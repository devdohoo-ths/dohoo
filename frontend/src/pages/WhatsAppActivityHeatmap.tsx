import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Heatmap
} from 'recharts';
import {
  Activity,
  Clock,
  TrendingUp,
  Calendar,
  RefreshCw,
  Zap,
  Target,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase } from '@/utils/apiBase';

interface ActivityData {
  date: string;
  activity_heatmap: { [key: string]: number };
  peak_hours: number[];
  total_messages: number;
  productivity_score: number;
}

const WhatsAppActivityHeatmap: React.FC = () => {
  const { user } = useAuth();
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    fetchActivityData();
  }, [selectedPeriod]);

  useEffect(() => {
    if (activityData.length > 0 && !selectedDate) {
      setSelectedDate(activityData[activityData.length - 1].date);
    }
  }, [activityData, selectedDate]);

  const fetchActivityData = async () => {
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
          activity_heatmap: item.activity_heatmap || {},
          peak_hours: item.peak_hours || [],
          total_messages: (item.total_messages_sent || 0) + (item.total_messages_received || 0),
          productivity_score: item.productivity_score || 0
        }));
        
        setActivityData(formattedData);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de atividade:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActivityData();
    setRefreshing(false);
  };

  const getSelectedDayData = () => {
    return activityData.find(item => item.date === selectedDate);
  };

  const generateHeatmapData = () => {
    const selectedDay = getSelectedDayData();
    if (!selectedDay) return [];

    const heatmapData = [];
    for (let hour = 0; hour < 24; hour++) {
      const activity = selectedDay.activity_heatmap[hour] || 0;
      heatmapData.push({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        hourNum: hour,
        activity,
        intensity: Math.min(100, (activity / 10) * 100) // Normalizar para 0-100
      });
    }
    return heatmapData;
  };

  const generateWeeklyHeatmap = () => {
    const weeklyData = [];
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    activityData.forEach((dayData, index) => {
      const dayName = days[new Date(dayData.date).getDay()];
      const heatmap = dayData.activity_heatmap;
      
      for (let hour = 0; hour < 24; hour++) {
        weeklyData.push({
          day: dayName,
          hour: hour,
          activity: heatmap[hour] || 0,
          intensity: Math.min(100, ((heatmap[hour] || 0) / 10) * 100)
        });
      }
    });
    
    return weeklyData;
  };

  const getPeakHours = () => {
    const selectedDay = getSelectedDayData();
    return selectedDay?.peak_hours || [];
  };

  const getTotalActivity = () => {
    const selectedDay = getSelectedDayData();
    if (!selectedDay) return 0;
    
    return Object.values(selectedDay.activity_heatmap).reduce((sum, activity) => sum + activity, 0);
  };

  const getMostActiveHour = () => {
    const selectedDay = getSelectedDayData();
    if (!selectedDay) return null;
    
    const heatmap = selectedDay.activity_heatmap;
    let maxActivity = 0;
    let mostActiveHour = 0;
    
    for (let hour = 0; hour < 24; hour++) {
      if (heatmap[hour] > maxActivity) {
        maxActivity = heatmap[hour];
        mostActiveHour = hour;
      }
    }
    
    return { hour: mostActiveHour, activity: maxActivity };
  };

  const getActivityLevel = (intensity: number) => {
    if (intensity >= 80) return { level: 'Muito Alto', color: 'bg-red-500' };
    if (intensity >= 60) return { level: 'Alto', color: 'bg-orange-500' };
    if (intensity >= 40) return { level: 'Médio', color: 'bg-yellow-500' };
    if (intensity >= 20) return { level: 'Baixo', color: 'bg-blue-500' };
    return { level: 'Muito Baixo', color: 'bg-gray-300' };
  };

  const heatmapData = generateHeatmapData();
  const weeklyHeatmap = generateWeeklyHeatmap();
  const peakHours = getPeakHours();
  const totalActivity = getTotalActivity();
  const mostActiveHour = getMostActiveHour();

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Carregando mapa de atividade...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Mapa de Atividade</h1>
          <p className="text-gray-600 mt-1">Visualização da atividade por hora do dia</p>
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

      {/* Seleção de Data */}
      {activityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Selecionar Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityData.map((item) => (
                  <SelectItem key={item.date} value={item.date}>
                    {item.date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Atividade Total</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{totalActivity}</div>
            <p className="text-xs text-muted-foreground">
              mensagens no dia selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Hora Mais Ativa</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {mostActiveHour ? `${mostActiveHour.hour}:00` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {mostActiveHour ? `${mostActiveHour.activity} mensagens` : 'Sem dados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Horários de Pico</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 flex-wrap">
              {peakHours.map((hour, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {hour}:00
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Produtividade</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {getSelectedDayData()?.productivity_score || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              score do dia selecionado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mapa de Calor Diário */}
      <Card>
        <CardHeader>
          <CardTitle>Mapa de Calor - Atividade por Hora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Legenda */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">Intensidade:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-300 rounded"></div>
                <span>Muito Baixo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Baixo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>Médio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>Alto</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Muito Alto</span>
              </div>
            </div>

            {/* Grid de Atividade */}
            <div className="grid grid-cols-12 gap-1">
              {heatmapData.map((item) => {
                const activityLevel = getActivityLevel(item.intensity);
                return (
                  <div
                    key={item.hourNum}
                    className={`h-8 rounded text-xs flex items-center justify-center text-white ${activityLevel.color}`}
                    title={`${item.hour}: ${item.activity} mensagens`}
                  >
                    {item.hourNum}
                  </div>
                );
              })}
            </div>

            {/* Labels das horas */}
            <div className="grid grid-cols-12 gap-1 text-xs text-gray-500 text-center">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="h-4 flex items-center justify-center">
                  {i % 2 === 0 ? i : ''}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Barras */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade por Hora - Gráfico</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={heatmapData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `${value} mensagens`, 
                  'Atividade'
                ]} 
              />
              <Bar dataKey="activity" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Análise de Padrões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Análise de Padrões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Período da Manhã (6h-12h)</span>
                <Badge variant="outline">
                  {heatmapData.slice(6, 12).reduce((sum, item) => sum + item.activity, 0)} msgs
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Período da Tarde (12h-18h)</span>
                <Badge variant="outline">
                  {heatmapData.slice(12, 18).reduce((sum, item) => sum + item.activity, 0)} msgs
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Período da Noite (18h-24h)</span>
                <Badge variant="outline">
                  {heatmapData.slice(18, 24).reduce((sum, item) => sum + item.activity, 0)} msgs
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Período da Madrugada (0h-6h)</span>
                <Badge variant="outline">
                  {heatmapData.slice(0, 6).reduce((sum, item) => sum + item.activity, 0)} msgs
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mostActiveHour && mostActiveHour.activity > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  Hora de Maior Atividade
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {mostActiveHour.hour}:00 com {mostActiveHour.activity} mensagens
                </div>
              </div>
            )}
            
            {peakHours.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-800">
                  Horários de Pico
                </div>
                <div className="text-xs text-green-700 mt-1">
                  {peakHours.map(hour => `${hour}:00`).join(', ')}
                </div>
              </div>
            )}
            
            {totalActivity === 0 && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-800">
                  Sem Atividade
                </div>
                <div className="text-xs text-gray-700 mt-1">
                  Nenhuma mensagem registrada neste dia
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppActivityHeatmap;
