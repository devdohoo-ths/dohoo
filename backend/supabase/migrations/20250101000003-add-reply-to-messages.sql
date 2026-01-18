-- Migração para adicionar suporte a respostas de mensagens
-- Adicionar coluna reply_to na tabela messages

-- Verificar se a coluna já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'reply_to'
    ) THEN
        -- Adicionar coluna reply_to
        ALTER TABLE messages ADD COLUMN reply_to UUID REFERENCES messages(id);
        
        -- Adicionar índice para melhor performance
        CREATE INDEX idx_messages_reply_to ON messages(reply_to);
        
        -- Adicionar comentário na coluna
        COMMENT ON COLUMN messages.reply_to IS 'Referência à mensagem original quando esta é uma resposta';
        
        RAISE NOTICE 'Coluna reply_to adicionada com sucesso na tabela messages';
    ELSE
        RAISE NOTICE 'Coluna reply_to já existe na tabela messages';
    END IF;
END $$;

