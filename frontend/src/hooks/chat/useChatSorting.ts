import { useMemo } from 'react';
import { ChatData } from '@/types/chat';

export const useChatSorting = (chats: ChatData[]) => {
  const sortedChats = useMemo(() => {
    if (!chats || chats.length === 0) return [];

    // ✅ ORDENAÇÃO INTELIGENTE: Similar ao WhatsApp
    return [...chats].sort((a, b) => {
      // 1. PRIORIDADE: Conversas com mensagens não lidas
      const aUnread = a.unread_count || 0;
      const bUnread = b.unread_count || 0;
      
      if (aUnread > 0 && bUnread === 0) return -1;
      if (aUnread === 0 && bUnread > 0) return 1;
      if (aUnread > 0 && bUnread > 0) {
        // Se ambos têm não lidas, ordenar por quantidade (mais não lidas primeiro)
        if (aUnread !== bUnread) {
          return bUnread - aUnread;
        }
      }

      // 2. PRIORIDADE: Conversas ativas vs finalizadas
      const aActive = a.status === 'active';
      const bActive = b.status === 'active';
      
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // 3. PRIORIDADE: Por data da última mensagem (mais recente primeiro)
      const aLastMessage = a.last_message_at ? new Date(a.last_message_at) : new Date(a.created_at || Date.now());
      const bLastMessage = b.last_message_at ? new Date(b.last_message_at) : new Date(b.created_at || Date.now());
      
      return bLastMessage.getTime() - aLastMessage.getTime();
    });
  }, [chats]);

  // ✅ ESTATÍSTICAS: Para exibir no header
  const stats = useMemo(() => {
    const total = chats.length;
    const unread = chats.filter(chat => (chat.unread_count || 0) > 0).length;
    const active = chats.filter(chat => chat.status === 'active').length;
    const today = chats.filter(chat => {
      const lastMessage = chat.last_message_at ? new Date(chat.last_message_at) : new Date(chat.created_at || Date.now());
      const today = new Date();
      return lastMessage.toDateString() === today.toDateString();
    }).length;

    return { total, unread, active, today };
  }, [chats]);

  return { sortedChats, stats };
};
