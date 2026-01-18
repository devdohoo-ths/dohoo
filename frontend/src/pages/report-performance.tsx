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
  TrendingUp,
  Clock,
  MessageCircle,
  User,
  Users,
  Target,
  Activity,
  BarChart3,
  Sparkles,
  CheckCircle,
  X,
  Calendar,
  Trophy
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';

interface PerformanceData {
  agent: {
    id: string;
    name: string;
    email: string;
    department?: string;
    isOnline: boolean;
    role: string;
  };
  metrics: {
    workTimeMinutes: number;
    workTimeHours: string;
    sentMessages: number;
    receivedMessages: number;
    totalMessages: number;
    newContacts: number;
    avgResponseTime: number;
    avgResponseTimeMinutes: string;
    bestResponseTime: number;
    bestResponseTimeMinutes: string;
    responseRate: string;
    totalConversations: number;
    resolvedConversations: number;
    resolutionRate: string;
    performanceScore: number;
    attentionPoints: string[];
  };
  activity: {
    messagesByDay: Array<{
      date: string;
      sent: number;
      received: number;
      total: number;
    }>;
    messagesByHour: Array<{
      hour: number;
      sent: number;
      received: number;
      total: number;
    }>;
  };
}

interface AIAnalysis {
  validation: Array<{
    agentName: string;
    worked: boolean;
    workQuality: string;
    reason: string;
    confidence: number;
  }>;
  summary: string;
  topPerformers: string[];
  needsAttention: Array<{
    agentName: string;
    issues: string[];
    priority: 'alta' | 'média' | 'baixa';
    recommendations: string[];
  }>;
  generalRecommendations: string[];
}

