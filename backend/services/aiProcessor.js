import { supabase } from '../lib/supabaseClient.js';
import { generateAIResponse } from './ai/generateAIResponse.js';
import { loadAISettings, validateAIEnabled, validateTranscriptionEnabled, validateSynthesisEnabled, getAIProcessingConfig } from './ai/aiSettingsMiddleware.js';
import { gerarAudioElevenLabs } from './elevenLabs.js';
import { sendAudioByAccount, checkAndApplyRateLimit } from './multiWhatsapp.js';
import { executeTool } from './ai/toolsExecutor.js';
import { isGroupChat, isGroupMention } from './groupProcessor.js';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
// Removido date-fns - usando JavaScript nativo

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to check business hours
export const checkIfWithinBusinessHours = (businessHours) => {
  console.log('⏰ [DEBUG] checkIfWithinBusinessHours chamada com:', {
    businessHours: JSON.stringify(businessHours, null, 2),
    type: typeof businessHours
  });

  if (!businessHours) {
    console.log('⏰ [DEBUG] Nenhum business_hours definido, permitindo acesso');
    return true;
  }

  // 🎯 USAR HORÁRIO BRASILEIRO CORRETO
  const now = new Date();
  
  // Converter para horário brasileiro
  const offsetBrasil = -3; // UTC-3 (horário de Brasília)
  const brazilTime = new Date(now.getTime() + (offsetBrasil * 60 * 60 * 1000));
  
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][brazilTime.getUTCDay()];
  
  console.log('⏰ [DEBUG] Data/hora corrigida para Brasil:', {
    utcTime: now.toISOString(),
    brazilTime: brazilTime.toISOString(),
    dayOfWeek,
    dayIndex: brazilTime.getUTCDay(),
    hour: brazilTime.getUTCHours(),
    minute: brazilTime.getUTCMinutes()
  });
  
  const todayHours = businessHours[dayOfWeek];

  if (!todayHours) {
    console.log(`⏰ [DEBUG] Não há configuração para ${dayOfWeek}`);
    console.log(`⏰ [DEBUG] Chaves disponíveis:`, Object.keys(businessHours));
    return false;
  }

  console.log(`⏰ [DEBUG] Configuração para ${dayOfWeek}:`, todayHours);

  if (!todayHours.enabled) {
    console.log(`⏰ [DEBUG] ${dayOfWeek} está desabilitado (enabled: ${todayHours.enabled})`);
    return false;
  }

  console.log(`⏰ [DEBUG] ${dayOfWeek} está habilitado, verificando horários...`);

  const [startHour, startMinute] = todayHours.start.split(':').map(Number);
  const [endHour, endMinute] = todayHours.end.split(':').map(Number);

  const currentHour = brazilTime.getUTCHours();
  const currentMinute = brazilTime.getUTCMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const startTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = endHour * 60 + endMinute;

  const isWithinHours = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
  
  console.log(`⏰ [DEBUG] Verificação detalhada:`, {
    startConfig: todayHours.start,
    endConfig: todayHours.end,
    currentTime: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
    startTimeMinutes: startTimeInMinutes,
    endTimeMinutes: endTimeInMinutes,
    currentTimeMinutes: currentTimeInMinutes,
    isWithinHours
  });

  return isWithinHours;
};



