import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useOrganizations } from '@/hooks/useOrganizations';
import { AnalyticsOverview } from './AnalyticsOverview';
import { ConversationList } from './ConversationList';
import { AnalyticsFilters } from './AnalyticsFilters';
import { KeywordAnalysis } from './KeywordAnalysis';
import { SentimentAnalysis } from './SentimentAnalysis';
import { ChartSelector } from './ChartSelector';
import ModernWordCloud from './ModernWordCloud';
import { AIConversationAssistant } from './AIConversationAssistant';
import { 
  TrendingUp, 
  Users, 
  MessageCircle, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Settings,
  Eye,
  Download,
  RefreshCw,
  Star,
  ArrowDownRight,
  Info
} from 'lucide-react';

export const AnalyticsDashboard: React.FC<{ initialTab?: string, externalTab?: string }> = ({ initialTab = 'overview', externalTab }) => {
  const { analytics, summary, loading, filters, updateFilters, powerfulData } = useAnalytics();
  const { canAccess, userProfile, currentOrganization } = useOrganizations();
  const [enabledCharts, setEnabledCharts] = useState<string[]>(['sentiment', 'priority', 'timeSeries', 'keywords']);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (externalTab && externalTab !== activeTab) {
      setActiveTab(externalTab);
    }
  }, [externalTab]);

  if (!canAccess('analytics')) {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <CardHeader>
          <CardTitle className="text-center">Acesso Negado</CardTitle>
          <CardDescription className="text-center">
            Você não tem permissão para acessar os analytics
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
          <p className="text-lg">Carregando analytics poderosos...</p>
          <p className="text-muted-foreground">Processando dados reais das conversas</p>
        </div>
      </div>
    );
  }

  // Verificar se são dados de demonstração
  const isDemoData = powerfulData?.isDemoData || false;
  
  // Transformar top_keywords para o formato esperado pelo ModernWordCloud
  const wordCloudData = powerfulData?.keywordAnalysis?.keywordCloud || summary?.top_keywords?.map(item => ({
    text: item.keyword,
    value: item.count,
    sentiment: 'neutral' as const
  })) || [];

  // Calcular insights dinâmicos
  const insights = powerfulData?.insights || [];
  const metrics = powerfulData?.metrics;
  const timeAnalysis = powerfulData?.timeAnalysis;
  const performanceAnalysis = powerfulData?.performanceAnalysis;

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 min-h-screen">
      {/* Nota sobre dados de demonstração */}
      {isDemoData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600">ℹ️</span>
            <span className="text-sm text-blue-800">Dados de Demonstração</span>
          </div>
          <p className="text-sm text-blue-700">
            Como não há dados reais de conversas no período selecionado, estamos exibindo dados simulados para demonstrar como os analytics apareceriam com atividade real.
          </p>
        </div>
      )}
      
      {/* Enhanced Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            🚀 Analytics Inteligente
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Análise avançada com dados reais {currentOrganization && `- ${currentOrganization.name}`}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600">Dados Reais</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-600">IA Ativada</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-purple-600">Insights Avançados</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setAiAssistantOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
          >
            <Bot className="w-4 h-4 mr-2" />
            Assistente IA
          </Button>
          <Badge variant="outline" className="text-sm px-4 py-2">
            {userProfile?.user_role === 'super_admin' ? '🔑 Super Admin' : 
             userProfile?.user_role === 'admin' ? '👑 Admin' : '👤 Agente'}
          </Badge>
        </div>
      </div>



      {/* Insights Dinâmicos */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {insights.slice(0, 3).map((insight, index) => (
            <Card key={index} className={`border-l-4 shadow-md ${
              insight.type === 'success' ? 'border-l-green-500' :
              insight.type === 'warning' ? 'border-l-orange-500' :
              'border-l-blue-500'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    insight.type === 'success' ? 'bg-green-100' :
                    insight.type === 'warning' ? 'bg-orange-100' :
                    'bg-blue-100'
                  }`}>
                    {insight.type === 'success' ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : insight.type === 'warning' ? (
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    ) : (
                      <Info className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">{insight.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{insight.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Performance Cards */}
      {performanceAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Award className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-800">Top Performers</p>
                  <p className="text-xs text-green-600">
                    {performanceAnalysis.topPerformers?.length || 0} agentes em destaque
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-800">Engajamento Alto</p>
                  <p className="text-xs text-blue-600">
                    Média de {metrics?.messages?.messagesPerConversation?.toFixed(1) || 0} mensagens por conversa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-orange-800">Oportunidades</p>
                  <p className="text-xs text-orange-600">
                    {performanceAnalysis.needsAttention?.length || 0} agentes precisam de atenção
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart Configuration */}
      <ChartSelector onChartsChange={setEnabledCharts} />

      {/* Enhanced Filters */}
      <AnalyticsFilters filters={filters} setFilters={updateFilters} />

      {/* Main Content with Enhanced Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white shadow-lg rounded-xl p-2">
          <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg px-6 py-3">
            <BarChart3 className="w-4 h-4 mr-2" />
            📊 Visão Geral
          </TabsTrigger>
          <TabsTrigger value="conversations" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white rounded-lg px-6 py-3">
            <MessageSquare className="w-4 h-4 mr-2" />
            💬 Conversas IA
          </TabsTrigger>
          <TabsTrigger value="keywords" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white rounded-lg px-6 py-3">
            <Sparkles className="w-4 h-4 mr-2" />
            🔍 Nuvem Inteligente
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white rounded-lg px-6 py-3">
            <TrendingUp className="w-4 h-4 mr-2" />
            😊 Sentimentos
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg px-6 py-3">
            <Target className="w-4 h-4 mr-2" />
            🎯 Performance
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <AnalyticsOverview summary={summary} enabledCharts={enabledCharts} powerfulData={powerfulData} />
        </TabsContent>
        
        <TabsContent value="conversations">
          <ConversationList analytics={analytics} />
        </TabsContent>
        
        <TabsContent value="keywords">
          <ModernWordCloud data={wordCloudData} />
        </TabsContent>
        
        <TabsContent value="sentiment">
          <SentimentAnalysis summary={summary} powerfulData={powerfulData} />
        </TabsContent>
        
        <TabsContent value="performance">
          <PerformanceTab performanceAnalysis={performanceAnalysis} timeAnalysis={timeAnalysis} />
        </TabsContent>
      </Tabs>

      {/* AI Assistant Modal */}
      <AIConversationAssistant
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
      />
    </div>
  );
};

// Componente para a aba de Performance
const PerformanceTab: React.FC<{ performanceAnalysis: any; timeAnalysis: any }> = ({ performanceAnalysis, timeAnalysis }) => {
  return (
    <div className="space-y-6">
      {/* Performance dos Agentes */}
      {performanceAnalysis?.agentPerformance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Performance dos Agentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {performanceAnalysis.agentPerformance.slice(0, 10).map((agent: any, index: number) => (
                <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.conversations} conversas • {agent.avgResponseTime}min resposta
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="">{agent.avgSatisfaction.toFixed(1)}/5</span>
                    </div>
                    <Badge variant={agent.isOnline ? "default" : "secondary"} className="text-xs">
                      {agent.isOnline ? "Online" : "Offline"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análise Temporal */}
      {timeAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Análise Temporal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="mb-3">Pico de Atividade</h4>
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                  <div className="text-3xl text-blue-600">
                    {timeAnalysis.peakHour?.hour || 0}:00
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {timeAnalysis.peakHour?.conversations || 0} conversas
                  </p>
                </div>
              </div>
              <div>
                <h4 className="mb-3">Período Analisado</h4>
                <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <div className="text-3xl text-green-600">
                    {timeAnalysis.totalDays || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">dias analisados</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
