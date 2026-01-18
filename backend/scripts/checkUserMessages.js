import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'your-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserMessages() {
  try {
    console.log('🔍 Verificando mensagens dos usuários...');
    
    // Buscar usuários com métricas
    const { data: metrics, error: metricsError } = await supabase
      .from('whatsapp_productivity_metrics')
      .select('user_id, organization_id, productivity_score')
      .limit(10);
    
    if (metricsError) {
      console.error('❌ Erro ao buscar métricas:', metricsError);
      return;
    }
    
    console.log(`📊 Verificando ${metrics.length} usuários...`);
    
    for (const metric of metrics) {
      console.log(`\n👤 Usuário: ${metric.user_id}`);
      console.log(`📈 Produtividade: ${metric.productivity_score}%`);
      
      // Buscar mensagens do usuário
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, created_at, is_from_me, content')
        .eq('user_id', metric.user_id)
        .eq('organization_id', metric.organization_id)
        .gte('created_at', '2025-09-25T00:00:00')
        .lte('created_at', '2025-09-25T23:59:59')
        .limit(5);
      
      if (messagesError) {
        console.error(`❌ Erro ao buscar mensagens:`, messagesError);
        continue;
      }
      
      console.log(`💬 Mensagens encontradas: ${messages.length}`);
      
      if (messages.length > 0) {
        console.log('📝 Primeiras mensagens:');
        messages.forEach((msg, index) => {
          console.log(`  ${index + 1}. ${msg.is_from_me ? 'Enviada' : 'Recebida'}: ${msg.content?.substring(0, 50)}...`);
        });
      } else {
        console.log('⚠️ Nenhuma mensagem encontrada para hoje');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkUserMessages();
