import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { accountsCache } from '@/utils/accountsCache';
import { normalizeQrCode, pickQrValue } from '@/utils/qrCode';
import { socketManager } from '@/services/socketManager'; // ✅ NOVO: Gerenciador centralizado

export interface WhatsAppAccount {
  id: string;
  user_id: string;
  name: string;
  phone_number?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  qr_code?: string;
  session_data?: any;
  account_id: string;
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
  assistant_id?: string | null;
  flow_id?: string | null;
  mode?: 'ia' | 'flow';
  platform?: string;
  account_type?: 'official' | 'unofficial';
  profile_picture?: string; // ✅ NOVO: Campo para foto de perfil do WhatsApp
  config?: {
    profile_picture?: string;
    [key: string]: any;
  };
}

const CONNECTED_MESSAGE_PATTERNS = [
  'já está conectada',
  'já está conectado',
  'conectado com sucesso',
  'conectada com sucesso',
  'wppconnect conectado',
  'wppconnect conectada'
];

const isResultAlreadyConnected = (result: any): boolean => {
  if (!result || result?.success === false) return false;

  if (result.alreadyConnected) return true;

  const normalizedStatus = (result.status || result.connectionStatus || '').toString().toLowerCase();
  if (normalizedStatus === 'connected') return true;

  const normalizedMessage = (result.message || '').toString().toLowerCase();
  return CONNECTED_MESSAGE_PATTERNS.some(pattern => normalizedMessage.includes(pattern));
};

const extractPhoneFromResult = (result: any): string | undefined => {
  if (!result) return undefined;
  return (
    result.phoneNumber ||
    result.phone_number ||
    result?.data?.phone_number ||
    result?.connection?.phone_number ||
    result?.account?.phone_number
  );
};

