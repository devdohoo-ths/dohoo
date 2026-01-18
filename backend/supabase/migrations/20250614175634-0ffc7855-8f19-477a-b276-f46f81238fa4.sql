
-- Criar tabela para contas WhatsApp
CREATE TABLE public.whatsapp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting', 'error')),
  qr_code TEXT,
  session_data JSONB DEFAULT '{}',
  account_id TEXT UNIQUE NOT NULL,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;

-- Política para visualizar próprias contas
CREATE POLICY "Users can view their own WhatsApp accounts" 
  ON public.whatsapp_accounts 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Política para criar próprias contas
CREATE POLICY "Users can create their own WhatsApp accounts" 
  ON public.whatsapp_accounts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Política para atualizar próprias contas
CREATE POLICY "Users can update their own WhatsApp accounts" 
  ON public.whatsapp_accounts 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Política para deletar próprias contas
CREATE POLICY "Users can delete their own WhatsApp accounts" 
  ON public.whatsapp_accounts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Índices para performance
CREATE INDEX idx_whatsapp_accounts_user_id ON public.whatsapp_accounts(user_id);
CREATE INDEX idx_whatsapp_accounts_account_id ON public.whatsapp_accounts(account_id);
CREATE INDEX idx_whatsapp_accounts_status ON public.whatsapp_accounts(status);
