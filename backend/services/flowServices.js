
// Função engine de execução do flow
export const executeFlowStep = async function ({ accountId, fromJid, message, flow, sock, chatId, userId, organizationId, mediaInfo, accountData,whatsapp_Id }) {
    console.log(`🔄 [executeFlowStep] Iniciando execução do fluxo ${flow.id} para usuário ${userId}`);
    console.log(`📝 [executeFlowStep] Mensagem recebida: "${message}"`);
    console.log(`🔍 [executeFlowStep] accountData recebido:`, accountData);
    console.log(`🔍 [executeFlowStep] accountData.user_id:`, accountData?.user_id);
    console.log(`🔍 [executeFlowStep] userId recebido:`, userId);
    console.log(`📊 [executeFlowStep] Flow data:`, { 
      id: flow.id, 
      nome: flow.nome, 
      nodesCount: flow.nodes?.length || 0,
      edgesCount: flow.edges?.length || 0 
    });
    
    // Log detalhado dos nodes e edges
    console.log(`🏗️ [executeFlowStep] Nodes do flow:`, flow.nodes?.map(n => ({
      id: n.id,
      type: n.type,
      data: n.data?.config
    })));
    console.log(`🔗 [executeFlowStep] Edges do flow:`, flow.edges?.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle
    })));
  
    // 1. Buscar estado do usuário
    let { data: userState, error: userStateError } = await supabase
      .from('flow_user_state')
      .select('*')
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('flow_id', flow.id)
      .maybeSingle();
  
    if (userStateError) {
      console.error(`❌ [executeFlowStep] Erro ao buscar estado do usuário:`, userStateError);
      return { text: 'Erro interno ao processar fluxo.' };
    }
  
    // 2. Se não existir, iniciar no bloco 'inicio'
    let currentNodeId;
    let variables = {};
    if (!userState) {
      console.log(`🆕 [executeFlowStep] Novo usuário no fluxo, buscando bloco inicial...`);
      const startNode = flow.nodes.find(n => n.type === 'inicio');
      if (!startNode) {
        console.error(`❌ [executeFlowStep] Fluxo ${flow.id} não possui bloco inicial`);
        return { text: 'Fluxo sem bloco inicial.' };
      }
      currentNodeId = startNode.id;
      console.log(`✅ [executeFlowStep] Bloco inicial encontrado: ${startNode.id} (${startNode.type})`);
      
      // Salvar novo estado
      const { error: insertError } = await supabase.from('flow_user_state').insert({
        user_id: userId,
        account_id: accountId,
        flow_id: flow.id,
        current_node_id: currentNodeId,
        variables: {},
        last_message: message,
        updated_at: new Date().toISOString()
      });
      
      if (insertError) {
        console.error(`❌ [executeFlowStep] Erro ao salvar estado inicial:`, insertError);
        return { text: 'Erro interno ao iniciar fluxo.' };
      }
      console.log(`✅ [executeFlowStep] Estado inicial salvo`);
    } else {
      currentNodeId = userState.current_node_id;
      variables = userState.variables || {};
      console.log(`📍 [executeFlowStep] Usuário retomando fluxo no bloco: ${currentNodeId}`);
    }
  
    // 3. Identificar bloco atual
    const currentNode = flow.nodes.find(n => n.id === currentNodeId);
    if (!currentNode) {
      console.error(`❌ [executeFlowStep] Bloco atual ${currentNodeId} não encontrado no fluxo`);
      return { text: 'Bloco atual não encontrado.' };
    }
  
    console.log(`🎯 [executeFlowStep] Processando bloco: ${currentNode.id} (${currentNode.type})`);
    console.log(`📋 [executeFlowStep] Configuração do bloco:`, currentNode.data?.config);
  
    // 4. Processar tipo do bloco
    let responseText = '';
    let nextNodeId = null;
    let shouldExecuteNextNode = false;
    let isInicioMessage = false; // Flag para identificar mensagens de início
    
    if (currentNode.type === 'inicio' || currentNode.type === 'mensagem') {
      // Envia mensagem e avança para o próximo bloco
      responseText = currentNode.data?.config?.mensagemInicial || currentNode.data?.config?.texto || 'Processando...';
      isInicioMessage = currentNode.type === 'inicio'; // Marcar se é mensagem de início
      console.log(`💬 [executeFlowStep] Enviando mensagem: "${responseText}"`);
      
      // Descobrir próximo bloco (edge)
      const nextEdge = flow.edges.find(e => e.source === currentNode.id);
      if (nextEdge) {
        nextNodeId = nextEdge.target;
        shouldExecuteNextNode = true; // Marcar para executar o próximo bloco
        console.log(`➡️ [executeFlowStep] Próximo bloco: ${nextNodeId} (será executado imediatamente)`);
      } else {
        console.log(`⚠️ [executeFlowStep] Nenhum edge encontrado para o bloco ${currentNode.id}`);
      }
      
      // Para blocos de início, sempre enviar a mensagem
      if (isInicioMessage) {
        console.log(`🚀 [executeFlowStep] Bloco de início detectado - continuando para salvar estado e executar próximo bloco`);
        // Não retornar aqui - deixar o código continuar para salvar o estado e executar o próximo bloco
        // A lógica de envio de mensagens será tratada na parte final da função
      }
    } else if (currentNode.type === 'opcoes' || currentNode.type === 'decisao') {
      // Espera resposta do usuário
      const opcoes = currentNode.data?.config?.opcoes || [];
      console.log(`🤔 [executeFlowStep] Processando opções:`, opcoes);
      
      // Tenta encontrar opção correspondente
      const userInput = (message || '').trim().toLowerCase();
      let matchedIdx = -1;
      
      // Verificar se é um clique em botão (selectedButtonId) ou seleção de lista
      if (userInput.startsWith('btn_')) {
        const buttonIndex = parseInt(userInput.replace('btn_', ''));
        if (!isNaN(buttonIndex) && buttonIndex >= 0 && buttonIndex < opcoes.length) {
          matchedIdx = buttonIndex;
          console.log(`🔘 [executeFlowStep] Botão ${buttonIndex} clicado: "${opcoes[buttonIndex]}"`);
        }
      } else if (Array.isArray(opcoes)) {
        // Busca por texto ou número
        matchedIdx = opcoes.findIndex(opt => userInput === opt.toLowerCase() || userInput === String(opcoes.indexOf(opt) + 1));
      }
      
      if (matchedIdx >= 0) {
        console.log(`✅ [executeFlowStep] Opção ${matchedIdx + 1} selecionada: "${opcoes[matchedIdx]}"`);
        console.log(`🔍 [executeFlowStep] Buscando edge para opção ${matchedIdx} no bloco ${currentNode.id}`);
        console.log(`🔍 [executeFlowStep] Edges disponíveis:`, flow.edges.filter(e => e.source === currentNode.id));
        
        // Encontrou opção, segue para o edge correspondente
        const nextEdge = flow.edges.find(e => e.source === currentNode.id && e.sourceHandle === `opcao_${matchedIdx}`);
        
        if (nextEdge) {
          nextNodeId = nextEdge.target;
          shouldExecuteNextNode = true; // Marcar para executar o próximo bloco
          const nextNode = flow.nodes.find(n => n.id === nextNodeId);
          
          // Se o próximo bloco é pesquisa_satisfacao, não retornar mensagem vazia
          if (nextNode?.type === 'pesquisa_satisfacao') {
            responseText = ''; // Não enviar mensagem do bloco atual
          } else {
            responseText = nextNode?.data?.config?.texto || nextNode?.data?.config?.mensagemInicial || 'Processando...';
          }
          console.log(`➡️ [executeFlowStep] Edge encontrado! Indo para bloco ${nextNodeId}, resposta: "${responseText}"`);
        } else {
          console.error(`❌ [executeFlowStep] Edge não encontrado para opção ${matchedIdx}`);
          console.error(`❌ [executeFlowStep] Procurando por sourceHandle: "opcao_${matchedIdx}"`);
          console.error(`❌ [executeFlowStep] Edges do bloco atual:`, flow.edges.filter(e => e.source === currentNode.id));
          
          // Tentar fallback: buscar qualquer edge do bloco atual
          const fallbackEdge = flow.edges.find(e => e.source === currentNode.id);
          if (fallbackEdge) {
            console.log(`🔄 [executeFlowStep] Usando fallback - primeiro edge disponível: ${fallbackEdge.target}`);
            nextNodeId = fallbackEdge.target;
            shouldExecuteNextNode = true;
            const nextNode = flow.nodes.find(n => n.id === nextNodeId);
            responseText = nextNode?.data?.config?.texto || nextNode?.data?.config?.mensagemInicial || 'Processando...';
          } else {
            responseText = 'Opção selecionada, mas próximo bloco não encontrado.';
          }
        }
      } else {
        // Não reconheceu a opção, repete a pergunta com formatação simples
        const pergunta = currentNode.data?.config?.pergunta || 'Escolha uma opção:';
        responseText = pergunta;
        
        if (Array.isArray(opcoes)) {
          // Formatar opções de forma simples
          responseText += '\n' + opcoes.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
        }
        nextNodeId = currentNode.id; // permanece no mesmo bloco
        console.log(`🔄 [executeFlowStep] Opção não reconhecida, repetindo pergunta`);
      }
    } else if (currentNode.type === 'pesquisa_satisfacao') {
      // Processar resposta da pesquisa de satisfação
      const pergunta = currentNode.data?.config?.pergunta || 'Qual a sua avaliação?';
      const tipoResposta = currentNode.data?.config?.tipoResposta || 'estrelas';
      
      // Verificar se o usuário já respondeu uma avaliação válida
      const userRating = parseInt(message);
      const isValidRating = !isNaN(userRating) && userRating >= 1 && userRating <= 5;
      
      if (isValidRating) {
        console.log(`⭐ [executeFlowStep] Avaliação recebida: ${userRating} estrelas`);
        // Avançar para o próximo bloco
        const nextEdge = flow.edges.find(e => e.source === currentNode.id);
        if (nextEdge) {
          nextNodeId = nextEdge.target;
          shouldExecuteNextNode = true;
          const nextNode = flow.nodes.find(n => n.id === nextNodeId);
          responseText = nextNode?.data?.config?.texto || nextNode?.data?.config?.mensagemInicial || 'Obrigado pela avaliação!';
          console.log(`➡️ [executeFlowStep] Indo para próximo bloco após avaliação: ${nextNodeId}`);
        } else {
          responseText = 'Obrigado pela sua avaliação!';
          console.log(`✅ [executeFlowStep] Avaliação processada, mas não há próximo bloco`);
        }
      } else {
        // Mostrar pergunta de pesquisa (primeira vez ou resposta inválida)
        if (tipoResposta === 'estrelas') {
          responseText = `${pergunta}\n\n⭐ 1 - Muito ruim\n⭐⭐ 2 - Ruim\n⭐⭐⭐ 3 - Regular\n⭐⭐⭐⭐ 4 - Bom\n⭐⭐⭐⭐⭐ 5 - Excelente`;
        } else {
          responseText = pergunta;
        }
        nextNodeId = currentNode.id; // permanece no mesmo bloco
        console.log(`📊 [executeFlowStep] Mostrando pergunta de pesquisa: "${responseText}"`);
      }
    } else if (currentNode.type === 'dentro_horario' || currentNode.type === 'fora_horario') {
      // Processar blocos de horário específicos
      console.log(`🕐 [executeFlowStep] Processando bloco: ${currentNode.type}`);
  
      // Enviar mensagem e avançar para o próximo bloco
      responseText = currentNode.data?.config?.texto || 'Processando...';
      console.log(`💬 [executeFlowStep] Enviando mensagem: "${responseText}"`);
  
      // Para bloco 'fora_horario', procurar especificamente pelo edge 'false'
      if (currentNode.type === 'fora_horario') {
        console.log(`❌ [executeFlowStep] Bloco fora_horario - procurando edge 'false'`);
        const nextEdge = flow.edges.find(e => e.source === currentNode.id && e.sourceHandle === 'false');
        if (nextEdge) {
          nextNodeId = nextEdge.target;
          shouldExecuteNextNode = true; // Marcar para executar o próximo bloco
          console.log(`➡️ [executeFlowStep] Edge 'false' encontrado! Próximo bloco: ${nextNodeId}`);
        } else {
          console.log(`⚠️ [executeFlowStep] Edge 'false' não encontrado para o bloco fora_horario`);
        }
      } else {
        // Para bloco 'dentro_horario', procurar qualquer edge
        const nextEdge = flow.edges.find(e => e.source === currentNode.id);
        if (nextEdge) {
          nextNodeId = nextEdge.target;
          shouldExecuteNextNode = true; // Marcar para executar o próximo bloco
          console.log(`➡️ [executeFlowStep] Próximo bloco: ${nextNodeId} (será executado imediatamente)`);
        } else {
          console.log(`⚠️ [executeFlowStep] Nenhum edge encontrado para o bloco ${currentNode.id}`);
        }
      }
    } else if (currentNode.type === 'horario') {
      // Processar bloco de horário de funcionamento
      console.log(`🕐 [executeFlowStep] Processando bloco de horário`);
      console.log(`📋 [executeFlowStep] Configuração do horário:`, currentNode.data?.config);
  
      // Verificar horário atual
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentDay = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
      // Obter configurações do bloco
      const config = currentNode.data?.config || {};
      const diasSemanaObj = config.dias || {};
      const horarios = config.horarios || [{ horaInicio: '08:00', horaFim: '18:00' }];
  
      console.log(`📅 [executeFlowStep] Dias configurados:`, diasSemana);
      console.log(`⏰ [executeFlowStep] Horários configurados:`, horarios);
      console.log(`🕐 [executeFlowStep] Horário atual: ${currentHour}:${currentMinute}, Dia: ${currentDay}`);
  
      const atualMinutos = currentHour * 60 + currentMinute;
      const diaAtualNome = Object.keys(diasSemanaObj).find(key => diasSemanaObj[key] === true);
      const isDiaValido = diasSemana.includes(diaAtualNome);
  
      // Verificar se está em algum dos intervalos de horário
      const isHorarioValido = horarios.some(intervalo => {
        const [inicioHour, inicioMin] = intervalo.horaInicio.split(':').map(Number);
        const [fimHour, fimMin] = intervalo.horaFim.split(':').map(Number);
        const inicioMinutos = inicioHour * 60 + inicioMin;
        const fimMinutos = fimHour * 60 + fimMin;
        return atualMinutos >= inicioMinutos && atualMinutos <= fimMinutos;
      });
  
      console.log(`📅 [executeFlowStep] Dia atual (${diaAtualNome}) está configurado: ${isDiaValido}`);
      console.log(`⏰ [executeFlowStep] Está no horário: ${isHorarioValido}`);
  
      const isEmHorarioFuncionamento = isDiaValido && isHorarioValido;
      const sourceHandle = isEmHorarioFuncionamento ? 'true' : 'false';
  
      console.log(`✅ [executeFlowStep] Decisão do horário: ${sourceHandle}`);
      const nextEdge = flow.edges.find(e => e.source === currentNode.id && e.sourceHandle === sourceHandle);
  
        if (nextEdge) {
          nextNodeId = nextEdge.target;
        shouldExecuteNextNode = true; // A mensagem será definida pelo próximo bloco
        responseText = ''; // Este bloco não envia mais mensagem
        console.log(`➡️ [executeFlowStep] Seguindo para o nó: ${nextNodeId} pela saída '${sourceHandle}'`);
        } else {
        console.log(`⚠️ [executeFlowStep] Nenhum nó conectado à saída '${sourceHandle}'`);
        // Fim do fluxo neste galho se nada estiver conectado
        return { text: '' };
      }
    } else if (currentNode.type === 'transferencia_agente' || currentNode.type === 'transferencia_ia' || currentNode.type === 'transferencia_departamento') {
      // Processar transferência
      console.log(`🔄 [executeFlowStep] Processando transferência: ${currentNode.type}`);
  
      // Salvar histórico de transferência
      await supabase.from('flow_user_history').insert({
        user_id: userId,
        account_id: accountId,
        flow_id: flow.id,
        final_node_id: currentNode.id,
        variables,
        status: currentNode.type === 'transferencia_agente' ? 'transferido_atendente' :
          currentNode.type === 'transferencia_ia' ? 'transferido_ia' : 'transferido_departamento',
        organization_id: organizationId,
        extra: {
          last_message: message,
          transfer_type: currentNode.type,
          transfer_config: currentNode.data?.config
        }
      });
  
      // Remover estado do usuário (transferência encerra o fluxo)
      await supabase.from('flow_user_state')
        .delete()
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('flow_id', flow.id);
  
      console.log(`📚 [executeFlowStep] Histórico de transferência salvo.`);
      console.log(`🗑️ [executeFlowStep] Estado do usuário removido após transferência.`);
  
      // Mensagem de transferência
      if (currentNode.type === 'transferencia_agente') {
        responseText = 'Transferindo para um atendente. Aguarde um momento...';
      } else if (currentNode.type === 'transferencia_ia') {
        responseText = 'Transferindo para nossa IA. Aguarde um momento...';
      } else {
        responseText = 'Transferindo para o departamento. Aguarde um momento...';
      }
      // Dentro de executeFlowStep, antes de cada insert em messages
      if (!chatId) {
        console.error('❌ [FLOW] chatId está undefined ou vazio ao tentar salvar mensagem do bot! userId:', userId, 'accountId:', accountId, 'organizationId:', organizationId, 'content:', responseText);
      } else {
        console.log('✅ [FLOW] Salvando mensagem do bot em messages. chatId:', chatId, 'userId:', userId, 'content:', responseText);
      }
      // Não enviar mensagem padrão
      if (isMensagemPadrao(responseText)) {
        return { text: '' };
      }
      return { text: responseText };
    } else {
      // Bloco não suportado - não enviar mensagem de erro para o cliente
      console.warn(`⚠️ [executeFlowStep] Tipo de bloco não suportado: ${currentNode.type}`);
  
      // Tentar seguir para o próximo bloco se houver edge
      const nextEdge = flow.edges.find(e => e.source === currentNode.id);
      if (nextEdge) {
        nextNodeId = nextEdge.target;
        shouldExecuteNextNode = true;
        const nextNode = flow.nodes.find(n => n.id === nextNodeId);
        responseText = nextNode?.data?.config?.texto || nextNode?.data?.config?.mensagemInicial || 'Processando...';
        console.log(`🔄 [executeFlowStep] Bloco não suportado - seguindo para próximo: ${nextNodeId}`);
      } else {
        responseText = 'Processando sua solicitação...';
        nextNodeId = currentNode.id;
        console.log(`⚠️ [executeFlowStep] Bloco não suportado e sem próximo bloco`);
      }
    }
  
    // Se deve executar o próximo bloco imediatamente, fazer isso agora
    if (shouldExecuteNextNode && nextNodeId && nextNodeId !== currentNodeId) {
      console.log(`🔄 [executeFlowStep] Executando próximo bloco imediatamente: ${nextNodeId}`);
      console.log(`🔍 [executeFlowStep] Bloco atual: ${currentNodeId}, Próximo bloco: ${nextNodeId}`);
      
      // Salvar estado ANTES de retornar (importante!)
      const { error: upsertError } = await supabase.from('flow_user_state')
        .upsert({
          user_id: userId,
          account_id: accountId,
          flow_id: flow.id,
          current_node_id: nextNodeId, // Avançar para o próximo bloco
          variables,
          last_message: message,
          updated_at: new Date().toISOString()
        }, { onConflict: ['user_id', 'account_id', 'flow_id'] });
  
      if (upsertError) {
        console.error(`❌ [executeFlowStep] Erro ao salvar estado:`, upsertError);
        return { text: 'Erro interno ao salvar progresso do fluxo.' };
      }
      console.log(`💾 [executeFlowStep] Estado salvo, próximo bloco: ${nextNodeId}`);
      
      // Buscar o próximo bloco
      const nextNode = flow.nodes.find(n => n.id === nextNodeId);
      if (nextNode) {
        console.log(`🎯 [executeFlowStep] Processando próximo bloco: ${nextNode.id} (${nextNode.type})`);
        console.log(`📋 [executeFlowStep] Configuração do próximo bloco:`, nextNode.data?.config);
        
        // Processar o próximo bloco baseado no tipo
        let nextNodeText = '';
        if (nextNode.type === 'opcoes' || nextNode.type === 'decisao') {
          const opcoes = nextNode.data?.config?.opcoes || [];
          const pergunta = nextNode.data?.config?.pergunta || 'Escolha uma opção:';
          nextNodeText = pergunta;
          
          if (Array.isArray(opcoes)) {
            nextNodeText += '\n' + opcoes.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
          }
          console.log(`💬 [executeFlowStep] Próximo bloco (opções) processado: "${nextNodeText}"`);
        } else if (nextNode.type === 'mensagem') {
          nextNodeText = nextNode.data?.config?.texto || nextNode.data?.config?.mensagemInicial || 'Processando...';
          console.log(`💬 [executeFlowStep] Próximo bloco (mensagem) processado: "${nextNodeText}"`);
        } else if (nextNode.type === 'pesquisa_satisfacao') {
          const pergunta = nextNode.data?.config?.pergunta || 'Qual a sua avaliação?';
          const tipoResposta = nextNode.data?.config?.tipoResposta || 'estrelas';
          
          if (tipoResposta === 'estrelas') {
            nextNodeText = `${pergunta}\n\n⭐ 1 - Muito ruim\n⭐⭐ 2 - Ruim\n⭐⭐⭐ 3 - Regular\n⭐⭐⭐⭐ 4 - Bom\n⭐⭐⭐⭐⭐ 5 - Excelente`;
          } else {
            nextNodeText = pergunta;
          }
          console.log(`💬 [executeFlowStep] Próximo bloco (pesquisa_satisfacao) processado: "${nextNodeText}"`);
        } else if (nextNode.type === 'encerrar') {
          nextNodeText = nextNode.data?.config?.mensagem || 'Obrigado pelo contato!';
          console.log(`💬 [executeFlowStep] Próximo bloco (encerrar) processado: "${nextNodeText}"`);
        } else if (nextNode.type === 'horario') {
          nextNodeText = 'Verificando horário de atendimento...';
          console.log(`💬 [executeFlowStep] Próximo bloco (horario) processado: "${nextNodeText}"`);
        } else if (nextNode.type === 'transferencia_ia' || nextNode.type === 'transferencia_departamento') {
          nextNodeText = 'Transferindo para atendimento...';
          console.log(`💬 [executeFlowStep] Próximo bloco (${nextNode.type}) processado: "${nextNodeText}"`);
        } else {
          nextNodeText = nextNode.data?.config?.texto || nextNode.data?.config?.mensagemInicial || 'Processando...';
          console.log(`💬 [executeFlowStep] Próximo bloco (${nextNode.type}) processado: "${nextNodeText}"`);
        }
        
        // Retornar múltiplas mensagens com delay
        console.log(`📝 [executeFlowStep] Retornando múltiplas mensagens com delay`);
        console.log(`📝 [executeFlowStep] Primeira mensagem: "${responseText}"`);
        console.log(`📝 [executeFlowStep] Segunda mensagem: "${nextNodeText}"`);
        
        // Se a primeira mensagem está vazia, enviar apenas a segunda
        if (!responseText || responseText.trim() === '') {
          // Para mensagens de início, sempre enviar a mensagem do próximo bloco
          if (nextNodeText && nextNodeText.trim() !== '' && !isMensagemPadrao(nextNodeText)) {
            console.log('🔍 [DEBUG] Antes do insert (linha 1489) - userId:', userId, 'accountData.user_id:', accountData.user_id);
            try {
              const { data: savedBotMessage, error: botMessageError } = await supabase.from('messages').insert({
                chat_id: chatId,
                user_id: accountData.user_id,
                account_id: whatsapp_Id,
                organization_id: organizationId,
                metadata: {
                  bot_generated: true,
                  timestamp: new Date().toISOString()
                },
                sender_name: 'bot',
                is_from_me: false,
                content: nextNodeText,
                created_at: new Date().toISOString()
              });
              console.log('✅ [FLOW] Mensagem do bot salva em messages1:', { chat_id: chatId, user_id: userId, content: nextNodeText });
              console.log('🟢 [FLOW] Retorno Supabase insert (bot)1:', { data: savedBotMessage, error: botMessageError });
            } catch (err) {
              console.error('❌ [FLOW] Erro ao salvar mensagem do bot em messages:', { chat_id: chatId, user_id: userId, content: nextNodeText, error: err });
            }
          }
          // Não enviar mensagem padrão
          if (isMensagemPadrao(nextNodeText)) {
            return { text: '' };
          }
          return { 
            text: nextNodeText,
            delay: 0 // Sem delay se não há primeira mensagem
          };
        }
        
        // Salvar ambas as mensagens
        const mensagensParaSalvar = [];
        if (responseText && responseText.trim() !== '' && !isMensagemPadrao(responseText)) {
          console.log('🔍 [DEBUG] Antes do insert - userId:', userId, 'accountData.user_id:', accountData.user_id);
          mensagensParaSalvar.push({
            chat_id: chatId,
            user_id: accountData.user_id,
            account_id: whatsapp_Id,
            organization_id: organizationId,
            sender_name: 'bot',
            metadata: {
              bot_generated: true,
              timestamp: new Date().toISOString()
            },
            content: responseText,
            created_at: new Date().toISOString()
          });
        }
        if (nextNodeText && nextNodeText.trim() !== '' && !isMensagemPadrao(nextNodeText)) {
          console.log('🔍 [DEBUG] Antes do insert - userId:', userId, 'accountData.user_id:', accountData.user_id, 'whatsapp_Id dentro da função: ', whatsapp_Id);
          mensagensParaSalvar.push({
            chat_id: chatId,
            user_id: accountData.user_id,
            account_id: whatsapp_Id,
            organization_id: organizationId,
            sender_name: 'bot',
            metadata: {
              bot_generated: true,
              timestamp: new Date().toISOString()
            },
            content: nextNodeText,
            created_at: new Date().toISOString()
          });
        }
        console.log("❌❌❌✅✅✅✅ mensagensParaSalvar", mensagensParaSalvar)
        if (mensagensParaSalvar.length > 0) {
          try {
            const { data: savedBotMessages, error: botMessagesError } = await supabase.from('messages').insert(mensagensParaSalvar);
            console.log('✅ [FLOW] Mensagens do bot salvas em messages2:', mensagensParaSalvar);
            console.log('🟢 [FLOW] Retorno Supabase insert (bot)2:', { data: savedBotMessages, error: botMessagesError });
          } catch (err) {
            console.error('❌ [FLOW] Erro ao salvar mensagens do bot em messages:', { mensagensParaSalvar, error: err });
          }
        }
        // Não enviar mensagem padrão
        if (isMensagemPadrao(responseText) && isMensagemPadrao(nextNodeText)) {
          return { text: '' };
        }
        if (isMensagemPadrao(responseText)) {
          return { text: nextNodeText, delay: 0 };
        }
        if (isMensagemPadrao(nextNodeText)) {
          return { text: responseText };
        }
        return { 
          text: responseText,
          nextMessage: nextNodeText,
          delay: 3000 // 3 segundos
        };
      } else {
        console.error(`❌ [executeFlowStep] Próximo bloco ${nextNodeId} não encontrado`);
        // Manter apenas a mensagem do bloco atual se o próximo não for encontrado
      }
    }
  
    // 5. Salvar novo estado (para casos que não retornam antecipadamente)
    // Se o bloco atual é de encerramento, salvar histórico e remover o estado do usuário
    if (currentNode.type === 'encerrar') {
      // Salvar histórico
      await supabase.from('flow_user_history').insert({
        user_id: accountData.user_id,
        account_id: accountId,
        flow_id: flow.id,
        final_node_id: currentNode.id,
        variables,
        status: 'encerrado',
        organization_id: organizationId,
        extra: { last_message: message }
      });
      // Remover estado do usuário
      await supabase.from('flow_user_state')
        .delete()
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('flow_id', flow.id);
      console.log(`🗑️ [executeFlowStep] Estado do usuário removido após encerramento do fluxo.`);
      console.log(`📚 [executeFlowStep] Histórico de encerramento salvo.`);
      // Retornar resposta normalmente
      return { text: currentNode.data?.config?.mensagem || 'Obrigado pelo contato!' };
    }
  
    const { error: upsertError } = await supabase.from('flow_user_state')
      .upsert({
        user_id: userId,
        account_id: accountId,
        flow_id: flow.id,
        current_node_id: nextNodeId || currentNodeId,
        variables,
        last_message: message,
        updated_at: new Date().toISOString()
      }, { onConflict: ['user_id', 'account_id', 'flow_id'] });
  
    if (upsertError) {
      console.error(`❌ [executeFlowStep] Erro ao salvar estado:`, upsertError);
      return { text: 'Erro interno ao salvar progresso do fluxo.' };
    }
  
    console.log(`💾 [executeFlowStep] Estado salvo, próximo bloco: ${nextNodeId || currentNodeId}`);
    console.log(`📤 [executeFlowStep] Retornando resposta: "${responseText}"`);
    console.log('🔍 [DEBUG] whatsapp_Id:', whatsapp_Id);
    // Salvar mensagem do bot no histórico (tabela messages)
    if (responseText && responseText.trim() !== '' && !isMensagemPadrao(responseText)) {
      console.log('🔍 [DEBUG] Antes do insert (linha 1616) - userId:', userId, 'accountData.user_id:', accountData.user_id);
      try {
        const { data: savedBotMessage, error: botMessageError } = await supabase.from('messages').insert({
          chat_id: chatId,
          user_id: accountData.user_id,
          account_id: whatsapp_Id,
          organization_id: organizationId,
          metadata: {
            bot_generated: true,
            timestamp: new Date().toISOString()
          },
          sender_name: 'bot',
          content: responseText,
          created_at: new Date().toISOString()
        });
        console.log('✅ [FLOW] Mensagem do bot salva em messages3:', { chat_id: chatId, user_id: userId, content: responseText });
        console.log('🟢 [FLOW] Retorno Supabase insert (bot)3:', { data: savedBotMessage, error: botMessageError });
      } catch (err) {
        console.error('❌ [FLOW] Erro ao salvar mensagem do bot em messages:', { chat_id: chatId, user_id: userId, content: responseText, error: err });
      }
    }
  
    // 6. Retornar resposta
    console.log(`📤 [executeFlowStep] Retornando resposta: "${responseText}"`);
  
    return { text: responseText };
  }