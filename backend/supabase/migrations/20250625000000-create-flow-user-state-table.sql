-- Criar tabela de estado do usuário em fluxos
CREATE TABLE IF NOT EXISTS public.flow_user_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  flow_id UUID REFERENCES public.fluxos(id) ON DELETE CASCADE,
  current_node_id TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  last_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que cada usuário só tem um estado por fluxo por conta
  UNIQUE(user_id, account_id, flow_id)
);

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_flow_user_state_updated_at ON public.flow_user_state;
CREATE TRIGGER update_flow_user_state_updated_at 
  BEFORE UPDATE ON public.flow_user_state 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.flow_user_state ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view their own flow state" ON public.flow_user_state 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own flow state" ON public.flow_user_state 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own flow state" ON public.flow_user_state 
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own flow state" ON public.flow_user_state 
  FOR DELETE USING (user_id = auth.uid());

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_flow_user_state_user_id ON public.flow_user_state(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_state_account_id ON public.flow_user_state(account_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_state_flow_id ON public.flow_user_state(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_state_user_account_flow ON public.flow_user_state(user_id, account_id, flow_id); 