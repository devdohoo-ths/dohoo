import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Rota de teste
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rankings API funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Função auxiliar para calcular período de datas
const getDateRange = (period) => {
  const now = new Date();
  const start = new Date();
  
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    case 'week':
      start.setDate(now.getDate() - 7);
      return { start, end: now };
    case 'month':
      start.setMonth(now.getMonth() - 1);
      return { start, end: now };
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      return { start, end: now };
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      return { start, end: now };
    default:
      start.setDate(now.getDate() - 7);
      return { start, end: now };
  }
};

// Função auxiliar para formatar ranking
const formatRankingData = (type, entries, period, organizationId) => {
  const titles = {
    messages_sent: 'Top Respondentes',
    response_speed: 'Ranking de Velocidade',
    engagement_balance: 'Ranking por Equilíbrio',
    consistency: 'Ranking de Consistência',
    evolution: 'Ranking de Evolução',
    total_activity: 'Atividade Total'
  };

  const descriptions = {
    messages_sent: 'Quem mais enviou mensagens úteis',
    response_speed: 'Quem responde mais rápido em média',
    engagement_balance: 'Melhor equilíbrio entre enviadas e recebidas',
    consistency: 'Usuários com atividade constante',
    evolution: 'Quem mais cresceu no período',
    total_activity: 'Maior atividade geral'
  };

  return {
    id: `${type}_${period}_${organizationId}`,
    title: titles[type] || 'Ranking',
    description: descriptions[type] || 'Ranking de usuários',
    type,
    period,
    entries: entries.map((entry, index) => ({
      user: {
        id: entry.user_id,
        name: entry.name || entry.email?.split('@')[0] || 'Usuário Anônimo',
        email: entry.email,
        avatar_url: entry.avatar_url,
        role_name: entry.role_name,
        department: entry.department,
        team: entry.team
      },
      position: index + 1,
      score: entry.score || 0,
      metric: entry.metric || 0,
      change: entry.change || 0,
      trend: entry.change > 0 ? 'up' : entry.change < 0 ? 'down' : 'stable',
      badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'none'
    })),
    totalUsers: entries.length,
    lastUpdated: new Date().toISOString(),
    metadata: {
      averageScore: entries.length > 0 ? entries.reduce((sum, e) => sum + (e.score || 0), 0) / entries.length : 0,
      topScore: entries.length > 0 ? Math.max(...entries.map(e => e.score || 0)) : 0,
      participationRate: entries.length > 0 ? 100 : 0
    }
  };
};

