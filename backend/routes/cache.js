/**
 * Rotas de API Otimizadas com Cache Redis
 * 
 * Este módulo implementa rotas de API com cache Redis para
 * melhorar performance e reduzir carga no Supabase.
 */

import express from 'express';
import redisCache from '../utils/redisCache.js';
import cachedSupabase from '../utils/cachedSupabase.js';
import paginationManager from '../utils/paginationManager.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Middleware para verificar cache Redis
 */
const checkRedisHealth = (req, res, next) => {
  if (!redisCache.isRedisAvailable()) {
    logger.warn('Redis não disponível, usando Supabase direto');
  }
  next();
};

/**
 * GET /api/cache/stats
 * Estatísticas do cache Redis
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = redisCache.getStats();
    res.json({
      success: true,
      data: {
        cache: stats,
        redis: {
          available: redisCache.isRedisAvailable(),
          connected: redisCache.isConnected
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas do cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/cache/clear
 * Limpa todo o cache Redis
 */
router.post('/clear', async (req, res) => {
  try {
    await redisCache.deletePattern('*');
    logger.info('Cache Redis limpo manualmente');
    res.json({
      success: true,
      message: 'Cache limpo com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache'
    });
  }
});

/**
 * GET /api/messages/paginated
 * Mensagens com paginação otimizada
 */
router.get('/messages/paginated', checkRedisHealth, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      organization_id,
      user_id,
      start_date,
      end_date,
      keyword
    } = req.query;

    // Construir filtros
    const filters = {};
    if (organization_id) filters.organization_id = organization_id;
    if (user_id) filters.user_id = user_id;
    if (start_date) filters.created_at = { operator: 'gte', value: start_date };
    if (end_date) filters.created_at = { operator: 'lte', value: end_date };
    if (keyword) filters.content = { operator: 'ilike', value: `%${keyword}%` };

    // Obter dados paginados
    const result = await paginationManager.paginateSupabaseData('messages', {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      filters,
      order: { column: 'created_at', ascending: false },
      ttl: 300 // 5 minutos
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      cached: result.cached
    });

  } catch (error) {
    logger.error('Erro ao obter mensagens paginadas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter mensagens'
    });
  }
});

/**
 * GET /api/chats/paginated
 * Chats com paginação otimizada
 */
router.get('/chats/paginated', checkRedisHealth, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      organization_id,
      assigned_agent_id,
      status
    } = req.query;

    // Construir filtros
    const filters = {};
    if (organization_id) filters.organization_id = organization_id;
    if (assigned_agent_id) filters.assigned_agent_id = assigned_agent_id;
    if (status) filters.status = status;

    // Obter dados paginados
    const result = await paginationManager.paginateSupabaseData('chats', {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      filters,
      order: { column: 'updated_at', ascending: false },
      ttl: 600 // 10 minutos
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      cached: result.cached
    });

  } catch (error) {
    logger.error('Erro ao obter chats paginados:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter chats'
    });
  }
});

/**
 * GET /api/users/paginated
 * Usuários com paginação otimizada
 */
router.get('/users/paginated', checkRedisHealth, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      organization_id,
      role,
      status
    } = req.query;

    // Construir filtros
    const filters = {};
    if (organization_id) filters.organization_id = organization_id;
    if (role) filters.role = role;
    if (status) filters.status = status;

    // Obter dados paginados
    const result = await paginationManager.paginateSupabaseData('users', {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      filters,
      order: { column: 'created_at', ascending: false },
      ttl: 900 // 15 minutos
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      cached: result.cached
    });

  } catch (error) {
    logger.error('Erro ao obter usuários paginados:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter usuários'
    });
  }
});

/**
 * GET /api/dashboard/cached
 * Dashboard com cache otimizado
 */
router.get('/dashboard/cached', checkRedisHealth, async (req, res) => {
  try {
    const { organization_id, start_date, end_date } = req.query;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }

    const cacheKey = redisCache.generateCacheKey('dashboard', {
      organization_id,
      start_date,
      end_date,
      period: Math.floor(Date.now() / (300 * 1000)) // Cache por 5 minutos
    });

    // Tentar obter do cache
    const cachedData = await redisCache.get(cacheKey);
    if (cachedData) {
      logger.debug('Dashboard obtido do cache');
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // Gerar dados do dashboard
    const dashboardData = await generateDashboardData(organization_id, start_date, end_date);

    // Armazenar no cache
    await redisCache.set(cacheKey, dashboardData, 300); // 5 minutos

    res.json({
      success: true,
      data: dashboardData,
      cached: false
    });

  } catch (error) {
    logger.error('Erro ao obter dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter dados do dashboard'
    });
  }
});

/**
 * Função auxiliar para gerar dados do dashboard
 */
async function generateDashboardData(organization_id, start_date, end_date) {
  const filters = { organization_id };
  if (start_date) filters.created_at = { operator: 'gte', value: start_date };
  if (end_date) filters.created_at = { operator: 'lte', value: end_date };

  // Obter estatísticas em paralelo
  const [totalMessages, totalChats, totalUsers, recentMessages] = await Promise.all([
    cachedSupabase.count('messages', filters),
    cachedSupabase.count('chats', filters),
    cachedSupabase.count('users', { organization_id }),
    cachedSupabase.select('messages', {
      filters,
      order: { column: 'created_at', ascending: false },
      limit: 10,
      ttl: 0
    })
  ]);

  return {
    totalMessages,
    totalChats,
    totalUsers,
    recentMessages,
    generatedAt: new Date().toISOString()
  };
}

/**
 * POST /api/cache/invalidate
 * Invalida cache específico
 */
router.post('/invalidate', async (req, res) => {
  try {
    const { table, operation, params = {} } = req.body;

    if (!table) {
      return res.status(400).json({
        success: false,
        error: 'Tabela é obrigatória'
      });
    }

    if (operation) {
      await cachedSupabase.invalidateCache(table, operation, params);
    } else {
      await cachedSupabase.invalidateTableCache(table);
    }

    logger.info(`Cache invalidado: ${table}${operation ? `:${operation}` : ''}`);
    res.json({
      success: true,
      message: 'Cache invalidado com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao invalidar cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao invalidar cache'
    });
  }
});

export default router;
