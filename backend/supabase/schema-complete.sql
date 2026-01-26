-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- ============================================
-- BASE TABLES (Must be created FIRST due to foreign key dependencies)
-- ============================================

-- Create enum type for organization status
DO $$ BEGIN
    CREATE TYPE public.organization_status AS ENUM ('active', 'inactive', 'suspended', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  logo_url text,
  settings jsonb DEFAULT jsonb_build_object('whatsapp_api', 'baileys'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cpf_cnpj text,
  deleted_at timestamp with time zone,
  max_users integer DEFAULT 10,
  status organization_status NOT NULL DEFAULT 'active'::organization_status,
  is_poc boolean DEFAULT false,
  poc_start_date timestamp without time zone,
  poc_end_date timestamp without time zone,
  poc_duration_days integer DEFAULT 30,
  poc_notifications_sent jsonb DEFAULT '[]'::jsonb,
  poc_status character varying DEFAULT 'inactive'::character varying CHECK (poc_status::text = ANY (ARRAY['inactive'::character varying, 'active'::character varying, 'expired'::character varying, 'converted'::character varying]::text[])),
  poc_contact_email character varying,
  poc_contact_phone character varying,
  financial_email character varying,
  price_per_user numeric DEFAULT 0,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL,
  name character varying NOT NULL UNIQUE,
  description text,
  organization_id uuid,
  permissions jsonb,
  is_default boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  department text,
  is_online boolean DEFAULT false,
  organization_id uuid,
  permissions jsonb DEFAULT '{"chat": true, "users": false, "settings": false, "analytics": false}'::jsonb,
  email text,
  last_seen timestamp without time zone,
  show_name_in_chat boolean DEFAULT true,
  deleted_at timestamp with time zone,
  cpf_cnpj text,
  platform_permissions jsonb DEFAULT '{"api": {"view": false, "create": false, "manage": false, "viewAll": false}, "facebook": {"view": false, "create": false, "manage": false, "viewAll": false}, "telegram": {"view": false, "create": false, "manage": false, "viewAll": false}, "whatsapp": {"view": true, "create": false, "manage": false, "viewAll": false}, "instagram": {"view": false, "create": false, "manage": false, "viewAll": false}}'::jsonb,
  role_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  -- ✅ CORREÇÃO: Removida constraint profiles_role_id_fkey - agora role_id pode referenciar roles OU default_roles
  -- A validação é feita via trigger validate_role_id_trigger
  CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- ============================================
-- OTHER TABLES
-- ============================================

CREATE TABLE public.agent_credit_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  monthly_limit integer DEFAULT 1000,
  daily_limit integer DEFAULT 100,
  current_month_used integer DEFAULT 0,
  current_day_used integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_credit_limits_pkey PRIMARY KEY (id),
  CONSTRAINT agent_credit_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT agent_credit_limits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.ai_assistants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  avatar_url text,
  personality text,
  instructions text NOT NULL,
  model text NOT NULL,
  provider text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  tags text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  business_hours jsonb,
  organization_id uuid,
  audio_enabled boolean DEFAULT false,
  audio_transcription boolean DEFAULT false,
  audio_synthesis boolean DEFAULT false,
  audio_voice text,
  audio_provider text,
  audio_model text,
  image_enabled boolean DEFAULT false,
  image_provider text,
  image_model text,
  image_size text,
  assistant_type text DEFAULT 'individual'::text CHECK (assistant_type = ANY (ARRAY['individual'::text, 'organizational'::text])),
  is_organizational boolean DEFAULT false,
  CONSTRAINT ai_assistants_pkey PRIMARY KEY (id),
  CONSTRAINT ai_assistants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT ai_assistants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.ai_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid NOT NULL UNIQUE,
  credits_purchased integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  -- Postgres não permite referenciar outras colunas em DEFAULT.
  -- Usamos uma coluna gerada para manter o valor sempre consistente.
  credits_remaining integer GENERATED ALWAYS AS (credits_purchased - credits_used) STORED,
  last_purchase_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_credits_pkey PRIMARY KEY (id),
  CONSTRAINT ai_credits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.ai_knowledge_bases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'general'::text,
  tags text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_knowledge_bases_pkey PRIMARY KEY (id),
  CONSTRAINT ai_knowledge_bases_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES public.ai_assistants(id)
);
CREATE TABLE public.ai_reports_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  report_name character varying NOT NULL,
  date_start timestamp with time zone NOT NULL,
  date_end timestamp with time zone NOT NULL,
  report_data jsonb NOT NULL,
  total_messages integer NOT NULL DEFAULT 0,
  total_agents integer NOT NULL DEFAULT 0,
  sentiment_analysis jsonb,
  topic_analysis jsonb,
  insights text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_reports_history_pkey PRIMARY KEY (id),
  CONSTRAINT ai_reports_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT ai_reports_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{"audio": {"enabled": false, "voiceId": "", "language": "pt-BR", "provider": "none"}, "image": {"size": "1024x1024", "model": "dall-e-3", "enabled": false, "provider": "none"}, "general": {"model": "gpt-4", "enabled": true, "maxTokens": 2000, "temperature": 0.7}, "scheduling": {"enabled": false, "location": "", "timezone": "America/Sao_Paulo", "service_types": [], "business_hours": {"friday": {"end": "18:00", "start": "09:00", "enabled": true}, "monday": {"end": "18:00", "start": "09:00", "enabled": true}, "sunday": {"end": "18:00", "start": "09:00", "enabled": false}, "tuesday": {"end": "18:00", "start": "09:00", "enabled": true}, "saturday": {"end": "18:00", "start": "09:00", "enabled": false}, "thursday": {"end": "18:00", "start": "09:00", "enabled": true}, "wednesday": {"end": "18:00", "start": "09:00", "enabled": true}}, "default_duration": 60, "auto_scheduling_enabled": false, "google_calendar_enabled": false}}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_settings_pkey PRIMARY KEY (id),
  CONSTRAINT ai_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- Chats precisam existir antes de qualquer tabela que referencie public.chats (ex: ai_token_usage)
CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'whatsapp'::text,
  remote_jid text,
  avatar_url text,
  status text DEFAULT 'active'::text,
  priority text DEFAULT 'medium'::text,
  assigned_agent_id uuid,
  department text,
  is_group boolean DEFAULT false,
  participants jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  whatsapp_jid text,
  unread_count integer DEFAULT 0,
  last_message_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_assigned_agent_id_fkey FOREIGN KEY (assigned_agent_id) REFERENCES auth.users(id),
  CONSTRAINT chats_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.ai_token_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  assistant_id uuid,
  chat_id uuid,
  tokens_used integer NOT NULL,
  model_used text NOT NULL,
  cost_in_credits integer NOT NULL,
  message_type text DEFAULT 'chat'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  system_tokens integer DEFAULT 0,
  context_tokens integer DEFAULT 0,
  user_message_tokens integer DEFAULT 0,
  tools_enabled boolean DEFAULT false,
  message_complexity text DEFAULT 'simple'::text CHECK (message_complexity = ANY (ARRAY['simple'::text, 'complex'::text])),
  optimization_applied boolean DEFAULT false,
  processing_time_ms integer DEFAULT 0,
  CONSTRAINT ai_token_usage_pkey PRIMARY KEY (id),
  CONSTRAINT ai_token_usage_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT ai_token_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT ai_token_usage_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES public.ai_assistants(id),
  CONSTRAINT ai_token_usage_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.ai_training_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  tags text[],
  validated boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_training_data_pkey PRIMARY KEY (id),
  CONSTRAINT ai_training_data_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES public.ai_assistants(id)
);

