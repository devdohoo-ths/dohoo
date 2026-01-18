-- Adicionar colunas platform e account_type na tabela whatsapp_accounts
ALTER TABLE public.whatsapp_accounts 
ADD COLUMN platform TEXT DEFAULT 'whatsapp',
ADD COLUMN account_type TEXT DEFAULT 'unofficial' CHECK (account_type IN ('official', 'unofficial'));

-- Criar índice para performance
CREATE INDEX idx_whatsapp_accounts_platform ON public.whatsapp_accounts(platform);
CREATE INDEX idx_whatsapp_accounts_account_type ON public.whatsapp_accounts(account_type); 