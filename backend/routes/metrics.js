/**
 * Rotas de API para Métricas de Performance
 * 
 * Este módulo fornece APIs para acessar métricas detalhadas
 * de performance e monitoramento do sistema.
 */

import express from 'express';
import performanceMetrics from '../utils/performanceMetrics.js';
import redisCache from '../utils/redisCache.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/metrics/overview
 * Visão geral das métricas de performance
 */
router.get('/overview', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: {
        overview: stats.summary,
        health: stats.summary.systemHealth,
        recommendations: stats.recommendations.slice(0, 5), // Top 5 recomendações
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Erro ao obter overview de métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/detailed
 * Métricas detalhadas de performance
 */
router.get('/detailed', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Erro ao obter métricas detalhadas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/api
 * Métricas específicas de API
 */
router.get('/api', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: {
        api: stats.metrics.api,
        summary: {
          totalRequests: stats.metrics.api.requests,
          averageTime: stats.metrics.api.averageTime,
          errorRate: stats.metrics.api.requests > 0 ? 
            (stats.metrics.api.errors / stats.metrics.api.requests * 100).toFixed(2) : 0,
          cacheHitRate: (stats.metrics.api.cacheHits + stats.metrics.api.cacheMisses) > 0 ?
            (stats.metrics.api.cacheHits / (stats.metrics.api.cacheHits + stats.metrics.api.cacheMisses) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao obter métricas de API:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/database
 * Métricas específicas de banco de dados
 */
router.get('/database', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: {
        database: stats.metrics.database,
        summary: {
          totalQueries: stats.metrics.database.queries,
          averageTime: stats.metrics.database.averageTime,
          errorRate: stats.metrics.database.queries > 0 ? 
            (stats.metrics.database.errors / stats.metrics.database.queries * 100).toFixed(2) : 0,
          cacheHitRate: (stats.metrics.database.cacheHits + stats.metrics.database.cacheMisses) > 0 ?
            (stats.metrics.database.cacheHits / (stats.metrics.database.cacheHits + stats.metrics.database.cacheMisses) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao obter métricas de banco:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/realtime
 * Métricas específicas de realtime
 */
router.get('/realtime', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: {
        realtime: stats.metrics.realtime,
        summary: {
          totalEvents: stats.metrics.realtime.events,
          averageTime: stats.metrics.realtime.averageTime,
          errorRate: stats.metrics.realtime.events > 0 ? 
            (stats.metrics.realtime.errors / stats.metrics.realtime.events * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao obter métricas de realtime:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/frontend
 * Métricas específicas de frontend
 */
router.get('/frontend', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: {
        frontend: stats.metrics.frontend,
        summary: {
          totalRenders: stats.metrics.frontend.renders,
          averageRenderTime: stats.metrics.frontend.averageRenderTime,
          slowRenderRate: stats.metrics.frontend.renders > 0 ? 
            (stats.metrics.frontend.slowRenders / stats.metrics.frontend.renders * 100).toFixed(2) : 0,
          memoryUsage: stats.metrics.frontend.memoryUsage
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao obter métricas de frontend:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/system
 * Métricas específicas de sistema
 */
router.get('/system', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    
    res.json({
      success: true,
      data: {
        system: stats.metrics.system,
        health: stats.summary.systemHealth,
        uptime: stats.summary.uptime
      }
    });
  } catch (error) {
    logger.error('Erro ao obter métricas de sistema:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/alerts
 * Alertas de performance
 */
router.get('/alerts', async (req, res) => {
  try {
    const { limit = 20, severity } = req.query;
    const stats = performanceMetrics.getDetailedStats();
    
    let alerts = stats.alerts;
    
    // Filtrar por severidade se especificado
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Limitar quantidade
    alerts = alerts.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        alerts,
        total: stats.alerts.length,
        filtered: alerts.length
      }
    });
  } catch (error) {
    logger.error('Erro ao obter alertas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/recommendations
 * Recomendações de otimização
 */
router.get('/recommendations', async (req, res) => {
  try {
    const { priority } = req.query;
    const stats = performanceMetrics.getDetailedStats();
    
    let recommendations = stats.recommendations;
    
    // Filtrar por prioridade se especificado
    if (priority) {
      recommendations = recommendations.filter(rec => rec.priority === priority);
    }
    
    res.json({
      success: true,
      data: {
        recommendations,
        total: recommendations.length,
        priorities: {
          critical: recommendations.filter(r => r.priority === 'critical').length,
          high: recommendations.filter(r => r.priority === 'high').length,
          medium: recommendations.filter(r => r.priority === 'medium').length,
          low: recommendations.filter(r => r.priority === 'low').length
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao obter recomendações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/metrics/record
 * Registrar métrica manualmente
 */
router.post('/record', async (req, res) => {
  try {
    const { category, type, data } = req.body;
    
    if (!category || !type) {
      return res.status(400).json({
        success: false,
        error: 'category e type são obrigatórios'
      });
    }
    
    // Registrar métrica baseada na categoria
    switch (category) {
      case 'api':
        performanceMetrics.recordAPIMetric(
          data.endpoint,
          data.method,
          data.duration,
          data.success,
          data.fromCache
        );
        break;
      case 'database':
        performanceMetrics.recordDatabaseMetric(
          data.table,
          data.operation,
          data.duration,
          data.success,
          data.fromCache
        );
        break;
      case 'realtime':
        performanceMetrics.recordRealtimeMetric(
          data.eventType,
          data.duration,
          data.success
        );
        break;
      case 'frontend':
        performanceMetrics.recordFrontendMetric(
          data.componentName,
          data.renderTime,
          data.memoryUsage
        );
        break;
      case 'system':
        performanceMetrics.recordSystemMetric(
          data.type,
          data.value
        );
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Categoria inválida'
        });
    }
    
    res.json({
      success: true,
      message: 'Métrica registrada com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao registrar métrica:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/metrics/export
 * Exportar métricas para análise
 */
router.post('/export', async (req, res) => {
  try {
    const { format = 'json' } = req.body;
    
    const exportedData = performanceMetrics.exportMetrics();
    
    if (format === 'csv') {
      // Implementar exportação CSV se necessário
      res.json({
        success: true,
        message: 'Exportação CSV não implementada ainda',
        data: exportedData
      });
    } else {
      res.json({
        success: true,
        data: exportedData
      });
    }
    
  } catch (error) {
    logger.error('Erro ao exportar métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/metrics/reset
 * Resetar todas as métricas
 */
router.post('/reset', async (req, res) => {
  try {
    performanceMetrics.reset();
    
    res.json({
      success: true,
      message: 'Métricas resetadas com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao resetar métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/metrics/health
 * Health check do sistema
 */
router.get('/health', async (req, res) => {
  try {
    const stats = performanceMetrics.getDetailedStats();
    const health = stats.summary.systemHealth;
    
    const statusCode = health === 'critical' ? 503 : 
                      health === 'warning' ? 200 : 200;
    
    res.status(statusCode).json({
      success: true,
      data: {
        health,
        status: health === 'critical' ? 'unhealthy' : 'healthy',
        timestamp: new Date().toISOString(),
        uptime: stats.summary.uptime,
        metrics: {
          totalRequests: stats.summary.totalRequests,
          totalErrors: stats.summary.totalErrors,
          averageResponseTime: stats.summary.averageResponseTime,
          cacheHitRate: stats.summary.cacheHitRate
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro no health check:', error);
    res.status(503).json({
      success: false,
      error: 'Sistema indisponível'
    });
  }
});

export default router;
