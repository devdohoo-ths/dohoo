-- Criar tabela team_sessions para gerenciar sessões dos times
CREATE TABLE IF NOT EXISTS team_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_team_sessions_team_id ON team_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_team_sessions_organization_id ON team_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_sessions_status ON team_sessions(status);
CREATE INDEX IF NOT EXISTS idx_team_sessions_last_activity ON team_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_team_sessions_session_token ON team_sessions(session_token);

-- RLS (Row Level Security)
ALTER TABLE team_sessions ENABLE ROW LEVEL SECURITY;

-- Política para permitir que times vejam suas próprias sessões
CREATE POLICY "Teams can view their own sessions" ON team_sessions
  FOR SELECT USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE organization_id IN (
        SELECT id FROM organizations 
        WHERE id = auth.jwt() ->> 'organization_id'
      )
    )
  );

-- Política para permitir que times criem suas próprias sessões
CREATE POLICY "Teams can create their own sessions" ON team_sessions
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT id FROM teams 
      WHERE organization_id IN (
        SELECT id FROM organizations 
        WHERE id = auth.jwt() ->> 'organization_id'
      )
    )
  );

-- Política para permitir que times atualizem suas próprias sessões
CREATE POLICY "Teams can update their own sessions" ON team_sessions
  FOR UPDATE USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE organization_id IN (
        SELECT id FROM organizations 
        WHERE id = auth.jwt() ->> 'organization_id'
      )
    )
  );

-- Política para permitir que times deletem suas próprias sessões
CREATE POLICY "Teams can delete their own sessions" ON team_sessions
  FOR DELETE USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE organization_id IN (
        SELECT id FROM organizations 
        WHERE id = auth.jwt() ->> 'organization_id'
      )
    )
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_team_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_team_sessions_updated_at
  BEFORE UPDATE ON team_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_team_sessions_updated_at();

-- Função para limpar sessões expiradas (mais de 24 horas)
CREATE OR REPLACE FUNCTION cleanup_expired_team_sessions()
RETURNS void AS $$
BEGIN
  UPDATE team_sessions 
  SET status = 'expired' 
  WHERE status = 'active' 
    AND last_activity < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE team_sessions IS 'Sessões ativas dos times para controle de status online/offline';
COMMENT ON COLUMN team_sessions.team_id IS 'ID do time';
COMMENT ON COLUMN team_sessions.organization_id IS 'ID da organização';
COMMENT ON COLUMN team_sessions.session_token IS 'Token único da sessão';
COMMENT ON COLUMN team_sessions.status IS 'Status da sessão: active, inactive, expired';
COMMENT ON COLUMN team_sessions.last_activity IS 'Última atividade da sessão';
COMMENT ON COLUMN team_sessions.created_at IS 'Data de criação da sessão';
COMMENT ON COLUMN team_sessions.updated_at IS 'Data da última atualização';
