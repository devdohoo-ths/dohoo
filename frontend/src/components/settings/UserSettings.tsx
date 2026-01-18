
import React, { useState } from 'react';
import { User, Bell, Lock, MessageCircle, Palette, Globe, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const UserSettings = () => {
  const [settings, setSettings] = useState({
    profile: {
      name: 'Admin User',
      email: 'admin@chatflow.com',
      department: 'Suporte',
      role: 'admin'
    },
    preferences: {
      theme: 'light',
      language: 'pt',
      notifications: {
        email: true,
        push: true,
        sound: false,
        desktop: true
      },
      privacy: {
        showOnlineStatus: true,
        allowDirectMessages: true
      },
      chat: {
        autoReply: false,
        showTypingIndicator: true,
        messagePreview: true
      }
    }
  });

  const handleSave = () => {
    console.log('Salvando configurações:', settings);
    // Aqui implementaria a lógica de salvamento
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Configurações do Usuário</h1>
          <p className="text-muted-foreground">Gerencie suas preferências e configurações</p>
        </div>
        <Button onClick={handleSave} className="flex items-center space-x-2">
          <Save size={16} />
          <span>Salvar Alterações</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User size={20} />
              <span>Perfil</span>
            </CardTitle>
            <CardDescription>
              Informações básicas do seu perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xl">
                A
              </div>
              <Button variant="outline" size="sm">Alterar Foto</Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={settings.profile.name}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  profile: { ...prev.profile, name: e.target.value }
                }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.profile.email}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  profile: { ...prev.profile, email: e.target.value }
                }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Input
                id="department"
                value={settings.profile.department}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  profile: { ...prev.profile, department: e.target.value }
                }))}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant={settings.profile.role === 'admin' ? 'default' : 'secondary'}>
                {settings.profile.role === 'admin' ? 'Administrador' : 'Usuário'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Preferências */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Palette size={20} />
              <span>Preferências</span>
            </CardTitle>
            <CardDescription>
              Configurações de aparência e idioma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tema</Label>
              <Select value={settings.preferences.theme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="auto">Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={settings.preferences.language}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell size={20} />
              <span>Notificações</span>
            </CardTitle>
            <CardDescription>
              Configure como deseja receber notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">Receber notificações por email</p>
              </div>
              <Switch
                checked={settings.preferences.notifications.email}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      notifications: { ...prev.preferences.notifications, email: checked }
                    }
                  }))
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Push</Label>
                <p className="text-sm text-muted-foreground">Notificações push no navegador</p>
              </div>
              <Switch
                checked={settings.preferences.notifications.push}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      notifications: { ...prev.preferences.notifications, push: checked }
                    }
                  }))
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Som</Label>
                <p className="text-sm text-muted-foreground">Sons de notificação</p>
              </div>
              <Switch
                checked={settings.preferences.notifications.sound}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      notifications: { ...prev.preferences.notifications, sound: checked }
                    }
                  }))
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Desktop</Label>
                <p className="text-sm text-muted-foreground">Notificações na área de trabalho</p>
              </div>
              <Switch
                checked={settings.preferences.notifications.desktop}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      notifications: { ...prev.preferences.notifications, desktop: checked }
                    }
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle size={20} />
              <span>Chat</span>
            </CardTitle>
            <CardDescription>
              Configurações de comportamento do chat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Resposta Automática</Label>
                <p className="text-sm text-muted-foreground">Ativar respostas automáticas</p>
              </div>
              <Switch
                checked={settings.preferences.chat.autoReply}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      chat: { ...prev.preferences.chat, autoReply: checked }
                    }
                  }))
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Indicador de Digitação</Label>
                <p className="text-sm text-muted-foreground">Mostrar quando estou digitando</p>
              </div>
              <Switch
                checked={settings.preferences.chat.showTypingIndicator}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      chat: { ...prev.preferences.chat, showTypingIndicator: checked }
                    }
                  }))
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Preview de Mensagens</Label>
                <p className="text-sm text-muted-foreground">Mostrar preview das mensagens</p>
              </div>
              <Switch
                checked={settings.preferences.chat.messagePreview}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      chat: { ...prev.preferences.chat, messagePreview: checked }
                    }
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserSettings;
