import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

// Estrutura das configurações de IA
export interface AISettings {
  general: {
    enabled: boolean;
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  audio: {
    enabled: boolean;
    provider: 'elevenlabs' | 'google' | 'none';
    voiceId: string;
    language: string;
    transcriptionEnabled: boolean;
    synthesisEnabled: boolean;
  };
  image: {
    enabled: boolean;
    provider: 'dalle' | 'midjourney' | 'none';
    model: string;
    size: string;
  };
}

const defaultSettings: AISettings = {
  general: {
    enabled: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000
  },
  audio: {
    enabled: false,
    provider: 'none',
    voiceId: '',
    language: 'pt-BR',
    transcriptionEnabled: false,
    synthesisEnabled: false
  },
  image: {
    enabled: false,
    provider: 'none',
    model: 'dall-e-3',
    size: '1024x1024'
  }
};

interface AISettingsResponse {
  settings: AISettings;
  processingConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
    provider: string;
    audio: {
      enabled: boolean;
      transcriptionEnabled: boolean;
      synthesisEnabled: boolean;
      provider: string;
      voiceId: string;
      language: string;
    };
    image: {
      enabled: boolean;
      provider: string;
      model: string;
      size: string;
    };
  };
  timestamp: string;
}

interface TestResponse {
  message: string;
  input: string;
  settings: {
    model: string;
    temperature: number;
    maxTokens: number;
    provider: string;
  };
  audio: {
    enabled: boolean;
    transcriptionEnabled: boolean;
    synthesisEnabled: boolean;
    provider: string;
  };
  image: {
    enabled: boolean;
    provider: string;
  };
  timestamp: string;
}

