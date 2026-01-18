import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { 
  RankingData, 
  RankingFilters, 
  RankingLeaderboard, 
  UserRankingProfile,
  RankingStats,
  RankingType,
  RankingPeriod 
} from '@/types/ranking';

export const useRanking = () => {
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [leaderboards, setLeaderboards] = useState<RankingLeaderboard[]>([]);
  const [userProfile, setUserProfile] = useState<UserRankingProfile | null>(null);
  const [stats, setStats] = useState<RankingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { profile } = useAuth();
  const { toast } = useToast();

  // Buscar rankings por tipo e período
  const fetchRankings = useCallback(async (
    type: RankingType, 
    period: RankingPeriod = 'week',
    filters?: Partial<RankingFilters>
  ) => {
    if (!profile?.organization_id) {
      console.log('[Ranking] ❌ Sem organization_id, pulando busca');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🏆 Buscando ranking ${type} para período ${period}`);
      
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        type,
        period,
        organization_id: profile.organization_id,
        ...(filters?.department && { department: filters.department.join(',') }),
        ...(filters?.team && { team: filters.team.join(',') }),
        ...(filters?.role && { role: filters.role.join(',') }),
        ...(filters?.dateRange && {
          start_date: filters.dateRange.start.toISOString(),
          end_date: filters.dateRange.end.toISOString()
        })
      });

      const response = await fetch(`${apiBase}/api/rankings?${params}`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar ranking: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar ranking');
      }

      console.log(`✅ Ranking ${type} carregado:`, result.data);
      const rankingData = result.data as RankingData;
      
      // Atualizar estado rankings
      setRankings(prev => {
        const filtered = prev.filter(r => !(r.type === type && r.period === period));
        return [...filtered, rankingData];
      });
      
      return rankingData;
    } catch (error) {
      console.error('❌ Erro ao buscar ranking:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      toast({
        title: "Erro",
        description: "Falha ao carregar ranking",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, toast]);

  // Buscar todos os leaderboards disponíveis
  const fetchLeaderboards = useCallback(async () => {
    if (!profile?.organization_id) {
      console.log('[Ranking] ❌ Sem organization_id, pulando busca de leaderboards');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🏆 Buscando leaderboards...');
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/rankings/leaderboards?organization_id=${profile.organization_id}`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar leaderboards: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar leaderboards');
      }

      console.log(`✅ ${result.leaderboards?.length || 0} leaderboards carregados`);
      setLeaderboards(result.leaderboards || []);
    } catch (error) {
      console.error('❌ Erro ao buscar leaderboards:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      toast({
        title: "Erro",
        description: "Falha ao carregar leaderboards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, toast]);

  // Buscar perfil de ranking do usuário atual
  const fetchUserProfile = useCallback(async () => {
    if (!profile?.id || !profile?.organization_id) {
      console.log('[Ranking] ❌ Sem dados do usuário, pulando busca de perfil');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('👤 Buscando perfil de ranking do usuário...');
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/rankings/user-profile?user_id=${profile.id}&organization_id=${profile.organization_id}`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar perfil: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar perfil');
      }

      console.log('✅ Perfil de ranking carregado:', result.profile);
      setUserProfile(result.profile);
    } catch (error) {
      console.error('❌ Erro ao buscar perfil de ranking:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.organization_id]);

  // Buscar estatísticas gerais de ranking
  const fetchStats = useCallback(async (period: RankingPeriod = 'week') => {
    if (!profile?.organization_id) {
      console.log('[Ranking] ❌ Sem organization_id, pulando busca de stats');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📊 Buscando estatísticas de ranking para período ${period}...`);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/rankings/stats?organization_id=${profile.organization_id}&period=${period}`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar estatísticas: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar estatísticas');
      }

      console.log('✅ Estatísticas de ranking carregadas:', result.stats);
      setStats(result.stats);
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas de ranking:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  // Buscar múltiplos rankings simultaneamente
  const fetchMultipleRankings = useCallback(async (
    types: RankingType[], 
    period: RankingPeriod = 'week',
    filters?: Partial<RankingFilters>
  ) => {
    if (!profile?.organization_id) {
      console.log('[Ranking] ❌ Sem organization_id, pulando busca múltipla');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🏆 Buscando múltiplos rankings: ${types.join(', ')}`);
      
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        types: types.join(','),
        period,
        organization_id: profile.organization_id,
        ...(filters?.department && { department: filters.department.join(',') }),
        ...(filters?.team && { team: filters.team.join(',') }),
        ...(filters?.role && { role: filters.role.join(',') }),
        ...(filters?.dateRange && {
          start_date: filters.dateRange.start.toISOString(),
          end_date: filters.dateRange.end.toISOString()
        })
      });

      const response = await fetch(`${apiBase}/api/rankings/multiple?${params}`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar rankings: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar rankings');
      }

      console.log(`✅ ${result.rankings?.length || 0} rankings carregados`);
      setRankings(result.rankings || []);
      return result.rankings as RankingData[];
    } catch (error) {
      console.error('❌ Erro ao buscar rankings múltiplos:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      toast({
        title: "Erro",
        description: "Falha ao carregar rankings",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, toast]);

  // Atualizar ranking específico
  const refreshRanking = useCallback(async (type: RankingType, period: RankingPeriod = 'week') => {
    const ranking = await fetchRankings(type, period);
    if (ranking) {
      setRankings(prev => {
        const filtered = prev.filter(r => !(r.type === type && r.period === period));
        return [...filtered, ranking];
      });
    }
    return ranking;
  }, [fetchRankings]);

  // Carregar dados iniciais
  useEffect(() => {
    if (profile?.organization_id) {
      fetchLeaderboards();
      fetchUserProfile();
      fetchStats();
    }
  }, [profile?.organization_id, fetchLeaderboards, fetchUserProfile, fetchStats]);

  return {
    rankings,
    leaderboards,
    userProfile,
    stats,
    loading,
    error,
    fetchRankings,
    fetchLeaderboards,
    fetchUserProfile,
    fetchStats,
    fetchMultipleRankings,
    refreshRanking
  };
};