-- Transcripts precisa existir antes de audio_conversions (FK em transcript_id)
CREATE TABLE public.transcripts (
  -- Usamos IDENTITY para evitar dependência de sequence explícita
  id integer GENERATED BY DEFAULT AS IDENTITY,
  chat_id uuid,
  audio_file_path character varying,
  transcript_text text,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT transcripts_pkey PRIMARY KEY (id),
  CONSTRAINT transcripts_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);

CREATE TABLE public.audio_conversions (
  -- Usamos IDENTITY para evitar dependência de sequence explícita
  id integer GENERATED BY DEFAULT AS IDENTITY,
  transcript_id integer,
  original_audio_path character varying,
  converted_audio_path character varying,
  voice_id character varying,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audio_conversions_pkey PRIMARY KEY (id),
  CONSTRAINT audio_conversions_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.transcripts(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action character varying,
  details jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.blacklist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  numero_telefone text NOT NULL,
  motivo text,
  ativo boolean DEFAULT true,
  criado_por uuid,
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT blacklist_pkey PRIMARY KEY (id),
  CONSTRAINT blacklist_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT blacklist_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.blacklist_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  blacklist_id uuid,
  organization_id uuid NOT NULL,
  usuario_id uuid,
  acao text NOT NULL CHECK (acao = ANY (ARRAY['adicionado'::text, 'removido'::text, 'ativado'::text, 'desativado'::text])),
  numero_telefone text NOT NULL,
  motivo text,
  detalhes jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT blacklist_logs_pkey PRIMARY KEY (id),
  CONSTRAINT blacklist_logs_blacklist_id_fkey FOREIGN KEY (blacklist_id) REFERENCES public.blacklist(id),
  CONSTRAINT blacklist_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT blacklist_logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id)
);
-- broadcast_lists deve existir antes das tabelas que o referenciam
CREATE TABLE public.broadcast_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  organization_id uuid NOT NULL,
  created_by uuid NOT NULL,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying]::text[])),
  contact_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT broadcast_lists_pkey PRIMARY KEY (id),
  CONSTRAINT broadcast_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT broadcast_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.broadcast_list_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  broadcast_list_id uuid NOT NULL,
  phone_number character varying NOT NULL,
  name character varying,
  whatsapp_jid character varying,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'blocked'::character varying]::text[])),
  added_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT broadcast_list_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT broadcast_list_contacts_broadcast_list_id_fkey FOREIGN KEY (broadcast_list_id) REFERENCES public.broadcast_lists(id)
);
CREATE TABLE public.broadcast_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  broadcast_list_id uuid NOT NULL,
  message_content text NOT NULL,
  account_id character varying NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status character varying DEFAULT 'sending'::character varying CHECK (status::text = ANY (ARRAY['sending'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying]::text[])),
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  media_info jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT broadcast_messages_pkey PRIMARY KEY (id),
  CONSTRAINT broadcast_messages_broadcast_list_id_fkey FOREIGN KEY (broadcast_list_id) REFERENCES public.broadcast_lists(id),
  CONSTRAINT broadcast_messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT broadcast_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.campanha_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nome text NOT NULL,
  conteudo text NOT NULL,
  variaveis jsonb DEFAULT '[]'::jsonb,
  aprovado boolean DEFAULT false,
  criado_por uuid,
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT campanha_templates_pkey PRIMARY KEY (id),
  CONSTRAINT campanha_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT campanha_templates_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.profiles(id)
);

