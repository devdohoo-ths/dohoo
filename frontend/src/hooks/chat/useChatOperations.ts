import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import type { Tables } from '@/integrations/supabase/types';

type ChatData = Tables<'chats'>;

interface UseChatOperationsOptions {
  accountId?: string | null; // ✅ NOVO: Filtro opcional por account_id do WhatsApp
}

export const useChatOperations = (options?: UseChatOperationsOptions) => {
  const [chats, setChats] = useState<ChatData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { accountId } = options || {};
  
  // ✅ Cache simples em memória para reduzir chamadas repetidas
  // TTL de 60s para a lista de chats
  // ✅ NOVO: Cache agora considera account_id para invalidar quando mudar de número
  // Escopo do módulo: variável estática compartilhada entre hooks
  // (mantém-se entre renders dentro do mesmo bundle)
  // @ts-ignore - allow module scoped cache
  const chatCache: { data?: ChatData[]; ts?: number; accountId?: string | null } = (useChatOperations as any)._cache || {};
  // @ts-ignore
  (useChatOperations as any)._cache = chatCache;

  // ✅ OTIMIZADO: Buscar chats com stats usando queries agregadas ao invés de N queries
  const fetchChatsWithStats = useCallback(async () => {
    try {
      // ✅ CACHE: usar resultado recente (TTL 120s) mas invalidar se account_id mudou
      const now = Date.now();
      const cacheValid = chatCache.data && 
                        chatCache.ts && 
                        now - chatCache.ts < 120000 && // ✅ AUMENTADO: De 60s para 120s para reduzir requisições
                        chatCache.accountId === accountId; // ✅ NOVO: Invalidar se account_id mudou
      
      if (cacheValid) {
        setChats(chatCache.data);
        setLoading(false);
        return;
      }

      // ✅ Usar endpoint do backend (com filtros e processamento + possibilidade de cache server-side)
      const headers = await getAuthHeaders();
      // ✅ NOVO: Adicionar account_id como query parameter se fornecido
      const url = accountId 
        ? `${apiBase}/api/chat-operations/chats?account_id=${encodeURIComponent(accountId)}`
        : `${apiBase}/api/chat-operations/chats`;
      const resp = await fetch(url, { headers });
      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        throw new Error(json?.error || 'Erro ao buscar chats');
      }

      const processed = (json.chats || []) as ChatData[];
      setChats(processed);
      // ✅ NOVO: Salvar no cache incluindo account_id para invalidar quando mudar
      chatCache.data = processed;
      chatCache.ts = now;
      chatCache.accountId = accountId || null;
    } catch (error) {
      console.error('Erro ao buscar chats:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar conversas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, accountId]); // ✅ NOVO: Adicionar accountId às dependências para recarregar quando mudar

  // Criar novo chat
  const createChat = useCallback(async (name: string, platform: string = 'whatsapp', customerNumber?: string) => {
    try {
      // ✅ MIGRADO: Usar user e profile do hook useAuth
      if (!user || !profile?.organization_id) {
        console.error('❌ Usuário ou organização não disponível');
        toast({
          title: "Erro",
          description: "Usuário não autenticado ou sem organização",
          variant: "destructive",
        });
        return;
      }

      // ✅ MIGRADO: Criar chat via API do backend
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/chat-operations/chats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          platform,
          whatsapp_jid: customerNumber ? `${customerNumber}@s.whatsapp.net` : undefined
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao criar chat');
      }

      toast({
        title: "Sucesso",
        description: "Chat criado com sucesso",
      });

      fetchChatsWithStats();
      return result.chat;
    } catch (error) {
      console.error('Erro ao criar chat:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar chat",
        variant: "destructive",
      });
    }
  }, [toast, fetchChatsWithStats, user, profile]);

  // ✨ NOVA FUNÇÃO: Atualizar unread_count de um chat específico
  const updateChatUnreadCount = useCallback((chatId: string, newUnreadCount: number) => {
    
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, unread_count: newUnreadCount }
          : chat
      )
    );
  }, []);

  // ✨ NOVA FUNÇÃO: Deletar conversa completa (chat e todas as mensagens)
  const deleteChat = useCallback(async (chatId: string) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        toast({
          title: "Erro",
          description: "Token de autenticação não encontrado",
          variant: "destructive",
        });
        return false;
      }

      const response = await fetch(`${apiBase}/api/chat-operations/chats/${chatId}`, {
        method: 'DELETE',
        headers
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao deletar conversa');
      }

      // Remover o chat da lista local
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
      
      // Invalidar cache
      chatCache.data = undefined;
      chatCache.ts = undefined;

      toast({
        title: "Sucesso",
        description: "Conversa deletada com sucesso",
      });

      return true;
    } catch (error) {
      console.error('Erro ao deletar chat:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao deletar conversa",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  return {
    chats,
    loading,
    setLoading,
    setChats,
    fetchChats: fetchChatsWithStats,
    createChat,
    updateChatUnreadCount,
    deleteChat
  };
};
