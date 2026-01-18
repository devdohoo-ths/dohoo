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
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  MessageCircle,
  Activity,
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Award,
  Star
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase } from '@/utils/apiBase';

interface ProductivityData {
  date: string;
  productivity_score: number;
  efficiency_score: number;
  engagement_score: number;
  total_messages: number;
  avg_response_time: number;
  active_time_minutes: number;
}

const WhatsAppProductivity: React.FC = () => {
  const { user } = useAuth();
  const [productivityData, setProductivityData] = useState<ProductivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProductivityData();
  }, [selectedPeriod]);

  const fetchProductivityData = async () => {
    try {
      setLoading(true);
      
      const endDate = new Date().toISOString().split('T')[0];
      let startDate = '';
      
      switch (selectedPeriod) {
        case '24h':
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        default:
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      // ✅ DESABILITADO: API removida - whatsapp_productivity_metrics não é mais usado
      // const response = await fetch(`${apiBase}/api/whatsapp-productivity/my-metrics?startDate=${startDate}&endDate=${endDate}`, {
      //   headers: {
      //     'Authorization': 'Bearer dohoo_dev_token_2024',
      //     'Content-Type': 'application/json',
      //   }
      // });
      // 
      // const data = await response.json();
      // 
      // if (data.success) {
      //   const formattedData = data.data.map((item: any) => ({
      //     date: new Date(item.date).toLocaleDateString('pt-BR', { 
      //       month: 'short', 
      //       day: 'numeric' 
      //     }),
      //     productivity_score: item.productivity_score || 0,
      //     efficiency_score: item.efficiency_score || 0,
      //     engagement_score: item.engagement_score || 0,
      //     total_messages: (item.total_messages_sent || 0) + (item.total_messages_received || 0),
      //     avg_response_time: item.avg_response_time_seconds || 0,
      //     active_time_minutes: item.active_time_minutes || 0
      //   }));
      //   
      //   setProductivityData(formattedData);
      // }
      
      // ✅ Retornar array vazio pois API não está mais disponível
      setProductivityData([]);
    } catch (error) {
      console.error('Erro ao buscar dados de produtividade:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProductivityData();
    setRefreshing(false);
  };

  // ✅ OTIMIZAÇÃO: Memoizar cálculos pesados
  const productivityTrend = useMemo(() => {
    if (productivityData.length < 2) return 'stable';
    const first = productivityData[0].productivity_score;
    const last = productivityData[productivityData.length - 1].productivity_score;
    if (last > first + 5) return 'up';
    if (last < first - 5) return 'down';
    return 'stable';
  }, [productivityData]);

  const averageProductivity = useMemo(() => {
    if (productivityData.length === 0) return 0;
    return Math.round(
      productivityData.reduce((sum, item) => sum + item.productivity_score, 0) / productivityData.length
    );
  }, [productivityData]);

  const averageEfficiency = useMemo(() => {
    if (productivityData.length === 0) return 0;
    return Math.round(
      productivityData.reduce((sum, item) => sum + item.efficiency_score, 0) / productivityData.length
    );
  }, [productivityData]);

  const averageEngagement = useMemo(() => {
    if (productivityData.length === 0) return 0;
    return Math.round(
      productivityData.reduce((sum, item) => sum + item.engagement_score, 0) / productivityData.length
    );
  }, [productivityData]);

  const totalMessages = useMemo(() => {
    return productivityData.reduce((sum, item) => sum + item.total_messages, 0);
  }, [productivityData]);

  const averageResponseTime = useMemo(() => {
    if (productivityData.length === 0) return 0;
    return Math.round(
      productivityData.reduce((sum, item) => sum + item.avg_response_time, 0) / productivityData.length
    );
  }, [productivityData]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getProductivityLevel = (score: number) => {
    if (score >= 80) return { level: 'Excelente', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (score >= 60) return { level: 'Bom', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (score >= 40) return { level: 'Regular', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { level: 'Precisa Melhorar', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  // ✅ OTIMIZAÇÃO: Usar valores memoizados ao invés de funções
  const trend = productivityTrend;
  const avgProductivity = averageProductivity;
  const avgEfficiency = averageEfficiency;
  const avgEngagement = averageEngagement;
  const totalMessagesValue = totalMessages;
  const avgResponseTime = averageResponseTime;
  const productivityLevel = getProductivityLevel(avgProductivity);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Carregando dados de produtividade...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Produtividade WhatsApp</h1>
          <p className="text-gray-600 mt-1">Análise detalhada da sua produtividade no WhatsApp</p>
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
            <CardTitle className="text-sm">Produtividade Média</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{avgProductivity}%</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`${productivityLevel.bgColor} ${productivityLevel.color}`}>
                {productivityLevel.level}
              </Badge>
              {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
              {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Eficiência Média</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{avgEfficiency}%</div>
            <Progress value={avgEfficiency} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Engajamento</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{avgEngagement}%</div>
            <Progress value={avgEngagement} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Mensagens</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{totalMessagesValue}</div>
            <p className="text-xs text-muted-foreground">
              {productivityData.length} dias analisados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendência de Produtividade */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução da Produtividade</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={productivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="productivity_score" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Produtividade"
              />
              <Line 
                type="monotone" 
                dataKey="efficiency_score" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Eficiência"
              />
              <Line 
                type="monotone" 
                dataKey="engagement_score" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="Engajamento"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráficos de Atividade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mensagens por Dia */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_messages" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tempo Ativo por Dia */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo Ativo por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [formatMinutes(value as number), 'Tempo Ativo']} />
                <Area 
                  type="monotone" 
                  dataKey="active_time_minutes" 
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tempo de Resposta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl text-blue-600">
                {formatTime(avgResponseTime)}
              </div>
              <p className="text-sm text-gray-600">Tempo médio de resposta</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Excelente</span>
                <span className="text-green-600">&lt; 2min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Bom</span>
                <span className="text-blue-600">2-5min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Regular</span>
                <span className="text-yellow-600">5-10min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Precisa Melhorar</span>
                <span className="text-red-600">&gt; 10min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Resumo de Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Produtividade</span>
                <div className="flex items-center gap-2">
                  <Progress value={avgProductivity} className="w-20" />
                  <span className="text-sm">{avgProductivity}%</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Eficiência</span>
                <div className="flex items-center gap-2">
                  <Progress value={avgEfficiency} className="w-20" />
                  <span className="text-sm">{avgEfficiency}%</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Engajamento</span>
                <div className="flex items-center gap-2">
                  <Progress value={avgEngagement} className="w-20" />
                  <span className="text-sm">{avgEngagement}%</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="text-center">
                <div className="text-lg text-gray-900">
                  {productivityLevel.level}
                </div>
                <p className="text-sm text-gray-600">
                  Nível de produtividade atual
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppProductivity;
