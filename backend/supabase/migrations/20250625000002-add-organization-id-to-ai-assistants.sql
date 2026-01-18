-- Adicionar coluna organization_id na tabela ai_assistants
ALTER TABLE public.ai_assistants 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_ai_assistants_organization_id ON public.ai_assistants(organization_id);

-- Atualizar políticas RLS se necessário
DROP POLICY IF EXISTS "Users can view ai assistants in their organization" ON public.ai_assistants;
CREATE POLICY "Users can view ai assistants in their organization" ON public.ai_assistants
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage ai assistants in their organization" ON public.ai_assistants;
CREATE POLICY "Users can manage ai assistants in their organization" ON public.ai_assistants
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  ); 