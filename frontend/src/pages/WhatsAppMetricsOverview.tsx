import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  MessageCircle,
  Clock,
  Target,
  TrendingUp,
  Users,
  Activity,
  Timer,
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnifiedReports } from '@/hooks/useUnifiedReports';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface WhatsAppMetrics {
  total_usage_time_minutes: number;
  active_time_minutes: number;
  idle_time_minutes: number;
  total_messages_sent: number;
  total_messages_received: number;
  avg_response_time_seconds: number;
  productivity_score: number;
  efficiency_score: number;
  engagement_score: number;
  activity_heatmap: { [key: string]: number };
  peak_hours: number[];
}

interface MetricsSummary {
  totalDays: number;
  totalUsageTime: number;
  totalActiveTime: number;
  totalMessages: number;
  avgProductivity: number;
  avgEfficiency: number;
  avgResponseTime: number;
  period: string;
}

const WhatsAppMetricsOverview: React.FC = () => {
  const { user } = useAuth();
  const { data, loading, error, filters, updateFilters, fetchWithFilters } = useUnifiedReports();
  const { selectedPeriod, setSelectedPeriod, getDateRange } = useDashboardContext();
  const [refreshing, setRefreshing] = useState(false);

  // Atualizar filtros quando o período mudar
  useEffect(() => {
    const { start, end } = getDateRange();
    const newFilters = {
      dateRange: { start, end }
    };
    
    updateFilters(newFilters);
    fetchWithFilters(newFilters);
  }, [selectedPeriod, getDateRange, updateFilters, fetchWithFilters]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const { start, end } = getDateRange();
    const newFilters = {
      dateRange: { start, end }
    };
    
    await fetchWithFilters(newFilters);
    setRefreshing(false);
  };

  // ✅ OTIMIZAÇÃO: Memoizar funções de formatação
  const formatTime = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }, []);

  const formatSeconds = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  }, []);


  // ✅ OTIMIZAÇÃO: Memoizar transformações de dados pesadas
  const heatmapData = useMemo(() => {
    if (!data?.messages) return {};
    return data.messages.reduce((acc, msg) => {
      const hour = new Date(msg.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  }, [data?.messages]);

  const heatmapChartData = useMemo(() => {
    return Object.entries(heatmapData).map(([hour, activity]) => ({
      hour: `${hour}:00`,
      activity,
      hourNum: parseInt(hour)
    })).sort((a, b) => a.hourNum - b.hourNum);
  }, [heatmapData]);

  // ✅ OTIMIZAÇÃO: Memoizar dados do gráfico de mensagens
  const messagesData = useMemo(() => {
    if (!data?.messages) return [];
    const sent = data.messages.filter(m => m.is_from_me).length;
    const received = data.messages.filter(m => !m.is_from_me).length;
    return [
      { name: 'Enviadas', value: sent, color: '#3b82f6' },
      { name: 'Recebidas', value: received, color: '#8b5cf6' }
    ];
  }, [data?.messages]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Carregando métricas do WhatsApp...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
          <h2 className="text-xl text-gray-600 mb-2">Erro ao carregar dados</h2>
          <p className="text-gray-500 text-center mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl text-gray-600 mb-2">Nenhum dado encontrado</h2>
          <p className="text-gray-500 text-center mb-4">
            Não há dados de mensagens do WhatsApp para o período selecionado.
          </p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Métricas WhatsApp</h1>
          <p className="text-gray-600 mt-1">
            Visão geral da produtividade do WhatsApp (dados reais)
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Mensagens</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {data?.globalStats?.totalMessages || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Mensagens do WhatsApp no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {data?.globalStats?.activeUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              de {data?.globalStats?.totalUsers || 0} usuários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Conversas Ativas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {data?.globalStats?.activeConversations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              de {data?.globalStats?.totalConversations || 0} conversas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Tempo Médio de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {data?.globalStats?.averageResponseTime ? 
                formatResponseTime(data.globalStats.averageResponseTime) : '0m 0s'}
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo médio de resposta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mapa de Atividade por Hora */}
        <Card>
          <CardHeader>
            <CardTitle>Atividade por Hora</CardTitle>
          </CardHeader>
          <CardContent>
            {heatmapChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={heatmapChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="activity" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Nenhum dado de atividade disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição de Mensagens */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Mensagens</CardTitle>
          </CardHeader>
          <CardContent>
            {messagesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={messagesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {messagesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Nenhum dado de mensagens disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Total de Usuários</span>
              <Badge variant="secondary">{data?.globalStats?.totalUsers || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Usuários Ativos</span>
              <Badge variant="outline">{data?.globalStats?.activeUsers || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Assistentes Criados</span>
              <Badge variant="default">{data?.globalStats?.assistantsCreated || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Créditos IA</span>
              <Badge variant="secondary">{data?.globalStats?.aiCredits || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Total de Mensagens</span>
              <Badge variant="default">{data?.globalStats?.totalMessages || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Enviadas</span>
              <Badge variant="secondary">{messagesData.find(m => m.name === 'Enviadas')?.value || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Recebidas</span>
              <Badge variant="outline">{messagesData.find(m => m.name === 'Recebidas')?.value || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Respostas IA</span>
              <Badge variant="default">{data?.globalStats?.aiResponses || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Produtividade Média</span>
              <Badge variant="default">{data?.globalStats?.averageProductivity?.toFixed(1) || 0}%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Satisfação Média</span>
              <Badge variant="secondary">{data?.globalStats?.averageSatisfaction?.toFixed(1) || 0}%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Tempo de Resposta</span>
              <Badge variant="outline">
                {data?.globalStats?.averageResponseTime ? 
                  formatResponseTime(data.globalStats.averageResponseTime) : '0m 0s'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Conversas Ativas</span>
              <Badge variant="default">{data?.globalStats?.activeConversations || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default WhatsAppMetricsOverview;
