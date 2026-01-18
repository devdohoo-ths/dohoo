import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Você pode logar o erro em um serviço externo aqui
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center text-muted-foreground">
          <div className="text-3xl mb-4">😥</div>
          <div className="text-lg mb-2">Ocorreu um erro inesperado na interface</div>
          <div className="mb-2">Por favor, tente recarregar a página ou entre em contato com o suporte.</div>
          <div className="text-xs text-red-500">{String(this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
} 