-- campanhas deve ser criada antes das tabelas que a referenciam
CREATE TABLE public.campanhas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nome text NOT NULL,
  template_id uuid,
  created_by uuid,
  status text DEFAULT 'rascunho'::text CHECK (status = ANY (ARRAY['rascunho'::text, 'em_execucao'::text, 'finalizada'::text, 'erro'::text, 'pausada'::text])),
  total_destinatarios integer DEFAULT 0,
  enviados integer DEFAULT 0,
  respondidos integer DEFAULT 0,
  data_inicio timestamp with time zone,
  data_fim timestamp with time zone,
  usar_ia boolean DEFAULT false,
  configuracoes jsonb DEFAULT '{}'::jsonb,
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT campanhas_pkey PRIMARY KEY (id),
  CONSTRAINT campanhas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT campanhas_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.campanha_templates(id),
  CONSTRAINT campanhas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.campanha_contatos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL,
  contato_id uuid NOT NULL,
  contato_nome text,
  contato_telefone text,
  enviado_por uuid,
  status text DEFAULT 'pendente'::text CHECK (status = ANY (ARRAY['pendente'::text, 'enviado'::text, 'erro'::text, 'respondido'::text])),
  mensagem_enviada text,
  resposta_cliente text,
  resumo_ia text,
  sentimento_ia text CHECK (sentimento_ia = ANY (ARRAY['positivo'::text, 'neutro'::text, 'negativo'::text])),
  erro_detalhes text,
  enviado_em timestamp with time zone,
  respondido_em timestamp with time zone,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT campanha_contatos_pkey PRIMARY KEY (id),
  CONSTRAINT campanha_contatos_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES public.campanhas(id),
  CONSTRAINT campanha_contatos_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES public.profiles(id)
);

CREATE TABLE public.campanha_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL,
  usuario_id uuid,
  acao text NOT NULL,
  detalhes jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT campanha_logs_pkey PRIMARY KEY (id),
  CONSTRAINT campanha_logs_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES public.campanhas(id),
  CONSTRAINT campanha_logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.campanha_remetentes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  numero_whatsapp text,
  ativo boolean DEFAULT true,
  mensagens_enviadas integer DEFAULT 0,
  ultima_mensagem timestamp with time zone,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT campanha_remetentes_pkey PRIMARY KEY (id),
  CONSTRAINT campanha_remetentes_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES public.campanhas(id),
  CONSTRAINT campanha_remetentes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.cdr_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  account_id text NOT NULL,
  name character varying NOT NULL,
  welcome_message text NOT NULL,
  distribution_mode character varying DEFAULT 'sequential'::character varying CHECK (distribution_mode::text = ANY (ARRAY['sequential'::character varying, 'random'::character varying]::text[])),
  active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cdr_configs_pkey PRIMARY KEY (id),
  CONSTRAINT cdr_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT cdr_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.cdr_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cdr_groups_pkey PRIMARY KEY (id),
  CONSTRAINT cdr_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT cdr_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.cdr_group_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone_number character varying,
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cdr_group_users_pkey PRIMARY KEY (id),
  CONSTRAINT cdr_group_users_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.cdr_groups(id),
  CONSTRAINT cdr_group_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.cdr_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cdr_config_id uuid NOT NULL,
  option_number integer NOT NULL,
  option_text text NOT NULL,
  group_id uuid,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cdr_options_pkey PRIMARY KEY (id),
  CONSTRAINT cdr_options_cdr_config_id_fkey FOREIGN KEY (cdr_config_id) REFERENCES public.cdr_configs(id)
);

