-- Adicionar campo max_users na tabela organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 10;

-- Criar índice para melhorar performance de consultas por max_users
CREATE INDEX IF NOT EXISTS idx_organizations_max_users ON public.organizations(max_users);

-- Atualizar organizações existentes com valor padrão se necessário
UPDATE public.organizations 
SET max_users = 10 
WHERE max_users IS NULL; 