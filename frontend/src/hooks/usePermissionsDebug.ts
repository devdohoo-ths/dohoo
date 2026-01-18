import { useEffect, useState } from 'react';
import { usePermissions } from './usePermissions';
import { useAuth } from './useAuth';
import { permissionsCache } from '@/utils/permissionsCache';

interface DebugInfo {
  authLoading: boolean;
  profileLoaded: boolean;
  permissionsLoaded: boolean;
  cacheHit: boolean;
  cacheStats: { memorySize: number; localStorageKeys: number };
  permissionsCount: number;
  loadingTime: number;
  errors: string[];
}

export const usePermissionsDebug = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { permissions, loading: permissionsLoading, initialized, error } = usePermissions();
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    authLoading: false,
    profileLoaded: false,
    permissionsLoaded: false,
    cacheHit: false,
    cacheStats: { memorySize: 0, localStorageKeys: 0 },
    permissionsCount: 0,
    loadingTime: 0,
    errors: []
  });

  useEffect(() => {
    const startTime = Date.now();
    
    // Verificar cache hit
    let cacheHit = false;
    if (user && profile) {
      const cachedData = permissionsCache.get(user.id, profile.organization_id || 'default');
      cacheHit = !!cachedData;
    }

    // Obter estatísticas do cache
    const cacheStats = permissionsCache.getStats();

    // Contar permissões
    const permissionsCount = Object.keys(permissions).length;

    // Coletar erros
    const errors: string[] = [];
    if (error) errors.push(error);

    setDebugInfo({
      authLoading,
      profileLoaded: !!profile,
      permissionsLoaded: initialized && !permissionsLoading,
      cacheHit,
      cacheStats,
      permissionsCount,
      loadingTime: Date.now() - startTime,
      errors
    });
  }, [authLoading, profile, permissionsLoading, initialized, permissions, error, user]);

  const logDebugInfo = () => {
    console.group('🔍 [PERMISSIONS DEBUG]');
    console.log('Auth Loading:', debugInfo.authLoading);
    console.log('Profile Loaded:', debugInfo.profileLoaded);
    console.log('Permissions Loaded:', debugInfo.permissionsLoaded);
    console.log('Cache Hit:', debugInfo.cacheHit);
    console.log('Cache Stats:', debugInfo.cacheStats);
    console.log('Permissions Count:', debugInfo.permissionsCount);
    console.log('Loading Time:', debugInfo.loadingTime + 'ms');
    if (debugInfo.errors.length > 0) {
      console.error('Errors:', debugInfo.errors);
    }
    console.groupEnd();
  };

  const clearCache = () => {
    permissionsCache.clear();
    console.log('🗑️ [DEBUG] Cache limpo');
  };

  const invalidateUserCache = () => {
    if (user && profile) {
      permissionsCache.invalidate(user.id, profile.organization_id || 'default');
      console.log('🗑️ [DEBUG] Cache do usuário invalidado');
    }
  };

  return {
    debugInfo,
    logDebugInfo,
    clearCache,
    invalidateUserCache
  };
}; 