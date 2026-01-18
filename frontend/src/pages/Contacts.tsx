import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Users, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  X,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useContacts, Contact, ContactFilters } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { ContactFiltersComponent } from '@/components/contacts/ContactFilters';
import { ContactDialog } from '@/components/contacts/ContactDialog';
import { TransferDialog } from '@/components/contacts/TransferDialog';
import { exportContactsToCSV } from '@/utils/csvExport';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ContactsPage() {
  const [filters, setFilters] = useState<ContactFilters>({
    // Sem limite inicial - o hook vai carregar todos os contatos
    offset: 0
  });
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [users, setUsers] = useState<Array<{id: string; name: string; email: string; roles: {name: string}}>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Estados para paginação (igual ao report-detailed-conversations)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const { user } = useAuth();
  
  const {
    contacts,
    loading,
    error,
    createContact,
    updateContact,
    deleteContact,
    transferContacts,
    getUsers,
    refreshContacts
  } = useContacts(filters);

  const isAdmin = user?.role_name === 'Admin' || user?.role_name === 'Super Admin';

  // Funções para paginação (igual ao report-detailed-conversations)
  const getPaginatedContacts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return contacts.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(contacts.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = getTotalPages();
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Carregar usuários para os diálogos
  useEffect(() => {
    const loadUsers = async () => {
      if (loadingUsers) return; // Evitar chamadas múltiplas
      
      setLoadingUsers(true);
      try {
        const usersData = await getUsers();
        setUsers(usersData || []);
      } catch (error) {
        // Erro silencioso - não exibir notificação para o usuário
      } finally {
        setLoadingUsers(false);
      }
    };

    // Só carregar usuários se o usuário estiver autenticado e ainda não foram carregados
    if (user?.token && users && users.length === 0 && !loadingUsers) {
      loadUsers();
    }
  }, [getUsers, users?.length, user?.token]); // Remover loadingUsers das dependências

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.user_id]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFiltersChange = (newFilters: ContactFilters) => {
    setFilters(newFilters);
    setSelectedContacts([]); // Limpar seleção ao mudar filtros
  };

  const handleClearFilters = () => {
    setFilters({ offset: 0 });
    setSelectedContacts([]);
  };

  const handleSelectContact = (contactId: string, selected: boolean) => {
    setSelectedContacts(prev => 
      selected 
        ? [...prev, contactId]
        : prev.filter(id => id !== contactId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedContacts(selected ? contacts.map(c => c.id) : []);
  };

  const handleCreateContact = () => {
    setEditingContact(null);
    setShowContactDialog(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactDialog(true);
  };

  const handleSaveContact = async (data: any) => {
    try {
      if (editingContact) {
        await updateContact(editingContact.id, data);
        showNotification('success', 'Contato atualizado com sucesso');
      } else {
        await createContact(data);
        showNotification('success', 'Contato criado com sucesso');
      }
      setShowContactDialog(false);
      setEditingContact(null);
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      showNotification('error', error instanceof Error ? error.message : 'Erro ao salvar contato');
    }
  };

  const handleDeleteContact = (contact: Contact) => {
    setDeletingContact(contact);
  };

  const confirmDeleteContact = async () => {
    if (!deletingContact) return;

    try {
      await deleteContact(deletingContact.id);
      showNotification('success', 'Contato excluído com sucesso');
      setDeletingContact(null);
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      showNotification('error', error instanceof Error ? error.message : 'Erro ao excluir contato');
    }
  };

  const handleTransferContacts = (contactIds: string[]) => {
    setSelectedContacts(contactIds);
    setShowTransferDialog(true);
  };

  const handleTransfer = async (data: any) => {
    try {
      await transferContacts(data);
      showNotification('success', `${data.contact_ids.length} contato(s) transferido(s) com sucesso`);
      setShowTransferDialog(false);
      setSelectedContacts([]);
      // Atualizar a lista de contatos após a transferência
      refreshContacts();
    } catch (error) {
      console.error('Erro ao transferir contatos:', error);
      showNotification('error', error instanceof Error ? error.message : 'Erro ao transferir contatos');
    }
  };

  const handleRefresh = () => {
    refreshContacts();
    showNotification('success', 'Lista de contatos atualizada');
  };

  const handleExportCSV = () => {
    try {
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `contatos_${timestamp}.csv`;
      
      exportContactsToCSV(contacts, filename);
      showNotification('success', `${contacts.length} contato(s) exportado(s) com sucesso`);
    } catch (error) {
      console.error('Erro ao exportar contatos:', error);
      showNotification('error', 'Erro ao exportar contatos');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">Contatos</h1>
          <p className="text-gray-600">
            Gerencie sua carteira de contatos e transfira entre usuários
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={loading || contacts.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          
          <Button
            onClick={handleCreateContact}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Notificação */}
      {notification && (
        <Alert className={notification.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {notification.message}
            </AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNotification(null)}
            className="ml-auto h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {/* Filtros */}
      <ContactFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      {/* Tabela de contatos */}
      <ContactsTable
        contacts={getPaginatedContacts()}
        loading={loading}
        selectedContacts={selectedContacts}
        onSelectContact={handleSelectContact}
        onSelectAll={handleSelectAll}
        onEditContact={handleEditContact}
        onDeleteContact={handleDeleteContact}
        onTransferContacts={handleTransferContacts}
        canEdit={true}
        canDelete={true}
        canTransfer={true} // Temporariamente sempre true para teste
        totalContacts={contacts.length}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
      />

      {/* Controles de Paginação */}
      {contacts.length > itemsPerPage && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, contacts.length)} de {contacts.length} contatos
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            <div className="flex items-center space-x-1">
              {(() => {
                const totalPages = getTotalPages();
                const maxVisiblePages = 5;
                const pages = [];
                
                if (totalPages <= maxVisiblePages) {
                  // Mostrar todas as páginas se são poucas
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  // Mostrar páginas com ellipsis
                  if (currentPage <= 3) {
                    // Páginas iniciais
                    for (let i = 1; i <= 4; i++) {
                      pages.push(i);
                    }
                    pages.push('...');
                    pages.push(totalPages);
                  } else if (currentPage >= totalPages - 2) {
                    // Páginas finais
                    pages.push(1);
                    pages.push('...');
                    for (let i = totalPages - 3; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    // Páginas do meio
                    pages.push(1);
                    pages.push('...');
                    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                      pages.push(i);
                    }
                    pages.push('...');
                    pages.push(totalPages);
                  }
                }
                
                return pages.map((page, index) => (
                  page === '...' ? (
                    <span key={index} className="px-2 text-gray-500">...</span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page as number)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  )
                ));
              })()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === getTotalPages()}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Diálogos */}
      <ContactDialog
        open={showContactDialog}
        onOpenChange={setShowContactDialog}
        contact={editingContact}
        onSave={handleSaveContact}
        users={users || []}
        loading={loadingUsers}
      />

      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        contacts={contacts}
        contactIds={selectedContacts}
        onTransfer={handleTransfer}
        users={users || []}
        loading={loadingUsers}
      />

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contato <strong>{deletingContact?.name || 'Cliente'}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteContact}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ContactsPage;
