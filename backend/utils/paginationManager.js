/**
 * Sistema de Paginação Otimizada
 * 
 * Este módulo implementa paginação inteligente com cache Redis
 * para melhorar performance em listas grandes.
 */

import redisCache from './redisCache.js';
import logger from './logger.js';

class PaginationManager {
  constructor() {
    this.defaultPageSize = 20;
    this.maxPageSize = 100;
    this.cachePrefix = 'pagination';
    this.defaultTTL = 600; // 10 minutos
  }

  /**
   * Gera chave de cache para página
   */
  generatePageKey(baseKey, page, pageSize, filters = {}) {
    return redisCache.generateCacheKey(
      `${this.cachePrefix}:${baseKey}`,
      { page, pageSize, ...filters }
    );
  }

  /**
   * Pagina dados com cache inteligente
   */
  async paginateData(baseKey, dataFunction, options = {}) {
    const {
      page = 1,
      pageSize = this.defaultPageSize,
      filters = {},
      ttl = this.defaultTTL,
      enableCache = true
    } = options;

    // Validar parâmetros
    const validPage = Math.max(1, parseInt(page));
    const validPageSize = Math.min(
      Math.max(1, parseInt(pageSize)),
      this.maxPageSize
    );

    const offset = (validPage - 1) * validPageSize;

    // Chave de cache para esta página
    const cacheKey = this.generatePageKey(baseKey, validPage, validPageSize, filters);

    // Tentar obter do cache primeiro
    if (enableCache) {
      const cachedData = await redisCache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Página ${validPage} obtida do cache: ${baseKey}`);
        return cachedData;
      }
    }

    // Obter dados se não estiver em cache
    try {
      const data = await dataFunction(offset, validPageSize, filters);
      
      // Calcular metadados de paginação
      const paginationData = {
        data: data.items || data,
        pagination: {
          page: validPage,
          pageSize: validPageSize,
          totalItems: data.totalCount || data.length,
          totalPages: Math.ceil((data.totalCount || data.length) / validPageSize),
          hasNextPage: validPage < Math.ceil((data.totalCount || data.length) / validPageSize),
          hasPrevPage: validPage > 1,
          nextPage: validPage < Math.ceil((data.totalCount || data.length) / validPageSize) ? validPage + 1 : null,
          prevPage: validPage > 1 ? validPage - 1 : null
        },
        filters: filters,
        cached: false
      };

      // Armazenar no cache
      if (enableCache) {
        await redisCache.set(cacheKey, paginationData, ttl);
        paginationData.cached = true;
      }

      logger.debug(`Página ${validPage} gerada: ${baseKey}`);
      return paginationData;

    } catch (error) {
      logger.error(`Erro na paginação ${baseKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Pagina dados Supabase com cache
   */
  async paginateSupabaseData(table, options = {}) {
    const {
      page = 1,
      pageSize = this.defaultPageSize,
      filters = {},
      columns = '*',
      order = {},
      ttl = this.defaultTTL,
      enableCache = true
    } = options;

    const validPage = Math.max(1, parseInt(page));
    const validPageSize = Math.min(
      Math.max(1, parseInt(pageSize)),
      this.maxPageSize
    );

    const offset = (validPage - 1) * validPageSize;
    const baseKey = `supabase:${table}`;
    const cacheKey = this.generatePageKey(baseKey, validPage, validPageSize, {
      columns,
      order,
      ...filters
    });

    // Tentar obter do cache
    if (enableCache) {
      const cachedData = await redisCache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Página Supabase ${validPage} obtida do cache: ${table}`);
        return cachedData;
      }
    }

    // Importar cachedSupabase dinamicamente para evitar dependência circular
    const { default: cachedSupabase } = await import('./cachedSupabase.js');

    try {
      // Obter dados e contagem total
      const [data, totalCount] = await Promise.all([
        cachedSupabase.select(table, {
          columns,
          filters,
          order,
          limit: validPageSize,
          offset,
          ttl: 0 // Não usar cache interno para evitar duplo cache
        }),
        cachedSupabase.count(table, filters, { ttl: 0 })
      ]);

      const paginationData = {
        data,
        pagination: {
          page: validPage,
          pageSize: validPageSize,
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / validPageSize),
          hasNextPage: validPage < Math.ceil(totalCount / validPageSize),
          hasPrevPage: validPage > 1,
          nextPage: validPage < Math.ceil(totalCount / validPageSize) ? validPage + 1 : null,
          prevPage: validPage > 1 ? validPage - 1 : null
        },
        filters: filters,
        cached: false
      };

      // Armazenar no cache
      if (enableCache) {
        await redisCache.set(cacheKey, paginationData, ttl);
        paginationData.cached = true;
      }

      logger.debug(`Página Supabase ${validPage} gerada: ${table}`);
      return paginationData;

    } catch (error) {
      logger.error(`Erro na paginação Supabase ${table}:`, error.message);
      throw error;
    }
  }

  /**
   * Invalida cache de paginação para uma tabela
   */
  async invalidatePaginationCache(table) {
    const pattern = `${this.cachePrefix}:supabase:${table}:*`;
    await redisCache.deletePattern(pattern);
    logger.debug(`Cache de paginação invalidado para: ${table}`);
  }

  /**
   * Invalida cache de paginação específico
   */
  async invalidatePageCache(baseKey, page, pageSize, filters = {}) {
    const cacheKey = this.generatePageKey(baseKey, page, pageSize, filters);
    await redisCache.delete(cacheKey);
    logger.debug(`Cache de página invalidado: ${cacheKey}`);
  }

  /**
   * Limpa todo o cache de paginação
   */
  async clearAllPaginationCache() {
    const pattern = `${this.cachePrefix}:*`;
    await redisCache.deletePattern(pattern);
    logger.info('Todo o cache de paginação foi limpo');
  }

  /**
   * Obtém estatísticas de paginação
   */
  getStats() {
    return redisCache.getStats();
  }

  /**
   * Valida parâmetros de paginação
   */
  validatePaginationParams(page, pageSize) {
    const validPage = Math.max(1, parseInt(page) || 1);
    const validPageSize = Math.min(
      Math.max(1, parseInt(pageSize) || this.defaultPageSize),
      this.maxPageSize
    );

    return {
      page: validPage,
      pageSize: validPageSize,
      offset: (validPage - 1) * validPageSize
    };
  }

  /**
   * Gera links de paginação para API
   */
  generatePaginationLinks(baseUrl, pagination, filters = {}) {
    const { page, totalPages, hasNextPage, hasPrevPage, nextPage, prevPage } = pagination;
    
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        queryParams.append(key, value);
      }
    });

    const baseQuery = queryParams.toString();
    const querySuffix = baseQuery ? `&${baseQuery}` : '';

    return {
      self: `${baseUrl}?page=${page}${querySuffix}`,
      first: `${baseUrl}?page=1${querySuffix}`,
      last: `${baseUrl}?page=${totalPages}${querySuffix}`,
      next: hasNextPage ? `${baseUrl}?page=${nextPage}${querySuffix}` : null,
      prev: hasPrevPage ? `${baseUrl}?page=${prevPage}${querySuffix}` : null
    };
  }
}

// Instância singleton
const paginationManager = new PaginationManager();

export default paginationManager;
