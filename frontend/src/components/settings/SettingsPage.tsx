
import React from 'react';
import { User, Bell, Shield, Palette, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SettingsPage = () => {
  console.log('SettingsPage: Renderizando página de configurações');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências do sistema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Perfil</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <div className="mt-1 p-2 bg-muted rounded">Admin User</div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="mt-1 p-2 bg-muted rounded">admin@empresa.com</div>
            </div>
            <Button>Editar Perfil</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <span>Notificações</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">Notificações por Email</Label>
              <Switch id="email-notifications" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="push-notifications">Notificações Push</Label>
              <Switch id="push-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="chat-sounds">Sons do Chat</Label>
              <Switch id="chat-sounds" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Privacidade</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="two-factor">Autenticação em Duas Etapas</Label>
              <Switch id="two-factor" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="activity-log">Log de Atividades</Label>
              <Switch id="activity-log" defaultChecked />
            </div>
            <Button variant="outline">Alterar Senha</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Palette className="w-5 h-5" />
              <span>Aparência</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tema</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <input type="radio" id="light" name="theme" />
                  <Label htmlFor="light">Claro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="dark" name="theme" />
                  <Label htmlFor="dark">Escuro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="auto" name="theme" defaultChecked />
                  <Label htmlFor="auto">Automático</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
