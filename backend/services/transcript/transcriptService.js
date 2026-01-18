import { execSync } from 'child_process';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

class TranscriptService {
    async createTranscript(chatId, audioFilePath) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const result = await client.query(
                'INSERT INTO transcripts (chat_id, audio_file_path, status) VALUES ($1, $2, $3) RETURNING id',
                [chatId, audioFilePath, 'pending']
            );
            
            await client.query('COMMIT');
            return result.rows[0].id;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async updateTranscript(transcriptId, transcriptText) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            await client.query(
                'UPDATE transcripts SET transcript_text = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [transcriptText, 'completed', transcriptId]
            );
            
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async createAudioConversion(transcriptId, originalAudioPath, voiceId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const result = await client.query(
                'INSERT INTO audio_conversions (transcript_id, original_audio_path, voice_id, status) VALUES ($1, $2, $3, $4) RETURNING id',
                [transcriptId, originalAudioPath, voiceId, 'pending']
            );
            
            await client.query('COMMIT');
            return result.rows[0].id;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async updateAudioConversion(conversionId, convertedAudioPath) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            await client.query(
                'UPDATE audio_conversions SET converted_audio_path = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [convertedAudioPath, 'completed', conversionId]
            );
            
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getTranscriptById(transcriptId) {
        const result = await pool.query(
            'SELECT * FROM transcripts WHERE id = $1',
            [transcriptId]
        );
        return result.rows[0];
    }

    async getAudioConversionById(conversionId) {
        const result = await pool.query(
            'SELECT * FROM audio_conversions WHERE id = $1',
            [conversionId]
        );
        return result.rows[0];
    }

    async getTranscriptsByChatId(chatId) {
        const result = await pool.query(
            'SELECT * FROM transcripts WHERE chat_id = $1 ORDER BY created_at DESC',
            [chatId]
        );
        return result.rows;
    }
}

export default new TranscriptService(); 