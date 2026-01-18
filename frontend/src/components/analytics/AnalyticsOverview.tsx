import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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
import { TrendingUp, Clock, Star, AlertCircle, CheckCircle } from 'lucide-react';
import type { AnalyticsSummary } from '@/types/analytics';

interface AnalyticsOverviewProps {
  summary: AnalyticsSummary;
  enabledCharts?: string[];
  powerfulData?: any; // Dados da API poderosa
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const chartConfig = {
  positive: {
    label: "Positivo",
    color: "#10B981",
  },
  neutral: {
    label: "Neutro", 
    color: "#F59E0B",
  },
  negative: {
    label: "Negativo",
    color: "#EF4444",
  },
}

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({ 
  summary, 
  enabledCharts = ['sentiment', 'priority', 'timeSeries', 'keywords'],
  powerfulData
}) => {
  const sentimentData = [
    { name: 'Positivo', value: summary.sentiment_distribution.positive, color: '#10B981' },
    { name: 'Neutro', value: summary.sentiment_distribution.neutral, color: '#F59E0B' },
    { name: 'Negativo', value: summary.sentiment_distribution.negative, color: '#EF4444' },
  ];

  const priorityData = [
    { name: 'Baixa', value: summary.priority_distribution.low, color: '#10B981' },
    { name: 'Média', value: summary.priority_distribution.medium, color: '#F59E0B' },
    { name: 'Alta', value: summary.priority_distribution.high, color: '#F97316' },
    { name: 'Urgente', value: summary.priority_distribution.urgent, color: '#EF4444' },
  ];

  const keywordsData = summary.top_keywords.slice(0, 10);

  // Usar dados reais da API poderosa ou mostrar "Sem dados"
  const timeSeriesData = powerfulData?.timeAnalysis?.hourlyActivity || [];

  const satisfactionScore = summary.avg_satisfaction * 100;
  const responseTime = Math.round(summary.avg_response_time / 60);

  return (
    <div className="space-y-8">
      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-green-800">Taxa de Resolução</CardTitle>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-green-700 mb-2">
              {summary.resolution_rate.toFixed(1)}%
            </div>
            <Progress value={summary.resolution_rate} className="h-2 bg-green-200" />
            <p className="text-xs text-green-600 mt-2">
              {summary.resolution_rate >= 85 ? '🎯 Meta atingida!' : '📈 Melhorando'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-blue-800">Satisfação Média</CardTitle>
              <Star className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-blue-700 mb-2">
              {satisfactionScore.toFixed(1)}%
            </div>
            <Progress value={satisfactionScore} className="h-2 bg-blue-200" />
            <p className="text-xs text-blue-600 mt-2">
              {satisfactionScore >= 90 ? '⭐ Excelente!' : satisfactionScore >= 75 ? '👍 Bom' : '⚠️ Melhorar'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-orange-800">Tempo de Resposta</CardTitle>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-orange-700 mb-2">{responseTime}min</div>
            <div className="flex items-center gap-2">
              <Badge variant={responseTime <= 5 ? "default" : responseTime <= 10 ? "secondary" : "destructive"}>
                {responseTime <= 5 ? 'Rápido' : responseTime <= 10 ? 'Moderado' : 'Lento'}
              </Badge>
            </div>
            <p className="text-xs text-orange-600 mt-2">
              Meta: ≤ 5min
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-purple-800">Score Geral</CardTitle>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-purple-700 mb-2">
              {((summary.resolution_rate + satisfactionScore) / 2).toFixed(0)}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-purple-700 border-purple-300">
                Performance
              </Badge>
            </div>
            <p className="text-xs text-purple-600 mt-2">
              Índice consolidado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sentiment Distribution */}
        {enabledCharts.includes('sentiment') && (
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                😊 Distribuição de Sentimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Priority Distribution */}
        {enabledCharts.includes('priority') && (
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚡ Distribuição de Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip 
                    formatter={(value, name) => [`${value} conversas`, 'Quantidade']}
                  />
                  <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Time Series and Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Time Series Chart */}
        {enabledCharts.includes('timeSeries') && (
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📈 Atividade ao Longo do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="conversations" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="url(#colorConversations)" 
                    />
                    <defs>
                      <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <div className="text-center">
                    <div className="text-2xl mb-2">📊</div>
                    <p>Sem dados de atividade</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Top Keywords Enhanced */}
        {enabledCharts.includes('keywords') && (
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔍 Principais Palavras-chave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={keywordsData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="keyword" type="category" width={80} />
                  <ChartTooltip 
                    formatter={(value) => [`${value} menções`, 'Frequência']}
                  />
                  <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-green-500 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Status Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Conversas Resolvidas</span>
                <Badge variant="default">{summary.resolution_rate.toFixed(0)}%</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Feedback Positivo</span>
                <Badge variant="secondary">{summary.sentiment_distribution.positive}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Tempo Médio</span>
                <Badge variant="outline">{responseTime}min</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Tendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Volume de Conversas</span>
                <Badge className="bg-green-100 text-green-800">+15%</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Satisfação</span>
                <Badge className="bg-blue-100 text-blue-800">+8%</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Eficiência</span>
                <Badge className="bg-purple-100 text-purple-800">+12%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Conversas Críticas</span>
                <Badge variant="destructive">{summary.sentiment_distribution.negative}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Alta Prioridade</span>
                <Badge className="bg-orange-100 text-orange-800">{summary.priority_distribution.urgent}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Pendentes</span>
                <Badge variant="outline">
                  {summary.total_conversations - Math.round(summary.total_conversations * summary.resolution_rate / 100)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
