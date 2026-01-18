import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useConnectionAuth } from './useConnectionAuth';
import { 
  Platform, 
  ConnectionAccount, 
  ConnectionAccountsResponse,
  ConnectionAccountsFilters,
  CreateConnectionAccountData,
  UpdateConnectionAccountData,
  PlatformStats,
  AllPlatformsStats
} from '@/types/connections';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders
import { normalizeQrCode } from '@/utils/qrCode';

export const useConnectionAccounts = (platform: Platform) => {
  console.log('=== useConnectionAccounts chamado ===');
  console.log('Platform:', platform);
  
  const { user } = useAuth();
  console.log('User from useAuth:', user);
  
  const auth = useConnectionAuth();
  console.log('Auth from useConnectionAuth:', auth);
  
  const [accounts, setAccounts] = useState<ConnectionAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrTimer, setQrTimer] = useState(0);

  const applyQrCode = useCallback(async (value?: string | null, timerValue?: number) => {
    const normalized = await normalizeQrCode(value);

    if (normalized) {
      setQrCode(normalized);
      setQrTimer(timerValue ?? 60);
    } else {
      setQrCode(null);
      setQrTimer(0);
    }
  }, []);

  // Buscar contas da plataforma
  const fetchAccounts = useCallback(async () => {
    console.log('=== fetchAccounts chamado ===');
    console.log('User organization_id:', user?.organization_id);
    
    if (!user?.organization_id) {
      console.log('Sem organization_id, retornando');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fazendo requisição para:', `${apiBase}/connections/${platform}`);
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}`, {
        method: 'GET',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        }
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Erro na resposta:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      setAccounts(data.accounts || []);
    } catch (err: any) {
      console.error(`Erro ao buscar contas ${platform}:`, err);
      setError(err.message || `Erro ao carregar contas ${platform}`);
    } finally {
      setLoading(false);
    }
  }, [user, platform]);

  // Criar nova conta
  const createAccount = useCallback(async (data: CreateConnectionAccountData) => {
    console.log('=== createAccount chamado ===');
    console.log('Data:', data);
    
    if (!user?.organization_id || !auth.canCreate(platform)) {
      throw new Error('Sem permissão para criar contas');
    }

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}`, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        },
        body: JSON.stringify({
          ...data,
          organization_id: user.organization_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      await fetchAccounts();
      return result;
    } catch (err: any) {
      console.error(`Erro ao criar conta ${platform}:`, err);
      throw new Error(err.message || `Erro ao criar conta ${platform}`);
    }
  }, [user, platform, auth, fetchAccounts]);

  // Atualizar conta
  const updateAccount = useCallback(async (accountId: string, data: UpdateConnectionAccountData) => {
    if (!user?.organization_id) return false;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}/${accountId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      await fetchAccounts();
      return true;
    } catch (err: any) {
      console.error(`Erro ao atualizar conta ${platform}:`, err);
      return false;
    }
  }, [user, platform, fetchAccounts]);

  // Deletar conta
  const deleteAccount = useCallback(async (accountId: string) => {
    if (!user?.organization_id || !auth.canManage(platform)) {
      throw new Error('Sem permissão para deletar contas');
    }

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}/${accountId}`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      await fetchAccounts();
      return true;
    } catch (err: any) {
      console.error(`Erro ao deletar conta ${platform}:`, err);
      throw new Error(err.message || `Erro ao deletar conta ${platform}`);
    }
  }, [user, platform, auth, fetchAccounts]);

  // Conectar conta
  const connectAccount = useCallback(async (accountId: string) => {
    if (!user?.organization_id) return;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}/${accountId}/connect`, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.qrCode || data.qr || data.code) {
        await applyQrCode(data.qrCode ?? data.qr ?? data.code, data.timer);
      }

      return data;
    } catch (err: any) {
      console.error(`Erro ao conectar conta ${platform}:`, err);
      throw new Error(err.message || `Erro ao conectar conta ${platform}`);
    }
  }, [user, platform, applyQrCode]);

  // Desconectar conta
  const disconnectAccount = useCallback(async (accountId: string) => {
    if (!user?.organization_id) return;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}/${accountId}/disconnect`, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      await fetchAccounts();
    } catch (err: any) {
      console.error(`Erro ao desconectar conta ${platform}:`, err);
      throw new Error(err.message || `Erro ao desconectar conta ${platform}`);
    }
  }, [user, platform, fetchAccounts]);

  // Reconectar conta individual
  const reconnectAccount = useCallback(async (accountId: string) => {
    if (!user?.organization_id) return;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}/${accountId}/reconnect`, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.qrCode || data.qr || data.code) {
        await applyQrCode(data.qrCode ?? data.qr ?? data.code, data.timer);
      }

      await fetchAccounts();
      return data;
    } catch (err: any) {
      console.error(`Erro ao reconectar conta ${platform}:`, err);
      throw new Error(err.message || `Erro ao reconectar conta ${platform}`);
    }
  }, [user, platform, fetchAccounts, applyQrCode]);

  // Reconectar todas as contas (apenas admin)
  const reconnectAllAccounts = useCallback(async () => {
    if (!user?.organization_id || !auth.isAdmin) {
      throw new Error('Apenas administradores podem reconectar todas as contas');
    }

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}/reconnect-all`, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      await fetchAccounts();
    } catch (err: any) {
      console.error(`Erro ao reconectar todas as contas ${platform}:`, err);
      throw new Error(err.message || `Erro ao reconectar todas as contas ${platform}`);
    }
  }, [user, platform, auth, fetchAccounts]);

  // Regenerar QR Code
  const regenerateQRCode = useCallback(async (accountId: string) => {
    if (!user?.organization_id) return;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/connections/${platform}/${accountId}/regenerate-qr`, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Organization-ID': user.organization_id
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.qrCode || data.qr || data.code) {
        await applyQrCode(data.qrCode ?? data.qr ?? data.code, data.timer);
      }

      return data;
    } catch (err: any) {
      console.error(`Erro ao regenerar QR Code ${platform}:`, err);
      throw new Error(err.message || `Erro ao regenerar QR Code ${platform}`);
    }
  }, [user, platform, applyQrCode]);

  // Calcular estatísticas
  const stats: PlatformStats = {
    total: accounts.length,
    connected: accounts.filter(a => a.status === 'connected').length,
    connecting: accounts.filter(a => a.status === 'connecting').length,
    disconnected: accounts.filter(a => a.status === 'disconnected').length,
    error: accounts.filter(a => a.status === 'error').length
  };

  // Buscar contas quando mudar plataforma ou usuário
  useEffect(() => {
    console.log('=== useEffect fetchAccounts ===');
    console.log('User:', user);
    console.log('Platform:', platform);
    fetchAccounts();
  }, [fetchAccounts]);

  // Timer para QR Code
  useEffect(() => {
    if (qrTimer > 0) {
      const interval = setInterval(() => {
        setQrTimer(prev => {
          if (prev <= 1) {
            setQrCode(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [qrTimer]);

  console.log('=== useConnectionAccounts retornando ===');
  console.log('Accounts:', accounts);
  console.log('Loading:', loading);
  console.log('Error:', error);
  console.log('Stats:', stats);

  return {
    accounts,
    loading,
    error,
    qrCode,
    qrTimer,
    stats,
    createAccount,
    updateAccount,
    deleteAccount,
    connectAccount,
    disconnectAccount,
    reconnectAccount,
    reconnectAllAccounts,
    regenerateQRCode
  };
};

// Hook para estatísticas de todas as plataformas
export const useAllPlatformsStats = (): AllPlatformsStats => {
  const platforms: Platform[] = ['whatsapp', 'telegram', 'facebook', 'instagram', 'api'];
  
  const stats: AllPlatformsStats = {
    total: 0,
    platforms: {}
  };

  platforms.forEach(platform => {
    const platformStats = useConnectionAccounts(platform);
    stats.platforms[platform] = platformStats.stats;
    stats.total += platformStats.stats.total;
  });

  return stats;
}; 