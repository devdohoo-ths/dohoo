class AISettingsService {
    async getSettingsByOrganization(organizationId) {
        try {
            const result = await pool.query(
                'SELECT settings FROM ai_settings WHERE organization_id = $1',
                [organizationId]
            );

            if (result.rows.length === 0) {
                // Se não existir configuração, cria uma com os valores padrão
                return this.createDefaultSettings(organizationId);
            }

            return result.rows[0].settings;
        } catch (error) {
            console.error('Error getting AI settings:', error);
            throw error;
        }
    }

    async updateSettings(organizationId, settings) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO ai_settings (organization_id, settings)
                 VALUES ($1, $2)
                 ON CONFLICT (organization_id)
                 DO UPDATE SET settings = $2, updated_at = CURRENT_TIMESTAMP
                 RETURNING settings`,
                [organizationId, settings]
            );

            await client.query('COMMIT');
            return result.rows[0].settings;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating AI settings:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async createDefaultSettings(organizationId) {
        const defaultSettings = {
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

        try {
            const result = await pool.query(
                'INSERT INTO ai_settings (organization_id, settings) VALUES ($1, $2) RETURNING settings',
                [organizationId, defaultSettings]
            );

            return result.rows[0].settings;
        } catch (error) {
            console.error('Error creating default AI settings:', error);
            throw error;
        }
    }

    // Método para migrar configurações antigas para o novo formato
    async migrateSettings(organizationId) {
        try {
            const result = await pool.query(
                'SELECT settings FROM ai_settings WHERE organization_id = $1',
                [organizationId]
            );

            if (result.rows.length === 0) {
                return this.createDefaultSettings(organizationId);
            }

            const currentSettings = result.rows[0].settings;
            const migratedSettings = this.migrateSettingsFormat(currentSettings);

            // Atualiza apenas se houve mudanças
            if (JSON.stringify(currentSettings) !== JSON.stringify(migratedSettings)) {
                await this.updateSettings(organizationId, migratedSettings);
            }

            return migratedSettings;
        } catch (error) {
            console.error('Error migrating AI settings:', error);
            throw error;
        }
    }

    // Método para migrar o formato das configurações
    migrateSettingsFormat(settings) {
        const defaultSettings = {
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
        
        // Garante que todas as seções existam
        const migrated = {
            general: {
                ...defaultSettings.general,
                ...settings.general
            },
            audio: {
                ...defaultSettings.audio,
                ...settings.audio
            },
            image: {
                ...defaultSettings.image,
                ...settings.image
            }
        };

        // Migrações específicas
        if (settings.general && !settings.general.provider) {
            migrated.general.provider = 'openai';
        }

        if (settings.audio) {
            if (!settings.audio.transcriptionEnabled) {
                migrated.audio.transcriptionEnabled = false;
            }
            if (!settings.audio.synthesisEnabled) {
                migrated.audio.synthesisEnabled = false;
            }
        }

        return migrated;
    }
}

export default new AISettingsService(); 