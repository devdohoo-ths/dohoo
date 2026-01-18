/**
 * Componente de Dashboard de Performance
 * 
 * Este componente exibe métricas de performance em tempo real
 * com visualizações otimizadas e interativas.
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Database, 
  Zap, 
  Monitor, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { logger } from '@/utils/logger';

interface PerformanceData {
  overview: {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    cacheHitRate: number;
    systemHealth: string;
    uptime: string;
  };
  metrics: {
    api: any;
    database: any;
    realtime: any;
    frontend: any;
    system: any;
  };
  alerts: Array<{
    id: string;
    category: string;
    type: string;
    severity: string;
    timestamp: string;
    data: any;
  }>;
  recommendations: Array<{
    category: string;
    priority: string;
    message: string;
    impact: string;
  }>;
}

const PerformanceDashboard = memo(() => {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch performance data
  const fetchData = async () => {
    try {
      const response = await fetch('/api/metrics/detailed');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastUpdate(new Date());
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Erro ao buscar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto refresh effect
  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Health status component
  const HealthStatus = memo(({ health }: { health: string }) => {
    const statusConfig = {
      excellent: { color: 'bg-green-500', icon: CheckCircle, text: 'Excelente' },
      good: { color: 'bg-blue-500', icon: CheckCircle, text: 'Bom' },
      warning: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'Atenção' },
      critical: { color: 'bg-red-500', icon: AlertTriangle, text: 'Crítico' }
    };

    const config = statusConfig[health as keyof typeof statusConfig] || statusConfig.warning;
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  });

  // Metric card component
  const MetricCard = memo(({ 
    title, 
    value, 
    unit, 
    trend, 
    icon: Icon, 
    color = 'text-blue-600' 
  }: {
    title: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
    icon: React.ComponentType<any>;
    color?: string;
  }) => {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{title}</p>
              <p className="text-2xl">
                {value}
                {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Icon className={`w-6 h-6 ${color}`} />
              {TrendIcon && <TrendIcon className="w-4 h-4 text-gray-400" />}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  });

  // Progress bar component
  const ProgressBar = memo(({ 
    label, 
    value, 
    max = 100, 
    color = 'bg-blue-500' 
  }: {
    label: string;
    value: number;
    max?: number;
    color?: string;
  }) => {
    const percentage = Math.min((value / max) * 100, 100);

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span>{value.toFixed(1)}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    );
  });

  // Alerts component
  const AlertsList = memo(() => {
    if (!data?.alerts.length) {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum alerta ativo. Sistema funcionando normalmente.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-2">
        {data.alerts.slice(0, 5).map((alert) => (
          <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex justify-between items-start">
                <div>
                  <strong>{alert.category.toUpperCase()}</strong>: {alert.type}
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2">
                  {alert.severity}
                </Badge>
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>
    );
  });

  // Recommendations component
  const RecommendationsList = memo(() => {
    if (!data?.recommendations.length) {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma recomendação de otimização no momento.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-3">
        {data.recommendations.slice(0, 5).map((rec, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={
                  rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
                  rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {rec.priority}
                </Badge>
                <Badge variant="secondary">{rec.category}</Badge>
              </div>
              <p className="text-sm mb-1">{rec.message}</p>
              <p className="text-xs text-gray-600">Impacto: {rec.impact}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Carregando métricas...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar métricas: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl">Dashboard de Performance</h1>
          <p className="text-gray-600">
            Última atualização: {lastUpdate.toLocaleString()}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Requisições"
          value={data.overview.totalRequests.toLocaleString()}
          icon={Activity}
          color="text-blue-600"
        />
        <MetricCard
          title="Taxa de Erro"
          value={data.overview.totalErrors}
          unit="%"
          icon={AlertTriangle}
          color="text-red-600"
        />
        <MetricCard
          title="Tempo Médio"
          value={data.overview.averageResponseTime}
          unit="ms"
          icon={Clock}
          color="text-green-600"
        />
        <MetricCard
          title="Cache Hit Rate"
          value={data.overview.cacheHitRate}
          unit="%"
          icon={Database}
          color="text-purple-600"
        />
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="w-5 h-5 mr-2" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <HealthStatus health={data.overview.systemHealth} />
              <p className="text-sm text-gray-600 mt-2">
                Uptime: {data.overview.uptime}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Performance Geral</p>
              <ProgressBar 
                value={data.overview.systemHealth === 'excellent' ? 100 : 
                       data.overview.systemHealth === 'good' ? 80 :
                       data.overview.systemHealth === 'warning' ? 60 : 30}
                color={data.overview.systemHealth === 'excellent' ? 'bg-green-500' :
                       data.overview.systemHealth === 'good' ? 'bg-blue-500' :
                       data.overview.systemHealth === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* API Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Métricas de API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressBar 
                  label="Taxa de Sucesso" 
                  value={100 - (data.metrics.api.errors / data.metrics.api.requests * 100)}
                  color="bg-green-500"
                />
                <ProgressBar 
                  label="Cache Hit Rate" 
                  value={data.metrics.api.cacheHits / (data.metrics.api.cacheHits + data.metrics.api.cacheMisses) * 100}
                  color="bg-blue-500"
                />
                <div className="text-sm text-gray-600">
                  <p>Requisições: {data.metrics.api.requests.toLocaleString()}</p>
                  <p>Tempo Médio: {data.metrics.api.averageTime.toFixed(2)}ms</p>
                  <p>Requisições Lentas: {data.metrics.api.slowRequests}</p>
                </div>
              </CardContent>
            </Card>

            {/* Database Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Métricas de Banco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressBar 
                  label="Taxa de Sucesso" 
                  value={100 - (data.metrics.database.errors / data.metrics.database.queries * 100)}
                  color="bg-green-500"
                />
                <ProgressBar 
                  label="Cache Hit Rate" 
                  value={data.metrics.database.cacheHits / (data.metrics.database.cacheHits + data.metrics.database.cacheMisses) * 100}
                  color="bg-blue-500"
                />
                <div className="text-sm text-gray-600">
                  <p>Consultas: {data.metrics.database.queries.toLocaleString()}</p>
                  <p>Tempo Médio: {data.metrics.database.averageTime.toFixed(2)}ms</p>
                  <p>Consultas Lentas: {data.metrics.database.slowQueries}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsList />
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsList />
        </TabsContent>
      </Tabs>
    </div>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;
