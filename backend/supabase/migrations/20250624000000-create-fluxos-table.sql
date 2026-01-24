-- Criar tabela de fluxos
CREATE TABLE IF NOT EXISTS public.fluxos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT FALSE,
  canal TEXT DEFAULT 'whatsapp',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_fluxos_updated_at ON public.fluxos;
CREATE TRIGGER update_fluxos_updated_at 
  BEFORE UPDATE ON public.fluxos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.fluxos ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view flows from their organization" ON public.fluxos 
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create flows in their organization" ON public.fluxos 
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update flows in their organization" ON public.fluxos 
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete flows in their organization" ON public.fluxos 
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_fluxos_organization_id ON public.fluxos(organization_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_user_id ON public.fluxos(user_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_ativo ON public.fluxos(ativo);
CREATE INDEX IF NOT EXISTS idx_fluxos_canal ON public.fluxos(canal);

-- Adicionar índice único parcial para garantir que apenas um fluxo ativo por organização e canal
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_flow_per_org_canal 
ON public.fluxos(organization_id, canal) 
WHERE ativo = true; 