import { supabase } from '../lib/supabaseClient.js';

/**
 * 🤖 FLOW EXECUTOR SIMPLIFICADO
 * 
 * Executor específico para flows do módulo "Atendimento Inteligente"
 * Baseado no flowServices.js existente, mas adaptado para blocos simplificados
 * 
 * Blocos suportados:
 * - inicio, mensagem, opcoes, decisao, encerrar (já existentes)
 * - coletar_dados (NOVO)
 * - transferencia_time (NOVO) 
 * - transferencia_agente (adaptado)
 */

/**
 * Executa um passo do flow simplificado
 * @param {Object} params - Parâmetros de execução
 * @param {string} params.accountId - ID da conta WhatsApp
 * @param {string} params.fromJid - JID do remetente
 * @param {string} params.message - Mensagem recebida
 * @param {Object} params.flow - Dados do flow
 * @param {Object} params.sock - Socket do Baileys
 * @param {string} params.chatId - ID do chat
 * @param {string} params.userId - ID do usuário
 * @param {string} params.organizationId - ID da organização
 * @param {Object} params.mediaInfo - Informações de mídia
 * @param {Object} params.accountData - Dados da conta
 * @param {string} params.whatsapp_Id - ID do WhatsApp
 * @returns {Object} Resposta do flow
 */
