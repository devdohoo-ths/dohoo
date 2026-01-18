import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export function useStatus() {
  const [status, setStatus] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/api/status`, {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status || []);
      } else {
        console.warn('Erro ao buscar status, usando dados padrão');
        // Dados padrão se a API não estiver disponível
        setStatus([
          { id: '1', name: 'Atendida' },
          { id: '2', name: 'Não atendida' },
          { id: '3', name: 'Encerrada' },
          { id: '4', name: 'Em andamento' },
          { id: '5', name: 'Chatbot' }
        ]);
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      // Dados padrão em caso de erro
      setStatus([
        { id: '1', name: 'Atendida' },
        { id: '2', name: 'Não atendida' },
        { id: '3', name: 'Encerrada' },
        { id: '4', name: 'Em andamento' },
        { id: '5', name: 'Chatbot' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchStatus(); 
  }, []);

  return { status, loading, fetchStatus };
} 