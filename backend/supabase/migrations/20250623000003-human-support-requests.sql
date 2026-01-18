-- Criar tabela para solicitações de atendimento humano
CREATE TABLE IF NOT EXISTS public.human_support_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES public.profiles(id),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  description TEXT,
  chat_id UUID REFERENCES public.chats(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_human_support_requests_user_id ON public.human_support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_human_support_requests_organization_id ON public.human_support_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_human_support_requests_status ON public.human_support_requests(status);
CREATE INDEX IF NOT EXISTS idx_human_support_requests_created_at ON public.human_support_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_human_support_requests_assigned_to ON public.human_support_requests(assigned_to);

-- Habilitar RLS
ALTER TABLE public.human_support_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view support requests in their organization" ON public.human_support_requests;
DROP POLICY IF EXISTS "Users can create support requests" ON public.human_support_requests;
DROP POLICY IF EXISTS "Users can update support requests they created" ON public.human_support_requests;
DROP POLICY IF EXISTS "Assigned users can update support requests" ON public.human_support_requests;

CREATE POLICY "Users can view support requests in their organization" ON public.human_support_requests
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create support requests" ON public.human_support_requests
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update support requests they created" ON public.human_support_requests
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "Assigned users can update support requests" ON public.human_support_requests
  FOR UPDATE USING (
    assigned_to = auth.uid()
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_human_support_requests_updated_at ON public.human_support_requests;
CREATE TRIGGER update_human_support_requests_updated_at 
  BEFORE UPDATE ON public.human_support_requests 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para obter estatísticas de atendimento
CREATE OR REPLACE FUNCTION public.get_support_stats(org_id UUID)
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_requests', COUNT(*),
    'pending_requests', COUNT(*) FILTER (WHERE status = 'pending'),
    'in_progress_requests', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'completed_requests', COUNT(*) FILTER (WHERE status = 'completed'),
    'avg_response_time', AVG(EXTRACT(EPOCH FROM (assigned_at - created_at))/3600) FILTER (WHERE assigned_at IS NOT NULL),
    'avg_resolution_time', AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) FILTER (WHERE completed_at IS NOT NULL)
  ) INTO stats
  FROM public.human_support_requests
  WHERE organization_id = org_id;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 