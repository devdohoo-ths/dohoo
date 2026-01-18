-- Garantir que a tabela profiles tenha a estrutura correta
-- Adicionar organization_id se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Adicionar user_role se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_role public.user_role DEFAULT 'agent';

-- Adicionar permissions se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"chat": true, "analytics": false, "users": false, "settings": false}';

-- Criar organização padrão se não existir
INSERT INTO public.organizations (name, domain, settings) 
VALUES ('Organização Padrão', 'default', '{}') 
ON CONFLICT DO NOTHING;

-- Associar usuários sem organização à organização padrão
UPDATE public.profiles 
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE domain = 'default' 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Garantir que todos os usuários tenham um role
UPDATE public.profiles 
SET user_role = 'agent' 
WHERE user_role IS NULL;

-- Garantir que todos os usuários tenham permissions
UPDATE public.profiles 
SET permissions = '{"chat": true, "analytics": false, "users": false, "settings": false}' 
WHERE permissions IS NULL;

-- Criar super admin se não existir
INSERT INTO public.profiles (id, name, user_role, organization_id, permissions)
SELECT 
  auth.uid(),
  COALESCE(auth.raw_user_meta_data()->>'name', auth.email),
  'super_admin',
  (SELECT id FROM public.organizations WHERE domain = 'default' LIMIT 1),
  '{"chat": true, "analytics": true, "users": true, "settings": true}'
FROM auth.users 
WHERE auth.email = 'admin@example.com' -- Substitua pelo email do super admin
ON CONFLICT (id) DO UPDATE SET
  user_role = 'super_admin',
  permissions = '{"chat": true, "analytics": true, "users": true, "settings": true}'; 