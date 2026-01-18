import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback
}) => {
  const { user, loading, initialized } = useAuth(); // ✅ ADICIONADO: initialized
  const navigate = useNavigate();
  const [showTimeout, setShowTimeout] = useState(false);

  // ✅ CORRIGIDO: Timeout apenas se ainda não foi inicializado
  useEffect(() => {
    if (loading && !initialized) {
      const timer = setTimeout(() => {
        setShowTimeout(true);
      }, 10000); // ✅ AUMENTADO: 10 segundos para dar mais tempo

      return () => clearTimeout(timer);
    } else {
      setShowTimeout(false);
    }
  }, [loading, initialized]);

  // ✅ CORRIGIDO: Loading apenas se não foi inicializado
  if (loading && !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">
            {showTimeout ? 'Verificando autenticação...' : 'Carregando...'}
          </p>
          {showTimeout && (
            <button
              onClick={() => navigate('/login')}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Voltar ao login
            </button>
          )}
        </div>
      </div>
    );
  }

  // Se o usuário está autenticado, mostra o conteúdo
  if (user) {
    return <>{children}</>;
  }

  // Se não está autenticado, mostra fallback ou redireciona
  if (fallback) {
    return <>{fallback}</>;
  }

  // Redireciona para login se não há fallback
  navigate('/login');
  return null;
}; 