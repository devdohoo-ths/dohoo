import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
// ✅ CORREÇÃO: Usar o hook correto do AuthProvider
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from './useRoles';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { permissionsCache } from '@/utils/permissionsCache';

export interface UserPermissions {
  chat?: boolean | Record<string, boolean>;
  ai?: boolean | Record<string, boolean>;
  accounts?: boolean | Record<string, boolean>;
  settings?: boolean | Record<string, boolean>;
  analytics?: boolean | Record<string, boolean>;
  users?: boolean | Record<string, boolean>;
  administration?: boolean | Record<string, boolean>;
  dashboard?: boolean | Record<string, boolean>;
  automation?: boolean | Record<string, boolean>;
  marketplace?: boolean | Record<string, boolean>;
  advanced_settings?: boolean | Record<string, boolean>;
  support?: boolean | Record<string, boolean>;
  [key: string]: boolean | Record<string, boolean> | undefined;
}

export const usePermissions = () => {
  // ✅ CORREÇÃO: Usar o hook correto
  const { user, profile } = useAuth();
  const { roles } = useRoles();
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef<boolean>(false);
  const [cacheUsed, setCacheUsed] = useState(false);

  // 🚀 Memoizar permissões para evitar re-renders desnecessários
  const memoizedPermissions = useMemo(() => permissions, [permissions]);

  // 🚀 Memoizar funções de verificação para performance
  const hasPermission = useCallback((permission: string, conservative: boolean = false): boolean => {
    if (!user || !profile) {
      return false;
    }
    
    // ✅ CORREÇÃO: Super admin usando estrutura correta - roles.name (não profile.role_name)
    const currentRole = roles.find(r => r.id === profile.role_id);
    if (currentRole?.name?.toLowerCase().includes('super admin')) {
      return true;
    }
    
    // Se ainda não foi inicializado, retorna false (modo conservador)
    if (!initialized) {
      return false;
    }
    
    // Se ainda está carregando, comportamento depende do modo
    if (loading) {
      if (conservative) {
        return false; // Modo conservador: não mostra nada durante loading
      } else {
        return true; // Modo permissivo: mostra durante loading
      }
    }
    
    // ✅ CORREÇÃO: Usar as permissões da role do profile (profile.role_permissions)
    if (profile.role_permissions && typeof profile.role_permissions === 'object') {
      const rolePermissions = profile.role_permissions as Record<string, boolean>;
      if (rolePermissions[permission] === true) {
        return true;
      }
    }
    
    // Verificar se a permissão existe diretamente
    if (memoizedPermissions[permission] === true) {
      return true;
    }
    
    // Verificar se a permissão existe dentro de um módulo
    const moduleKeys = Object.keys(memoizedPermissions);
    for (const moduleKey of moduleKeys) {
      const module = memoizedPermissions[moduleKey];
      if (typeof module === 'object' && module && module[permission] === true) {
        return true;
      }
    }
    
    return false;
  }, [user, profile, initialized, loading, memoizedPermissions, roles]);

  const hasAnyPermission = useCallback((permissionList: string[]): boolean => {
    if (!user || !profile) return false;
    
    // ✅ CORREÇÃO: Super admin usando estrutura correta
    const currentRole = roles.find(r => r.id === profile.role_id);
    if (currentRole?.name?.toLowerCase().includes('super admin')) return true;
    
    if (!initialized) return false;
    if (loading) return true;
    
    return permissionList.some(permission => hasPermission(permission));
  }, [user, profile, initialized, loading, hasPermission, roles]);

  const hasAllPermissions = useCallback((permissionList: string[]): boolean => {
    if (!user || !profile) return false;
    
    // ✅ CORREÇÃO: Super admin usando estrutura correta
    const currentRole = roles.find(r => r.id === profile.role_id);
    if (currentRole?.name?.toLowerCase().includes('super admin')) return true;
    
    if (!initialized) return false;
    if (loading) return true;
    
    return permissionList.every(permission => hasPermission(permission));
  }, [user, profile, initialized, loading, hasPermission, roles]);

  // ✅ CORREÇÃO: Função para buscar permissões atualizada
  const fetchPermissions = useCallback(async () => {
    if (!user || !profile || fetchRef.current) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      fetchRef.current = true;

      // ✅ CORREÇÃO: Super admin tem todas as permissões automaticamente
      const currentRole = roles.find(r => r.id === profile.role_id);
      if (currentRole?.name?.toLowerCase().includes('super admin')) {
        const superAdminPermissions: UserPermissions = {
          chat: true,
          ai: true,
          accounts: true,
          settings: true,
          analytics: true,
          users: true,
          administration: true,
          dashboard: true,
          automation: true,
          marketplace: true,
          advanced_settings: true,
          support: true,
          // Permissões específicas
          view_chat: true,
          manage_users: true,
          manage_accounts: true,
          manage_departments: true,
          manage_connections: true,
          manage_teams: true,
          use_ai_assistant: true,
          manage_flows: true,
          configure_prompts: true,
          access_ai_playground: true,
          manage_ai_credits: true,
          manage_agent_limits: true,
          manage_scheduling: true,
          view_attendance_report: true,
          view_conversation_report: true,
          export_reports: true,
          access_advanced_metrics: true,
          manage_rules: true,
          access_marketplace: true,
          define_permissions: true,
          manage_database: true,
          manage_google_integration: true,
          manage_organizations: true
        };

        setPermissions(superAdminPermissions);
        setInitialized(true);
        setLoading(false);
        fetchRef.current = false;
        return;
      }

      // ✅ CORREÇÃO: Para outros roles, usar as permissões da role
      if (profile.role_permissions && typeof profile.role_permissions === 'object') {
        setPermissions(profile.role_permissions as UserPermissions);
        setInitialized(true);
        setLoading(false);
        fetchRef.current = false;
        return;
      }

      // Fallback: buscar do backend se necessário
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/permissions/user-permissions`, {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-organization-id': profile.organization_id
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expirado ou inválido
          window.location.href = '/login';
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro na requisição');
      }

      const data = await response.json();
      setPermissions(data.permissions || {});
      setInitialized(true);

    } catch (err) {
      console.error('❌ [Permissions] Erro ao buscar permissões:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      
      // ✅ CORREÇÃO: Em caso de erro, dar permissões mínimas se for super admin
      const currentRole = roles.find(r => r.id === profile.role_id);
      if (currentRole?.name?.toLowerCase().includes('super admin')) {
        setPermissions({ dashboard: true, support: true });
        setInitialized(true);
      }
    } finally {
      setLoading(false);
      fetchRef.current = false;
    }
  }, [user, profile, roles]);

  // ✅ Efeito para carregar permissões quando user/profile mudar
  useEffect(() => {
    if (user && profile && !initialized && !fetchRef.current) {
      fetchPermissions();
    }
  }, [user, profile, fetchPermissions, initialized]);

  // ✅ Debug em desenvolvimento
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && initialized) {
      const currentRole = roles.find(r => r.id === profile?.role_id);
    }
  }, [initialized, permissions, user, profile, roles]);

  const clearCache = useCallback(() => {
    if (!user || !profile) return;
    permissionsCache.invalidate(user.id, profile.organization_id || 'default');
  }, [user, profile]);

  return {
    permissions: memoizedPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    loading,
    error,
    initialized,
    refetch: fetchPermissions,
    clearCache,
    cacheUsed
  };
}; 