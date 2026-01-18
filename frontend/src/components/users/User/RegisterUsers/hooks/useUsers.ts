import { useState, useEffect, useCallback } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders
import { User, LoadingStates } from '../types';

export const useUsers = (organizationId?: string) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({});
  const [inviteLoadingStates, setInviteLoadingStates] = useState<LoadingStates>({});
  const [linkLoadingStates, setLinkLoadingStates] = useState<LoadingStates>({});
  const [deleteLoadingStates, setDeleteLoadingStates] = useState<LoadingStates>({});

  const fetchUsers = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    setError('');
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users?organization_id=${organizationId}`, {
        headers
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao carregar usuários');
      }
      
      setUsers(
        (result.users || []).map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          user_role: user.user_role,
          role_id: user.role_id,
          created_at: user.created_at,
          avatar_url: user.avatar_url,
          is_online: user.is_online,
          last_seen: user.last_seen,
          show_name_in_chat: user.show_name_in_chat ?? true,
          deleted_at: user.deleted_at,
        }))
      );
    } catch (err: any) {
      console.error('Erro ao buscar usuários:', err);
      setError(err.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const deleteUser = useCallback(async (userId: string) => {
    setDeleteLoadingStates(prev => ({ ...prev, [userId]: true }));
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao desativar usuário');
      }
      
      await fetchUsers(); // Recarregar lista
      return { success: true, message: 'Usuário desativado com sucesso!' };
    } catch (err: any) {
      console.error('Erro ao desativar usuário:', err);
      throw err;
    } finally {
      setDeleteLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  }, [fetchUsers]);

  const restoreUser = useCallback(async (userId: string) => {
    setLoadingStates(prev => ({ ...prev, [userId]: true }));
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users/${userId}/restore`, {
        method: 'PATCH',
        headers
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao reativar usuário');
      }
      
      await fetchUsers(); // Recarregar lista
      return { success: true, message: 'Usuário reativado com sucesso!' };
    } catch (err: any) {
      console.error('Erro ao reativar usuário:', err);
      throw err;
    } finally {
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  }, [fetchUsers]);

  const hardDeleteUser = useCallback(async (userId: string) => {
    setLoadingStates(prev => ({ ...prev, [userId]: true }));
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users/${userId}/hard`, {
        method: 'DELETE',
        headers
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir usuário');
      }
      
      await fetchUsers(); // Recarregar lista
      return { success: true, message: 'Usuário excluído permanentemente!' };
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      throw err;
    } finally {
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  }, [fetchUsers]);

  const sendInvite = useCallback(async (user: User) => {
    setInviteLoadingStates(prev => ({ ...prev, [user.id]: true }));
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users/${user.id}/invite`, {
        method: 'POST',
        headers
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao enviar convite');
      }
      
      return { success: true, message: 'Convite enviado com sucesso!', user: result.user };
    } catch (err: any) {
      console.error('Erro ao enviar convite:', err);
      throw err;
    } finally {
      setInviteLoadingStates(prev => ({ ...prev, [user.id]: false }));
    }
  }, []);

  const generateLink = useCallback(async (user: User) => {
    setLinkLoadingStates(prev => ({ ...prev, [user.id]: true }));
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users/${user.id}/generate-link`, {
        method: 'POST',
        headers
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao gerar link');
      }
      
      return { success: true, link: result.link, message: 'Link gerado com sucesso!', user: result.user };
    } catch (err: any) {
      console.error('Erro ao gerar link:', err);
      throw err;
    } finally {
      setLinkLoadingStates(prev => ({ ...prev, [user.id]: false }));
    }
  }, []);

  // Carregar usuários na inicialização
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    loadingStates,
    inviteLoadingStates,
    linkLoadingStates,
    deleteLoadingStates,
    fetchUsers,
    deleteUser,
    restoreUser,
    hardDeleteUser,
    sendInvite,
    generateLink,
    setError
  };
}; 