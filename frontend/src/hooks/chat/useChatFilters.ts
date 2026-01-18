
import { useState, useMemo } from 'react';
import type { Tables } from '@/integrations/supabase/types';

type ChatData = Tables<'chats'>;
type FilterType = 'all' | 'active' | 'finished' | 'internal' | 'archived';

export const useChatFilters = (chats: ChatData[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredChats = useMemo(() => {
    // ✅ PRIMEIRO: Filtrar chats baseado no termo de busca e filtro
    const filtered = chats.filter(chat => {
      // Filter by search term
      const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by status
      const matchesFilter = filter === 'all' || chat.status === filter;
      
      return matchesSearch && matchesFilter;
    });

    // ✅ SEGUNDO: Ordenar por última mensagem (data + horário)
    return [...filtered].sort((a, b) => {
      // 1. PRIORIDADE: Chats com mensagens não lidas primeiro
      const aUnread = (a as any).unread_count || 0;
      const bUnread = (b as any).unread_count || 0;
      
      if (aUnread > 0 && bUnread === 0) return -1;
      if (aUnread === 0 && bUnread > 0) return 1;

      // 2. PRIORIDADE: Ordenar por timestamp da última mensagem
      const aLastMessage = (a as any).last_message?.created_at || a.updated_at || a.created_at;
      const bLastMessage = (b as any).last_message?.created_at || b.updated_at || b.created_at;
      
      const aTime = new Date(aLastMessage).getTime();
      const bTime = new Date(bLastMessage).getTime();
      
      // ✅ CORREÇÃO: Mais recente primeiro (descendente)
      return bTime - aTime;
    });
  }, [chats, searchTerm, filter]);

  return {
    searchTerm,
    filter,
    setSearchTerm,
    setFilter,
    filteredChats
  };
};
