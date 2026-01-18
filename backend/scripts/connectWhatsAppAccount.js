#!/usr/bin/env node

/**
 * Script para conectar manualmente uma conta WhatsApp
 * Útil para testar o sistema antes de executar campanhas
 */

import { createWhatsAppConnection } from '../services/multiWhatsapp.js';
import { supabase } from '../lib/supabaseClient.js';

async function connectWhatsAppAccount() {
  console.log('🔌 Conectando conta WhatsApp manualmente...');
  
  try {
    // Buscar uma conta para conectar
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, phone_number, name, status')
      .eq('status', 'connected')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro ao buscar contas:', error);
      return { success: false, error: error.message };
    }
    
    if (!accounts || accounts.length === 0) {
      console.log('⚠️ Nenhuma conta encontrada');
      return { success: false, error: 'Nenhuma conta encontrada' };
    }
    
    const account = accounts[0];
    console.log(`📱 Conectando conta: ${account.name} (${account.phone_number})`);
    console.log(`🆔 Account ID: ${account.account_id}`);
    
    // Conectar a conta
    const resultado = await createWhatsAppConnection(account.account_id, account.name, true, { source: 'manual' });
    
    console.log('📊 Resultado da conexão:', resultado);
    
    if (resultado.success) {
      console.log('✅ Conta conectada com sucesso!');
      console.log('💡 Aguarde alguns segundos para a conexão estar completamente pronta');
      return { success: true, result: resultado };
    } else {
      console.log('❌ Erro ao conectar conta:', resultado.error);
      return { success: false, error: resultado.error };
    }
    
  } catch (error) {
    console.error('❌ Erro no processo de conexão:', error.message);
    return { success: false, error: error.message };
  }
}

// Executar conexão
connectWhatsAppAccount()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 Conexão concluída!');
      console.log('✅ A conta está sendo conectada');
      console.log('⏳ Aguarde alguns segundos antes de testar envio de mensagens');
      process.exit(0);
    } else {
      console.log('\n❌ Conexão falhou!');
      console.log('🔧 Verifique se a conta existe e está configurada corretamente');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Erro inesperado:', error);
    process.exit(1);
  });
