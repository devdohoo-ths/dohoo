-- ✅ Corrigir tabela flow_user_state para suportar clientes WhatsApp
-- Clientes WhatsApp não são usuários autenticados, então precisamos de um campo diferente

-- 1. Tornar user_id nullable (para permitir clientes não autenticados)
ALTER TABLE public.flow_user_state 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Adicionar coluna para identificador do cliente WhatsApp (phone ou JID)
ALTER TABLE public.flow_user_state 
  ADD COLUMN IF NOT EXISTS whatsapp_client_id TEXT;

-- 3. Remover constraint UNIQUE antigo
ALTER TABLE public.flow_user_state 
  DROP CONSTRAINT IF EXISTS flow_user_state_user_id_account_id_flow_id_key;

-- 4. Criar novo constraint UNIQUE que funciona para ambos os casos
-- Usar COALESCE para permitir tanto user_id quanto whatsapp_client_id
ALTER TABLE public.flow_user_state 
  ADD CONSTRAINT unique_user_flow_state 
  UNIQUE NULLS NOT DISTINCT (user_id, whatsapp_client_id, account_id, flow_id);

-- 5. Criar índice para whatsapp_client_id
CREATE INDEX IF NOT EXISTS idx_flow_user_state_whatsapp_client_id 
  ON public.flow_user_state(whatsapp_client_id);

-- 6. Atualizar políticas RLS para permitir acesso público (sem autenticação)
-- para clientes WhatsApp

DROP POLICY IF EXISTS "Users can view their own flow state" ON public.flow_user_state;
DROP POLICY IF EXISTS "Users can create their own flow state" ON public.flow_user_state;
DROP POLICY IF EXISTS "Users can update their own flow state" ON public.flow_user_state;
DROP POLICY IF EXISTS "Users can delete their own flow state" ON public.flow_user_state;

-- Política para visualizar: usuários autenticados veem seu estado, sistema pode ver estados de clientes WhatsApp
CREATE POLICY "Users can view flow states" ON public.flow_user_state 
  FOR SELECT USING (
    user_id = auth.uid() OR 
    whatsapp_client_id IS NOT NULL
  );

-- Política para criar: qualquer um pode criar (sistema criará para clientes WhatsApp)
CREATE POLICY "Allow flow state creation" ON public.flow_user_state 
  FOR INSERT WITH CHECK (true);

-- Política para atualizar: usuários autenticados podem atualizar seu estado, sistema pode atualizar clientes WhatsApp
CREATE POLICY "Allow flow state updates" ON public.flow_user_state 
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    whatsapp_client_id IS NOT NULL
  );

-- Política para deletar: usuários autenticados podem deletar seu estado, sistema pode deletar clientes WhatsApp
CREATE POLICY "Allow flow state deletion" ON public.flow_user_state 
  FOR DELETE USING (
    user_id = auth.uid() OR 
    whatsapp_client_id IS NOT NULL
  );

-- 7. Comentário explicando a estrutura
COMMENT ON COLUMN public.flow_user_state.user_id IS 'UUID do usuário autenticado (para usuários do sistema)';
COMMENT ON COLUMN public.flow_user_state.whatsapp_client_id IS 'Identificador do cliente WhatsApp (phone number ou JID) para clientes não autenticados';
COMMENT ON TABLE public.flow_user_state IS 'Armazena o estado atual de cada usuário/cliente em um fluxo. Suporta tanto usuários autenticados (user_id) quanto clientes WhatsApp (whatsapp_client_id)';

