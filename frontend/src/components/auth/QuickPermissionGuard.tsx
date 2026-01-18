import React, { useMemo } from 'react';
import { useQuickPermissions } from '@/hooks/useQuickPermissions';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface QuickPermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  anyPermission?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
  showAlert?: boolean;
  loadingComponent?: React.ReactNode;
  // Nova prop para controlar se deve mostrar loading
  showLoading?: boolean;
}

export const QuickPermissionGuard: React.FC<QuickPermissionGuardProps> = ({
  children,
  requiredPermissions = [],
  anyPermission = [],
  allPermissions = [],
  fallback,
  showAlert = true,
  loadingComponent,
  showLoading = false // Por padrão, não mostra loading
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, ready, loading, cacheUsed } = useQuickPermissions();
  const { profile, loading: authLoading } = useAuth();

  // 🚀 Verificação otimizada que prioriza cache
  const accessCheck = useMemo(() => {
    // Se ainda está carregando o auth OU se o profile não foi carregado ainda
    if (authLoading || !profile) {
      return { hasAccess: false, reason: 'auth_loading' };
    }
    
    // Super admin sempre tem acesso imediatamente
    if (profile.user_role === 'super_admin') {
      return { hasAccess: true, reason: 'super_admin' };
    }

    // Se não há permissões requeridas, mostra o conteúdo
    if (requiredPermissions.length === 0 && anyPermission.length === 0 && allPermissions.length === 0) {
      return { hasAccess: true, reason: 'no_requirements' };
    }

    // Se não está pronto, verificar se deve mostrar loading
    if (!ready) {
      // Se cache foi usado, permitir acesso mesmo durante loading
      if (cacheUsed) {
        console.log('⚡ [QUICK_PERMISSIONS] Cache usado, permitindo acesso');
        return { hasAccess: true, reason: 'cache_used' };
      }
      
      // Se não deve mostrar loading, permitir acesso
      if (!showLoading) {
        console.log('⚡ [QUICK_PERMISSIONS] Loading desabilitado, permitindo acesso');
        return { hasAccess: true, reason: 'loading_disabled' };
      }
      
      return { hasAccess: false, reason: 'not_ready' };
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

    return { hasAccess, reason };
  }, [
    authLoading, 
    profile, 
    ready, 
    loading, 
    cacheUsed,
    showLoading,
    requiredPermissions, 
    anyPermission, 
    allPermissions, 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions
  ]);

  // 🚀 Loading component otimizado
  const LoadingComponent = useMemo(() => {
    if (loadingComponent) {
      return loadingComponent;
    }

    // Se cache foi usado, mostrar loading mais discreto
    if (cacheUsed) {
      return (
        <div className="flex items-center justify-center min-h-[50px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mx-auto"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[100px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto mb-2"></div>
          <p className="text-xs text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }, [loadingComponent, cacheUsed]);

  // 🚀 Componente de acesso negado
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
    if (accessCheck.reason === 'auth_loading' || accessCheck.reason === 'not_ready') {
      return LoadingComponent;
    }
    return AccessDeniedComponent;
  }

  return <>{children}</>;
}; 