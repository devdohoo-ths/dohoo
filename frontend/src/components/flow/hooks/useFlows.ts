import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Flow } from '../types';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase } from '@/utils/apiBase';

export const useFlows = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && organization?.id) {
      loadFlows();
    }
  }, [user, organization?.id]);

  const loadFlows = async () => {
    if (!organization?.id) {
      console.log('[loadFlows] Nenhuma organização encontrada:', organization);
      return;
    }
    try {
      setLoading(true);
      console.log('[loadFlows] Buscando fluxos para organization_id:', organization.id);
      const response = await fetch(`${apiBase}/api/flows/list?organization_id=${organization.id}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao buscar fluxos');
      }
      const flowsFormatted = result.flows?.map((f: any) => ({
        id: f.id,
        nome: f.nome,
        descricao: f.descricao || '',
        nodes: f.nodes || [],
        edges: f.edges || [],
        ativo: f.ativo || false,
        canal: f.canal || 'whatsapp',
        organization_id: f.organization_id,
        user_id: f.user_id,
        created_at: f.created_at
      })) || [];
      setFlows(flowsFormatted);
    } catch (error) {
      console.error('Erro ao carregar fluxos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os fluxos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para atualizar um fluxo na lista local sem fazer requisição ao servidor
  const updateFlowInList = (updatedFlow: Flow) => {
    setFlows(prevFlows => 
      prevFlows.map(flow => 
        flow.id === updatedFlow.id ? updatedFlow : flow
      )
    );
  };

  const saveFlow = async (flow: Flow) => {
    try {
      // Adicionar organization_id e user_id se não existirem
      const flowToSave = {
        ...flow,
        organization_id: flow.organization_id || organization?.id,
        user_id: flow.user_id || user?.id
      };

      console.log('[saveFlow] Enviando flow:', JSON.stringify(flowToSave, null, 2));

      const response = await fetch(`${apiBase}/api/flows/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow: flowToSave })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast({
          title: "Erro",
          description: result.error || "Não foi possível salvar o fluxo.",
          variant: "destructive"
        });
        return false;
      }
      toast({
        title: "Sucesso",
        description: flow.id ? "Fluxo atualizado!" : "Fluxo criado!",
      });
      loadFlows();
      return true;
    } catch (error) {
      console.error('[saveFlow] Erro ao salvar fluxo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o fluxo",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteFlow = async (id: string) => {
    if (!organization?.id) return;
    try {
      const response = await fetch(`${apiBase}/api/flows/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, organization_id: organization.id })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao excluir fluxo');
      }
      toast({
        title: "Sucesso",
        description: "Fluxo excluído!",
      });
      loadFlows();
    } catch (error) {
      console.error('Erro ao excluir fluxo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o fluxo",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (flow: Flow) => {
    if (!organization?.id) return;
    try {
      const response = await fetch(`${apiBase}/api/flows/toggle-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: flow.id, 
          organization_id: organization.id,
          ativo: !flow.ativo 
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (result.error?.includes('Já existe um fluxo ativo')) {
          toast({
            title: "Erro",
            description: result.error,
            variant: "destructive"
          });
          return;
        }
        throw new Error(result.error || 'Erro ao alterar status');
      }
      toast({
        title: "Sucesso",
        description: `Fluxo ${!flow.ativo ? 'ativado' : 'desativado'}!`,
      });
      loadFlows();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do fluxo",
        variant: "destructive"
      });
    }
  };

  return {
    flows,
    loading,
    saveFlow,
    deleteFlow,
    toggleActive,
    loadFlows,
    updateFlowInList
  };
};
