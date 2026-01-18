-- Adicionar campo deleted_at na tabela organizations para suportar soft delete
ALTER TABLE public.organizations 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhorar performance de consultas que filtram por deleted_at
CREATE INDEX idx_organizations_deleted_at ON public.organizations(deleted_at);

-- Atualizar RLS para considerar organizações desativadas
DROP POLICY IF EXISTS "Users can see their own organization" ON public.organizations;
CREATE POLICY "Users can see their own organization" 
  ON public.organizations 
  FOR SELECT 
  USING (
    id IN (
      SELECT organization_id FROM public.profiles 
      WHERE profiles.id = auth.uid()
    ) AND deleted_at IS NULL
  );

-- Política para super admins verem todas as organizações (incluindo desativadas)
CREATE POLICYSuper admins can see all organizations including deleted" 
  ON public.organizations 
  FOR ALL 
  USING (
    EXISTS (
      SELECT1OM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_role =super_admin'
    )
  ); 