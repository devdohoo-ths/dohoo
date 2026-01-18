import { useEffect, useRef, useCallback } from 'react';

interface NotificationSettings {
  soundEnabled: boolean;
  browserNotifications: boolean;
  urgentOnly: boolean;
}

export const useChatNotifications = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMessageIdRef = useRef<string>('');
  const settingsRef = useRef<NotificationSettings>({
    soundEnabled: true,
    browserNotifications: false,
    urgentOnly: false
  });

  // ✅ INICIALIZAR: Som de notificação
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/new-message.mp3');
      audioRef.current.volume = 0.5;
      audioRef.current.preload = 'auto';
    } catch (error) {
      console.error('❌ [Notifications] Erro ao inicializar som:', error);
    }

    // ✅ CARREGAR: Configurações salvas
    const savedSettings = localStorage.getItem('dohoo_notification_settings');
    if (savedSettings) {
      try {
        settingsRef.current = { ...settingsRef.current, ...JSON.parse(savedSettings) };
      } catch (error) {
        console.warn('⚠️ [Notifications] Erro ao carregar configurações:', error);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // ✅ NOTIFICAR: Apenas som para nova mensagem
  const notifyNewMessage = useCallback((messageId: string) => {
    // ✅ EVITAR: Notificações duplicadas
    if (messageId === lastMessageIdRef.current) {
      return;
    }
    
    lastMessageIdRef.current = messageId;

    // ✅ TOCAR: Som se habilitado
    if (settingsRef.current.soundEnabled && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      } catch (error) {
        console.error('❌ [Notifications] Erro ao tocar som:', error);
      }
    }
  }, []);

  // ✅ ATUALIZAR: Configurações
  const updateNotificationSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    settingsRef.current = { ...settingsRef.current, ...newSettings };
    localStorage.setItem('dohoo_notification_settings', JSON.stringify(settingsRef.current));
  }, []);

  // ✅ ADICIONADO: Função para solicitar permissão de notificação
  const requestNotificationPermission = useCallback(async () => {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission;
      }
    } catch (error) {
      console.error('❌ [Notifications] Erro ao solicitar permissão:', error);
    }
  }, []);

  return {
    notifyNewMessage,
    updateNotificationSettings,
    getSettings: () => settingsRef.current,
    requestNotificationPermission
  };
};
