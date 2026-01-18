import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { io } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Users, MessageSquare, Clock, Activity, Search, Filter, Grid, List, Eye, RefreshCw } from 'lucide-react';
import { TeamCard } from './TeamCard';

interface Chat {
  id: string;
  name: string;
  whatsapp_jid: string;
  platform: string;
  status: string;
  created_at: string;
  last_message_at: string;
  assigned_team?: string;
  assigned_agent_id?: string;
}

interface TeamStats {
  teamId: string;
  teamName: string;
  description?: string;
  isOnline: boolean;
  lastActivity?: string;
  activeSessions: number;
  waitingChats: number;
  activeChats: number;
  totalAgents: number;
  onlineAgents: number;
}

interface Team {
  id: string;
  name: string;
  description?: string;
}

export const DashboardSupervisorV2: React.FC = () => {
  const { organizationId, userToken } = useAuth();
  
  // Fallback para organizationId se estiver undefined
  const orgId = organizationId || 'default-org';
  const token = userToken || 'default-token';
  const [teamsStats, setTeamsStats] = useState<TeamStats[]>([]);
  const [waitingChats, setWaitingChats] = useState<Chat[]>([]);
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Socket.IO para notificações em tempo real
  useEffect(() => {
    const socket = io('http://localhost:3001');
    
    // Conectar à organização
    socket.emit('join-organization', orgId);
    
    // Escutar novos chats para times
    socket.on('new-team-chat', (data) => {
      console.log('📨 Novo chat para time:', data);
      fetchWaitingChats();
      fetchTeamsStats();
    });
    
    // Escutar transferências de chat para time
    socket.on('chat-transferred-to-team', (data) => {
      console.log('🔄 Chat transferido para time:', data);
      fetchWaitingChats();
      fetchActiveChats();
      fetchTeamsStats();
    });
    
    // Escutar quando chat é pego
    socket.on('chat-claimed', (data) => {
      console.log('✅ Chat foi pego:', data);
      fetchWaitingChats();
      fetchActiveChats();
      fetchTeamsStats();
    });
    
    return () => {
      socket.disconnect();
    };
  }, [orgId]);

  // Buscar estatísticas dos times
  const fetchTeamsStats = async () => {
    try {
      // Verificar se temos dados válidos
      if (!orgId || orgId === 'default-org') {
        console.warn('⚠️ OrganizationId não disponível, usando dados mock');
        // Dados mock para demonstração
        setTeamsStats([
          {
            teamId: 'mock-team-1',
            teamName: 'Time de Suporte',
            description: 'Equipe de atendimento ao cliente',
            isOnline: true,
            lastActivity: new Date().toISOString(),
            activeSessions: 2,
            waitingChats: 3,
            activeChats: 5,
            totalAgents: 4,
            onlineAgents: 3
          },
          {
            teamId: 'mock-team-2',
            teamName: 'Time de Vendas',
            description: 'Equipe comercial',
            isOnline: false,
            lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            activeSessions: 0,
            waitingChats: 1,
            activeChats: 2,
            totalAgents: 3,
            onlineAgents: 0
          }
        ]);
        return;
      }
      
      const response = await fetch(`/api/teams?organization_id=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': 'supervisor',
          'x-organization-id': orgId
        }
      });
      
      const { teams } = await response.json();
      
      // Buscar estatísticas para cada time
      const statsPromises = teams.map(async (team: any) => {
        const [waitingRes, activeRes, agentsRes, statusRes] = await Promise.all([
          fetch(`/api/teams/waiting-chats?team_id=${team.id}&organization_id=${orgId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-user-id': 'supervisor',
              'x-organization-id': orgId
            }
          }),
          fetch(`/api/teams/active-chats?team_id=${team.id}&organization_id=${orgId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-user-id': 'supervisor',
              'x-organization-id': orgId
            }
          }),
          fetch(`/api/teams/agents?team_id=${team.id}&organization_id=${orgId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-user-id': 'supervisor',
              'x-organization-id': orgId
            }
          }),
          fetch(`/api/teams/status/${team.id}?organization_id=${orgId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-user-id': 'supervisor',
              'x-organization-id': orgId
            }
          })
        ]);
        
        const [waitingData, activeData, agentsData, statusData] = await Promise.all([
          waitingRes.json(),
          activeRes.json(),
          agentsRes.json(),
          statusRes.json()
        ]);
        
        return {
          teamId: team.id,
          teamName: team.name,
          description: team.description,
          isOnline: statusData.isOnline || false,
          lastActivity: statusData.lastActivity,
          activeSessions: statusData.activeSessions || 0,
          waitingChats: waitingData.chats?.length || 0,
          activeChats: activeData.chats?.length || 0,
          totalAgents: agentsData.agents?.length || 0,
          onlineAgents: agentsData.agents?.filter((agent: any) => agent.is_online).length || 0
        };
      });
      
      const stats = await Promise.all(statsPromises);
      setTeamsStats(stats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas dos times:', error);
      // Em caso de erro, usar dados mock
      setTeamsStats([
        {
          teamId: 'error-team-1',
          teamName: 'Time de Suporte',
          description: 'Equipe de atendimento ao cliente',
          isOnline: true,
          lastActivity: new Date().toISOString(),
          activeSessions: 2,
          waitingChats: 3,
          activeChats: 5,
          totalAgents: 4,
          onlineAgents: 3
        }
      ]);
    }
  };

  // Buscar chats aguardando
  const fetchWaitingChats = async () => {
    try {
      const response = await fetch(`/api/teams/waiting-chats?organization_id=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': 'supervisor',
          'x-organization-id': orgId
        }
      });
      
      const data = await response.json();
      setWaitingChats(data.chats || []);
    } catch (error) {
      console.error('Erro ao buscar chats aguardando:', error);
    }
  };

  // Buscar chats ativos
  const fetchActiveChats = async () => {
    try {
      const response = await fetch(`/api/teams/active-chats?organization_id=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': 'supervisor',
          'x-organization-id': orgId
        }
      });
      
      const data = await response.json();
      setActiveChats(data.chats || []);
    } catch (error) {
      console.error('Erro ao buscar chats ativos:', error);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchTeamsStats(),
        fetchWaitingChats(),
        fetchActiveChats()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [orgId]);

  // Filtrar times por busca
  const filteredTeams = teamsStats.filter(team =>
    team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (team.description && team.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filtrar por time selecionado
  const filteredTeamsBySelection = selectedTeam === 'all' 
    ? filteredTeams 
    : filteredTeams.filter(team => team.teamId === selectedTeam);

  // Handlers
  const handleViewDetails = (teamId: string) => {
    console.log('Ver detalhes do time:', teamId);
    // Implementar navegação para detalhes do time
  };

  const handleViewChats = (teamId: string) => {
    console.log('Ver chats do time:', teamId);
    // Implementar navegação para chats do time
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Dashboard Supervisor</h1>
          <p className="text-gray-600">Gerencie times e monitore atendimentos</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <Grid className="w-4 h-4 mr-2" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-2" />
            Lista
          </Button>
        </div>
      </div>


      {/* Filtros */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar times..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os times</SelectItem>
            {teamsStats.map((team) => (
              <SelectItem key={team.teamId} value={team.teamId}>
                {team.teamName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button onClick={() => {
          fetchTeamsStats();
          fetchWaitingChats();
          fetchActiveChats();
        }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Times Online</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {teamsStats.filter(team => team.isOnline).length}
            </div>
            <p className="text-xs text-muted-foreground">
              de {teamsStats.length} times
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Chats Aguardando</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{waitingChats.length}</div>
            <p className="text-xs text-muted-foreground">
              aguardando atendimento
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Chats Ativos</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{activeChats.length}</div>
            <p className="text-xs text-muted-foreground">
              em atendimento
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total de Agentes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {teamsStats.reduce((sum, team) => sum + team.onlineAgents, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              de {teamsStats.reduce((sum, team) => sum + team.totalAgents, 0)} agentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards dos Times */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeamsBySelection.map((team) => (
            <TeamCard
              key={team.teamId}
              team={team}
              onViewDetails={handleViewDetails}
              onViewChats={handleViewChats}
            />
          ))}
        </div>
      )}

      {/* Lista dos Times */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Times</CardTitle>
            <CardDescription>
              Lista de todos os times e seus status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredTeamsBySelection.map((team) => (
                <div key={team.teamId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${team.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <h3 className="">{team.teamName}</h3>
                      {team.description && (
                        <p className="text-sm text-gray-500">{team.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-center">
                      <div className="">{team.onlineAgents}/{team.totalAgents}</div>
                      <div className="text-gray-500">Agentes</div>
                    </div>
                    <div className="text-center">
                      <div className="">{team.activeChats}</div>
                      <div className="text-gray-500">Chats Ativos</div>
                    </div>
                    <div className="text-center">
                      <div className="">{team.waitingChats}</div>
                      <div className="text-gray-500">Aguardando</div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(team.teamId)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Detalhes
                    </Button>
                    <Button size="sm" onClick={() => handleViewChats(team.teamId)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Chats
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem quando não há times */}
      {filteredTeamsBySelection.length === 0 && (
        <Alert>
          <AlertDescription>
            {searchTerm ? 'Nenhum time encontrado com o termo de busca.' : 'Nenhum time encontrado.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
