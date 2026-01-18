/**
 * Contexto Global para Dados da Aplicação
 * 
 * Este contexto centraliza o carregamento e cache de dados,
 * evitando requisições duplicadas e melhorando a performance.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dataCache, CacheOperations } from '@/utils/dataCache';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface AppDataState {
  // Dados do usuário e organização
  organization: any | null;
  userRole: string | null;
  
  // Dados do dashboard
  dashboardStats: any | null;
  dashboardStatsLoading: boolean;
  
  // Dados do WhatsApp
  whatsappAccounts: any[] | null;
  whatsappAccountsLoading: boolean;
  
  // Dados de times
  teams: any[] | null;
  teamsLoading: boolean;
  
  // Dados de IA
  aiSettings: any[] | null;
  aiCredits: any | null;
  aiDataLoading: boolean;
  
  // Estado geral
  initialized: boolean;
  lastRefresh: number | null;
}

interface AppDataContextValue extends AppDataState {
  // Funções para atualizar dados
  refreshDashboardStats: (force?: boolean) => Promise<void>;
  refreshWhatsAppAccounts: (force?: boolean) => Promise<void>;
  refreshTeams: (force?: boolean) => Promise<void>;
  refreshAIData: (force?: boolean) => Promise<void>;
  refreshAll: (force?: boolean) => Promise<void>;
  
  // Funções para invalidar cache
  invalidateCache: (operation?: string) => void;
  
  // Estado de loading
  isLoading: boolean;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

interface AppDataProviderProps {
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  const { user, profile } = useAuth();
  const [state, setState] = useState<AppDataState>({
    organization: null,
    userRole: null,
    dashboardStats: null,
    dashboardStatsLoading: false,
    whatsappAccounts: null,
    whatsappAccountsLoading: false,
    teams: null,
    teamsLoading: false,
    aiSettings: null,
    aiCredits: null,
    aiDataLoading: false,
    initialized: false,
    lastRefresh: null
  });

  const organizationId = profile?.organization_id;

  /**
   * Carrega dados da organização
   */
  const loadOrganization = useCallback(async () => {
    if (!organizationId) return null;

    const cached = dataCache.get(CacheOperations.ORGANIZATION, { organizationId });
    if (cached) {
      setState(prev => ({ ...prev, organization: cached }));
      return cached;
    }

    try {
      // ✅ MIGRADO: Usar API do backend para buscar organização
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/organizations/${organizationId}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar organização: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data && data.organization) {
        const orgData = data.organization;
        dataCache.set(CacheOperations.ORGANIZATION, orgData, { organizationId }, { ttl: 30 * 60 * 1000 }); // 30 minutos
        setState(prev => ({ ...prev, organization: orgData }));
        return orgData;
      }
    } catch (error) {
      console.error('❌ [AppData] Erro ao carregar organização:', error);
    }

    return null;
  }, [organizationId]);

  /**
   * Carrega estatísticas do dashboard
   */
  const loadDashboardStats = useCallback(async (force = false, period: '24h' | '7d' | '30d' = '7d') => {
    if (!user?.id || !organizationId) return;

    const params = {
      user_id: user.id,
      organization_id: organizationId,
      period
    };

    // Verificar cache se não for força
    if (!force) {
      const cached = dataCache.get(CacheOperations.DASHBOARD_STATS, params, { ttl: 2 * 60 * 1000 }); // 2 minutos
      if (cached) {
        setState(prev => ({ ...prev, dashboardStats: cached, dashboardStatsLoading: false }));
        return cached;
      }
    }

    setState(prev => ({ ...prev, dashboardStatsLoading: true }));

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let dateStart: string, dateEnd: string;

      if (period === '24h') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateStart = yesterday.toISOString().split('T')[0];
        dateEnd = today.toISOString().split('T')[0];
      } else if (period === '7d') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        dateStart = sevenDaysAgo.toISOString().split('T')[0];
        dateEnd = today.toISOString().split('T')[0];
      } else {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateStart = thirtyDaysAgo.toISOString().split('T')[0];
        dateEnd = today.toISOString().split('T')[0];
      }

      const statsParams = new URLSearchParams({
        user_id: user.id,
        organization_id: organizationId,
        dateStart,
        dateEnd
      });

      const headers = {
        'Authorization': 'Bearer dohoo_dev_token_2024',
        'Content-Type': 'application/json',
        'x-user-id': user.id,
        'x-user-role': profile?.roles?.name || 'agent'
      };

      const response = await fetch(`${apiBase}/api/dashboard/stats?${statsParams}`, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.stats) {
        dataCache.set(CacheOperations.DASHBOARD_STATS, data.stats, params, { ttl: 2 * 60 * 1000 }); // 2 minutos
        setState(prev => ({ ...prev, dashboardStats: data.stats, dashboardStatsLoading: false }));
        return data.stats;
      }
    } catch (error) {
      console.error('❌ [AppData] Erro ao carregar dashboard stats:', error);
      setState(prev => ({ ...prev, dashboardStatsLoading: false }));
    }

    return null;
  }, [user?.id, organizationId, profile?.roles?.name]);

  /**
   * Carrega contas WhatsApp
   */
  const loadWhatsAppAccounts = useCallback(async (force = false) => {
    if (!organizationId) return;

    const params = { organization_id: organizationId };

    if (!force) {
      const cached = dataCache.get(CacheOperations.WHATSAPP_ACCOUNTS, params, { ttl: 5 * 60 * 1000 }); // 5 minutos
      if (cached) {
        setState(prev => ({ ...prev, whatsappAccounts: cached, whatsappAccountsLoading: false }));
        return cached;
      }
    }

    setState(prev => ({ ...prev, whatsappAccountsLoading: true }));

    try {
      // ✅ MIGRADO: Usar API do backend para buscar WhatsApp accounts
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts?organizationId=${organizationId}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar WhatsApp accounts: ${response.statusText}`);
      }

      const json = await response.json();
      const data = json.accounts || json || [];

      if (data && Array.isArray(data)) {
        dataCache.set(CacheOperations.WHATSAPP_ACCOUNTS, data, params, { ttl: 5 * 60 * 1000 }); // 5 minutos
        setState(prev => ({ ...prev, whatsappAccounts: data, whatsappAccountsLoading: false }));
        return data;
      }
    } catch (error) {
      console.error('❌ [AppData] Erro ao carregar WhatsApp accounts:', error);
      setState(prev => ({ ...prev, whatsappAccountsLoading: false }));
    }

    return null;
  }, [organizationId]);

  /**
   * Carrega times
   */
  const loadTeams = useCallback(async (force = false) => {
    if (!organizationId) return;

    const params = { organization_id: organizationId };

    if (!force) {
      const cached = dataCache.get(CacheOperations.TEAMS, params, { ttl: 10 * 60 * 1000 }); // 10 minutos
      if (cached) {
        setState(prev => ({ ...prev, teams: cached, teamsLoading: false }));
        return cached;
      }
    }

    setState(prev => ({ ...prev, teamsLoading: true }));

    try {
      // ✅ MIGRADO: Usar API do backend para buscar teams
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams?organization_id=${organizationId}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar teams: ${response.statusText}`);
      }

      const json = await response.json();
      const data = json.teams || json || [];

      if (data && Array.isArray(data)) {
        // Ordenar por nome
        const sortedData = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        dataCache.set(CacheOperations.TEAMS, sortedData, params, { ttl: 10 * 60 * 1000 }); // 10 minutos
        setState(prev => ({ ...prev, teams: sortedData, teamsLoading: false }));
        return sortedData;
      }
    } catch (error) {
      console.error('❌ [AppData] Erro ao carregar teams:', error);
      setState(prev => ({ ...prev, teamsLoading: false }));
    }

    return null;
  }, [organizationId]);

  /**
   * Carrega dados de IA
   */
  const loadAIData = useCallback(async (force = false) => {
    if (!organizationId) return;

    const params = { organization_id: organizationId };

    if (!force) {
      const cachedSettings = dataCache.get(CacheOperations.AI_SETTINGS, params, { ttl: 10 * 60 * 1000 });
      const cachedCredits = dataCache.get(CacheOperations.AI_CREDITS, params, { ttl: 2 * 60 * 1000 });
      
      if (cachedSettings && cachedCredits) {
        setState(prev => ({ 
          ...prev, 
          aiSettings: cachedSettings, 
          aiCredits: cachedCredits, 
          aiDataLoading: false 
        }));
        return { settings: cachedSettings, credits: cachedCredits };
      }
    }

    setState(prev => ({ ...prev, aiDataLoading: true }));

    try {
      // ✅ MIGRADO: Usar API do backend para buscar dados de IA
      const headers = await getAuthHeaders();
      const [settingsResponse, creditsResponse] = await Promise.all([
        fetch(`${apiBase}/api/ai/assistants?organization_id=${organizationId}`, { headers }),
        fetch(`${apiBase}/api/ai/credits?organization_id=${organizationId}`, { headers })
      ]);

      if (!settingsResponse.ok) throw new Error(`Erro ao buscar AI assistants: ${settingsResponse.statusText}`);
      // Tratar erro de créditos de forma mais suave (pode não existir)
      if (!creditsResponse.ok && creditsResponse.status !== 404) {
        throw new Error(`Erro ao buscar AI credits: ${creditsResponse.statusText}`);
      }

      const settingsJson = await settingsResponse.json();
      const settings = settingsJson.assistants || settingsJson || [];
      
      // Processar créditos - pode não existir ou retornar 404
      let credits = null;
      if (creditsResponse.ok) {
        const creditsJson = await creditsResponse.json();
        credits = creditsJson.credit || creditsJson || null;
      } else if (creditsResponse.status === 404) {
        // Se não existir, criar objeto vazio
        credits = {
          credits_remaining: 0,
          credits_purchased: 0,
          credits_used: 0,
          organization_id: organizationId
        };
      }

      dataCache.set(CacheOperations.AI_SETTINGS, settings, params, { ttl: 10 * 60 * 1000 });
      if (credits) {
        dataCache.set(CacheOperations.AI_CREDITS, credits, params, { ttl: 2 * 60 * 1000 });
      }

      setState(prev => ({ 
        ...prev, 
        aiSettings: settings, 
        aiCredits: credits, 
        aiDataLoading: false 
      }));

      return { settings, credits };
    } catch (error) {
      console.error('❌ [AppData] Erro ao carregar dados de IA:', error);
      setState(prev => ({ ...prev, aiDataLoading: false }));
    }

    return null;
  }, [organizationId]);

  /**
   * Carrega todos os dados iniciais
   */
  const loadAllData = useCallback(async (force = false) => {
    if (!organizationId || !user?.id) return;

    setState(prev => ({ ...prev, initialized: false }));

    // Carregar em paralelo
    await Promise.all([
      loadOrganization(),
      loadDashboardStats(force),
      loadWhatsAppAccounts(force),
      loadTeams(force),
      loadAIData(force)
    ]);

    setState(prev => ({ 
      ...prev, 
      initialized: true, 
      lastRefresh: Date.now(),
      userRole: profile?.roles?.name || null
    }));
  }, [organizationId, user?.id, profile?.roles?.name, loadOrganization, loadDashboardStats, loadWhatsAppAccounts, loadTeams, loadAIData]);

  // Carregar dados quando o usuário fizer login
  useEffect(() => {
    if (user && profile && organizationId && !state.initialized) {
      loadAllData();
    }
  }, [user, profile, organizationId, state.initialized, loadAllData]);

  // Funções de refresh expostas
  const refreshDashboardStats = useCallback((force = false) => loadDashboardStats(force), [loadDashboardStats]);
  const refreshWhatsAppAccounts = useCallback((force = false) => loadWhatsAppAccounts(force), [loadWhatsAppAccounts]);
  const refreshTeams = useCallback((force = false) => loadTeams(force), [loadTeams]);
  const refreshAIData = useCallback((force = false) => loadAIData(force), [loadAIData]);
  const refreshAll = useCallback((force = false) => loadAllData(force), [loadAllData]);

  const invalidateCache = useCallback((operation?: string) => {
    if (operation) {
      dataCache.invalidate(operation, { organization_id: organizationId });
    } else {
      dataCache.invalidateByOrganization(organizationId!);
    }
  }, [organizationId]);

  const isLoading = 
    state.dashboardStatsLoading ||
    state.whatsappAccountsLoading ||
    state.teamsLoading ||
    state.aiDataLoading ||
    !state.initialized;

  const value: AppDataContextValue = {
    ...state,
    refreshDashboardStats,
    refreshWhatsAppAccounts,
    refreshTeams,
    refreshAIData,
    refreshAll,
    invalidateCache,
    isLoading
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData deve ser usado dentro de AppDataProvider');
  }
  return context;
};

