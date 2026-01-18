-- Migration: Criar tabelas para sistema de gestão de contatos
-- Data: 2025-01-19

-- Tabela principal de contatos
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  name TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraint para garantir unicidade do telefone por organização
  CONSTRAINT unique_phone_per_organization UNIQUE (phone_number, organization_id)
);

-- Tabela de histórico para auditoria de transferências e mudanças
CREATE TABLE IF NOT EXISTS public.contact_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'transferred', 'updated', 'deleted', 'assigned')),
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dados adicionais em JSON para flexibilidade
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON public.contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON public.contacts(last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_history_contact_id ON public.contact_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_action_type ON public.contact_history(action_type);
CREATE INDEX IF NOT EXISTS idx_contact_history_created_at ON public.contact_history(created_at DESC);

-- Triggers para updated_at
CREATE TRIGGER update_contacts_updated_at 
  BEFORE UPDATE ON public.contacts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para contacts
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON public.contacts;

-- Política para visualização: usuários veem contatos da sua organização
-- Agentes veem apenas seus próprios contatos, admins veem todos
CREATE POLICY "Users can view contacts in their organization" ON public.contacts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) AND (
      -- Admin vê todos os contatos da organização
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('Admin', 'Super Admin')
      )
      OR
      -- Agente vê apenas seus próprios contatos
      user_id = auth.uid()
    )
  );

-- Política para criação: usuários podem criar contatos na sua organização
CREATE POLICY "Users can create contacts in their organization" ON public.contacts
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Política para atualização: usuários podem atualizar contatos da sua organização
-- Agentes podem atualizar apenas seus próprios contatos, admins podem atualizar todos
CREATE POLICY "Users can update contacts in their organization" ON public.contacts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) AND (
      -- Admin pode atualizar todos os contatos da organização
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('Admin', 'Super Admin')
      )
      OR
      -- Agente pode atualizar apenas seus próprios contatos
      user_id = auth.uid()
    )
  );

-- Política para exclusão: usuários podem excluir contatos da sua organização
-- Agentes podem excluir apenas seus próprios contatos, admins podem excluir todos
CREATE POLICY "Users can delete contacts in their organization" ON public.contacts
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) AND (
      -- Admin pode excluir todos os contatos da organização
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('Admin', 'Super Admin')
      )
      OR
      -- Agente pode excluir apenas seus próprios contatos
      user_id = auth.uid()
    )
  );

-- Políticas RLS para contact_history
DROP POLICY IF EXISTS "Users can view contact history in their organization" ON public.contact_history;
DROP POLICY IF EXISTS "Users can create contact history in their organization" ON public.contact_history;

-- Política para visualização do histórico
CREATE POLICY "Users can view contact history in their organization" ON public.contact_history
  FOR SELECT USING (
    contact_id IN (
      SELECT id FROM public.contacts 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Política para criação do histórico
CREATE POLICY "Users can create contact history in their organization" ON public.contact_history
  FOR INSERT WITH CHECK (
    contact_id IN (
      SELECT id FROM public.contacts 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Função para criar contato automaticamente a partir de mensagem
CREATE OR REPLACE FUNCTION public.create_contact_from_message()
RETURNS TRIGGER AS $$
DECLARE
  contact_phone TEXT;
  contact_name TEXT;
  chat_organization_id UUID;
  chat_assigned_agent_id UUID;
  existing_contact_id UUID;
BEGIN
  -- Determinar o número do contato baseado na direção da mensagem
  IF NEW.is_from_me THEN
    -- Se a mensagem é do agente, o contato é o destinatário
    SELECT c.whatsapp_jid, c.organization_id, c.assigned_agent_id
    INTO contact_phone, chat_organization_id, chat_assigned_agent_id
    FROM public.chats c
    WHERE c.id = NEW.chat_id;
    
    -- Extrair número do JID (formato: 5511999999999@s.whatsapp.net)
    contact_phone := split_part(contact_phone, '@', 1);
  ELSE
    -- Se a mensagem é do cliente, o contato é o remetente
    contact_phone := NEW.sender_jid;
    contact_name := NEW.sender_name;
    
    -- Buscar organização e agente do chat
    SELECT c.organization_id, c.assigned_agent_id
    INTO chat_organization_id, chat_assigned_agent_id
    FROM public.chats c
    WHERE c.id = NEW.chat_id;
    
    -- Extrair número do JID se necessário
    IF contact_phone LIKE '%@%' THEN
      contact_phone := split_part(contact_phone, '@', 1);
    END IF;
  END IF;

  -- Verificar se já existe um contato com este número na organização
  SELECT id INTO existing_contact_id
  FROM public.contacts
  WHERE phone_number = contact_phone
  AND organization_id = chat_organization_id;

  IF existing_contact_id IS NULL AND contact_phone IS NOT NULL THEN
    -- Criar novo contato
    INSERT INTO public.contacts (
      phone_number,
      name,
      organization_id,
      user_id,
      last_interaction_at,
      metadata
    ) VALUES (
      contact_phone,
      COALESCE(contact_name, 'Cliente'),
      chat_organization_id,
      COALESCE(chat_assigned_agent_id, auth.uid()),
      NEW.created_at,
      jsonb_build_object(
        'created_from_message', true,
        'message_id', NEW.id,
        'chat_id', NEW.chat_id
      )
    );
  ELSE
    -- Atualizar último contato existente
    UPDATE public.contacts
    SET 
      last_interaction_at = NEW.created_at,
      name = COALESCE(contact_name, name),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_message_id', NEW.id,
        'last_chat_id', NEW.chat_id
      )
    WHERE id = existing_contact_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar contatos automaticamente quando uma mensagem é inserida
DROP TRIGGER IF EXISTS trigger_create_contact_from_message ON public.messages;
CREATE TRIGGER trigger_create_contact_from_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_contact_from_message();

-- Comentários para documentação
COMMENT ON TABLE public.contacts IS 'Tabela principal de contatos do sistema';
COMMENT ON TABLE public.contact_history IS 'Histórico de ações realizadas nos contatos para auditoria';
COMMENT ON FUNCTION public.create_contact_from_message() IS 'Função que cria contatos automaticamente a partir de mensagens recebidas/enviadas';
