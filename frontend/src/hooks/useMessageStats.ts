import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { useOrganization } from '@/hooks/useOrganization';

interface MessageStats {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  messagesByType: Record<string, number>;
  messagesByStatus: Array<{ status: string; count: number }>;
  messagesByDepartment: Array<{ department: string; count: number }>;
  messagesByDate: Array<{ date: string; count: number }>;
  topUsers: Array<{
    userId: string;
    userName: string;
    totalMessages: number;
    sentMessages: number;
    receivedMessages: number;
  }>;
  departments: string[];
  messageTypes: string[];
  messageStatuses: string[];
}

interface MessageStatsResponse {
  success: boolean;
  data: {
    stats: any[];
    totalStats: MessageStats;
    filters: {
      dateStart: string;
      dateEnd: string;
      userId: string;
      teamId: string;
      department: string;
      messageType: string;
      status: string;
      limit: number;
      organizationId: string;
    };
    permissions: {
      canViewAllUsers: boolean;
      canViewAllTeams: boolean;
      userRole: string;
    };
    searchScope: string;
    summary: {
      totalUsers: number;
      totalMessages: number;
      dateRange: {
        start: string;
        end: string;
      };
      departments: string[];
      messageTypes: string[];
      messageStatuses: string[];
      searchType: string;
    };
  };
}

export function useMessageStats() {
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { organization } = useOrganization();

  const fetchMessageStats = async (params: {
    dateStart: string;
    dateEnd: string;
    userId?: string;
    department?: string;
    messageType?: string;
    status?: string;
    limit?: number;
  }) => {
    if (!organization?.id) {
      setError('Organização não encontrada');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 🎯 USAR API DO RELATÓRIO DE ATENDIMENTO EM VEZ DA API DE MENSAGENS
      const queryParams = new URLSearchParams({
        dateStart: params.dateStart,
        dateEnd: params.dateEnd,
      });

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/reports/attendance?${queryParams}`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar estatísticas de mensagens');
      }

      const data = await response.json();
      
      if (data.success && data.stats && data.agents) {
        // Transformar dados do relatório de atendimento para o formato esperado
        const agents = data.agents;
        
        // Calcular métricas totais baseadas nos dados dos agentes
        const totalMessages = agents.reduce((sum: number, agent: any) => 
          sum + (agent.messagesSent || 0) + (agent.contactsReceived || 0), 0
        );
        
        const sentMessages = agents.reduce((sum: number, agent: any) => 
          sum + (agent.messagesSent || 0), 0
        );
        
        const receivedMessages = agents.reduce((sum: number, agent: any) => 
          sum + (agent.contactsReceived || 0), 0
        );
        
        // Calcular tempo médio de resposta
        const avgResponseTime = agents.length > 0 ? 
          Math.round(agents.reduce((sum: number, agent: any) => sum + (agent.averageResponseTime || 0), 0) / agents.length) : 0;
        
        // Transformar para o formato esperado
        const transformedStats: MessageStats = {
          totalMessages,
          sentMessages,
          receivedMessages,
          messagesByType: {},
          messagesByStatus: [],
          messagesByDepartment: [],
          messagesByDate: [],
          topUsers: agents.slice(0, 5).map((agent: any) => ({
            userId: agent.id,
            userName: agent.name,
            totalMessages: (agent.messagesSent || 0) + (agent.contactsReceived || 0),
            sentMessages: agent.messagesSent || 0,
            receivedMessages: agent.contactsReceived || 0,
          })),
          departments: [...new Set(agents.map((agent: any) => agent.department).filter(Boolean))] as string[],
          messageTypes: [],
          messageStatuses: [],
        };
        
        setStats(transformedStats);
        
        console.log('[useMessageStats] Dados carregados do relatório de atendimento:', {
          totalMessages,
          sentMessages,
          receivedMessages,
          agents: agents.length
        });
      } else {
        throw new Error('Erro na resposta da API');
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas de mensagens:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    error,
    fetchMessageStats,
  };
} 