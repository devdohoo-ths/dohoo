import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

interface DashboardStats {
  total_campanhas: number;
  campanhas_ativas: number;
  total_mensagens_enviadas: number;
  total_respostas: number;
  taxa_resposta_media: number;
  campanhas_com_ia: number;
  campanhas_por_status: Array<{
    name: string;
    value: number;
  }>;
}

interface CampanhaRecente {
  id: string;
  nome: string;
  status: string;
  total_destinatarios: number;
  enviados: number;
  respondidos: number;
  usar_ia: boolean;
}

interface PerformanceDia {
  data: string;
  enviados: number;
  respostas: number;
}

interface SentimentoDistribuicao {
  sentimento: string;
  quantidade: number;
}

export function useCampanhasDashboard() {
  const { user } = useAuth();

  // Buscar estatísticas gerais
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: errorStats
  } = useQuery({
    queryKey: ['campanhas-dashboard-stats', user?.organization_id],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas');
      }

      const result = await response.json();
      return result.data as DashboardStats;
    },
    enabled: !!user?.token,
    staleTime: 60000, // 1 minuto
  });

  // Buscar campanhas recentes
  const {
    data: campanhasRecentes,
    isLoading: isLoadingRecentes,
  } = useQuery({
    queryKey: ['campanhas-recentes', user?.organization_id],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas?limit=5&status=em_execucao,finalizada`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar campanhas recentes');
      }

      const result = await response.json();
      return result.data as CampanhaRecente[];
    },
    enabled: !!user?.token,
    staleTime: 30000, // 30 segundos
  });

  // Buscar performance por dia (últimos 7 dias)
  const {
    data: performancePorDia,
    isLoading: isLoadingPerformance,
  } = useQuery({
    queryKey: ['campanhas-performance-dia', user?.organization_id],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/dashboard/performance-diaria`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar performance diária');
      }

      const result = await response.json();
      return result.data as PerformanceDia[];
    },
    enabled: !!user?.token,
    staleTime: 300000, // 5 minutos
  });

  // Buscar distribuição de sentimentos
  const {
    data: sentimentosDistribuicao,
    isLoading: isLoadingSentimentos,
  } = useQuery({
    queryKey: ['campanhas-sentimentos', user?.organization_id],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/dashboard/sentimentos`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar análise de sentimentos');
      }

      const result = await response.json();
      return result.data as SentimentoDistribuicao[];
    },
    enabled: !!user?.token,
    staleTime: 300000, // 5 minutos
  });

  return {
    stats,
    campanhasRecentes,
    performancePorDia,
    sentimentosDistribuicao,
    isLoading: isLoadingStats || isLoadingRecentes || isLoadingPerformance || isLoadingSentimentos,
    error: errorStats,
  };
}

// Hook para métricas em tempo real
export function useCampanhasRealtime() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campanhas-realtime', user?.organization_id],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE}/api/campanhas/dashboard/realtime`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar dados em tempo real');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!user?.token,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
    staleTime: 0, // Sempre considerar dados como stale para refetch
  });
}

// Hook para comparar performance entre períodos
export function useCompararPerformance(periodo1: string, periodo2: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campanhas-comparacao', user?.organization_id, periodo1, periodo2],
    queryFn: async () => {
      if (!user?.token) throw new Error('Token não encontrado');

      const response = await fetch(
        `${API_BASE}/api/campanhas/dashboard/comparar?periodo1=${periodo1}&periodo2=${periodo2}`,
        {
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao comparar performance');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!user?.token && !!periodo1 && !!periodo2,
    staleTime: 300000, // 5 minutos
  });
}
