-- =====================================================
-- MIGRAÇÃO: Sistema de Blacklist - Dohoo v2.0
-- Descrição: Criação da tabela para gerenciar números bloqueados
-- Data: 2025-01-23
-- =====================================================

-- 1. Tabela principal de blacklist
CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    numero_telefone TEXT NOT NULL,
    motivo TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id, numero_telefone)
);

-- 2. Tabela de logs da blacklist para auditoria
CREATE TABLE IF NOT EXISTS blacklist_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blacklist_id UUID REFERENCES blacklist(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    acao TEXT NOT NULL CHECK (acao IN ('adicionado', 'removido', 'ativado', 'desativado')),
    numero_telefone TEXT NOT NULL,
    motivo TEXT,
    detalhes JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice para busca rápida por organização e número
CREATE INDEX IF NOT EXISTS idx_blacklist_org_numero ON blacklist(organization_id, numero_telefone);

-- Índice para busca por status ativo
CREATE INDEX IF NOT EXISTS idx_blacklist_ativo ON blacklist(organization_id, ativo);

-- Índice para logs por organização
CREATE INDEX IF NOT EXISTS idx_blacklist_logs_org ON blacklist_logs(organization_id);

-- Índice para logs por data
CREATE INDEX IF NOT EXISTS idx_blacklist_logs_data ON blacklist_logs(criado_em);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE blacklist IS 'Tabela para gerenciar números de telefone bloqueados por organização';
COMMENT ON COLUMN blacklist.numero_telefone IS 'Número de telefone a ser bloqueado (formato: +5511999999999)';
COMMENT ON COLUMN blacklist.motivo IS 'Motivo do bloqueio do número';
COMMENT ON COLUMN blacklist.ativo IS 'Indica se o bloqueio está ativo';
COMMENT ON COLUMN blacklist.criado_por IS 'Usuário que adicionou o número à blacklist';

COMMENT ON TABLE blacklist_logs IS 'Logs de auditoria para ações na blacklist';
COMMENT ON COLUMN blacklist_logs.acao IS 'Tipo de ação realizada: adicionado, removido, ativado, desativado';
COMMENT ON COLUMN blacklist_logs.detalhes IS 'Informações adicionais sobre a ação';

-- =====================================================
-- TRIGGERS PARA AUDITORIA
-- =====================================================

-- Função para criar log automático
CREATE OR REPLACE FUNCTION log_blacklist_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log para inserção
    IF TG_OP = 'INSERT' THEN
        INSERT INTO blacklist_logs (
            blacklist_id,
            organization_id,
            usuario_id,
            acao,
            numero_telefone,
            motivo,
            criado_em
        ) VALUES (
            NEW.id,
            NEW.organization_id,
            NEW.criado_por,
            'adicionado',
            NEW.numero_telefone,
            NEW.motivo,
            NEW.criado_em
        );
        RETURN NEW;
    END IF;
    
    -- Log para atualização
    IF TG_OP = 'UPDATE' THEN
        -- Log para mudança de status
        IF OLD.ativo != NEW.ativo THEN
            INSERT INTO blacklist_logs (
                blacklist_id,
                organization_id,
                usuario_id,
                acao,
                numero_telefone,
                motivo,
                criado_em
            ) VALUES (
                NEW.id,
                NEW.organization_id,
                NEW.criado_por,
                CASE WHEN NEW.ativo THEN 'ativado' ELSE 'desativado' END,
                NEW.numero_telefone,
                NEW.motivo,
                NEW.atualizado_em
            );
        END IF;
        RETURN NEW;
    END IF;
    
    -- Log para exclusão
    IF TG_OP = 'DELETE' THEN
        INSERT INTO blacklist_logs (
            organization_id,
            usuario_id,
            acao,
            numero_telefone,
            motivo,
            criado_em
        ) VALUES (
            OLD.organization_id,
            OLD.criado_por,
            'removido',
            OLD.numero_telefone,
            OLD.motivo,
            now()
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para auditoria
DROP TRIGGER IF EXISTS trigger_blacklist_logs ON blacklist;
CREATE TRIGGER trigger_blacklist_logs
    AFTER INSERT OR UPDATE OR DELETE ON blacklist
    FOR EACH ROW EXECUTE FUNCTION log_blacklist_changes();

-- =====================================================
-- FUNÇÃO PARA VERIFICAR SE NÚMERO ESTÁ NA BLACKLIST
-- =====================================================

CREATE OR REPLACE FUNCTION is_number_blacklisted(
    p_organization_id UUID,
    p_numero_telefone TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM blacklist 
        WHERE organization_id = p_organization_id 
        AND numero_telefone = p_numero_telefone 
        AND ativo = true
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist_logs ENABLE ROW LEVEL SECURITY;

-- Política para blacklist: usuários só podem ver/editar blacklist da própria organização
CREATE POLICY "blacklist_organization_policy" ON blacklist
    FOR ALL USING (organization_id = (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Política para logs: usuários só podem ver logs da própria organização
CREATE POLICY "blacklist_logs_organization_policy" ON blacklist_logs
    FOR ALL USING (organization_id = (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

