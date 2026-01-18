-- Criar tabela profiles se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  department TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  organization_id UUID REFERENCES public.organizations(id),
  user_role public.user_role DEFAULT 'agent',
  permissions JSONB DEFAULT '{"chat": true, "analytics": false, "users": false, "settings": false}',
  show_name_in_chat BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas se não existirem
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS user_role public.user_role DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"chat": true, "analytics": false, "users": false, "settings": false}',
ADD COLUMN IF NOT EXISTS show_name_in_chat BOOLEAN DEFAULT TRUE;

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, user_role, organization_id, permissions)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'agent',
    (SELECT id FROM public.organizations WHERE domain = 'default' LIMIT 1),
    '{"chat": true, "analytics": false, "users": false, "settings": false}'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar organização padrão se não existir
INSERT INTO public.organizations (name, domain, settings) 
VALUES ('Organização Padrão', 'default', '{}') 
ON CONFLICT DO NOTHING;

-- Associar usuários existentes sem organização à organização padrão
UPDATE public.profiles 
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE domain = 'default' 
  LIMIT 1
)
WHERE organization_id IS NULL; 