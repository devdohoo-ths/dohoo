import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useAppData } from '@/contexts/AppDataContext';
import { useThrottle } from './useDebounce';
import { apiBase } from '@/utils/apiBase';

export interface Widget {
  id: string;
  widget_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  is_enabled: boolean;
  widget_config?: any;
}

export interface WidgetConfig {
  [key: string]: boolean;
}

// Widget names and descriptions
export const WIDGET_NAMES: { [key: string]: string } = {
  ai_credits: 'Créditos IA',
  total_messages: 'Total de Mensagens',
  sent_messages: 'Mensagens Enviadas',
  received_messages: 'Mensagens Recebidas',
  assistants_created: 'Assistentes',
  users: 'Usuários Ativos',
  response_time: 'Tempo de Resposta',
  quick_actions: 'Ações Rápidas',
  recent_activity: 'Atividade Recente',
  ai_credits_overview: 'Visão Geral Créditos',
};

export const WIDGET_DESCRIPTIONS: { [key: string]: string } = {
  ai_credits: 'Créditos de IA disponíveis',
  total_messages: 'Total de mensagens da plataforma',
  sent_messages: 'Mensagens enviadas pelos agentes',
  received_messages: 'Mensagens recebidas dos clientes',
  assistants_created: 'Assistentes configurados',
  users: 'Usuários ativos no sistema',
  response_time: 'Tempo médio de resposta',
  quick_actions: 'Ações rápidas disponíveis',
  recent_activity: 'Atividades recentes',
  ai_credits_overview: 'Visão geral dos créditos de IA',
};

// Widgets padrão
const defaultWidgets: Omit<Widget, 'id'>[] = [
  { widget_type: 'ai_credits', position_x: 0, position_y: 0, width: 1, height: 1, is_enabled: true },
  { widget_type: 'total_messages', position_x: 1, position_y: 0, width: 1, height: 1, is_enabled: true },
  { widget_type: 'sent_messages', position_x: 2, position_y: 0, width: 1, height: 1, is_enabled: true },
  { widget_type: 'received_messages', position_x: 3, position_y: 0, width: 1, height: 1, is_enabled: true },
  { widget_type: 'assistants_created', position_x: 0, position_y: 1, width: 1, height: 1, is_enabled: true },
  { widget_type: 'users', position_x: 1, position_y: 1, width: 1, height: 1, is_enabled: true },
  { widget_type: 'response_time', position_x: 2, position_y: 1, width: 1, height: 1, is_enabled: true },
  { widget_type: 'quick_actions', position_x: 0, position_y: 2, width: 1, height: 1, is_enabled: true },
  { widget_type: 'recent_activity', position_x: 1, position_y: 2, width: 1, height: 1, is_enabled: true },
  { widget_type: 'ai_credits_overview', position_x: 0, position_y: 3, width: 1, height: 1, is_enabled: true },
];

// ✅ Função utilitária para logs condicionais (desabilitada)
const log = (..._args: any[]) => {
  // Logs desabilitados para limpeza do console
  // console.log(..._args);
};

