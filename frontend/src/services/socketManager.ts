import { io, Socket } from 'socket.io-client';
import { getCurrentApiBase } from '@/utils/apiBase';

/**
 * 🔌 Gerenciador Centralizado de Socket.IO
 * 
 * Singleton que gerencia uma única conexão Socket.IO para toda a aplicação.
 * Evita múltiplas conexões e problemas de instabilidade.
 */
class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Começa com 1 segundo
  private maxReconnectDelay = 30000; // Máximo de 30 segundos
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isAuthenticated = false;
  private userId: string | null = null;
  private organizationId: string | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private connectionCallbacks: Set<Function> = new Set();
  private disconnectCallbacks: Set<Function> = new Set();

  /**
   * Conecta ao servidor Socket.IO com autenticação
   */
  async connect(userId: string, organizationId: string, retryCount = 0): Promise<Socket | null> {
    // Se já está conectado com os mesmos dados, retornar a conexão existente
    if (this.socket?.connected && this.userId === userId && this.organizationId === organizationId) {
      return this.socket;
    }

    // Se já está conectando, aguardar
    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (!this.isConnecting && this.socket?.connected) {
            clearInterval(checkConnection);
            resolve(this.socket);
          }
        }, 100);
      });
    }

    // Desconectar conexão anterior se existir
    if (this.socket) {
      this.disconnect();
    }

    this.isConnecting = true;
    this.userId = userId;
    this.organizationId = organizationId;

    try {
      // ✅ CORREÇÃO: Aguardar um pouco após login para garantir que o token está disponível
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Obter token de autenticação do localStorage com retry
      let session = null;
      let accessToken = null;
      let attempts = 0;
      
      while (!accessToken && attempts < 3) {
        try {
          const storedSession = localStorage.getItem('auth_session');
          if (storedSession) {
            session = JSON.parse(storedSession);
            accessToken = session?.access_token;
            
            // Verificar se token ainda é válido
            if (accessToken) {
              const expiresAt = session.expires_at || 0;
              const now = Date.now() / 1000;
              
              if (expiresAt < now) {
                // Token expirado, tentar refresh
                try {
                  const response = await fetch(`${getCurrentApiBase()}/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: session.refresh_token })
                  });

                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.session) {
                      localStorage.setItem('auth_session', JSON.stringify(data.session));
                      session = data.session;
                      accessToken = data.session.access_token;
                    }
                  }
                } catch (refreshError) {
                  console.error('❌ [Socket.IO] Erro ao fazer refresh:', refreshError);
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ [Socket.IO] Erro ao obter sessão:', error);
        }
        
        if (!accessToken && attempts < 2) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        attempts++;
      }

      if (!accessToken) {
        console.error('❌ [Socket.IO] Sessão não encontrada para conectar após', attempts, 'tentativas');
        this.isConnecting = false;
        // ✅ CORREÇÃO: Tentar novamente após 2 segundos se for primeira tentativa
        if (retryCount < 2) {
          setTimeout(() => {
            this.connect(userId, organizationId, retryCount + 1).catch(() => {});
          }, 2000);
        }
        return null;
      }

      const socketUrl = getCurrentApiBase();

      // Criar nova conexão com configurações robustas
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 60000, // 60 segundos para produção
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        // Autenticação via query string e headers
        auth: {
          token: accessToken,
          userId: userId,
          organizationId: organizationId
        },
        // Headers de autenticação
        extraHeaders: {
          'Authorization': `Bearer ${accessToken}`,
          'x-user-id': userId,
          'x-organization-id': organizationId
        }
      });

      // Configurar listeners de eventos
      this.setupEventListeners();

      // Aguardar conexão
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!this.socket?.connected) {
            this.isConnecting = false;
            reject(new Error('Timeout ao conectar Socket.IO'));
          }
        }, 60000);

        this.socket.once('connect', () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.isAuthenticated = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Entrar nas salas necessárias
          this.joinRooms();
          
          // Notificar callbacks de conexão
          this.connectionCallbacks.forEach(callback => {
            try {
              callback();
            } catch (error) {
              console.error('❌ [Socket.IO] Erro em callback de conexão:', error);
            }
          });

          resolve(this.socket);
        });

        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          console.error('❌ [Socket.IO] Erro ao conectar:', error.message);
          this.handleReconnect();
          reject(error);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      console.error('❌ [Socket.IO] Erro ao criar conexão:', error);
      return null;
    }
  }

  /**
   * Configura listeners de eventos do Socket.IO
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Reconexão bem-sucedida
    this.socket.on('reconnect', (attemptNumber) => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.joinRooms();
    });

    // Erro de reconexão
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
    });

    // Erro de conexão
    this.socket.on('connect_error', (error) => {
      console.error('❌ [Socket.IO] Erro de conexão:', error.message);
      this.isAuthenticated = false;
      
      // ✅ CORREÇÃO: Se for erro de autenticação, não desconectar - apenas logar
      if (error.message.includes('Token') || error.message.includes('autenticação')) {
        console.warn('⚠️ [Socket.IO] Erro de autenticação - tentando reconectar em 3 segundos...');
        setTimeout(() => {
          if (this.userId && this.organizationId) {
            this.connect(this.userId, this.organizationId, 1).catch(() => {});
          }
        }, 3000);
      }
    });

    // Desconexão
    this.socket.on('disconnect', (reason) => {
      this.isAuthenticated = false;
      
      // Notificar callbacks de desconexão
      this.disconnectCallbacks.forEach(callback => {
        try {
          callback(reason);
        } catch (error) {
          console.error('❌ [Socket.IO] Erro em callback de desconexão:', error);
        }
      });

      // Se foi desconexão não intencional, tentar reconectar
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.handleReconnect();
      }
    });

    // Erro de autenticação
    this.socket.on('auth_error', (error) => {
      console.error('❌ [Socket.IO] Erro de autenticação:', error);
      this.isAuthenticated = false;
      // Tentar reconectar com novo token
      this.handleReconnect();
    });
  }

  /**
   * Entra nas salas necessárias após conexão
   */
  private async joinRooms(): Promise<void> {
    if (!this.socket?.connected || !this.userId || !this.organizationId) {
      return;
    }

    try {
      // Entrar na sala do usuário
      this.socket.emit('join-user', this.userId);

      // Entrar na sala da organização
      this.socket.emit('join-organization', this.organizationId);
    } catch (error) {
      console.error('❌ [Socket.IO] Erro ao entrar nas salas:', error);
    }
  }

  /**
   * Gerencia reconexão com backoff exponencial
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [Socket.IO] Máximo de tentativas de reconexão atingido');
      return;
    }

    // Backoff exponencial com jitter
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.maxReconnectDelay
    );


    this.reconnectTimer = setTimeout(async () => {
      if (this.userId && this.organizationId) {
        try {
          await this.connect(this.userId, this.organizationId);
        } catch (error) {
          console.error('❌ [Socket.IO] Erro na reconexão:', error);
          this.reconnectAttempts++;
          this.handleReconnect();
        }
      }
    }, delay);
  }

  /**
   * Desconecta do servidor
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnecting = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.userId = null;
    this.organizationId = null;
    this.eventListeners.clear();
  }

  /**
   * Retorna a instância do socket (pode ser null se não conectado)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected === true && this.isAuthenticated;
  }

  /**
   * Adiciona listener para um evento
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  /**
   * Remove listener de um evento
   */
  off(event: string, callback?: Function): void {
    if (callback) {
      this.eventListeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    } else {
      this.eventListeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  /**
   * Emite um evento
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.socket?.connected) {
      console.warn(`⚠️ [Socket.IO] Tentativa de emitir evento '${event}' sem conexão`);
      return false;
    }
    return this.socket.emit(event, ...args);
  }

  /**
   * Adiciona callback para quando conectar
   */
  onConnect(callback: () => void): void {
    this.connectionCallbacks.add(callback);
    if (this.isConnected()) {
      callback();
    }
  }

  /**
   * Remove callback de conexão
   */
  offConnect(callback: () => void): void {
    this.connectionCallbacks.delete(callback);
  }

  /**
   * Adiciona callback para quando desconectar
   */
  onDisconnect(callback: (reason: string) => void): void {
    this.disconnectCallbacks.add(callback);
  }

  /**
   * Remove callback de desconexão
   */
  offDisconnect(callback: (reason: string) => void): void {
    this.disconnectCallbacks.delete(callback);
  }
}

// Exportar instância singleton
export const socketManager = new SocketManager();

