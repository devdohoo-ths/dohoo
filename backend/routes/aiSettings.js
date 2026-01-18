import express from 'express';
import { loadAISettings, getAIProcessingConfig, normalizeSettings } from '../services/ai/aiSettingsMiddleware.js';
import { authenticateToken } from '../middleware/auth.js';
import { supabase } from '../lib/supabaseClient.js';
import { listarVoicesElevenLabs, testarVoiceElevenLabs, gerarAudioElevenLabs } from '../services/elevenLabs.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// Buscar configurações de IA da organização
router.get('/settings', async (req, res) => {
  try {
    console.log('🔧 Request body:', req.body);
    
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    console.log('🔧 Buscando configurações de IA para organização:', organizationId);
    
    // Buscar diretamente do banco para debug
    const { data: dbSettings, error: dbError } = await supabase
      .from('ai_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .single();

    console.log('📋 Configurações do banco:', dbSettings ? JSON.stringify(dbSettings.settings, null, 2) : 'Nenhuma configuração encontrada');
    
    const aiSettings = await loadAISettings(organizationId);
    const processingConfig = getAIProcessingConfig(aiSettings);

    console.log('⚙️ Configurações carregadas:', JSON.stringify(aiSettings, null, 2));
    console.log('🔧 Configurações de processamento:', JSON.stringify(processingConfig, null, 2));

    res.json({
      settings: aiSettings,
      processingConfig: processingConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error loading AI settings:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Atualizar configurações de IA da organização
router.put('/settings', async (req, res) => {
  try {
    console.log('❌❌❌❌✅✅✅✅😒😒😒😒  Request body:', req.body);
    const organizationId = req.user.organization_id;
    const { settings } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    if (!settings) {
      return res.status(400).json({ error: 'Settings are required' });
    }

    console.log('🔧 Atualizando configurações de IA para organização:', organizationId);
    console.log('⚙️ Novas configurações recebidas:', JSON.stringify(settings, null, 2));

    // Normalizar configurações antes de salvar
    const normalizedSettings = normalizeSettings(settings);
    console.log('✅ Configurações normalizadas:', JSON.stringify(normalizedSettings, null, 2));

    // Verificar se já existe configuração para a organização
    const { data: existingSettings, error: checkError } = await supabase
      .from('ai_settings')
      .select('id, settings')
      .eq('organization_id', organizationId)
      .single();

    console.log('🔍 Configuração existente:', existingSettings ? 'Sim' : 'Não');
    if (existingSettings) {
      console.log('📋 Configuração atual:', JSON.stringify(existingSettings.settings, null, 2));
    }

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar configuração existente:', checkError);
      throw checkError;
    }

    if (existingSettings) {
      // Atualizar configuração existente
      console.log('🔄 Atualizando configuração existente...');
      const { data: updatedSettings, error: updateError } = await supabase
        .from('ai_settings')
        .update({ 
          settings: normalizedSettings, 
          updated_at: new Date().toISOString() 
        })
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Erro ao atualizar configuração:', updateError);
        throw updateError;
      }

      console.log('✅ Configurações atualizadas com sucesso');
      console.log('📋 Configuração atualizada:', JSON.stringify(updatedSettings.settings, null, 2));
      res.json({
        message: 'AI settings updated successfully',
        settings: updatedSettings,
        timestamp: new Date().toISOString()
      });
    } else {
      // Criar nova configuração
      console.log('🆕 Criando nova configuração...');
      const { data: newSettings, error: insertError } = await supabase
        .from('ai_settings')
        .insert({
          organization_id: organizationId,
          settings: normalizedSettings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro ao criar configuração:', insertError);
        throw insertError;
      }

      console.log('✅ Configurações criadas com sucesso');
      console.log('📋 Configuração criada:', JSON.stringify(newSettings.settings, null, 2));
      res.json({
        message: 'AI settings created successfully',
        settings: newSettings,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Error updating AI settings:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Testar configurações de IA
router.post('/test', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { message = 'Olá, como você está?' } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    console.log('🧪 Testando configurações de IA para organização:', organizationId);
    
    // Carregar configurações
    const aiSettings = await loadAISettings(organizationId);
    const processingConfig = getAIProcessingConfig(aiSettings);

    // Simular teste de IA
    const testResponse = {
      message: 'Teste de configurações de IA',
      input: message,
      settings: {
        model: processingConfig.model,
        temperature: processingConfig.temperature,
        maxTokens: processingConfig.maxTokens,
        provider: processingConfig.provider
      },
      audio: {
        enabled: processingConfig.audio.enabled,
        transcriptionEnabled: processingConfig.audio.transcriptionEnabled,
        synthesisEnabled: processingConfig.audio.synthesisEnabled,
        provider: processingConfig.audio.provider
      },
      image: {
        enabled: processingConfig.image.enabled,
        provider: processingConfig.image.provider
      },
      timestamp: new Date().toISOString()
    };

    res.json(testResponse);
  } catch (error) {
    console.error('Error testing AI settings:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Listar voices do ElevenLabs
router.get('/voices', async (req, res) => {
  try {
    console.log('🎤 Listando voices do ElevenLabs...');
    
    const voices = await listarVoicesElevenLabs();
    
    res.json({
      voices: voices,
      count: voices.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error listing voices:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Testar voice específica
router.post('/voices/test', async (req, res) => {
  try {
    const { voiceId, text = "Olá, este é um teste de voz." } = req.body;

    if (!voiceId) {
      return res.status(400).json({ error: 'Voice ID is required' });
    }

    console.log('🧪 Testando voice:', voiceId);
    
    const audioUrl = await testarVoiceElevenLabs(voiceId, text);
    
    res.json({
      success: true,
      audioUrl: audioUrl,
      voiceId: voiceId,
      text: text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error testing voice:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Gerar áudio para texto
router.post('/audio/generate', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { text, voiceId } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('🔊 Gerando áudio para organização:', organizationId);
    console.log('📝 Texto:', text);
    
    const audioUrl = await gerarAudioElevenLabs(text, organizationId, voiceId);
    
    res.json({
      success: true,
      audioUrl: audioUrl,
      text: text,
      organizationId: organizationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating audio:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 