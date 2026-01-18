// Script para verificar status da conexão WhatsApp
import { sendMessage } from '../services/whatsapp.js';

async function verificarConexaoWhatsApp() {
  try {
    console.log('🔍 Verificando conexão WhatsApp...');

    // Tentar enviar uma mensagem de teste
    const resultado = await sendMessage(
      '551931670125', // Número do Rodolfo De Carlo
      '5519982714339', // Seu número
      'Teste de conexão WhatsApp - Dohoo'
    );

    if (resultado.success) {
      console.log('✅ WhatsApp conectado e funcionando!');
      console.log('📱 Mensagem enviada com sucesso');
    } else {
      console.log('❌ Erro na conexão WhatsApp:', resultado.error);
    }

  } catch (error) {
    console.error('❌ Erro ao verificar conexão:', error);
  }
}

// Executar verificação
verificarConexaoWhatsApp();
