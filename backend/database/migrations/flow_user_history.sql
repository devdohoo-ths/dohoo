-- Migration: flow_user_history
CREATE TABLE IF NOT EXISTS flow_user_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    flow_id uuid NOT NULL,
    final_node_id text NOT NULL,
    variables jsonb,
    status text NOT NULL, -- 'encerrado', 'transferido_atendente', 'transferido_ia', etc
    created_at timestamptz NOT NULL DEFAULT now(),
    organization_id uuid,
    extra jsonb -- para informações adicionais futuras
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_flow_user_history_user_id ON flow_user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_account_id ON flow_user_history(account_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_flow_id ON flow_user_history(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_organization_id ON flow_user_history(organization_id); 