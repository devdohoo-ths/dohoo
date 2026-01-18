import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Heart,
  X
} from 'lucide-react';
import { useAttendanceReports } from '@/hooks/useAttendanceReports';
import { SentimentAnalysisCard } from '@/components/reports/SentimentAnalysisCard';
import { SentimentReviewsTable } from '@/components/reports/SentimentReviewsTable';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useReportFilterData } from '@/hooks/useReportFilterData';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DatePickerWithRange } from '@/components/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const ReportSentiment: React.FC = () => {
  const { loading, error, filters, applyFilters, refetch } = useAttendanceReports();
  const { toast } = useToast();
  const { operators, loading: dataLoading } = useReportFilterData();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: filters.dateRange.start,
    to: filters.dateRange.end
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [generatingAIReport, setGeneratingAIReport] = useState(false);
  const [aiReport, setAIReport] = useState<any>(null);

  useEffect(() => {
    if (filters.agents) {
      setSelectedUsers(filters.agents);
    }
    
    // Atualizar dateRange quando os filtros mudarem
    if (filters.dateRange) {
      setDateRange({
        from: filters.dateRange.start,
        to: filters.dateRange.end
      });
    }
  }, [filters.agents, filters.dateRange]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    
    if (range?.from && range?.to) {
      applyFilters({
        dateRange: { 
          start: range.from, 
          end: range.to 
        }
      });
    }
  };

  const handleClearFilters = () => {
    // Resetar para último mês
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    
    const defaultRange: DateRange = {
      from: lastMonth,
      to: today
    };
    
    setDateRange(defaultRange);
    setSelectedUsers([]);
    applyFilters({
      dateRange: { start: lastMonth, end: today },
      agents: undefined
    });
  };

  const handleUserFilter = (userId: string, checked: boolean) => {
    const newUsers = checked 
      ? [...selectedUsers, userId]
      : selectedUsers.filter(id => id !== userId);
    
    setSelectedUsers(newUsers);
    applyFilters({
      agents: newUsers.length > 0 ? newUsers : undefined
    });
  };

  const removeUserFilter = (userId: string) => {
    const newUsers = selectedUsers.filter(id => id !== userId);
    setSelectedUsers(newUsers);
    applyFilters({
      agents: newUsers.length > 0 ? newUsers : undefined
    });
  };

  const handleExportSentiment = (format: 'excel' | 'pdf') => {
    if (!aiReport) {
      toast({
        title: "Nenhum relatório para exportar",
        description: "Gere um relatório de sentimento primeiro antes de exportar",
        variant: "destructive",
      });
      return;
    }

    if (format === 'pdf') {
      exportSentimentToPDF();
    } else {
      exportSentimentToExcel();
    }
  };

  const exportSentimentToPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.setTextColor(75, 85, 99);
      doc.text('Análise de Sentimento', 20, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.text(`Período: ${dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'N/A'} até ${dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'N/A'}`, 20, 45);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 55);
      
      let yPosition = 75;
      
      const sentimentData = aiReport?.sentimentAnalysis || aiReport?.sentiment_analysis;
      if (sentimentData) {
        doc.setFontSize(16);
        doc.setTextColor(75, 85, 99);
        doc.text('Análise de Sentimento', 20, yPosition);
        yPosition += 15;
        
        // Sentimento Geral
        if (sentimentData.overall_sentiment) {
          doc.setFontSize(12);
          doc.setTextColor(75, 85, 99);
          doc.text(`Sentimento Geral: ${sentimentData.overall_sentiment}`, 25, yPosition);
          yPosition += 10;
        }
        
        // Score se disponível
        if (sentimentData.sentiment_score !== undefined) {
          doc.setFontSize(11);
          doc.setTextColor(107, 114, 128);
          doc.text(`Score: ${sentimentData.sentiment_score.toFixed(2)}`, 25, yPosition);
          yPosition += 10;
        }
        
        yPosition += 5;
        
        // Distribuição de Sentimentos
        doc.setFontSize(12);
        doc.setTextColor(34, 197, 94);
        const positiveValue = sentimentData.positive_percentage || sentimentData.positive || 0;
        doc.text(`Positivo: ${positiveValue}%`, 25, yPosition);
        yPosition += 10;
        
        doc.setTextColor(239, 68, 68);
        const negativeValue = sentimentData.negative_percentage || sentimentData.negative || 0;
        doc.text(`Negativo: ${negativeValue}%`, 25, yPosition);
        yPosition += 10;
        
        doc.setTextColor(156, 163, 175);
        const neutralValue = sentimentData.neutral_percentage || sentimentData.neutral || 0;
        doc.text(`Neutro: ${neutralValue}%`, 25, yPosition);
        yPosition += 20;
        
        // Exemplos se disponíveis
        if (sentimentData.sentiment_breakdown) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 30;
          }
          
          doc.setFontSize(14);
          doc.setTextColor(75, 85, 99);
          doc.text('Exemplos de Sentimentos', 20, yPosition);
          yPosition += 15;
          
          doc.setFontSize(10);
          doc.setTextColor(107, 114, 128);
          
          if (sentimentData.sentiment_breakdown.positive && sentimentData.sentiment_breakdown.positive.length > 0) {
            doc.setTextColor(34, 197, 94);
            doc.text('Exemplos Positivos:', 25, yPosition);
            yPosition += 8;
            doc.setTextColor(107, 114, 128);
            sentimentData.sentiment_breakdown.positive.slice(0, 3).forEach((example: string) => {
              if (yPosition > 280) {
                doc.addPage();
                yPosition = 30;
              }
              doc.text(`• ${example.substring(0, 80)}`, 30, yPosition);
              yPosition += 7;
            });
            yPosition += 5;
          }
          
          if (sentimentData.sentiment_breakdown.negative && sentimentData.sentiment_breakdown.negative.length > 0) {
            doc.setTextColor(239, 68, 68);
            doc.text('Exemplos Negativos:', 25, yPosition);
            yPosition += 8;
            doc.setTextColor(107, 114, 128);
            sentimentData.sentiment_breakdown.negative.slice(0, 3).forEach((example: string) => {
              if (yPosition > 280) {
                doc.addPage();
                yPosition = 30;
              }
              doc.text(`• ${example.substring(0, 80)}`, 30, yPosition);
              yPosition += 7;
            });
            yPosition += 5;
          }
        }
      }
      
      const fileName = `analise-sentimento-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "PDF exportado",
        description: `Relatório salvo como ${fileName}`,
        variant: "default",
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o PDF",
        variant: "destructive",
      });
    }
  };

  const exportSentimentToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      const sentimentData = aiReport?.sentimentAnalysis || aiReport?.sentiment_analysis;
      const positiveValue = sentimentData?.positive_percentage || sentimentData?.positive || 0;
      const negativeValue = sentimentData?.negative_percentage || sentimentData?.negative || 0;
      const neutralValue = sentimentData?.neutral_percentage || sentimentData?.neutral || 0;
      
      if (sentimentData) {
        const resumoData = [
          ['Análise de Sentimento'],
          [''],
          ['Período', `${dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'N/A'} até ${dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'N/A'}`],
          ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm')],
          [''],
          ['ANÁLISE DE SENTIMENTO'],
          ['Tipo', 'Percentual'],
          ['Positivo', `${positiveValue}%`],
          ['Negativo', `${negativeValue}%`],
          ['Neutro', `${neutralValue}%`],
        ];
        
        // Adicionar sentimento geral se disponível
        if (sentimentData.overall_sentiment) {
          resumoData.push(['']);
          resumoData.push(['Sentimento Geral', sentimentData.overall_sentiment]);
        }
        
        // Adicionar score se disponível
        if (sentimentData.sentiment_score !== undefined) {
          resumoData.push(['Score', sentimentData.sentiment_score.toFixed(2)]);
        }
        
        // Adicionar breakdown de exemplos se disponível
        if (sentimentData.sentiment_breakdown) {
          resumoData.push(['']);
          resumoData.push(['EXEMPLOS POR SENTIMENTO']);
          resumoData.push(['Tipo', 'Exemplo']);
          
          if (sentimentData.sentiment_breakdown.positive && sentimentData.sentiment_breakdown.positive.length > 0) {
            sentimentData.sentiment_breakdown.positive.slice(0, 5).forEach((example: string) => {
              resumoData.push(['Positivo', example]);
            });
          }
          
          if (sentimentData.sentiment_breakdown.negative && sentimentData.sentiment_breakdown.negative.length > 0) {
            sentimentData.sentiment_breakdown.negative.slice(0, 5).forEach((example: string) => {
              resumoData.push(['Negativo', example]);
            });
          }
          
          if (sentimentData.sentiment_breakdown.neutral && sentimentData.sentiment_breakdown.neutral.length > 0) {
            sentimentData.sentiment_breakdown.neutral.slice(0, 5).forEach((example: string) => {
              resumoData.push(['Neutro', example]);
            });
          }
        }
        
        const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
        XLSX.utils.book_append_sheet(workbook, wsResumo, 'Análise');
      }
      
      const fileName = `analise-sentimento-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      toast({
        title: "Excel exportado",
        description: `Relatório salvo como ${fileName}`,
        variant: "default",
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o Excel",
        variant: "destructive",
      });
    }
  };


  const handleGenerateAIReport = async () => {
    try {
      setGeneratingAIReport(true);

      const activeFilters = {
        agents: selectedUsers.length > 0 ? selectedUsers : undefined,
        status: filters.status && filters.status.length > 0 ? filters.status : undefined
      };

      const requestBody = {
        dateStart: dateRange?.from ? new Date(dateRange.from).toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        dateEnd: dateRange?.to ? new Date(dateRange.to).toISOString() : new Date().toISOString(),
        reportType: 'sentiment',
        includeInsights: true,
        filters: activeFilters
      };

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/reports/generate-ai-report`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }

      const data = await response.json();
      
      if (data.success && data.report) {
        setAIReport(data.report);
        
        toast({
          title: "Relatório Gerado!",
          description: "Análise de sentimento concluída com sucesso",
          variant: "default",
        });
      } else {
        throw new Error('Não foi possível gerar análise de sentimento');
      }

    } catch (error) {
      console.error('Erro ao gerar relatório de sentimento:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar análise de sentimento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGeneratingAIReport(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="text-lg">Carregando relatório...</div>
          <div className="text-sm text-muted-foreground">Aguarde enquanto preparamos seus dados</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
          <div className="text-lg">Erro ao carregar dados</div>
          <div className="text-sm text-muted-foreground mb-4">{error}</div>
          <Button onClick={refetch} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard requiredPermissions={['view_attendance_report']}>
      <div className="p-8 max-w-screen-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl flex items-center gap-2">
              <Heart className="h-8 w-8 text-pink-600" />
              Análise de Sentimento
            </h1>
            <p className="text-muted-foreground mt-1">
              Análise inteligente do sentimento das conversas e mensagens dos clientes
            </p>
            
            {/* Filtros ativos */}
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedUsers.length > 0 && (
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  <strong>Usuários:</strong> {selectedUsers.length} selecionado(s)
                </div>
              )}
              {selectedUsers.length === 0 && (
                <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                  <strong>Análise Geral:</strong> Todos os usuários
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <Card className="border-0 shadow-none">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Filter className="h-5 w-5 text-primary" />
                      Filtros de Análise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Período */}
                    <div className="space-y-3">
                      <Label className="text-sm block">Período de Análise</Label>
                      <DatePickerWithRange
                        date={dateRange}
                        onDateChange={handleDateRangeChange}
                        className="w-full"
                      />
                      {dateRange?.from && dateRange?.to && (
                        <div className="text-xs text-muted-foreground">
                          {format(dateRange.from, 'dd/MM/yyyy')} até {format(dateRange.to, 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>

                    {/* Usuários */}
                    <div className="space-y-3">
                      <Label className="text-sm block">Selecionar Usuários</Label>
                      <Select 
                        onValueChange={(value: string) => handleUserFilter(value, true)}
                        disabled={dataLoading}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={dataLoading ? "Carregando usuários..." : "Selecionar usuários..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.length > 0 ? (
                            operators.map((operator) => (
                              <SelectItem 
                                key={operator.value} 
                                value={operator.value}
                                disabled={selectedUsers.includes(operator.value)}
                              >
                                {operator.label}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-users" disabled>
                              {dataLoading ? "Carregando..." : "Nenhum usuário encontrado"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Usuários selecionados */}
                      {selectedUsers.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs block">
                            Usuários Selecionados ({selectedUsers.length})
                          </Label>
                          <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg border min-h-[40px]">
                            {selectedUsers.map((userId) => {
                              const user = operators.find(op => op.value === userId);
                              return (
                                <Badge 
                                  key={userId} 
                                  variant="secondary" 
                                  className="flex items-center gap-1.5 px-2 py-1 text-xs"
                                >
                                  {user?.label}
                                  <X 
                                    className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                                    onClick={() => removeUserFilter(userId)}
                                  />
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        onClick={handleClearFilters}
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Resetar
                      </Button>
                      <Button 
                        onClick={() => setShowFilters(false)}
                        className="flex-1"
                      >
                        Aplicar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </PopoverContent>
            </Popover>

            <Button
              onClick={handleGenerateAIReport}
              disabled={generatingAIReport || !dateRange?.from || !dateRange?.to}
              className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
            >
              {generatingAIReport ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className="h-4 w-4" />
              )}
              {generatingAIReport ? 'Gerando...' : 'Gerar Análise'}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleExportSentiment('excel')}
              className="flex items-center gap-2"
              disabled={!aiReport}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportSentiment('pdf')}
              className="flex items-center gap-2"
              disabled={!aiReport}
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>


        {/* Análise de Sentimento - Foco principal */}
        <div className="space-y-6">
          <SentimentAnalysisCard sentimentData={aiReport?.sentiment_analysis || aiReport?.sentimentAnalysis || null} />
          
          {/* Tabela de Avaliações */}
          {aiReport?.reviews && aiReport.reviews.length > 0 && (
            <SentimentReviewsTable reviews={aiReport.reviews} />
          )}
          
        </div>
      </div>
    </PermissionGuard>
  );
};

export default ReportSentiment;

