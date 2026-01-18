-- Adicionar configurações de agendamento à tabela ai_settings
-- Primeiro, vamos atualizar a estrutura padrão das configurações

UPDATE public.ai_settings 
SET settings = settings || '{
  "scheduling": {
    "enabled": false,
    "google_calendar_enabled": false,
    "auto_scheduling_enabled": false,
    "business_hours": {
      "monday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "tuesday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "wednesday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "thursday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "friday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "saturday": {"enabled": false, "start": "09:00", "end": "18:00"},
      "sunday": {"enabled": false, "start": "09:00", "end": "18:00"}
    },
    "default_duration": 60,
    "timezone": "America/Sao_Paulo",
    "location": "",
    "service_types": []
  }
}'::jsonb
WHERE NOT (settings ? 'scheduling');

-- Atualizar o valor padrão para novas inserções
ALTER TABLE public.ai_settings 
ALTER COLUMN settings SET DEFAULT '{
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
  },
  "scheduling": {
    "enabled": false,
    "google_calendar_enabled": false,
    "auto_scheduling_enabled": false,
    "business_hours": {
      "monday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "tuesday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "wednesday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "thursday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "friday": {"enabled": true, "start": "09:00", "end": "18:00"},
      "saturday": {"enabled": false, "start": "09:00", "end": "18:00"},
      "sunday": {"enabled": false, "start": "09:00", "end": "18:00"}
    },
    "default_duration": 60,
    "timezone": "America/Sao_Paulo",
    "location": "",
    "service_types": []
  }
}'::jsonb;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.ai_settings.settings IS 'JSON configuration for AI features including general settings, audio processing, image processing, and scheduling.';

-- Função para verificar se agendamento está habilitado
CREATE OR REPLACE FUNCTION public.ai_scheduling_enabled(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.ai_settings 
    WHERE organization_id = org_id 
    AND settings->'scheduling'->>'enabled' = 'true'
    AND settings->'scheduling'->>'auto_scheduling_enabled' = 'true'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter configurações de agendamento
CREATE OR REPLACE FUNCTION public.get_ai_scheduling_config(org_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT settings->'scheduling'
    FROM public.ai_settings 
    WHERE organization_id = org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 