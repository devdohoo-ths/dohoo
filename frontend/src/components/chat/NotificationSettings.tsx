import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { useChatNotifications } from '@/hooks/chat/useChatNotifications';

interface NotificationSettingsProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  open,
  onClose
}) => {
  const { updateNotificationSettings, getSettings, requestNotificationPermission } = useChatNotifications();
  const [settings, setSettings] = useState(getSettings());

  useEffect(() => {
    setSettings(getSettings());
  }, [open, getSettings]);

  const handleSettingChange = (key: string, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    updateNotificationSettings(newSettings);
  };

  const handleRequestPermission = async () => {
    await requestNotificationPermission();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Notificação
          </DialogTitle>
          <DialogDescription>
            Configure como você deseja receber notificações de mensagens
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Som */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                Som de Notificação
              </Label>
              <p className="text-sm text-muted-foreground">
                Tocar som quando receber novas mensagens
              </p>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
            />
          </div>

          {/* Notificações do Navegador */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notificações do Navegador
              </Label>
              <p className="text-sm text-muted-foreground">
                Mostrar notificações na área de trabalho
              </p>
            </div>
            <Switch
              checked={settings.browserNotifications}
              onCheckedChange={(checked) => handleSettingChange('browserNotifications', checked)}
            />
          </div>

          {/* Apenas Urgentes */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Apenas Urgentes
              </Label>
              <p className="text-sm text-muted-foreground">
                Notificar apenas mensagens urgentes/importantes
              </p>
            </div>
            <Switch
              checked={settings.urgentOnly}
              onCheckedChange={(checked) => handleSettingChange('urgentOnly', checked)}
            />
          </div>

          {/* Permissão */}
          {Notification.permission !== 'granted' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-yellow-800">
                    Permissão de Notificação Necessária
                  </h4>
                  <p className="text-sm text-yellow-700">
                    Para receber notificações, você precisa permitir o acesso.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRequestPermission}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Permitir Notificações
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Status da Permissão */}
          <div className="text-sm text-muted-foreground">
            Status: {Notification.permission === 'granted' ? '✅ Permitido' : 
                    Notification.permission === 'denied' ? '❌ Negado' : '⏳ Pendente'}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
