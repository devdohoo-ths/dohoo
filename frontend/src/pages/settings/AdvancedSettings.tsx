import React from 'react';
import PermissionsManager from '@/components/settings/PermissionsManager';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Shield, Crown, UserCheck } from 'lucide-react';

const AdvancedSettings: React.FC = () => {
  const { profile, loading: authLoading, initialized: authInitialized } = useAuth();
  const { hasPermission, loading: permissionsLoading, initialized: permissionsInitialized } = usePermissions();

  // ✅ CORREÇÃO: Verificar permissões reais do banco em vez de hardcode
  // Verificar se tem permissão para gerenciar permissões/settings
  const canAccess = React.useMemo(() => {
    // Debug: log das permissões
    console.log('🔍 [AdvancedSettings] Verificando permissões:', {
      role_permissions: profile?.role_permissions,
      role_name: profile?.role_name,
      roles_name: profile?.roles?.name,
      hasPermission_manage_permissions: hasPermission('manage_permissions'),
      hasPermission_define_permissions: hasPermission('define_permissions'),
      hasPermission_settings: hasPermission('settings.managePermissions')
    });
    
    // Verificar permissões específicas do banco
    if (profile?.role_permissions && typeof profile.role_permissions === 'object') {
      const rolePerms = profile.role_permissions as Record<string, any>;
      
      // ✅ CORREÇÃO: Verificar estrutura simples do banco (settings: true)
      if (rolePerms.settings === true) {
        console.log('✅ [AdvancedSettings] Acesso permitido via settings: true');
        return true;
      }
      
      // ✅ CORREÇÃO: Verificar estrutura aninhada (administration.define_permissions)
      if (rolePerms.administration && typeof rolePerms.administration === 'object') {
        if (rolePerms.administration.define_permissions === true) {
          console.log('✅ [AdvancedSettings] Acesso permitido via administration.define_permissions');
          return true;
        }
      }
      
      // ✅ CORREÇÃO: Verificar estrutura aninhada (advanced_settings.define_permissions)
      if (rolePerms.advanced_settings && typeof rolePerms.advanced_settings === 'object') {
        if (rolePerms.advanced_settings.define_permissions === true) {
          console.log('✅ [AdvancedSettings] Acesso permitido via advanced_settings.define_permissions');
          return true;
        }
      }
      
      // Verificar se tem permissão em settings.managePermissions ou settings.manage_permissions
      if (rolePerms.settings && typeof rolePerms.settings === 'object' && rolePerms.settings !== null) {
        const settingsPerms = rolePerms.settings;
        if (settingsPerms.managePermissions === true || 
            settingsPerms.manage_permissions === true ||
            settingsPerms.edit === true) {
          console.log('✅ [AdvancedSettings] Acesso permitido via settings.managePermissions');
          return true;
        }
      }
      
      // Verificar se tem permissão direta (estrutura simples)
      if (rolePerms.manage_permissions === true || 
          rolePerms.managePermissions === true ||
          rolePerms.define_permissions === true ||
          rolePerms.manage_roles === true) {
        console.log('✅ [AdvancedSettings] Acesso permitido via permissão direta');
        return true;
      }
    }
    
    // Fallback: usar hook de permissões (que agora verifica todas as estruturas)
    const hasAccessViaHook = hasPermission('define_permissions') ||
           hasPermission('administration.define_permissions') ||
           hasPermission('advanced_settings.define_permissions') ||
           hasPermission('manage_permissions') || 
           hasPermission('managePermissions') || 
           hasPermission('settings.managePermissions') ||
           hasPermission('settings.manage_permissions');
    
    console.log('🔍 [AdvancedSettings] Resultado final:', hasAccessViaHook);
    return hasAccessViaHook;
  }, [profile, hasPermission]);

  // 🎯 DETERMINAR NÍVEL DO USUÁRIO (apenas para exibição)
  const userLevel = React.useMemo(() => {
    if (!profile?.roles?.name && !profile?.role_name) return 'agent';
    
    // Tentar pegar de roles.name primeiro, depois role_name
    const roleName = profile.roles?.name || profile.role_name;
    if (!roleName) return 'agent';
    
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    return roleMapping[roleName as keyof typeof roleMapping] || 'agent';
  }, [profile]);

  // ✅ CORREÇÃO: Aguardar carregamento antes de verificar permissões
  if (!authInitialized || authLoading || !permissionsInitialized || permissionsLoading) {
    return (
      <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
        <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
        <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl text-red-600 mb-4">Acesso Negado</h1>
            <p className="text-gray-600 mb-2">
              Você não tem permissão para acessar as Gestão de Permissões.
            </p>
            <p className="text-sm text-gray-500">
              Apenas Administradores e Super Administradores podem acessar esta área.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <UserCheck className="w-4 h-4" />
              <span>Seu nível: {userLevel === 'super_admin' ? 'Super Admin' : userLevel === 'admin' ? 'Admin' : 'Usuário'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
      <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
        {/* 🎯 HEADER COM NÍVEL DO USUÁRIO */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <UserCheck className="w-4 h-4" />
            <span>Nível: {userLevel === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
            {userLevel === 'super_admin' && (
              <Crown className="w-4 h-4 text-yellow-500" />
            )}
          </div>
        </div>

        {/* Conteúdo da Gestão de Permissões */}
        <PermissionsManager />
      </div>
    </div>
  );
};

export default AdvancedSettings; 