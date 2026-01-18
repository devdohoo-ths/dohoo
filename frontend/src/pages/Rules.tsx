import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { 
  Plus, 
  Search,
  Eye,
  RefreshCw,
  Download,
  Filter,
  TrendingUp,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  FileText,
  Settings,
  MessageCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RulesService } from '../services/rulesService';
import { 
  MonitoringRule, 
  RuleReportData, 
  CreateRuleRequest, 
  UpdateRuleRequest 
} from '../types/rules';
import { useToast } from '../hooks/use-toast';
import { ReportConversationDetail } from '@/components/reports/ReportConversationDetail';
import { useConversationReports } from '@/hooks/useConversationReports';
import { ConversationDetail } from '../types/conversation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuth } from '../hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Progress } from '../components/ui/progress';

// Tipos para as melhorias
interface RuleMetrics {
  totalOccurrences: number;
  uniqueKeywords: number;
  topKeywords: Array<{ keyword: string; count: number }>;
  topAgents: Array<{ agent: string; count: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  urgencyLevels: {
    high: number;
    medium: number;
    low: number;
  };
}

interface AdvancedFilters {
  agentFilter: string;
  departmentFilter: string;
  messageTypeFilter: string;
  dateRange: 'today' | 'week' | 'month' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
}

export default function Rules() {
  // Removido log de renderização que causava spam no console
  
  const [rules, setRules] = useState<MonitoringRule[]>([]);
  const [occurrences, setOccurrences] = useState<RuleReportData[]>([]);
  const [filteredOccurrences, setFilteredOccurrences] = useState<RuleReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<string>('all');
  const [dateStart, setDateStart] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // ✅ CORREÇÃO: Começar com 7 dias atrás
    return date;
  });
  const [dateEnd, setDateEnd] = useState<Date>(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MonitoringRule | null>(null);
  const [newKeywords, setNewKeywords] = useState<string>('');
  const [processingHistorical, setProcessingHistorical] = useState(false);
  const [viewChatId, setViewChatId] = useState<string | null>(null);
  const [chatDetail, setChatDetail] = useState<ConversationDetail | null>(null);
  const [chatDetailLoading, setChatDetailLoading] = useState(false);
  
  // Novos estados para melhorias
  const [metrics, setMetrics] = useState<RuleMetrics | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({
    agentFilter: '',
    departmentFilter: '',
    messageTypeFilter: '',
    dateRange: 'week'
  });
  const [activeTab, setActiveTab] = useState('overview');
  const location = useLocation();

  const { toast } = useToast();
  const { fetchConversationDetail } = useConversationReports();
  const { user } = useAuth();

  // Ajustar tab baseado na rota
  useEffect(() => {
    if (location.pathname === '/rules/report') {
      setActiveTab('overview'); // Relatório está na tab overview
    } else if (location.pathname === '/rules') {
      setActiveTab('rules'); // Nova regra está na tab rules
    }
  }, [location.pathname]);

  // Formulário para nova regra
  const [newRule, setNewRule] = useState<CreateRuleRequest>({
    name: '',
    keywords: [],
    description: ''
  });

  // Formulário para editar regra
  const [editRule, setEditRule] = useState<UpdateRuleRequest>({
    name: '',
    keywords: [],
    description: '',
    is_active: true
  });

  useEffect(() => {
    if (user?.id) {
      loadRules();
    }
  }, [user?.id]);

  // ✅ CORREÇÃO: Adicionar useEffect para aplicar filtros quando os filtros mudarem
  useEffect(() => {
    if (occurrences.length > 0) {
      applyFilters();
    }
  }, [filters, occurrences]);

  // Debug para o modal
  useEffect(() => {
    console.log('🔍 [Rules] Estado do modal:', { 
      viewChatId, 
      chatDetail: !!chatDetail, 
      chatDetailLoading 
    });
  }, [viewChatId, chatDetail, chatDetailLoading]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await RulesService.getRules(user?.id);
      setRules(data);
    } catch (error) {
      console.error('❌ Error loading rules:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar regras',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ CORREÇÃO: Modificar generateReport para não aplicar filtros automaticamente
  const generateReport = async () => {
    try {
      setReportLoading(true);
      console.log('🔍 [Rules] Gerando relatório com parâmetros:', {
        dateStart: dateStart.toISOString(),
        dateEnd: dateEnd.toISOString(),
        selectedRule: selectedRule === 'all' ? undefined : selectedRule
      });
      
      const response = await RulesService.generateReport(
        dateStart.toISOString(),
        dateEnd.toISOString(),
        selectedRule === 'all' ? undefined : selectedRule,
        user?.id
      );
      
      console.log('🔍 [Rules] Relatório gerado:', response);
      console.log('🔍 [Rules] Total de ocorrências:', response.total);
      console.log('🔍 [Rules] Primeira ocorrência:', response.occurrences[0]);
      
      setOccurrences(response.occurrences);
      calculateMetrics(response.occurrences);
      
      // ✅ CORREÇÃO: Não aplicar filtros automaticamente aqui
      // Os filtros serão aplicados pelo useEffect quando occurrences mudar
      
      toast({
        title: 'Sucesso',
        description: `Relatório gerado com ${response.total} ocorrências`
      });
    } catch (error) {
      console.error('🔍 [Rules] Erro ao gerar relatório:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao gerar relatório',
        variant: 'destructive'
      });
    } finally {
      setReportLoading(false);
    }
  };

  // Função para calcular métricas avançadas
  const calculateMetrics = (data: RuleReportData[]) => {
    if (!data.length) {
      setMetrics(null);
      return;
    }

    // Contagem de palavras-chave
    const keywordCounts: { [key: string]: number } = {};
    const agentCounts: { [key: string]: number } = {};
    const hourlyCounts: { [key: number]: number } = {};
    const dailyCounts: { [key: string]: number } = {};
    let highUrgency = 0, mediumUrgency = 0, lowUrgency = 0;

    data.forEach(occurrence => {
      // Contagem de palavras-chave
      keywordCounts[occurrence.matched_keyword] = (keywordCounts[occurrence.matched_keyword] || 0) + 1;
      
      // Contagem por agente
      agentCounts[occurrence.agent_name] = (agentCounts[occurrence.agent_name] || 0) + 1;
      
      // Distribuição horária
      const hour = new Date(occurrence.message_timestamp).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      
      // Tendência diária
      const date = format(new Date(occurrence.message_timestamp), 'yyyy-MM-dd');
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      
      // Análise de urgência
      const content = occurrence.message_content.toLowerCase();
      if (content.includes('urgente') || content.includes('agora') || content.includes('emergência')) {
        highUrgency++;
      } else if (content.includes('importante') || content.includes('preciso')) {
        mediumUrgency++;
      } else {
        lowUrgency++;
      }
    });

    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topAgents = Object.entries(agentCounts)
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyCounts[i] || 0
    }));

    const dailyTrend = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setMetrics({
      totalOccurrences: data.length,
      uniqueKeywords: Object.keys(keywordCounts).length,
      topKeywords,
      topAgents,
      hourlyDistribution,
      dailyTrend,
      urgencyLevels: { high: highUrgency, medium: mediumUrgency, low: lowUrgency }
    });
  };

  // Função para aplicar filtros avançados
  const applyFilters = () => {
    let filtered = [...occurrences];

    // ✅ CORREÇÃO: Aplicar filtro de agente
    if (filters.agentFilter) {
      filtered = filtered.filter(o => 
        o.agent_name.toLowerCase().includes(filters.agentFilter.toLowerCase())
      );
    }

    // ✅ CORREÇÃO: Aplicar filtros de data baseados no período selecionado
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (filters.dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'custom':
        startDate = filters.customStartDate || dateStart;
        endDate = filters.customEndDate || dateEnd;
        break;
      default:
        startDate = dateStart;
        endDate = dateEnd;
    }

    // ✅ CORREÇÃO: Filtrar por data
    filtered = filtered.filter(o => {
      const messageDate = new Date(o.message_timestamp);
      return messageDate >= startDate && messageDate <= endDate;
    });

    console.log('🔍 [Rules] Filtros aplicados:', {
      totalOccurrences: occurrences.length,
      filteredOccurrences: filtered.length,
      dateRange: filters.dateRange,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      agentFilter: filters.agentFilter
    });

    setFilteredOccurrences(filtered);
  };

  // Função para exportar dados
  const exportToCSV = () => {
    if (!filteredOccurrences.length) {
      toast({
        title: 'Aviso',
        description: 'Nenhum dado para exportar',
        variant: 'destructive'
      });
      return;
    }

    const headers = ['Data/Hora', 'Regra', 'Palavra/Frase', 'Cliente', 'Telefone', 'Agente', 'Mensagem'];
    const csvContent = [
      headers.join(','),
      ...filteredOccurrences.map(o => [
        format(new Date(o.message_timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        o.rule_name,
        o.matched_keyword,
        o.customer_name,
        o.customer_phone,
        o.agent_name,
        `"${o.message_content.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-regras-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Sucesso',
      description: 'Relatório exportado com sucesso'
    });
  };

  const createRule = async () => {
    try {
      // Processar palavras-chave do campo de texto
      const keywords = newKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (!newRule.name || keywords.length === 0) {
        toast({
          title: 'Erro',
          description: 'Nome e palavras-chave são obrigatórios',
          variant: 'destructive'
        });
        return;
      }

      // Criar objeto da regra com as palavras-chave processadas
      const ruleToCreate = {
        ...newRule,
        keywords: keywords
      };

      const createdRule = await RulesService.createRule(ruleToCreate, user?.id);
      console.log('✅ [Rules] Regra criada:', createdRule);
      setNewRule({ name: '', keywords: [], description: '' });
      setNewKeywords('');
      setIsCreateDialogOpen(false);
      // Recarregar regras após criar
      await loadRules();
      toast({
        title: 'Sucesso',
        description: 'Regra criada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao criar regra:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar regra',
        variant: 'destructive'
      });
    }
  };

  const updateRule = async () => {
    try {
      if (!editingRule || !editRule.name || editRule.keywords.length === 0) {
        toast({
          title: 'Erro',
          description: 'Nome e palavras-chave são obrigatórios',
          variant: 'destructive'
        });
        return;
      }

      await RulesService.updateRule(editingRule.id, editRule, user?.id);
      setIsEditDialogOpen(false);
      setEditingRule(null);
      loadRules();
      toast({
        title: 'Sucesso',
        description: 'Regra atualizada com sucesso'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar regra',
        variant: 'destructive'
      });
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await RulesService.deleteRule(id, user?.id);
      loadRules();
      toast({
        title: 'Sucesso',
        description: 'Regra deletada com sucesso'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao deletar regra',
        variant: 'destructive'
      });
    }
  };

  const processHistorical = async () => {
    try {
      setProcessingHistorical(true);
      const response = await RulesService.processHistorical({
        dateStart: dateStart.toISOString(),
        dateEnd: dateEnd.toISOString()
      }, user?.id);
      toast({
        title: 'Sucesso',
        description: response.message
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao processar dados históricos',
        variant: 'destructive'
      });
    } finally {
      setProcessingHistorical(false);
    }
  };

  const openEditDialog = (rule: MonitoringRule) => {
    setEditingRule(rule);
    setEditRule({
      name: rule.name,
      keywords: rule.keywords,
      description: rule.description || '',
      is_active: rule.is_active
    });
    setIsEditDialogOpen(true);
  };

  const addKeyword = (keywords: string[], setKeywords: (keywords: string[]) => void) => {
    if (newKeywords.trim() && !keywords.includes(newKeywords.trim())) {
      setKeywords([...keywords, newKeywords.trim()]);
      setNewKeywords('');
    }
  };

  const removeKeyword = (keywords: string[], setKeywords: (keywords: string[]) => void, index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const openChatReadOnly = async (chatId: string) => {
    console.log('🔍 [Rules] Abrindo chat:', chatId);
    try {
      setChatDetailLoading(true);
      setViewChatId(chatId);
      console.log('🔍 [Rules] viewChatId definido como:', chatId);
      const detail = await fetchConversationDetail(chatId);
      console.log('🔍 [Rules] Detalhes recebidos:', detail);
      setChatDetail(detail);
    } catch (error) {
      console.error('🔍 [Rules] Erro ao abrir chat:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar detalhes da conversa',
        variant: 'destructive'
      });
    } finally {
      setChatDetailLoading(false);
    }
  };

  // Removido log de renderização que causava spam no console

  return (
    <PermissionGuard requiredPermissions={['manage_rules']}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl">Relatório de Regras</h1>
            <p className="text-muted-foreground">Monitore palavras-chave e frases nas conversas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filtros Avançados
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Regra
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Criar Nova Regra</DialogTitle>
                  <DialogDescription>
                    Configure uma nova regra de monitoramento para acompanhar palavras-chave específicas nas conversas.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome da Regra</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Palavras de Emergência"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      placeholder="Descreva o propósito desta regra..."
                      value={newRule.description}
                      onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
                    <Input
                      id="keywords"
                      placeholder="urgente, emergência, ajuda, socorro"
                      value={newKeywords}
                      onChange={(e) => setNewKeywords(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={createRule}>
                      Criar Regra
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {filteredOccurrences.length > 0 && (
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>

        {/* Filtros Avançados */}
        {showAdvancedFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtros Avançados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Agente</Label>
                  <Input
                    placeholder="Filtrar por agente..."
                    value={filters.agentFilter}
                    onChange={(e) => setFilters({ ...filters, agentFilter: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Período</Label>
                  <Select value={filters.dateRange} onValueChange={(value) => setFilters({ ...filters, dateRange: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Última Semana</SelectItem>
                      <SelectItem value="month">Último Mês</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas Rápidas */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ocorrências</p>
                    <p className="text-2xl">{metrics.totalOccurrences}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Palavras Únicas</p>
                    <p className="text-2xl">{metrics.uniqueKeywords}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Agentes Afetados</p>
                    <p className="text-2xl">{metrics.topAgents.length}</p>
                  </div>
                  <User className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs para diferentes visualizações */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="rules">Regras</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Configuração de Relatório */}
            <Card>
              <CardHeader>
                <CardTitle>Configurar Relatório</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Regra</Label>
                    <Select value={selectedRule} onValueChange={setSelectedRule}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar regra" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Regras</SelectItem>
                        {rules.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data Inicial</Label>
                    <Input
                      type="date"
                      value={dateStart.toISOString().split('T')[0]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateStart(new Date(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Data Final</Label>
                    <Input
                      type="date"
                      value={dateEnd.toISOString().split('T')[0]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateEnd(new Date(e.target.value))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={generateReport} 
                      disabled={reportLoading}
                      className="w-full"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      {reportLoading ? 'Gerando...' : 'Gerar Relatório'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Relatório de Ocorrências */}
            {filteredOccurrences.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Ocorrências Encontradas ({filteredOccurrences.length})</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportToCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Regra</TableHead>
                        <TableHead>Palavra/Frase</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Agente</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOccurrences.map((occurrence) => (
                        <TableRow key={occurrence.id}>
                          <TableCell>
                            {format(new Date(occurrence.message_timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{occurrence.rule_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{occurrence.matched_keyword}</Badge>
                          </TableCell>
                          <TableCell>{occurrence.customer_name}</TableCell>
                          <TableCell>{occurrence.customer_phone}</TableCell>
                          <TableCell>{occurrence.agent_name}</TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={occurrence.message_content}>
                              {occurrence.message_content}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                console.log('🔍 [Rules] Botão clicado para chat:', occurrence.chat_id);
                                openChatReadOnly(occurrence.chat_id);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {occurrences.length === 0 ? 'Gere um relatório para ver as ocorrências' : 'Nenhuma ocorrência encontrada com os filtros aplicados'}
                  </p>
                </CardContent>
              </Card>
            )}

          </TabsContent>

          <TabsContent value="rules" className="space-y-6">
            {/* Lista de Regras */}
            <Card>
              <CardHeader>
                <CardTitle>Regras de Monitoramento</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Carregando regras...</div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Nenhuma regra cadastrada
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rules.map((rule) => (
                      <div key={rule.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="">{rule.name}</h3>
                              <Badge variant={rule.is_active ? "default" : "secondary"}>
                                {rule.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                            </div>
                            {rule.description && (
                              <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {rule.keywords.map((keyword, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(rule)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir a regra "{rule.name}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteRule(rule.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="analytics" className="space-y-6">
            {metrics ? (
              <>
                {/* Top Keywords e Agentes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Palavras-Chave</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {metrics.topKeywords.map((item, index) => (
                          <div key={item.keyword} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{index + 1}</Badge>
                              <span className="">{item.keyword}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(item.count / metrics.totalOccurrences) * 100} className="w-20" />
                              <span className="text-sm text-muted-foreground">{item.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Agentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {metrics.topAgents.map((item, index) => (
                          <div key={item.agent} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{index + 1}</Badge>
                              <span className="">{item.agent}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(item.count / metrics.totalOccurrences) * 100} className="w-20" />
                              <span className="text-sm text-muted-foreground">{item.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>


                {/* Distribuição Horária */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição Horária</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-12 gap-1">
                      {metrics.hourlyDistribution.map((item) => (
                        <div key={item.hour} className="text-center">
                          <div className="text-xs text-muted-foreground">{item.hour}h</div>
                          <div className="h-20 bg-muted rounded-t flex items-end justify-center p-1">
                            <div 
                              className="bg-primary rounded w-full"
                              style={{ 
                                height: `${(item.count / Math.max(...metrics.hourlyDistribution.map(h => h.count))) * 100}%`,
                                minHeight: item.count > 0 ? '4px' : '0'
                              }}
                            />
                          </div>
                          <div className="text-xs">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Gere um relatório para ver as análises</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog de Edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Regra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nome da Regra</Label>
                <Input
                  id="edit-name"
                  value={editRule.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRule({ ...editRule, name: e.target.value })}
                  placeholder="Ex: Palavrões"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={editRule.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditRule({ ...editRule, description: e.target.value })}
                  placeholder="Descrição opcional da regra"
                />
              </div>
              <div>
                <Label>Palavras/Frases para Monitorar</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newKeywords}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeywords(e.target.value)}
                    placeholder="Digite uma palavra ou frase"
                    onKeyPress={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        addKeyword(editRule.keywords, (keywords) => setEditRule({ ...editRule, keywords }));
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => addKeyword(editRule.keywords, (keywords) => setEditRule({ ...editRule, keywords }))}
                  >
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {editRule.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">
                      {keyword}
                      <button
                        onClick={() => removeKeyword(editRule.keywords, (keywords) => setEditRule({ ...editRule, keywords }), index)}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  checked={editRule.is_active}
                  onCheckedChange={(checked) => setEditRule({ ...editRule, is_active: checked })}
                />
                <Label htmlFor="edit-active">Regra ativa</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={updateRule}>
                  Atualizar Regra
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Detalhes da Conversa */}
        <ReportConversationDetail
          open={!!viewChatId}
          onClose={() => { setViewChatId(null); setChatDetail(null); }}
          detail={chatDetail}
          onExport={(format) => {
            console.log('Exportar em formato:', format);
            // Implementar exportação se necessário
          }}
          onAnalyzeAI={() => {
            console.log('Análise com IA');
            // Implementar análise com IA se necessário
          }}
          loading={chatDetailLoading}
        />
      </div>
    </PermissionGuard>
  );
}
