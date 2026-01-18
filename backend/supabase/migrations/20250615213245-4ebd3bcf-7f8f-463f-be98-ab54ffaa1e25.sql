
-- Adicionar coluna para horário de funcionamento nos assistentes de IA
ALTER TABLE public.ai_assistants
ADD COLUMN business_hours JSONB;

COMMENT ON COLUMN public.ai_assistants.business_hours IS 'Armazena as horas de funcionamento. Ex: {"monday": {"start": "09:00", "end": "18:00"}, "tuesday": {"start": "09:00", "end": "18:00"}}';

-- Adicionar coluna para vincular um assistente de IA a uma conta do WhatsApp
ALTER TABLE public.whatsapp_accounts
ADD COLUMN assistant_id UUID REFERENCES public.ai_assistants(id) ON DELETE SET NULL;

-- Criar um índice para otimizar a busca por assistente vinculado
CREATE INDEX idx_whatsapp_accounts_assistant_id ON public.whatsapp_accounts(assistant_id);
