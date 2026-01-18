import { useMemo } from 'react';
import { usePermissions } from './usePermissions';
import { useAuth } from './useAuth';

/**
 * Hook otimizado para verificação rápida de permissões
 * Usa cache de forma inteligente para evitar loading states desnecessários
 */
export const useQuickPermissions = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, initialized, cacheUsed } = usePermissions();
  const { profile, loading: authLoading } = useAuth();

  // 🚀 Verificação otimizada que prioriza cache
  const quickCheck = useMemo(() => {
    // Se ainda está carregando auth, aguardar
    if (authLoading || !profile) {
      return { ready: false, reason: 'auth_loading' };
    }

    // Super admin sempre pronto
    if (profile.user_role === 'super_admin') {
      return { ready: true, reason: 'super_admin' };
    }

    // Se cache foi usado, considerar pronto mesmo durante loading
    if (cacheUsed) {
      return { ready: true, reason: 'cache_ready' };
    }

    // Se inicializado e não está carregando, pronto
    if (initialized && !loading) {
      return { ready: true, reason: 'permissions_ready' };
    }

    // Se ainda não inicializado, aguardar
    if (!initialized) {
      return { ready: false, reason: 'not_initialized' };
    }

    // Se está carregando sem cache, aguardar
    if (loading) {
      return { ready: false, reason: 'permissions_loading' };
    }

    return { ready: true, reason: 'default' };
  }, [authLoading, profile, initialized, loading, cacheUsed]);

  // 🚀 Funções otimizadas que não mostram loading
  const quickHasPermission = useMemo(() => {
    return (permission: string): boolean => {
      if (!quickCheck.ready) return false;
      if (profile?.user_role === 'super_admin') return true;
      return hasPermission(permission, false); // Modo permissivo
    };
  }, [quickCheck.ready, profile, hasPermission]);

  const quickHasAnyPermission = useMemo(() => {
    return (permissionList: string[]): boolean => {
      if (!quickCheck.ready) return false;
      if (profile?.user_role === 'super_admin') return true;
      return hasAnyPermission(permissionList);
    };
  }, [quickCheck.ready, profile, hasAnyPermission]);

  const quickHasAllPermissions = useMemo(() => {
    return (permissionList: string[]): boolean => {
      if (!quickCheck.ready) return false;
      if (profile?.user_role === 'super_admin') return true;
      return hasAllPermissions(permissionList);
    };
  }, [quickCheck.ready, profile, hasAllPermissions]);

  return {
    ready: quickCheck.ready,
    reason: quickCheck.reason,
    hasPermission: quickHasPermission,
    hasAnyPermission: quickHasAnyPermission,
    hasAllPermissions: quickHasAllPermissions,
    loading: !quickCheck.ready,
    cacheUsed
  };
}; 