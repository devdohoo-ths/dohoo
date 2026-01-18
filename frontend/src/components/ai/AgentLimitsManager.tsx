import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAgentLimits } from '@/hooks/useAgentLimits';
import { useAuth } from '@/hooks/useAuth';
import { Users, Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  name: string;
  email: string;
}

export const AgentLimitsManager = () => {
  const { agentLimits, myLimit, loading, error, updateAgentLimit, fetchOrganizationAgents, isAdmin } = useAgentLimits();
  const { user } = useAuth();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [monthlyLimit, setMonthlyLimit] = useState(1000);
  const [dailyLimit, setDailyLimit] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  // Buscar agentes quando componente carrega
  useEffect(() => {
    const loadAgents = async () => {
      const agentsData = await fetchOrganizationAgents();
      setAgents(agentsData);
    };
    loadAgents();
  }, [fetchOrganizationAgents]);

  const handleUpdateLimit = async () => {
    if (!selectedAgent) {
      toast({
        title: "Erro",
        description: "Selecione um agente",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updateAgentLimit(selectedAgent, monthlyLimit, dailyLimit, isActive);
      toast({
        title: "Sucesso",
        description: "Limite atualizado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateAllAgents = async () => {
    if (agents.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum agente encontrado",
        variant: "destructive"
      });
      return;
    }

    setIsUpdatingAll(true);
    try {
      // Atualizar todos os agentes
      const updatePromises = agents.map(agent => 
        updateAgentLimit(agent.id, monthlyLimit, dailyLimit, isActive)
      );
      
      await Promise.all(updatePromises);
      
      toast({
        title: "Sucesso",
        description: `Limites atualizados para ${agents.length} agentes`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdatingAll(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Controle de Limites por Agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Erro ao carregar limites: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meu Limite (para agentes) */}
      {myLimit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Meu Limite de Créditos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Limite Mensal */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Limite Mensal</Label>
                  <Badge variant={myLimit.monthly_remaining > 0 ? "default" : "destructive"}>
                    {myLimit.current_month_used} / {myLimit.monthly_limit}
                  </Badge>
                </div>
                <Progress 
                  value={getUsagePercentage(myLimit.current_month_used, myLimit.monthly_limit)} 
                  className="h-2 mb-2"
                />
                <p className={`text-sm ${getUsageColor(getUsagePercentage(myLimit.current_month_used, myLimit.monthly_limit))}`}>
                  Restantes: {myLimit.monthly_remaining} créditos
                </p>
              </div>

              {/* Limite Diário */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Limite Diário</Label>
                  <Badge variant={myLimit.daily_remaining > 0 ? "default" : "destructive"}>
                    {myLimit.current_day_used} / {myLimit.daily_limit}
                  </Badge>
                </div>
                <Progress 
                  value={getUsagePercentage(myLimit.current_day_used, myLimit.daily_limit)} 
                  className="h-2 mb-2"
                />
                <p className={`text-sm ${getUsageColor(getUsagePercentage(myLimit.current_day_used, myLimit.daily_limit))}`}>
                  Restantes: {myLimit.daily_remaining} créditos
                </p>
              </div>
            </div>

            {!myLimit.is_active && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Seus limites estão desativados. Entre em contato com o administrador.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gerenciamento de Limites (para admins) */}
      {isAdmin() && (
        <>
          {/* Formulário para atualizar limites */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurar Limites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agent-select">Agente</Label>
                  <select
                    id="agent-select"
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Selecione um agente</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="is-active">Status</Label>
                  <select
                    id="is-active"
                    value={isActive ? 'true' : 'false'}
                    onChange={(e) => setIsActive(e.target.value === 'true')}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="monthly-limit">Limite Mensal</Label>
                  <Input
                    id="monthly-limit"
                    type="number"
                    value={monthlyLimit.toString()}
                    onChange={(e) => setMonthlyLimit(parseInt(e.target.value) || 0)}
                    placeholder="1000"
                  />
                </div>

                <div>
                  <Label htmlFor="daily-limit">Limite Diário</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    value={dailyLimit.toString()}
                    onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <Button 
                  onClick={handleUpdateLimit} 
                  disabled={!selectedAgent || isUpdating}
                >
                  {isUpdating ? 'Atualizando...' : 'Atualizar Agente'}
                </Button>

                <Button 
                  onClick={handleUpdateAllAgents} 
                  disabled={agents.length === 0 || isUpdatingAll}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  {isUpdatingAll ? 'Atualizando Todos...' : `Liberar para Todos (${agents.length})`}
                </Button>
              </div>

              {agents.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    💡 <strong>Dica:</strong> Use "Liberar para Todos" para aplicar os mesmos limites a todos os agentes da organização de uma vez.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de todos os limites */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Limites da Organização ({agentLimits.length} agentes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentLimits.length > 0 ? (
                <div className="space-y-4">
                  {agentLimits.map((limit) => (
                    <div key={limit.user_id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="">{limit.user_name}</h3>
                          <p className="text-sm text-gray-600">{limit.user_email}</p>
                        </div>
                        <Badge variant={limit.is_active ? "default" : "secondary"}>
                          {limit.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Limite Mensal */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm">Mensal</span>
                            <span className="text-sm">
                              {limit.current_month_used} / {limit.monthly_limit}
                            </span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(limit.current_month_used, limit.monthly_limit)} 
                            className="h-2"
                          />
                          <p className="text-xs text-gray-600 mt-1">
                            Restantes: {limit.monthly_remaining}
                          </p>
                        </div>

                        {/* Limite Diário */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm">Diário</span>
                            <span className="text-sm">
                              {limit.current_day_used} / {limit.daily_limit}
                            </span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(limit.current_day_used, limit.daily_limit)} 
                            className="h-2"
                          />
                          <p className="text-xs text-gray-600 mt-1">
                            Restantes: {limit.daily_remaining}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum limite configurado ainda</p>
                  <p className="text-sm">Configure limites para os agentes da organização</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};