import { supabase } from '../lib/supabaseClient.js';
import { sendEmail } from './emailService.js';

/**
 * Busca informações dos gestores da organização para envio de notificações
 * @param {string} organizationId - ID da organização
 * @returns {Array} Lista de gestores com email
 */
const getOrganizationManagers = async (organizationId) => {
  try {
    const { data: managers, error } = await supabase
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
      .eq('organization_id', organizationId)
      .not('role_id', 'is', null)
      .not('email', 'is', null);

    if (error) {
      console.error('❌ Erro ao buscar gestores:', error);
      return [];
    }

    if (!managers || managers.length === 0) {
      return [];
    }

    // Filtrar apenas administradores (admin e super_admin)
    const adminManagers = managers.filter(manager => {
      const roleName = manager.roles?.name?.toLowerCase();
      return roleName?.includes('admin');
    });

    console.log(`✅ Encontrados ${adminManagers.length} administradores para notificação de regras:`, 
      adminManagers.map(admin => `${admin.name} (${admin.roles?.name})`).join(', '));

    return adminManagers || [];
  } catch (error) {
    console.error('❌ Erro ao buscar gestores:', error);
    return [];
  }
};

/**
 * Cria template HTML para notificação de regra acionada
 * @param {Object} ruleData - Dados da regra e ocorrência
 * @returns {string} HTML do email
 */
