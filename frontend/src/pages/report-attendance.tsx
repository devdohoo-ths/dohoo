import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Star,
  Archive
} from 'lucide-react';
import { useAttendanceReports } from '@/hooks/useAttendanceReports';
import { AttendanceOverviewCharts } from '@/components/reports/AttendanceCharts';
// import { AgentPerformanceCharts } from '@/components/reports/AttendanceCharts'; // Removido: aba Performance removida
// import { AttendanceAgentsList } from '@/components/reports/AttendanceAgentsList'; // Removido: aba Agentes removida
import { AIInsightsCard } from '@/components/reports/AIInsightsCard';
import { SentimentAnalysisCard } from '@/components/reports/SentimentAnalysisCard';
import { TopicAnalysisCard } from '@/components/reports/TopicAnalysisCard';
import { AIReportsHistory } from '@/components/reports/AIReportsHistory';
import { ReportComparison } from '@/components/reports/ReportComparison';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAIReportsHistory } from '@/hooks/useAIReportsHistory';
import { useReportFilterData } from '@/hooks/useReportFilterData';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const ReportAttendance: React.FC = () => {
  const { agents, stats, loading, error, filters, applyFilters, refetch } = useAttendanceReports();
  
  // Debug: verificar se os dados estão chegando
  console.log('[Report-Attendance] Estado atual: Object');
  const { reports: historyReports, saveReport, deleteReport } = useAIReportsHistory();
  const { toast } = useToast();
  
  // Hook para dados de filtros (usuários)
  const { operators, loading: dataLoading } = useReportFilterData();
  
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year' | 'custom'>('week');
  const [startDate, setStartDate] = useState(
    format(filters.dateRange.start, 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    format(filters.dateRange.end, 'yyyy-MM-dd')
  );
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  
  // Estados para filtros de usuários
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [generatingAIReport, setGeneratingAIReport] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiReport, setAIReport] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [reportName, setReportName] = useState('');
  const [selectedReportsForComparison, setSelectedReportsForComparison] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  // const [activeTab, setActiveTab] = useState('overview'); // Removido: não usa mais abas

  // Monitorar mudanças no estado aiInsights
  useEffect(() => {
    // aiInsights mudou
  }, [aiInsights]);

  // Inicializar com período semanal
  useEffect(() => {
    handlePeriodChange('week');
  }, []);

  // Sincronizar filtros locais com os filtros do hook
  useEffect(() => {
    if (filters.agents) {
      setSelectedUsers(filters.agents);
    }
  }, [filters.agents]);

  const calculatePeriodDates = (period: 'week' | 'month' | 'year') => {
    const today = new Date();
    let start: Date;
    let end: Date = new Date(today);

    switch (period) {
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start = new Date(today);
        start.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        start = new Date(today);
        start.setFullYear(today.getFullYear() - 1);
        break;
      default:
        start = new Date(today);
        start.setDate(today.getDate() - 7);
    }

    return { start, end };
  };

  const handlePeriodChange = (period: 'week' | 'month' | 'year' | 'custom') => {
    setSelectedPeriod(period);
    
    if (period === 'custom') {
      setShowCustomPeriod(true);
      return;
    }

    setShowCustomPeriod(false);
    const { start, end } = calculatePeriodDates(period);
    
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
    
    applyFilters({
      dateRange: { start, end }
    });
  };

  const handleCustomPeriodApply = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validar se o período é de pelo menos uma semana
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
      toast({
        title: "Período inválido",
        description: "O período customizado deve ser de pelo menos uma semana (7 dias)",
        variant: "destructive",
      });
      return;
    }

    applyFilters({
      dateRange: { start, end }
    });
  };

  const handleClearFilters = () => {
    handlePeriodChange('week'); // Volta para período semanal (padrão)
    setSelectedUsers([]);
    applyFilters({
      agents: undefined
    });
  };

  // Funções para gerenciar filtros de usuários
  const handleUserFilter = (userId: string, checked: boolean) => {
    const newUsers = checked 
      ? [...selectedUsers, userId]
      : selectedUsers.filter(id => id !== userId);
    
    setSelectedUsers(newUsers);
    
    // Aplicar filtros com os novos usuários
    applyFilters({
      agents: newUsers.length > 0 ? newUsers : undefined
    });
  };

  const removeUserFilter = (userId: string) => {
    const newUsers = selectedUsers.filter(id => id !== userId);
    setSelectedUsers(newUsers);
    
    // Aplicar filtros com os novos usuários
    applyFilters({
      agents: newUsers.length > 0 ? newUsers : undefined
    });
  };

  // Funções para gerenciar filtros de times - REMOVIDAS
  // const handleTeamFilter = ...
  // const removeTeamFilter = ...

  const handleExportAI = (format: 'excel' | 'pdf') => {
    if (!aiReport) {
      toast({
        title: "Nenhum relatório para exportar",
        description: "Gere um relatório de IA primeiro antes de exportar",
        variant: "destructive",
      });
      return;
    }

    if (format === 'pdf') {
      exportAIToPDF();
    } else {
      exportAIToExcel();
    }
  };

  const exportAIToPDF = () => {
    try {
      // Debug: logs para investigação
      console.log('[Export] aiReport completo:', aiReport);
      console.log('[Export] sentiment_analysis:', aiReport?.sentiment_analysis);
      console.log('[Export] sentimentAnalysis:', aiReport?.sentimentAnalysis);
      
      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(20);
      doc.setTextColor(75, 85, 99);
      doc.text('Análise Inteligente - Relatório de IA', 20, 30);
      
      // Período
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.text(`Período: ${format(new Date(startDate), 'dd/MM/yyyy')} até ${format(new Date(endDate), 'dd/MM/yyyy')}`, 20, 45);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 55);
      
      let yPosition = 75;
      
      // Análise de Sentimento
      const sentimentData = aiReport.sentiment_analysis || aiReport.sentimentAnalysis;
      if (sentimentData) {
        doc.setFontSize(16);
        doc.setTextColor(75, 85, 99);
        doc.text('Análise de Sentimento', 20, yPosition);
        yPosition += 15;
        
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
      }
      
      // Análise de Tópicos
      const topicData = aiReport.topic_analysis || aiReport.topicAnalysis;
      console.log('[Export] topicData completo:', topicData);
      
      if (topicData) {
        let topicsToProcess = [];
        
        // Verificar se é um array de topics
        if (topicData.topics && Array.isArray(topicData.topics)) {
          topicsToProcess = topicData.topics;
          console.log('[Export] Usando topics array:', topicsToProcess);
        }
        // Verificar se é um objeto direto
        else if (typeof topicData === 'object' && Object.keys(topicData).length > 0) {
          topicsToProcess = Object.entries(topicData).map(([topic, count]) => ({
            name: topic,
            count: typeof count === 'object' ? (count as any)?.count || (count as any)?.frequency || 0 : count
          }));
          console.log('[Export] Usando object entries:', topicsToProcess);
        }
        
        if (topicsToProcess.length > 0) {
          doc.setFontSize(16);
          doc.setTextColor(75, 85, 99);
          doc.text('Análise de Tópicos', 20, yPosition);
          yPosition += 15;
          
          topicsToProcess.forEach((topic: any) => {
            doc.setFontSize(12);
            doc.setTextColor(107, 114, 128);
            
            // Se for do array topics
            if (topic.name && topic.count !== undefined) {
              doc.text(`• ${topic.name}: ${topic.count} ocorrências`, 25, yPosition);
            }
            // Se for do object entries
            else if (typeof topic === 'object' && topic.count !== undefined) {
              doc.text(`• ${topic.name}: ${topic.count}`, 25, yPosition);
            }
            
            yPosition += 10;
            
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 30;
            }
          });
          yPosition += 10;
        }
      }
      
      // Insights
      if (aiInsights) {
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 30;
        }
        
        doc.setFontSize(16);
        doc.setTextColor(75, 85, 99);
        doc.text('Insights e Recomendações', 20, yPosition);
        yPosition += 15;
        
        // Dividir texto em linhas
        const splitText = doc.splitTextToSize(aiInsights, 170);
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        
        splitText.forEach((line: string) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 30;
          }
          doc.text(line, 20, yPosition);
          yPosition += 5;
        });
      }
      
      // Salvar PDF
      const fileName = `analise-inteligente-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
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

  const exportAIToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Aba 1: Resumo
      const sentimentData = aiReport.sentiment_analysis || aiReport.sentimentAnalysis;
      const positiveValue = sentimentData?.positive_percentage || sentimentData?.positive || 0;
      const negativeValue = sentimentData?.negative_percentage || sentimentData?.negative || 0;
      const neutralValue = sentimentData?.neutral_percentage || sentimentData?.neutral || 0;
      
      const resumoData = [
        ['Análise Inteligente - Relatório de IA'],
        [''],
        ['Período', `${format(new Date(startDate), 'dd/MM/yyyy')} até ${format(new Date(endDate), 'dd/MM/yyyy')}`],
        ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm')],
        [''],
        ['ANÁLISE DE SENTIMENTO'],
        ['Tipo', 'Percentual'],
        ['Positivo', `${positiveValue}%`],
        ['Negativo', `${negativeValue}%`],
        ['Neutro', `${neutralValue}%`],
      ];
      
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');
      
      // Aba 2: Tópicos
      const topicDataExcel = aiReport.topic_analysis || aiReport.topicAnalysis;
      if (topicDataExcel) {
        let topicsToProcessExcel = [];
        
        // Verificar se é um array de topics
        if (topicDataExcel.topics && Array.isArray(topicDataExcel.topics)) {
          topicsToProcessExcel = topicDataExcel.topics;
        }
        // Verificar se é um objeto direto
        else if (typeof topicDataExcel === 'object' && Object.keys(topicDataExcel).length > 0) {
          topicsToProcessExcel = Object.entries(topicDataExcel).map(([topic, count]) => ({
            name: topic,
            count: typeof count === 'object' ? (count as any)?.count || (count as any)?.frequency || 0 : count
          }));
        }
        
        if (topicsToProcessExcel.length > 0) {
          const topicosData = [
            ['Análise de Tópicos'],
            [''],
            ['Tópico', 'Ocorrências'],
          ];
          
          topicsToProcessExcel.forEach((topic: any) => {
            if (topic.name && topic.count !== undefined) {
              topicosData.push([topic.name, topic.count]);
            }
          });
          
          const wsTopicos = XLSX.utils.aoa_to_sheet(topicosData);
          XLSX.utils.book_append_sheet(workbook, wsTopicos, 'Tópicos');
        }
      }
      
      // Aba 3: Insights
      if (aiInsights) {
        const insightsData = [
          ['Insights e Recomendações'],
          [''],
          ['Análise Completa'],
          [aiInsights]
        ];
        
        const wsInsights = XLSX.utils.aoa_to_sheet(insightsData);
        XLSX.utils.book_append_sheet(workbook, wsInsights, 'Insights');
      }
      
      // Salvar Excel
      const fileName = `analise-inteligente-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
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

  const handleSaveReport = async () => {
    if (!aiReport || !reportName.trim()) {
      toast({
        title: "Erro",
        description: "Nome do relatório é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      await saveReport({
        reportName: reportName.trim(),
        dateStart: new Date(startDate).toISOString(),
        dateEnd: new Date(endDate).toISOString(),
        reportData: aiReport,
        totalMessages: aiReport.summary?.totalMessages || 0,
        totalAgents: aiReport.summary?.totalAgents || 0,
        sentimentAnalysis: aiReport.sentiment_analysis || aiReport.sentimentAnalysis,
        topicAnalysis: aiReport.topic_analysis || aiReport.topicAnalysis,
        insights: aiReport.insights
      });

      toast({
        title: "Sucesso!",
        description: "Relatório salvo no histórico",
        variant: "default",
      });
      
      setReportName('');
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar relatório",
        variant: "destructive",
      });
    }
  };

  const handleViewHistory = () => {
    setShowHistory(!showHistory);
  };

  const handleCompareReport = (report: any) => {
    // Adicionar ou remover relatório da seleção para comparação
    const isSelected = selectedReportsForComparison.find(r => r.id === report.id);
    
    if (isSelected) {
      // Remover da seleção
      setSelectedReportsForComparison(prev => prev.filter(r => r.id !== report.id));
      toast({
        title: "Relatório removido",
        description: `"${report.report_name}" foi removido da comparação`,
        variant: "default",
      });
    } else {
      // Adicionar à seleção (máximo 3 relatórios)
      if (selectedReportsForComparison.length < 3) {
        setSelectedReportsForComparison(prev => [...prev, report]);
        toast({
          title: "Relatório adicionado",
          description: `"${report.report_name}" foi adicionado à comparação`,
          variant: "default",
        });
      } else {
        toast({
          title: "Limite atingido",
          description: "Você pode comparar no máximo 3 relatórios por vez",
          variant: "destructive",
        });
      }
    }
  };

  const handleViewComparison = () => {
    if (selectedReportsForComparison.length < 2) {
      toast({
        title: "Selecione mais relatórios",
        description: "Selecione pelo menos 2 relatórios para comparar",
        variant: "destructive",
      });
      return;
    }
    setShowComparison(true);
  };


  const handleDeleteReport = async (report: any) => {
    try {
      await deleteReport(report.id);
    toast({
        title: "Relatório deletado",
        description: `"${report.report_name}" foi removido do histórico`,
      variant: "default",
    });
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível deletar o relatório. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateAIReport = async () => {
    try {
      setGeneratingAIReport(true);
      setAiInsights(null);

      // Preparar filtros ativos para a IA
      const activeFilters = {
        agents: selectedUsers.length > 0 ? selectedUsers : undefined,
        status: filters.status && filters.status.length > 0 ? filters.status : undefined
      };

      const requestBody = {
        dateStart: new Date(startDate).toISOString(),
        dateEnd: new Date(endDate).toISOString(),
        reportType: 'attendance',
        includeInsights: true,
        filters: activeFilters
      };

      console.log('[Frontend] Enviando relatório IA com filtros:', {
        dateStart: requestBody.dateStart,
        dateEnd: requestBody.dateEnd,
        period: `${startDate} até ${endDate}`,
        activeFilters: activeFilters,
        selectedUsers: selectedUsers
      });

      // ✅ CORRIGIDO: Usar getAuthHeaders()
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
        const insightsText = data.report.insights || 'Análise gerada com sucesso';
        
        setAiInsights(insightsText);
        setAIReport(data.report);
        
        // Determinar tipo de análise baseado nos filtros
        const hasUserFilters = selectedUsers.length > 0;
        const hasStatusFilters = filters.status && filters.status.length > 0;
        
        let analysisType = 'Análise Geral';
        if (hasUserFilters || hasStatusFilters) {
          const filtersApplied = [];
          if (hasUserFilters) filtersApplied.push(`${selectedUsers.length} usuário(s)`);
          if (hasStatusFilters) filtersApplied.push(`${filters.status.length} status`);
          analysisType = `Análise Filtrada (${filtersApplied.join(', ')})`;
        }
        
        toast({
          title: "Relatório Gerado!",
          description: `${analysisType} com IA concluída com sucesso`,
          variant: "default",
        });
      } else {
        throw new Error('Não foi possível gerar insights');
      }

    } catch (error) {
      console.error('Erro ao gerar relatório com IA:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório com IA. Tente novamente.",
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
          <div className="text-lg">Carregando relatório de presença...</div>
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

  if (!stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500" />
          <div className="text-lg">Nenhum dado encontrado</div>
          <div className="text-sm text-muted-foreground">
            Não há dados de atendimento para o período selecionado
          </div>
        </div>
      </div>
    );
  }

  // Renderizando componente
  
  return (
          <PermissionGuard requiredPermissions={['view_attendance_report']}>
      <div className="p-8 max-w-screen-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl">Análise Inteligente</h1>
          <p className="text-muted-foreground mt-1">
            Insights avançados e análise comportamental automatizada com Inteligência Artificial
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
        <div className="flex items-center gap-2">
          <Button
            onClick={handleViewHistory}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            Histórico ({historyReports.length})
          </Button>
          
          <Button
            onClick={handleGenerateAIReport}
            disabled={generatingAIReport}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {generatingAIReport ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
            {generatingAIReport ? 'Gerando...' : 'Gerar Relatório IA'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => handleExportAI('excel')}
            className="flex items-center gap-2"
            disabled={!aiReport}
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportAI('pdf')}
            className="flex items-center gap-2"
            disabled={!aiReport}
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Período de Análise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Período de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Seleção de Período */}
            <div>
              <Label className="text-sm mb-3 block">Escolha o período para análise:</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Button
                  variant={selectedPeriod === 'week' ? 'default' : 'outline'}
                  onClick={() => handlePeriodChange('week')}
                  className="flex items-center gap-2"
                >
                  Semana
                </Button>
                <Button
                  variant={selectedPeriod === 'month' ? 'default' : 'outline'}
                  onClick={() => handlePeriodChange('month')}
                  className="flex items-center gap-2"
                >
                  Mês
                </Button>
                <Button
                  variant={selectedPeriod === 'year' ? 'default' : 'outline'}
                  onClick={() => handlePeriodChange('year')}
                  className="flex items-center gap-2"
                >
                  Ano
                </Button>
                <Button
                  variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
                  onClick={() => handlePeriodChange('custom')}
                  className="flex items-center gap-2"
                >
                  Customizado
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClearFilters} 
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Resetar
                </Button>
              </div>
            </div>

            {/* Período Customizado */}
            {showCustomPeriod && (
              <div className="border-2 border-dashed border-orange-200 bg-orange-50 p-4 rounded-lg">
                <Label className="text-sm mb-2 block text-orange-800">
                  Período Customizado (mínimo 7 dias)
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="dateStart" className="text-xs">Data Início</Label>
              <Input
                      id="dateStart"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
                  <div>
                    <Label htmlFor="dateEnd" className="text-xs">Data Fim</Label>
              <Input
                      id="dateEnd"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleCustomPeriodApply} 
                      className="w-full"
                    >
                      Aplicar Período
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Filtros de Usuários */}
            <div className="grid grid-cols-1 gap-4">
              {/* Filtro de Usuários */}
              <div>
                <Label className="text-sm mb-2 block">Filtrar por Usuários</Label>
                <Select 
                  onValueChange={(value) => handleUserFilter(value, true)}
                  disabled={dataLoading}
                >
                  <SelectTrigger>
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
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedUsers.map((userId) => {
                      const user = operators.find(op => op.value === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                          {user?.label}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-red-500" 
                            onClick={() => removeUserFilter(userId)}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Informação do período atual */}
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border-l-4 border-blue-400">
              <strong>Período atual:</strong> {format(new Date(startDate), 'dd/MM/yyyy')} até {format(new Date(endDate), 'dd/MM/yyyy')}
              {selectedPeriod !== 'custom' && (
                <span className="ml-2 text-blue-500">
                  ({selectedPeriod === 'week' ? 'Última semana' : selectedPeriod === 'month' ? 'Último mês' : 'Último ano'})
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Análise com IA */}
      <div className="space-y-4">

        <AttendanceOverviewCharts stats={stats!} agents={agents} />
      </div>

      {/* Relatórios de IA */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIInsightsCard 
            insights={aiInsights}
            recommendations={aiReport?.recommendations}
            dateRange={aiInsights ? { start: startDate, end: endDate } : undefined}
            onGenerate={handleGenerateAIReport}
            generating={generatingAIReport}
          />
          <SentimentAnalysisCard sentimentData={aiReport?.sentimentAnalysis || null} />
        </div>
        
        {/* Topic Analysis Card */}
        {aiReport?.topicAnalysis && (
          <TopicAnalysisCard topicData={aiReport.topicAnalysis} />
        )}
        
        {aiInsights && (
          <>
            {/* Opção para salvar relatório */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-600" />
                  Salvar Relatório no Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="reportName">Nome do Relatório</Label>
                    <Input
                      id="reportName"
                      placeholder="Ex: Relatório Semanal - Janeiro 2024"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSaveReport}
                    disabled={!reportName.trim() || !aiReport}
                    className="flex items-center gap-2"
                  >
                    <Star className="h-4 w-4" />
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Histórico de Relatórios */}
      {showHistory && (
        <AIReportsHistory
          reports={historyReports}
          onViewReport={handleCompareReport}
          selectedForComparison={selectedReportsForComparison}
          onViewComparison={handleViewComparison}
          onDeleteReport={handleDeleteReport}
        />
      )}

      {/* Modal de Comparação */}
      {showComparison && (
        <ReportComparison
          reports={selectedReportsForComparison}
          open={showComparison}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
    </PermissionGuard>
  );
};

export default ReportAttendance; 