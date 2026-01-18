-- Atualizar a estrutura da tabela ai_settings para incluir os novos campos
-- Esta migração atualiza o valor padrão do JSON settings para incluir os novos campos

-- Primeiro, vamos atualizar registros existentes para incluir os novos campos
UPDATE public.ai_settings 
SET settings = jsonb_set(
    jsonb_set(
        settings,
        '{general}',
        COALESCE(settings->'general', '{}') || '{"provider": "openai"}'::jsonb
    ),
    '{audio}',
    COALESCE(settings->'audio', '{}') || '{"transcriptionEnabled": false, "synthesisEnabled": false}'::jsonb
)
WHERE settings IS NOT NULL;

-- Agora vamos atualizar o valor padrão da coluna settings
ALTER TABLE public.ai_settings 
ALTER COLUMN settings SET DEFAULT '{
    "general": {
        "enabled": true,
        "provider": "openai",
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "maxTokens": 2000
    },
    "audio": {
        "enabled": false,
        "provider": "none",
        "voiceId": "",
        "language": "pt-BR",
        "transcriptionEnabled": false,
        "synthesisEnabled": false
    },
    "image": {
        "enabled": false,
        "provider": "none",
        "model": "dall-e-3",
        "size": "1024x1024"
    }
}'::jsonb;

-- Adicionar constraint para garantir que o JSON tenha a estrutura correta
ALTER TABLE public.ai_settings 
ADD CONSTRAINT ai_settings_structure_check 
CHECK (
    settings ? 'general' AND 
    settings ? 'audio' AND 
    settings ? 'image' AND
    settings->'general' ? 'enabled' AND
    settings->'general' ? 'provider' AND
    settings->'general' ? 'model' AND
    settings->'general' ? 'temperature' AND
    settings->'general' ? 'maxTokens' AND
    settings->'audio' ? 'enabled' AND
    settings->'audio' ? 'provider' AND
    settings->'audio' ? 'voiceId' AND
    settings->'audio' ? 'language' AND
    settings->'audio' ? 'transcriptionEnabled' AND
    settings->'audio' ? 'synthesisEnabled' AND
    settings->'image' ? 'enabled' AND
    settings->'image' ? 'provider' AND
    settings->'image' ? 'model' AND
    settings->'image' ? 'size'
);

-- Atualizar comentários
COMMENT ON COLUMN public.ai_settings.settings IS 'JSON configuration for AI features including general settings, audio processing (transcription/synthesis), and image processing.'; 