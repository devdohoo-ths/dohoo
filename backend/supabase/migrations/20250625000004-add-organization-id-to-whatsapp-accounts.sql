-- Adicionar coluna organization_id à tabela whatsapp_accounts
ALTER TABLE public.whatsapp_accounts
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Criar índice para otimizar consultas por organização
CREATE INDEX idx_whatsapp_accounts_organization_id ON public.whatsapp_accounts(organization_id);

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.whatsapp_accounts.organization_id IS 'ID da organização à qual a conta WhatsApp pertence';

-- Atualizar políticas RLS para incluir organization_id
DROP POLICY IF EXISTS "Users can view their own WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Users can view WhatsApp accounts from their organization" 
  ON public.whatsapp_accounts 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create their own WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Users can create WhatsApp accounts for their organization" 
  ON public.whatsapp_accounts 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Users can update WhatsApp accounts from their organization" 
  ON public.whatsapp_accounts 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Users can delete WhatsApp accounts from their organization" 
  ON public.whatsapp_accounts 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  ); 