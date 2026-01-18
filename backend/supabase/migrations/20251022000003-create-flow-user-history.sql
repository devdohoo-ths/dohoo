-- Criar tabela de histórico de execução de flows
CREATE TABLE IF NOT EXISTS public.flow_user_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  flow_id UUID REFERENCES public.fluxos(id) ON DELETE CASCADE,
  final_node_id TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  status TEXT NOT NULL, -- 'encerrado', 'transferido_time', 'transferido_agente', etc
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  extra JSONB DEFAULT '{}', -- para informações adicionais
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_flow_user_history_user_id ON public.flow_user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_account_id ON public.flow_user_history(account_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_flow_id ON public.flow_user_history(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_organization_id ON public.flow_user_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_status ON public.flow_user_history(status);
CREATE INDEX IF NOT EXISTS idx_flow_user_history_created_at ON public.flow_user_history(created_at);

-- Habilitar RLS
ALTER TABLE public.flow_user_history ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view their own flow history" ON public.flow_user_history 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own flow history" ON public.flow_user_history 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Política para organizações (admins podem ver histórico da organização)
CREATE POLICY "Organization admins can view flow history" ON public.flow_user_history 
  FOR SELECT USING (
    organization_id IN (
      SELECT id FROM public.organizations 
      WHERE id IN (
        SELECT organization_id FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );
