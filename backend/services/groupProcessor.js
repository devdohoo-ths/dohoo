import { supabase } from '../lib/supabaseClient.js';
import { processMessageWithAI } from './aiProcessor.js';

// ✅ Função para verificar se é grupo
export const isGroupChat = (jid) => {
  return jid?.endsWith('@g.us');
};

// ✅ Função para verificar se é menção em grupo
export const isGroupMention = (message, myJid) => {
  const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  return mentions.includes(myJid);
};

// ✅ MELHORADA: Função para obter informações completas do grupo
export async function getGroupInfo(sock, groupJid) {
  try {
    console.log(`👥 [GROUP INFO] Buscando informações do grupo: ${groupJid}`);
    
    // ✅ Obter metadados do grupo via Baileys
    const groupMetadata = await sock.groupMetadata(groupJid);
    
    console.log(` [GROUP INFO] Metadados obtidos:`, {
      id: groupMetadata.id,
      subject: groupMetadata.subject,
      participants: groupMetadata.participants?.length || 0,
      admins: groupMetadata.admins?.length || 0,
      isGroup: groupMetadata.id.endsWith('@g.us')
    });

    // ✅ Obter foto do grupo
    let groupPicture = null;
    try {
      groupPicture = await sock.profilePictureUrl(groupJid, 'image');
      console.log(`️ [GROUP INFO] Foto do grupo encontrada`);
    } catch (ppError) {
      console.log(`⚠️ [GROUP INFO] Sem foto do grupo: ${ppError.message}`);
    }

    // ✅ MELHORADO: Processar participantes com nomes
    const participants = [];
    const participantNames = []; // ✅ NOVO: Lista para exibição
    
    if (groupMetadata.participants) {
      for (const participant of groupMetadata.participants) {
        try {
          // ✅ Tentar obter nome do participante
          let participantName = null;
          
          // ✅ MÉTODO 1: Buscar no store de contatos
          const storeContact = sock.store?.contacts?.[participant.id];
          if (storeContact?.name) {
            participantName = storeContact.name;
          }
          
          // ✅ MÉTODO 2: Tentar obter via onWhatsApp
          if (!participantName) {
            try {
              const profileInfo = await sock.onWhatsApp(participant.id);
              if (profileInfo && profileInfo.length > 0 && profileInfo[0].name) {
                participantName = profileInfo[0].name;
              }
            } catch (profileError) {
              // Ignorar erro, continuar sem nome
            }
          }
          
          // ✅ MÉTODO 3: Usar número se não encontrou nome
          if (!participantName) {
            participantName = participant.id.split('@')[0];
          }
          
          participants.push({
            jid: participant.id,
            phone: participant.id.split('@')[0],
            name: participantName,
            role: participant.admin || 'member'
          });
          
          // ✅ Adicionar à lista de nomes para exibição
          participantNames.push(participantName);
          
        } catch (participantError) {
          console.log(`⚠️ [GROUP INFO] Erro ao processar participante ${participant.id}:`, participantError.message);
          // ✅ Adicionar participante mesmo sem nome
          const phoneNumber = participant.id.split('@')[0];
          participants.push({
            jid: participant.id,
            phone: phoneNumber,
            name: phoneNumber,
            role: participant.admin || 'member'
          });
          participantNames.push(phoneNumber);
        }
      }
    }

    // ✅ NOVO: Criar string de exibição dos participantes
    let participantsDisplay = '';
    if (participantNames.length > 0) {
      if (participantNames.length <= 3) {
        participantsDisplay = participantNames.join(', ');
      } else {
        participantsDisplay = `${participantNames.slice(0, 3).join(', ')}...`;
      }
    }

    console.log(`👥 [GROUP INFO] Participantes processados: ${participants.length}`);
    console.log(`👥 [GROUP INFO] Exibição: ${participantsDisplay}`);

    return {
      exists: true,
      name: groupMetadata.subject || `Grupo ${groupJid.split('@')[0]}`,
      description: groupMetadata.desc || null,
      participants,
      participantNames, // ✅ NOVO: Lista completa de nomes
      participantsDisplay, // ✅ NOVO: String formatada para exibição
      admins: groupMetadata.admins || [],
      groupPicture,
      isGroup: true,
      phoneNumber: groupJid.split('@')[0]
    };
    
  } catch (error) {
    console.error(`❌ [GROUP INFO] Erro ao obter informações do grupo:`, error);
    
    return {
      exists: false,
      name: `Grupo ${groupJid.split('@')[0]}`,
      description: null,
      participants: [],
      participantNames: [],
      participantsDisplay: '',
      admins: [],
      groupPicture: null,
      isGroup: true,
      phoneNumber: groupJid.split('@')[0]
    };
  }
}

