-- Migração para sistema de controle por agente
-- Data: 2025-01-01

-- 1. Criar tabela agent_credit_limits
CREATE TABLE public.agent_credit_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  monthly_limit INTEGER DEFAULT 1000,
  daily_limit INTEGER DEFAULT 100,
  current_month_used INTEGER DEFAULT 0,
  current_day_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Garantir que um usuário tenha apenas um limite por organização
  UNIQUE(user_id, organization_id)
);

-- 2. Habilitar RLS
ALTER TABLE public.agent_credit_limits ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para agent_credit_limits
-- Usuários podem ver seus próprios limites
CREATE POLICY "Users can view their own limits" ON public.agent_credit_limits 
  FOR SELECT USING (user_id = auth.uid());

-- Admins podem ver todos os limites da organização
CREATE POLICY "Admins can view organization limits" ON public.agent_credit_limits 
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.user_role IN ('admin', 'super_admin')
    )
  );

-- Admins podem gerenciar limites da organização
CREATE POLICY "Admins can manage organization limits" ON public.agent_credit_limits 
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.user_role IN ('admin', 'super_admin')
    )
  );

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_agent_credit_limits_user_id ON public.agent_credit_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_credit_limits_organization_id ON public.agent_credit_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_credit_limits_active ON public.agent_credit_limits(is_active);

