/**
 * Sistema de Subscriptions Realtime Otimizado
 * 
 * Este módulo otimiza subscriptions realtime do Supabase usando cache Redis
 * para reduzir carga e melhorar performance.
 */

import { createClient } from '@supabase/supabase-js';
import redisCache from './redisCache.js';
import logger from './logger.js';
import performanceMonitor from './performanceMonitor.js';

class OptimizedRealtimeManager {
  constructor() {
    this.supabase = null;
    this.subscriptions = new Map();
    this.cachePrefix = 'realtime';
    this.defaultTTL = 60; // 1 minuto para dados realtime
    this.initializeSupabase();
  }

  /**
   * Inicializa cliente Supabase
   */
  initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Variáveis Supabase não configuradas para realtime');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('Cliente Supabase Realtime inicializado com cache');
  }

  /**
   * Gera chave de cache para subscription
   */
  generateSubscriptionKey(table, filters = {}) {
    return redisCache.generateCacheKey(
      `${this.cachePrefix}:${table}`,
      filters
    );
  }

  /**
   * Subscription otimizada com cache
   */
  async subscribeToTable(table, options = {}) {
    const {
      filters = {},
      callback,
      onError,
      enableCache = true,
      ttl = this.defaultTTL
    } = options;

    if (!this.supabase) {
      logger.error('Cliente Supabase não inicializado');
      return null;
    }

    const subscriptionKey = this.generateSubscriptionKey(table, filters);
    
    // Verificar se já existe subscription ativa
    if (this.subscriptions.has(subscriptionKey)) {
      logger.debug(`Subscription já ativa para ${table}`);
      return this.subscriptions.get(subscriptionKey);
    }

    logger.debug(`Iniciando subscription otimizada para ${table}`);

    // Criar subscription com cache
    const subscription = this.supabase
      .channel(`optimized-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: this.buildFilterString(filters)
        },
        async (payload) => {
          const startTime = Date.now();
          
          try {
            // Processar evento
            await this.handleRealtimeEvent(table, payload, {
              enableCache,
              ttl,
              callback
            });

            // Monitorar performance
            const duration = Date.now() - startTime;
            performanceMonitor.trackOperation('realtime_event', duration);

          } catch (error) {
            logger.error(`Erro no evento realtime ${table}:`, error);
            if (onError) onError(error);
          }
        }
      )
      .subscribe((status) => {
        logger.debug(`Subscription ${table} status:`, status);
        
        if (status === 'SUBSCRIBED') {
          this.subscriptions.set(subscriptionKey, subscription);
          logger.info(`Subscription ativa para ${table}`);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(`Erro na subscription ${table}`);
          this.subscriptions.delete(subscriptionKey);
        }
      });

    return subscription;
  }

  /**
   * Manipula eventos realtime com cache
   */
  async handleRealtimeEvent(table, payload, options = {}) {
    const { enableCache, ttl, callback } = options;
    const { eventType, new: newRecord, old: oldRecord } = payload;

    logger.debug(`Evento realtime ${eventType} em ${table}`);

    // Invalidar cache relacionado
    if (enableCache) {
      await this.invalidateTableCache(table);
    }

    // Processar evento específico
    switch (eventType) {
      case 'INSERT':
        await this.handleInsert(table, newRecord, enableCache, ttl);
        break;
      case 'UPDATE':
        await this.handleUpdate(table, newRecord, oldRecord, enableCache, ttl);
        break;
      case 'DELETE':
        await this.handleDelete(table, oldRecord, enableCache);
        break;
    }

    // Executar callback se fornecido
    if (callback) {
      await callback({
        eventType,
        new: newRecord,
        old: oldRecord,
        table
      });
    }
  }

  /**
   * Manipula evento INSERT
   */
  async handleInsert(table, newRecord, enableCache, ttl) {
    if (!enableCache) return;

    // Cache do novo registro
    const recordKey = `${this.cachePrefix}:${table}:${newRecord.id}`;
    await redisCache.set(recordKey, newRecord, ttl);

    // Invalidar listas que podem incluir este registro
    await this.invalidateListCaches(table);

    logger.debug(`Cache atualizado para INSERT em ${table}`);
  }

  /**
   * Manipula evento UPDATE
   */
  async handleUpdate(table, newRecord, oldRecord, enableCache, ttl) {
    if (!enableCache) return;

    // Atualizar cache do registro
    const recordKey = `${this.cachePrefix}:${table}:${newRecord.id}`;
    await redisCache.set(recordKey, newRecord, ttl);

    // Invalidar listas que podem incluir este registro
    await this.invalidateListCaches(table);

    logger.debug(`Cache atualizado para UPDATE em ${table}`);
  }

  /**
   * Manipula evento DELETE
   */
  async handleDelete(table, oldRecord, enableCache) {
    if (!enableCache) return;

    // Remover registro do cache
    const recordKey = `${this.cachePrefix}:${table}:${oldRecord.id}`;
    await redisCache.delete(recordKey);

    // Invalidar listas que podem incluir este registro
    await this.invalidateListCaches(table);

    logger.debug(`Cache atualizado para DELETE em ${table}`);
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
   * Invalida caches de listas
   */
  async invalidateListCaches(table) {
    // Invalidar caches de paginação
    const paginationPattern = `pagination:supabase:${table}:*`;
    await redisCache.deletePattern(paginationPattern);

    // Invalidar caches de dashboard
    const dashboardPattern = `dashboard:*`;
    await redisCache.deletePattern(dashboardPattern);

    logger.debug(`Caches de lista invalidados para: ${table}`);
  }

  /**
   * Constrói string de filtro para subscription
   */
  buildFilterString(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return '*';
    }

    return Object.entries(filters)
      .map(([key, value]) => `${key}=eq.${value}`)
      .join(',');
  }

  /**
   * Subscription para mensagens com cache inteligente
   */
  async subscribeToMessages(options = {}) {
    const {
      organization_id,
      user_id,
      callback,
      onError
    } = options;

    const filters = {};
    if (organization_id) filters.organization_id = organization_id;
    if (user_id) filters.user_id = user_id;

    return await this.subscribeToTable('messages', {
      filters,
      callback,
      onError,
      enableCache: true,
      ttl: 30 // Cache mais curto para mensagens
    });
  }

  /**
   * Subscription para chats com cache inteligente
   */
  async subscribeToChats(options = {}) {
    const {
      organization_id,
      assigned_agent_id,
      callback,
      onError
    } = options;

    const filters = {};
    if (organization_id) filters.organization_id = organization_id;
    if (assigned_agent_id) filters.assigned_agent_id = assigned_agent_id;

    return await this.subscribeToTable('chats', {
      filters,
      callback,
      onError,
      enableCache: true,
      ttl: 60
    });
  }

  /**
   * Subscription para usuários com cache inteligente
   */
  async subscribeToUsers(options = {}) {
    const {
      organization_id,
      callback,
      onError
    } = options;

    const filters = {};
    if (organization_id) filters.organization_id = organization_id;

    return await this.subscribeToTable('users', {
      filters,
      callback,
      onError,
      enableCache: true,
      ttl: 300 // Cache mais longo para usuários
    });
  }

  /**
   * Desconecta subscription específica
   */
  async unsubscribeFromTable(table, filters = {}) {
    const subscriptionKey = this.generateSubscriptionKey(table, filters);
    const subscription = this.subscriptions.get(subscriptionKey);

    if (subscription) {
      await this.supabase.removeChannel(subscription);
      this.subscriptions.delete(subscriptionKey);
      logger.info(`Subscription removida para ${table}`);
    }
  }

  /**
   * Desconecta todas as subscriptions
   */
  async unsubscribeAll() {
    for (const [key, subscription] of this.subscriptions) {
      await this.supabase.removeChannel(subscription);
    }
    this.subscriptions.clear();
    logger.info('Todas as subscriptions foram removidas');
  }

  /**
   * Obtém estatísticas das subscriptions
   */
  getSubscriptionStats() {
    return {
      activeSubscriptions: this.subscriptions.size,
      subscriptions: Array.from(this.subscriptions.keys()),
      cacheStats: redisCache.getStats()
    };
  }

  /**
   * Limpa cache de realtime
   */
  async clearRealtimeCache() {
    const pattern = `${this.cachePrefix}:*`;
    await redisCache.deletePattern(pattern);
    logger.info('Cache realtime limpo');
  }
}

// Instância singleton
const optimizedRealtime = new OptimizedRealtimeManager();

export default optimizedRealtime;
