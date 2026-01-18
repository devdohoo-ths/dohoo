import { AISettings } from '@/types/ai';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface AIResponse {
  response: string;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  credits_used: number;
  model_used: string;
  timestamp: string;
}

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

export class AIService {
  private static instance: AIService;
  private useLocalBackend: boolean = false;

  private constructor() {
    // Inicializa com a configuração do localStorage ou padrão
    this.useLocalBackend = localStorage.getItem('useLocalBackend') === 'true';
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public setUseLocalBackend(useLocal: boolean) {
    this.useLocalBackend = useLocal;
    localStorage.setItem('useLocalBackend', useLocal.toString());
  }

  public getUseLocalBackend(): boolean {
    return this.useLocalBackend;
  }

  public async processMessage(request: AIRequest): Promise<AIResponse> {
    return this.processWithBackend(request);
  }

  private async processWithBackend(request: AIRequest): Promise<AIResponse> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/process`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend Error: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error processing with backend:', error);
      throw error;
    }
  }
}

export const aiService = AIService.getInstance(); 