
-- Create ai_assistants table
CREATE TABLE public.ai_assistants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    personality TEXT,
    instructions TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments to the table and columns
COMMENT ON TABLE public.ai_assistants IS 'Stores AI assistant configurations.';
COMMENT ON COLUMN public.ai_assistants.user_id IS 'The user who owns this assistant.';
COMMENT ON COLUMN public.ai_assistants.avatar_url IS 'URL for the assistant''s avatar image.';

-- Enable Row Level Security
ALTER TABLE public.ai_assistants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own assistants"
ON public.ai_assistants
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assistants"
ON public.ai_assistants
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assistants"
ON public.ai_assistants
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assistants"
ON public.ai_assistants
FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update 'updated_at' timestamp
CREATE TRIGGER handle_ai_assistants_updated_at
BEFORE UPDATE ON public.ai_assistants
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();
