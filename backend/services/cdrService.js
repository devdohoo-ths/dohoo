import { supabase } from '../lib/supabaseClient.js';
import { sendMessageByAccount } from './multiWhatsapp.js';

/**
 * Serviço CDR (Conexão Direta ao Responsável)
 * Sistema de URA para WhatsApp
 */

/**
 * Processa mensagem recebida e verifica se deve ser tratada pelo CDR
 */
export const processCDRMessage = async (message, accountId, accountName, senderJid, messageContent) => {
  try {
    // Buscar configuração CDR ativa para esta conta
    const { data: cdrConfig } = await supabase
      .from('cdr_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('active', true)
      .single();

    if (!cdrConfig) {
      // Não há CDR configurado para esta conta
      return { handled: false };
    }

    // Extrair número do cliente
    const customerPhone = senderJid.split('@')[0];
    
    // Buscar ou criar sessão do cliente
    let { data: session } = await supabase
      .from('cdr_sessions')
      .select('*')
      .eq('cdr_config_id', cdrConfig.id)
      .eq('customer_phone', customerPhone)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Se não há sessão ativa, criar nova
    if (!session) {
      // Verificar se há sessão recente (últimas 24h) para reutilizar
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentSession } = await supabase
        .from('cdr_sessions')
        .select('*')
        .eq('cdr_config_id', cdrConfig.id)
        .eq('customer_phone', customerPhone)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentSession && recentSession.status === 'waiting') {
        // Reativar sessão em espera
        const { data: updatedSession } = await supabase
          .from('cdr_sessions')
          .update({ 
            status: 'active',
            current_step: 'menu',
            updated_at: new Date().toISOString()
          })
          .eq('id', recentSession.id)
          .select()
          .single();
        
        session = updatedSession;
      } else {
        // Criar nova sessão
        const { data: newSession } = await supabase
          .from('cdr_sessions')
          .insert({
            cdr_config_id: cdrConfig.id,
            customer_phone: customerPhone,
            customer_name: null, // Tentar buscar nome depois
            current_step: 'welcome',
            status: 'active'
          })
          .select()
          .single();

        session = newSession;
      }
    }

    // Processar mensagem baseado no passo atual
    if (session.current_step === 'welcome') {
      // Enviar mensagem de boas-vindas e menu
      await sendWelcomeMessage(accountId, customerPhone, cdrConfig);
      
      // Atualizar sessão para menu
      await supabase
        .from('cdr_sessions')
        .update({ 
          current_step: 'menu',
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      return { handled: true, sessionId: session.id };
    }

    if (session.current_step === 'menu') {
      // Processar seleção de opção
      const optionNumber = parseInt(messageContent.trim());
      
      if (isNaN(optionNumber)) {
        // Resposta inválida, reenviar menu
        await sendWelcomeMessage(accountId, customerPhone, cdrConfig);
        return { handled: true, sessionId: session.id };
      }

      // Buscar opção selecionada
      const { data: option } = await supabase
        .from('cdr_options')
        .select('*, cdr_groups(*)')
        .eq('cdr_config_id', cdrConfig.id)
        .eq('option_number', optionNumber)
        .eq('active', true)
        .single();

      if (!option) {
        // Opção inválida, reenviar menu
        await sendWelcomeMessage(accountId, customerPhone, cdrConfig);
        return { handled: true, sessionId: session.id };
      }

      // Atualizar sessão com opção selecionada
      await supabase
        .from('cdr_sessions')
        .update({
          selected_option: optionNumber,
          group_id: option.group_id,
          current_step: 'waiting',
          status: 'waiting',
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      // Fazer ativos para o grupo
      await sendActivesToGroup(
        accountId,
        session.id,
        option.group_id,
        customerPhone,
        cdrConfig.distribution_mode
      );

      // Enviar mensagem de confirmação para o cliente
      const confirmationMessage = '✅ Entendido! Um de nossos colaboradores entrará em contato com você em breve através de outro número. Obrigado!';
      await sendMessageByAccount(accountId, customerPhone, confirmationMessage);

      return { handled: true, sessionId: session.id, optionSelected: optionNumber };
    }

    return { handled: true, sessionId: session.id };
  } catch (error) {
    console.error('❌ [CDR] Erro ao processar mensagem CDR:', error);
    return { handled: false, error: error.message };
  }
};

/**
 * Envia mensagem de boas-vindas e menu de opções
 */
const sendWelcomeMessage = async (accountId, customerPhone, cdrConfig) => {
  try {
    // Buscar opções ativas
    const { data: options } = await supabase
      .from('cdr_options')
      .select('*')
      .eq('cdr_config_id', cdrConfig.id)
      .eq('active', true)
      .order('option_number', { ascending: true });

    // Montar mensagem com menu
    let message = cdrConfig.welcome_message + '\n\n';
    
    if (options && options.length > 0) {
      message += 'Escolha uma opção:\n';
      options.forEach(option => {
        message += `${option.option_number} - ${option.option_text}\n`;
      });
    } else {
      message += 'Por favor, aguarde enquanto um atendente entra em contato.';
    }

    await sendMessageByAccount(accountId, customerPhone, message);
  } catch (error) {
    console.error('❌ [CDR] Erro ao enviar mensagem de boas-vindas:', error);
    throw error;
  }
};

/**
 * Envia ativos (mensagens) para usuários do grupo
 */
const sendActivesToGroup = async (accountId, sessionId, groupId, customerPhone, distributionMode) => {
  try {
    // Buscar usuários do grupo
    const { data: groupUsers } = await supabase
      .from('cdr_group_users')
      .select('*, profiles(*)')
      .eq('group_id', groupId)
      .eq('active', true)
      .order('priority', { ascending: false });

    if (!groupUsers || groupUsers.length === 0) {
      console.warn(`⚠️ [CDR] Nenhum usuário ativo no grupo ${groupId}`);
      return;
    }

    // Buscar informações da sessão
    const { data: session } = await supabase
      .from('cdr_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      console.error(`❌ [CDR] Sessão ${sessionId} não encontrada`);
      return;
    }

    // Buscar nome do cliente se disponível
    let customerName = session.customer_name || 'Cliente';
    
    // Tentar buscar nome do contato
    if (!session.customer_name) {
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('name')
          .eq('phone', customerPhone)
          .or(`phone.eq.55${customerPhone}`)
          .limit(1)
          .maybeSingle();

        if (contact && contact.name) {
          customerName = contact.name;
          // Atualizar sessão com nome
          await supabase
            .from('cdr_sessions')
            .update({ customer_name: customerName })
            .eq('id', sessionId);
        }
      } catch (error) {
        console.warn('⚠️ [CDR] Erro ao buscar nome do contato:', error);
      }
    }

    // Determinar quais usuários receberão o ativo
    let usersToNotify = [];
    
    if (distributionMode === 'random') {
      // Selecionar usuário aleatório
      const randomIndex = Math.floor(Math.random() * groupUsers.length);
      usersToNotify = [groupUsers[randomIndex]];
    } else {
      // Modo sequencial - buscar último usuário que recebeu ativo deste grupo
      const { data: lastActive } = await supabase
        .from('cdr_actives')
        .select('user_id')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastActive) {
        // Encontrar índice do último usuário
        const lastIndex = groupUsers.findIndex(u => u.user_id === lastActive.user_id);
        const nextIndex = (lastIndex + 1) % groupUsers.length;
        usersToNotify = [groupUsers[nextIndex]];
      } else {
        // Primeiro ativo, começar do primeiro
        usersToNotify = [groupUsers[0]];
      }
    }

    // Enviar ativos
    for (const groupUser of usersToNotify) {
      // Buscar telefone do usuário
      let userPhone = groupUser.phone_number;
      
      // Se não tem telefone no grupo, buscar da conta WhatsApp do usuário
      if (!userPhone) {
        try {
          const { data: whatsappAccount } = await supabase
            .from('whatsapp_accounts')
            .select('phone_number')
            .eq('user_id', groupUser.user_id)
            .eq('status', 'connected')
            .limit(1)
            .maybeSingle();

          if (whatsappAccount && whatsappAccount.phone_number) {
            userPhone = whatsappAccount.phone_number;
          }
        } catch (error) {
          console.warn(`⚠️ [CDR] Erro ao buscar telefone do usuário ${groupUser.user_id}:`, error);
        }
      }
      
      if (!userPhone) {
        console.warn(`⚠️ [CDR] Usuário ${groupUser.user_id} não tem telefone cadastrado`);
        continue;
      }

      // Montar mensagem do ativo
      const activeMessage = `🔔 *NOVO CLIENTE AGUARDANDO CONTATO*\n\n` +
        `👤 *Nome:* ${customerName}\n` +
        `📱 *Telefone:* ${customerPhone}\n\n` +
        `Um cliente está aguardando seu contato. Por favor, entre em contato através de outro número.`;

      try {
        // Enviar mensagem
        await sendMessageByAccount(accountId, userPhone, activeMessage);

        // Registrar ativo
        await supabase
          .from('cdr_actives')
          .insert({
            session_id: sessionId,
            group_id: groupId,
            user_id: groupUser.user_id,
            phone_number: userPhone,
            message_sent: activeMessage,
            status: 'sent',
            sent_at: new Date().toISOString()
          });

        console.log(`✅ [CDR] Ativo enviado para usuário ${groupUser.user_id} (${userPhone})`);
      } catch (error) {
        console.error(`❌ [CDR] Erro ao enviar ativo para ${userPhone}:`, error);
        
        // Registrar erro
        await supabase
          .from('cdr_actives')
          .insert({
            session_id: sessionId,
            group_id: groupId,
            user_id: groupUser.user_id,
            phone_number: userPhone,
            message_sent: activeMessage,
            status: 'error'
          });
      }
    }
  } catch (error) {
    console.error('❌ [CDR] Erro ao enviar ativos para grupo:', error);
    throw error;
  }
};

/**
 * Busca configuração CDR por account_id
 */
export const getCDRConfigByAccount = async (accountId) => {
  try {
    const { data, error } = await supabase
      .from('cdr_configs')
      .select('*')
      .eq('account_id', accountId)
      .eq('active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ [CDR] Erro ao buscar configuração CDR:', error);
    throw error;
  }
};

