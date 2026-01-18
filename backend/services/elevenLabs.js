import { loadAISettings, validateSynthesisEnabled, getAIProcessingConfig } from './ai/aiSettingsMiddleware.js';
import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const gerarAudioElevenLabs = async (text, organizationId, voiceId = null) => {
  try {
    // Carregar configurações de IA da organização
    console.log('🔧 Carregando configurações de áudio para organização:', organizationId);
    const aiSettings = await loadAISettings(organizationId);
    
    // Validar se a síntese de áudio está habilitada
    validateSynthesisEnabled(aiSettings);
    
    // Obter configurações formatadas para processamento
    const processingConfig = getAIProcessingConfig(aiSettings);
    
    // Usar voiceId das configurações se não fornecido
    const finalVoiceId = voiceId || processingConfig.audio.voiceId;
    
    if (!finalVoiceId) {
      throw new Error('Voice ID not configured for audio synthesis');
    }
    
    console.log('⚙️ Configurações de síntese carregadas:', {
      provider: processingConfig.audio.provider,
      voiceId: finalVoiceId,
      language: processingConfig.audio.language
    });

    // Verificar se o provider é ElevenLabs
    if (processingConfig.audio.provider !== 'elevenlabs') {
      throw new Error('ElevenLabs not configured as audio provider');
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    console.log('🔊 Gerando audio para o texto:', text);
    
    // Configurações otimizadas para WhatsApp
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`,
      {
        text: text,
        model_id: "eleven_multilingual_v1",
        voice_settings: {
          stability: 0.5,        // Aumentado para melhor qualidade
          similarity_boost: 0.75, // Ajustado para melhor clareza
          style: 0.0,            // Sem estilo adicional
          use_speaker_boost: true // Melhorar clareza da voz
        },
        output_format: "mp3_44100_128" // Formato específico para melhor compatibilidade
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      }     
    );

    // Verificar se o response tem dados
    if (!response.data || response.data.length === 0) {
      throw new Error('Resposta vazia da API ElevenLabs');
    }

    console.log('📊 Tamanho do áudio gerado:', response.data.length, 'bytes');

    // Criar diretório para uploads se não existir
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const fileName = `audio-${organizationId}-${timestamp}.mp3`;
    const filePath = path.join(uploadsDir, fileName);

    // Salvar arquivo de áudio
    fs.writeFileSync(filePath, response.data);

    // Verificar se o arquivo foi salvo corretamente
    const stats = fs.statSync(filePath);
    console.log('💾 Arquivo salvo:', {
      path: filePath,
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2)
    });

    // Retornar URL do arquivo
    const audioUrl = `/uploads/${fileName}`;
    
    console.log('✅ Áudio gerado com sucesso:', audioUrl);
    return audioUrl;
    
  } catch (error) {
    console.error('❌ Erro na geração de áudio:', error);
    throw error;
  }
};

export const listarVoicesElevenLabs = async () => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }
    
    const data = response.data;
    console.log('🎤 Voices carregadas:', data.voices?.length || 0);
    return data.voices || [];
    
  } catch (error) {
    console.error('❌ Erro ao listar voices do ElevenLabs:', error);
    throw error;
  }
};

export const testarVoiceElevenLabs = async (voiceId, text = "Olá, este é um teste de voz.") => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    console.log('🧪 Testando voice:', voiceId);
    
    // Configurações otimizadas para WhatsApp
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: "eleven_multilingual_v1",
        voice_settings: {
          stability: 0.5,        // Aumentado para melhor qualidade
          similarity_boost: 0.75, // Ajustado para melhor clareza
          style: 0.0,            // Sem estilo adicional
          use_speaker_boost: true // Melhorar clareza da voz
        },
        output_format: "mp3_44100_128" // Formato específico para melhor compatibilidade
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      }     
    );

    // Verificar se o response tem dados
    if (!response.data || response.data.length === 0) {
      throw new Error('Resposta vazia da API ElevenLabs');
    }

    console.log('📊 Tamanho do áudio de teste:', response.data.length, 'bytes');

    // Criar diretório para testes se não existir
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Gerar nome único para o arquivo de teste
    const timestamp = Date.now();
    const fileName = `test-audio-${voiceId}-${timestamp}.mp3`;
    const filePath = path.join(uploadsDir, fileName);

    // Salvar arquivo de áudio
    fs.writeFileSync(filePath, response.data);

    // Verificar se o arquivo foi salvo corretamente
    const stats = fs.statSync(filePath);
    console.log('💾 Arquivo de teste salvo:', {
      path: filePath,
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2)
    });

    // Retornar URL do arquivo
    const audioUrl = `/uploads/${fileName}`;
    
    console.log('✅ Teste de voice concluído:', audioUrl);
    return audioUrl;
    
  } catch (error) {
    console.error('❌ Erro no teste de voice:', error);
    throw error;
  }
}; 