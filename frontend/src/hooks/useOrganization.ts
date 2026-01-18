import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';

interface Organization {
  id: string;
  name: string;
  domain?: string;
  logo_url?: string;
  cpf_cnpj?: string;
  max_users?: number;
  settings?: Record<string, any>;
}

export function useOrganization() {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    async function loadOrganization() {
      try {
        setLoading(true);
        
        // Aguardar autenticação carregar
        if (authLoading) {
          return;
        }

        // Verificar se temos dados do usuário
        if (!user) {
          return;
        }

        
        // ✅ CORRIGIDO: Usar getAuthHeaders() com await
        const headers = await getAuthHeaders();

        const response = await fetch(`${apiBase}/api/organizations/current`, {
          headers
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ Erro na API:', errorData);
          throw new Error(errorData.error || 'Erro ao carregar organização');
        }

        const result = await response.json();
        
        if (result.success && result.organization) {
          setCurrentOrganization(result.organization);
        } else {
          setCurrentOrganization(null);
        }
        
      } catch (err) {
        console.error('❌ Erro geral:', err);
        setError(err instanceof Error ? err : new Error('Failed to load organization'));
        setCurrentOrganization(null);
      } finally {
        setLoading(false);
      }
    }

    loadOrganization();
  }, [user, profile, authLoading]);

  return {
    organization: currentOrganization,
    loading: loading || authLoading,
    error,
  };
} 