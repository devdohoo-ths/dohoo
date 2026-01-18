import { AISettings } from '@/types/ai';
import { Configuration, OpenAIApi } from 'openai';

interface AIRequest {
  message: string;
  conversation_history: any[];
  assistant?: {
    name: string;
    instructions?: string;
    personality?: string;
    knowledge_base?: Array<{ title: string; content: string }>;
    training_data?: Array<{ question: string; answer: string }>;
  };
  settings: AISettings;
}

// Função para estimar tokens (aproximação)
function estimateTokens(text: string): number {
  // Aproximação grosseira: 1 token ≈ 4 caracteres para texto em inglês
  return Math.ceil(text.length / 4);
}

// Função para calcular créditos necessários com base no modelo e tokens
function calculateCredits(model: string, tokens: number): number {
  if (model.includes('gpt-4')) {
    return Math.ceil(tokens / 50); // GPT-4 custa mais
  } else if (model.includes('gpt-3.5')) {
    return Math.ceil(tokens / 100); // GPT-3.5 custa menos
  }
  return Math.ceil(tokens / 75); // Taxa padrão para outros modelos
}

export async function processAIRequest(request: AIRequest) {
  const { message, conversation_history, assistant, settings } = request;
  const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Configurar OpenAI
  const configuration = new Configuration({
    apiKey: openaiApiKey,
  });
  const openai = new OpenAIApi(configuration);

  // Preparar mensagens para OpenAI
  let messages = [...conversation_history];

  // Adicionar instruções do assistente se fornecidas
  if (assistant) {
    const systemMessage = {
      role: 'system',
      content: `You are ${assistant.name}. ${assistant.instructions || 'You are a helpful AI assistant.'}\n\nPersonality: ${assistant.personality || 'Professional and helpful'}`
    };

    // Adicionar base de conhecimento se disponível
    if (assistant.knowledge_base && assistant.knowledge_base.length > 0) {
      const knowledge = assistant.knowledge_base.map((kb) => `${kb.title}: ${kb.content}`).join('\n\n');
      systemMessage.content += `\n\nKnowledge Base:\n${knowledge}`;
    }

    // Adicionar dados de treinamento se disponíveis
    if (assistant.training_data && assistant.training_data.length > 0) {
      const training = assistant.training_data.map((td) => `Q: ${td.question}\nA: ${td.answer}`).join('\n\n');
      systemMessage.content += `\n\nTraining Examples:\n${training}`;
    }

    messages.unshift(systemMessage);
  }

  // Adicionar a mensagem atual
  messages.push({
    role: 'user',
    content: message
  });

  try {
    // Fazer requisição para OpenAI
    const response = await openai.createChatCompletion({
      model: settings.model || 'gpt-4',
      messages: messages,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.max_tokens || 2000,
    });

    const aiResponse = response.data.choices[0]?.message?.content || 'Erro ao gerar resposta';

    // Calcular uso de tokens e créditos
    const promptTokens = response.data.usage?.prompt_tokens || estimateTokens(messages.map((m) => m.content).join(' '));
    const completionTokens = response.data.usage?.completion_tokens || estimateTokens(aiResponse);
    const totalTokens = promptTokens + completionTokens;
    const creditsUsed = calculateCredits(settings.model || 'gpt-4', totalTokens);

    return {
      response: aiResponse,
      tokens_used: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      credits_used: creditsUsed,
      model_used: settings.model || 'gpt-4',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in AI processing:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
} 