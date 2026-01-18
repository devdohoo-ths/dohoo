import { useState } from 'react';
import { AISettings } from '@/types/ai';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

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

interface AIResponse {
  response: string;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  credits_used: number;
  model_used: string;
  timestamp: string;
}

export function useAIBackend(useLocalBackend: boolean = true) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processMessage = async (request: AIRequest): Promise<AIResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("enviando mensagem para o backend...")
      console.log("request", request)
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/process`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    processMessage,
    isLoading,
    error
  };
} 