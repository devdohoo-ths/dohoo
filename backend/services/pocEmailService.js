import { supabase } from '../integrations/supabase/client.js';
import { sendEmail } from './emailService.js';

// Função para substituir variáveis no template
const replaceTemplateVariables = (text, variables) => {
  let result = text;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  
  return result;
};

// Função para formatar data
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Função para enviar email usando template
export async function sendPocEmail(organizationId, templateId, customVariables = {}) {
  try {
    console.log('📧 [POC Email] Iniciando envio de email:', { organizationId, templateId });

    // Buscar dados da organização
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      throw new Error('Organização não encontrada');
    }

    // Buscar template
    const { data: template, error: templateError } = await supabase
      .from('poc_email_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error('Template não encontrado ou inativo');
    }

    // Calcular dias restantes
    let daysRemaining = null;
    if (organization.is_poc && organization.poc_end_date) {
      const endDate = new Date(organization.poc_end_date);
      const today = new Date();
      const diffTime = endDate - today;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Preparar variáveis do template
    const variables = {
      organization_name: organization.name,
      poc_start_date: formatDate(organization.poc_start_date),
      poc_end_date: formatDate(organization.poc_end_date),
      poc_duration_days: organization.poc_duration_days || 0,
      days_remaining: daysRemaining !== null ? daysRemaining : 0,
      contact_url: process.env.CONTACT_URL || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/contato`,
      ...customVariables
    };

    // Substituir variáveis no subject e body
    const subject = replaceTemplateVariables(template.subject, variables);
    const body = replaceTemplateVariables(template.body, variables);

    // Determinar email do destinatário
    const recipientEmail = organization.poc_contact_email || organization.financial_email;
    
    if (!recipientEmail) {
      throw new Error('Nenhum email de contato encontrado para a organização');
    }

    // Enviar email usando o emailService.js que já funciona
    console.log('📤 [POC Email] Enviando email para:', recipientEmail);
    
    const emailResult = await sendEmail(recipientEmail, subject, body);
    
    if (!emailResult.success) {
      console.warn('⚠️ [POC Email] Falha ao enviar email:', emailResult.error);
      
      // Registrar no histórico como "failed"
      await supabase
        .from('poc_email_history')
        .insert({
          organization_id: organizationId,
          template_id: templateId,
          recipient_email: recipientEmail,
          subject: subject,
          body: body,
          status: 'failed',
          error_message: emailResult.error || 'SMTP não configurado',
          metadata: { variables }
        });
      
      return {
        success: false,
        message: emailResult.error || 'Erro ao enviar email'
      };
    }

    console.log('✅ [POC Email] Email enviado:', emailResult.messageId);

    // Registrar no histórico
    await supabase
      .from('poc_email_history')
      .insert({
        organization_id: organizationId,
        template_id: templateId,
        recipient_email: recipientEmail,
        subject: subject,
        body: body,
        status: 'sent',
        metadata: {
          variables,
          messageId: emailResult.messageId
        }
      });

    return {
      success: true,
      message: 'Email enviado com sucesso',
      messageId: emailResult.messageId
    };

  } catch (error) {
    console.error('❌ [POC Email] Erro ao enviar email:', error);

    // Tentar registrar erro no histórico
    try {
      await supabase
        .from('poc_email_history')
        .insert({
          organization_id: organizationId,
          template_id: templateId,
          recipient_email: 'unknown',
          subject: 'Erro ao enviar',
          body: 'Erro ao processar template',
          status: 'failed',
          error_message: error.message
        });
    } catch (historyError) {
      console.error('❌ [POC Email] Erro ao registrar no histórico:', historyError);
    }

    throw error;
  }
}

// Função para verificar e enviar emails para POCs próximas do vencimento
export async function checkAndSendExpiringPocEmails() {
  try {
    console.log('🔍 [POC Email] Verificando POCs próximas do vencimento...');

    // Buscar todas as POCs ativas
    const { data: activePocs, error: pocsError } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_poc', true)
      .eq('poc_status', 'active')
      .not('poc_end_date', 'is', null);

    if (pocsError) {
      throw new Error('Erro ao buscar POCs ativas: ' + pocsError.message);
    }

    if (!activePocs || activePocs.length === 0) {
      console.log('ℹ️ [POC Email] Nenhuma POC ativa encontrada');
      return { sent: 0, failed: 0 };
    }

    console.log(`📊 [POC Email] ${activePocs.length} POC(s) ativa(s) encontrada(s)`);

    // Buscar templates ativos do tipo 'expiring_soon'
    const { data: templates, error: templatesError } = await supabase
      .from('poc_email_templates')
      .select('*')
      .eq('type', 'expiring_soon')
      .eq('is_active', true)
      .not('days_before', 'is', null)
      .order('days_before', { ascending: false });

    if (templatesError || !templates || templates.length === 0) {
      console.log('⚠️ [POC Email] Nenhum template ativo encontrado');
      return { sent: 0, failed: 0 };
    }

    console.log(`📧 [POC Email] ${templates.length} template(s) ativo(s) encontrado(s)`);

    let sent = 0;
    let failed = 0;

    // Para cada POC, verificar se deve enviar email
    for (const poc of activePocs) {
      try {
        const endDate = new Date(poc.poc_end_date);
        const today = new Date();
        const diffTime = endDate - today;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        console.log(`📅 [POC Email] ${poc.name}: ${daysRemaining} dias restantes`);

        // Verificar se já enviou notificações
        const notificationsSent = poc.poc_notifications_sent || [];

        // Para cada template, verificar se deve enviar
        for (const template of templates) {
          const daysBefore = template.days_before;
          
          // Verificar se está no dia certo para enviar
          if (daysRemaining === daysBefore) {
            // Verificar se já enviou este template
            const notificationKey = `${template.type}_${daysBefore}`;
            
            if (notificationsSent.includes(notificationKey)) {
              console.log(`ℹ️ [POC Email] Notificação já enviada: ${poc.name} - ${template.name}`);
              continue;
            }

            console.log(`📤 [POC Email] Enviando: ${poc.name} - ${template.name}`);

            // Enviar email
            const result = await sendPocEmail(poc.id, template.id);

            if (result.success) {
              sent++;
              
              // Atualizar lista de notificações enviadas
              notificationsSent.push(notificationKey);
              
              await supabase
                .from('organizations')
                .update({
                  poc_notifications_sent: notificationsSent
                })
                .eq('id', poc.id);

              console.log(`✅ [POC Email] Email enviado: ${poc.name} - ${template.name}`);
            } else {
              failed++;
              console.log(`⚠️ [POC Email] Email não enviado (SMTP não configurado): ${poc.name}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ [POC Email] Erro ao processar POC ${poc.name}:`, error);
        failed++;
      }
    }

    console.log(`📊 [POC Email] Resumo: ${sent} enviado(s), ${failed} falha(s)`);

    return { sent, failed };

  } catch (error) {
    console.error('❌ [POC Email] Erro ao verificar POCs:', error);
    throw error;
  }
}

// Função para enviar email de POC expirada
export async function sendExpiredPocEmails() {
  try {
    console.log('🔍 [POC Email] Verificando POCs expiradas...');

    // Buscar POCs que expiraram hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: expiredPocs, error: pocsError } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_poc', true)
      .eq('poc_status', 'expired')
      .gte('poc_end_date', today.toISOString())
      .lt('poc_end_date', tomorrow.toISOString());

    if (pocsError) {
      throw new Error('Erro ao buscar POCs expiradas: ' + pocsError.message);
    }

    if (!expiredPocs || expiredPocs.length === 0) {
      console.log('ℹ️ [POC Email] Nenhuma POC expirada hoje');
      return { sent: 0, failed: 0 };
    }

    // Buscar template de expiração
    const { data: template, error: templateError } = await supabase
      .from('poc_email_templates')
      .select('*')
      .eq('type', 'expired')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.log('⚠️ [POC Email] Template de expiração não encontrado');
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const poc of expiredPocs) {
      try {
        // Verificar se já enviou notificação de expiração
        const notificationsSent = poc.poc_notifications_sent || [];
        
        if (notificationsSent.includes('expired')) {
          console.log(`ℹ️ [POC Email] Notificação de expiração já enviada: ${poc.name}`);
          continue;
        }

        console.log(`📤 [POC Email] Enviando email de expiração: ${poc.name}`);

        const result = await sendPocEmail(poc.id, template.id);

        if (result.success) {
          sent++;
          
          // Atualizar lista de notificações enviadas
          notificationsSent.push('expired');
          
          await supabase
            .from('organizations')
            .update({
              poc_notifications_sent: notificationsSent
            })
            .eq('id', poc.id);

          console.log(`✅ [POC Email] Email de expiração enviado: ${poc.name}`);
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ [POC Email] Erro ao processar POC expirada ${poc.name}:`, error);
        failed++;
      }
    }

    console.log(`📊 [POC Email] Emails de expiração: ${sent} enviado(s), ${failed} falha(s)`);

    return { sent, failed };

  } catch (error) {
    console.error('❌ [POC Email] Erro ao enviar emails de expiração:', error);
    throw error;
  }
}

export default {
  sendPocEmail,
  checkAndSendExpiringPocEmails,
  sendExpiredPocEmails
};

