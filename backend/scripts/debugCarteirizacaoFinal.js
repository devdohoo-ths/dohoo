// Script para debug da carteirização
import { supabase } from '../lib/supabaseClient.js';

async function debugCarteirizacao() {
  try {
    console.log('🔍 Debug da carteirização...');

    const organizationId = '6ff985af-01cf-4ed2-a7cb-c1adf0680194';

    // 1. Buscar números conectados
    console.log('\n1. Buscando números conectados...');
    const { data: numerosConectados, error: numerosError } = await supabase
      .from('whatsapp_accounts')
      .select('id, phone_number, name, status')
      .eq('organization_id', organizationId)
      .eq('status', 'connected');

    if (numerosError) {
      console.error('❌ Erro ao buscar números:', numerosError);
      return;
    }

    console.log('✅ Números conectados:', numerosConectados.length);
    numerosConectados.forEach(numero => {
      console.log(`  - ${numero.name}: ${numero.phone_number}`);
    });

    // 2. Buscar agentes
    console.log('\n2. Buscando agentes...');
    const { data: agentes, error: agentesError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('organization_id', organizationId);

    if (agentesError) {
      console.error('❌ Erro ao buscar agentes:', agentesError);
      return;
    }

    console.log('✅ Agentes encontrados:', agentes.length);
    agentes.forEach(agente => {
      console.log(`  - ${agente.name}: ${agente.email} (${agente.id})`);
    });

    // 3. Testar mapeamento
    console.log('\n3. Testando mapeamento números -> agentes...');
    const agentesMap = {};
    agentes?.forEach(agente => {
      const numeroCorrespondente = numerosConectados.find(num => 
        num.name.toLowerCase().includes(agente.name.toLowerCase()) ||
        agente.name.toLowerCase().includes(num.name.toLowerCase())
      );
      
      if (numeroCorrespondente) {
        agentesMap[numeroCorrespondente.phone_number] = agente.id;
        console.log(`✅ MAPEADO: ${numeroCorrespondente.name} (${numeroCorrespondente.phone_number}) -> ${agente.name} (${agente.id})`);
      } else {
        console.log(`❌ NÃO MAPEADO: ${agente.name} - não encontrou número correspondente`);
      }
    });

    console.log('\n4. Mapa final:', agentesMap);

    // 4. Buscar mensagens com assigned_agent_id
    console.log('\n5. Buscando mensagens com assigned_agent_id...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        is_from_me,
        chats(name, whatsapp_jid, assigned_agent_id, platform)
      `)
      .eq('organization_id', organizationId)
      .eq('is_from_me', true)
      .not('chats.assigned_agent_id', 'is', null)
      .limit(10);

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }

    console.log(`✅ Mensagens da empresa com assigned_agent_id: ${messages.length}`);

    // 5. Analisar assigned_agent_ids únicos
    console.log('\n6. Assigned Agent IDs únicos nas mensagens:');
    const agentIds = [...new Set(messages.map(m => m.chats?.assigned_agent_id).filter(Boolean))];
    agentIds.forEach(id => {
      const count = messages.filter(m => m.chats?.assigned_agent_id === id).length;
      console.log(`  - ${id}: ${count} mensagens`);
      
      // Buscar nome do agente
      const agente = agentes.find(a => a.id === id);
      if (agente) {
        console.log(`    -> Agente: ${agente.name}`);
      } else {
        console.log(`    -> Agente não encontrado!`);
      }
    });

    // 6. Testar filtro para um número específico
    console.log('\n7. Testando filtro para número específico...');
    const primeiroNumero = numerosConectados[0];
    console.log(`Testando com: ${primeiroNumero.name} (${primeiroNumero.phone_number})`);
    
    const agentIdDoNumero = agentesMap[primeiroNumero.phone_number];
    if (agentIdDoNumero) {
      console.log(`Agent ID do número: ${agentIdDoNumero}`);
      
      const mensagensFiltradas = messages.filter(msg => 
        msg.chats?.assigned_agent_id === agentIdDoNumero
      );
      
      console.log(`Mensagens filtradas para este agente: ${mensagensFiltradas.length}`);
      
      if (mensagensFiltradas.length > 0) {
        console.log('Primeiras mensagens filtradas:');
        mensagensFiltradas.slice(0, 3).forEach((msg, index) => {
          console.log(`  ${index + 1}. Chat: ${msg.chats?.name} (${msg.chats?.whatsapp_jid})`);
        });
      }
    } else {
      console.log(`❌ Número não mapeado para nenhum agente!`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar debug
debugCarteirizacao();
