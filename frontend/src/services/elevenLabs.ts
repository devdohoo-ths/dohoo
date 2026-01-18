import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description: string;
  preview_url?: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
}

export interface TextToSpeechOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
}

export async function getAvailableVoices(): Promise<Voice[]> {
  try {
    const headers = await getAuthHeaders();
    const settingsResponse = await fetch(`${apiBase}/api/ai-settings/settings`, {
      method: 'GET',
      headers
    });

    if (settingsResponse.ok) {
      const settingsResult = await settingsResponse.json();
      if (!settingsResult.settings?.audio?.enabled) {
        return [];
      }
    }

    const voicesResponse = await fetch(`${apiBase}/api/ai-settings/voices`, {
      method: 'GET',
      headers
    });

    if (!voicesResponse.ok) {
      throw new Error('Failed to fetch voices');
    }

    const result = await voicesResponse.json();
    const voices = result.voices || [];
    
    return voices.map((voice: any) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      description: voice.labels?.description || voice.description || '',
      preview_url: voice.preview_url,
    }));
  } catch (error) {
    console.error('Error fetching voices:', error);
    return [];
  }
}

export async function generateAudio(options: TextToSpeechOptions): Promise<ArrayBuffer> {
  try {
    const { text, voiceId, modelId = 'eleven_multilingual_v1', voiceSettings = { stability: 0.3, similarity_boost: 0.8 } } = options;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': import.meta.env.VITE_ELEVEN_LABS_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: voiceSettings
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to generate audio');
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error generating audio:', error);
    throw error;
  }
}

export async function gerarAudioElevenLabs(texto: string, companyId: string): Promise<string> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/api/ai-settings/audio/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: texto,
        organization_id: companyId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate audio: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.audioUrl || result.url || '';
  } catch (error) {
    console.error('Error in gerarAudioElevenLabs:', error);
    throw error;
  }
} 