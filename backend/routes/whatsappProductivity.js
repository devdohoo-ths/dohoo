import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { WhatsAppProductivityService } from '../services/whatsappProductivityService.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Buscar métricas de um usuário específico
router.get('/metrics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate e endDate são obrigatórios' 
      });
    }
    
    // Verificar se o usuário pertence à organização
    if (userId !== req.user.id && req.user.organization_id !== req.user.organization_id) {
      return res.status(403).json({ 
        error: 'Acesso negado' 
      });
    }
    
    const metrics = await WhatsAppProductivityService.getUserMetrics(
      userId, 
      req.user.organization_id, 
      startDate, 
      endDate
    );
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Buscar métricas do usuário atual
router.get('/my-metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate e endDate são obrigatórios' 
      });
    }
    
    const metrics = await WhatsAppProductivityService.getUserMetrics(
      req.user.id, 
      req.user.organization_id, 
      startDate, 
      endDate
    );
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Erro ao buscar métricas do usuário:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Buscar métricas agregadas de todos os usuários
router.get('/dashboard-widgets', async (req, res) => {
  try {
    const { userId, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`🔍 [Dashboard] Query params - userId: ${userId}, date: ${targetDate}`);
    console.log(`🔍 [Dashboard] User organization: ${req.user.organization_id}`);
    console.log(`🔍 [Dashboard] VERSÃO ATUALIZADA - ${new Date().toISOString()}`);
    
    let metrics;
    
    if (userId) {
      console.log(`📊 Buscando métricas do usuário específico: ${userId}`);
      // Buscar métricas de um usuário específico
      const userMetrics = await WhatsAppProductivityService.getUserMetrics(
        userId, 
        req.user.organization_id, 
        targetDate, 
        targetDate
      );
      
      metrics = userMetrics[0] || null;
      
      // Se não existir métricas para o dia, calcular em tempo real
      if (!metrics) {
        console.log(`📊 Calculando métricas em tempo real para ${userId} em ${targetDate}`);
        metrics = await WhatsAppProductivityService.calculateUserMetrics(
          userId, 
          req.user.organization_id, 
          targetDate
        );
        
        // Salvar métricas calculadas
        await WhatsAppProductivityService.saveUserMetrics(
          userId, 
          req.user.organization_id, 
          targetDate, 
          metrics
        );
      }
    } else {
      console.log(`📊 Buscando métricas agregadas da organização: ${req.user.organization_id}`);
      // Buscar métricas agregadas de todos os usuários da organização
      metrics = await WhatsAppProductivityService.getAggregatedMetrics(
        req.user.organization_id, 
        targetDate
      );
    }
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Erro ao buscar métricas do dashboard:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Buscar métricas de todos os usuários da organização
router.get('/organization-metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate e endDate são obrigatórios' 
      });
    }
    
    // Buscar todos os usuários da organização
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('organization_id', req.user.organization_id);
    
    if (usersError) throw usersError;
    
    // Buscar métricas de todos os usuários
    const allMetrics = await Promise.all(
      users.map(async (user) => {
        const metrics = await WhatsAppProductivityService.getUserMetrics(
          user.id, 
          req.user.organization_id, 
          startDate, 
          endDate
        );
        
        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          metrics: metrics
        };
      })
    );
    
    res.json({
      success: true,
      data: allMetrics
    });
    
  } catch (error) {
    console.error('Erro ao buscar métricas da organização:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Calcular métricas em tempo real
router.post('/calculate-realtime', async (req, res) => {
  try {
    const { userId, date } = req.body;
    const targetUserId = userId || req.user.id;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Verificar se o usuário pertence à organização
    if (targetUserId !== req.user.id && req.user.organization_id !== req.user.organization_id) {
      return res.status(403).json({ 
        error: 'Acesso negado' 
      });
    }
    
    const metrics = await WhatsAppProductivityService.calculateUserMetrics(
      targetUserId, 
      req.user.organization_id, 
      targetDate
    );
    
    // Salvar métricas calculadas
    await WhatsAppProductivityService.saveUserMetrics(
      targetUserId, 
      req.user.organization_id, 
      targetDate, 
      metrics
    );
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Erro ao calcular métricas em tempo real:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Processar métricas diárias (para cron job)
router.post('/process-daily', async (req, res) => {
  try {
    // Verificar se é uma requisição autorizada (pode adicionar validação de token especial)
    await WhatsAppProductivityService.processDailyMetrics();
    
    res.json({
      success: true,
      message: 'Métricas diárias processadas com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao processar métricas diárias:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// Buscar estatísticas resumidas
router.get('/summary', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let startDate, endDate;
    const today = new Date();
    
    switch (period) {
      case '24h':
        startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        endDate = today;
        break;
      case '7d':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = today;
        break;
      case '30d':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = today;
        break;
      default:
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = today;
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const metrics = await WhatsAppProductivityService.getUserMetrics(
      req.user.id, 
      req.user.organization_id, 
      startDateStr, 
      endDateStr
    );
    
    // Calcular resumo
    const summary = {
      totalDays: metrics.length,
      totalUsageTime: metrics.reduce((sum, m) => sum + (m.total_usage_time_minutes || 0), 0),
      totalActiveTime: metrics.reduce((sum, m) => sum + (m.active_time_minutes || 0), 0),
      totalMessages: metrics.reduce((sum, m) => sum + (m.total_messages_sent || 0) + (m.total_messages_received || 0), 0),
      avgProductivity: metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + (m.productivity_score || 0), 0) / metrics.length : 0,
      avgEfficiency: metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + (m.efficiency_score || 0), 0) / metrics.length : 0,
      avgResponseTime: metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + (m.avg_response_time_seconds || 0), 0) / metrics.length : 0,
      period: period
    };
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error('Erro ao buscar resumo das métricas:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

export default router;