// ✅ Função para obter informações do contato individual
export async function getContactInfo(sock, jid, message = null) {
  try {
    console.log(` [CONTACT INFO] Buscando informações para: ${jid}`);
    
    let contactName = null;
    let profilePicture = null;
    
    // ✅ MÉTODO 1: Usar pushName da mensagem (mais confiável)
    if (message && message.pushName) {
      contactName = message.pushName;
      console.log(`📝 [CONTACT INFO] Nome encontrado no pushName: ${contactName}`);
    }
    
    // ✅ MÉTODO 2: Tentar buscar via store.contacts
    if (!contactName) {
      try {
        const storeContact = sock.store?.contacts?.[jid];
        if (storeContact?.name) {
          contactName = storeContact.name;
          console.log(`📝 [CONTACT INFO] Nome encontrado no store: ${contactName}`);
        }
      } catch (storeError) {
        console.log(`⚠️ [CONTACT INFO] Erro ao buscar no store: ${storeError.message}`);
      }
    }
    
    // ✅ MÉTODO 3: Tentar obter via onWhatsApp
    if (!contactName) {
      try {
        const profileInfo = await sock.onWhatsApp(jid);
        if (profileInfo && profileInfo.length > 0 && profileInfo[0].name) {
          contactName = profileInfo[0].name;
          console.log(`📝 [CONTACT INFO] Nome do perfil obtido: ${contactName}`);
        }
      } catch (profileError) {
        console.log(`ℹ️ [CONTACT INFO] Não foi possível obter informações do perfil`);
      }
    }
    
    // ✅ MÉTODO 4: Buscar foto do perfil
    try {
      const ppUrl = await sock.profilePictureUrl(jid, 'image');
      profilePicture = ppUrl;
      console.log(`🖼️ [CONTACT INFO] Foto encontrada: ${ppUrl}`);
    } catch (ppError) {
      console.log(`⚠️ [CONTACT INFO] Sem foto de perfil: ${ppError.message}`);
    }
    
    // ✅ RESULTADO FINAL: Se não encontrou nome, usar "Contato" + número
    if (!contactName) {
      const phoneNumber = jid.split('@')[0];
      contactName = `Contato ${phoneNumber}`;
      console.log(`📱 [CONTACT INFO] Usando nome padrão: ${contactName}`);
    }
    
    console.log(`✅ [CONTACT INFO] Resultado final:`, {
      exists: true,
      name: contactName,
      hasPicture: !!profilePicture,
      phoneNumber: jid.split('@')[0],
      isGroup: false
    });
    
    return {
      exists: true,
      name: contactName,
      profilePicture,
      phoneNumber: jid.split('@')[0],
      isGroup: false
    };
    
  } catch (error) {
    console.error(`❌ [CONTACT INFO] Erro geral:`, error);
    
    const phoneNumber = jid.split('@')[0];
    const fallbackName = `Contato ${phoneNumber}`;
    
    return {
      exists: false,
      name: fallbackName,
      profilePicture: null,
      phoneNumber: phoneNumber,
      isGroup: false
    };
  }
}