const ReportPerformance: React.FC = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { operators, departments: teams, loading: dataLoading } = useReportFilterData();
  
  const [filterType, setFilterType] = useState<'general' | 'individual' | 'team'>('general');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  // Inicializar com o dia atual
  const getTodayString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [endDate, setEndDate] = useState<string>(getTodayString());
  
  const [generatingReport, setGeneratingReport] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [includeAI, setIncludeAI] = useState(true);

  useEffect(() => {
    console.log('📊 [PERFORMANCE] Estado atualizado:', {
      startDate,
      endDate,
      filterType,
      selectedAgentId,
      selectedTeamId,
      performanceDataCount: performanceData.length,
      generatingReport
    });
  }, [startDate, endDate, filterType, selectedAgentId, selectedTeamId, performanceData.length, generatingReport]);

  const handleClearFilters = () => {
    const today = getTodayString();
    setStartDate(today);
    setEndDate(today);
    setFilterType('general');
    setSelectedAgentId('');
    setSelectedTeamId('');
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Período inválido",
        description: "Selecione um período válido",
        variant: "destructive",
      });
      return;
    }

    if (filterType === 'individual' && !selectedAgentId) {
      toast({
        title: "Agente não selecionado",
        description: "Selecione um agente para análise individual",
        variant: "destructive",
      });
      return;
    }

    if (filterType === 'team' && !selectedTeamId) {
      toast({
        title: "Time não selecionado",
        description: "Selecione um time para análise",
        variant: "destructive",
      });
      return;
    }

    setGeneratingReport(true);
    try {
      console.log('📊 [PERFORMANCE] Iniciando geração de relatório...', {
        startDate,
        endDate,
        filterType,
        agentId: filterType === 'individual' ? selectedAgentId : undefined,
        teamId: filterType === 'team' ? selectedTeamId : undefined,
        includeAI,
        apiBase
      });

      const headers = await getAuthHeaders();
      
      // Criar datas no início e fim do dia no fuso horário local
      // Converter para ISO mas garantir que mantenha o dia correto
      const createDateISO = (dateString: string, isEnd: boolean = false): string => {
        const [year, month, day] = dateString.split('-').map(Number);
        // Criar data local (sem conversão de fuso)
        const localDate = new Date(year, month - 1, day);
        if (isEnd) {
          localDate.setHours(23, 59, 59, 999);
        } else {
          localDate.setHours(0, 0, 0, 0);
        }
        // Converter para ISO mas ajustar o offset para manter o dia local
        const offset = localDate.getTimezoneOffset();
        const adjustedDate = new Date(localDate.getTime() - (offset * 60 * 1000));
        return adjustedDate.toISOString();
      };

      const requestBody = {
        dateStart: createDateISO(startDate, false),
        dateEnd: createDateISO(endDate, true),
        filterType,
        agentId: filterType === 'individual' ? selectedAgentId : undefined,
        teamId: filterType === 'team' ? selectedTeamId : undefined,
        includeAI
      };

      console.log('📊 [PERFORMANCE] Enviando requisição para:', `${apiBase}/api/reports/performance`);
      console.log('📊 [PERFORMANCE] Body da requisição:', requestBody);
      
      const response = await fetch(`${apiBase}/api/reports/performance`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log('📊 [PERFORMANCE] Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [PERFORMANCE] Erro na resposta:', errorText);
        throw new Error(`Erro HTTP ${response.status}: ${errorText || 'Erro ao gerar relatório'}`);
      }

      const data = await response.json();
      console.log('📊 [PERFORMANCE] Dados recebidos:', {
        success: data.success,
        performanceCount: data.performance?.length || 0,
        hasAnalysis: !!data.analysis,
        error: data.error
      });
      
      if (data.success) {
        setPerformanceData(data.performance || []);
        setAiAnalysis(data.analysis || null);
        
        console.log('✅ [PERFORMANCE] Relatório gerado com sucesso!', {
          agents: data.performance?.length || 0,
          hasAI: !!data.analysis
        });
        
        toast({
          title: "Relatório Gerado!",
          description: `Análise de performance concluída com sucesso. ${data.performance?.length || 0} agente(s) processado(s).`,
          variant: "default",
        });
      } else {
        const errorMsg = data.error || data.message || 'Erro ao gerar relatório';
        console.error('❌ [PERFORMANCE] Resposta sem sucesso:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('❌ [PERFORMANCE] Erro completo ao gerar relatório:', error);
      console.error('❌ [PERFORMANCE] Stack trace:', error.stack);
      
      let errorMessage = "Falha ao gerar relatório de performance. Tente novamente.";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = "Erro de conexão. Verifique se o servidor está rodando e tente novamente.";
      }
      
      toast({
        title: "Erro ao Gerar Relatório",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Aba 1: Resumo de Performance
      const summaryData = [
        ['Relatório de Performance de Agentes'],
        [''],
        ['Período', `${format(new Date(startDate), 'dd/MM/yyyy')} até ${format(new Date(endDate), 'dd/MM/yyyy')}`],
        ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm')],
        ['Filtro', filterType === 'general' ? 'Geral' : filterType === 'individual' ? 'Individual' : 'Time'],
        [''],
        ['Agente', 'Tempo Trabalhado (h)', 'Mensagens Enviadas', 'Mensagens Recebidas', 'Tempo Médio Resposta (min)', 'Taxa Resposta (%)', 'Taxa Resolução (%)', 'Contatos Novos', 'Score Performance', 'Pontos de Atenção']
      ];
      
      performanceData.forEach(data => {
        summaryData.push([
          data.agent.name,
          data.metrics.workTimeHours,
          data.metrics.sentMessages,
          data.metrics.receivedMessages,
          data.metrics.avgResponseTimeMinutes,
          data.metrics.responseRate,
          data.metrics.resolutionRate,
          data.metrics.newContacts,
          data.metrics.performanceScore,
          data.metrics.attentionPoints.join('; ')
        ]);
      });
      
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Resumo Performance');
      
      // Aba 2: Análise IA (se disponível)
      if (aiAnalysis) {
        const aiData = [
          ['Análise de Performance com IA'],
          [''],
          ['Resumo Executivo'],
          [aiAnalysis.summary],
          [''],
          ['Melhores Performers'],
          ...aiAnalysis.topPerformers.map(name => [name]),
          [''],
          ['Agentes que Precisam de Atenção'],
        ];
        
        aiAnalysis.needsAttention.forEach(item => {
          aiData.push([item.agentName]);
          aiData.push(['Prioridade', item.priority]);
          aiData.push(['Problemas', ...item.issues]);
          aiData.push(['Recomendações', ...item.recommendations]);
          aiData.push(['']);
        });
        
        aiData.push(['']);
        aiData.push(['Recomendações Gerais']);
        aiAnalysis.generalRecommendations.forEach(rec => {
          aiData.push([rec]);
        });
        
        const wsAI = XLSX.utils.aoa_to_sheet(aiData);
        XLSX.utils.book_append_sheet(workbook, wsAI, 'Análise IA');
      }
      
      const fileName = `performance-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
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

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.setTextColor(75, 85, 99);
      doc.text('Relatório de Performance de Agentes', 20, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.text(`Período: ${format(new Date(startDate), 'dd/MM/yyyy')} até ${format(new Date(endDate), 'dd/MM/yyyy')}`, 20, 45);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 55);
      
      let yPosition = 75;
      
      // Tabela de resumo
      const tableData = performanceData.map(data => [
        data.agent.name,
        `${data.metrics.workTimeHours}h`,
        data.metrics.sentMessages.toString(),
        data.metrics.receivedMessages.toString(),
        `${data.metrics.avgResponseTimeMinutes} min`,
        `${data.metrics.responseRate}%`,
        data.metrics.performanceScore.toString()
      ]);
      
      (doc as any).autoTable({
        head: [['Agente', 'Tempo (h)', 'Enviadas', 'Recebidas', 'Tempo Médio', 'Taxa Resposta', 'Score']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 9 }
      });
      
      // Análise IA
      if (aiAnalysis) {
        yPosition = (doc as any).lastAutoTable.finalY + 20;
        
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 30;
        }
        
        doc.setFontSize(16);
        doc.setTextColor(75, 85, 99);
        doc.text('Análise com Inteligência Artificial', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        const summaryLines = doc.splitTextToSize(aiAnalysis.summary, 170);
        summaryLines.forEach((line: string) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 30;
          }
          doc.text(line, 20, yPosition);
          yPosition += 5;
        });
      }
      
      const fileName = `performance-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
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


  if (dataLoading) {
    return (
      <PermissionGuard requiredPermissions={['view_attendance_report']}>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div className="text-lg">Carregando dados...</div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard requiredPermissions={['view_attendance_report']}>
      <div className="p-8 max-w-screen-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Relatório de Performance
            </h1>
            <p className="text-muted-foreground mt-1">
              Análise completa de performance de agentes com validação por IA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {generatingReport ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generatingReport ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
            
            <Button
              variant="outline"
              onClick={exportToExcel}
              className="flex items-center gap-2"
              disabled={performanceData.length === 0}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={exportToPDF}
              className="flex items-center gap-2"
              disabled={performanceData.length === 0}
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Período */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateStart" className="text-sm">Data Início</Label>
                  <Input
                    id="dateStart"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                    max={endDate || undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateEnd" className="text-sm">Data Fim</Label>
                  <Input
                    id="dateEnd"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                    min={startDate || undefined}
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="">Período selecionado:</span>
                  <span className="text-primary">
                    {startDate ? startDate.split('-').reverse().join('/') : '-'} até {endDate ? endDate.split('-').reverse().join('/') : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Tipo de Filtro */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5 text-primary" />
                Tipo de Filtro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-3 block">Selecione o tipo:</Label>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={filterType === 'general' ? 'default' : 'outline'}
                    onClick={() => setFilterType('general')}
                    className="h-10"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Geral
                  </Button>
                  <Button
                    variant={filterType === 'individual' ? 'default' : 'outline'}
                    onClick={() => setFilterType('individual')}
                    className="h-10"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Individual
                  </Button>
                  <Button
                    variant={filterType === 'team' ? 'default' : 'outline'}
                    onClick={() => setFilterType('team')}
                    className="h-10"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Time
                  </Button>
                </div>
              </div>

              {filterType === 'individual' && (
                <div className="space-y-2">
                  <Label className="text-sm">Selecione o Agente</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filterType === 'team' && (
                <div className="space-y-2">
                  <Label className="text-sm">Selecione o Time</Label>
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione um time" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.value} value={team.value}>
                          {team.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeAI"
                  checked={includeAI}
                  onChange={(e) => setIncludeAI(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="includeAI" className="text-sm">
                  Incluir análise com IA
                </Label>
              </div>

              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                className="w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Resetar Filtros
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resultados */}
        {performanceData.length > 0 && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="ai-analysis">Análise IA</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Cards de Métricas Principais - Ordenados do maior para o menor score */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...performanceData]
                  .sort((a, b) => b.metrics.performanceScore - a.metrics.performanceScore)
                  .map((data) => (
                  <Card key={data.agent.id} className="relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{data.agent.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="text-2xl">{data.metrics.performanceScore}</div>
                            <span className="text-xs text-muted-foreground" title="Score de 0-100 baseado em: volume de mensagens (30pts), taxa de resposta (25pts), tempo de resposta (20pts), balanceamento enviadas/recebidas (15pts) e tempo trabalhado (10pts)">
                              <Activity className="h-4 w-4 cursor-help" />
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">Score de Performance</p>
                          <Progress value={data.metrics.performanceScore} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="">{data.metrics.workTimeHours}h</div>
                            <div className="text-muted-foreground">Tempo Trabalhado</div>
                          </div>
                          <div>
                            <div className="">{data.metrics.totalMessages}</div>
                            <div className="text-muted-foreground">Total Mensagens</div>
                          </div>
                        </div>
                        {data.metrics.attentionPoints.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Pontos de Atenção:</span>
                            </div>
                            <ul className="text-xs text-amber-600 space-y-0.5 pl-4">
                              {data.metrics.attentionPoints.map((point, idx) => (
                                <li key={idx} className="list-disc">{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Tabela Detalhada */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes de Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agente</TableHead>
                        <TableHead>Tempo (h)</TableHead>
                        <TableHead>Enviadas</TableHead>
                        <TableHead>Recebidas</TableHead>
                        <TableHead>Tempo Médio</TableHead>
                        <TableHead>Taxa Resposta</TableHead>
                        <TableHead>Contatos Novos</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Atenção</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...performanceData]
                        .sort((a, b) => b.metrics.performanceScore - a.metrics.performanceScore)
                        .map((data) => (
                        <TableRow key={data.agent.id}>
                          <TableCell className="">{data.agent.name}</TableCell>
                          <TableCell>{data.metrics.workTimeHours}h</TableCell>
                          <TableCell>{data.metrics.sentMessages}</TableCell>
                          <TableCell>{data.metrics.receivedMessages}</TableCell>
                          <TableCell>{data.metrics.avgResponseTimeMinutes} min</TableCell>
                          <TableCell>{data.metrics.responseRate}%</TableCell>
                          <TableCell>{data.metrics.newContacts}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant={data.metrics.performanceScore >= 70 ? 'default' : data.metrics.performanceScore >= 50 ? 'secondary' : 'destructive'}>
                                {data.metrics.performanceScore}
                              </Badge>
                              <span className="text-xs text-muted-foreground cursor-help" title="Baseado em: volume (30pts), taxa de resposta (25pts), tempo de resposta (20pts), balanceamento enviadas/recebidas (15pts) e tempo trabalhado (10pts)">
                                <Activity className="h-3 w-3" />
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {data.metrics.attentionPoints.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant="destructive" className="w-fit">{data.metrics.attentionPoints.length}</Badge>
                                <div className="text-xs text-muted-foreground max-w-xs">
                                  {data.metrics.attentionPoints.map((point, idx) => (
                                    <div key={idx} className="flex items-start gap-1">
                                      <span className="text-amber-600">•</span>
                                      <span>{point}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-analysis" className="space-y-6">
              {aiAnalysis ? (
                <>
                  {/* Resumo Executivo */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Resumo Executivo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {aiAnalysis.summary}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Melhores Performers */}
                  {aiAnalysis.topPerformers.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-yellow-600" />
                          Melhores Performers
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {aiAnalysis.topPerformers.map((name, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center">
                                {index + 1}
                              </Badge>
                              <span className="">{name}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Agentes que Precisam de Atenção */}
                  {aiAnalysis.needsAttention.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          Agentes que Precisam de Atenção
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {aiAnalysis.needsAttention.map((item, index) => (
                          <Card key={index} className="border-l-4 border-l-red-500">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{item.agentName}</CardTitle>
                                <Badge variant={item.priority === 'alta' ? 'destructive' : item.priority === 'média' ? 'secondary' : 'outline'}>
                                  {item.priority.toUpperCase()}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <Label className="text-sm">Problemas Identificados:</Label>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                  {item.issues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <Label className="text-sm">Recomendações:</Label>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                  {item.recommendations.map((rec, idx) => (
                                    <li key={idx}>{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Recomendações Gerais */}
                  {aiAnalysis.generalRecommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5 text-blue-600" />
                          Recomendações Gerais
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {aiAnalysis.generalRecommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Validação de Trabalho */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Validação de Trabalho
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Agente</TableHead>
                            <TableHead>Trabalhou?</TableHead>
                            <TableHead>Qualidade</TableHead>
                            <TableHead>Justificativa</TableHead>
                            <TableHead>Confiança</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...aiAnalysis.validation]
                            .sort((a, b) => {
                              // Ordenar: SIM primeiro (worked: true), depois NÃO (worked: false)
                              if (a.worked === b.worked) return 0;
                              return a.worked ? -1 : 1;
                            })
                            .map((val, index) => (
                            <TableRow key={index}>
                              <TableCell className="">{val.agentName}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    val.worked 
                                      ? (val.workQuality?.toLowerCase().includes('insuficiente') 
                                          ? 'secondary' as const
                                          : 'default' as const)
                                      : 'destructive' as const
                                  }
                                  className={
                                    val.worked && val.workQuality?.toLowerCase().includes('insuficiente')
                                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-transparent'
                                      : undefined
                                  }
                                >
                                  {val.worked ? 'Sim' : 'Não'}
                                </Badge>
                              </TableCell>
                              <TableCell>{val.workQuality}</TableCell>
                              <TableCell className="max-w-md text-sm text-muted-foreground">
                                {val.reason}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{(val.confidence * 100).toFixed(0)}%</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma análise de IA disponível. Ative a opção "Incluir análise com IA" ao gerar o relatório.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Estado Vazio */}
        {performanceData.length === 0 && !generatingReport && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg mb-2">Nenhum relatório gerado</h3>
              <p className="text-muted-foreground mb-4">
                Configure os filtros acima e clique em "Gerar Relatório" para começar a análise de performance.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGuard>
  );
};

export default ReportPerformance;

