import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, boolean>;
  is_default: boolean;
  organization_id: string | null; // null para roles globais
  created_at: string;
  updated_at: string;
}

// Cache simples para roles
const rolesCache = new Map<string, { roles: Role[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

export const useRoles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [globalRoles, setGlobalRoles] = useState<Role[]>([]);
  const [customRoles, setCustomRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🚀 Memoizar roles para evitar re-renders
  const memoizedRoles = useMemo(() => roles, [roles]);
  const memoizedGlobalRoles = useMemo(() => globalRoles, [globalRoles]);
  const memoizedCustomRoles = useMemo(() => customRoles, [customRoles]);

  // 🔄 Função para buscar roles com cache
  const fetchRoles = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      // Tentar cache primeiro (se não for force refresh)
      if (!forceRefresh) {
        const cached = rolesCache.get('roles');
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setRoles(cached.roles);
          setGlobalRoles(cached.roles.filter(role => role.organization_id === null));
          setCustomRoles(cached.roles.filter(role => role.organization_id !== null));
          setLoading(false);
          return;
        }
      }

      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/permissions/roles`, {
        headers
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar roles');
      }
      
      const rolesData = result.roles || [];
      const globalRolesData = result.globalRoles || [];
      const customRolesData = result.customRoles || [];
      
      // Salvar no cache
      rolesCache.set('roles', {
        roles: rolesData,
        timestamp: Date.now()
      });
      
      setRoles(rolesData);
      setGlobalRoles(globalRolesData);
      setCustomRoles(customRolesData);
    } catch (err: any) {
      console.error('❌ [ROLES] Erro ao buscar roles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔄 Função para criar role (apenas customizada)
  const createRole = useCallback(async (roleData: Omit<Role, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Garantir que a role seja customizada
      const customRoleData = {
        ...roleData,
        organization_id: roleData.organization_id || 'current' // Será substituído pelo backend
      };

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/permissions/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(customRoleData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar role');
      }
      
      // Invalidar cache e recarregar
      rolesCache.delete('roles');
      await fetchRoles(true);
      return result.role;
    } catch (err: any) {
      console.error('❌ [ROLES] Erro ao criar role:', err);
      throw err;
    }
  }, [fetchRoles]);

  // 🔄 Função para atualizar role (apenas customizada)
  const updateRole = useCallback(async (id: string, roleData: Partial<Role>) => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/permissions/roles/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(roleData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar role');
      }
      
      // Invalidar cache e recarregar
      rolesCache.delete('roles');
      await fetchRoles(true);
      return result.role;
    } catch (err: any) {
      console.error('❌ [ROLES] Erro ao atualizar role:', err);
      throw err;
    }
  }, [fetchRoles]);

  // 🔄 Função para deletar role (apenas customizada)
  const deleteRole = useCallback(async (id: string) => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/permissions/roles/${id}`, {
        method: 'DELETE',
        headers
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao deletar role');
      }
      
      // Invalidar cache e recarregar
      rolesCache.delete('roles');
      await fetchRoles(true);
      return result;
    } catch (err: any) {
      console.error('❌ [ROLES] Erro ao deletar role:', err);
      throw err;
    }
  }, [fetchRoles]);

  // 🔄 Função para invalidar cache
  const invalidateCache = useCallback(() => {
    rolesCache.delete('roles');
  }, []);

  // 🔄 Função para limpar cache
  const clearCache = useCallback(() => {
    rolesCache.clear();
  }, []);

  // 🔄 Função para verificar se uma role é global
  const isGlobalRole = useCallback((role: Role) => {
    return role.organization_id === null;
  }, []);

  // 🔄 Função para verificar se uma role é customizada
  const isCustomRole = useCallback((role: Role) => {
    return role.organization_id !== null;
  }, []);

  // 🔄 Função para obter role padrão
  const getDefaultRole = useCallback(() => {
    return roles.find(role => role.is_default) || null;
  }, [roles]);

  // 🔄 Efeito inicial para carregar roles
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    // Dados
    roles: memoizedRoles,
    globalRoles: memoizedGlobalRoles,
    customRoles: memoizedCustomRoles,
    
    // Estado
    loading,
    error,
    
    // Ações
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    invalidateCache,
    clearCache,
    isGlobalRole,
    isCustomRole,
    getDefaultRole
  };
}; 