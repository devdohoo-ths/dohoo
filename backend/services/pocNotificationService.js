import { supabase } from '../lib/supabaseClient.js';

/**
 * Serviço de notificações POC
 * Gerencia o envio de notificações sobre POCs expirando
 */

// Configurações de notificação
const NOTIFICATION_CONFIG = {
  warning_7_days: {
    days: 7,
    type: 'warning_7_days',
    subject: 'POC expirando em 7 dias - Ação necessária',
    whatsapp_template: 'poc_warning_7_days',
    email_template: 'poc_warning_7_days'
  },
  warning_3_days: {
    days: 3,
    type: 'warning_3_days',
    subject: 'POC expirando em 3 dias - Ação urgente',
    whatsapp_template: 'poc_warning_3_days',
    email_template: 'poc_warning_3_days'
  },
  final_1_day: {
    days: 1,
    type: 'final_1_day',
    subject: 'POC expira amanhã - Última chance',
    whatsapp_template: 'poc_final_1_day',
    email_template: 'poc_final_1_day'
  },
  expired: {
    days: 0,
    type: 'expired',
    subject: 'POC expirada - Organização desativada',
    whatsapp_template: 'poc_expired',
    email_template: 'poc_expired'
  }
};

/**
 * Buscar POCs que precisam de notificação
 */
export const getPocsNeedingNotification = async () => {
  try {
    console.log('🔔 [POC] Buscando POCs que precisam de notificação...');

    // Buscar POCs ativas
    const { data: activePocs, error: activeError } = await supabase
      .from('organizations')
      .select(`
        id, name, poc_start_date, poc_end_date, poc_duration_days,
        poc_notifications_sent, contact_email, contact_phone,
        profiles!inner(id, name, email, phone)
      `)
      .eq('is_poc', true)
      .eq('poc_status', 'active')
      .not('poc_end_date', 'is', null);

    if (activeError) {
      console.error('❌ [POC] Erro ao buscar POCs ativas:', activeError);
      return [];
    }

    const pocsToNotify = [];

    for (const poc of activePocs || []) {
      const endDate = new Date(poc.poc_end_date);
      const today = new Date();
      const diffTime = endDate - today;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Verificar quais notificações já foram enviadas
      const sentNotifications = poc.poc_notifications_sent || [];

      // Verificar se precisa de notificação
      for (const [key, config] of Object.entries(NOTIFICATION_CONFIG)) {
        if (daysRemaining <= config.days && daysRemaining >= 0) {
          if (!sentNotifications.includes(config.type)) {
            pocsToNotify.push({
              ...poc,
              days_remaining: daysRemaining,
              notification_type: config.type,
              notification_config: config
            });
          }
        }
      }
    }

    console.log(`✅ [POC] ${pocsToNotify.length} POCs precisam de notificação`);
    return pocsToNotify;

  } catch (error) {
    console.error('❌ [POC] Erro ao buscar POCs para notificação:', error);
    return [];
  }
};

/**
 * Enviar notificação POC
 */
export const sendPocNotification = async (poc, notificationType) => {
  try {
    console.log(`🔔 [POC] Enviando notificação ${notificationType} para ${poc.name}`);

    const config = NOTIFICATION_CONFIG[notificationType];
    if (!config) {
      throw new Error(`Tipo de notificação inválido: ${notificationType}`);
    }

    const results = {
      email: { sent: false, error: null },
      whatsapp: { sent: false, error: null }
    };

    // Enviar email se tiver contato
    if (poc.contact_email) {
      try {
        await sendEmailNotification(poc, config);
        results.email.sent = true;
        console.log(`✅ [POC] Email enviado para ${poc.contact_email}`);
      } catch (error) {
        results.email.error = error.message;
        console.error(`❌ [POC] Erro ao enviar email:`, error);
      }
    }

    // Enviar WhatsApp se tiver contato
    if (poc.contact_phone) {
      try {
        await sendWhatsAppNotification(poc, config);
        results.whatsapp.sent = true;
        console.log(`✅ [POC] WhatsApp enviado para ${poc.contact_phone}`);
      } catch (error) {
        results.whatsapp.error = error.message;
        console.error(`❌ [POC] Erro ao enviar WhatsApp:`, error);
      }
    }

    // Registrar notificação no banco
    await recordNotification(poc, notificationType, results);

    // Atualizar lista de notificações enviadas
    await updateSentNotifications(poc.id, notificationType);

    return results;

  } catch (error) {
    console.error('❌ [POC] Erro ao enviar notificação:', error);
    throw error;
  }
};

