
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AIAssistant, AISession } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa API do backend

const fetchAssistants = async () => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${apiBase}/api/ai/assistants`, { headers });
  
  if (!response.ok) {
    throw new Error('Erro ao buscar assistentes');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Erro ao buscar assistentes');
  }
  
  // Converter os dados da API para nossa interface AIAssistant
  const convertedData: AIAssistant[] = (data.assistants || []).map((assistant: any) => ({
    ...assistant,
    business_hours: assistant.business_hours as any,
    tags: assistant.tags || null,
    avatar_url: assistant.avatar_url || null,
    description: assistant.description || null,
    personality: assistant.personality || null,
    performance: {
      totalInteractions: 0,
      averageRating: 0,
      responseTime: 0
    }
  }));
  
  return convertedData;
};

export const useAISessions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assistants, isLoading: assistantsLoading } = useQuery({
    queryKey: ['ai_assistants_for_sessions'],
    queryFn: fetchAssistants,
  });

  return {
    sessions: [],
    assistants,
    isLoading: assistantsLoading,
    error: null,
    createSession: async () => {},
    deleteSession: async () => {},
    isCreating: false,
  };
};
