import { apiBase } from './apiBase';

class AuthManager {
  private refreshPromise: Promise<string | null> | null = null;

  // Obter token válido (com refresh automático)
  async getValidToken(): Promise<string | null> {
    try {
      // console.log('🔑 [AUTH] Obtendo token válido...');
      
      // Se já está fazendo refresh, aguardar
      if (this.refreshPromise) {
        // console.log('🔄 [AUTH] Aguardando refresh em andamento...');
        return await this.refreshPromise;
      }

      // Tentar obter sessão do localStorage
      const storedSession = localStorage.getItem('auth_session');
      
      if (!storedSession) {
        // console.log('❌ [AUTH] Nenhuma sessão ativa');
        return null;
      }

      let session;
      try {
        session = JSON.parse(storedSession);
      } catch (e) {
        console.error('❌ [AUTH] Erro ao parsear sessão:', e);
        return null;
      }

      if (!session || !session.access_token) {
        // console.log('❌ [AUTH] Nenhuma sessão ativa');
        return null;
      }

      // Verificar se o token está próximo de expirar (5 minutos antes)
      const expiresAt = session.expires_at || 0;
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - currentTime;
      
      // console.log(`⏰ [AUTH] Token expira em ${timeUntilExpiry} segundos`);

      // Se está próximo de expirar (menos de 5 minutos)
      if (timeUntilExpiry < 300) {
        // console.log('🔄 [AUTH] Token próximo de expirar, fazendo refresh...');
        return await this.refreshToken();
      }

      // Token ainda válido
      const token = session.access_token;
      
      // Salvar token nas chaves que o sistema usa
      this.saveTokenToStorage(token);
      
      // console.log('✅ [AUTH] Token válido obtido');
      return token;
      
    } catch (error) {
      console.error('❌ [AUTH] Erro ao obter token:', error);
      return null;
    }
  }

  // Fazer refresh do token
  private async refreshToken(): Promise<string | null> {
    // Evitar múltiplos refreshes simultâneos
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<string | null> {
    try {
      // console.log('🔄 [AUTH] Fazendo refresh do token...');
      
      // Obter refresh_token do localStorage
      const storedSession = localStorage.getItem('auth_session');
      if (!storedSession) {
        await this.handleTokenExpired();
        return null;
      }

      const session = JSON.parse(storedSession);
      if (!session?.refresh_token) {
        await this.handleTokenExpired();
        return null;
      }

      // Fazer refresh via backend
      const response = await fetch(`${apiBase}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [AUTH] Erro no refresh:', errorData.error || response.statusText);
        await this.handleTokenExpired();
        return null;
      }

      const data = await response.json();
      
      if (!data.success || !data.session) {
        // console.log('❌ [AUTH] Refresh não retornou sessão');
        await this.handleTokenExpired();
        return null;
      }

      // Salvar nova sessão
      localStorage.setItem('auth_session', JSON.stringify(data.session));

      const newToken = data.session.access_token;
      
      // Salvar novo token
      this.saveTokenToStorage(newToken);
      
      // console.log('✅ [AUTH] Token renovado com sucesso');
      return newToken;
      
    } catch (error) {
      console.error('❌ [AUTH] Erro no refresh:', error);
      await this.handleTokenExpired();
      return null;
    }
  }

  // Salvar token em todas as chaves que o sistema usa
  private saveTokenToStorage(token: string) {
    try {
      // Chaves que diferentes partes do sistema podem usar
      const keys = [
        'supabase-auth-token',
        `sb-${window.location.hostname.replace(/\./g, '-')}-auth-token`,
        'sb-localhost-auth-token',
        'sb-127-0-0-1-auth-token'
      ];

      keys.forEach(key => {
        localStorage.setItem(key, token);
      });
      
      // console.log('💾 [AUTH] Token salvo no localStorage');
    } catch (error) {
      console.error('❌ [AUTH] Erro ao salvar token:', error);
    }
  }

  // Lidar com token expirado
  private async handleTokenExpired() {
    // console.log('🚨 [AUTH] Token expirado, limpando dados...');
    
    // Limpar localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });

    // Redirecionar para login se necessário
    // Você pode descomentar isso se quiser redirecionamento automático
    // window.location.href = '/login';
  }

  // Verificar se há sessão ativa
  async hasValidSession(): Promise<boolean> {
    try {
      const storedSession = localStorage.getItem('auth_session');
      if (!storedSession) return false;
      
      const session = JSON.parse(storedSession);
      const expiresAt = session.expires_at || 0;
      const now = Date.now() / 1000;
      
      // Verificar se token ainda é válido
      return !!session.access_token && expiresAt > now;
    } catch {
      return false;
    }
  }

  // Obter informações do usuário
  async getCurrentUser() {
    try {
      const userData = localStorage.getItem('user_data');
      if (!userData) return null;
      
      return JSON.parse(userData);
    } catch (error) {
      console.error('❌ [AUTH] Erro ao obter usuário:', error);
      return null;
    }
  }
}

// Instância singleton
export const authManager = new AuthManager();

// Função helper para compatibilidade
export const getAuthToken = () => authManager.getValidToken(); 