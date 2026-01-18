
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export const useAIChat = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendAIMessage = useCallback(async (
    assistantId: string,
    message: string,
    chatId?: string
  ) => {
    try {
      setLoading(true);
      console.log('🤖 Enviando mensagem para IA:', { assistantId, message, chatId });

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/process`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          assistantId,
          chatId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na API:', errorText);
        throw new Error(`Failed to process AI message: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Resposta da IA recebida:', data);
      return data;

    } catch (error) {
      console.error('❌ Erro ao enviar mensagem para IA:', error);
      toast({
        title: "Erro na IA",
        description: "Falha ao processar mensagem com assistente",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    sendAIMessage,
    loading
  };
};
