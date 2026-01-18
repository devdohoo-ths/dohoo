// Script para testar criação de campanha com dados exatos da interface
const API_BASE = 'http://localhost:3001/api';

// Simular dados exatos que a interface BulkMessageDialog está enviando
const campanhaData = {
  nome: `Campanha em Massa - ${new Date().toLocaleString()}`,
  template_id: null,
  contatos: [{
    id: '5519982714339',
    name: 'Teste Dohoo',
    phone: '5519982714339'
  }],
  usuarios_remetentes: ['5511999999999'], // Número de teste
  usar_ia: false,
  data_inicio: new Date().toISOString(),
  configuracoes: {
    rate_limit_per_minute: 30,
    interval_between_messages: 2000,
    max_messages_per_user: 1,
    numeros_whatsapp: ['5511999999999'],
    media_files: []
  },
  message_content: 'Olá! Esta é uma mensagem de teste da Dohoo. 🚀',
  media_files: []
};

console.log('📤 Dados que serão enviados:');
console.log(JSON.stringify(campanhaData, null, 2));

// Validar campos obrigatórios
console.log('\n🔍 Validação dos campos:');
console.log('✅ nome:', campanhaData.nome ? 'OK' : 'ERRO');
console.log('✅ template_id:', campanhaData.template_id === null ? 'OK' : 'ERRO');
console.log('✅ contatos:', Array.isArray(campanhaData.contatos) && campanhaData.contatos.length > 0 ? 'OK' : 'ERRO');
console.log('✅ usuarios_remetentes:', Array.isArray(campanhaData.usuarios_remetentes) && campanhaData.usuarios_remetentes.length > 0 ? 'OK' : 'ERRO');
console.log('✅ usar_ia:', typeof campanhaData.usar_ia === 'boolean' ? 'OK' : 'ERRO');
console.log('✅ data_inicio:', campanhaData.data_inicio ? 'OK' : 'ERRO');
console.log('✅ configuracoes:', typeof campanhaData.configuracoes === 'object' ? 'OK' : 'ERRO');
console.log('✅ message_content:', typeof campanhaData.message_content === 'string' ? 'OK' : 'ERRO');
console.log('✅ media_files:', Array.isArray(campanhaData.media_files) ? 'OK' : 'ERRO');

console.log('\n📋 Resumo:');
console.log('- Nome:', campanhaData.nome);
console.log('- Contatos:', campanhaData.contatos.length);
console.log('- Remetentes:', campanhaData.usuarios_remetentes.length);
console.log('- Mensagem:', campanhaData.message_content);
console.log('- Template ID:', campanhaData.template_id);