const createRuleNotificationTemplate = (ruleData) => {
  const {
    ruleName,
    matchedKeyword,
    messageContent,
    customerName,
    customerPhone,
    agentName,
    messageTimestamp,
    organizationName
  } = ruleData;

  const formattedDate = new Date(messageTimestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alerta de Regra Acionada</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #e74c3c;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .alert-icon {
          font-size: 48px;
          color: #e74c3c;
          margin-bottom: 10px;
        }
        .title {
          color: #e74c3c;
          font-size: 24px;
          font-weight: bold;
          margin: 0;
        }
        .subtitle {
          color: #666;
          font-size: 16px;
          margin: 5px 0 0 0;
        }
        .info-section {
          background-color: #f8f9fa;
          border-left: 4px solid #007bff;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .info-title {
          color: #007bff;
          font-weight: bold;
          font-size: 18px;
          margin: 0 0 15px 0;
        }
        .info-item {
          margin: 10px 0;
          display: flex;
          align-items: center;
        }
        .info-label {
          font-weight: bold;
          color: #495057;
          min-width: 120px;
          margin-right: 10px;
        }
        .info-value {
          color: #212529;
          flex: 1;
        }
        .message-content {
          background-color: #fff;
          border: 1px solid #dee2e6;
          border-radius: 5px;
          padding: 15px;
          margin: 15px 0;
          font-style: italic;
          color: #495057;
        }
        .highlight {
          background-color: #fff3cd;
          padding: 2px 4px;
          border-radius: 3px;
          font-weight: bold;
          color: #856404;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          color: #6c757d;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="alert-icon">🚨</div>
          <h1 class="title">Regra de Monitoramento Acionada</h1>
          <p class="subtitle">${organizationName}</p>
        </div>

        <div class="info-section">
          <h2 class="info-title">📋 Detalhes da Regra</h2>
          <div class="info-item">
            <span class="info-label">Regra:</span>
            <span class="info-value">${ruleName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Palavra-chave:</span>
            <span class="info-value"><span class="highlight">${matchedKeyword}</span></span>
          </div>
          <div class="info-item">
            <span class="info-label">Data/Hora:</span>
            <span class="info-value">${formattedDate}</span>
          </div>
        </div>

        <div class="info-section">
          <h2 class="info-title">👤 Informações do Cliente</h2>
          <div class="info-item">
            <span class="info-label">Nome:</span>
            <span class="info-value">${customerName || 'Não informado'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Telefone:</span>
            <span class="info-value">${customerPhone || 'Não informado'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Agente:</span>
            <span class="info-value">${agentName}</span>
          </div>
        </div>

        <div class="info-section">
          <h2 class="info-title">💬 Mensagem Detectada</h2>
          <div class="message-content">
            "${messageContent}"
          </div>
        </div>

        <div class="footer">
          <p>Este é um alerta automático do sistema Dohoo.</p>
          <p>Para mais informações, acesse o painel administrativo.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Envia notificação por email quando uma regra é acionada
 * @param {Object} occurrenceData - Dados da ocorrência da regra
 * @param {string} occurrenceData.rule_id - ID da regra
 * @param {string} occurrenceData.matched_keyword - Palavra-chave encontrada
 * @param {string} occurrenceData.message_content - Conteúdo da mensagem
 * @param {string} occurrenceData.customer_name - Nome do cliente
 * @param {string} occurrenceData.customer_phone - Telefone do cliente
 * @param {string} occurrenceData.agent_name - Nome do agente
 * @param {string} occurrenceData.message_timestamp - Timestamp da mensagem
 * @param {string} occurrenceData.organization_id - ID da organização
 */
export const sendRuleNotificationEmail = async (occurrenceData) => {
  try {
    console.log('📧 Preparando envio de notificação de regra...');
    console.log('📧 [DEBUG] Dados recebidos:', occurrenceData);

    // Buscar informações da regra
    const { data: rule, error: ruleError } = await supabase
      .from('monitoring_rules')
      .select('name, organization_id')
      .eq('id', occurrenceData.rule_id)
      .single();

    if (ruleError || !rule) {
      console.error('❌ Erro ao buscar dados da regra:', ruleError);
      return { success: false, error: 'Regra não encontrada' };
    }

    // Buscar nome da organização
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', rule.organization_id)
      .single();

    if (orgError || !organization) {
      console.error('❌ Erro ao buscar dados da organização:', orgError);
      return { success: false, error: 'Organização não encontrada' };
    }

    // Buscar gestores para envio
    console.log(`📧 [DEBUG] Buscando administradores para organização: ${rule.organization_id}`);
    const managers = await getOrganizationManagers(rule.organization_id);
    console.log(`📧 [DEBUG] Administradores encontrados: ${managers.length}`);
    
    if (managers.length === 0) {
      console.warn('⚠️ Nenhum gestor encontrado para envio de notificação');
      return { success: false, error: 'Nenhum gestor encontrado' };
    }

    // Preparar dados para o template
    const templateData = {
      ruleName: rule.name,
      matchedKeyword: occurrenceData.matched_keyword,
      messageContent: occurrenceData.message_content,
      customerName: occurrenceData.customer_name,
      customerPhone: occurrenceData.customer_phone,
      agentName: occurrenceData.agent_name,
      messageTimestamp: occurrenceData.message_timestamp,
      organizationName: organization.name
    };

    // Criar template do email
    const emailHtml = createRuleNotificationTemplate(templateData);
    const subject = `🚨 Alerta: Regra "${rule.name}" acionada - ${organization.name}`;
    
    console.log(`📧 [DEBUG] Preparando envio para ${managers.length} administrador(es)`);
    managers.forEach(manager => {
      console.log(`📧 [DEBUG] - ${manager.name} (${manager.email})`);
    });

    // Enviar email para todos os gestores
    const emailPromises = managers.map(manager => {
      console.log(`📧 [DEBUG] Enviando e-mail para: ${manager.email}`);
      return sendEmail(manager.email, subject, emailHtml);
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    const failed = results.filter(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && !result.value.success)
    ).length;

    console.log(`✅ Notificação enviada: ${successful} sucesso, ${failed} falhas`);

    return {
      success: successful > 0,
      sent: successful,
      failed: failed,
      managers: managers.length
    };

  } catch (error) {
    console.error('❌ Erro ao enviar notificação de regra:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verifica se deve enviar notificação baseado na frequência configurada
 * @param {string} ruleId - ID da regra
 * @param {string} organizationId - ID da organização
 * @returns {boolean} Se deve enviar notificação
 */
export const shouldSendNotification = async (ruleId, organizationId) => {
  try {
    // Por enquanto, sempre envia notificação
    // Futuramente pode implementar lógica de frequência (ex: máximo 1 por hora)
    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar se deve enviar notificação:', error);
    return false;
  }
};
