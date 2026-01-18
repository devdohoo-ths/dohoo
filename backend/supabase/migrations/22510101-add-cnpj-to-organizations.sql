-- Adicionar campo CNPJ na tabela organizations
ALTER TABLE public.organizations 
ADD COLUMN cnpj TEXT;

-- Criar índice para melhorar performance de consultas por CNPJ
CREATE INDEX idx_organizations_cnpj ON public.organizations(cnpj); 