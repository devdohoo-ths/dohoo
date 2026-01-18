import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, CheckCircle, XCircle, Clock, Smartphone, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import io, { Socket } from 'socket.io-client';
import { apiBase } from '@/utils/apiBase';
import { normalizeQrCode, pickQrValue } from '@/utils/qrCode';

interface InviteData {
  id: string; 
  email: string;
  name: string;
  user_role: string;
  permissions: any;
  organization_id: string;
}

const ConnectWhatsApp: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrTimer, setQrTimer] = useState<number>(0);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const listeningAccountIdsRef = useRef<Set<string>>(new Set());
  const connectingRef = useRef(false);
  const qrCodeRef = useRef('');
  const pollingActiveRef = useRef(false); // ✅ NOVO: Flag para controlar se polling está ativo

  useEffect(() => {
    connectingRef.current = connecting;
  }, [connecting]);

  useEffect(() => {
    qrCodeRef.current = qrCode;
  }, [qrCode]);

  useEffect(() => {
    // ✅ CORREÇÃO: Só conectar Socket.IO se tiver token do convite
    if (!token) {
      return;
    }

    let isMounted = true;
    
    // ✅ CORREÇÃO: Passar token do convite na conexão Socket.IO para permitir autenticação via convite
    // Usar tanto query quanto auth para garantir que o token seja recebido
    const newSocket = io(apiBase, {
      query: {
        inviteToken: token
      },
      auth: {
        inviteToken: token
      },
      extraHeaders: {
        'x-invite-token': token
      }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Conectado ao Socket.IO');
      // ✅ CORREÇÃO: Entrar na sala da organização assim que conectar (se invite já estiver disponível)
      // Isso garante que eventos sejam recebidos mesmo após reconexões
      if (invite?.organization_id) {
        console.log('🏢 [Frontend] Entrando na sala da organização após conexão:', invite.organization_id);
        newSocket.emit('join-organization', invite.organization_id);
      }
      // ✅ CRÍTICO: Entrar na sala do usuário para receber eventos whatsapp-connection-success
      if (invite?.user_id) {
        console.log('👤 [Frontend] Entrando na sala do usuário após conexão:', invite.user_id);
        newSocket.emit('join-user', invite.user_id);
      }
    });

    // ✅ NOVO: Listener para reconexão - garantir que sala seja reentrada
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ [Frontend] Socket reconectado após ${attemptNumber} tentativas`);
      // ✅ CORREÇÃO: Reentrar na sala da organização após reconexão
      if (invite?.organization_id) {
        console.log('🏢 [Frontend] Reentrando na sala da organização após reconexão:', invite.organization_id);
        newSocket.emit('join-organization', invite.organization_id);
      }
      // ✅ CRÍTICO: Reentrar na sala do usuário após reconexão
      if (invite?.user_id) {
        console.log('👤 [Frontend] Reentrando na sala do usuário após reconexão:', invite.user_id);
        newSocket.emit('join-user', invite.user_id);
      }
    });

    newSocket.on('whatsapp-qr-code', async (data: { accountId: string; qr?: string; qrCode?: string; code?: string; accountName: string }) => {
      if (!isMounted) {
        return;
      }

      // ✅ CORREÇÃO: Aceitar QR code se accountId corresponde OU se estamos conectando e não temos QR ainda
      const shouldProcess = 
        listeningAccountIdsRef.current.has(data.accountId) || 
        accountId === data.accountId ||
        (connectingRef.current && !qrCodeRef.current);

      if (!shouldProcess) {
        console.log('⚠️ [Frontend] QR Code recebido mas ignorado:', {
          receivedAccountId: data.accountId,
          currentAccountId: accountId,
          isConnecting: connectingRef.current,
          hasQrCode: !!qrCodeRef.current
        });
        return;
      }

      if (!listeningAccountIdsRef.current.has(data.accountId)) {
        console.log('✅ [Frontend] Adotando accountId emitido pelo backend para convite em andamento:', data.accountId);
        listeningAccountIdsRef.current.add(data.accountId);
        setAccountId(data.accountId);
      }

      const rawQrValue = pickQrValue(data);
      const normalized = await normalizeQrCode(rawQrValue);

      if (!normalized) {
        console.warn('⚠️ [Frontend] QR Code recebido sem payload válido:', {
          accountId: data.accountId,
          rawLength: rawQrValue.length,
        });
        return;
      }

      console.log('✅ [Frontend] QR Code recebido via Socket.IO e normalizado:', {
        accountId: data.accountId,
        accountName: data.accountName,
        qrLength: normalized.length,
      });

      // ✅ CORREÇÃO: Parar polling se QR code foi recebido via socket
      pollingActiveRef.current = false; // Parar polling
      setQrCode(normalized);
      setQrTimer(120); // ✅ CORREÇÃO: Atualizado para 120 segundos
      setConnecting(false); // QR code recebido, parar estado de conexão
    });

    newSocket.on('whatsapp-connected', (data: { accountId: string; accountName: string; phoneNumber: string }) => {
      console.log('✅ [Frontend] WhatsApp conectado:', data);
      console.log('🔍 [Frontend] Verificando se deve processar evento:', {
        receivedAccountId: data.accountId,
        currentAccountId: accountId,
        isInListeningSet: listeningAccountIdsRef.current.has(data.accountId),
        listeningAccountIds: Array.from(listeningAccountIdsRef.current),
        isConnecting: connecting
      });
      
      // ✅ CORREÇÃO: Aceitar evento se:
      // 1. accountId está em listeningAccountIds OU
      // 2. accountId corresponde ao accountId atual OU
      // 3. Estamos em processo de conexão (connecting = true)
      const shouldProcess = 
        listeningAccountIdsRef.current.has(data.accountId) || 
        accountId === data.accountId ||
        connecting;
      
      if (shouldProcess) {
        console.log('✅ [Frontend] Processando evento whatsapp-connected');
        setConnected(true);
        setConnecting(false);
        setQrCode('');
        setQrTimer(0);
        listeningAccountIdsRef.current.delete(data.accountId);
        // ✅ CORREÇÃO: Atualizar accountId se necessário
        if (data.accountId && data.accountId !== accountId) {
          console.log(`🔄 [Frontend] Atualizando accountId de ${accountId} para ${data.accountId}`);
          setAccountId(data.accountId);
        }

        toast({
          title: "WhatsApp Conectado",
          description: `Conta conectada com sucesso!`,
        });

        markInviteAsAccepted();
      } else {
        console.log('⚠️ [Frontend] Evento whatsapp-connected ignorado - accountId não corresponde:', {
          received: data.accountId,
          current: accountId,
          listening: Array.from(listeningAccountIdsRef.current),
          connecting: connecting
        });
      }
    });

    // ✅ NOVO: Listener para evento específico de sucesso de convite
    newSocket.on('whatsapp-invite-success', (data: { accountId: string; accountName: string; phoneNumber: string; message: string }) => {
      console.log('✅ [Frontend] WhatsApp invite success:', data);
      console.log('🔍 [Frontend] Verificando se deve processar evento whatsapp-invite-success:', {
        receivedAccountId: data.accountId,
        currentAccountId: accountId,
        isInListeningSet: listeningAccountIdsRef.current.has(data.accountId),
        listeningAccountIds: Array.from(listeningAccountIdsRef.current),
        isConnecting: connecting
      });
      
      // ✅ CORREÇÃO: Aceitar evento se:
      // 1. accountId está em listeningAccountIds OU
      // 2. accountId corresponde ao accountId atual OU
      // 3. Estamos em processo de conexão (connecting = true)
      const shouldProcess = 
        listeningAccountIdsRef.current.has(data.accountId) || 
        accountId === data.accountId ||
        connecting;
      
      if (shouldProcess) {
        console.log('✅ [Frontend] Processando evento whatsapp-invite-success');
        setConnected(true);
        setConnecting(false);
        setQrCode('');
        setQrTimer(0);
        listeningAccountIdsRef.current.delete(data.accountId);
        // ✅ CORREÇÃO: Atualizar accountId se necessário
        if (data.accountId && data.accountId !== accountId) {
          console.log(`🔄 [Frontend] Atualizando accountId de ${accountId} para ${data.accountId}`);
          setAccountId(data.accountId);
        }

        toast({
          title: "WhatsApp Conectado",
          description: data.message || `Conta ${data.accountName} conectada com sucesso!`,
        });

        markInviteAsAccepted();
      } else {
        console.log('⚠️ [Frontend] Evento whatsapp-invite-success ignorado - accountId não corresponde:', {
          received: data.accountId,
          current: accountId,
          listening: Array.from(listeningAccountIdsRef.current),
          connecting: connecting
        });
      }
    });

    // ✅ NOVO: Listener para evento de sucesso de conexão (usado para conexões manuais e convites com userId)
    newSocket.on('whatsapp-connection-success', (data: { accountId: string; accountName: string; phoneNumber: string; message: string }) => {
      console.log('✅✅✅ [Frontend] EVENTO whatsapp-connection-success RECEBIDO:', data);
      console.log('🔍 [Frontend] Verificando se deve processar evento whatsapp-connection-success:', {
        receivedAccountId: data.accountId,
        currentAccountId: accountId,
        isInListeningSet: listeningAccountIdsRef.current.has(data.accountId),
        listeningAccountIds: Array.from(listeningAccountIdsRef.current),
        isConnecting: connecting,
        hasQrCode: !!qrCode,
        hasInvite: !!invite,
        inviteName: invite?.name,
        inviteUserId: invite?.user_id,
        accountName: data.accountName,
        socketConnected: newSocket.connected,
        socketId: newSocket.id
      });
      
      // ✅ CORREÇÃO MELHORADA: Aceitar evento se:
      // 1. accountId está em listeningAccountIds OU
      // 2. accountId corresponde ao accountId atual OU
      // 3. Estamos em processo de conexão (connecting = true) OU
      // 4. Temos QR code ativo (qrCode não vazio) OU
      // 5. O nome da conta corresponde ao invite (se houver invite) OU
      // 6. Estamos na página de conexão com invite e não conectados ainda (mais permissivo)
      const hasActiveQrCode = !!qrCode && qrCode.trim().length > 0;
      const accountNameMatchesInvite = invite && data.accountName && 
        (data.accountName.includes(invite.name) || invite.name.includes(data.accountName.split(' - ')[0]));
      
      // ✅ CORREÇÃO CRÍTICA: Se estamos na página de conexão com invite,
      // aceitar o evento mesmo se o accountId não corresponder (pode ser que o backend tenha usado um ID diferente)
      // Não verificar !connected porque pode haver race condition
      const isOnInvitePage = !!invite && !!token;
      
      const shouldProcess = 
        listeningAccountIdsRef.current.has(data.accountId) || 
        accountId === data.accountId ||
        connecting ||
        hasActiveQrCode ||
        accountNameMatchesInvite ||
        isOnInvitePage; // ✅ MAIS PERMISSIVO: Se estamos na página de invite, aceitar o evento
      
      if (shouldProcess) {
        console.log('✅ [Frontend] Processando evento whatsapp-connection-success', {
          reason: listeningAccountIdsRef.current.has(data.accountId) ? 'accountId em listeningAccountIds' :
                  accountId === data.accountId ? 'accountId corresponde' :
                  connecting ? 'está conectando' :
                  hasActiveQrCode ? 'tem QR code ativo' :
                  accountNameMatchesInvite ? 'nome corresponde ao invite' :
                  isOnInvitePage ? 'está na página de invite' : 'outro'
        });
        setConnected(true);
        setConnecting(false);
        setQrCode('');
        setQrTimer(0);
        // ✅ CORREÇÃO: Atualizar accountId ANTES de deletar do listeningAccountIds
        if (data.accountId && data.accountId !== accountId) {
          console.log(`🔄 [Frontend] Atualizando accountId de ${accountId} para ${data.accountId}`);
          setAccountId(data.accountId);
          // Adicionar o novo accountId ao listeningAccountIds
          listeningAccountIdsRef.current.add(data.accountId);
        }
        // Remover o accountId antigo se for diferente
        if (accountId && accountId !== data.accountId && listeningAccountIdsRef.current.has(accountId)) {
          listeningAccountIdsRef.current.delete(accountId);
        }
        // Remover o accountId atual do listeningAccountIds (conexão bem-sucedida)
        listeningAccountIdsRef.current.delete(data.accountId);

        toast({
          title: "WhatsApp Conectado",
          description: data.message || `Conta ${data.accountName} conectada com sucesso!`,
        });

        console.log('📞 [Frontend] Chamando markInviteAsAccepted...');
        // ✅ CORREÇÃO: Chamar markInviteAsAccepted sem await para não bloquear
        // O useEffect que monitora 'connected' também garantirá o redirecionamento
        markInviteAsAccepted().catch((error) => {
          console.error('❌ [Frontend] Erro ao chamar markInviteAsAccepted:', error);
          // ✅ FALLBACK: Se markInviteAsAccepted falhar, o useEffect com 'connected' ainda redirecionará
        });
        
        // ✅ REMOVIDO: Redireção duplicada (markInviteAsAccepted já faz isso)
      } else {
        console.log('⚠️ [Frontend] Evento whatsapp-connection-success ignorado - accountId não corresponde:', {
          received: data.accountId,
          current: accountId,
          listening: Array.from(listeningAccountIdsRef.current),
          connecting: connecting,
          hasQrCode: hasActiveQrCode,
          accountNameMatchesInvite: accountNameMatchesInvite,
          isOnInvitePage: isOnInvitePage,
          hasInvite: !!invite,
          hasToken: !!token,
          connected: connected,
          accountName: data.accountName,
          inviteName: invite?.name
        });
      }
    });

    newSocket.on('whatsapp-disconnected', (data: { accountId: string; accountName: string; disconnectReason?: number; reason?: string }) => {
      console.log('⚠️ [Frontend] WhatsApp desconectado:', data);
      console.log('🔍 [Frontend] Verificando se deve processar desconexão:', {
        receivedAccountId: data.accountId,
        currentAccountId: accountId,
        isInListeningSet: listeningAccountIdsRef.current.has(data.accountId),
        isConnecting: connecting,
        isConnected: connected,
        disconnectReason: data.disconnectReason,
        reason: data.reason
      });
      
      // ✅ CORREÇÃO: Ignorar desconexão se:
      // 1. Estamos conectados (pode ser um evento antigo)
      // 2. Estamos em processo de conexão E é erro 515 (socket pode estar sendo recriado)
      // 3. AccountId não corresponde
      const shouldIgnore = 
        connected || // Já conectado, ignorar desconexão
        (connecting && data.disconnectReason === 515) || // Erro 515 durante conexão - socket pode estar sendo recriado
        (!listeningAccountIdsRef.current.has(data.accountId) && accountId !== data.accountId); // AccountId não corresponde
      
      if (shouldIgnore) {
        console.log('⏭️ [Frontend] Ignorando evento de desconexão:', {
          reason: connected ? 'já conectado' : 
                  (connecting && data.disconnectReason === 515) ? 'erro 515 durante conexão (socket sendo recriado)' :
                  'accountId não corresponde'
        });
        return;
      }
      
      if (listeningAccountIdsRef.current.has(data.accountId) || accountId === data.accountId) {
        console.log('❌ [Frontend] Processando desconexão');
        setConnecting(false);
        setQrCode('');
        setQrTimer(0);
        listeningAccountIdsRef.current.delete(data.accountId);

        toast({
          title: "WhatsApp Desconectado",
          description: data.reason || `Conexão foi perdida`,
          variant: "destructive",
        });
      }
    });

    newSocket.on('whatsapp-qr-expired', (data: { accountId: string; accountName: string }) => {
      console.log('QR Code expirado:', data);
      if (listeningAccountIdsRef.current.has(data.accountId)) {
        setConnecting(false);
        setQrCode('');
        setQrTimer(0);
        listeningAccountIdsRef.current.delete(data.accountId);
        
        toast({
          title: "QR Code Expirado",
          description: `QR Code expirou. Clique em conectar novamente.`,
          variant: "destructive",
        });
      }
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
    };
  }, [token, toast]);

  // ✅ CORREÇÃO: Entrar na sala da organização e do usuário quando o convite for validado E socket estiver conectado
  useEffect(() => {
    if (invite && socket) {
      const joinOrg = () => {
        console.log('🏢 [Frontend] Entrando na sala da organização:', invite.organization_id);
        socket.emit('join-organization', invite.organization_id);
      };
      
      const joinUser = () => {
        if (invite.user_id) {
          console.log('👤 [Frontend] Entrando na sala do usuário:', invite.user_id);
          socket.emit('join-user', invite.user_id);
        }
      };

      if (socket.connected) {
        joinOrg();
        joinUser();
      } else {
        // ✅ NOVO: Se socket não estiver conectado, aguardar evento 'connect'
        console.log('⏳ [Frontend] Socket não conectado ainda, aguardando evento connect...');
        const onConnect = () => {
          console.log('🏢 [Frontend] Socket conectado, entrando nas salas:', {
            org: invite.organization_id,
            user: invite.user_id
          });
          joinOrg();
          joinUser();
          socket.off('connect', onConnect);
        };
        socket.on('connect', onConnect);
        
        return () => {
          socket.off('connect', onConnect);
        };
      }
    }
  }, [invite, socket]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [qrTimer]);

  useEffect(() => {
    validateToken();
  }, [token]);

  // ✅ NOVO: Monitorar estado connected e garantir redirecionamento
  useEffect(() => {
    if (connected && token && invite) {
      console.log('🔄 [Frontend] Estado connected=true detectado, agendando redirecionamento...');
      const redirectTimer = setTimeout(() => {
        console.log('🚀 [Frontend] Redirecionando devido ao estado connected=true...');
        try {
          navigate('/connections');
          console.log('✅ [Frontend] Redirecionamento executado com sucesso (via useEffect)');
        } catch (navError) {
          console.error('❌ [Frontend] Erro ao executar navigate:', navError);
          // Fallback: usar window.location se navigate falhar
          console.log('🔄 [Frontend] Tentando fallback com window.location...');
          window.location.href = '/connections';
        }
      }, 3000); // 3 segundos para dar tempo do toast aparecer

      return () => {
        clearTimeout(redirectTimer);
      };
    }
  }, [connected, token, invite, navigate]);


  const validateToken = async () => {
    if (!token) {
      setError('Token de convite não fornecido');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/api/invites/whatsapp/validate/${token}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Token inválido');
        setLoading(false);
        return;
      }

      setInvite(result.invite);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao validar token:', error);
      setError('Erro ao validar convite');
      setLoading(false);
    }
  };

  const connectWhatsApp = async () => {
    console.log(`🚀 [Frontend] connectWhatsApp chamado`, { hasInvite: !!invite });
    if (!invite) {
      console.warn(`⚠️ [Frontend] connectWhatsApp abortado - sem invite`);
      return;
    }

    console.log(`🔄 [Frontend] Iniciando conexão WhatsApp...`);
    setConnecting(true);
    
    // ✅ CORREÇÃO: Gerar UUID válido em vez de string customizada
    const newAccountId = crypto.randomUUID();
    console.log(`🆔 [Frontend] Novo accountId gerado: ${newAccountId}`);
    // ✅ NOVO: Atualizar imediatamente para começar a escutar eventos do socket
    setAccountId(newAccountId);
    listeningAccountIdsRef.current.add(newAccountId);

    try {
      const response = await fetch(`${apiBase}/api/accounts/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${invite.name} - WhatsApp`,
          accountId: newAccountId,
          inviteId: invite.id,
          userId: invite.user_id
        }),
      });

      let result: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const nonJsonBody = await response.text();
        console.error('Resposta não JSON ao criar conexão WhatsApp:', {
          status: response.status,
          body: nonJsonBody?.slice(0, 500)
        });
        throw new Error(response.status === 504 
          ? 'Servidor demorou para responder (504). Tente novamente em alguns segundos.'
          : 'Resposta inválida do servidor (sem JSON)');
      }

      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Erro ao conectar WhatsApp');
      }

      console.log(`✅ [Frontend] Resposta da API:`, {
        success: result.success,
        accountId: result.accountId,
        newAccountId,
        resultKeys: Object.keys(result)
      });

      const accountIdFromServer = result.accountId || newAccountId;
      console.log(`🔍 [Frontend] AccountId para polling: ${accountIdFromServer} (original: ${newAccountId})`);
      
      if (accountIdFromServer !== newAccountId) {
        console.log(`🔄 [Frontend] AccountId mudou de ${newAccountId} para ${accountIdFromServer}`);
        setAccountId(accountIdFromServer);
        listeningAccountIdsRef.current.add(accountIdFromServer);
      }

      // ✅ NOVO: Fazer polling para buscar QR Code via HTTP (mais simples que Socket.IO)
      console.log(`🔍 [Frontend] Conta criada, iniciando polling para QR Code. AccountId: ${accountIdFromServer}`);
      console.log(`⏰ [Frontend] Aguardando 5 segundos antes de iniciar polling (dar tempo para QR ser gerado)...`);
      
      // ✅ GARANTIR: Usar accountIdFromServer (pode ser diferente do newAccountId)
      const finalAccountId = accountIdFromServer;
      console.log(`🆔 [Frontend] AccountId final para polling: ${finalAccountId}`);
      
      const pollQRCode = async () => {
        try {
          console.log(`🔄 [Frontend] pollQRCode iniciado com accountId: ${finalAccountId}`);
          pollingActiveRef.current = true; // ✅ NOVO: Marcar polling como ativo
          
          // ✅ CORREÇÃO: Aumentar tentativas e tempo total para dar mais tempo ao backend gerar QR code
          // QR code pode levar até 60-90 segundos para ser gerado (download versão WhatsApp, inicialização socket, etc)
          const maxAttempts = 45; // ✅ AUMENTADO: 45 tentativas (90 segundos de polling + 5s inicial = ~95s total)
          let attempts = 0;
          
          const poll = async () => {
            // ✅ NOVO: Verificar se polling foi cancelado (QR code recebido via socket)
            if (!pollingActiveRef.current) {
              console.log('✅ [Frontend] Polling cancelado - QR code recebido via Socket.IO');
              return;
            }
            
            try {
              const qrUrl = `${apiBase}/api/accounts/whatsapp/${finalAccountId}/qr`;
              // ✅ REDUZIDO: Logs menos verbosos (apenas a cada 5 tentativas)
              if (attempts % 5 === 0) {
                console.log(`🔄 [Frontend] Tentativa ${attempts + 1}/${maxAttempts} - Buscando QR Code`);
              }
            
              const qrResponse = await fetch(qrUrl);
              
              // ✅ CORREÇÃO: Tratar 404 como "ainda não disponível", não como erro
              if (qrResponse.status === 404) {
                attempts++;
                if (attempts < maxAttempts) {
                  // ✅ CORREÇÃO: Intervalo progressivo - começar com 1s, depois 2s após 10 tentativas
                  const delay = attempts <= 10 ? 1000 : 2000;
                  if (attempts % 10 === 0) {
                    console.log(`⏳ [Frontend] QR Code ainda não disponível. Tentativa ${attempts}/${maxAttempts}. Aguardando ${delay}ms...`);
                  }
                  setTimeout(poll, delay);
                } else {
                  console.warn(`⚠️ [Frontend] QR Code não foi gerado a tempo após ${maxAttempts} tentativas (~${Math.round((maxAttempts * 1.5 + 5))}s)`);
                  setConnecting(false);
                  toast({
                    title: "Timeout",
                    description: "QR Code não foi gerado a tempo. O processo pode estar demorando mais que o esperado. Tente novamente.",
                    variant: "destructive",
                  });
                }
                return;
              }
              
              // ✅ NOVO: Tratar rate limit (429)
              if (qrResponse.status === 429) {
                const retryAfter = 3; // Aguardar 3 segundos se rate limited
                console.log(`⏳ [Frontend] Rate limit atingido. Aguardando ${retryAfter} segundos...`);
                attempts++;
                if (attempts < maxAttempts) {
                  setTimeout(poll, retryAfter * 1000);
                } else {
                  setConnecting(false);
                  toast({
                    title: "Muitas tentativas",
                    description: "Aguarde alguns segundos antes de tentar novamente.",
                    variant: "destructive",
                  });
                }
                return;
              }
              
              // Se não for 404 ou 429, tentar parsear JSON
              if (!qrResponse.ok) {
                throw new Error(`HTTP ${qrResponse.status}: ${qrResponse.statusText}`);
              }
              
              const qrResult = await qrResponse.json();
              
              if (qrResult.success && qrResult.qrCode) {
                console.log('✅ [Frontend] QR Code obtido via HTTP!');
                pollingActiveRef.current = false; // ✅ NOVO: Parar polling ao obter QR code
                setQrCode(qrResult.qrCode);
                setQrTimer(120);
                setConnecting(false); // QR code obtido, parar estado de conexão
                return; // Sucesso!
              }
              
              attempts++;
              if (attempts < maxAttempts) {
                // ✅ CORREÇÃO: Intervalo progressivo - começar com 1s, depois 2s após 10 tentativas
                const delay = attempts <= 10 ? 1000 : 2000;
                setTimeout(poll, delay);
              } else {
                console.warn(`⚠️ [Frontend] QR Code não foi gerado a tempo após ${maxAttempts} tentativas (~${Math.round((maxAttempts * 1.5 + 5))}s)`);
                setConnecting(false);
                toast({
                  title: "Timeout",
                  description: "QR Code não foi gerado a tempo. O processo pode estar demorando mais que o esperado. Tente novamente.",
                  variant: "destructive",
                });
              }
            } catch (error: any) {
              console.error(`❌ [Frontend] Erro ao buscar QR Code (tentativa ${attempts + 1}):`, error);
              attempts++;
              if (attempts < maxAttempts) {
                // ✅ CORREÇÃO: Intervalo progressivo - começar com 1s, depois 2s após 10 tentativas
                const delay = attempts <= 10 ? 1000 : 2000;
                setTimeout(poll, delay);
              } else {
                setConnecting(false);
                toast({
                  title: "Erro",
                  description: error?.message || "Não foi possível obter o QR Code após várias tentativas.",
                  variant: "destructive",
                });
              }
            }
          };
          
          // ✅ CORREÇÃO: Aumentar tempo inicial para dar mais tempo ao backend gerar QR code
          // O backend precisa: criar socket Baileys, baixar versão WhatsApp (se necessário), inicializar, gerar QR
          console.log(`⏰ [Frontend] Configurando polling para iniciar em 5 segundos (dar tempo ao backend gerar QR code)...`);
          setTimeout(() => {
            poll();
          }, 5000);
        } catch (error: any) {
          console.error(`❌ [Frontend] Erro ao configurar polling:`, error);
          console.error(`❌ [Frontend] Stack trace:`, error?.stack);
          setConnecting(false);
          toast({
            title: "Erro",
            description: "Erro ao configurar polling do QR Code.",
            variant: "destructive",
          });
        }
      };
      
      console.log(`🚀 [Frontend] Chamando pollQRCode()...`);
      pollQRCode();

    } catch (error: any) {
      console.error('❌ [Frontend] Erro ao conectar WhatsApp:', error);
      console.error('❌ [Frontend] Stack trace:', error?.stack);
      console.error('❌ [Frontend] Error details:', {
        message: error?.message,
        name: error?.name,
        cause: error?.cause
      });
      setConnecting(false);
      listeningAccountIdsRef.current.delete(newAccountId);
      setAccountId('');
      toast({
        title: "Erro",
        description: error?.message === 'Failed to fetch'
          ? 'Não foi possível se comunicar com o servidor. Verifique sua conexão e tente novamente.'
          : (error?.message || "Falha ao conectar WhatsApp"),
        variant: "destructive",
      });
    }
  };

  const markInviteAsAccepted = async () => {
    console.log('🔄 [Frontend] markInviteAsAccepted chamado', { token, hasNavigate: !!navigate });
    try {
      const response = await fetch(`${apiBase}/api/invites/whatsapp/${token}/accept`, {
        method: 'POST',
      });
      
      console.log('✅ [Frontend] Resposta ao marcar convite como aceito:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      // ✅ CORREÇÃO: Usar navigate do React Router em vez de window.location.href
      // Redirecionar para /connections após 2 segundos para dar tempo do toast aparecer
      console.log('⏰ [Frontend] Agendando redirecionamento para /connections em 2 segundos...');
      setTimeout(() => {
        console.log('🚀 [Frontend] Executando redirecionamento para /connections...');
        try {
          navigate('/connections');
          console.log('✅ [Frontend] Redirecionamento executado com sucesso');
        } catch (navError) {
          console.error('❌ [Frontend] Erro ao executar navigate:', navError);
          // Fallback: usar window.location se navigate falhar
          console.log('🔄 [Frontend] Tentando fallback com window.location...');
          window.location.href = '/connections';
        }
      }, 2000);
    } catch (error) {
      console.error('❌ [Frontend] Erro ao marcar convite como aceito:', error);
      // ✅ CORREÇÃO: Mesmo com erro na API, redirecionar após 2 segundos
      console.log('⏰ [Frontend] Erro na API, mas agendando redirecionamento mesmo assim...');
      setTimeout(() => {
        console.log('🚀 [Frontend] Executando redirecionamento após erro na API...');
        try {
          navigate('/connections');
          console.log('✅ [Frontend] Redirecionamento executado com sucesso (após erro)');
        } catch (navError) {
          console.error('❌ [Frontend] Erro ao executar navigate:', navError);
          // Fallback: usar window.location se navigate falhar
          console.log('🔄 [Frontend] Tentando fallback com window.location...');
          window.location.href = '/connections';
        }
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg">Validando convite...</p>
            <p className="text-sm text-muted-foreground mt-2">Aguarde um momento</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Convite Inválido</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/')} variant="outline">
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Conectado com Sucesso!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Seu WhatsApp foi conectado com sucesso. Você será redirecionado em alguns segundos...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <Button 
              onClick={() => {
                console.log('🚀 [Frontend] Botão de redirecionamento manual clicado');
                navigate('/connections', { replace: true });
              }}
              className="mt-4"
            >
              Ir para Conexões Agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle>Conectar WhatsApp</CardTitle>
            <p className="text-muted-foreground">
              Olá <strong>{invite?.name}</strong>! Vamos conectar seu WhatsApp à plataforma.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                <span className="text-blue-900">Informações do Convite</span>
              </div>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Email:</strong> {invite?.email}</p>
                <p><strong>Função:</strong> {invite?.user_role}</p>
                <p><strong>Status:</strong> Convite válido</p>
              </div>
            </div>

            {qrCode ? (
              <div className="text-center space-y-4">
                <div className="bg-white p-6 rounded-2xl mx-auto w-fit shadow-lg">
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64 rounded-lg"
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-lg">Escaneie o QR Code</p>
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp no seu telefone e escaneie este código
                  </p>
                  <div className="flex items-center justify-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                    <Clock size={20} />
                    <span className="font-mono text-xl">
                      {Math.floor(qrTimer / 60)}:{(qrTimer % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O QR Code expira em 60 segundos
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Button 
                  onClick={connectWhatsApp}
                  disabled={connecting}
                  size="lg"
                  className="w-full"
                >
                  {connecting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Gerando QR Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-5 h-5 mr-2" />
                      Conectar WhatsApp
                    </>
                  )}
                </Button>
                
                <p className="text-sm text-muted-foreground mt-4">
                  Clique no botão acima para gerar o QR Code e conectar seu WhatsApp
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default ConnectWhatsApp; 