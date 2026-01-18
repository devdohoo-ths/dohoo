import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

interface Campanha {
  id: string;
  nome: string;
  status: 'rascunho' | 'em_execucao' | 'finalizada' | 'erro' | 'pausada';
  total_destinatarios: number;
  enviados: number;
  respondidos: number;
  usar_ia: boolean;
  data_inicio: string;
  data_fim?: string;
  criado_em: string;
  template: {
    id: string;
    nome: string;
    conteudo: string;
  };
  created_by_profile: {
    id: string;
    name: string;
    email: string;
  };
}

interface CreateCampanhaData {
  nome: string;
  template_id?: string | null;
  contatos: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
  usuarios_remetentes: string[];
  usar_ia?: boolean;
  data_inicio?: string;
  configuracoes?: Record<string, any>;
  message_content?: string;
  media_files?: Array<{
    id: string;
    type: string;
    name: string;
    size: number;
  }>;
}

export function useCampanhas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar campanhas
  const {
    data: campanhas,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['campanhas', user?.organization_id],
    queryFn: async () => {
      console.log('🔍 useCampanhas - Iniciando busca:', {
        user: user?.name,
        organizationId: user?.organization_id,
        hasToken: !!user?.token
      });

      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 useCampanhas - Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ useCampanhas - Erro na resposta:', errorText);
        throw new Error('Erro ao buscar campanhas');
      }

      const result = await response.json();
      console.log('🔍 useCampanhas - Resultado:', {
        success: result.success,
        dataLength: result.data?.length,
        data: result.data
      });
      
      return result.data;
    },
    enabled: !!user?.token,
    staleTime: 30000, // 30 segundos
  });

  // Criar campanha
  const createCampanha = useMutation({
    mutationFn: async (data: CreateCampanhaData) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar campanha');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Iniciar campanha
  const iniciarCampanha = useMutation({
    mutationFn: async (campanhaId: string) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao iniciar campanha');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha iniciada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Pausar campanha
  const pausarCampanha = useMutation({
    mutationFn: async (campanhaId: string) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao pausar campanha');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha pausada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Retomar campanha
  const retomarCampanha = useMutation({
    mutationFn: async (campanhaId: string) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao retomar campanha');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha retomada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reiniciar campanha (resetar e reenfileirar)
  const reiniciarCampanha = useMutation({
    mutationFn: async (campanhaId: string) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}/restart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao reiniciar campanha');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha reiniciada e reenviada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Deletar campanha
  const deletarCampanha = useMutation({
    mutationFn: async (campanhaId: string) => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar campanha');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      toast.success('Campanha deletada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    campanhas,
    isLoading,
    error,
    refetch,
    criarCampanha: createCampanha.mutateAsync,
    iniciarCampanha: iniciarCampanha.mutateAsync,
    pausarCampanha: pausarCampanha.mutateAsync,
    retomarCampanha: retomarCampanha.mutateAsync,
    deletarCampanha: deletarCampanha.mutateAsync,
    reiniciarCampanha: reiniciarCampanha.mutateAsync,
    isCreating: createCampanha.isPending,
    isStarting: iniciarCampanha.isPending,
    isPausing: pausarCampanha.isPending,
    isResuming: retomarCampanha.isPending,
    isDeleting: deletarCampanha.isPending,
    isRestarting: reiniciarCampanha.isPending,
  };
}

// Hook para buscar detalhes de uma campanha específica
export function useCampanha(campanhaId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campanha', campanhaId],
    queryFn: async () => {
      // ✅ CORREÇÃO: Usar getAuthHeaders que funciona mesmo sem user.token
      const { getAuthHeaders } = await import('@/utils/apiBase');
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}`, {
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [useCampanha] Erro na resposta:', response.status, errorText);
        throw new Error('Erro ao buscar campanha');
      }

      const result = await response.json();
      
      // ✅ DEBUG: Log dos dados recebidos
      console.log('📊 [useCampanha] Dados recebidos:', {
        campanha_id: campanhaId,
        enviados: result.data?.enviados,
        respondidos: result.data?.respondidos,
        taxa_resposta: result.data?.taxa_resposta
      });
      
      return result.data;
    },
    enabled: !!campanhaId,
  });
}

// Hook para buscar contatos de uma campanha
export function useCampanhaContatos(campanhaId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campanha-contatos', campanhaId],
    queryFn: async () => {
      // ✅ CORREÇÃO: Usar getAuthHeaders que funciona mesmo sem user.token
      const { getAuthHeaders } = await import('@/utils/apiBase');
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}/contatos`, {
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [useCampanhaContatos] Erro na resposta:', response.status, errorText);
        throw new Error('Erro ao buscar contatos da campanha');
      }

      const result = await response.json();
      
      // ✅ DEBUG: Log dos dados recebidos
      console.log('📊 [useCampanhaContatos] Dados recebidos:', {
        campanha_id: campanhaId,
        total_contatos: result.data?.length || 0,
        primeiro_contato: result.data?.[0] ? {
          name: result.data[0].contato?.name,
          phone: result.data[0].contato?.phone,
          status: result.data[0].status
        } : null
      });
      
      return result.data;
    },
    enabled: !!campanhaId,
  });
}

// Hook para buscar relatório de uma campanha
export function useCampanhaRelatorio(campanhaId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campanha-relatorio', campanhaId],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/${campanhaId}/relatorio`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar relatório da campanha');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!user?.token && !!campanhaId,
  });
}