CREATE TABLE public.cdr_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cdr_config_id uuid NOT NULL,
  customer_phone character varying NOT NULL,
  customer_name character varying,
  current_step character varying DEFAULT 'welcome'::character varying,
  selected_option integer,
  group_id uuid,
  assigned_to uuid,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'waiting'::character varying, 'assigned'::character varying, 'completed'::character varying, 'cancelled'::character varying]::text[])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cdr_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT cdr_sessions_cdr_config_id_fkey FOREIGN KEY (cdr_config_id) REFERENCES public.cdr_configs(id),
  CONSTRAINT cdr_sessions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.cdr_groups(id),
  CONSTRAINT cdr_sessions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
);

-- cdr_actives depende de cdr_sessions e cdr_groups
CREATE TABLE public.cdr_actives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone_number character varying NOT NULL,
  message_sent text,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'sent'::character varying, 'delivered'::character varying, 'read'::character varying, 'error'::character varying]::text[])),
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cdr_actives_pkey PRIMARY KEY (id),
  CONSTRAINT cdr_actives_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.cdr_sessions(id),
  CONSTRAINT cdr_actives_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.cdr_groups(id),
  CONSTRAINT cdr_actives_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.chat_interface_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  chat_type character varying NOT NULL CHECK (chat_type::text = ANY (ARRAY['internal'::character varying, 'external'::character varying, 'hybrid'::character varying]::text[])),
  internal_config jsonb DEFAULT '{"allow_mentions": true, "max_file_size_mb": 10, "allow_file_sharing": true}'::jsonb,
  external_config jsonb DEFAULT '{"platforms": ["whatsapp"], "auto_reply_enabled": false, "business_hours_only": false}'::jsonb,
  routing_rules jsonb DEFAULT '{"auto_assign": false, "skills_based": false, "priority_based": false}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_interface_config_pkey PRIMARY KEY (id),
  CONSTRAINT chat_interface_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.connection_accounts (
  id text NOT NULL,
  name character varying NOT NULL,
  platform character varying NOT NULL CHECK (platform::text = ANY (ARRAY['whatsapp'::character varying, 'telegram'::character varying, 'facebook'::character varying, 'instagram'::character varying, 'api'::character varying]::text[])),
  status character varying NOT NULL DEFAULT 'disconnected'::character varying CHECK (status::text = ANY (ARRAY['connected'::character varying, 'connecting'::character varying, 'disconnected'::character varying, 'error'::character varying]::text[])),
  user_id uuid,
  organization_id uuid,
  assigned_to uuid,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT connection_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT connection_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT connection_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT connection_accounts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  name text,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_interaction_at timestamp with time zone,
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.contact_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['created'::text, 'transferred'::text, 'updated'::text, 'deleted'::text, 'assigned'::text])),
  from_user_id uuid,
  to_user_id uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT contact_history_pkey PRIMARY KEY (id),
  CONSTRAINT contact_history_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT contact_history_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id),
  CONSTRAINT contact_history_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.profiles(id),
  CONSTRAINT contact_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversation_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid UNIQUE,
  organization_id uuid,
  analysis_data jsonb DEFAULT '{}'::jsonb,
  keywords jsonb DEFAULT '[]'::jsonb,
  sentiment_score numeric,
  interaction_count integer DEFAULT 0,
  resolution_status text DEFAULT 'pending'::text,
  priority_level text DEFAULT 'medium'::text,
  customer_satisfaction numeric,
  response_time_avg numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversation_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_analytics_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT conversation_analytics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['purchase'::text, 'usage'::text, 'refund'::text])),
  credits_amount integer NOT NULL,
  cost_usd numeric,
  payment_status text DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])),
  stripe_payment_id text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT credit_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.dashboard_widgets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  widget_type text NOT NULL,
  widget_config jsonb DEFAULT '{}'::jsonb,
  position_x integer DEFAULT 0,
  position_y integer DEFAULT 0,
  width integer DEFAULT 1,
  height integer DEFAULT 1,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  organization_id uuid,
  title text,
  description text,
  is_visible boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT dashboard_widgets_pkey PRIMARY KEY (id),
  CONSTRAINT dashboard_widgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT dashboard_widgets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.database_connections (
  id text NOT NULL,
  name character varying NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['postgresql'::character varying, 'mysql'::character varying, 'sqlite'::character varying, 'supabase'::character varying]::text[])),
  host character varying,
  port integer,
  database character varying,
  username character varying,
  password text,
  url text,
  service_role_key text,
  status character varying DEFAULT 'disconnected'::character varying CHECK (status::text = ANY (ARRAY['connected'::character varying, 'disconnected'::character varying, 'error'::character varying]::text[])),
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone,
  CONSTRAINT database_connections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.database_settings (
  id integer NOT NULL DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT database_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.default_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  permissions jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT default_roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  organization_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  delivery_strategy text NOT NULL DEFAULT 'round_robin'::text,
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.department_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'agent'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT department_members_pkey PRIMARY KEY (id),
  CONSTRAINT department_members_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT department_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.email_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  notification_types jsonb DEFAULT '["disconnected", "connected", "poor_service"]'::jsonb,
  email_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_settings_pkey PRIMARY KEY (id),
  CONSTRAINT email_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.favorite_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'geral'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorite_messages_pkey PRIMARY KEY (id),
  CONSTRAINT favorite_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.flow_user_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  whatsapp_client_id uuid NOT NULL,
  account_id uuid NOT NULL,
  flow_id uuid NOT NULL,
  final_node_id text NOT NULL,
  variables jsonb,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  organization_id uuid,
  extra jsonb,
  CONSTRAINT flow_user_history_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fluxos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  nome text NOT NULL,
  descricao text,
  nodes jsonb NOT NULL,
  edges jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  canal text DEFAULT 'whatsapp'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT fluxos_pkey PRIMARY KEY (id),
  CONSTRAINT fluxos_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT fluxos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.flow_user_state (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  account_id text NOT NULL,
  flow_id uuid,
  current_node_id text NOT NULL,
  variables jsonb DEFAULT '{}'::jsonb,
  last_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  whatsapp_client_id text,
  CONSTRAINT flow_user_state_pkey PRIMARY KEY (id),
  CONSTRAINT flow_user_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT flow_user_state_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.fluxos(id)
);
CREATE TABLE public.google_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  google_event_id text NOT NULL,
  client_phone_number text,
  user_email text NOT NULL,
  start_date_time timestamp with time zone NOT NULL,
  end_date_time timestamp with time zone NOT NULL,
  summary text,
  description text,
  location text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'rescheduled'::text])),
  chat_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT google_calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT google_calendar_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT google_calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT google_calendar_events_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
