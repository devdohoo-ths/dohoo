import { useState, useCallback } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { BulkActionType, User } from '../types';

interface UseBulkActionsProps {
  users: User[];
  organizationId?: string;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  onUsersUpdate: () => void;
}

export const useBulkActions = ({ 
  users,
  organizationId,
  onSuccess, 
  onError, 
  onUsersUpdate 
}: UseBulkActionsProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkActionModal, setBulkActionModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectUser = useCallback((userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  }, []);

  const handleSelectAll = useCallback((checked: boolean, currentUsers: User[]) => {
    if (checked) {
      setSelectedUsers(currentUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  }, []);

  const openBulkActionModal = useCallback((action: BulkActionType) => {
    if (selectedUsers.length === 0) return;
    setBulkAction(action);
    setBulkActionModal(true);
  }, [selectedUsers]);

  const closeBulkActionModal = useCallback(() => {
    setBulkActionModal(false);
    setBulkAction(null);
  }, []);

  const sendWhatsAppInvite = async (user: User) => {
    if (!organizationId) {
      throw new Error('ID da organização não encontrado');
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/api/invites/whatsapp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        name: user.name,
        user_role: user.user_role || 'user',
        permissions: {},
        organization_id: organizationId,
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Erro ao enviar convite');
    }

    return response.json();
  };

  const executeBulkAction = useCallback(async () => {
    if (!bulkAction || selectedUsers.length === 0) return;

    setLoading(true);

    try {
      // ✅ ADICIONADO: Obter headers de autenticação
      const headers = await getAuthHeaders();
      
      let successCount = 0;
      let errorCount = 0;

      if (bulkAction === 'invite') {
        // Enviar convites em massa
        for (const userId of selectedUsers) {
          try {
            const user = users.find(u => u.id === userId);
            if (user) {
              await sendWhatsAppInvite(user);
              successCount++;
            }
          } catch (err) {
            console.error(`Erro ao enviar convite para ${userId}:`, err);
            errorCount++;
          }
        }
        
        const message = errorCount > 0 
          ? `${successCount} convites enviados com sucesso! ${errorCount} falharam.`
          : `${successCount} convites enviados com sucesso!`;
        onSuccess(message);

      } else if (bulkAction === 'delete') {
        // Desativar usuários em massa
        for (const userId of selectedUsers) {
          try {
            const response = await fetch(`${apiBase}/api/users/${userId}`, {
              method: 'DELETE',
              headers // ✅ CORRIGIDO: Adicionar headers de autenticação
            });
            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            errorCount++;
          }
        }
        
        const message = errorCount > 0 
          ? `${successCount} usuários desativados com sucesso! ${errorCount} falharam.`
          : `${successCount} usuários desativados com sucesso!`;
        onSuccess(message);

      } else if (bulkAction === 'restore') {
        // Reativar usuários em massa
        for (const userId of selectedUsers) {
          try {
            const response = await fetch(`${apiBase}/api/users/${userId}/restore`, {
              method: 'PATCH',
              headers // ✅ CORRIGIDO: Adicionar headers de autenticação
            });
            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            errorCount++;
          }
        }
        
        const message = errorCount > 0 
          ? `${successCount} usuários reativados com sucesso! ${errorCount} falharam.`
          : `${successCount} usuários reativados com sucesso!`;
        onSuccess(message);

      } else if (bulkAction === 'hardDelete') {
        // Excluir usuários permanentemente em massa
        for (const userId of selectedUsers) {
          try {
            const response = await fetch(`${apiBase}/api/users/${userId}/hard`, {
              method: 'DELETE',
              headers // ✅ CORRIGIDO: Adicionar headers de autenticação
            });
            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            errorCount++;
          }
        }
        
        const message = errorCount > 0 
          ? `${successCount} usuários removidos permanentemente! ${errorCount} falharam.`
          : `${successCount} usuários removidos permanentemente!`;
        onSuccess(message);
      }

      setSelectedUsers([]);
      setBulkActionModal(false);
      setBulkAction(null);
      onUsersUpdate();
      
    } catch (err: any) {
      onError(err.message || 'Erro na ação em massa');
    } finally {
      setLoading(false);
    }
  }, [bulkAction, selectedUsers, users, organizationId, onSuccess, onError, onUsersUpdate]);

  const clearSelection = useCallback(() => {
    setSelectedUsers([]);
  }, []);

  return {
    // Estado
    selectedUsers,
    bulkActionModal,
    bulkAction,
    loading,
    
    // Ações
    handleSelectUser,
    handleSelectAll,
    openBulkActionModal,
    closeBulkActionModal,
    executeBulkAction,
    clearSelection,
    setSelectedUsers
  };
};