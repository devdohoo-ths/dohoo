
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, Zap } from 'lucide-react';

interface TokenUsageChartWidgetProps {
  usageStats: any;
  className?: string;
}

export const TokenUsageChartWidget: React.FC<TokenUsageChartWidgetProps> = ({ usageStats, className }) => {
  const chartData = [
    { name: 'Hoje', value: usageStats?.today || 0 },
    { name: 'Esta Semana', value: usageStats?.thisWeek || 0 },
    { name: 'Este Mês', value: usageStats?.thisMonth || 0 },
  ];

  const modelData = usageStats?.byModel ? Object.entries(usageStats.byModel).map(([model, value]) => ({
    name: model.replace('gpt-', 'GPT-'),
    value: value as number
  })) : [];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Uso de Tokens
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Bar Chart */}
          <div>
            <h4 className="text-sm mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Período
            </h4>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Bar dataKey="value" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          {modelData.length > 0 && (
            <div>
              <h4 className="text-sm mb-2">Por Modelo</h4>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={modelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={50}
                    dataKey="value"
                  >
                    {modelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {modelData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1 text-xs">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
