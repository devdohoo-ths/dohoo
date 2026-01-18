import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Brain, Users, MessageCircle, BarChart3, Zap, 
  Settings, Trash2, ToggleLeft, ToggleRight, Loader2 
} from 'lucide-react';
import { useConfigs } from '../../hooks/useConfigs';
import { useStrategies } from '../../hooks/useStrategies';
import { useTeams } from '@/hooks/useTeams';
import { useFlows } from '@/components/flow/hooks/useFlows';
import ConfigForm from '../ConfigForm';

/**
 * Dashboard Principal do Módulo de Atendimento Inteligente
 * 
 * Este é o componente principal que exibe:
 * - Métricas gerais do módulo
 * - Lista de produtos ativos
 * - Ações rápidas
 */
export const ProductDashboard: React.FC = () => {
  const { configs, loading: loadingConfigs, activeConfigs, totalConfigs, deleteConfig, toggleActive } = useConfigs();
  const { strategies, loading: loadingStrategies, activeStrategies } = useStrategies();
  const { teams, loading: loadingTeams } = useTeams();
  const { flows, loading: loadingFlows } = useFlows();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isLoading = loadingConfigs || loadingStrategies;

  const handleEdit = (config: any) => {
    setEditingConfig(config);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta configuração?')) {
      return;
    }
    setDeletingId(id);
    await deleteConfig(id);
    setDeletingId(null);
  };

  const handleToggleActive = async (config: any) => {
    await toggleActive(config.id, config.is_active);
  };

  const handleCloseForm = () => {
    setShowCreateForm(false);
    setEditingConfig(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-600" />
            Atendimento Inteligente
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas configurações de atendimento automatizado
          </p>
        </div>
        <Button 
          className="flex items-center gap-2"
          onClick={() => setShowCreateForm(true)}
        >
          <Plus className="w-4 h-4" />
          Nova Configuração
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Configurações Ativas</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl">{activeConfigs.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalConfigs === 0 ? 'Nenhuma configuração criada' : `${totalConfigs} no total`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Estratégias</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl">{activeStrategies.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Times com estratégias
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Atendimentos Hoje</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Em breve
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Performance</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">-</div>
            <p className="text-xs text-muted-foreground mt-1">
              Em breve
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Configurações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Configurações de Atendimento</span>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-16 h-16 mx-auto mb-4 text-purple-600 opacity-50" />
              <h3 className="text-xl mb-2">
                Nenhuma configuração criada
              </h3>
              <p className="text-muted-foreground mb-6">
                Crie sua primeira configuração para começar a usar o Atendimento Inteligente
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Configuração
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map(config => (
                <Card key={config.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg">{config.name}</h4>
                          <Badge variant={config.is_active ? "default" : "secondary"}>
                            {config.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        {config.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {config.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          {config.flow_id && (
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              <span className="text-muted-foreground">Flow configurado</span>
                            </div>
                          )}
                          {config.team_id && (
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              <span className="text-muted-foreground">
                                {typeof config.teams === 'object' && config.teams && 'name' in config.teams 
                                  ? config.teams.name 
                                  : 'Time configurado'}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            <span className="text-muted-foreground">
                              {config.chat_config?.type || 'Chat híbrido'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(config)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className={config.is_active ? 'text-green-600' : 'text-gray-400'}
                          onClick={() => handleToggleActive(config)}
                        >
                          {config.is_active ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600"
                          onClick={() => handleDelete(config.id)}
                          disabled={deletingId === config.id}
                        >
                          {deletingId === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulário de Criação/Edição */}
      <ConfigForm
        open={showCreateForm}
        onClose={handleCloseForm}
        config={editingConfig}
        teams={teams.map(t => ({ id: t.id, name: t.name }))}
        flows={flows.map(f => ({ id: f.id, name: f.nome }))}
      />
    </div>
  );
};

export default ProductDashboard;

