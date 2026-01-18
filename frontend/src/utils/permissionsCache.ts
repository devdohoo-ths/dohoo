interface CachedPermissions {
  permissions: Record<string, any>;
  role_id: string | null;
  role_name: string | null;
  timestamp: number;
  ttl: number; // Time to live em milissegundos
}

interface CacheConfig {
  ttl: number; // 5 minutos por padrão
  maxAge: number; // 30 minutos por padrão
}

class PermissionsCache {
  private static instance: PermissionsCache;
  private cache: Map<string, CachedPermissions> = new Map();
  private config: CacheConfig = {
    ttl: 5 * 60 * 1000, // 5 minutos
    maxAge: 30 * 60 * 1000 // 30 minutos
  };

  static getInstance(): PermissionsCache {
    if (!PermissionsCache.instance) {
      PermissionsCache.instance = new PermissionsCache();
    }
    return PermissionsCache.instance;
  }

  private getCacheKey(userId: string, organizationId: string): string {
    return `permissions_${userId}_${organizationId}`;
  }

  private getLocalStorageKey(userId: string, organizationId: string): string {
    return `permissions_cache_${userId}_${organizationId}`;
  }

  // Salvar no cache em memória e localStorage
  set(userId: string, organizationId: string, data: Omit<CachedPermissions, 'timestamp' | 'ttl'>): void {
    const cacheKey = this.getCacheKey(userId, organizationId);
    const storageKey = this.getLocalStorageKey(userId, organizationId);
    
    const cachedData: CachedPermissions = {
      ...data,
      timestamp: Date.now(),
      ttl: this.config.ttl
    };

    // Cache em memória
    this.cache.set(cacheKey, cachedData);

    // Cache no localStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify(cachedData));
    } catch (error) {
      console.warn('Erro ao salvar permissões no localStorage:', error);
    }
  }

  // Buscar do cache (memória primeiro, depois localStorage)
  get(userId: string, organizationId: string): CachedPermissions | null {
    const cacheKey = this.getCacheKey(userId, organizationId);
    const storageKey = this.getLocalStorageKey(userId, organizationId);

    // Tentar cache em memória primeiro
    const memoryCache = this.cache.get(cacheKey);
    if (memoryCache && this.isValid(memoryCache)) {
      return memoryCache;
    }

    // Se não encontrou em memória, tentar localStorage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsedData: CachedPermissions = JSON.parse(stored);
        if (this.isValid(parsedData)) {
          // Restaurar no cache em memória
          this.cache.set(cacheKey, parsedData);
          return parsedData;
        }
      }
    } catch (error) {
      console.warn('Erro ao ler permissões do localStorage:', error);
    }

    return null;
  }

  // Verificar se o cache é válido
  private isValid(cachedData: CachedPermissions): boolean {
    const now = Date.now();
    const age = now - cachedData.timestamp;
    
    // Verificar se não expirou
    if (age > cachedData.ttl) {
      return false;
    }

    // Verificar se não é muito antigo
    if (age > this.config.maxAge) {
      return false;
    }

    return true;
  }

  // Invalidar cache para um usuário
  invalidate(userId: string, organizationId: string): void {
    const cacheKey = this.getCacheKey(userId, organizationId);
    const storageKey = this.getLocalStorageKey(userId, organizationId);

    this.cache.delete(cacheKey);
    
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Erro ao remover permissões do localStorage:', error);
    }
  }

  // Limpar todo o cache
  clear(): void {
    this.cache.clear();
    
    // Limpar localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('permissions_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Erro ao limpar cache do localStorage:', error);
    }
  }

  // Configurar TTL
  setTTL(ttl: number): void {
    this.config.ttl = ttl;
  }

  // Obter estatísticas do cache
  getStats(): { memorySize: number; localStorageKeys: number } {
    const localStorageKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('permissions_cache_')
    ).length;

    return {
      memorySize: this.cache.size,
      localStorageKeys
    };
  }
}

export const permissionsCache = PermissionsCache.getInstance();
export default permissionsCache; 