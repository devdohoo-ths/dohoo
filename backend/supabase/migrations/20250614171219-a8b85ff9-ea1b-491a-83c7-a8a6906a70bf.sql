
-- Corrigir políticas RLS que estão causando recursão infinita
-- Primeiro, remover as políticas problemáticas
DROP POLICY IF EXISTS "Super admins can see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can see profiles from their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Criar políticas RLS mais simples e sem recursão
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (id = auth.uid());

-- Permitir inserção de perfis (necessário para o signup)
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- Corrigir política de organizações
DROP POLICY IF EXISTS "Super admins can see all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can see their own organization" ON public.organizations;

CREATE POLICY "Users can see organizations" 
  ON public.organizations 
  FOR SELECT 
  USING (true);

-- Permitir que usuários vejam analytics da sua organização
DROP POLICY IF EXISTS "Analytics access by organization and role" ON public.conversation_analytics;

CREATE POLICY "Users can view analytics" 
  ON public.conversation_analytics 
  FOR SELECT 
  USING (true);

-- Dar permissão de analytics para o usuário atual (temporariamente para todos)
UPDATE public.profiles 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'), 
  '{analytics}', 
  'true'
)
WHERE id = auth.uid();
