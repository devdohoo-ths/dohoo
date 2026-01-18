-- =====================================================
-- MIGRAÇÃO: Campanhas Inteligentes - Dohoo v2.0
-- Descrição: Criação das tabelas para o módulo de campanhas
-- Data: 2025-01-13
-- =====================================================

-- 1. Tabela de templates de campanha
CREATE TABLE IF NOT EXISTS campanha_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    variaveis JSONB DEFAULT '[]'::jsonb,
    aprovado BOOLEAN DEFAULT false,
    criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela principal de campanhas
CREATE TABLE IF NOT EXISTS campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    template_id UUID REFERENCES campanha_templates(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('rascunho', 'em_execucao', 'finalizada', 'erro', 'pausada')) DEFAULT 'rascunho',
    total_destinatarios INTEGER DEFAULT 0,
    enviados INTEGER DEFAULT 0,
    respondidos INTEGER DEFAULT 0,
    data_inicio TIMESTAMP WITH TIME ZONE,
    data_fim TIMESTAMP WITH TIME ZONE,
    usar_ia BOOLEAN DEFAULT false,
    configuracoes JSONB DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de contatos da campanha
CREATE TABLE IF NOT EXISTS campanha_contatos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    contato_id UUID NOT NULL, -- Referência genérica para contatos
    contato_nome TEXT, -- Nome do contato (cache)
    contato_telefone TEXT, -- Telefone do contato (cache)
    enviado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pendente', 'enviado', 'erro', 'respondido')) DEFAULT 'pendente',
    mensagem_enviada TEXT,
    resposta_cliente TEXT,
    resumo_ia TEXT,
    sentimento_ia TEXT CHECK (sentimento_ia IN ('positivo', 'neutro', 'negativo')),
    erro_detalhes TEXT,
    enviado_em TIMESTAMP WITH TIME ZONE,
    respondido_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de logs de campanha para auditoria
CREATE TABLE IF NOT EXISTS campanha_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    acao TEXT NOT NULL,
    detalhes JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Tabela de usuários remetentes por campanha
CREATE TABLE IF NOT EXISTS campanha_remetentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    numero_whatsapp TEXT,
    ativo BOOLEAN DEFAULT true,
    mensagens_enviadas INTEGER DEFAULT 0,
    ultima_mensagem TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(campanha_id, usuario_id)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para campanha_templates
CREATE INDEX IF NOT EXISTS idx_campanha_templates_org_id ON campanha_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_campanha_templates_aprovado ON campanha_templates(aprovado);
CREATE INDEX IF NOT EXISTS idx_campanha_templates_criado_por ON campanha_templates(criado_por);

-- Índices para campanhas
CREATE INDEX IF NOT EXISTS idx_campanhas_org_id ON campanhas(organization_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON campanhas(status);
CREATE INDEX IF NOT EXISTS idx_campanhas_created_by ON campanhas(created_by);
CREATE INDEX IF NOT EXISTS idx_campanhas_data_inicio ON campanhas(data_inicio);
CREATE INDEX IF NOT EXISTS idx_campanhas_template_id ON campanhas(template_id);

-- Índices para campanha_contatos
CREATE INDEX IF NOT EXISTS idx_campanha_contatos_campanha_id ON campanha_contatos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_contatos_contato_id ON campanha_contatos(contato_id);
CREATE INDEX IF NOT EXISTS idx_campanha_contatos_status ON campanha_contatos(status);
CREATE INDEX IF NOT EXISTS idx_campanha_contatos_enviado_por ON campanha_contatos(enviado_por);
CREATE INDEX IF NOT EXISTS idx_campanha_contatos_enviado_em ON campanha_contatos(enviado_em);

-- Índices para campanha_logs
CREATE INDEX IF NOT EXISTS idx_campanha_logs_campanha_id ON campanha_logs(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_logs_usuario_id ON campanha_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_campanha_logs_criado_em ON campanha_logs(criado_em);

-- Índices para campanha_remetentes
CREATE INDEX IF NOT EXISTS idx_campanha_remetentes_campanha_id ON campanha_remetentes(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_remetentes_usuario_id ON campanha_remetentes(usuario_id);

-- =====================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- =====================================================

-- Trigger para atualizar atualizado_em em campanha_templates
CREATE OR REPLACE FUNCTION update_campanha_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_campanha_templates_updated_at
    BEFORE UPDATE ON campanha_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campanha_templates_updated_at();

-- Trigger para atualizar atualizado_em em campanhas
CREATE OR REPLACE FUNCTION update_campanhas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_campanhas_updated_at
    BEFORE UPDATE ON campanhas
    FOR EACH ROW
    EXECUTE FUNCTION update_campanhas_updated_at();

-- =====================================================
-- FUNÇÕES UTILITÁRIAS
-- =====================================================

-- Função para atualizar contadores da campanha
CREATE OR REPLACE FUNCTION update_campanha_counters()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar contadores quando status do contato muda
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        UPDATE campanhas 
        SET 
            enviados = (
                SELECT COUNT(*) 
                FROM campanha_contatos 
                WHERE campanha_id = NEW.campanha_id 
                AND status IN ('enviado', 'respondido')
            ),
            respondidos = (
                SELECT COUNT(*) 
                FROM campanha_contatos 
                WHERE campanha_id = NEW.campanha_id 
                AND status = 'respondido'
            )
        WHERE id = NEW.campanha_id;
    END IF;
    
    -- Atualizar contador quando novo contato é inserido
    IF TG_OP = 'INSERT' THEN
        UPDATE campanhas 
        SET total_destinatarios = (
            SELECT COUNT(*) 
            FROM campanha_contatos 
            WHERE campanha_id = NEW.campanha_id
        )
        WHERE id = NEW.campanha_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_campanha_counters
    AFTER INSERT OR UPDATE ON campanha_contatos
    FOR EACH ROW
    EXECUTE FUNCTION update_campanha_counters();

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE campanha_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_remetentes ENABLE ROW LEVEL SECURITY;

-- Políticas para campanha_templates
CREATE POLICY "Users can view templates from their organization" ON campanha_templates
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create templates in their organization" ON campanha_templates
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update templates in their organization" ON campanha_templates
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Políticas para campanhas
CREATE POLICY "Users can view campaigns from their organization" ON campanhas
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create campaigns in their organization" ON campanhas
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update campaigns in their organization" ON campanhas
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Políticas para campanha_contatos
CREATE POLICY "Users can view campaign contacts from their organization" ON campanha_contatos
    FOR SELECT USING (
        campanha_id IN (
            SELECT id FROM campanhas WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage campaign contacts in their organization" ON campanha_contatos
    FOR ALL USING (
        campanha_id IN (
            SELECT id FROM campanhas WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Políticas para campanha_logs
CREATE POLICY "Users can view campaign logs from their organization" ON campanha_logs
    FOR SELECT USING (
        campanha_id IN (
            SELECT id FROM campanhas WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "System can insert campaign logs" ON campanha_logs
    FOR INSERT WITH CHECK (true);

-- Políticas para campanha_remetentes
CREATE POLICY "Users can view campaign senders from their organization" ON campanha_remetentes
    FOR SELECT USING (
        campanha_id IN (
            SELECT id FROM campanhas WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage campaign senders in their organization" ON campanha_remetentes
    FOR ALL USING (
        campanha_id IN (
            SELECT id FROM campanhas WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE campanha_templates IS 'Templates de mensagens para campanhas inteligentes';
COMMENT ON TABLE campanhas IS 'Campanhas de envio em massa com IA opcional';
COMMENT ON TABLE campanha_contatos IS 'Contatos incluídos em cada campanha com status de envio';
COMMENT ON TABLE campanha_logs IS 'Logs de auditoria para todas as ações das campanhas';
COMMENT ON TABLE campanha_remetentes IS 'Usuários/números que enviarão mensagens da campanha';

COMMENT ON COLUMN campanhas.usar_ia IS 'Se true, ativa personalização e análise com IA';
COMMENT ON COLUMN campanhas.configuracoes IS 'Configurações JSON: rate_limit, horarios, etc';
COMMENT ON COLUMN campanha_contatos.sentimento_ia IS 'Análise de sentimento da resposta: positivo/neutro/negativo';
COMMENT ON COLUMN campanha_contatos.resumo_ia IS 'Resumo gerado por IA da resposta do cliente';

