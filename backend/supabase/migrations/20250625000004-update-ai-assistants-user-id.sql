-- Atualizar dados existentes da tabela ai_assistants
-- Populate organization_id baseado no user_id dos assistentes existentes
UPDATE public.ai_assistants 
SET organization_id = (
    SELECT p.organization_id 
    FROM public.profiles p 
    WHERE p.id = ai_assistants.user_id
)
WHERE organization_id IS NULL;

-- Tornar user_id opcional (não NOT NULL)
ALTER TABLE public.ai_assistants 
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.ai_assistants.user_id IS 'User who created the assistant (optional, organization-based access now)';
COMMENT ON COLUMN public.ai_assistants.organization_id IS 'Organization that owns this assistant (primary access control)'; 