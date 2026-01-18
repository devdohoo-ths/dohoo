-- 🚀 OTIMIZAÇÃO: Função otimizada para incrementar unread_count
-- Reduz PATCHs desnecessários verificando se realmente precisa atualizar

CREATE OR REPLACE FUNCTION public.increment_unread_count(chat_id_param uuid)
RETURNS void AS $$
DECLARE
  current_unread_count INTEGER;
  current_last_message_at TIMESTAMP WITH TIME ZONE;
  message_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- ✅ OTIMIZAÇÃO: Buscar valores atuais do chat
  SELECT unread_count, last_message_at INTO current_unread_count, current_last_message_at
  FROM public.chats
  WHERE id = chat_id_param;
  
  -- ✅ OTIMIZAÇÃO: Buscar created_at da mensagem mais recente
  SELECT MAX(created_at) INTO message_created_at
  FROM public.messages
  WHERE chat_id = chat_id_param
    AND is_from_me = false; -- Apenas mensagens recebidas incrementam unread_count
  
  -- ✅ OTIMIZAÇÃO: Só atualizar se:
  -- 1. A mensagem é mais recente que last_message_at atual, OU
  -- 2. last_message_at é NULL
  IF message_created_at IS NOT NULL AND 
     (current_last_message_at IS NULL OR message_created_at > current_last_message_at) THEN
    
    -- ✅ OTIMIZAÇÃO: Só fazer PATCH se realmente precisa atualizar
    UPDATE public.chats
    SET 
      unread_count = COALESCE(current_unread_count, 0) + 1,
      updated_at = now(),
      last_message_at = message_created_at
    WHERE id = chat_id_param
      -- ✅ OTIMIZAÇÃO: Evitar PATCH se unread_count já está muito alto (possível erro)
      AND (current_unread_count IS NULL OR current_unread_count < 10000);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comentário para documentação
COMMENT ON FUNCTION public.increment_unread_count(uuid) IS 
'Função otimizada para incrementar unread_count. Reduz PATCHs desnecessários verificando se realmente precisa atualizar antes de fazer o UPDATE.';

