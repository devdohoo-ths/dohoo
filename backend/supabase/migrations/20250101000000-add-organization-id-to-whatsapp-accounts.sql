-- Adicionar organization_id à tabela whatsapp_accounts
ALTER TABLE public.whatsapp_accounts
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_organization_id ON public.whatsapp_accounts(organization_id);

-- Atualizar contas existentes com organization_id baseado no user_id
UPDATE public.whatsapp_accounts
SET organization_id = (
  SELECT organization_id 
  FROM public.profiles 
  WHERE profiles.id = whatsapp_accounts.user_id
)
WHERE organization_id IS NULL;

-- Tornar organization_id NOT NULL após atualizar dados existentes
ALTER TABLE public.whatsapp_accounts
ALTER COLUMN organization_id SET NOT NULL;

-- Remover políticas antigas baseadas apenas em user_id
DROP POLICY IF EXISTS "Users can view their own WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Users can create their own WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Users can update their own WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Users can delete their own WhatsApp accounts" ON public.whatsapp_accounts;

-- Criar novas políticas baseadas em organization_id
CREATE POLICY "Users can view WhatsApp accounts from their organization" 
  ON public.whatsapp_accounts 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create WhatsApp accounts in their organization" 
  ON public.whatsapp_accounts 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update WhatsApp accounts from their organization" 
  ON public.whatsapp_accounts 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete WhatsApp accounts from their organization" 
  ON public.whatsapp_accounts 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.whatsapp_accounts.organization_id IS 'The organization this WhatsApp account belongs to. Used for multi-tenant isolation.'; 