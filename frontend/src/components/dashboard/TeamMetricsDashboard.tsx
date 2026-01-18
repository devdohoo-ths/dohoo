import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  MessageCircle, 
  Clock, 
  TrendingUp, 
  Download
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { apiBase } from "@/utils/apiBase";
import { useToast } from "@/hooks/use-toast";

interface TeamMetrics {
  id: string;
  name: string;
  totalMembers: number;
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  avgResponseTime: number;
  productivity: number;
  trend: 'up' | 'down' | 'stable';
  dailyData: { date: string; messages: number }[];
  members: TeamMember[];
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  totalMessages: number;
  avgResponseTime: number;
  productivity: number;
  status: 'online' | 'offline';
  lastActivity: string;
}

interface TeamMetricsDashboardProps {
  selectedPeriod?: string;
  dateStart?: string;
  dateEnd?: string;
}

export function TeamMetricsDashboard({ selectedPeriod = '7d', dateStart, dateEnd }: TeamMetricsDashboardProps) {
  const { user, profile } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  
  const [teams, setTeams] = useState<TeamMetrics[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(selectedPeriod);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  // Períodos disponíveis
  const periods = [
    { value: '1d', label: 'Hoje' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' }
  ];

  // Buscar métricas dos times
  const fetchTeamMetrics = async () => {
    console.log('🔍 [TeamMetrics] DEBUG: Verificando dados de autenticação:', {
      userId: user?.id,
      profile: profile,
      organizationId: profile?.organization_id,
      organization: organization
    });
    
    if (!user?.id || !profile?.organization_id) {
      console.log('❌ [TeamMetrics] DEBUG: Dados de autenticação incompletos:', {
        hasUser: !!user?.id,
        hasProfile: !!profile,
        hasOrgId: !!profile?.organization_id
      });
      return;
    }

    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        organization_id: profile.organization_id,
        period: dateStart && dateEnd ? 'custom' : period,
        ...(dateStart && dateEnd && { dateStart, dateEnd }),
        _t: Date.now().toString()
      });

      console.log('🔍 [TeamMetrics] DEBUG: Dados de autenticação:', {
        userId: user?.id,
        userEmail: user?.email,
        profileId: profile?.id,
        organizationId: profile?.organization_id,
        hasUser: !!user,
        hasProfile: !!profile
      });

      console.log('🔍 [TeamMetrics] DEBUG: Parâmetros da requisição:', {
        organization_id: profile.organization_id,
        period: period,
        dateStart,
        dateEnd,
        paramsString: params.toString()
      });

      console.log('🔍 [TeamMetrics] DEBUG: Headers da requisição:', {
        'Authorization': 'Bearer dohoo_dev_token_2024',
        'Content-Type': 'application/json',
        'x-user-id': user?.id,
        'x-organization-id': profile?.organization_id
      });

      const response = await fetch(`${apiBase}/api/teams/metrics?${params}`, {
        headers: {
          'Authorization': 'Bearer dohoo_dev_token_2024',
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-organization-id': profile?.organization_id || ''
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [TeamMetrics] Erro na API:', {
          status: response.status,
          error: errorText
        });
        
        // 🎯 CORREÇÃO: Em vez de usar dados mock, mostrar erro mais claro
        throw new Error(`Erro na API: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [TeamMetrics] Dados recebidos:', data);
        setTeams(data.teams || []);
      } else {
        throw new Error(data.error || 'Erro ao buscar métricas dos times');
      }
    } catch (error: any) {
      console.error('❌ [TeamMetrics] Erro ao buscar métricas:', error);
      
      // 🎯 CORREÇÃO: Mostrar erro mais claro para o usuário
      toast({
        title: 'Erro ao carregar métricas',
        description: error.message || 'Não foi possível carregar os dados dos times',
        variant: 'destructive'
      });
      
      // 🎯 CORREÇÃO: Em vez de dados mock, deixar array vazio
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };



  // Filtrar times baseado na seleção
  const filteredTeams = selectedTeam === 'all' 
    ? teams 
    : teams.filter(team => team.id === selectedTeam);

  // Calcular métricas totais
  const totalMetrics = {
    teams: teams.length,
    totalMembers: teams.reduce((sum, team) => sum + team.totalMembers, 0),
    totalMessages: teams.reduce((sum, team) => sum + team.totalMessages, 0),
    avgProductivity: teams.length > 0 
      ? Math.round(teams.reduce((sum, team) => sum + team.productivity, 0) / teams.length)
      : 0,
    avgResponseTime: teams.length > 0
      ? Math.round(teams.reduce((sum, team) => sum + team.avgResponseTime, 0) / teams.length * 10) / 10
      : 0
  };

  // Exportar dados
  const exportData = () => {
    const data = {
      period,
      totalMetrics,
      teams: filteredTeams,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-metrics-${period}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportado',
      description: 'Dados exportados com sucesso!'
    });
  };

  // Obter ícone de tendência
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-500" />;
    }
  };

  // Obter cor da produtividade
  const getProductivityColor = (productivity: number) => {
    if (productivity >= 90) return 'text-green-600';
    if (productivity >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Obter cor do progresso
  const getProgressColor = (productivity: number) => {
    if (productivity >= 90) return 'bg-green-500';
    if (productivity >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Carregar dados quando o período mudar
  useEffect(() => {
    fetchTeamMetrics();
  }, [period, user?.id, profile?.organization_id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Mostrar mensagem quando não há times ou quando não há membros associados
  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg mb-2">Nenhum time encontrado</h3>
            <p className="text-muted-foreground">
              Crie times na sua organização para visualizar as métricas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (teams.every(team => team.totalMembers === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg mb-2">Times encontrados, mas sem membros</h3>
            <p className="text-muted-foreground mb-4">
              Os times foram criados, mas nenhum usuário foi associado a eles ainda.
            </p>
            <p className="text-sm text-muted-foreground">
              Associe usuários aos times para visualizar as métricas de produtividade.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl tracking-tight">Métricas dos Times</h2>
            <p className="text-muted-foreground">
              Desempenho e produtividade das equipes
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-48">
              <Users className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Selecionar time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Times</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={exportData} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas totais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Times</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{totalMetrics.teams}</div>
            <p className="text-xs text-muted-foreground">
              Equipes ativas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{totalMetrics.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              Participantes
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Mensagens</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{totalMetrics.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Produtividade Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{totalMetrics.avgProductivity}%</div>
            <p className="text-xs text-muted-foreground">
              Média das equipes
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Tempo de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{totalMetrics.avgResponseTime}m</div>
            <p className="text-xs text-muted-foreground">
              Média das equipes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes visualizações */}
      <Tabs value={viewMode} onValueChange={(v: string) => setViewMode(v as 'overview' | 'detailed')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="gap-2">
            <Users className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="detailed" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Detalhado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Cards dos times */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(team.trend)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {team.totalMembers} membros
                  </p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Métricas principais */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl text-blue-600">
                        {team.totalMessages.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">Mensagens</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl text-green-600">
                        {team.avgResponseTime}m
                      </div>
                      <p className="text-xs text-muted-foreground">Tempo médio</p>
                    </div>
                  </div>
                  
                  {/* Produtividade */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Produtividade</span>
                      <span className={getProductivityColor(team.productivity)}>
                        {team.productivity}%
                      </span>
                    </div>
                    <Progress 
                      value={team.productivity} 
                      className="h-2"
                      indicatorClassName={getProgressColor(team.productivity)}
                    />
                  </div>
                  
                  {/* Estatísticas de mensagens */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Enviadas: {team.sentMessages}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Recebidas: {team.receivedMessages}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-6">
          {/* Tabela detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento por Time</CardTitle>
              <p className="text-sm text-muted-foreground">
                Métricas detalhadas de cada equipe e seus membros
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead>Mensagens</TableHead>
                    <TableHead>Tempo de Resposta</TableHead>
                    <TableHead>Produtividade</TableHead>
                    <TableHead>Tendência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="">{team.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {team.totalMembers}
                        </Badge>
                      </TableCell>
                      <TableCell>{team.totalMessages.toLocaleString()}</TableCell>
                      <TableCell>{team.avgResponseTime}m</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={team.productivity} 
                            className="w-16 h-2"
                            indicatorClassName={getProgressColor(team.productivity)}
                          />
                          <span className={getProductivityColor(team.productivity)}>
                            {team.productivity}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getTrendIcon(team.trend)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detalhamento por membro */}
          {selectedTeam !== 'all' && filteredTeams.length === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Membros do Time: {filteredTeams[0]?.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Desempenho individual dos participantes
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Mensagens</TableHead>
                      <TableHead>Tempo de Resposta</TableHead>
                      <TableHead>Produtividade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeams[0]?.members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="">{member.name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{member.totalMessages}</TableCell>
                        <TableCell>{member.avgResponseTime}m</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={member.productivity} 
                              className="w-16 h-2"
                              indicatorClassName={getProgressColor(member.productivity)}
                            />
                            <span className={getProductivityColor(member.productivity)}>
                              {member.productivity}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.status === 'online' ? 'default' : 'secondary'}>
                            {member.status === 'online' ? 'Online' : 'Offline'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
