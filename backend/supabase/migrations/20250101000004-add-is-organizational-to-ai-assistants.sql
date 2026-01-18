-- Add is_organizational column to ai_assistants table
-- This column will explicitly mark if an AI assistant belongs to the organization (true) or individual user (false)

ALTER TABLE public.ai_assistants 
ADD COLUMN IF NOT EXISTS is_organizational boolean DEFAULT false;

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.ai_assistants.is_organizational IS 'Whether the AI assistant belongs to the organization (true) or individual user (false)';

-- Create index for better query performance when filtering by is_organizational
CREATE INDEX IF NOT EXISTS idx_ai_assistants_is_organizational 
ON public.ai_assistants(is_organizational);

-- Update existing records to have appropriate default values
-- If assistant_type is 'organizational', set is_organizational to true
-- If assistant_type is 'individual' or null, set is_organizational to false
UPDATE public.ai_assistants 
SET is_organizational = CASE 
    WHEN assistant_type = 'organizational' THEN true
    ELSE false
END
WHERE is_organizational IS NULL;

-- Set NOT NULL constraint after updating existing records
ALTER TABLE public.ai_assistants 
ALTER COLUMN is_organizational SET NOT NULL; 