// Check AI credits before processing with detailed breakdown
const checkAndDeductCredits = async (userId, tokensUsed, model, assistantId, chatId, organizationId, tokenBreakdown = {}, messageComplexity = 'simple') => {
  try {
    console.log('💰 [DEBUG] Verificando créditos:', {
      userId,
      tokensUsed,
      model,
      assistantId,
      organizationId
    });

    // 🔍 VERIFICAR CRÉDITOS ORGANIZACIONAIS ANTES DE CHAMAR A FUNÇÃO
    const { data: orgCredits, error: orgCreditsError } = await supabase
      .from('ai_credits')
      .select('credits_remaining, credits_purchased, credits_used, organization_id')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('🏢 [DEBUG] Créditos organizacionais encontrados:', {
      orgCredits,
      orgCreditsError
    });

    // 🔍 VERIFICAR LIMITES DO AGENTE
    const { data: agentLimits, error: agentLimitsError } = await supabase
      .from('agent_credit_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    console.log('👤 [DEBUG] Limites do agente encontrados:', {
      agentLimits,
      agentLimitsError
    });
    
    // Usar a nova função organizacional com breakdown detalhado
    const startTime = Date.now();
    const { data, error } = await supabase.rpc('deduct_organization_ai_credits', {
      p_organization_id: organizationId,
      p_tokens_used: tokensUsed,
      p_model: model,
      p_user_id: userId,
      p_assistant_id: assistantId,
      p_chat_id: chatId,
      // 📊 Breakdown detalhado para relatórios
      p_prompt_tokens: tokenBreakdown.prompt || 0,
      p_completion_tokens: tokenBreakdown.completion || 0,
      p_system_tokens: tokenBreakdown.system || 0,
      p_context_tokens: tokenBreakdown.context || 0,
      p_user_message_tokens: tokenBreakdown.userMessage || 0,
      p_tools_enabled: tokenBreakdown.toolsEnabled || false,
      p_message_complexity: messageComplexity,
      p_optimization_applied: true, // Sempre true pois temos otimizações
      p_processing_time_ms: Date.now() - startTime
    });

    console.log('💰 [DEBUG] Resultado da verificação:', { data, error });

    if (error) {
      console.error('❌ Erro ao verificar créditos organizacionais:', error);
      return false;
    }

    // 🔍 DEBUG ESPECÍFICO do resultado
    if (!data) {
      console.log('❌ [DEBUG] Função retornou FALSE - possíveis motivos:');
      console.log('  1. Organização sem créditos suficientes');
      console.log('  2. Agente excedeu limite diário/mensal');
      console.log('  3. Erro na execução da função SQL');
      console.log('  🔍 Dados verificados acima ↑');

      // 🔧 TESTE MANUAL: Vamos ver se a coluna credits_remaining está certa
      const calculatedRemaining = orgCredits?.credits_purchased - orgCredits?.credits_used;
      console.log('🧮 [DEBUG] Cálculo manual:', {
        credits_purchased: orgCredits?.credits_purchased,
        credits_used: orgCredits?.credits_used,
        credits_remaining_tabela: orgCredits?.credits_remaining,
        credits_remaining_calculado: calculatedRemaining,
        tokens_necessarios: tokensUsed,
        sobra_suficiente: calculatedRemaining >= tokensUsed
      });

      // 🔧 VAMOS TESTAR A FUNÇÃO SQL MANUALMENTE
      console.log('🔧 [DEBUG] Testando função SQL diretamente...');
      const { data: testResult, error: testError } = await supabase.rpc('deduct_organization_ai_credits', {
        p_organization_id: organizationId,
        p_tokens_used: 10, // Teste com poucos tokens
        p_model: 'gpt-4o-mini',
        p_user_id: userId,
        p_assistant_id: assistantId,
        p_chat_id: chatId
      });
      console.log('🧪 [DEBUG] Teste com 10 tokens:', { testResult, testError });

    } else {
      console.log('✅ [DEBUG] Função retornou TRUE - créditos deduzidos com sucesso');
    }

    return data;
  } catch (error) {
    console.error('❌ Erro ao processar créditos organizacionais:', error);
    return false;
  }
};

// Get conversation history for context
const getConversationHistory = async (chatId, limit = 10) => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('content, is_from_me, sender_name, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Erro ao buscar histórico:', error);
      return [];
    }

    return messages.reverse().map(msg => ({
      role: msg.is_from_me ? 'assistant' : 'user',
      content: msg.content,
      sender: msg.sender_name,
      timestamp: msg.created_at
    }));
  } catch (error) {
    console.error('❌ Erro ao processar histórico:', error);
    return [];
  }
};

// Função para transcrever áudio usando OpenAI Whisper
const transcribeAudio = async (audioPath) => {
  try {
    console.log('🎵 Iniciando transcrição do áudio:', audioPath);
    
    // Verificar se o arquivo existe
    const fs = await import('fs');
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
    }

    // Criar stream do arquivo
    const audioStream = fs.createReadStream(audioPath);
    
    // Transcrever usando OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "pt", // Português
      response_format: "text"
    });

    console.log('✅ Transcrição concluída:', transcription);
    return transcription;

  } catch (error) {
    console.error('❌ Erro na transcrição:', error);
    throw error;
  }
};

