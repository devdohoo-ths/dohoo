import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrainingData } from '@/types';
import { useToast } from "@/components/ui/use-toast";
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders

const fetchTrainingData = async (assistantId: string) => {
  console.log('🤖 Buscando dados de treinamento via API para assistente:', assistantId);
  
  // ✅ CORRIGIDO: Usar getAuthHeaders()
  const headers = await getAuthHeaders();
  const response = await fetch(`${apiBase}/api/ai-training-data/${assistantId}`, {
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar dados de treinamento: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Erro ao buscar dados de treinamento');
  }

  console.log(`✅ ${result.trainingData?.length || 0} dados de treinamento carregados`);
  return result.trainingData as TrainingData[];
};

const addTrainingData = async (trainingData: Omit<TrainingData, 'id' | 'created_at' | 'updated_at' | 'validated'>) => {
  console.log('🤖 Criando novo dado de treinamento via API...');
  
  // ✅ CORRIGIDO: Usar getAuthHeaders()
  const headers = await getAuthHeaders();
  const response = await fetch(`${apiBase}/api/ai-training-data`, {
    method: 'POST',
    headers,
    body: JSON.stringify(trainingData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao criar dado de treinamento: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Erro ao criar dado de treinamento');
  }

  return result.trainingData;
};

const updateTrainingData = async (trainingData: Partial<TrainingData> & { id: string }) => {
  const { id, assistant_id, ...updateData } = trainingData;
  
  if (!assistant_id) {
    throw new Error('assistant_id é obrigatório para atualizar dados de treinamento');
  }
  
  console.log('🤖 Atualizando dado de treinamento via API...');
  
  // ✅ CORRIGIDO: Usar getAuthHeaders()
  const headers = await getAuthHeaders();
  const response = await fetch(`${apiBase}/api/ai-training-data/${assistant_id}/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updateData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao atualizar dado de treinamento: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Erro ao atualizar dado de treinamento');
  }

  return result.trainingData;
};

const deleteTrainingData = async (assistantId: string, id: string) => {
  console.log('🤖 Deletando dado de treinamento via API...');
  
  // ✅ CORRIGIDO: Usar getAuthHeaders()
  const headers = await getAuthHeaders();
  const response = await fetch(`${apiBase}/api/ai-training-data/${assistantId}/${id}`, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao deletar dado de treinamento: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Erro ao deletar dado de treinamento');
  }
};

export const useAITraining = (assistantId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const queryKey = ['ai_training_data', assistantId];

  const { data: trainingData, isLoading: isLoadingTraining } = useQuery<TrainingData[]>({
    queryKey,
    queryFn: () => fetchTrainingData(assistantId),
    enabled: !!assistantId,
  });

  const addMutation = useMutation({
    mutationFn: addTrainingData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Sucesso', description: 'Dado de treinamento adicionado.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateTrainingData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Sucesso', description: 'Dado de treinamento atualizado.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteTrainingData(assistantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Sucesso', description: 'Dado de treinamento excluído.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  });

  return {
    trainingData,
    isLoadingTraining,
    addTrainingData: addMutation.mutateAsync,
    updateTrainingData: updateMutation.mutateAsync,
    deleteTrainingData: deleteMutation.mutateAsync,
  };
};