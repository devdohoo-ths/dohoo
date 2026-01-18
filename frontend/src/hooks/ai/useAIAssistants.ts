import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AIAssistant } from '@/types';
import { useToast } from "@/components/ui/use-toast";
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';

const fetchAssistants = async () => {
  try {
    // ✅ CORRIGIDO: Adicionar await
    const headers = await getAuthHeaders();
    console.log('🔧 Headers para buscar assistentes:', headers);
    
    const res = await fetch(`${apiBase}/api/ai/assistants`, {
      headers
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Erro na requisição:', res.status, errorText);
      throw new Error(`Erro ao buscar assistentes: ${res.status} - ${errorText}`);
    }
    
    const data = await res.json();
    console.log('✅ Dados recebidos:', data?.length || 0, 'assistentes');
    
    // Log da estrutura do primeiro assistente para debug
    if (data && data.length > 0) {
      console.log('🔍 Estrutura do primeiro assistente:', data[0]);
      console.log('🔍 ID do primeiro assistente:', data[0].id);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Erro inesperado no fetchAssistants:', error);
    throw error;
  }
};

const createAssistant = async (assistant: Omit<AIAssistant, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'avatar_url' | 'performance'> & { is_organizational: boolean }) => {
  // ✅ CORRIGIDO: Adicionar await
  const headers = await getAuthHeaders();
  console.log("Headers para criar assistente:", headers);
  const res = await fetch(`${apiBase}/api/ai/assistants`, {
    method: 'POST',
    headers,
    body: JSON.stringify(assistant),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro ao criar assistente: ${res.status} - ${errorText}`);
  }

  return res.json();
};

const updateAssistant = async (assistant: Partial<AIAssistant> & { id: string; is_organizational?: boolean }) => {
  // ✅ CORRIGIDO: Adicionar await
  const headers = await getAuthHeaders();
  const { id, ...updateData } = assistant;
  const res = await fetch(`${apiBase}/api/ai/assistants/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updateData),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro ao atualizar assistente: ${res.status} - ${errorText}`);
  }

  return res.json();
};

const deleteAssistant = async (assistantId: string) => {
  const headers = await getAuthHeaders();

  const res = await fetch(`${apiBase}/api/ai/assistants/${assistantId}`, {
    method: 'DELETE',
    headers
  });

  if (!res.ok) {
    let errorMessage = 'Erro ao deletar assistente';
    
    try {
      const errorData = await res.json();
      // Extrair mensagem de erro do backend se disponível
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Se não conseguir fazer parse do JSON, usar texto da resposta
      const errorText = await res.text();
      if (errorText) {
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
      }
    }
    
    // Criar erro com mensagem amigável
    const error = new Error(errorMessage);
    // Adicionar código de status para tratamento específico
    (error as any).status = res.status;
    (error as any).code = res.status === 400 ? 'HAS_USAGE_HISTORY' : 'DELETE_ERROR';
    throw error;
  }

  // Verificar se a resposta tem conteúdo antes de fazer parse
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    // Se tiver conteúdo JSON, fazer parse
    const text = await res.text();
    if (text) {
      return JSON.parse(text);
    }
  }
  
  // Se for 204 No Content ou resposta vazia, retornar sucesso
  return { success: true, message: 'Assistente deletado com sucesso' };
};

export const useAIAssistants = () => {
  const { data: assistants = [], isLoading, error } = useQuery({
    queryKey: ['assistants'],
    queryFn: fetchAssistants,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: createAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
      toast({
        title: "Assistente criado",
        description: "Assistente criado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
      toast({
        title: "Assistente atualizado",
        description: "Assistente atualizado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
      toast({
        title: "Assistente deletado",
        description: "Assistente deletado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    assistants,
    isLoading,
    error,
    createAssistant: createMutation.mutate,
    updateAssistant: updateMutation.mutate,
    deleteAssistant: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};