/**
 * Supabase com Cache Redis Inteligente
 * 
 * Este módulo estende o Supabase com cache Redis para otimizar
 * consultas e reduzir chamadas desnecessárias ao banco.
 */

import { createClient } from '@supabase/supabase-js';
import redisCache from './redisCache.js';
import logger from './logger.js';
import performanceMonitor from './performanceMonitor.js';

class CachedSupabaseClient {
  constructor() {
    this.supabase = null;
    this.cachePrefix = 'supabase';
    this.defaultTTL = 300; // 5 minutos
    this.initializeSupabase();
  }

  /**
   * Inicializa cliente Supabase
   */
  initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Variáveis Supabase não configuradas');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('Cliente Supabase inicializado com cache Redis');
  }

  /**
   * Gera chave de cache para consulta Supabase
   */
  generateQueryKey(table, operation, params = {}) {
    return redisCache.generateCacheKey(
      `${this.cachePrefix}:${table}:${operation}`,
      params
    );
  }

  /**
   * Consulta com cache automático
   */
  async cachedQuery(table, operation, queryFunction, ttlSeconds = null) {
    const ttl = ttlSeconds || this.defaultTTL;
    const cacheKey = this.generateQueryKey(table, operation, {
      timestamp: Math.floor(Date.now() / (ttl * 1000)) // Cache por período
    });

    return await redisCache.cacheSupabaseQuery(
      cacheKey,
      queryFunction,
      ttl
    );
  }

  /**
   * SELECT com cache
   */
  async select(table, options = {}) {
    const {
      columns = '*',
      filters = {},
      order = {},
      limit = null,
      offset = null,
      ttl = this.defaultTTL,
      cacheKey = null
    } = options;

    const queryFunction = async () => {
      const startTime = Date.now();
      
      let query = this.supabase.from(table).select(columns);

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'object' && value.operator) {
          query = query[value.operator](key, value.value);
        } else {
          query = query.eq(key, value);
        }
      });

      // Aplicar ordenação
      if (order.column) {
        query = query.order(order.column, { ascending: order.ascending !== false });
      }

      // Aplicar limite e offset
      if (limit) {
        query = query.limit(limit);
      }
      if (offset) {
        query = query.range(offset, offset + (limit || 1000) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`Erro Supabase SELECT ${table}:`, error);
        throw error;
      }

      // Monitorar performance
      const duration = Date.now() - startTime;
      performanceMonitor.trackQuery(table, 'select', duration);

      return data;
    };

    const finalCacheKey = cacheKey || this.generateQueryKey(table, 'select', {
      columns,
      filters,
      order,
      limit,
      offset
    });

    return await redisCache.cacheSupabaseQuery(
      finalCacheKey,
      queryFunction,
      ttl
    );
  }

  /**
   * INSERT com invalidação de cache
   */
  async insert(table, data, options = {}) {
    const { invalidateCache = true } = options;

    const startTime = Date.now();
    const { data: result, error } = await this.supabase
      .from(table)
      .insert(data)
      .select();

    if (error) {
      logger.error(`Erro Supabase INSERT ${table}:`, error);
      throw error;
    }

    // Monitorar performance
    const duration = Date.now() - startTime;
    performanceMonitor.trackQuery(table, 'insert', duration);

    // Invalidar cache relacionado
    if (invalidateCache) {
      await this.invalidateTableCache(table);
    }

    return result;
  }

  /**
   * UPDATE com invalidação de cache
   */
  async update(table, data, filters, options = {}) {
    const { invalidateCache = true } = options;

    const startTime = Date.now();
    let query = this.supabase.from(table).update(data);

    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: result, error } = await query.select();

    if (error) {
      logger.error(`Erro Supabase UPDATE ${table}:`, error);
      throw error;
    }

    // Monitorar performance
    const duration = Date.now() - startTime;
    performanceMonitor.trackQuery(table, 'update', duration);

    // Invalidar cache relacionado
    if (invalidateCache) {
      await this.invalidateTableCache(table);
    }

    return result;
  }

  /**
   * DELETE com invalidação de cache
   */
  async delete(table, filters, options = {}) {
    const { invalidateCache = true } = options;

    const startTime = Date.now();
    let query = this.supabase.from(table).delete();

    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: result, error } = await query.select();

    if (error) {
      logger.error(`Erro Supabase DELETE ${table}:`, error);
      throw error;
    }

    // Monitorar performance
    const duration = Date.now() - startTime;
    performanceMonitor.trackQuery(table, 'delete', duration);

    // Invalidar cache relacionado
    if (invalidateCache) {
      await this.invalidateTableCache(table);
    }

    return result;
  }

  /**
   * COUNT com cache
   */
  async count(table, filters = {}, options = {}) {
    const { ttl = 60 } = options; // Cache mais curto para contadores

    const queryFunction = async () => {
      const startTime = Date.now();
      
      let query = this.supabase.from(table).select('*', { count: 'exact', head: true });

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      });

      const { count, error } = await query;

      if (error) {
        logger.error(`Erro Supabase COUNT ${table}:`, error);
        throw error;
      }

      // Monitorar performance
      const duration = Date.now() - startTime;
      performanceMonitor.trackQuery(table, 'count', duration);

      return count;
    };

    const cacheKey = this.generateQueryKey(table, 'count', filters);
    return await redisCache.cacheSupabaseQuery(cacheKey, queryFunction, ttl);
  }

  /**
   * Invalida cache de uma tabela
   */
  async invalidateTableCache(table) {
    const pattern = `${this.cachePrefix}:${table}:*`;
    await redisCache.deletePattern(pattern);
    logger.debug(`Cache invalidado para tabela: ${table}`);
  }

  /**
   * Invalida cache específico
   */
  async invalidateCache(table, operation, params = {}) {
    const cacheKey = this.generateQueryKey(table, operation, params);
    await redisCache.delete(cacheKey);
    logger.debug(`Cache invalidado: ${cacheKey}`);
  }

  /**
   * Limpa todo o cache
   */
  async clearAllCache() {
    const pattern = `${this.cachePrefix}:*`;
    await redisCache.deletePattern(pattern);
    logger.info('Todo o cache Supabase foi limpo');
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats() {
    return redisCache.getStats();
  }

  /**
   * Obtém cliente Supabase original
   */
  getClient() {
    return this.supabase;
  }
}

// Instância singleton
const cachedSupabase = new CachedSupabaseClient();

export default cachedSupabase;
