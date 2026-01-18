import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Wifi, 
  WifiOff,
  RefreshCw,
  Clock,
  AlertCircle,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Settings,
  QrCode,
  Search,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useConnections, Connection } from '@/hooks/useConnections';
import { useAIAssistants } from '@/hooks/ai/useAIAssistants';
import { useFlows } from '@/components/flow/hooks/useFlows';
import { useToast } from '@/hooks/use-toast';
import AccountsCards from '@/components/accounts/AccountsCards';
import { apiBase } from '@/utils/apiBase';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl text-red-600 mb-4">
              Erro Capturado
            </h2>
            <p className="text-red-800 mb-4">
              {this.state.error?.message || 'Erro desconhecido'}
            </p>
            <pre className="text-xs text-red-700 bg-red-50 p-2 rounded overflow-auto">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type ViewMode = 'cards' | 'list';
type Platform = 'all' | 'whatsapp' | 'telegram' | 'facebook' | 'instagram' | 'api';

const ConnectionsPage = () => {
  console.log('=== CONNECTIONS PAGE - COM FUNCIONALIDADE REAL ===');
  
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Connection | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<any>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPlatform, setNewAccountPlatform] = useState<string>('whatsapp');
  const [newAccountType, setNewAccountType] = useState<'official' | 'unofficial'>('unofficial');
  const [updatedAccountName, setUpdatedAccountName] = useState('');
  const [updatedAssistantId, setUpdatedAssistantId] = useState<string>('none');
  const [updatedMode, setUpdatedMode] = useState<'ia' | 'flow'>('ia');
  const [updatedFlowId, setUpdatedFlowId] = useState<string>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [createLoading, setCreateLoading] = useState(false);

  // Hook unificado de conexões
  const {
    connections,
    loading,
    qrCode,
    qrTimer,
    createConnection,
    connectConnection,
    disconnectConnection,
    deleteConnection,
    updateConnection
  } = useConnections();
  const { assistants } = useAIAssistants();
  const { flows, loading: flowsLoading } = useFlows();
  const { toast } = useToast();

  // Filtrar conexões baseado na plataforma selecionada
  const filteredConnections = connections.filter(connection => {
    const matchesPlatform = selectedPlatform === 'all' || connection.platform === selectedPlatform;
    const matchesSearch = !searchTerm || 
      connection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (connection.config.phone_number && connection.config.phone_number.includes(searchTerm));
    const matchesStatus = statusFilter === 'all' || connection.status === statusFilter;
    
    return matchesPlatform && matchesSearch && matchesStatus;
  });

  // Paginação
  const totalPages = Math.ceil(filteredConnections.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedConnections = filteredConnections.slice(startIndex, endIndex);

  // Debug: mostrar todas as conexões e filtros
  console.log('🔍 Debug Connections:', {
    totalConnections: connections.length,
    selectedPlatform,
    filteredConnections: filteredConnections.length
  });

  // Estatísticas
  const connectedCount = filteredConnections.filter(conn => conn.status === 'connected').length;
  const totalCount = filteredConnections.length;
  const connectingCount = filteredConnections.filter(conn => conn.status === 'connecting').length;
  const disconnectedCount = filteredConnections.filter(conn => conn.status === 'disconnected').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'border-green-200 bg-green-50';
      case 'connecting': return 'border-yellow-200 bg-yellow-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="text-green-600" size={16} />;
      case 'connecting': return <Clock className="text-yellow-600 animate-spin" size={16} />;
      case 'error': return <AlertCircle className="text-red-600" size={16} />;
      default: return <WifiOff className="text-gray-600" size={16} />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'whatsapp':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#25D366" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M20.52 3.478a11.812 11.812 0 0 0-16.707 0 11.812 11.812 0 0 0-2.67 12.524L0 24l8.236-2.118a11.79 11.79 0 0 0 5.271 1.282h.005c3.14 0 6.092-1.222 8.315-3.445 4.594-4.593 4.594-12.041 0-16.641zM12 21.754a9.76 9.76 0 0 1-4.982-1.368l-.357-.21-4.891 1.26 1.297-4.77-.232-.366A9.8 9.8 0 0 1 2.248 12c0-5.388 4.363-9.752 9.752-9.752 2.607 0 5.06 1.016 6.906 2.861a9.732 9.732 0 0 1 0 13.792A9.697 9.697 0 0 1 12 21.754zm5.443-7.334c-.299-.15-1.77-.875-2.044-.973-.273-.098-.472-.149-.67.15-.199.299-.768.973-.941 1.172-.173.199-.348.224-.647.075s-1.262-.464-2.402-1.478c-.888-.791-1.489-1.766-1.662-2.065-.173-.299-.018-.46.13-.609.134-.133.299-.348.448-.522.149-.174.199-.299.299-.498.1-.199.05-.374-.025-.523-.075-.15-.67-1.613-.916-2.211-.242-.579-.488-.5-.67-.51-.173-.007-.373-.009-.573-.009a1.09 1.09 0 0 0-.796.373c-.273.299-1.042 1.017-1.042 2.48 0 1.463 1.066 2.876 1.214 3.074.149.199 2.1 3.211 5.09 4.502.711.306 1.264.489 1.696.626.713.227 1.362.195 1.874.118.572-.085 1.77-.723 2.021-1.422.25-.699.25-1.298.174-1.422-.074-.124-.273-.199-.572-.348z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#E1306C" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.355 3.608 1.33.975.975 1.268 2.242 1.33 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.355 2.633-1.33 3.608-.975.975-2.242 1.268-3.608 1.33-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.355-3.608-1.33-.975-.975-1.268-2.242-1.33-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.355-2.633 1.33-3.608C4.538 2.588 5.805 2.295 7.171 2.233 8.437 2.175 8.817 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.773.13 4.548.435 3.523 1.46 2.497 2.486 2.192 3.711 2.134 4.99.875 6.27.863 6.679.863 10c0 3.321.012 3.73.072 5.01.058 1.279.363 2.504 1.389 3.529 1.025 1.026 2.25 1.331 3.529 1.389 1.279.06 1.688.072 5.01.072s3.73-.012 5.01-.072c1.279-.058 2.504-.363 3.529-1.389 1.026-1.025 1.331-2.25 1.389-3.529.06-1.279.072-1.688.072-5.01s-.012-3.73-.072-5.01c-.058-1.279-.363-2.504-1.389-3.529C19.954.435 18.729.13 17.45.072 16.17.013 15.761 0 12 0z"/>
            <path d="M12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zM18.406 4.594a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
          </svg>
        );
      case 'telegram':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#0088CC" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm5.543 7.53-2.2 10.372c-.166.743-.596.923-1.207.574l-3.338-2.462-1.61 1.552c-.177.177-.327.327-.67.327l.24-3.402 6.203-5.608c.27-.24-.058-.374-.418-.133l-7.662 4.823-3.298-1.03c-.717-.225-.73-.717.15-1.06l12.86-4.955c.594-.22 1.112.144.922 1.06z"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1877F2" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M22.675 0h-21.35C.595 0 0 .593 0 1.326v21.348C0 23.406.595 24 1.326 24h11.495v-9.294H9.691v-3.622h3.13V8.413c0-3.1 1.894-4.788 4.659-4.788 1.325 0 2.463.099 2.794.143v3.24h-1.917c-1.504 0-1.796.716-1.796 1.765v2.31h3.588l-.467 3.622h-3.12V24h6.116C23.405 24 24 23.406 24 22.674V1.326C24 .593 23.405 0 22.675 0z"/>
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#25D366" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M20.52 3.478a11.812 11.812 0 0 0-16.707 0 11.812 11.812 0 0 0-2.67 12.524L0 24l8.236-2.118a11.79 11.79 0 0 0 5.271 1.282h.005c3.14 0 6.092-1.222 8.315-3.445 4.594-4.593 4.594-12.041 0-16.641zM12 21.754a9.76 9.76 0 0 1-4.982-1.368l-.357-.21-4.891 1.26 1.297-4.77-.232-.366A9.8 9.8 0 0 1 2.248 12c0-5.388 4.363-9.752 9.752-9.752 2.607 0 5.06 1.016 6.906 2.861a9.732 9.732 0 0 1 0 13.792A9.697 9.697 0 0 1 12 21.754zm5.443-7.334c-.299-.15-1.77-.875-2.044-.973-.273-.098-.472-.149-.67.15-.199.299-.768.973-.941 1.172-.173.199-.348.224-.647.075s-1.262-.464-2.402-1.478c-.888-.791-1.489-1.766-1.662-2.065-.173-.299-.018-.46.13-.609.134-.133.299-.348.448-.522.149-.174.199-.299.299-.498.1-.199.05-.374-.025-.523-.075-.15-.67-1.613-.916-2.211-.242-.579-.488-.5-.67-.51-.173-.007-.373-.009-.573-.009a1.09 1.09 0 0 0-.796.373c-.273.299-1.042 1.017-1.042 2.48 0 1.463 1.066 2.876 1.214 3.074.149.199 2.1 3.211 5.09 4.502.711.306 1.264.489 1.696.626.713.227 1.362.195 1.874.118.572-.085 1.77-.723 2.021-1.422.25-.699.25-1.298.174-1.422-.074-.124-.273-.199-.572-.348z"/>
          </svg>
        );
    }
  };

  // Handlers
  const handleCreateConnection = async () => {
    if (!newAccountName.trim()) return;
    setCreateLoading(true);
    
    // Enviar tipo de conta apenas para WhatsApp
    const accountType = newAccountPlatform === 'whatsapp' ? newAccountType : undefined;
    const connection = await createConnection(newAccountName, newAccountPlatform as any, accountType);
    setCreateLoading(false);
    
    if (connection) {
      setNewAccountName('');
      setNewAccountPlatform('whatsapp');
      setNewAccountType('unofficial');
      setShowCreateModal(false);
      
      // Mudar para a plataforma criada automaticamente
      setSelectedPlatform(newAccountPlatform as Platform);
      
      toast({
        title: "Conexão Criada",
        description: `${newAccountName} (${newAccountPlatform}) foi criada com sucesso!`,
      });
    }
  };

  const handleConnect = async (account: any) => {
    setSelectedAccount(account);
    
    // Comportamento específico por plataforma
    if (account.platform === 'whatsapp') {
      // WhatsApp: Abrir QR Code
      await connectConnection(account.id);
      setShowQRModal(true);
      
      // Timeout para fechar modal automaticamente após 5 minutos
      setTimeout(() => {
        if (showQRModal) {
          console.log('Timeout: Fechando modal de QR code automaticamente');
          setShowQRModal(false);
          setSelectedAccount(null);
        }
      }, 5 * 60 * 1000); // 5 minutos
    } else {
      // Outras plataformas: Conectar diretamente sem QR Code
      try {
        await connectConnection(account.id);
        
        // Mostrar toast específico para cada plataforma
        const platformMessages: Record<string, string> = {
          instagram: 'Iniciando conexão com Instagram...',
          telegram: 'Iniciando conexão com Telegram...',
          facebook: 'Iniciando conexão com Facebook...',
          api: 'Iniciando conexão com API...'
        };
        
        toast({
          title: "Conectando",
          description: platformMessages[account.platform] || `Iniciando conexão com ${account.platform}...`,
        });

        // Mostrar toast de sucesso
        toast({
          title: "Conectado!",
          description: `${account.platform} conectado com sucesso!`,
        });
        
      } catch (error) {
        console.error('❌ Erro ao conectar:', error);
        toast({
          title: "Erro",
          description: `Falha ao conectar com ${account.platform}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleDisconnect = async (account: any) => {
    try {
      console.log('🔌 Desconectando conta:', account.name);
      await disconnectConnection(account.id);
    } catch (error) {
      console.error('❌ Erro ao desconectar conta:', error);
      toast({
        title: "Erro",
        description: "Falha ao desconectar conta",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (account: any) => {
    await deleteConnection(account.id);
  };

  const handleOpenSettings = (account: any) => {
    setAccountToEdit(account);
    setUpdatedAccountName(account.name || '');
    setUpdatedAssistantId(account.config?.assistant_id || 'none');
    setUpdatedMode(account.config?.mode || 'ia');
    setUpdatedFlowId(account.config?.flow_id || 'none');
    setShowSettingsModal(true);
  };

  const handleOpenDelete = (account: any) => {
    setAccountToEdit(account);
    setShowDeleteModal(true);
  };

  const handleUpdateAccount = async () => {
    if (!updatedAccountName.trim() || !accountToEdit) {
      return;
    }
    
    // Preparar configuração atualizada
    const currentConfig = accountToEdit.config || {};
    const updatedConfig = {
      ...currentConfig,
      mode: updatedMode,
    };
    
    if (updatedMode === 'ia') {
      updatedConfig.assistant_id = updatedAssistantId && updatedAssistantId !== 'none' ? updatedAssistantId : null;
      updatedConfig.flow_id = null;
    } else {
      updatedConfig.flow_id = updatedFlowId && updatedFlowId !== 'none' ? updatedFlowId : null;
      updatedConfig.assistant_id = null;
    }
    
    const updates = {
      name: updatedAccountName,
      config: updatedConfig
    };
    
    await updateConnection(accountToEdit.id, updates);
    setShowSettingsModal(false);
    setAccountToEdit(null);
    setUpdatedAccountName('');
    setUpdatedAssistantId('none');
    setUpdatedFlowId('none');
    setUpdatedMode('ia');
  };

  const handleDeleteConnection = async () => {
    if (!accountToEdit) return;
    await deleteConnection(accountToEdit.id);
    setShowDeleteModal(false);
    setAccountToEdit(null);
  };

  // Exportar dados
  const exportData = () => {
    const csvContent = [
      ['Nome', 'Plataforma', 'Status', 'Telefone', 'Criada em', 'Atualizada em'],
      ...filteredConnections.map(connection => [
        connection.name,
        connection.platform,
        connection.status,
        connection.config.phone_number || '-',
        new Date(connection.created_at).toLocaleDateString(),
        new Date(connection.updated_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `conexoes-${selectedPlatform}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Listener para fechar modal de QR code quando conexão for bem-sucedida
  useEffect(() => {
    const handleConnectionSuccess = (event: CustomEvent) => {
      console.log('Conexão WhatsApp bem-sucedida, fechando modal:', event.detail);
      setShowQRModal(false);
      setSelectedAccount(null);
    };

    window.addEventListener('whatsapp-connection-success', handleConnectionSuccess as EventListener);

    return () => {
      window.removeEventListener('whatsapp-connection-success', handleConnectionSuccess as EventListener);
    };
  }, []);

  return (
          <PermissionGuard requiredPermissions={['manage_connections']}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-100">
          <div className="p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl text-slate-900">
                  Conexões
                </h1>
                <p className="text-sm sm:text-base text-slate-600">
                  Gerencie suas conexões de todas as plataformas
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={exportData}
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Download size={16} className="mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
                  size="lg"
                >
                  <Plus size={18} />
                  <span>Nova Conexão</span>
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <Card className="bg-blue-50 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <div className="p-2 sm:p-3 bg-blue-100 rounded-xl">
                      <MessageCircle className="text-blue-600" size={20} />
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

            {/* Seletor de Plataforma */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="platform">Plataforma:</Label>
                  <Select value={selectedPlatform} onValueChange={(value: Platform) => setSelectedPlatform(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Plataformas</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Controles de Visualização */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 w-full max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                      <Input
                        placeholder="Buscar por nome ou telefone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 w-full"
                      />
                    </div>
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
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                    >
                      <Grid3X3 size={16} className="mr-2" />
                      Cards
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <List size={16} className="mr-2" />
                      Lista
                    </Button>
                    <Button
                      onClick={() => {
                        // TODO: Implementar reconexão de todas as conexões
                        toast({
                          title: "Reconexão",
                          description: "Funcionalidade em desenvolvimento",
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw size={16} className="mr-2" />
                      <span className="hidden sm:inline">Reconectar</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Conexões */}
            {viewMode === 'cards' ? (
              <AccountsCards
                accounts={paginatedConnections}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSettings={handleOpenSettings}
                onDelete={handleOpenDelete}
                loading={loading}
              />
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {paginatedConnections.map((connection) => (
                      <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                            {getPlatformIcon(connection.platform)}
                          </div>
                          <div>
                            <h3 className="">{connection.name}</h3>
                            {connection.config.phone_number && (
                              <p className="text-sm text-slate-600">{connection.config.phone_number}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(connection.status)}
                            <span className="text-sm capitalize">{connection.status}</span>
                          </div>
                          <div className="flex space-x-2">
                            {connection.status === 'disconnected' ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleConnect(connection)}
                              >
                                <QrCode size={14} className="mr-2" />
                                Conectar
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDisconnect(connection)}
                              >
                                <WifiOff size={14} className="mr-2" />
                                Desconectar
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              <Settings size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Mostrando {startIndex + 1}-{Math.min(endIndex, filteredConnections.length)} de {filteredConnections.length} conexões
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                      <span className="text-sm">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Modal Criar Conta */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
              <DialogContent className="sm:max-w-md mx-4">
                <DialogHeader>
                  <DialogTitle className="text-xl text-slate-900">
                    Nova Conexão
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Nome da Conexão */}
                  <div className="space-y-2">
                    <Label htmlFor="accountName" className="text-sm text-slate-700">
                      Nome da Conexão
                    </Label>
                    <Input
                      id="accountName"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Ex: Suporte Principal"
                      className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Seleção de Plataforma */}
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-700">
                      Plataforma
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'whatsapp', label: 'WhatsApp', icon: getPlatformIcon('whatsapp') },
                        { value: 'instagram', label: 'Instagram', icon: getPlatformIcon('instagram') },
                        { value: 'telegram', label: 'Telegram', icon: getPlatformIcon('telegram') },
                        { value: 'facebook', label: 'Facebook', icon: getPlatformIcon('facebook') }
                      ].map((platform) => (
                        <button
                          key={platform.value}
                          type="button"
                          onClick={() => setNewAccountPlatform(platform.value)}
                          className={`p-3 rounded-lg border-2 transition-all duration-200 flex items-center space-x-2 ${
                            newAccountPlatform === platform.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {platform.icon}
                          <span className="text-sm">{platform.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tipo de Conta - Apenas para WhatsApp */}
                  {newAccountPlatform === 'whatsapp' && (
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-700">
                        Tipo de Conta WhatsApp
                      </Label>
                      <div className="flex space-x-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="unofficial"
                            name="accountType"
                            value="unofficial"
                            checked={newAccountType === 'unofficial'}
                            onChange={(e) => setNewAccountType(e.target.value as 'official' | 'unofficial')}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor="unofficial" className="text-sm text-slate-700">
                            Não Oficial
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="official"
                            name="accountType"
                            value="official"
                            checked={newAccountType === 'official'}
                            onChange={(e) => setNewAccountType(e.target.value as 'official' | 'unofficial')}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor="official" className="text-sm text-slate-700">
                            Oficial
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateConnection}
                      disabled={createLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {createLoading ? 'Criando...' : 'Criar Conexão'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Modal QR Code */}
            <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
              <DialogContent className="max-w-md mx-4">
                <DialogHeader>
                  <DialogTitle className="text-xl text-slate-900">
                    Conectar {selectedAccount?.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 text-center">
                  {qrCode ? (
                    <>
                      <div className="bg-white p-4 sm:p-6 rounded-2xl mx-auto w-fit shadow-lg border border-slate-200">
                        <img 
                          src={qrCode} 
                          alt="QR Code WhatsApp" 
                          className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg"
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
                    <div className="py-8 sm:py-12">
                      <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600">Gerando QR Code...</p>
                    </div>
                  )}
                  
                  {/* Botão para fechar manualmente */}
                  <div className="pt-4 border-t border-slate-200">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowQRModal(false);
                        setSelectedAccount(null);
                      }}
                      className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar Conexão
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Modal Configurações */}
            <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
              <DialogContent className="sm:max-w-md mx-4">
                <DialogHeader>
                  <DialogTitle className="text-xl text-slate-900">
                    Configurar Conexão
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="updatedAccountName" className="text-sm text-slate-700">
                      Nome da Conexão
                    </Label>
                    <Input
                      id="updatedAccountName"
                      value={updatedAccountName}
                      onChange={(e) => setUpdatedAccountName(e.target.value)}
                      placeholder="Nome da conexão"
                      className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-slate-700">Modo de Operação</Label>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={updatedMode === 'ia'}
                          onCheckedChange={(checked) => setUpdatedMode(checked ? 'ia' : 'flow')}
                        />
                        <span className="text-sm text-slate-600">IA</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={updatedMode === 'flow'}
                          onCheckedChange={(checked) => setUpdatedMode(checked ? 'flow' : 'ia')}
                        />
                        <span className="text-sm text-slate-600">Flow</span>
                      </div>
                    </div>
                  </div>

                  {updatedMode === 'ia' && (
                    <div className="space-y-2">
                      <Label htmlFor="assistant" className="text-sm text-slate-700">
                        Assistente IA
                      </Label>
                      <Select value={updatedAssistantId} onValueChange={setUpdatedAssistantId}>
                        <SelectTrigger className="border-slate-200">
                          <SelectValue placeholder="Selecione um assistente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {(assistants || []).map((assistant) => (
                            <SelectItem key={assistant.id} value={assistant.id}>
                              {assistant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {updatedMode === 'flow' && (
                    <div className="space-y-2">
                      <Label htmlFor="flow" className="text-sm text-slate-700">
                        Flow
                      </Label>
                      <Select value={updatedFlowId} onValueChange={setUpdatedFlowId}>
                        <SelectTrigger className="border-slate-200">
                          <SelectValue placeholder="Selecione um flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {(flows || []).map((flow) => (
                            <SelectItem key={flow.id} value={flow.id}>
                              {flow.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowSettingsModal(false)}
                      className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleUpdateAccount}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Modal Deletar */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
              <DialogContent className="sm:max-w-md mx-4">
                <DialogHeader>
                  <DialogTitle className="text-xl text-slate-900">
                    Confirmar Exclusão
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <p className="text-slate-600">
                    Tem certeza que deseja excluir a conexão <strong>{accountToEdit?.name}</strong>? 
                    Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleDeleteConnection}
                      variant="destructive"
                      className="flex-1"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </ErrorBoundary>
    </PermissionGuard>
  );
};

export default ConnectionsPage;