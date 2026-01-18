import { supabase } from '../lib/supabaseClient.js';
import { sendDisconnectNotificationEmail } from './emailService.js';

/**
 * Detecta se uma desconexão foi manual (usuário desconectou no WhatsApp)
 * @param {string} accountId - ID da conta WhatsApp
 * @param {number} disconnectReason - Razão da desconexão do Baileys
 * @returns {boolean} - true se foi desconexão manual
 */
export const isManualDisconnect = (disconnectReason) => {
  // DisconnectReason.loggedOut = 401 - usuário desconectou manualmente no WhatsApp
  // DisconnectReason.connectionClosed = 428 - conexão fechada pelo servidor
  // DisconnectReason.connectionLost = 408 - perda de conexão
  // DisconnectReason.restartRequired = 515 - reinício necessário
  
  return disconnectReason === 401; // loggedOut = desconexão manual
};

/**
 * Busca as últimas conversas de um usuário
 * @param {string} accountId - ID da conta WhatsApp
 * @param {number} limit - Número de conversas para buscar (padrão: 3)
 * @returns {Array} - Array com as últimas conversas
 */
export const getLastConversations = async (accountId, limit = 3) => {
  try {
    console.log(`🔍 Buscando últimas ${limit} conversas para conta: ${accountId}`);
    
    // Buscar chats da conta WhatsApp (precisamos filtrar por usuário)
    // Primeiro, buscar o user_id da conta WhatsApp
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id')
      .eq('account_id', accountId)
      .single();

    if (accountError || !accountData) {
      console.error('❌ Erro ao buscar dados da conta WhatsApp:', accountError);
      return [];
    }

    // Buscar chats atribuídos ao usuário da conta
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select(`
        id,
        name,
        remote_jid,
        last_message_at,
        assigned_agent_id
      `)
      .eq('platform', 'whatsapp')
      .eq('assigned_agent_id', accountData.user_id)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (chatsError) {
      console.error('❌ Erro ao buscar chats:', chatsError);
      return [];
    }

    if (!chats || chats.length === 0) {
      console.log('📭 Nenhuma conversa encontrada para a conta');
      return [];
    }

    // Para cada chat, buscar as últimas mensagens
    const conversationsWithMessages = await Promise.all(
      chats.map(async (chat) => {
        // Buscar últimas 5 mensagens de cada conversa
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (messagesError) {
          console.error(`❌ Erro ao buscar mensagens do chat ${chat.id}:`, messagesError);
          return null;
        }

        return {
          chatId: chat.id,
          chatName: chat.name,
          remoteJid: chat.remote_jid,
          lastMessageAt: chat.last_message_at,
          messages: messages ? messages.reverse() : [] // Reverter para ordem cronológica
        };
      })
    );

    // Filtrar conversas nulas
    const validConversations = conversationsWithMessages.filter(conv => conv !== null);
    
    console.log(`✅ Encontradas ${validConversations.length} conversas com mensagens`);
    return validConversations;

  } catch (error) {
    console.error('❌ Erro ao buscar últimas conversas:', error);
    return [];
  }
};

/**
 * Busca informações do usuário e gestor da organização
 * @param {string} accountId - ID da conta WhatsApp
 * @returns {Object|null} Informações do usuário e gestor
 */
export const getUserAndManagerInfo = async (accountId) => {
  try {
    // Buscar conta WhatsApp
    const { data: whatsappAccount, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select(`
        id,
        name,
        phone_number,
        user_id
      `)
      .eq('account_id', accountId)
      .single();

    if (accountError || !whatsappAccount) {
      console.error('❌ Erro ao buscar conta WhatsApp:', accountError);
      return null;
    }

    // Buscar informações do usuário com role_id e join com roles
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select(`
        name, 
        email, 
        organization_id,
        role_id,
        roles (
          id,
          name
        )
      `)
      .eq('id', whatsappAccount.user_id)
      .single();

    if (userError || !userProfile) {
      console.error('❌ Erro ao buscar perfil do usuário:', userError);
      return null;
    }

    // Verificar se o usuário tem organização
    if (!userProfile.organization_id) {
      console.error('❌ Usuário não possui organização associada');
      return null;
    }

    // Buscar gestores da organização usando role_id
    const { data: managers, error: managerError } = await supabase
      .from('profiles')
      .select(`
        id, 
        name, 
        email,
        role_id,
        roles (
          id,
          name
        )
      `)
      .eq('organization_id', userProfile.organization_id)
      .not('role_id', 'is', null);

    if (managerError || !managers || managers.length === 0) {
      console.error('❌ Erro ao buscar gestores da organização:', managerError);
      return null;
    }

    // Filtrar todos os administradores (admin e super_admin)
    const allAdmins = managers.filter(manager => {
      const roleName = manager.roles?.name?.toLowerCase();
      return roleName?.includes('admin');
    });

    if (allAdmins.length === 0) {
      console.error('❌ Nenhum administrador encontrado na organização');
      return null;
    }

    console.log(`✅ Encontrados ${allAdmins.length} administradores para notificação:`, 
      allAdmins.map(admin => `${admin.name} (${admin.roles?.name})`).join(', '));

    // Determinar role do usuário
    const userRole = userProfile.roles?.name || 'Agent';

    console.log(`📧 Email de notificação será enviado para ${allAdmins.length} administrador(es)`);

    return {
      user: {
        id: whatsappAccount.user_id,
        name: userProfile.name,
        email: userProfile.email,
        phoneNumber: whatsappAccount.phone_number,
        role: userRole
      },
      admins: allAdmins.map(admin => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.roles?.name || 'Admin'
      })),
      account: {
        id: whatsappAccount.id,
        name: whatsappAccount.name,
        phoneNumber: whatsappAccount.phone_number
      }
    };

  } catch (error) {
    console.error('❌ Erro ao buscar informações do usuário e gestor:', error);
    return null;
  }
};

