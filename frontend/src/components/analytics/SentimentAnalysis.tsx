
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Heart, Frown, Meh, Smile } from 'lucide-react';
import type { AnalyticsSummary } from '@/types/analytics';

interface SentimentAnalysisProps {
  summary: AnalyticsSummary;
}

const COLORS = {
  positive: '#10B981',
  neutral: '#F59E0B', 
  negative: '#EF4444'
};

export const SentimentAnalysis: React.FC<SentimentAnalysisProps> = ({ summary }) => {
  const sentimentData = [
    { 
      name: 'Positivo', 
      value: summary.sentiment_distribution.positive,
      color: COLORS.positive,
      icon: Smile
    },
    { 
      name: 'Neutro', 
      value: summary.sentiment_distribution.neutral,
      color: COLORS.neutral,
      icon: Meh
    },
    { 
      name: 'Negativo', 
      value: summary.sentiment_distribution.negative,
      color: COLORS.negative,
      icon: Frown
    },
  ];

  const totalSentiments = summary.sentiment_distribution.positive + 
                         summary.sentiment_distribution.neutral + 
                         summary.sentiment_distribution.negative;

  const sentimentScore = summary.avg_sentiment;
  const sentimentLabel = sentimentScore >= 0.1 ? 'Positivo' : 
                        sentimentScore <= -0.1 ? 'Negativo' : 'Neutro';
  const sentimentColor = sentimentScore >= 0.1 ? 'text-green-600' : 
                        sentimentScore <= -0.1 ? 'text-red-600' : 'text-yellow-600';

  return (
    <div className="space-y-6">
      {/* Score geral de sentimento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Score Geral de Sentimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className={`text-4xl mb-2 ${sentimentColor}`}>
              {(sentimentScore * 100).toFixed(1)}%
            </div>
            <div className={`text-lg mb-4 ${sentimentColor}`}>
              {sentimentLabel}
            </div>
            <Progress 
              value={((sentimentScore + 1) / 2) * 100} 
              className="h-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Muito Negativo</span>
              <span>Neutro</span>
              <span>Muito Positivo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição e estatísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de pizza */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Sentimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cards de estatísticas */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Sentimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sentimentData.map((sentiment) => {
                const Icon = sentiment.icon;
                const percentage = totalSentiments > 0 ? (sentiment.value / totalSentiments) * 100 : 0;
                
                return (
                  <div key={sentiment.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" style={{ color: sentiment.color }} />
                      <div>
                        <span className="">{sentiment.name}</span>
                        <p className="text-sm text-muted-foreground">
                          {sentiment.value} conversas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg" style={{ color: sentiment.color }}>
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Taxa de Satisfação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">
              {((summary.sentiment_distribution.positive / (totalSentiments || 1)) * 100).toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">
              Conversas com sentimento positivo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conversas Neutras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-yellow-600">
              {summary.sentiment_distribution.neutral}
            </div>
            <p className="text-sm text-muted-foreground">
              Oportunidades de melhoria
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Atenção Necessária</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">
              {summary.sentiment_distribution.negative}
            </div>
            <p className="text-sm text-muted-foreground">
              Conversas com sentimento negativo
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
