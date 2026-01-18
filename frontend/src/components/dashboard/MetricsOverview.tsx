import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Users, Clock, TrendingUp } from "lucide-react";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";

interface MetricsData {
  totalMessages: number;
  activeUsers: number;
  avgResponseTime: number;
  productivityScore: number;
  businessHours: {
    messages: number;
    percentage: number;
  };
  afterHours: {
    messages: number;
    percentage: number;
  };
  trends: {
    messages: number;
    responseTime: number;
    productivity: number;
  };
}

interface MetricsOverviewProps {
  selectedPeriod: '24h' | '7d' | '30d';
  data?: MetricsData;
  loading?: boolean;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ 
  selectedPeriod, 
  data,
  loading = false 
}) => {
  const { dashboardStats, selectedPeriod: hookPeriod, updatePeriod } = useDashboardWidgets();

  // 🎯 SINCRONIZAR O PERÍODO DO HOOK COM O PERÍODO RECEBIDO VIA PROPS
  React.useEffect(() => {
    if (selectedPeriod !== hookPeriod) {
      console.log('📅 [MetricsOverview] Sincronizando período:', { from: hookPeriod, to: selectedPeriod });
      updatePeriod(selectedPeriod);
    }
  }, [selectedPeriod, hookPeriod, updatePeriod]);

  // Usar dados reais do dashboard se disponíveis, senão usar dados mockados como fallback
  const defaultMetrics: MetricsData = {
    totalMessages: dashboardStats?.totalMessages || 0,
    activeUsers: dashboardStats?.totalUsers || 0,
    avgResponseTime: dashboardStats?.avgResponseTime || 2.3, // Já está em minutos
    productivityScore: dashboardStats?.productivity || 87, // Valor padrão para produtividade
    businessHours: {
      messages: Math.floor((dashboardStats?.totalMessages || 0) * 0.83),
      percentage: 83.3
    },
    afterHours: {
      messages: Math.floor((dashboardStats?.totalMessages || 0) * 0.17),
      percentage: 16.7
    },
    trends: {
      messages: dashboardStats?.trend?.messages || 0,
      responseTime: -8.2, // Valor padrão para tendência de tempo de resposta
      productivity: 5.1 // Valor padrão para tendência de produtividade
    }
  };

  const metrics = data || defaultMetrics;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const TrendIndicator = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
    const isPositive = value > 0;
    const colorClass = isPositive ? "text-green-600" : "text-red-600";
    
    return (
      <div className={`flex items-center gap-1 ${colorClass}`}>
        <TrendingUp className={`h-3 w-3 ${!isPositive ? 'rotate-180' : ''}`} />
        <span className="text-xs">
          {Math.abs(value)}{suffix}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-20"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Total de Mensagens</CardTitle>
          <MessageCircle className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl text-blue-600">
            {formatNumber(metrics.totalMessages)}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Últimos {selectedPeriod === '24h' ? '24h' : selectedPeriod === '7d' ? '7 dias' : '30 dias'}
            </p>
            <TrendIndicator value={metrics.trends.messages} suffix="%" />
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Colaboradores Ativos</CardTitle>
          <Users className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl text-green-600">
            {metrics.activeUsers}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Online agora
            </p>
            <Badge variant="secondary" className="text-xs">
              {metrics.activeUsers > 0 ? Math.round((metrics.activeUsers / Math.max(metrics.activeUsers, 1)) * 100) : 0}% da equipe
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ===== OCULTO: Card Tempo de Resposta (não será exibido) */}
      {/* <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Tempo Médio de Resposta</CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl text-orange-600">
            {metrics.avgResponseTime}min
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Meta: 3min
            </p>
            <TrendIndicator value={metrics.trends.responseTime} suffix="%" />
          </div>
        </CardContent>
      </Card> */}

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Score de Produtividade</CardTitle>
          <TrendingUp className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl text-purple-600">
            {metrics.productivityScore}%
          </div>
          <div className="space-y-2">
            <Progress value={metrics.productivityScore} className="h-2" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Excelente desempenho
              </p>
              <TrendIndicator value={metrics.trends.productivity} suffix="%" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 