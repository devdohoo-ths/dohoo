import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChatOperations } from './chat/useChatOperations';
import { useMessageOperations } from './chat/useMessageOperations';
import { useRealtimeSubscriptions } from './chat/useRealtimeSubscriptions';
import { useChatFilters } from './chat/useChatFilters';
import { useRealtimeChat } from './useRealtimeChat';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts'; // ✅ NOVO: Importar hook de contas WhatsApp
import io from 'socket.io-client';
import type { Tables } from '@/integrations/supabase/types';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
type ChatData = Tables<'chats'>;
type MessageData = Tables<'messages'>;

export const useSupabaseChat = () => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { accounts } = useWhatsAppAccounts(); // ✅ NOVO: Obter contas WhatsApp
  
  // ✅ NOVO: Obter account_id do primeiro número conectado
  const connectedAccountId = useMemo(() => {
    const connectedAccount = accounts.find(acc => acc.status === 'connected');
    return connectedAccount?.account_id || connectedAccount?.id || null;
  }, [accounts]);
  
  // ✅ OTIMIZADO: Debounce ref declarado no topo para evitar problemas de inicialização
  const fetchChatsDebouncedRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ NOVO: Cache para verificação de propriedade do chat (evitar múltiplas requisições)
  const chatOwnershipCacheRef = useRef<Map<string, { valid: boolean; timestamp: number }>>(new Map());
  
  // ✅ CORREÇÃO: Refs para quebrar dependência circular com useRealtimeChat
  const markMessagesAsReadRef = useRef<((chatId: string) => Promise<void>) | null>(null);
  
  const {
    chats: rawChats,
    loading,
    setLoading,
    fetchChats,
    createChat,
    setChats,
    updateChatUnreadCount,
    deleteChat
  } = useChatOperations({ accountId: connectedAccountId }); // ✅ NOVO: Passar accountId para filtrar chats

  const {
    messages,
    setMessages,
    fetchMessages,
    sendMessage,
    resendMessage,
    markMessagesAsRead: markMessagesAsReadFromOperations // ✅ CORREÇÃO: Pegar markMessagesAsRead de useMessageOperations
  } = useMessageOperations();

  const {
    searchTerm,
    filter,
    setSearchTerm,
    setFilter,
    filteredChats
  } = useChatFilters(rawChats);

  // Configurar Socket.IO para tempo real
  useEffect(() => {
    // 🔒 SEGURANÇA: Só configurar Socket.IO se o usuário estiver autenticado
    if (!user?.id) {
      return;
    }

    const setupSocket = async () => {
      // Obter token de autenticação do localStorage
      const storedSession = localStorage.getItem('auth_session');
      if (!storedSession) {
        console.error('❌ [Socket.IO] Sessão não encontrada');
        return;
      }

      let session;
      try {
        session = JSON.parse(storedSession);
      } catch (e) {
        console.error('❌ [Socket.IO] Erro ao parsear sessão:', e);
        return;
      }

      let accessToken = session?.access_token;
      if (!accessToken) {
        console.error('❌ [Socket.IO] Token não encontrado na sessão');
        return;
      }

      // Verificar se token ainda é válido
      const expiresAt = session.expires_at || 0;
      const now = Date.now() / 1000;
      
      if (expiresAt < now) {
        // Token expirado, tentar refresh
        try {
          const response = await fetch(`${apiBase}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.session) {
              localStorage.setItem('auth_session', JSON.stringify(data.session));
              session = data.session;
              accessToken = data.session.access_token;
            }
          }
        } catch (refreshError) {
          console.error('❌ [Socket.IO] Erro ao fazer refresh:', refreshError);
          return;
        }
      }

      // Garantir que a URL esteja formatada corretamente
      let socketUrl = apiBase;
      
      // Limpar URL malformada e garantir formato correto (proteção contra erros de .env)
      socketUrl = socketUrl.replace(/^https?:\/\/https?:\/\//, 'http://'); // Remove duplicações
      socketUrl = socketUrl.replace(/^https?:\/\/http\//, 'http://'); // Corrige http sem ://
      socketUrl = socketUrl.replace(/^https?:\/\/https\//, 'https://'); // Corrige https sem ://
      
      // Verificar se contém protocolo
      if (!socketUrl.startsWith('http://') && !socketUrl.startsWith('https://')) {
        socketUrl = `http://${socketUrl}`;
      }
      
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        // 🔒 SEGURANÇA: Incluir token de autenticação na conexão
        auth: {
          token: accessToken,
          userId: user.id,
          organizationId: organization?.id || null
        },
        // Headers de autenticação
        extraHeaders: {
          'Authorization': `Bearer ${accessToken}`,
          'x-user-id': user.id,
          'x-organization-id': organization?.id || ''
        }
      });
      
      newSocket.on('connect', () => {
        setSocket(newSocket);
        
        // 🔒 SEGURANÇA: Entrar na sala específica do usuário
        newSocket.emit('join-user', user.id);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão Socket.IO:', error);
      });

      newSocket.on('disconnect', (reason) => {
      });

      // 🔒 SEGURANÇA: Escutar novas mensagens com verificações robustas
      newSocket.on('new-message', async (data) => {
        try {
          console.log('📨 [Socket.IO] Evento new-message recebido:', {
            chatId: data?.chatId,
            messageId: data?.message?.id,
            userId: data?.userId,
            currentUserId: user.id,
            isFromMe: data?.message?.is_from_me
          });
        
          // Verificação básica de dados
          if (!data || !data.message || !data.chatId) {
            console.error('❌ Dados inválidos recebidos:', data);
            return;
          }

          // 🔒 VERIFICAÇÃO CRÍTICA 1: ID do usuário
          // ✅ CORREÇÃO: Permitir mensagens próprias (is_from_me) mesmo se userId não corresponder exatamente
          // (isso pode acontecer em alguns casos de sincronização)
          if (data.userId && data.userId !== user.id && !data.message.is_from_me) {
            console.warn('🚨 Tentativa de receber mensagem de outro usuário bloqueada:', { 
              messageUserId: data.userId, 
              currentUserId: user.id,
              chatId: data.chatId,
              messageContent: data.message?.content?.substring(0, 50) 
            });
            return;
          }

          const { chatId, message, isAI } = data;
          
          // ✅ OTIMIZAÇÃO: Se for mensagem própria (is_from_me), pular verificação de propriedade do chat
          // (mensagens próprias sempre devem ser exibidas)
          if (!message.is_from_me) {
            try {
              // ✅ OTIMIZADO: Usar cache para evitar verificar o mesmo chat múltiplas vezes
              const cacheKey = data.chatId;
              const cached = chatOwnershipCacheRef.current.get(cacheKey);
              const now = Date.now();
              
              // Se tem cache válido (menos de 30 segundos), usar o cache
              if (cached && (now - cached.timestamp) < 30000) {
                if (!cached.valid) {
                  console.warn('🚨 Mensagem de chat bloqueada (cache):', { chatId: data.chatId });
                  return;
                }
              } else {
                // 🔒 VERIFICAÇÃO CRÍTICA 2: Propriedade do chat no banco de dados via API (apenas para mensagens de outros)
                const headers = await getAuthHeaders();
                const chatResponse = await fetch(`${apiBase}/api/chat/${data.chatId}`, {
                  headers
                });

                if (!chatResponse.ok) {
                  chatOwnershipCacheRef.current.set(cacheKey, { valid: false, timestamp: now });
                  console.warn('🚨 Mensagem de chat que não pertence ao usuário bloqueada (verificação no banco):', {
                    chatId: data.chatId,
                    currentUserId: user.id,
                    error: `Erro ${chatResponse.status}`
                  });
                  return;
                }

                const chatData = await chatResponse.json();
                const chatOwnership = chatData.chat || chatData.data;
                const isValid = chatOwnership && chatOwnership.assigned_agent_id === user.id;

                // Salvar no cache
                chatOwnershipCacheRef.current.set(cacheKey, { valid: isValid, timestamp: now });

                if (!isValid) {
                  console.warn('🚨 Mensagem de chat que não pertence ao usuário bloqueada (verificação no banco):', {
                    chatId: data.chatId,
                    currentUserId: user.id,
                    assignedAgentId: chatOwnership?.assigned_agent_id
                  });
                  return;
                }
              }
            } catch (error) {
              console.error('❌ Erro ao verificar propriedade do chat:', error);
              // ✅ Não bloquear mensagem própria mesmo se houver erro na verificação
              if (!message.is_from_me) {
                return;
              }
            }
          }
            
          // Se for do chat ativo, adicionar à lista de mensagens
          if (activeChat === chatId) {
            setMessages(prev => {
              // Verificar se a mensagem já existe
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
          
          // ✅ OTIMIZADO: Usar debounce para atualizar lista de chats (evitar múltiplas requisições)
          if (fetchChatsDebouncedRef.current) {
            clearTimeout(fetchChatsDebouncedRef.current);
          }
          fetchChatsDebouncedRef.current = setTimeout(() => {
            fetchChats();
          }, 2000); // Debounce de 2 segundos
          
          // Notificação apenas se não for do chat ativo e não for minha mensagem
          if (activeChat !== chatId && !message.is_from_me) {
            toast({
              title: "Nova mensagem",
              description: `${message.sender_name || 'Cliente'}: ${message.content}`,
            });
          }
        } catch (error) {
          console.error('❌ Erro geral ao processar nova mensagem:', error);
        }
      });

      return () => {
        newSocket.disconnect();
        setSocket(null);
      };
    };

    setupSocket();
  }, [activeChat, setMessages, toast, user, organization?.id]); // ✅ OTIMIZADO: Removido fetchChats das dependências para evitar reconexões

  // 🔒 SEGURANÇA: Entrar no chat ativo apenas se o usuário for autenticado
  useEffect(() => {
    if (socket && activeChat && user?.id) {
      // Incluir ID do usuário ao entrar no chat
      socket.emit('join-chat', { chatId: activeChat, userId: user.id });
    }
  }, [socket, activeChat, user]);

  // ✅ CORREÇÃO: Criar refs para callbacks antes de useRealtimeChat para quebrar dependência circular
  const handleNewMessageRef = useRef<((message: MessageData) => void) | null>(null);
  const handleChatUpdateRef = useRef<((chat?: any) => void) | null>(null);
  const handleMessageUpdateRef = useRef<((message: MessageData) => void) | null>(null);
  
  // ✅ CORREÇÃO: Criar callbacks estáveis ANTES de passar para useRealtimeChat
  const stableOnNewMessage = useCallback((message: MessageData) => {
    handleNewMessageRef.current?.(message);
  }, []);
  
  const stableOnChatUpdate = useCallback((chat?: any) => {
    handleChatUpdateRef.current?.(chat);
  }, []);
  
  const stableOnMessageUpdate = useCallback((message: MessageData) => {
    handleMessageUpdateRef.current?.(message);
  }, []);
  
  // ✅ CONSOLIDADO: Usar apenas uma subscription realtime para evitar conflitos
  // ✅ CONSOLIDADO: Usar apenas uma subscription realtime para evitar conflitos
  const { isConnected } = useRealtimeChat({
    onNewMessage: stableOnNewMessage,
    onChatUpdate: stableOnChatUpdate,
    onMessageUpdate: stableOnMessageUpdate
  });
  
  // ✅ CORREÇÃO: markMessagesAsRead já vem de useMessageOperations acima

  // ✅ CORREÇÃO: Atualizar ref quando markMessagesAsRead mudar
  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsReadFromOperations;
  }, [markMessagesAsReadFromOperations]);

  // Callbacks memoizadas para evitar reconexões
  const handleNewMessage = useCallback((newMessage: MessageData) => {
    if (!newMessage || !newMessage.chat_id) {
      console.error('Mensagem inválida recebida:', newMessage);
      return;
    }

    if (activeChat === newMessage.chat_id) {
      setMessages(prev => {
        if (newMessage.id && prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        const convertedMessage = {
          ...newMessage,
          sender: newMessage.is_from_me ? 'agent' : 'user',
          timestamp: new Date(newMessage.created_at),
          message_type: newMessage.message_type || 'text',
          metadata: newMessage.metadata || {}
        };
        return [...prev, convertedMessage];
      });
      // ✅ CORREÇÃO: Usar ref para evitar dependência circular
      if (markMessagesAsReadRef.current) {
        markMessagesAsReadRef.current(newMessage.chat_id);
      }
    }
    
    // ✅ OTIMIZAÇÃO: Debounce aumentado para 2 segundos para reduzir requisições
    if (fetchChatsDebouncedRef.current) {
      clearTimeout(fetchChatsDebouncedRef.current);
    }
    fetchChatsDebouncedRef.current = setTimeout(() => {
      fetchChats();
    }, 2000); // ✅ AUMENTADO: De 500ms para 2 segundos
  }, [activeChat, setMessages, fetchChats]);

  const handleChatUpdate = useCallback((updatedChat?: any) => {
    
    // 🔥 ATUALIZAÇÃO IMEDIATA: Se recebeu unread_count atualizado, aplicar localmente
    if (updatedChat?.id && typeof updatedChat.unread_count === 'number') {
      updateChatUnreadCount(updatedChat.id, updatedChat.unread_count);
      // Não precisa fazer fetchChats se já temos o unread_count atualizado
      return;
    }
    
    // ✅ OTIMIZAÇÃO: Debounce aumentado para 2 segundos para reduzir requisições
    if (fetchChatsDebouncedRef.current) {
      clearTimeout(fetchChatsDebouncedRef.current);
    }
    fetchChatsDebouncedRef.current = setTimeout(() => {
      fetchChats();
    }, 2000); // ✅ AUMENTADO: De 500ms para 2 segundos
    
    // ✅ OTIMIZADO: Debounce também para fetchMessages quando chat atualiza
    // Só recarregar mensagens se for realmente necessário (chat ativo)
    if (updatedChat?.id && activeChat === updatedChat.id) {
      // ✅ Adicionar pequeno debounce para evitar múltiplas chamadas rápidas
      setTimeout(() => {
        fetchMessages(updatedChat.id);
      }, 500);
    }
  }, [fetchChats, fetchMessages, activeChat, updateChatUnreadCount]);

  // ✅ Função updateChatUnreadCount já disponível via useChatOperations

  const handleMessageUpdate = useCallback((updatedMessage: MessageData) => {
    if (!updatedMessage || !updatedMessage.chat_id || !updatedMessage.id) {
      console.error('Mensagem inválida recebida:', updatedMessage);
      return;
    }

    if (activeChat === updatedMessage.chat_id) {
      setMessages(prev => prev.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      ));
    }
  }, [activeChat, setMessages]);

  // ✅ CORREÇÃO: Atualizar refs dos callbacks quando mudarem
  useEffect(() => {
    handleNewMessageRef.current = handleNewMessage;
  }, [handleNewMessage]);

  useEffect(() => {
    handleChatUpdateRef.current = handleChatUpdate;
  }, [handleChatUpdate]);

  useEffect(() => {
    handleMessageUpdateRef.current = handleMessageUpdate;
  }, [handleMessageUpdate]);

  // useRealtimeSubscriptions({
  //   activeChat,
  //   fetchChats,
  //   setMessages
  // });

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
  }, [fetchChats, setLoading, toast]);

  // ✨ SIMPLIFICADO: Apenas carregar mensagens quando chat ativo muda
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat);
      
      // ✅ OTIMIZADO: Marcar como lida SEM recarregar lista imediatamente
      // O Realtime já vai atualizar o unread_count automaticamente via handleChatUpdate
      markMessagesAsReadFromOperations(activeChat);
      // ✅ REMOVIDO: setTimeout com fetchChats - não precisa recarregar, o Realtime atualiza
    }
  }, [activeChat, fetchMessages, markMessagesAsReadFromOperations]);

  // Enhanced send message with better error handling
  const enhancedSendMessage = async (chatId: string, content: string, messageType: string = 'text', replyTo?: string) => {
    try {
      await sendMessage(chatId, content, messageType, replyTo);
      
      // Emitir via Socket.IO para tempo real
      if (socket) {
        socket.emit('send-message', {
          chatId,
          content,
          messageType
        });
      }
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive",
      });
    }
  };

  // Enhanced create chat
  const enhancedCreateChat = async (name: string, platform: string = 'whatsapp') => {
    try {
      const newChat = await createChat(name, platform);
      if (newChat) {
        setActiveChat(newChat.id);
        toast({
          title: "Sucesso",
          description: "Nova conversa criada",
        });
      }
      return newChat;
    } catch (error) {
      console.error('Erro ao criar chat:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar conversa",
        variant: "destructive",
      });
    }
  };

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
    sendMessage: enhancedSendMessage,
    resendMessage,
    createChat: enhancedCreateChat,
    fetchChats,
    fetchMessages,
    markMessagesAsRead: markMessagesAsReadFromOperations,
    deleteChat
  };
};
