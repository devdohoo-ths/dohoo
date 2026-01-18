import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeadersWithUser } from '@/utils/apiBase';
import type { IntelligentServiceProduct } from '../types';

/**
 * Hook para gerenciar configurações de atendimento inteligente
 */
export const useConfigs = () => {
  const [configs, setConfigs] = useState<IntelligentServiceProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { organization } = useOrganization();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  /**
   * Buscar todas as configurações da organização
   */
  const fetchConfigs = useCallback(async () => {
    if (!organization?.id) {
      console.log('[useConfigs] Organização não disponível');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[useConfigs] Buscando configurações...');
      
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/intelligent-service/configs`, {
        headers
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao buscar configurações');
      }

      console.log('[useConfigs] Configurações carregadas:', data.configs.length);
      setConfigs(data.configs || []);

    } catch (err: any) {
      console.error('[useConfigs] Erro ao buscar configurações:', err);
      setError(err.message);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, user, profile, toast]);

  /**
   * Criar nova configuração
   */
  const createConfig = useCallback(async (configData: Partial<IntelligentServiceProduct>) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useConfigs] Criando configuração:', configData);

      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/intelligent-service/configs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(configData)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao criar configuração');
      }

      console.log('[useConfigs] Configuração criada:', data.config.id);
      
      toast({
        title: 'Sucesso',
        description: 'Configuração criada com sucesso!'
      });

      // Recarregar lista
      await fetchConfigs();

      return data.config;

    } catch (err: any) {
      console.error('[useConfigs] Erro ao criar configuração:', err);
      setError(err.message);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível criar a configuração',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast, fetchConfigs]);

  /**
   * Atualizar configuração existente
   */
  const updateConfig = useCallback(async (
    id: string, 
    configData: Partial<IntelligentServiceProduct>
  ) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useConfigs] Atualizando configuração:', id);

      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/intelligent-service/configs/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(configData)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao atualizar configuração');
      }

      console.log('[useConfigs] Configuração atualizada');
      
      toast({
        title: 'Sucesso',
        description: 'Configuração atualizada com sucesso!'
      });

      // Recarregar lista
      await fetchConfigs();

      return data.config;

    } catch (err: any) {
      console.error('[useConfigs] Erro ao atualizar configuração:', err);
      setError(err.message);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível atualizar a configuração',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast, fetchConfigs]);

  /**
   * Deletar configuração
   */
  const deleteConfig = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useConfigs] Deletando configuração:', id);

      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/intelligent-service/configs/${id}`, {
        method: 'DELETE',
        headers
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao deletar configuração');
      }

      console.log('[useConfigs] Configuração deletada');
      
      toast({
        title: 'Sucesso',
        description: 'Configuração deletada com sucesso!'
      });

      // Recarregar lista
      await fetchConfigs();

      return true;

    } catch (err: any) {
      console.error('[useConfigs] Erro ao deletar configuração:', err);
      setError(err.message);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível deletar a configuração',
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast, fetchConfigs]);

  /**
   * Buscar configuração específica
   */
  const getConfig = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useConfigs] Buscando configuração:', id);

      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/intelligent-service/configs/${id}`, {
        headers
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao buscar configuração');
      }

      console.log('[useConfigs] Configuração encontrada');
      return data.config;

    } catch (err: any) {
      console.error('[useConfigs] Erro ao buscar configuração:', err);
      setError(err.message);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível buscar a configuração',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast]);

  /**
   * Alternar status ativo/inativo
   */
  const toggleActive = useCallback(async (id: string, currentStatus: boolean) => {
    return await updateConfig(id, { is_active: !currentStatus });
  }, [updateConfig]);

  // Carregar configurações ao montar o componente
  useEffect(() => {
    if (organization?.id) {
      fetchConfigs();
    }
  }, [organization?.id, fetchConfigs]);

  return {
    configs,
    loading,
    error,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    getConfig,
    toggleActive,
    // Métricas úteis
    activeConfigs: configs.filter(c => c.is_active),
    inactiveConfigs: configs.filter(c => !c.is_active),
    totalConfigs: configs.length
  };
};