-- messages precisa existir antes de qualquer tabela que referencie public.messages
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  sender_id uuid,
  sender_name text,
  content text,
  message_type text DEFAULT 'text'::text,
  media_url text,
  is_from_me boolean DEFAULT false,
  is_internal boolean DEFAULT false,
  is_important boolean DEFAULT false,
  status text DEFAULT 'sent'::text,
  message_id text,
  reply_to uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  whatsapp_message_id text,
  account_id uuid,
  user_id uuid,
  reactions jsonb,
  message_key jsonb,
  message_object jsonb,
  sender_jid text,
  is_deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id),
  CONSTRAINT messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES public.messages(id),
  CONSTRAINT messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.google_drive_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  google_file_id text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint,
  folder_id text,
  chat_id uuid,
  message_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT google_drive_files_pkey PRIMARY KEY (id),
  CONSTRAINT google_drive_files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT google_drive_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT google_drive_files_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT google_drive_files_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id)
);

CREATE TABLE public.google_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  service_type text NOT NULL CHECK (service_type = ANY (ARRAY['calendar'::text, 'drive'::text, 'gmail'::text, 'oauth_config'::text])),
  client_id text NOT NULL,
  client_secret text NOT NULL,
  redirect_uri text NOT NULL,
  access_token text,
  refresh_token text,
  expiry_date timestamp with time zone,
  scope text[] NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT google_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT google_integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT google_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.human_support_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  assigned_to uuid,
  priority text DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  description text,
  chat_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  assigned_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT human_support_requests_pkey PRIMARY KEY (id),
  CONSTRAINT human_support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT human_support_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT human_support_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
  CONSTRAINT human_support_requests_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.intelligent_service_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  flow_id uuid,
  team_id uuid,
  chat_config jsonb DEFAULT '{"type": "hybrid", "auto_routing": false, "external_enabled": true, "internal_enabled": true}'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT intelligent_service_products_pkey PRIMARY KEY (id),
  CONSTRAINT intelligent_service_products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  -- FK para teams será adicionada depois da criação de public.teams
  -- CONSTRAINT intelligent_service_products_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT intelligent_service_products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.intelligent_service_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_interactions integer DEFAULT 0,
  successful_interactions integer DEFAULT 0,
  failed_interactions integer DEFAULT 0,
  average_response_time_seconds numeric DEFAULT 0,
  customer_satisfaction_score numeric,
  flow_completion_rate numeric,
  metrics_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT intelligent_service_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT intelligent_service_metrics_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.intelligent_service_products(id),
  CONSTRAINT intelligent_service_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.keyword_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT keyword_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.keywords (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category_id uuid,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT keywords_pkey PRIMARY KEY (id),
  CONSTRAINT keywords_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.keyword_categories(id)
);
CREATE TABLE public.meta_whatsapp_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  waba_id character varying NOT NULL,
  business_id character varying NOT NULL,
  access_token text NOT NULL,
  phone_number_id character varying NOT NULL,
  verified_name character varying,
  display_phone_number character varying,
  status character varying DEFAULT 'active'::character varying,
  session_window_expires_at timestamp with time zone,
  is_session_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  disconnected_at timestamp with time zone,
  CONSTRAINT meta_whatsapp_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT meta_whatsapp_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.meta_whatsapp_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  token_id uuid NOT NULL,
  action character varying NOT NULL,
  details jsonb,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT meta_whatsapp_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT meta_whatsapp_audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT meta_whatsapp_audit_logs_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.meta_whatsapp_tokens(id),
  CONSTRAINT meta_whatsapp_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.meta_whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  token_id uuid NOT NULL,
  message_id character varying NOT NULL UNIQUE,
  from_number character varying NOT NULL,
  to_number character varying NOT NULL,
  type character varying NOT NULL,
  body text,
  media_url text,
  media_type character varying,
  status character varying NOT NULL,
  direction character varying NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT meta_whatsapp_messages_pkey PRIMARY KEY (id),
  CONSTRAINT meta_whatsapp_messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT meta_whatsapp_messages_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.meta_whatsapp_tokens(id)
);

