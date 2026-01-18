import { useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ChatData } from '@/types/chat';

interface NotificationSound {
  newMessage: HTMLAudioElement;
  notification: HTMLAudioElement;
}

export const useChatNotifications = () => {
  const { toast } = useToast();
  const audioRef = useRef<NotificationSound | null>(null);
  const lastNotificationRef = useRef<Set<string>>(new Set());

  // ✅ INICIALIZAR: Sons de notificação
  useEffect(() => {
    audioRef.current = {
      newMessage: new Audio('/sounds/new-message.mp3'),
      notification: new Audio('/sounds/notification.mp3')
    };

    // ✅ CONFIGURAR: Volume e preload
    Object.values(audioRef.current).forEach(audio => {
      audio.volume = 0.5;
      audio.preload = 'auto';
    });

    return () => {
      if (audioRef.current) {
        Object.values(audioRef.current).forEach(audio => {
          audio.pause();
          audio.src = '';
        });
      }
    };
  }, []);

  // ✅ NOTIFICAR: Nova mensagem
  const notifyNewMessage = useCallback((chat: ChatData, message: any) => {
    const notificationId = `${chat.id}-${message.id}`;
    
    // ✅ EVITAR: Notificações duplicadas
    if (lastNotificationRef.current.has(notificationId)) {
      return;
    }
    lastNotificationRef.current.add(notificationId);

    // ✅ LIMPAR: Notificações antigas (manter apenas últimas 50)
    if (lastNotificationRef.current.size > 50) {
      const firstKey = lastNotificationRef.current.values().next().value;
      lastNotificationRef.current.delete(firstKey);
    }

    // ✅ TOCAR: Som de nova mensagem
    if (audioRef.current?.newMessage) {
      audioRef.current.newMessage.play().catch(console.error);
    }

    // ✅ MOSTRAR: Toast notification (sem JSX inline)
    toast({
      title: `Nova mensagem de ${chat.name}`,
      description: message.content?.substring(0, 100) || 'Nova mensagem recebida',
      duration: 5000
    });

    // ✅ NOTIFICAÇÃO: Browser notification (se permitido)
    if (Notification.permission === 'granted') {
      new Notification(`Nova mensagem - ${chat.name}`, {
        body: message.content?.substring(0, 100) || 'Nova mensagem recebida',
        icon: '/favicon.ico',
        tag: notificationId,
        requireInteraction: false
      });
    }
  }, [toast]);

  // ✅ NOTIFICAR: Chat não lido
  const notifyUnreadChat = useCallback((chat: ChatData) => {
    const notificationId = `unread-${chat.id}`;
    
    if (lastNotificationRef.current.has(notificationId)) {
      return;
    }
    lastNotificationRef.current.add(notificationId);

    // ✅ TOCAR: Som de notificação
    if (audioRef.current?.notification) {
      audioRef.current.notification.play().catch(console.error);
    }

    // ✅ MOSTRAR: Toast para chat não lido (sem JSX inline)
    toast({
      title: `Chat não lido: ${chat.name}`,
      description: `${chat.unread_count || 0} mensagens não lidas`,
      duration: 3000
    });
  }, [toast]);

  // ✅ SOLICITAR: Permissão de notificação
  const requestNotificationPermission = useCallback(async () => {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('🔔 Permissão de notificação:', permission);
    }
  }, []);

  // ✅ CONFIGURAR: Notificações ao carregar
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  return {
    notifyNewMessage,
    notifyUnreadChat,
    requestNotificationPermission
  };
};
