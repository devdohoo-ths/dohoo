import { WhatsAppProductivityService } from '../services/whatsappProductivityService.js';

async function runMetricsProcessing() {
  try {
    console.log('🔄 Iniciando processamento de métricas do WhatsApp...');
    
    await WhatsAppProductivityService.processDailyMetrics();
    
    console.log('✅ Processamento de métricas concluído!');
    
  } catch (error) {
    console.error('❌ Erro no processamento:', error);
  }
}

runMetricsProcessing();
