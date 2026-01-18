import React, { useState, useEffect } from 'react';
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
  Timer,
  Clock,
  Activity,
  Pause,
  Play,
  Target,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  Zap,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase } from '@/utils/apiBase';

interface UsageTimeData {
  date: string;
  total_usage_time_minutes: number;
  active_time_minutes: number;
  idle_time_minutes: number;
  break_time_minutes: number;
  productivity_score: number;
  efficiency_score: number;
}

const WhatsAppUsageTime: React.FC = () => {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageTimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUsageData();
  }, [selectedPeriod]);

  const fetchUsageData = async () => {
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
          total_usage_time_minutes: item.total_usage_time_minutes || 0,
          active_time_minutes: item.active_time_minutes || 0,
          idle_time_minutes: item.idle_time_minutes || 0,
          break_time_minutes: item.break_time_minutes || 0,
          productivity_score: item.productivity_score || 0,
          efficiency_score: item.efficiency_score || 0
        }));
        
        setUsageData(formattedData);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de uso:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsageData();
    setRefreshing(false);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getTotalUsageTime = () => {
    return usageData.reduce((sum, item) => sum + item.total_usage_time_minutes, 0);
  };

  const getTotalActiveTime = () => {
    return usageData.reduce((sum, item) => sum + item.active_time_minutes, 0);
  };

  const getTotalIdleTime = () => {
    return usageData.reduce((sum, item) => sum + item.idle_time_minutes, 0);
  };

  const getAverageUsageTime = () => {
    if (usageData.length === 0) return 0;
    return Math.round(getTotalUsageTime() / usageData.length);
  };

  const getAverageActiveTime = () => {
    if (usageData.length === 0) return 0;
    return Math.round(getTotalActiveTime() / usageData.length);
  };

  const getEfficiencyRatio = () => {
    const totalUsage = getTotalUsageTime();
    const totalActive = getTotalActiveTime();
    return totalUsage > 0 ? Math.round((totalActive / totalUsage) * 100) : 0;
  };

  const getUsageTrend = () => {
    if (usageData.length < 2) return 'stable';
    
    const first = usageData[0].total_usage_time_minutes;
    const last = usageData[usageData.length - 1].total_usage_time_minutes;
    
    if (last > first + 30) return 'up';
    if (last < first - 30) return 'down';
    return 'stable';
  };

  const getUsageLevel = (minutes: number) => {
    if (minutes >= 480) return { level: 'Muito Alto', color: 'text-red-600', bgColor: 'bg-red-100' };
    if (minutes >= 360) return { level: 'Alto', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    if (minutes >= 240) return { level: 'Moderado', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (minutes >= 120) return { level: 'Baixo', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    return { level: 'Muito Baixo', color: 'text-green-600', bgColor: 'bg-green-100' };
  };

  // Dados para o gráfico de pizza de distribuição de tempo
  const timeDistributionData = [
    { name: 'Tempo Ativo', value: getTotalActiveTime(), color: '#10b981' },
    { name: 'Tempo Ocioso', value: getTotalIdleTime(), color: '#f59e0b' }
  ];

  // Dados para o gráfico de barras de uso diário
  const dailyUsageData = usageData.map(item => ({
    ...item,
    total_hours: Math.round(item.total_usage_time_minutes / 60 * 10) / 10,
    active_hours: Math.round(item.active_time_minutes / 60 * 10) / 10
  }));

  const trend = getUsageTrend();
  const totalUsage = getTotalUsageTime();
  const totalActive = getTotalActiveTime();
  const avgUsage = getAverageUsageTime();
  const avgActive = getAverageActiveTime();
  const efficiencyRatio = getEfficiencyRatio();
  const usageLevel = getUsageLevel(avgUsage);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Carregando dados de uso...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Tempo de Uso WhatsApp</h1>
          <p className="text-gray-600 mt-1">Análise detalhada do tempo gasto no WhatsApp</p>
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
            <CardTitle className="text-sm">Tempo Total</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatTime(totalUsage)}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`${usageLevel.bgColor} ${usageLevel.color}`}>
                {usageLevel.level}
              </Badge>
              {trend === 'up' && <TrendingUp className="h-4 w-4 text-red-600" />}
              {trend === 'down' && <TrendingDown className="h-4 w-4 text-green-600" />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Tempo Ativo</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatTime(totalActive)}</div>
            <p className="text-xs text-muted-foreground">
              {efficiencyRatio}% do tempo total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Média Diária</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatTime(avgUsage)}</div>
            <p className="text-xs text-muted-foreground">
              {usageData.length} dias analisados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Eficiência</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{efficiencyRatio}%</div>
            <Progress value={efficiencyRatio} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uso Diário */}
        <Card>
          <CardHeader>
            <CardTitle>Uso Diário (Horas)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  `${value}h`, 
                  name === 'total_hours' ? 'Total' : 'Ativo'
                ]} />
                <Bar dataKey="total_hours" fill="#3b82f6" name="total_hours" />
                <Bar dataKey="active_hours" fill="#10b981" name="active_hours" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição de Tempo */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={timeDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {timeDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatTime(value as number), 'Tempo']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendência */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução do Tempo de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyUsageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value, name) => [
                `${value}h`, 
                name === 'total_hours' ? 'Tempo Total' : 'Tempo Ativo'
              ]} />
              <Area 
                type="monotone" 
                dataKey="total_hours" 
                stackId="1"
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.6}
                name="total_hours"
              />
              <Area 
                type="monotone" 
                dataKey="active_hours" 
                stackId="2"
                stroke="#10b981" 
                fill="#10b981" 
                fillOpacity={0.8}
                name="active_hours"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Análise Detalhada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Análise de Eficiência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Tempo Ativo</span>
                <div className="flex items-center gap-2">
                  <Progress value={efficiencyRatio} className="w-20" />
                  <span className="text-sm">{efficiencyRatio}%</span>
                </div>
              </div>
              
              <div className="text-center py-4">
                <div className="text-2xl text-blue-600">
                  {formatTime(avgActive)}
                </div>
                <p className="text-sm text-gray-600">Tempo ativo médio por dia</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="text-center">
                <div className="text-lg text-gray-900">
                  {efficiencyRatio >= 70 ? 'Excelente' : 
                   efficiencyRatio >= 50 ? 'Bom' : 
                   efficiencyRatio >= 30 ? 'Regular' : 'Precisa Melhorar'}
                </div>
                <p className="text-sm text-gray-600">
                  Nível de eficiência no uso do tempo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {efficiencyRatio < 50 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800">
                      Baixa Eficiência
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Considere reduzir o tempo ocioso e focar mais nas conversas ativas.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {avgUsage > 480 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800">
                      Uso Excessivo
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Considere fazer pausas regulares para manter a produtividade.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {efficiencyRatio >= 70 && avgUsage <= 480 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-800">
                      Uso Equilibrado
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Você está usando o WhatsApp de forma eficiente e equilibrada.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppUsageTime;
