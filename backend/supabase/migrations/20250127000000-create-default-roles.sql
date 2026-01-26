-- Criar tabela default_roles se não existir
CREATE TABLE IF NOT EXISTS public.default_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  permissions jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT default_roles_pkey PRIMARY KEY (id)
);

-- Inserir os 4 níveis de acesso padrão
-- 1. SuperAdmin (principal - somente para funcionários Dohoo)
INSERT INTO public.default_roles (name, description, permissions, is_active)
VALUES (
  'superAdmin',
  'Super Administrador - Acesso total ao sistema (somente para funcionários Dohoo)',
  '{
    "chat": true,
    "analytics": true,
    "users": true,
    "settings": true,
    "organizations": true,
    "manage_rules": true,
    "manage_blacklist": true,
    "manage_departments": true,
    "manage_roles": true,
    "view_all_organizations": true,
    "manage_all_organizations": true,
    "system_settings": true,
    "ai": true,
    "reports": true,
    "database": true
  }'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- 2. Admin (Administrador da organização)
INSERT INTO public.default_roles (name, description, permissions, is_active)
VALUES (
  'admin',
  'Administrador - Acesso completo à organização',
  '{
    "chat": true,
    "analytics": true,
    "users": true,
    "settings": true,
    "organizations": false,
    "manage_rules": true,
    "manage_blacklist": true,
    "manage_departments": true,
    "manage_roles": true,
    "view_all_organizations": false,
    "manage_all_organizations": false,
    "system_settings": false,
    "ai": true,
    "reports": true,
    "database": false
  }'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- 3. Supervisor (Supervisor de equipe)
INSERT INTO public.default_roles (name, description, permissions, is_active)
VALUES (
  'supervisor',
  'Supervisor - Acesso para supervisionar equipe e visualizar relatórios',
  '{
    "chat": true,
    "analytics": true,
    "users": false,
    "settings": false,
    "organizations": false,
    "manage_rules": false,
    "manage_blacklist": false,
    "manage_departments": false,
    "manage_roles": false,
    "view_all_organizations": false,
    "manage_all_organizations": false,
    "system_settings": false,
    "ai": true,
    "reports": true,
    "database": false
  }'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- 4. Agente (Agente de atendimento)
INSERT INTO public.default_roles (name, description, permissions, is_active)
VALUES (
  'agente',
  'Agente - Acesso básico para atendimento ao cliente',
  '{
    "chat": true,
    "analytics": false,
    "users": false,
    "settings": false,
    "organizations": false,
    "manage_rules": false,
    "manage_blacklist": false,
    "manage_departments": false,
    "manage_roles": false,
    "view_all_organizations": false,
    "manage_all_organizations": false,
    "system_settings": false,
    "ai": true,
    "reports": false,
    "database": false
  }'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- Comentários na tabela
COMMENT ON TABLE public.default_roles IS 'Roles padrão do sistema (globais, não vinculados a organizações)';
COMMENT ON COLUMN public.default_roles.name IS 'Nome único do role (superAdmin, admin, supervisor, agente)';
COMMENT ON COLUMN public.default_roles.permissions IS 'Permissões do role em formato JSONB';
COMMENT ON COLUMN public.default_roles.is_active IS 'Se o role está ativo e pode ser usado';

