// Novo arquivo para gerenciar limpeza de cache
export class CacheManager {
  static async clearAllCache(): Promise<void> {
    // console.log('🧹 [CACHE] Iniciando limpeza completa de cache...');
    
    // 1. Limpar localStorage
    this.clearLocalStorage();
    
    // 2. Limpar sessionStorage
    this.clearSessionStorage();
    
    // 3. Limpar cookies
    this.clearCookies();
    
    // 4. Limpar cache de permissões
    await this.clearPermissionsCache();
    
    // 5. Limpar cache de dados do usuário
    this.clearUserDataCache();
    
    // console.log('✅ [CACHE] Limpeza de cache concluída');
  }

  private static clearLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      let clearedCount = 0;
      
      keys.forEach(key => {
        if (
          key.startsWith('sb-') || 
          key.includes('supabase') || 
          key.includes('auth') ||
          key.includes('user_data') ||
          key.includes('permissions_cache_') ||
          key.includes('chat_') ||
          key.includes('ai_') ||
          key.includes('analytics_')
        ) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      });
      
      // console.log(`��️ [CACHE] Removidos ${clearedCount} itens do localStorage`);
    } catch (error) {
      console.error('❌ [CACHE] Erro ao limpar localStorage:', error);
    }
  }

  private static clearSessionStorage(): void {
    try {
      sessionStorage.clear();
      // console.log('🗑️ [CACHE] SessionStorage limpo');
    } catch (error) {
      console.error('❌ [CACHE] Erro ao limpar sessionStorage:', error);
    }
  }

  private static clearCookies(): void {
    try {
      const cookies = document.cookie.split(';');
      let clearedCount = 0;
      
      cookies.forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        
        // Remover cookies relacionados ao Supabase e autenticação
        if (
          name.includes('supabase') ||
          name.includes('auth') ||
          name.includes('session') ||
          name.includes('token')
        ) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
          clearedCount++;
        }
      });
      
      // console.log(`🍪 [CACHE] Removidos ${clearedCount} cookies`);
    } catch (error) {
      console.error('❌ [CACHE] Erro ao limpar cookies:', error);
    }
  }

  private static async clearPermissionsCache(): Promise<void> {
    try {
      // Importar e usar o cache de permissões
      const { permissionsCache } = await import('./permissionsCache');
      permissionsCache.clear();
      // console.log('🔐 [CACHE] Cache de permissões limpo');
    } catch (error) {
      console.error('❌ [CACHE] Erro ao limpar cache de permissões:', error);
    }
  }

  private static clearUserDataCache(): void {
    try {
      // Limpar dados específicos do usuário
      const userDataKeys = [
        'user_data',
        'user_profile',
        'user_preferences',
        'user_settings'
      ];
      
      userDataKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // console.log('👤 [CACHE] Cache de dados do usuário limpo');
    } catch (error) {
      console.error('❌ [CACHE] Erro ao limpar cache de dados do usuário:', error);
    }
  }

  // Método para limpar cache específico de um usuário
  static async clearUserCache(userId: string, organizationId?: string): Promise<void> {
    // console.log(`🧹 [CACHE] Limpando cache do usuário ${userId}...`);
    
    try {
      // Limpar cache de permissões específico
      if (organizationId) {
        const { permissionsCache } = await import('./permissionsCache');
        permissionsCache.invalidate(userId, organizationId);
      }
      
      // Limpar dados específicos do usuário
      const userSpecificKeys = [
        `user_data_${userId}`,
        `user_profile_${userId}`,
        `user_preferences_${userId}`
      ];
      
      userSpecificKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // console.log(`✅ [CACHE] Cache do usuário ${userId} limpo`);
    } catch (error) {
      console.error(`❌ [CACHE] Erro ao limpar cache do usuário ${userId}:`, error);
    }
  }
} 