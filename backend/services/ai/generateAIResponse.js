const OpenAIModulePromise = import("openai");
const calculateTokensPromise = import("./calculateTokens.js");
const toolsPromise = import("./toolsService.js");


export const generateAIResponse = async (mensagem, treinamento, contexto = [], iaConfig = { configuracoes: {} }) => {
  const { default: OpenAI } = await OpenAIModulePromise;
  const { calculateTokens } = await calculateTokensPromise;
  const { tools } = await toolsPromise;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const contextoFormater = contexto
    .map(item => {
      // Garante que o item existe e tem conteúdo
      if (!item || !item.content || !item.role) return null;

      // Verifica se o role é válido
      if (item.role !== 'user' && item.role !== 'assistant') return null;

      return {
        role: item.role,
        content: item.content.trim()
      };
    })
    .filter(item => item && item.role && item.content); // Remove nulos, undefineds, strings vazias

  const treinamentoContent =
    typeof treinamento === 'object'
      ? (treinamento.instructions || JSON.stringify(treinamento))
      : treinamento;

  const input = [
    { role: "system", content: treinamentoContent },
    ...contextoFormater,
  ];



  if (typeof mensagem === "string") {
    // mensagem é um texto simples
    input.push({ role: "user", content: mensagem });
  } else if (Array.isArray(mensagem)) {
    // mensagem é um array de mensagens já formatadas (ex: tool call + tool + user)
    input.push(...mensagem);
  } else {
    console.warn("🚨 Tipo de mensagem inesperado:", mensagem);
  }

  // 🔍 ANÁLISE DETALHADA DE TOKENS POR COMPONENTE
  const systemTokens = await calculateTokens([{ role: "system", content: treinamentoContent }]);
  const contextTokens = await calculateTokens(contextoFormater);
  const userTokens = await calculateTokens([input[input.length - 1]]); // Última mensagem do usuário
  const tokensEstimados = await calculateTokens(input);

  // 🎯 OTIMIZAÇÃO: Tools condicionais baseadas no contexto da mensagem
  const messageText = typeof mensagem === "string" ? mensagem : 
                     Array.isArray(mensagem) ? mensagem[mensagem.length-1]?.content || "" : "";
  
  const needsTools = messageText.includes('agendar') || 
                    messageText.includes('horário') || 
                    messageText.includes('disponível') ||
                    messageText.includes('cancelar') ||
                    messageText.includes('reagendar') ||
                    messageText.includes('atendente');

  const toolsToUse = needsTools ? tools : [];

  const completionParams = {
    model: iaConfig.configuracoes?.modelo || "gpt-4o-mini",
    messages: input,
    temperature: parseFloat(iaConfig.configuracoes?.temperature || 0.7),
    max_tokens: parseInt(iaConfig.configuracoes?.max_tokens || 1000)
  };

  // Adicionar tools apenas se necessário
  if (needsTools) {
    completionParams.tools = toolsToUse;
    completionParams.tool_choice = "auto";
  }

  const completion = await openai.chat.completions.create(completionParams);

  const role = completion.choices[0].message.role;
  const respostaIA = completion.choices[0].message;

  const tokensUsados = completion.usage.total_tokens;


  // 📊 Retornar breakdown detalhado para relatórios
  return { 
    respostaIA, 
    role, 
    tokensUsados,
    tokenBreakdown: {
      total: completion.usage.total_tokens,
      prompt: completion.usage.prompt_tokens,
      completion: completion.usage.completion_tokens,
      system: systemTokens || 0,
      context: contextTokens || 0,
      userMessage: userTokens || 0,
      toolsEnabled: needsTools,
      estimatedTotal: tokensEstimados
    }
  };
}

