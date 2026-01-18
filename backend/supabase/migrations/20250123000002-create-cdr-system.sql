-- =====================================================
-- MIGRAÇÃO: Sistema CDR (URA para WhatsApp) - Dohoo
-- Descrição: Criação das tabelas para o módulo CDR (Conexão Direta ao Responsável)
-- Data: 2025-01-23
-- =====================================================

-- 1. Tabela principal de configurações CDR
CREATE TABLE IF NOT EXISTS cdr_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES whatsapp_accounts(account_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    welcome_message TEXT NOT NULL,
    distribution_mode VARCHAR(20) CHECK (distribution_mode IN ('sequential', 'random')) DEFAULT 'sequential',
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id, account_id)
);

-- 2. Tabela de opções do menu CDR
CREATE TABLE IF NOT EXISTS cdr_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cdr_config_id UUID NOT NULL REFERENCES cdr_configs(id) ON DELETE CASCADE,
    option_number INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    group_id UUID, -- Referência para cdr_groups
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(cdr_config_id, option_number)
);

-- 3. Tabela de grupos CDR
CREATE TABLE IF NOT EXISTS cdr_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de usuários nos grupos CDR
CREATE TABLE IF NOT EXISTS cdr_group_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES cdr_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    phone_number VARCHAR(20), -- Telefone do WhatsApp do usuário
    priority INTEGER DEFAULT 0, -- Prioridade na distribuição (maior = mais prioritário)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- 5. Tabela de sessões ativas de clientes
CREATE TABLE IF NOT EXISTS cdr_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cdr_config_id UUID NOT NULL REFERENCES cdr_configs(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255),
    current_step VARCHAR(50) DEFAULT 'welcome', -- welcome, menu, waiting, completed
    selected_option INTEGER,
    group_id UUID REFERENCES cdr_groups(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) CHECK (status IN ('active', 'waiting', 'assigned', 'completed', 'cancelled')) DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Tabela de histórico de ativos (ligações enviadas)
CREATE TABLE IF NOT EXISTS cdr_actives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES cdr_sessions(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES cdr_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    message_sent TEXT,
    status VARCHAR(20) CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'error')) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_cdr_configs_org ON cdr_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_cdr_configs_account ON cdr_configs(account_id);
CREATE INDEX IF NOT EXISTS idx_cdr_options_config ON cdr_options(cdr_config_id);
CREATE INDEX IF NOT EXISTS idx_cdr_groups_org ON cdr_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_cdr_group_users_group ON cdr_group_users(group_id);
CREATE INDEX IF NOT EXISTS idx_cdr_group_users_user ON cdr_group_users(user_id);
CREATE INDEX IF NOT EXISTS idx_cdr_sessions_config ON cdr_sessions(cdr_config_id);
CREATE INDEX IF NOT EXISTS idx_cdr_sessions_phone ON cdr_sessions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_cdr_sessions_status ON cdr_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cdr_actives_session ON cdr_actives(session_id);
CREATE INDEX IF NOT EXISTS idx_cdr_actives_user ON cdr_actives(user_id);

-- 8. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_cdr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Triggers para updated_at
CREATE TRIGGER update_cdr_configs_updated_at 
    BEFORE UPDATE ON cdr_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_cdr_updated_at();

CREATE TRIGGER update_cdr_options_updated_at 
    BEFORE UPDATE ON cdr_options 
    FOR EACH ROW 
    EXECUTE FUNCTION update_cdr_updated_at();

CREATE TRIGGER update_cdr_groups_updated_at 
    BEFORE UPDATE ON cdr_groups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_cdr_updated_at();

CREATE TRIGGER update_cdr_sessions_updated_at 
    BEFORE UPDATE ON cdr_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_cdr_updated_at();

-- 10. Comentários para documentação
COMMENT ON TABLE cdr_configs IS 'Configurações principais do CDR (URA)';
COMMENT ON TABLE cdr_options IS 'Opções do menu do CDR (1, 2, 3, etc.)';
COMMENT ON TABLE cdr_groups IS 'Grupos de usuários que receberão os ativos';
COMMENT ON TABLE cdr_group_users IS 'Usuários dentro dos grupos CDR';
COMMENT ON TABLE cdr_sessions IS 'Sessões ativas de clientes interagindo com o CDR';
COMMENT ON TABLE cdr_actives IS 'Histórico de ativos (mensagens enviadas) para usuários dos grupos';

