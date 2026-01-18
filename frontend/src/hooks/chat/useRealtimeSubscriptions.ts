import { useEffect } from 'react';
import type { Tables } from '@/integrations/supabase/types';

type MessageData = Tables<'messages'>;

interface UseRealtimeSubscriptionsProps {
  activeChat: string | null;
  fetchChats: () => void;
  setMessages: React.Dispatch<React.SetStateAction<MessageData[]>>;
}

export const useRealtimeSubscriptions = ({ 
  activeChat, 
  fetchChats, 
  setMessages 
}: UseRealtimeSubscriptionsProps) => {
  // ❌ DESABILITADO: Para evitar múltiplas subscrições que causam erro "subscribe multiple times"
  console.log('⚠️ useRealtimeSubscriptions desabilitado para evitar conflitos');
  
  useEffect(() => {
    // Não fazer nada - hook desabilitado
    return () => {
      // Cleanup vazio
    };
  }, [fetchChats, activeChat, setMessages]);
};
