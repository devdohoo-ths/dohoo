/**
 * Sistema de Cache Inteligente para Dados da Aplicação
 * 
 * Este módulo implementa um cache centralizado que:
 * - Evita requisições duplicadas ao Supabase
 * - Cacheia dados por organização
 * - Invalida cache automaticamente após TTL
 * - Suporta cache em memória e localStorage
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  organizationId: string;
  ttl: number; // Time to live em milissegundos
}

interface CacheOptions {
  ttl?: number; // Tempo de vida do cache em ms (padrão: 5 minutos)
  useLocalStorage?: boolean; // Se deve persistir no localStorage
  keyPrefix?: string; // Prefixo para as chaves do cache
}

class DataCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  private defaultTTL = 5 * 60 * 1000; // 5 minutos
  private defaultOptions: CacheOptions = {
    ttl: this.defaultTTL,
    useLocalStorage: true,
    keyPrefix: 'app_cache_'
  };

  /**
   * Gera chave única para o cache baseada em parâmetros
   */
  private generateKey(operation: string, params: Record<string, any> = {}): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .join('|');
    return `${operation}:${paramString}`;
  }

  /**
   * Verifica se uma entrada do cache ainda é válida
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Obtém dados do cache (memória primeiro, depois localStorage)
   */
  get<T>(operation: string, params: Record<string, any> = {}, options?: CacheOptions): T | null {
    const opts = { ...this.defaultOptions, ...options };
    const key = this.generateKey(operation, params);

    // Tentar memória primeiro
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      return memoryEntry.data as T;
    }

    // Tentar localStorage se habilitado
    if (opts.useLocalStorage && typeof window !== 'undefined') {
      try {
        const storageKey = `${opts.keyPrefix}${key}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);
          if (this.isValid(entry)) {
            // Restaurar na memória
            this.memoryCache.set(key, entry);
            return entry.data;
          } else {
            // Remover se expirado
            localStorage.removeItem(storageKey);
          }
        }
      } catch (error) {
        console.warn('⚠️ [Cache] Erro ao ler do localStorage:', error);
      }
    }

    return null;
  }

  /**
   * Salva dados no cache (memória e localStorage)
   */
  set<T>(operation: string, data: T, params: Record<string, any> = {}, options?: CacheOptions): void {
    const opts = { ...this.defaultOptions, ...options };
    const key = this.generateKey(operation, params);
    const organizationId = params.organization_id || params.organizationId || 'global';

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      organizationId,
      ttl: opts.ttl!
    };

    // Salvar na memória
    this.memoryCache.set(key, entry);

    // Salvar no localStorage se habilitado
    if (opts.useLocalStorage && typeof window !== 'undefined') {
      try {
        const storageKey = `${opts.keyPrefix}${key}`;
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch (error) {
        console.warn('⚠️ [Cache] Erro ao salvar no localStorage:', error);
      }
    }
  }

  /**
   * Remove entrada específica do cache
   */
  invalidate(operation: string, params: Record<string, any> = {}): void {
    const key = this.generateKey(operation, params);
    
    // Remover da memória
    this.memoryCache.delete(key);

    // Remover do localStorage
    if (typeof window !== 'undefined') {
      try {
        const prefix = this.defaultOptions.keyPrefix || 'app_cache_';
        localStorage.removeItem(`${prefix}${key}`);
      } catch (error) {
        console.warn('⚠️ [Cache] Erro ao remover do localStorage:', error);
      }
    }
  }

  /**
   * Remove todas as entradas do cache para uma organização específica
   */
  invalidateByOrganization(organizationId: string): void {
    // Limpar memória
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.organizationId === organizationId) {
        this.memoryCache.delete(key);
      }
    }

    // Limpar localStorage
    if (typeof window !== 'undefined') {
      try {
        const prefix = this.defaultOptions.keyPrefix || 'app_cache_';
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const stored = localStorage.getItem(key);
            if (stored) {
              try {
                const entry: CacheEntry<any> = JSON.parse(stored);
                if (entry.organizationId === organizationId) {
                  keysToRemove.push(key);
                }
              } catch {
                // Ignorar entradas inválidas
              }
            }
          }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('⚠️ [Cache] Erro ao limpar localStorage:', error);
      }
    }
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.pendingRequests.clear();

    if (typeof window !== 'undefined') {
      try {
        const prefix = this.defaultOptions.keyPrefix || 'app_cache_';
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('⚠️ [Cache] Erro ao limpar localStorage:', error);
      }
    }
  }

  /**
   * Executa uma função assíncrona com cache e debounce para evitar requisições duplicadas
   */
  async fetch<T>(
    operation: string,
    fetchFn: () => Promise<T>,
    params: Record<string, any> = {},
    options?: CacheOptions
  ): Promise<T> {
    const key = this.generateKey(operation, params);

    // Verificar cache primeiro
    const cached = this.get<T>(operation, params, options);
    if (cached !== null) {
      return cached;
    }

    // Verificar se já existe uma requisição pendente
    const pendingRequest = this.pendingRequests.get(key);
    if (pendingRequest) {
      return pendingRequest as Promise<T>;
    }

    // Criar nova requisição
    const requestPromise = fetchFn()
      .then(data => {
        // Salvar no cache
        this.set(operation, data, params, options);
        // Remover da lista de pendentes
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        // Remover da lista de pendentes em caso de erro
        this.pendingRequests.delete(key);
        throw error;
      });

    // Adicionar à lista de pendentes
    this.pendingRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    return {
      memoryEntries: this.memoryCache.size,
      pendingRequests: this.pendingRequests.size,
      localStorageEntries: typeof window !== 'undefined' 
        ? Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .filter(key => key?.startsWith(this.defaultOptions.keyPrefix || 'app_cache_')).length
        : 0
    };
  }
}

// Instância singleton do cache
export const dataCache = new DataCache();

// Operações pré-definidas para facilitar o uso
export const CacheOperations = {
  DASHBOARD_STATS: 'dashboard_stats',
  USER_PROFILE: 'user_profile',
  ORGANIZATION: 'organization',
  WHATSAPP_ACCOUNTS: 'whatsapp_accounts',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  TEAMS: 'teams',
  AI_SETTINGS: 'ai_settings',
  AI_CREDITS: 'ai_credits',
  ROLES: 'roles',
  WIDGETS: 'widgets'
} as const;