export const executeFlowSimple = async function ({ 
  accountId, 
  fromJid, 
  message, 
  flow, 
  sock, 
  chatId, 
  userId, 
  organizationId, 
  mediaInfo, 
  accountData, 
  whatsapp_Id 
}) {
  console.log(`🤖 [FLOW-SIMPLE] Iniciando execução do flow ${flow.id} para usuário ${userId}`);
  console.log(`📝 [FLOW-SIMPLE] Mensagem recebida: "${message}"`);
  console.log(`📊 [FLOW-SIMPLE] Flow data:`, { 
    id: flow.id, 
    nome: flow.nome, 
    nodesCount: flow.nodes?.length || 0,
    edgesCount: flow.edges?.length || 0 
  });
  
  // Log detalhado dos nodes e edges
  console.log(`🏗️ [FLOW-SIMPLE] Nodes do flow:`, flow.nodes?.map(n => ({
    id: n.id,
    type: n.type,
    data: n.data?.config
  })));
  console.log(`🔗 [FLOW-SIMPLE] Edges do flow:`, flow.edges?.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle
  })));

  try {
    // 1. Buscar estado do usuário/cliente WhatsApp
    let { data: userState, error: userStateError } = await supabase
      .from('flow_user_state')
      .select('*')
      .eq('whatsapp_client_id', userId)  // ✅ Usar whatsapp_client_id para clientes WhatsApp
      .eq('account_id', accountId)
      .eq('flow_id', flow.id)
      .maybeSingle();
    
    if (userStateError) {
      console.error(`❌ [FLOW-SIMPLE] Erro ao buscar estado do usuário:`, userStateError);
      return { text: 'Erro interno ao processar fluxo.' };
    }
    
    // 2. Se não existir, iniciar no bloco 'inicio'
    let currentNodeId;
    let variables = {};
    if (!userState) {
      console.log(`🆕 [FLOW-SIMPLE] Novo usuário no fluxo, buscando bloco inicial...`);
      const startNode = flow.nodes.find(n => n.type === 'inicio');
      if (!startNode) {
        console.error(`❌ [FLOW-SIMPLE] Fluxo ${flow.id} não possui bloco inicial`);
        return { text: 'Fluxo sem bloco inicial.' };
      }
      currentNodeId = startNode.id;
      console.log(`✅ [FLOW-SIMPLE] Bloco inicial encontrado: ${startNode.id} (${startNode.type})`);
      
      // Salvar novo estado
      const { error: insertError } = await supabase.from('flow_user_state').insert({
        whatsapp_client_id: userId,  // ✅ Usar whatsapp_client_id para clientes WhatsApp
        account_id: accountId,
        flow_id: flow.id,
        current_node_id: currentNodeId,
        variables: {},
        last_message: message,
        updated_at: new Date().toISOString()
      });
      
      if (insertError) {
        console.error(`❌ [FLOW-SIMPLE] Erro ao salvar estado inicial:`, insertError);
        return { text: 'Erro interno ao iniciar fluxo.' };
      }
      console.log(`✅ [FLOW-SIMPLE] Estado inicial salvo`);
    } else {
      currentNodeId = userState.current_node_id;
      variables = userState.variables || {};
      console.log(`📍 [FLOW-SIMPLE] Usuário retomando fluxo no bloco: ${currentNodeId}`);
    }
    
    // 3. Identificar bloco atual
    const currentNode = flow.nodes.find(n => n.id === currentNodeId);
    if (!currentNode) {
      console.error(`❌ [FLOW-SIMPLE] Bloco atual ${currentNodeId} não encontrado no fluxo`);
      return { text: 'Bloco atual não encontrado.' };
    }
    
    console.log(`🎯 [FLOW-SIMPLE] Processando bloco: ${currentNode.id} (${currentNode.type})`);
    console.log(`📋 [FLOW-SIMPLE] Configuração do bloco:`, currentNode.data?.config);
    
    // 4. Processar tipo do bloco
    let responseText = '';
    let nextNodeId = null;
    let shouldExecuteNextNode = false;
    
    // ========================================
    // BLOCOS EXISTENTES (reutilizando lógica)
    // ========================================
    
    if (currentNode.type === 'inicio' || currentNode.type === 'mensagem') {
      // Envia mensagem e avança para o próximo bloco
      responseText = currentNode.data?.config?.mensagemInicial || currentNode.data?.config?.texto || 'Processando...';
      console.log(`💬 [FLOW-SIMPLE] Enviando mensagem: "${responseText}"`);
      
      // Descobrir próximo bloco (edge)
      const nextEdge = flow.edges.find(e => e.source === currentNode.id);
      if (nextEdge) {
        nextNodeId = nextEdge.target;
        shouldExecuteNextNode = true;
        console.log(`➡️ [FLOW-SIMPLE] Próximo bloco: ${nextNodeId}`);
      } else {
        console.log(`⚠️ [FLOW-SIMPLE] Nenhum edge encontrado para o bloco ${currentNode.id}`);
      }
      
    } else if (currentNode.type === 'opcoes' || currentNode.type === 'decisao') {
      // Espera resposta do usuário
      let opcoes = [];
      let sourceHandlePrefix = 'opcao';
      
      if (currentNode.type === 'decisao') {
        // ✅ Para decisão, criar array com Sim/Não
        const opcaoSim = currentNode.data?.config?.opcaoSim || 'Sim';
        const opcaoNao = currentNode.data?.config?.opcaoNao || 'Não';
        opcoes = [opcaoSim, opcaoNao];
        sourceHandlePrefix = 'decisao'; // decisão usa sourceHandle "sim" e "nao"
        console.log(`🤔 [FLOW-SIMPLE] Processando decisão: ${opcoes.join(' / ')}`);
      } else {
        // Para opções normais
        opcoes = currentNode.data?.config?.opcoes || [];
        console.log(`🤔 [FLOW-SIMPLE] Processando opções:`, opcoes);
      }
      
      console.log(`📝 [FLOW-SIMPLE] Mensagem do usuário: "${message}"`);
      
      // Tenta encontrar opção correspondente
      const userInput = (message || '').trim().toLowerCase();
      let matchedIdx = -1;
      
      // Verificar se é um clique em botão (selectedButtonId) ou seleção de lista
      if (userInput.startsWith('btn_')) {
        const buttonIndex = parseInt(userInput.replace('btn_', ''));
        if (!isNaN(buttonIndex) && buttonIndex >= 0 && buttonIndex < opcoes.length) {
          matchedIdx = buttonIndex;
          console.log(`🔘 [FLOW-SIMPLE] Botão ${buttonIndex} clicado: "${opcoes[buttonIndex]}"`);
        }
      } else if (Array.isArray(opcoes)) {
        // ✅ CORRIGIDO: Busca por texto ou número da opção
        matchedIdx = opcoes.findIndex((opt, idx) => {
          const optionText = String(opt).toLowerCase();
          const optionNumber = String(idx + 1);
          const matches = userInput === optionText || userInput === optionNumber;
          console.log(`  Comparando "${userInput}" com opção ${idx + 1} "${opt}": ${matches}`);
          return matches;
        });
      }
      
      console.log(`🔍 [FLOW-SIMPLE] matchedIdx resultado: ${matchedIdx}`);
      
      if (matchedIdx >= 0) {
        console.log(`✅ [FLOW-SIMPLE] Opção ${matchedIdx + 1} selecionada: "${opcoes[matchedIdx]}"`);
        
        // ✅ Determinar sourceHandle baseado no tipo
        let sourceHandle;
        if (currentNode.type === 'decisao') {
          // Para decisão: "sim" (0) ou "nao" (1)
          sourceHandle = matchedIdx === 0 ? 'sim' : 'nao';
        } else {
          // Para opções: "opcao_0", "opcao_1", etc
          sourceHandle = `opcao_${matchedIdx}`;
        }
        
        // Encontrou opção, segue para o edge correspondente
        const nextEdge = flow.edges.find(e => e.source === currentNode.id && e.sourceHandle === sourceHandle);
        
        console.log(`🔍 [FLOW-SIMPLE] Procurando edge com:`, {
          source: currentNode.id,
          sourceHandle: sourceHandle,
          edgesDisponiveis: flow.edges.filter(e => e.source === currentNode.id).map(e => ({
            source: e.source,
            sourceHandle: e.sourceHandle,
            target: e.target
          }))
        });
        
        if (nextEdge) {
          nextNodeId = nextEdge.target;
          shouldExecuteNextNode = true;
          responseText = ''; // ✅ Deixar vazio para o próximo bloco definir a resposta
          console.log(`➡️ [FLOW-SIMPLE] Edge encontrado! Indo para bloco ${nextNodeId} (${nextEdge.sourceHandle})`);
        } else {
          console.error(`❌ [FLOW-SIMPLE] Edge não encontrado para opção ${matchedIdx} (sourceHandle: opcao_${matchedIdx})`);
          responseText = 'Opção selecionada, mas próximo bloco não encontrado.';
        }
      } else {
        // Não reconheceu a opção, repete a pergunta
        const pergunta = currentNode.data?.config?.pergunta || 'Escolha uma opção:';
        responseText = pergunta;
        
        if (Array.isArray(opcoes)) {
          responseText += '\n' + opcoes.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
        }
        nextNodeId = currentNode.id; // permanece no mesmo bloco
        console.log(`🔄 [FLOW-SIMPLE] Opção não reconhecida, repetindo pergunta`);
      }
      
    } else if (currentNode.type === 'encerrar') {
      // Bloco de encerramento
      responseText = currentNode.data?.config?.mensagem || 'Obrigado pelo contato!';
      console.log(`🏁 [FLOW-SIMPLE] Encerrando fluxo: "${responseText}"`);
      
      // Salvar histórico e remover estado
      await supabase.from('flow_user_history').insert({
        whatsapp_client_id: userId,  // ✅ Usar whatsapp_client_id
        account_id: accountId,
        flow_id: flow.id,
        final_node_id: currentNode.id,
        variables,
        status: 'encerrado',
        organization_id: organizationId,
        extra: { last_message: message }
      });
      
      await supabase.from('flow_user_state')
        .delete()
        .eq('whatsapp_client_id', userId)  // ✅ Usar whatsapp_client_id
        .eq('account_id', accountId)
        .eq('flow_id', flow.id);
      
      console.log(`📚 [FLOW-SIMPLE] Histórico salvo e estado removido`);
      return { text: responseText };
    }
    
    // ========================================
    // BLOCOS NOVOS (específicos do módulo)
    // ========================================
    
    else if (currentNode.type === 'coletar_dados') {
      console.log(`📝 [FLOW-SIMPLE] Processando bloco: coletar_dados`);
      
      const pergunta = currentNode.data?.config?.pergunta || 'Digite sua resposta:';
      const variavel = currentNode.data?.config?.variavel || 'dados_coletados';
      const validacao = currentNode.data?.config?.validacao || 'texto';
      
      // Se já tem resposta, salvar em variables
      if (message && message.trim()) {
        console.log(`✅ [FLOW-SIMPLE] Dados coletados: "${message}" para variável "${variavel}"`);
        variables[variavel] = message;
        
        // Avançar para próximo bloco
        const nextEdge = flow.edges.find(e => e.source === currentNode.id);
        if (nextEdge) {
          nextNodeId = nextEdge.target;
          shouldExecuteNextNode = true;
          const nextNode = flow.nodes.find(n => n.id === nextNodeId);
          responseText = nextNode?.data?.config?.texto || nextNode?.data?.config?.mensagemInicial || 'Processando...';
          console.log(`➡️ [FLOW-SIMPLE] Dados coletados, avançando para: ${nextNodeId}`);
        } else {
          responseText = 'Dados coletados com sucesso!';
        }
      } else {
        // Primeira vez, mostrar pergunta
        responseText = pergunta;
        nextNodeId = currentNode.id; // permanece no mesmo bloco
        console.log(`❓ [FLOW-SIMPLE] Coletando dados: "${pergunta}"`);
      }
      
    } else if (currentNode.type === 'transferencia_time') {
      console.log(`👥 [FLOW-SIMPLE] Processando transferência para time`);
      
      // ✅ DEBUG: Verificar estrutura completa do data
      console.log(`🔍 [FLOW-SIMPLE] Estrutura completa do data:`, JSON.stringify(currentNode.data, null, 2));
      
      // ✅ CORREÇÃO: Acessar dados diretamente do data, não do config
      const teamId = currentNode.data?.teamId || currentNode.data?.config?.teamId;
      const mensagem = currentNode.data?.mensagem || currentNode.data?.config?.mensagem || 'Aguarde, você será atendido por nossa equipe...';
      const teamNome = currentNode.data?.teamNome || currentNode.data?.config?.teamNome;
      
      console.log(`🔍 [FLOW-SIMPLE] Configuração da transferência:`, {
        teamId,
        mensagem,
        teamNome
      });
      
      if (!teamId) {
        console.error(`❌ [FLOW-SIMPLE] TeamId não configurado no bloco de transferência`);
        return { text: 'Erro na configuração de transferência.' };
      }
      
      // Salvar histórico
      await supabase.from('flow_user_history').insert({
        whatsapp_client_id: userId,  // ✅ Usar whatsapp_client_id
        account_id: accountId,
        flow_id: flow.id,
        final_node_id: currentNode.id,
        variables,
        status: 'transferido_time',
        organization_id: organizationId,
        extra: {
          team_id: teamId,
          transfer_type: 'transferencia_time',
          last_message: message
        }
      });
      
      // Atualizar chat para "aguardando atendimento"
      await supabase.from('chats')
        .update({ 
          status: 'aguardando_atendimento',
          assigned_team: teamId 
        })
        .eq('id', chatId);
      
      // Remover estado do flow (transferência encerra o fluxo)
      await supabase.from('flow_user_state')
        .delete()
        .eq('whatsapp_client_id', userId)  // ✅ Usar whatsapp_client_id
        .eq('account_id', accountId)
        .eq('flow_id', flow.id);
      
      // ✅ NOVO: Emitir notificação Socket.IO para o time
      if (global.io) {
        // Buscar informações do chat para a notificação
        const { data: chatInfo } = await supabase
          .from('chats')
          .select('name, whatsapp_jid, status, assigned_team')
          .eq('id', chatId)
          .single();
        
        // Buscar informações do time
        const { data: teamInfo } = await supabase
          .from('teams')
          .select('name, description')
          .eq('id', teamId)
          .single();
        
        const notificationData = {
          chatId: chatId,
          chatName: chatInfo?.name || 'Cliente WhatsApp',
          whatsapp_jid: chatInfo?.whatsapp_jid || fromJid,
          message: `Novo chat transferido para o time ${teamInfo?.name || 'Desconhecido'}`,
          teamId: teamId,
          teamName: teamInfo?.name || 'Time Desconhecido',
          fromJid: fromJid,
          organizationId: organizationId,
          status: 'aguardando_atendimento',
          transferType: 'transferencia_time',
          timestamp: new Date().toISOString()
        };
        
        // Emitir para o time específico
        global.io.to(`team_${teamId}`).emit('new-team-chat', notificationData);
        
        // Emitir para a organização (supervisor dashboard)
        global.io.to(`org_${organizationId}`).emit('chat-transferred-to-team', notificationData);
        
        console.log(`📡 [FLOW-SIMPLE] Notificação enviada para time ${teamId} e organização ${organizationId}`);
        console.log(`📡 [FLOW-SIMPLE] Dados da notificação:`, notificationData);
      } else {
        console.warn(`⚠️ [FLOW-SIMPLE] Socket.IO não disponível para notificação`);
      }
      
      console.log(`📚 [FLOW-SIMPLE] Transferência para time ${teamId} processada`);
      console.log(`🗑️ [FLOW-SIMPLE] Estado do usuário removido após transferência`);
      console.log(`💬 [FLOW-SIMPLE] Retornando mensagem: "${mensagem}"`);
      
      return { text: mensagem };
      
    } else if (currentNode.type === 'transferencia_agente') {
      console.log(`👤 [FLOW-SIMPLE] Processando transferência para agente`);
      
      // ✅ CORREÇÃO: Acessar dados diretamente do data, não do config
      const agenteId = currentNode.data?.agenteId || currentNode.data?.config?.agenteId;
      const mensagem = currentNode.data?.mensagem || currentNode.data?.config?.mensagem || 'Aguarde, você será atendido por um de nossos especialistas...';
      const agenteNome = currentNode.data?.agenteNome || currentNode.data?.config?.agenteNome;
      
      if (!agenteId) {
        console.error(`❌ [FLOW-SIMPLE] AgenteId não configurado no bloco de transferência`);
        return { text: 'Erro na configuração de transferência.' };
      }
      
      // Salvar histórico
      await supabase.from('flow_user_history').insert({
        whatsapp_client_id: userId,  // ✅ Usar whatsapp_client_id
        account_id: accountId,
        flow_id: flow.id,
        final_node_id: currentNode.id,
        variables,
        status: 'transferido_agente',
        organization_id: organizationId,
        extra: {
          agente_id: agenteId,
          transfer_type: 'transferencia_agente',
          last_message: message
        }
      });
      
      // Atualizar chat para "aguardando atendimento" com agente específico
      await supabase.from('chats')
        .update({ 
          status: 'aguardando_atendimento',
          assigned_agent: agenteId 
        })
        .eq('id', chatId);
      
      // Remover estado do flow (transferência encerra o fluxo)
      await supabase.from('flow_user_state')
        .delete()
        .eq('whatsapp_client_id', userId)  // ✅ Usar whatsapp_client_id
        .eq('account_id', accountId)
        .eq('flow_id', flow.id);
      
      console.log(`📚 [FLOW-SIMPLE] Transferência para agente ${agenteId} processada`);
      console.log(`🗑️ [FLOW-SIMPLE] Estado do usuário removido após transferência`);
      
      return { text: mensagem };
      
    } else {
      // Bloco não suportado
      console.warn(`⚠️ [FLOW-SIMPLE] Tipo de bloco não suportado: ${currentNode.type}`);
      
      // Tentar seguir para o próximo bloco se houver edge
      const nextEdge = flow.edges.find(e => e.source === currentNode.id);
      if (nextEdge) {
        nextNodeId = nextEdge.target;
        shouldExecuteNextNode = true;
        const nextNode = flow.nodes.find(n => n.id === nextNodeId);
        responseText = nextNode?.data?.config?.texto || nextNode?.data?.config?.mensagemInicial || 'Processando...';
        console.log(`🔄 [FLOW-SIMPLE] Bloco não suportado - seguindo para próximo: ${nextNodeId}`);
      } else {
        responseText = 'Processando sua solicitação...';
        nextNodeId = currentNode.id;
        console.log(`⚠️ [FLOW-SIMPLE] Bloco não suportado e sem próximo bloco`);
      }
    }
    
    // 5. Se deve executar o próximo bloco imediatamente
    if (shouldExecuteNextNode && nextNodeId && nextNodeId !== currentNodeId) {
      console.log(`🔄 [FLOW-SIMPLE] Executando próximo bloco imediatamente: ${nextNodeId}`);
      
      // Salvar estado ANTES de retornar
      // ✅ Primeiro deletar o estado existente, depois inserir novo
      await supabase.from('flow_user_state')
        .delete()
        .eq('whatsapp_client_id', userId)
        .eq('account_id', accountId)
        .eq('flow_id', flow.id);
      
      const { error: upsertError } = await supabase.from('flow_user_state')
        .insert({
          whatsapp_client_id: userId,
          account_id: accountId,
          flow_id: flow.id,
          current_node_id: nextNodeId,
          variables,
          last_message: message,
          updated_at: new Date().toISOString()
        });
      
      if (upsertError) {
        console.error(`❌ [FLOW-SIMPLE] Erro ao salvar estado:`, upsertError);
        return { text: 'Erro interno ao salvar progresso do fluxo.' };
      }
      console.log(`💾 [FLOW-SIMPLE] Estado salvo, próximo bloco: ${nextNodeId}`);
      
      // Buscar o próximo bloco
      const nextNode = flow.nodes.find(n => n.id === nextNodeId);
      if (nextNode) {
        console.log(`🎯 [FLOW-SIMPLE] Processando próximo bloco: ${nextNode.id} (${nextNode.type})`);
        
        // Processar o próximo bloco baseado no tipo
        let nextNodeText = '';
        console.log(`🔍 [FLOW-SIMPLE] Preparando mensagem para próximo bloco tipo: ${nextNode.type}`);
        
        if (nextNode.type === 'opcoes') {
          const opcoes = nextNode.data?.config?.opcoes || [];
          const pergunta = nextNode.data?.config?.pergunta || 'Escolha uma opção:';
          nextNodeText = pergunta;
          
          if (Array.isArray(opcoes) && opcoes.length > 0) {
            nextNodeText += '\n' + opcoes.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
          }
        } else if (nextNode.type === 'decisao') {
          const pergunta = nextNode.data?.config?.pergunta || 'Escolha uma opção:';
          const opcaoSim = nextNode.data?.config?.opcaoSim || 'Sim';
          const opcaoNao = nextNode.data?.config?.opcaoNao || 'Não';
          nextNodeText = pergunta + '\n1. ' + opcaoSim + '\n2. ' + opcaoNao;
        } else if (nextNode.type === 'mensagem') {
          nextNodeText = nextNode.data?.config?.texto || nextNode.data?.config?.mensagemInicial || '';
        } else if (nextNode.type === 'coletar_dados') {
          nextNodeText = nextNode.data?.config?.pergunta || 'Digite sua resposta:';
        } else if (nextNode.type === 'encerrar') {
          nextNodeText = nextNode.data?.config?.mensagem || 'Obrigado pelo contato!';
        } else if (nextNode.type === 'inicio') {
          nextNodeText = nextNode.data?.config?.mensagemInicial || '';
        } else {
          nextNodeText = nextNode.data?.config?.texto || nextNode.data?.config?.mensagemInicial || '';
        }
        
        console.log(`📝 [FLOW-SIMPLE] Texto do próximo bloco: "${nextNodeText}"`);
        
        console.log(`📝 [FLOW-SIMPLE] Retornando múltiplas mensagens`);
        console.log(`📝 [FLOW-SIMPLE] Primeira mensagem: "${responseText}"`);
        console.log(`📝 [FLOW-SIMPLE] Segunda mensagem: "${nextNodeText}"`);
        
        // Se a primeira mensagem está vazia, enviar apenas a segunda
        if (!responseText || responseText.trim() === '') {
          if (nextNodeText && nextNodeText.trim() !== '') {
            // Salvar mensagem do bot
            await saveBotMessage(chatId, accountData.user_id, whatsapp_Id, organizationId, nextNodeText);
          }
          return { text: nextNodeText, delay: 0 };
        }
        
        // Salvar ambas as mensagens
        const mensagensParaSalvar = [];
        if (responseText && responseText.trim() !== '') {
          mensagensParaSalvar.push({
            chat_id: chatId,
            user_id: accountData.user_id,
            account_id: whatsapp_Id,
            organization_id: organizationId,
            sender_name: 'bot',
            metadata: { bot_generated: true, timestamp: new Date().toISOString() },
            content: responseText,
            created_at: new Date().toISOString()
          });
        }
        if (nextNodeText && nextNodeText.trim() !== '') {
          mensagensParaSalvar.push({
            chat_id: chatId,
            user_id: accountData.user_id,
            account_id: whatsapp_Id,
            organization_id: organizationId,
            sender_name: 'bot',
            metadata: { bot_generated: true, timestamp: new Date().toISOString() },
            content: nextNodeText,
            created_at: new Date().toISOString()
          });
        }
        
        if (mensagensParaSalvar.length > 0) {
          try {
            await supabase.from('messages').insert(mensagensParaSalvar);
            console.log(`✅ [FLOW-SIMPLE] Mensagens do bot salvas:`, mensagensParaSalvar.length);
          } catch (err) {
            console.error(`❌ [FLOW-SIMPLE] Erro ao salvar mensagens do bot:`, err);
          }
        }
        
        return { 
          text: responseText,
          nextMessage: nextNodeText,
          delay: 3000 // 3 segundos
        };
      } else {
        console.error(`❌ [FLOW-SIMPLE] Próximo bloco ${nextNodeId} não encontrado`);
      }
    }
    
    // 6. Salvar estado (para casos que não retornam antecipadamente)
    // ✅ Primeiro deletar o estado existente, depois inserir novo
    await supabase.from('flow_user_state')
      .delete()
      .eq('whatsapp_client_id', userId)
      .eq('account_id', accountId)
      .eq('flow_id', flow.id);
    
    const { error: upsertError } = await supabase.from('flow_user_state')
      .insert({
        whatsapp_client_id: userId,
        account_id: accountId,
        flow_id: flow.id,
        current_node_id: nextNodeId || currentNodeId,
        variables,
        last_message: message,
        updated_at: new Date().toISOString()
      });
    
    if (upsertError) {
      console.error(`❌ [FLOW-SIMPLE] Erro ao salvar estado:`, upsertError);
      return { text: 'Erro interno ao salvar progresso do fluxo.' };
    }
    
    console.log(`💾 [FLOW-SIMPLE] Estado salvo, próximo bloco: ${nextNodeId || currentNodeId}`);
    console.log(`📤 [FLOW-SIMPLE] Retornando resposta: "${responseText}"`);
    
    // Salvar mensagem do bot no histórico
    if (responseText && responseText.trim() !== '') {
      await saveBotMessage(chatId, accountData.user_id, whatsapp_Id, organizationId, responseText);
    }
    
    return { text: responseText };
    
  } catch (error) {
    console.error(`❌ [FLOW-SIMPLE] Erro na execução do flow:`, error);
    return { text: 'Erro interno ao processar fluxo.' };
  }
};

/**
 * Salva mensagem do bot no histórico
 */
async function saveBotMessage(chatId, userId, accountId, organizationId, content) {
  try {
    const { data: savedBotMessage, error: botMessageError } = await supabase.from('messages').insert({
      chat_id: chatId,
      user_id: userId,
      account_id: accountId,
      organization_id: organizationId,
      metadata: { bot_generated: true, timestamp: new Date().toISOString() },
      sender_name: 'bot',
      is_from_me: false,
      content: content,
      created_at: new Date().toISOString()
    });
    
    if (botMessageError) {
      console.error(`❌ [FLOW-SIMPLE] Erro ao salvar mensagem do bot:`, botMessageError);
    } else {
      console.log(`✅ [FLOW-SIMPLE] Mensagem do bot salva:`, content);
    }
  } catch (err) {
    console.error(`❌ [FLOW-SIMPLE] Erro ao salvar mensagem do bot:`, err);
  }
}