/**
 * Processa desconexão e envia notificação se for manual
 * @param {string} accountId - ID da conta WhatsApp
 * @param {number} disconnectReason - Razão da desconexão
 * @param {string} accountName - Nome da conta
 */
export const processDisconnectNotification = async (accountId, disconnectReason, accountName) => {
  try {
    console.log(`🔍 Processando desconexão para conta: ${accountName} (${accountId})`);
    console.log(`📊 Razão da desconexão: ${disconnectReason}`);

    // ✅ CORREÇÃO: Verificar se foi desconexão manual (401 ou DisconnectReason.loggedOut)
    const isManual = isManualDisconnect(disconnectReason);
    
    if (!isManual) {
      console.log('ℹ️ Desconexão não manual, ignorando notificação de email');
      return;
    }

    console.log('🚨 Desconexão manual detectada! Enviando email e notificação...');

    // Buscar informações do usuário e administradores
    const userAndAdminsInfo = await getUserAndManagerInfo(accountId);
    if (!userAndAdminsInfo) {
      console.error('❌ Não foi possível obter informações do usuário/administradores');
      return;
    }

    // Buscar últimas conversas
    const lastConversations = await getLastConversations(accountId, 3);
    
    console.log(`📝 Encontradas ${lastConversations.length} conversas para incluir na notificação`);

    // Enviar e-mail de notificação para todos os administradores
    const emailPromises = userAndAdminsInfo.admins.map(async (admin) => {
      const emailResult = await sendDisconnectNotificationEmail(
        admin.email,
        userAndAdminsInfo.user,
        userAndAdminsInfo.account,
        lastConversations
      );

      if (emailResult.success) {
        console.log(`✅ E-mail de notificação enviado com sucesso para ${admin.name} (${admin.email})`);
      } else {
        console.error(`❌ Erro ao enviar e-mail para ${admin.name} (${admin.email}):`, emailResult.error);
      }

      return emailResult;
    });

    // Aguardar todos os e-mails serem enviados
    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result.success).length;
    
    console.log(`📧 Resumo: ${successfulEmails}/${emailResults.length} e-mails enviados com sucesso`);

    if (successfulEmails > 0) {
      // Registrar a notificação no banco (opcional)
      await logDisconnectNotification(accountId, userAndAdminsInfo, lastConversations);
    }

  } catch (error) {
    console.error('❌ Erro ao processar notificação de desconexão:', error);
  }
};

/**
 * Registra a notificação de desconexão no banco (opcional)
 * @param {string} accountId - ID da conta
 * @param {Object} userAndAdminsInfo - Informações do usuário e administradores
 * @param {Array} conversations - Conversas incluídas na notificação
 */
const logDisconnectNotification = async (accountId, userAndAdminsInfo, conversations) => {
  try {
    // Criar registros para cada administrador
    const notificationRecords = userAndAdminsInfo.admins.map(admin => ({
      account_id: accountId,
      user_id: userAndAdminsInfo.user.id,
      manager_id: admin.id,
      user_name: userAndAdminsInfo.user.name,
      user_phone: userAndAdminsInfo.user.phoneNumber,
      manager_email: admin.email,
      conversations_count: conversations.length,
      sent_at: new Date().toISOString()
    }));

    await supabase
      .from('disconnect_notifications')
      .insert(notificationRecords);

    console.log(`📝 Registradas ${notificationRecords.length} notificações no banco de dados`);
  } catch (error) {
    console.error('❌ Erro ao registrar notificação no banco:', error);
    // Não falhar se não conseguir registrar
  }
}; 