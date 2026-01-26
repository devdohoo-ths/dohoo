import React, { useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  anyPermission?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
  showAlert?: boolean;
  loadingComponent?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermissions = [],
  anyPermission = [],
  allPermissions = [],
  fallback,
  showAlert = true,
  loadingComponent
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, permissions, initialized, cacheUsed } = usePermissions();
  const { profile, loading: authLoading } = useAuth();

  // 🚀 Memoizar verificações de permissão para performance
  const accessCheck = useMemo(() => {
    // Se ainda está carregando o auth OU se o profile não foi carregado ainda
    if (authLoading || !profile) {
      return { hasAccess: false, reason: 'auth_loading' };
    }
    
    // ✅ CORREÇÃO: Verificar permissões do banco em vez de hardcode
    // Se o profile tem role_permissions e todas as permissões estão como true,
    // ou se tem uma permissão especial que indica acesso total, permitir acesso
    // Mas isso deve ser verificado através das permissões reais, não hardcode

    // Se não há permissões requeridas, mostra o conteúdo
    if (requiredPermissions.length === 0 && anyPermission.length === 0 && allPermissions.length === 0) {
      return { hasAccess: true, reason: 'no_requirements' };
    }

    // Se ainda não foi inicializado, aguardar
    if (!initialized) {
      return { hasAccess: false, reason: 'not_initialized' };
    }

    // 🚀 OTIMIZAÇÃO: Se cache foi usado, não mostrar loading
    if (loading && cacheUsed) {
      // Se temos cache mas ainda está "carregando", provavelmente é um estado transitório
      // Vamos permitir acesso baseado nas permissões já carregadas
      console.log('⚡ [PERMISSIONS] Cache usado, permitindo acesso durante loading');
      return { hasAccess: true, reason: 'cache_used' };
    }

    // Se ainda está carregando permissões (sem cache), aguardar
    if (loading) {
      return { hasAccess: false, reason: 'permissions_loading' };
    }

    // Verificar permissões
    let hasAccess = true;
    let reason = 'granted';

    // Verificar permissão específica
    if (requiredPermissions.length > 0) {
      hasAccess = requiredPermissions.every(permission => hasPermission(permission));
      if (!hasAccess) {
        reason = 'required_permissions_missing';
      }
    }

    // Verificar se tem pelo menos uma das permissões
    if (hasAccess && anyPermission.length > 0) {
      hasAccess = hasAnyPermission(anyPermission);
      if (!hasAccess) {
        reason = 'any_permissions_missing';
      }
    }

    // Verificar se tem todas as permissões
    if (hasAccess && allPermissions.length > 0) {
      hasAccess = hasAllPermissions(allPermissions);
      if (!hasAccess) {
        reason = 'all_permissions_missing';
      }
    }

    // Debug para Advanced Settings
    if (requiredPermissions.includes('define_permissions')) {
      console.log('🔍 [PERMISSION_GUARD] Advanced Settings - Permissões requeridas:', requiredPermissions);
      console.log('🔍 [PERMISSION_GUARD] Advanced Settings - Tem define_permissions:', hasPermission('define_permissions'));
      console.log('🔍 [PERMISSION_GUARD] Advanced Settings - Acesso:', hasAccess, 'Razão:', reason);
    }

    return { hasAccess, reason };
  }, [
    authLoading, 
    profile, 
    initialized, 
    loading, 
    cacheUsed,
    requiredPermissions, 
    anyPermission, 
    allPermissions, 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions
  ]);

  // 🚀 Memoizar componente de loading
  const LoadingComponent = useMemo(() => {
    if (loadingComponent) {
      return loadingComponent;
    }

    // Se cache foi usado, mostrar loading mais discreto
    if (cacheUsed) {
      return (
        <div className="flex items-center justify-center min-h-[100px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto mb-2"></div>
            <p className="text-xs text-muted-foreground">Verificando...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">
            {accessCheck.reason === 'auth_loading' ? 'Verificando autenticação...' : 'Carregando permissões...'}
          </p>
        </div>
      </div>
    );
  }, [loadingComponent, accessCheck.reason, cacheUsed]);

  // 🚀 Memoizar componente de acesso negado
  const AccessDeniedComponent = useMemo(() => {
    if (fallback) {
      return fallback;
    }

    if (!showAlert) {
      return null;
    }

    const getErrorMessage = (reason: string) => {
      switch (reason) {
        case 'required_permissions_missing':
          return 'Você não tem as permissões necessárias para acessar este recurso.';
        case 'any_permissions_missing':
          return 'Você precisa de pelo menos uma das permissões necessárias.';
        case 'all_permissions_missing':
          return 'Você precisa de todas as permissões necessárias.';
        default:
          return 'Acesso negado. Verifique suas permissões.';
      }
    };

    return (
      <Alert variant="destructive" className="max-w-md mx-auto mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {getErrorMessage(accessCheck.reason)}
        </AlertDescription>
      </Alert>
    );
  }, [fallback, showAlert, accessCheck.reason]);

  // Renderizar baseado no estado de acesso
  if (!accessCheck.hasAccess) {
    if (accessCheck.reason === 'auth_loading' || accessCheck.reason === 'permissions_loading' || accessCheck.reason === 'not_initialized') {
      return LoadingComponent;
    }
    return AccessDeniedComponent;
  }

  return <>{children}</>;
}; 