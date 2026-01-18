import { supabase } from '../lib/supabaseClient.js';
import optimizedSupabase from '../utils/optimizedSupabase.js';
import performanceMonitor from '../utils/performanceMonitor.js';
import logger from '../utils/logger.js';

// 🎯 FUNÇÃO AUXILIAR PARA VERIFICAR SE MENSAGEM FOI ENVIADA PELO AGENTE
function isAgentMessage(msg) {
  return msg.is_from_me === true || 
         (msg.sender_name && msg.sender_name.toLowerCase() === 'agent') ||
         (msg.sender_id && msg.sender_id !== null);
}

// 🎯 FONTE ÚNICA DE DADOS - GARANTE CONSISTÊNCIA TOTAL
export async function getUnifiedData(targetOrganizationId, startDate, endDate, filters = {}) {
  logger.database('Buscando dados unificados para:', {
    organization: targetOrganizationId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    filters
  });

  try {
    // Validar parâmetros
    if (!targetOrganizationId) {
      throw new Error('targetOrganizationId é obrigatório');
    }

    if (!startDate || !endDate) {
      throw new Error('startDate e endDate são obrigatórios');
    }

    // Validar se as datas são válidas
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Datas inválidas fornecidas');
    }

    // Garantir que startDate <= endDate
    if (startDate > endDate) {
      throw new Error('startDate deve ser anterior ou igual a endDate');
    }

    // Só corrigir datas se estiverem no futuro
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let adjusted = false;
    if (endDate > today) {
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      adjusted = true;
    }
    if (startDate > today) {
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      adjusted = true;
    }
    if (adjusted) {
      console.log('⚠️ [UnifiedData] Período ajustado para não ultrapassar hoje:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
    } else {
      console.log('✅ [UnifiedData] Usando período enviado pelo frontend:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
    }

    logger.database('Parâmetros validados', {
      organization: targetOrganizationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startDateValid: !isNaN(startDate.getTime()),
      endDateValid: !isNaN(endDate.getTime())
    });

    // 1. BUSCAR CONVERSAS DA ORGANIZAÇÃO PRIMEIRO (OTIMIZADO)
    const { data: conversations, error: conversationsError } = await optimizedSupabase.executeQuery(
      'getChatsWithStatsOptimized',
      async () => {
        return supabase
          .from('chats')
          .select(`
            id,
            name,
            platform,
            status,
            priority,
            department,
            created_at,
            updated_at,
            assigned_agent_id,
            organization_id
          `)
          .eq('organization_id', targetOrganizationId);
      },
      `chats_${targetOrganizationId}`,
      optimizedSupabase.cacheConfig.chats
    );

    if (conversationsError) {
      logger.error('Erro ao buscar conversas:', conversationsError);
      throw conversationsError;
    }

    logger.database('Conversas encontradas', conversations?.length || 0);

    // 2. BUSCAR MENSAGENS DAS CONVERSAS
    let messages = [];
    if (conversations && conversations.length > 0) {
      const chatIds = conversations.map(chat => chat.id);
      
      logger.debug('Buscando mensagens para chats', chatIds.length);
      
      const { data: messagesData, error: messagesError } = await optimizedSupabase.executeQuery(
        'getMessagesOptimized',
        async () => {
          return supabase
            .from('messages')
            .select('*')
            .in('chat_id', chatIds)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: true })
            .limit(500); // Limite otimizado para performance
        },
        `messages_${targetOrganizationId}_${startDate.toISOString()}_${endDate.toISOString()}`,
        optimizedSupabase.cacheConfig.messages
      );

      if (messagesError) {
        logger.error('Erro ao buscar mensagens:', messagesError);
        throw messagesError;
      }

      messages = messagesData || [];
      logger.database('Mensagens encontradas', messages.length);
    }

    // 3. BUSCAR USUÁRIOS (OTIMIZADO COM CACHE)
    const { data: users, error: usersError } = await optimizedSupabase.executeQuery(
      'getUsersOptimized',
      async () => {
        return supabase
          .from('profiles')
          .select(`
            id,
            name,
            email,
            department,
            is_online,
            created_at,
            organization_id
          `)
          .eq('organization_id', targetOrganizationId);
      },
      `users_${targetOrganizationId}`,
      optimizedSupabase.cacheConfig.users
    );

    if (usersError) {
      console.error('❌ [UnifiedData] Erro ao buscar usuários:', usersError);
      throw usersError;
    }

    console.log('📊 [UnifiedData] Usuários encontrados:', users?.length || 0);

    // 4. BUSCAR ANALYTICS (se existir) - OTIMIZADO COM CACHE
    let analytics = [];
    try {
      const { data: analyticsData, error: analyticsError } = await optimizedSupabase.executeQuery(
        'getAnalyticsOptimized',
        async () => {
          return supabase
            .from('conversation_analytics')
            .select('*')
            .eq('organization_id', targetOrganizationId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());
        },
        `analytics_${targetOrganizationId}_${startDate.toISOString()}_${endDate.toISOString()}`,
        optimizedSupabase.cacheConfig.analytics
      );

      if (analyticsError) {
        console.warn('⚠️ [UnifiedData] Analytics não encontrado:', analyticsError);
      } else {
        analytics = analyticsData || [];
      }
    } catch (analyticsError) {
      console.warn('⚠️ [UnifiedData] Erro ao buscar analytics (ignorando):', analyticsError);
    }

    console.log('📊 [UnifiedData] Analytics encontrados:', analytics.length);

    // 5. CALCULAR MÉTRICAS UNIFICADAS
    const unifiedMetrics = calculateUnifiedMetrics(messages || [], conversations, users || [], analytics, startDate, endDate);

    console.log('✅ [UnifiedData] Dados unificados coletados:', {
      messages: messages?.length || 0,
      conversations: conversations?.length || 0,
      users: users?.length || 0,
      analytics: analytics.length,
      metrics: unifiedMetrics
    });

    return {
      messages: messages || [],
      conversations: conversations || [],
      users: users || [],
      analytics: analytics,
      metrics: unifiedMetrics
    };

  } catch (error) {
    console.error('❌ [UnifiedData] Erro na busca unificada:', error);
    throw error;
  }
}

