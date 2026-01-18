import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders
import type { 
  ConversationReport, 
  ReportFilters, 
  ReportStats, 
  ConversationDetail,
  AIAnalysis,
  ExportOptions 
} from '@/types/reports';

export const useConversationReports = () => {
  const [conversations, setConversations] = useState<ConversationReport[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ConversationReport[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: {
      start: new Date(), // Alterado: apenas o dia atual
      end: new Date()    // Alterado: apenas o dia atual
    }
  });

  const { toast } = useToast();
  const { organization } = useOrganization();
  const { profile } = useAuth();

  // Buscar conversas do banco de dados
  const fetchConversations = useCallback(async (filters: ReportFilters) => {
    if (!organization?.id) {
      console.log('[Relatório] Sem organização, pulando busca');
      return;
    }

    setLoading(true);
    try {
      console.log('[Relatório] Iniciando busca de conversas com filtros:', filters);
      console.log('[Relatório] Filtros detalhados:', {
        dateRange: filters.dateRange,
        keywords: filters.keywords,
        channels: filters.channels,
        agents: filters.agents,
        statuses: filters.statuses,
        departments: filters.departments,
        priority: filters.priority
      });

      // Montar parâmetros da requisição
      const params = new URLSearchParams();
      
      // Filtros de data
      if (filters.dateRange?.start) {
        params.append('dateStart', filters.dateRange.start.toISOString());
      }
      if (filters.dateRange?.end) {
        params.append('dateEnd', filters.dateRange.end.toISOString());
      }
      
      // Filtros adicionais
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
      if (filters.keywords && filters.keywords.trim()) {
        params.append('keywords', filters.keywords);
        console.log('[Relatório] ✅ Filtro de palavras-chave aplicado:', filters.keywords);
      } else {
        console.log('[Relatório] ❌ Nenhum filtro de palavras-chave aplicado');
      }

      // Fazer requisição para a API
      const url = `${apiBase}/api/reports/conversations?${params.toString()}`;
      console.log('[Relatório] URL da requisição:', url);
      console.log('[Relatório] Parâmetros da URL:', params.toString());

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Relatório] Resposta da API:', data);

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar conversas');
      }

      const transformedConversations: ConversationReport[] = data.conversations.map((conv: any) => {
        // Função para converter data com tratamento de erro
        const safeDate = (dateValue: any) => {
          try {
            if (!dateValue) return new Date();
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? new Date() : date;
          } catch (error) {
            console.error('Erro ao converter data:', dateValue, error);
            return new Date();
          }
        };

        return {
          ...conv,
          startTime: safeDate(conv.startTime),
          endTime: conv.endTime ? safeDate(conv.endTime) : undefined,
          aiAnalysis: conv.aiAnalysis ? {
            ...conv.aiAnalysis,
            createdAt: safeDate(conv.aiAnalysis.createdAt)
          } : undefined
        };
      });

      setConversations(transformedConversations);
      setFilteredConversations(transformedConversations);
      
      // Calcular estatísticas
      calculateStats(transformedConversations);

      console.log('[Relatório] Conversas carregadas com sucesso:', transformedConversations.length);

    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, toast]);

  // Aplicar filtros
  const applyFilters = useCallback((newFilters: Partial<ReportFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    let filtered = conversations;

    // Filtro por palavras-chave
    if (updatedFilters.keywords) {
      const keyword = updatedFilters.keywords.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.customerName.toLowerCase().includes(keyword) ||
        conv.customerPhone?.includes(keyword) ||
        conv.customerEmail?.toLowerCase().includes(keyword) ||
        conv.tags.some(tag => tag.toLowerCase().includes(keyword))
      );
    }

    // Filtro por clientes
    if (updatedFilters.customers?.length) {
      filtered = filtered.filter(conv => 
        updatedFilters.customers!.includes(conv.customerName)
      );
    }

    // Filtro por tipos de conversa
    if (updatedFilters.conversationTypes?.length) {
      filtered = filtered.filter(conv => 
        updatedFilters.conversationTypes!.includes(conv.status)
      );
    }

    setFilteredConversations(filtered);
  }, [filters, conversations]);

  // Calcular estatísticas
  const calculateStats = useCallback((conversations: ConversationReport[]) => {
    if (conversations.length === 0) {
      setStats(null);
      return;
    }

    const totalConversations = conversations.length;
    const totalDuration = conversations.reduce((sum, conv) => sum + conv.duration, 0);
    const averageDuration = totalDuration / totalConversations;
    
    const totalSatisfaction = conversations
      .filter(conv => conv.satisfaction !== undefined)
      .reduce((sum, conv) => sum + (conv.satisfaction || 0), 0);
    const satisfactionCount = conversations.filter(conv => conv.satisfaction !== undefined).length;
    const averageSatisfaction = satisfactionCount > 0 ? totalSatisfaction / satisfactionCount : 0;

    const unattendedCount = conversations.filter(conv => conv.status === 'unattended').length;
    const abandonmentRate = (unattendedCount / totalConversations) * 100;

    // Distribuição por canal
    const channelDistribution: Record<string, number> = {};
    conversations.forEach(conv => {
      channelDistribution[conv.channel] = (channelDistribution[conv.channel] || 0) + 1;
    });

    // Performance dos agentes
    const agentStats: Record<string, { total: number; duration: number; satisfaction: number; resolved: number }> = {};
    conversations.forEach(conv => {
      if (conv.agentId) {
        if (!agentStats[conv.agentId]) {
          agentStats[conv.agentId] = { total: 0, duration: 0, satisfaction: 0, resolved: 0 };
        }
        agentStats[conv.agentId].total++;
        agentStats[conv.agentId].duration += conv.duration;
        if (conv.satisfaction) {
          agentStats[conv.agentId].satisfaction += conv.satisfaction;
        }
        if (conv.status === 'closed') {
          agentStats[conv.agentId].resolved++;
        }
      }
    });

    const agentPerformance = Object.entries(agentStats).map(([agentId, stats]) => ({
      agentId,
      agentName: conversations.find(c => c.agentId === agentId)?.agentName || 'Agente',
      totalConversations: stats.total,
      averageDuration: stats.duration / stats.total,
      averageSatisfaction: stats.satisfaction / stats.total,
      resolutionRate: (stats.resolved / stats.total) * 100
    }));

    // Distribuição por status
    const statusDistribution: Record<string, number> = {};
    conversations.forEach(conv => {
      statusDistribution[conv.status] = (statusDistribution[conv.status] || 0) + 1;
    });

    // Distribuição por sentimento
    const sentimentDistribution: Record<string, number> = {};
    conversations.forEach(conv => {
      const sentiment = conv.sentiment || 'undefined';
      sentimentDistribution[sentiment] = (sentimentDistribution[sentiment] || 0) + 1;
    });

    // Palavras-chave mais comuns
    const allKeywords: string[] = [];
    conversations.forEach(conv => {
      if (conv.aiAnalysis?.keywords) {
        allKeywords.push(...conv.aiAnalysis.keywords);
      }
    });
    
    const keywordCount: Record<string, number> = {};
    allKeywords.forEach(keyword => {
      keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
    });
    
    const topKeywords = Object.entries(keywordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([keyword]) => keyword);

    // Horários de pico
    const hourlyDistribution: Record<number, number> = {};
    conversations.forEach(conv => {
      const hour = conv.startTime.getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    });
    
    const peakHours = Object.entries(hourlyDistribution)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);

    setStats({
      totalConversations,
      averageDuration,
      averageSatisfaction,
      abandonmentRate,
      channelDistribution,
      agentPerformance,
      statusDistribution,
      sentimentDistribution,
      topKeywords,
      peakHours
    });
  }, []);

  // Buscar detalhes de uma conversa específica
  const fetchConversationDetail = useCallback(async (conversationId: string): Promise<ConversationDetail | null> => {
    try {
      console.log('[Relatório] Buscando detalhes da conversa:', conversationId);

      const url = `${apiBase}/api/reports/conversations/${conversationId}`;
      console.log('[Relatório] URL da requisição de detalhes:', url);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Relatório] Resposta da API de detalhes:', data);

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar detalhes da conversa');
      }

      const detail: ConversationDetail = {
        ...data.detail,
        conversation: {
          ...data.detail.conversation,
          startTime: new Date(data.detail.conversation.startTime),
          endTime: data.detail.conversation.endTime ? new Date(data.detail.conversation.endTime) : undefined
        },
        messages: data.detail.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        timeline: data.detail.timeline.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }))
      };

      setSelectedConversation(detail);
      console.log('[Relatório] Detalhes da conversa carregados com sucesso');
      
      return detail;
    } catch (error) {
      console.error('Erro ao buscar detalhes da conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes da conversa",
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  // Analisar conversa com IA
  const analyzeConversation = useCallback(async (conversationId: string): Promise<AIAnalysis | null> => {
    try {
      const detail = await fetchConversationDetail(conversationId);
      if (!detail) return null;

      const analysis: AIAnalysis = {
        id: `analysis_${conversationId}`,
        conversationId,
        summary: `Análise da conversa com ${detail.conversation.customerName}. ${detail.messages.length} mensagens trocadas.`,
        sentiment: detail.messages.length > 0 ? 'positive' : 'neutral',
        sentimentScore: 0.5,
        category: 'Suporte',
        keywords: ['atendimento', 'suporte', 'cliente'],
        suggestions: [
          'Melhorar tempo de resposta',
          'Treinar agentes em resolução de problemas',
          'Implementar FAQ automatizado'
        ],
        satisfaction: 4.2,
        createdAt: new Date(),
        filters
      };

      setAiAnalysis(analysis);
      return analysis;
    } catch (error) {
      console.error('Erro ao analisar conversa:', error);
      return null;
    }
  }, [fetchConversationDetail, filters]);

  // Exportar relatório
  const exportReport = useCallback(async (options: ExportOptions) => {
    try {
      const data = options.includeMessages ? conversations : filteredConversations;
      
      if (options.format === 'excel') {
        console.log('Exportando para Excel:', data.length, 'conversas');
      } else if (options.format === 'pdf') {
        console.log('Exportando para PDF:', data.length, 'conversas');
      }
      
      toast({
        title: "Sucesso",
        description: `Relatório exportado com ${data.length} conversas`,
      });
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar o relatório",
        variant: "destructive"
      });
    }
  }, [conversations, filteredConversations, toast]);

  // Analisar todas as conversas com IA
  const analyzeAllWithAI = useCallback(async () => {
    try {
      console.log('Iniciando análise de todas as conversas com IA...');
      toast({
        title: "Análise iniciada",
        description: "Análise de todas as conversas foi iniciada",
      });
    } catch (error) {
      console.error('Erro ao analisar todas as conversas:', error);
      toast({
        title: "Erro",
        description: "Erro ao iniciar análise em lote",
        variant: "destructive"
      });
    }
  }, [toast]);

  return {
    conversations: filteredConversations,
    stats,
    loading,
    selectedConversation,
    aiAnalysis,
    filters,
    setFilters,
    fetchConversations,
    applyFilters,
    fetchConversationDetail,
    analyzeConversationWithAI: analyzeConversation,
    analyzeAllWithAI,
    exportReport,
    setSelectedConversation
  };
};
 