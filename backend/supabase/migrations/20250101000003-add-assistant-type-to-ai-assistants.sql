-- Add assistant_type column to ai_assistants table
-- This column will distinguish between individual and organizational AI assistants

ALTER TABLE public.ai_assistants 
ADD COLUMN IF NOT EXISTS assistant_type text DEFAULT 'individual' CHECK (assistant_type IN ('individual', 'organizational'));

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.ai_assistants.assistant_type IS 'Type of AI assistant: individual (1:1) or organizational (shared within organization)';

-- Create index for better query performance when filtering by assistant_type
CREATE INDEX IF NOT EXISTS idx_ai_assistants_assistant_type 
ON public.ai_assistants(assistant_type);

-- Update existing records to have a default value
-- This ensures all existing assistants are marked as individual by default
UPDATE public.ai_assistants 
SET assistant_type = 'individual' 
WHERE assistant_type IS NULL; 