import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { Platform } from '@/types/connections';

export const useConnectionAuth = () => {
  console.log('=== useConnectionAuth chamado ===');
  
  const { user, profile } = useAuth();
  console.log('User from useAuth:', user);
  console.log('Profile from useAuth:', profile);

  const auth = useMemo(() => {
    console.log('=== Calculando auth ===');
    console.log('User:', user);
    console.log('Profile:', profile);

    if (!user || !profile) {
      console.log('Sem user ou profile, retornando auth padrão');
      return {
        isAuthenticated: false,
        isAdmin: false,
        isSuperAdmin: false,
        canCreate: () => false,
        canView: () => false,
        canEdit: () => false,
        canDelete: () => false,
        canManage: () => false,
        canViewAll: () => false,
        getPlatformPermissions: () => null
      };
    }

    const role = profile.user_role || 'agent';
    const platformPermissions = profile.platform_permissions || {};
    
    console.log('Role:', role);
    console.log('Platform permissions:', platformPermissions);

    const isAdmin = role === 'admin' || role === 'super_admin';
    const isSuperAdmin = role === 'super_admin';

    console.log('Is admin:', isAdmin);
    console.log('Is super admin:', isSuperAdmin);

    return {
      isAuthenticated: true,
      isAdmin,
      isSuperAdmin,
      canCreate: (platform: Platform) => {
        const canCreate = isSuperAdmin || 
          (isAdmin && platformPermissions[platform]?.create) ||
          (role === 'agent' && platformPermissions[platform]?.create);
        console.log(`canCreate(${platform}):`, canCreate);
        return canCreate;
      },
      canView: (platform: Platform) => {
        const canView = isSuperAdmin || 
          (isAdmin && platformPermissions[platform]?.view) ||
          (role === 'agent' && platformPermissions[platform]?.view);
        console.log(`canView(${platform}):`, canView);
        return canView;
      },
      canEdit: (platform: Platform) => {
        const canEdit = isSuperAdmin || 
          (isAdmin && platformPermissions[platform]?.edit) ||
          (role === 'agent' && platformPermissions[platform]?.edit);
        console.log(`canEdit(${platform}):`, canEdit);
        return canEdit;
      },
      canDelete: (platform: Platform) => {
        const canDelete = isSuperAdmin || 
          (isAdmin && platformPermissions[platform]?.delete) ||
          (role === 'agent' && platformPermissions[platform]?.delete);
        console.log(`canDelete(${platform}):`, canDelete);
        return canDelete;
      },
      canManage: (platform: Platform) => {
        const canManage = isSuperAdmin || 
          (isAdmin && platformPermissions[platform]?.manage) ||
          (role === 'agent' && platformPermissions[platform]?.manage);
        console.log(`canManage(${platform}):`, canManage);
        return canManage;
      },
      canViewAll: (platform: Platform) => {
        const canViewAll = isSuperAdmin || 
          (isAdmin && platformPermissions[platform]?.viewAll);
        console.log(`canViewAll(${platform}):`, canViewAll);
        return canViewAll;
      },
      getPlatformPermissions: (platform: Platform) => {
        const permissions = platformPermissions[platform] || {};
        console.log(`getPlatformPermissions(${platform}):`, permissions);
        return permissions;
      }
    };
  }, [user, profile]);

  console.log('=== useConnectionAuth retornando ===');
  console.log('Auth object:', auth);

  return auth;
};

// Hook auxiliar para verificar permissões específicas
export const usePlatformPermissions = (platform: Platform) => {
  const auth = useConnectionAuth();
  
  return {
    canView: auth.canView(platform),
    canViewAll: auth.canViewAll(platform),
    canCreate: auth.canCreate(platform),
    canManage: auth.canManage(platform),
    isAdmin: auth.isAdmin,
    isSuperAdmin: auth.isSuperAdmin,
    isAgent: auth.isSuperAdmin // Assuming isAgent is derived from isSuperAdmin
  };
};

// Hook para verificar se usuário pode ver uma conta específica
export const useCanViewAccount = (accountUserId: string, accountAssignedTo: string | null, platform: Platform) => {
  const auth = useConnectionAuth();
  const currentUserId = useAuth().user?.id;

  return useMemo(() => {
    // Super admin pode ver tudo
    if (auth.isSuperAdmin) return true;
    
    // Admin pode ver tudo se tiver permissão viewAll
    if (auth.isAdmin && auth.canViewAll(platform)) return true;
    
    // Usuário pode ver se for o dono ou responsável
    if (currentUserId === accountUserId || currentUserId === accountAssignedTo) return true;
    
    // Usuário pode ver se tiver permissão viewAll
    if (auth.canViewAll(platform)) return true;
    
    return false;
  }, [auth, currentUserId, accountUserId, accountAssignedTo, platform]);
};

// Hook para verificar se usuário pode editar uma conta específica
export const useCanEditAccount = (accountUserId: string, accountAssignedTo: string | null, platform: Platform) => {
  const auth = useConnectionAuth();
  const currentUserId = useAuth().user?.id;

  return useMemo(() => {
    // Super admin pode editar tudo
    if (auth.isSuperAdmin) return true;
    
    // Admin pode editar se tiver permissão manage
    if (auth.isAdmin && auth.canManage(platform)) return true;
    
    // Usuário pode editar se for o dono ou responsável
    if (currentUserId === accountUserId || currentUserId === accountAssignedTo) return true;
    
    return false;
  }, [auth, currentUserId, accountUserId, accountAssignedTo, platform]);
};

// Hook para verificar se usuário pode deletar uma conta específica
export const useCanDeleteAccount = (platform: Platform) => {
  const auth = useConnectionAuth();

  return useMemo(() => {
    // Apenas admins podem deletar
    return auth.isAdmin && auth.canManage(platform);
  }, [auth, platform]);
}; 