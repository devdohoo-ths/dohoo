import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Settings, Save, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface BusinessHours {
  enabled: boolean;
  start: string;
  end: string;
}

interface SchedulingConfig {
  enabled: boolean;
  google_calendar_enabled: boolean;
  auto_scheduling_enabled: boolean;
  business_hours: {
    monday: BusinessHours;
    tuesday: BusinessHours;
    wednesday: BusinessHours;
    thursday: BusinessHours;
    friday: BusinessHours;
    saturday: BusinessHours;
    sunday: BusinessHours;
  };
  default_duration: number;
  timezone: string;
  location: string;
  service_types: string[];
}

const SchedulingSettings = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SchedulingConfig>({
    enabled: false,
    google_calendar_enabled: false,
    auto_scheduling_enabled: false,
    business_hours: {
      monday: { enabled: true, start: '09:00', end: '18:00' },
      tuesday: { enabled: true, start: '09:00', end: '18:00' },
      wednesday: { enabled: true, start: '09:00', end: '18:00' },
      thursday: { enabled: true, start: '09:00', end: '18:00' },
      friday: { enabled: true, start: '09:00', end: '18:00' },
      saturday: { enabled: false, start: '09:00', end: '18:00' },
      sunday: { enabled: false, start: '09:00', end: '18:00' }
    },
    default_duration: 60,
    timezone: 'America/Sao_Paulo',
    location: '',
    service_types: []
  });

  const days = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
  ];

  const timezones = [
    { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
    { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
    { value: 'America/Belem', label: 'Belém (GMT-3)' },
    { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
    { value: 'America/Recife', label: 'Recife (GMT-3)' },
    { value: 'America/Maceio', label: 'Maceió (GMT-3)' },
    { value: 'America/Aracaju', label: 'Aracaju (GMT-3)' },
    { value: 'America/Salvador', label: 'Salvador (GMT-3)' },
    { value: 'America/Vitoria', label: 'Vitória (GMT-3)' },
    { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' }
  ];

  // Carregar configurações
  useEffect(() => {
    if (user && organization) {
      loadSchedulingConfig();
    }
  }, [user, organization]);

  const loadSchedulingConfig = async () => {
    try {
      setLoading(true);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/settings?organization_id=${organization.id}`, {
        headers
      });

      if (!response.ok) {
        console.error('Erro ao carregar configurações:', response.status);
        return;
      }

      const result = await response.json();
      const aiSettings = result.settings || result.data;

      if (aiSettings?.settings?.scheduling) {
        setConfig(aiSettings.settings.scheduling);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedulingConfig = async () => {
    try {
      console.log('🔧 Iniciando salvamento das configurações...');
      console.log('📋 Configurações a salvar:', config);
      console.log('🏢 Organization ID:', organization?.id);
      
      setSaving(true);
      
      if (!organization?.id) {
        throw new Error('Organization ID não encontrado');
      }
      
      // Buscar configurações atuais via API do backend
      console.log('🔍 Buscando configurações atuais...');
      const headers = await getAuthHeaders();
      const fetchResponse = await fetch(`${apiBase}/api/ai/settings?organization_id=${organization.id}`, {
        headers
      });

      if (!fetchResponse.ok) {
        throw new Error(`Erro ao buscar configurações: ${fetchResponse.status}`);
      }

      const fetchResult = await fetchResponse.json();
      const currentSettings = fetchResult.settings || fetchResult.data;

      console.log('📄 Configurações atuais:', currentSettings);

      // Atualizar apenas a seção de agendamento
      const updatedSettings = {
        ...(currentSettings?.settings || {}),
        scheduling: config
      };

      console.log('🔄 Configurações atualizadas:', updatedSettings);

      // Atualizar via API do backend
      const updateResponse = await fetch(`${apiBase}/api/ai/settings`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization_id: organization.id,
          settings: updatedSettings
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao atualizar: ${updateResponse.status}`);
      }

      console.log('✅ Configurações salvas com sucesso!');

      toast({
        title: "Configurações salvas",
        description: "Suas configurações de agendamento foram salvas com sucesso!",
      });
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: `Erro ao salvar configurações: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateBusinessHours = (day: string, field: keyof BusinessHours, value: any) => {
    setConfig(prev => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: {
          ...prev.business_hours[day as keyof typeof prev.business_hours],
          [field]: value
        }
      }
    }));
  };

  const updateConfig = (field: keyof SchedulingConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Settings className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
          <PermissionGuard requiredPermissions={['manage_scheduling']}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Configurações de Agendamento
          </h1>
          <p className="text-muted-foreground">
            Configure como a IA deve gerenciar agendamentos automáticos via WhatsApp
          </p>
        </div>

        {/* Configurações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>
              Habilite o agendamento automático e configure as integrações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Agendamento Automático</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que a IA faça agendamentos automaticamente via WhatsApp
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig('enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Agendamento Automático Detalhado</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita verificações de disponibilidade e sugestões de horários
                </p>
              </div>
              <Switch
                checked={config.auto_scheduling_enabled}
                onCheckedChange={(checked) => updateConfig('auto_scheduling_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Integração Google Calendar</Label>
                <p className="text-sm text-muted-foreground">
                  Conecta com Google Calendar para salvar eventos automaticamente
                </p>
              </div>
              <Switch
                checked={config.google_calendar_enabled}
                onCheckedChange={(checked) => updateConfig('google_calendar_enabled', checked)}
              />
            </div>

            {config.google_calendar_enabled && (!config.enabled || !config.auto_scheduling_enabled) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Para usar o Google Calendar, você precisa habilitar o agendamento automático.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duração Padrão (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={config.default_duration}
                  onChange={(e) => updateConfig('default_duration', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Fuso Horário</Label>
                <Select
                  value={config.timezone}
                  onValueChange={(value) => updateConfig('timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Local Padrão</Label>
              <Input
                id="location"
                placeholder="Ex: Barbearia Central, Rua das Flores, 123"
                value={config.location}
                onChange={(e) => updateConfig('location', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Horário de Funcionamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horário de Funcionamento
            </CardTitle>
            <CardDescription>
              Defina os horários em que você atende
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {days.map((day) => (
              <div key={day.key} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="flex items-center space-x-2 min-w-[140px]">
                  <Switch
                    checked={config.business_hours[day.key as keyof typeof config.business_hours].enabled}
                    onCheckedChange={(checked) => updateBusinessHours(day.key, 'enabled', checked)}
                  />
                  <Label className="text-sm">{day.label}</Label>
                </div>
                
                {config.business_hours[day.key as keyof typeof config.business_hours].enabled && (
                  <div className="flex items-center space-x-2">
                    <Input
                      type="time"
                      value={config.business_hours[day.key as keyof typeof config.business_hours].start}
                      onChange={(e) => updateBusinessHours(day.key, 'start', e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={config.business_hours[day.key as keyof typeof config.business_hours].end}
                      onChange={(e) => updateBusinessHours(day.key, 'end', e.target.value)}
                      className="w-24"
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <Button onClick={saveSchedulingConfig} disabled={saving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>

        {/* Informações */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Como funciona o agendamento automático?</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800 space-y-2">
            <p>• Quando habilitado, a IA pode agendar compromissos automaticamente via WhatsApp</p>
            <p>• Os clientes podem pedir horários e a IA verificará disponibilidade</p>
            <p>• Se houver integração com Google Calendar, os eventos serão salvos automaticamente</p>
            <p>• A IA respeitará os horários de funcionamento configurados</p>
            <p>• Você pode cancelar ou reagendar compromissos através da IA</p>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
};

export default SchedulingSettings; 