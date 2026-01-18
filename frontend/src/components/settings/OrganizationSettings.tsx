import React, { useState, useEffect } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface OrganizationSettings {
  disabledModules?: string[];
  features?: {
    automation?: boolean;
    advancedSettings?: boolean;
    marketplace?: boolean;
    aiPlayground?: boolean;
  };
  proxy?: string | null;
}

export const OrganizationSettings = () => {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [settings, setSettings] = useState<OrganizationSettings>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;
    fetchSettings();
  }, [organization?.id]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/organizations/${organization.id}/settings`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || {
          disabledModules: [],
          features: {
            automation: true,
            advancedSettings: true,
            marketplace: true,
            aiPlayground: true
          },
          proxy: null
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações da organização",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFeature = (feature: keyof OrganizationSettings['features'], enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled
      }
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/organizations/${organization.id}/settings`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Configurações salvas com sucesso"
        });
      } else {
        throw new Error('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Carregando configurações...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações da Organização</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg">Funcionalidades</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Automação</Label>
                <p className="text-sm text-muted-foreground">
                  Permite acesso aos recursos de automação e IA
                </p>
              </div>
              <Switch
                checked={settings.features?.automation ?? true}
                onCheckedChange={(checked) => updateFeature('automation', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Configurações Avançadas</Label>
                <p className="text-sm text-muted-foreground">
                  Permite acesso às configurações avançadas do sistema
                </p>
              </div>
              <Switch
                checked={settings.features?.advancedSettings ?? true}
                onCheckedChange={(checked) => updateFeature('advancedSettings', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Marketplace</Label>
                <p className="text-sm text-muted-foreground">
                  Permite acesso ao marketplace de integrações
                </p>
              </div>
              <Switch
                checked={settings.features?.marketplace ?? true}
                onCheckedChange={(checked) => updateFeature('marketplace', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>AI Playground</Label>
                <p className="text-sm text-muted-foreground">
                  Permite acesso ao playground de IA
                </p>
              </div>
              <Switch
                checked={settings.features?.aiPlayground ?? true}
                onCheckedChange={(checked) => updateFeature('aiPlayground', checked)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg">Configurações de Rede</h3>
          
          <div className="space-y-2">
            <Label htmlFor="proxy">Proxy (Opcional)</Label>
            <p className="text-sm text-muted-foreground">
              Configure um proxy para conexões WhatsApp. Formatos suportados: http://, https://, socks4://, socks5://
            </p>
            <Input
              id="proxy"
              type="text"
              placeholder="http://proxy.example.com:8080 ou socks5://proxy.example.com:1080"
              value={settings.proxy || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, proxy: e.target.value || null }))}
            />
            <p className="text-xs text-muted-foreground">
              Exemplo: http://usuario:senha@proxy.example.com:8080
            </p>
          </div>
        </div>

        <Button onClick={saveSettings} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </CardContent>
    </Card>
  );
}; 