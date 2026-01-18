import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateSampleData() {
  try {
    console.log('🔄 Populando dados de exemplo...');
    
    // 1. Verificar se há usuários
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .not('organization_id', 'is', null)
      .limit(1);
    
    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado. Criando usuário de exemplo...');
      
      // Criar usuário de exemplo
      const { data: newUser, error: userError } = await supabase
        .from('profiles')
        .insert({
          id: 'sample-user-123',
          email: 'sample@example.com',
          organization_id: 'sample-org-123',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (userError) {
        console.error('❌ Erro ao criar usuário:', userError);
        return;
      }
      
      users.push(newUser);
    }
    
    const user = users[0];
    console.log(`✅ Usando usuário: ${user.id}`);
    
    // 2. Criar mensagens de exemplo para os últimos 7 dias
    const messages = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Criar 10-20 mensagens por dia
      const messageCount = Math.floor(Math.random() * 11) + 10;
      
      for (let j = 0; j < messageCount; j++) {
        const hour = Math.floor(Math.random() * 12) + 8; // 8h às 20h
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);
        
        const timestamp = new Date(date);
        timestamp.setHours(hour, minute, second);
        
        const isFromMe = Math.random() > 0.4; // 60% das mensagens são do usuário
        
        messages.push({
          id: `msg-${dateStr}-${j}`,
          chat_id: `chat-${dateStr}`,
          content: `Mensagem de exemplo ${j + 1}`,
          created_at: timestamp.toISOString(),
          user_id: user.id,
          organization_id: user.organization_id,
          is_from_me: isFromMe,
          sender_name: isFromMe ? 'Usuário' : 'Cliente',
          message_type: 'text'
        });
      }
    }
    
    console.log(`📝 Criando ${messages.length} mensagens de exemplo...`);
    
    // 3. Inserir mensagens
    const { error: messagesError } = await supabase
      .from('messages')
      .upsert(messages, { onConflict: 'id' });
    
    if (messagesError) {
      console.error('❌ Erro ao inserir mensagens:', messagesError);
      return;
    }
    
    console.log('✅ Mensagens inseridas com sucesso');
    
    // 4. Processar métricas
    console.log('🔄 Processando métricas...');
    
    const { WhatsAppProductivityService } = await import('../services/whatsappProductivityService.js');
    await WhatsAppProductivityService.processDailyMetrics();
    
    console.log('✅ Dados de exemplo populados com sucesso!');
    
    // 5. Verificar dados inseridos
    const { data: metrics, error: metricsError } = await supabase
      .from('whatsapp_productivity_metrics')
      .select('*')
      .eq('user_id', user.id);
    
    if (metricsError) {
      console.error('❌ Erro ao verificar métricas:', metricsError);
    } else {
      console.log(`📊 ${metrics.length} registros de métricas criados`);
      metrics.forEach(metric => {
        console.log(`  - ${metric.date}: ${metric.productivity_score}% produtividade`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

populateSampleData();
