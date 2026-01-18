import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, MessageCircle } from "lucide-react";
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface TimeData {
  hour: number;
  messages: number;
  productivity: number;
  responseTime: number;
}

interface TimeAnalysisProps {
  selectedPeriod: string;
  detailed?: boolean;
}

export function TimeAnalysis({ selectedPeriod, detailed = false }: TimeAnalysisProps) {
  const [data, setData] = useState<TimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        console.log('🚨 [TimeAnalysis] PERÍODO SELECIONADO:', {
          start: start.toISOString().split('T')[0],
          end: finalEnd.toISOString().split('T')[0],
          selectedPeriod
        });
        
        const params = new URLSearchParams({
          dateStart: start.toISOString().split('T')[0],
          dateEnd: finalEnd.toISOString().split('T')[0],
          selectedPeriod: selectedPeriod,
        });
        
        console.log('🚨 [TimeAnalysis] URL FINAL:', `${apiBase}/api/reports/attendance?${params}`);
        
        // 🎯 USAR A MESMA API DAS MÉTRICAS INDIVIDUAIS PARA GARANTIR CONSISTÊNCIA
        // ✅ CORRIGIDO: Usar getAuthHeaders()
        const headers = await getAuthHeaders();
        const response = await fetch(`${apiBase}/api/reports/attendance?${params}`, {
          headers
        });
        
        console.log('🚨 [TimeAnalysis] STATUS:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🚨 [TimeAnalysis] ERRO:', errorText);
          throw new Error(`Erro ao buscar dados de analytics: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 [TimeAnalysis] Dados recebidos:', result);
        
        // Converter dados do relatório de atendimento para formato do TimeAnalysis
        const agents = result.data?.agents || [];
        
        // Calcular totais dos agentes
        const totalMessages = agents.reduce((sum: number, agent: any) => 
          sum + (agent.messagesSent || 0) + (agent.contactsReceived || 0), 0);
        
        // Verificar se há dados reais
        const hasRealData = totalMessages > 0;
        
        if (!hasRealData) {
          console.log('🎭 [TimeAnalysis] Sem dados reais, gerando dados de demonstração...');
          
          // Sem dados reais, gerar dados zerados
          const timeData = [];
          
          for (let hour = 0; hour < 24; hour++) {
            timeData.push({
              hour,
              messages: 0,
              productivity: 0, // Sem dados, produtividade zero
              responseTime: 0 // Sem dados, tempo de resposta zero
            });
          }
          
          setData(timeData);
        } else {
          // Usar dados reais da API
          const hourlyActivity = result.data?.timeAnalysis?.hourlyActivity || [];
          
          // Converter para o formato esperado pelo componente
          const timeData = hourlyActivity.map((item: any, index: number) => ({
            hour: index,
            messages: item.messages || 0,
            productivity: item.satisfaction ? Math.round(item.satisfaction * 20) : 0,
            responseTime: item.responseTime || 2.5
          }));
          
          setData(timeData);
        }
        
        console.log('📊 [TimeAnalysis] Dados processados com sucesso');
      } catch (err: any) {
        console.error('🚨 [TimeAnalysis] ERRO FINAL:', err);
        setError(err.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [selectedPeriod]);

  const getPeakHours = () => {
    const sortedByMessages = [...data].sort((a, b) => b.messages - a.messages);
    return sortedByMessages.slice(0, 3);
  };

  const getBestProductivityHours = () => {
    const sortedByProductivity = [...data].sort((a, b) => b.productivity - a.productivity);
    return sortedByProductivity.slice(0, 3);
  };

  const getAverageResponseTime = () => {
    if (!data.length) return 0;
    return data.reduce((sum, item) => sum + item.responseTime, 0) / data.length;
  };

  const getProductivityColor = (productivity: number) => {
    if (productivity >= 90) return 'text-green-600';
    if (productivity >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResponseTimeColor = (time: number) => {
    if (time <= 2) return 'text-green-600';
    if (time <= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análise de Horários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análise de Horários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-center py-8">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Análise de Horários
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Padrões de atividade por horário
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Peak Hours */}
          <div>
            <h4 className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Horários de Pico
            </h4>
            <div className="space-y-2">
              {getPeakHours().map((item, index) => (
                <div key={item.hour} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{index + 1}º</Badge>
                    <span className="">{item.hour}:00</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {item.messages} mensagens
                    </span>
                    <span className={`text-sm ${getProductivityColor(item.productivity)}`}>
                      {item.productivity > 0 ? `${item.productivity}%` : '-'} produtividade
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Best Productivity Hours */}
          <div>
            <h4 className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Melhor Produtividade
            </h4>
            <div className="space-y-2">
              {getBestProductivityHours().map((item, index) => (
                <div key={item.hour} className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      {index + 1}º
                    </Badge>
                    <span className="">{item.hour}:00</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {item.messages} mensagens
                    </span>
                    <span className="text-sm text-green-600">
                      {item.productivity > 0 ? `${item.productivity}%` : '-'} produtividade
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl text-blue-600">
                {Math.max(...data.map(item => item.messages))}
              </div>
              <div className="text-xs text-muted-foreground">Máximo mensagens/hora</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-green-600">
                {getAverageResponseTime() > 0 ? `${getAverageResponseTime().toFixed(1)}min` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Tempo médio resposta</div>
            </div>
          </div>

          {/* Detailed Chart (if detailed mode) */}
          {detailed && (
            <div className="pt-4 border-t">
              <h4 className="mb-3">Distribuição por Hora</h4>
              <div className="h-48 flex items-end justify-between gap-1">
                {data.map((item) => {
                  const maxMessages = Math.max(...data.map(d => d.messages));
                  const height = (item.messages / maxMessages) * 100;
                  return (
                    <div key={item.hour} className="flex flex-col items-center gap-1 flex-1">
                      <div className="text-xs text-muted-foreground">
                        {item.messages}
                      </div>
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t transition-all duration-300"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      ></div>
                      <div className="text-xs text-muted-foreground">
                        {item.hour}h
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insights */}
          <div className="pt-4 border-t">
            <h4 className="mb-2">Insights</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Horário de pico: {getPeakHours()[0]?.hour}:00 com {getPeakHours()[0]?.messages} mensagens</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Melhor produtividade: {getBestProductivityHours()[0]?.hour}:00 com {getBestProductivityHours()[0]?.productivity}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Tempo médio de resposta: {getAverageResponseTime().toFixed(1)} minutos</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 