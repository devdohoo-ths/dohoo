import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  MessageCircle,
  TrendingUp,
  Clock,
  Settings,
  RefreshCw,
  Star,
  CheckCircle,
  FileText,
  AlertCircle,
  Eye,
  Send,
  Download
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { apiBase, getAuthHeaders, getAuthHeadersWithUser } from "@/utils/apiBase"; // ✅ CORRIGIDO: Adicionar getAuthHeaders
import { useDashboardWidgets, WIDGET_NAMES, WIDGET_DESCRIPTIONS } from "@/hooks/useDashboardWidgets";
import { useAICredits } from "@/hooks/useAICredits";
import { IndividualMetrics } from "./IndividualMetrics";
import { TeamMetrics } from "./TeamMetrics";
import { ScheduleAnalysisChart } from "./ScheduleAnalysisChart";
import { TimeAnalysis } from "./TimeAnalysis";
import { ProductivityChart } from "./ProductivityChart";
import { UserComparisonChart } from "./dashboard/UserComparisonChart";
import { HeatmapCard } from "./dashboard/HeatmapCard";
import { AIOperationSummary } from "./dashboard/AIOperationSummary";
import { useNavigate } from "react-router-dom";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import { useAnalytics } from "@/hooks/useAnalytics";
import { dashboardCache } from "@/utils/dashboardCache";
import { CacheManager } from "@/utils/cacheManager";
import { cn } from "@/lib/utils";

// Tipos e interfaces
interface DashboardStats {
  totalMessages: number;
  totalUsers: number;
  activeConversations: number;
  avgResponseTime: number;
  messagesToday: number;
  messagesThisWeek: number;
  aiResponses: number;
  assistantsCreated: number;
  creditsUsed: number;
  creditsRemaining: number;
  productivity: number;
  responseRate: number;
  sentMessages: number;
  receivedMessages: number;
  trend: {
    messages: number;
    users: number;
    responseTime: number;
  };
}

