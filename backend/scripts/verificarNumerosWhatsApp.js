// Script para verificar números WhatsApp conectados
import { supabase } from '../lib/supabaseClient.js';

async function verificarNumerosWhatsApp() {
  try {
    console.log('📱 Verificando números WhatsApp conectados...');

    // Buscar contas WhatsApp
    const { data: contasWhatsApp, error } = await supabase
      .from('whatsapp_accounts')
      .select(`
        id,
        phone_number,
        name,
        status,
        organization_id,
        user_id
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar contas WhatsApp: ${error.message}`);
    }

    console.log(`📊 Total de contas WhatsApp: ${contasWhatsApp?.length || 0}`);
    
    if (!contasWhatsApp || contasWhatsApp.length === 0) {
      console.log('❌ NENHUMA conta WhatsApp encontrada!');
      console.log('💡 Você precisa conectar pelo menos um número WhatsApp para enviar mensagens.');
      return;
    }

    contasWhatsApp?.forEach((conta, index) => {
      console.log(`\n${index + 1}. ${conta.name || 'Sem nome'} (${conta.phone_number})`);
      console.log(`   Status: ${conta.status}`);
      console.log(`   Usuário: ${conta.user_id}`);
      console.log(`   Organização: ${conta.organization_id}`);
    });

    // Verificar contas conectadas
    const contasConectadas = contasWhatsApp?.filter(c => c.status === 'connected') || [];
    console.log(`\n✅ Contas conectadas: ${contasConectadas.length}`);
    
    if (contasConectadas.length === 0) {
      console.log('❌ NENHUMA conta WhatsApp conectada!');
      console.log('💡 Conecte pelo menos um número WhatsApp para enviar mensagens.');
    } else {
      console.log('📱 Números conectados disponíveis:');
      contasConectadas.forEach((conta, index) => {
        console.log(`   ${index + 1}. ${conta.phone_number}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar
verificarNumerosWhatsApp();