/**
 * Enviar notificação por email
 */
const sendEmailNotification = async (poc, config) => {
  // Aqui você integraria com seu serviço de email (SendGrid, AWS SES, etc.)
  // Por enquanto, vamos simular o envio
  
  const emailContent = generateEmailContent(poc, config);
  
  console.log(`📧 [POC] Simulando envio de email para ${poc.contact_email}:`);
  console.log(`Assunto: ${config.subject}`);
  console.log(`Conteúdo: ${emailContent}`);
  
  // TODO: Implementar envio real de email
  // await emailService.send({
  //   to: poc.contact_email,
  //   subject: config.subject,
  //   html: emailContent
  // });
  
  return true;
};

/**
 * Enviar notificação por WhatsApp
 */
const sendWhatsAppNotification = async (poc, config) => {
  // Aqui você integraria com sua API de WhatsApp
  // Por enquanto, vamos simular o envio
  
  const whatsappMessage = generateWhatsAppMessage(poc, config);
  
  console.log(`📱 [POC] Simulando envio de WhatsApp para ${poc.contact_phone}:`);
  console.log(`Mensagem: ${whatsappMessage}`);
  
  // TODO: Implementar envio real de WhatsApp
  // await whatsappService.sendMessage({
  //   to: poc.contact_phone,
  //   message: whatsappMessage
  // });
  
  return true;
};

/**
 * Gerar conteúdo do email
 */