// Função para gerar áudio usando ElevenLabs
const generateAudioResponse = async (text, organizationId, voiceId = null) => {
  try {
    console.log('🔊 Gerando áudio com ElevenLabs...');
    console.log('📝 Texto:', text);
    console.log('🏢 Organization ID:', organizationId);
    console.log('🎤 Voice ID:', voiceId);
    
    if (!organizationId) {
      console.log('❌ Organization ID não fornecido');
      return null;
    }

    // Usar o serviço ElevenLabs que implementamos
    const audioUrl = await gerarAudioElevenLabs(text, organizationId, voiceId);
    
    if (audioUrl) {
      console.log('✅ Áudio gerado com sucesso:', audioUrl);
      return audioUrl;
    } else {
      console.log('❌ Falha na geração de áudio');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erro na geração de áudio:', error);
    return null;
  }
};

// Process message with AI assistant
export const processMessageWithAI = async (
  accountId,
  fromJid,
  messageContent,
  sock,
  message,
  organizationId,
  mediaInfo = {},
  isGroupMessage = false // ✅ NOVO: Flag para mensagens de grupo
) => {
  try {
    console.log(`🤖 [AI PROCESSOR] Processando mensagem com IA...`, {
      fromJid,
      isGroup: isGroupChat(fromJid),
      isGroupMessage,
      content: messageContent ? messageContent.substring(0, 100) + '...' : '(sem texto)'
    });

    // ✅ NOVO: Para grupos, verificar se é menção
    if (isGroupMessage) {
      const myJid = sock.user?.id;
      const isMentioned = isGroupMention(message, myJid);
      
      if (!isMentioned) {
        console.log(`🤖 [AI PROCESSOR] Mensagem de grupo não menciona o bot, ignorando`);
        return false;
      }
      
      console.log(`🤖 [AI PROCESSOR] Mensagem de grupo menciona o bot, processando...`);
    }

    // 1. Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, assistant_id')
      .eq('account_id', accountId)
      .maybeSingle();

    if (accountError || !accountData) {
      console.log('❌ Conta não encontrada:', accountError);
      return false;
    }

    // 2. Carregar configurações de IA da organização
    console.log('🔧 Carregando configurações de IA para organização:', organizationId);
    const aiSettings = await loadAISettings(organizationId);
    
    // Validar se a IA está habilitada
    validateAIEnabled(aiSettings);
    
    // Obter configurações formatadas para processamento
    const processingConfig = getAIProcessingConfig(aiSettings);
    
    console.log('⚙️ Configurações de IA carregadas:', {
      model: processingConfig.model,
      temperature: processingConfig.temperature,
      maxTokens: processingConfig.maxTokens,
      audioEnabled: processingConfig.audio.enabled,
      transcriptionEnabled: processingConfig.audio.transcriptionEnabled,
      synthesisEnabled: processingConfig.audio.synthesisEnabled
    });

    // 3. Detectar se é áudio (verificação será feita após carregar assistente)
    let finalMessageContent = messageContent;
    let isAudioTranscription = false;
    let hasAudioMessage = message && message.message && message.message.audioMessage;

    if (!accountData.assistant_id) {
      console.log('❌ Nenhum assistente vinculado à conta');
      return false;
    }

    // 4. Buscar dados do assistente de IA
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('*')
      .eq('id', accountData.assistant_id)
      .single();

    if (assistantError || !assistant || !assistant.is_active) {
      console.log('❌ Assistente inativo ou não encontrado:', assistantError);
      return false;
    }

    console.log(`✅ Assistente "${assistant.name}" encontrado`);

    // 4.5. 🎯 PROCESSAR ÁUDIO USANDO CONFIGURAÇÕES DO ASSISTENTE
    if (hasAudioMessage) {
      console.log('🎵 Mensagem de áudio detectada');
      
      if (assistant.audio_transcription) {
        console.log('🎤 [ASSISTENTE] Transcrição habilitada - processando áudio...');
        try {
          let audioPath = null;
          
          if (mediaInfo && mediaInfo.localPath) {
            audioPath = mediaInfo.localPath;
            console.log('🎵 Usando localPath do mediaInfo:', audioPath);
          } else {
            console.log('❌ localPath não encontrado no mediaInfo');
            finalMessageContent = "[Áudio não pôde ser transcrito - arquivo não encontrado]";
          }

          if (audioPath) {
            console.log('🎵 Caminho do áudio:', audioPath);
            
            const transcript = await transcribeAudio(audioPath);
            finalMessageContent = transcript;
            isAudioTranscription = true;
            console.log('✅ Transcrição concluída:', transcript);
          } else {
            console.log('❌ Arquivo de áudio não encontrado');
            finalMessageContent = "[Áudio não pôde ser transcrito - arquivo não encontrado]";
          }
        } catch (transcriptionError) {
          console.error('❌ Erro na transcrição:', transcriptionError);
          finalMessageContent = "[Áudio não pôde ser transcrito]";
        }
      } else {
        console.log('❌ [ASSISTENTE] Transcrição desabilitada - ignorando áudio');
        return false;
      }
    }

    // 5. Verificar horário de funcionamento
    if (!checkIfWithinBusinessHours(assistant.business_hours)) {
      console.log(`⏰ Fora do horário de funcionamento do assistente "${assistant.name}"`);
      return false;
    }

    // 6. Buscar histórico da conversa para contexto
    const { data: chatData } = await supabase
      .from('chats')
      .select('id')
      .eq('whatsapp_jid', fromJid)
      .single();

    let conversationHistory = [];
    if (chatData) {
      // 🎯 OTIMIZAÇÃO: Limitar histórico para reduzir tokens
      conversationHistory = await getConversationHistory(chatData.id, 5); // Apenas últimas 5 mensagens
    }

    // 7. Buscar conhecimento base e treinamento do assistente (OTIMIZADO)
    const { data: knowledgeBase } = await supabase
      .from('ai_knowledge_bases')
      .select('content, title, type')
      .eq('assistant_id', assistant.id)
      .eq('is_active', true)
      .limit(3); // 🎯 OTIMIZAÇÃO: Máximo 3 itens de knowledge base

    const { data: trainingData } = await supabase
      .from('ai_training_data')
      .select('question, answer, category')
      .eq('assistant_id', assistant.id)
      .eq('validated', true)
      .limit(5); // 🎯 OTIMIZAÇÃO: Máximo 5 exemplos de treinamento

    console.log(`✅ Assistente "${assistant.name}" ativo e dentro do horário`);

    // 8. Verificar se há menção em grupos (se for grupo)
    const isGroup = isGroupChat(fromJid);
    let shouldRespond = true;

    if (isGroup) {
      // Verificar se há conteúdo antes de processar
      if (!messageContent || typeof messageContent !== 'string') {
        console.log('📱 Mensagem em grupo sem conteúdo de texto - ignorando');
        return false;
      }
      
      shouldRespond = messageContent.toLowerCase().includes('@' + assistant.name.toLowerCase()) ||
                     messageContent.toLowerCase().includes('ia') ||
                     messageContent.toLowerCase().includes('bot');
      
      if (!shouldRespond) {
        console.log('📱 Mensagem em grupo sem menção - ignorando');
        return false;
      }
    }

    // 9. 🎯 OTIMIZAÇÃO: Contexto adaptativo baseado na complexidade da mensagem
    const isSimpleMessage = finalMessageContent.length < 50 && 
                           !finalMessageContent.includes('agendar') && 
                           !finalMessageContent.includes('horário') &&
                           !finalMessageContent.includes('disponível');
    
    const fullContext = {
      assistant,
      conversationHistory: isSimpleMessage ? conversationHistory.slice(-2) : conversationHistory, // Menos histórico para mensagens simples
      knowledgeBase: isSimpleMessage ? [] : (knowledgeBase || []), // Sem knowledge base para mensagens simples
      trainingData: isSimpleMessage ? [] : (trainingData || []),   // Sem training data para mensagens simples
      isGroup,
      currentMessage: finalMessageContent
    };

    console.log(`🎯 [OTIMIZAÇÃO] Mensagem ${isSimpleMessage ? 'simples' : 'complexa'} detectada:`, {
      historico: fullContext.conversationHistory.length,
      knowledge: fullContext.knowledgeBase.length,
      training: fullContext.trainingData.length
    });

    // 10. (Removido: digitando agora é feito após processar a IA)

    // 10. Processar mensagem com IA usando configurações da organização
    const iaConfig = {
      configuracoes: {
        modelo: processingConfig.model,
        temperature: processingConfig.temperature,
        max_tokens: processingConfig.maxTokens
      }
    };

    // Processar com tool calls
    const finalResponse = await processWithToolCalls(
      finalMessageContent, 
      fullContext, 
      conversationHistory, 
      iaConfig, 
      accountData.user_id, 
      organizationId, 
      fromJid
    );

    if (!finalResponse) {
      console.log('❌ Falha ao processar mensagem com ferramentas');
      return false;
    }

    const tokensUsed = finalResponse.tokensUsados || finalResponse.tokensUsed || 100; // Fallback se não conseguir calcular
    const tokenBreakdown = finalResponse.tokenBreakdown || {};

    // 🔍 DEBUG: Verificar se tokenBreakdown está chegando
    console.log('📊 [DEBUG] Token breakdown recebido:', {
      tokensUsados: finalResponse.tokensUsados,
      tokensUsed: finalResponse.tokensUsed,
      tokenBreakdown: tokenBreakdown,
      hasPrompt: tokenBreakdown.prompt ? 'SIM' : 'NÃO',
      hasCompletion: tokenBreakdown.completion ? 'SIM' : 'NÃO'
    });

    // 12. Verificar e deduzir créditos com breakdown detalhado
    const creditsOk = await checkAndDeductCredits(
      accountData.user_id,
      tokensUsed,
      processingConfig.model, // Usar modelo das configurações
      assistant.id,
      chatData?.id,
      organizationId,
      tokenBreakdown, // Passar breakdown para salvar no banco
      isSimpleMessage ? 'simple' : 'complex' // Complexidade da mensagem
    );

    if (!creditsOk) {
      console.log('❌ Créditos insuficientes para processar mensagem');
      // ❌ REMOVER: Não enviar mensagem técnica para cliente final
      // const warningMsg = "⚠️ Créditos insuficientes para usar a IA. Por favor, adquira mais créditos.";
      // if (socket) {
      //   await socket.sendMessage(fromJid, { text: warningMsg });
      // }
      
      // ✅ APENAS LOG - sem mensagem para cliente
      console.log('🔕 Processamento de IA bloqueado por falta de créditos - usuário não será notificado');
      return false;
    }

    // 13. ✅ ENVIAR INDICADOR DE DIGITAÇÃO (após IA processar)
    if (sock) { // Changed from 'socket' to 'sock'
      console.log('⌨️ Enviando indicador de digitação...');
      await sock.sendPresenceUpdate('composing', fromJid); // Changed from 'socket' to 'sock'
      
      // Simular digitação por 2-3 segundos antes de enviar
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 2000));
    }

    // 14. 🎯 CORREÇÃO: Verificar áudio no ASSISTENTE, não nas AI Settings
    let finalResponseText = finalResponse.content;
    if (assistant.audio_synthesis && assistant.audio_provider === 'elevenlabs') {
      console.log('🔊 [ASSISTENTE] Síntese de áudio habilitada - gerando áudio...');
      console.log('🎤 [ASSISTENTE] Voice ID configurado:', assistant.audio_voice);
      console.log('📝 Texto para síntese:', finalResponseText.substring(0, 100) + '...');
      
      try {
        const audioUrl = await generateAudioResponse(finalResponseText, organizationId, assistant.audio_voice);
        if (audioUrl) {
          console.log('✅ Áudio gerado, URL:', audioUrl);
          
          // Converter URL relativa em caminho absoluto
          const audioPath = path.join(__dirname, '..', audioUrl);
          console.log('🎵 Caminho absoluto do áudio:', audioPath);
          
          // Verificar se o arquivo existe
          const fs = await import('fs');
          if (!fs.existsSync(audioPath)) {
            console.error('❌ Arquivo de áudio não encontrado no caminho:', audioPath);
            // Fallback para texto
            // ✅ NOVO: Delay aleatório antes de resposta automática
            const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            // ✅ NOVO: Aplicar rate limiting antes de enviar
            if (accountId) await checkAndApplyRateLimit(accountId);
            await sock.sendMessage(fromJid, { text: finalResponseText }); // Changed from 'socket' to 'sock'
            return true;
          }
          
          // Verificar tamanho do arquivo
          const stats = fs.statSync(audioPath);
          console.log('📊 Tamanho do arquivo de áudio:', (stats.size / 1024).toFixed(2), 'KB');
          
          // Enviar áudio usando a função do multiWhatsapp
          console.log('📤 Enviando áudio via WhatsApp...');
          const audioResult = await sendAudioByAccount(accountId, fromJid, audioPath, 'audio/mpeg');
          
          if (audioResult.success) {
            console.log('🎵 Áudio enviado com sucesso via WhatsApp - ID:', audioResult.messageId);
            
            // Aguardar um pouco para garantir que foi processado
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verificar se a mensagem foi realmente entregue
            console.log('✅ Processamento de áudio concluído com sucesso');
          } else {
            console.error('❌ Erro ao enviar áudio via WhatsApp:', audioResult.error);
            // Fallback para texto
            console.log('📝 Enviando resposta em texto como fallback...');
            // ✅ NOVO: Delay aleatório antes de resposta automática
            const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            // ✅ NOVO: Aplicar rate limiting antes de enviar
            if (accountId) await checkAndApplyRateLimit(accountId);
            await sock.sendMessage(fromJid, { text: finalResponseText }); // Changed from 'socket' to 'sock'
          }
        } else {
          // Fallback para texto se falhar na geração de áudio
          console.log('⚠️ Falha na geração de áudio - enviando texto');
          // ✅ NOVO: Delay aleatório antes de resposta automática
          const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
          await new Promise(resolve => setTimeout(resolve, randomDelay));
          // ✅ NOVO: Aplicar rate limiting antes de enviar
          if (accountId) await checkAndApplyRateLimit(accountId);
          await sock.sendMessage(fromJid, { text: finalResponseText }); // Changed from 'socket' to 'sock'
        }
      } catch (audioError) {
        console.error('❌ Erro na geração de áudio:', audioError);
        // Fallback para texto
        console.log('📝 Enviando resposta em texto como fallback...');
        // ✅ NOVO: Delay aleatório antes de resposta automática
        const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        // ✅ NOVO: Aplicar rate limiting antes de enviar
        if (accountId) await checkAndApplyRateLimit(accountId);
        await sock.sendMessage(fromJid, { text: finalResponseText }); // Changed from 'socket' to 'sock'
      }
    } else {
      // Enviar resposta em texto
      console.log('📝 Enviando resposta em texto (síntese desabilitada)');
      // ✅ NOVO: Delay aleatório antes de resposta automática
      const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 segundos
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      // ✅ NOVO: Aplicar rate limiting antes de enviar
      if (accountId) await checkAndApplyRateLimit(accountId);
      await sock.sendMessage(fromJid, { text: finalResponseText }); // Changed from 'socket' to 'sock'
    }

    // ✅ PARAR INDICADOR DE DIGITAÇÃO
    if (sock) { // Changed from 'socket' to 'sock'
      await sock.sendPresenceUpdate('available', fromJid); // Changed from 'socket' to 'sock'
    }

    console.log(`📤 Resposta da IA enviada: ${finalResponseText.substring(0, 50)}...`);
    console.log(`💰 Tokens utilizados: ${tokensUsed} | Modelo: ${processingConfig.model}`);

    // 14. Salvar resposta da IA no banco de dados
    await saveAIResponse(fromJid, finalResponseText, organizationId, assistant.id, tokensUsed);

    return true;

  } catch (error) {
    console.error(`❌ [AI PROCESSOR] Erro no processamento com IA:`, error);
    
    // Se for erro de configuração desabilitada, não enviar mensagem de erro
    if (error.message.includes('disabled')) {
      console.log('ℹ️ Funcionalidade desabilitada:', error.message);
      return false;
    }
    
    return false;
  }
};