// ✅ CORREÇÃO: Função para processar mensagens de grupo
export async function processGroupMessage(message, accountId, accountName, sock, io, downloadAndProcessMedia) {
  try {
    console.log(`👥 [GROUP MESSAGE] Processando mensagem de grupo...`);
    
    const groupJid = message.key?.remoteJid;
    const senderJid = message.key?.participant || message.key?.remoteJid;
    const isOwnMessage = message.key?.fromMe;
    
    console.log(`👥 [GROUP MESSAGE] Detalhes:`, {
      groupJid,
      senderJid,
      isOwnMessage,
      hasParticipant: !!message.key?.participant
    });
    
    // ✅ Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id')
      .eq('account_id', accountId)
      .single();

    if (!accountData) {
      console.error(`❌ [GROUP MESSAGE] Conta não encontrada: ${accountId}`);
      return;
    }
    
    // ✅ Obter informações do grupo
    const groupInfo = await getGroupInfo(sock, groupJid);
    
    // ✅ CORREÇÃO: Obter informações do remetente correto
    let senderInfo;
    if (isOwnMessage) {
      // ✅ Para mensagens próprias, buscar nome real do usuário
      let userName = accountName; // Fallback
      
      try {
        // ✅ Buscar informações do usuário no banco
        const { data: userData } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', accountData.user_id)
          .single();
        
        if (userData?.name) {
          userName = userData.name;
          console.log(`👤 [GROUP MESSAGE] Nome do usuário encontrado: ${userName}`);
        } else {
          console.log(`⚠️ [GROUP MESSAGE] Usando nome da conta como fallback: ${userName}`);
        }
      } catch (userError) {
        console.log(`⚠️ [GROUP MESSAGE] Erro ao buscar usuário, usando nome da conta: ${userError.message}`);
      }
      
      senderInfo = {
        name: userName,
        phoneNumber: sock.user?.id?.split('@')[0] || 'unknown',
        profilePicture: null
      };
      console.log(`👤 [GROUP MESSAGE] Mensagem própria de: ${senderInfo.name}`);
    } else {
      // ✅ Para mensagens de outros, buscar informações do participante
      senderInfo = await getContactInfo(sock, senderJid, message);
      console.log(`👤 [GROUP MESSAGE] Mensagem de: ${senderInfo.name}`);
    }
    
    console.log(`👥 [GROUP MESSAGE] Informações obtidas:`, {
      groupName: groupInfo.name,
      senderName: senderInfo.name,
      participants: groupInfo.participants?.length || 0,
      isOwnMessage
    });
    
    // ✅ Buscar ou criar chat do grupo
    let { data: existingChat, error: chatError } = await supabase
      .from('chats')
      .select('id, name, avatar_url, participants')
      .eq('whatsapp_jid', groupJid)
      .eq('assigned_agent_id', accountData.user_id)
      .eq('organization_id', accountData.organization_id)
      .maybeSingle();

    let chatId;
    if (existingChat) {
      chatId = existingChat.id;
      console.log(`👥 [GROUP MESSAGE] Chat do grupo existente: ${chatId}`);
      
      // ✅ Atualizar informações do grupo se necessário
      if (groupInfo.name !== existingChat.name || groupInfo.participants?.length !== existingChat.participants?.length) {
        console.log(` [GROUP MESSAGE] Atualizando informações do grupo...`);
        await supabase
          .from('chats')
          .update({
            name: groupInfo.name,
            avatar_url: groupInfo.groupPicture || existingChat.avatar_url,
            participants: groupInfo.participants,
            metadata: {
              ...existingChat.metadata,
              group_info: {
                description: groupInfo.description,
                admins: groupInfo.admins,
                total_participants: groupInfo.participants?.length || 0,
                participants_display: groupInfo.participantsDisplay // ✅ NOVO: Adicionar exibição formatada
              }
            }
          })
          .eq('id', chatId);
      }
    } else {
      // ✅ Criar novo chat do grupo
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
          name: groupInfo.name,
          platform: 'whatsapp',
          whatsapp_jid: groupJid,
          assigned_agent_id: accountData.user_id,
          status: 'active',
          organization_id: accountData.organization_id,
          avatar_url: groupInfo.groupPicture,
          is_group: true,
          participants: groupInfo.participants,
          metadata: {
            group_info: {
              description: groupInfo.description,
              admins: groupInfo.admins,
              total_participants: groupInfo.participants?.length || 0,
              participants_display: groupInfo.participantsDisplay // ✅ NOVO: Adicionar exibição formatada
            }
          }
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`❌ [GROUP MESSAGE] Erro ao criar chat do grupo:`, createError);
        return;
      }

      chatId = newChat.id;
      console.log(`👥 [GROUP MESSAGE] Novo chat do grupo criado: ${chatId}`);
    }
    
    // ✅ Processar mídia
    const mediaInfo = await downloadAndProcessMedia(message, sock, chatId);
    
    // ✅ Extrair conteúdo da mensagem
    // ✅ CORREÇÃO: Para mídias sem caption, usar nome do arquivo ou deixar vazio (não usar "Mídia")
    let messageContent = message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption ||
      message.message?.audioMessage?.caption ||
      message.message?.documentMessage?.caption ||
      mediaInfo.caption ||
      null;
    
    // Se não há conteúdo de texto mas há mídia, usar nome do arquivo ou deixar vazio
    if (!messageContent && mediaInfo.mediaType !== 'text' && mediaInfo.fileName) {
      messageContent = mediaInfo.fileName;
    } else if (!messageContent && mediaInfo.mediaType !== 'text') {
      // Para mídias sem nome de arquivo, deixar vazio (será exibido como mídia na interface)
      messageContent = '';
    }

    console.log(`👥 [GROUP MESSAGE] Conteúdo:`, messageContent ? messageContent.substring(0, 100) + '...' : '(mídia sem texto)');

    // ✅ CORREÇÃO: Salvar mensagem com informações corretas
    const messagePayload = {
      chat_id: chatId,
      content: messageContent,
      message_type: mediaInfo.mediaType,
      media_url: mediaInfo.mediaUrl,
      is_from_me: isOwnMessage,
      sender_name: senderInfo.name,
      sender_jid: isOwnMessage ? sock.user?.id : senderJid,
      status: isOwnMessage ? 'sent' : 'received',
      whatsapp_message_id: message.key?.id,
      organization_id: accountData.organization_id,
      user_id: accountData.user_id,
      message_object: message.message,
      message_key: message.key,
      metadata: {
        ...mediaInfo,
        is_group_message: true,
        is_own_message: isOwnMessage,
        group_jid: groupJid,
        participant_jid: senderJid,
        received_at: new Date().toISOString(),
        push_name: message.pushName,
        timestamp: message.messageTimestamp
      }
    };

    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert(messagePayload)
      .select('id')
      .single();

    if (messageError) {
      console.error(`❌ [GROUP MESSAGE] Erro ao salvar mensagem:`, messageError);
      return;
    }

    console.log(`✅ [GROUP MESSAGE] Mensagem salva: ${savedMessage.id} (própria: ${isOwnMessage}, tipo: ${mediaInfo.mediaType})`);

    // ✅ NOVO: Transcrever áudio automaticamente se for mensagem de áudio de grupo (recebidas E enviadas)
    if (mediaInfo.mediaType === 'audio' && mediaInfo.localPath) {
      // Importar função de transcrição
      const { transcribeAudioAutomatically } = await import('../services/multiWhatsapp.js');
      if (transcribeAudioAutomatically) {
        transcribeAudioAutomatically(savedMessage.id, mediaInfo.localPath, accountData.organization_id, accountName)
          .catch(error => {
            console.error(`❌ [GROUP MESSAGE] Erro ao transcrever áudio automaticamente:`, error);
          });
      }
    }

    // ✅ Emitir evento para frontend
    io.to(`org_${accountData.organization_id}`).emit('new-message', {
      message: {
        ...messagePayload,
        id: savedMessage.id
      },
      chat_id: chatId,
      is_broadcast: false,
      is_group: true,
      is_own_message: isOwnMessage
    });

    // ✅ Processar com IA (apenas para mensagens de outros)
    if (!isOwnMessage) {
      try {
        await processMessageWithAI(
          accountId,
          senderJid,
          messageContent,
          sock,
          message,
          accountData.organization_id,
          mediaInfo,
          true
        );
      } catch (aiError) {
        console.warn(`⚠️ [GROUP MESSAGE] Erro ao processar com IA:`, aiError.message);
      }
    } else {
      console.log(`🤖 [GROUP MESSAGE] Pulando IA para mensagem própria`);
    }

  } catch (error) {
    console.error(`❌ [GROUP MESSAGE] Erro ao processar mensagem de grupo:`, error);
  }
}

