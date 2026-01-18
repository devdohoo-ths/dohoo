// Script para verificar estrutura da tabela messages
import { supabase } from '../lib/supabaseClient.js';

async function verificarEstruturaMessages() {
  try {
    console.log('🔍 Verificando estrutura da tabela messages...');

    // Buscar algumas mensagens para ver a estrutura
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ Erro ao buscar mensagens:', error);
      return;
    }

    console.log('📊 Mensagens encontradas:', messages?.length || 0);
    
    if (messages && messages.length > 0) {
      console.log('📋 Estrutura da primeira mensagem:');
      console.log(JSON.stringify(messages[0], null, 2));
    }

    // Verificar colunas disponíveis
    console.log('\n🔍 Colunas disponíveis:');
    if (messages && messages.length > 0) {
      Object.keys(messages[0]).forEach(coluna => {
        console.log(`- ${coluna}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar
verificarEstruturaMessages();
