import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUnifiedReports } from '@/hooks/useUnifiedReports';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { 
  Users, 
  MessageCircle, 
  Clock, 
  TrendingUp, 
  BarChart3,
  Star,
  Activity,
  Circle
} from 'lucide-react';

interface UnifiedDashboardProps {
  selectedPeriod?: '24h' | '7d' | '30d';
}

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({ selectedPeriod }) => {
  const { data, loading, error, filters, updateFilters, fetchWithFilters } = useUnifiedReports();
  const { selectedPeriod: contextPeriod, getDateRange } = useDashboardContext();
  const { dashboardStats, updatePeriod } = useDashboardWidgets();

  // 🎯 USAR O PERÍODO RECEBIDO VIA PROPS OU DO CONTEXTO
  const currentPeriod = selectedPeriod || contextPeriod;

  // 🎯 SINCRONIZAR O PERÍODO DO HOOK COM O PERÍODO ATUAL
  React.useEffect(() => {
    if (currentPeriod) {
      console.log('📅 [UnifiedDashboard] Sincronizando período:', currentPeriod);
      updatePeriod(currentPeriod);
    }
  }, [currentPeriod, updatePeriod]);

  // Atualizar filtros quando o período global mudar
  React.useEffect(() => {
    const { start, end } = getDateRange();
    const newFilters = {
      dateRange: { start, end }
    };
    
    updateFilters(newFilters);
    fetchWithFilters(newFilters);
  }, [currentPeriod, getDateRange, updateFilters, fetchWithFilters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados unificados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-destructive mb-2">❌</div>
          <p className="text-destructive">Erro ao carregar dados: {error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </div>
      </div>
    );
  }

  const { globalStats, agents, conversations } = data;

  return (
    <div className="space-y-6">
      {/* Header com estatísticas globais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{globalStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {globalStats.activeUsers} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Conversas</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{globalStats.totalConversations}</div>
            <p className="text-xs text-muted-foreground">
              {globalStats.activeConversations} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Mensagens</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{globalStats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              {globalStats.aiResponses} respostas IA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Produtividade</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{Math.round(globalStats.averageProductivity)}%</div>
            <p className="text-xs text-muted-foreground">
              Média da equipe
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de agentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agentes ({agents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${agent.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="">{agent.name}</span>
                  </div>
                  <Badge variant="secondary">{agent.department}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Atendimentos:</span>
                    <div className="">{agent.totalAttendances}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Resolvidos:</span>
                    <div className="">{agent.resolvedAttendances}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mensagens:</span>
                    <div className="">{agent.messagesSent}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Produtividade:</span>
                    <div className="">{Math.round(agent.productivity)}%</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Tempo médio: {Math.round(agent.averageResponseTime)}s</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seção de conversas recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversas Recentes ({conversations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {conversations.slice(0, 10).map((conversation) => (
              <div key={conversation.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="">{conversation.customerName || conversation.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {conversation.assigned_agent_name || 'Sem agente'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                    {conversation.status}
                  </Badge>
                  <Badge variant="outline">{conversation.platform}</Badge>
                  <div className="text-sm text-muted-foreground">
                    {conversation.totalMessages} msgs
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seção de métricas avançadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Satisfação do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-green-600">
              {Math.round(globalStats.averageSatisfaction)}%
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Média de satisfação baseada em {agents.length} agentes
            </p>
          </CardContent>
        </Card>

        {/* ===== OCULTO: Card Assistentes IA (não será exibido) */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Assistentes IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-blue-600">
              {globalStats.assistantsCreated}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Assistentes criados na organização
            </p>
          </CardContent>
        </Card> */}
      </div>

      {/* Footer com informações do período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Resumo do Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl text-blue-600">{globalStats.finishedConversations}</div>
              <div className="text-sm text-muted-foreground">Finalizadas</div>
            </div>
            {/* ===== OCULTO: Créditos IA (não será exibido) */}
            {/* <div>
              <div className="text-2xl text-green-600">{globalStats.aiCredits}</div>
              <div className="text-sm text-muted-foreground">Créditos IA</div>
            </div> */}
            {/* ===== OCULTO: Tempo de Resposta (não será exibido) */}
            {/* <div>
              <div className="text-2xl text-orange-600">{Math.round(globalStats.averageResponseTime)}s</div>
              <div className="text-sm text-muted-foreground">Tempo Médio</div>
            </div> */}
            <div>
              <div className="text-2xl text-purple-600">{Math.round(globalStats.averageProductivity)}%</div>
              <div className="text-sm text-muted-foreground">Produtividade</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 