import { Role } from '@/hooks/useRoles';

export function getAvailableRoles(
  roles: Role[], 
  profileRoleId?: string
): Role[] {
  if (!roles || !profileRoleId) return [];
  
  // Buscar a role do usuário atual na tabela roles pelo ID
  const currentUserRole = roles.find(role => role.id === profileRoleId);
  if (!currentUserRole) return [];
  
  const userRoleName = currentUserRole.name?.toLowerCase();
  
  return roles.filter(role => {
    const roleName = role.name?.toLowerCase();
    
    // Agentes não podem ver nenhuma role
    if (userRoleName?.includes('agent') || userRoleName?.includes('agente')) {
      return false;
    }
    
    // Admins não podem ver roles de super admin
    if (userRoleName?.includes('admin') && !userRoleName?.includes('super') && 
        (roleName?.includes('super') || roleName?.includes('super_admin'))) {
      return false;
    }
    
    return true;
  });
}

export function getDefaultRole(roles: Role[]): Role | null {
  return roles.find(role => role.is_default) || null;
}

export function getRoleById(roles: Role[], roleId: string): Role | undefined {
  return roles.find(role => role.id === roleId);
}

export function getRolePermissionsText(role: Role): string {
  const permissions = Object.entries(role.permissions)
    .filter(([_, enabled]) => enabled)
    .map(([key, _]) => key)
    .join(', ');
  return permissions || 'Nenhuma';
}

export function canUserCreateUsers(
  roles: Role[], 
  profileRoleId?: string
): boolean {
  if (!roles || !profileRoleId) return false;
  
  // Buscar a role do usuário atual na tabela roles pelo ID
  const currentUserRole = roles.find(role => role.id === profileRoleId);
  if (!currentUserRole) return false;
  
  const userRoleName = currentUserRole.name?.toLowerCase();
  
  // Agentes não podem criar usuários
  return !(userRoleName?.includes('agent') || userRoleName?.includes('agente'));
}

export function getUserRoleDisplayName(roleName: string): string {
  const lowerRole = roleName.toLowerCase();
  
  if (lowerRole.includes('super') || lowerRole.includes('super_admin')) {
    return 'Super Admin';
  } else if (lowerRole.includes('admin')) {
    return 'Admin';
  } else if (lowerRole.includes('agent') || lowerRole.includes('agente')) {
    return 'Agente';
  }
  
  return roleName;
}