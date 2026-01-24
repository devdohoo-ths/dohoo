import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';
import contactService from '../services/contactService.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// GET /api/chat-operations/chats - Listar chats do usuário
router.get('/chats', async (req, res) => {
  try {
    const userId = req.user.id;
    const { account_id } = req.query; // ✅ NOVO: Filtro opcional por account_id do WhatsApp
    
    // ✅ NOVO: Se account_id fornecido, buscar apenas chats desse número específico
    let chatIds = null;
    if (account_id) {
      console.log('🔍 [API] Filtrando chats por account_id:', account_id);
      
      // Buscar phone_number do account_id
      const { data: whatsappAccount, error: accountError } = await supabase
        .from('whatsapp_accounts')
        .select('phone_number, user_id')
        .eq('account_id', account_id)
        .eq('user_id', userId)
        .eq('status', 'connected')
        .single();
      
      if (whatsappAccount?.phone_number) {
        const phoneNumber = whatsappAccount.phone_number.replace(/\D/g, ''); // Remover caracteres não numéricos
        
        // ✅ CORREÇÃO: Buscar chats validando por account_id OU phone_number
        // Isso garante que encontre chats mesmo se a conta foi recriada com o mesmo número
        let allChatIds = new Set();
        
        // 1. Buscar por account_id (mais específico)
        const { data: messagesByAccountId } = await supabase
          .from('messages')
          .select('chat_id')
          .eq('user_id', userId)
          .eq('metadata->>account_id', account_id)
          .limit(1000);
        
        if (messagesByAccountId && messagesByAccountId.length > 0) {
          messagesByAccountId.forEach(m => allChatIds.add(m.chat_id));
          console.log(`✅ [API] Encontrados ${messagesByAccountId.length} mensagens com account_id ${account_id}`);
        }
        
        // 2. Buscar por phone_number (para contas recriadas ou mensagens antigas)
        const { data: messagesByPhone } = await supabase
          .from('messages')
          .select('chat_id')
          .eq('user_id', userId)
          .or(`sender_jid.ilike.%${phoneNumber}%,metadata->>target_jid.ilike.%${phoneNumber}%`)
          .limit(1000);
        
        if (messagesByPhone && messagesByPhone.length > 0) {
          messagesByPhone.forEach(m => allChatIds.add(m.chat_id));
          console.log(`✅ [API] Encontradas ${messagesByPhone.length} mensagens com phone_number ${phoneNumber}`);
        }
        
        if (allChatIds.size > 0) {
          chatIds = Array.from(allChatIds);
          console.log(`✅ [API] Total de ${chatIds.length} chats únicos encontrados para account_id ${account_id} / phone ${phoneNumber}`);
        } else {
          console.log(`⚠️ [API] Nenhum chat encontrado para account_id ${account_id} / phone ${phoneNumber}`);
        }
      } else {
        console.log('⚠️ [API] Account não encontrado ou não conectado:', account_id);
      }
    }
    
    // Construir query base
    let chatsQuery = supabase
      .from('chats')
      .select(`
        *,
        messages:messages(
          id,
          content,
          created_at,
          is_from_me,
          status
        )
      `)
      .eq('assigned_agent_id', userId)
      .eq('status', 'active');
    
    // ✅ NOVO: Aplicar filtro de chat_ids se account_id foi fornecido
    if (chatIds && chatIds.length > 0) {
      chatsQuery = chatsQuery.in('id', chatIds);
    } else if (chatIds && chatIds.length === 0) {
      // Se account_id foi fornecido mas não encontrou chats, retornar vazio
      return res.json({ 
        success: true,
        chats: []
      });
    }
    
    const { data: chats, error } = await chatsQuery.order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro ao buscar chats:', error);
      return res.status(500).json({ error: 'Erro ao buscar chats' });
    }

    // Processar chats para incluir contagem de mensagens não lidas
    const processedChats = (chats || []).map(chat => {
      const unreadCount = chat.messages?.filter(msg => 
        !msg.is_from_me && msg.status !== 'read'
      ).length || 0;
      
      const lastMessage = chat.messages?.[chat.messages.length - 1];
      
      return {
        ...chat,
        unread_count: unreadCount,
        last_message: lastMessage ? {
          content: lastMessage.content,
          created_at: lastMessage.created_at,
          is_from_me: lastMessage.is_from_me
        } : null,
        messages: undefined // Remover array de mensagens para reduzir payload
      };
    });
    
    res.json({ 
      success: true,
      chats: processedChats
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar chats:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/chat-operations/chats - Criar novo chat
router.post('/chats', async (req, res) => {
  try {
    const { name, platform = 'whatsapp', whatsapp_jid } = req.body;
    const userId = req.user.id;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome do chat é obrigatório' });
    }

    console.log('💬 [API] Criando novo chat:', { name, platform, whatsapp_jid });
    
    // Buscar organization_id do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('❌ [API] Erro ao buscar organização do usuário:', profileError);
      return res.status(400).json({ error: 'Usuário não possui organização válida' });
    }

    // Criar o chat
    const newChatData = {
      name,
      platform,
      status: 'active',
      priority: 'medium',
      assigned_agent_id: userId,
      organization_id: profile.organization_id
    };

    // Adicionar whatsapp_jid se fornecido
    if (whatsapp_jid) {
      newChatData.whatsapp_jid = whatsapp_jid;
    }

    const { data: newChat, error: createError } = await supabase
      .from('chats')
      .insert([newChatData])
      .select()
      .single();

    if (createError) {
      console.error('❌ [API] Erro ao criar chat:', createError);
      return res.status(500).json({ error: 'Erro ao criar chat' });
    }

    console.log('✅ [API] Chat criado com sucesso:', newChat.id);
    
    res.json({ 
      success: true,
      chat: newChat 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao criar chat:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/chat-operations/chats/:chatId/messages - Listar mensagens de um chat
router.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    console.log('💬 [API] Buscando mensagens do chat:', chatId, 'usuário:', userId);
    
    // Verificar se o chat pertence ao usuário
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, assigned_agent_id')
      .eq('id', chatId)
      .eq('assigned_agent_id', userId)
      .single();

    if (chatError || !chat) {
      console.error('❌ [API] Chat não encontrado ou não pertence ao usuário:', { chatError, chatId, userId });
      return res.status(404).json({ error: 'Chat não encontrado ou acesso negado' });
    }

    // Buscar mensagens do chat
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('❌ [API] Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }

    console.log(`✅ [API] ${messages?.length || 0} mensagens encontradas para chat ${chatId}`);
    
    res.json({ 
      success: true,
      messages: messages || []
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/chat-operations/chats/:chatId - Deletar conversa completa (chat e todas as mensagens)
// ✅ RESTRIÇÃO: Apenas super admins podem deletar conversas
router.delete('/chats/:chatId', requireSuperAdmin, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    console.log('🗑️ [API] Deletando conversa:', chatId, 'usuário:', userId);
    
    // 1. Verificar se o chat pertence ao usuário
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, assigned_agent_id, organization_id')
      .eq('id', chatId)
      .eq('assigned_agent_id', userId)
      .single();
    
    if (chatError || !chat) {
      console.error('❌ [API] Chat não encontrado ou não pertence ao usuário:', { chatError, chatId, userId });
      return res.status(404).json({ error: 'Chat não encontrado ou acesso negado' });
    }
    
    // 2. Deletar todas as mensagens do chat
    const { error: messagesDeleteError, count: messagesDeleted } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .eq('chat_id', chatId);
    
    if (messagesDeleteError) {
      console.error('❌ [API] Erro ao deletar mensagens:', messagesDeleteError);
      return res.status(500).json({ error: 'Erro ao deletar mensagens do chat' });
    }
    
    console.log(`✅ [API] ${messagesDeleted || 0} mensagens deletadas do chat ${chatId}`);
    
    // 3. Deletar o chat
    const { error: chatDeleteError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);
    
    if (chatDeleteError) {
      console.error('❌ [API] Erro ao deletar chat:', chatDeleteError);
      return res.status(500).json({ error: 'Erro ao deletar chat' });
    }
    
    console.log(`✅ [API] Chat ${chatId} deletado com sucesso`);
    
    res.json({ 
      success: true,
      message: 'Conversa deletada com sucesso',
      stats: {
        chatId,
        messagesDeleted: messagesDeleted || 0
      }
    });
    
  } catch (error) {
    console.error('❌ [API] Erro geral ao deletar conversa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/chat-operations/chats/:chatId/messages - Enviar mensagem
router.post('/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, message_type = 'text', reply_to } = req.body;
    const userId = req.user.id;
    
    if (!content) {
      return res.status(400).json({ error: 'Conteúdo da mensagem é obrigatório' });
    }

    console.log('💬 [API] Enviando mensagem para chat:', chatId, 'usuário:', userId);
    
    // Verificar se o chat pertence ao usuário
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, assigned_agent_id, organization_id')
      .eq('id', chatId)
      .eq('assigned_agent_id', userId)
      .single();

    if (chatError || !chat) {
      console.error('❌ [API] Chat não encontrado ou não pertence ao usuário:', { chatError, chatId, userId });
      return res.status(404).json({ error: 'Chat não encontrado ou acesso negado' });
    }

    // Criar a mensagem
    const messageData = {
      chat_id: chatId,
      content,
      message_type,
      is_from_me: true,
      sender_name: 'Você',
      status: 'sent',
      organization_id: chat.organization_id
    };

    // Adicionar reply_to se fornecido
    if (reply_to) {
      messageData.reply_to = reply_to;
    }

    const { data: newMessage, error: createError } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (createError) {
      console.error('❌ [API] Erro ao criar mensagem:', createError);
      return res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }

    console.log('✅ [API] Mensagem enviada com sucesso:', newMessage.id);

    // ✅ NOVO: Emitir evento Socket.IO para atualizar frontend em tempo real
    try {
      const io = global.io;
      if (io) {
        console.log('📡 [API] Emitindo evento new-message para atualização em tempo real');
        console.log('📡 [API] Dados do evento:', {
          userId,
          chatId,
          messageId: newMessage.id,
          organizationId: chat.organization_id
        });
        
        // ✅ Emitir para o usuário específico (sala que o frontend já está escutando)
        io.to(`user-${userId}`).emit('new-message', {
          chatId: chatId,
          message: newMessage,
          userId: userId,
          isAI: false
        });
        
        console.log('✅ [API] Evento new-message emitido para user-' + userId);
      } else {
        console.warn('⚠️ [API] Socket.IO não disponível (global.io) - mensagem não será atualizada em tempo real');
      }
    } catch (socketError) {
      console.error('❌ [API] Erro ao emitir evento Socket.IO (não crítico):', socketError);
      console.error('❌ [API] Stack:', socketError.stack);
    }

    // 📞 Capturar contato automaticamente após envio de mensagem
    try {
      // Buscar dados do chat para obter o número do destinatário
      const { data: chatData, error: chatDataError } = await supabase
        .from('chats')
        .select('whatsapp_jid, name')
        .eq('id', chatId)
        .single();

      if (!chatDataError && chatData?.whatsapp_jid) {
        // Extrair número do JID (formato: 5511999999999@s.whatsapp.net)
        const phoneNumber = chatData.whatsapp_jid.split('@')[0];
        const contactName = chatData.name || 'Cliente';

        await contactService.createContactFromMessage({
          phone: phoneNumber,
          name: contactName,
          organization_id: chat.organization_id,
          user_id: userId,
          last_interaction_at: new Date(),
          metadata: {
            created_from_sent_message: true,
            message_id: newMessage.id,
            chat_id: chatId
          }
        });

        console.log('📞 [API] Contato capturado automaticamente:', phoneNumber);
      }
    } catch (contactError) {
      // Não falhar o envio da mensagem por erro na captura do contato
      console.error('⚠️ [API] Erro ao capturar contato (não crítico):', contactError);
    }
    
    res.json({ 
      success: true,
      message: newMessage 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/chat-operations/chats/:chatId/mark-read - Marcar mensagens como lidas
router.post('/chats/:chatId/mark-read', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    console.log('💬 [API] Marcando mensagens como lidas para chat:', chatId, 'usuário:', userId);
    
    // Verificar se o chat pertence ao usuário
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, assigned_agent_id')
      .eq('id', chatId)
      .eq('assigned_agent_id', userId)
      .single();

    if (chatError || !chat) {
      console.error('❌ [API] Chat não encontrado ou não pertence ao usuário:', { chatError, chatId, userId });
      return res.status(404).json({ error: 'Chat não encontrado ou acesso negado' });
    }

    // Marcar mensagens como lidas
    const { error: updateError } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('chat_id', chatId)
      .eq('is_from_me', false)
      .neq('status', 'read');

    if (updateError) {
      console.error('❌ [API] Erro ao marcar mensagens como lidas:', updateError);
      return res.status(500).json({ error: 'Erro ao marcar mensagens como lidas' });
    }

    // ✅ OTIMIZADO: Verificar se unread_count já é 0 antes de atualizar (evitar PATCHs desnecessários)
    const { data: currentChat, error: getChatError } = await supabase
      .from('chats')
      .select('unread_count')
      .eq('id', chatId)
      .single();

    // Só atualizar se o unread_count não for 0
    if (!getChatError && currentChat && currentChat.unread_count !== 0) {
      const { error: chatUpdateError } = await supabase
        .from('chats')
        .update({ 
          unread_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (chatUpdateError) {
        console.error('❌ [API] Erro ao atualizar unread_count do chat:', chatUpdateError);
        // Não retornar erro aqui, pois as mensagens já foram marcadas como lidas
      }
    } else {
      // ✅ OTIMIZADO: Não fazer PATCH se já está em 0 - reduz requisições
      console.log('✅ [API] unread_count já está em 0, pulando atualização do chat');
    }

    console.log('✅ [API] Mensagens marcadas como lidas com sucesso');
    
    res.json({ 
      success: true,
      message: 'Mensagens marcadas como lidas'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao marcar mensagens como lidas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/chat-operations/update-contacts - Atualizar informações dos contatos
router.post('/update-contacts', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('🔄 [API] Iniciando atualização de contatos para usuário:', userId);
    
    // Buscar conta WhatsApp do usuário
    const { data: whatsappAccount, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single();

    if (accountError || !whatsappAccount) {
      console.error('❌ [API] Conta WhatsApp não encontrada ou não conectada');
      return res.status(404).json({ 
        success: false, 
        error: 'Conta WhatsApp não encontrada ou não conectada' 
      });
    }

    console.log('✅ [API] Conta WhatsApp encontrada:', whatsappAccount.name);

    // ✅ NOVO: Importar função de atualização do WhatsApp
    const { updateExistingContactInfo, fixMessageSenderNames } = await import('../services/multiWhatsapp.js');
    
    // ✅ NOVO: Buscar conexão ativa
    const { activeConnections } = await import('../services/multiWhatsapp.js');
    const connection = activeConnections.get(whatsappAccount.account_id);
    
    if (!connection || !connection.socket) {
      console.error('❌ [API] Conexão WhatsApp não encontrada');
      return res.status(404).json({ 
        success: false, 
        error: 'Conexão WhatsApp não encontrada' 
      });
    }

    console.log('✅ [API] Conexão WhatsApp encontrada, iniciando atualização...');

    // ✅ NOVO: Executar atualização real
    await updateExistingContactInfo(
      connection.socket, 
      whatsappAccount.account_id, 
      whatsappAccount.name
    );

    // ✅ NOVO: Corrigir nomes nas mensagens também
    await fixMessageSenderNames(
      connection.socket, 
      whatsappAccount.account_id, 
      whatsappAccount.name
    );

    console.log('✅ [API] Atualização de contatos e mensagens concluída');
    
    res.json({ 
      success: true,
      message: `Atualização de contatos e mensagens concluída para ${whatsappAccount.name}`,
      stats: {
        accountName: whatsappAccount.name,
        accountId: whatsappAccount.account_id
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar contatos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/chat-operations/update-specific-contact - Atualizar contato específico
router.post('/update-specific-contact', async (req, res) => {
  try {
    const { jid } = req.body;
    const userId = req.user.id;
    
    console.log('👤 [API] Atualizando contato específico:', jid, 'usuário:', userId);
    
    if (!jid) {
      return res.status(400).json({ error: 'JID é obrigatório' });
    }

    // Buscar conta WhatsApp do usuário
    const { data: whatsappAccount, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, organization_id')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single();

    if (accountError || !whatsappAccount) {
      console.error('❌ [API] Conta WhatsApp não encontrada:', accountError);
      return res.status(404).json({ 
        success: false, 
        error: 'Conta WhatsApp não encontrada ou não conectada' 
      });
    }

    console.log('✅ [API] Conta WhatsApp encontrada:', whatsappAccount.name);

    // Importar função de atualização do WhatsApp
    const { updateExistingContactInfo, activeConnections } = await import('../services/multiWhatsapp.js');
    
    // Buscar conexão ativa
    const connection = activeConnections.get(whatsappAccount.account_id);
    
    if (!connection || !connection.socket) {
      console.error('❌ [API] Conexão WhatsApp não encontrada');
      return res.status(404).json({ 
        success: false, 
        error: 'Conexão WhatsApp não encontrada' 
      });
    }

    console.log('✅ [API] Conexão WhatsApp encontrada, atualizando contato específico...');

    // Buscar chat específico
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid')
      .eq('whatsapp_jid', jid)
      .eq('assigned_agent_id', userId)
      .eq('organization_id', whatsappAccount.organization_id)
      .single();

    if (chatError || !chat) {
      console.error('❌ [API] Chat não encontrado:', chatError);
      return res.status(404).json({ 
        success: false, 
        error: 'Chat não encontrado' 
      });
    }

    // Importar getContactInfo
    const { getContactInfo } = await import('../services/multiWhatsapp.js');
    
    // Buscar informações do contato
    const contactInfo = await getContactInfo(connection.socket, jid);
    
    console.log('📋 [API] Informações obtidas:', {
      chatId: chat.id,
      oldName: chat.name,
      newName: contactInfo.name,
      hasPicture: !!contactInfo.profilePicture,
      exists: contactInfo.exists
    });

    // Atualizar chat se temos um nome
    if (contactInfo.name) {
      const { error: updateError } = await supabase
        .from('chats')
        .update({
          name: contactInfo.name,
          avatar_url: contactInfo.profilePicture || chat.avatar_url
        })
        .eq('id', chat.id);

      if (updateError) {
        console.error('❌ [API] Erro ao atualizar chat:', updateError);
        return res.status(500).json({ 
          success: false, 
          error: 'Erro ao atualizar chat' 
        });
      }

      console.log('✅ [API] Chat atualizado com sucesso');
      
      res.json({ 
        success: true,
        message: `Contato atualizado: ${chat.name} → ${contactInfo.name}`,
        data: {
          chatId: chat.id,
          oldName: chat.name,
          newName: contactInfo.name,
          hasPicture: !!contactInfo.profilePicture
        }
      });
    } else {
      console.log('⚠️ [API] Nenhum nome encontrado para o contato');
      res.json({ 
        success: false,
        message: 'Nenhum nome encontrado para o contato',
        data: {
          chatId: chat.id,
          currentName: chat.name,
          phoneNumber: jid.split('@')[0]
        }
      });
    }

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar contato específico:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/chat-operations/fix-whatsapp-jids - Corrigir whatsapp_jid incorretos nos chats
router.post('/fix-whatsapp-jids', async (req, res) => {
  console.log('🔧 [FIX JIDS] Iniciando correção de whatsapp_jid incorretos...');
  
  try {
    const userId = req.user.id;
    
    // Buscar chats com whatsapp_jid que terminam com @lid ou têm números incorretos
    const { data: allChats, error: chatsError } = await supabase
      .from('chats')
      .select('id, whatsapp_jid, name, assigned_agent_id, organization_id')
      .eq('assigned_agent_id', userId)
      .eq('status', 'active')
      .not('whatsapp_jid', 'is', null);
    
    if (chatsError) {
      console.error('❌ [FIX JIDS] Erro ao buscar chats:', chatsError);
      return res.status(500).json({ success: false, error: chatsError.message });
    }
    
    console.log(`📊 [FIX JIDS] Encontrados ${allChats?.length || 0} chats para verificar`);
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const chat of allChats || []) {
      try {
        // Verificar se o whatsapp_jid termina com @lid (incorreto)
        if (chat.whatsapp_jid?.endsWith('@lid')) {
          console.log(`⚠️ [FIX JIDS] Chat ${chat.id} tem whatsapp_jid incorreto: ${chat.whatsapp_jid}`);
          
          // Buscar a última mensagem do chat para extrair o target_jid correto do metadata
          const { data: lastMessage, error: messageError } = await supabase
            .from('messages')
            .select('metadata, sender_jid, is_from_me')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (messageError) {
            console.error(`❌ [FIX JIDS] Erro ao buscar mensagem do chat ${chat.id}:`, messageError);
            errors++;
            continue;
          }
          
          let correctJid = null;
          
          // Tentar extrair o JID correto do metadata
          if (lastMessage?.metadata?.target_jid) {
            correctJid = lastMessage.metadata.target_jid;
            console.log(`✅ [FIX JIDS] JID correto encontrado no metadata: ${correctJid}`);
          } else if (lastMessage && !lastMessage.is_from_me && lastMessage.sender_jid && !lastMessage.sender_jid.endsWith('@lid')) {
            // Se é mensagem recebida, o sender_jid é o JID correto
            correctJid = lastMessage.sender_jid;
            console.log(`✅ [FIX JIDS] JID correto encontrado no sender_jid: ${correctJid}`);
          } else if (lastMessage && lastMessage.is_from_me) {
            // Se é mensagem enviada, buscar o target_jid de outra mensagem recebida do mesmo chat
            const { data: receivedMessage } = await supabase
              .from('messages')
              .select('sender_jid')
              .eq('chat_id', chat.id)
              .eq('is_from_me', false)
              .not('sender_jid', 'like', '%@lid%')
              .limit(1)
              .maybeSingle();
            
            if (receivedMessage?.sender_jid) {
              correctJid = receivedMessage.sender_jid;
              console.log(`✅ [FIX JIDS] JID correto encontrado em mensagem recebida: ${correctJid}`);
            }
          }
          
          if (correctJid && correctJid !== chat.whatsapp_jid) {
            // Atualizar o whatsapp_jid do chat
            const { error: updateError } = await supabase
              .from('chats')
              .update({ whatsapp_jid: correctJid })
              .eq('id', chat.id);
            
            if (updateError) {
              console.error(`❌ [FIX JIDS] Erro ao atualizar chat ${chat.id}:`, updateError);
              errors++;
            } else {
              console.log(`✅ [FIX JIDS] Chat ${chat.id} corrigido: ${chat.whatsapp_jid} → ${correctJid}`);
              fixed++;
            }
          } else {
            console.log(`⚠️ [FIX JIDS] Não foi possível encontrar JID correto para chat ${chat.id}`);
            skipped++;
          }
        } else {
          // Verificar se o número parece incorreto (muito longo ou formato estranho)
          const phoneNumber = chat.whatsapp_jid?.split('@')[0];
          if (phoneNumber && phoneNumber.length > 15) {
            console.log(`⚠️ [FIX JIDS] Chat ${chat.id} tem número suspeito: ${phoneNumber}`);
            
            // Buscar mensagem para verificar o JID correto
            const { data: lastMessage } = await supabase
              .from('messages')
              .select('metadata, sender_jid, is_from_me')
              .eq('chat_id', chat.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (lastMessage?.metadata?.target_jid && !lastMessage.metadata.target_jid.endsWith('@lid')) {
              const correctJid = lastMessage.metadata.target_jid;
              const { error: updateError } = await supabase
                .from('chats')
                .update({ whatsapp_jid: correctJid })
                .eq('id', chat.id);
              
              if (!updateError) {
                console.log(`✅ [FIX JIDS] Chat ${chat.id} corrigido: ${chat.whatsapp_jid} → ${correctJid}`);
                fixed++;
              } else {
                errors++;
              }
            } else {
              skipped++;
            }
          }
        }
      } catch (chatError) {
        console.error(`❌ [FIX JIDS] Erro ao processar chat ${chat.id}:`, chatError);
        errors++;
      }
    }
    
    console.log(`🎉 [FIX JIDS] Correção concluída: ${fixed} corrigidos, ${skipped} ignorados, ${errors} erros`);
    res.json({ 
      success: true, 
      message: `${fixed} chats foram corrigidos`,
      stats: {
        total: allChats?.length || 0,
        fixed,
        skipped,
        errors
      }
    });
    
  } catch (error) {
    console.error('❌ [FIX JIDS] Erro durante correção:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno durante correção de whatsapp_jid' 
    });
  }
});

// PATCH /api/chat-operations/messages/:messageId - Atualizar mensagem (para reenvio)
router.patch('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status, content } = req.body;
    const userId = req.user.id;
    
    console.log('💬 [API] Atualizando mensagem:', messageId, 'usuário:', userId);
    
    // Verificar se a mensagem pertence a um chat do usuário
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        *,
        chat:chats!inner(
          id,
          assigned_agent_id
        )
      `)
      .eq('id', messageId)
      .eq('chat.assigned_agent_id', userId)
      .single();

    if (messageError || !message) {
      console.error('❌ [API] Mensagem não encontrada ou não pertence ao usuário:', { messageError, messageId, userId });
      return res.status(404).json({ error: 'Mensagem não encontrada ou acesso negado' });
    }

    // Atualizar a mensagem
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (content !== undefined) updateData.content = content;
    
    updateData.updated_at = new Date().toISOString();

    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [API] Erro ao atualizar mensagem:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar mensagem' });
    }

    console.log('✅ [API] Mensagem atualizada com sucesso');
    
    res.json({ 
      success: true,
      message: updatedMessage 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar mensagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 