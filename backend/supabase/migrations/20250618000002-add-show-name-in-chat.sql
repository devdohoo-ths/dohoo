-- Adicionar campo show_name_in_chat na tabela profiles
-- Este campo controla se o nome do usuário deve aparecer nas mensagens do chat

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS show_name_in_chat BOOLEAN DEFAULT true;

-- Atualizar registros existentes para ter o valor padrão
UPDATE profiles 
SET show_name_in_chat = true 
WHERE show_name_in_chat IS NULL;

-- Adicionar comentário na coluna
COMMENT ON COLUMN profiles.show_name_in_chat IS 'Controla se o nome do usuário deve aparecer nas mensagens do chat. Se true, mostra "Nome: mensagem". Se false, mostra apenas "mensagem".'; 