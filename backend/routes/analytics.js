import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { getUnifiedData } from '../services/unifiedDataService.js';

const router = express.Router();

// Rota de teste simples
router.get('/test', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 [Analytics Test] Rota de teste chamada');
    res.json({
      success: true,
      message: 'Rota analytics funcionando!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Analytics Test] Erro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no teste',
      error: error.message
    });
  }
});

// Rota de teste sem autenticação
router.get('/test-no-auth', async (req, res) => {
  try {
    console.log('🧪 [Analytics Test No Auth] Rota de teste sem autenticação chamada');
    res.json({
      success: true,
      message: 'Rota analytics sem autenticação funcionando!',
      query: req.query,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Analytics Test No Auth] Erro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no teste sem autenticação',
      error: error.message
    });
  }
});

// Rota de teste do unifiedDataService
router.get('/test-unified', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 [Analytics Test Unified] Testando unifiedDataService...');
    
    const { user } = req;
    const targetOrganizationId = user.organization_id;
    
    if (!targetOrganizationId) {
      return res.status(400).json({
        success: false,
        message: 'Sem organização definida'
      });
    }

    // Usar datas de hoje
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    console.log('🧪 [Analytics Test Unified] Testando com datas:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      organization: targetOrganizationId
    });

    // Testar o unifiedDataService
    const unifiedData = await getUnifiedData(targetOrganizationId, startDate, endDate, {});
    
    res.json({
      success: true,
      message: 'UnifiedDataService funcionando!',
      data: {
        messages: unifiedData.messages.length,
        conversations: unifiedData.conversations.length,
        users: unifiedData.users.length,
        globalMetrics: unifiedData.metrics.global
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Analytics Test Unified] Erro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no teste unifiedDataService',
      error: error.message
    });
  }
});

