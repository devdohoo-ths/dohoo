/**
 * Tipos TypeScript para o Módulo de Atendimento Inteligente
 * 
 * Este arquivo contém todas as definições de tipos para o novo módulo
 * de atendimento inteligente do sistema Dohoo.
 */

// =====================================================
// TIPOS PRINCIPAIS
// =====================================================

/**
 * Produto de Atendimento Inteligente
 * Representa um produto completo com flow, time e chat configurados
 */
export interface IntelligentServiceProduct {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  flow_id?: string;
  team_id?: string;
  chat_config: ChatConfig;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Estratégia de Entrega do Time
 * Define como os atendimentos serão distribuídos entre os membros
 */
export interface TeamDeliveryStrategy {
  id: string;
  team_id: string;
  strategy_type: StrategyType;
  config: StrategyConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Configuração de Interface de Chat
 * Define as configurações do chat híbrido (interno/externo)
 */
export interface ChatInterfaceConfig {
  id: string;
  organization_id: string;
  chat_type: ChatType;
  internal_config: InternalChatConfig;
  external_config: ExternalChatConfig;
  routing_rules: RoutingRules;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Métricas do Atendimento Inteligente
 * Armazena dados de performance dos produtos
 */
export interface IntelligentServiceMetrics {
  id: string;
  product_id: string;
  organization_id: string;
  date: string;
  total_interactions: number;
  successful_interactions: number;
  failed_interactions: number;
  average_response_time_seconds: number;
  customer_satisfaction_score?: number;
  flow_completion_rate?: number;
  metrics_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// TIPOS AUXILIARES
// =====================================================

/**
 * Tipos de Estratégia de Distribuição
 */
export type StrategyType = 'round_robin' | 'priority' | 'broadcast' | 'workload';

/**
 * Tipos de Chat
 */
export type ChatType = 'internal' | 'external' | 'hybrid';

/**
 * Configuração de Chat Geral
 */
export interface ChatConfig {
  type: ChatType;
  internal_enabled: boolean;
  external_enabled: boolean;
  auto_routing: boolean;
}

/**
 * Configuração de Chat Interno
 */
export interface InternalChatConfig {
  allow_file_sharing: boolean;
  allow_mentions: boolean;
  max_file_size_mb: number;
  allowed_file_types?: string[];
  enable_notifications?: boolean;
}

/**
 * Configuração de Chat Externo
 */
export interface ExternalChatConfig {
  platforms: string[];
  auto_reply_enabled: boolean;
  business_hours_only: boolean;
  default_message?: string;
  whatsapp_config?: WhatsAppConfig;
}

/**
 * Configuração específica do WhatsApp
 */
export interface WhatsAppConfig {
  enable_template_messages: boolean;
  enable_media_messages: boolean;
  enable_location_sharing: boolean;
}

/**
 * Regras de Roteamento
 */
export interface RoutingRules {
  auto_assign: boolean;
  priority_based: boolean;
  skills_based: boolean;
  max_concurrent_chats?: number;
  assignment_criteria?: AssignmentCriteria;
}

/**
 * Critérios de Atribuição
 */
export interface AssignmentCriteria {
  by_availability: boolean;
  by_workload: boolean;
  by_skills: boolean;
  by_language: boolean;
}

// =====================================================
// CONFIGURAÇÕES DE ESTRATÉGIA
// =====================================================

/**
 * Configuração da Estratégia
 * Varia de acordo com o tipo de estratégia selecionado
 */
export type StrategyConfig = 
  | RoundRobinConfig
  | PriorityConfig
  | BroadcastConfig
  | WorkloadConfig;

/**
 * Configuração Round Robin
 * Distribui atendimentos em sequência circular
 */
export interface RoundRobinConfig {
  type: 'round_robin';
  rotation_order: string[]; // IDs dos membros do time
  current_index: number;
  skip_offline_users: boolean;
  reset_on_day_change?: boolean;
}

/**
 * Configuração por Prioridade
 * Distribui baseado em níveis de prioridade
 */
export interface PriorityConfig {
  type: 'priority';
  priority_levels: PriorityLevel[];
  fallback_to_next_level: boolean;
}

/**
 * Nível de Prioridade
 */
export interface PriorityLevel {
  level: number;
  team_members: string[];
  max_concurrent_chats?: number;
}

/**
 * Configuração Broadcast
 * Todos os membros recebem
 */
export interface BroadcastConfig {
  type: 'broadcast';
  all_members: boolean;
  exclude_members: string[];
  require_acknowledgment?: boolean;
}

/**
 * Configuração por Carga de Trabalho
 * Distribui baseado na carga atual de cada membro
 */
export interface WorkloadConfig {
  type: 'workload';
  max_concurrent_chats: number;
  weight_factors: WeightFactor[];
  consider_complexity?: boolean;
}

/**
 * Fator de Peso para Carga de Trabalho
 */
export interface WeightFactor {
  factor: string;
  weight: number;
}

// =====================================================
// TIPOS DE FORMULÁRIOS
// =====================================================

/**
 * Formulário para Criar/Editar Produto
 */
export interface ProductFormData {
  name: string;
  description?: string;
  flow_id?: string;
  team_id?: string;
  chat_config: Partial<ChatConfig>;
  is_active: boolean;
}

/**
 * Formulário para Estratégia de Time
 */
export interface StrategyFormData {
  team_id: string;
  strategy_type: StrategyType;
  config: Partial<StrategyConfig>;
  is_active: boolean;
}

/**
 * Formulário para Configuração de Chat
 */
export interface ChatConfigFormData {
  chat_type: ChatType;
  internal_config: Partial<InternalChatConfig>;
  external_config: Partial<ExternalChatConfig>;
  routing_rules: Partial<RoutingRules>;
}

// =====================================================
// TIPOS DE RESPOSTA DA API
// =====================================================

/**
 * Resposta Padrão da API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Resposta de Lista Paginada
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Resposta de Métricas
 */
export interface MetricsResponse {
  success: boolean;
  metrics: IntelligentServiceMetrics[];
  summary: {
    total_products: number;
    active_products: number;
    total_interactions: number;
    average_satisfaction: number;
  };
}

// =====================================================
// TIPOS DE EVENTOS
// =====================================================

/**
 * Evento do Sistema de Atendimento
 */
export interface ServiceEvent {
  id: string;
  type: ServiceEventType;
  product_id: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Tipos de Eventos
 */
export type ServiceEventType = 
  | 'product_created'
  | 'product_updated'
  | 'product_activated'
  | 'product_deactivated'
  | 'strategy_changed'
  | 'chat_started'
  | 'chat_ended'
  | 'interaction_completed'
  | 'flow_completed'
  | 'flow_failed';

// =====================================================
// EXPORTAÇÕES AUXILIARES
// =====================================================

/**
 * Labels para Tipos de Estratégia
 */
export const STRATEGY_TYPE_LABELS: Record<StrategyType, string> = {
  round_robin: 'Round Robin',
  priority: 'Por Prioridade',
  broadcast: 'Broadcast (Todos)',
  workload: 'Por Carga de Trabalho'
};

/**
 * Labels para Tipos de Chat
 */
export const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  internal: 'Apenas Interno',
  external: 'Apenas Externo',
  hybrid: 'Híbrido (Interno + Externo)'
};

/**
 * Opções de Estratégia
 */
export const STRATEGY_OPTIONS = [
  { value: 'round_robin', label: 'Round Robin', description: 'Distribui em sequência circular' },
  { value: 'priority', label: 'Por Prioridade', description: 'Baseado em níveis de prioridade' },
  { value: 'broadcast', label: 'Broadcast', description: 'Todos recebem simultaneamente' },
  { value: 'workload', label: 'Carga de Trabalho', description: 'Baseado na carga atual' }
] as const;

/**
 * Opções de Tipo de Chat
 */
export const CHAT_TYPE_OPTIONS = [
  { value: 'internal', label: 'Interno', description: 'Chat apenas para equipe interna' },
  { value: 'external', label: 'Externo', description: 'Chat apenas com clientes externos' },
  { value: 'hybrid', label: 'Híbrido', description: 'Chat interno e externo integrados' }
] as const;


