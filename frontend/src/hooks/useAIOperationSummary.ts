import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface OperationSummary {
  id: string;
  timestamp: string;
  period: string;
  summary: string;
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative' | 'positivo' | 'negativo' | 'neutro';
    score?: number;
    description?: string;
    positive_percentage?: number;
    neutral_percentage?: number;
    negative_percentage?: number;
  };
  metrics: {
    total_messages: number;
    active_chats: number;
    sent_messages?: number;
    received_messages?: number;
    active_users?: number;
    avg_response_time?: number;
  };
  insights: string[];
  recommendations: string[];
  status: 'generating' | 'completed' | 'error';
}

interface UseAIOperationSummaryReturn {
  summary: OperationSummary | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  generateSummary: (period: 'today' | '7d' | 'current_month', force?: boolean) => Promise<void>;
  refreshSummary: (period?: 'today' | '7d' | 'current_month') => Promise<void>;
}

const STORAGE_KEY = 'ai_operation_summary';

export const useAIOperationSummary = (): UseAIOperationSummaryReturn => {
  const { user, profile } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  
  // Carregar resumo do localStorage na inicialização
  const loadStoredSummary = (): OperationSummary | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
    } catch (error) {
      console.warn('Erro ao carregar resumo do localStorage:', error);
    }
    return null;
  };

  const storedSummary = loadStoredSummary();
  const [summary, setSummary] = useState<OperationSummary | null>(storedSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(
    storedSummary?.timestamp ? new Date(storedSummary.timestamp) : null
  );
  const summaryRef = useRef<OperationSummary | null>(null);

  // Atualizar ref sempre que summary mudar
  useEffect(() => {
    summaryRef.current = summary;
    // Salvar no localStorage quando summary mudar
    if (summary) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
        if (summary.timestamp) {
          setLastUpdate(new Date(summary.timestamp));
        }
        // Limpar erro se resumo foi carregado com sucesso
        setError(null);
      } catch (error) {
        console.warn('Erro ao salvar resumo no localStorage:', error);
      }
    }
  }, [summary]);

  // Limpar erro quando organização for carregada e tiver resumo armazenado
  useEffect(() => {
    if (!orgLoading && summaryRef.current && (profile?.organization_id || organization?.id)) {
      setError(null);
    }
  }, [orgLoading, profile?.organization_id, organization?.id]);

  // Verificar se precisa gerar novo resumo (última atualização há mais de 1 hora)
  const shouldGenerateNewSummary = useCallback((currentSummary: OperationSummary | null, period: string): boolean => {
    if (!currentSummary) return true; // Sem resumo, precisa gerar
    
    // Se o período mudou, precisa gerar novo resumo
    if (currentSummary.period !== period) return true;
    
    // Se não tem timestamp, precisa gerar
    if (!currentSummary.timestamp) return true;
    
    // Verificar se passou mais de 1 hora desde a última atualização
    const lastUpdateTime = new Date(currentSummary.timestamp).getTime();
    const now = Date.now();
    const oneHourInMs = 60 * 60 * 1000; // 1 hora em milissegundos
    
    return (now - lastUpdateTime) >= oneHourInMs;
  }, []);

  const generateSummary = useCallback(async (period: 'today' | '7d' | 'current_month', force: boolean = false) => {
    // Se não for forçado, verificar se já existe um resumo recente para o mesmo período
    if (!force) {
      const currentSummary = summaryRef.current;
      if (!shouldGenerateNewSummary(currentSummary, period)) {
        // Não precisa gerar, já existe um resumo recente
        return;
      }
    }
    
    // Aguardar carregamento da organização
    if (orgLoading) {
      return;
    }
    
    // Tentar obter organization_id - priorizar profile?.organization_id que é mais confiável
    const organizationId = profile?.organization_id || organization?.id;
    
    if (!user?.id) {
      setError('Usuário não autenticado. Faça login novamente.');
      return;
    }
    
    if (!organizationId) {
      // Se não tem organização mas tem resumo armazenado, não mostrar erro nem tentar gerar
      if (summaryRef.current) {
        // Limpar erro se existir resumo armazenado
        setError(null);
        return;
      }
      // Só definir erro se não há resumo armazenado
      setError('Usuário não possui organização associada. Verifique se você foi adicionado a uma organização.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Log removido para reduzir poluição no console

      // Usar o mesmo padrão de headers dos outros componentes
      const headers = {
        'Authorization': 'Bearer dohoo_dev_token_2024',
        'Content-Type': 'application/json',
        'x-user-id': user.id,
        'x-user-role': profile?.roles?.name || 'agent',
        // Removido x-organization-id para evitar CORS; org vai no body
        'x-request-id': `${user.id}-${organizationId}-${Date.now()}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      const response = await fetch(`${apiBase}/api/ai/generate-operation-summary`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          period,
          organization_id: organizationId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar resumo da operação');
      }

      // Log removido para reduzir poluição no console
      
      setSummary(result.summary);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('❌ [HOOK] Erro ao gerar resumo da operação:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao gerar resumo');
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, organization?.id, user?.id, shouldGenerateNewSummary, orgLoading]);

  const refreshSummary = useCallback(async (period?: 'today' | '7d' | 'current_month') => {
    // Se não tem período, usar o período do resumo atual ou 'today' como padrão
    const periodToUse = period || summary?.period || 'today';
    // Forçar geração ao clicar no botão
    await generateSummary(periodToUse as 'today' | '7d' | 'current_month', true);
  }, [summary?.period, generateSummary]);

  // Removido auto-refresh automático - agora é apenas manual via botão
  // Isso evita consumo desnecessário de tokens de IA

  return {
    summary,
    loading,
    error,
    lastUpdate,
    generateSummary,
    refreshSummary
  };
};