/**
 * Processa mensagem com tool calls
 */
const processWithToolCalls = async (message, context, conversationHistory, iaConfig, userId, organizationId, phoneNumber) => {
  try {
    console.log('🔧 Processando com tool calls...');
    
    let currentMessages = [
      { role: "user", content: message }
    ];

    let maxIterations = 5; // Máximo de 5 iterações para evitar loop infinito
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`🔄 Iteração ${iteration} de processamento com ferramentas`);

      // Gerar resposta da IA (parâmetros corretos: mensagem, treinamento, contexto, iaConfig)
      const aiResponse = await generateAIResponse(currentMessages, context.trainingData || '', conversationHistory, iaConfig);
      
      if (!aiResponse?.respostaIA) {
        console.log('❌ Falha ao gerar resposta da IA');
        return null;
      }

      const response = aiResponse.respostaIA;
      const tokensUsed = aiResponse.tokensUsados || 100;

      // Verificar se há tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`🔧 ${response.tool_calls.length} ferramenta(s) chamada(s)`);
        
        // Executar cada ferramenta
        const toolResults = [];
        for (const toolCall of response.tool_calls) {
          console.log(`🔧 Executando ferramenta: ${toolCall.function.name}`);
          
          const result = await executeTool(toolCall, userId, organizationId, phoneNumber);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolCall.function.name,
            content: JSON.stringify(result)
          });
          
          console.log(`✅ Resultado da ferramenta ${toolCall.function.name}:`, result);
        }

        // Adicionar resposta da IA e resultados das ferramentas ao contexto
        currentMessages.push(response);
        currentMessages.push(...toolResults);

        // Se alguma ferramenta falhou, parar e retornar erro
        const failedTools = toolResults.filter(result => {
          const content = JSON.parse(result.content);
          return !content.success;
        });

        if (failedTools.length > 0) {
          console.log('❌ Algumas ferramentas falharam:', failedTools);
          // Continuar para a IA responder sobre o erro
        }

      } else {
        // Não há tool calls, retornar resposta final
        console.log('✅ Processamento concluído sem ferramentas');
        return {
          content: response.content,
          tokensUsed: tokensUsed,
          tokenBreakdown: aiResponse.tokenBreakdown // ← ADICIONAR BREAKDOWN!
        };
      }
    }

    // Se chegou aqui, houve muitas iterações
    console.log('⚠️ Máximo de iterações atingido');
    return {
      content: "Desculpe, houve um problema no processamento. Tente novamente.",
      tokensUsed: 100
    };

  } catch (error) {
    console.error('❌ Erro no processamento com tool calls:', error);
    
    // 🔕 Não enviar erros técnicos para o cliente final
    return {
      content: "Desculpe, houve um problema no processamento. Tente novamente.",
      tokensUsed: 100
    };
  }
};

