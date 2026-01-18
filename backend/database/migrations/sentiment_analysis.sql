-- Análise de Sentimento por Palavras-Chave
-- Função para calcular satisfação baseada no sentimento das mensagens

-- Função para calcular satisfação automática baseada em palavras-chave
CREATE OR REPLACE FUNCTION calculate_sentiment_satisfaction(p_chat_id uuid)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  v_positive_keywords text[] := ARRAY[
    'obrigado', 'valeu', 'perfeito', 'excelente', 'ótimo', 'muito bom', 
    'resolvido', 'ajudou', 'satisfeito', 'gostei', 'funcionou', 'claro', 
    'entendi', 'top', 'show', 'legal', 'bom', 'bem', 'certo', 'sim', 
    'concordo', 'exato', 'preciso', 'perfeito', 'maravilhoso', 'fantástico',
    'incrível', 'demais', 'massa', 'irado', 'sucesso', 'consegui', 'deu certo'
  ];
  
  v_negative_keywords text[] := ARRAY[
    'ruim', 'péssimo', 'horrível', 'insatisfeito', 'não gostei', 'problema', 
    'erro', 'falha', 'lento', 'demorado', 'confuso', 'difícil', 'não funciona',
    'não entendo', 'não consigo', 'não deu certo', 'frustrado', 'irritado',
    'chateado', 'decepcionado', 'não resolveu', 'não ajudou', 'perda de tempo',
    'inútil', 'sem sentido', 'não serve', 'quebrado', 'defeituoso', 'mal',
    'terrível', 'desastre', 'catástrofe', 'não funciona', 'bug', 'erro'
  ];
  
  v_messages_count integer;
  v_positive_count integer := 0;
  v_negative_count integer := 0;
  v_neutral_count integer := 0;
  v_total_score decimal(3,2) := 0.0;
  v_message record;
  v_content_lower text;
BEGIN
  -- Contar mensagens do cliente
  SELECT COUNT(*) INTO v_messages_count
  FROM messages 
  WHERE chat_id = p_chat_id AND is_from_me = false;
  
  -- Se não há mensagens suficientes, retornar null
  IF v_messages_count < 2 THEN
    RETURN NULL;
  END IF;
  
  -- Analisar cada mensagem do cliente
  FOR v_message IN 
    SELECT content, created_at
    FROM messages 
    WHERE chat_id = p_chat_id AND is_from_me = false
    ORDER BY created_at
  LOOP
    v_content_lower := LOWER(v_message.content);
    
    -- Verificar palavras positivas
    IF EXISTS (
      SELECT 1 FROM unnest(v_positive_keywords) AS keyword
      WHERE v_content_lower LIKE '%' || keyword || '%'
    ) THEN
      v_positive_count := v_positive_count + 1;
    -- Verificar palavras negativas
    ELSIF EXISTS (
      SELECT 1 FROM unnest(v_negative_keywords) AS keyword
      WHERE v_content_lower LIKE '%' || keyword || '%'
    ) THEN
      v_negative_count := v_negative_count + 1;
    ELSE
      v_neutral_count := v_neutral_count + 1;
    END IF;
  END LOOP;
  
  -- Calcular score baseado na proporção de mensagens positivas/negativas
  IF v_messages_count > 0 THEN
    -- Fórmula: (positivas * 5 + neutras * 3 + negativas * 1) / total
    v_total_score := (
      (v_positive_count::decimal / v_messages_count) * 5.0 +
      (v_neutral_count::decimal / v_messages_count) * 3.0 +
      (v_negative_count::decimal / v_messages_count) * 1.0
    );
  END IF;
  
  -- Garantir que o score esteja entre 1.0 e 5.0
  RETURN LEAST(GREATEST(v_total_score, 1.0), 5.0);
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar satisfação do cliente na tabela conversation_analytics
CREATE OR REPLACE FUNCTION update_sentiment_satisfaction(p_chat_id uuid)
RETURNS void AS $$
DECLARE
  v_satisfaction decimal(3,2);
  v_organization_id uuid;
BEGIN
  -- Buscar organização do chat
  SELECT organization_id INTO v_organization_id 
  FROM chats WHERE id = p_chat_id;
  
  -- Calcular satisfação baseada no sentimento
  v_satisfaction := calculate_sentiment_satisfaction(p_chat_id);
  
  -- Atualizar conversation_analytics
  UPDATE conversation_analytics 
  SET customer_satisfaction = v_satisfaction,
      updated_at = now()
  WHERE chat_id = p_chat_id;
  
  -- Se não existe registro, criar um
  IF NOT FOUND THEN
    INSERT INTO conversation_analytics (chat_id, organization_id, customer_satisfaction)
    VALUES (p_chat_id, v_organization_id, v_satisfaction);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar satisfação quando mensagens são adicionadas
CREATE OR REPLACE FUNCTION trigger_update_sentiment_satisfaction()
RETURNS trigger AS $$
BEGIN
  -- Atualizar satisfação quando uma nova mensagem é adicionada
  PERFORM update_sentiment_satisfaction(NEW.chat_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS update_sentiment_satisfaction_on_message ON messages;
CREATE TRIGGER update_sentiment_satisfaction_on_message
  AFTER INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_sentiment_satisfaction();

-- Função para recalcular satisfação de todos os chats de uma organização
CREATE OR REPLACE FUNCTION recalculate_organization_satisfaction(p_organization_id uuid)
RETURNS integer AS $$
DECLARE
  v_chat record;
  v_count integer := 0;
BEGIN
  FOR v_chat IN 
    SELECT id FROM chats WHERE organization_id = p_organization_id
  LOOP
    PERFORM update_sentiment_satisfaction(v_chat.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql; 