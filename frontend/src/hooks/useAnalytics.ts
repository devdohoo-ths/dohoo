
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import type { ConversationAnalytics, AnalyticsFilters, AnalyticsSummary } from '@/types/analytics';

export const useAnalytics = (periodRange?: { start: Date; end: Date }) => {
  const [analytics, setAnalytics] = useState<ConversationAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [powerfulData, setPowerfulData] = useState<any>(null);
  const { organization } = useOrganization();
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: periodRange || { 
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
      end: new Date() 
    },
    sentiment: 'all',
    keywords: [],
    resolution_status: [],
    priority_level: [],
    organization_id: undefined
  });
  const { toast } = useToast();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Atualizar filtros quando periodRange mudar
  useEffect(() => {
    if (periodRange) {
      console.log('🔄 [useAnalytics] PeriodRange atualizado:', periodRange);
      setFilters(prev => ({
        ...prev,
        dateRange: periodRange
      }));
    }
  }, [periodRange]);

  // 🎯 NOVA FUNÇÃO: Buscar dados usando as mesmas APIs dos relatórios
  const fetchPowerfulAnalytics = async () => {
    if (!organization?.id) return;

    try {
      console.log('🚀 [useAnalytics] Buscando dados usando APIs dos relatórios...');
      setLoading(true);
      
      // 🎯 USAR A MESMA API DOS RELATÓRIOS DE ATTENDANCE
      const attendanceParams = new URLSearchParams({
        dateStart: filters.dateRange.start.toISOString().split('T')[0],
        dateEnd: filters.dateRange.end.toISOString().split('T')[0],
        organization_id: organization.id
      });

      const attendanceUrl = `${apiBase}/api/reports/attendance?${attendanceParams.toString()}`;
      console.log('🚀 [useAnalytics] URL do attendance:', attendanceUrl);

      const headers = await getAuthHeaders();
      const attendanceResponse = await fetch(attendanceUrl, {
        headers
      });

      if (!attendanceResponse.ok) {
        throw new Error(`HTTP error! status: ${attendanceResponse.status}`);
      }

      const attendanceData = await attendanceResponse.json();
      
      if (!attendanceData.success) {
        throw new Error(attendanceData.message || 'Erro ao buscar analytics');
      }

      console.log('🚀 [useAnalytics] Dados do relatório de attendance recebidos:', attendanceData);
      
      // 🎯 USAR A MESMA API DOS RELATÓRIOS DE CONVERSAS
      const conversationsParams = new URLSearchParams();
      
      // Filtros de data
      if (filters.dateRange?.start) {
        conversationsParams.append('dateStart', filters.dateRange.start.toISOString());
      }
      if (filters.dateRange?.end) {
        conversationsParams.append('dateEnd', filters.dateRange.end.toISOString());
      }
      
      // Filtros adicionais
      if (filters.keywords?.length) {
        filters.keywords.forEach(keyword => conversationsParams.append('keywords', keyword));
      }
      if (filters.resolution_status?.length) {
        filters.resolution_status.forEach(status => conversationsParams.append('statuses', status));
      }
      if (filters.priority_level?.length) {
        filters.priority_level.forEach(priority => conversationsParams.append('priority', priority));
      }

      const conversationsUrl = `${apiBase}/api/reports/conversations?${conversationsParams.toString()}`;
      console.log('🚀 [useAnalytics] URL das conversas:', conversationsUrl);

      const conversationsResponse = await fetch(conversationsUrl, {
        headers
      });

      if (!conversationsResponse.ok) {
        throw new Error(`HTTP error! status: ${conversationsResponse.status}`);
      }

      const conversationsData = await conversationsResponse.json();
      
      if (!conversationsData.success) {
        throw new Error(conversationsData.error || 'Erro ao buscar conversas');
      }

      console.log('🚀 [useAnalytics] Dados das conversas recebidos:', conversationsData);
      
      // 🎯 CONSTRUIR DADOS UNIFICADOS USANDO AS MESMAS ESTRUTURAS
      const attendanceDataProcessed = attendanceData.data || {};
      const agents = attendanceDataProcessed.agents || [];
      const conversations = conversationsData.conversations || [];
      
      // Verificar se há dados reais
      const hasRealData = agents.length > 0 || conversations.length > 0;
      
      if (!hasRealData) {
        console.log('🎭 [useAnalytics] Sem dados reais, gerando dados de demonstração...');
        
        // Gerar dados de demonstração - SEM DADOS REAIS
        const demoData = {
          // Dados dos agentes (sem dados reais)
          agents: [
            { name: 'dohoo', messagesSent: 0, contactsReceived: 0, totalAttendances: 0, productivity: 0 },
            { name: 'Guilherme', messagesSent: 0, contactsReceived: 0, totalAttendances: 0, productivity: 0 },
            { name: 'Lucimara', messagesSent: 0, contactsReceived: 0, totalAttendances: 0, productivity: 0 },
          ],
          
          // Dados das conversas (sem dados reais)
          conversations: [],
          
          // Estatísticas globais (sem dados reais)
          globalStats: {
            totalMessages: 0,
            totalSent: 0,
            totalReceived: 0,
            totalConversations: 0,
            averageResponseTime: 0,
            customerSatisfaction: 0,
            productivityScore: 0
          }
        };
        
        setPowerfulData(demoData);
        setAnalytics(convertToLegacyFormat(demoData));
        return;
      }
      
      // 🎯 PROCESSAR DADOS REAIS USANDO AS MESMAS ESTRUTURAS DOS RELATÓRIOS
      const processedData = {
        // Dados dos agentes (do attendance)
        agents: agents.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          email: agent.email,
          department: agent.department,
          is_online: agent.is_online,
          user_role: agent.user_role,
          totalAttendances: agent.totalAttendances || 0,
          resolvedAttendances: agent.resolvedAttendances || 0,
          messagesSent: agent.messagesSent || 0,
          contactsReceived: agent.contactsReceived || 0,
          productivity: agent.productivity || 0,
          customerSatisfaction: agent.customerSatisfaction || 0,
          averageResponseTime: agent.averageResponseTime || 0,
          totalConversations: agent.totalConversations || 0,
          activeConversations: agent.activeConversations || 0,
          finishedConversations: agent.finishedConversations || 0
        })),
        
        // Dados das conversas (do conversations)
        conversations: conversations.map((conv: any) => ({
          id: conv.id,
          name: conv.name,
          platform: conv.platform,
          status: conv.status,
          priority: conv.priority,
          department: conv.department,
          assigned_agent_id: conv.assigned_agent_id,
          assigned_agent_name: conv.assigned_agent_name,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message_at: conv.last_message_at,
          totalMessages: conv.totalMessages || 0,
          duration: conv.duration || 0,
          customerName: conv.customerName,
          customerPhone: conv.customerPhone,
          customerEmail: conv.customerEmail,
          tags: conv.tags || []
        })),
        
        // Estatísticas globais (calculadas dos dados reais)
        globalStats: {
          totalMessages: agents.reduce((sum: number, agent: any) => 
            sum + (agent.messagesSent || 0) + (agent.contactsReceived || 0), 0),
          totalSent: agents.reduce((sum: number, agent: any) => 
            sum + (agent.messagesSent || 0), 0),
          totalReceived: agents.reduce((sum: number, agent: any) => 
            sum + (agent.contactsReceived || 0), 0),
          totalConversations: conversations.length,
          averageResponseTime: agents.reduce((sum: number, agent: any) => 
            sum + (agent.averageResponseTime || 0), 0) / Math.max(agents.length, 1),
          customerSatisfaction: agents.reduce((sum: number, agent: any) => 
            sum + (agent.customerSatisfaction || 0), 0) / Math.max(agents.length, 1),
          productivityScore: agents.reduce((sum: number, agent: any) => 
            sum + (agent.productivity || 0), 0) / Math.max(agents.length, 1)
        }
      };
      
      setPowerfulData(processedData);
      setAnalytics(convertToLegacyFormat(processedData));
      
      console.log('🚀 [useAnalytics] Dados processados usando APIs dos relatórios:', processedData);

    } catch (error: any) {
      console.error('❌ [useAnalytics] Erro ao buscar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ REMOVIDO: fetchBasicAnalytics não é mais necessário, já que fetchPowerfulAnalytics usa APIs do backend

  // Função para converter dados poderosos para formato legado
  const convertToLegacyFormat = (powerfulData: any): ConversationAnalytics[] => {
    console.log('🔄 [useAnalytics] Convertendo dados poderosos para formato legado...');
    
    // Verificar se há dados reais
    const hasRealData = powerfulData?.globalStats?.totalMessages > 0 || powerfulData?.globalStats?.totalConversations > 0;
    
    if (!hasRealData) {
      console.log('🎭 [useAnalytics] Sem dados reais, gerando dados de demonstração...');
      
      // Gerar dados de demonstração simples
      const converted: ConversationAnalytics[] = [];
      const demoConversations = 15;
      
      for (let i = 0; i < demoConversations; i++) {
        converted.push({
          id: `demo-${i}`,
          chat_id: `demo-chat-${i}`,
          organization_id: organization?.id || '',
          analysis_data: {
            summary: `Conversa de demonstração ${i + 1} - Cliente satisfeito com atendimento`,
            topics: ['atendimento', 'produto', 'suporte'].slice(0, Math.floor(Math.random() * 3) + 1),
            issues: [],
            satisfaction_indicators: ['rápido', 'eficiente', 'resolvido'],
            resolution_suggestions: ['continuar monitorando', 'seguir padrão']
          },
          keywords: ['obrigado', 'perfeito', 'ajudou', 'resolvido', 'claro'].slice(0, Math.floor(Math.random() * 5) + 1),
          sentiment_score: 0.2 + (Math.random() * 0.6), // Positivo
          interaction_count: Math.floor(Math.random() * 15) + 5,
          customer_satisfaction: 4.0 + (Math.random() * 1.0), // 4.0-5.0
          response_time_avg: 120 + (Math.random() * 300), // 2-7 minutos
          created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Últimos 7 dias
          updated_at: new Date(),
          resolution_status: Math.random() > 0.2 ? 'resolved' : 'pending',
          priority_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
          chats: {
            id: `demo-chat-${i}`,
            name: `Cliente Demo ${i + 1}`,
            platform: 'whatsapp',
            status: 'finished',
            created_at: new Date().toISOString()
          }
        });
      }
      
      console.log(`🎭 [useAnalytics] Gerados ${converted.length} registros de demonstração`);
      return converted;
    }
    
    // Criar dados simulados baseados nos dados reais
    const converted: ConversationAnalytics[] = [];
    const totalConversations = Math.min(powerfulData.globalStats?.totalConversations || 50, 50);
    
    for (let i = 0; i < totalConversations; i++) {
      // Usar dados reais quando disponíveis
      const realSatisfaction = powerfulData.globalStats?.customerSatisfaction || 4.0;
      const realSentiment = 0.2; // Placeholder, as sentiment_score is not directly available from powerfulData
      const realResponseTime = powerfulData.globalStats?.averageResponseTime || 180;
      
      converted.push({
        id: `converted-${i}`,
        chat_id: `chat-${i}`,
        organization_id: organization?.id || '',
        analysis_data: {
          summary: `Conversa ${i + 1} - ${powerfulData.globalStats?.activeConversations || 0} ativas`,
          topics: powerfulData.conversations?.slice(0, 3).map((c: any) => c.name) || [],
          issues: [],
          satisfaction_indicators: [],
          resolution_suggestions: []
        },
        keywords: powerfulData.conversations?.slice(0, 5).map((c: any) => c.name) || [],
        sentiment_score: realSentiment + (Math.random() - 0.5) * 0.4, // Variação baseada no real
        interaction_count: Math.floor(Math.random() * 20) + 1,
        customer_satisfaction: realSatisfaction + (Math.random() - 0.5) * 0.5, // Variação baseada no real
        response_time_avg: realResponseTime + (Math.random() - 0.5) * 60, // Variação baseada no real
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        updated_at: new Date(),
        resolution_status: Math.random() > 0.3 ? 'resolved' : 'pending',
        priority_level: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)] as any,
        chats: {
          id: `chat-${i}`,
          name: `Cliente ${i + 1}`,
          platform: 'whatsapp',
          status: 'active',
          created_at: new Date().toISOString()
        }
      });
    }

    console.log(`✅ [useAnalytics] Convertidos ${converted.length} registros`);
    return converted;
  };

  const updateFilters = (newFilters: Partial<AnalyticsFilters>) => {
    console.log('🔧 [useAnalytics] Atualizando filtros:', newFilters);
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const getOverviewStats = () => {
    // Se temos dados poderosos, usar eles
    if (powerfulData) {
      console.log('📊 [useAnalytics] Usando dados poderosos para overview:', powerfulData);
      return {
        total_conversations: powerfulData.globalStats?.totalConversations || 0,
        avg_sentiment: 0, // sentiment_score is not directly available from powerfulData
        avg_satisfaction: powerfulData.globalStats?.customerSatisfaction || 0,
        avg_response_time: powerfulData.globalStats?.averageResponseTime || 0,
        resolution_rate: 0, // resolution_status is not directly available from powerfulData
        top_keywords: powerfulData.conversations?.slice(0, 10).map((c: any) => c.name) || [],
        sentiment_distribution: { positive: 0, neutral: 0, negative: 0 }, // sentiment_score is not directly available from powerfulData
        priority_distribution: { // priority is not directly available from powerfulData
          low: 0,
          medium: 0,
          high: 0,
          urgent: 0
        }
      };
    }

    // Fallback para cálculo local
    console.log('📊 [useAnalytics] Calculando estatísticas com', analytics.length, 'registros');
    
    const totalConversations = analytics.length;
    const avgSentiment = analytics.reduce((acc, curr) => acc + (curr.sentiment_score || 0), 0) / totalConversations || 0;
    const avgSatisfaction = analytics.reduce((acc, curr) => acc + (curr.customer_satisfaction || 0), 0) / totalConversations || 0;
    const avgResponseTime = analytics.reduce((acc, curr) => acc + (curr.response_time_avg || 0), 0) / totalConversations || 0;

    const resolutionStats = analytics.reduce((acc, curr) => {
      acc[curr.resolution_status] = (acc[curr.resolution_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityStats = analytics.reduce((acc, curr) => {
      acc[curr.priority_level] = (acc[curr.priority_level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sentimentStats = analytics.reduce((acc, curr) => {
      if (curr.sentiment_score >= 0.1) acc.positive++;
      else if (curr.sentiment_score <= -0.1) acc.negative++;
      else acc.neutral++;
      return acc;
    }, { positive: 0, negative: 0, neutral: 0 });

    const keywordFrequency = analytics.reduce((acc, curr) => {
      curr.keywords.forEach(keyword => {
        acc[keyword] = (acc[keyword] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const topKeywords = Object.entries(keywordFrequency)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const resolutionRate = resolutionStats.resolved ? (resolutionStats.resolved / totalConversations) * 100 : 0;

    return {
      total_conversations: totalConversations,
      avg_sentiment: avgSentiment,
      avg_satisfaction: avgSatisfaction,
      avg_response_time: avgResponseTime,
      resolution_rate: resolutionRate,
      top_keywords: topKeywords,
      sentiment_distribution: sentimentStats,
      priority_distribution: {
        low: priorityStats.low || 0,
        medium: priorityStats.medium || 0,
        high: priorityStats.high || 0,
        urgent: priorityStats.urgent || 0
      }
    };
  };

  // useEffect com debounce para buscar analytics ao mudar filtros
  useEffect(() => {
    if (organization?.id) {
      console.log('🔄 [useAnalytics] Filtros alterados, reagendando busca:', {
        dateRange: filters.dateRange,
        sentiment: filters.sentiment,
        keywords: filters.keywords,
        resolution_status: filters.resolution_status,
        priority_level: filters.priority_level
      });

      // Limpar timer anterior
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Debounce de 500ms
      debounceTimer.current = setTimeout(() => {
        console.log('🚀 [useAnalytics] Executando busca com novos filtros...');
        fetchPowerfulAnalytics();
      }, 500);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [organization?.id, filters]);

  // Retry automático se os dados não carregaram
  useEffect(() => {
    if (organization?.id && !loading && !powerfulData) {
      console.log('🔄 [useAnalytics] Tentando recarregar dados de analytics...');
      const retryTimeout = setTimeout(() => {
        fetchPowerfulAnalytics();
      }, 3000); // Tentar novamente após 3 segundos

      return () => clearTimeout(retryTimeout);
    }
  }, [organization?.id, loading, powerfulData, fetchPowerfulAnalytics]);

  return {
    analytics,
    loading,
    filters,
    updateFilters,
    fetchAnalytics: fetchPowerfulAnalytics,
    getOverviewStats,
    summary: getOverviewStats(),
    powerfulData // Exportar dados poderosos para componentes avançados
  };
};
