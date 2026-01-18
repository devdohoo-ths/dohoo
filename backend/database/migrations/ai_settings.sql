-- Tabela para armazenar configurações de IA por organização
CREATE TABLE IF NOT EXISTS ai_settings (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    settings JSONB NOT NULL DEFAULT '{
        "general": {
            "enabled": true,
            "model": "gpt-4",
            "temperature": 0.7,
            "maxTokens": 2000
        },
        "audio": {
            "enabled": false,
            "provider": "none",
            "voiceId": "",
            "language": "pt-BR"
        },
        "image": {
            "enabled": false,
            "provider": "none",
            "model": "dall-e-3",
            "size": "1024x1024"
        }
    }',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_ai_settings_organization_id ON ai_settings(organization_id);

-- Trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_settings_updated_at
    BEFORE UPDATE ON ai_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 