import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';

export const DebugModal = () => {
  const { profile } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();

  const getAvailableRoles = () => {
    if (!roles || !profile?.role_id) return [];
    
    // Buscar a role do usuário atual na tabela roles pelo ID
    const currentUserRole = roles.find(role => role.id === profile.role_id);
    const userRoleName = currentUserRole?.name?.toLowerCase();
    
    console.log('🔍 Debug - Current user role ID:', profile.role_id);
    console.log('🔍 Debug - Current user role name:', userRoleName);
    console.log('🔍 Debug - Available roles:', roles);
    
    return roles.filter(role => {
      const roleName = role.name?.toLowerCase();
      
      // Agentes não podem ver nenhuma role
      if (userRoleName?.includes('agent') || userRoleName?.includes('agente')) {
        console.log('❌ User is agent, blocking modal');
        return false;
      }
      
      // Admins não podem ver roles de super admin
      if (userRoleName?.includes('admin') && !userRoleName?.includes('super') && 
          (roleName?.includes('super') || roleName?.includes('super_admin'))) {
        return false;
      }
      
      return true;
    });
  };

  React.useEffect(() => {
    const currentUserRole = roles.find(role => role.id === profile?.role_id);
    console.log('🔍 DEBUG INFO:', {
      profile,
      userRoleId: profile?.role_id,
      userRoleName: currentUserRole?.name,
      roles,
      rolesLoading,
      availableRoles: getAvailableRoles()
    });
  }, [profile, roles, rolesLoading]);

  return null;
}; 