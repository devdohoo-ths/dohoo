import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { io } from 'socket.io-client';

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
  teamName: string;
  totalChats: number;
  waitingChats: number;
  activeChats: number;
  onlineAgents: number;
}

interface SupervisorDashboardProps {
  organizationId: string;
  userToken: string;
}

export const DashboardSupervisor: React.FC<SupervisorDashboardProps> = ({
  organizationId,
  userToken
}) => {
  const [teamsStats, setTeamsStats] = useState<TeamStats[]>([]);
  const [waitingChats, setWaitingChats] = useState<Chat[]>([]);
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Socket.IO para notificações em tempo real
  useEffect(() => {
    const socket = io('http://localhost:3001');
    
    // Conectar à organização
    socket.emit('join-organization', organizationId);
    
    // Escutar novos chats para times
    socket.on('new-team-chat', (data) => {
      console.log('📨 Novo chat para time:', data);
      // Atualizar lista de chats aguardando
      fetchWaitingChats();
    });
    
    // Escutar transferências de chat para time
    socket.on('chat-transferred-to-team', (data) => {
      console.log('🔄 Chat transferido para time:', data);
      // Atualizar listas
      fetchWaitingChats();
      fetchActiveChats();
      fetchTeamsStats();
    });
    
    // Escutar quando chat é pego
    socket.on('chat-claimed', (data) => {
      console.log('✅ Chat foi pego:', data);
      // Atualizar listas
      fetchWaitingChats();
      fetchActiveChats();
    });
    
    return () => {
      socket.disconnect();
    };
  }, [organizationId]);

  // Buscar estatísticas dos times
  const fetchTeamsStats = async () => {
    try {
      const response = await fetch(`/api/teams?organization_id=${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'x-user-id': 'supervisor',
          'x-organization-id': organizationId
        }
      });
      
      const { teams } = await response.json();
      
      // Buscar estatísticas para cada time
      const statsPromises = teams.map(async (team: any) => {
        const [waitingRes, activeRes, agentsRes] = await Promise.all([
          fetch(`/api/teams/queue?organization_id=${organizationId}&team=${team.name}`, {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'x-user-id': 'supervisor',
              'x-organization-id': organizationId
            }
          }),
          fetch(`/api/teams/active-chats?organization_id=${organizationId}&team=${team.name}`, {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'x-user-id': 'supervisor',
              'x-organization-id': organizationId
            }
          }),
          fetch(`/api/teams/agents?organization_id=${organizationId}&team=${team.name}`, {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'x-user-id': 'supervisor',
              'x-organization-id': organizationId
            }
          })
        ]);
        
        const [waitingData, activeData, agentsData] = await Promise.all([
          waitingRes.json(),
          activeRes.json(),
          agentsRes.json()
        ]);
        
        return {
          teamName: team.name,
          totalChats: (waitingData.chats?.length || 0) + (activeData.chats?.length || 0),
          waitingChats: waitingData.chats?.length || 0,
          activeChats: activeData.chats?.length || 0,
          onlineAgents: agentsData.agents?.filter((a: any) => a.is_online)?.length || 0
        };
      });
      
      const stats = await Promise.all(statsPromises);
      setTeamsStats(stats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas dos times:', error);
    }
  };

  // Buscar chats aguardando
  const fetchWaitingChats = async () => {
    try {
      const response = await fetch(`/api/teams/waiting-chats?organization_id=${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'x-user-id': 'supervisor',
          'x-organization-id': organizationId
        }
      });
      
      const { chats } = await response.json();
      setWaitingChats(chats || []);
    } catch (error) {
      console.error('Erro ao buscar chats aguardando:', error);
    }
  };

  // Buscar chats ativos
  const fetchActiveChats = async () => {
    try {
      const response = await fetch(`/api/teams/active-chats?organization_id=${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'x-user-id': 'supervisor',
          'x-organization-id': organizationId
        }
      });
      
      const { chats } = await response.json();
      setActiveChats(chats || []);
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
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [organizationId, userToken]);

  // Filtrar chats por time
  const filteredWaitingChats = waitingChats.filter(chat => 
    selectedTeam === 'all' || chat.assigned_team === selectedTeam
  );
  
  const filteredActiveChats = activeChats.filter(chat => 
    selectedTeam === 'all' || chat.assigned_team === selectedTeam
  );

  // Filtrar por termo de busca
  const searchFilter = (chat: Chat) => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.whatsapp_jid.includes(searchTerm);

  const finalWaitingChats = filteredWaitingChats.filter(searchFilter);
  const finalActiveChats = filteredActiveChats.filter(searchFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Dashboard de Supervisão</h1>
          <p className="text-muted-foreground">
            Gerencie chats e times em tempo real
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas dos Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {teamsStats.map((team) => (
          <Card key={team.teamName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <Users className="h-4 w-4 mr-2" />
                {team.teamName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <Badge variant="outline">{team.totalChats}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Aguardando:</span>
                  <Badge variant="destructive">{team.waitingChats}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Ativos:</span>
                  <Badge variant="default">{team.activeChats}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Online:</span>
                  <Badge variant="secondary">{team.onlineAgents}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os times</SelectItem>
            {teamsStats.map((team) => (
              <SelectItem key={team.teamName} value={team.teamName}>
                {team.teamName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs de Chats */}
      <Tabs defaultValue="waiting" className="space-y-4">
        <TabsList>
          <TabsTrigger value="waiting" className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Aguardando ({finalWaitingChats.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Ativos ({finalActiveChats.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting" className="space-y-4">
          {finalWaitingChats.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum chat aguardando atendimento
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finalWaitingChats.map((chat) => (
                <Card key={chat.id} className="border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{chat.name}</span>
                      <Badge variant="destructive">Aguardando</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time:</span>
                        <span>{chat.assigned_team}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plataforma:</span>
                        <span>{chat.platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Criado:</span>
                        <span>{new Date(chat.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </Button>
                      <Button size="sm" variant="outline">
                        <Users className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {finalActiveChats.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum chat ativo no momento
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finalActiveChats.map((chat) => (
                <Card key={chat.id} className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{chat.name}</span>
                      <Badge variant="default">Ativo</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agente:</span>
                        <span>{chat.assigned_agent_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plataforma:</span>
                        <span>{chat.platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última mensagem:</span>
                        <span>{new Date(chat.last_message_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Entrar no Chat
                      </Button>
                      <Button size="sm" variant="outline">
                        <Users className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardSupervisor;
