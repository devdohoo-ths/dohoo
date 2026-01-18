import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeadersWithUser } from '@/utils/apiBase';
import type { TeamDeliveryStrategy } from '../types';

/**
 * Hook para gerenciar estratégias de entrega de times
 */
export const useStrategies = () => {
  const [strategies, setStrategies] = useState<TeamDeliveryStrategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { organization } = useOrganization();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  /**
   * Buscar todas as estratégias da organização
   */
  const fetchStrategies = useCallback(async () => {
    if (!organization?.id) {
      console.log('[useStrategies] Organização não disponível');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[useStrategies] Buscando estratégias...');
      
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/intelligent-service/strategies`, {
        headers
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao buscar estratégias');
      }

      console.log('[useStrategies] Estratégias carregadas:', data.strategies.length);
      setStrategies(data.strategies || []);

    } catch (err: any) {
      console.error('[useStrategies] Erro ao buscar estratégias:', err);
      setError(err.message);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as estratégias',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, user, profile, toast]);

  /**
   * Criar ou atualizar estratégia de um time
   */
  const saveStrategy = useCallback(async (strategyData: Partial<TeamDeliveryStrategy>) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useStrategies] Salvando estratégia:', strategyData);

      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/intelligent-service/strategies`, {
        method: 'POST',
        headers,
        body: JSON.stringify(strategyData)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar estratégia');
      }

      console.log('[useStrategies] Estratégia salva:', data.strategy.id);
      
      toast({
        title: 'Sucesso',
        description: 'Estratégia salva com sucesso!'
      });

      // Recarregar lista
      await fetchStrategies();

      return data.strategy;

    } catch (err: any) {
      console.error('[useStrategies] Erro ao salvar estratégia:', err);
      setError(err.message);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível salvar a estratégia',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast, fetchStrategies]);

  /**
   * Buscar estratégia de um time específico
   */
  const getStrategyByTeam = useCallback((teamId: string) => {
    return strategies.find(s => s.team_id === teamId);
  }, [strategies]);

  /**
   * Alternar status ativo/inativo
   */
  const toggleActive = useCallback(async (teamId: string, currentStatus: boolean) => {
    const strategy = getStrategyByTeam(teamId);
    if (!strategy) {
      toast({
        title: 'Erro',
        description: 'Estratégia não encontrada',
        variant: 'destructive'
      });
      return null;
    }

    return await saveStrategy({
      team_id: teamId,
      strategy_type: strategy.strategy_type,
      config: strategy.config,
      is_active: !currentStatus
    });
  }, [getStrategyByTeam, saveStrategy, toast]);

  // Carregar estratégias ao montar o componente
  useEffect(() => {
    if (organization?.id) {
      fetchStrategies();
    }
  }, [organization?.id, fetchStrategies]);

  return {
    strategies,
    loading,
    error,
    fetchStrategies,
    saveStrategy,
    getStrategyByTeam,
    toggleActive,
    // Métricas úteis
    activeStrategies: strategies.filter(s => s.is_active),
    inactiveStrategies: strategies.filter(s => !s.is_active),
    totalStrategies: strategies.length,
    // Estratégias por tipo
    roundRobinStrategies: strategies.filter(s => s.strategy_type === 'round_robin'),
    priorityStrategies: strategies.filter(s => s.strategy_type === 'priority'),
    broadcastStrategies: strategies.filter(s => s.strategy_type === 'broadcast'),
    workloadStrategies: strategies.filter(s => s.strategy_type === 'workload')
  };
};

