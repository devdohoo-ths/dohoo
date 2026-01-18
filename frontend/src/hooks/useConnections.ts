import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import io, { Socket } from 'socket.io-client';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders
import { useLocation } from 'react-router-dom';
import { normalizeQrCode, pickQrValue } from '@/utils/qrCode';

export interface Connection {
  id: string;
  name: string;
  platform: 'whatsapp' | 'telegram' | 'facebook' | 'instagram' | 'api';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  user_id: string;
  organization_id: string;
  assigned_to: string;
  assigned_user?: {
    id: string;
    name: string;
    email: string;
  };
  created_user?: {
    id: string;
    name: string;
    email: string;
  };
  config: {
    account_type?: 'official' | 'unofficial';
    phone_number?: string;
    qr_code?: string;
    session_data?: any;
    last_connected_at?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export const useConnections = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrTimer, setQrTimer] = useState<number>(0);
  const { toast } = useToast();
  const location = useLocation();

  // Verificar se estamos na tela de contas/conexões
  const isOnAccountsPage = location.pathname.includes('/accounts') || location.pathname.includes('/connections');

  // Conectar com Socket.IO
  useEffect(() => {
    let isMounted = true;
    const newSocket = io(apiBase);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Conectado ao Socket.IO');
      
      // ✅ CORREÇÃO: Entrar na sala da organização se o usuário estiver autenticado
      // Isso será feito quando o usuário se conectar
    });

    newSocket.on('whatsapp-qr-code', async (data: { accountId: string; qr?: string; qrCode?: string; code?: string; accountName: string }) => {
      if (!isMounted) {
        return;
      }

      const rawQrValue = pickQrValue(data);
      const normalized = await normalizeQrCode(rawQrValue);

      if (!normalized) {
        console.warn('⚠️ [Connections] QR Code recebido sem payload válido:', {
          accountId: data.accountId,
          rawLength: rawQrValue.length,
        });
        return;
      }

      console.log('QR Code recebido:', {
        accountId: data.accountId,
        accountName: data.accountName,
        qrLength: normalized.length,
      });
      setQrCode(normalized);
      setQrTimer(120); // ✅ CORREÇÃO: Atualizado para 120 segundos
      
      updateConnectionStatus(data.accountId, 'connecting', { qr_code: normalized });
    });

    newSocket.on('whatsapp-connected', (data: { accountId: string; accountName: string; phoneNumber: string }) => {
      console.log('Evento whatsapp-connected recebido:', data);
      
      // Limpar QR Code ao conectar
      setQrCode('');
      setQrTimer(0);
      
      // Atualizar status da conexão
      updateConnectionStatus(data.accountId, 'connected', {
        phone_number: data.phoneNumber,
        qr_code: null,
        last_connected_at: new Date().toISOString()
      });
      
      // Emitir evento para fechar modal de QR code
      window.dispatchEvent(new CustomEvent('whatsapp-connection-success', { 
        detail: { accountId: data.accountId } 
      }));
      
      toast({
        title: "WhatsApp Conectado",
        description: `Conta ${data.accountName} conectada com sucesso!`,
      });
    });

    newSocket.on('whatsapp-disconnected', (data: { accountId: string; accountName: string }) => {
      console.log('❌ WhatsApp desconectado:', data);
      
      // Verificar se não está no processo de conexão
      if (qrTimer > 0) {
        console.log('Ignorando evento de desconexão durante conexão ativa');
        return;
      }
      
      // Filtrar: só exibir toast se a conexão for do usuário logado
      const connection = connections.find(conn => conn.id === data.accountId);
      // Supondo que user_id do usuário logado está disponível em window.__USER_ID__
      const loggedUserId = window.__USER_ID__ || null;
      if (!connection || (loggedUserId && connection.user_id !== loggedUserId)) return;
      
      updateConnectionStatus(data.accountId, 'disconnected', {
        phone_number: null,
        qr_code: null
      });

      // Só exibir toast se estiver na tela de contas
      if (isOnAccountsPage) {
        toast({
          title: "WhatsApp Desconectado",
          description: `Conta ${data.accountName} foi desconectada`,
          variant: "destructive",
        });
      }
    });

