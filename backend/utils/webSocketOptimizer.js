/**
 * Middleware de Otimização de WebSocket Connections
 * 
 * Este módulo otimiza conexões WebSocket para reduzir overhead
 * e melhorar performance das subscriptions realtime.
 */

import redisCache from './redisCache.js';
import logger from './logger.js';

class WebSocketOptimizer {
  constructor() {
    this.connections = new Map();
    this.connectionStats = {
      total: 0,
      active: 0,
      closed: 0,
      errors: 0
    };
    this.cachePrefix = 'websocket';
    this.maxConnectionsPerUser = 5;
    this.connectionTTL = 300; // 5 minutos
  }

  /**
   * Registra nova conexão WebSocket
   */
  registerConnection(connectionId, userId, socket) {
    const connectionData = {
      id: connectionId,
      userId,
      socket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      subscriptions: new Set()
    };

    this.connections.set(connectionId, connectionData);
    this.connectionStats.total++;
    this.connectionStats.active++;

    // Cache da conexão
    this.cacheConnection(connectionId, connectionData);

    logger.debug(`Conexão WebSocket registrada: ${connectionId} (usuário: ${userId})`);
  }

  /**
   * Remove conexão WebSocket
   */
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.connectionStats.active--;
      this.connectionStats.closed++;

      // Limpar cache da conexão
      this.clearConnectionCache(connectionId);

      logger.debug(`Conexão WebSocket removida: ${connectionId}`);
    }
  }

  /**
   * Atualiza atividade da conexão
   */
  updateActivity(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      this.cacheConnection(connectionId, connection);
    }
  }

  /**
   * Adiciona subscription à conexão
   */
  addSubscription(connectionId, subscriptionKey) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscriptions.add(subscriptionKey);
      this.cacheConnection(connectionId, connection);
      
      logger.debug(`Subscription ${subscriptionKey} adicionada à conexão ${connectionId}`);
    }
  }

  /**
   * Remove subscription da conexão
   */
  removeSubscription(connectionId, subscriptionKey) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscriptions.delete(subscriptionKey);
      this.cacheConnection(connectionId, connection);
      
      logger.debug(`Subscription ${subscriptionKey} removida da conexão ${connectionId}`);
    }
  }

  /**
   * Verifica se usuário pode criar nova conexão
   */
  canCreateConnection(userId) {
    const userConnections = Array.from(this.connections.values())
      .filter(conn => conn.userId === userId);

    return userConnections.length < this.maxConnectionsPerUser;
  }

  /**
   * Obtém conexões de um usuário
   */
  getUserConnections(userId) {
    return Array.from(this.connections.values())
      .filter(conn => conn.userId === userId);
  }

  /**
   * Limpa conexões inativas
   */
  async cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutos
    const connectionsToRemove = [];

    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastActivity > inactiveThreshold) {
        connectionsToRemove.push(connectionId);
      }
    }

    for (const connectionId of connectionsToRemove) {
      this.removeConnection(connectionId);
      logger.info(`Conexão inativa removida: ${connectionId}`);
    }

    return connectionsToRemove.length;
  }

  /**
   * Cache da conexão no Redis
   */
  async cacheConnection(connectionId, connectionData) {
    if (!redisCache.isRedisAvailable()) return;

    const cacheKey = `${this.cachePrefix}:connection:${connectionId}`;
    const cacheData = {
      id: connectionData.id,
      userId: connectionData.userId,
      connectedAt: connectionData.connectedAt,
      lastActivity: connectionData.lastActivity,
      subscriptions: Array.from(connectionData.subscriptions)
    };

    await redisCache.set(cacheKey, cacheData, this.connectionTTL);
  }

  /**
   * Limpa cache da conexão
   */
  async clearConnectionCache(connectionId) {
    if (!redisCache.isRedisAvailable()) return;

    const cacheKey = `${this.cachePrefix}:connection:${connectionId}`;
    await redisCache.delete(cacheKey);
  }

  /**
   * Obtém conexão do cache
   */
  async getCachedConnection(connectionId) {
    if (!redisCache.isRedisAvailable()) return null;

    const cacheKey = `${this.cachePrefix}:connection:${connectionId}`;
    return await redisCache.get(cacheKey);
  }

  /**
   * Broadcast otimizado para múltiplas conexões
   */
  async broadcastToUser(userId, event, data) {
    const userConnections = this.getUserConnections(userId);
    
    if (userConnections.length === 0) {
      logger.debug(`Nenhuma conexão ativa para usuário ${userId}`);
      return;
    }

    // Usar Promise.all para broadcast paralelo
    const broadcastPromises = userConnections.map(connection => {
      try {
        connection.socket.emit(event, data);
        this.updateActivity(connection.id);
        return Promise.resolve();
      } catch (error) {
        logger.error(`Erro no broadcast para conexão ${connection.id}:`, error);
        this.connectionStats.errors++;
        return Promise.reject(error);
      }
    });

    try {
      await Promise.all(broadcastPromises);
      logger.debug(`Broadcast enviado para ${userConnections.length} conexões do usuário ${userId}`);
    } catch (error) {
      logger.error(`Erro no broadcast para usuário ${userId}:`, error);
    }
  }

  /**
   * Broadcast para conexões com subscription específica
   */
  async broadcastToSubscription(subscriptionKey, event, data) {
    const relevantConnections = Array.from(this.connections.values())
      .filter(conn => conn.subscriptions.has(subscriptionKey));

    if (relevantConnections.length === 0) {
      logger.debug(`Nenhuma conexão com subscription ${subscriptionKey}`);
      return;
    }

    const broadcastPromises = relevantConnections.map(connection => {
      try {
        connection.socket.emit(event, data);
        this.updateActivity(connection.id);
        return Promise.resolve();
      } catch (error) {
        logger.error(`Erro no broadcast para conexão ${connection.id}:`, error);
        this.connectionStats.errors++;
        return Promise.reject(error);
      }
    });

    try {
      await Promise.all(broadcastPromises);
      logger.debug(`Broadcast enviado para ${relevantConnections.length} conexões com subscription ${subscriptionKey}`);
    } catch (error) {
      logger.error(`Erro no broadcast para subscription ${subscriptionKey}:`, error);
    }
  }

  /**
   * Obtém estatísticas das conexões
   */
  getConnectionStats() {
    const now = Date.now();
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => now - conn.lastActivity < 5 * 60 * 1000); // 5 minutos

    const subscriptionsCount = Array.from(this.connections.values())
      .reduce((total, conn) => total + conn.subscriptions.size, 0);

    return {
      ...this.connectionStats,
      activeConnections: activeConnections.length,
      totalSubscriptions: subscriptionsCount,
      averageSubscriptionsPerConnection: this.connectionStats.active > 0 
        ? (subscriptionsCount / this.connectionStats.active).toFixed(2) 
        : 0
    };
  }

  /**
   * Limpa todas as conexões
   */
  async clearAllConnections() {
    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId);
    }
    
    // Limpar cache de conexões
    const pattern = `${this.cachePrefix}:connection:*`;
    await redisCache.deletePattern(pattern);
    
    logger.info('Todas as conexões WebSocket foram limpas');
  }
}

// Instância singleton
const webSocketOptimizer = new WebSocketOptimizer();

export default webSocketOptimizer;
