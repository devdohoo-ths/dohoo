import React, { useState, useEffect } from 'react';
import { Star, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { useRanking } from '@/hooks/useRanking';
import { RankingType, RankingPeriod } from '@/types/ranking';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const RANKING_TYPES: { 
  type: RankingType; 
  title: string; 
  icon: React.ReactNode;
  description: string;
  calculation: string;
}[] = [
  {
    type: 'messages_sent',
    title: 'Top Respondentes',
    icon: <Star className="w-4 h-4" />,
    description: 'Colaboradores que mais enviaram mensagens',
    calculation: 'Soma total de mensagens enviadas pelo usuário no período'
  },
  {
    type: 'response_speed',
    title: 'Mais Rápidos',
    icon: <TrendingUp className="w-4 h-4" />,
    description: 'Menor tempo médio de resposta',
    calculation: 'Tempo médio entre receber e responder mensagens (em segundos)'
  },
  {
    type: 'engagement_balance',
    title: 'Mais Engajados',
    icon: <Users className="w-4 h-4" />,
    description: 'Melhor equilíbrio entre envio e recebimento',
    calculation: 'Proporção entre mensagens enviadas e recebidas (0-100%)'
  },
  {
    type: 'total_activity',
    title: 'Mais Ativos',
    icon: <Star className="w-4 h-4" />,
    description: 'Maior atividade geral de comunicação',
    calculation: 'Soma total de mensagens enviadas + recebidas no período'
  }
];

const PERIODS: { 
  value: RankingPeriod; 
  label: string; 
  description: string;
  timeframe: string;
}[] = [
  { 
    value: 'today', 
    label: 'Hoje', 
    description: 'Dados do dia atual',
    timeframe: 'Últimas 24 horas'
  },
  { 
    value: 'week', 
    label: 'Semana', 
    description: 'Últimos 7 dias',
    timeframe: 'De segunda a domingo'
  },
  { 
    value: 'month', 
    label: 'Mês', 
    description: 'Últimos 30 dias',
    timeframe: 'Mês calendário atual'
  },
  { 
    value: 'quarter', 
    label: 'Trimestre', 
    description: 'Últimos 90 dias',
    timeframe: 'Trimestre atual'
  }
];

const RankingPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<RankingType>('messages_sent');
  const [selectedPeriod, setSelectedPeriod] = useState<RankingPeriod>('week');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    rankings,
    loading,
    error,
    fetchRankings,
    fetchMultipleRankings,
    refreshRanking
  } = useRanking();

  // Buscar ranking inicial
  useEffect(() => {
    if (selectedType && selectedPeriod) {
      fetchRankings(selectedType, selectedPeriod);
    }
  }, [selectedType, selectedPeriod, fetchRankings]);

  // Buscar múltiplos rankings para overview
  useEffect(() => {
    const types: RankingType[] = ['messages_sent', 'response_speed', 'engagement_balance'];
    fetchMultipleRankings(types, selectedPeriod);
  }, [selectedPeriod, fetchMultipleRankings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRanking(selectedType, selectedPeriod);
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentRanking = rankings.find(r => r.type === selectedType && r.period === selectedPeriod);

  const formatScore = (score: number, type: string) => {
    switch (type) {
      case 'response_speed':
        return `${score.toFixed(1)}s`;
      case 'messages_sent':
        return score.toLocaleString();
      case 'engagement_balance':
        return `${score.toFixed(1)}%`;
      case 'total_activity':
        return score.toLocaleString();
      default:
        return score.toLocaleString();
    }
  };

  const getPositionIcon = (position: number) => {
    if (position === 1) return <Star className="w-5 h-5 text-yellow-600" />;
    if (position === 2) return <Star className="w-5 h-5 text-gray-500" />;
    if (position === 3) return <Star className="w-5 h-5 text-orange-600" />;
    return <span className="text-sm text-muted-foreground">#{position}</span>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl mb-2">Ranking de Colaboradores</h1>
              <p className="text-muted-foreground">Acompanhe os melhores desempenhos da equipe</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Period Selection */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border">
                {PERIODS.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={selectedPeriod === value ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedPeriod(value)}
                    className="h-8 px-3"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              
              {/* Refresh Button */}
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Ranking Types */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {RANKING_TYPES.map(({ type, title, icon }) => (
              <Button
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                onClick={() => setSelectedType(type)}
                className="h-12 flex items-center gap-2"
              >
                {icon}
                {title}
              </Button>
            ))}
          </div>

          {/* Ranking Info */}
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {RANKING_TYPES.find(t => t.type === selectedType)?.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg mb-1">
                    {RANKING_TYPES.find(t => t.type === selectedType)?.title}
                  </h3>
                  <p className="text-muted-foreground mb-2">
                    {RANKING_TYPES.find(t => t.type === selectedType)?.description}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-sm mb-1">Como é calculado:</div>
                      <div className="text-sm text-muted-foreground">
                        {RANKING_TYPES.find(t => t.type === selectedType)?.calculation}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-sm mb-1">Período de análise:</div>
                      <div className="text-sm text-muted-foreground">
                        {PERIODS.find(p => p.value === selectedPeriod)?.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {PERIODS.find(p => p.value === selectedPeriod)?.timeframe}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Ranking */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {RANKING_TYPES.find(t => t.type === selectedType)?.icon}
                  {RANKING_TYPES.find(t => t.type === selectedType)?.title}
                  <Badge variant="outline" className="ml-auto">
                    {PERIODS.find(p => p.value === selectedPeriod)?.label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading && !currentRanking ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <div className="text-destructive mb-2">Erro ao carregar ranking</div>
                    <div className="text-muted-foreground text-sm">{error}</div>
                  </div>
                ) : currentRanking && currentRanking.entries.length > 0 ? (
                  <div className="space-y-3">
                    {currentRanking.entries.slice(0, 10).map((entry) => (
                      <div
                        key={entry.user.id}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {getPositionIcon(entry.position)}
                        </div>
                        
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm">
                          {entry.user.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="truncate">
                            {entry.user.name || 'Usuário Anônimo'}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {entry.user.role_name || entry.user.department || 'Sem função'}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-lg">
                            {formatScore(entry.score, selectedType)}
                          </div>
                          {entry.change && (
                            <div className={cn(
                              "text-xs flex items-center gap-1",
                              entry.change > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              <TrendingUp className={cn("w-3 h-3", entry.change < 0 && "rotate-180")} />
                              {Math.abs(entry.change).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground">Nenhum dado encontrado para este período</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Overview */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estatísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total de Participantes</span>
                  <span className="">{currentRanking?.totalUsers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Melhor Score</span>
                  <span className="">
                    {currentRanking?.metadata?.topScore?.toFixed(1) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Score Médio</span>
                  <span className="">
                    {currentRanking?.metadata?.averageScore?.toFixed(1) || 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Top 3 Podium */}
            {currentRanking && currentRanking.entries.length >= 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top 3</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentRanking.entries.slice(0, 3).map((entry, index) => (
                      <div key={entry.user.id} className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm",
                          index === 0 ? "bg-yellow-500" :
                          index === 1 ? "bg-gray-400" :
                          "bg-orange-500"
                        )}>
                          {index + 1}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm">
                          {entry.user.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">
                            {entry.user.name || 'Usuário Anônimo'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatScore(entry.score, selectedType)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Rankings */}
            {rankings.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outros Rankings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {rankings
                      .filter(ranking => ranking.type !== selectedType)
                      .slice(0, 3)
                      .map((ranking) => (
                        <Button
                          key={`${ranking.type}-${ranking.period}`}
                          variant="ghost"
                          onClick={() => setSelectedType(ranking.type)}
                          className="w-full justify-start h-auto p-3"
                        >
                          <div className="flex items-center gap-3 w-full">
                            {RANKING_TYPES.find(t => t.type === ranking.type)?.icon}
                            <div className="flex-1 text-left">
                              <div className="text-sm">
                                {RANKING_TYPES.find(t => t.type === ranking.type)?.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {ranking.entries.length} participantes
                              </div>
                            </div>
                          </div>
                        </Button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Help Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  📋 Como Funcionam os Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm mb-2">📊 Tipos de Métricas:</div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div>• <strong>Top Respondentes:</strong> Volume de mensagens enviadas</div>
                      <div>• <strong>Mais Rápidos:</strong> Velocidade de resposta (menor tempo)</div>
                      <div>• <strong>Mais Engajados:</strong> Equilíbrio entre envio/recebimento</div>
                      <div>• <strong>Mais Ativos:</strong> Total de interações (envio + recebimento)</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm mb-2">⏰ Períodos de Análise:</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>• <strong>Hoje:</strong> Últimas 24 horas</div>
                      <div>• <strong>Semana:</strong> Últimos 7 dias</div>
                      <div>• <strong>Mês:</strong> Últimos 30 dias</div>
                      <div>• <strong>Trimestre:</strong> Últimos 90 dias</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm mb-2">🎯 Interpretação:</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>• <strong>Posição:</strong> Ranking entre todos os colaboradores</div>
                      <div>• <strong>Score:</strong> Valor numérico da métrica</div>
                      <div>• <strong>Tendência:</strong> Variação em relação ao período anterior</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankingPage;