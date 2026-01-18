-- =====================================================
-- MÉTRICAS DE PRODUTIVIDADE DO WHATSAPP
-- =====================================================

-- Tabela para métricas de produtividade do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_productivity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Métricas de tempo
    total_usage_time_minutes INTEGER DEFAULT 0,
    active_time_minutes INTEGER DEFAULT 0,
    idle_time_minutes INTEGER DEFAULT 0,
    break_time_minutes INTEGER DEFAULT 0,
    
    -- Métricas de atividade
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_received INTEGER DEFAULT 0,
    conversations_started INTEGER DEFAULT 0,
    conversations_ended INTEGER DEFAULT 0,
    
    -- Métricas de eficiência
    avg_response_time_seconds DECIMAL(10,2) DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0, -- porcentagem
    resolution_rate DECIMAL(5,2) DEFAULT 0, -- porcentagem
    
    -- Métricas de produtividade
    productivity_score DECIMAL(5,2) DEFAULT 0, -- 0-100
    efficiency_score DECIMAL(5,2) DEFAULT 0, -- 0-100
    engagement_score DECIMAL(5,2) DEFAULT 0, -- 0-100
    
    -- Dados de horários
    peak_hours JSONB DEFAULT '[]',
    activity_heatmap JSONB DEFAULT '{}', -- {hour: activity_level}
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, organization_id, date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_productivity_user_date ON whatsapp_productivity_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_productivity_org_date ON whatsapp_productivity_metrics(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_productivity_date ON whatsapp_productivity_metrics(date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_productivity_user_org ON whatsapp_productivity_metrics(user_id, organization_id);

-- Políticas RLS
ALTER TABLE whatsapp_productivity_metrics ENABLE ROW LEVEL SECURITY;

-- Política para visualização
CREATE POLICY "Users can view their own productivity metrics" ON whatsapp_productivity_metrics
    FOR SELECT USING (
        user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Política para inserção
CREATE POLICY "Users can insert productivity metrics" ON whatsapp_productivity_metrics
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Política para atualização
CREATE POLICY "Users can update their productivity metrics" ON whatsapp_productivity_metrics
    FOR UPDATE USING (
        user_id = auth.uid() AND
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_productivity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_productivity_updated_at
    BEFORE UPDATE ON whatsapp_productivity_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_productivity_updated_at();

-- Comentários
COMMENT ON TABLE whatsapp_productivity_metrics IS 'Métricas de produtividade e uso do WhatsApp por usuário';
COMMENT ON COLUMN whatsapp_productivity_metrics.total_usage_time_minutes IS 'Tempo total de uso do WhatsApp em minutos';
COMMENT ON COLUMN whatsapp_productivity_metrics.active_time_minutes IS 'Tempo ativo (interagindo) em minutos';
COMMENT ON COLUMN whatsapp_productivity_metrics.idle_time_minutes IS 'Tempo ocioso entre conversas em minutos';
COMMENT ON COLUMN whatsapp_productivity_metrics.productivity_score IS 'Score de produtividade (0-100)';
COMMENT ON COLUMN whatsapp_productivity_metrics.activity_heatmap IS 'Mapa de atividade por hora do dia';
COMMENT ON COLUMN whatsapp_productivity_metrics.peak_hours IS 'Horários de maior atividade';

