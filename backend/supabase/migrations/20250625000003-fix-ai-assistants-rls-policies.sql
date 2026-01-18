-- Corrigir políticas RLS da tabela ai_assistants
-- Remover políticas antigas baseadas em user_id
DROP POLICY IF EXISTS "Users can view their own assistants" ON public.ai_assistants;
DROP POLICY IF EXISTS "Users can create their own assistants" ON public.ai_assistants;
DROP POLICY IF EXISTS "Users can update their own assistants" ON public.ai_assistants;
DROP POLICY IF EXISTS "Users can delete their own assistants" ON public.ai_assistants;

-- Garantir que as políticas baseadas em organization_id estejam corretas
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

-- Adicionar política específica para INSERT
CREATE POLICY "Users can create ai assistants in their organization" ON public.ai_assistants
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  ); 