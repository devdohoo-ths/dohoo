// Script para investigar dados atualizados
import { supabase } from '../lib/supabaseClient.js';

async function investigarDadosAtualizados() {
  try {
    console.log('🔍 Investigando dados atualizados...');

    const organizationId = '6ff985af-01cf-4ed2-a7cb-c1adf0680194';

    // 1. Verificar mensagens mais recentes
    console.log('\n1. Verificando mensagens mais recentes...');
    const { data: mensagensRecentes, error: mensagensError } = await supabase
      .from('messages')
      .select(`
        id,
        created_at,
        content,
        sender_name,
        is_from_me,
        chats(name, whatsapp_jid)
      `)
      .eq('organization_id', organizationId)
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (mensagensError) {
      console.error('❌ Erro ao buscar mensagens:', mensagensError);
      return;
    }

    console.log(`✅ Mensagens mais recentes encontradas: ${mensagensRecentes.length}`);
    mensagensRecentes.forEach((msg, index) => {
      const data = new Date(msg.created_at).toLocaleDateString('pt-BR');
      const hora = new Date(msg.created_at).toLocaleTimeString('pt-BR');
      console.log(`  ${index + 1}. ${data} ${hora} - ${msg.sender_name} (${msg.is_from_me ? 'Empresa' : 'Cliente'})`);
    });

    // 2. Verificar mensagens de hoje
    console.log('\n2. Verificando mensagens de hoje...');
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);

    const { data: mensagensHoje, error: mensagensHojeError } = await supabase
      .from('messages')
      .select(`
        id,
        created_at,
        content,
        sender_name,
        is_from_me,
        chats(name, whatsapp_jid)
      `)
      .eq('organization_id', organizationId)
      .not('content', 'is', null)
      .gte('created_at', inicioHoje.toISOString())
      .lt('created_at', fimHoje.toISOString())
      .order('created_at', { ascending: false });

    if (mensagensHojeError) {
      console.error('❌ Erro ao buscar mensagens de hoje:', mensagensHojeError);
      return;
    }

    console.log(`✅ Mensagens de hoje encontradas: ${mensagensHoje.length}`);
    mensagensHoje.forEach((msg, index) => {
      const hora = new Date(msg.created_at).toLocaleTimeString('pt-BR');
      console.log(`  ${index + 1}. ${hora} - ${msg.sender_name} (${msg.is_from_me ? 'Empresa' : 'Cliente'})`);
    });

    // 3. Verificar total de mensagens
    console.log('\n3. Verificando total de mensagens...');
    const { count: totalMensagens, error: totalError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .not('content', 'is', null);

    if (totalError) {
      console.error('❌ Erro ao contar mensagens:', totalError);
      return;
    }

    console.log(`✅ Total de mensagens na organização: ${totalMensagens}`);

    // 4. Verificar mensagens da empresa
    console.log('\n4. Verificando mensagens da empresa...');
    const { count: mensagensEmpresa, error: empresaError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_from_me', true)
      .not('content', 'is', null);

    if (empresaError) {
      console.error('❌ Erro ao contar mensagens da empresa:', empresaError);
      return;
    }

    console.log(`✅ Total de mensagens da empresa: ${mensagensEmpresa}`);

    // 5. Verificar mensagens da empresa de hoje
    console.log('\n5. Verificando mensagens da empresa de hoje...');
    const { count: mensagensEmpresaHoje, error: empresaHojeError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_from_me', true)
      .not('content', 'is', null)
      .gte('created_at', inicioHoje.toISOString())
      .lt('created_at', fimHoje.toISOString());

    if (empresaHojeError) {
      console.error('❌ Erro ao contar mensagens da empresa de hoje:', empresaHojeError);
      return;
    }

    console.log(`✅ Mensagens da empresa de hoje: ${mensagensEmpresaHoje}`);

    // 6. Verificar se o limite de 1000 está afetando
    console.log('\n6. Verificando impacto do limite de 1000...');
    if (totalMensagens > 1000) {
      console.log(`⚠️ PROBLEMA: Total de mensagens (${totalMensagens}) > limite (1000)`);
      console.log(`   Isso significa que mensagens mais recentes podem estar sendo perdidas!`);
      
      // Verificar mensagens mais antigas que estão sendo incluídas
      const { data: mensagensAntigas, error: antigasError } = await supabase
        .from('messages')
        .select(`
          id,
          created_at,
          content,
          sender_name,
          is_from_me
        `)
        .eq('organization_id', organizationId)
        .not('content', 'is', null)
        .order('created_at', { ascending: true })
        .limit(5);

      if (!antigasError && mensagensAntigas.length > 0) {
        console.log('\n📅 Mensagens mais antigas sendo incluídas:');
        mensagensAntigas.forEach((msg, index) => {
          const data = new Date(msg.created_at).toLocaleDateString('pt-BR');
          console.log(`  ${index + 1}. ${data} - ${msg.sender_name}`);
        });
      }
    } else {
      console.log(`✅ Total de mensagens (${totalMensagens}) <= limite (1000) - OK`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar investigação
investigarDadosAtualizados();
