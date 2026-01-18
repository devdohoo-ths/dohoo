
-- Função para incrementar o contador de mensagens não lidas e atualizar timestamps
CREATE OR REPLACE FUNCTION public.increment_unread_count(chat_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.chats
  SET 
    unread_count = COALESCE(unread_count, 0) + 1,
    updated_at = now(),
    last_message_at = now()
  WHERE id = chat_id_param;
END;
$$ LANGUAGE plpgsql;
