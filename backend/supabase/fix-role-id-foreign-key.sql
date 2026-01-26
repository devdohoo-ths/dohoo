-- ============================================
-- CORRIGIR FOREIGN KEY PARA PERMITIR ROLES DE default_roles E roles
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- para corrigir o problema de foreign key constraint
-- ============================================

-- 1. Remover a foreign key constraint atual
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_id_fkey;

-- 2. Criar função para validar se role_id existe em roles OU default_roles
CREATE OR REPLACE FUNCTION public.validate_role_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se role_id é NULL, permitir (não obrigatório)
  IF NEW.role_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se existe na tabela roles
  IF EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se existe na tabela default_roles
  IF EXISTS (SELECT 1 FROM public.default_roles WHERE id = NEW.role_id) THEN
    RETURN NEW;
  END IF;
  
  -- Se não encontrou em nenhuma das duas tabelas, lançar erro
  RAISE EXCEPTION 'Role ID % não existe em roles ou default_roles', NEW.role_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para validar antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS validate_role_id_trigger ON public.profiles;
CREATE TRIGGER validate_role_id_trigger
  BEFORE INSERT OR UPDATE OF role_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_id();

-- 4. Comentários
COMMENT ON FUNCTION public.validate_role_id() IS 'Valida se role_id existe em roles ou default_roles antes de inserir/atualizar profiles';
COMMENT ON TRIGGER validate_role_id_trigger ON public.profiles IS 'Garante que role_id referencie uma role válida em roles ou default_roles';

-- 5. Verificar se a função foi criada corretamente
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc 
WHERE proname = 'validate_role_id';

