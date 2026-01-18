import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetricsData() {
  try {
    console.log('🔍 Verificando dados na tabela whatsapp_productivity_metrics...');
    
    // Verificar se a tabela existe
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'whatsapp_productivity_metrics');
    
    if (tablesError) {
      console.error('❌ Erro ao verificar tabelas:', tablesError);
      return;
    }
    
    if (tables.length === 0) {
      console.log('❌ Tabela whatsapp_productivity_metrics não existe!');
      console.log('📝 Execute o script de migração primeiro.');
      return;
    }
    
    console.log('✅ Tabela existe');
    
    // Verificar dados na tabela
    const { data: metrics, error: metricsError } = await supabase
      .from('whatsapp_productivity_metrics')
      .select('*')
      .limit(10);
    
    if (metricsError) {
      console.error('❌ Erro ao buscar métricas:', metricsError);
      return;
    }
    
    console.log(`📊 Total de registros encontrados: ${metrics.length}`);
    
    if (metrics.length === 0) {
      console.log('⚠️ Nenhum dado encontrado na tabela');
      console.log('🔄 Executando processamento de métricas...');
      
      // Importar e executar o processamento
      const { WhatsAppProductivityService } = await import('../services/whatsappProductivityService.js');
      await WhatsAppProductivityService.processDailyMetrics();
      
      console.log('✅ Processamento executado');
    } else {
      console.log('📈 Dados encontrados:');
      metrics.forEach((metric, index) => {
        console.log(`  ${index + 1}. User: ${metric.user_id}, Date: ${metric.date}, Productivity: ${metric.productivity_score}%`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkMetricsData();
