-- Criar tabela para registrar notificações de desconexão
CREATE TABLE IF NOT EXISTS public.disconnect_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  manager_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_phone TEXT,
  manager_email TEXT NOT NULL,
  conversations_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.disconnect_notifications ENABLE ROW LEVEL SECURITY;

-- Política para visualizar notificações da própria organização
CREATE POLICY "Users can view disconnect notifications from their organization" 
  ON public.disconnect_notifications 
  FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM public.profiles 
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Política para inserir notificações (apenas sistema)
CREATE POLICY "System can insert disconnect notifications" 
  ON public.disconnect_notifications 
  FOR INSERT 
  WITH CHECK (true);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_disconnect_notifications_account_id ON public.disconnect_notifications(account_id);
CREATE INDEX IF NOT EXISTS idx_disconnect_notifications_user_id ON public.disconnect_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_disconnect_notifications_sent_at ON public.disconnect_notifications(sent_at); 