-- Migração para adicionar campo is_deleted na tabela messages
-- Este campo marca mensagens que foram deletadas no WhatsApp

-- Verificar se a coluna já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'is_deleted'
    ) THEN
        -- Adicionar coluna is_deleted
        ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL;
        
        -- Adicionar índice para melhor performance em consultas
        CREATE INDEX idx_messages_is_deleted ON messages(is_deleted);
        
        -- Adicionar comentário na coluna
        COMMENT ON COLUMN messages.is_deleted IS 'Indica se a mensagem foi deletada no WhatsApp (mas mantida no relatório)';
        
        RAISE NOTICE 'Coluna is_deleted adicionada com sucesso na tabela messages';
    ELSE
        RAISE NOTICE 'Coluna is_deleted já existe na tabela messages';
    END IF;
END $$;
