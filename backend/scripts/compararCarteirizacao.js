// Script para comparar lógica de carteirização com report-detailed-conversations
import { supabase } from '../lib/supabaseClient.js';

async function compararCarteirizacao() {
  try {
    console.log('🔍 Comparando carteirização com report-detailed-conversations...');

    const organizationId = '6ff985af-01cf-4ed2-a7cb-c1adf0680194';
    const numeroSelecionado = '551931670125'; // Rodolfo

    // 1. Buscar dados como no report-detailed-conversations
    console.log('\n1. Buscando dados como no report-detailed-conversations...');
    
    const { data: messagesReport, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        account_id,
        sender_jid,
        is_from_me,
        chats(name, whatsapp_jid, assigned_agent_id, platform, status, department, priority, created_at, last_message_at)
      `)
      .eq('organization_id', organizationId)
      .not('content', 'is', null)
      .limit(1000);

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }

    console.log(`✅ Total de mensagens: ${messagesReport.length}`);

    // 2. Buscar agentes
    const { data: agentes, error: agentesError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('organization_id', organizationId);

    if (agentesError) {
      console.error('❌ Erro ao buscar agentes:', agentesError);
      return;
    }

    console.log(`✅ Agentes encontrados: ${agentes.length}`);

    // 3. Buscar números conectados
    const { data: numerosConectados, error: numerosError } = await supabase
      .from('whatsapp_accounts')
      .select('id, phone_number, name, status')
      .eq('organization_id', organizationId)
      .eq('status', 'connected');

    if (numerosError) {
      console.error('❌ Erro ao buscar números:', numerosError);
      return;
    }

    console.log(`✅ Números conectados: ${numerosConectados.length}`);

    // 4. Mapear números para agentes
    const agentesMap = {};
    agentes?.forEach(agente => {
      const numeroCorrespondente = numerosConectados.find(num => {
        const nomeNumero = num.name.toLowerCase().replace(/[^a-z]/g, '');
        const nomeAgente = agente.name.toLowerCase().replace(/[^a-z]/g, '');
        
        if (nomeNumero.includes(nomeAgente) || nomeAgente.includes(nomeNumero)) {
          return true;
        }
        
        const partesNumero = nomeNumero.split(' ');
        const partesAgente = nomeAgente.split(' ');
        
        return partesNumero.some(parteNum => 
          partesAgente.some(parteAgente => 
            parteNum.includes(parteAgente) || parteAgente.includes(parteNum)
          )
        );
      });
      
      if (numeroCorrespondente) {
        agentesMap[numeroCorrespondente.phone_number] = agente.id;
        console.log(`✅ MAPEADO: ${numeroCorrespondente.name} -> ${agente.name} (${agente.id})`);
      }
    });

    // 5. Filtrar mensagens do Rodolfo
    const agentIdRodolfo = agentesMap[numeroSelecionado];
    console.log(`\n🔍 Agent ID do Rodolfo: ${agentIdRodolfo}`);

    if (!agentIdRodolfo) {
      console.log('❌ Rodolfo não mapeado para nenhum agente!');
      return;
    }

    // Filtrar mensagens da empresa
    const mensagensEmpresa = messagesReport.filter(msg => msg.is_from_me === true);
    console.log(`✅ Mensagens da empresa: ${mensagensEmpresa.length}`);

    // Filtrar mensagens do Rodolfo
    const mensagensRodolfo = mensagensEmpresa.filter(msg => 
      msg.chats?.assigned_agent_id === agentIdRodolfo
    );
    console.log(`✅ Mensagens do Rodolfo: ${mensagensRodolfo.length}`);

    // 6. Processar como no report-detailed-conversations
    console.log('\n2. Processando como no report-detailed-conversations...');
    
    // Agrupar por chat_id
    const chatsUnicos = new Map();
    mensagensRodolfo.forEach(msg => {
      if (!chatsUnicos.has(msg.chat_id)) {
        chatsUnicos.set(msg.chat_id, {
          id: msg.chat_id,
          name: msg.chats?.name,
          whatsapp_jid: msg.chats?.whatsapp_jid,
          platform: msg.chats?.platform,
          assigned_agent_id: msg.chats?.assigned_agent_id,
          last_message_at: msg.created_at
        });
      }
    });

    console.log(`✅ Conversas únicas do Rodolfo: ${chatsUnicos.size}`);

    // 7. Extrair contatos
    const contatosUnicos = new Map();
    chatsUnicos.forEach(chat => {
      if (!chat.whatsapp_jid) return;
      
      let phoneNumber = null;
      let customerName = null;
      
      if (chat.whatsapp_jid.endsWith('@s.whatsapp.net')) {
        phoneNumber = chat.whatsapp_jid.replace('@s.whatsapp.net', '');
        customerName = chat.name || `Contato ${phoneNumber}`;
      } else if (chat.whatsapp_jid.endsWith('@g.us')) {
        return; // Pular grupos
      }
      
      if (!phoneNumber) return;
      
      // Verificar se é número da empresa
      const isNumeroEmpresa = numerosConectados.some(num => 
        num.phone_number.replace(/\D/g, '') === phoneNumber.replace(/\D/g, '')
      );
      
      if (isNumeroEmpresa) return;
      
      const chaveUnica = phoneNumber;
      if (!contatosUnicos.has(chaveUnica)) {
        contatosUnicos.set(chaveUnica, {
          phoneNumber,
          customerName,
          assigned_agent_id: chat.assigned_agent_id,
          lastMessageAt: chat.last_message_at
        });
      }
    });

    console.log(`\n✅ Contatos únicos do Rodolfo: ${contatosUnicos.size}`);
    
    // Mostrar contatos encontrados
    const contatosArray = Array.from(contatosUnicos.values());
    console.log('\n📋 Contatos encontrados:');
    contatosArray.forEach((contato, index) => {
      console.log(`  ${index + 1}. ${contato.customerName} (${contato.phoneNumber})`);
    });

    // 8. Comparar com dados do report-detailed-conversations
    console.log('\n3. Comparando com dados esperados...');
    console.log('📊 Dados esperados do report-detailed-conversations:');
    console.log('  - Gui Mateus (5519989410246)');
    console.log('  - Rodolfo (5519982714339)');
    
    const contatosEsperados = ['5519989410246', '5519982714339'];
    const contatosEncontrados = contatosArray.map(c => c.phoneNumber);
    
    console.log('\n🔍 Análise:');
    contatosEsperados.forEach(telefone => {
      const encontrado = contatosEncontrados.includes(telefone);
      console.log(`  - ${telefone}: ${encontrado ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);
    });

    // 9. Verificar mensagens específicas
    console.log('\n4. Verificando mensagens específicas...');
    const mensagensGui = mensagensRodolfo.filter(msg => 
      msg.chats?.whatsapp_jid === '5519989410246@s.whatsapp.net'
    );
    const mensagensRodolfoContato = mensagensRodolfo.filter(msg => 
      msg.chats?.whatsapp_jid === '5519982714339@s.whatsapp.net'
    );
    
    console.log(`📱 Mensagens para Gui Mateus: ${mensagensGui.length}`);
    console.log(`📱 Mensagens para Rodolfo: ${mensagensRodolfoContato.length}`);

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar comparação
compararCarteirizacao();
