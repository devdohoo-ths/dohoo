import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  MessageSquare, 
  Users, 
  TrendingUp, 
  Brain,
  Play,
  CheckCircle,
  AlertCircle,
  Pause
} from 'lucide-react';
import { useCampanhasDashboard } from '@/hooks/useCampanhasDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const statusColors = {
  rascunho: '#6B7280',
  em_execucao: '#3B82F6',
  finalizada: '#10B981',
  erro: '#EF4444',
  pausada: '#F59E0B'
};

export function CampanhasDashboard() {
  const { 
    stats, 
    campanhasRecentes, 
    performancePorDia, 
    sentimentosDistribuicao,
    isLoading, 
    error 
  } = useCampanhasDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Cards de métricas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar dashboard. Tente novamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg mb-2">Nenhum dado disponível</h3>
          <p className="text-muted-foreground text-center">
            Crie sua primeira campanha para ver as estatísticas aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Campanhas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.total_campanhas}</div>
            <p className="text-xs text-muted-foreground">
              {stats.campanhas_ativas} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Mensagens Enviadas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.total_mensagens_enviadas}</div>
            <p className="text-xs text-muted-foreground">
              Últimos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Taxa de Resposta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.taxa_resposta_media}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_respostas} respostas recebidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Campanhas com IA</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.campanhas_com_ia}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.campanhas_com_ia / stats.total_campanhas) * 100).toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principais */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Performance por dia */}
        <Card>
          <CardHeader>
            <CardTitle>Performance dos Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performancePorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="data" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                  formatter={(value, name) => [value, name === 'enviados' ? 'Enviados' : 'Respostas']}
                />
                <Area 
                  type="monotone" 
                  dataKey="enviados" 
                  stackId="1"
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="respostas" 
                  stackId="1"
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status das campanhas */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.campanhas_por_status}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.campanhas_por_status.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análise de sentimentos (se houver dados de IA) */}
      {sentimentosDistribuicao && sentimentosDistribuicao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Análise de Sentimentos (IA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sentimentosDistribuicao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sentimento" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#8884d8">
                  {sentimentosDistribuicao.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.sentimento === 'positivo' ? '#10B981' :
                        entry.sentimento === 'negativo' ? '#EF4444' : '#6B7280'
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Campanhas recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Campanhas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campanhasRecentes.map((campanha) => (
              <div key={campanha.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {campanha.status === 'em_execucao' && <Play className="h-4 w-4 text-blue-500" />}
                    {campanha.status === 'finalizada' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {campanha.status === 'pausada' && <Pause className="h-4 w-4 text-yellow-500" />}
                    {campanha.status === 'erro' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    {campanha.usar_ia && <Brain className="h-4 w-4 text-purple-500" />}
                  </div>
                  <div>
                    <p className="">{campanha.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {campanha.enviados}/{campanha.total_destinatarios} enviados
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={
                    campanha.status === 'finalizada' ? 'success' :
                    campanha.status === 'em_execucao' ? 'default' :
                    campanha.status === 'erro' ? 'destructive' : 'secondary'
                  }>
                    {campanha.status === 'em_execucao' ? 'Em Execução' :
                     campanha.status === 'finalizada' ? 'Finalizada' :
                     campanha.status === 'pausada' ? 'Pausada' :
                     campanha.status === 'erro' ? 'Erro' : 'Rascunho'}
                  </Badge>
                  {campanha.enviados > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {((campanha.respondidos / campanha.enviados) * 100).toFixed(1)}% resposta
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
