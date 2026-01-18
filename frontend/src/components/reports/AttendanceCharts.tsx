import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Users, 
  Star,
  TrendingUp,
  AlertTriangle,
  MessageCircle
} from 'lucide-react';
import type { AttendanceStats, AttendanceAgent } from '@/hooks/useAttendanceReports';
import { Badge } from '@/components/ui/badge';

interface AttendanceChartsProps {
  stats: AttendanceStats;
  agents: AttendanceAgent[];
}

export const AttendanceOverviewCharts: React.FC<AttendanceChartsProps> = () => {
  return (
    <div className="space-y-6">
      {/* Conteúdo da aba Análise com IA será adicionado aqui */}
    </div>
  );
};

export const AgentPerformanceCharts: React.FC<{ agents: AttendanceAgent[] }> = ({ agents }) => {
  if (!agents || agents.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground">Nenhum agente encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular estatísticas reais
  const avgResolutionRate = Math.round(agents.reduce((sum, a) => sum + a.resolutionRate, 0) / agents.length);
  const avgBestResponseTime = Math.round(agents.reduce((sum, a) => sum + a.bestResponseTime, 0) / agents.length);
  const totalActiveContacts = agents.reduce((sum, a) => sum + a.activeContacts, 0);
  const totalNewContacts = agents.reduce((sum, a) => sum + a.newContacts, 0);
  const totalChats = agents.reduce((sum, a) => sum + a.totalChats, 0);



  // Dados para gráfico de departamentos
  const departmentData = Object.entries(
    agents.reduce((acc, agent) => {
      const dept = agent.department || 'Geral';
      if (!acc[dept]) {
        acc[dept] = {
          department: dept,
          agents: 0,
          totalChats: 0,
          avgResolutionRate: 0,
          avgResponseTime: 0
        };
      }
      acc[dept].agents++;
      acc[dept].totalChats += agent.totalChats;
      acc[dept].avgResolutionRate += agent.resolutionRate;
      acc[dept].avgResponseTime += agent.averageResponseTime;
      return acc;
    }, {} as Record<string, any>)
  ).map(([dept, stats]) => ({
    department: dept,
    agents: stats.agents,
    totalChats: stats.totalChats,
    avgResolutionRate: Math.round(stats.avgResolutionRate / stats.agents),
    avgResponseTime: Math.round(stats.avgResponseTime / stats.agents / 60) // em minutos
  }));

  // Dados para gráfico de distribuição de performance
  const performanceDistribution = [
    { 
      name: 'Excelente (90%+)', 
      value: agents.filter(a => a.resolutionRate >= 90).length,
      color: '#10b981'
    },
    { 
      name: 'Bom (80-89%)', 
      value: agents.filter(a => a.resolutionRate >= 80 && a.resolutionRate < 90).length,
      color: '#3b82f6'
    },
    { 
      name: 'Regular (70-79%)', 
      value: agents.filter(a => a.resolutionRate >= 70 && a.resolutionRate < 80).length,
      color: '#f59e0b'
    },
    { 
      name: 'Precisa Melhorar (<70%)', 
      value: agents.filter(a => a.resolutionRate < 70).length,
      color: '#ef4444'
    }
  ].filter(item => item.value > 0);



  return (
    <div className="space-y-6">
             {/* Resumo de Performance */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Melhor Tempo Resp.</p>
                 <p className="text-2xl">{Math.round(avgBestResponseTime / 60)}min</p>
               </div>
               <Clock className="h-8 w-8 text-green-600" />
             </div>
           </CardContent>
         </Card>

         <Card>
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Contatos Ativos</p>
                 <p className="text-2xl">{totalActiveContacts}</p>
               </div>
               <Users className="h-8 w-8 text-blue-600" />
             </div>
           </CardContent>
         </Card>

         <Card>
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Total de Chats</p>
                 <p className="text-2xl">{totalChats}</p>
               </div>
               <MessageCircle className="h-8 w-8 text-purple-600" />
             </div>
           </CardContent>
         </Card>
       </div>

            {/* Resumo de Performance por Departamento */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Performance por Departamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentData.map((dept) => (
              <div key={dept.department} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="">{dept.department}</h3>
                  <Badge variant="secondary">{dept.agents} agentes</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Taxa de Resolução</span>
                    <span className="">{dept.avgResolutionRate}%</span>
                  </div>
                  <Progress value={dept.avgResolutionRate} className="h-2" />
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Chats</div>
                      <div className="text-lg">{dept.totalChats}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Tempo Resp.</div>
                      <div className="text-lg">{dept.avgResponseTime}min</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}

      {/* Distribuição de Performance */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Distribuição de Performance dos Agentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {performanceDistribution.map((level, index) => (
              <div key={index} className="text-center p-4 border rounded-lg">
                <div 
                  className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-lg"
                  style={{ backgroundColor: level.color }}
                >
                  {level.value}
                </div>
                <h3 className="text-sm">{level.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {level.value} {level.value === 1 ? 'agente' : 'agentes'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}

      {/* Análise Detalhada por Agente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Análise Detalhada por Agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agents.map((agent) => {
              const performanceLevel = agent.resolutionRate >= 90 ? 'Excelente' : 
                                      agent.resolutionRate >= 80 ? 'Bom' : 
                                      agent.resolutionRate >= 70 ? 'Regular' : 'Necessita Melhoria';
              
              const performanceColor = agent.resolutionRate >= 90 ? 'text-green-600' : 
                                     agent.resolutionRate >= 80 ? 'text-blue-600' : 
                                     agent.resolutionRate >= 70 ? 'text-yellow-600' : 'text-red-600';

              return (
                <div key={agent.id} className="border rounded-lg p-4 space-y-3">
                                     <div className="flex items-center justify-between">
                     <div>
                       <h3 className="">{agent.name}</h3>
                       <p className="text-sm text-muted-foreground">{agent.department}</p>
                     </div>
                   </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Melhor Resp.</div>
                      <div className="text-lg text-green-600">
                        {Math.round(agent.bestResponseTime / 60)}min
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Chats</div>
                      <div className="text-lg text-blue-600">
                        {agent.totalChats}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Tempo Resp.</div>
                      <div className="text-lg text-purple-600">
                        {Math.round(agent.averageResponseTime / 60)}min
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Ativos</div>
                      <div className="text-lg text-orange-600">
                        {agent.activeContacts}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Novos</div>
                      <div className="text-lg text-cyan-600">
                        {agent.newContacts}
                      </div>
                    </div>
                  </div>
                  
                  <Progress value={agent.resolutionRate} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas por Departamento */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Estatísticas por Departamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentData.map((dept) => (
              <div key={dept.department} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="">{dept.department}</h3>
                  <Badge variant="secondary">{dept.agents} agentes</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Chats</div>
                    <div className="text-lg">{dept.totalChats}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Taxa Resolução</div>
                    <div className="text-lg">
                      {dept.avgResolutionRate}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Tempo Resp.</div>
                    <div className="text-lg">
                      {dept.avgResponseTime}min
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}
    </div>
  );
};

export const KPIMetrics: React.FC<{ stats: AttendanceStats }> = ({ stats }) => {
  // Validação de dados
  if (!stats || !stats.kpis) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-muted-foreground">Dados de KPI não disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const kpiData = [
    {
      title: 'SLA Compliance',
      value: `${stats.kpis.slaCompliance || 0}%`,
      description: 'Atendimentos dentro do SLA',
      icon: Star,
      color: (stats.kpis.slaCompliance || 0) >= 90 ? 'text-green-600' : 
             (stats.kpis.slaCompliance || 0) >= 80 ? 'text-yellow-600' : 'text-red-600',
      bgColor: (stats.kpis.slaCompliance || 0) >= 90 ? 'bg-green-100' : 
               (stats.kpis.slaCompliance || 0) >= 80 ? 'bg-yellow-100' : 'bg-red-100'
    },
    {
      title: 'First Response SLA',
      value: `${stats.kpis.firstResponseSla || 0}%`,
      description: 'Primeira resposta em até 1 min',
      icon: Clock,
      color: (stats.kpis.firstResponseSla || 0) >= 95 ? 'text-green-600' : 
             (stats.kpis.firstResponseSla || 0) >= 85 ? 'text-yellow-600' : 'text-red-600',
      bgColor: (stats.kpis.firstResponseSla || 0) >= 95 ? 'bg-green-100' : 
               (stats.kpis.firstResponseSla || 0) >= 85 ? 'bg-yellow-100' : 'bg-red-100'
    },
    {
      title: 'Resolution SLA',
      value: `${stats.kpis.resolutionSla || 0}%`,
      description: 'Resolução em até 10 min',
      icon: Star,
      color: (stats.kpis.resolutionSla || 0) >= 85 ? 'text-green-600' : 
             (stats.kpis.resolutionSla || 0) >= 75 ? 'text-yellow-600' : 'text-red-600',
      bgColor: (stats.kpis.resolutionSla || 0) >= 85 ? 'bg-green-100' : 
               (stats.kpis.resolutionSla || 0) >= 75 ? 'bg-yellow-100' : 'bg-red-100'
    },
    {
      title: 'Customer Retention',
      value: `${stats.kpis.customerRetention || 0}%`,
      description: 'Clientes satisfeitos',
      icon: Users,
      color: (stats.kpis.customerRetention || 0) >= 90 ? 'text-green-600' : 
             (stats.kpis.customerRetention || 0) >= 80 ? 'text-yellow-600' : 'text-red-600',
      bgColor: (stats.kpis.customerRetention || 0) >= 90 ? 'bg-green-100' : 
               (stats.kpis.customerRetention || 0) >= 80 ? 'bg-yellow-100' : 'bg-red-100'
    },
    {
      title: 'Agent Utilization',
      value: `${stats.kpis.agentUtilization || 0}%`,
      description: 'Agentes ativos',
      icon: Star,
      color: (stats.kpis.agentUtilization || 0) >= 80 ? 'text-green-600' : 
             (stats.kpis.agentUtilization || 0) >= 60 ? 'text-yellow-600' : 'text-red-600',
      bgColor: (stats.kpis.agentUtilization || 0) >= 80 ? 'bg-green-100' : 
               (stats.kpis.agentUtilization || 0) >= 60 ? 'bg-yellow-100' : 'bg-red-100'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          KPIs de Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiData.map((kpi, index) => (
            <div key={index} className="text-center space-y-2">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${kpi.bgColor}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
              <div>
                <div className={`text-2xl ${kpi.color}`}>{kpi.value}</div>
                <div className="text-sm">{kpi.title}</div>
                <div className="text-xs text-muted-foreground">{kpi.description}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}; 
