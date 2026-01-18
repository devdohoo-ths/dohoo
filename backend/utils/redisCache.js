/**
 * Sistema de Cache Redis Inteligente
 * 
 * Este módulo implementa cache inteligente com Redis para otimizar
 * consultas Supabase e melhorar performance geral do sistema.
 * 
 * Compatível com PM2 e não afeta a instalação existente.
 */

import Redis from 'ioredis';
import logger from './logger.js';

class RedisCacheManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.errorLogged = false; // ✅ Para evitar spam de erros Redis
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    this.initializeRedis();
  }

  /**
   * Inicializa conexão com Redis
   */
  async initializeRedis() {
    try {
      // Configuração Redis compatível com PM2
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Configurações para PM2
        enableReadyCheck: false,
        maxMemoryPolicy: 'allkeys-lru'
      };

      this.redis = new Redis(redisConfig);

      // Event listeners
      this.redis.on('connect', () => {
        logger.info('Redis conectado com sucesso');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        // ✅ OTIMIZADO: Só logar erro uma vez e silenciar conexões recusadas esperadas
        if (error.code === 'ECONNREFUSED' && !this.errorLogged) {
          logger.warn('⚠️ Redis não disponível (ECONNREFUSED) - cache desabilitado');
          this.errorLogged = true;
        } else if (error.code !== 'ECONNREFUSED') {
          logger.error('❌ Erro Redis:', error.message);
        }
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Conexão Redis fechada');
        this.isConnected = false;
      });

      // Conectar
      await this.redis.connect();
      
    } catch (error) {
      logger.error('Falha ao inicializar Redis:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Verifica se Redis está disponível
   */
  isRedisAvailable() {
    return this.isConnected && this.redis;
  }

  /**
   * Gera chave de cache baseada em parâmetros
   */
  generateCacheKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});
    
    const paramString = JSON.stringify(sortedParams);
    return `${prefix}:${Buffer.from(paramString).toString('base64')}`;
  }

  /**
   * Obtém dados do cache
   */
  async get(key) {
    if (!this.isRedisAvailable()) {
      this.cacheStats.misses++;
      return null;
    }

    try {
      const data = await this.redis.get(key);
      if (data) {
        this.cacheStats.hits++;
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(data);
      } else {
        this.cacheStats.misses++;
        logger.debug(`Cache MISS: ${key}`);
        return null;
      }
    } catch (error) {
      logger.error(`Erro ao obter cache ${key}:`, error.message);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Armazena dados no cache
   */
  async set(key, data, ttlSeconds = 300) {
    if (!this.isRedisAvailable()) {
      return false;
    }

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
      this.cacheStats.sets++;
      logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error(`Erro ao definir cache ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Remove dados do cache
   */
  async delete(key) {
    if (!this.isRedisAvailable()) {
      return false;
    }

    try {
      await this.redis.del(key);
      this.cacheStats.deletes++;
      logger.debug(`Cache DELETE: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao deletar cache ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Remove múltiplas chaves do cache
   */
  async deletePattern(pattern) {
    if (!this.isRedisAvailable()) {
      return false;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.cacheStats.deletes += keys.length;
        logger.debug(`Cache DELETE PATTERN: ${pattern} (${keys.length} keys)`);
      }
      return true;
    } catch (error) {
      logger.error(`Erro ao deletar padrão ${pattern}:`, error.message);
      return false;
    }
  }

  /**
   * Cache inteligente para consultas Supabase
   */
  async cacheSupabaseQuery(queryKey, queryFunction, ttlSeconds = 300) {
    // Tentar obter do cache primeiro
    const cachedData = await this.get(queryKey);
    if (cachedData) {
      return cachedData;
    }

    // Executar query se não estiver em cache
    try {
      const data = await queryFunction();
      
      // Armazenar no cache
      await this.set(queryKey, data, ttlSeconds);
      
      return data;
    } catch (error) {
      logger.error(`Erro na query Supabase ${queryKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Cache com invalidação automática
   */
  async cacheWithInvalidation(key, data, ttlSeconds = 300, invalidationKeys = []) {
    await this.set(key, data, ttlSeconds);
    
    // Armazenar chaves de invalidação
    if (invalidationKeys.length > 0) {
      const invalidationKey = `${key}:invalidation`;
      await this.set(invalidationKey, invalidationKeys, ttlSeconds);
    }
  }

  /**
   * Invalida cache relacionado
   */
  async invalidateRelated(relatedKey) {
    if (!this.isRedisAvailable()) {
      return false;
    }

    try {
      // Buscar chaves relacionadas
      const pattern = `*:invalidation`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const invalidationKeys = await this.get(key);
        if (invalidationKeys && invalidationKeys.includes(relatedKey)) {
          const mainKey = key.replace(':invalidation', '');
          await this.delete(mainKey);
          await this.delete(key);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Erro ao invalidar cache relacionado ${relatedKey}:`, error.message);
      return false;
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0;
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      isConnected: this.isConnected,
      total: total
    };
  }

  /**
   * Limpa todas as estatísticas
   */
  resetStats() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * Fecha conexão Redis
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Conexão Redis fechada');
    }
  }
}

// Instância singleton
const redisCache = new RedisCacheManager();

export default redisCache;
