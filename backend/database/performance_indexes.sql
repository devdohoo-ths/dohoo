-- ✅ OTIMIZAÇÕES DE PERFORMANCE: Índices para melhorar queries frequentes
-- Execute este script no banco de dados Supabase para melhorar performance

-- Índices para tabela messages (queries mais frequentes)
CREATE INDEX IF NOT EXISTS idx_messages_organization_created 
ON messages(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created 
ON messages(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_created 
ON messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_is_from_me_created 
ON messages(is_from_me, created_at DESC) 
WHERE is_from_me = true;

CREATE INDEX IF NOT EXISTS idx_messages_organization_from_me 
ON messages(organization_id, is_from_me, created_at DESC);

-- Índices para tabela chats
CREATE INDEX IF NOT EXISTS idx_chats_organization_status 
ON chats(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_chats_assigned_agent 
ON chats(assigned_agent_id, status) 
WHERE assigned_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chats_organization_updated 
ON chats(organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_unread_count 
ON chats(organization_id, unread_count) 
WHERE unread_count > 0;

-- Índices para tabela whatsapp_accounts
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_organization_status 
ON whatsapp_accounts(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_user_status 
ON whatsapp_accounts(user_id, status);

-- Índices para tabela profiles
CREATE INDEX IF NOT EXISTS idx_profiles_organization 
ON profiles(organization_id) 
WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles(role_id) 
WHERE role_id IS NOT NULL;

-- Índices para tabela organizations
CREATE INDEX IF NOT EXISTS idx_organizations_deleted 
ON organizations(deleted_at) 
WHERE deleted_at IS NULL;

-- Índices compostos para relatórios
CREATE INDEX IF NOT EXISTS idx_messages_org_date_from_me 
ON messages(organization_id, created_at, is_from_me);

CREATE INDEX IF NOT EXISTS idx_chats_org_agent_status 
ON chats(organization_id, assigned_agent_id, status, updated_at DESC);

-- Índice para busca full-text (se necessário)
-- CREATE INDEX IF NOT EXISTS idx_messages_content_search 
-- ON messages USING gin(to_tsvector('portuguese', content));

-- Estatísticas atualizadas (executar periodicamente)
-- ANALYZE messages;
-- ANALYZE chats;
-- ANALYZE whatsapp_accounts;
-- ANALYZE profiles;

