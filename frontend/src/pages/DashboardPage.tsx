import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { MetricsOverview } from "@/components/dashboard/MetricsOverview";
import { useMessageStats } from "@/hooks/useMessageStats";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

const DashboardPage: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const { stats: messageStats, loading: messageStatsLoading, fetchMessageStats } = useMessageStats();

  // Buscar dados quando o período mudar
  useEffect(() => {
    const getDateRange = () => {
      const end = new Date();
      const start = new Date();
      
      switch (selectedPeriod) {
        case '24h':
          start.setHours(start.getHours() - 24);
          break;
        case '7d':
          start.setDate(start.getDate() - 7);
          break;
        case '30d':
          start.setDate(start.getDate() - 30);
          break;
      }
      
      return {
        dateStart: start.toISOString().split('T')[0],
        dateEnd: end.toISOString().split('T')[0]
      };
    };

    const dateRange = getDateRange();
    fetchMessageStats(dateRange);
  }, [selectedPeriod, fetchMessageStats]);

  // Transformar dados da API para o formato esperado pelo componente
  const transformMetricsData = () => {
    if (!messageStats) return null;

    return {
      totalMessages: messageStats.totalMessages || 0,
      activeUsers: 0, // Será preenchido pelos dados reais do dashboard
      avgResponseTime: 0, // Será calculado dos dados reais
      productivityScore: 0, // Será calculado dos dados reais
      businessHours: {
        messages: Math.round((messageStats.totalMessages || 0) * 0.83),
        percentage: 83.3
      },
      afterHours: {
        messages: Math.round((messageStats.totalMessages || 0) * 0.17),
        percentage: 16.7
      },
      trends: {
        messages: 0, // Será calculado comparando períodos
        responseTime: 0, // Será calculado dos dados reais
        productivity: 0 // Será calculado dos dados reais
      }
    };
  };

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value as '24h' | '7d' | '30d');
  };

  const handleRefresh = () => {
    const getDateRange = () => {
      const end = new Date();
      const start = new Date();
      
      switch (selectedPeriod) {
        case '24h':
          start.setHours(start.getHours() - 24);
          break;
        case '7d':
          start.setDate(start.getDate() - 7);
          break;
        case '30d':
          start.setDate(start.getDate() - 30);
          break;
      }
      
      return {
        dateStart: start.toISOString().split('T')[0],
        dateEnd: end.toISOString().split('T')[0]
      };
    };

    const dateRange = getDateRange();
    fetchMessageStats(dateRange);
  };

  const handleExport = () => {
    // Aqui você pode implementar a lógica para exportar dados
    console.log('Exportando dados...');
  };

  return (
    <PermissionGuard requiredPermissions={['settings']}>
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visão geral e métricas do sistema
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Seletor de período */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500">📅</span>
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Últimas 24h</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões de ação */}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={messageStatsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${messageStatsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principais */}
      <MetricsOverview 
        selectedPeriod={selectedPeriod} 
        data={transformMetricsData() || undefined}
        loading={messageStatsLoading}
      />

      {/* Seção de gráficos e análises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de atividade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊
              Atividade por Hora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <span className="text-4xl mb-2 opacity-50">📈</span>
                <p>Gráfico de atividade</p>
                <p className="text-sm">Em desenvolvimento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de distribuição */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊
              Distribuição por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <span className="text-4xl mb-2 opacity-50">📈</span>
                <p>Gráfico de distribuição</p>
                <p className="text-sm">Em desenvolvimento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção de insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights e Recomendações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="text-green-800 mb-2">✅ Performance Excelente</h4>
              <p className="text-sm text-green-600">
                O tempo médio de resposta está 23% abaixo da meta. Continue assim!
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-blue-800 mb-2">📈 Crescimento Positivo</h4>
              <p className="text-sm text-blue-600">
                Volume de mensagens aumentou 12.5% em relação ao período anterior.
              </p>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="text-yellow-800 mb-2">⚠️ Atenção Necessária</h4>
              <p className="text-sm text-yellow-600">
                Considerar aumentar a equipe no horário de pico (14h-16h).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </PermissionGuard>
  );
};

export default DashboardPage; 