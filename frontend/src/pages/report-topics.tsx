import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Tag,
  X
} from 'lucide-react';
import { useAttendanceReports } from '@/hooks/useAttendanceReports';
import { TopicAnalysisCard } from '@/components/reports/TopicAnalysisCard';
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

const ReportTopics: React.FC = () => {
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

  const handleExportTopics = (format: 'excel' | 'pdf') => {
    if (!aiReport) {
      toast({
        title: "Nenhum relatório para exportar",
        description: "Gere um relatório de tópicos primeiro antes de exportar",
        variant: "destructive",
      });
      return;
    }

    if (format === 'pdf') {
      exportTopicsToPDF();
    } else {
      exportTopicsToExcel();
    }
  };

  const exportTopicsToPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.setTextColor(75, 85, 99);
      doc.text('Tópicos/Temas Identificados', 20, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.text(`Período: ${dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'N/A'} até ${dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'N/A'}`, 20, 45);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 55);
      
      let yPosition = 75;
      
      const topicData = aiReport?.topicAnalysis || aiReport?.topic_analysis;
      if (topicData) {
        let topicsToProcess = [];
        
        if (topicData.topics && Array.isArray(topicData.topics)) {
          topicsToProcess = topicData.topics;
        } else if (typeof topicData === 'object' && Object.keys(topicData).length > 0) {
          topicsToProcess = Object.entries(topicData).map(([topic, count]) => ({
            name: topic,
            count: typeof count === 'object' ? (count as any)?.count || (count as any)?.frequency || 0 : count
          }));
        }
        
        if (topicsToProcess.length > 0) {
          doc.setFontSize(16);
          doc.setTextColor(75, 85, 99);
          doc.text('Tópicos/Temas Identificados', 20, yPosition);
          yPosition += 15;
          
          topicsToProcess.forEach((topic: any) => {
            doc.setFontSize(12);
            doc.setTextColor(75, 85, 99);
            
            if (topic.name) {
              // Nome do tópico
              doc.text(`• ${topic.name}`, 25, yPosition);
              yPosition += 8;
              
              // Descrição se disponível
              if (topic.description) {
                doc.setFontSize(10);
                doc.setTextColor(107, 114, 128);
                const descLines = doc.splitTextToSize(topic.description, 165);
                descLines.forEach((line: string) => {
                  if (yPosition > 280) {
                    doc.addPage();
                    yPosition = 30;
                  }
                  doc.text(line, 30, yPosition);
                  yPosition += 6;
                });
              }
              
              // Frequência e ocorrências
              doc.setFontSize(10);
              doc.setTextColor(107, 114, 128);
              const count = topic.count !== undefined ? topic.count : (topic.frequency || 'N/A');
              doc.text(`   Frequência: ${topic.frequency || 'N/A'} | Ocorrências: ${count}`, 30, yPosition);
              yPosition += 8;
              
              // Keywords se disponíveis
              if (topic.keywords && topic.keywords.length > 0) {
                doc.setFontSize(9);
                doc.setTextColor(107, 114, 128);
                const keywordsText = `   Palavras-chave: ${topic.keywords.slice(0, 5).join(', ')}${topic.keywords.length > 5 ? '...' : ''}`;
                doc.text(keywordsText, 30, yPosition);
                yPosition += 8;
              }
              
              yPosition += 5;
              
              if (yPosition > 270) {
                doc.addPage();
                yPosition = 30;
              }
            }
          });
        }
      }
      
      const fileName = `topicos-temas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
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

  const exportTopicsToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      const topicDataExcel = aiReport?.topicAnalysis || aiReport?.topic_analysis;
      if (topicDataExcel) {
        let topicsToProcessExcel = [];
        
        if (topicDataExcel.topics && Array.isArray(topicDataExcel.topics)) {
          topicsToProcessExcel = topicDataExcel.topics;
        } else if (typeof topicDataExcel === 'object' && Object.keys(topicDataExcel).length > 0) {
          topicsToProcessExcel = Object.entries(topicDataExcel).map(([topic, count]) => ({
            name: topic,
            count: typeof count === 'object' ? (count as any)?.count || (count as any)?.frequency || 0 : count
          }));
        }
        
        if (topicsToProcessExcel.length > 0) {
          const topicosData = [
            ['Tópicos/Temas Identificados'],
            [''],
            ['Período', `${dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'N/A'} até ${dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'N/A'}`],
            ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm')],
            [''],
            ['Tópico', 'Descrição', 'Frequência', 'Ocorrências', 'Palavras-chave'],
          ];
          
          topicsToProcessExcel.forEach((topic: any) => {
            if (topic.name) {
              const count = topic.count !== undefined ? topic.count : (topic.frequency || 'N/A');
              const keywords = topic.keywords && topic.keywords.length > 0 
                ? topic.keywords.slice(0, 10).join(', ') + (topic.keywords.length > 10 ? '...' : '')
                : 'N/A';
              topicosData.push([
                topic.name || 'N/A',
                topic.description || 'N/A',
                topic.frequency || 'N/A',
                count,
                keywords
              ]);
            }
          });
          
          const wsTopicos = XLSX.utils.aoa_to_sheet(topicosData);
          XLSX.utils.book_append_sheet(workbook, wsTopicos, 'Tópicos');
        }
      }
      
      const fileName = `topicos-temas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
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
        reportType: 'topics',
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
          description: "Análise de tópicos/temas concluída com sucesso",
          variant: "default",
        });
      } else {
        throw new Error('Não foi possível gerar análise de tópicos');
      }

    } catch (error) {
      console.error('Erro ao gerar relatório de tópicos:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar análise de tópicos. Tente novamente.",
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
              <Tag className="h-8 w-8 text-blue-600" />
              Tópicos/Temas Identificados
            </h1>
            <p className="text-muted-foreground mt-1">
              Análise inteligente dos principais temas e tópicos identificados nas conversas
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
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {generatingAIReport ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Tag className="h-4 w-4" />
              )}
              {generatingAIReport ? 'Gerando...' : 'Gerar Análise'}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleExportTopics('excel')}
              className="flex items-center gap-2"
              disabled={!aiReport}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportTopics('pdf')}
              className="flex items-center gap-2"
              disabled={!aiReport}
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Análise de Tópicos/Temas - Foco principal */}
        <div className="space-y-6">
          <TopicAnalysisCard topicData={aiReport?.topic_analysis || aiReport?.topicAnalysis || null} />
          
        </div>
      </div>
    </PermissionGuard>
  );
};

export default ReportTopics;

