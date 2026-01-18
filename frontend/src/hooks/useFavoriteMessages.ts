
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders

export interface FavoriteMessage {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export const useFavoriteMessages = () => {
  const [favoriteMessages, setFavoriteMessages] = useState<FavoriteMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Buscar mensagens favoritas
  const fetchFavoriteMessages = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📝 Buscando mensagens favoritas via API...');

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/favorite-messages`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar mensagens favoritas: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar mensagens favoritas');
      }

      console.log(`✅ ${result.messages?.length || 0} mensagens favoritas carregadas`);
      setFavoriteMessages(result.messages || []);
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens favoritas:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar mensagens favoritas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Criar nova mensagem favorita
  const createFavoriteMessage = async (title: string, content: string, category: string = 'geral') => {
    try {
      console.log('📝 Criando nova mensagem favorita via API...');

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/favorite-messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          content,
          category
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar mensagem favorita: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar mensagem favorita');
      }

      setFavoriteMessages(prev => [result.message, ...prev]);

      toast({
        title: "Sucesso",
        description: "Mensagem favorita criada",
      });

      return result.message;
    } catch (error) {
      console.error('❌ Erro ao criar mensagem favorita:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar mensagem favorita",
        variant: "destructive",
      });
    }
  };

  // Atualizar mensagem favorita
  const updateFavoriteMessage = async (id: string, updates: Partial<FavoriteMessage>) => {
    try {
      console.log('📝 Atualizando mensagem favorita via API...');

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/favorite-messages/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao atualizar mensagem favorita: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar mensagem favorita');
      }

      setFavoriteMessages(prev => prev.map(msg => 
        msg.id === id ? { ...msg, ...result.message } : msg
      ));

      toast({
        title: "Sucesso",
        description: "Mensagem favorita atualizada",
      });

      return result.message;
    } catch (error) {
      console.error('❌ Erro ao atualizar mensagem favorita:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar mensagem favorita",
        variant: "destructive",
      });
    }
  };

  // Deletar mensagem favorita
  const deleteFavoriteMessage = async (id: string) => {
    try {
      console.log('📝 Deletando mensagem favorita via API...');

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/favorite-messages/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao deletar mensagem favorita: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao deletar mensagem favorita');
      }

      setFavoriteMessages(prev => prev.filter(msg => msg.id !== id));

      toast({
        title: "Sucesso",
        description: "Mensagem favorita removida",
      });
    } catch (error) {
      console.error('❌ Erro ao deletar mensagem favorita:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover mensagem favorita",
        variant: "destructive",
      });
    }
  };

  // Buscar categorias disponíveis
  const fetchCategories = async () => {
    try {
      console.log('📝 Buscando categorias via API...');

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/favorite-messages/categories`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar categorias: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar categorias');
      }

      return result.categories || [];
    } catch (error) {
      console.error('❌ Erro ao buscar categorias:', error);
      return [];
    }
  };

  // Carregar mensagens ao montar o componente
  useEffect(() => {
    fetchFavoriteMessages();
  }, [fetchFavoriteMessages]);

  return {
    favoriteMessages,
    loading,
    createFavoriteMessage,
    updateFavoriteMessage,
    deleteFavoriteMessage,
    fetchFavoriteMessages,
    fetchCategories
  };
};
