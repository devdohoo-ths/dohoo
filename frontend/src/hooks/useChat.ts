
import { useSupabaseChat } from './useSupabaseChat';
import { useCallback } from 'react';

export const useChat = () => {
  const supabaseChat = useSupabaseChat();

  // Adaptar interface para compatibilidade com componentes existentes
  const toggleMessageSelection = useCallback((messageId: string) => {
    console.log('Toggling message selection:', messageId);
    // TODO: implementar seleção de mensagens
  }, []);

  const clearMessageSelection = useCallback(() => {
    console.log('Clearing message selection');
    // TODO: implementar limpeza de seleção
  }, []);

  const markAsImportant = useCallback((messageId: string) => {
    console.log('Marking message as important:', messageId);
    // TODO: implementar marcação como importante
  }, []);

  const startTyping = useCallback((chatId: string, userName: string) => {
    console.log('Start typing:', { chatId, userName });
    // TODO: implementar indicador de digitação
  }, []);

  return {
    ...supabaseChat,
    filteredChats: supabaseChat.chats,
    selectedMessages: [],
    isTyping: {},
    notifications: [],
    typingUsers: [],
    toggleMessageSelection,
    clearMessageSelection,
    markAsImportant,
    startTyping
  };
};