    newSocket.on('whatsapp-qr-expired', (data: { accountId: string; accountName: string }) => {
      console.log('QR Code expirado, aguardando novo do backend:', data);
      setQrCode('');
      setQrTimer(0); 
      
      updateConnectionStatus(data.accountId, 'connecting');
      
      toast({
        title: "QR Code Expirado",
        description: `O QR Code para ${data.accountName} expirou. Gerando um novo automaticamente...`,
      });
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
    };
  }, [toast, connections, isOnAccountsPage]);

  // Timer do QR Code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [qrTimer]);

  // Buscar conexões
  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔗 Buscando conexões via API...');

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/connections`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error text:', errorText);
        setConnections([]);
        return;
      }

      const result = await response.json();
      
      if (!result.success) {
        console.log('⚠️ Response não foi bem-sucedida, usando fallback');
        setConnections([]);
        return;
      }

      console.log(`✅ ${result.connections?.length || 0} conexões carregadas`);
      setConnections(result.connections || []);
    } catch (error) {
      console.error('❌ Erro ao buscar conexões:', error);
      setConnections([]);
      toast({
        title: "Erro",
        description: "Falha ao carregar conexões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Atualizar status da conexão (apenas localmente para UI)
  const updateConnectionStatus = async (connectionId: string, status: Connection['status'], additionalData?: Partial<Connection['config']>) => {
    try {
      setConnections(prev => prev.map(conn => 
        conn.id === connectionId 
          ? { 
              ...conn, 
              status,
              config: { ...conn.config, ...additionalData },
              updated_at: new Date().toISOString()
            }
          : conn
      ));
    } catch (error) {
      console.error('❌ Erro ao atualizar status local:', error);
    }
  };

  // Criar nova conexão
  const createConnection = async (name: string, platform: Connection['platform'], accountType?: 'official' | 'unofficial') => {
    try {
      setLoading(true);
      console.log('🔗 Criando nova conexão:', { name, platform, accountType });

      const requestBody: any = { 
        name,
        platform
      };

      // Adicionar account_type apenas se fornecido (WhatsApp)
      if (accountType) {
        requestBody.account_type = accountType;
      }

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/connections`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar conexão: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar conexão');
      }

      setConnections(prev => [result.connection, ...prev]);

      toast({
        title: "Conexão Criada",
        description: `Conexão ${platform} criada com sucesso`,
      });

      return result.connection;
    } catch (error) {
      console.error('❌ Erro ao criar conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar conexão",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Conectar conta
  const connectConnection = async (connectionId: string) => {
    try {
      console.log('🔗 Conectando conta:', connectionId);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/connections/${connectionId}/connect`, {
        method: 'POST',
        headers
      });

      const result = await response.json();

      if (result.success) {
        updateConnectionStatus(connectionId, 'connecting');
        toast({
          title: "Conectando",
          description: "Iniciando conexão...",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao conectar conta:', error);
      toast({
        title: "Erro",
        description: "Falha ao conectar conta",
        variant: "destructive",
      });
    }
  };

  // Desconectar conexão
  const disconnectConnection = async (connectionId: string) => {
    try {
      console.log('🔌 Desconectando conexão:', connectionId);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/connections/${connectionId}/disconnect`, {
        method: 'POST',
        headers
      });

      const result = await response.json();

      if (result.success) {
        updateConnectionStatus(connectionId, 'disconnected');
        
        toast({
          title: "Conexão Desconectada",
          description: "Conexão desconectada com sucesso",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao desconectar conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao desconectar conexão",
        variant: "destructive",
      });
    }
  };

  // Deletar conexão
  const deleteConnection = async (connectionId: string) => {
    try {
      console.log('🔗 Deletando conexão:', connectionId);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/connections/${connectionId}`, {
        method: 'DELETE',
        headers
      });

      const result = await response.json();

      if (result.success) {
        setConnections(prev => prev.filter(conn => conn.id !== connectionId));
        
        toast({
          title: "Conexão Removida",
          description: "Conexão removida com sucesso",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao remover conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover conexão",
        variant: "destructive",
      });
    }
  };

  // Atualizar conexão
  const updateConnection = async (connectionId: string, updates: { name?: string; config?: any; assigned_to?: string }) => {
    try {
      console.log('🔗 Atualizando conexão:', connectionId, updates);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/connections/${connectionId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });

      const result = await response.json();

      if (result.success) {
        // Atualizar o estado local com os dados retornados
        setConnections(prev => prev.map(conn => 
          conn.id === connectionId 
            ? { 
                ...conn, 
                ...result.connection,
                // Manter dados do usuário se existirem
                assigned_user: conn.assigned_user || result.connection.assigned_user,
                created_user: conn.created_user || result.connection.created_user
              }
            : conn
        ));
        
        toast({
          title: "Conexão Atualizada",
          description: "Conexão atualizada com sucesso",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar conexão",
        variant: "destructive",
      });
    }
  };

  // Carregar conexões na inicialização
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  return {
    connections,
    loading,
    qrCode,
    qrTimer,
    fetchConnections,
    createConnection,
    connectConnection,
    disconnectConnection,
    deleteConnection,
    updateConnection,
    updateConnectionStatus
  };
}; 