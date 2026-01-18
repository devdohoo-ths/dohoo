interface CachedDashboardData {
  stats: any;
  period: string;
  timestamp: number;
  ttl: number;
}

class DashboardCache {
  private static instance: DashboardCache;
  private cache: Map<string, CachedDashboardData> = new Map();
  private config = {
    ttl: 30 * 1000, // 30 segundos (reduzido de 2 minutos)
    maxAge: 2 * 60 * 1000 // 2 minutos (reduzido de 10 minutos)
  };

  static getInstance(): DashboardCache {
    if (!DashboardCache.instance) {
      DashboardCache.instance = new DashboardCache();
    }
    return DashboardCache.instance;
  }

  private getCacheKey(userId: string, period: string): string {
    return `dashboard_${userId}_${period}`;
  }

  set(userId: string, period: string, stats: any): void {
    const cacheKey = this.getCacheKey(userId, period);
    const cachedData: CachedDashboardData = {
      stats,
      period,
      timestamp: Date.now(),
      ttl: this.config.ttl
    };

    this.cache.set(cacheKey, cachedData);
  }

  get(userId: string, period: string): any | null {
    const cacheKey = this.getCacheKey(userId, period);
    const cachedData = this.cache.get(cacheKey);

    if (cachedData && this.isValid(cachedData)) {
      const age = Date.now() - cachedData.timestamp;
      return cachedData.stats;
    }

    if (cachedData) {
      const age = Date.now() - cachedData.timestamp;
    } else {
    }
    
    return null;
  }

  private isValid(cachedData: CachedDashboardData): boolean {
    const now = Date.now();
    const age = now - cachedData.timestamp;
    
    return age <= cachedData.ttl && age <= this.config.maxAge;
  }

  invalidate(userId: string, period?: string): void {
    if (period) {
      const cacheKey = this.getCacheKey(userId, period);
      this.cache.delete(cacheKey);
    } else {
      // Invalidar todos os períodos do usuário
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.startsWith(`dashboard_${userId}_`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const dashboardCache = DashboardCache.getInstance();
export default dashboardCache; 