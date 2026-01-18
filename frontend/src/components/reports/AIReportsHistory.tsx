import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Calendar, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Eye,
  Save,
  FileText,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AIReportHistory } from '@/hooks/useAIReportsHistory';

interface AIReportsHistoryProps {
  reports: AIReportHistory[];
  onViewReport: (report: AIReportHistory) => void;
  onSaveReport?: (report: AIReportHistory) => void;
  selectedForComparison?: AIReportHistory[];
  onViewComparison?: () => void;
  onDeleteReport?: (report: AIReportHistory) => void;
}

export const AIReportsHistory: React.FC<AIReportsHistoryProps> = ({
  reports,
  onViewReport,
  onSaveReport,
  selectedForComparison = [],
  onViewComparison,
  onDeleteReport
}) => {
  const [selectedReport, setSelectedReport] = useState<AIReportHistory | null>(null);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  const getSentimentColor = (sentiment: number) => {
    const value = typeof sentiment === 'number' && !isNaN(sentiment) ? sentiment : 0;
    if (value >= 70) return 'bg-green-100 text-green-800';
    if (value >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getSentimentLabel = (sentiment: number) => {
    const value = typeof sentiment === 'number' && !isNaN(sentiment) ? sentiment : 0;
    if (value >= 70) return 'Excelente';
    if (value >= 40) return 'Bom';
    return 'Precisa Melhorar';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            Histórico de Relatórios IA
            <Badge variant="secondary">
              {reports.length}
            </Badge>
          </CardTitle>
          
          {selectedForComparison.length >= 2 && onViewComparison && (
            <Button onClick={onViewComparison} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Visualizar Comparação ({selectedForComparison.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum relatório salvo ainda. Gere um relatório e salve-o para ver o histórico.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg mb-2">{report.report_name}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDate(report.date_start)} - {formatDate(report.date_end)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <Badge className={getSentimentColor(report.sentiment_analysis?.positive ?? 0)}>
                            {getSentimentLabel(report.sentiment_analysis?.positive ?? 0)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Criado em: {formatDate(report.created_at)}</span>
                        {report.updated_at !== report.created_at && (
                          <span>• Atualizado em: {formatDate(report.updated_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>{report.report_name}</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-6">
                              {/* Período */}
                              <div>
                                <h4 className="mb-2">Período Analisado</h4>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(report.date_start)} até {formatDate(report.date_end)}
                                </p>
                              </div>

                              {/* Métrica Principal */}
                              <div className="flex justify-center">
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                  <div className="text-3xl text-purple-600">
                                    {report.sentiment_analysis?.positive ?? 0}%
                                  </div>
                                  <div className="text-sm text-muted-foreground">Satisfação Geral</div>
                                </div>
                              </div>

                              {/* Análise de Sentimento */}
                              <div>
                                <h4 className="mb-3">Análise de Sentimento</h4>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="text-center">
                                    <div className="text-lg text-green-600">
                                      {report.sentiment_analysis?.positive ?? 0}%
                                    </div>
                                    <div className="text-sm text-muted-foreground">Positivo</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg text-yellow-600">
                                      {report.sentiment_analysis?.neutral ?? 0}%
                                    </div>
                                    <div className="text-sm text-muted-foreground">Neutro</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg text-red-600">
                                      {report.sentiment_analysis?.negative ?? 0}%
                                    </div>
                                    <div className="text-sm text-muted-foreground">Negativo</div>
                                  </div>
                                </div>
                              </div>

                              {/* Análise de Tópicos */}
                              {report.topic_analysis && Object.keys(report.topic_analysis).length > 0 && (
                                <div>
                                  <h4 className="mb-3">Análise de Tópicos</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(report.topic_analysis).map(([topic, count]) => (
                                      <div key={topic} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <span className="">{topic}</span>
                                        <Badge variant="secondary">
                                          {(() => {
                                            if (typeof count === 'object' && count !== null) {
                                              // Se for um objeto complexo, tentar extrair valor numérico
                                              if (typeof (count as any).count === 'number') return (count as any).count;
                                              if (typeof (count as any).frequency === 'number') return (count as any).frequency;
                                              if (typeof (count as any).value === 'number') return (count as any).value;
                                              // Última tentativa: contar propriedades do objeto
                                              return Object.keys(count).length;
                                            }
                                            // Se for um número, string ou outro tipo primitivo
                                            return count || 0;
                                          })()}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Insights */}
                              <div>
                                <h4 className="mb-3">Insights e Recomendações</h4>
                                <div className="bg-blue-50 p-4 rounded-lg">
                                  <p className="text-sm whitespace-pre-wrap">{report.insights}</p>
                                </div>
                              </div>
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant={selectedForComparison.find(r => r.id === report.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => onViewReport(report)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {selectedForComparison.find(r => r.id === report.id) ? "Selecionado" : "Comparar"}
                      </Button>

                      {onDeleteReport && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeleteReport(report)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Deletar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 