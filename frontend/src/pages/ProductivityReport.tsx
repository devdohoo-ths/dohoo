import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Users,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  Download,
  Calendar,
  User,
  UserCheck,
  UserX,
  Activity,
  Filter,
  Search
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
import { DatePickerWithRange } from '@/components/DateRangePicker';
import { exportToExcel, exportToCSV, generatePDFReport, ExportData } from '@/utils/reportExporter';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

interface ProductivityFilters {
  startDate: string;
  endDate: string;
  userId: string;
}

interface ContactData {
  chatId: string;
  contactName: string;
  contactPhone: string;
  assignedAgent: string;
  platform: string;
  status: string;
  department: string;
  priority: string;
  firstMessageAt: string;
  lastMessageAt: string;
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
}

interface DailyStats {
  date: string;
  uniqueContacts: number;
  activeContacts: number;
  reactiveContacts: number;
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
}

interface ProductivityData {
  uniqueContacts: ContactData[];
  activeContacts: ContactData[];
  reactiveContacts: ContactData[];
  dailyBreakdown: DailyStats[];
  summary: {
    totalUniqueContacts: number;
    totalActiveContacts: number;
    totalReactiveContacts: number;
    totalMessages: number;
    totalMessagesSent: number;
    totalMessagesReceived: number;
    averageMessagesPerContact: number;
    period: {
      start: string;
      end: string;
      days: number;
    };
  };
  period: {
    start: string;
    end: string;
  };
  filters: {
    organization_id: string;
    selectedUser: string;
    selectedAgent: string;
  };
  context: {
    users: any[];
    agents: any[];
  };
}

