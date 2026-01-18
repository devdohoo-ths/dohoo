import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface AgentLimit {
  user_id: string;
  user_name: string;
  user_email: string;
  monthly_limit: number;
  daily_limit: number;
  current_month_used: number;
  current_day_used: number;
  monthly_remaining: number;
  daily_remaining: number;
  is_active: boolean;
}

interface MyAgentLimit {
  monthly_limit: number;
  daily_limit: number;
  current_month_used: number;
  current_day_used: number;
  monthly_remaining: number;
  daily_remaining: number;
  is_active: boolean;
}

export const useAgentLimits = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const [agentLimits, setAgentLimits] = useState<AgentLimit[]>([]);
  const [myLimit, setMyLimit] = useState<MyAgentLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar todos os limites da organização (para admins)
  const fetchOrganizationLimits = async () => {
    if (!organization?.id) {
      console.log('⚠️ [AGENT_LIMITS] Organização não disponível');
      return;
    }

    try {
      console.log('🔄 [AGENT_LIMITS] Buscando limites da organização...');
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/agent-limits?organization_id=${organization.id}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch organization limits: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const data = result.limits || result.data || [];
      
      console.log('✅ [AGENT_LIMITS] Limites da organização carregados:', data?.length || 0);
      setAgentLimits(data || []);
    } catch (err: any) {
      console.error('❌ [AGENT_LIMITS] Erro geral ao buscar limites da organização:', err);
      setError(err.message);
    }
  };

  // Buscar meu próprio limite (para agentes)
  const fetchMyLimit = async () => {
    if (!user?.id || !organization?.id) {
      console.log('⚠️ [AGENT_LIMITS] Usuário ou organização não disponível para buscar meu limite');
      return;
    }

    try {
      console.log('🔄 [AGENT_LIMITS] Buscando meu limite...');
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/agent-limits/me?organization_id=${organization.id}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        // Se endpoint não existe ainda (404), retornar null (pode ser implementado depois)
        if (response.status === 404) {
          console.log('⚠️ [AGENT_LIMITS] Endpoint não encontrado, retornando null');
          setMyLimit(null);
          return;
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch my limit: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const data = result.limit || result.data || null;
      
      console.log('✅ [AGENT_LIMITS] Meu limite carregado:', data ? 'encontrado' : 'não encontrado');
      setMyLimit(Array.isArray(data) && data.length > 0 ? data[0] : data);
    } catch (err: any) {
      console.error('❌ [AGENT_LIMITS] Erro geral ao buscar meu limite:', err);
      setError(err.message);
    }
  };

  // Atualizar limite de um agente
  const updateAgentLimit = async (
    userId: string,
    monthlyLimit: number,
    dailyLimit: number,
    isActive: boolean = true
  ) => {
    if (!organization?.id) {
      throw new Error('Organization not found');
    }

    try {
      console.log('🔄 [AGENT_LIMITS] Atualizando limite do agente:', userId);
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/agent-limits/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          organization_id: organization.id,
          monthly_limit: monthlyLimit,
          daily_limit: dailyLimit,
          is_active: isActive
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AGENT_LIMITS] Erro ao atualizar limite:', errorText);
        throw new Error(`Failed to update limit: ${response.statusText} - ${errorText}`);
      }

      console.log('✅ [AGENT_LIMITS] Limite atualizado com sucesso');

      // Recarregar dados
      await fetchOrganizationLimits();
      await fetchMyLimit();

      return true;
    } catch (err: any) {
      console.error('❌ [AGENT_LIMITS] Erro geral ao atualizar limite:', err);
      setError(err.message);
      throw err;
    }
  };

  // Buscar agentes da organização (para seleção)
  const fetchOrganizationAgents = async () => {
    if (!organization?.id) {
      console.log('⚠️ [AGENT_LIMITS] Organização não disponível para buscar agentes');
      return [];
    }

    try {
      console.log('🔄 [AGENT_LIMITS] Buscando agentes da organização...');
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users?organization_id=${organization.id}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AGENT_LIMITS] Erro ao buscar agentes:', errorText);
        throw new Error(`Failed to fetch agents: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const data = result.users || result.data || [];
      
      // Mapear para o formato esperado (id, name, email)
      const mappedData = data.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email
      }));
      
      console.log('✅ [AGENT_LIMITS] Agentes carregados:', mappedData?.length || 0);
      return mappedData || [];
    } catch (err: any) {
      console.error('❌ [AGENT_LIMITS] Erro geral ao buscar agentes:', err);
      setError(err.message);
      return [];
    }
  };

  // Verificar se usuário é admin
  const isAdmin = () => {
    // Esta lógica deve ser implementada baseada no seu sistema de roles
    // Por enquanto, vamos assumir que todos podem ver os limites
    return true;
  };

  useEffect(() => {
    // Aguardar autenticação e organização carregarem
    if (authLoading || orgLoading) {
      console.log('⏳ [AGENT_LIMITS] Aguardando autenticação ou organização...');
      return;
    }

    // Verificar se temos os dados necessários
    if (!user || !organization?.id) {
      console.log('⚠️ [AGENT_LIMITS] Dados insuficientes para carregar limites');
      setLoading(false);
      return;
    }

    console.log('🚀 [AGENT_LIMITS] Iniciando carregamento de limites...');
    setLoading(true);
    setError(null);

    Promise.all([
      fetchOrganizationLimits(),
      fetchMyLimit()
    ]).finally(() => {
      console.log('✅ [AGENT_LIMITS] Carregamento concluído');
      setLoading(false);
    });
  }, [user, organization?.id, authLoading, orgLoading]);

  return {
    agentLimits,
    myLimit,
    loading,
    error,
    updateAgentLimit,
    fetchOrganizationAgents,
    isAdmin,
    refetch: () => {
      console.log('🔄 [AGENT_LIMITS] Recarregando dados...');
      fetchOrganizationLimits();
      fetchMyLimit();
    }
  };
};