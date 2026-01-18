-- Adiciona constraint UNIQUE em organization_id na tabela ai_settings
ALTER TABLE public.ai_settings
ADD CONSTRAINT ai_settings_organization_id_unique UNIQUE (organization_id); 