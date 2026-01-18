-- Atualizar a restrição de chave estrangeira para incluir ON DELETE CASCADE
ALTER TABLE public.ai_token_usage
DROP CONSTRAINT IF EXISTS ai_token_usage_chat_id_fkey,
ADD CONSTRAINT ai_token_usage_chat_id_fkey
FOREIGN KEY (chat_id)
REFERENCES public.chats(id)
ON DELETE CASCADE; 