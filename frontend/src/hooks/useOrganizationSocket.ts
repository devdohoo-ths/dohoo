import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { socketManager } from '@/services/socketManager';

/**
 * ✅ CORREÇÃO: Hook simplificado que usa o gerenciador centralizado
 * Garante que a conexão Socket.IO está estabelecida e que entrou na sala da organização
 */
export const useOrganizationSocket = () => {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id || !profile?.organization_id) return;

    // ✅ NOVO: Conectar usando o gerenciador centralizado
    // O gerenciador já gerencia a conexão única e entra nas salas necessárias
    socketManager.connect(profile.id, profile.organization_id).catch((error) => {
      console.error('❌ [useOrganizationSocket] Erro ao conectar:', error);
    });

    // Não precisa de cleanup - o gerenciador centralizado gerencia isso
  }, [profile?.id, profile?.organization_id]);

  return null; // Este hook não retorna nada, apenas garante a conexão
};
