
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Workflow, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Play, 
  Power,
  Users,
  AlertTriangle,
  Smartphone,
  AlertCircle
} from 'lucide-react';
import { Flow } from './types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FlowListPageProps {
  flows: Flow[];
  loading: boolean;
  onCreateNew: () => void;
  onEditFlow: (flow: Flow) => void;
  onDeleteFlow: (id: string) => void;
  onToggleActive: (flow: Flow) => void;
}

export const FlowListPage = ({ 
  flows, 
  loading, 
  onCreateNew, 
  onEditFlow, 
  onDeleteFlow, 
  onToggleActive 
}: FlowListPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredFlows = flows.filter(flow => {
    const matchesSearch = flow.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flow.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'active') return matchesSearch && flow.ativo;
    if (filter === 'inactive') return matchesSearch && !flow.ativo;
    return matchesSearch;
  });

  const getChannelIcon = (canal?: string) => {
    switch (canal) {
      case 'whatsapp': return '📱';
      case 'webchat': return '💬';
      case 'telegram': return '✈️';
      default: return '🌐';
    }
  };

  const getChannelName = (canal?: string) => {
    switch (canal) {
      case 'whatsapp': return 'WhatsApp';
      case 'webchat': return 'WebChat';
      case 'telegram': return 'Telegram';
      default: return 'Universal';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando fluxos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Workflow className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl text-gray-900">
                  Fluxos de Automação
                </h1>
                <p className="text-gray-600">
                  Gerencie seus fluxos de atendimento automatizado
                </p>
              </div>
            </div>
            <Button onClick={onCreateNew} size="lg" className="w-full sm:w-auto">
              <Plus className="h-5 w-5 mr-2" />
              Criar Novo Fluxo
            </Button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar fluxos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos ({flows.length})
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              Ativos ({flows.filter(f => f.ativo).length})
            </Button>
            <Button
              variant={filter === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('inactive')}
            >
              Inativos ({flows.filter(f => !f.ativo).length})
            </Button>
          </div>
        </div>

        {/* Grid de Cards */}
        {filteredFlows.length === 0 ? (
          <div className="text-center py-12">
            <Workflow className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg text-gray-900 mb-2">
              {searchTerm ? 'Nenhum fluxo encontrado' : 'Nenhum fluxo criado'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? 'Tente ajustar os filtros ou termos de busca' 
                : 'Crie seu primeiro fluxo de automação para começar'
              }
            </p>
            {!searchTerm && (
              <Button onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Fluxo
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFlows.map((flow) => (
              <Card key={flow.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                          {flow.nome}
                        </CardTitle>
                        <Badge variant={flow.ativo ? 'default' : 'secondary'}>
                          {flow.ativo ? (
                            <><Power className="h-3 w-3 mr-1" /> Ativo</>
                          ) : (
                            'Inativo'
                          )}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <div className="flex items-center space-x-1">
                          <span>{getChannelIcon(flow.canal)}</span>
                          <span>{getChannelName(flow.canal)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span>{flow.nodes.length} blocos</span>
                        </div>
                      </div>

                      {/* Informações da conta vinculada */}
                      <div className="flex items-center space-x-2 text-sm">
                        <Smartphone className="h-3 w-3 text-gray-400" />
                        {flow.conta_id ? (
                          <Badge variant="outline" className="text-xs">
                            Conta vinculada
                          </Badge>
                        ) : (
                          <div className="flex items-center space-x-1 text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            <span className="text-xs">Sem conta vinculada</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {flow.descricao || 'Sem descrição disponível'}
                  </p>
                  
                  {/* Visualização mini do fluxo */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      {flow.nodes.slice(0, 4).map((node, index) => (
                        <div key={node.id} className="flex items-center">
                          <div className="w-6 h-6 bg-blue-100 rounded border flex items-center justify-center text-xs">
                            {node.type === 'inicio' ? '▶️' : 
                             node.type === 'ia' ? '🤖' : 
                             node.type === 'mensagem' ? '💬' : 
                             node.type === 'decisao' ? '❓' : 
                             node.type === 'transferencia' ? '👤' : 
                             node.type === 'api' ? '🔗' :
                             '⏹️'}
                          </div>
                          {index < Math.min(flow.nodes.length - 1, 3) && (
                            <div className="w-4 h-px bg-gray-300 mx-1"></div>
                          )}
                        </div>
                      ))}
                      {flow.nodes.length > 4 && (
                        <span className="text-xs text-gray-400">+{flow.nodes.length - 4}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => onEditFlow(flow)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onToggleActive(flow)}
                      disabled={flow.ativo && !flow.conta_id}
                    >
                      <Power className="h-3 w-3 mr-1" />
                      {flow.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center space-x-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <span>Confirmar Exclusão</span>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o fluxo "{flow.nome}"? 
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => flow.id && onDeleteFlow(flow.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir Fluxo
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