-- 5. Atualizar função de dedução para incluir verificação de limites
CREATE OR REPLACE FUNCTION public.deduct_organization_ai_credits(
  p_organization_id UUID,
  p_tokens_used INTEGER,
  p_model TEXT,
  p_user_id UUID DEFAULT NULL,
  p_assistant_id UUID DEFAULT NULL,
  p_chat_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits_needed INTEGER;
  v_available_credits INTEGER;
  v_current_credits_id UUID;
  v_agent_limit RECORD;
  v_can_use BOOLEAN := true;
BEGIN
  -- Calcular créditos necessários baseado no modelo
  v_credits_needed := CASE 
    WHEN p_model LIKE '%gpt-4%' THEN p_tokens_used * 2
    WHEN p_model LIKE '%gpt-3.5%' THEN p_tokens_used
    ELSE p_tokens_used
  END;
  
  -- Verificar limite do agente (se aplicável)
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_agent_limit
    FROM agent_credit_limits
    WHERE user_id = p_user_id 
    AND organization_id = p_organization_id
    AND is_active = true;
    
    IF v_agent_limit IS NOT NULL THEN
      -- Verificar limite diário
      IF v_agent_limit.current_day_used + v_credits_needed > v_agent_limit.daily_limit THEN
        v_can_use := false;
      END IF;
      
      -- Verificar limite mensal
      IF v_agent_limit.current_month_used + v_credits_needed > v_agent_limit.monthly_limit THEN
        v_can_use := false;
      END IF;
    END IF;
  END IF;
  
  -- Se agente excedeu limite, retornar false
  IF NOT v_can_use THEN
    RETURN false;
  END IF;
  
  -- Buscar créditos da organização
  SELECT id, credits_remaining INTO v_current_credits_id, v_available_credits
  FROM ai_credits 
  WHERE organization_id = p_organization_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se não tem créditos suficientes, retornar false
  IF v_available_credits IS NULL OR v_available_credits < v_credits_needed THEN
    RETURN FALSE;
  END IF;
  
  -- Atualizar créditos usados da organização
  UPDATE ai_credits 
  SET credits_used = credits_used + v_credits_needed,
      updated_at = now()
  WHERE id = v_current_credits_id;
  
  -- Atualizar limite do agente (se aplicável)
  IF v_agent_limit IS NOT NULL THEN
    UPDATE agent_credit_limits
    SET 
      current_day_used = current_day_used + v_credits_needed,
      current_month_used = current_month_used + v_credits_needed,
      updated_at = now()
    WHERE id = v_agent_limit.id;
  END IF;
  
  -- Registrar uso de tokens (mantém user_id para rastreamento)
  INSERT INTO ai_token_usage (
    user_id, 
    organization_id,
    assistant_id,
    chat_id,
    tokens_used,
    model_used,
    cost_in_credits
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_assistant_id,
    p_chat_id,
    p_tokens_used,
    p_model,
    v_credits_needed
  );
  
  -- Registrar transação
  INSERT INTO credit_transactions (
    user_id,
    organization_id,
    transaction_type,
    credits_amount,
    description
  ) VALUES (
    p_user_id,
    p_organization_id,
    'usage',
    -v_credits_needed,
    'AI tokens usage for ' || p_model
  );
  
  RETURN TRUE;
END;
$$;

-- 6. Função para obter limites de um agente
CREATE OR REPLACE FUNCTION public.get_agent_credit_limits(p_user_id UUID, p_organization_id UUID)
RETURNS TABLE (
  monthly_limit INTEGER,
  daily_limit INTEGER,
  current_month_used INTEGER,
  current_day_used INTEGER,
  monthly_remaining INTEGER,
  daily_remaining INTEGER,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acl.monthly_limit,
    acl.daily_limit,
    acl.current_month_used,
    acl.current_day_used,
    (acl.monthly_limit - acl.current_month_used) as monthly_remaining,
    (acl.daily_limit - acl.current_day_used) as daily_remaining,
    acl.is_active
  FROM agent_credit_limits acl
  WHERE acl.user_id = p_user_id 
  AND acl.organization_id = p_organization_id
  AND acl.is_active = true;
END;
$$;

-- 7. Função para obter todos os limites da organização
CREATE OR REPLACE FUNCTION public.get_organization_agent_limits(p_organization_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  monthly_limit INTEGER,
  daily_limit INTEGER,
  current_month_used INTEGER,
  current_day_used INTEGER,
  monthly_remaining INTEGER,
  daily_remaining INTEGER,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acl.user_id,
    p.name as user_name,
    p.email as user_email,
    acl.monthly_limit,
    acl.daily_limit,
    acl.current_month_used,
    acl.current_day_used,
    (acl.monthly_limit - acl.current_month_used) as monthly_remaining,
    (acl.daily_limit - acl.current_day_used) as daily_remaining,
    acl.is_active
  FROM agent_credit_limits acl
  JOIN profiles p ON acl.user_id = p.id
  WHERE acl.organization_id = p_organization_id
  ORDER BY p.name;
END;
$$;

-- 8. Função para atualizar limites de um agente
CREATE OR REPLACE FUNCTION public.update_agent_credit_limits(
  p_user_id UUID,
  p_organization_id UUID,
  p_monthly_limit INTEGER,
  p_daily_limit INTEGER,
  p_is_active BOOLEAN DEFAULT true
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO agent_credit_limits (
    user_id,
    organization_id,
    monthly_limit,
    daily_limit,
    is_active
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_monthly_limit,
    p_daily_limit,
    p_is_active
  )
  ON CONFLICT (user_id, organization_id) 
  DO UPDATE SET
    monthly_limit = p_monthly_limit,
    daily_limit = p_daily_limit,
    is_active = p_is_active,
    updated_at = now();
  
  RETURN TRUE;
END;
$$;

-- 9. Trigger para atualizar updated_at
CREATE TRIGGER update_agent_credit_limits_updated_at 
  BEFORE UPDATE ON public.agent_credit_limits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Comentários explicativos
COMMENT ON TABLE public.agent_credit_limits IS 'Controle de limites de créditos por agente';
COMMENT ON FUNCTION public.get_agent_credit_limits IS 'Obtém limites de créditos de um agente específico';
COMMENT ON FUNCTION public.get_organization_agent_limits IS 'Obtém todos os limites de agentes da organização';
COMMENT ON FUNCTION public.update_agent_credit_limits IS 'Atualiza limites de créditos de um agente';