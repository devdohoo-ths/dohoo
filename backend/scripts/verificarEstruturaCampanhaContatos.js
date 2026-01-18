// Script para verificar estrutura da tabela campanha_contatos
import { supabase } from '../lib/supabaseClient.js';

async function verificarEstruturaCampanhaContatos() {
  try {
    console.log('🔍 Verificando estrutura da tabela campanha_contatos...');

    // Buscar alguns registros para ver a estrutura
    const { data: contatos, error } = await supabase
      .from('campanha_contatos')
      .select('*')
      .limit(3);

    if (error) {
      console.log('❌ Erro ao buscar contatos:', error);
      return;
    }

    console.log('📊 Contatos encontrados:', contatos?.length || 0);
    
    if (contatos && contatos.length > 0) {
      console.log('📋 Estrutura do primeiro contato:');
      console.log(JSON.stringify(contatos[0], null, 2));
    }

    // Verificar colunas disponíveis
    console.log('\n🔍 Colunas disponíveis:');
    if (contatos && contatos.length > 0) {
      Object.keys(contatos[0]).forEach(coluna => {
        console.log(`- ${coluna}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar
verificarEstruturaCampanhaContatos();
