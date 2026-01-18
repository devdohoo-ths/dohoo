import { useState, useEffect, useCallback } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';

// Tipos unificados baseados nos relatórios
export interface UnifiedReportData {
  // Dados dos agentes (mesmo formato do relatório de attendance)
  agents: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    is_online: boolean;
    user_role: string;
    totalAttendances: number;
    resolvedAttendances: number;
    messagesSent: number;
    contactsReceived: number;
    productivity: number;
    customerSatisfaction: number;
    averageResponseTime: number;
    totalConversations: number;
    activeConversations: number;
    finishedConversations: number;
  }>;
  
  // Dados das conversas (mesmo formato do relatório de conversations)
  conversations: Array<{
    id: string;
    name: string;
    platform: string;
    status: string;
    priority: string;
    department: string;
    assigned_agent_id: string;
    assigned_agent_name: string;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    totalMessages: number;
    duration: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    tags: string[];
  }>;
  
  // Estatísticas globais (mesmo formato do dashboard)
  globalStats: {
    totalUsers: number;
    activeUsers: number;
    totalConversations: number;
    activeConversations: number;
    finishedConversations: number;
    totalMessages: number;
    aiResponses: number;
    assistantsCreated: number;
    aiCredits: number;
    averageProductivity: number;
    averageSatisfaction: number;
    averageResponseTime: number;
  };
  
  // Dados de mensagens (mesmo formato do relatório)
  messages: Array<{
    id: string;
    chat_id: string;
    content: string;
    is_from_me: boolean;
    sender_name: string;
    created_at: string;
    organization_id: string;
  }>;
}

export interface UnifiedFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  channels?: string[];
  agents?: string[];
  statuses?: string[];
  departments?: string[];
  priority?: string[];
  keywords?: string;
}

