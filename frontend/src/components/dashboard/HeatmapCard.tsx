import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface HeatmapData {
  hour: number;
  day: number;
  value: number;
  dayName: string;
}

interface HeatmapCardProps {
  selectedPeriod: 'today' | '7d' | 'current_month';
  className?: string;
}

export const HeatmapCard: React.FC<HeatmapCardProps> = ({ 
  selectedPeriod, 
  className 
}) => {
  const { user, profile } = useAuth();
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'hour' | 'day'>('hour');

  // Função para criar o período baseado no filtro
  const createPeriodRange = (period: 'today' | '7d' | 'current_month') => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let start: Date;
    let end: Date;

    switch (period) {
      case 'today':
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case '7d':
        start = new Date(today);
        start.setDate(today.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case 'current_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  // Função para buscar dados do heatmap
  const fetchHeatmapData = async () => {
    if (!user || !profile?.organization_id) return;

    setLoading(true);
    setError(null);

    try {
      const periodRange = createPeriodRange(selectedPeriod);
      const headers = await getAuthHeaders();

      const params = new URLSearchParams({
        dateStart: periodRange.start.toISOString().split('T')[0],
        dateEnd: periodRange.end.toISOString().split('T')[0],
        organization_id: profile.organization_id
      });

      const response = await fetch(`${apiBase}/api/dashboard/heatmap-data?${params}`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.heatmap) {
          setHeatmapData(data.heatmap);
        } else {
          setHeatmapData([]);
        }
      } else {
        throw new Error('Erro ao buscar dados do heatmap');
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados do heatmap:', err);
      setError(err.message || 'Erro desconhecido');
      setHeatmapData([]);
    } finally {
      setLoading(false);
    }
  };


  // Carregar dados quando período mudar
  useEffect(() => {
    fetchHeatmapData();
  }, [selectedPeriod, user, profile]);

  // Obter valor máximo para normalização
  const maxValue = Math.max(...heatmapData.map(d => d.value));

  // Obter intensidade da cor baseada no valor
  const getIntensity = (value: number) => {
    if (maxValue === 0) return 0;
    return (value / maxValue) * 100;
  };

  // Renderizar heatmap por hora
  const renderHourHeatmap = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Horas do dia</span>
          <span>0h - 23h</span>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {/* Header com dias */}
          <div></div>
          {days.map(day => (
            <div key={day} className="text-xs text-center text-muted-foreground">
              {day}
            </div>
          ))}
          
          {/* Linhas de horas */}
          {hours.map(hour => (
            <div key={hour} className="contents">
              <div className="text-xs text-right pr-2 text-muted-foreground">
                {hour}h
              </div>
              {days.map((day, dayIndex) => {
                const data = heatmapData.find(d => d.hour === hour && d.day === dayIndex);
                const value = data?.value || 0;
                const intensity = getIntensity(value);
                
                // Garantir que sempre há uma cor de fundo, mesmo para valores 0
                const backgroundColor = value === 0 
                  ? 'rgba(229, 231, 235, 0.3)' // Cor cinza claro para valores 0
                  : `rgba(239, 68, 68, ${Math.max(0.1, intensity / 100)})`; // Mínimo de 10% de opacidade para valores > 0 (vermelho)
                
                return (
                  <div
                    key={`${hour}-${dayIndex}`}
                    className="w-6 h-6 rounded-sm border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer"
                    style={{
                      backgroundColor,
                    }}
                    title={`${day} ${hour}h: ${value} mensagens`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Renderizar heatmap por dia
  const renderDayHeatmap = () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayData = days.map((dayName, dayIndex) => {
      const dayValues = heatmapData.filter(d => d.day === dayIndex);
      const totalValue = dayValues.reduce((sum, d) => sum + d.value, 0);
      return { dayName, dayIndex, totalValue };
    });

    return (
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground text-center">
          Atividade total por dia da semana
        </div>
        <div className="flex justify-between items-end h-32">
          {dayData.map(({ dayName, totalValue }) => {
            const intensity = getIntensity(totalValue);
            const height = Math.max((intensity / 100) * 100, 4); // Altura mínima de 4px
            
            // Definir cor baseada no valor
            const backgroundColor = totalValue === 0 
              ? 'rgb(229, 231, 235)' // Cinza claro para valores 0
              : intensity < 25 
                ? 'rgb(252, 165, 165)' // Vermelho claro para baixa atividade
                : intensity < 50
                  ? 'rgb(248, 113, 113)' // Vermelho médio
                  : intensity < 75
                    ? 'rgb(239, 68, 68)' // Vermelho
                    : 'rgb(220, 38, 38)'; // Vermelho escuro para alta atividade
            
            const hoverColor = totalValue === 0 
              ? 'rgb(209, 213, 219)' // Cinza mais escuro no hover
              : 'rgb(185, 28, 28)'; // Vermelho escuro no hover
            
            return (
              <div key={dayName} className="flex flex-col items-center space-y-2">
                <div
                  className="w-8 rounded-t-sm transition-all duration-300 cursor-pointer"
                  style={{ 
                    height: `${height}px`,
                    backgroundColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hoverColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = backgroundColor;
                  }}
                  title={`${dayName}: ${totalValue} mensagens`}
                />
                <span className="text-xs text-muted-foreground">
                  {dayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {totalValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-normal">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Heatmap de Atividade
          </CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Por Hora</SelectItem>
                <SelectItem value="day">Por Dia</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchHeatmapData} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2 sm:hidden">Atualizar</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <div className="text-red-500 mb-2">❌</div>
              <p className="text-red-600">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchHeatmapData} 
                className="mt-2"
              >
                Tentar Novamente
              </Button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : heatmapData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
            </div>
          </div>
        ) : (
          <div className="h-80 overflow-auto">
            {viewType === 'hour' ? renderHourHeatmap() : renderDayHeatmap()}
            
            {/* Legenda */}
            <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-muted-foreground">
              <span>Menor atividade</span>
              <div className="flex space-x-1">
                {[0, 25, 50, 75, 100].map(intensity => (
                  <div
                    key={intensity}
                    className="w-4 h-4 rounded-sm border border-gray-200"
                    style={{
                      backgroundColor: intensity === 0 
                        ? 'rgba(229, 231, 235, 0.3)' 
                        : `rgba(239, 68, 68, ${intensity / 100})`,
                    }}
                  />
                ))}
              </div>
              <span>Maior atividade</span>
            </div>
          </div>
        )}
        
        {heatmapData.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Visualização por {viewType === 'hour' ? 'horas e dias da semana' : 'dias da semana'} • 
            Período: {selectedPeriod === 'today' ? 'Hoje' : selectedPeriod === '7d' ? '7 dias' : 'Mês atual'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
