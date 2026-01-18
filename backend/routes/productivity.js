import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { filterBlacklistedMessages } from '../utils/blacklistFilter.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * GET /api/reports/productivity
 * Relatório de produtividade com contatos únicos (ativo e receptivo)
 */
router.get('/productivity', async (req, res) => {
  try {
    logger.info('📊 [PRODUCTIVITY] Relatório de produtividade iniciado');
    
    const { user } = req;
    
    if (!user) {
      logger.error('❌ [PRODUCTIVITY] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!user.organization_id) {
      logger.error('❌ [PRODUCTIVITY] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }

    const { 
      dateStart, 
      dateEnd, 
      selectedUser
    } = req.query;

    // Processar datas
    let processedDateStart, processedDateEnd;
    
    if (dateStart && dateEnd) {
      processedDateStart = new Date(dateStart).toISOString();
      processedDateEnd = new Date(dateEnd).toISOString();
    } else {
      // Fallback para últimos 30 dias
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
      now.setUTCHours(23, 59, 59, 999);
      
      processedDateStart = thirtyDaysAgo.toISOString();
      processedDateEnd = now.toISOString();
    }

    logger.info('📅 [PRODUCTIVITY] Período processado:', {
      processedDateStart,
      processedDateEnd,
      selectedUser
    });

    // 🎯 BUSCAR MENSAGENS COM FILTROS
    let messagesQuery = supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        organization_id,
        is_from_me,
        user_id,
        chats(
          id, 
          name, 
          whatsapp_jid, 
          assigned_agent_id, 
          platform, 
          status, 
          department, 
          priority, 
          created_at, 
          last_message_at
        )
      `)
      .eq('organization_id', user.organization_id)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null);

    // Aplicar filtro por usuário se especificado
    if (selectedUser && selectedUser !== 'all') {
      messagesQuery = messagesQuery.eq('user_id', selectedUser);
    }

    const { data: foundMessages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      logger.error('❌ [PRODUCTIVITY] Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar mensagens'
      });
    }

    // 🎯 APLICAR FILTRO DE BLACKLIST
    logger.info('🚫 [PRODUCTIVITY] Aplicando filtro de blacklist...');
    const filteredMessages = await filterBlacklistedMessages(foundMessages || [], user.organization_id);
    logger.info('🚫 [PRODUCTIVITY] Mensagens após filtro:', filteredMessages.length);

    // 🎯 PROCESSAR DADOS DE PRODUTIVIDADE
    const productivityData = processProductivityData(filteredMessages, processedDateStart, processedDateEnd);

    // 🎯 BUSCAR USUÁRIOS PARA CONTEXTO (mesma lógica do relatório detalhado)
    logger.info('👥 [PRODUCTIVITY] Buscando dados dos usuários via API');
    
    // Buscar usuários diretamente do Supabase
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        organization_id,
        role_id,
        roles(
          id,
          name,
          description
        )
      `)
      .eq('organization_id', user.organization_id);

    if (usersError) {
      logger.error('❌ [PRODUCTIVITY] Erro ao buscar usuários:', usersError);
    }

    logger.info('📊 [PRODUCTIVITY] Dados processados:', {
      totalMessages: filteredMessages.length,
      uniqueContacts: productivityData.uniqueContacts.length,
      activeContacts: productivityData.activeContacts.length,
      reactiveContacts: productivityData.reactiveContacts.length,
      users: users?.length || 0
    });

    res.json({
      success: true,
      data: {
        ...productivityData,
        period: {
          start: processedDateStart,
          end: processedDateEnd
        },
        filters: {
          organization_id: user.organization_id,
          selectedUser: selectedUser || 'all'
        },
        context: {
          users: users || []
        }
      }
    });

  } catch (error) {
    logger.error('❌ [PRODUCTIVITY] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * Função para processar dados de produtividade
 */
function processProductivityData(messages, startDate, endDate) {
  logger.info('🔄 [PRODUCTIVITY] Processando dados de produtividade...');

  // Agrupar mensagens por chat
  const messagesByChat = new Map();
  
  messages.forEach(message => {
    const chatId = message.chat_id;
    if (!messagesByChat.has(chatId)) {
      messagesByChat.set(chatId, []);
    }
    messagesByChat.get(chatId).push(message);
  });

  logger.info('📊 [PRODUCTIVITY] Chats únicos encontrados:', messagesByChat.size);

  const uniqueContacts = [];
  const activeContacts = [];
  const reactiveContacts = [];
  const dailyStats = new Map();

  // Processar cada chat
  messagesByChat.forEach((chatMessages, chatId) => {
    if (chatMessages.length === 0) return;

    const firstMessage = chatMessages[0];
    const chat = firstMessage.chats;
    
    if (!chat) return;

    // Informações básicas do contato
    const contactInfo = {
      chatId: chatId,
      contactName: chat.name || 'Contato sem nome',
      contactPhone: chat.whatsapp_jid || '',
      assignedAgent: chat.assigned_agent_id,
      platform: chat.platform || 'whatsapp',
      status: chat.status || 'active',
      department: chat.department,
      priority: chat.priority,
      firstMessageAt: chat.created_at,
      lastMessageAt: chat.last_message_at,
      totalMessages: chatMessages.length,
      messagesSent: chatMessages.filter(m => m.is_from_me).length,
      messagesReceived: chatMessages.filter(m => !m.is_from_me).length
    };

    // Determinar se é contato ativo ou receptivo
    const hasOutgoingMessages = contactInfo.messagesSent > 0;
    const hasIncomingMessages = contactInfo.messagesReceived > 0;

    if (hasOutgoingMessages) {
      activeContacts.push(contactInfo);
    }

    if (hasIncomingMessages) {
      reactiveContacts.push(contactInfo);
    }

    uniqueContacts.push(contactInfo);

    // Calcular estatísticas diárias
    chatMessages.forEach(message => {
      const messageDate = new Date(message.created_at).toISOString().split('T')[0];
      
      if (!dailyStats.has(messageDate)) {
        dailyStats.set(messageDate, {
          date: messageDate,
          uniqueContacts: new Set(),
          activeContacts: new Set(),
          reactiveContacts: new Set(),
          totalMessages: 0,
          messagesSent: 0,
          messagesReceived: 0
        });
      }

      const dayStats = dailyStats.get(messageDate);
      dayStats.uniqueContacts.add(chatId);
      
      if (hasOutgoingMessages) {
        dayStats.activeContacts.add(chatId);
      }
      
      if (hasIncomingMessages) {
        dayStats.reactiveContacts.add(chatId);
      }

      dayStats.totalMessages++;
      
      if (message.is_from_me) {
        dayStats.messagesSent++;
      } else {
        dayStats.messagesReceived++;
      }
    });
  });

  // Converter Map para Array e calcular totais
  const dailyBreakdown = Array.from(dailyStats.values()).map(day => ({
    date: day.date,
    uniqueContacts: day.uniqueContacts.size,
    activeContacts: day.activeContacts.size,
    reactiveContacts: day.reactiveContacts.size,
    totalMessages: day.totalMessages,
    messagesSent: day.messagesSent,
    messagesReceived: day.messagesReceived
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calcular resumo geral
  const summary = {
    totalUniqueContacts: uniqueContacts.length,
    totalActiveContacts: activeContacts.length,
    totalReactiveContacts: reactiveContacts.length,
    totalMessages: messages.length,
    totalMessagesSent: messages.filter(m => m.is_from_me).length,
    totalMessagesReceived: messages.filter(m => !m.is_from_me).length,
    averageMessagesPerContact: uniqueContacts.length > 0 ? Math.round(messages.length / uniqueContacts.length) : 0,
    period: {
      start: startDate,
      end: endDate,
      days: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
    }
  };

  logger.info('✅ [PRODUCTIVITY] Dados processados com sucesso:', {
    uniqueContacts: summary.totalUniqueContacts,
    activeContacts: summary.totalActiveContacts,
    reactiveContacts: summary.totalReactiveContacts,
    dailyBreakdown: dailyBreakdown.length
  });

  return {
    uniqueContacts,
    activeContacts,
    reactiveContacts,
    dailyBreakdown,
    summary
  };
}

export default router;
