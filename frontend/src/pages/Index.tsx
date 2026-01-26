import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
// ✅ OTIMIZADO: Lazy loading para componentes principais (reduz bundle inicial)
const ChatDashboard = lazy(() => import('@/components/chat/ChatDashboard'));
const Dashboard = lazy(() => import('@/components/Dashboard').then(m => ({ default: m.Dashboard })));
const AccountsPage = lazy(() => import('@/components/accounts/AccountsPage'));
const AIAssistants = lazy(() => 
  import('@/components/ai/AIAssistants').then(module => ({
    default: module.default || module.AIAssistants || (() => <div>Erro ao carregar</div>)
  }))
);
const AIPlayground = lazy(() => import('@/components/ai/AIPlayground').then(m => ({ default: m.AIPlayground })));
const AnalyticsDashboard = lazy(() => import('@/components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));
const UserSettings = lazy(() => import('@/pages/settings/UserSettings'));
const RegisterUser = lazy(() => import('@/components/users/RegisterUser'));
const OrganizationsPage = lazy(() => import('./OrganizationsPage'));
const GoogleIntegration = lazy(() => import('@/components/settings/GoogleIntegration'));
const GoogleConnect = lazy(() => import('@/components/settings/GoogleConnect'));
const SchedulingSettings = lazy(() => import('@/components/settings/SchedulingSettings'));
const AgentLimitsPage = lazy(() => import('@/pages/settings/AgentLimits'));
const Rules = lazy(() => import('./Rules'));
const DepartmentsPage = lazy(() => import('@/components/groups/DepartmentsPage'));
const DatabaseManagerPage = lazy(() => import('./DatabaseManagerPage'));
const MarketplacePage = lazy(() => import('./MarketplacePage').then(m => ({ default: m.MarketplacePage })));
const AdvancedSettings = lazy(() => import('./settings/AdvancedSettings'));
const SystemLogs = lazy(() => import('./settings/SystemLogs'));
const WhatsAppAuditPage = lazy(() => import('./settings/WhatsAppAuditPage'));
const OrganizationSettings = lazy(() => import('@/components/settings/OrganizationSettings').then(m => ({ default: m.OrganizationSettings })));
const BlacklistPage = lazy(() => import('./BlacklistPage'));
const ContactsPage = lazy(() => import('./Contacts'));
const CDRPage = lazy(() => import('./CDRPage'));

// ✅ OTIMIZAÇÃO: Lazy loading para componentes pesados de relatórios
const ReportAttendance = lazy(() => import('./report-attendance'));
const ReportAIAnalysis = lazy(() => import('./report-ai-analysis'));
const ReportSentiment = lazy(() => import('./report-sentiment'));
const ReportTopics = lazy(() => import('./report-topics'));
const ReportPerformance = lazy(() => import('./report-performance'));
const ReportConversations = lazy(() => import('./report-conversations'));
const ReportDetailedConversations = lazy(() => import('./report-detailed-conversations'));
const HeatmapGeographic = lazy(() => import('./heatmap-geographic'));
const WhatsAppMetricsOverview = lazy(() => import('./WhatsAppMetricsOverview'));
const WhatsAppProductivity = lazy(() => import('./WhatsAppProductivity'));
const WhatsAppUsageTime = lazy(() => import('./WhatsAppUsageTime'));
const WhatsAppActivityHeatmap = lazy(() => import('./WhatsAppActivityHeatmap'));
const WhatsAppTrends = lazy(() => import('./WhatsAppTrends'));
const ManagerReport = lazy(() => import('./ManagerReport'));
const CampanhasPage = lazy(() => import('./CampanhasPage'));

// Componente de loading para Suspense
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  </div>
);
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Módulo de Atendimento Inteligente - ARQUIVADO (removido do menu, mantido apenas Chat)
// import ProductDashboard from '@/components/products/intelligent-service/components/ProductDashboard';
// import FlowManager from '@/components/products/intelligent-service/pages/FlowManager';
// import TeamStrategy from '@/components/products/intelligent-service/pages/TeamStrategy';
// import ChatManager from '@/components/products/intelligent-service/pages/ChatManager';
// import PauseManagement from '@/components/products/intelligent-service/pages/PauseManagement';
// import SupervisorPage from '@/pages/supervisor';

// Componente da página de suporte
const SupportPage = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl text-gray-900">Central de Suporte</h1>
            <p className="text-gray-600">Como podemos ajudar você hoje?</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Seção de Contato */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-lg mb-4">Contato Direto</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-sm text-gray-700">(11) 99999-9999</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-700">suporte@dohoo.com.br</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-sm text-gray-700">WhatsApp: (11) 99999-9999</span>
              </div>
            </div>
          </div>

          {/* Seção de FAQ */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-lg mb-4">Perguntas Frequentes</h2>
            <div className="space-y-3">
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  Como conectar minha conta WhatsApp?
                  <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                                 <p className="mt-2 text-sm text-gray-600">
                   Acesse a seção &quot;Contas&quot; no menu lateral e siga as instruções para conectar sua conta WhatsApp Business.
                 </p>
              </details>
              
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  Como usar os assistentes de IA?
                  <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                                 <p className="mt-2 text-sm text-gray-600">
                   Vá até &quot;Automação &gt; Assistentes&quot; para configurar e usar os assistentes de inteligência artificial.
                 </p>
              </details>
              
              <details className="group">
                <summary className="flex justify-between items-center cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  Como visualizar relatórios?
                  <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-2 text-sm text-gray-600">
                  Acesse "Relatórios & Analytics" no menu para visualizar todas as métricas e relatórios disponíveis.
                </p>
              </details>
            </div>
          </div>
        </div>

        {/* Seção de Status do Sistema */}
        <div className="mt-6 bg-white border rounded-lg p-6">
          <h2 className="text-lg mb-4">Status do Sistema</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Chat - Operacional</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">IA - Operacional</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Analytics - Operacional</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  // Redirecionamento automático baseado no role
  useEffect(() => {
    if (location.pathname !== '/' && location.pathname !== '') {
      return;
    }

    if (location.pathname !== '/') return;

    // Se o usuário é agente, redireciona para o chat
    if (profile?.user_role === 'agent' || profile?.user_role === 'Agente') {
      navigate('/chat');
    } else {
      // Para outros roles, vai para o dashboard
      navigate('/dashboard');
    }
  }, [profile, navigate, location.pathname]);

  const renderContent = () => {
    if (location.pathname.includes('whatsapp-audit')) {
    }
    
    return (
      <Routes>
        <Route path="dashboard" element={
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        } />
        <Route path="contacts" element={
          <Suspense fallback={<LoadingFallback />}>
            <ContactsPage />
          </Suspense>
        } />
        {/* <Route path="ranking" element={<RankingPage />} /> */}
        <Route path="chat" element={
          <Suspense fallback={<LoadingFallback />}>
            <ChatDashboard />
          </Suspense>
        } />
        <Route path="chat/:chatId" element={
          <Suspense fallback={<LoadingFallback />}>
            <ChatDashboard />
          </Suspense>
        } />
        
        {/* Rotas das Métricas WhatsApp - Lazy Loaded */}
        <Route path="whatsapp-overview" element={
          <Suspense fallback={<LoadingFallback />}>
            <WhatsAppMetricsOverview />
          </Suspense>
        } />
        <Route path="whatsapp-productivity" element={
          <Suspense fallback={<LoadingFallback />}>
            <WhatsAppProductivity />
          </Suspense>
        } />
        <Route path="whatsapp-usage-time" element={
          <Suspense fallback={<LoadingFallback />}>
            <WhatsAppUsageTime />
          </Suspense>
        } />
        <Route path="whatsapp-activity-heatmap" element={
          <Suspense fallback={<LoadingFallback />}>
            <WhatsAppActivityHeatmap />
          </Suspense>
        } />
        <Route path="whatsapp-trends" element={
          <Suspense fallback={<LoadingFallback />}>
            <WhatsAppTrends />
          </Suspense>
        } />
        <Route path="manager-report" element={
          <Suspense fallback={<LoadingFallback />}>
            <ManagerReport />
          </Suspense>
        } />
        <Route path="accounts" element={
          <Suspense fallback={<LoadingFallback />}>
            <AccountsPage />
          </Suspense>
        } />
        <Route path="ai-assistants" element={
          <Suspense fallback={<LoadingFallback />}>
            <AIAssistants />
          </Suspense>
        } />
        <Route path="ai-playground" element={
          <Suspense fallback={<LoadingFallback />}>
            <AIPlayground setActiveTab={() => {}} />
          </Suspense>
        } />
        <Route path="settings/agent-limits" element={
          <Suspense fallback={<LoadingFallback />}>
            <AgentLimitsPage />
          </Suspense>
        } />
        <Route path="departments" element={
          <Suspense fallback={<LoadingFallback />}>
            <DepartmentsPage />
          </Suspense>
        } />
        <Route path="blacklist" element={
          <Suspense fallback={<LoadingFallback />}>
            <BlacklistPage />
          </Suspense>
        } />
        <Route path="database-manager/*" element={
          <Suspense fallback={<LoadingFallback />}>
            <DatabaseManagerPage />
          </Suspense>
        } />
        <Route path="google-connect" element={
          <Suspense fallback={<LoadingFallback />}>
            <GoogleConnect />
          </Suspense>
        } />
        <Route path="google-integration" element={
          <Suspense fallback={<LoadingFallback />}>
            <GoogleIntegration />
          </Suspense>
        } />
        <Route path="scheduling-settings" element={
          <Suspense fallback={<LoadingFallback />}>
            <SchedulingSettings />
          </Suspense>
        } />
        <Route path="user-settings" element={
          <Suspense fallback={<LoadingFallback />}>
            <UserSettings />
          </Suspense>
        } />
        <Route path="register-user" element={
          <Suspense fallback={<LoadingFallback />}>
            <RegisterUser />
          </Suspense>
        } />
        <Route path="organizations" element={
          <Suspense fallback={<LoadingFallback />}>
            <OrganizationsPage />
          </Suspense>
        } />
        <Route path="report-attendance" element={
          <Suspense fallback={<LoadingFallback />}>
            <ReportAttendance />
          </Suspense>
        } />
        <Route path="report-ai-analysis" element={
          <Suspense fallback={<LoadingFallback />}>
            <ReportAIAnalysis />
          </Suspense>
        } />
        <Route path="report-sentiment" element={
          <Suspense fallback={<LoadingFallback />}>
            <ReportSentiment />
          </Suspense>
        } />
        <Route path="report-topics" element={
          <Suspense fallback={<LoadingFallback />}>
            <ReportTopics />
          </Suspense>
        } />
        <Route path="report-performance" element={
          <Suspense fallback={<LoadingFallback />}>
            <ReportPerformance />
          </Suspense>
        } />
        <Route path="report-conversations" element={
          <Suspense fallback={<LoadingFallback />}>
            <ReportConversations />
          </Suspense>
        } />
        <Route path="report-detailed-conversations" element={
          <Suspense fallback={<LoadingFallback />}>
            <ReportDetailedConversations />
          </Suspense>
        } />
        <Route path="heatmap-geographic" element={
          <Suspense fallback={<LoadingFallback />}>
            <HeatmapGeographic />
          </Suspense>
        } />
        <Route path="rules" element={
          <Suspense fallback={<LoadingFallback />}>
            <Rules />
          </Suspense>
        } />
        <Route path="rules/report" element={
          <Suspense fallback={<LoadingFallback />}>
            <Rules />
          </Suspense>
        } />
        <Route path="cdr" element={
          <Suspense fallback={<LoadingFallback />}>
            <CDRPage />
          </Suspense>
        } />
        <Route path="campanhas" element={
          <Suspense fallback={<LoadingFallback />}>
            <CampanhasPage />
          </Suspense>
        } />
        <Route path="campanhas/report" element={
          <Suspense fallback={<LoadingFallback />}>
            <CampanhasPage />
          </Suspense>
        } />
        {/* <Route path="productivity" element={<ProductivityReport />} /> */}
        <Route path="settings/advanced" element={
          <Suspense fallback={<LoadingFallback />}>
            <AdvancedSettings />
          </Suspense>
        } />
        <Route path="settings/organization" element={
          <Suspense fallback={<LoadingFallback />}>
            <OrganizationSettings />
          </Suspense>
        } />
        <Route path="system-logs" element={
          <Suspense fallback={<LoadingFallback />}>
            <SystemLogs />
          </Suspense>
        } />
        <Route path="whatsapp-audit" element={
          <Suspense fallback={<LoadingFallback />}>
            <WhatsAppAuditPage />
          </Suspense>
        } />
        
        {/* Rotas do Módulo de Atendimento Inteligente - ARQUIVADAS */}
        {/* <Route path="product-dashboard" element={<ProductDashboard />} /> */}
        {/* <Route path="flow-manager" element={<FlowManager />} /> */}
        {/* <Route path="flow-manager/:flowId" element={<FlowManager />} /> */}
        {/* <Route path="team-strategy" element={<TeamStrategy />} /> */}
        {/* <Route path="chat-manager" element={<ChatManager />} /> */}
        {/* <Route path="pause-management" element={<PauseManagement />} /> */}
        {/* <Route path="supervisor" element={<SupervisorPage />} /> */}
        
        {/* Rota catch-all deve ser sempre a última */}
        <Route path="*" element={<Dashboard />} />
      </Routes>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto bg-gray-100">
          <Header />
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;