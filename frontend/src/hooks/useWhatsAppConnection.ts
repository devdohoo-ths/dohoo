
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import io from 'socket.io-client';

interface WhatsAppStatus {
  status: 'connected' | 'disconnected' | 'connecting';
  qrCode?: string;
  phoneNumber?: string;
}

export const useWhatsAppConnection = () => {
  const [socket, setSocket] = useState<any>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    status: 'disconnected'
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Conectar com o backend Socket.IO
  const connectSocket = useCallback(async () => {
    // Obter token de autenticação
    const headers = await getAuthHeaders();
    const accessToken = headers['Authorization']?.replace('Bearer ', '') || 
                      JSON.parse(localStorage.getItem('auth_session') || '{}')?.access_token;
    
    if (!accessToken) {
      console.error('❌ [WhatsApp Connection] Token não encontrado');
      return null;
    }

    const newSocket = io(apiBase, {
      transports: ['websocket', 'polling'],
      auth: {
        token: accessToken
      },
      extraHeaders: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    newSocket.on('connect', () => {
      console.log('Conectado ao servidor Socket.IO');
      setSocket(newSocket);
    });

    newSocket.on('qr-code', (data: { qr: string }) => {
      console.log('QR Code recebido');
      setWhatsappStatus(prev => ({ ...prev, qrCode: data.qr, status: 'connecting' }));
    });

    newSocket.on('whatsapp-connected', () => {
      console.log('WhatsApp conectado');
      setWhatsappStatus(prev => ({ ...prev, status: 'connected', qrCode: undefined }));
      toast({
        title: "WhatsApp Conectado",
        description: "WhatsApp foi conectado com sucesso!",
      });
    });

    newSocket.on('whatsapp-disconnected', () => {
      console.log('WhatsApp desconectado');
      setWhatsappStatus(prev => ({ ...prev, status: 'disconnected', qrCode: undefined }));
      toast({
        title: "WhatsApp Desconectado",
        description: "A conexão com WhatsApp foi perdida",
        variant: "destructive",
      });
    });

    // ✅ REMOVIDO: Lógica de criar chats/mensagens agora é feita pelo backend via Socket.IO
    // O backend já processa as mensagens recebidas e cria chats/mensagens automaticamente
    newSocket.on('new-whatsapp-message', async (messageData: any) => {
      console.log('Nova mensagem WhatsApp recebida (processada pelo backend):', messageData);
      toast({
        title: "Nova Mensagem",
        description: `Mensagem recebida de ${messageData.from?.split('@')[0] || 'Contato'}`,
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Desconectado do servidor Socket.IO');
      setSocket(null);
    });

    return newSocket;
  }, [toast]);

  // Verificar status do WhatsApp
  const checkWhatsAppStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/whatsapp/status`);
      const data = await response.json();
      
      setWhatsappStatus(prev => ({
        ...prev,
        status: data.status === 'connected' ? 'connected' : 'disconnected'
      }));
    } catch (error) {
      console.error('Erro ao verificar status WhatsApp:', error);
    }
  }, []);

  // Enviar mensagem via WhatsApp
  const sendWhatsAppMessage = useCallback(async (to: string, message: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${apiBase}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, message }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Mensagem Enviada",
          description: "Mensagem enviada via WhatsApp com sucesso",
        });
        return true;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem via WhatsApp",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ✅ REMOVIDO: Salvamento de sessão agora é feito pelo backend
  // A sessão é gerenciada automaticamente pelo backend via Socket.IO
  const saveWhatsAppSession = useCallback(async () => {
    // Sessões são gerenciadas pelo backend
    console.log('📝 Status WhatsApp atualizado (gerenciado pelo backend):', whatsappStatus.status);
  }, [whatsappStatus]);

  // Inicializar conexão
  useEffect(() => {
    const setupConnection = async () => {
      const newSocket = await connectSocket();
      if (newSocket) {
        setSocket(newSocket);
        checkWhatsAppStatus();
      }
    };

    setupConnection();

    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, []); // Executar apenas uma vez na montagem

  // Salvar mudanças de status
  useEffect(() => {
    if (whatsappStatus.status !== 'disconnected') {
      saveWhatsAppSession();
    }
  }, [whatsappStatus, saveWhatsAppSession]);

  return {
    socket,
    whatsappStatus,
    loading,
    sendWhatsAppMessage,
    checkWhatsAppStatus,
    connectSocket
  };
};
