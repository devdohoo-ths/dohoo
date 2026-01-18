import { useEffect, useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { socketManager } from '@/services/socketManager';
import type { Tables } from '@/integrations/supabase/types';

type MessageData = Tables<'messages'>;

interface UseStableRealtimeProps {
  onNewMessage?: (message: MessageData) => void;
  onChatUpdate?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * ✅ MIGRADO: Hook de realtime estável usando Socket.IO ao invés de Supabase Realtime
 * 
 * Este hook substitui as subscriptions do Supabase Realtime por eventos Socket.IO.
 * O socketManager já gerencia reconexão automática, então este hook é mais simples.
 */
export const useStableRealtime = ({
  onNewMessage,
  onChatUpdate,
  onConnectionChange
}: UseStableRealtimeProps) => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  
  const callbacksRef = useRef({ onNewMessage, onChatUpdate, onConnectionChange });
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    callbacksRef.current = { onNewMessage, onChatUpdate, onConnectionChange };
  }, [onNewMessage, onChatUpdate, onConnectionChange]);

  const disconnect = useCallback(() => {
    console.log('🔌 [REALTIME] Desconectando listeners locais...');
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    
    // Não desconectar o socket global, apenas limpar listeners locais
    socketManager.off('new-message');
    socketManager.off('connect');
    socketManager.off('disconnect');
    
    setIsConnected(false);
    callbacksRef.current.onConnectionChange?.(false);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    console.log('⏰ [REALTIME] Agendando reconexão em 5 segundos...');
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, 5000);
  }, [user, profile]);

  // Handler para novas mensagens via Socket.IO
  const handleNewMessage = useCallback((data: any) => {
    if (!data || !data.message) {
      return;
    }

    const newMessage = data.message as MessageData;
    
    if (!newMessage || !newMessage.chat_id) {
      console.warn('❌ [REALTIME] Mensagem inválida recebida');
      return;
    }

    console.log('📨 [REALTIME] Nova mensagem:', newMessage);
    callbacksRef.current.onNewMessage?.(newMessage);

    if (!newMessage.is_from_me && newMessage.sender_name) {
      toast({
        title: "Nova mensagem",
        description: `${newMessage.sender_name}: ${newMessage.content?.slice(0, 50)}...`,
      });
    }

    // Trigger de atualização de chat quando nova mensagem chega
    callbacksRef.current.onChatUpdate?.();
  }, [toast]);

  const connect = useCallback(async () => {
    if (!user?.id || !profile?.organization_id) {
      console.log('🔐 [REALTIME] Sem autenticação válida, abortando conexão');
      return;
    }

    try {
      console.log('🔄 [REALTIME] Configurando listeners Socket.IO...');
      
      // Conectar ao socket se ainda não estiver conectado
      const socket = socketManager.getSocket();
      if (!socket || !socket.connected) {
        await socketManager.connect(user.id, profile.organization_id);
      }

      // Adicionar listeners
      socketManager.on('new-message', handleNewMessage);
      socketManager.onConnect(() => {
        console.log('🔗 [REALTIME] Conectado via Socket.IO');
        setIsConnected(true);
        callbacksRef.current.onConnectionChange?.(true);
      });
      socketManager.onDisconnect(() => {
        console.log('🔌 [REALTIME] Desconectado do Socket.IO');
        setIsConnected(false);
        callbacksRef.current.onConnectionChange?.(false);
        scheduleReconnect();
      });

      // Se já estiver conectado, atualizar estado imediatamente
      if (socketManager.isConnected()) {
        setIsConnected(true);
        callbacksRef.current.onConnectionChange?.(true);
      }

    } catch (error) {
      console.error('❌ [REALTIME] Erro ao conectar:', error);
      scheduleReconnect();
    }
  }, [user?.id, profile?.organization_id, handleNewMessage, scheduleReconnect]);

  useEffect(() => {
    if (user?.id && profile?.organization_id) {
      connect();
    } else {
      disconnect();
    }

    return disconnect;
  }, [user?.id, profile?.organization_id]); // Reconectar se user/org mudarem

  return {
    isConnected,
    connect,
    disconnect,
    reconnect: connect
  };
};
