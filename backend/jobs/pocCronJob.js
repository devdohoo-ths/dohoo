import cron from 'node-cron';
import { runPocNotificationCheck } from '../services/pocNotificationService.js';
import { checkAndSendExpiringPocEmails, sendExpiredPocEmails } from '../services/pocEmailService.js';

/**
 * Job/Cron para verificação automática de POCs
 * Executa diariamente para verificar POCs expirando e enviar notificações
 */

// Configuração do cron job
const POC_CRON_SCHEDULE = '0 9 * * *'; // Todo dia às 9:00
const POC_CRON_TIMEZONE = 'America/Sao_Paulo';

let pocCronJob = null;

/**
 * Iniciar o cron job de POC
 */
export const startPocCronJob = () => {
  try {
    console.log('🕐 [POC Cron] Iniciando cron job de POC...');
    console.log(`🕐 [POC Cron] Agendamento: ${POC_CRON_SCHEDULE} (${POC_CRON_TIMEZONE})`);

    pocCronJob = cron.schedule(POC_CRON_SCHEDULE, async () => {
      console.log('🕐 [POC Cron] Executando verificação de POCs...');
      
      try {
        // 1. Executar verificação de status das POCs
        const result = await runPocNotificationCheck();
        
        if (result.success) {
          console.log(`✅ [POC Cron] Verificação de status concluída:`, {
            notificationsSent: result.notificationsSent,
            pocsProcessed: result.pocsProcessed
          });
        } else {
          console.error(`❌ [POC Cron] Erro na verificação de status:`, result.error);
        }
        
        // 2. Verificar e enviar emails para POCs próximas do vencimento
        console.log('📧 [POC Cron] Verificando POCs próximas do vencimento...');
        const expiringResult = await checkAndSendExpiringPocEmails();
        console.log(`✅ [POC Cron] Emails de vencimento: ${expiringResult.sent} enviado(s), ${expiringResult.failed} falha(s)`);
        
        // 3. Enviar emails para POCs expiradas
        console.log('📧 [POC Cron] Verificando POCs expiradas...');
        const expiredResult = await sendExpiredPocEmails();
        console.log(`✅ [POC Cron] Emails de expiração: ${expiredResult.sent} enviado(s), ${expiredResult.failed} falha(s)`);
        
      } catch (error) {
        console.error('❌ [POC Cron] Erro inesperado na verificação:', error);
      }
    }, {
      scheduled: true,
      timezone: POC_CRON_TIMEZONE
    });

    console.log('✅ [POC Cron] Cron job iniciado com sucesso');
    return true;

  } catch (error) {
    console.error('❌ [POC Cron] Erro ao iniciar cron job:', error);
    return false;
  }
};

/**
 * Parar o cron job de POC
 */
export const stopPocCronJob = () => {
  try {
    if (pocCronJob) {
      pocCronJob.stop();
      pocCronJob = null;
      console.log('✅ [POC Cron] Cron job parado');
      return true;
    } else {
      console.log('⚠️ [POC Cron] Nenhum cron job ativo para parar');
      return false;
    }
  } catch (error) {
    console.error('❌ [POC Cron] Erro ao parar cron job:', error);
    return false;
  }
};

/**
 * Verificar status do cron job
 */
export const getPocCronJobStatus = () => {
  return {
    isRunning: pocCronJob ? pocCronJob.running : false,
    schedule: POC_CRON_SCHEDULE,
    timezone: POC_CRON_TIMEZONE,
    nextRun: pocCronJob ? pocCronJob.nextDate() : null
  };
};

/**
 * Executar verificação manual (para testes)
 */
export const runManualPocCheck = async () => {
  try {
    console.log('🔧 [POC Cron] Executando verificação manual...');
    
    // 1. Verificação de status
    const result = await runPocNotificationCheck();
    console.log('🔧 [POC Cron] Verificação de status:', result);
    
    // 2. Emails de vencimento
    const expiringResult = await checkAndSendExpiringPocEmails();
    console.log('🔧 [POC Cron] Emails de vencimento:', expiringResult);
    
    // 3. Emails de expiração
    const expiredResult = await sendExpiredPocEmails();
    console.log('🔧 [POC Cron] Emails de expiração:', expiredResult);
    
    return {
      success: true,
      statusCheck: result,
      expiringEmails: expiringResult,
      expiredEmails: expiredResult
    };
    
  } catch (error) {
    console.error('❌ [POC Cron] Erro na verificação manual:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Inicializar automaticamente quando o módulo for importado
 */
console.log('🕐 [POC Cron] Módulo carregado. Use startPocCronJob() para iniciar.');

// Exportar funções
export default {
  startPocCronJob,
  stopPocCronJob,
  getPocCronJobStatus,
  runManualPocCheck
};
