import { useState, useEffect, useCallback } from 'react';
import { useSupabaseChat } from './useSupabaseChat';

export const useUnreadCount = () => {
  const { chats } = useSupabaseChat();
  const [totalUnread, setTotalUnread] = useState(0);

  // Calcular total de mensagens não lidas
  const calculateTotalUnread = useCallback(() => {
    const total = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
    setTotalUnread(total);
  }, [chats]);

  // Atualizar contador quando chats mudarem
  useEffect(() => {
    calculateTotalUnread();
  }, [calculateTotalUnread]);

  // Função para atualizar contador de um chat específico
  const updateChatUnreadCount = useCallback((chatId: string, newCount: number) => {
    
    // O contador será recalculado automaticamente quando os chats forem atualizados
    // Esta função pode ser usada para atualizações manuais se necessário
  }, []);

  return {
    totalUnread,
    updateChatUnreadCount,
    calculateTotalUnread
  };
}; 