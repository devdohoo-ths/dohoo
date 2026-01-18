-- ✅ Ajustar tabela flow_user_history para usar whatsapp_client_id também

-- 1. Renomear coluna user_id para whatsapp_client_id (mantendo compatibilidade)
ALTER TABLE public.flow_user_history 
  RENAME COLUMN user_id TO whatsapp_client_id;

-- 2. Atualizar índice
DROP INDEX IF EXISTS idx_flow_user_history_user_id;
CREATE INDEX IF NOT EXISTS idx_flow_user_history_whatsapp_client_id 
  ON public.flow_user_history(whatsapp_client_id);

-- 3. Atualizar políticas RLS
DROP POLICY IF EXISTS "Users can view their own flow history" ON public.flow_user_history;
DROP POLICY IF EXISTS "Users can create their own flow history" ON public.flow_user_history;
DROP POLICY IF EXISTS "Organization admins can view flow history" ON public.flow_user_history;

-- Política para permitir visualização por organização (admins e sistema)
CREATE POLICY "Allow flow history viewing" ON public.flow_user_history 
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    ) OR whatsapp_client_id IS NOT NULL
  );

-- Política para permitir criação (sistema cria para clientes WhatsApp)
CREATE POLICY "Allow flow history creation" ON public.flow_user_history 
  FOR INSERT WITH CHECK (true);

-- 4. Comentário explicando
COMMENT ON COLUMN public.flow_user_history.whatsapp_client_id IS 'Identificador do cliente WhatsApp (phone number ou JID)';
COMMENT ON TABLE public.flow_user_history IS 'Histórico de execução de fluxos para clientes WhatsApp';