// Rota de teste específica para verificar cálculo de averageMessages
router.get('/test-average-messages', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 [Test Average Messages] Iniciando teste...');
    const { dateStart, dateEnd, organization_id } = req.query;
    const { user } = req;

    const targetOrganizationId = organization_id || user.organization_id;

    if (!targetOrganizationId) {
      return res.status(400).json({
        success: false,
        message: 'organization_id é obrigatório'
      });
    }

    let startDate, endDate;
    
    if (dateStart && dateEnd) {
      startDate = new Date(dateStart);
      endDate = new Date(dateEnd);
    } else {
      // Usar período padrão de 7 dias
      endDate = new Date();
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    console.log('🧪 [Test Average Messages] Período:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    const unifiedData = await getUnifiedData(targetOrganizationId, startDate, endDate);
    const { metrics } = unifiedData;

    // Calcular dias de forma detalhada
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const avgMessages = metrics.global.totalMessages > 0 ? 
      Math.round(metrics.global.totalMessages / daysDiff) : 0;

    console.log('🧪 [Test Average Messages] Resultado:', {
      totalMessages: metrics.global.totalMessages,
      daysDiff,
      avgMessages,
      calculation: `${metrics.global.totalMessages} / ${daysDiff} = ${avgMessages}`
    });

    res.json({
      success: true,
      data: {
        totalMessages: metrics.global.totalMessages,
        daysDiff,
        averageMessages: avgMessages,
        calculation: `${metrics.global.totalMessages} / ${daysDiff} = ${avgMessages}`,
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('❌ [Test Average Messages] Erro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no teste',
      error: error.message
    });
  }
});

// Rota principal de analytics com dados UNIFICADOS
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [Analytics] Iniciando requisição com dados unificados...');
    const { dateStart, dateEnd, organization_id, selectedPeriod = '7d' } = req.query;
    const { user } = req;

    console.log('🚨 [Analytics] PARÂMETROS RECEBIDOS:', {
      dateStart,
      dateEnd,
      organization_id,
      selectedPeriod,
      user: user?.id
    });

    console.log('👤 [Analytics] Usuário autenticado:', { 
      userId: user.id, 
      userOrg: user.organization_id,
      queryOrg: organization_id 
    });

    // Usar organization_id do query ou do usuário autenticado
    const targetOrganizationId = organization_id || user.organization_id;

    if (!targetOrganizationId) {
      console.log('❌ [Analytics] Sem organização definida');
      return res.status(400).json({
        success: false,
        message: 'organization_id é obrigatório'
      });
    }

    // Definir período padrão se não fornecido
    let startDate, endDate;
    
    try {
      if (dateStart && dateEnd) {
        startDate = new Date(dateStart);
        endDate = new Date(dateEnd);
        
        console.log('🚨 [Analytics] DATAS CONVERTIDAS:', {
          dateStart,
          dateEnd,
          startDateValid: !isNaN(startDate.getTime()),
          endDateValid: !isNaN(endDate.getTime()),
          startDateISO: startDate.toISOString(),
          endDateISO: endDate.toISOString()
        });
        
        // Validar se as datas são válidas
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Datas inválidas fornecidas');
        }
      } else {
        // Usar período padrão
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        console.log('🚨 [Analytics] USANDO PERÍODO PADRÃO:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      }
    } catch (dateError) {
      console.error('❌ [Analytics] Erro ao processar datas:', dateError);
      return res.status(400).json({
        success: false,
        message: 'Datas inválidas fornecidas',
        error: dateError.message
      });
    }

    console.log('📊 [Analytics] Buscando dados unificados para período:', { 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString(),
      organization: targetOrganizationId,
      selectedPeriod
    });

    // 🎯 USAR FONTE UNIFICADA DE DADOS
    const unifiedData = await getUnifiedData(targetOrganizationId, startDate, endDate, { selectedPeriod });
    
    const { messages, conversations, users, analytics, metrics } = unifiedData;

    console.log('📊 [Analytics] Dados unificados coletados:', {
      messages: messages.length,
      conversations: conversations.length,
      users: users.length,
      analytics: analytics.length,
      globalMetrics: metrics.global
    });

    // 🎯 GERAR RESPOSTA UNIFICADA
    const response = {
      success: true,
      data: {
        // MÉTRICAS GLOBAIS UNIFICADAS
        global: {
          totalMessages: metrics.global.totalMessages,
          sentMessages: metrics.global.sentMessages,
          receivedMessages: metrics.global.receivedMessages,
          productivity: metrics.global.productivity,
          avgResponseTime: metrics.global.avgResponseTime,
          totalUsers: metrics.global.totalUsers,
          totalConversations: metrics.global.totalConversations
        },

        // MÉTRICAS POR USUÁRIO UNIFICADAS
        users: Object.values(metrics.users),

        // PRODUTIVIDADE UNIFICADA
        productivity: {
          periods: metrics.byHour.map(hour => ({
            time: hour.time,
            messages: hour.messages,
            productivity: hour.productivity
          })),
          averageProductivity: metrics.global.productivity,
          averageMessages: (() => {
            // Calcular número de dias no período de forma mais precisa
            // Para 7 dias: de hoje até 7 dias atrás = 7 dias
            // Para hoje: apenas 1 dia
            let daysDiff;
            if (selectedPeriod === 'today') {
              daysDiff = 1;
            } else if (selectedPeriod === '7d') {
              daysDiff = 7;
            } else if (selectedPeriod === 'current_month') {
              // Calcular dias do mês atual
              const now = new Date();
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              daysDiff = daysInMonth;
            } else {
              // Fallback: calcular pela diferença de datas
              daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            }
            
            const avgMessages = metrics.global.totalMessages > 0 ? 
              Math.round(metrics.global.totalMessages / daysDiff) : 0;
            
            console.log('📊 [Analytics] Cálculo averageMessages:', {
              totalMessages: metrics.global.totalMessages,
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              selectedPeriod,
              daysDiff,
              avgMessages,
              formula: `${metrics.global.totalMessages} / ${daysDiff} = ${avgMessages}`
            });
            
            return avgMessages;
          })(),
          maxMessages: Math.max(...metrics.byHour.map(h => h.messages), 0),
          maxProductivity: Math.max(...metrics.byHour.map(h => h.productivity), 0)
        },

        // ANÁLISE TEMPORAL UNIFICADA
        timeAnalysis: {
          hourlyActivity: metrics.byHour.map(hour => ({
            time: hour.time,
            conversations: hour.conversations,
            messages: hour.messages,
            satisfaction: 4.0, // Valor padrão
            responseTime: metrics.global.avgResponseTime
          })),
          peakHour: metrics.byHour.reduce((max, current) => 
            current.messages > max.messages ? current : max
          ),
          dailyTrend: metrics.byDate,
          totalDays: metrics.byDate.length
        },

        // PERFORMANCE UNIFICADA
        performance: {
          agentPerformance: Object.values(metrics.users).map(user => ({
            id: user.id,
            name: user.name,
            conversations: conversations.filter(conv => conv.assigned_agent_id === user.id).length,
            avgSatisfaction: 4.0, // Valor padrão
            avgResponseTime: user.avgResponseTime,
            isOnline: user.isOnline
          })),
          topPerformers: Object.values(metrics.users)
            .sort((a, b) => b.productivity - a.productivity)
            .slice(0, 5),
          needsAttention: Object.values(metrics.users)
            .filter(user => user.productivity < 40)
        },

        // INSIGHTS UNIFICADOS
        insights: {
          topInsights: [
            `Total de ${metrics.global.totalMessages} mensagens processadas`,
            `Produtividade média de ${metrics.global.productivity}%`,
            `Tempo médio de resposta: ${metrics.global.avgResponseTime} minutos`,
            `${metrics.global.totalUsers} usuários ativos`
          ],
          trends: metrics.global.totalMessages > 0 ? 'Positiva' : 'Estável',
          recommendations: [
            'Mantenha o foco na produtividade',
            'Monitore o tempo de resposta',
            'Analise padrões de horário'
          ]
        },

        // FILTROS APLICADOS
        filters: {
          dateStart: startDate.toISOString().split('T')[0],
          dateEnd: endDate.toISOString().split('T')[0],
          selectedPeriod,
          organizationId: targetOrganizationId
        }
      }
    };

    console.log('✅ [Analytics] Resposta unificada gerada:', {
      globalMessages: response.data.global.totalMessages,
      userCount: response.data.users.length,
      productivityPeriods: response.data.productivity.periods.length,
      timeAnalysisHours: response.data.timeAnalysis.hourlyActivity.length
    });

    res.json(response);

  } catch (error) {
    console.error('❌ [Analytics] Erro na rota principal:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

export default router; 