const generateEmailContent = (poc, config) => {
  const daysText = config.days === 0 ? 'hoje' : `em ${config.days} dia${config.days > 1 ? 's' : ''}`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">🚨 Aviso Importante - POC ${poc.name}</h2>
      
      <p>Olá,</p>
      
      <p>Este é um aviso automático sobre o período de POC da organização <strong>${poc.name}</strong>.</p>
      
      <div style="background-color: ${config.days <= 1 ? '#fef2f2' : '#fef3c7'}; border: 1px solid ${config.days <= 1 ? '#fecaca' : '#fde68a'}; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="color: ${config.days <= 1 ? '#dc2626' : '#d97706'}; margin: 0 0 8px 0;">
          ${config.days === 0 ? '⚠️ POC Expirada' : '⏰ POC Expirando'}
        </h3>
        <p style="margin: 0;">
          ${config.days === 0 
            ? 'Sua POC expirou hoje e a organização foi desativada.'
            : `Sua POC expira ${daysText} (${new Date(poc.poc_end_date).toLocaleDateString('pt-BR')}).`
          }
        </p>
      </div>
      
      ${config.days > 0 ? `
        <h3>Próximos Passos:</h3>
        <ul>
          <li>Entre em contato conosco para conversar sobre um plano completo</li>
          <li>Ou solicite uma extensão da POC se precisar de mais tempo</li>
        </ul>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="mailto:contato@dohoo.com" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Entrar em Contato
          </a>
        </div>
      ` : `
        <h3>O que aconteceu:</h3>
        <p>Sua organização foi automaticamente desativada devido ao término da POC. Para reativar, entre em contato conosco.</p>
      `}
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      
      <p style="color: #6b7280; font-size: 14px;">
        Este é um aviso automático do sistema Dohoo.<br>
        Se você tiver dúvidas, entre em contato conosco.
      </p>
    </div>
  `;
};

/**
 * Gerar mensagem do WhatsApp
 */
const generateWhatsAppMessage = (poc, config) => {
  const daysText = config.days === 0 ? 'hoje' : `em ${config.days} dia${config.days > 1 ? 's' : ''}`;
  
  let message = `🚨 *Aviso POC - ${poc.name}*\n\n`;
  
  if (config.days === 0) {
    message += `⚠️ Sua POC expirou hoje e a organização foi desativada.\n\n`;
    message += `Para reativar, entre em contato conosco.\n\n`;
  } else {
    message += `⏰ Sua POC expira ${daysText} (${new Date(poc.poc_end_date).toLocaleDateString('pt-BR')}).\n\n`;
    message += `Para continuar usando o sistema:\n`;
    message += `• Entre em contato para um plano completo\n`;
    message += `• Ou solicite uma extensão da POC\n\n`;
  }
  
  message += `📧 Email: contato@dohoo.com\n`;
  message += `📱 WhatsApp: (11) 99999-9999\n\n`;
  message += `_Aviso automático do sistema Dohoo_`;
  
  return message;
};

/**
 * Registrar notificação no banco
 */
const recordNotification = async (poc, notificationType, results) => {
  try {
    const sentVia = [];
    if (results.email.sent) sentVia.push('email');
    if (results.whatsapp.sent) sentVia.push('whatsapp');
    
    await supabase
      .from('poc_notifications')
      .insert({
        organization_id: poc.id,
        type: notificationType,
        sent_via: sentVia.join(','),
        status: results.email.sent || results.whatsapp.sent ? 'sent' : 'failed',
        recipient_email: poc.contact_email,
        recipient_phone: poc.contact_phone,
        message_content: generateWhatsAppMessage(poc, NOTIFICATION_CONFIG[notificationType]),
        metadata: {
          email_result: results.email,
          whatsapp_result: results.whatsapp,
          days_remaining: poc.days_remaining
        }
      });
      
    console.log(`✅ [POC] Notificação registrada no banco`);
  } catch (error) {
    console.error('❌ [POC] Erro ao registrar notificação:', error);
  }
};

/**
 * Atualizar lista de notificações enviadas
 */
const updateSentNotifications = async (organizationId, notificationType) => {
  try {
    // Buscar notificações atuais
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('poc_notifications_sent')
      .eq('id', organizationId)
      .single();

    if (fetchError) {
      console.error('❌ [POC] Erro ao buscar organização:', fetchError);
      return;
    }

    const currentNotifications = org.poc_notifications_sent || [];
    const updatedNotifications = [...currentNotifications, notificationType];

    // Atualizar
    await supabase
      .from('organizations')
      .update({ poc_notifications_sent: updatedNotifications })
      .eq('id', organizationId);

    console.log(`✅ [POC] Lista de notificações atualizada`);
  } catch (error) {
    console.error('❌ [POC] Erro ao atualizar notificações enviadas:', error);
  }
};

/**
 * Processar POCs expiradas
 */
export const processExpiredPocs = async () => {
  try {
    console.log('🔔 [POC] Processando POCs expiradas...');

    // Buscar POCs expiradas
    const { data: expiredPocs, error: expiredError } = await supabase
      .from('organizations')
      .select('id, name, poc_end_date')
      .eq('is_poc', true)
      .eq('poc_status', 'active')
      .lt('poc_end_date', new Date().toISOString());

    if (expiredError) {
      console.error('❌ [POC] Erro ao buscar POCs expiradas:', expiredError);
      return;
    }

    for (const poc of expiredPocs || []) {
      try {
        // Desativar organização
        await supabase
          .from('organizations')
          .update({ 
            poc_status: 'expired',
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', poc.id);

        // Registrar no histórico
        await supabase
          .from('poc_history')
          .insert({
            organization_id: poc.id,
            action: 'expired',
            old_end_date: poc.poc_end_date,
            new_end_date: null,
            notes: 'POC expirada automaticamente pelo sistema',
            metadata: {
              auto_expired: true,
              expired_at: new Date().toISOString()
            }
          });

        console.log(`✅ [POC] Organização ${poc.name} desativada por POC expirada`);

        // Enviar notificação de expiração
        await sendPocNotification(poc, 'expired');

      } catch (error) {
        console.error(`❌ [POC] Erro ao processar POC expirada ${poc.name}:`, error);
      }
    }

    console.log(`✅ [POC] ${expiredPocs?.length || 0} POCs expiradas processadas`);

  } catch (error) {
    console.error('❌ [POC] Erro ao processar POCs expiradas:', error);
  }
};

/**
 * Executar verificação completa de POCs
 */
export const runPocNotificationCheck = async () => {
  try {
    console.log('🔔 [POC] Iniciando verificação de notificações POC...');

    // 1. Processar POCs expiradas primeiro
    await processExpiredPocs();

    // 2. Buscar POCs que precisam de notificação
    const pocsToNotify = await getPocsNeedingNotification();

    // 3. Enviar notificações
    let notificationsSent = 0;
    for (const poc of pocsToNotify) {
      try {
        await sendPocNotification(poc, poc.notification_type);
        notificationsSent++;
      } catch (error) {
        console.error(`❌ [POC] Erro ao enviar notificação para ${poc.name}:`, error);
      }
    }

    console.log(`✅ [POC] Verificação concluída: ${notificationsSent} notificações enviadas`);

    return {
      success: true,
      notificationsSent,
      pocsProcessed: pocsToNotify.length
    };

  } catch (error) {
    console.error('❌ [POC] Erro na verificação de POCs:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