export const useAISettings = () => {
  const { toast } = useToast();
  const { organization, loading: orgLoading } = useOrganization();
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [processingConfig, setProcessingConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para normalizar configurações
  const normalizeSettings = (settingsObj: any): AISettings => {
    return {
      general: {
        enabled: settingsObj?.general?.enabled ?? defaultSettings.general.enabled,
        provider: settingsObj?.general?.provider ?? defaultSettings.general.provider,
        model: settingsObj?.general?.model ?? defaultSettings.general.model,
        temperature: settingsObj?.general?.temperature ?? defaultSettings.general.temperature,
        maxTokens: settingsObj?.general?.maxTokens ?? defaultSettings.general.maxTokens
      },
      audio: {
        enabled: settingsObj?.audio?.enabled ?? defaultSettings.audio.enabled,
        provider: settingsObj?.audio?.provider ?? defaultSettings.audio.provider,
        voiceId: settingsObj?.audio?.voiceId ?? defaultSettings.audio.voiceId,
        language: settingsObj?.audio?.language ?? defaultSettings.audio.language,
        transcriptionEnabled: settingsObj?.audio?.transcriptionEnabled ?? defaultSettings.audio.transcriptionEnabled,
        synthesisEnabled: settingsObj?.audio?.synthesisEnabled ?? defaultSettings.audio.synthesisEnabled
      },
      image: {
        enabled: settingsObj?.image?.enabled ?? defaultSettings.image.enabled,
        provider: settingsObj?.image?.provider ?? defaultSettings.image.provider,
        model: settingsObj?.image?.model ?? defaultSettings.image.model,
        size: settingsObj?.image?.size ?? defaultSettings.image.size
      }
    };
  };

  // Carregar configurações
  const loadSettings = async () => {
    console.log('🔄 Iniciando loadSettings...');
    console.log('🌐 API Base URL:', apiBase);
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Carregando configurações de IA...');

      const url = `${apiBase}/api/ai-settings/settings`;
      console.log('🌐 URL da requisição:', url);

      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log('📥 Resposta do backend:', response.status, response.statusText);
      console.log('📥 Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        console.error('❌ Status:', response.status);
        console.error('❌ Status Text:', response.statusText);
        throw new Error(`Failed to load settings: ${response.statusText} - ${errorText}`);
      }

      const result: AISettingsResponse = await response.json();
      
      console.log('📋 Configurações carregadas:', result.settings);
      
      // Normalizar configurações
      const normalizedSettings = normalizeSettings(result.settings);
      setSettings(normalizedSettings);
      setProcessingConfig(result.processingConfig);
      console.log('✅ Configurações normalizadas e salvas no estado');
    } catch (err: any) {
      console.error('❌ Erro ao carregar configurações:', err);
      setError(err.message);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de IA.",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Finalizando loadSettings');
      setLoading(false);
    }
  };

  // Salvar configurações
  const saveSettings = async (newSettings?: AISettings) => {
    setSaving(true);
    setError(null);

    try {
      // Sempre usar o estado atual das configurações para garantir que as mudanças sejam salvas
      const settingsToSave = settings;
      
      console.log('🔍 DEBUG - Estado atual das configurações:', settingsToSave);
      
      if (!settingsToSave) {
        throw new Error('No settings available to save');
      }

      // Normalizar configurações antes de salvar
      const normalizedSettings = normalizeSettings(settingsToSave);

      console.log('💾 Salvando configurações:', normalizedSettings);
      console.log('📦 Dados que serão enviados:', JSON.stringify({ settings: normalizedSettings }, null, 2));

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai-settings/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ settings: normalizedSettings })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        throw new Error(`Failed to save settings: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('✅ Configurações salvas com sucesso:', result);
      
      // Atualizar o estado local com as configurações salvas
      setSettings(normalizedSettings);
      setHasChanges(false); // Resetar mudanças após salvar com sucesso
      
      // Atualizar o processingConfig com base nas novas configurações
      const newProcessingConfig = {
        model: normalizedSettings.general.model,
        temperature: normalizedSettings.general.temperature,
        maxTokens: normalizedSettings.general.maxTokens,
        provider: normalizedSettings.general.provider,
        audio: {
          enabled: normalizedSettings.audio.enabled,
          transcriptionEnabled: normalizedSettings.audio.transcriptionEnabled,
          synthesisEnabled: normalizedSettings.audio.synthesisEnabled,
          provider: normalizedSettings.audio.provider,
          voiceId: normalizedSettings.audio.voiceId,
          language: normalizedSettings.audio.language
        },
        image: {
          enabled: normalizedSettings.image.enabled,
          provider: normalizedSettings.image.provider,
          model: normalizedSettings.image.model,
          size: normalizedSettings.image.size
        }
      };
      setProcessingConfig(newProcessingConfig);
      
      toast({
        title: "Sucesso",
        description: "Configurações de IA salvas com sucesso!",
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      console.error('Error saving AI settings:', err);
      toast({
        title: "Erro",
        description: `Não foi possível salvar as configurações de IA: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Atualizar configurações
  const updateSettings = (section: keyof AISettings, updates: Partial<AISettings[keyof AISettings]>) => {
    console.log(`🔄 Atualizando ${section}:`, updates);
    console.log('📋 Configurações antes da atualização:', settings);
    
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [section]: { ...prev[section], ...updates }
      };
      console.log('📋 Configurações após atualização:', newSettings);
      return newSettings;
    });
    setHasChanges(true);
  };

  // Resetar mudanças
  const resetChanges = () => {
    setHasChanges(false);
  };

  // Testar configurações
  const testSettings = async (message: string = 'Olá, como você está?'): Promise<TestResponse> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai-settings/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`Failed to test settings: ${response.statusText}`);
      }

      const result: TestResponse = await response.json();
      return result;
    } catch (err: any) {
      setError(err.message);
      console.error('Error testing AI settings:', err);
      toast({
        title: "Erro",
        description: `Não foi possível testar as configurações de IA: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Carregar configurações quando a organização mudar
  useEffect(() => {
    console.log('🔄 useEffect - Organização mudou:', {
      organizationId: organization?.id,
      orgLoading,
      loading
    });
    
    if (organization?.id) {
      console.log('📋 Carregando configurações para organização:', organization.id);
      loadSettings();
    } else if (!orgLoading) {
      // Se não está carregando e não tem organização, parar o loading
      console.log('❌ Nenhuma organização encontrada, parando loading');
      setLoading(false);
    }
  }, [organization?.id, orgLoading]);

  // Monitorar mudanças no estado das configurações
  useEffect(() => {
    console.log('📊 Estado das configurações mudou:', settings);
  }, [settings]);

  return {
    settings,
    processingConfig,
    loading: loading || orgLoading,
    saving,
    hasChanges,
    error,
    currentOrganization: organization,
    loadSettings,
    saveSettings,
    updateSettings,
    resetChanges,
    testSettings
  };
}; 