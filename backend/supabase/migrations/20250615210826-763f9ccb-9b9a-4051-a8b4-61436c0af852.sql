
-- Create table for Q&A training data linked to an assistant
CREATE TABLE public.ai_training_data (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assistant_id uuid NOT NULL REFERENCES public.ai_assistants(id) ON DELETE CASCADE,
    question text NOT NULL,
    answer text NOT NULL,
    category text,
    tags text[],
    validated boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for ai_training_data
ALTER TABLE public.ai_training_data ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to manage training data for their own assistants
CREATE POLICY "Users can manage training data for their own assistants"
ON public.ai_training_data
FOR ALL
USING (
  auth.uid() = (
    SELECT user_id FROM public.ai_assistants WHERE id = assistant_id
  )
)
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.ai_assistants WHERE id = assistant_id
  )
);

-- Create table for knowledge base documents linked to an assistant
CREATE TABLE public.ai_knowledge_bases (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assistant_id uuid NOT NULL REFERENCES public.ai_assistants(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    type text NOT NULL DEFAULT 'general'::text,
    tags text[],
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for ai_knowledge_bases
ALTER TABLE public.ai_knowledge_bases ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to manage knowledge bases for their own assistants
CREATE POLICY "Users can manage knowledge bases for their own assistants"
ON public.ai_knowledge_bases
FOR ALL
USING (
  auth.uid() = (
    SELECT user_id FROM public.ai_assistants WHERE id = assistant_id
  )
)
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.ai_assistants WHERE id = assistant_id
  )
);
