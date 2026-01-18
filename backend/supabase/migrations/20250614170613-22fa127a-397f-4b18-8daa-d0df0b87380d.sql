
-- Primeiro, criar constraint única para chat_id na tabela conversation_analytics
ALTER TABLE conversation_analytics 
ADD CONSTRAINT conversation_analytics_chat_id_unique UNIQUE (chat_id);

-- Criar função para calcular analytics de uma conversa (corrigida para usar UPSERT corretamente)
CREATE OR REPLACE FUNCTION calculate_conversation_analytics(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_message_count integer;
    v_avg_response_time numeric;
    v_keywords text[];
    v_sentiment_score numeric;
    v_organization_id uuid;
    v_analysis_data jsonb;
    v_content_text text;
    v_analytics_exists boolean;
BEGIN
    -- Buscar organization_id do chat
    SELECT organization_id INTO v_organization_id
    FROM chats WHERE id = p_chat_id;
    
    -- Contar mensagens na conversa
    SELECT COUNT(*) INTO v_message_count
    FROM messages WHERE chat_id = p_chat_id;
    
    -- Calcular tempo médio de resposta (em segundos)
    WITH message_times AS (
        SELECT 
            created_at,
            lead(created_at) OVER (ORDER BY created_at) as next_created_at,
            is_from_me
        FROM messages 
        WHERE chat_id = p_chat_id 
        ORDER BY created_at
    )
    SELECT AVG(EXTRACT(EPOCH FROM (next_created_at - created_at)))
    INTO v_avg_response_time
    FROM message_times
    WHERE is_from_me = true AND next_created_at IS NOT NULL;
    
    -- Concatenar todo o conteúdo das mensagens
    SELECT string_agg(lower(content), ' ')
    INTO v_content_text
    FROM messages 
    WHERE chat_id = p_chat_id AND content IS NOT NULL;
    
    -- Simular extração de palavras-chave (implementação simplificada)
    WITH words AS (
        SELECT unnest(string_to_array(COALESCE(v_content_text, ''), ' ')) as word
    )
    SELECT array_agg(DISTINCT word ORDER BY word)
    INTO v_keywords
    FROM words
    WHERE length(trim(word)) > 3
    LIMIT 10;
    
    -- Simular análise de sentimento baseada em palavras-chave
    SELECT CASE 
        WHEN COALESCE(v_content_text, '') ILIKE ANY(ARRAY['%obrigado%', '%perfeito%', '%excelente%', '%ótimo%', '%agradeço%']) THEN 0.8
        WHEN COALESCE(v_content_text, '') ILIKE ANY(ARRAY['%problema%', '%erro%', '%ruim%', '%péssimo%', '%reclamação%']) THEN -0.6
        ELSE 0.1
    END INTO v_sentiment_score;
    
    -- Criar dados de análise
    v_analysis_data := jsonb_build_object(
        'summary', 'Conversa analisada automaticamente',
        'topics', COALESCE(v_keywords, ARRAY[]::text[]),
        'issues', CASE WHEN v_sentiment_score < 0 THEN ARRAY['Possível insatisfação'] ELSE ARRAY[]::text[] END,
        'satisfaction_indicators', CASE WHEN v_sentiment_score > 0.5 THEN ARRAY['Cliente satisfeito'] ELSE ARRAY[]::text[] END,
        'resolution_suggestions', ARRAY['Acompanhar satisfação', 'Verificar resolução']
    );
    
    -- Verificar se já existe analytics para este chat
    SELECT EXISTS(SELECT 1 FROM conversation_analytics WHERE chat_id = p_chat_id) INTO v_analytics_exists;
    
    IF v_analytics_exists THEN
        -- Atualizar registro existente
        UPDATE conversation_analytics SET
            analysis_data = v_analysis_data,
            keywords = to_jsonb(COALESCE(v_keywords, ARRAY[]::text[])),
            sentiment_score = v_sentiment_score,
            interaction_count = v_message_count,
            customer_satisfaction = GREATEST(0, LEAST(1, (v_sentiment_score + 1) / 2)),
            response_time_avg = COALESCE(v_avg_response_time, 0),
            resolution_status = CASE WHEN v_message_count > 10 THEN 'resolved' ELSE 'pending' END,
            priority_level = CASE WHEN v_sentiment_score < -0.3 THEN 'high' ELSE 'medium' END,
            updated_at = now()
        WHERE chat_id = p_chat_id;
    ELSE
        -- Inserir novo registro
        INSERT INTO conversation_analytics (
            chat_id,
            organization_id,
            analysis_data,
            keywords,
            sentiment_score,
            interaction_count,
            customer_satisfaction,
            response_time_avg,
            resolution_status,
            priority_level
        ) VALUES (
            p_chat_id,
            v_organization_id,
            v_analysis_data,
            to_jsonb(COALESCE(v_keywords, ARRAY[]::text[])),
            v_sentiment_score,
            v_message_count,
            GREATEST(0, LEAST(1, (v_sentiment_score + 1) / 2)),
            COALESCE(v_avg_response_time, 0),
            CASE WHEN v_message_count > 10 THEN 'resolved' ELSE 'pending' END,
            CASE WHEN v_sentiment_score < -0.3 THEN 'high' ELSE 'medium' END
        );
    END IF;
END;
$$;

-- Criar função para processar analytics de todos os chats
CREATE OR REPLACE FUNCTION process_all_analytics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    chat_record RECORD;
BEGIN
    FOR chat_record IN 
        SELECT DISTINCT c.id 
        FROM chats c 
        LEFT JOIN conversation_analytics ca ON c.id = ca.chat_id
        WHERE ca.chat_id IS NULL OR ca.updated_at < c.updated_at
    LOOP
        PERFORM calculate_conversation_analytics(chat_record.id);
    END LOOP;
END;
$$;

-- Criar trigger para gerar analytics automaticamente quando mensagens são inseridas
CREATE OR REPLACE FUNCTION trigger_analytics_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Agendar recalculo de analytics para o chat após inserção de mensagem
    PERFORM calculate_conversation_analytics(NEW.chat_id);
    RETURN NEW;
END;
$$;

-- Aplicar trigger na tabela de mensagens
DROP TRIGGER IF EXISTS messages_analytics_trigger ON messages;
CREATE TRIGGER messages_analytics_trigger
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_analytics_update();

-- Inserir alguns dados de exemplo para demonstração
INSERT INTO organizations (name, domain) VALUES 
('Empresa Demo', 'demo.com') 
ON CONFLICT DO NOTHING;

INSERT INTO chats (name, platform, organization_id) 
SELECT 'Chat com Cliente 1', 'whatsapp', id FROM organizations WHERE name = 'Empresa Demo'
ON CONFLICT DO NOTHING;

INSERT INTO chats (name, platform, organization_id) 
SELECT 'Chat com Cliente 2', 'whatsapp', id FROM organizations WHERE name = 'Empresa Demo' 
ON CONFLICT DO NOTHING;

-- Inserir mensagens de exemplo
WITH demo_org AS (SELECT id FROM organizations WHERE name = 'Empresa Demo' LIMIT 1),
     demo_chats AS (SELECT id, name FROM chats WHERE organization_id = (SELECT id FROM demo_org) LIMIT 2)
INSERT INTO messages (chat_id, content, is_from_me, sender_name, organization_id)
SELECT 
    c.id,
    CASE 
        WHEN c.name = 'Chat com Cliente 1' THEN 
            CASE (row_number() OVER (ORDER BY c.id))::int % 4
                WHEN 1 THEN 'Olá, preciso de ajuda com meu pedido'
                WHEN 2 THEN 'Obrigado pelo atendimento, foi excelente!'
                WHEN 3 THEN 'Perfeito, muito obrigado!'
                ELSE 'Ótimo atendimento, recomendo!'
            END
        ELSE 
            CASE (row_number() OVER (ORDER BY c.id))::int % 4
                WHEN 1 THEN 'Estou com problema no meu produto'
                WHEN 2 THEN 'Isso é péssimo, quero reclamação'
                WHEN 3 THEN 'Ainda não resolveram meu problema'
                ELSE 'Serviço ruim, vou cancelar'
            END
    END,
    (row_number() OVER (ORDER BY c.id))::int % 2 = 0,
    CASE WHEN (row_number() OVER (ORDER BY c.id))::int % 2 = 0 THEN 'Atendente' ELSE 'Cliente' END,
    (SELECT id FROM demo_org)
FROM demo_chats c
CROSS JOIN generate_series(1, 4)
ON CONFLICT DO NOTHING;

-- Processar analytics iniciais
SELECT process_all_analytics();