export const useWhatsAppAccounts = (options?: { disableErrorToasts?: boolean }) => {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingReconnectEmails, setSendingReconnectEmails] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrTimer, setQrTimer] = useState<number>(0);
  const [lastConnectedAccountId, setLastConnectedAccountId] = useState<string | null>(null);
  
  // ✅ NOVO: Controle de estado para evitar loops
  const [reconnectingAccounts, setReconnectingAccounts] = useState<Set<string>>(new Set());
  const [lastReconnectAttempt, setLastReconnectAttempt] = useState<Map<string, number>>(new Map());
  const [pendingReconnectEmails, setPendingReconnectEmails] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const { profile } = useAuth();
  const location = useLocation();

  const fetchPendingReconnects = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-reconnect/pending`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar status de reconexão');
      }

      const result = await response.json();
      const pendingSet = new Set<string>();
      if (Array.isArray(result?.tokens)) {
        result.tokens.forEach((token: { account_id: string }) => pendingSet.add(token.account_id));
      }
      setPendingReconnectEmails(pendingSet);
    } catch (error) {
      console.error('❌ Erro ao buscar tokens de reconexão pendentes:', error);
      setPendingReconnectEmails(new Set());
    }
  }, []);

  const matchesAccountId = useCallback((account: WhatsAppAccount, accountId: string) => {
    if (!accountId) return false;
    return account.account_id === accountId || (account as any).account_id === accountId || account.id === accountId;
  }, []);

  // ✅ CORREÇÃO: Configurar Socket.IO usando gerenciador centralizado
  useEffect(() => {
    if (!profile?.id || !profile?.organization_id) return;

    let isMounted = true;

    // Conectar usando o gerenciador centralizado
    socketManager.connect(profile.id, profile.organization_id).catch((error) => {
      console.error('❌ [Socket.IO] Erro ao conectar:', error);
    });

    // ✅ NOVO: Configurar listeners usando o gerenciador centralizado
    const handleQrCode = async (data: { accountId: string; qr?: string; qrCode?: string; code?: string; accountName: string }) => {
      const rawQrValue = pickQrValue(data);
      const qrValue = await normalizeQrCode(rawQrValue);

      if (!isMounted) {
        return;
      }

      if (!qrValue) {
        console.warn('⚠️ [FRONTEND] QR Code recebido sem payload válido:', {
          accountId: data.accountId,
          accountName: data.accountName,
          rawQrLength: rawQrValue?.length || 0,
        });
        return;
      }

      console.log('📱 [FRONTEND] QR Code recebido via Socket.IO:', {
        accountId: data.accountId,
        accountName: data.accountName,
        qrLength: qrValue.length,
      });

      // ✅ NOVO: Como o QR code está sendo emitido apenas para o usuário específico (user-${userId}),
      // podemos processar diretamente sem verificar se a conta está em 'connecting'
      // O backend já garante que apenas o usuário correto recebe o QR code
      const account = accounts.find(acc => matchesAccountId(acc, data.accountId));
      
      // ✅ CORREÇÃO: Processar QR code sempre, pois já foi filtrado pelo backend para o usuário correto
      // Se a conta existe, atualizar status para 'connecting' se necessário
      console.log('✅ [FRONTEND] QR Code processado (já filtrado pelo backend para este usuário):', {
        accountId: data.accountId,
        accountName: data.accountName,
        accountExists: !!account,
        accountStatus: account?.status
      });
      
      setQrCode(qrValue);
      setQrTimer(120);
      
      // Atualizar status da conta para 'connecting' se existir no array
      if (account && account.status !== 'connecting') {
        setAccounts(prev => prev.map(acc => 
          matchesAccountId(acc, data.accountId) 
            ? { ...acc, status: 'connecting' as const }
            : acc
        ));
      }

      await fetchPendingReconnects();
    };

    const handleConnected = (data: { accountId: string; accountName: string; phoneNumber: string }) => {
      console.log('📱 [FRONTEND] Evento whatsapp-connected recebido:', data);
      setQrCode('');
      setQrTimer(0);
      
      // Atualizar conta específica
      setAccounts(prev => {
        const updated = prev.map(account => {
          if (matchesAccountId(account, data.accountId)) {
            console.log(`✅ [FRONTEND] Atualizando conta ${account.account_id || account.id} para connected`);
            return { ...account, status: 'connected' as const, phone_number: data.phoneNumber };
          }
          return account;
        });
        return updated;
      });

      // ✅ NOVO: Remover flags de reconexão para esta conta
      setReconnectingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.accountId);
        return newSet;
      });

      setLastReconnectAttempt(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.accountId);
        return newMap;
      });

      setPendingReconnectEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.accountId);
        return newSet;
      });

      // ✅ NOVO: Sinalizar conta conectada para fechar modal automaticamente
      setLastConnectedAccountId(data.accountId);

      if (!options?.disableErrorToasts) {
        toast({
          title: "WhatsApp Conectado",
          description: `Conta ${data.accountName} conectada com sucesso!`,
        });
      }
    };

    const handleDisconnected = (data: { accountId: string; accountName: string; reason?: string; attemptCount?: number }) => {
      
      // Remover da lista de reconexão
      setReconnectingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.accountId);
        return newSet;
      });
      
      // ✅ OTIMIZADO: Atualizar conta específica SEM recarregar tudo
      setAccounts(prev => prev.map(account => 
        matchesAccountId(account, data.accountId) 
          ? { 
              ...account, 
              status: (data.attemptCount && data.attemptCount >= 5) ? 'error' as const : 'disconnected' as const, 
              phone_number: undefined 
            }
          : account
      ));
      
      // ✅ OTIMIZADO: NÃO fazer fetchAccounts - atualização local é suficiente
      // fetchAccounts(true, false); // REMOVIDO para reduzir requisições

      // Toast de desconexão removido conforme solicitado
    };

    const handleQrExpired = (data: { accountId: string; accountName: string }) => {
      setQrCode('');
      setQrTimer(0);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "QR Code Expirado",
          description: `QR Code da conta ${data.accountName} expirou. Tente novamente.`,
          variant: "destructive",
        });
      }
    };

    // ✅ NOVO: Evento de timeout de conexão
    const handleConnectionTimeout = (data: { 
      accountId: string; 
      accountName: string; 
      reason: string;
      debug?: { duration: string; lastStatus: string; }
    }) => {
      
      // Atualizar status da conta para erro
      setAccounts(prev => prev.map(account => 
        matchesAccountId(account, data.accountId) 
          ? { ...account, status: 'error' as const }
          : account
      ));
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Timeout de Conexão",
          description: `Conexão de ${data.accountName} demorou mais que ${data.debug?.duration || '5 minutos'}. Tente novamente.`,
          variant: "destructive",
        });
      }

      fetchPendingReconnects();
    };

    // ✅ NOVO: Evento de reset de sessão
    const handleSessionReset = (data: { 
      accountId: string; 
      accountName: string; 
      reason: string;
      message: string;
    }) => {
      
      // Atualizar status da conta para desconectado
      setAccounts(prev => prev.map(account => 
        matchesAccountId(account, data.accountId) 
          ? { 
              ...account, 
              status: 'disconnected' as const,
              phone_number: undefined,
              qr_code: undefined
            }
          : account
      ));
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Sessão Resetada",
          description: data.message,
          variant: "destructive",
        });
      }

      setPendingReconnectEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.accountId);
        return newSet;
      });

      fetchPendingReconnects();
    };

    // ✅ NOVO: Registrar listeners usando o gerenciador centralizado
    socketManager.on('whatsapp-qr-code', handleQrCode);
    socketManager.on('whatsapp-connected', handleConnected);
    socketManager.on('whatsapp-disconnected', handleDisconnected);
    socketManager.on('whatsapp-qr-expired', handleQrExpired);
    socketManager.on('whatsapp-connection-timeout', handleConnectionTimeout);
    socketManager.on('whatsapp-session-reset', handleSessionReset);

    return () => {
      isMounted = false;
      // ✅ NOVO: Remover listeners ao desmontar
      socketManager.off('whatsapp-qr-code', handleQrCode);
      socketManager.off('whatsapp-connected', handleConnected);
      socketManager.off('whatsapp-disconnected', handleDisconnected);
      socketManager.off('whatsapp-qr-expired', handleQrExpired);
      socketManager.off('whatsapp-connection-timeout', handleConnectionTimeout);
      socketManager.off('whatsapp-session-reset', handleSessionReset);
    };
  }, [profile?.id, profile?.organization_id, toast, options?.disableErrorToasts, fetchPendingReconnects, accounts, matchesAccountId]);

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

  // Buscar contas do usuário
  const fetchAccounts = useCallback(async (forceRefresh = false, showLoading = true) => {
    try {
      // Tentar cache primeiro (se não for refresh forçado)
      if (!forceRefresh && profile?.id) {
        const cachedAccounts = accountsCache.get(profile.id);
        if (cachedAccounts) {
          setAccounts(cachedAccounts);
          setInitialLoading(false);
          await fetchPendingReconnects();
          return;
        }
      }

      // Só mostrar loading se explicitamente solicitado
      if (showLoading) {
        setLoading(true);
      }
      

      // ✅ CORRIGIDO: Usar getAuthHeaders() sem parâmetros
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts`, {
        headers
      });


      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error text:', errorText);
        
        // Fallback: retornar array vazio em caso de erro
        setAccounts([]);
        setInitialLoading(false);
        return;
      }

      const result = await response.json();
      
      if (!result.success) {
        setAccounts([]);
        setInitialLoading(false);
        return;
      }

      // Converter os dados da API para nossa interface
      const convertedAccounts = result.accounts.map((account: any) => {
        return {
          ...account,
          status: account.status || 'disconnected'
        };
      });
      
      // Log removido para reduzir poluição no console
      setAccounts(convertedAccounts);
      
      // Cache os resultados
      if (profile?.id) {
        accountsCache.set(profile.id, convertedAccounts);
      }

      await fetchPendingReconnects();
      // ✅ CORREÇÃO: Removida chamada recursiva que causava loop infinito
      
    } catch (error) {
      console.error('❌ Erro ao buscar contas:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao carregar contas",
          description: "Não foi possível carregar as contas WhatsApp. Tente novamente.",
          variant: "destructive",
        });
      }
      
      setAccounts([]);
      setPendingReconnectEmails(new Set());
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [profile?.id, toast, options?.disableErrorToasts, fetchPendingReconnects]);

  // Criar nova conta
  const createAccount = useCallback(async (name: string, assistantId?: string, flowId?: string, mode: 'ia' | 'flow' = 'ia') => {
    try {
      setLoading(true);
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          assistant_id: assistantId === 'none' ? null : assistantId,
          flow_id: flowId === 'none' ? null : flowId,
          mode
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar conta');
      }

      // ✅ OTIMIZADO: Não recarregar toda a lista - o socket já atualizará ou podemos adicionar localmente
      // await fetchAccounts(true, false); // REMOVIDO para reduzir requisições
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Conta criada",
          description: "Conta WhatsApp criada com sucesso!",
        });
      }

      // ✅ OTIMIZADO: Atualizar lista local sem duplicar registros
      if (result.account) {
        setAccounts(prev => {
          const existsIndex = prev.findIndex(acc =>
            acc.account_id === result.account.account_id ||
            acc.id === result.account.id
          );

          if (existsIndex >= 0) {
            const updated = [...prev];
            updated[existsIndex] = {
              ...updated[existsIndex],
              ...result.account
            };
            return updated;
          }

          return [...prev, result.account];
        });
      } else {
        // Se não veio no result, recarregar apenas uma vez
        // ✅ OTIMIZADO: Removido fetchAccounts desnecessário - atualização via Socket.IO é suficiente
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao criar conta:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao criar conta",
          description: error.message || "Não foi possível criar a conta WhatsApp.",
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts, toast, options?.disableErrorToasts]);

  // ✅ MELHORADO: Conectar conta com controle de reconexão
  const connectAccount = useCallback(async (accountId: string) => {
    console.log('🔥 [FRONTEND] ===== INÍCIO CONEXÃO MANUAL =====');
    console.log('📱 [FRONTEND] accountId:', accountId);
    console.log('🌐 [FRONTEND] apiBase:', apiBase);
    
    const now = Date.now();
    const lastAttempt = lastReconnectAttempt.get(accountId) || 0;
    const timeSinceLastAttempt = now - lastAttempt;
    
    // ✅ PREVENIR LOOP: Aguardar pelo menos 10 segundos entre tentativas
    if (timeSinceLastAttempt < 10000) {
      const remainingTime = Math.ceil((10000 - timeSinceLastAttempt) / 1000);
      console.log(`⏸️ [FRONTEND] Aguardando ${remainingTime}s antes de tentar novamente`);
      toast({
        title: "Aguarde um pouco",
        description: `Tente novamente em ${remainingTime} segundos.`,
        variant: "destructive",
      });
      return;
    }
    
    // ✅ PREVENIR LOOP: Verificar se já está tentando reconectar
    if (reconnectingAccounts.has(accountId)) {
      console.log('⏸️ [FRONTEND] Já está reconectando, ignorando...');
      toast({
        title: "Reconexão em andamento",
        description: "Esta conta já está sendo reconectada. Aguarde um momento.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // ✅ NOVO: Atualizar status para 'connecting' IMEDIATAMENTE ao clicar em conectar
      // Isso garante que o filtro de QR code funcione corretamente
      setAccounts(prev => prev.map(account => 
        matchesAccountId(account, accountId)
          ? { ...account, status: 'connecting' as const }
          : account
      ));
      
      // Marcar como reconectando
      setReconnectingAccounts(prev => new Set(prev).add(accountId));
      setLastReconnectAttempt(prev => new Map(prev).set(accountId, now));
      setPendingReconnectEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      console.log('🔐 [FRONTEND] Obtendo headers de autenticação...');
      const headers = await getAuthHeaders();
      console.log('🔐 [FRONTEND] Headers obtidos:', Object.keys(headers));
      
      const url = `${apiBase}/api/whatsapp-accounts/${accountId}/connect`;
      console.log('📡 [FRONTEND] Enviando requisição para:', url);
      console.log('📡 [FRONTEND] Método: POST');
      
      const response = await fetch(url, {
        method: 'POST',
        headers
      });

      console.log('📥 [FRONTEND] Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const result = await response.json();
      console.log('📥 [FRONTEND] Resultado:', result);
      
      if (!response.ok) {
        console.error('❌ [FRONTEND] Erro na resposta:', result);
        throw new Error(result.error || 'Erro ao conectar conta');
      }

      console.log('✅ [FRONTEND] Conexão iniciada com sucesso!');

      const markAsConnected = isResultAlreadyConnected(result);
      const inferredStatus: WhatsAppAccount['status'] = markAsConnected ? 'connected' : 'connecting';
      const inferredPhone = extractPhoneFromResult(result);
      
      // Atualizar status local da conta
      setAccounts(prev => prev.map(account => 
        matchesAccountId(account, accountId)
          ? { 
              ...account, 
              status: inferredStatus, 
              ...(markAsConnected && inferredPhone ? { phone_number: inferredPhone } : {}) 
            }
          : account
      ));

      if (markAsConnected) {
        setReconnectingAccounts(prev => {
          const newSet = new Set(prev);
          newSet.delete(accountId);
          return newSet;
        });

        setLastReconnectAttempt(prev => {
          const newMap = new Map(prev);
          newMap.delete(accountId);
          return newMap;
        });

        setPendingReconnectEmails(prev => {
          const newSet = new Set(prev);
          newSet.delete(accountId);
          return newSet;
        });

        setLastConnectedAccountId(accountId);

        if (!options?.disableErrorToasts) {
          toast({
            title: "WhatsApp Conectado",
            description: result.message || "Conta conectada com sucesso!",
          });
        }
      }

      console.log('🔥 [FRONTEND] ===== FIM CONEXÃO MANUAL =====');
      return result;
    } catch (error: any) {
      console.error('❌ [FRONTEND] Erro ao conectar conta:', error);
      
      // Remover da lista de reconexão em caso de erro
      setReconnectingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
      
      // ✅ MELHORADO: Verificar se é erro de conexão com backend
      const isConnectionError = error.message?.includes('Failed to fetch') || 
                                error.message?.includes('ERR_CONNECTION_REFUSED') ||
                                error.message?.includes('NetworkError');
      
      if (!options?.disableErrorToasts) {
        toast({
          title: isConnectionError ? "Backend não disponível" : "Erro ao conectar",
          description: isConnectionError 
            ? "Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 3001."
            : (error.message || "Não foi possível conectar a conta WhatsApp."),
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast, options?.disableErrorToasts, reconnectingAccounts, lastReconnectAttempt, matchesAccountId]);

  // Regenerar QR Code
  const regenerateQRCode = useCallback(async (accountId: string) => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/${accountId}/regenerate-qr`, {
        method: 'POST',
        headers
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao regenerar QR Code');
      }

      if (result.alreadyConnected) {
        setAccounts(prev => prev.map(account =>
          matchesAccountId(account, accountId)
            ? { ...account, status: 'connected' }
            : account
        ));
        setLastConnectedAccountId(accountId);
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao regenerar QR Code:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao regenerar QR Code",
          description: error.message || "Não foi possível regenerar o QR Code.",
          variant: "destructive",
        });
      }
      
      throw error;
    }
  }, [toast, options?.disableErrorToasts]);

  // Desconectar conta
  const disconnectAccount = useCallback(async (accountId: string) => {
    try {
      setLoading(true);
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/${accountId}/disconnect`, {
        method: 'POST',
        headers
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao desconectar conta');
      }

      // ✅ NOVO: Atualizar estado local imediatamente após desconectar
      setAccounts(prevAccounts => 
        prevAccounts.map(account => 
          account.account_id === accountId || account.id === accountId
            ? {
                ...account,
                status: 'disconnected' as const,
                phone_number: undefined,
                qr_code: undefined
              }
            : account
        )
      );
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Conta desconectada",
          description: "Conta WhatsApp desconectada com sucesso!",
        });
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao desconectar conta:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao desconectar",
          description: error.message || "Não foi possível desconectar a conta WhatsApp.",
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts, toast, options?.disableErrorToasts]);

  // Desconectar todas as contas da organização
  const disconnectAllAccounts = useCallback(async () => {
    try {
      setLoading(true);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/disconnect-all`, {
        method: 'POST',
        headers
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao desconectar todas as contas');
      }

      // Recarregar lista de contas
      await fetchAccounts(true, false);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: result.disconnectedCount > 0 ? "Contas desconectadas" : "Nenhuma conta conectada",
          description: result.message || `${result.disconnectedCount} conta(s) desconectada(s) com sucesso`,
        });
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao desconectar todas as contas:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao desconectar",
          description: error.message || "Não foi possível desconectar todas as contas WhatsApp.",
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts, toast, options?.disableErrorToasts]);

  // Deletar conta
  const deleteAccount = useCallback(async (accountId: string) => {
    try {
      setLoading(true);
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/${accountId}`, {
        method: 'DELETE',
        headers,
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao deletar conta');
      }

      // ✅ OTIMIZADO: Remover conta localmente ao invés de recarregar tudo
      setAccounts(prev => prev.filter(acc => acc.account_id !== accountId));
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Conta deletada",
          description: "Conta WhatsApp deletada com sucesso!",
        });
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao deletar conta:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao deletar",
          description: error.message || "Não foi possível deletar a conta WhatsApp.",
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts, toast, options?.disableErrorToasts]);

  // Atualizar conta
  const updateAccount = useCallback(async (accountId: string, updates: Partial<WhatsAppAccount>) => {
    try {
      setLoading(true);
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/${accountId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar conta');
      }

      // ✅ OTIMIZADO: Atualizar conta localmente ao invés de recarregar tudo
      if (result.account) {
        setAccounts(prev => prev.map(acc => 
          acc.account_id === accountId ? { ...acc, ...result.account } : acc
        ));
      }
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Conta atualizada",
          description: "Conta WhatsApp atualizada com sucesso!",
        });
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao atualizar conta:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao atualizar",
          description: error.message || "Não foi possível atualizar a conta WhatsApp.",
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts, toast, options?.disableErrorToasts]);

  // Reconectar todas as contas
  const reconnectAllAccounts = useCallback(async () => {
    try {
      setLoading(true);
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/reconnect-all`, {
        method: 'POST',
        headers
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao reconectar contas');
      }

      // Atualizar lista de contas
      // ✅ OTIMIZADO: Removido fetchAccounts desnecessário - atualização via Socket.IO é suficiente
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Reconectando contas",
          description: "Processo de reconexão iniciado para todas as contas!",
        });
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao reconectar contas:', error);
      
      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao reconectar",
          description: error.message || "Não foi possível reconectar as contas WhatsApp.",
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts, toast, options?.disableErrorToasts]);

  const sendReconnectEmails = useCallback(async () => {
    try {
      setSendingReconnectEmails(true);

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts/reconnect-emails`, {
        method: 'POST',
        headers
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao enviar e-mails de reconexão');
      }

      await fetchPendingReconnects();

      if (!options?.disableErrorToasts) {
        toast({
          title: "E-mails enviados",
          description: `${result.emailsSent || 0} e-mail(s) processados.`,
        });
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao enviar e-mails de reconexão:', error);

      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao enviar e-mails",
          description: error.message || "Não foi possível enviar os e-mails de reconexão.",
          variant: "destructive",
        });
      }

      throw error;
    } finally {
      setSendingReconnectEmails(false);
    }
  }, [toast, options?.disableErrorToasts, fetchPendingReconnects, fetchAccounts]);

  // ✅ OTIMIZADO: Carregar contas quando o usuário estiver disponível com debounce
  useEffect(() => {
    if (profile?.id) {
      // ✅ OTIMIZAÇÃO: Usar debounce para evitar múltiplas chamadas simultâneas
      const timeoutId = setTimeout(() => {
        fetchAccounts();
      }, 100); // Pequeno delay para agrupar chamadas rápidas

      return () => clearTimeout(timeoutId);
    }
  }, [profile?.id]); // ✅ REMOVIDO fetchAccounts das dependências para evitar loops

  // ✅ NOVO: Verificar periodicamente contas em "connecting" para sincronizar com banco
  useEffect(() => {
    if (!profile?.id) return;

    const interval = setInterval(async () => {
      // Verificar status no servidor
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${apiBase}/api/whatsapp-accounts`, { headers });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.accounts) {
            setAccounts(prev => {
              const connectingAccounts = prev.filter(acc => acc.status === 'connecting');
              if (connectingAccounts.length === 0) return prev;

              const updated = prev.map(localAccount => {
                // Só verificar se está em connecting
                if (localAccount.status !== 'connecting') return localAccount;

                const serverAccount = result.accounts.find((sa: any) => 
                  matchesAccountId(localAccount, sa.account_id || sa.id)
                );
                
                if (serverAccount && serverAccount.status === 'connected') {
                  console.log(`✅ [FRONTEND] Sincronizando conta ${localAccount.account_id || localAccount.id} para connected (do banco)`);
                  return {
                    ...localAccount,
                    status: 'connected' as const,
                    phone_number: serverAccount.phone_number
                  };
                }
                return localAccount;
              });
              return updated;
            });
          }
        }
      } catch (error) {
        console.error('❌ [FRONTEND] Erro ao verificar status:', error);
      }
    }, 10000); // Verificar a cada 10 segundos

    return () => clearInterval(interval);
  }, [profile?.id]);

  const clearLastConnectedAccount = useCallback(() => setLastConnectedAccountId(null), []);

  // ✅ NOVO: Enviar convite para uma conta específica
  const sendInviteForAccount = useCallback(async (accountId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/accounts/whatsapp/${accountId}/send-invite`, {
        method: 'POST',
        headers
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao enviar convite');
      }

      if (!options?.disableErrorToasts) {
        toast({
          title: "Convite enviado",
          description: `Convite enviado com sucesso para ${result.user?.name || 'o usuário'}.`,
        });
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao enviar convite:', error);

      if (!options?.disableErrorToasts) {
        toast({
          title: "Erro ao enviar convite",
          description: error.message || "Não foi possível enviar o convite.",
          variant: "destructive",
        });
      }

      throw error;
    }
  }, [toast, options?.disableErrorToasts]);

  return {
    accounts,
    loading,
    sendingReconnectEmails,
    initialLoading,
    qrCode,
    qrTimer,
    createAccount,
    connectAccount,
    disconnectAccount,
    disconnectAllAccounts,
    deleteAccount,
    updateAccount,
    reconnectAllAccounts,
    sendReconnectEmails,
    regenerateQRCode,
    fetchAccounts,
    sendInviteForAccount, // ✅ NOVO
    // ✅ CORREÇÃO: Removido socket - usar socketManager.getSocket() se necessário
    socket: socketManager.getSocket(),
    // ✅ NOVO: Expor estados de controle
    reconnectingAccounts,
    lastReconnectAttempt,
    pendingReconnectEmails,
    lastConnectedAccountId,
    clearLastConnectedAccount
  };
};
