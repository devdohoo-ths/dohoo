import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Organization, UserProfile } from '@/types/analytics';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export const useOrganizations = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchUserProfile = async () => {
    try {
      // ✅ CORRIGIDO: Usar profile do useAuth em vez de buscar diretamente do Supabase
      if (profile) {
        // Converter profile do useAuth para formato UserProfile esperado
        const profileData: UserProfile = {
          id: profile.id,
          email: profile.email || '',
          name: profile.name || '',
          organization_id: profile.organization_id || '',
          role_id: profile.role_id || '',
          role_name: profile.role_name || '',
          role_permissions: profile.role_permissions || {},
          organization: profile.organization || {
            id: profile.organization_id || '',
            name: '',
            status: 'active'
          },
          user_role: profile.user_role || 'agent',
          permissions: (profile.role_permissions as any) || {}
        };
        setUserProfile(profileData);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('useOrganizations: Erro ao buscar perfil do usuário:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar perfil do usuário",
        variant: "destructive",
      });
    }
  };

  const fetchOrganizations = async () => {
    try {
      
      // ✅ CORRIGIDO: Usar await getAuthHeaders()
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${apiBase}/api/organizations`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('useOrganizations: Erro na API:', errorData);
        throw new Error(errorData.error || 'Erro ao carregar organizações');
      }

      const result = await response.json();
      
      const organizationData: Organization[] = result.organizations?.map(item => ({
        id: item.id,
        name: item.name,
        domain: item.domain,
        logo_url: item.logo_url,
        settings: item.settings as Record<string, any>,
        created_at: new Date(item.created_at),
        updated_at: new Date(item.updated_at)
      })) || [];

      setOrganizations(organizationData);

      // Definir organização atual se não estiver definida
      if (organizationData.length > 0 && !currentOrganization) {
        setCurrentOrganization(organizationData[0]);
      }
    } catch (error) {
      console.error('useOrganizations: Erro ao buscar organizações:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar organizações",
        variant: "destructive",
      });
    }
  };

  const canAccess = (feature: string): boolean => {
    
    if (!userProfile) {
      return false;
    }

    // Super admins têm acesso a tudo
    if (userProfile.user_role === 'super_admin') {
      return true;
    }

    // Verificar permissões específicas
    const hasPermission = userProfile.permissions?.[feature] === true;
    
    return hasPermission;
  };

  useEffect(() => {
    fetchUserProfile();
  }, [profile]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      await fetchOrganizations();
      
      setLoading(false);
    };

    // Só carregar organizações se tiver perfil
    if (profile) {
      loadData();
    }
  }, [profile]);

  return {
    organizations,
    userProfile,
    currentOrganization,
    loading,
    canAccess,
    fetchUserProfile,
    fetchOrganizations,
    setCurrentOrganization
  };
};
