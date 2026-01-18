import { OpenAI } from 'openai';
import { supabase } from '../lib/supabaseClient.js';
import { gerarAudioElevenLabs } from './elevenLabs.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadAISettings, validateAIEnabled, validateAudioEnabled, validateTranscriptionEnabled, validateSynthesisEnabled, getAIProcessingConfig } from './ai/aiSettingsMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioProcessor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async processAudio(audioBuffer, chatId, companyId) {
        try {
            console.log('🎵 Iniciando processamento de áudio...');
            console.log('📝 Parâmetros:', { chatId, companyId, bufferSize: audioBuffer.length });

            // 1. Carregar configurações de IA da organização
            console.log('🔧 Carregando configurações de IA para organização:', companyId);
            const aiSettings = await loadAISettings(companyId);
            
            // Validar se a IA está habilitada
            validateAIEnabled(aiSettings);
            
            // Validar se o processamento de áudio está habilitado
            validateAudioEnabled(aiSettings);
            
            // Obter configurações formatadas para processamento
            const processingConfig = getAIProcessingConfig(aiSettings);
            
            console.log('⚙️ Configurações de áudio carregadas:', {
                audioEnabled: processingConfig.audio.enabled,
                transcriptionEnabled: processingConfig.audio.transcriptionEnabled,
                synthesisEnabled: processingConfig.audio.synthesisEnabled,
                provider: processingConfig.audio.provider
            });

            // 2. Salvar áudio do WhatsApp
            const audioPath = await this.saveWhatsAppAudio(audioBuffer, chatId);
            console.log('✅ Áudio do WhatsApp salvo em:', audioPath);

            // 3. Transcrever áudio usando OpenAI (se habilitado)
            let transcript = null;
            if (processingConfig.audio.transcriptionEnabled) {
                console.log('🎤 Iniciando transcrição...');
                transcript = await this.transcribeAudio(audioPath);
                console.log('✅ Transcrição concluída:', transcript);
            } else {
                console.log('❌ Transcrição desabilitada - pulando etapa');
                transcript = "[Transcrição desabilitada]";
            }

            // 4. Processar com IA
            console.log('🤖 Processando com IA...');
            const aiResponse = await this.processWithAI(transcript, companyId, processingConfig);
            console.log('✅ Resposta da IA:', aiResponse);

            // 5. Converter resposta para áudio (se habilitado)
            let audioResponse = null;
            if (processingConfig.audio.synthesisEnabled && processingConfig.audio.provider === 'elevenlabs') {
                console.log('🔊 Convertendo resposta para áudio...');
                audioResponse = await this.convertToAudio(aiResponse, companyId, processingConfig.audio.voiceId);
                console.log('✅ Áudio de resposta gerado:', audioResponse);
            } else {
                console.log('❌ Síntese de áudio desabilitada - retornando apenas texto');
            }

            return {
                transcript,
                aiResponse,
                audioUrl: audioResponse,
                settings_used: {
                    transcriptionEnabled: processingConfig.audio.transcriptionEnabled,
                    synthesisEnabled: processingConfig.audio.synthesisEnabled,
                    provider: processingConfig.audio.provider,
                    model: processingConfig.model
                }
            };
        } catch (error) {
            console.error('❌ Erro no processamento de áudio:', error);
            console.error('Stack trace:', error.stack);
            
            // Se for erro de configuração desabilitada, retornar erro específico
            if (error.message.includes('disabled')) {
                throw new Error(`Funcionalidade desabilitada: ${error.message}`);
            }
            
            throw error;
        }
    }

    async saveWhatsAppAudio(audioBuffer, chatId) {
        try {
            console.log('💾 Salvando áudio do WhatsApp...');
            const uploadDir = path.join(process.cwd(), 'uploads', 'whatsapp', chatId);
            console.log('📁 Diretório de upload:', uploadDir);
            
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('✅ Diretório criado/verificado');

            const fileName = `${Date.now()}_whatsapp_audio.ogg`;
            const filePath = path.join(uploadDir, fileName);
            
            fs.writeFileSync(filePath, audioBuffer);
            console.log('✅ Arquivo salvo:', filePath);
            
            return filePath;
        } catch (error) {
            console.error('❌ Erro ao salvar áudio:', error);
            throw error;
        }
    }

    async transcribeAudio(audioPath) {
        try {
            console.log('🎤 Iniciando transcrição do áudio:', audioPath);
            
            // Verificar se o arquivo existe
            if (!fs.existsSync(audioPath)) {
                throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
            }

            // Converter para MP3 se necessário (WhatsApp envia em OGG)
            const mp3Path = audioPath.replace('.ogg', '.mp3');
            console.log('🔄 Convertendo para MP3:', mp3Path);
            
            try {
                execSync(`ffmpeg -i "${audioPath}" "${mp3Path}"`);
                console.log('✅ Conversão para MP3 concluída');
            } catch (error) {
                console.error('❌ Erro na conversão para MP3:', error);
                throw new Error('Falha ao converter áudio para MP3');
            }

            console.log('🎵 Enviando para transcrição OpenAI...');
            const audioFile = fs.createReadStream(mp3Path);
            const response = await this.openai.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-1",
                language: "pt"
            });
            console.log('✅ Transcrição recebida da OpenAI');

            // Limpar arquivos temporários
            try {
                fs.unlinkSync(mp3Path);
                fs.unlinkSync(audioPath);
                console.log('🧹 Arquivos temporários removidos');
            } catch (error) {
                console.warn('⚠️ Erro ao remover arquivos temporários:', error);
            }

            return response.text;
        } catch (error) {
            console.error('❌ Erro na transcrição:', error);
            throw error;
        }
    }

    async processWithAI(text, companyId, processingConfig) {
        try {
            // Usar configurações carregadas em vez de buscar novamente
            const completion = await this.openai.chat.completions.create({
                model: processingConfig.model,
                messages: [
                    {
                        role: "system",
                        content: "Você é um assistente virtual amigável e prestativo. Responda de forma clara e concisa."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: processingConfig.temperature,
                max_tokens: processingConfig.maxTokens
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('❌ Erro no processamento com IA:', error);
            throw error;
        }
    }

    async convertToAudio(text, companyId, voiceId) {
        try {
            // Usar Eleven Labs ou Google TTS baseado nas configurações
            const { data: settings } = await supabase
                .from('ai_settings')
                .select('settings')
                .eq('organization_id', companyId)
                .single();

            if (!settings?.settings?.audio?.enabled) {
                throw new Error('Audio processing not enabled');
            }

            if (settings.settings.audio.provider === 'elevenlabs') {
                return await gerarAudioElevenLabs(text, companyId, voiceId);
            } else if (settings.settings.audio.provider === 'google') {
                // Implementar conversão com Google TTS se necessário
                throw new Error('Google TTS not implemented yet');
            } else {
                throw new Error('No audio provider configured');
            }
        } catch (error) {
            console.error('❌ Erro na conversão para áudio:', error);
            throw error;
        }
    }
}

export default new AudioProcessor(); 