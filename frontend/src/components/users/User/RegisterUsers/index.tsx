import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { useRoles } from '@/hooks/useRoles';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Send, UserMinus, RotateCcw, Trash2 } from 'lucide-react';

// Hooks
import { useUsers } from './hooks/useUsers';
import { useUserForm } from './hooks/useUserForm';
import { useBulkActions } from './hooks/useBulkActions';
import { useCsvImport } from './hooks/useCsvImport';

// Components
import Toolbar from './components/Toolbar';
import UserTable from './components/UserTable';
import UserForm from './components/UserForm';
import SuccessModal from './components/Modals/SuccessModal';
import DeleteModal from './components/Modals/DeleteModal';
import BulkActionModal from './components/Modals/BulkActionModal';
import ImportModal from './components/Modals/ImportModal';
import EmailModal from './components/Modals/EmailModal';

// Utils
import { filterUsers, paginateUsers, getUserStats } from './utils/filterHelpers';
import { downloadCsvTemplate } from './utils/csvHelpers';
import { canUserCreateUsers } from './utils/roleHelpers';

// Constants
import { CSV_TEMPLATE, ITEMS_PER_PAGE } from './constants';

// Types
import { UserFilters, BulkActionType } from './types';

const RegisterUsers: React.FC = () => {
  // Hooks básicos
  const { organization, loading: orgLoading } = useOrganization();
  const { roles, loading: rolesLoading } = useRoles();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Estados locais
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    activeTab: 'active',
    currentPage: 1,
    itemsPerPage: ITEMS_PER_PAGE
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [invitedUser, setInvitedUser] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Hook de usuários
  const {
    users,
    loading: usersLoading,
    error: usersError,
    loadingStates,
    inviteLoadingStates,
    linkLoadingStates,
    deleteLoadingStates,
    fetchUsers, // ✅ CORRIGIDO: Mudar de refetch para fetchUsers
    deleteUser,
    restoreUser,
    hardDeleteUser,
    sendInvite,
    generateLink,
    setError: setUsersError
  } = useUsers(organization?.id);

  // Hook de formulário
  const userForm = useUserForm({
    roles,
    onSuccess: () => {
      fetchUsers(); // ✅ CORRIGIDO: Usar fetchUsers em vez de refetch
      setSuccess('Operação realizada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    },
    onUserCreated: fetchUsers // ✅ CORRIGIDO: Usar fetchUsers em vez de refetch
  });

  // Hook de ações em massa
  const bulkActions = useBulkActions({
    users,
    organizationId: organization?.id,
    onSuccess: (message) => {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 5000);
    },
    onError: (error) => {
      setError(error);
      setTimeout(() => setError(''), 5000);
    },
    onUsersUpdate: fetchUsers // ✅ CORRIGIDO: Usar fetchUsers em vez de refetch
  });

  // Hook de importação CSV
  const csvImport = useCsvImport({
    organizationId: organization?.id,
    organizationName: organization?.name,
    onSuccess: (message) => {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 5000);
    },
    onError: (error) => {
      setError(error);
      setTimeout(() => setError(''), 5000);
    },
    onUsersUpdate: fetchUsers // ✅ CORRIGIDO: Usar fetchUsers em vez de refetch
  });

  // Limpar seleção quando mudar de aba
  useEffect(() => {
    bulkActions.clearSelection();
    setFilters(prev => ({ ...prev, currentPage: 1 }));
  }, [filters.activeTab]);

  // Verificar permissões
  const canCreateUsers = canUserCreateUsers(roles, profile?.role_id);

  // Processar dados dos usuários
  const userStats = useMemo(() => {
    const stats = getUserStats(users);
    return {
      ...stats,
      maxUsers: organization?.max_users || 10
    };
  }, [users, organization?.max_users]);

  const filteredUsers = useMemo(() => {
    return filterUsers(users, filters);
  }, [users, filters]);

  const paginationData = useMemo(() => {
    return paginateUsers(filteredUsers, filters.currentPage, filters.itemsPerPage);
  }, [filteredUsers, filters.currentPage, filters.itemsPerPage]);

  // Handlers
  const handleSearchChange = (search: string) => {
    setFilters(prev => ({ ...prev, search, currentPage: 1 }));
  };

  const handleTabChange = (activeTab: 'active' | 'inactive') => {
    setFilters(prev => ({ ...prev, activeTab, currentPage: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, currentPage: page }));
  };

  const handleCsvDownload = () => {
    downloadCsvTemplate(CSV_TEMPLATE);
  };

  const handleDeleteUser = async (userId: string) => {
    setUserToDelete(userId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      const result = await deleteUser(userToDelete);
      setSuccess(result.message);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleInviteUser = async (user: any) => {
    try {
      const result = await sendInvite(user);
      setSuccess(result.message);
      setInvitedUser(result.user);
      setShowSuccessModal(true);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleGenerateLink = async (user: any) => {
    try {
      const result = await generateLink(user);
      
      // Copiar link para área de transferência
      await navigator.clipboard.writeText(result.link);
      
      setSuccess('Link de conexão gerado e copiado para a área de transferência!');
      setTimeout(() => setSuccess(''), 5000);
      
      // Mostrar toast de sucesso
      toast({
        title: "Link copiado!",
        description: "O link de conexão foi copiado para a área de transferência.",
      });
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleRestoreUser = async (userId: string) => {
    try {
      const result = await restoreUser(userId);
      setSuccess(result.message);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleHardDeleteUser = async (userId: string) => {
    try {
      const result = await hardDeleteUser(userId);
      setSuccess(result.message);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await userForm.submitForm(organization?.id);
  };

  // Loading state
  if (orgLoading) {
    return (
      <div className="w-full min-h-screen p-8 bg-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando configurações da organização...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!organization) {
    return (
      <div className="w-full min-h-screen p-8 bg-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <h2 className="text-xl text-gray-900 mb-2">Organização não encontrada</h2>
            <p className="text-gray-600">Não foi possível carregar as informações da organização.</p>
            <p className="text-sm text-gray-500 mt-2">Entre em contato com o administrador do sistema.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 bg-gray-100">
      <div className="max-w-7xl mx-auto">
        {/* Toolbar */}
        <Toolbar
          userStats={userStats}
          filters={filters}
          onSearchChange={handleSearchChange}
          onTabChange={handleTabChange}
          onOpenUserForm={() => canCreateUsers && userForm.openModal()}
          onCsvDownload={handleCsvDownload}
          onCsvUpload={csvImport.handleCsvUpload}
          csvUploading={csvImport.csvUploading}
        />

        {/* Controles de seleção em massa */}
        {bulkActions.selectedUsers.length > 0 && (
          <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg mb-4 ${
            filters.activeTab === 'active' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{bulkActions.selectedUsers.length} selecionado(s)</Badge>
                <span className={`text-sm hidden sm:inline ${
                  filters.activeTab === 'active' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {filters.activeTab === 'active' ? 'Usuários ativos' : 'Usuários desativados'}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={bulkActions.clearSelection}>
                Limpar seleção
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              {filters.activeTab === 'active' ? (
                <>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => bulkActions.openBulkActionModal('invite')}
                    className="border-green-300 text-green-600 hover:bg-green-50 w-full sm:w-auto"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Enviar convites</span>
                    <span className="sm:hidden">Convites</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => bulkActions.openBulkActionModal('delete')}
                    className="w-full sm:w-auto"
                  >
                    <UserMinus className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Desativar selecionados</span>
                    <span className="sm:hidden">Desativar</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => bulkActions.openBulkActionModal('restore')}
                    className="border-blue-300 text-blue-600 hover:bg-blue-50 w-full sm:w-auto"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Reativar selecionados</span>
                    <span className="sm:hidden">Reativar</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => bulkActions.openBulkActionModal('hardDelete')}
                    className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Excluir permanentemente</span>
                    <span className="sm:hidden">Excluir</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabela de usuários */}
        <UserTable
          users={paginationData.paginatedUsers}
          selectedUsers={bulkActions.selectedUsers}
          onSelectUser={bulkActions.handleSelectUser}
          onSelectAll={(checked) => bulkActions.handleSelectAll(checked, paginationData.paginatedUsers)}
          onEdit={(user) => canCreateUsers && userForm.openModal(user)}
          onDelete={handleDeleteUser}
          onInvite={handleInviteUser}
          onGenerateLink={handleGenerateLink}
          onRestore={handleRestoreUser}
          onHardDelete={handleHardDeleteUser}
          loadingStates={loadingStates}
          inviteLoadingStates={inviteLoadingStates}
          linkLoadingStates={linkLoadingStates}
          deleteLoadingStates={deleteLoadingStates}
          isActive={filters.activeTab === 'active'}
        />

        {/* Paginação */}
        {paginationData.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {paginationData.startIndex + 1} a {Math.min(paginationData.endIndex, filteredUsers.length)} de {filteredUsers.length} usuários
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(filters.currentPage - 1, 1))}
                disabled={filters.currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(paginationData.totalPages, 5) }, (_, i) => {
                  let page;
                  if (paginationData.totalPages <= 5) {
                    page = i + 1;
                  } else {
                    if (filters.currentPage <= 3) {
                      page = i + 1;
                    } else if (filters.currentPage >= paginationData.totalPages - 2) {
                      page = paginationData.totalPages - 4 + i;
                    } else {
                      page = filters.currentPage - 2 + i;
                    }
                  }
                  return (
                    <Button
                      key={page}
                      variant={filters.currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-6 h-6 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(filters.currentPage + 1, paginationData.totalPages))}
                disabled={filters.currentPage === paginationData.totalPages}
                className="flex items-center gap-1"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Mensagens de feedback */}
        {error && (
          <div className="text-red-500 text-xs sm:text-sm mt-2 p-2 bg-red-50 rounded border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="text-green-600 text-xs sm:text-sm mt-2 p-2 bg-green-50 rounded border border-green-200">
            {success}
          </div>
        )}

        {/* Espaço extra para mobile */}
        <div className="pb-8 sm:pb-4"></div>
      </div>

      {/* Modais */}
      <UserForm
        open={userForm.modalOpen}
        onClose={userForm.closeModal}
        editUser={userForm.editUser}
        form={userForm.form}
        loading={userForm.loading}
        error={userForm.error}
        success={userForm.success}
        showPassword={userForm.showPassword}
        avatarFile={userForm.avatarFile}
        avatarPreview={userForm.avatarPreview}
        onFormChange={userForm.handleFormChange}
        onAvatarChange={userForm.handleAvatarChange}
        onSubmit={handleUserFormSubmit}
        onFormUpdate={userForm.setForm}
      />

      <SuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        invitedUser={invitedUser}
      />

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteUser}
        loading={usersLoading}
      />

      <BulkActionModal
        open={bulkActions.bulkActionModal}
        onClose={bulkActions.closeBulkActionModal}
        onConfirm={bulkActions.executeBulkAction}
        loading={bulkActions.loading}
        action={bulkActions.bulkAction}
        selectedUsers={bulkActions.selectedUsers}
        users={users}
      />

      <ImportModal
        open={csvImport.showInviteModal}
        onClose={csvImport.closeInviteModal}
        onConfirm={csvImport.confirmImport}
        loading={csvImport.csvUploading}
        importedUsers={csvImport.importedUsers}
      />

      <EmailModal
        open={csvImport.showEmailModal}
        onClose={csvImport.closeEmailModal} // ✅ CORRIGIDO: Usar closeEmailModal em vez de closeInviteModal
        onConfirm={csvImport.sendEmailsToNewUsers}
        loading={csvImport.sendingEmails}
        newUsersForEmail={csvImport.newUsersForEmail}
      />
    </div>
  );
};

export default RegisterUsers;