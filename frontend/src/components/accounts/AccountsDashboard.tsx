
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Wifi, WifiOff, AlertCircle, CheckCircle, QrCode, Settings, Trash2, Clock, 
  Smartphone, MessageCircle, Search, Filter, Download, ChevronLeft, ChevronRight, User 
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import io, { Socket } from 'socket.io-client';
import type { WhatsAppAccount } from '@/types/chat';
import { apiBase } from '@/utils/apiBase';
import { normalizeQrCode, pickQrValue } from '@/utils/qrCode';

const AccountsDashboard = () => {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Função para gerar avatar com iniciais
  const getAvatarFallback = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Função para obter foto de perfil do WhatsApp
  const getWhatsAppProfilePicture = (account: WhatsAppAccount) => {
    // Verificar se há foto de perfil nos dados da conta
    if ((account as any).profile_picture) {
      return (account as any).profile_picture;
    }
    
    return null;
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrTimer, setQrTimer] = useState<number>(0);
  const [newAccountName, setNewAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  
  const { toast } = useToast();

  // Conectar com Socket.IO
  useEffect(() => {
    let isMounted = true;
    const newSocket = io(apiBase);
    setSocket(newSocket);

    // Eventos do Socket.IO
    newSocket.on('whatsapp-qr-code', async (data: { accountId: string; qr?: string; qrCode?: string; code?: string; accountName: string }) => {
      if (!isMounted) {
        return;
      }

      const rawQrValue = pickQrValue(data);
      const normalized = await normalizeQrCode(rawQrValue);

      if (!normalized) {
        console.warn('⚠️ [Dashboard] QR Code recebido sem payload válido:', {
          accountId: data.accountId,
          rawLength: rawQrValue.length,
        });
        return;
      }

      console.log('QR Code recebido:', {
        accountId: data.accountId,
        accountName: data.accountName,
        qrLength: normalized.length,
      });

      setQrCode(normalized);
      setQrTimer(120); // ✅ CORREÇÃO: Atualizado para 120 segundos
      
      setAccounts(prev => prev.map(acc => 
        acc.id === data.accountId 
          ? { ...acc, status: 'connecting', qr_code: normalized }
          : acc
      ));
    });

    newSocket.on('whatsapp-connected', (data: { accountId: string; accountName: string; phoneNumber: string }) => {
      console.log('WhatsApp conectado:', data);
      setShowQRModal(false);
      setQrCode('');
      setQrTimer(0);
      
      setAccounts(prev => prev.map(acc => 
        acc.id === data.accountId 
          ? { ...acc, status: 'connected', phone_number: data.phoneNumber, qr_code: undefined }
          : acc
      ));

      toast({
        title: "WhatsApp Conectado",
        description: `Conta ${data.accountName} conectada com sucesso!`,
      });
    });

    newSocket.on('whatsapp-disconnected', (data: { accountId: string; accountName: string }) => {
      console.log('WhatsApp desconectado:', data);
      
      setAccounts(prev => prev.map(acc => 
        acc.id === data.accountId 
          ? { ...acc, status: 'disconnected', phone_number: undefined, qr_code: undefined }
          : acc
      ));

      toast({
        title: "WhatsApp Desconectado",
        description: `Conta ${data.accountName} foi desconectada`,
        variant: "destructive",
      });
    });

    newSocket.on('whatsapp-qr-expired', (data: { accountId: string; accountName: string }) => {
      console.log('QR Code expirado:', data);
      setShowQRModal(false);
      setQrCode('');
      setQrTimer(0);
      
      toast({
        title: "QR Code Expirado",
        description: `QR Code da conta ${data.accountName} expirou. Tente novamente.`,
        variant: "destructive",
      });
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
    };
  }, [toast]);

  // Timer do QR Code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [qrTimer]);

  // Buscar contas existentes
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${apiBase}/api/accounts`);
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
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

  // Exportar dados
  const exportData = () => {
    const csvContent = [
      ['Nome', 'Status', 'Telefone', 'Criada em', 'Atualizada em'],
      ...filteredAccounts.map(account => [
        account.name,
        account.status,
        account.phone_number || '-',
        new Date(account.created_at).toLocaleDateString(),
        new Date(account.updated_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `whatsapp-accounts-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Dados Exportados",
      description: `CSV com ${filteredAccounts.length} contas foi baixado`,
    });
  };

  const createWhatsAppAccount = async () => {
    if (!newAccountName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da conta é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const accountId = Date.now().toString();
      const response = await fetch(`${apiBase}/api/accounts/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newAccountName,
          accountId
        }),
      });

      const result = await response.json();

      if (result.success) {
        const newAccount: WhatsAppAccount = {
          id: accountId,
          name: newAccountName,
          status: 'connecting',
          created_at: new Date(),
          updated_at: new Date(),
          user_id: 'current-user'
        };

        setAccounts(prev => [...prev, newAccount]);
        setSelectedAccount(newAccount);
        setShowCreateModal(false);
        setShowQRModal(true);
        setNewAccountName('');
        
        toast({
          title: "Conta Criada",
          description: "Escaneie o QR Code para conectar",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar conta WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      const response = await fetch(`${apiBase}/api/accounts/whatsapp/${accountId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setAccounts(prev => prev.filter(acc => acc.id !== accountId));
        toast({
          title: "Conta Removida",
          description: "Conta desconectada e removida com sucesso",
        });
      }
    } catch (error) {
      console.error('Erro ao remover conta:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover conta",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="text-emerald-500" size={20} />;
      case 'connecting':
        return <Clock className="text-amber-500" size={20} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={20} />;
      default:
        return <WifiOff className="text-slate-400" size={20} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: 'default',
      connecting: 'secondary',
      error: 'destructive',
      disconnected: 'outline'
    };
    
    const labels = {
      connected: 'Conectado',
      connecting: 'Conectando...',
      error: 'Erro',
      disconnected: 'Desconectado'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-50 border-emerald-200 hover:shadow-emerald-100';
      case 'connecting':
        return 'bg-amber-50 border-amber-200 hover:shadow-amber-100';
      case 'error':
        return 'bg-red-50 border-red-200 hover:shadow-red-100';
      default:
        return 'bg-slate-50 border-slate-200 hover:shadow-slate-100';
    }
  };

  return (
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl text-slate-900">
            Contas WhatsApp
          </h1>
          <p className="text-slate-600 text-lg">
            Gerencie suas conexões WhatsApp de forma centralizada
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
          size="lg"
        >
          <Plus size={18} />
          <span>Nova Conta</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Smartphone className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total de Contas</p>
                <p className="text-2xl text-slate-900">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Wifi className="text-emerald-600" size={24} />
                </div>
              <div>
                <p className="text-sm text-slate-600">Conectadas</p>
                <p className="text-2xl text-slate-900">
                  {accounts.filter(acc => acc.status === 'connected').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="text-amber-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-600">Conectando</p>
                <p className="text-2xl text-slate-900">
                  {accounts.filter(acc => acc.status === 'connecting').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-slate-100 rounded-xl">
                <WifiOff className="text-slate-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-600">Desconectadas</p>
                <p className="text-2xl text-slate-900">
                  {accounts.filter(acc => acc.status === 'disconnected').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card className="bg-white border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              {/* Busca */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Filtro por Status */}
              <div className="flex items-center space-x-2">
                <Filter className="text-slate-400" size={16} />
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
              </div>
            </div>

            {/* Export */}
            <Button
              onClick={exportData}
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} className="mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* Resultados da busca */}
          {searchTerm || statusFilter !== 'all' ? (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                Mostrando {filteredAccounts.length} de {accounts.length} contas
                {searchTerm && ` para "${searchTerm}"`}
                {statusFilter !== 'all' && ` com status "${statusFilter}"`}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Grid de Contas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedAccounts.map((account) => (
          <Card 
            key={account.id} 
            className={`group relative overflow-hidden transition-all duration-300 hover:scale-105 ${getStatusColor(account.status)} border-2 shadow-lg hover:shadow-2xl`}
          >
            {/* Status indicator bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${
              account.status === 'connected' ? 'bg-emerald-500' :
              account.status === 'connecting' ? 'bg-amber-500' :
              account.status === 'error' ? 'bg-red-500' : 'bg-slate-400'
            }`} />
            
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12 border-2 border-white shadow-lg">
                      <AvatarImage 
                        src={getWhatsAppProfilePicture(account)} 
                        alt={`Foto de perfil de ${account.name}`}
                      />
                      <AvatarFallback className="bg-blue-600 text-white">
                        {getAvatarFallback(account.name)}
                      </AvatarFallback>
                    </Avatar>
                    {account.status === 'connected' && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                    {/* Removido: Ícone do WhatsApp */}
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900 group-hover:text-blue-700 transition-colors">
                      {account.name}
                    </CardTitle>
                    {account.phone_number && (
                      <p className="text-sm text-slate-600 font-mono">
                        {account.phone_number}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(account.status)}
                  {getStatusBadge(account.status)}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Criada:</span>
                  <span className="">{new Date(account.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Atualizada:</span>
                  <span className="">{new Date(account.updated_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}</span>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                {account.status === 'disconnected' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                    onClick={() => {
                      setSelectedAccount(account);
                      setShowQRModal(true);
                      createWhatsAppAccount();
                    }}
                  >
                    <QrCode size={14} className="mr-2" />
                    Conectar
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                >
                  <Settings size={14} className="mr-2" />
                  Config
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                  onClick={() => disconnectAccount(account.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <Card className="bg-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredAccounts.length)} de {filteredAccounts.length} contas
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="border-slate-200"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </Button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? "bg-blue-600" : "border-slate-200"}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="border-slate-200"
                >
                  Próxima
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {filteredAccounts.length === 0 && (
        <Card className="bg-white border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="text-slate-400" size={32} />
            </div>
            <h3 className="text-lg text-slate-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'Nenhuma conta encontrada' : 'Nenhuma conta WhatsApp encontrada'}
            </h3>
            <p className="text-slate-600 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Tente ajustar os filtros ou termos de busca'
                : 'Crie sua primeira conta WhatsApp para começar a gerenciar suas conexões'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                Criar Primeira Conta
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Criar Conta */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-900">
              Nova Conta WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="accountName" className="text-sm text-slate-700">
                Nome da Conta
              </Label>
              <Input
                id="accountName"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Ex: Suporte Principal"
                className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateModal(false)}
                className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button 
                onClick={createWhatsAppAccount}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Criando...' : 'Criar Conta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-900">
              Conectar {selectedAccount?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-center">
            {qrCode ? (
              <>
                <div className="bg-white p-6 rounded-2xl mx-auto w-fit shadow-lg border border-slate-200">
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64 rounded-lg"
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Escaneie o QR Code com seu WhatsApp
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                    <Clock size={16} />
                    <span className="font-mono text-lg">
                      {Math.floor(qrTimer / 60)}:{(qrTimer % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Gerando QR Code...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountsDashboard;
