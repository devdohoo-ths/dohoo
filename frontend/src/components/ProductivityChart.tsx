import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders

interface ProductivityChartProps {
  selectedPeriod: string;
}

interface PeriodData {
  time: string;
  messages: number;
  productivity: number;
}

export const ProductivityChart: React.FC<ProductivityChartProps> = ({ selectedPeriod }) => {
  const [data, setData] = useState<PeriodData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    averageProductivity: 0,
    averageMessages: 0,
    maxMessages: 0,
    maxProductivity: 0,
  });

  // Função para criar range de datas baseado no filtro
  const getPeriodRange = () => {
    // Usar a data atual real, não uma data futura
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    
    if (selectedPeriod === 'today') {
      // Para hoje, usar apenas o dia atual
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === '7d') {
      // Para 7 dias, voltar 7 dias a partir de hoje
      start.setDate(today.getDate() - 7);
    } else if (selectedPeriod === 'current_month') {
      // Para o mês atual, começar no dia 1
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      // Padrão: usar apenas hoje
      start.setHours(0, 0, 0, 0);
    }
    
    // Garantir que não estamos usando datas futuras
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use o período selecionado pelo usuário
        const { start, end } = getPeriodRange();
        // Se o usuário selecionar um período futuro, ajuste para hoje
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let finalEnd = end;
        if (end > today) {
          finalEnd = new Date(today);
          finalEnd.setHours(23, 59, 59, 999);
        }
        const params = new URLSearchParams({
          dateStart: start.toISOString().split('T')[0],
          dateEnd: finalEnd.toISOString().split('T')[0],
          selectedPeriod: selectedPeriod,
        });
        // 🎯 USAR A MESMA API DAS MÉTRICAS INDIVIDUAIS PARA GARANTIR CONSISTÊNCIA
        // ✅ CORRIGIDO: Usar getAuthHeaders()
        const headers = await getAuthHeaders();
        const response = await fetch(`${apiBase}/api/reports/attendance?${params}`, {
          headers
        });
        if (!response.ok) throw new Error('Erro ao buscar dados de relatório de atendimento');
        const result = await response.json();
        
        // Converter dados do relatório de atendimento para formato do ProductivityChart
        const agents = result.data?.agents || [];
        
        // Calcular totais dos agentes
        const totalMessages = agents.reduce((sum: number, agent: any) => 
          sum + (agent.messagesSent || 0) + (agent.contactsReceived || 0), 0);
        
        // Verificar se há dados reais
        const hasRealData = totalMessages > 0;
        
        if (!hasRealData) {
          console.log('🎭 [ProductivityChart] Sem dados reais, gerando dados de demonstração...');
          
          // Sem dados reais, gerar dados zerados
          const periods = [];
          for (let hour = 0; hour < 24; hour++) {
            periods.push({
              time: `${hour.toString().padStart(2, '0')}:00`,
              messages: 0,
              productivity: 0 // Sem dados, produtividade zero
            });
          }
          
          setData(periods);
          setSummary({
            averageProductivity: 0, // Sem dados, produtividade zero
            averageMessages: 0, // Sem dados, mensagens zero
            maxMessages: 0, // Sem dados, máximo zero
            maxProductivity: 0, // Sem dados, produtividade máxima zero
          });
        } else {
          // Usar dados reais da API
          const periods = result.data?.productivity?.periods || [];
          setData(periods);
          setSummary({
            averageProductivity: result.data?.productivity?.averageProductivity || 0,
            averageMessages: result.data?.productivity?.averageMessages || 0,
            maxMessages: result.data?.productivity?.maxMessages || 0,
            maxProductivity: result.data?.productivity?.maxProductivity || 0,
          });
        }
      } catch (err: any) {
        setError(err.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [selectedPeriod]);

  const formatTooltipLabel = (label: string) => {
    if (selectedPeriod === 'today') return `${label}h`;
    if (selectedPeriod === '7d') return label;
    return `Dia ${label}`;
  };

  if (loading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Produtividade ao Longo do Tempo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Evolução da produtividade e volume de mensagens
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Produtividade ao Longo do Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-center py-8">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Produtividade ao Longo do Tempo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Evolução da produtividade e volume de mensagens
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Métricas resumo */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-2xl text-blue-600">
                {summary.averageProductivity > 0 ? `${summary.averageProductivity}%` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">
                Produtividade média
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-green-600">
                {summary.averageMessages}
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedPeriod === 'today' ? 'Mensagens hoje' : 
                 selectedPeriod === '7d' ? 'Mensagens/dia (7 dias)' :
                 selectedPeriod === 'current_month' ? 'Mensagens/dia (mês)' :
                 'Mensagens/dia'}
              </div>
            </div>
          </div>

          {/* Gráfico real com Recharts */}
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  formatter={(value: any, name: any) => [
                    typeof value === 'number' ? Math.round(value) : value,
                    name === 'messages'
                      ? 'Mensagens'
                      : name === 'productivity'
                      ? 'Produtividade (%)'
                      : name,
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="messages"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMessages)"
                  name="messages"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="productivity"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  name="productivity"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda */}
          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Volume de Mensagens</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Produtividade (%)</span>
            </div>
          </div>

          {/* Métricas detalhadas */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-lg text-blue-600">
                {summary.maxMessages}
              </div>
              <div className="text-xs text-muted-foreground">
                Máximo mensagens/hora
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg text-green-600">
                {summary.maxProductivity}%
              </div>
              <div className="text-xs text-muted-foreground">
                Máximo produtividade
              </div>
            </div>
          </div>

          {/* Tendência */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">
              Tendência positiva nos últimos {selectedPeriod === '7d' ? '7 dias' : selectedPeriod === 'current_month' ? 'no mês atual' : 'hoje'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 