// 🎯 CÁLCULO DE MÉTRICAS UNIFICADAS
function calculateUnifiedMetrics(messages, conversations, users, analytics, startDate, endDate) {
  console.log('🎯 [UnifiedMetrics] Calculando métricas unificadas...');

  try {
    // Validar parâmetros
    if (!Array.isArray(messages)) messages = [];
    if (!Array.isArray(conversations)) conversations = [];
    if (!Array.isArray(users)) users = [];
    if (!Array.isArray(analytics)) analytics = [];

    console.log('🎯 [UnifiedMetrics] Parâmetros validados:', {
      messagesCount: messages.length,
      conversationsCount: conversations.length,
      usersCount: users.length,
      analyticsCount: analytics.length,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    });

    // MÉTRICAS GERAIS
    const totalMessages = messages.length;
    const sentMessages = messages.filter(msg => isAgentMessage(msg)).length;
    const receivedMessages = totalMessages - sentMessages;
    
    // MÉTRICAS POR USUÁRIO
    const userMetrics = {};
    users.forEach(user => {
      try {
        // Buscar conversas atribuídas ao usuário
        const userConversations = conversations.filter(conv => conv.assigned_agent_id === user.id) || [];
        const userChatIds = userConversations.map(conv => conv.id);
        
        // Buscar mensagens das conversas do usuário
        const userMessages = messages.filter(msg => userChatIds.includes(msg.chat_id)) || [];
        const userSent = userMessages.filter(msg => isAgentMessage(msg)).length;
        const userReceived = userMessages.length - userSent;
        
        console.log(`👤 [UnifiedMetrics] Processando usuário ${user.name}:`, {
          conversations: userConversations.length,
          messages: userMessages.length,
          sent: userSent,
          received: userReceived
        });
        
        // Calcular tempo médio de resposta
        let avgResponseTime = 0;
        if (userMessages.length > 1) {
          const sortedMessages = userMessages.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          const responseTimes = [];
          for (let i = 0; i < sortedMessages.length - 1; i++) {
            const current = sortedMessages[i];
            const next = sortedMessages[i + 1];
            
            const isCurrentAgent = isAgentMessage(current);
            const isNextAgent = isAgentMessage(next);
            
            if (!isCurrentAgent && isNextAgent) {
              const responseTime = (new Date(next.created_at).getTime() - new Date(current.created_at).getTime()) / (1000 * 60);
              responseTimes.push(responseTime);
            }
          }
          
          if (responseTimes.length > 0) {
            avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
          }
        }
        
        // Calcular produtividade
        let productivity = 0;
        if (userMessages.length > 0) {
          const responseRate = userSent / userMessages.length;
          const resolvedConversations = userConversations.filter(conv => conv.status === 'finished').length;
          const resolutionRate = userConversations.length > 0 ? resolvedConversations / userConversations.length : 0;
          
          productivity = Math.round((responseRate * 60 + resolutionRate * 40) * 100);
        }
        
        // Incluir todos os usuários, mesmo sem atividade
        userMetrics[user.id] = {
          id: user.id,
          name: user.name || user.email?.split('@')[0] || 'Usuário',
          email: user.email,
          department: user.department || 'Sem departamento',
          totalMessages: userMessages.length,
          sentMessages: userSent,
          receivedMessages: userReceived,
          avgResponseTime: Math.round(avgResponseTime),
          productivity: Math.max(0, Math.min(100, productivity)),
          isOnline: user.is_online
        };
        
        console.log(`✅ [UnifiedMetrics] Usuário ${user.name} incluído com ${userMessages.length} mensagens`);
      } catch (userError) {
        console.error('❌ [UnifiedMetrics] Erro ao processar usuário:', user.id, userError);
        // Continuar com próximo usuário
      }
    });

    // MÉTRICAS GLOBAIS
    const globalProductivity = totalMessages > 0 ? 
      Math.round((sentMessages / totalMessages) * 100) : 0;
    
    const globalAvgResponseTime = users.length > 0 ? 
      Object.values(userMetrics).reduce((sum, user) => sum + user.avgResponseTime, 0) / users.length : 0;

    // Calcular métricas por hora e dia
    const hourlyMetrics = calculateHourlyMetrics(messages);
    const dailyMetrics = calculateDailyMetrics(messages, startDate, endDate);

    const metrics = {
      global: {
        totalMessages,
        sentMessages,
        receivedMessages,
        productivity: globalProductivity,
        avgResponseTime: Math.round(globalAvgResponseTime),
        totalUsers: users.length,
        totalConversations: conversations.length
      },
      users: userMetrics,
      byHour: hourlyMetrics,
      byDate: dailyMetrics
    };

    console.log('✅ [UnifiedMetrics] Métricas calculadas:', {
      global: metrics.global,
      userCount: Object.keys(metrics.users).length,
      hourlyPeriods: metrics.byHour.length,
      dailyPeriods: metrics.byDate.length
    });

    return metrics;

  } catch (error) {
    console.error('❌ [UnifiedMetrics] Erro ao calcular métricas:', error);
    
    // Retornar métricas vazias em caso de erro
    return {
      global: {
        totalMessages: 0,
        sentMessages: 0,
        receivedMessages: 0,
        productivity: 0,
        avgResponseTime: 0,
        totalUsers: 0,
        totalConversations: 0
      },
      users: {},
      byHour: Array.from({ length: 24 }, (_, hour) => ({
        time: `${hour.toString().padStart(2, '0')}:00`,
        messages: 0,
        productivity: 0,
        conversations: 0
      })),
      byDate: []
    };
  }
}

