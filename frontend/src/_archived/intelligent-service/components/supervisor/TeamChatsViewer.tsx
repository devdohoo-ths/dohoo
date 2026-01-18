import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  Users,
  RefreshCw,
  Eye,
  User
} from 'lucide-react';
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

interface TeamChatsViewerProps {
  organizationId: string;
  userToken: string;
}

export const TeamChatsViewer: React.FC<TeamChatsViewerProps> = ({
  organizationId,
  userToken
}) => {
  const [waitingChats, setWaitingChats] = useState<Chat[]>([]);
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  // Socket.IO para notificações em tempo real
  useEffect(() => {
    const socket = io('http://localhost:3001');
    
    // Conectar à organização
    socket.emit('join-organization', organizationId);
    
    // Escutar novos chats para times
    socket.on('new-team-chat', (data) => {
      console.log('📨 Novo chat para time:', data);
      fetchWaitingChats();
    });
    
    // Escutar transferências de chat para time
    socket.on('chat-transferred-to-team', (data) => {
      console.log('🔄 Chat transferido para time:', data);
      fetchWaitingChats();
      fetchActiveChats();
    });
    
    // Escutar quando chat é pego
    socket.on('chat-claimed', (data) => {
      console.log('✅ Chat foi pego:', data);
      fetchWaitingChats();
      fetchActiveChats();
    });
    
    return () => {
      socket.disconnect();
    };
  }, [organizationId]);

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

  // Abrir chat em nova aba
  const openChat = (chat: Chat) => {
    const chatUrl = `/chat/${chat.id}`;
    window.open(chatUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando chats...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Chats dos Times</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie chats aguardando e ativos
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm">Aguardando</p>
                <p className="text-2xl text-orange-500">{waitingChats.length}</p>
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
                <p className="text-2xl text-green-500">{activeChats.length}</p>
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
                <p className="text-2xl text-blue-500">{waitingChats.length + activeChats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Chats */}
      <Tabs defaultValue="waiting" className="space-y-4">
        <TabsList>
          <TabsTrigger value="waiting" className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Aguardando ({waitingChats.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Ativos ({activeChats.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting" className="space-y-4">
          {waitingChats.length === 0 ? (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Nenhum chat aguardando atendimento no momento
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {waitingChats.map((chat) => (
                <Card key={chat.id} className="border-orange-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="truncate">{chat.name}</span>
                      <Badge variant="destructive">Aguardando</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="">{chat.assigned_team}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plataforma:</span>
                        <span>{chat.platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Criado:</span>
                        <span>{new Date(chat.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => openChat(chat)}
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
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeChats.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum chat ativo no momento
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeChats.map((chat) => (
                <Card key={chat.id} className="border-green-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="truncate">{chat.name}</span>
                      <Badge variant="default">Ativo</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agente:</span>
                        <span className="">{chat.assigned_agent_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plataforma:</span>
                        <span>{chat.platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última mensagem:</span>
                        <span>{new Date(chat.last_message_at).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => openChat(chat)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Entrar no Chat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
            <div className="space-y-2">
              <p><strong>Status:</strong> {selectedChat.status}</p>
              <p><strong>Plataforma:</strong> {selectedChat.platform}</p>
              <p><strong>JID:</strong> {selectedChat.whatsapp_jid}</p>
              <p><strong>Criado:</strong> {new Date(selectedChat.created_at).toLocaleString('pt-BR')}</p>
              {selectedChat.assigned_agent_id && (
                <p><strong>Agente:</strong> {selectedChat.assigned_agent_id}</p>
              )}
              {selectedChat.assigned_team && (
                <p><strong>Time:</strong> {selectedChat.assigned_team}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamChatsViewer;
