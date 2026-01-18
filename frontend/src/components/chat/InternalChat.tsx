
import React, { useState, useRef, useEffect } from 'react';
import { Send, Users, Search, Plus, MoreVertical, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface InternalChatUser {
  id: string;
  name: string;
  role: string;
  isOnline: boolean;
  avatar?: string;
}

interface InternalChatMessage {
  id: string;
  senderId: string;
  sender: InternalChatUser;
  content: string;
  timestamp: Date;
  type: 'text' | 'system';
}

const InternalChat = () => {
  const [message, setMessage] = useState('');
  const [activeChat, setActiveChat] = useState<string>('team-general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const users: InternalChatUser[] = [
    { id: '1', name: 'Ana Silva', role: 'Manager', isOnline: true },
    { id: '2', name: 'Carlos Santos', role: 'Agent', isOnline: true },
    { id: '3', name: 'Maria Costa', role: 'Agent', isOnline: false },
    { id: '4', name: 'João Oliveira', role: 'Admin', isOnline: true },
  ];

  const chats = [
    {
      id: 'team-general',
      name: 'Equipe Geral',
      participants: users.length,
      lastMessage: 'Reunião às 15h hoje',
      isGroup: true
    },
    {
      id: 'support-team',
      name: 'Suporte Técnico',
      participants: 3,
      lastMessage: 'Cliente relatou problema no sistema',
      isGroup: true
    },
    {
      id: 'direct-ana',
      name: 'Ana Silva',
      participants: 2,
      lastMessage: 'Pode revisar o relatório?',
      isGroup: false
    }
  ];

  const messages: InternalChatMessage[] = [
    {
      id: '1',
      senderId: '1',
      sender: users[0],
      content: 'Bom dia pessoal! Temos reunião às 15h hoje.',
      timestamp: new Date(Date.now() - 3600000),
      type: 'text'
    },
    {
      id: '2',
      senderId: '2',
      sender: users[1],
      content: 'Perfeito! Já preparei o relatório de atendimentos.',
      timestamp: new Date(Date.now() - 1800000),
      type: 'text'
    },
    {
      id: '3',
      senderId: 'system',
      sender: { id: 'system', name: 'Sistema', role: 'system', isOnline: true },
      content: 'Maria Costa saiu do chat',
      timestamp: new Date(Date.now() - 900000),
      type: 'system'
    },
    {
      id: '4',
      senderId: '4',
      sender: users[3],
      content: 'Ótimo trabalho da equipe hoje! 💪',
      timestamp: new Date(),
      type: 'text'
    }
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('Enviando mensagem interna:', message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Lista de Chats Internos */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center space-x-2">
              <Users size={20} />
              <span>Chat Interno</span>
            </h2>
            <Button size="sm" variant="outline">
              <Plus size={16} />
            </Button>
          </div>
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar conversas..." className="pl-10" />
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={cn(
                "p-4 border-b border-border cursor-pointer transition-colors hover:bg-accent",
                activeChat === chat.id && "bg-accent"
              )}
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white">
                  {chat.isGroup ? <Users size={16} /> : chat.name.charAt(0)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate">{chat.name}</h3>
                    {chat.isGroup && (
                      <Badge variant="secondary" className="text-xs">
                        {chat.participants}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {chat.lastMessage}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Usuários Online */}
        <div className="p-4 border-t border-border">
          <h3 className="text-sm mb-3">Online ({users.filter(u => u.isOnline).length})</h3>
          <div className="space-y-2">
            {users.filter(u => u.isOnline).map((user) => (
              <div key={user.id} className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{user.name}</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header do Chat */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white">
                <Users size={16} />
              </div>
              <div>
                <h3 className="">Equipe Geral</h3>
                <p className="text-sm text-muted-foreground">
                  {users.filter(u => u.isOnline).length} membros online
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline">
                <Phone size={16} />
              </Button>
              <Button size="sm" variant="outline">
                <Video size={16} />
              </Button>
              <Button size="sm" variant="outline">
                <MoreVertical size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn(
              "flex space-x-3",
              msg.type === 'system' && "justify-center"
            )}>
              {msg.type === 'system' ? (
                <div className="text-sm text-muted-foreground bg-accent px-3 py-1 rounded-full">
                  {msg.content}
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                    {msg.sender.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm">{msg.sender.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {msg.sender.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {msg.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de Mensagem */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                className="resize-none"
              />
            </div>
            <Button onClick={handleSendMessage} disabled={!message.trim()}>
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalChat;
