import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVEN_API_KEY;
        this.baseUrl = 'https://api.elevenlabs.io/v1';
    }

    async convertTextToSpeech(text, voiceId, outputPath) {
        try {
            const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Eleven Labs API error: ${response.statusText}`);
            }

            const audioBuffer = await response.buffer();
            fs.writeFileSync(outputPath, audioBuffer);
            return outputPath;
        } catch (error) {
            console.error('Error converting text to speech:', error);
            throw error;
        }
    }

    async getAvailableVoices() {
        try {
            const response = await fetch(`${this.baseUrl}/voices`, {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Eleven Labs API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.voices;
        } catch (error) {
            console.error('Error fetching available voices:', error);
            throw error;
        }
    }

    async cloneVoice(audioFile, name) {
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('files', fs.createReadStream(audioFile));

            const response = await fetch(`${this.baseUrl}/voices/add`, {
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Eleven Labs API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.voice_id;
        } catch (error) {
            console.error('Error cloning voice:', error);
            throw error;
        }
    }
}

export default new ElevenLabsService(); 