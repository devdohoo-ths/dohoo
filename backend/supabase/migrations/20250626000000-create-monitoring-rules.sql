-- Criar tabela para regras de monitoramento
CREATE TABLE IF NOT EXISTS public.monitoring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL, -- Array de palavras/frases para monitorar
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela para registrar ocorrências das regras
CREATE TABLE IF NOT EXISTS public.rule_occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.monitoring_rules(id) ON DELETE CASCADE NOT NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  matched_keyword TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  agent_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.monitoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_occurrences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para monitoring_rules
CREATE POLICY "Users can view rules from their organization" 
  ON public.monitoring_rules 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create rules in their organization" 
  ON public.monitoring_rules 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update rules in their organization" 
  ON public.monitoring_rules 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete rules in their organization" 
  ON public.monitoring_rules 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Políticas RLS para rule_occurrences
CREATE POLICY "Users can view rule occurrences from their organization" 
  ON public.rule_occurrences 
  FOR SELECT 
  USING (
    rule_id IN (
      SELECT id FROM public.monitoring_rules 
      WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert rule occurrences" 
  ON public.rule_occurrences 
  FOR INSERT 
  WITH CHECK (true);

-- Criar índices para melhorar performance
CREATE INDEX idx_monitoring_rules_organization_id ON public.monitoring_rules(organization_id);
CREATE INDEX idx_monitoring_rules_user_id ON public.monitoring_rules(user_id);
CREATE INDEX idx_monitoring_rules_is_active ON public.monitoring_rules(is_active);
CREATE INDEX idx_rule_occurrences_rule_id ON public.rule_occurrences(rule_id);
CREATE INDEX idx_rule_occurrences_chat_id ON public.rule_occurrences(chat_id);
CREATE INDEX idx_rule_occurrences_message_timestamp ON public.rule_occurrences(message_timestamp);
CREATE INDEX idx_rule_occurrences_matched_keyword ON public.rule_occurrences(matched_keyword);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_monitoring_rules_updated_at
  BEFORE UPDATE ON public.monitoring_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentar as tabelas
COMMENT ON TABLE public.monitoring_rules IS 'Regras de monitoramento de palavras/frases nas conversas';
COMMENT ON COLUMN public.monitoring_rules.keywords IS 'Array de palavras ou frases para monitorar nas mensagens';
COMMENT ON TABLE public.rule_occurrences IS 'Registro de ocorrências quando uma regra é acionada';
COMMENT ON COLUMN public.rule_occurrences.matched_keyword IS 'Palavra/frase específica que acionou a regra'; 