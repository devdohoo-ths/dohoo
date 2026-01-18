import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  BarChart3,
  X,
  ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AIReportHistory } from '@/hooks/useAIReportsHistory';

interface ReportComparisonProps {
  reports: AIReportHistory[];
  onClose: () => void;
  open: boolean;
}

export const ReportComparison: React.FC<ReportComparisonProps> = ({
  reports,
  onClose,
  open
}) => {
  
  // Função para limpar formatação Markdown dos insights
  const cleanMarkdownFormatting = (text: string) => {
    if (!text) return text;
    
    return text
      // Remover cabeçalhos Markdown (###, ##, #)
      .replace(/^#{1,6}\s*/gm, '')
      // Remover negrito Markdown (**texto** ou __texto__)
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      // Remover itálico Markdown (*texto* ou _texto_)
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remover links Markdown [texto](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remover código inline `código`
      .replace(/`([^`]+)`/g, '$1')
      // Remover listas Markdown (-, *, +)
      .replace(/^[-*+]\s*/gm, '• ')
      // Limpar espaços extras
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  };
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const getSentimentColor = (sentiment: number) => {
    const value = typeof sentiment === 'number' && !isNaN(sentiment) ? sentiment : 0;
    if (value >= 70) return 'text-green-600 bg-green-50';
    if (value >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  const getTrendPercentage = (current: number, previous: number) => {
    // Garantir que os valores são números válidos
    const currentValue = typeof current === 'number' && !isNaN(current) ? current : 0;
    const previousValue = typeof previous === 'number' && !isNaN(previous) ? previous : 0;
    
    // Se o valor anterior for 0, mostrar apenas a diferença absoluta
    if (previousValue === 0) {
      return currentValue;
    }
    
    const percentage = ((currentValue - previousValue) / previousValue) * 100;
    return Math.round(percentage);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Comparação de Relatórios ({reports.length})
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[75vh]">
          <div className="space-y-6">
            {/* Cabeçalho com nomes dos relatórios */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
              <div className="text-sm text-muted-foreground">Relatório</div>
              {reports.map((report, index) => (
                <Card key={report.id} className="p-3">
                  <div className="space-y-1">
                    <h4 className="text-sm truncate" title={report.report_name}>
                      {report.report_name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(report.date_start)} - {formatDate(report.date_end)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Criado: {formatDate(report.created_at)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Análise de Sentimento Positivo */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
              <div className="flex items-center text-sm">
                <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                Sentimento Positivo
              </div>
              {reports.map((report, index) => {
                const positiveValue = report.sentiment_analysis?.positive ?? 0;
                const previousPositiveValue = index > 0 ? (reports[index - 1].sentiment_analysis?.positive ?? 0) : 0;
                
                return (
                  <div key={report.id} className="text-center">
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${getSentimentColor(positiveValue)}`}>
                      <span className="text-lg">
                        {positiveValue}%
                      </span>
                      {index > 0 && (
                        <div className="flex items-center gap-1">
                          {getTrendIcon(positiveValue, previousPositiveValue)}
                          <span className="text-xs">
                            {getTrendPercentage(positiveValue, previousPositiveValue)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Análise de Sentimento Negativo */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
              <div className="flex items-center text-sm">
                <TrendingDown className="h-4 w-4 mr-2 text-red-600" />
                Sentimento Negativo
              </div>
              {reports.map((report, index) => {
                const negativeValue = report.sentiment_analysis?.negative ?? 0;
                const previousNegativeValue = index > 0 ? (reports[index - 1].sentiment_analysis?.negative ?? 0) : 0;
                
                return (
                  <div key={report.id} className="text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600">
                      <span className="text-lg">
                        {negativeValue}%
                      </span>
                      {index > 0 && (
                        <div className="flex items-center gap-1">
                          {getTrendIcon(negativeValue, previousNegativeValue)}
                          <span className="text-xs">
                            {getTrendPercentage(negativeValue, previousNegativeValue)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Análise de Sentimento Neutro */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
              <div className="flex items-center text-sm">
                <ArrowUpDown className="h-4 w-4 mr-2 text-gray-500" />
                Sentimento Neutro
              </div>
              {reports.map((report, index) => {
                const neutralValue = report.sentiment_analysis?.neutral ?? 0;
                const previousNeutralValue = index > 0 ? (reports[index - 1].sentiment_analysis?.neutral ?? 0) : 0;
                
                return (
                  <div key={report.id} className="text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-gray-600">
                      <span className="text-lg">
                        {neutralValue}%
                      </span>
                      {index > 0 && (
                        <div className="flex items-center gap-1">
                          {getTrendIcon(neutralValue, previousNeutralValue)}
                          <span className="text-xs">
                            {getTrendPercentage(neutralValue, previousNeutralValue)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Análise de Tópicos */}
            {reports.some(report => report.topic_analysis && Object.keys(report.topic_analysis).length > 0) && (
              <div className="space-y-4">
                <h3 className="text-lg border-b pb-2">Análise de Tópicos</h3>
                
                {/* Obter todos os tópicos únicos */}
                {(() => {
                  const allTopics = new Set<string>();
                  reports.forEach(report => {
                    if (report.topic_analysis) {
                      Object.keys(report.topic_analysis).forEach(topic => allTopics.add(topic));
                    }
                  });

                  return Array.from(allTopics).map(topic => (
                    <div key={topic} className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}>
                      <div className="flex items-center text-sm truncate" title={topic}>
                        {topic}
                      </div>
                      {reports.map((report, index) => (
                        <div key={report.id} className="text-center">
                          <Badge variant="secondary" className="w-full justify-center">
                            {(() => {
                              const value = report.topic_analysis?.[topic] || 0;
                              if (typeof value === 'object' && value !== null) {
                                // Se for um objeto complexo, tentar extrair valor numérico
                                if (typeof (value as any).count === 'number') return (value as any).count;
                                if (typeof (value as any).frequency === 'number') return (value as any).frequency;
                                if (typeof (value as any).value === 'number') return (value as any).value;
                                // Última tentativa: contar propriedades do objeto
                                return Object.keys(value).length;
                              }
                              // Se for um número, string ou outro tipo primitivo
                              return value || 0;
                            })()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Insights Comparativos */}
            <div className="space-y-4">
              <h3 className="text-lg border-b pb-2">Insights de Cada Relatório</h3>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${reports.length}, 1fr)` }}>
                {reports.map((report) => (
                  <Card key={report.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm truncate" title={report.report_name}>
                        {report.report_name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-32">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {cleanMarkdownFormatting(report.insights)}
                        </p>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