interface PeriodRange {
  start: Date;
  end: Date;
}

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth(); // 🎯 INCLUIR PROFILE
  const { organization } = useOrganization();
  const { widgets, toggleWidget, resetToDefault } = useDashboardWidgets();
  const { credits, getUsageStats } = useAICredits();
  const navigate = useNavigate();

  // 🎯 VERIFICAR SE O USUÁRIO É AGENTE
  const isAgent = useMemo(() => {
    if (!profile) return false;
    const roleName = profile?.roles?.name || profile?.role_name || '';
    return roleName.toLowerCase().includes('agente') || roleName.toLowerCase().includes('agent');
  }, [profile]);

  // Estados
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7d' | 'current_month'>('today');
  const [activeTab, setActiveTab] = useState<'overview' | 'individual' | 'teams'>('overview');
  
  // 🎯 GARANTIR QUE AGENTES FICAM APENAS NA ABA OVERVIEW
  useEffect(() => {
    if (isAgent && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [isAgent, activeTab]);
  const [showWidgetControls, setShowWidgetControls] = useState(false);
  const [loading, setLoading] = useState(false); // Mudado para false inicialmente
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalMessages: 0,
    totalUsers: 0,
    activeConversations: 0,
    avgResponseTime: 0,
    messagesToday: 0,
    messagesThisWeek: 0,
    aiResponses: 0,
    assistantsCreated: 0,
    creditsUsed: 0,
    creditsRemaining: 0,
    productivity: 0,
    responseRate: 0,
    sentMessages: 0,
    receivedMessages: 0,
    trend: {
      messages: 0,
      users: 0,
      responseTime: 0
    }
  });
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loadingRecentMessages, setLoadingRecentMessages] = useState(false);
  const [hasInitialData, setHasInitialData] = useState(false);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [connectedUsersCount, setConnectedUsersCount] = useState(0);

  // Função para buscar usuários conectados
  const fetchConnectedUsers = async () => {
    if (!user || !profile?.organization_id) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts`, { headers });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.accounts) {
          // Filtrar apenas contas conectadas e extrair user_ids únicos
          const connectedUserIds = [...new Set(
            data.accounts
              .filter((account: any) => account.status === 'connected')
              .map((account: any) => account.user_id)
              .filter((userId: string) => userId) // Remover valores nulos/undefined
          )];
          
          setConnectedUsersCount(connectedUserIds.length);
        } else {
          setConnectedUsersCount(0);
        }
      } else {
        setConnectedUsersCount(0);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários conectados:', error);
      setConnectedUsersCount(0);
    }
  };

  // Função para carregar mensagens recentes (otimizada - não bloqueia renderização inicial)
  const fetchRecentMessages = async () => {
    if (!user) {
      return;
    }

    // 🎯 USAR ORGANIZATION_ID DO USUÁRIO AUTENTICADO
    const userOrganizationId = profile?.organization_id;
    
    if (!userOrganizationId) {
      return;
    }

    // Só mostrar loading se já tiver dados (atualização), não no carregamento inicial
    // Isso evita que o card demore para aparecer
    if (recentMessages.length > 0) {
      setLoadingRecentMessages(true);
    }

    try {
      const params = new URLSearchParams({
        dateStart: periodRange.start.toISOString().split('T')[0],
        dateEnd: periodRange.end.toISOString().split('T')[0],
        limit: '10', // Limitar a 10 mensagens mais recentes
        organization_id: userOrganizationId // 🎯 SEMPRE INCLUIR ORGANIZATION_ID
      });

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();

      // Buscar mensagens recentes da API dedicada
      const response = await fetch(`${apiBase}/api/messages/recent?${params}`, { headers });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.messages) {
          setRecentMessages(data.messages);
        } else {
          setRecentMessages([]);
        }
      } else {
        setRecentMessages([]);
      }
    } catch (error) {
      setRecentMessages([]);
    } finally {
      setLoadingRecentMessages(false);
    }
  };

  // Função para criar período baseado no filtro
  const createPeriodRange = (period: 'today' | '7d' | 'current_month'): PeriodRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let start: Date;
    let end: Date;

    switch (period) {
      case 'today':
        // Hoje: apenas o dia atual (00:00:00 até 23:59:59)
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case '7d':
        // Últimos 7 dias: 7 dias atrás até HOJE (incluindo hoje)
        start = new Date(today);
        start.setDate(today.getDate() - 6); // -6 para incluir hoje (7 dias total)
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'current_month':
        // Mês atual: do dia 1 do mês atual até hoje
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      default:
        // Padrão: apenas hoje
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  const periodRange = useMemo(() => createPeriodRange(selectedPeriod), [selectedPeriod]);

  // Função para buscar estatísticas
  const fetchStats = async (refresh = false) => {
    if (!user) {
      return;
    }
    
    // Log removido para reduzir poluição no console

    // 🎯 AGENTES NUNCA USAM CACHE - sempre buscar dados frescos filtrados
    if (isAgent) {
      console.log('🔒 [Dashboard] Usuário é agente - pulando cache e forçando busca fresca');
      // Limpar cache do agente ao iniciar
      dashboardCache.invalidate(user.id, selectedPeriod);
      refresh = true; // Forçar refresh sempre para agentes
    }

    // Se já temos dados e não é refresh, não mostrar loading
    if (hasInitialData && !refresh && !isAgent) {
      return;
    }

    // Tentar cache primeiro (se não for refresh E não for agente)
    if (!refresh && !isAgent) {
      const cachedStats = dashboardCache.get(user.id, selectedPeriod);
      if (cachedStats) {
        setStats(cachedStats);
        setHasInitialData(true);
        setIsUsingCache(true);
        return;
      }
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 🎯 CORRIGIDO: Usar parâmetros corretos para o endpoint /stats
      const statsParams = new URLSearchParams({
        user_id: user.id,
        organization_id: profile?.organization_id || '',
        dateStart: periodRange.start.toISOString().split('T')[0],
        dateEnd: periodRange.end.toISOString().split('T')[0],
      });

      const headers = await getAuthHeadersWithUser(user, profile);

      const statsResponse = await fetch(`${apiBase}/api/dashboard/stats?${statsParams}`, { headers });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        // Log removido para reduzir poluição no console

        const usageStats = getUsageStats();

        // 🎯 CORRIGIDO: Usar dados diretos do endpoint /stats que já tem o count real
        if (statsData.success && statsData.stats) {
          const stats = statsData.stats;
          
          // Usar dados diretos do endpoint com count real
          const totalMessages = stats.totalMessages || 0;
          const sentMessages = stats.sentMessages || 0;
          const receivedMessages = stats.receivedMessages || 0;
          const totalUsers = stats.users || 0;
          
          // Tempo médio de resposta já vem em segundos do endpoint
          const avgResponseTimeMinutes = Math.round((stats.response_time || 0) / 60);

          // Usar dados reais de créditos de IA
          const aiCredits = usageStats?.thisMonth || 0;
          const creditsUsed = usageStats?.today || 0;

          // Calcular taxa de resposta
          const responseRate = totalMessages > 0 ? Math.round((sentMessages / totalMessages) * 100) : 0;

          // Usar dados diretos do endpoint /stats
          const productivity = stats.productivity || 0;
          const activeConversations = stats.active_conversations || 0;

          const newStats = {
            totalMessages,
            totalUsers,
            activeConversations,
            avgResponseTime: avgResponseTimeMinutes,
            messagesToday: totalMessages, // Para hoje
            messagesThisWeek: totalMessages, // Para a semana
            aiResponses: stats.ai_responses || sentMessages, // Usar ai_responses do endpoint
            assistantsCreated: stats.assistants_created || 0, // Usar dados do endpoint
            creditsUsed,
            creditsRemaining: aiCredits,
            productivity,
            responseRate,
            sentMessages,
            receivedMessages,
            trend: stats.trends || {
              messages: 0,
              users: 0,
              responseTime: 0
            }
          };

          setStats(newStats);
          setHasInitialData(true);
          setIsUsingCache(false);
          // 🎯 AGENTES NÃO SALVAM NO CACHE (sempre buscar dados frescos)
          if (!isAgent) {
            dashboardCache.set(user.id, selectedPeriod, newStats);
          }

        } else {
          setStats({
            totalMessages: 0,
            totalUsers: 0,
            activeConversations: 0,
            avgResponseTime: 0,
            messagesToday: 0,
            messagesThisWeek: 0,
            aiResponses: 0,
            assistantsCreated: 0,
            creditsUsed: 0,
            creditsRemaining: 0,
            productivity: 0,
            responseRate: 0,
            sentMessages: 0,
            receivedMessages: 0,
            trend: { messages: 0, users: 0, responseTime: 0 }
          });
        }
      } else {
        setStats({
          totalMessages: 0,
          totalUsers: 0,
          activeConversations: 0,
          avgResponseTime: 0,
          messagesToday: 0,
          messagesThisWeek: 0,
          aiResponses: 0,
          assistantsCreated: 0,
          creditsUsed: 0,
          creditsRemaining: 0,
          productivity: 0,
          responseRate: 0,
          sentMessages: 0,
          receivedMessages: 0,
          trend: { messages: 0, users: 0, responseTime: 0 }
        });
      }
    } catch (error) {
      console.error('❌ [Dashboard] Erro ao buscar estatísticas:', error);
      setStats({
        totalMessages: 0,
        totalUsers: 0,
        activeConversations: 0,
        avgResponseTime: 0,
        messagesToday: 0,
        messagesThisWeek: 0,
        aiResponses: 0,
        assistantsCreated: 0,
        creditsUsed: 0,
        creditsRemaining: 0,
        productivity: 0,
        responseRate: 0,
        sentMessages: 0,
        receivedMessages: 0,
        trend: { messages: 0, users: 0, responseTime: 0 }
      });
    } finally {
      if (refresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  // ✅ OTIMIZADO: Effects com carregamento sequencial para melhor performance
  useEffect(() => {
    if (!user || !profile?.organization_id) return;

    widgets.forEach(widget => {
      // Widget loading logic
    });

    // ✅ FASE 1: Carregar dados críticos primeiro (stats e usuários conectados)
    fetchStats();
    fetchConnectedUsers();
    
    // ✅ FASE 2: Carregar mensagens recentes com delay maior para não bloquear
    // Isso permite que os cards principais apareçam primeiro
    const recentMessagesTimeout = setTimeout(() => {
      fetchRecentMessages();
    }, 500); // ✅ AUMENTADO: De 300ms para 500ms para melhorar percepção de velocidade

    return () => {
      clearTimeout(recentMessagesTimeout);
    };
  }, [user, profile?.organization_id]); // 🎯 INCLUIR PROFILE.ORGANIZATION_ID

  // ✅ OTIMIZADO: Atualização automática a cada 5 minutos (aumentado de 3 min)
  useEffect(() => {
    if (!user || !profile?.organization_id || !autoRefreshEnabled) return;

    // ✅ OTIMIZAÇÃO: Configurar intervalo de 5 minutos (aumentado de 3 min) para reduzir requisições ao Supabase
    const intervalId = setInterval(async () => {
      if (!autoRefreshEnabled) return; // Verificar novamente se ainda está habilitado
      
      setAutoRefreshing(true);
      
      try {
        await fetchStats(true); // true = refresh, força atualização
        await fetchRecentMessages();
        await fetchConnectedUsers();
      } catch (error) {
        console.error('❌ [Dashboard] Erro na atualização automática:', error);
      } finally {
        setAutoRefreshing(false);
      }
    }, 5 * 60 * 1000); // ✅ OTIMIZADO: 5 minutos (aumentado de 3 min)

    // Cleanup do intervalo quando o componente for desmontado ou dependências mudarem
    return () => {
      clearInterval(intervalId);
    };
  }, [user, profile?.organization_id, selectedPeriod, autoRefreshEnabled]); // Incluir autoRefreshEnabled

  // 🎯 LIMPAR CACHE QUANDO A ORGANIZAÇÃO MUDAR OU QUANDO ROLE MUDAR
  useEffect(() => {
    if (user && profile?.organization_id) {
      dashboardCache.invalidate(user.id); // Limpar todos os períodos
      setHasInitialData(false); // Forçar recarregamento
      fetchStats(true); // Buscar dados novamente
      fetchConnectedUsers(); // Buscar usuários conectados novamente
    }
  }, [profile?.organization_id, user?.id, isAgent]); // 🎯 INCLUIR isAgent para limpar quando role mudar

  // 🎯 LIMPAR CACHE QUANDO O PERÍODO MUDAR
  useEffect(() => {
    if (user) {
      dashboardCache.invalidate(user.id, selectedPeriod);
      setHasInitialData(false); // Forçar recarregamento
      fetchStats(true); // Buscar dados novamente
    }
  }, [selectedPeriod, periodRange.start, periodRange.end, user?.id, profile?.organization_id]);


  // Função para formatar números
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  // Função para formatar tempo de resposta
  const formatResponseTime = (minutes: number) => {
    if (!minutes || minutes === 0) return 'N/A';

    // Converter minutos para segundos para ter mais precisão
    const totalSeconds = minutes * 60;
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}h ${mins}m ${seconds}s`;
    } else if (mins > 0) {
      return `${mins}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Componente de indicador de tendência
  const TrendIndicator = ({ value, suffix = "%" }: { value: number; suffix?: string }) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;

    if (isNeutral) {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <div className="h-3 w-3 bg-gray-500 rounded-full" />
          <span className="text-xs">0{suffix}</span>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
        <span className="text-xs">
          {Math.abs(value)}{suffix}
        </span>
      </div>
    );
  };

  // Componente de card de estatística
  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    trend,
    color = "blue"
  }: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
    trend?: number;
    color?: string;
  }) => {

    const iconColorClasses = {
      blue: "text-blue-600",
      green: "text-green-600",
      purple: "text-purple-600",
      orange: "text-orange-600",
      red: "text-red-600",
      gray: "text-gray-600",
      yellow: "text-yellow-600",
      cyan: "text-cyan-600"
    };

    return (
      <Card className="hover:shadow-lg transition-all duration-200 h-[120px] sm:h-[140px] bg-white border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
          <CardTitle className="text-sm sm:text-base truncate pr-2 font-normal text-gray-900">{title}</CardTitle>
          <Icon className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${iconColorClasses[color as keyof typeof iconColorClasses] || iconColorClasses.blue}`} />
        </CardHeader>
        <CardContent className="space-y-1 sm:space-y-2 pt-0">
          <div className="text-lg sm:text-2xl text-gray-900">{value}</div>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
          {trend !== undefined && (
            <div className="flex justify-end">
              <TrendIndicator value={trend} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Componente de ações rápidas
  const QuickActions = () => (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-normal">
          <Star className="h-4 w-4" />
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Button variant="outline" className="h-24 sm:h-32 p-3 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
              window.open('/chat', '_blank');
            } else {
              navigate('/chat');
            }
          }} onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/chat', '_blank');
            }
          }} onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/chat', '_blank');
            }
          }}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <span className="text-xs sm:text-sm text-center">Nova Conversa</span>
            <span className="text-xs text-muted-foreground text-center hidden sm:block">Iniciar chat</span>
          </Button>
          <Button variant="outline" className="h-24 sm:h-32 p-3 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
              window.open('/ai-assistants', '_blank');
            } else {
              navigate('/ai-assistants');
            }
          }} onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/ai-assistants', '_blank');
            }
          }} onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/ai-assistants', '_blank');
            }
          }}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <span className="text-xs sm:text-sm text-center">Criar Assistente</span>
            <span className="text-xs text-muted-foreground text-center hidden sm:block">Configurar IA</span>
          </Button>
          <Button variant="outline" className="h-24 sm:h-32 p-3 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
              window.open('/accounts', '_blank');
            } else {
              navigate('/accounts');
            }
          }} onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/accounts', '_blank');
            }
          }} onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/accounts', '_blank');
            }
          }}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <span className="text-xs sm:text-sm text-center">Conectar Conta</span>
            <span className="text-xs text-muted-foreground text-center hidden sm:block">WhatsApp</span>
          </Button>
          <Button variant="outline" className="h-24 sm:h-32 p-3 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
              window.open('/ai-credits', '_blank');
            } else {
              navigate('/ai-credits');
            }
          }} onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/ai-credits', '_blank');
            }
          }} onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/ai-credits', '_blank');
            }
          }}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Star className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
            </div>
            <span className="text-xs sm:text-sm text-center">Comprar Créditos</span>
            <span className="text-xs text-muted-foreground text-center hidden sm:block">Adquirir tokens</span>
          </Button>
          <Button variant="outline" className="h-24 sm:h-32 p-3 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
              window.open('/report-conversations', '_blank');
            } else {
              navigate('/report-conversations');
            }
          }} onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/report-conversations', '_blank');
            }
          }} onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              window.open('/report-conversations', '_blank');
            }
          }}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
            </div>
            <span className="text-xs sm:text-sm text-center">Relatórios</span>
            <span className="text-xs text-muted-foreground text-center hidden sm:block">Analisar dados</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Componente de atividade recente
  const RecentActivity = () => (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-normal">
          <Clock className="h-4 w-4" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {loadingRecentMessages ? (
            // Skeleton loading enquanto carrega
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md animate-pulse">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-20" />
                    <div className="h-2 bg-gray-200 rounded w-full" />
                  </div>
                  <div className="h-2 bg-gray-200 rounded w-12 flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : recentMessages.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-muted-foreground text-xs">
                {selectedPeriod === 'today' && 'Hoje ainda não houve atividade'}
                {selectedPeriod === '7d' && 'Últimos 7 dias sem atividade'}
                {selectedPeriod === 'current_month' && 'Mês atual sem atividade'}
              </div>
            </div>
          ) : (
            <>
              {recentMessages.slice(0, 5).map((msg, index) => {
                const isSent = msg.is_from_me || msg.sender === 'agent';
                const icon = isSent ? MessageCircle : Users;
                const color = isSent ? 'text-blue-600' : 'text-green-600';
                const who = isSent ? (msg.sender_name || 'Agente') : (msg.sender_name || 'Cliente');
                const content = msg.content ? msg.content.slice(0, 35) + (msg.content.length > 35 ? '...' : '') : '';

                return (
                  <div key={msg.id || index} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {React.createElement(icon, { className: `h-3 w-3 ${color}` })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs truncate">{who}</p>
                        <p className="text-xs text-muted-foreground flex-shrink-0">
                          {dayjs(msg.created_at).fromNow()}
                        </p>
                      </div>
                      {content && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {recentMessages.length > 5 && (
                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    +{recentMessages.length - 5} mais mensagens
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Componente de créditos AI
  const AICreditsOverview = () => {
    const usagePercentage = credits ? (credits.credits_used / credits.credits_purchased) * 100 : 0;

    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-900 font-normal">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <span className="text-base sm:text-lg">Créditos de IA</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 sm:space-y-4">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl text-blue-900 mb-1">
                {formatNumber(credits?.credits_remaining || 0)}
              </div>
              <p className="text-xs sm:text-sm text-blue-700">Créditos restantes</p>
            </div>

            <div className="bg-white rounded-lg p-2 sm:p-3 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm text-gray-700">Uso atual</span>
                <Badge
                  variant={usagePercentage > 80 ? "destructive" : usagePercentage > 50 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {usagePercentage.toFixed(0)}% usado
                </Badge>
              </div>
              <Progress
                value={usagePercentage}
                className="h-2 sm:h-3 bg-blue-100"
                style={{
                  '--progress-background': usagePercentage > 80 ? '#ef4444' : usagePercentage > 50 ? '#3b82f6' : '#10b981'
                } as React.CSSProperties}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-white rounded-lg p-2 sm:p-3 border border-blue-200 text-center">
                <div className="text-sm sm:text-lg text-green-600">
                  {formatNumber(credits?.credits_used || 0)}
                </div>
                <p className="text-xs text-gray-600">Usado</p>
              </div>
              <div className="bg-white rounded-lg p-2 sm:p-3 border border-blue-200 text-center">
                <div className="text-sm sm:text-lg text-blue-600">
                  {formatNumber(credits?.credits_purchased || 0)}
                </div>
                <p className="text-xs text-gray-600">Total</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Componente Analytics que usa o periodRange
  const Analytics = ({ periodRange }: { periodRange: PeriodRange }) => {
    const { analytics, summary, loading: analyticsLoading, powerfulData } = useAnalytics(periodRange);

    if (analyticsLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    // Verificar se são dados de demonstração
    const isDemoData = powerfulData?.isDemoData || false;

    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ProductivityChart selectedPeriod={selectedPeriod} />
          <TimeAnalysis selectedPeriod={selectedPeriod} />
        </div>
        <ScheduleAnalysisChart periodRange={periodRange} />
      </div>
    );
  };


  // Renderização dos widgets principais e secundários, e blocos especiais, só se estiverem habilitados

  // Função utilitária para checar se um widget está habilitado
  const isWidgetEnabled = (type: string) => widgets.find(w => w.widget_type === type && w.is_enabled);

  // Função utilitária para checar se um widget existe (independente do status)
  const getWidget = (type: string) => widgets.find(w => w.widget_type === type);

  // Função utilitária para verificar se deve exibir um widget no dashboard
  const shouldShowWidget = (type: string) => {
    const widget = getWidget(type);
    const shouldShow = widget && widget.is_enabled;

    return shouldShow;
  };

  if (loading && !refreshing && !hasInitialData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
          <p className="text-lg">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-6 bg-gray-100 min-h-screen">
      {/* Header Mobile-First */}
      <div className="space-y-4">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={(value: 'today' | '7d' | 'current_month') => setSelectedPeriod(value)}>
                <SelectTrigger className="w-auto min-w-[120px]">
                  <SelectValue placeholder="Selecionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="current_month">Mês atual</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`${autoRefreshEnabled ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                title={autoRefreshEnabled ? 'Auto: Ativo' : 'Auto: Pausado'}
              >
                {autoRefreshEnabled ? (
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                ) : (
                  <div className="h-2 w-2 bg-gray-400 rounded-full" />
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (user) {
                    dashboardCache.invalidate(user.id, selectedPeriod);
                  }
                  fetchStats(true);
                  fetchConnectedUsers();
                }}
                disabled={refreshing}
                title="Atualizar"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Visão geral das métricas e performance da equipe
          </p>
        </div>

        {/* Controles Mobile-First */}
        {isUsingCache && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
            <RefreshCw className="h-4 w-4" />
            Dados do cache
          </div>
        )}
      </div>

      {/* Controles de Widgets */}
      {showWidgetControls && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-normal">
              <Eye className="h-5 w-5" />
              Configuração de Widgets
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Controle quais widgets aparecem no seu dashboard
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {widgets.map((widget) => {
                const widgetName = WIDGET_NAMES[widget.widget_type] || widget.widget_type;
                const widgetDescription = WIDGET_DESCRIPTIONS[widget.widget_type] || 'Widget do dashboard';

                return (
                  <div key={widget.id} className="relative flex flex-col p-3 sm:p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors min-h-[100px] sm:min-h-[120px]">
                    <div className="flex items-start gap-2 sm:gap-3 flex-1">
                      <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-white rounded-full shadow-sm flex-shrink-0">
                        {widget.is_enabled ? (
                          <Eye className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-gray-900 mb-1">{widgetName}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{widgetDescription}</p>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-4 flex justify-end">
                      <Button
                        variant={widget.is_enabled ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleWidget(widget.id)}
                        className="w-full sm:w-auto text-xs"
                      >
                        {widget.is_enabled ? (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" /> Ocultar
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" /> Exibir
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
              <Button
                variant="outline"
                onClick={resetToDefault}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Restaurar Padrão
              </Button>
              <Button
                onClick={() => setShowWidgetControls(false)}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <CheckCircle className="w-4 h-4" />
                Concluído
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Abas principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={cn(
          "h-auto w-full gap-1 p-1",
          isAgent ? "grid-cols-1 sm:h-10 sm:grid-cols-1" : "grid-cols-1 sm:h-10 sm:grid-cols-3"
        )}>
          <TabsTrigger value="overview" className="text-sm">Visão Geral</TabsTrigger>
          {!isAgent && (
            <>
              <TabsTrigger value="individual" className="text-sm">Métricas Individuais</TabsTrigger>
              <TabsTrigger value="teams" className="text-sm">Métricas de Times</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          {/* Grid de widgets principais */}
          <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {/* Widget de Total de Mensagens */}
            {shouldShowWidget('total_messages') && (
              <StatCard
                title="Total de Mensagens"
                value={formatNumber(stats.totalMessages)}
                icon={MessageCircle}
                description="Mensagens da plataforma"
                color="green"
              />
            )}

            {/* Widget de Mensagens Enviadas */}
            {shouldShowWidget('sent_messages') && (
              <StatCard
                title="Mensagens Enviadas"
                value={formatNumber(stats.sentMessages || 0)}
                icon={Send}
                description="Mensagens enviadas"
                color="purple"
              />
            )}

            {/* Widget de Mensagens Recebidas */}
            {shouldShowWidget('received_messages') && (
              <StatCard
                title="Mensagens Recebidas"
                value={formatNumber(stats.receivedMessages || 0)}
                icon={Download}
                description="Mensagens recebidas"
                color="orange"
              />
            )}

            {/* ===== OCULTO: Widget de Assistentes (não será exibido) */}
            {/* {shouldShowWidget('assistants_created') && (
              <StatCard
                title="Assistentes"
                value={formatNumber(stats.assistantsCreated)}
                icon={Settings}
                description="Assistentes configurados"
                color="indigo"
              />
            )} */}

            {/* Widget de Usuários Conectados */}
            {shouldShowWidget('users') && (
              <StatCard
                title="Usuários Conectados"
                value={formatNumber(connectedUsersCount)}
                icon={Users}
                description="Números conectados da organização"
                color="cyan"
              />
            )}

            {/* ===== OCULTO: Widget de Tempo de Resposta (não será exibido) */}
            {/* {shouldShowWidget('response_time') && (
              <StatCard
                title="Tempo de Resposta"
                value={formatResponseTime(stats.avgResponseTime)}
                icon={Clock}
                description="Tempo médio"
                color="yellow"
              />
            )} */}
          </div>

          {/* Widgets especiais em grid 2x2 */}
          <div className="grid gap-3 sm:gap-6 grid-cols-1 md:grid-cols-2">
            {/* Widget de Atividade Recente */}
            {shouldShowWidget('recent_activity') && <RecentActivity />}

            {/* Widget de Comparativo de Usuários */}
            <UserComparisonChart selectedPeriod={selectedPeriod} />
          </div>

          {/* Novos widgets em grid 2x2 */}
          <div className="grid gap-3 sm:gap-6 grid-cols-1 md:grid-cols-2">
            {/* Widget de Heatmap de Atividade */}
            <HeatmapCard selectedPeriod={selectedPeriod} />

            {/* Widget de Resumo da Operação com IA */}
            <AIOperationSummary selectedPeriod={selectedPeriod} />
          </div>

          {/* ===== OCULTO: Widget de Ações Rápidas (não será exibido) */}
          {/* {shouldShowWidget('quick_actions') && (
            <div className="w-full">
              <QuickActions />
            </div>
          )} */}
        </TabsContent>

        {/* Temporariamente removido
        <TabsContent value="analytics" className="space-y-6">
          <Analytics periodRange={periodRange} />
        </TabsContent>
        */}

        <TabsContent value="individual" className="space-y-6">
          <IndividualMetrics periodRange={periodRange} />
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <TeamMetrics periodRange={periodRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
};