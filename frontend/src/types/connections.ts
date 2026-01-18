// =====================================================
// TIPOS PARA SISTEMA DE CONTAS DE CONEXÃO UNIFICADO
// =====================================================

export type Platform = 'whatsapp' | 'telegram' | 'facebook' | 'instagram' | 'api';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// Configurações específicas por plataforma
export interface WhatsAppConfig {
  phone_number?: string;
  assistant_id?: string | null;
  flow_id?: string | null;
  mode?: 'ia' | 'flow';
}

export interface TelegramConfig {
  bot_token?: string;
  chat_id?: string;
  webhook_url?: string;
}

export interface FacebookConfig {
  page_id?: string;
  access_token?: string;
  webhook_verify_token?: string;
}

export interface InstagramConfig {
  business_account_id?: string;
  access_token?: string;
}

export interface ApiConfig {
  api_key?: string;
  endpoint_url?: string;
  webhook_url?: string;
}

export type PlatformConfig = 
  | WhatsAppConfig 
  | TelegramConfig 
  | FacebookConfig 
  | InstagramConfig 
  | ApiConfig;

// Permissões por plataforma
export interface PlatformPermissions {
  view: boolean;
  create: boolean;
  manage: boolean;
  viewAll: boolean;
}

export interface UserPlatformPermissions {
  whatsapp: PlatformPermissions;
  telegram: PlatformPermissions;
  facebook: PlatformPermissions;
  instagram: PlatformPermissions;
  api: PlatformPermissions;
}

// Conta de conexão unificada
export interface ConnectionAccount {
  id: string;
  name: string;
  platform: Platform;
  status: ConnectionStatus;
  user_id: string;
  organization_id: string;
  assigned_to: string | null;
  config: PlatformConfig;
  created_at: string;
  updated_at: string;
  assigned_user_name?: string;
  assigned_user_email?: string;
}

// Dados para criar/atualizar conta
export interface CreateConnectionAccountData {
  name: string;
  platform: Platform;
  assigned_to?: string;
  config?: PlatformConfig;
}

export interface UpdateConnectionAccountData {
  name?: string;
  assigned_to?: string;
  config?: PlatformConfig;
}

// Resposta da API
export interface ConnectionAccountsResponse {
  accounts: ConnectionAccount[];
  total: number;
  loading: boolean;
  error?: string;
}

// Filtros e busca
export interface ConnectionAccountsFilters {
  platform?: Platform;
  status?: ConnectionStatus;
  search?: string;
  assigned_to?: string;
}

// Estatísticas por plataforma
export interface PlatformStats {
  total: number;
  connected: number;
  connecting: number;
  disconnected: number;
  error: number;
}

export interface AllPlatformsStats {
  whatsapp: PlatformStats;
  telegram: PlatformStats;
  facebook: PlatformStats;
  instagram: PlatformStats;
  api: PlatformStats;
}

// Hook de autorização
export interface ConnectionAuth {
  canViewAll: (platform: Platform) => boolean;
  canCreate: (platform: Platform) => boolean;
  canManage: (platform: Platform) => boolean;
  canViewOwn: (platform: Platform) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAgent: boolean;
}

// Configurações de plataforma para UI
export interface PlatformConfigUI {
  name: string;
  icon: string;
  color: string;
  description: string;
  features: string[];
  isAvailable: boolean;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfigUI> = {
  whatsapp: {
    name: 'WhatsApp',
    icon: '📱',
    color: '#25D366',
    description: 'Conexão via WhatsApp Business API',
    features: ['QR Code', 'IA Assistant', 'Flows', 'Mensagens em tempo real'],
    isAvailable: true
  },
  telegram: {
    name: 'Telegram',
    icon: '📬',
    color: '#0088CC',
    description: 'Conexão via Telegram Bot API',
    features: ['Bot Token', 'Webhooks', 'Canais', 'Grupos'],
    isAvailable: false
  },
  facebook: {
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    description: 'Conexão via Facebook Messenger',
    features: ['Page ID', 'Access Token', 'Webhooks', 'Páginas'],
    isAvailable: false
  },
  instagram: {
    name: 'Instagram',
    icon: '📷',
    color: '#E4405F',
    description: 'Conexão via Instagram Business',
    features: ['Business Account', 'Direct Messages', 'Stories'],
    isAvailable: false
  },
  api: {
    name: 'API Oficial',
    icon: '🔌',
    color: '#6366F1',
    description: 'Conexão via API REST',
    features: ['API Key', 'Webhooks', 'Endpoints', 'JSON'],
    isAvailable: false
  }
};

// Tipos para operações específicas
export interface ConnectAccountParams {
  accountId: string;
  platform: Platform;
}

export interface DisconnectAccountParams {
  accountId: string;
  platform: Platform;
}

export interface ReconnectAccountParams {
  accountId: string;
  platform: Platform;
}

// Tipos para modais e formulários
export interface ConnectionModalState {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'settings';
  account?: ConnectionAccount;
  platform?: Platform;
}

// Tipos para notificações e eventos
export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'error' | 'connecting';
  accountId: string;
  platform: Platform;
  message: string;
  timestamp: string;
}

// Tipos para exportação
export interface ExportData {
  platform: Platform;
  accounts: ConnectionAccount[];
  format: 'csv' | 'json' | 'xlsx';
}

// Tipos para paginação
export interface ConnectionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Tipos para ordenação
export type ConnectionSortField = 'name' | 'status' | 'created_at' | 'updated_at' | 'assigned_user_name';
export type ConnectionSortOrder = 'asc' | 'desc';

export interface ConnectionSort {
  field: ConnectionSortField;
  order: ConnectionSortOrder;
} 