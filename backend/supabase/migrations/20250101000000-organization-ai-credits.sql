-- Migração para modificar sistema de créditos para funcionar por organização
-- Data: 2025-01-01

-- 1. Modificar a tabela ai_credits para funcionar por organização
ALTER TABLE public.ai_credits 
DROP CONSTRAINT IF EXISTS ai_credits_user_id_fkey;

-- Tornar user_id opcional (apenas para rastreamento)
ALTER TABLE public.ai_credits 
ALTER COLUMN user_id DROP NOT NULL;

-- Tornar organization_id obrigatório
ALTER TABLE public.ai_credits 
ALTER COLUMN organization_id SET NOT NULL;

-- Adicionar constraint única para organization_id (uma organização = um registro de créditos)
ALTER TABLE public.ai_credits 
ADD CONSTRAINT ai_credits_organization_id_unique UNIQUE (organization_id);

-- 2. Atualizar políticas RLS para organização
DROP POLICY IF EXISTS "Users can view their own credits" ON public.ai_credits;
DROP POLICY IF EXISTS "Users can update their own credits" ON public.ai_credits;

-- Nova política: usuários podem ver créditos da sua organização
CREATE POLICY "Users can view organization credits" ON public.ai_credits 
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Nova política: apenas admins podem atualizar créditos da organização
CREATE POLICY "Admins can update organization credits" ON public.ai_credits 
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.user_role IN ('admin', 'super_admin')
    )
  );

-- 3. Criar nova função para deduzir créditos organizacionais
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
BEGIN
  -- Calcular créditos necessários baseado no modelo
  v_credits_needed := CASE 
    WHEN p_model LIKE '%gpt-4%' THEN p_tokens_used * 2
    WHEN p_model LIKE '%gpt-3.5%' THEN p_tokens_used
    ELSE p_tokens_used
  END;
  
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

-- 4. Atualizar políticas RLS para ai_token_usage
DROP POLICY IF EXISTS "Users can view their own token usage" ON public.ai_token_usage;

-- Usuários podem ver uso de tokens da sua organização
CREATE POLICY "Users can view organization token usage" ON public.ai_token_usage 
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 5. Atualizar políticas RLS para credit_transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;

-- Usuários podem ver transações da sua organização
CREATE POLICY "Users can view organization transactions" ON public.credit_transactions 
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 6. Criar função para obter créditos da organização
CREATE OR REPLACE FUNCTION public.get_organization_ai_credits(p_organization_id UUID)
RETURNS TABLE (
  credits_purchased INTEGER,
  credits_used INTEGER,
  credits_remaining INTEGER,
  last_purchase_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.credits_purchased,
    ac.credits_used,
    ac.credits_remaining,
    ac.last_purchase_at
  FROM ai_credits ac
  WHERE ac.organization_id = p_organization_id
  ORDER BY ac.created_at DESC
  LIMIT 1;
END;
$$;

-- 7. Criar função para adicionar créditos à organização
CREATE OR REPLACE FUNCTION public.add_organization_ai_credits(
  p_organization_id UUID,
  p_credits_amount INTEGER,
  p_user_id UUID DEFAULT NULL,
  p_cost_usd DECIMAL(10,2) DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_credits_id UUID;
BEGIN
  -- Verificar se já existe registro de créditos para a organização
  SELECT id INTO v_existing_credits_id
  FROM ai_credits 
  WHERE organization_id = p_organization_id
  LIMIT 1;
  
  IF v_existing_credits_id IS NOT NULL THEN
    -- Atualizar créditos existentes
    UPDATE ai_credits 
    SET 
      credits_purchased = credits_purchased + p_credits_amount,
      last_purchase_at = now(),
      updated_at = now()
    WHERE id = v_existing_credits_id;
  ELSE
    -- Criar novo registro de créditos
    INSERT INTO ai_credits (
      organization_id,
      user_id,
      credits_purchased,
      credits_used,
      last_purchase_at
    ) VALUES (
      p_organization_id,
      p_user_id,
      p_credits_amount,
      0,
      now()
    );
  END IF;
  
  -- Registrar transação de compra
  INSERT INTO credit_transactions (
    user_id,
    organization_id,
    transaction_type,
    credits_amount,
    cost_usd,
    payment_status,
    description
  ) VALUES (
    p_user_id,
    p_organization_id,
    'purchase',
    p_credits_amount,
    p_cost_usd,
    'completed',
    'Purchase of ' || p_credits_amount || ' AI credits for organization'
  );
  
  RETURN TRUE;
END;
$$;

-- 8. Comentários explicativos
COMMENT ON FUNCTION public.deduct_organization_ai_credits IS 'Deduz créditos de IA da organização em vez do usuário individual';
COMMENT ON FUNCTION public.get_organization_ai_credits IS 'Obtém informações de créditos de IA da organização';
COMMENT ON FUNCTION public.add_organization_ai_credits IS 'Adiciona créditos de IA à organização';

-- 9. Índices para performance
CREATE INDEX IF NOT EXISTS idx_ai_credits_organization_id ON public.ai_credits(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_organization_id ON public.ai_token_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_organization_id ON public.credit_transactions(organization_id);