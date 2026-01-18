
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Activity,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

interface ChartConfig {
  id: string;
  title: string;
  icon: React.ReactNode;
  enabled: boolean;
}

interface ChartSelectorProps {
  onChartsChange: (enabledCharts: string[]) => void;
}

export const ChartSelector: React.FC<ChartSelectorProps> = ({ onChartsChange }) => {
  const [charts, setCharts] = useState<ChartConfig[]>([
    { id: 'sentiment', title: 'Distribuição de Sentimentos', icon: <PieChart className="w-4 h-4" />, enabled: true },
    { id: 'priority', title: 'Distribuição de Prioridade', icon: <BarChart3 className="w-4 h-4" />, enabled: true },
    { id: 'timeSeries', title: 'Atividade ao Longo do Dia', icon: <TrendingUp className="w-4 h-4" />, enabled: true },
    { id: 'keywords', title: 'Principais Palavras-chave', icon: <Activity className="w-4 h-4" />, enabled: true },
  ]);

  const [isOpen, setIsOpen] = useState(false);

  const toggleChart = (chartId: string) => {
    const updatedCharts = charts.map(chart => 
      chart.id === chartId ? { ...chart, enabled: !chart.enabled } : chart
    );
    setCharts(updatedCharts);
    onChartsChange(updatedCharts.filter(chart => chart.enabled).map(chart => chart.id));
  };

  const enabledCount = charts.filter(chart => chart.enabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurar Gráficos
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2"
          >
            {isOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isOpen ? 'Ocultar' : 'Configurar'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{enabledCount} de {charts.length} gráficos ativos</Badge>
        </div>
      </CardHeader>
      
      {isOpen && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charts.map((chart) => (
              <div
                key={chart.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {chart.icon}
                  <span className="">{chart.title}</span>
                </div>
                <Switch
                  checked={chart.enabled}
                  onCheckedChange={() => toggleChart(chart.id)}
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allEnabled = charts.map(chart => ({ ...chart, enabled: true }));
                setCharts(allEnabled);
                onChartsChange(allEnabled.map(chart => chart.id));
              }}
            >
              Ativar Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allDisabled = charts.map(chart => ({ ...chart, enabled: false }));
                setCharts(allDisabled);
                onChartsChange([]);
              }}
            >
              Desativar Todos
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
