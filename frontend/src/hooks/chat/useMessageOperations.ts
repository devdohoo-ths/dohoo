import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
import axios from 'axios';

type MessageData = Tables<'messages'>;

export const useMessageOperations = () => {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const { toast } = useToast();
  const { user, profile } = useAuth(); // ✅ CORRIGIDO: Adicionar user do useAuth

  // ✅ OTIMIZAÇÃO: Cache de últimas chamadas para evitar requisições duplicadas
  const lastFetchRef = useRef<Map<string, number>>(new Map());
  const FETCH_CACHE_TIME = 5000; // Cache de 5 segundos
  // ✅ Cache simples por chat (mensagens recentes) para reduzir GETs
  const cacheRef = useRef<Map<string, { ts: number; data: MessageData[] }>>(new Map());
  
  // Buscar mensagens de um chat específico
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      // ✅ OTIMIZAÇÃO: Throttle - evitar chamadas muito frequentes para o mesmo chat
      const now = Date.now();
      const lastFetch = lastFetchRef.current.get(chatId) || 0;
      const timeSinceLastFetch = now - lastFetch;
      
      if (timeSinceLastFetch < FETCH_CACHE_TIME) {
        // Se foi chamado há menos de 2 segundos, pular (dados já estão frescos)
        console.log('⏭️ Pulando fetchMessages - muito recente');
        return;
      }
      
      lastFetchRef.current.set(chatId, now);
      console.log('📨 Buscando mensagens para chat:', chatId);
      
      // ✅ MIGRADO: Verificação de ownership agora é feita pelo backend na API
      // O endpoint /api/chat-operations/chats/:chatId/messages já valida o acesso

      // ✅ CACHE: usar se ainda válido
      const cached = cacheRef.current.get(chatId);
      if (cached && now - cached.ts < FETCH_CACHE_TIME) {
        setMessages(cached.data);
        return;
      }

      // Buscar via backend otimizado
      const headers = await getAuthHeaders();
      const response = await axios.get(`${apiBase}/api/chat-operations/chats/${chatId}/messages`, { headers });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao buscar mensagens');
      }
      const data = response.data.messages as MessageData[];
      
      // Converter is_from_me para sender
      const convertedMessages = data?.map(msg => ({
        ...msg,
        sender: msg.is_from_me ? 'agent' : 'user',
        timestamp: new Date(msg.created_at),
        message_type: (msg.message_type as 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact' | 'location') || 'text',
        // Preservar metadados da IA
        metadata: {
          ...msg.metadata,
          ai_generated: msg.metadata?.ai_generated || false,
          assistant_id: msg.metadata?.assistant_id,
          tokens_used: msg.metadata?.tokens_used,
          transcription: msg.metadata?.transcription,
          transcribed_at: msg.metadata?.transcribed_at
        }
      })) || [];
      setMessages(convertedMessages);
      cacheRef.current.set(chatId, { ts: now, data: convertedMessages });
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar mensagens",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Enviar mensagem
  const sendMessage = useCallback(async (chatId: string, content: string, type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact' | 'location' = 'text', replyTo?: string) => {
    try {
      console.log('📤 Enviando mensagem para chat:', chatId);
      
      // ✅ MIGRADO: Usar user e profile do hook useAuth
      if (!user || !profile) {
        console.error('❌ Usuário não autenticado');
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const userName = profile.name || 'Você';
      
      // ✅ MIGRADO: Enviar mensagem via API do backend (validação e salvamento feitos pelo backend)
      const headers = await getAuthHeaders();
      
      const response = await axios.post(`${apiBase}/api/chat/${chatId}/send`, {
        message: content,
        messageType: type,
        agentName: userName,
        replyTo: replyTo || null
      }, {
        timeout: 30000,
        headers
      });

      if (response.data.success && response.data.message) {
        // Atualizar mensagens localmente com a resposta do backend
        const messageData = response.data.message;
        const convertedMessage = {
          ...messageData,
          sender: 'agent',
          timestamp: new Date(messageData.created_at || new Date()),
          message_type: messageData.message_type || 'text'
        };
        
        setMessages(prev => [...prev, convertedMessage]);
        
        console.log('✅ Mensagem enviada via WhatsApp com sucesso');
      } else {
        throw new Error(response.data.error || 'Erro ao enviar mensagem');
      }

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.error || error.message || "Falha ao enviar mensagem",
        variant: "destructive",
      });
    }
  }, [toast, profile, user]);

  // Reenviar mensagem que falhou
  const resendMessage = useCallback(async (messageId: string) => {
    try {
      console.log('🔄 Reenviando mensagem:', messageId);
      
      // ✅ MIGRADO: Usar user e profile do hook useAuth
      if (!user || !profile) {
        console.error('❌ Usuário não autenticado');
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const userName = profile.name || 'Você';
      
      // ✅ MIGRADO: Reenviar via API do backend
      const headers = await getAuthHeaders();
      
      // 1. Buscar a mensagem para obter o chatId e conteúdo
      const message = messages.find(msg => msg.id === messageId);
      if (!message) {
        toast({
          title: "Erro",
          description: "Mensagem não encontrada",
          variant: "destructive",
        });
        return;
      }

      // 2. Atualizar status local para 'sending'
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status: 'sending' } : msg
      ));

      // 3. Reenviar via API do backend
      try {
        const sendResponse = await axios.post(`${apiBase}/api/chat/${message.chat_id}/send`, {
          message: message.content,
          agentName: userName,
          replyTo: null
        }, {
          timeout: 30000,
          headers
        });

        if (sendResponse.data.success) {
          // ✅ MIGRADO: Atualizar status via API do backend
          await axios.patch(`${apiBase}/api/chat-operations/messages/${messageId}`, {
            status: 'sent'
          }, { headers });

          // Atualizar mensagem local
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, status: 'sent' } : msg
          ));

          toast({
            title: "Sucesso",
            description: "Mensagem reenviada com sucesso!",
          });
        }
      } catch (whatsappError: any) {
        console.error('❌ Erro ao reenviar mensagem via WhatsApp:', whatsappError);
        
        // ✅ MIGRADO: Atualizar status via API do backend
        try {
          await axios.patch(`${apiBase}/api/chat-operations/messages/${messageId}`, {
            status: 'failed'
          }, { headers });
        } catch (updateError) {
          console.error('Erro ao atualizar status da mensagem:', updateError);
        }

        // Atualizar mensagem local
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { 
            ...msg, 
            status: 'failed',
            metadata: {
              ...msg.metadata,
              error: whatsappError.response?.data?.error || whatsappError.message || 'Erro desconhecido'
            }
          } : msg
        ));

        toast({
          title: "Falha no Reenvio",
          description: "Não foi possível reenviar a mensagem. Verifique a conexão com o WhatsApp.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao reenviar mensagem:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.error || error.message || "Falha ao reenviar mensagem",
        variant: "destructive",
      });
    }
  }, [toast, profile, user, messages]);

  // Marcar mensagens como lidas
  const markMessagesAsRead = useCallback(async (chatId: string) => {
    try {
      console.log('📖 Marcando mensagens como lidas:', chatId);
      
      // ✅ MIGRADO: Marcar mensagens como lidas via API do backend
      const headers = await getAuthHeaders();
      const response = await axios.post(`${apiBase}/api/chat-operations/chats/${chatId}/mark-read`, {}, { headers });
      
      if (response.data.success) {
        console.log('✅ Mensagens marcadas como lidas');
        // Atualizar mensagens locais
        setMessages(prev => prev.map(msg => 
          msg.chat_id === chatId && !msg.is_from_me ? { ...msg, status: 'read' } : msg
        ));
      }
    } catch (error: any) {
      console.error('Erro ao marcar mensagens como lidas:', error);
      // Não mostrar toast para erros silenciosos
    }
  }, []);

  return {
    messages,
    setMessages,
    fetchMessages,
    sendMessage,
    resendMessage,
    markMessagesAsRead
  };
};