CREATE TABLE public.meta_whatsapp_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  token_id uuid NOT NULL,
  report_date date NOT NULL,
  total_messages integer DEFAULT 0,
  inbound_messages integer DEFAULT 0,
  outbound_messages integer DEFAULT 0,
  unique_contacts integer DEFAULT 0,
  avg_response_time_minutes numeric DEFAULT 0,
  session_reopens integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT meta_whatsapp_reports_pkey PRIMARY KEY (id),
  CONSTRAINT meta_whatsapp_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT meta_whatsapp_reports_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.meta_whatsapp_tokens(id)
);
CREATE TABLE public.monitoring_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  keywords text[] NOT NULL,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT monitoring_rules_pkey PRIMARY KEY (id),
  CONSTRAINT monitoring_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT monitoring_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['disconnected'::text, 'connected'::text, 'poor_service'::text, 'system'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.pause_types (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  icon character varying DEFAULT 'Clock'::character varying,
  color character varying DEFAULT 'blue'::character varying,
  duration_minutes integer NOT NULL DEFAULT 15,
  is_active boolean DEFAULT true,
  requires_justification boolean DEFAULT false,
  max_uses_per_day integer,
  is_system boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT pause_types_pkey PRIMARY KEY (id),
  CONSTRAINT pause_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT pause_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.pause_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  team_id uuid,
  pause_type_id uuid,
  pause_name character varying NOT NULL,
  custom_name character varying,
  justification text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  expected_end_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  duration_minutes integer NOT NULL,
  actual_duration_minutes integer,
  status character varying DEFAULT 'active'::character varying,
  exceeded_minutes integer DEFAULT 0,
  ip_address character varying,
  user_agent text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pause_history_pkey PRIMARY KEY (id),
  CONSTRAINT pause_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT pause_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT pause_history_pause_type_id_fkey FOREIGN KEY (pause_type_id) REFERENCES public.pause_types(id)
);
CREATE TABLE public.poc_email_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  subject character varying NOT NULL,
  body text NOT NULL,
  type character varying NOT NULL,
  days_before integer,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT poc_email_templates_pkey PRIMARY KEY (id),
  CONSTRAINT poc_email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.poc_email_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid,
  template_id uuid,
  recipient_email character varying NOT NULL,
  subject character varying NOT NULL,
  body text NOT NULL,
  sent_at timestamp without time zone DEFAULT now(),
  status character varying DEFAULT 'sent'::character varying,
  error_message text,
  metadata jsonb,
  CONSTRAINT poc_email_history_pkey PRIMARY KEY (id),
  CONSTRAINT poc_email_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT poc_email_history_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.poc_email_templates(id)
);
CREATE TABLE public.poc_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  action character varying NOT NULL CHECK (action::text = ANY (ARRAY['created'::character varying, 'extended'::character varying, 'converted'::character varying, 'expired'::character varying, 'notified'::character varying]::text[])),
  old_end_date timestamp without time zone,
  new_end_date timestamp without time zone,
  performed_by uuid,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT poc_history_pkey PRIMARY KEY (id),
  CONSTRAINT poc_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT poc_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.poc_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['warning_7_days'::character varying, 'warning_3_days'::character varying, 'final_1_day'::character varying, 'expired'::character varying]::text[])),
  sent_at timestamp without time zone DEFAULT now(),
  sent_via character varying NOT NULL CHECK (sent_via::text = ANY (ARRAY['email'::character varying, 'whatsapp'::character varying, 'both'::character varying]::text[])),
  status character varying DEFAULT 'sent'::character varying CHECK (status::text = ANY (ARRAY['sent'::character varying, 'failed'::character varying, 'pending'::character varying]::text[])),
  recipient_email character varying,
  recipient_phone character varying,
  message_content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT poc_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT poc_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  description text,
  short_description text,
  category text NOT NULL CHECK (category = ANY (ARRAY['module'::text, 'addon'::text, 'service'::text, 'plan'::text])),
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0::numeric),
  currency character varying DEFAULT 'BRL'::character varying,
  billing_cycle text DEFAULT 'monthly'::text CHECK (billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text, 'one-time'::text, 'usage-based'::text])),
  features jsonb DEFAULT '[]'::jsonb,
  icon_url text,
  image_url text,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_per_user boolean DEFAULT false,
  commercial_email character varying,
  default_quantity integer DEFAULT 1,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- Requests de contratação de produto