// ✅ Função para enviar mensagem para grupo
export const sendGroupMessage = async (accountId, groupJid, message, replyTo = null, activeConnections) => {
  try {
    console.log(`👥 [GROUP SEND] Enviando mensagem para grupo: ${groupJid}`);
    
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.socket) {
      throw new Error('Conta não conectada');
    }
    
    // ✅ Verificar se é realmente um grupo
    if (!isGroupChat(groupJid)) {
      throw new Error('JID fornecido não é um grupo');
    }
    
    // ✅ Preparar mensagem
    const messageData = { text: message };
    
    if (replyTo) {
      messageData.contextInfo = {
        quotedMessage: replyTo.message_object,
        stanzaId: replyTo.whatsapp_message_id,
        participant: replyTo.sender_jid,
        remoteJid: groupJid
      };
    }
    
    // ✅ Enviar mensagem
    const result = await connection.socket.sendMessage(groupJid, messageData);
    
    console.log(`✅ [GROUP SEND] Mensagem enviada para grupo: ${result?.key?.id}`);
    
    return {
      success: true,
      message: 'Mensagem enviada para grupo com sucesso',
      whatsapp_message_id: result?.key?.id
    };
    
  } catch (error) {
    console.error(`❌ [GROUP SEND] Erro ao enviar mensagem para grupo:`, error);
    return { success: false, error: error.message };
  }
};

