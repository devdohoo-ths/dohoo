
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

interface PlaygroundRequest {
  message: string;
  conversation_history: Array<{role: string; content: string}>;
  assistant?: any;
  settings: {
    temperature: number;
    max_tokens: number;
    model: string;
  };
}

// Function to estimate tokens (approximation)
function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Function to calculate credits needed based on model and tokens
function calculateCredits(model: string, tokens: number): number {
  if (model.includes('gpt-4o')) {
    return Math.ceil(tokens / 50); // GPT-4o costs more
  } else if (model.includes('gpt-3.5')) {
    return Math.ceil(tokens / 100); // GPT-3.5 costs less
  }
  return Math.ceil(tokens / 75); // Default rate for gpt-4o-mini
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Playground request received');
    
    const { message, conversation_history, assistant, settings }: PlaygroundRequest = await req.json();

    console.log('Request data:', { message, assistant: assistant?.name, settings });

    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    if (!message || !message.trim()) {
      throw new Error('Message is required');
    }

    // Prepare messages for OpenAI
    let messages = [...conversation_history];
    
    // Add assistant instructions if provided
    if (assistant) {
      const systemMessage = {
        role: 'system',
        content: `You are ${assistant.name}. ${assistant.instructions || 'You are a helpful AI assistant.'}\n\nPersonality: ${assistant.personality || 'Professional and helpful'}`
      };
      
      // Add knowledge base if available
      if (assistant.knowledge_base && assistant.knowledge_base.length > 0) {
        const knowledge = assistant.knowledge_base.map((kb: any) => 
          `${kb.title}: ${kb.content}`
        ).join('\n\n');
        systemMessage.content += `\n\nKnowledge Base:\n${knowledge}`;
      }
      
      // Add training data if available
      if (assistant.training_data && assistant.training_data.length > 0) {
        const training = assistant.training_data.map((td: any) => 
          `Q: ${td.question}\nA: ${td.answer}`
        ).join('\n\n');
        systemMessage.content += `\n\nTraining Examples:\n${training}`;
      }
      
      messages.unshift(systemMessage);
    }

    // Add the current message
    messages.push({ role: 'user', content: message });

    console.log('Sending to OpenAI with model:', settings.model);

    // Make request to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: messages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.max_tokens || 2000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('OpenAI response received:', data);
    
    const aiResponse = data.choices[0]?.message?.content || 'Erro ao gerar resposta';
    
    // Calculate token usage and credits
    const promptTokens = data.usage?.prompt_tokens || estimateTokens(messages.map(m => m.content).join(' '));
    const completionTokens = data.usage?.completion_tokens || estimateTokens(aiResponse);
    const totalTokens = promptTokens + completionTokens;
    const creditsUsed = calculateCredits(settings.model || 'gpt-4o-mini', totalTokens);

    console.log('Usage stats:', { promptTokens, completionTokens, totalTokens, creditsUsed });

    // TODO: Deduct credits from user account
    // This should be implemented when you have user authentication in the edge function

    return new Response(
      JSON.stringify({
        response: aiResponse,
        tokens_used: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        credits_used: creditsUsed,
        model_used: settings.model || 'gpt-4o-mini',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in AI playground:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