export const useDashboardWidgets = () => {
  const { user, profile } = useAuth();
  const { 
    dashboardStats: contextStats, 
    dashboardStatsLoading,
    refreshDashboardStats 
  } = useAppData();
  
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('7d');

  // ✅ Corrigido: Definir userOrganizationId corretamente
  const userOrganizationId = profile?.organization_id;

  // ✅ NOVO: Usar dados do contexto quando disponíveis
  useEffect(() => {
    if (contextStats) {
      setDashboardStats(contextStats);
      setLoading(false);
    }
  }, [contextStats]);

  // 🎯 NOVA ABORDAGEM: Usar localStorage em vez do banco
  const getStorageKey = useCallback((userId: string) => `dashboard_widgets_${userId}`, []);
  const getConfigKey = useCallback((userId: string) => `widget_config_${userId}`, []);

  // Carregar widgets do localStorage
  const loadWidgetsFromStorage = useCallback((userId: string): Widget[] => {
    try {
      const storageKey = getStorageKey(userId);
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        log('🔧 Widgets carregados do localStorage:', parsed.length);
        return parsed;
      }
    } catch (err) {
    }
    
    // Fallback para widgets padrão
    return defaultWidgets.map((widget, index) => ({
      ...widget,
      id: `widget_${index}`,
      is_enabled: true
    }));
  }, [getStorageKey]);

  // Salvar widgets no localStorage
  const saveWidgetsToStorage = useCallback((userId: string, widgets: Widget[]) => {
    try {
      const storageKey = getStorageKey(userId);
      localStorage.setItem(storageKey, JSON.stringify(widgets));
      log('💾 Widgets salvos no localStorage:', widgets.length);
    } catch (err) {
    }
  }, [getStorageKey]);

  // Carregar configuração do localStorage
  const loadWidgetConfig = useCallback((userId: string): WidgetConfig => {
    try {
      const configKey = getConfigKey(userId);
      const stored = localStorage.getItem(configKey);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        log('🔧 Configuração carregada do localStorage:', Object.keys(parsed).length);
        return parsed;
      }
    } catch (err) {
    }
    
    // Fallback para configuração padrão (todos habilitados)
    const defaultConfig: WidgetConfig = {};
    defaultWidgets.forEach(widget => {
      defaultConfig[widget.widget_type] = true;
    });
    return defaultConfig;
  }, [getConfigKey]);

  // Salvar configuração no localStorage
  const saveWidgetConfig = useCallback((userId: string, config: WidgetConfig) => {
    try {
      const configKey = getConfigKey(userId);
      localStorage.setItem(configKey, JSON.stringify(config));
      log('💾 Configuração salva no localStorage:', Object.keys(config).length);
    } catch (err) {
    }
  }, [getConfigKey]);

  // Carregar widgets
  const fetchWidgets = useCallback(async () => {
    if (!user?.id) return;

    try {
      log('🔧 Carregando widgets do localStorage...');
      
      const fallbackWidgets = loadWidgetsFromStorage(user.id);
      const config = loadWidgetConfig(user.id);
      
      log('🔧 Widgets carregados do storage:', fallbackWidgets.length);
      log('🔧 Configuração carregada:', Object.keys(config).length);
      
      // Aplicar configuração aos widgets
      const configuredWidgets = fallbackWidgets.map(widget => ({
        ...widget,
        is_enabled: config[widget.widget_type] !== false // Padrão: habilitado
      }));
      
      log('🔧 Widgets configurados:', configuredWidgets.map(w => `${w.widget_type}: ${w.is_enabled ? 'enabled' : 'disabled'}`));
      
      setWidgets(configuredWidgets);
      log('✅ Widgets carregados:', configuredWidgets.length);
      
    } catch (err: any) {
      setError(err.message);
      
      // Fallback para widgets padrão
      const fallbackWidgets = defaultWidgets.map((widget, index) => ({
        ...widget,
        id: `widget_${index}`,
        is_enabled: true
      }));
      setWidgets(fallbackWidgets);
    }
  }, [user?.id, loadWidgetsFromStorage, loadWidgetConfig]);

  // ✅ OTIMIZADO: Throttled refresh usando contexto global
  const throttledRefresh = useThrottle(
    useCallback((period?: '24h' | '7d' | '30d') => {
      if (period && period !== selectedPeriod) {
        setSelectedPeriod(period);
      }
      refreshDashboardStats(true);
    }, [refreshDashboardStats, selectedPeriod]),
    2000 // Throttle de 2 segundos
  );

  // ✅ OTIMIZADO: Função simplificada que usa o contexto global
  const fetchDashboardStats = useCallback(async (period?: '24h' | '7d' | '30d') => {
    if (!user?.id || !userOrganizationId) {
      log('⚠️ [Dashboard] Usuário ou organização não disponível');
      return;
    }

    const currentPeriod = period || selectedPeriod;
    
    // Atualizar período se necessário
    if (period && period !== selectedPeriod) {
      setSelectedPeriod(period);
    }

    // Usar função throttled para evitar múltiplas chamadas
    setLoading(true);
    throttledRefresh(currentPeriod);
    
    // Os dados serão atualizados automaticamente pelo useEffect que observa contextStats
  }, [user?.id, userOrganizationId, selectedPeriod, throttledRefresh]);

  // 🎯 FUNÇÃO PARA ATUALIZAR O PERÍODO E RECARREGAR AS ESTATÍSTICAS
  const updatePeriod = useCallback((newPeriod: '24h' | '7d' | '30d') => {
    log('📅 [Dashboard] Atualizando período:', { from: selectedPeriod, to: newPeriod });
    setSelectedPeriod(newPeriod);
    fetchDashboardStats(newPeriod);
  }, [selectedPeriod, fetchDashboardStats]);

  // 🎯 FUNÇÃO PARA RECARREGAR ESTATÍSTICAS COM O PERÍODO ATUAL
  const refreshStats = useCallback(() => {
    log('🔄 [Dashboard] Recarregando estatísticas com período atual:', selectedPeriod);
    fetchDashboardStats(selectedPeriod);
  }, [selectedPeriod, fetchDashboardStats]);

  // Alternar visibilidade do widget
  const toggleWidget = useCallback(async (widgetId: string) => {
    if (!user?.id) return;

    try {
      log('🔄 Alternando widget:', widgetId);
      
      const updatedWidgets = widgets.map(widget => {
        if (widget.id === widgetId) {
          return { ...widget, is_enabled: !widget.is_enabled };
        }
        return widget;
      });
      
      setWidgets(updatedWidgets);
      
      // Salvar no localStorage
      saveWidgetsToStorage(user.id, updatedWidgets);
      
      // Atualizar configuração
      const newConfig: WidgetConfig = {};
      updatedWidgets.forEach(widget => {
        newConfig[widget.widget_type] = widget.is_enabled;
      });
      saveWidgetConfig(user.id, newConfig);
      
      log('✅ Widget alternado e salvo no localStorage');
      
    } catch (err: any) {
      setError(err.message);
    }
  }, [widgets, user?.id, saveWidgetsToStorage, saveWidgetConfig]);

  // Resetar para padrão
  const resetToDefault = useCallback(async () => {
    if (!user?.id) return;

    try {
      log('🔄 Resetando widgets para padrão');
      
      // Criar widgets padrão com todos habilitados
      const defaultWidgetsWithIds = defaultWidgets.map((widget, index) => ({
        ...widget,
        id: `widget_${index}`,
        is_enabled: true,
        widget_config: {}
      }));
      
      setWidgets(defaultWidgetsWithIds);
      
      // Salvar no localStorage
      saveWidgetsToStorage(user.id, defaultWidgetsWithIds);
      
      // Resetar configuração para todos habilitados
      const defaultConfig: WidgetConfig = {};
      defaultWidgets.forEach(widget => {
        defaultConfig[widget.widget_type] = true;
      });
      saveWidgetConfig(user.id, defaultConfig);
      
      log('✅ Widgets resetados para padrão no localStorage');
      setError(null);
      
    } catch (err: any) {
      setError(err.message);
    }
  }, [user?.id, saveWidgetsToStorage, saveWidgetConfig]);

  // ✅ OTIMIZADO: Carregar widgets apenas (stats vêm do contexto)
  useEffect(() => {
    if (user?.id && userOrganizationId) {
      log('📊 [Dashboard] 🚀 Carregando widgets para organização:', userOrganizationId);
      fetchWidgets();
      // Stats são carregados automaticamente pelo AppDataContext no login
    }
  }, [user?.id, userOrganizationId, fetchWidgets]);

  // ✅ OTIMIZADO: Atualização periódica reduzida (5 minutos ao invés de 30 segundos)
  // O contexto já gerencia o refresh de forma otimizada
  useEffect(() => {
    if (!user?.id || !userOrganizationId) return;

    const interval = setInterval(() => {
      log('📊 [Dashboard] 🔄 Atualizando estatísticas periodicamente (5min)');
      throttledRefresh(selectedPeriod);
    }, 5 * 60 * 1000); // 5 minutos ao invés de 30 segundos

    return () => clearInterval(interval);
  }, [user?.id, userOrganizationId, selectedPeriod, throttledRefresh]);

  return {
    widgets,
    dashboardStats,
    error,
    loading,
    toggleWidget,
    resetToDefault,
    fetchWidgets,
    fetchDashboardStats,
    updatePeriod,
    refreshStats,
    selectedPeriod,
  };
};