// ✅ Função para obter lista de grupos
export const getGroupsList = async (accountId, activeConnections) => {
  try {
    console.log(`👥 [GROUPS LIST] Obtendo lista de grupos para conta: ${accountId}`);
    
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.socket) {
      throw new Error('Conta não conectada');
    }
    
    // ✅ Buscar grupos no banco de dados
    const { data: accountData } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id')
      .eq('account_id', accountId)
      .single();
    
    if (!accountData) {
      throw new Error('Conta não encontrada');
    }
    
    const { data: groups, error } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid, avatar_url, participants, metadata')
      .eq('assigned_agent_id', accountData.user_id)
      .eq('organization_id', accountData.organization_id)
      .eq('is_group', true)
      .order('updated_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ [GROUPS LIST] Encontrados ${groups?.length || 0} grupos`);
    
    return {
      success: true,
      groups: groups || []
    };
    
  } catch (error) {
    console.error(`❌ [GROUPS LIST] Erro ao obter lista de grupos:`, error);
    return { success: false, error: error.message };
  }
};

// ✅ Função para atualizar informações de grupos existentes
export async function updateExistingGroupInfo(sock, accountId, accountName) {
  try {
    console.log(` [UPDATE GROUPS] Iniciando atualização de grupos para conta: ${accountName}`);

    // Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id')
      .eq('account_id', accountId)
      .single();

    if (!accountData) {
      console.error(`❌ [UPDATE GROUPS] Conta não encontrada: ${accountId}`);
      return;
    }

    // ✅ Buscar apenas chats de grupo
    const { data: existingGroups, error: groupsError } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid, avatar_url, participants')
      .eq('assigned_agent_id', accountData.user_id)
      .eq('organization_id', accountData.organization_id)
      .eq('platform', 'whatsapp')
      .eq('is_group', true);

    if (groupsError) {
      console.error(`❌ [UPDATE GROUPS] Erro ao buscar grupos:`, groupsError);
      return;
    }

    console.log(` [UPDATE GROUPS] Encontrados ${existingGroups?.length || 0} grupos para atualizar`);

    let updatedCount = 0;
    let errorCount = 0;

    // Atualizar cada grupo
    for (const group of existingGroups || []) {
      if (!group.whatsapp_jid) continue;

      try {
        console.log(`🔄 [UPDATE GROUPS] Processando grupo: ${group.name} (${group.whatsapp_jid})`);

        const groupInfo = await getGroupInfo(sock, group.whatsapp_jid);

        console.log(`📋 [UPDATE GROUPS] Informações obtidas:`, {
          groupId: group.id,
          oldName: group.name,
          newName: groupInfo.name,
          oldParticipants: group.participants?.length || 0,
          newParticipants: groupInfo.participants?.length || 0,
          hasPicture: !!groupInfo.groupPicture
        });

        // ✅ Atualizar se temos informações novas
        if (groupInfo.name || groupInfo.participants?.length > 0) {
          console.log(`✅ [UPDATE GROUPS] Atualizando grupo: ${group.name} → ${groupInfo.name}`);

          const { error: updateError } = await supabase
            .from('chats')
            .update({
              name: groupInfo.name || group.name,
              avatar_url: groupInfo.groupPicture || group.avatar_url,
              participants: groupInfo.participants || group.participants,
              metadata: {
                group_info: {
                  description: groupInfo.description,
                  admins: groupInfo.admins,
                  total_participants: groupInfo.participants?.length || 0,
                  participants_display: groupInfo.participantsDisplay
                }
              }
            })
            .eq('id', group.id);

          if (updateError) {
            console.error(`❌ [UPDATE GROUPS] Erro ao atualizar grupo ${group.id}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ [UPDATE GROUPS] Grupo ${group.id} atualizado com sucesso`);
            updatedCount++;
          }
        } else {
          console.log(`⚠️ [UPDATE GROUPS] Grupo ${group.id} não conseguiu obter informações para: ${group.whatsapp_jid}`);
        }

        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ [UPDATE GROUPS] Erro ao processar grupo ${group.id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ [UPDATE GROUPS] Atualização concluída:`, {
      total: existingGroups?.length || 0,
      updated: updatedCount,
      errors: errorCount,
      accountName
    });

  } catch (error) {
    console.error(`❌ [UPDATE GROUPS] Erro geral:`, error);
  }
}