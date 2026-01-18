import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, LogOut } from 'lucide-react';

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
  onReset?: () => void;
}

export class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [GlobalErrorBoundary] Erro capturado:', error);
    console.error('🚨 [GlobalErrorBoundary] Stack trace:', errorInfo);
    
    // Log do erro para análise
    this.logError(error, errorInfo);
    
    this.setState({ errorInfo });
  }

  private logError = (error: Error, errorInfo: React.ErrorInfo) => {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      retryCount: this.state.retryCount
    };

    // Salvar no localStorage para debug
    const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
    existingLogs.push(errorLog);
    localStorage.setItem('error_logs', JSON.stringify(existingLogs.slice(-10))); // Manter apenas os últimos 10

    console.error('📝 [GlobalErrorBoundary] Log salvo:', errorLog);
  };

  private handleRetry = () => {
    console.log('🔄 [GlobalErrorBoundary] Tentando recuperar...');
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));

    // Limpar cache específico se necessário
    this.clearSpecificCache();
    
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  private handleReset = () => {
    console.log('🔄 [GlobalErrorBoundary] Resetando estado...');
    
    // Limpar cache e estado
    this.clearAllCache();
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleLogout = () => {
    // Limpar cache e logout
    this.clearAllCache();
    localStorage.removeItem('user_data');
    sessionStorage.clear();
    window.location.href = '/login';
  };

  private clearSpecificCache = () => {
    // Limpar apenas cache específico que pode estar causando problemas
    const keysToClear = [
      'accounts_cache',
      'assistants_cache',
      'flows_cache',
      'user_permissions_cache'
    ];

    keysToClear.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    console.log('🧹 [GlobalErrorBoundary] Cache específico limpo');
  };

  private clearAllCache = () => {
    // Limpar todo o cache
    localStorage.clear();
    sessionStorage.clear();
    
    // ✅ REMOVIDO: Limpeza de sessão Supabase - agora é feito via backend
    // A sessão é gerenciada pelo backend, apenas limpar tokens locais
    localStorage.removeItem('auth_session');
    localStorage.removeItem('auth_session_expires_at');

    console.log('🧹 [GlobalErrorBoundary] Todo cache limpo');
  };

  private isRecoverableError = (error: Error): boolean => {
    // Lista de erros que podem ser recuperados sem logout
    const recoverableErrors = [
      'NetworkError',
      'TypeError',
      'ReferenceError',
      'Failed to fetch',
      'Network request failed'
    ];

    return recoverableErrors.some(errorType => 
      error.message.includes(errorType) || error.name === errorType
    );
  };

  render() {
    if (this.state.hasError) {
      const isRecoverable = this.state.error && this.isRecoverableError(this.state.error);
      const maxRetries = 3;

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-800">
                Ops! Algo deu errado
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  {isRecoverable 
                    ? "Encontramos um problema temporário. Vamos tentar resolver isso."
                    : "Ocorreu um erro inesperado no sistema."
                  }
                </p>
                
                {this.state.error && (
                  <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-700 mb-4">
                    <strong>Erro:</strong> {this.state.error.message}
                  </div>
                )}

                {this.state.retryCount > 0 && (
                  <div className="text-sm text-gray-500 mb-4">
                    Tentativas de recuperação: {this.state.retryCount}/{maxRetries}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {isRecoverable && this.state.retryCount < maxRetries && (
                  <Button
                    onClick={this.handleRetry}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </Button>
                )}

                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="border-orange-200 text-orange-700 hover:bg-orange-50"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resetar Estado
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Ir para Home
                </Button>

                {!isRecoverable && (
                  <Button
                    onClick={this.handleLogout}
                    variant="destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Fazer Logout
                  </Button>
                )}
              </div>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Detalhes técnicos (desenvolvimento)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
