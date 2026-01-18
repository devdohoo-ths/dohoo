import express from 'express';
import performanceMonitor from '../utils/performanceMonitor.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// GET /api/performance/stats - Obter estatísticas de performance
router.get('/stats', async (req, res) => {
  try {
    const stats = performanceMonitor.getStats();
    
    logger.debug('Performance stats requested', { 
      userId: req.user?.id,
      stats: stats.summary 
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estatísticas de performance'
    });
  }
});

// GET /api/performance/slow-queries - Obter queries mais lentas
router.get('/slow-queries', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const slowQueries = performanceMonitor.getSlowestQueries(limit);
    
    logger.debug('Slow queries requested', { 
      userId: req.user?.id,
      limit,
      count: slowQueries.length 
    });
    
    res.json({
      success: true,
      data: slowQueries
    });
  } catch (error) {
    logger.error('Error getting slow queries:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter queries lentas'
    });
  }
});

// GET /api/performance/slow-operations - Obter operações mais lentas
router.get('/slow-operations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const slowOperations = performanceMonitor.getSlowestOperations(limit);
    
    logger.debug('Slow operations requested', { 
      userId: req.user?.id,
      limit,
      count: slowOperations.length 
    });
    
    res.json({
      success: true,
      data: slowOperations
    });
  } catch (error) {
    logger.error('Error getting slow operations:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter operações lentas'
    });
  }
});

// GET /api/performance/errors - Obter erros mais frequentes
router.get('/errors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const frequentErrors = performanceMonitor.getMostFrequentErrors(limit);
    
    logger.debug('Frequent errors requested', { 
      userId: req.user?.id,
      limit,
      count: frequentErrors.length 
    });
    
    res.json({
      success: true,
      data: frequentErrors
    });
  } catch (error) {
    logger.error('Error getting frequent errors:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter erros frequentes'
    });
  }
});

// GET /api/performance/report - Obter relatório completo de performance
router.get('/report', async (req, res) => {
  try {
    const report = performanceMonitor.generateReport();
    
    logger.info('Performance report generated', { 
      userId: req.user?.id,
      recommendations: report.recommendations.length 
    });
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating performance report:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar relatório de performance'
    });
  }
});

// POST /api/performance/cleanup - Limpar métricas antigas
router.post('/cleanup', async (req, res) => {
  try {
    performanceMonitor.cleanup();
    
    logger.info('Performance metrics cleaned up', { 
      userId: req.user?.id 
    });
    
    res.json({
      success: true,
      message: 'Métricas de performance limpas com sucesso'
    });
  } catch (error) {
    logger.error('Error cleaning up performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar métricas de performance'
    });
  }
});

export default router;
