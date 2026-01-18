import React, { useState, useMemo, useEffect } from 'react';
import { Smartphone, Wifi, Clock, WifiOff, Mail, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { useAIAssistants } from '@/hooks/ai/useAIAssistants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AccountsList from './AccountsList';
import AccountsCards from './AccountsCards';
import { useToast } from '@/hooks/use-toast';
import { QuickPermissionGuard } from '@/components/auth/QuickPermissionGuard';
import { useAuth } from '@/hooks/useAuth';

type ViewMode = 'cards' | 'list';

const AccountsPage = () => { 
  // ✅ OTIMIZADO: Removidos logs desnecessários que poluem o console

  const {
    accounts,
    loading,
    initialLoading,
    disconnectAccount, // ✅ ADICIONADO: Para desconectar contas individuais
    deleteAccount, // ✅ ADICIONADO: Para excluir contas
    disconnectAllAccounts,
    sendReconnectEmails,
    sendingReconnectEmails,
    sendInviteForAccount, // ✅ NOVO
    pendingReconnectEmails
  } = useWhatsAppAccounts();
  const { assistants } = useAIAssistants();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showDisconnectAllModal, setShowDisconnectAllModal] = useState(false);
  const [disconnectAllConfirmation, setDisconnectAllConfirmation] = useState('');
  const [disconnectingAll, setDisconnectingAll] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null); // ✅ NOVO: Rastrear qual conta está enviando convite
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);

  // ✅ NOVO: Handler para enviar convite
  const handleSendInvite = async (accountId: string) => {
    try {
      setSendingInvite(accountId);
      await sendInviteForAccount(accountId);
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setSendingInvite(null);
    }
  };

  // ✅ NOVO: Handler para desconectar conta individual
  const handleDisconnect = async (accountId: string) => {
    try {
      await disconnectAccount(accountId);
      toast({
        title: "Conta desconectada",
        description: "A conta foi desconectada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Não foi possível desconectar a conta.",
        variant: "destructive",
      });
    }
  };

  // ✅ NOVO: Handler para abrir modal de exclusão
  const handleOpenDelete = (accountId: string, accountName: string) => {
    setAccountToDelete({ id: accountId, name: accountName });
    setShowDeleteModal(true);
  };

  // ✅ NOVO: Handler para excluir conta
  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      setDeletingAccount(true);
      await deleteAccount(accountToDelete.id);
      toast({
        title: "Conta excluída",
        description: "A conta foi excluída com sucesso.",
      });
      setShowDeleteModal(false);
      setAccountToDelete(null);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir a conta.",
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
    }
  };


  // Filtrar e buscar contas
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.phone_number && account.phone_number.includes(searchTerm))
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(account => account.status === statusFilter);
    }

    return filtered;
  }, [accounts, searchTerm, statusFilter]);

  // Paginação
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAccounts = filteredAccounts.slice(startIndex, endIndex);

  // Resetar página quando mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);


  const connectedCount = accounts.filter(acc => acc.status === 'connected').length;
  const totalCount = accounts.length;
  const connectingCount = accounts.filter(acc => acc.status === 'connecting').length;
  const disconnectedCount = accounts.filter(acc => acc.status === 'disconnected').length;

  // ✅ REMOVIDO: Log excessivo que causava loops de re-render

  // Mostrar loading apenas se ainda não temos dados e estamos carregando inicialmente
  const shouldShowLoading = initialLoading && accounts.length === 0;

  // Se ainda está carregando inicialmente e não temos dados, mostrar loading
  if (shouldShowLoading) {
    return (
      <QuickPermissionGuard requiredPermissions={['manage_accounts']}>
        <div className="min-h-screen bg-gray-100">
          <div className="p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
                <p className="text-lg">Carregando contas...</p>
              </div>
            </div>
          </div>
        </div>
      </QuickPermissionGuard>
    );
  }


  const handleDisconnectAll = async () => {
    if (disconnectAllConfirmation !== 'Desconectar') {
      toast({
        title: "Confirmação incorreta",
        description: "Por favor, digite 'Desconectar' para confirmar.",
        variant: "destructive",
      });
      return;
    }

    setDisconnectingAll(true);
    try {
      await disconnectAllAccounts();
      setShowDisconnectAllModal(false);
      setDisconnectAllConfirmation('');
      toast({
        title: "Sucesso",
        description: "Todas as contas foram desconectadas com sucesso.",
      });
    } catch (error: any) {
      console.error('❌ Erro ao desconectar todas:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível desconectar todas as contas.",
        variant: "destructive",
      });
    } finally {
      setDisconnectingAll(false);
    }
  };

  return (
    <QuickPermissionGuard requiredPermissions={['manage_accounts']}>
      <div className="min-h-screen bg-gray-100">
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header Responsivo com Botões */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl text-slate-900">
                Contas WhatsApp
              </h1>
              <p className="text-sm sm:text-base text-slate-600">
                Gerencie suas conexões WhatsApp de forma centralizada
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  // ✅ NOVO: Gerar convite genérico (pode ser implementado depois)
                  toast({
                    title: "Em desenvolvimento",
                    description: "Funcionalidade de gerar convite genérico será implementada em breve.",
                  });
                }}
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Mail size={16} className="mr-2" />
                <span className="hidden sm:inline">Enviar Convite</span>
              </Button>
            </div>
          </div>

          {/* Stats Cards Responsivos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <Card className="bg-blue-50 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="p-2 sm:p-3 bg-blue-100 rounded-xl">
                    <Smartphone className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-blue-700">Total</p>
                    <p className="text-lg sm:text-2xl text-blue-900">{totalCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50 border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="p-2 sm:p-3 bg-emerald-100 rounded-xl">
                    <Wifi className="text-emerald-600" size={20} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-emerald-700">Conectadas</p>
                    <p className="text-lg sm:text-2xl text-emerald-900">{connectedCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="p-2 sm:p-3 bg-amber-100 rounded-xl">
                    <Clock className="text-amber-600" size={20} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-amber-700">Conectando</p>
                    <p className="text-lg sm:text-2xl text-amber-900">{connectingCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="p-2 sm:p-3 bg-slate-100 rounded-xl">
                    <WifiOff className="text-slate-600" size={20} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-slate-700">Desconectadas</p>
                    <p className="text-lg sm:text-2xl text-slate-900">{disconnectedCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Busca e Filtros */}
          <Card className="bg-white border-0 shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Busca */}
                <div className="relative flex-1 w-full max-w-md">
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500 w-full"
                  />
                </div>

                {/* Filtro e View Mode */}
                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48 border-slate-200">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="connected">Conectadas</SelectItem>
                      <SelectItem value="connecting">Conectando</SelectItem>
                      <SelectItem value="disconnected">Desconectadas</SelectItem>
                      <SelectItem value="error">Com Erro</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className={viewMode === 'cards' ? 'bg-blue-600' : 'border-slate-200'}
                    >
                      <span className="hidden sm:inline">Cards</span>
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={viewMode === 'list' ? 'bg-blue-600' : 'border-slate-200'}
                    >
                      <span className="hidden sm:inline">Lista</span>
                    </Button>
                  </div>

                  <Button
                    onClick={() => void sendReconnectEmails()}
                    variant="outline"
                    size="sm"
                    disabled={sendingReconnectEmails}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {sendingReconnectEmails ? (
                      <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                      <Mail size={16} className="mr-2" />
                    )}
                    <span className="hidden sm:inline">Enviar e-mails</span>
                  </Button>
                  <Button
                    onClick={() => setShowDisconnectAllModal(true)}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <WifiOff size={16} className="mr-2" />
                    <span className="hidden sm:inline">Desconectar todos</span>
                  </Button>
                </div>
              </div>

              {/* Resultados da busca */}
              {/* Resultados da busca sem gradientes */}
              {searchTerm || statusFilter !== 'all' ? (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-900">
                        Mostrando {filteredAccounts.length} de {accounts.length} contas
                        {searchTerm && ` para "${searchTerm}"`}
                        {statusFilter !== 'all' && ` com status "${statusFilter}"`}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {filteredAccounts.filter(acc => acc.status === 'connected').length} conectadas • 
                        {filteredAccounts.filter(acc => acc.status === 'connecting').length} conectando • 
                        {filteredAccounts.filter(acc => acc.status === 'disconnected').length} desconectadas
                      </p>
                    </div>
                    {(searchTerm || statusFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('all');
                        }}
                        className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Content */}
          {viewMode === 'cards' ? (
            <AccountsCards 
              accounts={paginatedAccounts}
              assistants={assistants || []}
              onSendInvite={handleSendInvite}
              onDisconnect={handleDisconnect}
              onDelete={handleOpenDelete}
              loading={loading}
              sendingInvite={sendingInvite}
            />
          ) : (
            <AccountsList
              accounts={paginatedAccounts}
              assistants={assistants || []}
              onSendInvite={handleSendInvite}
              onDisconnect={handleDisconnect}
              onDelete={handleOpenDelete}
              loading={loading}
              sendingInvite={sendingInvite}
            />
          )}

          {/* Paginação Responsiva */}
          {totalPages > 1 && (
            <Card className="bg-white border-0 shadow-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-600 text-center sm:text-left">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredAccounts.length)} de {filteredAccounts.length} contas
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="border-slate-200"
                    >
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={currentPage === page ? "bg-blue-600" : "border-slate-200"}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="border-slate-200"
                    >
                      <span className="hidden sm:inline">Próxima</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State Responsivo */}
          {filteredAccounts.length === 0 && (
            <Card className="bg-white border-0 shadow-lg">
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="text-slate-400" size={24} />
                </div>
                <h3 className="text-base sm:text-lg text-slate-900 mb-2">
                  {searchTerm || statusFilter !== 'all' ? 'Nenhuma conta encontrada' : 'Nenhuma conta WhatsApp encontrada'}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 mb-6">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Tente ajustar os filtros ou termos de busca'
                    : 'Crie sua primeira conta WhatsApp para começar a gerenciar suas conexões'
                  }
                </p>
              </CardContent>
            </Card>
          )}

          {/* Modal Excluir Conta */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="sm:max-w-md mx-4">
              <DialogHeader>
                <DialogTitle className="text-xl text-slate-900">
                  Excluir Conta WhatsApp
                </DialogTitle>
                <DialogDescription>
                  Esta ação é irreversível e irá remover permanentemente a conta da sua organização.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 font-medium mb-2">⚠️ Atenção</p>
                  <p className="text-xs text-red-600">
                    A conta <strong>{accountToDelete?.name}</strong> será excluída permanentemente. 
                    Esta ação não pode ser desfeita.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteModal(false);
                      setAccountToDelete(null);
                    }}
                    disabled={deletingAccount}
                    className="flex-1 border-slate-200"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {deletingAccount ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      'Excluir Conta'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal Desconectar Todos */}
          <Dialog open={showDisconnectAllModal} onOpenChange={setShowDisconnectAllModal}>
            <DialogContent className="sm:max-w-md mx-4">
              <DialogHeader>
                <DialogTitle className="text-xl text-slate-900">
                  Desconectar Todas as Contas
                </DialogTitle>
                <DialogDescription>
                  Esta ação irá desconectar todos os números WhatsApp da sua organização.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 font-medium mb-2">⚠️ Atenção</p>
                  <p className="text-xs text-red-600">
                    Esta ação irá desconectar todas as contas WhatsApp conectadas ou conectando da sua organização. 
                    Você precisará reconectar cada conta individualmente após esta ação.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="disconnectConfirmation" className="text-sm text-slate-700">
                    Digite <strong>"Desconectar"</strong> para confirmar:
                  </Label>
                  <Input
                    id="disconnectConfirmation"
                    value={disconnectAllConfirmation}
                    onChange={(e) => setDisconnectAllConfirmation(e.target.value)}
                    placeholder="Desconectar"
                    className="border-slate-200 focus:border-red-500 focus:ring-red-500"
                    disabled={disconnectingAll}
                  />
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDisconnectAllModal(false);
                      setDisconnectAllConfirmation('');
                    }}
                    disabled={disconnectingAll}
                    className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleDisconnectAll}
                    variant="destructive"
                    disabled={disconnectingAll || disconnectAllConfirmation !== 'Desconectar'}
                    className="flex-1"
                  >
                    {disconnectingAll ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      'Desconectar Todas'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </QuickPermissionGuard>
  );
};

export default AccountsPage;
