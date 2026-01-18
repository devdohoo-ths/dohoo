-- Create ai_settings table
CREATE TABLE public.ai_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{
        "general": {
            "enabled": true,
            "model": "gpt-4",
            "temperature": 0.7,
            "maxTokens": 2000
        },
        "audio": {
            "enabled": false,
            "provider": "none",
            "voiceId": "",
            "language": "pt-BR"
        },
        "image": {
            "enabled": false,
            "provider": "none",
            "model": "dall-e-3",
            "size": "1024x1024"
        }
    }',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments to the table and columns
COMMENT ON TABLE public.ai_settings IS 'Stores AI settings for organizations.';
COMMENT ON COLUMN public.ai_settings.organization_id IS 'The organization these settings belong to.';
COMMENT ON COLUMN public.ai_settings.settings IS 'JSON configuration for AI features.';

-- Enable Row Level Security
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's AI settings"
    ON public.ai_settings
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their organization's AI settings"
    ON public.ai_settings
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
            AND user_role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
            AND user_role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Users can insert their organization's AI settings"
    ON public.ai_settings
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
            AND user_role IN ('admin', 'super_admin')
        )
    );

-- Trigger to update 'updated_at' timestamp
CREATE TRIGGER handle_ai_settings_updated_at
    BEFORE UPDATE ON public.ai_settings
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_ai_settings_organization_id ON public.ai_settings(organization_id); 