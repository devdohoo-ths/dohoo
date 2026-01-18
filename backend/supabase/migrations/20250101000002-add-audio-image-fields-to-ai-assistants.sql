-- Adicionar campos de processamento de áudio na tabela ai_assistants
ALTER TABLE public.ai_assistants 
ADD COLUMN IF NOT EXISTS audio_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS audio_transcription BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS audio_synthesis BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS audio_voice TEXT,
ADD COLUMN IF NOT EXISTS audio_provider TEXT,
ADD COLUMN IF NOT EXISTS audio_model TEXT;

-- Adicionar campos de processamento de imagem na tabela ai_assistants
ALTER TABLE public.ai_assistants 
ADD COLUMN IF NOT EXISTS image_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS image_provider TEXT,
ADD COLUMN IF NOT EXISTS image_model TEXT,
ADD COLUMN IF NOT EXISTS image_size TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.ai_assistants.audio_enabled IS 'Habilita processamento de áudio para este assistente';
COMMENT ON COLUMN public.ai_assistants.audio_transcription IS 'Habilita transcrição de áudio para texto';
COMMENT ON COLUMN public.ai_assistants.audio_synthesis IS 'Habilita síntese de texto para áudio';
COMMENT ON COLUMN public.ai_assistants.audio_voice IS 'Voz selecionada para síntese de áudio';
COMMENT ON COLUMN public.ai_assistants.audio_provider IS 'Provedor de serviços de áudio (elevenlabs, openai, etc)';
COMMENT ON COLUMN public.ai_assistants.audio_model IS 'Modelo de áudio utilizado';

COMMENT ON COLUMN public.ai_assistants.image_enabled IS 'Habilita processamento de imagem para este assistente';
COMMENT ON COLUMN public.ai_assistants.image_provider IS 'Provedor de serviços de imagem (openai, anthropic, google, etc)';
COMMENT ON COLUMN public.ai_assistants.image_model IS 'Modelo de imagem utilizado';
COMMENT ON COLUMN public.ai_assistants.image_size IS 'Tamanho das imagens geradas (ex: 1024x1024)'; 