-- =====================================================
-- SISTEMA DE GESTÃO DE PAUSAS
-- =====================================================
-- Criado em: 2025-01-25
-- Descrição: Sistema completo de pausas com tipos configuráveis e histórico para relatórios
-- =====================================================

-- 1. Tabela de Tipos de Pausas (Configurável)
-- =====================================================
CREATE TABLE IF NOT EXISTS pause_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Clock', -- Nome do ícone Lucide React
  color VARCHAR(50) DEFAULT 'blue', -- Cor para UI
  duration_minutes INTEGER NOT NULL DEFAULT 15, -- Duração padrão em minutos
  is_active BOOLEAN DEFAULT true,
  requires_justification BOOLEAN DEFAULT false, -- Se requer justificativa ao usar
  max_uses_per_day INTEGER, -- Limite de usos por dia (NULL = ilimitado)
  is_system BOOLEAN DEFAULT false, -- Se é uma pausa do sistema (não pode ser deletada)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT unique_pause_type_per_org UNIQUE(organization_id, name)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pause_types_org ON pause_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_pause_types_active ON pause_types(is_active);

-- 2. Tabela de Histórico de Pausas (Para Relatórios)
-- =====================================================
CREATE TABLE IF NOT EXISTS pause_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  pause_type_id UUID REFERENCES pause_types(id) ON DELETE SET NULL,
  
  -- Informações da pausa
  pause_name VARCHAR(100) NOT NULL, -- Nome do tipo de pausa (guardado para histórico)
  custom_name VARCHAR(200), -- Nome customizado se for pausa personalizada
  justification TEXT, -- Justificativa se necessário
  
  -- Tempos
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expected_end_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Quando deveria terminar
  ended_at TIMESTAMP WITH TIME ZONE, -- Quando realmente terminou (NULL = ainda em pausa)
  duration_minutes INTEGER NOT NULL, -- Duração configurada
  actual_duration_minutes INTEGER, -- Duração real (calculado quando ended_at é preenchido)
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, completed, exceeded, cancelled
  exceeded_minutes INTEGER DEFAULT 0, -- Quantos minutos excedeu
  
  -- Metadados
  ip_address VARCHAR(45),
  user_agent TEXT,
  notes TEXT, -- Notas adicionais
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance e relatórios
CREATE INDEX IF NOT EXISTS idx_pause_history_org ON pause_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_pause_history_user ON pause_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pause_history_team ON pause_history(team_id);
CREATE INDEX IF NOT EXISTS idx_pause_history_type ON pause_history(pause_type_id);
CREATE INDEX IF NOT EXISTS idx_pause_history_status ON pause_history(status);
CREATE INDEX IF NOT EXISTS idx_pause_history_dates ON pause_history(started_at, ended_at);
CREATE INDEX IF NOT EXISTS idx_pause_history_exceeded ON pause_history(exceeded_minutes) WHERE exceeded_minutes > 0;

-- 3. Função para calcular duração real e status
-- =====================================================
CREATE OR REPLACE FUNCTION update_pause_history_on_end()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    -- Calcular duração real em minutos
    NEW.actual_duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
    
    -- Calcular minutos excedidos
    NEW.exceeded_minutes := GREATEST(0, NEW.actual_duration_minutes - NEW.duration_minutes);
    
    -- Atualizar status
    IF NEW.exceeded_minutes > 0 THEN
      NEW.status := 'exceeded';
    ELSE
      NEW.status := 'completed';
    END IF;
    
    NEW.updated_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar automaticamente ao finalizar pausa
DROP TRIGGER IF EXISTS trigger_update_pause_history ON pause_history;
CREATE TRIGGER trigger_update_pause_history
  BEFORE UPDATE ON pause_history
  FOR EACH ROW
  EXECUTE FUNCTION update_pause_history_on_end();

-- 4. Inserir Tipos de Pausas Padrão do Sistema
-- =====================================================
-- Nota: Estes serão inseridos para cada organização via backend
-- Aqui está apenas como exemplo/documentação

/*
INSERT INTO pause_types (organization_id, name, description, icon, color, duration_minutes, is_system, is_active)
VALUES 
  ('{org_id}', 'Café', 'Pausa para café', 'Coffee', 'orange', 15, true, true),
  ('{org_id}', 'Almoço', 'Pausa para almoço', 'Utensils', 'green', 60, true, true),
  ('{org_id}', 'Telefone', 'Atendimento telefônico', 'Phone', 'blue', 10, true, true),
  ('{org_id}', 'Problema Técnico', 'Resolução de problemas técnicos', 'Wrench', 'red', 30, true, true),
  ('{org_id}', 'Banheiro', 'Pausa para banheiro', 'Clock', 'purple', 5, true, true),
  ('{org_id}', 'Reunião', 'Reunião interna', 'Users', 'indigo', 30, true, true);
*/

