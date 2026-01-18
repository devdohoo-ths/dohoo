-- Migração para adicionar sistema POC
-- Data: 2024-12-19

-- 1. Adicionar campos POC na tabela organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS is_poc BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS poc_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS poc_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS poc_duration_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS poc_notifications_sent JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS poc_status VARCHAR(20) DEFAULT 'inactive' CHECK (poc_status IN ('inactive', 'active', 'expired', 'converted'));

-- 2. Criar tabela para histórico de POCs
CREATE TABLE IF NOT EXISTS poc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'extended', 'converted', 'expired', 'notified')),
  old_end_date TIMESTAMP,
  new_end_date TIMESTAMP,
  performed_by UUID REFERENCES profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Criar tabela para notificações POC
CREATE TABLE IF NOT EXISTS poc_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('warning_7_days', 'warning_3_days', 'final_1_day', 'expired')),
  sent_at TIMESTAMP DEFAULT NOW(),
  sent_via VARCHAR(20) NOT NULL CHECK (sent_via IN ('email', 'whatsapp', 'both')),
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(50),
  message_content TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_organizations_poc_status ON organizations(poc_status);
CREATE INDEX IF NOT EXISTS idx_organizations_poc_end_date ON organizations(poc_end_date);
CREATE INDEX IF NOT EXISTS idx_organizations_is_poc ON organizations(is_poc);
CREATE INDEX IF NOT EXISTS idx_poc_history_organization_id ON poc_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_poc_history_created_at ON poc_history(created_at);
CREATE INDEX IF NOT EXISTS idx_poc_notifications_organization_id ON poc_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_poc_notifications_sent_at ON poc_notifications(sent_at);

-- 5. Criar função para calcular data de fim da POC
CREATE OR REPLACE FUNCTION calculate_poc_end_date(start_date TIMESTAMP, duration_days INTEGER)
RETURNS TIMESTAMP AS $$
BEGIN
  RETURN start_date + INTERVAL '1 day' * duration_days;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar função para verificar POCs expirando
CREATE OR REPLACE FUNCTION get_expiring_pocs(days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR,
  poc_end_date TIMESTAMP,
  days_remaining INTEGER,
  contact_email VARCHAR,
  contact_phone VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.poc_end_date,
    EXTRACT(DAY FROM (o.poc_end_date - CURRENT_DATE))::INTEGER as days_remaining,
    o.contact_email,
    o.contact_phone
  FROM organizations o
  WHERE o.is_poc = TRUE 
    AND o.poc_status = 'active'
    AND o.poc_end_date IS NOT NULL
    AND o.poc_end_date <= (CURRENT_DATE + INTERVAL '1 day' * days_ahead)
    AND o.poc_end_date > CURRENT_DATE
  ORDER BY o.poc_end_date ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar função para verificar POCs expiradas
CREATE OR REPLACE FUNCTION get_expired_pocs()
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR,
  poc_end_date TIMESTAMP,
  days_expired INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.poc_end_date,
    EXTRACT(DAY FROM (CURRENT_DATE - o.poc_end_date))::INTEGER as days_expired
  FROM organizations o
  WHERE o.is_poc = TRUE 
    AND o.poc_status = 'active'
    AND o.poc_end_date IS NOT NULL
    AND o.poc_end_date < CURRENT_DATE
  ORDER BY o.poc_end_date ASC;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar trigger para atualizar poc_end_date automaticamente
CREATE OR REPLACE FUNCTION update_poc_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Se is_poc for TRUE e poc_start_date ou poc_duration_days mudaram
  IF NEW.is_poc = TRUE AND (
    OLD.poc_start_date IS DISTINCT FROM NEW.poc_start_date OR
    OLD.poc_duration_days IS DISTINCT FROM NEW.poc_duration_days
  ) THEN
    NEW.poc_end_date := calculate_poc_end_date(NEW.poc_start_date, NEW.poc_duration_days);
    
    -- Se não tem data de início, usar data atual
    IF NEW.poc_start_date IS NULL THEN
      NEW.poc_start_date := CURRENT_TIMESTAMP;
      NEW.poc_end_date := calculate_poc_end_date(NEW.poc_start_date, NEW.poc_duration_days);
    END IF;
    
    -- Atualizar status para active se for POC
    IF NEW.poc_status = 'inactive' THEN
      NEW.poc_status := 'active';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_poc_end_date ON organizations;
CREATE TRIGGER trigger_update_poc_end_date
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_poc_end_date();

-- 9. Comentários para documentação
COMMENT ON COLUMN organizations.is_poc IS 'Indica se a organização está em período de POC';
COMMENT ON COLUMN organizations.poc_start_date IS 'Data de início da POC';
COMMENT ON COLUMN organizations.poc_end_date IS 'Data de fim da POC (calculada automaticamente)';
COMMENT ON COLUMN organizations.poc_duration_days IS 'Duração da POC em dias (padrão: 30)';
COMMENT ON COLUMN organizations.poc_notifications_sent IS 'Array com tipos de notificações já enviadas';
COMMENT ON COLUMN organizations.poc_status IS 'Status da POC: inactive, active, expired, converted';

COMMENT ON TABLE poc_history IS 'Histórico de alterações nas POCs';
COMMENT ON TABLE poc_notifications IS 'Registro de notificações enviadas sobre POCs';

