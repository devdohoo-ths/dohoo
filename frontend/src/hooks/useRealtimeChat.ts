import { useEffect, useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { socketManager } from '@/services/socketManager';
import type { Tables } from '@/integrations/supabase/types';

type MessageData = Tables<'messages'>;
type ChatData = Tables<'chats'>;

interface UseRealtimeChatProps {
  onNewMessage?: (message: MessageData) => void;
  onChatUpdate?: (chat: ChatData) => void;
  onMessageUpdate?: (message: MessageData) => void;
}

/**
 * ✅ MIGRADO: Hook de realtime usando Socket.IO ao invés de Supabase Realtime
 * 
 * Este hook substitui as subscriptions do Supabase Realtime por eventos Socket.IO.
 * O backend emite eventos 'new-message' quando há novas mensagens.
 */
export const useRealtimeChat = ({
  onNewMessage,
  onChatUpdate,
  onMessageUpdate
}: UseRealtimeChatProps) => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  
  // Usar useRef para callbacks estáveis
  const callbacksRef = useRef({
    onNewMessage,
    onChatUpdate,
    onMessageUpdate
  });

  // Atualizar callbacks ref apenas quando realmente mudarem
  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onChatUpdate,
      onMessageUpdate
    };
  }, [onNewMessage, onChatUpdate, onMessageUpdate]);

  // Handler para novas mensagens via Socket.IO
  const handleNewMessage = useCallback((data: any) => {
    if (!data || !data.message) {
      console.warn('❌ [Realtime] Dados inválidos recebidos:', data);
      return;
    }

    const newMessage = data.message as MessageData;
    
    if (!newMessage || !newMessage.chat_id) {
      console.warn('❌ [Realtime] Mensagem inválida recebida');
      return;
    }

    // ✅ SEGURANÇA: Verificar se o usuário tem acesso a esta mensagem
    // O backend já filtra por assigned_agent_id, mas validar aqui também
    if (user?.id && data.userId && data.userId !== user.id) {
      console.warn('🚨 [Realtime] Tentativa de receber mensagem de outro usuário bloqueada');
      return;
    }

    // Chamar callback de nova mensagem
    callbacksRef.current.onNewMessage?.(newMessage);
    
    // Notificação apenas para mensagens de OUTROS usuários (não próprias)
    if (!newMessage.is_from_me && newMessage.sender_name) {
      toast({
        title: "Nova mensagem",
        description: `${newMessage.sender_name}: ${newMessage.message_type === 'text' 
          ? (newMessage.content?.substring(0, 50) + '...') 
          : '📎 Arquivo'}`,
        duration: 3000,
      });
    }

    // Trigger de atualização de chat quando nova mensagem chega
    // (o evento new-message indica que o chat foi atualizado)
    callbacksRef.current.onChatUpdate?.();
  }, [user, toast]);

  // Handler para atualizações de mensagem
  const handleMessageUpdate = useCallback((data: any) => {
    if (!data || !data.message) {
      return;
    }

    const updatedMessage = data.message as MessageData;
    callbacksRef.current.onMessageUpdate?.(updatedMessage);
  }, []);

  // Configurar listeners do Socket.IO
  useEffect(() => {
    if (!user?.id || !profile?.organization_id) {
      return;
    }

    // Conectar ao socket se ainda não estiver conectado
    const connectSocket = async () => {
      const socket = socketManager.getSocket();
      if (!socket || !socket.connected) {
        await socketManager.connect(user.id, profile.organization_id);
      }
    };

    connectSocket();

    // Adicionar listeners
    socketManager.on('new-message', handleNewMessage);
    socketManager.on('message-updated', handleMessageUpdate);
    socketManager.onConnect(() => setIsConnected(true));

    // Cleanup
    return () => {
      socketManager.off('new-message', handleNewMessage);
      socketManager.off('message-updated', handleMessageUpdate);
    };
  }, [user?.id, profile?.organization_id, handleNewMessage, handleMessageUpdate]);

  // Retornar status de conexão
  return {
    isConnected: socketManager.isConnected() || isConnected,
    disconnect: () => {
      // Não desconectar o socket global, apenas limpar listeners locais
      socketManager.off('new-message', handleNewMessage);
      socketManager.off('message-updated', handleMessageUpdate);
      setIsConnected(false);
    }
  };
};
