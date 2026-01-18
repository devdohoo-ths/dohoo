// Script para investigar estrutura das mensagens
import { supabase } from '../lib/supabaseClient.js';

async function investigarMensagens() {
  try {
    console.log('🔍 Investigando estrutura das mensagens...');

    const organizationId = '6ff985af-01cf-4ed2-a7cb-c1adf0680194';

    // 1. Buscar números conectados
    console.log('\n1. Buscando números conectados...');
    const { data: numeros, error: numerosError } = await supabase
      .from('whatsapp_accounts')
      .select('id, phone_number, name, status')
      .eq('organization_id', organizationId)
      .eq('status', 'connected');

    if (numerosError) {
      console.error('❌ Erro ao buscar números:', numerosError);
      return;
    }

    console.log('✅ Números encontrados:', numeros.length);
    numeros.forEach(numero => {
      console.log(`  - ${numero.name}: ${numero.phone_number} (${numero.id})`);
    });

    // 2. Buscar algumas mensagens para ver a estrutura
    console.log('\n2. Buscando mensagens para análise...');
    const { data: messages, error: messagesError } = await supabase
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
        chats(name, whatsapp_jid, platform)
      `)
      .eq('organization_id', organizationId)
      .not('content', 'is', null)
      .limit(10);

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }

    console.log(`✅ Mensagens encontradas: ${messages.length}`);

    // 3. Analisar estrutura das mensagens
    console.log('\n3. Analisando estrutura das mensagens...');
    messages.forEach((msg, index) => {
      console.log(`\n--- Mensagem ${index + 1} ---`);
      console.log(`ID: ${msg.id}`);
      console.log(`Chat ID: ${msg.chat_id}`);
      console.log(`Account ID: ${msg.account_id}`);
      console.log(`Sender JID: ${msg.sender_jid}`);
      console.log(`Is From Me: ${msg.is_from_me}`);
      console.log(`Sender Name: ${msg.sender_name}`);
      console.log(`Content: ${msg.content?.substring(0, 50)}...`);
      
      if (msg.chats) {
        console.log(`Chat Name: ${msg.chats.name}`);
        console.log(`Chat WhatsApp JID: ${msg.chats.whatsapp_jid}`);
        console.log(`Chat Platform: ${msg.chats.platform}`);
      }
    });

    // 4. Verificar correspondências
    console.log('\n4. Verificando correspondências...');
    const primeiroNumero = numeros[0];
    console.log(`\nTestando com número: ${primeiroNumero.phone_number}`);
    
    // Verificar por account_id
    const mensagensPorAccount = messages.filter(m => m.account_id === primeiroNumero.id);
    console.log(`Mensagens por account_id (${primeiroNumero.id}): ${mensagensPorAccount.length}`);
    
    // Verificar por sender_jid
    const numeroLimpo = primeiroNumero.phone_number.replace(/\D/g, '');
    const mensagensPorSender = messages.filter(m => {
      if (!m.sender_jid) return false;
      const senderPhone = m.sender_jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      const senderLimpo = senderPhone.replace(/\D/g, '');
      return senderLimpo === numeroLimpo;
    });
    console.log(`Mensagens por sender_jid (${numeroLimpo}): ${mensagensPorSender.length}`);
    
    // Verificar por whatsapp_jid dos chats
    const mensagensPorChatJid = messages.filter(m => {
      if (!m.chats?.whatsapp_jid) return false;
      const chatJid = m.chats.whatsapp_jid;
      if (chatJid.endsWith('@s.whatsapp.net')) {
        const chatPhone = chatJid.replace('@s.whatsapp.net', '');
        const chatLimpo = chatPhone.replace(/\D/g, '');
        return chatLimpo === numeroLimpo;
      }
      return false;
    });
    console.log(`Mensagens por chat whatsapp_jid (${numeroLimpo}): ${mensagensPorChatJid.length}`);

    // 5. Verificar todos os account_ids únicos
    console.log('\n5. Account IDs únicos nas mensagens:');
    const accountIds = [...new Set(messages.map(m => m.account_id).filter(Boolean))];
    accountIds.forEach(id => {
      const count = messages.filter(m => m.account_id === id).length;
      console.log(`  - ${id}: ${count} mensagens`);
    });

    // 6. Verificar todos os sender_jids únicos
    console.log('\n6. Sender JIDs únicos nas mensagens:');
    const senderJids = [...new Set(messages.map(m => m.sender_jid).filter(Boolean))];
    senderJids.forEach(jid => {
      const count = messages.filter(m => m.sender_jid === jid).length;
      console.log(`  - ${jid}: ${count} mensagens`);
    });

    // 7. Verificar todos os whatsapp_jids dos chats únicos
    console.log('\n7. WhatsApp JIDs dos chats únicos:');
    const chatJids = [...new Set(messages.map(m => m.chats?.whatsapp_jid).filter(Boolean))];
    chatJids.forEach(jid => {
      const count = messages.filter(m => m.chats?.whatsapp_jid === jid).length;
      console.log(`  - ${jid}: ${count} mensagens`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar investigação
investigarMensagens();
