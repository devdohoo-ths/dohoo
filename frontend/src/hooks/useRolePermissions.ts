import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface RolePermissions {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
}

export const useRolePermissions = (roleId?: string) => {
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roleId) {
      setRolePermissions(null);
      return;
    }

    const fetchRolePermissions = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${apiBase}/api/permissions/roles/${roleId}`, {
          headers
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ [RolePermissions] Erro ao buscar role:', errorData.error || `Erro ${response.status}`);
          setRolePermissions(null);
          return;
        }

        const data = await response.json();
        
        if (data.success && data.role) {
          setRolePermissions({
            id: data.role.id,
            name: data.role.name,
            permissions: data.role.permissions || {}
          });
        } else {
          setRolePermissions(null);
        }
      } catch (error) {
        console.error('❌ [RolePermissions] Erro inesperado:', error);
        setRolePermissions(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRolePermissions();
  }, [roleId]);

  const isAdmin = rolePermissions?.name === 'Admin' || rolePermissions?.name === 'Super Admin';
  const isSuperAdmin = rolePermissions?.name === 'Super Admin';

  return {
    rolePermissions,
    loading,
    isAdmin,
    isSuperAdmin,
    roleName: rolePermissions?.name
  };
};
