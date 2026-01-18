import { supabase } from '../../lib/supabaseClient.js';

/**
 * Middleware para carregar e validar configurações de IA da organização
 */
export const loadAISettings = async (organizationId) => {
  try {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    console.log('🔍 Carregando configurações para organização:', organizationId);

    const { data, error } = await supabase
      .from('ai_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar configurações:', error);
      throw error;
    }

    if (!data) {
      console.log('📋 Nenhuma configuração encontrada, usando padrões');
      // Retornar configurações padrão se não existir
      return {
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
    }

    console.log('📋 Configurações encontradas:', JSON.stringify(data.settings, null, 2));
    return data.settings;
  } catch (error) {
    console.error('Error loading AI settings:', error);
    throw error;
  }
};

/**
 * Valida se a IA está habilitada para a organização
 */
export const validateAIEnabled = (settings) => {
  if (!settings?.general?.enabled) {
    throw new Error('AI processing is disabled for this organization');
  }
  return true;
};

/**
 * Valida se o processamento de áudio está habilitado
 */
export const validateAudioEnabled = (settings) => {
  if (!settings?.audio?.enabled) {
    throw new Error('Audio processing is disabled for this organization');
  }
  return true;
};

/**
 * Valida se a transcrição de áudio está habilitada
 */
export const validateTranscriptionEnabled = (settings) => {
  if (!settings?.audio?.transcriptionEnabled) {
    throw new Error('Audio transcription is disabled for this organization');
  }
  return true;
};

/**
 * Valida se a síntese de áudio está habilitada
 */
export const validateSynthesisEnabled = (settings) => {
  if (!settings?.audio?.synthesisEnabled) {
    throw new Error('Audio synthesis is disabled for this organization');
  }
  return true;
};

/**
 * Valida se o processamento de imagem está habilitado
 */
export const validateImageEnabled = (settings) => {
  if (!settings?.image?.enabled) {
    throw new Error('Image processing is disabled for this organization');
  }
  return true;
};

/**
 * Normaliza as configurações para garantir estrutura correta
 */
export const normalizeSettings = (settings) => {
  return {
    general: {
      enabled: settings?.general?.enabled ?? true,
      provider: settings?.general?.provider ?? 'openai',
      model: settings?.general?.model ?? 'gpt-4o-mini',
      temperature: settings?.general?.temperature ?? 0.7,
      maxTokens: settings?.general?.maxTokens ?? 2000
    },
    audio: {
      enabled: settings?.audio?.enabled ?? false,
      provider: settings?.audio?.provider ?? 'none',
      voiceId: settings?.audio?.voiceId ?? '',
      language: settings?.audio?.language ?? 'pt-BR',
      transcriptionEnabled: settings?.audio?.transcriptionEnabled ?? false,
      synthesisEnabled: settings?.audio?.synthesisEnabled ?? false
    },
    image: {
      enabled: settings?.image?.enabled ?? false,
      provider: settings?.image?.provider ?? 'none',
      model: settings?.image?.model ?? 'dall-e-3',
      size: settings?.image?.size ?? '1024x1024'
    }
  };
};

/**
 * Obtém as configurações de IA formatadas para uso no processamento
 */
export const getAIProcessingConfig = (settings) => {
  const normalized = normalizeSettings(settings);
  
  return {
    model: normalized.general.model,
    temperature: normalized.general.temperature,
    maxTokens: normalized.general.maxTokens,
    provider: normalized.general.provider,
    audio: {
      enabled: normalized.audio.enabled,
      transcriptionEnabled: normalized.audio.transcriptionEnabled,
      synthesisEnabled: normalized.audio.synthesisEnabled,
      provider: normalized.audio.provider,
      voiceId: normalized.audio.voiceId,
      language: normalized.audio.language
    },
    image: {
      enabled: normalized.image.enabled,
      provider: normalized.image.provider,
      model: normalized.image.model,
      size: normalized.image.size
    }
  };
}; 