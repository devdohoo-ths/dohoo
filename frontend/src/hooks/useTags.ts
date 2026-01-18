import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export function useTags() {
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/api/tags`, {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      } else {
        console.warn('Erro ao buscar tags, usando dados padrão');
        // Dados padrão se a API não estiver disponível
        setTags([
          { id: '1', name: 'urgente' },
          { id: '2', name: 'vip' },
          { id: '3', name: 'reclamacao' },
          { id: '4', name: 'duvida' },
          { id: '5', name: 'sugestao' }
        ]);
      }
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
      // Dados padrão em caso de erro
      setTags([
        { id: '1', name: 'urgente' },
        { id: '2', name: 'vip' },
        { id: '3', name: 'reclamacao' },
        { id: '4', name: 'duvida' },
        { id: '5', name: 'sugestao' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchTags(); 
  }, []);

  return { tags, loading, fetchTags };
} 