-- 5. Views para Relatórios
-- =====================================================

-- View: Pausas Ativas no Momento
CREATE OR REPLACE VIEW active_pauses AS
SELECT 
  ph.*,
  p.name as user_name,
  p.email as user_email,
  t.name as team_name,
  pt.name as pause_type_name,
  pt.color as pause_color,
  EXTRACT(EPOCH FROM (NOW() - ph.started_at)) / 60 AS current_duration_minutes,
  GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ph.expected_end_at)) / 60) AS current_exceeded_minutes
FROM pause_history ph
LEFT JOIN profiles p ON ph.user_id = p.id
LEFT JOIN teams t ON ph.team_id = t.id
LEFT JOIN pause_types pt ON ph.pause_type_id = pt.id
WHERE ph.status = 'active' AND ph.ended_at IS NULL;

-- View: Relatório de Pausas por Usuário
CREATE OR REPLACE VIEW pause_report_by_user AS
SELECT 
  ph.organization_id,
  ph.user_id,
  p.name as user_name,
  p.email as user_email,
  DATE(ph.started_at) as pause_date,
  COUNT(*) as total_pauses,
  SUM(ph.actual_duration_minutes) as total_minutes,
  SUM(CASE WHEN ph.exceeded_minutes > 0 THEN 1 ELSE 0 END) as exceeded_count,
  SUM(ph.exceeded_minutes) as total_exceeded_minutes,
  AVG(ph.actual_duration_minutes) as avg_duration_minutes
FROM pause_history ph
LEFT JOIN profiles p ON ph.user_id = p.id
WHERE ph.ended_at IS NOT NULL
GROUP BY ph.organization_id, ph.user_id, p.name, p.email, DATE(ph.started_at);

-- View: Relatório de Pausas por Tipo
CREATE OR REPLACE VIEW pause_report_by_type AS
SELECT 
  ph.organization_id,
  ph.pause_type_id,
  pt.name as pause_type_name,
  DATE(ph.started_at) as pause_date,
  COUNT(*) as total_uses,
  SUM(ph.actual_duration_minutes) as total_minutes,
  SUM(CASE WHEN ph.exceeded_minutes > 0 THEN 1 ELSE 0 END) as exceeded_count,
  SUM(ph.exceeded_minutes) as total_exceeded_minutes,
  AVG(ph.actual_duration_minutes) as avg_duration_minutes
FROM pause_history ph
LEFT JOIN pause_types pt ON ph.pause_type_id = pt.id
WHERE ph.ended_at IS NOT NULL
GROUP BY ph.organization_id, ph.pause_type_id, pt.name, DATE(ph.started_at);

-- 6. Políticas RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS
ALTER TABLE pause_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pause_history ENABLE ROW LEVEL SECURITY;

-- Políticas para pause_types
CREATE POLICY "Users can view pause types from their organization"
  ON pause_types FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage pause types"
  ON pause_types FOR ALL
  USING (
    organization_id IN (
      SELECT p.organization_id 
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() 
      AND r.name IN ('Admin', 'Super Admin', 'Owner')
    )
  );

-- Políticas para pause_history
CREATE POLICY "Users can view their own pause history"
  ON pause_history FOR SELECT
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT p.organization_id 
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() 
      AND r.name IN ('Admin', 'Super Admin', 'Owner', 'Supervisor', 'Manager')
    )
  );

CREATE POLICY "Users can create their own pause records"
  ON pause_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pause records"
  ON pause_history FOR UPDATE
  USING (user_id = auth.uid());

-- 7. Comentários para documentação
-- =====================================================
COMMENT ON TABLE pause_types IS 'Tipos de pausas configuráveis por organização';
COMMENT ON TABLE pause_history IS 'Histórico completo de pausas para relatórios e auditoria';
COMMENT ON COLUMN pause_types.is_system IS 'Pausas do sistema não podem ser deletadas pelos usuários';
COMMENT ON COLUMN pause_history.exceeded_minutes IS 'Minutos que excederam o tempo permitido (para relatórios)';
COMMENT ON VIEW active_pauses IS 'View com todas as pausas ativas no momento';
COMMENT ON VIEW pause_report_by_user IS 'Relatório agregado de pausas por usuário e data';
COMMENT ON VIEW pause_report_by_type IS 'Relatório agregado de pausas por tipo e data';