CREATE TABLE public.product_hire_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  name character varying NOT NULL,
  email character varying NOT NULL,
  phone character varying,
  company character varying,
  message text,
  quantity integer DEFAULT 1,
  requested_price numeric,
  total_price numeric,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'contacted'::character varying, 'converted'::character varying, 'rejected'::character varying, 'cancelled'::character varying]::text[])),
  organization_id uuid,
  subscription_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_hire_requests_pkey PRIMARY KEY (id),
  CONSTRAINT product_hire_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_hire_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT product_hire_requests_product_fk FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Tabela de relação entre organizações e produtos
CREATE TABLE public.organization_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  product_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'suspended'::text, 'pending'::text, 'expired'::text])),
  subscribed_at timestamp with time zone NOT NULL DEFAULT now(),
  activated_at timestamp with time zone,
  expires_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price numeric,
  currency character varying DEFAULT 'BRL'::character varying,
  billing_cycle text,
  discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0::numeric AND discount_percentage <= 100::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  -- Não é permitido usar outras colunas em DEFAULT; usamos coluna gerada
  final_price numeric GENERATED ALWAYS AS (
    (COALESCE(price, 0::numeric) * (1::numeric - (COALESCE(discount_percentage, 0::numeric) / 100::numeric)))
    - COALESCE(discount_amount, 0::numeric)
  ) STORED,
  notes text,
  cancellation_reason text,
  trial_ends_at timestamp with time zone,
  is_trial boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organization_products_pkey PRIMARY KEY (id),
  CONSTRAINT organization_products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT organization_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.rule_occurrences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  chat_id uuid NOT NULL,
  message_id uuid NOT NULL,
  matched_keyword text NOT NULL,
  message_content text NOT NULL,
  message_timestamp timestamp with time zone NOT NULL,
  customer_name text,
  customer_phone text,
  agent_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rule_occurrences_pkey PRIMARY KEY (id),
  CONSTRAINT rule_occurrences_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.monitoring_rules(id),
  CONSTRAINT rule_occurrences_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT rule_occurrences_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id)
);
CREATE TABLE public.status_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT status_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.status (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  category_id uuid,
  CONSTRAINT status_pkey PRIMARY KEY (id),
  CONSTRAINT status_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.status_categories(id)
);
CREATE TABLE public.tag_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tag_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  color text,
  usage_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  category_id uuid,
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.tag_categories(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text,
  organization_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.team_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  account_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT team_accounts_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
  -- FK para whatsapp_accounts será adicionada após a criação da tabela whatsapp_accounts
  -- via ALTER TABLE no final do arquivo
);

CREATE TABLE public.team_delivery_strategies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL UNIQUE,
  strategy_type character varying NOT NULL CHECK (strategy_type::text = ANY (ARRAY['round_robin'::character varying, 'priority'::character varying, 'broadcast'::character varying, 'workload'::character varying]::text[])),
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_delivery_strategies_pkey PRIMARY KEY (id),
  CONSTRAINT team_delivery_strategies_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);