// GET /api/rankings - Buscar ranking específico
router.get('/', async (req, res) => {
  try {
    console.log('🏆 [Rankings] Requisição recebida:', {
      query: req.query,
      user: req.user ? { id: req.user.id, organization_id: req.user.organization_id } : 'No user'
    });

    const { type, period, organization_id, department, team, role, start_date, end_date } = req.query;
    
    if (!type || !period) {
      console.log('❌ [Rankings] Parâmetros obrigatórios ausentes:', { type, period });
      return res.status(400).json({
        success: false,
        error: 'Parâmetros type e period são obrigatórios'
      });
    }

    const organizationId = organization_id || req.user?.organization_id;
    if (!organizationId) {
      console.log('❌ [Rankings] Organization ID ausente:', { organization_id, user_org: req.user?.organization_id });
      return res.status(400).json({
        success: false,
        error: 'ID da organização é obrigatório'
      });
    }

    // Determinar período de datas
    let dateRange;
    if (start_date && end_date) {
      dateRange = {
        start: new Date(start_date),
        end: new Date(end_date)
      };
    } else {
      dateRange = getDateRange(period);
    }

    console.log(`🏆 Buscando ranking ${type} para período ${period}`, {
      organizationId,
      dateRange,
      filters: { department, team, role }
    });

    // Processar datas igual ao dashboard
    let processedDateStart, processedDateEnd;
    
    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      // Início do dia (00:00:00.000)
      startDate.setUTCHours(0, 0, 0, 0);
      processedDateStart = startDate.toISOString();
      
      // Fim do dia (23:59:59.999)
      endDate.setUTCHours(23, 59, 59, 999);
      processedDateEnd = endDate.toISOString();
    } else {
      // Usar dateRange calculado
      processedDateStart = dateRange.start.toISOString();
      processedDateEnd = dateRange.end.toISOString();
    }

    console.log('📅 [Rankings] Datas processadas:', {
      processedDateStart,
      processedDateEnd
    });

    // Buscar mensagens igual ao dashboard
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        organization_id,
        is_from_me,
        chats(id, name, whatsapp_jid, assigned_agent_id, platform, status, department, priority, created_at, last_message_at)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null)

    if (messagesError) {
      console.error('❌ [Rankings] Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do ranking'
      });
    }

    console.log('📊 [Rankings] Mensagens encontradas:', messages?.length || 0);

    // Buscar usuários da organização igual ao dashboard
    const { data: agentsData, error: agentsError } = await supabase
      .from('profiles')
      .select(`
        id, 
        name, 
        email, 
        department, 
        is_online, 
        role_id,
        roles (
          id,
          name
        ),
        created_at, 
        updated_at
      `)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (agentsError) {
      console.error('❌ [Rankings] Erro ao buscar agentes:', agentsError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do ranking'
      });
    }

    console.log('👥 [Rankings] Agentes encontrados:', agentsData?.length || 0);

    // Filtrar usuários reais igual ao dashboard
    const realUsers = agentsData?.filter(agent => {
      const isRealUser = !agent.name?.toLowerCase().includes('exemplo') && 
                        !agent.name?.toLowerCase().includes('test') &&
                        !agent.name?.toLowerCase().includes('demo') &&
                        !agent.email?.toLowerCase().includes('exemplo') &&
                        !agent.email?.toLowerCase().includes('test') &&
                        !agent.email?.toLowerCase().includes('demo');
      
      if (!isRealUser) {
        console.log(`🚫 [Rankings] Removendo usuário de teste/demo: ${agent.name} (${agent.email})`);
      }
      
      return isRealUser;
    }) || [];

    console.log(`📊 [Rankings] Usuários reais após filtro: ${realUsers.length}`);

    // Processar dados baseado no tipo de ranking
    let rankingEntries = [];

    if (messages && messages.length > 0 && realUsers.length > 0) {
      switch (type) {
        case 'messages_sent':
          rankingEntries = await calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd);
          break;
        case 'response_speed':
          rankingEntries = await calculateResponseSpeedRanking(messages, realUsers, processedDateStart, processedDateEnd);
          break;
        case 'engagement_balance':
          rankingEntries = await calculateEngagementBalanceRanking(messages, realUsers, processedDateStart, processedDateEnd);
          break;
        case 'consistency':
          rankingEntries = await calculateConsistencyRanking(messages, realUsers, processedDateStart, processedDateEnd);
          break;
        case 'evolution':
          rankingEntries = await calculateEvolutionRanking(messages, realUsers, processedDateStart, processedDateEnd, period);
          break;
        case 'total_activity':
          rankingEntries = await calculateTotalActivityRanking(messages, realUsers, processedDateStart, processedDateEnd);
          break;
        default:
          rankingEntries = await calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd);
      }
    } else {
      console.log('⚠️ [Rankings] Nenhuma mensagem ou usuário encontrado');
      rankingEntries = [];
    }

    const rankingData = formatRankingData(type, rankingEntries, period, organizationId);

    console.log('✅ [Rankings] Ranking gerado com sucesso:', {
      type,
      entriesCount: rankingEntries.length,
      totalUsers: rankingData.totalUsers
    });

    res.json({
      success: true,
      data: rankingData
    });

  } catch (error) {
    console.error('❌ Erro no endpoint de ranking:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/rankings/multiple - Buscar múltiplos rankings
router.get('/multiple', async (req, res) => {
  try {
    console.log('🏆 [Rankings Multiple] Requisição recebida:', {
      query: req.query,
      user: req.user ? { id: req.user.id, organization_id: req.user.organization_id } : 'No user'
    });

    const { types, period, organization_id, department, team, role, start_date, end_date } = req.query;
    
    if (!types) {
      console.log('❌ [Rankings Multiple] Parâmetro types ausente');
      return res.status(400).json({
        success: false,
        error: 'Parâmetro types é obrigatório'
      });
    }

    const typeList = types.split(',');
    const organizationId = organization_id || req.user.organization_id;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'ID da organização é obrigatório'
      });
    }

    // Determinar período de datas
    let dateRange;
    if (start_date && end_date) {
      dateRange = {
        start: new Date(start_date),
        end: new Date(end_date)
      };
    } else {
      dateRange = getDateRange(period);
    }

    console.log(`🏆 Buscando múltiplos rankings: ${typeList.join(', ')}`);

    // Processar datas igual ao dashboard
    let processedDateStart, processedDateEnd;
    
    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      // Início do dia (00:00:00.000)
      startDate.setUTCHours(0, 0, 0, 0);
      processedDateStart = startDate.toISOString();
      
      // Fim do dia (23:59:59.999)
      endDate.setUTCHours(23, 59, 59, 999);
      processedDateEnd = endDate.toISOString();
    } else {
      // Usar dateRange calculado
      processedDateStart = dateRange.start.toISOString();
      processedDateEnd = dateRange.end.toISOString();
    }

    // Buscar mensagens igual ao dashboard
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        organization_id,
        is_from_me,
        chats(id, name, whatsapp_jid, assigned_agent_id, platform, status, department, priority, created_at, last_message_at)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null)

    if (messagesError) {
      console.error('❌ [Rankings Multiple] Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do ranking'
      });
    }

    // Buscar usuários da organização igual ao dashboard
    const { data: agentsData, error: agentsError } = await supabase
      .from('profiles')
      .select(`
        id, 
        name, 
        email, 
        department, 
        is_online, 
        role_id,
        roles (
          id,
          name
        ),
        created_at, 
        updated_at
      `)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (agentsError) {
      console.error('❌ [Rankings Multiple] Erro ao buscar agentes:', agentsError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do ranking'
      });
    }

    // Filtrar usuários reais igual ao dashboard
    const realUsers = agentsData?.filter(agent => {
      const isRealUser = !agent.name?.toLowerCase().includes('exemplo') && 
                        !agent.name?.toLowerCase().includes('test') &&
                        !agent.name?.toLowerCase().includes('demo') &&
                        !agent.email?.toLowerCase().includes('exemplo') &&
                        !agent.email?.toLowerCase().includes('test') &&
                        !agent.email?.toLowerCase().includes('demo');
      
      return isRealUser;
    }) || [];

    // Calcular cada tipo de ranking
    const rankings = [];
    for (const type of typeList) {
      let rankingEntries = [];

      if (messages && messages.length > 0 && realUsers.length > 0) {
        switch (type) {
          case 'messages_sent':
            rankingEntries = await calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd);
            break;
          case 'response_speed':
            rankingEntries = await calculateResponseSpeedRanking(messages, realUsers, processedDateStart, processedDateEnd);
            break;
          case 'engagement_balance':
            rankingEntries = await calculateEngagementBalanceRanking(messages, realUsers, processedDateStart, processedDateEnd);
            break;
          case 'consistency':
            rankingEntries = await calculateConsistencyRanking(messages, realUsers, processedDateStart, processedDateEnd);
            break;
          case 'evolution':
            rankingEntries = await calculateEvolutionRanking(messages, realUsers, processedDateStart, processedDateEnd, period);
            break;
          default:
            rankingEntries = await calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd);
        }
      } else {
        console.log(`⚠️ [Rankings Multiple] Nenhuma mensagem ou usuário encontrado para ${type}`);
        rankingEntries = [];
      }

      rankings.push(formatRankingData(type, rankingEntries, period, organizationId));
    }

    res.json({
      success: true,
      rankings
    });

  } catch (error) {
    console.error('❌ Erro no endpoint de múltiplos rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/rankings/leaderboards - Buscar leaderboards disponíveis
router.get('/leaderboards', async (req, res) => {
  try {
    const { organization_id } = req.query;
    const organizationId = organization_id || req.user.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'ID da organização é obrigatório'
      });
    }

    const leaderboards = [
      {
        id: 'main_leaderboard',
        name: 'Hall da Fama',
        description: 'Rankings principais da organização',
        icon: 'trophy',
        rankings: [],
        isActive: true,
        sortOrder: 1
      }
    ];

    res.json({
      success: true,
      leaderboards
    });

  } catch (error) {
    console.error('❌ Erro no endpoint de leaderboards:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/rankings/user-profile - Buscar perfil de ranking do usuário
router.get('/user-profile', async (req, res) => {
  try {
    const { user_id, organization_id } = req.query;
    const userId = user_id || req.user.id;
    const organizationId = organization_id || req.user.organization_id;

    if (!userId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário e organização são obrigatórios'
      });
    }

    // Buscar dados do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (profileError) {
      console.error('❌ Erro ao buscar perfil:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar perfil do usuário'
      });
    }

    // Calcular estatísticas do usuário
    const userProfile = {
      userId,
      overallRank: 1, // TODO: Calcular ranking geral
      achievements: [], // TODO: Implementar sistema de conquistas
      stats: {
        totalScore: 0,
        averageRank: 0,
        bestRank: 1,
        participationDays: 0,
        streak: 0
      },
      rankings: {
        messages_sent: {
          currentRank: 1,
          bestRank: 1,
          score: 0,
          trend: 'stable'
        },
        response_speed: {
          currentRank: 1,
          bestRank: 1,
          score: 0,
          trend: 'stable'
        },
        engagement_balance: {
          currentRank: 1,
          bestRank: 1,
          score: 0,
          trend: 'stable'
        },
        consistency: {
          currentRank: 1,
          bestRank: 1,
          score: 0,
          trend: 'stable'
        },
        evolution: {
          currentRank: 1,
          bestRank: 1,
          score: 0,
          trend: 'stable'
        }
      }
    };

    res.json({
      success: true,
      profile: userProfile
    });

  } catch (error) {
    console.error('❌ Erro no endpoint de perfil do usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/rankings/stats - Buscar estatísticas gerais
router.get('/stats', async (req, res) => {
  try {
    const { organization_id, period } = req.query;
    const organizationId = organization_id || req.user.organization_id;
    const periodValue = period || 'week';

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'ID da organização é obrigatório'
      });
    }

    const dateRange = getDateRange(periodValue);

    // Buscar estatísticas básicas
    const { data: messages, error } = await supabase
      .from('messages')
      .select('sender_id, created_at, is_from_me')
      .eq('organization_id', organizationId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    if (error) {
      console.error('❌ Erro ao buscar mensagens para stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar estatísticas'
      });
    }

    // Calcular estatísticas
    const totalMessages = messages.length;
    const sentMessages = messages.filter(m => m.is_from_me).length;
    const receivedMessages = messages.filter(m => !m.is_from_me).length;
    const uniqueUsers = new Set(messages.map(m => m.sender_id)).size;

    // Buscar total de usuários da organização
    const { data: allUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId);

    const totalUsers = allUsers?.length || 0;
    const activeUsers = uniqueUsers;
    const engagementRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    const stats = {
      totalMessages,
      averageResponseTime: 0, // TODO: Calcular tempo médio de resposta
      totalUsers,
      activeUsers,
      engagementRate,
      consistencyScore: 0 // TODO: Calcular score de consistência
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Erro no endpoint de estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Funções auxiliares para calcular diferentes tipos de ranking

async function calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd) {
  const userStats = new Map();

  // Inicializar todos os usuários reais
  realUsers.forEach(user => {
    userStats.set(user.id, {
      user_id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      role_name: user.roles?.name || 'Agente',
      department: user.department,
      team: user.team || 'Geral',
      score: 0,
      metric: 0
    });
  });

  // Contar mensagens enviadas por usuário
  messages.forEach(message => {
    if (message.is_from_me && message.chats?.assigned_agent_id) {
      const userId = message.chats.assigned_agent_id;
      
      if (userStats.has(userId)) {
        const stats = userStats.get(userId);
        stats.score += 1;
        stats.metric += 1;
      }
    }
  });

  return Array.from(userStats.values())
    .filter(user => user.score > 0) // Apenas usuários com mensagens
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // Top 50
}

async function calculateResponseSpeedRanking(messages, realUsers, processedDateStart, processedDateEnd) {
  // TODO: Implementar cálculo de velocidade de resposta
  // Por enquanto, retorna ranking baseado em mensagens enviadas
  return await calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd);
}

async function calculateEngagementBalanceRanking(messages, realUsers, processedDateStart, processedDateEnd) {
  const userStats = new Map();

  // Inicializar todos os usuários reais
  realUsers.forEach(user => {
    userStats.set(user.id, {
      user_id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      role_name: user.roles?.name || 'Agente',
      department: user.department,
      team: user.team || 'Geral',
      sent: 0,
      received: 0,
      score: 0,
      metric: 0
    });
  });

  // Contar mensagens enviadas e recebidas por usuário
  messages.forEach(message => {
    if (message.chats?.assigned_agent_id) {
      const userId = message.chats.assigned_agent_id;
      
      if (userStats.has(userId)) {
        const stats = userStats.get(userId);
        if (message.is_from_me) {
          stats.sent += 1;
        } else {
          stats.received += 1;
        }
      }
    }
  });

  // Calcular score de equilíbrio
  userStats.forEach(stats => {
    const total = stats.sent + stats.received;
    if (total > 0) {
      const balance = Math.min(stats.sent, stats.received) / Math.max(stats.sent, stats.received);
      stats.score = balance * total; // Score baseado no equilíbrio e volume
      stats.metric = balance;
    }
  });

  return Array.from(userStats.values())
    .filter(stats => stats.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

async function calculateConsistencyRanking(messages, realUsers, processedDateStart, processedDateEnd) {
  // TODO: Implementar cálculo de consistência
  // Por enquanto, retorna ranking baseado em mensagens enviadas
  return await calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd);
}

async function calculateEvolutionRanking(messages, realUsers, processedDateStart, processedDateEnd, period) {
  // TODO: Implementar cálculo de evolução comparando com período anterior
  // Por enquanto, retorna ranking baseado em mensagens enviadas
  return await calculateMessagesSentRanking(messages, realUsers, processedDateStart, processedDateEnd);
}

async function calculateTotalActivityRanking(messages, realUsers, processedDateStart, processedDateEnd) {
  const userStats = new Map();
  
  // Inicializar stats para todos os usuários
  realUsers.forEach(user => {
    userStats.set(user.id, {
      user_id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      role_name: user.role_name,
      department: user.department,
      team: user.team,
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      score: 0
    });
  });

  // Processar mensagens
  messages.forEach(message => {
    const stats = userStats.get(message.sender_id);
    if (stats) {
      stats.totalMessages++;
      if (message.is_from_me) {
        stats.sentMessages++;
      } else {
        stats.receivedMessages++;
      }
    }
  });

  // Calcular score baseado na atividade total (mensagens enviadas + recebidas)
  userStats.forEach(stats => {
    // Score = mensagens enviadas * 2 + mensagens recebidas * 1
    stats.score = (stats.sentMessages * 2) + (stats.receivedMessages * 1);
    stats.metric = stats.totalMessages;
  });

  return Array.from(userStats.values())
    .filter(stats => stats.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

export default router;
