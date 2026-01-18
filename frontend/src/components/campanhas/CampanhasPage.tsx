import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Send, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Play,
  Pause,
  MoreHorizontal,
  FileText,
  Eye,
  Trash2,
  Edit
} from 'lucide-react';
import { BulkMessageDialog } from './BulkMessageDialog';
import { CreateCampanhaDialog } from './CreateCampanhaDialog';
import { CreateTemplateDialog } from './CreateTemplateDialog';
import { CampanhaDetalhes } from './CampanhaDetalhes';
import { TemplatesList } from './TemplatesList';
import { useCampanhas } from '@/hooks/useCampanhas';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Campanha {
  id: string;
  nome: string;
  status: 'rascunho' | 'em_execucao' | 'finalizada' | 'erro' | 'pausada';
  total_destinatarios: number;
  enviados: number;
  respondidos: number;
  data_inicio: string;
  data_fim?: string;
  usar_ia: boolean;
}

export function CampanhasPage() {
  const { 
    campanhas, 
    isLoading, 
    refetch, 
    iniciarCampanha, 
    pausarCampanha, 
    retomarCampanha,
    deletarCampanha,
    reiniciarCampanha,
    isStarting,
    isPausing,
    isResuming,
    isDeleting,
    isRestarting
  } = useCampanhas();
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('campanhas');
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Ajustar tab baseado na rota
  useEffect(() => {
    if (searchParams.get('tab') === 'templates') {
      setActiveTab('templates');
    } else {
      setActiveTab('campanhas');
    }
  }, [location.pathname, searchParams]);

  // ✅ CORREÇÃO: Garantir que campanhas seja sempre um array
  const campanhasList = campanhas || [];

  // ✅ DEBUG: Log para verificar o estado
  console.log('🔍 CampanhasPage - Estado:', {
    campanhas,
    campanhasList,
    isLoading,
    campanhasType: typeof campanhas,
    campanhasLength: campanhas?.length
  });

  // ✅ CORREÇÃO: Handlers para os botões
  const handleIniciarCampanha = async (campanhaId: string) => {
    try {
      await iniciarCampanha(campanhaId);
      console.log('✅ Campanha iniciada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao iniciar campanha:', error);
    }
  };

  const handlePausarCampanha = async (campanhaId: string) => {
    try {
      await pausarCampanha(campanhaId);
      console.log('✅ Campanha pausada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao pausar campanha:', error);
    }
  };

  const handleRetomarCampanha = async (campanhaId: string) => {
    try {
      await retomarCampanha(campanhaId);
      console.log('✅ Campanha retomada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao retomar campanha:', error);
    }
  };

  const handleReiniciarCampanha = async (campanhaId: string) => {
    try {
      await reiniciarCampanha(campanhaId);
      console.log('✅ Campanha reiniciada com sucesso');
      refetch();
    } catch (error) {
      console.error('❌ Erro ao reiniciar campanha:', error);
    }
  };

  const handleVerDetalhes = (campanhaId: string) => {
    console.log('🔍 Ver detalhes da campanha:', campanhaId);
    setSelectedCampanha(campanhaId);
  };

  const handleDeletarCampanha = async (campanhaId: string) => {
    if (confirm('Tem certeza que deseja deletar esta campanha?')) {
      try {
        await deletarCampanha(campanhaId);
        console.log('✅ Campanha deletada com sucesso');
      } catch (error) {
        console.error('❌ Erro ao deletar campanha:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_execucao':
        return 'bg-green-100 text-green-800';
      case 'finalizada':
        return 'bg-blue-100 text-blue-800';
      case 'pausada':
        return 'bg-yellow-100 text-yellow-800';
      case 'erro':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'em_execucao':
        return <Play className="h-4 w-4" />;
      case 'finalizada':
        return <CheckCircle className="h-4 w-4" />;
      case 'pausada':
        return <Pause className="h-4 w-4" />;
      case 'erro':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'em_execucao':
        return 'Em Execução';
      case 'finalizada':
        return 'Finalizada';
      case 'pausada':
        return 'Pausada';
      case 'erro':
        return 'Erro';
      default:
        return 'Rascunho';
    }
  };

  const handleCampanhaCreated = () => {
    // Recarregar lista de campanhas
    console.log('Campanha criada com sucesso!');
    refetch();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl text-gray-900">Campanhas</h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">Gerencie suas campanhas de marketing e comunicação</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-auto">
            <BulkMessageDialog onMessageSent={handleCampanhaCreated} />
          </div>
          <div className="w-full sm:w-auto">
            <CreateCampanhaDialog onCampanhaCreated={handleCampanhaCreated} />
          </div>
          <Button 
            onClick={() => setShowCreateTemplate(true)}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Criar Template</span>
            <span className="sm:hidden">Template</span>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation com scroll */}
      <div className="-mx-4 sm:mx-0">
        <div className="px-4 overflow-x-auto no-scrollbar">
          <Tabs value={activeTab} onValueChange={setActiveTab}
        className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="campanhas">
              <Send className="h-4 w-4 mr-2" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total de Campanhas</CardTitle>
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Send className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-blue-600">{campanhasList.length}</div>
                  <p className="text-xs text-muted-foreground">Todas as campanhas criadas</p>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Em Execução</CardTitle>
                  <div className="p-2 bg-green-100 rounded-full">
                    <Play className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-green-600">
                    {campanhasList.filter(c => c.status === 'em_execucao').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Campanhas ativas</p>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Mensagens Enviadas</CardTitle>
                  <div className="p-2 bg-purple-100 rounded-full">
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-purple-600">
                    {campanhasList.reduce((acc, c) => acc + c.enviados, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Total entregues</p>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Taxa de Resposta</CardTitle>
                  <div className="p-2 bg-orange-100 rounded-full">
                    <Users className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-orange-600">
                    {campanhasList.length > 0 
                      ? `${Math.round((campanhasList.reduce((acc, c) => acc + c.respondidos, 0) / 
                          Math.max(campanhasList.reduce((acc, c) => acc + c.enviados, 0), 1)) * 100)}%`
                      : '0%'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">Respostas recebidas</p>
                </CardContent>
              </Card>
            </div>

            {/* Campanhas List */}
            <div className="space-y-6">
              <h2 className="text-xl">Campanhas Recentes</h2>
              
              {isLoading ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <h3 className="text-xl mb-2">Carregando campanhas...</h3>
                  </CardContent>
                </Card>
              ) : campanhasList.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Send className="h-16 w-16 text-muted-foreground mb-6" />
                    <h3 className="text-xl mb-2">Nenhuma campanha encontrada</h3>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {campanhasList.map((campanha) => (
                    <Card key={campanha.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          {/* Informações principais */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg truncate">{campanha.nome}</h3>
                              <Badge className={getStatusColor(campanha.status)}>
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(campanha.status)}
                                  {getStatusText(campanha.status)}
                                </div>
                              </Badge>
                              {campanha.usar_ia && (
                                <Badge variant="outline" className="text-xs">
                                  IA Ativada
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                              <span>Criada em {new Date(campanha.data_inicio).toLocaleDateString()}</span>
                              <span>{campanha.enviados}/{campanha.total_destinatarios} enviados</span>
                            </div>

                            {/* Barra de progresso */}
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${campanha.total_destinatarios > 0 
                                    ? (campanha.enviados / campanha.total_destinatarios) * 100 
                                    : 0}%` 
                                }}
                              />
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                            {campanha.status === 'rascunho' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleIniciarCampanha(campanha.id)}
                                disabled={isStarting}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                {isStarting ? 'Iniciando...' : 'Iniciar'}
                              </Button>
                            )}
                            {campanha.status === 'em_execucao' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handlePausarCampanha(campanha.id)}
                                disabled={isPausing}
                              >
                                <Pause className="h-4 w-4 mr-1" />
                                {isPausing ? 'Pausando...' : 'Pausar'}
                              </Button>
                            )}
                            {campanha.status === 'pausada' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleRetomarCampanha(campanha.id)}
                                disabled={isResuming}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                {isResuming ? 'Retomando...' : 'Retomar'}
                              </Button>
                            )}
                            
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleVerDetalhes(campanha.id)}
                              className="flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleVerDetalhes(campanha.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeletarCampanha(campanha.id)}
                                  className="text-red-600 focus:text-red-600"
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {isDeleting ? 'Deletando...' : 'Deletar'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {(campanha.status === 'finalizada' || campanha.status === 'pausada' || campanha.status === 'erro') && (
                                  <DropdownMenuItem onClick={() => handleReiniciarCampanha(campanha.id)} disabled={isRestarting}>
                                    <span className="mr-2">⟲</span>
                                    {isRestarting ? 'Reiniciando...' : 'Reiniciar'}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <TemplatesList />
          </TabsContent>
        </Tabs>
      </div>
    </div>

      {/* Dialog de Criar Template */}
      <CreateTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
      />

      {/* Dialog de Detalhes da Campanha */}
      {selectedCampanha && (
        <CampanhaDetalhes
          campanhaId={selectedCampanha}
          open={!!selectedCampanha}
          onOpenChange={(open) => !open && setSelectedCampanha(null)}
        />
      )}
    </div>
  );
}