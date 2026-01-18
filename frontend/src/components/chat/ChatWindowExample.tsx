import React, { useState } from 'react';
import ChatWindow from './ChatWindow';
import type { Tables } from '@/integrations/supabase/types';

// Exemplo de uso do ChatWindow com as novas funcionalidades
export const ChatWindowExample = () => {
  const [messages, setMessages] = useState([
    {
      id: '1',
      content: 'Olá! Como posso ajudar?',
      sender: 'agent' as const,
      senderName: 'João',
      timestamp: new Date(),
      message_type: 'text' as const,
      status: 'read' as const,
      reactions: {
        '👍': ['user1', 'user2'],
        '❤️': ['user3']
      }
    },
    {
      id: '2',
      content: 'Preciso de ajuda com meu pedido',
      sender: 'user' as const,
      senderName: 'Maria',
      timestamp: new Date(),
      message_type: 'text' as const,
      status: 'read' as const
    }
  ]);

  const chat: Tables<'chats'> = {
    id: '1',
    name: 'Maria Silva',
    whatsapp_jid: '5511999999999@s.whatsapp.net',
    platform: 'WhatsApp',
    organization_id: 'org1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Função para lidar com reações
  const handleReactToMessage = (messageId: string, reaction: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const currentReactions = msg.reactions || {};
        const currentUsers = currentReactions[reaction] || [];
        
        // Se o usuário já reagiu, remove a reação
        if (currentUsers.includes('currentUser')) {
          const newUsers = currentUsers.filter(user => user !== 'currentUser');
          if (newUsers.length === 0) {
            const { [reaction]: removed, ...rest } = currentReactions;
            return { ...msg, reactions: rest };
          } else {
            return { ...msg, reactions: { ...currentReactions, [reaction]: newUsers } };
          }
        } else {
          // Adiciona a reação
          return {
            ...msg,
            reactions: { ...currentReactions, [reaction]: [...currentUsers, 'currentUser'] }
          };
        }
      }
      return msg;
    }));
  };

  // Função para lidar com resposta
  const handleReplyToMessage = (messageId: string) => {
    console.log('Respondendo à mensagem:', messageId);
    // A lógica de resposta é gerenciada pelo próprio ChatWindow
  };

  // Função para lidar com encaminhamento
  const handleForwardMessage = (messageId: string) => {
    console.log('Encaminhando mensagem:', messageId);
    // Aqui você pode abrir um modal para selecionar o chat de destino
    alert('Funcionalidade de encaminhamento - selecione o chat de destino');
  };

  // Função para enviar mensagem
  const handleSendMessage = (content: string, type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact' | 'location') => {
    const newMessage = {
      id: Date.now().toString(),
      content,
      sender: 'agent' as const,
      senderName: 'Você',
      timestamp: new Date(),
      message_type: type,
      status: 'sent' as const
    };
    setMessages(prev => [...prev, newMessage]);
  };

  return (
    <div className="h-screen">
      <ChatWindow
        chat={chat}
        messages={messages}
        onSendMessage={handleSendMessage}
        onReactToMessage={handleReactToMessage}
        onReplyToMessage={handleReplyToMessage}
        onForwardMessage={handleForwardMessage}
      />
    </div>
  );
};

export default ChatWindowExample; 