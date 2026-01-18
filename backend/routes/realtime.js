/**
 * Rotas de API para Subscriptions Realtime Otimizadas
 * 
 * Este módulo fornece APIs para gerenciar subscriptions realtime
 * com cache Redis e otimizações de performance.
 */

import express from 'express';
import optimizedRealtime from '../utils/optimizedRealtime.js';
import webSocketOptimizer from '../utils/webSocketOptimizer.js';
import redisCache from '../utils/redisCache.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Middleware para verificar Redis
 */
const checkRedisHealth = (req, res, next) => {
  if (!redisCache.isRedisAvailable()) {
    logger.warn('Redis não disponível para realtime');
  }
  next();
};

/**
 * GET /api/realtime/stats
 * Estatísticas das subscriptions realtime
 */
router.get('/stats', checkRedisHealth, async (req, res) => {
  try {
    const stats = optimizedRealtime.getSubscriptionStats();
    const connectionStats = webSocketOptimizer.getConnectionStats();
    
    res.json({
      success: true,
      data: {
        subscriptions: stats,
        connections: connectionStats,
        redis: {
          available: redisCache.isRedisAvailable(),
          stats: redisCache.getStats()
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas realtime:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/realtime/subscribe/messages
 * Subscribe para mensagens com cache
 */
router.post('/subscribe/messages', checkRedisHealth, async (req, res) => {
  try {
    const { organization_id, user_id, callback_url } = req.body;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }

    const subscription = await optimizedRealtime.subscribeToMessages({
      organization_id,
      user_id,
      callback: async (payload) => {
        logger.debug('Callback de mensagem executado:', payload);
        // Aqui você pode implementar lógica adicional
      },
      onError: (error) => {
        logger.error('Erro na subscription de mensagens:', error);
      }
    });

    if (subscription) {
      res.json({
        success: true,
        message: 'Subscription para mensagens ativada',
        subscriptionId: subscription.id
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao criar subscription'
      });
    }

  } catch (error) {
    logger.error('Erro ao criar subscription de mensagens:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar subscription'
    });
  }
});

/**
 * POST /api/realtime/subscribe/chats
 * Subscribe para chats com cache
 */
router.post('/subscribe/chats', checkRedisHealth, async (req, res) => {
  try {
    const { organization_id, assigned_agent_id, callback_url } = req.body;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }

    const subscription = await optimizedRealtime.subscribeToChats({
      organization_id,
      assigned_agent_id,
      callback: async (payload) => {
        logger.debug('Callback de chat executado:', payload);
        // Aqui você pode implementar lógica adicional
      },
      onError: (error) => {
        logger.error('Erro na subscription de chats:', error);
      }
    });

    if (subscription) {
      res.json({
        success: true,
        message: 'Subscription para chats ativada',
        subscriptionId: subscription.id
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao criar subscription'
      });
    }

  } catch (error) {
    logger.error('Erro ao criar subscription de chats:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar subscription'
    });
  }
});

/**
 * POST /api/realtime/subscribe/users
 * Subscribe para usuários com cache
 */
router.post('/subscribe/users', checkRedisHealth, async (req, res) => {
  try {
    const { organization_id, callback_url } = req.body;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }

    const subscription = await optimizedRealtime.subscribeToUsers({
      organization_id,
      callback: async (payload) => {
        logger.debug('Callback de usuário executado:', payload);
        // Aqui você pode implementar lógica adicional
      },
      onError: (error) => {
        logger.error('Erro na subscription de usuários:', error);
      }
    });

    if (subscription) {
      res.json({
        success: true,
        message: 'Subscription para usuários ativada',
        subscriptionId: subscription.id
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao criar subscription'
      });
    }

  } catch (error) {
    logger.error('Erro ao criar subscription de usuários:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar subscription'
    });
  }
});

/**
 * DELETE /api/realtime/unsubscribe/:table
 * Remove subscription específica
 */
router.delete('/unsubscribe/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { filters = {} } = req.body;

    await optimizedRealtime.unsubscribeFromTable(table, filters);

    res.json({
      success: true,
      message: `Subscription para ${table} removida`
    });

  } catch (error) {
    logger.error('Erro ao remover subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover subscription'
    });
  }
});

/**
 * DELETE /api/realtime/unsubscribe/all
 * Remove todas as subscriptions
 */
router.delete('/unsubscribe/all', async (req, res) => {
  try {
    await optimizedRealtime.unsubscribeAll();

    res.json({
      success: true,
      message: 'Todas as subscriptions foram removidas'
    });

  } catch (error) {
    logger.error('Erro ao remover todas as subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover subscriptions'
    });
  }
});

/**
 * POST /api/realtime/broadcast/user
 * Broadcast para usuário específico
 */
router.post('/broadcast/user', async (req, res) => {
  try {
    const { userId, event, data } = req.body;

    if (!userId || !event) {
      return res.status(400).json({
        success: false,
        error: 'userId e event são obrigatórios'
      });
    }

    await webSocketOptimizer.broadcastToUser(userId, event, data);

    res.json({
      success: true,
      message: `Broadcast enviado para usuário ${userId}`
    });

  } catch (error) {
    logger.error('Erro no broadcast para usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro no broadcast'
    });
  }
});

/**
 * POST /api/realtime/broadcast/subscription
 * Broadcast para subscription específica
 */
router.post('/broadcast/subscription', async (req, res) => {
  try {
    const { subscriptionKey, event, data } = req.body;

    if (!subscriptionKey || !event) {
      return res.status(400).json({
        success: false,
        error: 'subscriptionKey e event são obrigatórios'
      });
    }

    await webSocketOptimizer.broadcastToSubscription(subscriptionKey, event, data);

    res.json({
      success: true,
      message: `Broadcast enviado para subscription ${subscriptionKey}`
    });

  } catch (error) {
    logger.error('Erro no broadcast para subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Erro no broadcast'
    });
  }
});

/**
 * POST /api/realtime/cleanup
 * Limpa conexões inativas
 */
router.post('/cleanup', async (req, res) => {
  try {
    const removedCount = await webSocketOptimizer.cleanupInactiveConnections();
    
    res.json({
      success: true,
      message: `${removedCount} conexões inativas foram removidas`
    });

  } catch (error) {
    logger.error('Erro na limpeza de conexões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro na limpeza'
    });
  }
});

/**
 * POST /api/realtime/cache/clear
 * Limpa cache realtime
 */
router.post('/cache/clear', async (req, res) => {
  try {
    await optimizedRealtime.clearRealtimeCache();
    
    res.json({
      success: true,
      message: 'Cache realtime limpo'
    });

  } catch (error) {
    logger.error('Erro ao limpar cache realtime:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache'
    });
  }
});

/**
 * GET /api/realtime/connections
 * Lista conexões ativas
 */
router.get('/connections', async (req, res) => {
  try {
    const stats = webSocketOptimizer.getConnectionStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Erro ao obter conexões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
