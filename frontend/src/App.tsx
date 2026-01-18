import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from './components/auth/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { AppDataProvider } from '@/contexts/AppDataContext';
import { LoginForm } from "@/components/auth/LoginForm";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ConnectWhatsApp from "./pages/ConnectWhatsApp";
import ReconnectWhatsApp from "./pages/ReconnectWhatsApp";
import ResetPasswordPage from "./pages/reset-password";
import ContatoPage from "./pages/ContatoPage";
import { FlowBuilderPage } from "@/components/flow/FlowBuilderPage";
import { FlowListPage } from "@/components/flow/FlowListPage";
import { useOrganizationSocket } from '@/hooks/useOrganizationSocket';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Componente para rotas protegidas
const ProtectedRoutes = () => {
  const { user, profile, loading, initialized } = useAuth();

  // ✅ CORREÇÃO CRÍTICA: Verificar reset de senha ANTES de qualquer verificação de auth
  const isResetPasswordRoute = window.location.pathname.startsWith('/reset-password');
  if (isResetPasswordRoute) {
    // console.log('🔐 [App] Rota de reset de senha detectada, permitindo acesso SEMPRE');
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  // ✅ NOVO: Página de contato pública
  const isContatoRoute = window.location.pathname === '/contato';
  if (isContatoRoute) {
    return (
      <Routes>
        <Route path="/contato" element={<ContatoPage />} />
      </Routes>
    );
  }

  // ✅ CORREÇÃO: Aguardar inicialização completa antes de verificar user
  if (loading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
          <p className="text-xs text-muted-foreground mt-2">
            Verificando autenticação...
          </p>
        </div>
      </div>
    );
  }

    // ✅ NOVO: Verificar se é uma rota de convite WhatsApp
  const isWhatsAppInviteRoute = window.location.pathname.startsWith('/connect-whatsapp/');
  const isWhatsAppReconnectRoute = window.location.pathname.startsWith('/reconnect-whatsapp/');

  // ✅ CORREÇÃO: Permitir acesso às rotas públicas sem autenticação
  if (isWhatsAppInviteRoute) {
    return (
      <Routes>
        <Route path="/connect-whatsapp/:token" element={<ConnectWhatsApp />} />
      </Routes>
    );
  }

  if (isWhatsAppReconnectRoute) {
    return (
      <Routes>
        <Route path="/reconnect-whatsapp/:token" element={<ReconnectWhatsApp />} />
      </Routes>
    );
  }


  if (!user) {
    // console.log('👤 [App] Usuário não autenticado, mostrando login');
    return <LoginForm />;
  }

  // ✅ CORREÇÃO: Se não tem profile mas tem user, o useAuth já criou um perfil mínimo
  // Mas se ainda assim não tem (pode acontecer em edge cases), mostrar loading apenas por pouco tempo
  if (!profile) {
    // console.log('📄 [App] Usuário autenticado mas perfil não carregado');
    // Dar um tempo curto (3 segundos) para tentar carregar, depois permitir acesso mínimo
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando perfil...</p>
          <p className="text-xs text-muted-foreground mt-2">
            {user.email}
          </p>
          <p className="text-xs text-orange-500 mt-2">
            Tentando conectar com o servidor...
          </p>
        </div>
      </div>
    );
  }

  // console.log('✅ [App] Usuário e perfil carregados, mostrando aplicação');

  return (
    <Routes>
      {/* ✅ CORRIGIDO: Todas as rotas principais usam Index (layout com sidebar) */}
      <Route path="/*" element={<Index />} />
      {/* ✅ MANTIDO: Rotas específicas que não usam sidebar */}
      <Route path="/connect-whatsapp" element={<ConnectWhatsApp />} />
      <Route path="/reconnect-whatsapp/:token" element={<ReconnectWhatsApp />} />
      <Route path="/flows-external" element={<FlowListPage />} />
      <Route path="/flows-external/new" element={<FlowBuilderPage />} />
      <Route path="/flows-external/:id/edit" element={<FlowBuilderPage />} />
      {/* ✅ MANTIDO: Rota 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  // ✅ ADICIONADO: Configurar Socket.IO para organização
  useOrganizationSocket();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppDataProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ProtectedRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AppDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
