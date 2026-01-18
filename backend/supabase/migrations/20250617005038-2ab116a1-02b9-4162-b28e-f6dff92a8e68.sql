-- Criar tabela para controle de tokens/créditos
CREATE TABLE public.ai_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  credits_purchased INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_remaining INTEGER GENERATED ALWAYS AS (credits_purchased - credits_used) STORED,
  last_purchase_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para histórico de uso de tokens
CREATE TABLE public.ai_token_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  assistant_id UUID REFERENCES ai_assistants(id),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  tokens_used INTEGER NOT NULL,
  model_used TEXT NOT NULL,
  cost_in_credits INTEGER NOT NULL,
  message_type TEXT DEFAULT 'chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para transações de créditos
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund')),
  credits_amount INTEGER NOT NULL,
  cost_usd DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para configurações de dashboard personalizável
CREATE TABLE public.dashboard_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  widget_type TEXT NOT NULL,
  widget_config JSONB DEFAULT '{}',
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1,
  height INTEGER DEFAULT 1,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ai_credits
CREATE POLICY "Users can view their own credits" ON public.ai_credits 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own credits" ON public.ai_credits 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert credits" ON public.ai_credits 
  FOR INSERT WITH CHECK (true);

-- Políticas RLS para ai_token_usage
CREATE POLICY "Users can view their own token usage" ON public.ai_token_usage 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert token usage" ON public.ai_token_usage 
  FOR INSERT WITH CHECK (true);

-- Políticas RLS para credit_transactions
CREATE POLICY "Users can view their own transactions" ON public.credit_transactions 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON public.credit_transactions 
  FOR INSERT WITH CHECK (true);

-- Políticas RLS para dashboard_widgets
CREATE POLICY "Users can manage their own widgets" ON public.dashboard_widgets 
  FOR ALL USING (auth.uid() = user_id);

-- Criar função para decrementar créditos
CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_user_id UUID,
  p_tokens_used INTEGER,
  p_model TEXT,
  p_assistant_id UUID DEFAULT NULL,
  p_chat_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits_needed INTEGER;
  v_available_credits INTEGER;
  v_organization_id UUID;
BEGIN
  -- Calcular créditos necessários baseado no modelo
  v_credits_needed := CASE 
    WHEN p_model LIKE '%gpt-4%' THEN p_tokens_used * 2
    WHEN p_model LIKE '%gpt-3.5%' THEN p_tokens_used
    ELSE p_tokens_used
  END;
  
  -- Buscar organização do usuário
  SELECT organization_id INTO v_organization_id 
  FROM profiles WHERE id = p_user_id;
  
  -- Verificar créditos disponíveis
  SELECT credits_remaining INTO v_available_credits
  FROM ai_credits 
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se não tem créditos suficientes, retornar false
  IF v_available_credits IS NULL OR v_available_credits < v_credits_needed THEN
    RETURN FALSE;
  END IF;
  
  -- Atualizar créditos usados
  UPDATE ai_credits 
  SET credits_used = credits_used + v_credits_needed,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Registrar uso de tokens
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
    v_organization_id,
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
    v_organization_id,
    'usage',
    -v_credits_needed,
    'AI tokens usage for ' || p_model
  );
  
  RETURN TRUE;
END;
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ai_credits_updated_at 
  BEFORE UPDATE ON public.ai_credits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at 
  BEFORE UPDATE ON public.dashboard_widgets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