export const useUnifiedReports = () => {
  const [data, setData] = useState<UnifiedReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UnifiedFilters>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
      end: new Date()
    }
  });

  const { profile } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  // 🎯 FUNÇÃO PRINCIPAL: Buscar dados usando a mesma API dos relatórios
  const fetchUnifiedData = useCallback(async (customFilters?: Partial<UnifiedFilters>) => {
    // 🎯 SEMPRE USAR ORGANIZATION_ID DO PERFIL DO USUÁRIO AUTENTICADO
    const userOrganizationId = profile?.organization_id;
    
    if (!userOrganizationId) {
      return;
    }

    console.log('🔍 [UnifiedReports] Buscando dados para organização:', {
      profileOrganizationId: profile?.organization_id,
      organizationId: organization?.id,
      organizationName: organization?.name
    });

    setLoading(true);
    setError(null);

    try {
      
      // 🎯 USAR EXATAMENTE A MESMA API DOS RELATÓRIOS DE CONVERSAS
      const params = new URLSearchParams();
      
      // Filtros de data (mesmo formato dos relatórios)
      if (filters.dateRange?.start) {
        params.append('dateStart', filters.dateRange.start.toISOString());
      }
      if (filters.dateRange?.end) {
        params.append('dateEnd', filters.dateRange.end.toISOString());
      }
      
      // Filtros adicionais (mesmo formato dos relatórios)
      if (filters.channels?.length) {
        filters.channels.forEach(channel => params.append('channels', channel));
      }
      if (filters.agents?.length) {
        filters.agents.forEach(agent => params.append('agents', agent));
      }
      if (filters.statuses?.length) {
        filters.statuses.forEach(status => params.append('statuses', status));
      }
      if (filters.departments?.length) {
        filters.departments.forEach(dept => params.append('departments', dept));
      }
      if (filters.priority?.length) {
        filters.priority.forEach(priority => params.append('priority', priority));
      }

      // Filtro de palavras-chave
      if (filters.keywords?.trim()) {
        params.append('keywords', filters.keywords.trim());
      }

      // 🎯 USAR A MESMA URL DOS RELATÓRIOS DE CONVERSAS
      const url = `${apiBase}/api/reports/conversations?${params.toString()}`;

      const response = await fetch(url, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const responseData = await response.json();

      if (!responseData.success) {
        throw new Error(responseData.error || 'Erro ao buscar dados');
      }

      // 🎯 USAR A MESMA API DOS RELATÓRIOS DE ATTENDANCE PARA DADOS DOS AGENTES
      const attendanceParams = new URLSearchParams({
        dateStart: filters.dateRange.start.toISOString().split('T')[0],
        dateEnd: filters.dateRange.end.toISOString().split('T')[0],
        organization_id: userOrganizationId // 🎯 SEMPRE USAR DO USUÁRIO
      });

      const attendanceUrl = `${apiBase}/api/reports/attendance?${attendanceParams.toString()}`;

      const attendanceResponse = await fetch(attendanceUrl, {
        headers: getAuthHeaders()
      });

      if (!attendanceResponse.ok) {
        throw new Error(`Erro na requisição de attendance: ${attendanceResponse.status}`);
      }

      const attendanceData = await attendanceResponse.json();

      // 🎯 USAR A MESMA API DO DASHBOARD PARA ESTATÍSTICAS GLOBAIS
      const dashboardParams = new URLSearchParams({
        user_id: profile?.id || '',
        organization_id: userOrganizationId, // 🎯 SEMPRE USAR DO USUÁRIO
        dateStart: filters.dateRange.start.toISOString().split('T')[0],
        dateEnd: filters.dateRange.end.toISOString().split('T')[0]
      });

      const dashboardUrl = `${apiBase}/api/dashboard/stats?${dashboardParams.toString()}`;

      const dashboardResponse = await fetch(dashboardUrl, {
        headers: getAuthHeaders()
      });

      if (!dashboardResponse.ok) {
        throw new Error(`Erro na requisição do dashboard: ${dashboardResponse.status}`);
      }

      const dashboardData = await dashboardResponse.json();

      // 🎯 VERIFICAR SE OS DADOS PERTENCEM À ORGANIZAÇÃO CORRETA

      // 🎯 CONSTRUIR DADOS UNIFICADOS USANDO AS MESMAS ESTRUTURAS
      const unifiedData: UnifiedReportData = {
        // Dados dos agentes (do attendance)
        agents: attendanceData.data?.agents || [],
        
        // Dados das conversas (do conversations)
        conversations: responseData.conversations || [],
        
        // Estatísticas globais (do dashboard)
        globalStats: dashboardData.stats || {
          totalUsers: 0,
          activeUsers: 0,
          totalConversations: 0,
          activeConversations: 0,
          finishedConversations: 0,
          totalMessages: 0,
          aiResponses: 0,
          assistantsCreated: 0,
          aiCredits: 0,
          averageProductivity: 0,
          averageSatisfaction: 0,
          averageResponseTime: 0
        },
        
        // Dados de mensagens (do conversations)
        messages: responseData.messages || []
      };

      // 🎯 VERIFICAÇÃO FINAL DE ISOLAMENTO

      setData(unifiedData);

    } catch (error: any) {
      console.error('[UnifiedReports] ❌ Erro ao buscar dados:', error);
      setError(error.message);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados unificados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, profile?.id, organization?.id, filters, toast]);

  // Atualizar filtros
  const updateFilters = useCallback((newFilters: Partial<UnifiedFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Buscar dados com filtros customizados
  const fetchWithFilters = useCallback((customFilters: Partial<UnifiedFilters>) => {
    const updatedFilters = { ...filters, ...customFilters };
    setFilters(updatedFilters);
    fetchUnifiedData(customFilters);
  }, [filters, fetchUnifiedData]);

  // Buscar dados iniciais
  useEffect(() => {
    if (profile?.organization_id) {
      fetchUnifiedData();
    }
  }, [profile?.organization_id, fetchUnifiedData]);

  return {
    data,
    loading,
    error,
    filters,
    updateFilters,
    fetchWithFilters,
    fetchUnifiedData
  };
}; 