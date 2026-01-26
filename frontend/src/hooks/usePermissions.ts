import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
// ✅ CORREÇÃO: Usar o hook correto do AuthProvider
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from './useRoles';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { permissionsCache } from '@/utils/permissionsCache';

export interface UserPermissions {
  chat?: boolean | Record<string, boolean>;
  ai?: boolean | Record<string, boolean>;
  accounts?: boolean | Record<string, boolean>;
  settings?: boolean | Record<string, boolean>;
  analytics?: boolean | Record<string, boolean>;
  users?: boolean | Record<string, boolean>;
  administration?: boolean | Record<string, boolean>;
  dashboard?: boolean | Record<string, boolean>;
  automation?: boolean | Record<string, boolean>;
  marketplace?: boolean | Record<string, boolean>;
  advanced_settings?: boolean | Record<string, boolean>;
  support?: boolean | Record<string, boolean>;
  [key: string]: boolean | Record<string, boolean> | undefined;
}

export const usePermissions = () => {
  // ✅ CORREÇÃO: Usar o hook correto
  const { user, profile } = useAuth();
  const { roles } = useRoles();
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef<boolean>(false);
  const [cacheUsed, setCacheUsed] = useState(false);

  // 🚀 Memoizar permissões para evitar re-renders desnecessários
  const memoizedPermissions = useMemo(() => permissions, [permissions]);

  // 🚀 Memoizar funções de verificação para performance
  const hasPermission = useCallback((permission: string, conservative: boolean = false): boolean => {
    if (!user || !profile) {
      return false;
    }
    
    // ✅ REMOVIDO: Verificação fixa de Super Admin
    // ✅ Super Admin agora é apenas uma role no banco, sem tratamento especial
    // ✅ As permissões do Super Admin devem estar configuradas no banco de dados
    
    // Se ainda não foi inicializado, retorna false (modo conservador)
    if (!initialized) {
      return false;
    }
    
    // Se ainda está carregando, comportamento depende do modo
    if (loading) {
      if (conservative) {
        return false; // Modo conservador: não mostra nada durante loading
      } else {
        return true; // Modo permissivo: mostra durante loading
      }
    }
    
    // ✅ MAPEAMENTO: Converter permissões do Sidebar para permissões do banco (default_roles)
    // O banco usa estrutura simples: { "chat": true, "analytics": true, "users": true, etc. }
    const permissionMapping: Record<string, string[]> = {
      // Dashboard e Analytics
      'view_dashboard': ['analytics', 'dashboard'],
      'view_attendance_report': ['analytics', 'reports'],
      'view_conversation_report': ['analytics', 'reports'],
      'export_reports': ['analytics', 'reports'],
      'access_advanced_metrics': ['analytics'],
      'view_geographic_heatmap': ['analytics', 'reports'],
      
      // Chat
      'view_chat': ['chat'],
      'view_history': ['chat'],
      'send_messages': ['chat'],
      'reply_messages': ['chat'],
      'manage_conversations': ['chat'],
      'configure_automations': ['chat'],
      
      // Usuários e Administração
      'manage_users': ['users'],
      'manage_accounts': ['users', 'settings'],
      'manage_organizations': ['organizations', 'manage_all_organizations'],
      'super_admin': ['system_settings', 'manage_all_organizations'], // Verifica se tem permissões de super admin
      
      // Regras e Blacklist
      'manage_rules': ['manage_rules'],
      'view_rules_report': ['manage_rules', 'reports'],
      
      // Blacklist
      'manage_blacklist': ['manage_blacklist'],
      
      // Departamentos
      'manage_departments': ['manage_departments'],
      
      // Permissões
      'manage_roles': ['manage_roles'],
      'define_permissions': ['manage_roles', 'system_settings'],
      
      // Configurações
      'manage_google_integration': ['settings', 'system_settings'],
      'access_logs': ['settings', 'system_settings'],
      'manage_database': ['database', 'system_settings'],
      
      // IA
      'use_ai_assistant': ['ai'],
      'access_ai_playground': ['ai'],
      'manage_agent_limits': ['ai', 'users'],
      'manage_scheduling': ['ai', 'settings'],
      
      // Campanhas
      'access_campaigns': ['users', 'settings'],
      'access_contacts': ['users'],
      
      // Marketplace
      'access_marketplace': ['settings'],
      'configure_integrations': ['settings'],
    };
    
    // ✅ CORREÇÃO: Usar as permissões da role do profile (profile.role_permissions)
    // Primeiro verificar em role_permissions (vem direto do banco)
    if (profile.role_permissions && typeof profile.role_permissions === 'object') {
      const rolePermissions = profile.role_permissions as Record<string, any>;
      
      // Verificar se é "super_admin" - verifica se tem todas as permissões principais
      if (permission === 'super_admin') {
        const superAdminPerms = ['system_settings', 'manage_all_organizations', 'database'];
        const hasSuperAdminPerms = superAdminPerms.some(perm => rolePermissions[perm] === true);
        // Também verifica pelo nome da role
        const roleName = profile.role_name || profile.roles?.name || '';
        if (roleName.toLowerCase().includes('super admin') || roleName.toLowerCase() === 'superadmin') {
          return true;
        }
        return hasSuperAdminPerms;
      }
      
      // 1. Verificar se a permissão existe diretamente como true
      // Exemplo: "settings": true ou "define_permissions": true
      if (rolePermissions[permission] === true) {
        return true;
      }
      
      // 2. Verificar mapeamento de permissões do Sidebar para permissões do banco
      if (permissionMapping[permission]) {
        const mappedPerms = permissionMapping[permission];
        // Se qualquer uma das permissões mapeadas estiver como true, permite
        if (mappedPerms.some(mappedPerm => rolePermissions[mappedPerm] === true)) {
          return true;
        }
      }
      
      // 3. Verificar estrutura aninhada: module.subPermission
      // Exemplo: "administration.define_permissions" ou "advanced_settings.define_permissions"
      if (permission.includes('.')) {
        const [moduleKey, subPermission] = permission.split('.');
        if (rolePermissions[moduleKey] && typeof rolePermissions[moduleKey] === 'object') {
          const module = rolePermissions[moduleKey];
          if (module[subPermission] === true) {
            return true;
          }
        }
      }
      
      // 4. Verificar se a permissão existe dentro de qualquer módulo
      // Exemplo: procurar "define_permissions" em "administration" ou "advanced_settings"
      const moduleKeys = Object.keys(rolePermissions);
      for (const moduleKey of moduleKeys) {
        const module = rolePermissions[moduleKey];
        if (typeof module === 'object' && module !== null && !Array.isArray(module)) {
          // Verificar se o módulo tem a permissão específica
          if (module[permission] === true) {
            return true;
          }
        }
      }
      
      // 5. Verificar se o módulo inteiro está como true (estrutura simples)
      // Exemplo: "settings": true significa acesso total a settings
      // Se estamos procurando por "settings.managePermissions" e "settings": true, permitir
      if (permission.includes('.')) {
        const [moduleKey] = permission.split('.');
        if (rolePermissions[moduleKey] === true) {
          return true; // Módulo inteiro tem acesso total
        }
      }
    }
    
    // Verificar se a permissão existe diretamente em memoizedPermissions
    if (memoizedPermissions[permission] === true) {
      return true;
    }
    
      // Verificar se a permissão existe dentro de um módulo em memoizedPermissions
      const moduleKeys = Object.keys(memoizedPermissions);
      for (const moduleKey of moduleKeys) {
        const module = memoizedPermissions[moduleKey];
        
        // Se o módulo inteiro está como true, permite qualquer sub-permissão desse módulo
        if (module === true && permission.startsWith(moduleKey + '.')) {
          return true;
        }
        
        if (typeof module === 'object' && module && module !== null) {
          // Verificar se o módulo tem a permissão específica diretamente
          if (module[permission] === true) {
            return true;
          }
          
          // Verificar estrutura aninhada: module.subPermission
          if (permission.includes('.') && permission.startsWith(moduleKey + '.')) {
            const subPermission = permission.split('.').slice(1).join('.');
            // Verificar caminho completo: administration.define_permissions
            const pathParts = subPermission.split('.');
            let current = module;
            for (const part of pathParts) {
              if (current && typeof current === 'object' && current[part] === true) {
                return true;
              }
              if (current && typeof current === 'object') {
                current = current[part];
              } else {
                break;
              }
            }
          }
        }
      }
      
      return false;
  }, [user, profile, initialized, loading, memoizedPermissions, roles]);

  const hasAnyPermission = useCallback((permissionList: string[]): boolean => {
    if (!user || !profile) return false;
    
    // ✅ CORREÇÃO: Verificar permissões do banco em vez de hardcode
    // Se o profile tem role_permissions e todas as permissões estão como true,
    // isso indica acesso total (Super Admin configurado corretamente no banco)
    if (profile.role_permissions && typeof profile.role_permissions === 'object') {
      const rolePerms = profile.role_permissions as Record<string, any>;
      // Verificar se todas as permissões principais estão como true
      const allMainPermissions = ['dashboard', 'chat', 'analytics', 'users', 'settings', 'ai'];
      const hasAllMainPermissions = allMainPermissions.every(key => {
        const perm = rolePerms[key];
        return perm === true || (typeof perm === 'object' && perm?.view === true);
      });
      if (hasAllMainPermissions) {
        return true; // Super Admin configurado corretamente no banco
      }
    }
    
    if (!initialized) return false;
    if (loading) return true;
    
    return permissionList.some(permission => hasPermission(permission));
  }, [user, profile, initialized, loading, hasPermission]);

  const hasAllPermissions = useCallback((permissionList: string[]): boolean => {
    if (!user || !profile) return false;
    
    // ✅ CORREÇÃO: Verificar permissões do banco em vez de hardcode
    // Se o profile tem role_permissions e todas as permissões estão como true,
    // isso indica acesso total (Super Admin configurado corretamente no banco)
    if (profile.role_permissions && typeof profile.role_permissions === 'object') {
      const rolePerms = profile.role_permissions as Record<string, any>;
      // Verificar se todas as permissões principais estão como true
      const allMainPermissions = ['dashboard', 'chat', 'analytics', 'users', 'settings', 'ai'];
      const hasAllMainPermissions = allMainPermissions.every(key => {
        const perm = rolePerms[key];
        return perm === true || (typeof perm === 'object' && perm?.view === true);
      });
      if (hasAllMainPermissions) {
        return true; // Super Admin configurado corretamente no banco
      }
    }
    
    if (!initialized) return false;
    if (loading) return true;
    
    return permissionList.every(permission => hasPermission(permission));
  }, [user, profile, initialized, loading, hasPermission]);

  // ✅ CORREÇÃO: Função para buscar permissões atualizada
  const fetchPermissions = useCallback(async () => {
    if (!user || !profile || fetchRef.current) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      fetchRef.current = true;

      // ✅ REMOVIDO: Código fixo de Super Admin - agora tudo vem do banco
      // ✅ As permissões do Super Admin devem estar configuradas no banco de dados

      // ✅ CORREÇÃO: Para outros roles, usar as permissões da role
      if (profile.role_permissions && typeof profile.role_permissions === 'object') {
        setPermissions(profile.role_permissions as UserPermissions);
        setInitialized(true);
        setLoading(false);
        fetchRef.current = false;
        return;
      }

      // Fallback: buscar do backend se necessário
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/permissions/user-permissions`, {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-organization-id': profile.organization_id
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expirado ou inválido
          window.location.href = '/login';
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro na requisição');
      }

      const data = await response.json();
      setPermissions(data.permissions || {});
      setInitialized(true);

    } catch (err) {
      console.error('❌ [Permissions] Erro ao buscar permissões:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      
      // ✅ CORREÇÃO: Em caso de erro, dar permissões mínimas se for super admin
      const currentRole = roles.find(r => r.id === profile.role_id);
      if (currentRole?.name?.toLowerCase().includes('super admin')) {
        setPermissions({ dashboard: true, support: true });
        setInitialized(true);
      }
    } finally {
      setLoading(false);
      fetchRef.current = false;
    }
  }, [user, profile, roles]);

  // ✅ Efeito para carregar permissões quando user/profile mudar
  useEffect(() => {
    if (user && profile && !initialized && !fetchRef.current) {
      fetchPermissions();
    }
  }, [user, profile, fetchPermissions, initialized]);

  // ✅ Debug em desenvolvimento
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && initialized) {
      const currentRole = roles.find(r => r.id === profile?.role_id);
    }
  }, [initialized, permissions, user, profile, roles]);

  const clearCache = useCallback(() => {
    if (!user || !profile) return;
    permissionsCache.invalidate(user.id, profile.organization_id || 'default');
  }, [user, profile]);

  return {
    permissions: memoizedPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    loading,
    error,
    initialized,
    refetch: fetchPermissions,
    clearCache,
    cacheUsed
  };
}; 