// 🎯 MÉTRICAS POR HORA
function calculateHourlyMetrics(messages) {
  try {
    if (!Array.isArray(messages)) messages = [];

    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      time: `${hour.toString().padStart(2, '0')}:00`,
      messages: 0,
      productivity: 0,
      conversations: 0
    }));

    messages.forEach(msg => {
      try {
        const hour = new Date(msg.created_at).getHours();
        if (hour >= 0 && hour < 24) {
          hourlyData[hour].messages++;
        }
      } catch (msgError) {
        console.warn('⚠️ [HourlyMetrics] Erro ao processar mensagem:', msgError);
      }
    });

    // Calcular produtividade por hora
    hourlyData.forEach((hourData, hour) => {
      try {
        const hourMessages = messages.filter(msg => {
          try {
            return new Date(msg.created_at).getHours() === hour;
          } catch (error) {
            return false;
          }
        }) || [];
        
        if (hourMessages.length > 0) {
          const sentInHour = hourMessages.filter(msg => isAgentMessage(msg)).length;
          hourData.productivity = Math.round((sentInHour / hourMessages.length) * 100);
        }
      } catch (hourError) {
        console.warn('⚠️ [HourlyMetrics] Erro ao calcular produtividade da hora:', hour, hourError);
      }
    });

    return hourlyData;
  } catch (error) {
    console.error('❌ [HourlyMetrics] Erro ao calcular métricas por hora:', error);
    return Array.from({ length: 24 }, (_, hour) => ({
      time: `${hour.toString().padStart(2, '0')}:00`,
      messages: 0,
      productivity: 0,
      conversations: 0
    }));
  }
}

// 🎯 MÉTRICAS POR DIA
function calculateDailyMetrics(messages, startDate, endDate) {
  try {
    if (!Array.isArray(messages)) messages = [];
    if (!startDate || !endDate) return [];

    const dailyData = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      try {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayMessages = messages.filter(msg => {
          try {
            return msg.created_at && msg.created_at.startsWith(dateStr);
          } catch (error) {
            return false;
          }
        }) || [];
        
        const sentInDay = dayMessages.filter(msg => isAgentMessage(msg)).length;
        const productivity = dayMessages.length > 0 ? Math.round((sentInDay / dayMessages.length) * 100) : 0;
        
        dailyData.push({
          date: dateStr,
          messages: dayMessages.length,
          productivity
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      } catch (dayError) {
        console.warn('⚠️ [DailyMetrics] Erro ao processar dia:', currentDate, dayError);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return dailyData;
  } catch (error) {
    console.error('❌ [DailyMetrics] Erro ao calcular métricas por dia:', error);
    return [];
  }
} 