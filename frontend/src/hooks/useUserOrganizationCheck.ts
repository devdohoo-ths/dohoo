import { useState, useCallback } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface OrganizationCheckResult {
  success: boolean;
  hasOrganization: boolean;
  profile: {
    id: string;
    name: string;
    email: string;
    organization_id: string | null;
    role: string;
  };
  organization?: {
    id: string;
    name: string;
    domain: string;
    status?: string;
  };
  message: string;
}

export const useUserOrganizationCheck = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAndFixOrganization = useCallback(async (): Promise<OrganizationCheckResult | null> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 [HOOK] Verificando organização do usuário...');

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/check-user-organization`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('✅ [HOOK] Verificação de organização concluída:', result);

      return result;

    } catch (err) {
      console.error('❌ [HOOK] Erro ao verificar organização:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    checkAndFixOrganization,
    loading,
    error
  };
};
