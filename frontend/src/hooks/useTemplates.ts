import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

interface Template {
  id: string;
  nome: string;
  conteudo: string;
  variaveis: string[];
  media_files?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    path: string;
  }>;
  aprovado: boolean;
  criado_em: string;
  atualizado_em: string;
  criado_por_profile: {
    id: string;
    name: string;
    email: string;
  };
}

interface CreateTemplateData {
  nome: string;
  conteudo: string;
  variaveis?: string[];
  media_files?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    path: string;
  }>;
}

interface UpdateTemplateData {
  nome?: string;
  conteudo?: string;
  aprovado?: boolean;
}

export function useTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar templates
  const {
    data: templates,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['templates', user?.organization_id],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/templates`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar templates');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!user?.token,
    staleTime: 30000, // 30 segundos
  });

  // Buscar apenas templates aprovados
  const {
    data: templatesAprovados,
    isLoading: isLoadingAprovados,
  } = useQuery({
    queryKey: ['templates-aprovados', user?.organization_id],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/templates?aprovado=true`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar templates aprovados');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!user?.token,
    staleTime: 30000,
  });

  // Criar template
  const createTemplate = useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      if (!user?.token) {
        console.error('❌ Token não encontrado:', { user, token: user?.token });
        throw new Error('Token não encontrado. Faça login novamente.');
      }

      console.log('🔍 Criando template com token:', user.token.substring(0, 20) + '...');

      const response = await fetch(`${API_BASE}/api/campanhas/templates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Atualizar template
  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTemplateData }) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });


  // Deletar template
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deletado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    templates,
    templatesAprovados,
    isLoading,
    isLoadingAprovados,
    error,
    refetch,
    criarTemplate: createTemplate.mutateAsync,
    atualizarTemplate: updateTemplate.mutateAsync,
    deletarTemplate: deleteTemplate.mutateAsync,
    isCreating: createTemplate.isPending,
    isUpdating: updateTemplate.isPending,
    isDeleting: deleteTemplate.isPending,
  };
}

// Hook para buscar um template específico
export function useTemplate(templateId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/templates/${templateId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar template');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!user?.token && !!templateId,
  });
}

// Hook para validar template com IA
export function useValidarTemplate() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conteudo: string) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/templates/validar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conteudo }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao validar template');
      }

      return response.json();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Hook para sugerir melhorias no template
export function useSugerirMelhorias() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ conteudo, estatisticas }: { conteudo: string; estatisticas?: any }) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/templates/sugerir-melhorias`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conteudo, estatisticas }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar sugestões');
      }

      return response.json();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
