import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  Users,
  RefreshCw,
  Eye,
  User,
  Phone,
  Mail
} from 'lucide-react';
import { io } from 'socket.io-client';
import { TeamLoginModal } from './TeamLoginModal';

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

interface SupervisorChatActiveProps {
  organizationId: string;
  userToken: string;
}

export const SupervisorChatActive: React.FC<SupervisorChatActiveProps> = ({
  organizationId,
  userToken
}) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [filter, setFilter] = useState<'all' | 'waiting' | 'active'>('all');
  const [currentTeam, setCurrentTeam] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<string>('');

  // Socket.IO para notificações em tempo real
  useEffect(() => {
    const socket = io('http://localhost:3001');
    
    // Conectar à organização
    socket.emit('join-organization', organizationId);
    
    // Escutar novos chats para times
    socket.on('new-team-chat', (data) => {
      console.log('Novo chat para time:', data);
      fetchChats();
    });
    
    // Escutar quando chat é pego
    socket.on('chat-claimed', (data) => {
      console.log('Chat foi pego:', data);
      fetchChats();
    });
    
    return () => {
      socket.disconnect();
    };
  }, [organizationId]);

  // Buscar todos os chats
  const fetchChats = async () => {
    try {
      setLoading(true);
      
      // Buscar chats aguardando e ativos em paralelo
      const [waitingRes, activeRes] = await Promise.all([
        fetch(`/api/teams/waiting-chats?organization_id=${organizationId}`, {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'x-user-id': 'supervisor',
            'x-organization-id': organizationId
          }
        }),
        fetch(`/api/teams/active-chats?organization_id=${organizationId}`, {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'x-user-id': 'supervisor',
            'x-organization-id': organizationId
          }
        })
      ]);
      
      const [waitingData, activeData] = await Promise.all([
        waitingRes.json(),
        activeRes.json()
      ]);
      
      // Combinar todos os chats
      const allChats = [
        ...(waitingData.chats || []).map((chat: Chat) => ({ ...chat, status: 'aguardando_atendimento' })),
        ...(activeData.chats || []).map((chat: Chat) => ({ ...chat, status: 'active' }))
      ];
      
      setChats(allChats);
    } catch (error) {
      console.error('Erro ao buscar chats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchChats();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, [organizationId, userToken]);

  // Filtrar chats
  const filteredChats = chats.filter(chat => {
    if (filter === 'waiting') return chat.status === 'aguardando_atendimento';
    if (filter === 'active') return chat.status === 'active';
    return true;
  });

  // Abrir chat em nova aba
  const openChat = (chat: Chat) => {
    const chatUrl = `/chat/${chat.id}`;
    window.open(chatUrl, '_blank');
  };

  // Estatísticas
  const waitingCount = chats.filter(c => c.status === 'aguardando_atendimento').length;
  const activeCount = chats.filter(c => c.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando chats...</span>
      </div>
    );
  }

  const handleTeamLogin = (team: any, token: string) => {
    setCurrentTeam(team);
    setSessionToken(token);
    console.log('✅ Time logado:', team, token);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Chats Ativos - Supervisão</h1>
          <p className="text-muted-foreground">
            Visualize todos os chats dos times em tempo real
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <TeamLoginModal onLoginSuccess={handleTeamLogin}>
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Login como Time
            </Button>
          </TeamLoginModal>
          
          <Button onClick={fetchChats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Time Logado */}
      {currentTeam && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-blue-900">
                  Logado como: <strong>{currentTeam.name}</strong>
                </p>
                <p className="text-sm text-blue-700">
                  Sessão ativa - Acesso às funcionalidades do time
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setCurrentTeam(null);
                setSessionToken('');
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm">Aguardando</p>
                <p className="text-2xl text-orange-500">{waitingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm">Ativos</p>
                <p className="text-2xl text-green-500">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm">Total</p>
                <p className="text-2xl text-blue-500">{chats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Todos ({chats.length})
        </Button>
        <Button 
          variant={filter === 'waiting' ? 'default' : 'outline'}
          onClick={() => setFilter('waiting')}
        >
          Aguardando ({waitingCount})
        </Button>
        <Button 
          variant={filter === 'active' ? 'default' : 'outline'}
          onClick={() => setFilter('active')}
        >
          Ativos ({activeCount})
        </Button>
      </div>

      {/* Lista de Chats */}
      {filteredChats.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum chat encontrado com o filtro selecionado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChats.map((chat) => (
            <Card 
              key={chat.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                chat.status === 'aguardando_atendimento' 
                  ? 'border-orange-200' 
                  : 'border-green-200'
              }`}
              onClick={() => setSelectedChat(chat)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="truncate">{chat.name}</span>
                  <Badge 
                    variant={chat.status === 'aguardando_atendimento' ? 'destructive' : 'default'}
                  >
                    {chat.status === 'aguardando_atendimento' ? 'Aguardando' : 'Ativo'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="">{chat.assigned_team || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plataforma:</span>
                    <span>{chat.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Criado:</span>
                    <span>{new Date(chat.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {chat.assigned_agent_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agente:</span>
                      <span className="">{chat.assigned_agent_id}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openChat(chat);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chat Selecionado */}
      {selectedChat && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Chat Selecionado: {selectedChat.name}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedChat(null)}
              >
                Fechar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p><strong>Status:</strong> 
                  <Badge 
                    variant={selectedChat.status === 'aguardando_atendimento' ? 'destructive' : 'default'}
                    className="ml-2"
                  >
                    {selectedChat.status === 'aguardando_atendimento' ? 'Aguardando' : 'Ativo'}
                  </Badge>
                </p>
                <p><strong>Plataforma:</strong> {selectedChat.platform}</p>
                <p><strong>JID:</strong> {selectedChat.whatsapp_jid}</p>
                <p><strong>Criado:</strong> {new Date(selectedChat.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <div className="space-y-2">
                {selectedChat.assigned_agent_id && (
                  <p><strong>Agente:</strong> {selectedChat.assigned_agent_id}</p>
                )}
                {selectedChat.assigned_team && (
                  <p><strong>Time:</strong> {selectedChat.assigned_team}</p>
                )}
                <p><strong>Última mensagem:</strong> {new Date(selectedChat.last_message_at).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button 
                onClick={() => openChat(selectedChat)}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Abrir Chat
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SupervisorChatActive;
