import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { sendMessageByAccount, sendImageByAccount, sendDocumentByAccount, sendAudioByAccount, checkConnectionStatus } from '../services/multiWhatsapp.js';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const router = express.Router();

// Debug middleware removido - funcionalidade funcionando perfeitamente

// Health check específico para chat
router.get('/health', (req, res) => {
  console.log('💚 CHAT HEALTH: Verificação de saúde do chat router');
  res.json({ 
    success: true, 
    message: 'Chat router funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Marcar mensagens como lidas
router.post('/:chatId/mark-read', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const user_id = req.user.id;

    console.log(`🔍 [DEBUG] Tentando marcar como lidas:`, {
      chatId,
      userId: user_id,
      timestamp: new Date().toISOString()
    });

    // ✅ Verificar se o chat pertence ao usuário e à organização
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, assigned_agent_id, name, status, organization_id')
      .eq('id', chatId)
      .eq('assigned_agent_id', user_id)
      .eq('organization_id', req.user.organization_id) // ✅ FILTRO DE ORGANIZAÇÃO
      .single();

    console.log(`🔍 [DEBUG] Resultado da busca do chat:`, {
      chatFound: !!chat,
      chatError: chatError?.message,
      chatData: chat ? {
        id: chat.id,
        name: chat.name,
        status: chat.status,
        assigned_agent_id: chat.assigned_agent_id
      } : null
    });

    if (chatError || !chat) {
      console.log(`❌ Chat ${chatId} não encontrado para usuário ${user_id}`);
      
      // Buscar o chat sem filtro de usuário para debug
      const { data: allChats, error: allChatsError } = await supabase
        .from('chats')
        .select('id, assigned_agent_id, name, status')
        .eq('id', chatId);
      
      console.log(`🔍 [DEBUG] Busca sem filtro de usuário:`, {
        foundChats: allChats?.length || 0,
        error: allChatsError?.message,
        chats: allChats
      });
      
      return res.status(404).json({ 
        success: false, 
        error: 'Chat não encontrado ou não autorizado',
        debug: {
          chatId,
          userId: user_id,
          chatExists: allChats?.length > 0,
          chatOwner: allChats?.[0]?.assigned_agent_id
        }
      });
    }

    // Marcar mensagens como lidas
    const { error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('chat_id', chatId)
      .eq('is_from_me', false)
      .neq('status', 'read');

    if (error) {
      console.error('❌ Erro ao marcar mensagens como lidas:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
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
        console.error('❌ Erro ao atualizar unread_count do chat:', chatUpdateError);
        // Não retornar erro aqui, pois as mensagens já foram marcadas como lidas
      }
    } else {
      // ✅ OTIMIZADO: Não fazer PATCH se já está em 0 - reduz requisições
      console.log('✅ [API] unread_count já está em 0, pulando atualização do chat');
    }

    console.log(`✅ Mensagens do chat ${chatId} marcadas como lidas`);
    res.json({ 
      success: true, 
      message: 'Mensagens marcadas como lidas' 
    });
  } catch (error) {
    console.error('❌ Erro na rota mark-read:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Configuração do multer para salvar arquivos em /uploads/{chatId}/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { chatId } = req.params;
    const uploadPath = path.join(__dirname, '..', 'uploads', chatId);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    console.log('📁 Multer processando arquivo:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Aceitar imagens, pdf, doc, xls, áudio, vídeo
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/m4a',
      'video/mp4', 'video/quicktime',
      'application/zip', 'application/x-zip-compressed',
      'text/plain',
      'application/octet-stream' // Aceitar arquivos sem tipo MIME específico
    ];
    
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      console.log('✅ Arquivo aceito:', file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ Arquivo rejeitado:', file.mimetype);
      cb(new Error('Tipo de arquivo não suportado'));
    }
  }
});

// Enviar mensagem
router.post('/:chatId/send', authenticateToken, async (req, res) => {
  const { chatId } = req.params;
  const { message, agentName, replyTo } = req.body;
  console.log("message: ", message);
  console.log("agentName: ", agentName);
  console.log("replyTo: ", replyTo);
  console.log("replyTo type: ", typeof replyTo);
  console.log("replyTo === null: ", replyTo === null);
  console.log("replyTo === undefined: ", replyTo === undefined);
  if (!chatId || !message) {
    return res.status(400).json({ error: 'Chat ID e mensagem são obrigatórios' });
  }

  try {
    // ✅ 1. Buscar o chat com validação de organização
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('whatsapp_jid, assigned_agent_id, name, organization_id')
      .eq('id', chatId)
      .eq('organization_id', req.user.organization_id) // ✅ FILTRO DE ORGANIZAÇÃO
      .single();

    if (chatError || !chat) {
      console.error('❌ [SECURITY] Chat não encontrado ou não pertence à organização:', chatId);
      return res.status(404).json({ error: 'Chat não encontrado' });
    }

    // ✅ 2. Validar se o chat pertence à organização do usuário
    if (chat.organization_id !== req.user.organization_id) {
      console.error(`❌ [SECURITY] Tentativa de enviar mensagem para chat de organização diferente: ${chatId}`);
      return res.status(403).json({ error: 'Acesso negado: chat não pertence à sua organização' });
    }

    // ✅ 3. Garantir que o requisitante é o dono do chat
    if (chat.assigned_agent_id !== req.user.id) {
      console.error(`❌ [SECURITY] Tentativa de enviar mensagem para chat de outro usuário: ${chatId}`);
      return res.status(403).json({ error: 'Acesso negado: você não é o responsável por este chat' });
    }

    if (!chat.assigned_agent_id) {
      return res.status(400).json({ error: 'Chat não possui um agente responsável para enviar a mensagem.' });
    }
    
    if (!chat.whatsapp_jid) {
      return res.status(400).json({ error: 'Chat não possui um número de WhatsApp de destino (JID).' });
    }

    // ✅ 3. Buscar a conta do WhatsApp com validação de organização
    // ✅ 3. VALIDAÇÃO DE SEGURANÇA EM DUAS ETAPAS
    // Etapa 1: Buscar conta e validar organização
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, organization_id, user_id')
      .eq('organization_id', req.user.organization_id)
      .eq('user_id', chat.assigned_agent_id) // ✅ PRIMEIRO: Filtrar por organização
      .single();

    if (accountError || !account) {
      console.error('❌ [SECURITY] Nenhuma conta WhatsApp encontrada para a organização:', req.user.organization_id);
      return res.status(404).json({ error: 'Conta do WhatsApp não encontrada para esta organização' });
    }

    // ✅ Etapa 2: Validar permissões do usuário
    // Verificar se o usuário é o dono da conta OU tem permissões de admin/super_admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        roles (
          id,
          name,
          permissions
        )
      `)
      .eq('user_id', req.user.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    let userRoleName = req.user.user_role; // fallback
    if (!roleError && userRole?.roles) {
      userRoleName = userRole.roles.name;
    }

    // ✅ Verificar permissões: usuário pode usar a conta se:
    // 1. É o dono da conta, OU
    // 2. É admin/super_admin da organização
    const canUseAccount = account.user_id === req.user.id || 
                         userRoleName === 'admin' || 
                         userRoleName === 'super_admin';

    if (!canUseAccount) {
      console.error(`❌ [SECURITY] Usuário ${req.user.id} (${userRoleName}) tentou usar conta de outro usuário: ${account.user_id}`);
      return res.status(403).json({ error: 'Você não tem permissão para usar esta conta WhatsApp' });
    }

    console.log(`✅ [SECURITY] Usuário ${req.user.id} (${userRoleName}) autorizado a usar conta ${account.account_id}`);

    // 3. Se for uma resposta, buscar a mensagem original
    let replyToMessage = null;
    let originalMessageContent = null;
    let originalMessageIsFromMe = false;
    let originalMessageObject = null;
    let originalSenderJid = null;
    let originalMessageKey = null;
    if (replyTo) {
      console.log('🔄 Buscando mensagem original para resposta:', replyTo);
      const { data: originalMessage, error: originalError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', replyTo)
        .eq('chat_id', chatId)
        .single();

      if (originalError || !originalMessage) {
        console.error('❌ Erro ao buscar mensagem original:', originalError);
        return res.status(404).json({ error: 'Mensagem original não encontrada' });
      }

      // Buscar a mensagem no WhatsApp usando o whatsapp_message_id
      if (originalMessage.whatsapp_message_id) {
        replyToMessage = originalMessage.whatsapp_message_id;
        originalMessageContent = originalMessage.content;
        originalMessageIsFromMe = originalMessage.is_from_me;
        originalMessageObject = originalMessage.message_object;
        originalSenderJid = originalMessage.sender_jid;
        originalMessageKey = originalMessage.message_key;
        console.log('✅ Mensagem original encontrada para resposta:', replyToMessage, originalMessageContent);
      } else {
        console.log('⚠️ Mensagem original não tem whatsapp_message_id, enviando sem resposta');
      }
    }

    // 4. Enviar a mensagem usando o serviço multiWhatsapp
    // Enviar apenas o conteúdo da mensagem, sem formatação
    console.log('📤 Enviando mensagem:', message);
    
    const result = await sendMessageByAccount(account.account_id, chat.whatsapp_jid, message, replyToMessage, originalMessageContent, originalMessageIsFromMe, originalMessageObject, originalSenderJid, originalMessageKey);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Erro ao enviar mensagem' });
    }

    // 5. Atualizar a mensagem existente com o whatsapp_message_id e status
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'sent',
        whatsapp_message_id: result.whatsapp_message_id || null,
        reply_to: replyTo || null,
        metadata: {
          timestamp: new Date().toISOString(),
          isReply: !!replyTo,
          whatsapp_sent: true
        }
      })
      .eq('chat_id', chatId)
      .eq('content', message)
      .eq('is_from_me', true)
      .eq('status', 'sending')
      .order('created_at', { ascending: false })
      .limit(1)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar mensagem no banco:', updateError);
      // Não retornar erro aqui, pois a mensagem já foi enviada
    } else {
      console.log('✅ Mensagem atualizada no banco:', updatedMessage?.id);
    }

    res.json({ 
      success: true, 
      message: 'Mensagem enviada com sucesso',
      messageId: updatedMessage?.id || null
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

// Rota para upload de arquivos
router.post('/:chatId/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const { chatId } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo não enviado' });
  }
  
  // Capturar caption do FormData
  const caption = req.body.caption || '';
  
  console.log('📁 Upload de arquivo:', {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    chatId: chatId,
    caption: caption
  });
  
  // Caminho relativo para servir o arquivo
  const relativePath = `/uploads/${chatId}/${req.file.filename}`;

  // ✅ Buscar o chat com validação de organização
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('whatsapp_jid, assigned_agent_id, name, organization_id')
    .eq('id', chatId)
    .eq('organization_id', req.user.organization_id) // ✅ FILTRO DE ORGANIZAÇÃO
    .single();

  if (chatError || !chat) {
    console.error('❌ [SECURITY] Chat não encontrado ou não pertence à organização:', chatId);
    return res.status(404).json({ error: 'Chat não encontrado' });
  }

  // ✅ Validar se o chat pertence à organização do usuário
  if (chat.organization_id !== req.user.organization_id) {
    console.error(`❌ [SECURITY] Tentativa de upload para chat de organização diferente: ${chatId}`);
    return res.status(403).json({ error: 'Acesso negado: chat não pertence à sua organização' });
  }

  // ✅ Garantir que o requisitante é o dono do chat
  if (chat.assigned_agent_id !== req.user.id) {
    console.error(`❌ [SECURITY] Tentativa de upload para chat de outro usuário: ${chatId}`);
    return res.status(403).json({ error: 'Acesso negado: você não é o responsável por este chat' });
  }

  if (!chat.assigned_agent_id) {
    return res.status(400).json({ error: 'Chat não possui um agente responsável para enviar a mensagem.' });
  }
  if (!chat.whatsapp_jid) {
    return res.status(400).json({ error: 'Chat não possui um número de WhatsApp de destino (JID).' });
  }

  // ✅ Buscar a conta do WhatsApp com validação de organização
  const { data: account, error: accountError } = await supabase
    .from('whatsapp_accounts')
    .select('account_id, organization_id')
    .eq('user_id', chat.assigned_agent_id)
    .eq('organization_id', req.user.organization_id) // ✅ FILTRO DE ORGANIZAÇÃO
    .single();

  if (accountError || !account) {
    console.error('❌ [SECURITY] Conta WhatsApp não encontrada ou não pertence à organização:', chat.assigned_agent_id);
    return res.status(404).json({ error: 'Conta do WhatsApp para este agente não foi encontrada' });
  }

  // ✅ Validar se a conta pertence à organização correta
  if (account.organization_id !== req.user.organization_id) {
    console.error(`❌ [SECURITY] Tentativa de usar conta de organização diferente: ${account.account_id}`);
    return res.status(403).json({ error: 'Acesso negado: conta não pertence à sua organização' });
  }

  // Se for imagem, enviar via Baileys
  if (req.file.mimetype.startsWith('image/')) {
    const imagePath = path.join(__dirname, '..', 'uploads', chatId, req.file.filename);
    const result = await sendImageByAccount(account.account_id, chat.whatsapp_jid, imagePath, caption);
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Erro ao enviar imagem para o WhatsApp' });
    }

    // Salvar mensagem com media_url no banco (NUNCA salvar caminho no content)
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        content: caption || '', // Usar caption se existir, senão string vazia
        message_type: 'image',
        media_url: relativePath,
        is_from_me: true,
        sender_name: 'Eu',
        status: 'sent',
        organization_id: chat.organization_id,
        whatsapp_message_id: result.whatsapp_message_id || null, // Salvar o ID da mensagem do WhatsApp
        metadata: {
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          timestamp: new Date().toISOString(),
          hasCaption: !!caption
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('Erro ao salvar mensagem de imagem:', messageError);
    }

    return res.json({ success: true, url: relativePath, filename: req.file.originalname, whatsapp: 'Imagem enviada para o cliente' });
  }

  // Se for áudio, enviar via Baileys
  if (req.file.mimetype.startsWith('audio/')) {
    console.log('🎵 Processando áudio:', req.file.mimetype);
    
    // Verificar status da conexão antes de enviar
    const connectionStatus = checkConnectionStatus(account.account_id);
    console.log('🎵 Status da conexão WhatsApp:', connectionStatus);
    
    if (!connectionStatus.connected) {
      console.error('❌ WhatsApp não está conectado:', connectionStatus.error);
      return res.status(500).json({ error: `WhatsApp não está conectado: ${connectionStatus.error}` });
    }
    
    const audioPath = path.join(__dirname, '..', 'uploads', chatId, req.file.filename);
    const result = await sendAudioByAccount(account.account_id, chat.whatsapp_jid, audioPath, req.file.mimetype, caption);
    console.log('🎵 Resultado do envio de áudio:', result);
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Erro ao enviar áudio para o WhatsApp' });
    }

    // Salvar mensagem com media_url no banco (NUNCA salvar caminho no content)
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        content: caption || '', // Usar caption se existir, senão string vazia
        message_type: 'audio',
        media_url: relativePath,
        is_from_me: true,
        sender_name: 'Eu',
        status: 'sent',
        organization_id: chat.organization_id,
        whatsapp_message_id: result.whatsapp_message_id || null, // Salvar o ID da mensagem do WhatsApp
        metadata: {
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          timestamp: new Date().toISOString(),
          hasCaption: !!caption
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Erro ao salvar mensagem de áudio:', messageError);
    } else {
      console.log('✅ Mensagem de áudio salva no banco:', savedMessage);
    }

    return res.json({ success: true, url: relativePath, filename: req.file.originalname, whatsapp: 'Áudio enviado para o cliente' });
  }

  // Se for outro arquivo (documento), enviar via Baileys
  if (req.file.mimetype && req.file.mimetype !== '' && req.file.mimetype !== 'application/octet-stream') {
    const filePath = path.join(__dirname, '..', 'uploads', chatId, req.file.filename);
    const result = await sendDocumentByAccount(
      account.account_id,
      chat.whatsapp_jid,
      filePath,
      req.file.mimetype,
      req.file.originalname,
      caption
    );
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Erro ao enviar documento para o WhatsApp' });
    }

    // Salvar mensagem com media_url no banco (NUNCA salvar caminho no content)
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        content: caption || '', // Usar caption se existir, senão string vazia
        message_type: 'file',
        media_url: relativePath,
        is_from_me: true,
        sender_name: 'Eu',
        status: 'sent',
        organization_id: chat.organization_id,
        whatsapp_message_id: result.whatsapp_message_id || null, // Salvar o ID da mensagem do WhatsApp
        metadata: {
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          timestamp: new Date().toISOString(),
          hasCaption: !!caption
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('Erro ao salvar mensagem de arquivo:', messageError);
    }

    return res.json({ success: true, url: relativePath, filename: req.file.originalname, whatsapp: 'Documento enviado para o cliente' });
  }

  // Para outros casos, apenas salvar e retornar o link
  const { data: savedMessage, error: messageError } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      content: caption || '', // Usar caption se existir, senão string vazia
      message_type: 'file',
      media_url: relativePath,
      is_from_me: true,
      sender_name: 'Eu',
      status: 'sent',
      organization_id: chat.organization_id,
      metadata: {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        timestamp: new Date().toISOString(),
        hasCaption: !!caption
      }
    })
    .select()
    .single();

  if (messageError) {
    console.error('Erro ao salvar mensagem de arquivo:', messageError);
  }

  res.json({ success: true, url: relativePath, filename: req.file.originalname });
});

// Obter usuário atual
router.get('/current-user', authenticateToken, async (req, res) => {
  try {
    res.json({ 
      success: true, 
      user: req.user 
    });
  } catch (error) {
    console.error('❌ Erro ao obter usuário atual:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Obter sessão atual (substituir chamadas diretas do frontend)
router.get('/session', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.json({ 
        success: true, 
        session: null 
      });
    }

    // Verificar token com Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.json({ 
        success: true, 
        session: null 
      });
    }

    res.json({ 
      success: true, 
      session: {
        access_token: token,
        user: user
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter sessão:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Criar novo chat
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, platform, whatsapp_jid } = req.body;
    const user_id = req.user.id;

    if (!name || !platform) {
      return res.status(400).json({ 
        success: false, 
        error: 'name e platform são obrigatórios' 
      });
    }

    // Buscar organization_id do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user_id)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('Erro ao buscar organização do usuário:', profileError);
      return res.status(400).json({ 
        success: false, 
        error: 'Usuário não possui organização válida' 
      });
    }

    // Criar o chat
    const newChatData = {
      name,
      platform,
      status: 'active',
      priority: 'medium',
      assigned_agent_id: user_id,
      organization_id: profile.organization_id
    };

    // Adicionar whatsapp_jid se fornecido
    if (whatsapp_jid) {
      // ✅ CRÍTICO: Bloquear criação de chats para newsletter/updates
      if (whatsapp_jid.includes('@newsletter') || whatsapp_jid.includes('@updates')) {
        console.log(`🚫 [API] Tentativa de criar chat para newsletter/updates bloqueada: ${whatsapp_jid}`);
        return res.status(400).json({ 
          success: false, 
          error: 'Não é permitido criar chats para newsletter ou updates do WhatsApp' 
        });
      }
      newChatData.whatsapp_jid = whatsapp_jid;
    }

    const { data: newChat, error: createError } = await supabase
      .from('chats')
      .insert([newChatData])
      .select()
      .single();

    if (createError) {
      console.error('Erro ao criar chat:', createError);
      return res.status(500).json({ 
        success: false, 
        error: createError.message 
      });
    }

    console.log('✅ Chat criado com sucesso:', newChat);
    res.json({ 
      success: true, 
      chat: newChat 
    });

  } catch (error) {
    console.error('❌ Erro ao criar chat:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Verificar se chat já existe para o usuário atual
router.get('/check-existing', authenticateToken, async (req, res) => {
  try {
    const { whatsapp_jid } = req.query;
    const user_id = req.user.id;

    if (!whatsapp_jid) {
      return res.status(400).json({ 
        success: false, 
        error: 'whatsapp_jid é obrigatório' 
      });
    }

    // ✅ Verificar se existe chat com este JID E atribuído ao usuário atual E da mesma organização
    const { data: existingChat, error } = await supabase
      .from('chats')
      .select('*')
      .eq('whatsapp_jid', whatsapp_jid)
      .eq('assigned_agent_id', user_id)
      .eq('organization_id', req.user.organization_id) // ✅ FILTRO DE ORGANIZAÇÃO
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao verificar chat existente:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    console.log(`🔍 Verificando chat para usuário ${user_id} com JID ${whatsapp_jid}:`, existingChat ? 'ENCONTRADO' : 'NÃO ENCONTRADO');

    res.json({ 
      success: true, 
      exists: !!existingChat,
      chat: existingChat || null
    });

  } catch (error) {
    console.error('❌ Erro ao verificar chat existente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Rota para verificar status da conexão WhatsApp
router.get('/connection-status/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const status = checkConnectionStatus(accountId);
    res.json(status);
  } catch (error) {
    console.error('❌ Erro ao verificar status da conexão:', error);
    res.status(500).json({ error: 'Erro ao verificar status da conexão' });
  }
});

// Rotas de teste removidas - funcionalidade principal funcionando

// REMOVIDO: Rota mark-read duplicada (movida para o início do arquivo)

// Rota para limpar chats duplicados
router.post('/clean-duplicates', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('🔍 Iniciando limpeza de chats duplicados para usuário:', user_id);
    
    // ✅ Buscar todos os chats do WhatsApp do usuário da organização
    const { data: chats, error } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid, assigned_agent_id, created_at, organization_id')
      .eq('platform', 'whatsapp')
      .eq('assigned_agent_id', user_id)
      .eq('organization_id', req.user.organization_id) // ✅ FILTRO DE ORGANIZAÇÃO
      .not('whatsapp_jid', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar chats:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`📋 Encontrados ${chats.length} chats do WhatsApp do usuário`);

    // Agrupar chats por whatsapp_jid
    const groupedChats = {};
    for (const chat of chats) {
      const jid = chat.whatsapp_jid;
      if (!groupedChats[jid]) {
        groupedChats[jid] = [];
      }
      groupedChats[jid].push(chat);
    }

    // Identificar duplicatas
    const duplicates = [];
    for (const [jid, chatList] of Object.entries(groupedChats)) {
      if (chatList.length > 1) {
        console.log(`📱 Duplicatas encontradas para ${jid}:`, chatList.length);
        duplicates.push({ jid, chats: chatList });
      }
    }

    console.log(`🔍 Encontradas ${duplicates.length} duplicatas`);

    let removedCount = 0;
    let movedMessagesCount = 0;

    // Para cada grupo de duplicatas, manter apenas o mais antigo
    for (const duplicate of duplicates) {
      const { jid, chats: duplicateChats } = duplicate;
      
      // Ordenar por data de criação (mais antigo primeiro)
      duplicateChats.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      const keepChat = duplicateChats[0]; // Manter o mais antigo
      const removeChats = duplicateChats.slice(1); // Remover os outros

      console.log(`📱 Para ${jid}:`);
      console.log(`  ✅ Mantendo: ${keepChat.id} (${keepChat.name}) - ${keepChat.created_at}`);
      
      for (const removeChat of removeChats) {
        console.log(`  ❌ Removendo: ${removeChat.id} (${removeChat.name}) - ${removeChat.created_at}`);
        
        // Mover mensagens do chat duplicado para o chat principal
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id')
          .eq('chat_id', removeChat.id);

        if (messagesError) {
          console.error(`❌ Erro ao buscar mensagens do chat ${removeChat.id}:`, messagesError);
          continue;
        }

        if (messages && messages.length > 0) {
          console.log(`  📝 Movendo ${messages.length} mensagens para o chat principal`);
          
          const { error: updateError } = await supabase
            .from('messages')
            .update({ chat_id: keepChat.id })
            .eq('chat_id', removeChat.id);

          if (updateError) {
            console.error(`❌ Erro ao mover mensagens:`, updateError);
            continue;
          }
          
          movedMessagesCount += messages.length;
        }

        // Remover o chat duplicado
        const { error: deleteError } = await supabase
          .from('chats')
          .delete()
          .eq('id', removeChat.id);

        if (deleteError) {
          console.error(`❌ Erro ao remover chat ${removeChat.id}:`, deleteError);
        } else {
          console.log(`  ✅ Chat ${removeChat.id} removido com sucesso`);
          removedCount++;
        }
      }
    }

    console.log('✅ Limpeza de duplicatas concluída!');
    
    res.json({ 
      success: true, 
      message: 'Limpeza concluída com sucesso',
      stats: {
        duplicateGroups: duplicates.length,
        chatsRemoved: removedCount,
        messagesMovedd: movedMessagesCount
      }
    });
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Middleware de erro para capturar erros do multer
router.use((error, req, res, next) => {
  console.error('❌ Erro na rota de chat:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 50MB' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Campo de arquivo inesperado' });
    }
    return res.status(400).json({ error: `Erro do Multer: ${error.message}` });
  }
  
  if (error.message === 'Tipo de arquivo não suportado') {
    return res.status(400).json({ error: 'Tipo de arquivo não suportado' });
  }
  
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ✨ NOVA ROTA: Buscar mensagens de um chat específico
router.get('/:chatId/messages', authenticateToken, async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  console.log('🔍 [API] Buscando mensagens para chat:', chatId, 'usuário:', userId);

  try {
    // ✅ 1. Verificar se o chat pertence ao usuário e à organização (SEGURANÇA)
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, assigned_agent_id, organization_id')
      .eq('id', chatId)
      .eq('assigned_agent_id', userId)
      .eq('organization_id', req.user.organization_id) // ✅ FILTRO DE ORGANIZAÇÃO
      .single();

    if (chatError || !chat) {
      console.error('❌ [API] Chat não encontrado ou não pertence ao usuário:', { chatError, chatId, userId });
      return res.status(404).json({ error: 'Chat não encontrado ou acesso negado' });
    }

    console.log('✅ [API] Chat verificado, buscando mensagens...');

    // 2. Buscar mensagens do chat
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('❌ [API] Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }

    console.log('✅ [API] Mensagens encontradas:', {
      chatId,
      totalMessages: messages?.length || 0,
      firstMessage: messages?.[0]?.content || 'N/A'
    });

    res.json(messages || []);

  } catch (error) {
    console.error('❌ [API] Erro completo ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 🚨 ROTA DESABILITADA POR SEGURANÇA: Consolidar chats duplicados do mesmo cliente
// PROBLEMA: Esta rota acessava chats de toda a organização, podendo misturar conversas entre usuários
router.post('/consolidate-duplicates', authenticateToken, async (req, res) => {
  console.log('🚨 ROTA DESABILITADA: consolidate-duplicates foi desabilitada por questões de segurança');
  res.status(403).json({ 
        success: false, 
    error: 'Esta funcionalidade foi desabilitada por questões de segurança. Use a rota clean-duplicates que é segura por usuário.' 
  });
});

// 🚨 ROTA DESABILITADA POR SEGURANÇA: Corrigir chats misturados
// PROBLEMA: Esta rota poderia misturar conversas entre diferentes usuários da organização
router.post('/fix-mixed-chats', authenticateToken, async (req, res) => {
  console.log('🚨 ROTA DESABILITADA: fix-mixed-chats foi desabilitada por questões de segurança');
  res.status(403).json({ 
        success: false, 
    error: 'Esta funcionalidade foi desabilitada por questões de segurança. Cada usuário deve gerenciar apenas suas próprias conversas.' 
  });
});

export default router;
