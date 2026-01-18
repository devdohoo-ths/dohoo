interface CachedAccountsData {
  accounts: any[];
  timestamp: number;
  ttl: number;
}

class AccountsCache {
  private static instance: AccountsCache;
  private cache: Map<string, CachedAccountsData> = new Map();
  private config = {
    ttl: 1 * 60 * 1000, // 1 minuto
    maxAge: 5 * 60 * 1000 // 5 minutos
  };

  static getInstance(): AccountsCache {
    if (!AccountsCache.instance) {
      AccountsCache.instance = new AccountsCache();
    }
    return AccountsCache.instance;
  }

  private getCacheKey(userId: string): string {
    return `accounts_${userId}`;
  }

  set(userId: string, accounts: any[]): void {
    const cacheKey = this.getCacheKey(userId);
    const cachedData: CachedAccountsData = {
      accounts,
      timestamp: Date.now(),
      ttl: this.config.ttl
    };

    this.cache.set(cacheKey, cachedData);
    // console.log('💾 [ACCOUNTS_CACHE] Dados salvos no cache:', { userId, accountsCount: accounts.length });
  }

  get(userId: string): any[] | null {
    const cacheKey = this.getCacheKey(userId);
    const cachedData = this.cache.get(cacheKey);

    if (cachedData && this.isValid(cachedData)) {
      // console.log('✅ [ACCOUNTS_CACHE] Cache encontrado:', { userId, accountsCount: cachedData.accounts.length });
      return cachedData.accounts;
    }

    // console.log('❌ [ACCOUNTS_CACHE] Cache não encontrado ou expirado:', { userId });
    return null;
  }

  private isValid(cachedData: CachedAccountsData): boolean {
    const now = Date.now();
    const age = now - cachedData.timestamp;
    
    return age <= cachedData.ttl && age <= this.config.maxAge;
  }

  invalidate(userId: string): void {
    const cacheKey = this.getCacheKey(userId);
    this.cache.delete(cacheKey);
    // console.log('🗑️ [ACCOUNTS_CACHE] Cache invalidado:', { userId });
  }

  clear(): void {
    this.cache.clear();
    // console.log('🗑️ [ACCOUNTS_CACHE] Cache limpo');
  }
}

export const accountsCache = AccountsCache.getInstance();
export default accountsCache; 