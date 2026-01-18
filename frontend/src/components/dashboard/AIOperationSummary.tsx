import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  MessageCircle,
  Users,
  Calendar
} from 'lucide-react';
import { useAIOperationSummary } from '@/hooks/useAIOperationSummary';
import { useUserOrganizationCheck } from '@/hooks/useUserOrganizationCheck';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

interface AIOperationSummaryProps {
  selectedPeriod: 'today' | '7d' | 'current_month';
  className?: string;
}

export const AIOperationSummary: React.FC<AIOperationSummaryProps> = ({ 
  selectedPeriod, 
  className 
}) => {
  const { user, profile } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const { summary, loading, error, lastUpdate, generateSummary, refreshSummary } = useAIOperationSummary();
  const { checkAndFixOrganization, loading: orgCheckLoading } = useUserOrganizationCheck();

  // Verificar se precisa gerar resumo apenas na montagem inicial ou quando o período muda
  // Otimização: Aguardar carregar a tela primeiro antes de gerar análise
  // IMPORTANTE: Só gera automaticamente se passou mais de 1 hora desde a última atualização
  useEffect(() => {
    // Aguardar carregamento da organização antes de tentar gerar
    if (orgLoading) {
      return;
    }
    
    // Verificar se tem organização antes de tentar gerar
    const organizationId = profile?.organization_id || organization?.id;
    
    // Se não tem organização, não tentar gerar (mas pode ter resumo armazenado)
    if (!organizationId) {
      return;
    }
    
    // Verificar se já existe um resumo recente (menos de 1 hora)
    if (summary && lastUpdate) {
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();
      const oneHourInMs = 60 * 60 * 1000;
      
      // Se tem resumo recente e o período é o mesmo, não precisa gerar
      if (timeSinceUpdate < oneHourInMs && summary.period === selectedPeriod) {
        // Não precisa gerar, já tem resumo recente
        return;
      }
    }
    
    // Delay para carregar a tela primeiro antes de fazer análise do supervisor virtual
    // Isso melhora a percepção de velocidade do dashboard
    const timeoutId = setTimeout(() => {
      // O hook já verifica internamente se precisa gerar (baseado em tempo de 1h e período)
      // Passar force=false para respeitar o cache de 1 hora
      generateSummary(selectedPeriod, false);
    }, 2000); // 2 segundos de delay para dar tempo do dashboard carregar
    
    // Cleanup do timeout se o componente desmontar ou dependências mudarem
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, orgLoading, profile?.organization_id, organization?.id]);

  const handleFixOrganization = async () => {
    const result = await checkAndFixOrganization();
    if (result?.success && result.hasOrganization) {
      // Recarregar a página para atualizar o contexto de autenticação
      window.location.reload();
    }
  };


  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
      case 'positivo': return 'text-green-600 bg-green-50';
      case 'negative':
      case 'negativo': return 'text-red-600 bg-red-50';
      case 'neutral':
      case 'neutro':
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
      case 'positivo': return <CheckCircle className="h-4 w-4" />;
      case 'negative':
      case 'negativo': return <AlertTriangle className="h-4 w-4" />;
      case 'neutral':
      case 'neutro':
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatPeriod = (period: string) => {
    switch (period) {
      case 'today': return 'Hoje';
      case '7d': return 'Últimos 7 dias';
      case 'current_month': return 'Mês atual';
      default: return period;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-normal">
            <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            <span className="hidden sm:inline">Supervisor Virtual</span>
            <span className="sm:hidden">Supervisor Virtual</span>
          </CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Badge variant="outline" className="text-xs">
              {formatPeriod(selectedPeriod)}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refreshSummary(selectedPeriod)} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2 sm:hidden">Atualizar</span>
            </Button>
          </div>
        </div>
        {lastUpdate && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última atualização: <span className="font-medium">{formatTime(lastUpdate.toISOString())}</span>
            </p>
            {(() => {
              const timeSinceUpdate = Date.now() - lastUpdate.getTime();
              const oneHourInMs = 60 * 60 * 1000;
              const isRecent = timeSinceUpdate < oneHourInMs;
              
              return (
                <Badge 
                  variant={isRecent ? "default" : "secondary"} 
                  className="text-xs"
                >
                  {isRecent ? 'Atualizado recentemente' : 'Pode atualizar'}
                </Badge>
              );
            })()}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-purple-600" />
              <span className="text-sm text-muted-foreground">
                IA analisando operação...
              </span>
            </div>
            <Progress value={75} className="w-full" />
            <p className="text-xs text-muted-foreground">
              Analisando conversas e gerando insights
            </p>
          </div>
        )}



        {error && !summary && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Erro na análise</span>
            </div>
            <p className="text-xs text-red-600">{error}</p>
            {error.includes('organização') || error.includes('organização associada') ? (
              <div className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded">
                <p className="mb-1">Como resolver:</p>
                <ul className="list-disc list-inside space-y-1 mb-2">
                  <li>Verifique se você foi adicionado a uma organização</li>
                  <li>Entre em contato com o administrador do sistema</li>
                  <li>Certifique-se de que seu perfil está completo</li>
                </ul>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleFixOrganization}
                  disabled={orgCheckLoading}
                  className="w-full"
                >
                  {orgCheckLoading ? 'Verificando...' : 'Tentar corrigir automaticamente'}
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refreshSummary(selectedPeriod)}
                className="w-full"
              >
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        {!loading && !error && !summary && (
          <div className="space-y-2 text-center py-4">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Brain className="h-8 w-8 text-purple-300" />
              <p className="text-sm">Nenhuma análise disponível</p>
              <p className="text-xs">Clique em atualizar para gerar uma nova análise</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refreshSummary(selectedPeriod)}
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Análise
              </Button>
            </div>
          </div>
        )}

        {summary && !loading && (
          <div className="space-y-4">
            {/* Resumo Principal */}

            {/* Análise de Sentimento */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Sentimento Geral</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge 
                  variant="outline" 
                  className={`${getSentimentColor(summary.sentiment.overall)} border-0`}
                >
                  <div className="flex items-center gap-1">
                    {getSentimentIcon(summary.sentiment.overall)}
                    {summary.sentiment.overall === 'positive' || summary.sentiment.overall === 'positivo' ? 'Positivo' : 
                     summary.sentiment.overall === 'negative' || summary.sentiment.overall === 'negativo' ? 'Negativo' : 'Neutro'}
                  </div>
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {summary.sentiment.score ? `Score: ${summary.sentiment.score.toFixed(2)}` : summary.sentiment.description || 'Análise concluída'}
                </span>
              </div>
            </div>


            {/* Insights */}
            {summary.insights && summary.insights.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Insights Principais</span>
                </div>
                <ul className="space-y-1">
                  {summary.insights.slice(0, 3).map((insight, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recomendações */}
            {summary.recommendations && summary.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Recomendações</span>
                </div>
                <ul className="space-y-1">
                  {summary.recommendations.slice(0, 2).map((recommendation, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">→</span>
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timestamp */}
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Análise gerada em: {formatTime(summary.timestamp)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
