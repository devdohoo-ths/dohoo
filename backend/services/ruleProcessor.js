import { supabase } from '../lib/supabaseClient.js';
import { sendRuleNotificationEmail, shouldSendNotification } from './ruleNotificationService.js';

// Variável global para Socket.IO (será inicializada pelo multiWhatsapp)
let io = null;

export const setIO = (socketIO) => {
  io = socketIO;
};

/**
 * Processa uma mensagem para verificar se aciona alguma regra de monitoramento
 * @param {Object} message - Objeto da mensagem
 * @param {string} message.id - ID da mensagem
 * @param {string} message.chat_id - ID do chat
 * @param {string} message.content - Conteúdo da mensagem
 * @param {string} message.created_at - Data de criação
 * @param {string} message.sender_name - Nome do remetente
 * @param {string} message.organization_id - ID da organização
 */
export const processMessageForRules = async (message) => {
  try {
    if (!message.content || !message.organization_id) {
      return;
    }

    // Buscar regras ativas da organização
    const { data: rules, error: rulesError } = await supabase
      .from('monitoring_rules')
      .select('*')
      .eq('organization_id', message.organization_id)
      .eq('is_active', true);

    if (rulesError) {
      console.error('❌ Erro ao buscar regras:', rulesError);
      return;
    }

    if (!rules || rules.length === 0) {
      return;
    }

    const content = message.content.toLowerCase();
    let processedCount = 0;

    // Processar cada regra
    for (const rule of rules) {
      for (const keyword of rule.keywords) {
        if (content.includes(keyword.toLowerCase())) {
          // Verificar se já existe uma ocorrência para esta mensagem e regra
          const { data: existing } = await supabase
            .from('rule_occurrences')
            .select('id')
            .eq('rule_id', rule.id)
            .eq('message_id', message.id)
            .eq('matched_keyword', keyword)
            .single();

          if (!existing) {
            // Buscar informações do chat e agente
            const { data: chat } = await supabase
              .from('chats')
              .select('name, whatsapp_jid, assigned_agent_id')
              .eq('id', message.chat_id)
              .single();

            // Buscar nome do agente (apenas da mesma organização)
            let agentName = 'Agente';
            if (chat?.assigned_agent_id) {
              const { data: agent } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', chat.assigned_agent_id)
                .eq('organization_id', message.organization_id)
                .single();
              
              if (agent) {
                agentName = agent.name;
              }
            }

            // Criar ocorrência
            const { error: insertError } = await supabase
              .from('rule_occurrences')
              .insert({
                rule_id: rule.id,
                chat_id: message.chat_id,
                message_id: message.id,
                matched_keyword: keyword,
                message_content: message.content,
                message_timestamp: message.created_at,
                customer_name: chat?.name,
                customer_phone: chat?.whatsapp_jid,
                agent_name: agentName
              });

            if (insertError) {
              console.error('❌ Erro ao criar ocorrência:', insertError);
            } else {
              processedCount++;
              console.log(`✅ Regra "${rule.name}" acionada pela palavra "${keyword}"`);
              
              // ✅ NOVO: Emitir evento socket para notificação em tempo real
              if (io) {
                try {
                  const eventData = {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    keyword: keyword,
                    chatId: message.chat_id,
                    customerName: chat?.name,
                    organizationId: message.organization_id
                  };
                  
                  console.log(`📢 [Socket] Emitindo evento rule-triggered:`, {
                    organizationId: message.organization_id,
                    room: `org_${message.organization_id}`,
                    ruleName: rule.name,
                    keyword: keyword,
                    chatId: message.chat_id,
                    customerName: chat?.name
                  });
                  
                  io.to(`org_${message.organization_id}`).emit('rule-triggered', eventData);
                  console.log(`✅ [Socket] Evento rule-triggered emitido com sucesso para organização ${message.organization_id}`);
                } catch (socketError) {
                  console.error('❌ Erro ao emitir evento socket:', socketError);
                  console.error('❌ Stack:', socketError.stack);
                }
              } else {
                console.warn(`⚠️ [Socket] io não está disponível. Evento rule-triggered não será emitido.`);
              }
              
              // Enviar notificação por email
              try {
                console.log(`📧 [DEBUG] Tentando enviar notificação para regra "${rule.name}"`);
                const shouldNotify = await shouldSendNotification(rule.id, message.organization_id);
                console.log(`📧 [DEBUG] shouldNotify: ${shouldNotify}`);
                
                if (shouldNotify) {
                  const notificationData = {
                    rule_id: rule.id,
                    matched_keyword: keyword,
                    message_content: message.content,
                    customer_name: chat?.name,
                    customer_phone: chat?.whatsapp_jid,
                    agent_name: agentName,
                    message_timestamp: message.created_at,
                    organization_id: message.organization_id
                  };
                  
                  console.log(`📧 [DEBUG] Dados da notificação:`, notificationData);
                  const emailResult = await sendRuleNotificationEmail(notificationData);
                  
                  if (emailResult.success) {
                    console.log(`✅ Notificação enviada para ${emailResult.sent} gestor(es)`);
                  } else {
                    console.error(`❌ Falha ao enviar notificação: ${emailResult.error}`);
                  }
                } else {
                  console.log(`⚠️ Notificação não enviada (shouldNotify = false)`);
                }
              } catch (emailError) {
                console.error('❌ Erro ao enviar notificação por email:', emailError);
              }
            }
          }
        }
      }
    }

    if (processedCount > 0) {
      console.log(`📊 ${processedCount} ocorrência(s) de regra(s) processada(s) para mensagem ${message.id}`);
    }

  } catch (error) {
    console.error('❌ Erro ao processar mensagem para regras:', error);
  }
};

/**
 * Processa mensagens existentes em um período específico
 * @param {string} organizationId - ID da organização
 * @param {string} dateStart - Data inicial (ISO string)
 * @param {string} dateEnd - Data final (ISO string)
 */
export const processHistoricalMessages = async (organizationId, dateStart, dateEnd) => {
  try {
    console.log(`🔄 Processando mensagens históricas de ${dateStart} até ${dateEnd}`);

    // Buscar regras ativas da organização
    const { data: rules, error: rulesError } = await supabase
      .from('monitoring_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (rulesError) {
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      console.log('ℹ️ Nenhuma regra ativa encontrada');
      return { processed: 0 };
    }

    // Buscar mensagens no período
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        organization_id
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd)
      .not('content', 'is', null);

    if (messagesError) {
      throw messagesError;
    }

    let processedCount = 0;

    // Processar cada mensagem
    for (const message of messages || []) {
      const content = message.content.toLowerCase();
      
      for (const rule of rules) {
        for (const keyword of rule.keywords) {
          if (content.includes(keyword.toLowerCase())) {
            // Verificar se já existe uma ocorrência
            const { data: existing } = await supabase
              .from('rule_occurrences')
              .select('id')
              .eq('rule_id', rule.id)
              .eq('message_id', message.id)
              .eq('matched_keyword', keyword)
              .single();

            if (!existing) {
              // Buscar informações do chat e agente
              const { data: chat } = await supabase
                .from('chats')
                .select('name, whatsapp_jid, assigned_agent_id')
                .eq('id', message.chat_id)
                .single();

              // Buscar nome do agente (apenas da mesma organização)
              let agentName = 'Agente';
              if (chat?.assigned_agent_id) {
                const { data: agent } = await supabase
                  .from('profiles')
                  .select('name')
                  .eq('id', chat.assigned_agent_id)
                  .eq('organization_id', organizationId)
                  .single();
                
                if (agent) {
                  agentName = agent.name;
                }
              }

              // Criar ocorrência
              const { error: insertError } = await supabase
                .from('rule_occurrences')
                .insert({
                  rule_id: rule.id,
                  chat_id: message.chat_id,
                  message_id: message.id,
                  matched_keyword: keyword,
                  message_content: message.content,
                  message_timestamp: message.created_at,
                  customer_name: chat?.name,
                  customer_phone: chat?.whatsapp_jid,
                  agent_name: agentName
                });

              if (!insertError) {
                processedCount++;
                
                // Enviar notificação por email (apenas para processamento histórico se necessário)
                // Comentado por padrão para evitar spam em processamento histórico
                /*
                try {
                  const shouldNotify = await shouldSendNotification(rule.id, organizationId);
                  if (shouldNotify) {
                    const notificationData = {
                      rule_id: rule.id,
                      matched_keyword: keyword,
                      message_content: message.content,
                      customer_name: chat?.name,
                      customer_phone: chat?.whatsapp_jid,
                      agent_name: agentName,
                      message_timestamp: message.created_at,
                      organization_id: organizationId
                    };
                    
                    await sendRuleNotificationEmail(notificationData);
                  }
                } catch (emailError) {
                  console.error('❌ Erro ao enviar notificação por email:', emailError);
                }
                */
              }
            }
          }
        }
      }
    }

    console.log(`✅ Processamento concluído. ${processedCount} ocorrências encontradas.`);
    return { processed: processedCount };

  } catch (error) {
    console.error('❌ Erro ao processar mensagens históricas:', error);
    throw error;
  }
}; 