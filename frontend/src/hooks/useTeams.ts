import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import type { Team } from '@/components/groups/TeamsPage';

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { organization } = useOrganization();
  const { toast } = useToast();

  // Buscar times da organização
  const fetchTeams = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams?organization_id=${organization.id}`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTeams(data.teams || []);
      } else {
        setTeams([]);
      }
    } catch (error) {
      console.error('Erro ao buscar times:', error);
      // Não mostrar toast de erro quando não há times - isso é normal para organizações novas
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  // Criar time
  const createTeam = async (teamData: { name: string; description?: string }) => {
    if (!organization?.id) return null;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams?organization_id=${organization.id}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.team) {
        setTeams(prev => [...prev, data.team]);
        toast({
          title: 'Sucesso',
          description: 'Time criado com sucesso!'
        });
        return data.team;
      } else {
        throw new Error('Erro ao criar time');
      }
    } catch (error) {
      console.error('Erro ao criar time:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar time',
        variant: 'destructive'
      });
      return null;
    }
  };

  // Atualizar time
  const updateTeam = async (teamId: string, teamData: { name: string; description?: string }) => {
    if (!organization?.id) return false;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams/${teamId}?organization_id=${organization.id}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.team) {
        setTeams(prev => prev.map(team => team.id === teamId ? data.team : team));
        toast({
          title: 'Sucesso',
          description: 'Time atualizado com sucesso!'
        });
        return true;
      } else {
        throw new Error('Erro ao atualizar time');
      }
    } catch (error) {
      console.error('Erro ao atualizar time:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar time',
        variant: 'destructive'
      });
      return false;
    }
  };

  // Excluir time
  const deleteTeam = async (teamId: string) => {
    if (!organization?.id) return false;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams/${teamId}?organization_id=${organization.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTeams(prev => prev.filter(team => team.id !== teamId));
        toast({
          title: 'Sucesso',
          description: 'Time excluído com sucesso!'
        });
        return true;
      } else {
        throw new Error('Erro ao excluir time');
      }
    } catch (error) {
      console.error('Erro ao excluir time:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir time',
        variant: 'destructive'
      });
      return false;
    }
  };

  // 🎯 NOVA FUNÇÃO: Adicionar membro ao time
  const addTeamMember = async (teamId: string, userId: string) => {
    if (!organization?.id) return false;

    try {
      console.log('🔍 [useTeams] Adicionando membro ao time:', { teamId, userId, organizationId: organization.id });
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams/${teamId}/members?organization_id=${organization.id}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Membro adicionado ao time com sucesso!'
        });
        return true;
      } else {
        throw new Error(result.error || 'Erro ao adicionar membro');
      }
    } catch (error) {
      console.error('❌ [useTeams] Erro ao adicionar membro ao time:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao adicionar membro ao time',
        variant: 'destructive'
      });
      return false;
    }
  };

  // 🎯 NOVA FUNÇÃO: Remover membro do time
  const removeTeamMember = async (teamId: string, userId: string) => {
    if (!organization?.id) return false;

    try {
      console.log('🔍 [useTeams] Removendo membro do time:', { teamId, userId, organizationId: organization.id });
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams/${teamId}/members/${userId}?organization_id=${organization.id}`, {
        method: 'DELETE',
        headers
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Membro removido do time com sucesso!'
        });
        return true;
      } else {
        throw new Error(result.error || 'Erro ao remover membro');
      }
    } catch (error) {
      console.error('❌ [useTeams] Erro ao remover membro do time:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao remover membro do time',
        variant: 'destructive'
      });
      return false;
    }
  };

  // 🎯 NOVA FUNÇÃO: Listar membros de um time
  const getTeamMembers = async (teamId: string) => {
    if (!organization?.id) return [];

    try {
      console.log('🔍 [useTeams] Listando membros do time:', { teamId, organizationId: organization.id });
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams/${teamId}/members?organization_id=${organization.id}`, {
        headers
      });
      const result = await response.json();

      if (result.success) {
        return result.members || [];
      } else {
        throw new Error(result.error || 'Erro ao listar membros do time');
      }
    } catch (error) {
      console.error('❌ [useTeams] Erro ao listar membros do time:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao listar membros do time',
        variant: 'destructive'
      });
      return [];
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [organization?.id]);

  return {
    teams,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    // 🎯 NOVAS FUNÇÕES
    addTeamMember,
    removeTeamMember,
    getTeamMembers,
    refetch: fetchTeams
  };
}; 