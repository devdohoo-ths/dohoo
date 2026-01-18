import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa apenas API do backend
import { useOrganization } from '@/hooks/useOrganization';

export interface AttendanceAgent {
  id: string;
  name: string;
  avatar?: string;
  department: string;
  status: 'online' | 'offline';
  role: string;
  
  // Métricas reais do banco
  totalChats: number;
  resolvedChats: number;
  pendingChats: number;
  averageResponseTime: number; // em segundos
  averageResolutionTime: number; // em segundos
  resolutionRate: number; // 0-100
  
  // Métricas de mensagens reais
  messagesSent: number;
  messagesReceived: number;
  bestResponseTime: number; // em segundos
  
  // Novas métricas solicitadas
  activeContacts: number; // contatos ativos (últimos 7 dias)
  newContacts: number; // novos contatos no período
  
  // Estatísticas detalhadas reais
  peakHours: Array<{ hour: number; count: number }>;
  dailyStats: Array<{ date: string; chats: number; resolved: number }>;
  channelPerformance: Record<string, { total: number; resolved: number; avgTime: number }>;
}

export interface AttendanceStats {
  totalChats: number;
  totalResolved: number;
  totalPending: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  totalActiveContacts: number;
  totalNewContacts: number;
  averageBestResponseTime: number;
  overallSatisfaction: number;
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  peakHours: Array<{ hour: number; count: number }>;
  dailyTrend: Array<{ date: string; chats: number; resolved: number }>;
  channelDistribution: Record<string, { total: number; resolved: number; avgTime: number }>;
  departmentPerformance: Record<string, { total: number; resolved: number; avgSatisfaction: number; agents: number }>;
  satisfactionTrend: Array<{ date: string; satisfaction: number }>;
  topPerformers: AttendanceAgent[];
  needsAttention: AttendanceAgent[];
  kpis: {
    slaCompliance: number;
    firstResponseSla: number;
    resolutionSla: number;
    customerRetention: number;
    agentUtilization: number;
  };
}

export interface AttendanceFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  agents?: string[];
  departments?: string[];
  channels?: string[];
  status?: string[];
}

export const useAttendanceReports = () => {
  const [agents, setAgents] = useState<AttendanceAgent[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { organization } = useOrganization();
  
  // Debug detalhado da organização
  console.log('🔍 [useAttendanceReports] Hook iniciado, organização:', {
    organization,
    organizationId: organization?.id,
    hasOrganization: !!organization
  });
  const [filters, setFilters] = useState<AttendanceFilters>({
    dateRange: {
      start: new Date(), // Alterado: apenas o dia atual
      end: new Date()    // Alterado: apenas o dia atual
    }
  });

  const fetchAttendanceData = async (newFilters?: Partial<AttendanceFilters>) => {
    console.log('[DEBUG] fetchAttendanceData chamado');
    try {
      setLoading(true);
      setError(null);

      const currentFilters = { ...filters, ...newFilters };
      
      console.log('[DEBUG] Filtros aplicados:', {
        agents: currentFilters.agents,
        departments: currentFilters.departments,
        status: currentFilters.status,
        dateRange: currentFilters.dateRange
      });
      
      const params = new URLSearchParams({
        dateStart: currentFilters.dateRange.start.toISOString(),
        dateEnd: currentFilters.dateRange.end.toISOString()
      });

      // Adicionar filtros apenas se existirem e não estiverem vazios
      if (currentFilters.agents && currentFilters.agents.length > 0) {
        params.append('agents', currentFilters.agents.join(','));
        console.log('[DEBUG] Filtro de agentes aplicado:', currentFilters.agents);
      }
      if (currentFilters.departments && currentFilters.departments.length > 0) {
        params.append('departments', currentFilters.departments.join(','));
        console.log('[DEBUG] Filtro de departamentos aplicado:', currentFilters.departments);
      }
      if (currentFilters.status && currentFilters.status.length > 0) {
        params.append('status', currentFilters.status.join(','));
        console.log('[DEBUG] Filtro de status aplicado:', currentFilters.status);
      }

      const url = `${apiBase}/api/reports/attendance?${params}`;
      console.log('[DEBUG] URL da API:', url);
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        headers
      });

      console.log('[DEBUG] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[DEBUG] Error response:', errorText);
        throw new Error(`Erro na API: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[DEBUG] Resposta da API:', data);
      console.log('[DEBUG] Estrutura completa:', {
        success: data.success,
        agentsCount: data.agents?.length || 0,
        statsExist: !!data.stats,
        topPerformersCount: data.stats?.topPerformers?.length || 0,
        needsAttentionCount: data.stats?.needsAttention?.length || 0
      });
      
      if (data.success) {
        console.log('[DEBUG] Dados recebidos com sucesso');
        console.log('[DEBUG] Agents data:', data.agents?.slice(0, 3));
        console.log('[DEBUG] Stats data:', {
          totalChats: data.stats?.totalChats,
          topPerformers: data.stats?.topPerformers?.length,
          needsAttention: data.stats?.needsAttention?.length
        });
        setAgents(data.agents || []);
        setStats(data.stats || null);
      } else {
        throw new Error(data.error || 'Erro ao buscar dados');
      }
    } catch (error) {
      console.error('Erro ao buscar dados de atendimento:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      
      // Fallback: dados vazios em caso de erro
      setAgents([]);
      setStats({
        totalChats: 0,
        totalResolved: 0,
        totalPending: 0,
        averageResponseTime: 0,
        averageResolutionTime: 0,
        totalActiveContacts: 0,
        totalNewContacts: 0,
        averageBestResponseTime: 0,
        overallSatisfaction: 0,
        totalAgents: 0,
        onlineAgents: 0,
        offlineAgents: 0,
        peakHours: [],
        dailyTrend: [],
        channelDistribution: {},
        departmentPerformance: {},
        satisfactionTrend: [],
        topPerformers: [],
        needsAttention: [],
        kpis: {
          slaCompliance: 0,
          firstResponseSla: 0,
          resolutionSla: 0,
          customerRetention: 0,
          agentUtilization: 0
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[DEBUG] useEffect triggered, organization?.id:', organization?.id);
    
    // FORÇAR EXECUÇÃO PARA TESTE - mesmo sem organização
    console.log('[DEBUG] FORÇANDO chamada da API para teste...');
    fetchAttendanceData();
    
    // if (organization?.id) {
    //   console.log('[DEBUG] Chamando fetchAttendanceData...');
    //   fetchAttendanceData();
    // } else {
    //   console.log('[DEBUG] Organização não encontrada, não chamando API');
    // }
  }, [organization?.id]);

  const applyFilters = (newFilters: Partial<AttendanceFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    fetchAttendanceData(updatedFilters);
  };

  const exportReport = (format: 'excel' | 'pdf') => {
    console.log(`Exportando relatório de atendimento em ${format}`, { agents, stats, filters });
    // Implementar exportação real aqui
  };

  return {
    agents,
    stats,
    loading,
    error,
    filters,
    setFilters,
    applyFilters,
    exportReport,
    refetch: () => fetchAttendanceData(filters)
  };
}; 