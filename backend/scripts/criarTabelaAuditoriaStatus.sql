-- =====================================================
-- CRIAÇÃO DE TABELA DE AUDITORIA DE STATUS
-- =====================================================
-- Esta tabela registra TODAS as mudanças de status de contas WhatsApp
-- para permitir análise histórica e identificação de problemas

-- 1. Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS whatsapp_status_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    account_name TEXT,
    organization_id UUID,
    old_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT, -- Razão da mudança (ex: 'connection.update', 'health_check', 'manual')
    metadata JSONB DEFAULT '{}'::jsonb, -- Dados adicionais (socket state, error codes, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Índices para performance
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(account_id) ON DELETE CASCADE
);

-- 2. Criar índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_status_audit_account_id ON whatsapp_status_audit(account_id);
CREATE INDEX IF NOT EXISTS idx_status_audit_created_at ON whatsapp_status_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_status_audit_new_status ON whatsapp_status_audit(new_status);
CREATE INDEX IF NOT EXISTS idx_status_audit_organization ON whatsapp_status_audit(organization_id);

-- 3. Criar função para registrar mudanças automaticamente via trigger
CREATE OR REPLACE FUNCTION log_whatsapp_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Só registrar se o status realmente mudou
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO whatsapp_status_audit (
            account_id,
            account_name,
            organization_id,
            old_status,
            new_status,
            reason,
            metadata
        ) VALUES (
            NEW.account_id,
            NEW.name,
            NEW.organization_id,
            OLD.status,
            NEW.status,
            'database_trigger', -- Indica que foi mudança direta no banco
            jsonb_build_object(
                'updated_at', NEW.updated_at,
                'phone_number', NEW.phone_number
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para registrar mudanças automaticamente
DROP TRIGGER IF EXISTS trigger_log_whatsapp_status_change ON whatsapp_accounts;
CREATE TRIGGER trigger_log_whatsapp_status_change
    AFTER UPDATE OF status ON whatsapp_accounts
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_whatsapp_status_change();

-- 5. Criar view para facilitar consultas
CREATE OR REPLACE VIEW vw_status_changes_recent AS
SELECT 
    sa.id,
    sa.account_id,
    sa.account_name,
    sa.organization_id,
    sa.old_status,
    sa.new_status,
    sa.reason,
    sa.metadata,
    sa.created_at,
    CASE 
        WHEN sa.old_status = 'connected' AND sa.new_status = 'connecting' THEN '⚠️ REGRESSÃO'
        WHEN sa.old_status = 'connected' AND sa.new_status = 'disconnected' THEN '🔌 DESCONEXÃO'
        WHEN sa.old_status = 'connecting' AND sa.new_status = 'connected' THEN '✅ CONEXÃO'
        WHEN sa.old_status = 'connecting' AND sa.new_status = 'disconnected' THEN '❌ FALHA'
        ELSE '🔄 MUDANÇA'
    END as tipo_mudanca
FROM whatsapp_status_audit sa
WHERE sa.created_at >= NOW() - INTERVAL '7 days'
ORDER BY sa.created_at DESC;

-- 6. Criar função para consultar histórico de uma conta
CREATE OR REPLACE FUNCTION get_account_status_history(
    p_account_id TEXT,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    id UUID,
    old_status TEXT,
    new_status TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    tipo_mudanca TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.id,
        sa.old_status,
        sa.new_status,
        sa.reason,
        sa.created_at,
        CASE 
            WHEN sa.old_status = 'connected' AND sa.new_status = 'connecting' THEN '⚠️ REGRESSÃO'
            WHEN sa.old_status = 'connected' AND sa.new_status = 'disconnected' THEN '🔌 DESCONEXÃO'
            WHEN sa.old_status = 'connecting' AND sa.new_status = 'connected' THEN '✅ CONEXÃO'
            WHEN sa.old_status = 'connecting' AND sa.new_status = 'disconnected' THEN '❌ FALHA'
            ELSE '🔄 MUDANÇA'
        END
    FROM whatsapp_status_audit sa
    WHERE sa.account_id = p_account_id
      AND sa.created_at >= NOW() - (p_days || ' days')::INTERVAL
    ORDER BY sa.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. Comentários para documentação
COMMENT ON TABLE whatsapp_status_audit IS 'Auditoria de todas as mudanças de status de contas WhatsApp';
COMMENT ON COLUMN whatsapp_status_audit.reason IS 'Razão da mudança: connection.update, health_check, manual, database_trigger, etc.';
COMMENT ON COLUMN whatsapp_status_audit.metadata IS 'Dados adicionais: socket state, error codes, timestamps, etc.';

-- =====================================================
-- EXEMPLOS DE CONSULTAS ÚTEIS
-- =====================================================

-- Consultar todas as regressões (connected -> connecting) nos últimos 7 dias
-- SELECT * FROM vw_status_changes_recent WHERE tipo_mudanca = '⚠️ REGRESSÃO';

-- Consultar histórico de uma conta específica
-- SELECT * FROM get_account_status_history('account_id_aqui', 7);

-- Contar mudanças por tipo nos últimos 24 horas
-- SELECT tipo_mudanca, COUNT(*) as total 
-- FROM vw_status_changes_recent 
-- WHERE created_at >= NOW() - INTERVAL '24 hours'
-- GROUP BY tipo_mudanca;

-- Identificar contas com muitas mudanças (possível intermitência)
-- SELECT account_id, account_name, COUNT(*) as mudancas
-- FROM whatsapp_status_audit
-- WHERE created_at >= NOW() - INTERVAL '24 hours'
-- GROUP BY account_id, account_name
-- HAVING COUNT(*) > 5
-- ORDER BY mudancas DESC;

