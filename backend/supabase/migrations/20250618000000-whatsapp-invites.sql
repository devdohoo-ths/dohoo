-- Criar tabela para convites WhatsApp
CREATE TABLE public.whatsapp_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  organization_id UUID REFERENCES public.organizations NOT NULL,
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_invites ENABLE ROW LEVEL SECURITY;

-- Política para visualizar convites da própria organização
CREATE POLICY "Users can view invites from their organization" 
  ON public.whatsapp_invites 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Política para criar convites (apenas admins da organização)
CREATE POLICY "Admins can create invites for their organization" 
  ON public.whatsapp_invites 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid() AND user_role IN ('admin', 'super_admin')
    )
  );

-- Política para atualizar convites (apenas admins da organização)
CREATE POLICY "Admins can update invites for their organization" 
  ON public.whatsapp_invites 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid() AND user_role IN ('admin', 'super_admin')
    )
  );

-- Política para deletar convites (apenas admins da organização)
CREATE POLICY "Admins can delete invites for their organization" 
  ON public.whatsapp_invites 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid() AND user_role IN ('admin', 'super_admin')
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_invites_updated_at
  BEFORE UPDATE ON public.whatsapp_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Índices para performance
CREATE INDEX idx_whatsapp_invites_user_id ON public.whatsapp_invites(user_id);
CREATE INDEX idx_whatsapp_invites_organization_id ON public.whatsapp_invites(organization_id);
CREATE INDEX idx_whatsapp_invites_token ON public.whatsapp_invites(token);
CREATE INDEX idx_whatsapp_invites_status ON public.whatsapp_invites(status);
CREATE INDEX idx_whatsapp_invites_expires_at ON public.whatsapp_invites(expires_at);

-- Função para gerar token único
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql; 