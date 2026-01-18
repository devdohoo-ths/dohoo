import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Users, 
  MessageCircle, 
  Clock, 
  RefreshCw,
  Star,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface SimpleAdvancedWidgetProps {
  className?: string;
  period?: string;
  onRefresh?: () => void;
}

interface MetricData {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
  target?: number;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SimpleAdvancedWidget: React.FC<SimpleAdvancedWidgetProps> = ({ 
  className, 
  period = '7d',
  onRefresh 
}) => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MetricData[]>([]);

  useEffect(() => {
    const mockMetrics: MetricData[] = [
      {
        label: 'Mensagens Processadas',
        value: 2847,
        change: 12.5,
        trend: 'up',
        color: 'text-blue-600',
        target: 3000,
        unit: '',
        icon: MessageCircle
      },
      {
        label: 'Taxa de Resposta',
        value: 94.2,
        change: 2.1,
        trend: 'up',
        color: 'text-green-600',
        target: 95,
        unit: '%',
        icon: CheckCircle
      },
      {
        label: 'Tempo Médio',
        value: 1.8,
        change: -8.3,
        trend: 'down',
        color: 'text-orange-600',
        target: 2.0,
        unit: 'min',
        icon: Clock
      },
      {
        label: 'Satisfação',
        value: 4.7,
        change: 0.2,
        trend: 'up',
        color: 'text-yellow-600',
        target: 4.8,
        unit: '/5',
        icon: Star
      },
      {
        label: 'Usuários Ativos',
        value: 156,
        change: 8.7,
        trend: 'up',
        color: 'text-purple-600',
        target: 200,
        unit: '',
        icon: Users
      },
      {
        label: 'Alertas Críticos',
        value: 3,
        change: -50,
        trend: 'down',
        color: 'text-red-600',
        target: 0,
        unit: '',
        icon: AlertCircle
      }
    ];

    setMetrics(mockMetrics);
  }, [period]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onRefresh?.();
    }, 1000);
  };

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />;
      default:
        return <div className="h-3 w-3 bg-gray-500 rounded-full" />;
    }
  };

  const MetricCard = ({ metric }: { metric: MetricData }) => {
    const progress = metric.target ? Math.min((metric.value / metric.target) * 100, 100) : 0;
    const IconComponent = metric.icon;
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <IconComponent className={`h-4 w-4 ${metric.color}`} />
              <span className="text-sm text-gray-700">{metric.label}</span>
            </div>
            <TrendIcon trend={metric.trend} />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={`text-2xl ${metric.color}`}>
                {metric.value.toLocaleString('pt-BR')}
                {metric.unit && <span className="text-sm ml-1">{metric.unit}</span>}
              </div>
              <Badge 
                variant={metric.change > 0 ? "default" : "destructive"}
                className="text-xs"
              >
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </Badge>
            </div>
            
            {metric.target && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Meta: {metric.target.toLocaleString('pt-BR')}{metric.unit}</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Métricas Avançadas
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <MetricCard key={index} metric={metric} />
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg mb-3">Resumo de Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl text-green-600">92%</div>
              <div className="text-sm text-gray-600">Taxa de Resolução</div>
            </div>
            <div className="text-center">
              <div className="text-3xl text-blue-600">1.2</div>
              <div className="text-sm text-gray-600">Tempo Primeira Resposta (min)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl text-purple-600">78</div>
              <div className="text-sm text-gray-600">NPS Score</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 