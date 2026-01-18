-- =====================================================
-- ESTRUTURA UNIFICADA PARA CONTAS DE CONEXÃO
-- =====================================================

-- 1. Criar tabela connection_accounts
CREATE TABLE IF NOT EXISTS connection_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('whatsapp', 'telegram', 'facebook', 'instagram', 'api')),
  status VARCHAR(50) NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'connecting', 'disconnected', 'error')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_connection_accounts_platform ON connection_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_connection_accounts_user_id ON connection_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_accounts_org_id ON connection_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_connection_accounts_assigned_to ON connection_accounts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_connection_accounts_status ON connection_accounts(status);
CREATE INDEX IF NOT EXISTS idx_connection_accounts_platform_org ON connection_accounts(platform, organization_id);

-- 3. Migrar dados existentes da tabela whatsapp_accounts
INSERT INTO connection_accounts (
  id,
  name,
  platform,
  status,
  user_id,
  organization_id,
  assigned_to,
  config,
  created_at,
  updated_at
)
SELECT 
  account_id,
  name,
  'whatsapp' as platform,
  status,
  user_id,
  NULL as organization_id, -- Será atualizado depois
  user_id as assigned_to, -- Assumindo que o criador é o responsável
  jsonb_build_object(
    'phone_number', phone_number,
    'qr_code', qr_code,
    'session_data', session_data,
    'last_connected_at', last_connected_at
  ) as config,
  created_at,
  updated_at
FROM whatsapp_accounts
WHERE account_id NOT IN (SELECT id FROM connection_accounts);

-- 4. Atualizar estrutura de permissões na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS platform_permissions JSONB DEFAULT '{
  "whatsapp": {"view": true, "create": false, "manage": false, "viewAll": false},
  "telegram": {"view": false, "create": false, "manage": false, "viewAll": false},
  "facebook": {"view": false, "create": false, "manage": false, "viewAll": false},
  "instagram": {"view": false, "create": false, "manage": false, "viewAll": false},
  "api": {"view": false, "create": false, "manage": false, "viewAll": false}
}';

-- 5. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Trigger para atualizar updated_at
CREATE TRIGGER update_connection_accounts_updated_at 
    BEFORE UPDATE ON connection_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Políticas RLS (Row Level Security)
ALTER TABLE connection_accounts ENABLE ROW LEVEL SECURITY;

-- Política para visualizar contas próprias
CREATE POLICY "Users can view their own accounts" ON connection_accounts
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() = assigned_to OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.platform_permissions->platform->>'viewAll' = 'true'
        )
    );

-- Política para criar contas (apenas admins)
CREATE POLICY "Admins can create accounts" ON connection_accounts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.platform_permissions->platform->>'create' = 'true'
        )
    );

-- Política para atualizar contas
CREATE POLICY "Users can update their accounts" ON connection_accounts
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        auth.uid() = assigned_to OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.platform_permissions->platform->>'manage' = 'true'
        )
    );

-- Política para deletar contas (apenas admins)
CREATE POLICY "Admins can delete accounts" ON connection_accounts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.platform_permissions->platform->>'manage' = 'true'
        )
    );

-- 8. Função para obter contas por plataforma e permissões
CREATE OR REPLACE FUNCTION get_connection_accounts_by_platform(
    platform_name VARCHAR(50),
    user_uuid UUID DEFAULT auth.uid()
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    platform VARCHAR(50),
    status VARCHAR(50),
    user_id UUID,
    organization_id UUID,
    assigned_to UUID,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    assigned_user_name VARCHAR(255),
    assigned_user_email VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.id,
        ca.name,
        ca.platform,
        ca.status,
        ca.user_id,
        ca.organization_id,
        ca.assigned_to,
        ca.config,
        ca.created_at,
        ca.updated_at,
        p.name as assigned_user_name,
        p.email as assigned_user_email
    FROM connection_accounts ca
    LEFT JOIN profiles p ON ca.assigned_to = p.id
    WHERE ca.platform = platform_name
    AND (
        ca.user_id = user_uuid OR 
        ca.assigned_to = user_uuid OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = user_uuid 
            AND profiles.platform_permissions->platform_name->>'viewAll' = 'true'
        )
    )
    ORDER BY ca.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Comentários para documentação
COMMENT ON TABLE connection_accounts IS 'Tabela unificada para contas de todas as plataformas de conexão';
COMMENT ON COLUMN connection_accounts.platform IS 'Plataforma: whatsapp, telegram, facebook, instagram, api';
COMMENT ON COLUMN connection_accounts.config IS 'Configurações específicas da plataforma em formato JSON';
COMMENT ON COLUMN connection_accounts.assigned_to IS 'Usuário responsável pela conta (pode ser diferente do criador)';

-- 10. Valores padrão para permissões de admin
UPDATE profiles 
SET platform_permissions = '{
  "whatsapp": {"view": true, "create": true, "manage": true, "viewAll": true},
  "telegram": {"view": true, "create": true, "manage": true, "viewAll": true},
  "facebook": {"view": true, "create": true, "manage": true, "viewAll": true},
  "instagram": {"view": true, "create": true, "manage": true, "viewAll": true},
  "api": {"view": true, "create": true, "manage": true, "viewAll": true}
}'
WHERE user_role IN ('admin', 'super_admin');

-- 11. Valores padrão para permissões de agente
UPDATE profiles 
SET platform_permissions = '{
  "whatsapp": {"view": true, "create": false, "manage": false, "viewAll": false},
  "telegram": {"view": false, "create": false, "manage": false, "viewAll": false},
  "facebook": {"view": false, "create": false, "manage": false, "viewAll": false},
  "instagram": {"view": false, "create": false, "manage": false, "viewAll": false},
  "api": {"view": false, "create": false, "manage": false, "viewAll": false}
}'
WHERE user_role = 'agent';

