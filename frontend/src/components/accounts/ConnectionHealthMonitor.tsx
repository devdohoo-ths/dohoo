import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { cn } from '@/lib/utils';

export const ConnectionHealthMonitor: React.FC = () => {
  const { accounts, summary, loading, lastUpdate, fetchHealthData, forceReconnect } = useConnectionHealth();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'connecting':
        return <Clock className="h-4 w-4 text-yellow-600 animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConnectionPercentage = () => {
    if (summary.total === 0) return 0;
    return Math.round((summary.connected / summary.total) * 100);
  };

  const handleForceReconnect = async (accountId: string) => {
    try {
      await forceReconnect(accountId);
    } catch (error) {
      console.error('Erro ao forçar reconexão:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Saúde das Conexões
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealthData}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>
            <Badge variant="outline" className="text-xs">
              Última atualização: {lastUpdate.toLocaleTimeString()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl text-blue-600">{summary.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-green-600">{summary.connected}</div>
              <div className="text-xs text-gray-600">Conectadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-yellow-600">{summary.reconnecting}</div>
              <div className="text-xs text-gray-600">Reconectando</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-gray-600">{summary.disconnected}</div>
              <div className="text-xs text-gray-600">Desconectadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-red-600">{summary.error}</div>
              <div className="text-xs text-gray-600">Com Erro</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Taxa de Conectividade</span>
              <span>{getConnectionPercentage()}%</span>
            </div>
            <Progress value={getConnectionPercentage()} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Contas */}
      <div className="grid gap-4">
        {accounts.map((account) => (
          <Card key={account.account_id} className={cn(
            "transition-all duration-200",
            account.status === 'connected' && "border-green-200 bg-green-50/50",
            account.status === 'connecting' && "border-yellow-200 bg-yellow-50/50",
            account.status === 'error' && "border-red-200 bg-red-50/50"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(account.status)}
                  <div>
                    <h3 className="">{account.name}</h3>
                    <p className="text-sm text-gray-600">
                      {account.phone_number ? `+${account.phone_number}` : 'Número não disponível'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge className={getStatusColor(account.status)}>
                    {account.status === 'connected' && 'Conectado'}
                    {account.status === 'connecting' && 'Conectando...'}
                    {account.status === 'disconnected' && 'Desconectado'}
                    {account.status === 'error' && 'Erro'}
                  </Badge>
                  
                  {account.health.isReconnecting && (
                    <div className="text-xs text-yellow-600">
                      Tentativa {account.health.attemptCount}/5
                    </div>
                  )}
                  
                  {!account.health.canRetry && account.health.nextRetryIn > 0 && (
                    <div className="text-xs text-gray-600">
                      Aguarde {Math.ceil(account.health.nextRetryIn / 1000)}s
                    </div>
                  )}
                  
                  {(account.status === 'disconnected' || account.status === 'error') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleForceReconnect(account.account_id)}
                      disabled={!account.health.canRetry || account.health.isReconnecting}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reconectar
                    </Button>
                  )}
                </div>
              </div>
              
              {account.health.isReconnecting && (
                <div className="mt-3 p-2 bg-yellow-100 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-yellow-800">
                    <Clock className="h-4 w-4 animate-spin" />
                    <span>Reconectando automaticamente... Tentativa {account.health.attemptCount}/5</span>
                  </div>
                </div>
              )}
              
              {account.status === 'error' && (
                <div className="mt-3 p-2 bg-red-100 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-red-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Limite de tentativas atingido. Clique em "Reconectar" para tentar novamente.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {accounts.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg text-gray-900 mb-2">Nenhuma conta encontrada</h3>
            <p className="text-gray-600">Não há contas WhatsApp configuradas para monitorar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