CREATE TABLE public.team_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'expired'::text])),
  last_activity timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT team_sessions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL,
  user_id uuid,
  role_id uuid,
  organization_id uuid,
  assigned_by uuid,
  assigned_at timestamp without time zone DEFAULT now(),
  expires_at timestamp without time zone,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  theme text DEFAULT 'light'::text,
  language text DEFAULT 'pt'::text,
  notifications jsonb DEFAULT '{"push": true, "email": true, "sound": false, "desktop": true}'::jsonb,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.whatsapp_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected'::text CHECK (status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'connecting'::text, 'error'::text])),
  qr_code text,
  session_data jsonb DEFAULT '{}'::jsonb,
  account_id text NOT NULL UNIQUE,
  last_connected_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  assistant_id uuid,
  organization_id uuid,
  mode text DEFAULT 'ia'::text,
  flow_id uuid,
  platform text DEFAULT 'whatsapp'::text,
  account_type text DEFAULT 'unofficial'::text CHECK (account_type = ANY (ARRAY['official'::text, 'unofficial'::text])),
  team_id uuid,
  evolution_instance_id text,
  evolution_api_key text,
  evolution_session_status text,
  evolution_metadata jsonb,
  CONSTRAINT whatsapp_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT whatsapp_accounts_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT whatsapp_accounts_assistant_id_fkey FOREIGN KEY (assistant_id) REFERENCES public.ai_assistants(id),
  CONSTRAINT fk_whatsapp_accounts_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT whatsapp_accounts_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES public.fluxos(id)
  -- FK para teams pode ser adicionada depois, se necessário, via ALTER TABLE
);
CREATE TABLE public.whatsapp_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  user_role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text])),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_invites_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_invites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT whatsapp_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.whatsapp_productivity_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  date date NOT NULL,
  total_usage_time_minutes integer DEFAULT 0,
  active_time_minutes integer DEFAULT 0,
  idle_time_minutes integer DEFAULT 0,
  break_time_minutes integer DEFAULT 0,
  total_messages_sent integer DEFAULT 0,
  total_messages_received integer DEFAULT 0,
  conversations_started integer DEFAULT 0,
  conversations_ended integer DEFAULT 0,
  avg_response_time_seconds numeric DEFAULT 0,
  response_rate numeric DEFAULT 0,
  resolution_rate numeric DEFAULT 0,
  productivity_score numeric DEFAULT 0,
  efficiency_score numeric DEFAULT 0,
  engagement_score numeric DEFAULT 0,
  peak_hours jsonb DEFAULT '[]'::jsonb,
  activity_heatmap jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_productivity_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_productivity_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT whatsapp_productivity_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.whatsapp_reconnect_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_reconnect_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_reconnect_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.whatsapp_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  session_data jsonb,
  qr_code text,
  status text CHECK (status = ANY (ARRAY['disconnected'::text, 'connecting'::text, 'connected'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  phone_number text,
  CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.whatsapp_status_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  account_name text,
  organization_id uuid,
  old_status text,
  new_status text NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT whatsapp_status_audit_pkey PRIMARY KEY (id)
  -- FK para whatsapp_accounts será adicionada após a criação da tabela whatsapp_accounts
  -- via ALTER TABLE no final do arquivo
);

-- ============================================
-- FKs adicionadas após a criação de whatsapp_accounts
-- ============================================

ALTER TABLE public.cdr_configs
  ADD CONSTRAINT cdr_configs_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.whatsapp_accounts(account_id);

ALTER TABLE public.team_accounts
  ADD CONSTRAINT team_accounts_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.whatsapp_accounts(id);

ALTER TABLE public.whatsapp_reconnect_tokens
  ADD CONSTRAINT whatsapp_reconnect_tokens_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.whatsapp_accounts(account_id);

ALTER TABLE public.whatsapp_status_audit
  ADD CONSTRAINT fk_account
  FOREIGN KEY (account_id) REFERENCES public.whatsapp_accounts(account_id);

-- ============================================
-- FUNÇÕES E TRIGGERS PARA VALIDAÇÃO DE ROLE_ID
-- ============================================

-- Função para validar se role_id existe em roles OU default_roles
CREATE OR REPLACE FUNCTION public.validate_role_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se role_id é NULL, permitir (não obrigatório)
  IF NEW.role_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se existe na tabela roles
  IF EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id) THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se existe na tabela default_roles
  IF EXISTS (SELECT 1 FROM public.default_roles WHERE id = NEW.role_id) THEN
    RETURN NEW;
  END IF;
  
  -- Se não encontrou em nenhuma das duas tabelas, lançar erro
  RAISE EXCEPTION 'Role ID % não existe em roles ou default_roles', NEW.role_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar role_id antes de INSERT ou UPDATE
CREATE TRIGGER validate_role_id_trigger
  BEFORE INSERT OR UPDATE OF role_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_id();

COMMENT ON FUNCTION public.validate_role_id() IS 'Valida se role_id existe em roles ou default_roles antes de inserir/atualizar profiles';
COMMENT ON TRIGGER validate_role_id_trigger ON public.profiles IS 'Garante que role_id referencie uma role válida em roles ou default_roles';