-- =====================================================
-- MIGRAÇÃO: Atendimento Inteligente - Dohoo v2.0
-- Descrição: Criação das tabelas para o módulo de atendimento inteligente
-- Data: 2025-10-22
-- Versão: Supabase
-- =====================================================

-- =====================================================
-- 1. TABELA DE PRODUTOS DE ATENDIMENTO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.intelligent_service_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    flow_id UUID,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    chat_config JSONB DEFAULT '{
        "type": "hybrid",
        "internal_enabled": true,
        "external_enabled": true,
        "auto_routing": false
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT intelligent_service_products_name_org_unique UNIQUE(organization_id, name)
);

-- =====================================================
-- 2. TABELA DE ESTRATÉGIAS DE ENTREGA DOS TIMES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.team_delivery_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    strategy_type VARCHAR(50) NOT NULL CHECK (strategy_type IN ('round_robin', 'priority', 'broadcast', 'workload')),
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT team_delivery_strategies_team_unique UNIQUE(team_id)
);

-- =====================================================
-- 3. TABELA DE CONFIGURAÇÃO DE CHAT HÍBRIDO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_interface_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chat_type VARCHAR(20) NOT NULL CHECK (chat_type IN ('internal', 'external', 'hybrid')),
    internal_config JSONB DEFAULT '{
        "allow_file_sharing": true,
        "allow_mentions": true,
        "max_file_size_mb": 10
    }'::jsonb,
    external_config JSONB DEFAULT '{
        "platforms": ["whatsapp"],
        "auto_reply_enabled": false,
        "business_hours_only": false
    }'::jsonb,
    routing_rules JSONB DEFAULT '{
        "auto_assign": false,
        "priority_based": false,
        "skills_based": false
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chat_interface_config_org_unique UNIQUE(organization_id)
);

-- =====================================================
-- 4. TABELA DE MÉTRICAS DO ATENDIMENTO INTELIGENTE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.intelligent_service_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.intelligent_service_products(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_interactions INTEGER DEFAULT 0,
    successful_interactions INTEGER DEFAULT 0,
    failed_interactions INTEGER DEFAULT 0,
    average_response_time_seconds DECIMAL(10,2) DEFAULT 0,
    customer_satisfaction_score DECIMAL(3,2),
    flow_completion_rate DECIMAL(5,2),
    metrics_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT intelligent_service_metrics_product_date_unique UNIQUE(product_id, date)
);

-- =====================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_intelligent_service_products_org 
    ON public.intelligent_service_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_service_products_active 
    ON public.intelligent_service_products(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_intelligent_service_products_team 
    ON public.intelligent_service_products(team_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_service_products_created_at 
    ON public.intelligent_service_products(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_delivery_strategies_team 
    ON public.team_delivery_strategies(team_id);
CREATE INDEX IF NOT EXISTS idx_team_delivery_strategies_active 
    ON public.team_delivery_strategies(team_id, is_active);

CREATE INDEX IF NOT EXISTS idx_chat_interface_config_org 
    ON public.chat_interface_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_interface_config_active 
    ON public.chat_interface_config(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_intelligent_service_metrics_product 
    ON public.intelligent_service_metrics(product_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_service_metrics_org_date 
    ON public.intelligent_service_metrics(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_intelligent_service_metrics_date 
    ON public.intelligent_service_metrics(date DESC);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.intelligent_service_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_delivery_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_interface_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligent_service_metrics ENABLE ROW LEVEL SECURITY;

-- Policies para intelligent_service_products
CREATE POLICY "Users can view products from their organization"
    ON public.intelligent_service_products FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert products in their organization"
    ON public.intelligent_service_products FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update products in their organization"
    ON public.intelligent_service_products FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete products in their organization"
    ON public.intelligent_service_products FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policies para team_delivery_strategies
CREATE POLICY "Users can view strategies from their organization teams"
    ON public.team_delivery_strategies FOR SELECT
    USING (
        team_id IN (
            SELECT id FROM public.teams 
            WHERE organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage strategies in their organization"
    ON public.team_delivery_strategies FOR ALL
    USING (
        team_id IN (
            SELECT id FROM public.teams 
            WHERE organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Policies para chat_interface_config
CREATE POLICY "Users can view chat config from their organization"
    ON public.chat_interface_config FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage chat config in their organization"
    ON public.chat_interface_config FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policies para intelligent_service_metrics
CREATE POLICY "Users can view metrics from their organization"
    ON public.intelligent_service_metrics FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- =====================================================
-- 7. TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE TRIGGER trigger_intelligent_service_products_updated_at
    BEFORE UPDATE ON public.intelligent_service_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_team_delivery_strategies_updated_at
    BEFORE UPDATE ON public.team_delivery_strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_chat_interface_config_updated_at
    BEFORE UPDATE ON public.chat_interface_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_intelligent_service_metrics_updated_at
    BEFORE UPDATE ON public.intelligent_service_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================


