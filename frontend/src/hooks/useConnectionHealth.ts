import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export interface ConnectionHealth {
  isReconnecting: boolean;
  lastAttempt: number;
  attemptCount: number;
  canRetry: boolean;
  nextRetryIn: number;
}

export interface AccountWithHealth {
  id: string;
  account_id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  phone_number?: string;
  health: ConnectionHealth;
  created_at: string;
  updated_at: string;
}

export interface HealthSummary {
  total: number;
  connected: number;
  disconnected: number;
  reconnecting: number;
  error: number;
}

export const useConnectionHealth = () => {
  const [accounts, setAccounts] = useState<AccountWithHealth[]>([]);
  const [summary, setSummary] = useState<HealthSummary>({
    total: 0,
    connected: 0,
    disconnected: 0,
    reconnecting: 0,
    error: 0
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  const { toast } = useToast();

  // Função para buscar dados de saúde
  const fetchHealthData = useCallback(async () => {
    try {
      setLoading(true);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/health`, {
        method: 'GET',
        headers
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar dados de saúde');
      }

      setAccounts(result.accounts || []);
      setSummary(result.summary || {
        total: 0,
        connected: 0,
        disconnected: 0,
        reconnecting: 0,
        error: 0
      });
      setLastUpdate(new Date());
      
    } catch (error: any) {
      console.error('❌ Erro ao buscar dados de saúde:', error);
      toast({
        title: "Erro ao verificar saúde",
        description: error.message || "Não foi possível verificar a saúde das conexões.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Função para forçar reconexão
  const forceReconnect = useCallback(async (accountId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/${accountId}/force-reconnect`, {
        method: 'POST',
        headers
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao forçar reconexão');
      }

      toast({
        title: "Reconexão forçada",
        description: result.message || "Reconexão iniciada com sucesso!",
      });

      // Atualizar dados após alguns segundos
      setTimeout(() => {
        fetchHealthData();
      }, 2000);

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao forçar reconexão:', error);
      toast({
        title: "Erro ao forçar reconexão",
        description: error.message || "Não foi possível forçar a reconexão.",
        variant: "destructive",
      });
      throw error;
    }
  }, [fetchHealthData, toast]);

  // ✅ OTIMIZADO: Atualizar dados periodicamente com intervalo maior
  useEffect(() => {
    fetchHealthData();
    
    // ✅ OTIMIZAÇÃO: Atualizar a cada 5 minutos (aumentado de 2 min) para reduzir requisições ao Supabase
    const interval = setInterval(() => {
      fetchHealthData();
    }, 300000); // 300000ms = 5 minutos

    return () => clearInterval(interval);
  }, [fetchHealthData]);

  // Atualizar contadores de tempo em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setAccounts(prev => prev.map(account => ({
        ...account,
        health: {
          ...account.health,
          canRetry: Date.now() - account.health.lastAttempt >= 10000,
          nextRetryIn: Math.max(0, 10000 - (Date.now() - account.health.lastAttempt))
        }
      })));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return {
    accounts,
    summary,
    loading,
    lastUpdate,
    fetchHealthData,
    forceReconnect
  };
};
