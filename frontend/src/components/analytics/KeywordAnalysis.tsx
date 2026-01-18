
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Hash, TrendingUp } from 'lucide-react';
import type { AnalyticsSummary } from '@/types/analytics';

interface KeywordAnalysisProps {
  summary: AnalyticsSummary;
}

export const KeywordAnalysis: React.FC<KeywordAnalysisProps> = ({ summary }) => {
  const topKeywords = summary.top_keywords.slice(0, 15);
  const allKeywords = summary.top_keywords;

  if (topKeywords.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Hash className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg">Nenhuma palavra-chave encontrada</h3>
          <p className="text-muted-foreground">As conversas ainda não possuem palavras-chave analisadas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de barras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="w-5 h-5" />
            Frequência de Palavras-chave
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topKeywords} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="keyword" type="category" width={100} />
              <Tooltip 
                formatter={(value) => [`${value} menções`, 'Frequência']}
              />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Grid de palavras-chave */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top 10 Palavras-chave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topKeywords.slice(0, 10).map((item, index) => (
                <div key={item.keyword} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <Badge variant="outline">{item.keyword}</Badge>
                  </div>
                  <span className="text-sm">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nuvem de Palavras-chave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allKeywords.map((item) => {
                const maxCount = Math.max(...allKeywords.map(k => k.count));
                const minSize = 12;
                const maxSize = 24;
                const fontSize = minSize + ((item.count / maxCount) * (maxSize - minSize));
                
                return (
                  <Badge
                    key={item.keyword}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {item.keyword} ({item.count})
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas das palavras-chave */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total de Palavras-chave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{allKeywords.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Palavra Mais Frequente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg">{topKeywords[0]?.keyword || 'N/A'}</div>
            <p className="text-sm text-muted-foreground">
              {topKeywords[0]?.count || 0} menções
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Média de Menções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {allKeywords.length > 0 
                ? Math.round(allKeywords.reduce((acc, item) => acc + item.count, 0) / allKeywords.length)
                : 0
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
