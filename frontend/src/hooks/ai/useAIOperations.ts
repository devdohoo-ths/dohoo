
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AIAssistant } from '@/types';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa API do backend

export const useAIOperations = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const processMessage = useCallback(async (
    assistantId: string,
    message: string,
    chatId: string,
    fromJid: string
  ) => {
    try {
      setProcessing(true);
      console.log('🤖 Processando mensagem com IA:', { assistantId, chatId, fromJid });

      // ✅ MIGRADO: Processar mensagem via API do backend
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/process`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          assistantId,
          chatId,
          fromJid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao processar mensagem com IA:', errorData.error);
        return null;
      }

      const data = await response.json();

      if (!data.success) {
        console.error('Erro na resposta da API:', data.error);
        return null;
      }

      console.log('✅ Resposta da IA processada:', data);
      return data.response;

    } catch (error) {
      console.error('❌ Erro ao processar mensagem com IA:', error);
      toast({
        title: "Erro na IA",
        description: "Falha ao processar mensagem com assistente",
        variant: "destructive",
      });
      return null;
    } finally {
      setProcessing(false);
    }
  }, [toast]);

  const checkBusinessHours = (businessHours: any) => {
    if (!businessHours) return true;

    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    
    const todayHours = businessHours[dayOfWeek];
    if (!todayHours || !todayHours.enabled) return false;

    const [startHour, startMinute] = todayHours.start.split(':').map(Number);
    const [endHour, endMinute] = todayHours.end.split(':').map(Number);

    const startTime = new Date();
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date();
    endTime.setHours(endHour, endMinute, 0, 0);

    return now >= startTime && now <= endTime;
  };

  return {
    processMessage,
    processing,
    checkBusinessHours
  };
};
