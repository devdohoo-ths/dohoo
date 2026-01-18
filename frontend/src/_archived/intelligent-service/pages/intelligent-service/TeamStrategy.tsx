import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Users, Target, RotateCw, TrendingUp, Radio, 
  CheckCircle2, Settings2, Loader2 
} from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { useStrategies } from '../hooks/useStrategies';
import type { TeamDeliveryStrategy } from '../types';

/**
 * Página de Estratégias de Time
 * Configure estratégias de distribuição de atendimento
 */
export default function TeamStrategy() {
  const { teams, loading: loadingTeams } = useTeams();
  const { strategies, loading: loadingStrategies, saveStrategy, getStrategyByTeam } = useStrategies();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [strategyType, setStrategyType] = useState<'round_robin' | 'priority' | 'broadcast' | 'workload'>('round_robin');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const currentStrategy = selectedTeamId ? getStrategyByTeam(selectedTeamId) : null;

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    const strategy = getStrategyByTeam(teamId);
    if (strategy) {
      setStrategyType(strategy.strategy_type);
      setIsActive(strategy.is_active);
    } else {
      setStrategyType('round_robin');
      setIsActive(true);
    }
  };

  const handleSave = async () => {
    if (!selectedTeamId) return;

    setSaving(true);
    await saveStrategy({
      team_id: selectedTeamId,
      strategy_type: strategyType,
      config: {},
      is_active: isActive
    });
    setSaving(false);
  };

  const strategyDescriptions = {
    round_robin: {
      name: 'Rodízio (Round Robin)',
      description: 'Distribui atendimentos em ordem rotativa entre os membros do time',
      icon: RotateCw,
      color: 'text-blue-600'
    },
    priority: {
      name: 'Prioridade',
      description: 'Distribui para membros com base em níveis de prioridade configurados',
      icon: TrendingUp,
      color: 'text-purple-600'
    },
    broadcast: {
      name: 'Broadcast',
      description: 'Envia para todos os membros do time simultaneamente',
      icon: Radio,
      color: 'text-orange-600'
    },
    workload: {
      name: 'Carga de Trabalho',
      description: 'Distribui com base na carga atual de cada membro',
      icon: Target,
      color: 'text-green-600'
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl flex items-center gap-3">
          <Users className="w-8 h-8 text-green-600" />
          Estratégias de Time
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure como os atendimentos serão distribuídos para cada time
        </p>
      </div>

      {/* Seleção de Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Selecione um Time</span>
            {loadingTeams && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeamId} onValueChange={handleTeamChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um time para configurar" />
            </SelectTrigger>
            <SelectContent>
              {teams.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  Nenhum time disponível
                </div>
              ) : (
                teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{team.name}</span>
                      {getStrategyByTeam(team.id) && (
                        <CheckCircle2 className="w-4 h-4 ml-2 text-green-600" />
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {currentStrategy && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Este time já possui uma estratégia configurada: <strong>{strategyDescriptions[currentStrategy.strategy_type].name}</strong>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTeamId && (
        <>
          {/* Tipos de Estratégia */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Estratégia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(strategyDescriptions) as Array<keyof typeof strategyDescriptions>).map(type => {
                  const strategy = strategyDescriptions[type];
                  const Icon = strategy.icon;
                  const isSelected = strategyType === type;

                  return (
                    <Card
                      key={type}
                      className={`cursor-pointer transition-all border-2 ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-gray-300'
                      }`}
                      onClick={() => setStrategyType(type)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Icon className={`w-6 h-6 mt-1 ${strategy.color}`} />
                          <div className="flex-1">
                            <h4 className="mb-1">{strategy.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {strategy.description}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configurações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Ativo */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Estratégia Ativa</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativa, esta estratégia será usada para distribuir atendimentos
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              {/* Informações do Time */}
              {selectedTeam && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="mb-2">Time Selecionado</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Nome:</strong> {selectedTeam.name}</div>
                    {selectedTeam.description && (
                      <div><strong>Descrição:</strong> {selectedTeam.description}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Botão Salvar */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving || !selectedTeamId}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {currentStrategy ? 'Atualizar Estratégia' : 'Salvar Estratégia'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Lista de Estratégias Configuradas */}
      {strategies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Estratégias Configuradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {strategies.map(strategy => {
                const team = teams.find(t => t.id === strategy.team_id);
                const strategyInfo = strategyDescriptions[strategy.strategy_type];
                const Icon = strategyInfo?.icon || Settings2;

                return (
                  <div
                    key={strategy.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${strategyInfo?.color || 'text-gray-600'}`} />
                      <div>
                        <p className="">{team?.name || 'Time não encontrado'}</p>
                        <p className="text-sm text-muted-foreground">{strategyInfo?.name}</p>
                      </div>
                    </div>
                    <Badge variant={strategy.is_active ? "default" : "secondary"}>
                      {strategy.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