const ProductivityReport: React.FC = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [productivityData, setProductivityData] = useState<ProductivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados para filtros
  const getDefaultDateRange = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      startDate: yesterday.toISOString().split('T')[0],
      endDate: yesterday.toISOString().split('T')[0]
    };
  };
  
  const [filters, setFilters] = useState<ProductivityFilters>({
    ...getDefaultDateRange(),
    userId: ''
  });

  useEffect(() => {
    fetchProductivityData();
  }, [organization]);

  const fetchProductivityData = async () => {
    if (!organization?.id) {
      console.log('[ProductivityReport] Sem organização, pulando busca');
      return;
    }

    try {
      setLoading(true);
      
      const startDate = new Date(filters.startDate + 'T00:00:00.000Z');
      const endDate = new Date(filters.endDate + 'T23:59:59.999Z');
      
      console.log('📊 [ProductivityReport] Buscando dados de produtividade...');
      
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        organization_id: organization.id,
        dateStart: startDate.toISOString(),
        dateEnd: endDate.toISOString(),
        selectedUser: filters.userId || 'all'
      });

      const response = await fetch(`${apiBase}/api/productivity/productivity?${params}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const apiData = await response.json();
      
      if (!apiData.success) {
        throw new Error(apiData.error || 'Erro ao buscar dados');
      }

      console.log('✅ [ProductivityReport] Dados recebidos:', apiData.data);
      console.log('👥 [ProductivityReport] Usuários disponíveis:', apiData.data.context?.users);
      setProductivityData(apiData.data);
      
    } catch (error) {
      console.error('❌ [ProductivityReport] Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados de produtividade');
      setProductivityData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!productivityData) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const exportData: ExportData = {
        title: 'Relatório de Produtividade',
        period: `${new Date(productivityData.period.start).toLocaleDateString('pt-BR')} - ${new Date(productivityData.period.end).toLocaleDateString('pt-BR')}`,
        data: [
          {
            sheetName: 'Resumo',
            headers: ['Métrica', 'Valor'],
            rows: [
              ['Total de Contatos Únicos', productivityData.summary.totalUniqueContacts],
              ['Contatos Ativos', productivityData.summary.totalActiveContacts],
              ['Contatos Receptivos', productivityData.summary.totalReactiveContacts],
              ['Total de Mensagens', productivityData.summary.totalMessages],
              ['Mensagens Enviadas', productivityData.summary.totalMessagesSent],
              ['Mensagens Recebidas', productivityData.summary.totalMessagesReceived],
              ['Média de Mensagens por Contato', productivityData.summary.averageMessagesPerContact]
            ]
          },
          {
            sheetName: 'Contatos Únicos',
            headers: ['Nome', 'Telefone', 'Agente', 'Plataforma', 'Status', 'Total Mensagens', 'Enviadas', 'Recebidas'],
            rows: productivityData.uniqueContacts.map(contact => [
              contact.contactName,
              contact.contactPhone,
              contact.assignedAgent || 'Não atribuído',
              contact.platform,
              contact.status,
              contact.totalMessages,
              contact.messagesSent,
              contact.messagesReceived
            ])
          }
        ]
      };

      switch (format) {
        case 'excel':
          await exportToExcel(exportData, 'relatorio-produtividade');
          break;
        case 'csv':
          await exportToCSV(exportData, 'relatorio-produtividade');
          break;
        case 'pdf':
          await generatePDFReport(exportData, 'relatorio-produtividade');
          break;
      }

      toast.success(`Relatório exportado em ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar relatório');
    }
  };

  const handleFilterChange = (field: keyof ProductivityFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    fetchProductivityData();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Relatório de Produtividade</h1>
          <p className="text-gray-600 mt-2">Análise de contatos únicos e produtividade da equipe</p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => handleExport('excel')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={() => handleExport('csv')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button onClick={() => handleExport('pdf')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={fetchProductivityData} disabled={loading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
        </Button>
        <Button 
          onClick={handleSearch} 
          variant="outline" 
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Buscar
        </Button>
      </div>

      {/* Painel de Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="userId">Usuário</Label>
                <select
                  id="userId"
                  value={filters.userId}
                  onChange={(e) => handleFilterChange('userId', e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Todos os usuários</option>
                  {(productivityData?.context.users || []).map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.name || user.email || `Usuário ${user.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Carregando dados de produtividade...</p>
          </div>
        </div>
      ) : productivityData ? (
        <div className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Contatos Únicos</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-blue-600">
                  {productivityData.summary.totalUniqueContacts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total de contatos únicos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Contatos Ativos</CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-green-600">
                  {productivityData.summary.totalActiveContacts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Contatos com mensagens enviadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Contatos Receptivos</CardTitle>
                <UserX className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-orange-600">
                  {productivityData.summary.totalReactiveContacts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Contatos com mensagens recebidas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Média por Contato</CardTitle>
                <MessageSquare className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-purple-600">
                  {productivityData.summary.averageMessagesPerContact}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mensagens por contato
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="contacts">Contatos</TabsTrigger>
              <TabsTrigger value="trends">Tendências</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Pizza - Distribuição de Contatos */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição de Contatos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Ativos', value: productivityData.summary.totalActiveContacts, color: '#10B981' },
                            { name: 'Receptivos', value: productivityData.summary.totalReactiveContacts, color: '#F59E0B' }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'Ativos', value: productivityData.summary.totalActiveContacts, color: '#10B981' },
                            { name: 'Receptivos', value: productivityData.summary.totalReactiveContacts, color: '#F59E0B' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico de Barras - Mensagens por Tipo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Mensagens por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        { name: 'Enviadas', value: productivityData.summary.totalMessagesSent, color: '#3B82F6' },
                        { name: 'Recebidas', value: productivityData.summary.totalMessagesReceived, color: '#10B981' }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lista de Contatos Ativos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-green-600" />
                      Contatos Ativos ({productivityData.activeContacts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {productivityData.activeContacts.slice(0, 10).map((contact, index) => (
                        <div key={contact.chatId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="">{contact.contactName}</p>
                            <p className="text-sm text-gray-500">{contact.contactPhone}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary">{contact.messagesSent} enviadas</Badge>
                          </div>
                        </div>
                      ))}
                      {productivityData.activeContacts.length > 10 && (
                        <p className="text-sm text-gray-500 text-center">
                          E mais {productivityData.activeContacts.length - 10} contatos...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Lista de Contatos Receptivos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserX className="h-5 w-5 text-orange-600" />
                      Contatos Receptivos ({productivityData.reactiveContacts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {productivityData.reactiveContacts.slice(0, 10).map((contact, index) => (
                        <div key={contact.chatId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="">{contact.contactName}</p>
                            <p className="text-sm text-gray-500">{contact.contactPhone}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{contact.messagesReceived} recebidas</Badge>
                          </div>
                        </div>
                      ))}
                      {productivityData.reactiveContacts.length > 10 && (
                        <p className="text-sm text-gray-500 text-center">
                          E mais {productivityData.reactiveContacts.length - 10} contatos...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              {/* Gráfico de Tendências Diárias */}
              <Card>
                <CardHeader>
                  <CardTitle>Tendências Diárias</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={productivityData.dailyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="uniqueContacts" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        name="Contatos Únicos"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="activeContacts" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        name="Contatos Ativos"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="reactiveContacts" 
                        stroke="#F59E0B" 
                        strokeWidth={2}
                        name="Contatos Receptivos"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg text-gray-900 mb-2">Nenhum dado encontrado</h3>
          <p className="text-gray-500">Não há dados de produtividade para o período selecionado.</p>
        </div>
      )}
    </div>
  );
};

export default ProductivityReport;
