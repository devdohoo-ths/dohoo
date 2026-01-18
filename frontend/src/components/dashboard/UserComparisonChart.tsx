import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { RefreshCw, Users, BarChart3, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface UserMetric {
  userId: string;
  userName: string;
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  avgResponseTime: number;
}

interface UserComparisonChartProps {
  selectedPeriod: 'today' | '7d' | 'current_month';
  className?: string;
}

export const UserComparisonChart: React.FC<UserComparisonChartProps> = ({ 
  selectedPeriod, 
  className 
}) => {
  const { user, profile } = useAuth();
  const [userMetrics, setUserMetrics] = useState<UserMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'stacked' | 'messages' | 'sent' | 'received' | 'responseTime'>('stacked');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');
  const [isExpanded, setIsExpanded] = useState(false);

  // Função para criar o período baseado no filtro
  const createPeriodRange = (period: 'today' | '7d' | 'current_month') => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let start: Date;
    let end: Date;

    switch (period) {
      case 'today':
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case '7d':
        start = new Date(today);
        start.setDate(today.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case 'current_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  // Função para buscar métricas dos usuários
  const fetchUserMetrics = async () => {
    if (!user || !profile?.organization_id) return;

    setLoading(true);
    setError(null);

    try {
      const periodRange = createPeriodRange(selectedPeriod);
      const headers = await getAuthHeaders();

      // Primeiro, buscar usuários com contas WhatsApp conectadas
      const accountsResponse = await fetch(`${apiBase}/api/whatsapp-accounts`, {
        headers
      });

      let connectedUserIds: string[] = [];
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.success && accountsData.accounts) {
          // Filtrar apenas contas conectadas e extrair user_ids únicos
          connectedUserIds = [...new Set(
            accountsData.accounts
              .filter((account: any) => account.status === 'connected')
              .map((account: any) => account.user_id)
              .filter((userId: string) => userId) // Remover valores nulos/undefined
          )];
        }
      }

      const params = new URLSearchParams({
        dateStart: periodRange.start.toISOString().split('T')[0],
        dateEnd: periodRange.end.toISOString().split('T')[0],
        organization_id: profile.organization_id
      });

      const response = await fetch(`${apiBase}/api/dashboard/individual-metrics?${params}`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.agents) {
          // Transformar os dados para o formato do gráfico
          let transformedMetrics: UserMetric[] = data.agents.map((agent: any) => ({
            userId: agent.id,
            userName: agent.name || agent.email || 'Usuário',
            totalMessages: agent.totalMessages || 0,
            sentMessages: agent.sentMessages || 0,
            receivedMessages: agent.receivedMessages || 0,
            avgResponseTime: (agent.averageResponseTime || 0) / 1000 // Converter de ms para segundos
          }));

          // Filtrar apenas usuários que têm números conectados
          if (connectedUserIds.length > 0) {
            transformedMetrics = transformedMetrics.filter(metric => 
              connectedUserIds.includes(metric.userId)
            );
          }

          // Ordenar por total de mensagens (descendente)
          const sortedMetrics = transformedMetrics
            .sort((a, b) => b.totalMessages - a.totalMessages);

          setUserMetrics(sortedMetrics);
        } else {
          setUserMetrics([]);
        }
      } else {
        throw new Error('Erro ao buscar métricas dos usuários');
      }
    } catch (err: any) {
      console.error('Erro ao buscar métricas:', err);
      setError(err.message || 'Erro desconhecido');
      setUserMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados quando período mudar
  useEffect(() => {
    fetchUserMetrics();
  }, [selectedPeriod, user, profile]);

  // Preparar dados para o gráfico baseado na métrica selecionada
  const getChartData = () => {
    return userMetrics.map(metric => ({
      name: metric.userName.length > 12 ? `${metric.userName.substring(0, 12)}...` : metric.userName,
      fullName: metric.userName,
      // Para barras empilhadas, incluir todas as métricas
      totalMessages: metric.totalMessages,
      sentMessages: metric.sentMessages,
      receivedMessages: metric.receivedMessages,
      avgResponseTime: Math.round(metric.avgResponseTime * 100) / 100,
      // Para métricas individuais
      value: (() => {
        switch (selectedMetric) {
          case 'messages':
            return metric.totalMessages;
          case 'sent':
            return metric.sentMessages;
          case 'received':
            return metric.receivedMessages;
          case 'responseTime':
            return Math.round(metric.avgResponseTime * 100) / 100;
          default:
            return metric.totalMessages;
        }
      })()
    }));
  };

  // Configurações do gráfico baseadas na métrica selecionada
  const getChartConfig = () => {
    switch (selectedMetric) {
      case 'stacked':
        return {
          title: 'Todas as Métricas',
          isStacked: true,
          format: (value: number) => value.toLocaleString()
        };
      case 'messages':
        return {
          title: 'Total de Mensagens',
          color: '#3B82F6',
          isStacked: false,
          format: (value: number) => value.toLocaleString()
        };
      case 'sent':
        return {
          title: 'Mensagens Enviadas',
          color: '#10B981',
          isStacked: false,
          format: (value: number) => value.toLocaleString()
        };
      case 'received':
        return {
          title: 'Mensagens Recebidas',
          color: '#F59E0B',
          isStacked: false,
          format: (value: number) => value.toLocaleString()
        };
      case 'responseTime':
        return {
          title: 'Tempo Médio de Resposta',
          color: '#EF4444',
          isStacked: false,
          format: (value: number) => `${value}s`
        };
      default:
        return {
          title: 'Todas as Métricas',
          isStacked: true,
          format: (value: number) => value.toLocaleString()
        };
    }
  };

  const chartConfig = getChartConfig();
  const chartData = getChartData();

  // Cores para gráfico de pizza
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="">{data.fullName}</p>
          <p className="text-blue-600">Total: {data.totalMessages}</p>
          <p className="text-green-600">Enviadas: {data.sentMessages}</p>
          <p className="text-orange-600">Recebidas: {data.receivedMessages}</p>
          <p className="text-red-600">Tempo Médio: {data.avgResponseTime}s</p>
        </div>
      );
    }
    return null;
  };

  // Função para renderizar o gráfico baseado no tipo selecionado
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: {
        top: 20,
        right: 30,
        left: 20,
        bottom: chartType === 'pie' ? 20 : 60
      }
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={60}
              fontSize={12}
            />
            <YAxis 
              fontSize={12}
              tickFormatter={chartConfig.format}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {chartConfig.isStacked ? (
              <>
                <Line 
                  type="monotone" 
                  dataKey="sentMessages" 
                  name="Mensagens Enviadas"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="receivedMessages" 
                  name="Mensagens Recebidas"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                />
              </>
            ) : (
              <Line 
                type="monotone" 
                dataKey="value" 
                name={chartConfig.title}
                stroke={chartConfig.color}
                strokeWidth={2}
                dot={{ fill: chartConfig.color, strokeWidth: 2, r: 4 }}
              />
            )}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={60}
              fontSize={12}
            />
            <YAxis 
              fontSize={12}
              tickFormatter={chartConfig.format}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {chartConfig.isStacked ? (
              <>
                <Area 
                  type="monotone" 
                  dataKey="sentMessages" 
                  name="Mensagens Enviadas"
                  stackId="1"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="receivedMessages" 
                  name="Mensagens Recebidas"
                  stackId="1"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.6}
                />
              </>
            ) : (
              <Area 
                type="monotone" 
                dataKey="value" 
                name={chartConfig.title}
                stroke={chartConfig.color}
                fill={chartConfig.color}
                fillOpacity={0.6}
              />
            )}
          </AreaChart>
        );

      case 'pie':
        const pieData = chartData.map((item, index) => ({
          name: item.name,
          value: item.value,
          color: COLORS[index % COLORS.length]
        }));
        
        return (
          <PieChart {...commonProps}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );

      default: // bar
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={60}
              fontSize={12}
            />
            <YAxis 
              fontSize={12}
              tickFormatter={chartConfig.format}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {chartConfig.isStacked ? (
              <>
                <Bar 
                  dataKey="sentMessages" 
                  name="Mensagens Enviadas"
                  fill="#10B981"
                  stackId="messages"
                  radius={[0, 0, 0, 0]}
                />
                <Bar 
                  dataKey="receivedMessages" 
                  name="Mensagens Recebidas"
                  fill="#F59E0B"
                  stackId="messages"
                  radius={[4, 4, 0, 0]}
                />
              </>
            ) : (
              <Bar 
                dataKey="value" 
                name={chartConfig.title}
                fill={chartConfig.color}
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        );
    }
  };

  return (
    <Card className={`${className} ${isExpanded ? 'col-span-2 row-span-2' : ''}`}>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-normal">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Comparativo de Usuários</span>
            <span className="sm:hidden">Comparativo</span>
          </CardTitle>
          
          {/* Controles responsivos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Primeira linha de controles */}
            <div className="flex items-center gap-2">
              <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barras</SelectItem>
                  <SelectItem value="line">Linha</SelectItem>
                  <SelectItem value="area">Área</SelectItem>
                  <SelectItem value="pie">Pizza</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchUserMetrics} 
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="ml-2 sm:hidden">Atualizar</span>
              </Button>
            </div>
            
            {/* Segunda linha de controles */}
            <div className="flex items-center gap-2">
              <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stacked">Todas as Métricas</SelectItem>
                  <SelectItem value="messages">Total de Mensagens</SelectItem>
                  <SelectItem value="sent">Mensagens Enviadas</SelectItem>
                  <SelectItem value="received">Mensagens Recebidas</SelectItem>
                  <SelectItem value="responseTime">Tempo de Resposta</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Minimizar" : "Expandir"}
                className="w-full sm:w-auto"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                <span className="ml-2 sm:hidden">{isExpanded ? "Minimizar" : "Expandir"}</span>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <div className="text-red-500 mb-2">❌</div>
              <p className="text-red-600">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchUserMetrics} 
                className="mt-2"
              >
                Tentar Novamente
              </Button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário conectado encontrado para o período selecionado</p>
            </div>
          </div>
        ) : (
          <div className={isExpanded ? "h-[70vh]" : "h-64 sm:h-80"}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        )}
        
        {chartData.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Mostrando {chartData.length} usuários conectados • {chartConfig.title} • Gráfico de {chartType === 'bar' ? 'Barras' : chartType === 'line' ? 'Linha' : chartType === 'area' ? 'Área' : 'Pizza'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
