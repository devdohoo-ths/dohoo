
-- Criar tabela para mensagens favoritas
CREATE TABLE public.favorite_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.favorite_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para mensagens favoritas
CREATE POLICY "Users can view their own favorite messages" 
  ON public.favorite_messages 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorite messages" 
  ON public.favorite_messages 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorite messages" 
  ON public.favorite_messages 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite messages" 
  ON public.favorite_messages 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_favorite_messages_updated_at
  BEFORE UPDATE ON public.favorite_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Índices para performance
CREATE INDEX idx_favorite_messages_user_id ON public.favorite_messages(user_id);
CREATE INDEX idx_favorite_messages_category ON public.favorite_messages(category);

-- Habilitar realtime para todas as tabelas de chat
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.favorite_messages REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.favorite_messages;
