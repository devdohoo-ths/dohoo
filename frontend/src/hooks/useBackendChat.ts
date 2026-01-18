import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import io from 'socket.io-client';
import type { Tables } from '@/integrations/supabase/types';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders

type ChatData = Tables<'chats'>;
type MessageData = Tables<'messages'>;

export const useBackendChat = () => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [chats, setChats] = useState<ChatData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();
  const { user } = useAuth();

  // Buscar chats do usuário
  const fetchChats = useCallback(async () => {
    try {
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/chat-operations/chats`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar chats: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar chats');
      }

      setChats(result.chats || []);
    } catch (error) {
      console.error('❌ Erro ao buscar chats:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar conversas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Buscar mensagens de um chat
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/chat-operations/chats/${chatId}/messages`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar mensagens: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar mensagens');
      }

      // Converter mensagens para o formato esperado
      const convertedMessages = (result.messages || []).map((msg: any) => ({
        ...msg,
        sender: msg.is_from_me ? 'agent' : 'user',
        timestamp: new Date(msg.created_at),
        message_type: msg.message_type || 'text',
        metadata: {
          ...msg.metadata,
          ai_generated: msg.metadata?.ai_generated || false,
          assistant_id: msg.metadata?.assistant_id,
          tokens_used: msg.metadata?.tokens_used,
          transcription: msg.metadata?.transcription,
          transcribed_at: msg.metadata?.transcribed_at
        }
      }));

      setMessages(convertedMessages);
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar mensagens",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Enviar mensagem
  const sendMessage = useCallback(async (chatId: string, content: string, messageType: string = 'text', replyTo?: string) => {
    try {
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/chat-operations/chats/${chatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          message_type: messageType,
          reply_to: replyTo
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao enviar mensagem: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao enviar mensagem');
      }

      
      // Atualizar mensagens localmente
      const convertedMessage = {
        ...result.message,
        sender: 'agent',
        timestamp: new Date(result.message.created_at),
        message_type: result.message.message_type || 'text'
      };
      
      setMessages(prev => [...prev, convertedMessage]);
      
      // Emitir via Socket.IO para tempo real
      if (socket) {
        socket.emit('send-message', {
          chatId,
          content,
          messageType
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive",
      });
    }
  }, [socket, toast]);

  // Reenviar mensagem
  const resendMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/chat-operations/messages/${messageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          content: newContent,
          status: 'sent'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao reenviar mensagem: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao reenviar mensagem');
      }

      
      // Atualizar mensagem localmente
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent, status: 'sent' }
          : msg
      ));
      
    } catch (error) {
      console.error('❌ Erro ao reenviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Falha ao reenviar mensagem",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Criar novo chat
  const createChat = useCallback(async (name: string, platform: string = 'whatsapp') => {
    try {
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/chat-operations/chats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          platform
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar chat: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar chat');
      }

      
      // Atualizar lista de chats
      await fetchChats();
      
      toast({
        title: "Sucesso",
        description: "Nova conversa criada",
      });
      
      return result.chat;
    } catch (error) {
      console.error('❌ Erro ao criar chat:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar conversa",
        variant: "destructive",
      });
    }
  }, [fetchChats, toast]);

  // Marcar mensagens como lidas
  const markMessagesAsRead = useCallback(async (chatId: string) => {
    try {
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/chat-operations/chats/${chatId}/mark-read`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao marcar mensagens como lidas: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao marcar mensagens como lidas');
      }

      
      // Atualizar lista de chats para refletir mudanças
      await fetchChats();
      
    } catch (error) {
      console.error('❌ Erro ao marcar mensagens como lidas:', error);
    }
  }, [fetchChats]);

  // Enviar indicador de digitação
  const sendTypingIndicator = useCallback((chatId: string, isTyping: boolean) => {
    if (socket) {
      socket.emit('typing', { chatId, isTyping });
    }
  }, [socket]);

  // Filtrar chats baseado no termo de busca e filtro
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'unread' && chat.unread_count > 0) ||
                         (filter === 'read' && chat.unread_count === 0);
    return matchesSearch && matchesFilter;
  });

  // Configurar Socket.IO para tempo real
  useEffect(() => {
    if (!user?.id) {
      return;
    }


    let socketUrl = apiBase;
    socketUrl = socketUrl.replace(/^https?:\/\/https?:\/\//, 'http://');
    socketUrl = socketUrl.replace(/^https?:\/\/http\//, 'http://');
    socketUrl = socketUrl.replace(/^https?:\/\/https\//, 'https://');
    
    if (!socketUrl.startsWith('http://') && !socketUrl.startsWith('https://')) {
      socketUrl = `http://${socketUrl}`;
    }
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      auth: {
        userId: user.id
      }
    });
    
    newSocket.on('connect', () => {
      setSocket(newSocket);
      newSocket.emit('join-user', user.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão Socket.IO:', error);
    });

    newSocket.on('disconnect', (reason) => {
    });

    newSocket.on('new-message', async (data) => {
      
      if (!data || !data.message || !data.chatId) {
        console.error('❌ Dados inválidos recebidos:', data);
        return;
      }

      if (data.userId && data.userId !== user.id) {
        console.warn('🚨 Tentativa de receber mensagem de outro usuário bloqueada');
        return;
      }

      const { chatId, message, isAI } = data;
      
      if (activeChat === chatId) {
        setMessages(prev => {
          if (message.id && prev.some(msg => msg.id === message.id)) {
            return prev;
          }
          const convertedMessage = {
            ...message,
            sender: message.is_from_me ? 'agent' : 'user',
            timestamp: new Date(message.created_at),
            message_type: message.message_type || 'text',
            metadata: {
              ai_generated: isAI || false,
              assistant_id: null,
              tokens_used: null,
              transcription: null,
              transcribed_at: null
            }
          };
          return [...prev, convertedMessage];
        });
      }
      
      fetchChats();
      
      if (activeChat !== chatId && !message.is_from_me) {
        toast({
          title: "Nova mensagem",
          description: `${message.sender_name || 'Cliente'}: ${message.content}`,
        });
      }
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [activeChat, fetchChats, toast, user]);

  // Entrar no chat ativo
  useEffect(() => {
    if (socket && activeChat && user?.id) {
      socket.emit('join-chat', { chatId: activeChat, userId: user.id });
    }
  }, [socket, activeChat, user]);

  // Carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await fetchChats();
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        toast({
          title: "Erro",
          description: "Falha ao carregar conversas",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [fetchChats, toast]);

  // Carregar mensagens quando chat ativo muda
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat);
      
      markMessagesAsRead(activeChat).then(() => {
        setTimeout(() => {
          fetchChats();
        }, 500);
      });
    }
  }, [activeChat, fetchMessages, markMessagesAsRead, fetchChats]);

  return {
    chats: filteredChats,
    messages,
    activeChat,
    loading,
    searchTerm,
    filter,
    socket,
    setActiveChat,
    setSearchTerm,
    setFilter,
    sendMessage,
    resendMessage,
    createChat,
    fetchChats,
    fetchMessages,
    markMessagesAsRead,
    sendTypingIndicator
  };
}; 