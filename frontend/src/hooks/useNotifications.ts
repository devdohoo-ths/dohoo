import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import io, { Socket } from 'socket.io-client';
import { getCurrentApiBase, getAuthHeaders } from '@/utils/apiBase';

export interface Notification {
  id: string;
  type: 'disconnect' | 'rule';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: {
    accountId?: string;
    accountName?: string;
    ruleId?: string;
    ruleName?: string;
    keyword?: string;
    chatId?: string;
  };
}

export const useNotifications = () => {
  const { profile } = useAuth();
  const { organization } = useOrganization();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Contar notificações não lidas
  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  // Configurar Socket.IO
  useEffect(() => {
    if (!profile?.id || !profile?.organization_id) return;

    let isMounted = true;
    let currentSocket: Socket | null = null;
    const socketUrl = getCurrentApiBase();
    
    // ✅ CORREÇÃO: Obter token de autenticação antes de criar socket
    const setupSocket = async () => {
      try {
        // Obter token do localStorage (via getAuthHeaders)
        const headers = await getAuthHeaders();
        const accessToken = headers['Authorization']?.replace('Bearer ', '') || 
                          JSON.parse(localStorage.getItem('auth_session') || '{}')?.access_token;
        
        if (!accessToken) {
          console.error('❌ [Notifications] Token de autenticação não encontrado');
          return;
        }

        const newSocket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: true,
          auth: {
            token: accessToken
          },
          extraHeaders: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        currentSocket = newSocket;

        newSocket.on('connect', () => {
          if (!isMounted) return;
          newSocket.emit('join-organization', profile.organization_id);
        });

        newSocket.on('connect_error', (error) => {
          console.error('❌ [Notifications] Erro de conexão Socket.IO:', error);
        });

        // Escutar desconexão manual
        newSocket.on('whatsapp-disconnected', (data: { 
      accountId: string; 
      accountName: string;
      reason?: string;
      disconnectReason?: number;
      attemptCount?: number;
      isManual?: boolean; // ✅ NOVO: Flag explícita do backend
    }) => {
      if (!isMounted) return;

      // ✅ CORREÇÃO: Verificar se é admin ou super_admin antes de mostrar notificação
      const userRole = profile?.user_role || profile?.role_name || profile?.roles?.name || '';
      const normalizedRole = userRole.toString().toLowerCase().trim();
      const isAdmin = normalizedRole === 'admin' || normalizedRole === 'super_admin' || normalizedRole.includes('admin');

      // Se não for admin, não mostrar notificação
      if (!isAdmin) {
        return;
      }

      // ✅ CORREÇÃO: Verificar se foi desconexão manual
      // Priorizar flag isManual do backend, depois verificar reason e disconnectReason
      const reasonLower = data.reason?.toLowerCase() || '';
      const isManual = 
        data.isManual === true || // ✅ NOVO: Usar flag explícita do backend primeiro
        reasonLower.includes('manual') ||
        reasonLower.includes('desconexão manual') ||
        reasonLower.includes('desconexao manual') ||
        data.disconnectReason === 401; // loggedOut

      // ✅ NOVO: Mostrar notificação para TODAS as desconexões para admins
      // Mas com mensagem diferente para desconexões manuais vs automáticas
      const disconnectMessage = isManual
        ? `O número ${data.accountName} foi desconectado manualmente`
        : `O número ${data.accountName} foi desconectado${data.reason ? `: ${data.reason}` : ''}`;

      const notification: Notification = {
        id: `disconnect-${data.accountId}-${Date.now()}`,
        type: 'disconnect',
        title: 'WhatsApp Desconectado',
        message: disconnectMessage,
        timestamp: new Date(),
        read: false,
        data: {
          accountId: data.accountId,
          accountName: data.accountName
        }
      };

          setNotifications(prev => [notification, ...prev]);
        });

        // Escutar regras acionadas
        newSocket.on('rule-triggered', (data: {
          ruleId: string;
          ruleName: string;
          keyword: string;
          chatId: string;
          customerName?: string;
          organizationId: string;
        }) => {
          if (!isMounted) return;
          
          // ✅ CORREÇÃO: Verificar se a organização corresponde
          if (data.organizationId !== profile.organization_id) {
            return;
          }

          // ✅ MELHORADO: Mensagem mais informativa incluindo nome do cliente
          const customerInfo = data.customerName ? ` no chat com ${data.customerName}` : '';
          const notification: Notification = {
            id: `rule-${data.ruleId}-${Date.now()}`,
            type: 'rule',
            title: 'Palavra Monitorada Detectada',
            message: `A palavra "${data.keyword}" da regra "${data.ruleName}" foi detectada${customerInfo}`,
            timestamp: new Date(),
            read: false,
            data: {
              ruleId: data.ruleId,
              ruleName: data.ruleName,
              keyword: data.keyword,
              chatId: data.chatId
            }
          };

          setNotifications(prev => [notification, ...prev]);
        });

        setSocket(newSocket);
      } catch (error) {
        console.error('❌ [Notifications] Erro ao configurar socket:', error);
      }
    };

    setupSocket();

    // Cleanup function
    return () => {
      isMounted = false;
      if (currentSocket) {
        currentSocket.disconnect();
        currentSocket = null;
      }
      setSocket(null);
    };
  }, [profile?.id, profile?.organization_id, profile]);

  // Marcar notificação como lida
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Remover notificação
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification
  };
};




