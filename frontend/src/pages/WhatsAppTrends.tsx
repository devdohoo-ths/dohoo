import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  MessageCircle,
  Clock,
  Target,
  RefreshCw,
  Calendar,
  Zap,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase } from '@/utils/apiBase';

interface TrendData {
  date: string;
  productivity_score: number;
  efficiency_score: number;
  engagement_score: number;
  total_messages: number;
  total_usage_time_minutes: number;
  active_time_minutes: number;
  avg_response_time_seconds: number;
}

const WhatsAppTrends: React.FC = () => {
  const { user } = useAuth();
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('productivity');

  useEffect(() => {
    fetchTrendData();
  }, [selectedPeriod]);

  const fetchTrendData = async () => {
    try {
      setLoading(true);
      
      const endDate = new Date().toISOString().split('T')[0];
      let startDate = '';
      
      switch (selectedPeriod) {
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '90d':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      // ✅ DESABILITADO: API removida - whatsapp_productivity_metrics não é mais usado
      // ✅ Mock response para evitar erros
      const response = {
        ok: true,
        json: async () => ({ success: true, data: [] })
      } as any;
      
      // const response = await fetch(`${apiBase}/api/whatsapp-productivity/my-metrics?startDate=${startDate}&endDate=${endDate}`, {
      //   headers: {
      //     'Authorization': 'Bearer dohoo_dev_token_2024',
      //     'Content-Type': 'application/json',
      //   }
      // });
      
      const data = await response.json();
      
      if (data.success) {
        const formattedData = data.data.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('pt-BR', { 
            month: 'short', 
            day: 'numeric' 
          }),
          productivity_score: item.productivity_score || 0,
          efficiency_score: item.efficiency_score || 0,
          engagement_score: item.engagement_score || 0,
          total_messages: (item.total_messages_sent || 0) + (item.total_messages_received || 0),
          total_usage_time_minutes: item.total_usage_time_minutes || 0,
          active_time_minutes: item.active_time_minutes || 0,
          avg_response_time_seconds: item.avg_response_time_seconds || 0
        }));
        
        setTrendData(formattedData);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de tendências:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrendData();
    setRefreshing(false);
  };

  const getTrendDirection = (data: number[]) => {
    if (data.length < 2) return 'stable';
    
    const first = data[0];
    const last = data[data.length - 1];
    const change = ((last - first) / first) * 100;
    
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  };

  const getProductivityTrend = () => {
    const scores = trendData.map(item => item.productivity_score);
    return getTrendDirection(scores);
  };

  const getEfficiencyTrend = () => {
    const scores = trendData.map(item => item.efficiency_score);
    return getTrendDirection(scores);
  };

  const getMessagesTrend = () => {
    const messages = trendData.map(item => item.total_messages);
    return getTrendDirection(messages);
  };

  const getUsageTimeTrend = () => {
    const usage = trendData.map(item => item.total_usage_time_minutes);
    return getTrendDirection(usage);
  };

  const getAverageProductivity = () => {
    if (trendData.length === 0) return 0;
    return Math.round(
      trendData.reduce((sum, item) => sum + item.productivity_score, 0) / trendData.length
    );
  };

  const getAverageEfficiency = () => {
    if (trendData.length === 0) return 0;
    return Math.round(
      trendData.reduce((sum, item) => sum + item.efficiency_score, 0) / trendData.length
    );
  };

  const getTotalMessages = () => {
    return trendData.reduce((sum, item) => sum + item.total_messages, 0);
  };

  const getTotalUsageTime = () => {
    return trendData.reduce((sum, item) => sum + item.total_usage_time_minutes, 0);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatSeconds = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const productivityTrend = getProductivityTrend();
  const efficiencyTrend = getEfficiencyTrend();
  const messagesTrend = getMessagesTrend();
  const usageTimeTrend = getUsageTimeTrend();

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Carregando tendências...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Tendências WhatsApp</h1>
          <p className="text-gray-600 mt-1">Análise de tendências e evolução das métricas</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
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

      {/* Cards de Tendências */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Produtividade</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{getAverageProductivity()}%</div>
            <div className="flex items-center gap-2 mt-2">
              {getTrendIcon(productivityTrend)}
              <span className={`text-sm ${getTrendColor(productivityTrend)}`}>
                {productivityTrend === 'up' ? 'Crescendo' : 
                 productivityTrend === 'down' ? 'Decrescendo' : 'Estável'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Eficiência</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{getAverageEfficiency()}%</div>
            <div className="flex items-center gap-2 mt-2">
              {getTrendIcon(efficiencyTrend)}
              <span className={`text-sm ${getTrendColor(efficiencyTrend)}`}>
                {efficiencyTrend === 'up' ? 'Crescendo' : 
                 efficiencyTrend === 'down' ? 'Decrescendo' : 'Estável'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Mensagens</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{getTotalMessages()}</div>
            <div className="flex items-center gap-2 mt-2">
              {getTrendIcon(messagesTrend)}
              <span className={`text-sm ${getTrendColor(messagesTrend)}`}>
                {messagesTrend === 'up' ? 'Crescendo' : 
                 messagesTrend === 'down' ? 'Decrescendo' : 'Estável'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Tempo de Uso</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatTime(getTotalUsageTime())}</div>
            <div className="flex items-center gap-2 mt-2">
              {getTrendIcon(usageTimeTrend)}
              <span className={`text-sm ${getTrendColor(usageTimeTrend)}`}>
                {usageTimeTrend === 'up' ? 'Crescendo' : 
                 usageTimeTrend === 'down' ? 'Decrescendo' : 'Estável'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Principal de Tendências */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Evolução das Métricas</CardTitle>
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="productivity">Produtividade</SelectItem>
                <SelectItem value="efficiency">Eficiência</SelectItem>
                <SelectItem value="engagement">Engajamento</SelectItem>
                <SelectItem value="messages">Mensagens</SelectItem>
                <SelectItem value="usage">Tempo de Uso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey={selectedMetric === 'messages' ? 'total_messages' : 
                        selectedMetric === 'usage' ? 'total_usage_time_minutes' :
                        `${selectedMetric}_score`}
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráficos Comparativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtividade vs Eficiência */}
        <Card>
          <CardHeader>
            <CardTitle>Produtividade vs Eficiência</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="productivity_score" fill="#3b82f6" name="Produtividade" />
                <Line yAxisId="right" type="monotone" dataKey="efficiency_score" stroke="#10b981" strokeWidth={2} name="Eficiência" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Mensagens vs Tempo de Uso */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens vs Tempo de Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="total_messages" fill="#8b5cf6" name="Mensagens" />
                <Line yAxisId="right" type="monotone" dataKey="total_usage_time_minutes" stroke="#f59e0b" strokeWidth={2} name="Tempo (min)" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Correlação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análise de Correlação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl text-blue-600">
                {trendData.length > 0 ? 
                  Math.round((trendData.reduce((sum, item) => sum + item.productivity_score, 0) / trendData.length) * 100) / 100 : 0
                }
              </div>
              <div className="text-sm text-blue-800">Produtividade Média</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl text-green-600">
                {trendData.length > 0 ? 
                  Math.round((trendData.reduce((sum, item) => sum + item.efficiency_score, 0) / trendData.length) * 100) / 100 : 0
                }
              </div>
              <div className="text-sm text-green-800">Eficiência Média</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl text-purple-600">
                {trendData.length > 0 ? 
                  Math.round(trendData.reduce((sum, item) => sum + item.total_messages, 0) / trendData.length) : 0
                }
              </div>
              <div className="text-sm text-purple-800">Mensagens/Dia</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights e Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Insights e Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {productivityTrend === 'up' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <div className="text-sm text-green-800">
                    Produtividade em Crescimento
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    Sua produtividade está aumentando ao longo do tempo. Continue mantendo esse ritmo!
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {productivityTrend === 'down' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <div className="text-sm text-red-800">
                    Produtividade em Declínio
                  </div>
                  <div className="text-xs text-red-700 mt-1">
                    Sua produtividade está diminuindo. Considere revisar suas práticas e otimizar seu tempo.
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {messagesTrend === 'up' && usageTimeTrend === 'down' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="text-sm text-blue-800">
                    Eficiência Melhorando
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Você está enviando mais mensagens em menos tempo. Excelente evolução!
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {trendData.length === 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-800">
                    Dados Insuficientes
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    Não há dados suficientes para gerar insights. Continue usando o WhatsApp para ver as tendências.
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppTrends;
