// src/hooks/useKeywords.ts
import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders

interface Keyword {
  id: string;
  name: string;
  created_at?: string;
}

export function useKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/api/keywords`, {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
        console.log('✅ Keywords carregadas:', data.keywords?.length || 0);
      } else {
        console.warn('⚠️ Erro ao buscar keywords, usando dados padrão');
        // Dados padrão se a API não estiver disponível
        setKeywords([
          { id: '1', name: 'suporte' },
          { id: '2', name: 'vendas' },
          { id: '3', name: 'problema' },
          { id: '4', name: 'duvida' },
          { id: '5', name: 'reclamacao' }
        ]);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar keywords:', error);
      // Dados padrão em caso de erro
      setKeywords([
        { id: '1', name: 'suporte' },
        { id: '2', name: 'vendas' },
        { id: '3', name: 'problema' },
        { id: '4', name: 'duvida' },
        { id: '5', name: 'reclamacao' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = async (keyword: { name: string }) => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/api/keywords`, {
        method: 'POST',
        headers,
        body: JSON.stringify(keyword),
      });
      
      if (res.ok) {
        await fetchKeywords(); // Recarregar lista
        return true;
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao adicionar keyword');
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar keyword:', error);
      throw error;
    }
  };

  const deleteKeyword = async (id: string) => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/api/keywords/${id}`, {
        method: 'DELETE',
        headers
      });
      
      if (res.ok) {
        await fetchKeywords(); // Recarregar lista
        return true;
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao deletar keyword');
      }
    } catch (error) {
      console.error('❌ Erro ao deletar keyword:', error);
      throw error;
    }
  };

  const searchKeywords = async (query: string): Promise<Keyword[]> => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/api/keywords/search?q=${encodeURIComponent(query)}`, {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        return data.keywords || [];
      } else {
        console.warn('⚠️ Erro na busca, retornando lista vazia');
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao buscar keywords:', error);
      return [];
    }
  };

  useEffect(() => { 
    fetchKeywords(); 
  }, []);

  return { 
    keywords, 
    loading, 
    fetchKeywords, 
    addKeyword, 
    deleteKeyword,
    searchKeywords
  };
}