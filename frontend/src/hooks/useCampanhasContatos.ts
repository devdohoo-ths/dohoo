import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getCurrentApiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase

const API_BASE = getCurrentApiBase();

export interface NumeroConectado {
  id: string;
  phone_number: string;
  session_name: string;
  status: string;
  last_seen: string;
  created_at: string;
}

export interface ContatoComHistorico {
  contato_phone: string;
  contato_name: string;
  numero_whatsapp: string;
  ultima_conversa: string;
  total_mensagens: number;
}

export interface ContatoValidado {
  contato_phone: string;
  numero_whatsapp: string;
  tem_historico: boolean;
}

export interface DistribuicaoSugerida {
  numero_whatsapp: string;
  contatos_sugeridos: Array<{
    contact_phone: string;
    contact_name: string;
    ultima_conversa: string;
  }>;
  total_mensagens: number;
  ultima_atividade: string;
}

export interface SugestaoDistribuicao {
  distribuicao: DistribuicaoSugerida[];
  total_contatos_distribuidos: number;
  numeros_ativos: number;
}

export function useCampanhasContatos() {
  const { user, profile } = useAuth();
  const [numerosConectados, setNumerosConectados] = useState<NumeroConectado[]>([]);
  const [contatosComHistorico, setContatosComHistorico] = useState<ContatoComHistorico[]>([]);
  const [contatosValidados, setContatosValidados] = useState<ContatoValidado[]>([]);
  const [sugestaoDistribuicao, setSugestaoDistribuicao] = useState<SugestaoDistribuicao | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar números conectados
  const buscarNumerosConectados = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/campanhas/contatos/numeros-conectados`, {
        headers
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar números conectados');
      }

      console.log('🔍 Debug números conectados:', data.debug);
      
      let numerosFiltrados = data.data || [];
      
      // 🎯 FILTRO DE BACKUP NO FRONTEND: Se for agente E backend não filtrou, filtrar aqui
      const isAgentFrontend = profile?.roles?.name?.toLowerCase().includes('agente') || 
                             profile?.role_name?.toLowerCase().includes('agente');
      
      if (isAgentFrontend) {
        console.log('🔒 [Frontend] Agente detectado');
        console.log('🔒 [Frontend] Números recebidos do backend:', numerosFiltrados.length);
        console.log('🔒 [Frontend] Debug do backend:', data.debug);
        
        // 🎯 FILTRO DE SEGURANÇA: Se backend não filtrou (isAgent false ou connected_accounts > 1), filtrar no frontend
        // Usar o endpoint /api/whatsapp-accounts que já filtra corretamente por agente
        if (!data.debug?.isAgent || (data.debug?.connected_accounts && data.debug.connected_accounts > 1)) {
          console.warn('⚠️ [Frontend] Backend não aplicou filtro de agente, usando filtro de backup via /api/whatsapp-accounts');
          
          try {
            const headersBackup = await getAuthHeaders();
            const responseBackup = await fetch(`${API_BASE}/api/whatsapp-accounts`, {
              headers: headersBackup
            });
            
            if (responseBackup.ok) {
              const dataBackup = await responseBackup.json();
              if (dataBackup.success && dataBackup.accounts) {
                // Filtrar apenas contas conectadas do agente
                const accountsFiltrados = dataBackup.accounts
                  .filter((account: any) => account.status === 'connected' && account.user_id === user?.id)
                  .map((account: any) => ({
                    id: account.id,
                    phone_number: account.phone_number,
                    session_name: account.name,
                    status: account.status,
                    last_seen: account.last_connected_at,
                    created_at: account.created_at
                  }));
                
                console.log('✅ [Frontend] Filtro de backup aplicado, números do agente:', accountsFiltrados.length);
                numerosFiltrados = accountsFiltrados;
              }
            }
          } catch (errorBackup) {
            console.error('❌ [Frontend] Erro no filtro de backup:', errorBackup);
            // Se o backup falhar, usar array vazio para agentes
            numerosFiltrados = [];
          }
        }
      }
      
      setNumerosConectados(numerosFiltrados);
    } catch (err) {
      console.error('Erro ao buscar números conectados:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar contatos com histórico
  const buscarContatosComHistorico = async (numeros: string[], limit = 100, offset = 0, search = '') => {
    if (!numeros.length) return;

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const numerosQuery = numeros.join(',');
      console.log('🔍 [FRONTEND] Buscando contatos:', {
        numeros: numerosQuery,
        search: search,
        limit,
        offset
      });
      
      const response = await fetch(
        `${API_BASE}/api/campanhas/contatos/contatos-com-historico?numeros=${numerosQuery}&limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`,
        {
          headers
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar contatos com histórico');
      }

      setContatosComHistorico(data.data);
      return data;
    } catch (err) {
      console.error('Erro ao buscar contatos com histórico:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Validar contatos
  const validarContatos = async (numeros: string[], contatos: string[]) => {
    if (!numeros.length || !contatos.length) return;

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/campanhas/contatos/validar-contatos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ numeros, contatos })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao validar contatos');
      }

      setContatosValidados(data.data.contatos_validados);
      return data.data;
    } catch (err) {
      console.error('Erro ao validar contatos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Sugerir distribuição automática
  const sugerirDistribuicao = async (numeros: string[], contatos: string[]) => {
    if (!numeros.length || !contatos.length) return;

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const numerosQuery = numeros.join(',');
      const contatosQuery = contatos.join(',');
      
      const response = await fetch(
        `${API_BASE}/api/campanhas/contatos/sugerir-distribuicao?numeros=${numerosQuery}&contatos=${contatosQuery}`,
        {
          headers
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao sugerir distribuição');
      }

      setSugestaoDistribuicao(data.data);
      return data.data;
    } catch (err) {
      console.error('Erro ao sugerir distribuição:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Limpar dados
  const limparDados = () => {
    setContatosComHistorico([]);
    setContatosValidados([]);
    setSugestaoDistribuicao(null);
    setError(null);
  };

  // Carregar números conectados automaticamente
  useEffect(() => {
    if (user?.token) {
      buscarNumerosConectados();
    }
  }, [user?.token]);

  return {
    // Estados
    numerosConectados,
    contatosComHistorico,
    contatosValidados,
    sugestaoDistribuicao,
    isLoading,
    error,

    // Ações
    buscarNumerosConectados,
    buscarContatosComHistorico,
    validarContatos,
    sugerirDistribuicao,
    limparDados
  };
}
