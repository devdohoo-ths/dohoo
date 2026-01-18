// Script para debug detalhado da carteirização
import { supabase } from '../lib/supabaseClient.js';

async function debugCarteirizacao() {
  try {
    console.log('🔍 Debug detalhado da carteirização...');

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

    if (numeros.length === 0) {
      console.log('⚠️ Nenhum número conectado encontrado');
      return;
    }

    // 2. Testar com o primeiro número
    const primeiroNumero = numeros[0];
    console.log(`\n2. Testando com número: ${primeiroNumero.phone_number}`);

    // 3. Buscar TODAS as mensagens da organização
    console.log('\n3. Buscando TODAS as mensagens da organização...');
    const { data: allMessages, error: allMessagesError } = await supabase
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
      .limit(200);

    if (allMessagesError) {
      console.error('❌ Erro ao buscar mensagens:', allMessagesError);
      return;
    }

    console.log(`✅ Total de mensagens na organização: ${allMessages.length}`);

    // 4. Verificar account_ids únicos
    const accountIds = [...new Set(allMessages.map(m => m.account_id).filter(Boolean))];
    console.log(`✅ Account IDs únicos encontrados: ${accountIds.length}`);
    accountIds.forEach(id => {
      const count = allMessages.filter(m => m.account_id === id).length;
      console.log(`  - ${id}: ${count} mensagens`);
    });

    // 5. Criar mapa de contas
    const accountMap = {};
    numeros.forEach(account => {
      accountMap[account.id] = account.phone_number;
    });

    console.log('\n5. Mapa de contas:');
    Object.entries(accountMap).forEach(([id, phone]) => {
      console.log(`  - ${id}: ${phone}`);
    });

    // 6. Filtrar mensagens dos números selecionados
    console.log('\n6. Filtrando mensagens dos números selecionados...');
    const messages = allMessages.filter(msg => {
      return msg.account_id && accountMap[msg.account_id];
    });

    console.log(`✅ Mensagens dos números selecionados: ${messages.length}`);

    if (messages.length === 0) {
      console.log('\n⚠️ PROBLEMA: Nenhuma mensagem encontrada para os números selecionados!');
      console.log('Possíveis causas:');
      console.log('- Os account_ids dos números não correspondem aos account_ids das mensagens');
      console.log('- As mensagens não estão sendo salvas com o account_id correto');
      
      // Verificar se há correspondência
      console.log('\n🔍 Verificando correspondências...');
      numeros.forEach(numero => {
        const mensagensDesteNumero = allMessages.filter(m => m.account_id === numero.id);
        console.log(`  - ${numero.phone_number} (${numero.id}): ${mensagensDesteNumero.length} mensagens`);
      });
      
      return;
    }

    // 7. Agrupar por chat
    console.log('\n7. Agrupando por chat...');
    const uniqueChats = new Map();
    
    messages.forEach(msg => {
      if (msg.chat_id && msg.chats) {
        const chatId = msg.chat_id;
        if (!uniqueChats.has(chatId)) {
          uniqueChats.set(chatId, {
            id: msg.chats.id || chatId,
            name: msg.chats.name || msg.sender_name || 'Sem nome',
            platform: msg.chats.platform || 'whatsapp',
            whatsapp_jid: msg.chats.whatsapp_jid,
            created_at: msg.chats.created_at || msg.created_at,
            last_message_at: msg.chats.last_message_at || msg.created_at,
            totalMessages: 0,
            mensagensEmpresa: 0,
            mensagensCliente: 0
          });
        }
        
        const chat = uniqueChats.get(chatId);
        chat.totalMessages++;
        
        if (msg.is_from_me) {
          chat.mensagensEmpresa++;
        } else {
          chat.mensagensCliente++;
        }
      }
    });

    console.log(`✅ Chats únicos encontrados: ${uniqueChats.size}`);

    // 8. Filtrar contatos válidos
    console.log('\n8. Filtrando contatos válidos...');
    const contatosValidos = [];
    
    uniqueChats.forEach((chat, chatId) => {
      // Verificar se é WhatsApp
      if (chat.platform !== 'whatsapp' || !chat.whatsapp_jid) {
        return;
      }
      
      // Extrair número do contato
      const whatsappJid = chat.whatsapp_jid;
      const contatoPhone = whatsappJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      // Verificar se não é número da empresa
      const isNumeroEmpresa = numeros.some(n => {
        const numeroLimpo = n.phone_number.replace(/\D/g, '');
        const contatoLimpo = contatoPhone.replace(/\D/g, '');
        return contatoLimpo.includes(numeroLimpo) || numeroLimpo.includes(contatoLimpo);
      });
      
      if (!isNumeroEmpresa && chat.mensagensEmpresa > 0) {
        contatosValidos.push({
          contato_phone: contatoPhone,
          contato_name: chat.name,
          numero_whatsapp: primeiroNumero.phone_number,
          ultima_conversa: chat.last_message_at,
          total_mensagens: chat.totalMessages,
          mensagens_empresa: chat.mensagensEmpresa,
          mensagens_cliente: chat.mensagensCliente
        });
        
        console.log(`✅ Contato válido: ${chat.name} (${contatoPhone}) - ${chat.mensagensEmpresa} msgs empresa, ${chat.mensagensCliente} msgs cliente`);
      }
    });

    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`- Número testado: ${primeiroNumero.phone_number}`);
    console.log(`- Total de mensagens na organização: ${allMessages.length}`);
    console.log(`- Mensagens dos números selecionados: ${messages.length}`);
    console.log(`- Total de chats: ${uniqueChats.size}`);
    console.log(`- Contatos válidos: ${contatosValidos.length}`);

    if (contatosValidos.length > 0) {
      console.log('\n📋 Contatos válidos encontrados:');
      contatosValidos.forEach((contato, index) => {
        console.log(`  ${index + 1}. ${contato.contato_name} (${contato.contato_phone})`);
        console.log(`     - Total: ${contato.total_mensagens} msgs`);
        console.log(`     - Empresa: ${contato.mensagens_empresa} msgs`);
        console.log(`     - Cliente: ${contato.mensagens_cliente} msgs`);
      });
    } else {
      console.log('\n⚠️ Nenhum contato válido encontrado');
      console.log('Possíveis causas:');
      console.log('- Não há mensagens da empresa (is_from_me = true)');
      console.log('- Todos os chats são de números da empresa');
      console.log('- Problema na lógica de filtragem');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar debug
debugCarteirizacao();
