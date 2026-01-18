
-- Criar tabela de organizações
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar enum para roles do sistema
CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin', 'agent');

-- Atualizar tabela profiles para incluir organização e role
ALTER TABLE public.profiles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id),
ADD COLUMN user_role public.user_role DEFAULT 'agent',
ADD COLUMN permissions JSONB DEFAULT '{"chat": true, "analytics": false, "users": false, "settings": false}';

-- Criar tabela para analytics de conversas
CREATE TABLE public.conversation_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  analysis_data JSONB DEFAULT '{}',
  keywords JSONB DEFAULT '[]',
  sentiment_score DECIMAL(3,2),
  interaction_count INTEGER DEFAULT 0,
  resolution_status TEXT DEFAULT 'pending',
  priority_level TEXT DEFAULT 'medium',
  customer_satisfaction DECIMAL(3,2),
  response_time_avg DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Atualizar tabela chats para incluir organização
ALTER TABLE public.chats 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Atualizar tabela messages para incluir organização
ALTER TABLE public.messages 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- RLS para organizações
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can see all organizations" 
  ON public.organizations 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_role = 'super_admin'
    )
  );

CREATE POLICY "Users can see their own organization" 
  ON public.organizations 
  FOR SELECT 
  USING (
    id IN (
      SELECT organization_id FROM public.profiles 
      WHERE profiles.id = auth.uid()
    )
  );

-- RLS para analytics
ALTER TABLE public.conversation_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics access by organization and role" 
  ON public.conversation_analytics 
  FOR ALL 
  USING (
    organization_id IN (
      SELECT profiles.organization_id FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.user_role = 'super_admin' OR
        (profiles.user_role IN ('admin', 'agent') AND profiles.permissions->>'analytics' = 'true')
      )
    )
  );

-- Atualizar RLS para chats com organização
DROP POLICY IF EXISTS "Users can view chats from their organization" ON public.chats;
CREATE POLICY "Users can view chats from their organization" 
  ON public.chats 
  FOR ALL 
  USING (
    organization_id IN (
      SELECT profiles.organization_id FROM public.profiles 
      WHERE profiles.id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_role = 'super_admin'
    )
  );

-- Atualizar RLS para messages com organização
DROP POLICY IF EXISTS "Users can view messages from their organization" ON public.messages;
CREATE POLICY "Users can view messages from their organization" 
  ON public.messages 
  FOR ALL 
  USING (
    organization_id IN (
      SELECT profiles.organization_id FROM public.profiles 
      WHERE profiles.id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_role = 'super_admin'
    )
  );

-- Atualizar RLS para profiles
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Super admins can see all profiles" 
  ON public.profiles 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.user_role = 'super_admin'
    )
  );

CREATE POLICY "Users can see profiles from their organization" 
  ON public.profiles 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (id = auth.uid());

-- Triggers para updated_at
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON public.organizations 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_conversation_analytics_updated_at 
  BEFORE UPDATE ON public.conversation_analytics 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Inserir organização padrão e super admin
INSERT INTO public.organizations (name, domain) 
VALUES ('Sistema Principal', 'admin.sistema.com') 
ON CONFLICT DO NOTHING;
