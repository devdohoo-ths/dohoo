import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Volume2, Settings } from 'lucide-react';
import { useChatNotifications } from '@/hooks/chat/useChatNotifications';

interface NotificationButtonProps {
  onOpenSettings?: () => void;
}

export const NotificationButton: React.FC<NotificationButtonProps> = ({ 
  onOpenSettings 
}) => {
  const { getSettings, updateNotificationSettings } = useChatNotifications();
  const [isOpen, setIsOpen] = useState(false);
  
  const settings = getSettings();

  const toggleSound = () => {
    updateNotificationSettings({ soundEnabled: !settings.soundEnabled });
  };

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  // ✅ ADICIONADO: Função para testar o som
  const testSound = () => {
    console.log('🔊 [Test] Testando som de notificação...');
    
    try {
      const audio = new Audio('/sounds/new-message.mp3');
      audio.volume = 0.6;
      
      audio.addEventListener('loadstart', () => console.log('🔊 [Test] Carregando som...'));
      audio.addEventListener('canplay', () => console.log('🔊 [Test] Som pronto para tocar'));
      audio.addEventListener('play', () => console.log(' [Test] Som tocando'));
      audio.addEventListener('ended', () => console.log('🔊 [Test] Som terminou'));
      audio.addEventListener('error', (e) => console.error('🔊 [Test] Erro:', e));
      
      audio.play().catch(error => {
        console.error('🔊 [Test] Erro ao tocar som:', error);
      });
    } catch (error) {
      console.error('🔊 [Test] Erro ao criar áudio:', error);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* ✅ MODIFICADO: Botão principal agora abre as configurações */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpenSettings}
        className="relative"
        title="Configurações de notificação"
      >
        <Settings className="h-4 w-4" />
      </Button>
      
      {/* ✅ ADICIONADO: Botão secundário para alternar som rapidamente */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSound}
        className="relative"
        title={settings.soundEnabled ? "Desativar som" : "Ativar som"}
      >
        {settings.soundEnabled ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </Button>
      
      {/* ✅ ADICIONADO: Botão de teste */}
      {/* <Button
        variant="ghost"
        size="sm"
        onClick={testSound}
        className="relative"
        title="Testar som"
      >
        <Volume2 className="h-4 w-4" />
      </Button> */}
    </div>
  );
};
