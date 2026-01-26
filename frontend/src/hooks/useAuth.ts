import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import type { Tables } from '@/integrations/supabase/types';

// Tipos locais (mantém compatibilidade)
type User = {
  id: string;
  email?: string;
  [key: string]: any;
};

type Profile = Tables<'profiles'> & {
  roles?: {
    id: string;
    name: string;
    description?: string;
    permissions?: any;
  };
  role_name?: string | null; // Nome da role (vem do backend)
  role_permissions?: Record<string, any>; // Permissões da role (vem do backend)
  organization?: {
    id: string;
    name: string;
    status?: string;
  };
};

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean; // ✅ ADICIONADO: Flag para controlar inicialização
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    initialized: false // ✅ ADICIONADO: Começa como false
  });

  const { toast } = useToast();

  // 🎯 FUNÇÃO PARA DETERMINAR USER_ROLE BASEADO NO ROLE_NAME (agora vem do profile)
  const determineUserRole = useCallback((roleName: string | null | undefined) => {
    if (!roleName) return 'agent';
    
    // Mapear nome da role para user_role
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    return roleMapping[roleName as keyof typeof roleMapping] || 'agent';
  }, []);

  const fetchProfile = useCallback(async (userId?: string) => {
    try {
      // Buscar perfil via backend
      let headers;
      try {
        headers = await getAuthHeaders();
      } catch (headerError: any) {
        // Se não conseguir obter headers, usar token do localStorage
        const storedSession = localStorage.getItem('auth_session');
        if (storedSession) {
          const session = JSON.parse(storedSession);
          headers = {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          };
        } else {
          throw new Error('Nenhuma sessão encontrada');
        }
      }
      
      let response;
      try {
        response = await fetch(`${apiBase}/api/auth/profile`, { headers });
      } catch (fetchError: any) {
        // Erro de conexão (backend não disponível) - silencioso
        return null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Token inválido, limpar e redirecionar
          localStorage.removeItem('auth_session');
          localStorage.removeItem('user_data');
          return null;
        }
        // Para outros erros, retornar null (não lançar erro)
        return null;
      }

      const responseData = await response.json();
      const { profile } = responseData;

      if (!profile) {
        return null;
      }

      // 🎯 DETERMINAR USER_ROLE BASEADO NO ROLE_NAME
      const userRole = determineUserRole(profile.role_name);
      
      // Adicionar user_role ao profile para compatibilidade
      const profileWithUserRole = {
        ...profile,
        user_role: userRole
      };
      
      setAuthState(prev => ({ ...prev, profile: profileWithUserRole }));
      return profileWithUserRole;
    } catch (err) {
      // Erro silencioso - retornar null
      return null;
    }
  }, [determineUserRole]);

  // 🚀 Memoiza usuário e autenticação para evitar rerenders desnecessários
  const memoizedUser = useMemo(() => {
    return authState.user;
  }, [authState.user?.id]);
  
  const isAuthenticated = useMemo(() => {
    const authenticated = !!authState.user?.id;
    return authenticated;
  }, [authState.user?.id]);

  // ✅ Verificação inicial via backend
  useEffect(() => {
    let mounted = true;
    
    const checkInitialAuth = async () => {
      try {
        // Verificar se existe sessão no localStorage
        const storedSession = localStorage.getItem('auth_session');
        const storedUserData = localStorage.getItem('user_data');
        
        if (!storedSession || !storedUserData) {
          // Não há sessão - usuário não está logado, simplesmente marcar como inicializado
          if (mounted) {
            setAuthState({ user: null, profile: null, loading: false, initialized: true });
          }
          return;
        }

        let session = JSON.parse(storedSession);
        const userData = JSON.parse(storedUserData);

        // Verificar se a sessão ainda é válida
        const expiresAt = session.expires_at || 0;
        const now = Date.now() / 1000;

        if (expiresAt < now) {
          // Token expirado, tentar refresh
          try {
            const response = await fetch(`${apiBase}/api/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: session.refresh_token })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.session) {
                localStorage.setItem('auth_session', JSON.stringify(data.session));
                session = data.session;
              } else {
                throw new Error('Refresh falhou');
              }
            } else {
              throw new Error('Refresh falhou');
            }
          } catch (refreshError) {
            // Refresh falhou, limpar e deslogar
            localStorage.removeItem('auth_session');
            localStorage.removeItem('user_data');
            if (mounted) {
              setAuthState({ user: null, profile: null, loading: false, initialized: true });
            }
            return;
          }
        }

        // Buscar perfil via backend
        const profile = await fetchProfile(userData.id);
        
        if (!mounted) return;

        if (profile) {
          const userWithToken = {
            id: userData.id,
            email: userData.email,
            token: session.access_token,
            ...userData
          };
          
          setAuthState({ user: userWithToken, profile, loading: false, initialized: true });
          
          // Atualizar user_data com dados do profile
          const updatedUserData = {
            id: userData.id,
            email: userData.email,
            user_role: profile.user_role || 'agent',
            role_name: profile.role_name || 'agent',
            organization_id: profile.organization_id
          };
          localStorage.setItem('user_data', JSON.stringify(updatedUserData));
        } else {
          // Se não conseguir buscar perfil, criar perfil mínimo do localStorage
          // Isso evita que o usuário seja deslogado se houver problema temporário no backend
          const userWithToken = {
            id: userData.id,
            email: userData.email,
            token: session.access_token,
            ...userData
          };
          
          // Criar perfil mínimo baseado nos dados do localStorage
          const minimalProfile = {
            id: userData.id,
            name: userData.email?.split('@')[0] || 'Usuário',
            email: userData.email || '',
            organization_id: userData.organization_id || null,
            role_id: null,
            role_name: userData.role_name || 'agent',
            role_permissions: {},
            user_role: userData.user_role || 'agent',
            organization: null
          };
          
          // Usar perfil mínimo do localStorage se backend não disponível
          setAuthState({ 
            user: userWithToken, 
            profile: minimalProfile as any, 
            loading: false, 
            initialized: true 
          });
        }
      } catch (error) {
        // Erro silencioso na inicialização
        if (mounted) {
          setAuthState({ user: null, profile: null, loading: false, initialized: true });
        }
      }
    };

    checkInitialAuth();

    return () => {
      mounted = false;
    };
  }, []); // fetchProfile será atualizado quando necessário

  // ✅ Monitorar mudanças no localStorage (para sincronizar entre abas)
  // Usar useRef para evitar recriação do fetchProfile
  const fetchProfileRef = useRef(fetchProfile);
  useEffect(() => {
    fetchProfileRef.current = fetchProfile;
  }, [fetchProfile]);

  useEffect(() => {
    if (!authState.initialized) return;

    const handleStorageChange = (e: StorageEvent) => {
      // Só processar eventos de outras abas (não da mesma aba)
      if (e.key === 'auth_session' || e.key === 'user_data') {
        const storedSession = localStorage.getItem('auth_session');
        const storedUserData = localStorage.getItem('user_data');
        
        if (!storedSession || !storedUserData) {
          setAuthState({ user: null, profile: null, loading: false, initialized: true });
        } else {
          // Recarregar dados apenas se realmente mudou
          const userData = JSON.parse(storedUserData);
          if (userData.id && userData.id !== authState.user?.id) {
            fetchProfileRef.current(userData.id);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [authState.initialized, authState.user?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no login');
      }

      if (!data.success || !data.user || !data.session) {
        throw new Error('Resposta inválida do servidor');
      }

      // Salvar sessão no localStorage
      localStorage.setItem('auth_session', JSON.stringify(data.session));
      
      // Salvar dados do usuário
      const userData = {
        id: data.user.id,
        email: data.user.email,
        user_role: data.profile?.role_name || 'agent',
        role_name: data.profile?.role_name || 'agent',
        organization_id: data.profile?.organization_id
      };
      localStorage.setItem('user_data', JSON.stringify(userData));

      // Atualizar estado
      const userWithToken = {
        ...data.user,
        token: data.session.access_token
      };
      
      // Determinar user_role
      const userRole = determineUserRole(data.profile?.role_name);
      const profileWithUserRole = {
        ...data.profile,
        user_role: userRole
      };

      setAuthState({ 
        user: userWithToken, 
        profile: profileWithUserRole, 
        loading: false, 
        initialized: true 
      });

      toast({ title: 'Sucesso', description: 'Login realizado com sucesso!' });
      return { success: true, user: userWithToken };
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha no login',
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      // Nota: Endpoint de signup pode não existir no backend ainda
      // Por enquanto, retornar erro informando que precisa ser criado via admin
      toast({
        title: 'Cadastro',
        description: 'Para criar uma conta, entre em contato com o administrador do sistema.',
        variant: 'default'
      });
      return { success: false, error: 'Cadastro via frontend não disponível. Contate o administrador.' };
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha no cadastro',
        variant: 'destructive'
      });
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      // Chamar endpoint de logout no backend (opcional, pois logout é principalmente client-side)
      try {
        const storedSession = localStorage.getItem('auth_session');
        const session = storedSession ? JSON.parse(storedSession) : null;
        
        if (session?.access_token) {
          await fetch(`${apiBase}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }).catch(() => {
            // Ignorar erros no logout, pois é principalmente client-side
          });
        }
      } catch (logoutError) {
        // Ignorar erros no logout
      }
      
      // Limpar estado local
      setAuthState({ user: null, profile: null, loading: false, initialized: true });
      
      // Limpar localStorage
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user_data');
      sessionStorage.clear();
      
      toast({ title: 'Sucesso', description: 'Logout realizado com sucesso!' });
      
      // Redirecionar para login após um pequeno delay para garantir que o toast seja mostrado
      setTimeout(() => {
        window.location.href = '/login';
      }, 300);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha no logout',
        variant: 'destructive'
      });
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!authState.user) return;

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${apiBase}/api/users/${authState.user.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar perfil');
      }

      const { data: updatedProfile } = await response.json();

      // Atualizar perfil no estado
      const userRole = determineUserRole(updatedProfile.role_name);
      const profileWithUserRole = {
        ...updatedProfile,
        user_role: userRole
      };

      setAuthState(prev => ({ ...prev, profile: profileWithUserRole }));
      toast({ title: 'Perfil atualizado', description: 'Seu perfil foi atualizado com sucesso.' });

      return profileWithUserRole;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar perfil.',
        variant: 'destructive'
      });
      throw error;
    }
  };

  return {
    user: memoizedUser,
    profile: authState.profile,
    loading: authState.loading,
    initialized: authState.initialized, // ✅ ADICIONADO: Expor flag de inicialização
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile: fetchProfile
  };
};