// Salvar resposta da IA no banco
const saveAIResponse = async (fromJid, aiResponse, organizationId, assistantId, tokensUsed) => {
  try {
    // Buscar chat COM assigned_agent_id para saber qual usuário deve receber a notificação
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id, assigned_agent_id')
      .eq('whatsapp_jid', fromJid)
      .eq('organization_id', organizationId)
      .single();

    if (chatError) {
      console.error('Erro ao buscar chat para salvar resposta da IA:', chatError);
      return;
    }

    // Inserir mensagem da IA
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatData.id,
        content: aiResponse,
        message_type: 'text',
        is_from_me: true,
        sender_name: 'Assistente IA',
        status: 'sent',
        organization_id: organizationId,
        metadata: {
          ai_generated: true,
          assistant_id: assistantId,
          tokens_used: tokensUsed,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('Erro ao salvar resposta da IA no banco:', messageError);
    } else {
      console.log('💾 Resposta da IA salva no banco de dados');

      // CORREÇÃO: Emitir evento APENAS para o usuário específico do chat
      const io = global.io;
      if (io && chatData.assigned_agent_id) {
        console.log('📡 Emitindo resposta da IA para usuário específico:', chatData.assigned_agent_id);
        
        io.to(`user-${chatData.assigned_agent_id}`).emit('new-message', {
          chatId: chatData.id,
          message: savedMessage,
          fromJid,
          isAI: true,
          userId: chatData.assigned_agent_id // Adicionar userId para segurança
        });
        
        console.log('✅ Resposta da IA emitida com sucesso para usuário específico');
      } else if (!chatData.assigned_agent_id) {
        console.warn('⚠️ Chat sem assigned_agent_id - resposta da IA não será emitida em tempo real');
      }
    }

  } catch (error) {
    console.error('Erro ao salvar resposta da IA:', error);
  }
};
