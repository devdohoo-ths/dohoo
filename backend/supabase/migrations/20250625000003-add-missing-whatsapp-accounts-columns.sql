-- Adicionar colunas que estão faltando na tabela whatsapp_accounts
-- Estas colunas são referenciadas no código mas não existem na tabela

-- Adicionar coluna flow_id para vincular fluxos às contas WhatsApp
ALTER TABLE public.whatsapp_accounts
ADD COLUMN flow_id UUID REFERENCES public.fluxos(id) ON DELETE SET NULL;

-- Adicionar coluna mode para definir o modo de operação (ia/flow)
ALTER TABLE public.whatsapp_accounts
ADD COLUMN mode TEXT DEFAULT 'ia' CHECK (mode IN ('ia', 'flow'));

-- Criar índices para otimizar consultas
CREATE INDEX idx_whatsapp_accounts_flow_id ON public.whatsapp_accounts(flow_id);
CREATE INDEX idx_whatsapp_accounts_mode ON public.whatsapp_accounts(mode);

-- Comentários para documentar as colunas
COMMENT ON COLUMN public.whatsapp_accounts.flow_id IS 'ID do fluxo vinculado à conta WhatsApp';
COMMENT ON COLUMN public.whatsapp_accounts.mode IS 'Modo de operação: ia (inteligência artificial) ou flow (fluxo automatizado)'; 