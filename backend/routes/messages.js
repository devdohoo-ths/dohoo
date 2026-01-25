import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authenticateToken as auth } from '../middleware/auth.js';
import { getUnifiedData } from '../services/unifiedDataService.js';
import { supabaseAdmin } from '../lib/supabaseClient.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GET /api/messages/test - Rota de teste
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Rota de mensagens funcionando!',
    timestamp: new Date().toISOString()
  });
});

// GET /api/messages/stats-test - Rota de teste sem autenticação
router.get('/stats-test', (req, res) => {
  console.log('📊 [API] Rota /api/messages/stats-test chamada');
  res.json({ 
    success: true, 
    message: 'Rota stats-test funcionando sem autenticação!',
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

// GET /api/messages - Buscar mensagens com filtros
router.get('/', auth, async (req, res) => {
  try {
    console.log('🔍 [API] GET /api/messages chamado');
    const { user } = req;
    
    if (!user || !user.organization_id) {
      console.log('❌ [API] Usuário não autenticado ou sem organização');
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const { 
      organization_id,
      dateStart, 
      dateEnd, 
      limit: limitParam,
      keyword,
      agents, // Filtro por agentes (user_id)
      chat_id // ✅ NOVO: Filtro por chat_id específico (CRÍTICO PARA SEGURANÇA)
    } = req.query;

    // ✅ Limitar o máximo de resultados para evitar problemas de performance
    const maxLimit = 10000; // Limite máximo seguro
    const limit = Math.min(parseInt(limitParam) || 1000, maxLimit);

    console.log('🔍 [API] Parâmetros recebidos:', { organization_id, dateStart, dateEnd, limit, keyword, agents, chat_id });

    // ✅ Usar organization_id do parâmetro ou do usuário
    const targetOrganizationId = organization_id || user.organization_id;
    console.log('🔍 [API] Organization ID alvo:', targetOrganizationId);
    
    if (!targetOrganizationId) {
      console.error('❌ [API] Organization ID não encontrado');
      return res.status(400).json({ 
        success: false, 
        error: 'Organization ID é obrigatório' 
      });
    }

    // ✅ Verificar role do usuário para filtrar dados se for agente
    let isAgent = false;
    
    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', user.id)
        .single();

      if (!profileError && userProfile?.role_id) {
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('name')
          .eq('id', userProfile.role_id)
          .single();

        if (!roleError && role?.name) {
          isAgent = role.name.toLowerCase().includes('agente') || role.name.toLowerCase().includes('agent');
        }
      }
    } catch (error) {
      // Erro silencioso
    }

    // ✅ Construir query base (simplificada inicialmente para evitar problemas com relacionamentos)
    // ✅ CORREÇÃO: Usar supabaseAdmin para garantir acesso completo
    let messagesQuery = supabaseAdmin
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        is_from_me,
        created_at,
        sender_name,
        organization_id
      `)
      .eq('organization_id', targetOrganizationId);

    // ✅ Aplicar filtro de data se fornecido
    if (dateStart) {
      try {
        const startDate = new Date(dateStart);
        if (isNaN(startDate.getTime())) {
          console.warn('⚠️ [API] Data de início inválida:', dateStart);
        } else {
          startDate.setUTCHours(0, 0, 0, 0);
          messagesQuery = messagesQuery.gte('created_at', startDate.toISOString());
          console.log('🔍 [API] Filtro de data início aplicado:', startDate.toISOString());
        }
      } catch (dateError) {
        console.warn('⚠️ [API] Erro ao processar data de início:', dateError);
      }
    }

    if (dateEnd) {
      try {
        const endDate = new Date(dateEnd);
        if (isNaN(endDate.getTime())) {
          console.warn('⚠️ [API] Data de fim inválida:', dateEnd);
        } else {
          endDate.setUTCHours(23, 59, 59, 999);
          messagesQuery = messagesQuery.lte('created_at', endDate.toISOString());
          console.log('🔍 [API] Filtro de data fim aplicado:', endDate.toISOString());
        }
      } catch (dateError) {
        console.warn('⚠️ [API] Erro ao processar data de fim:', dateError);
      }
    }

    // ✅ CRÍTICO: Filtro por chat_id específico (SEGURANÇA - deve ser aplicado primeiro)
    if (chat_id) {
      console.log('🔒 [API] Filtrando mensagens por chat_id específico:', chat_id);
      // ✅ VALIDAÇÃO DE SEGURANÇA: Verificar se o chat pertence à organização do usuário
      const { data: chatValidation, error: chatValidationError } = await supabaseAdmin
        .from('chats')
        .select('id, organization_id, assigned_agent_id')
        .eq('id', chat_id)
        .eq('organization_id', targetOrganizationId)
        .single();
      
      if (chatValidationError || !chatValidation) {
        console.error('🚨 [API] Tentativa de acessar chat de outra organização bloqueada:', {
          chat_id,
          user_organization: targetOrganizationId,
          error: chatValidationError?.message
        });
        return res.status(403).json({ 
          success: false, 
          error: 'Chat não encontrado ou acesso negado' 
        });
      }
      
      // ✅ APLICAR FILTRO: Apenas mensagens deste chat específico
      messagesQuery = messagesQuery.eq('chat_id', chat_id);
      console.log('✅ [API] Filtro por chat_id aplicado com sucesso');
    }

    // ✅ Filtro por keyword (busca no conteúdo)
    if (keyword && keyword.trim()) {
      messagesQuery = messagesQuery.ilike('content', `%${keyword.trim()}%`);
    }

    // ✅ Determinar chatIds para filtro (se necessário) - APENAS SE NÃO HOUVER chat_id específico
    let chatIds = null;
    
    // ✅ Filtro por agente: Se for agente, filtrar mensagens de conversas atribuídas a ele
    // ⚠️ IMPORTANTE: Não aplicar se já foi filtrado por chat_id específico
    if (isAgent && !chat_id) {
      const { data: agentChats, error: chatsError } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('organization_id', targetOrganizationId)
        .eq('assigned_agent_id', user.id);
      
      if (!chatsError && agentChats && agentChats.length > 0) {
        chatIds = agentChats.map(c => c.id);
        messagesQuery = messagesQuery.in('chat_id', chatIds);
      } else {
        // Se não tem conversas, retornar array vazio
        return res.json({ success: true, messages: [], total: 0 });
      }
    }

    // ✅ Filtro por agentes específicos (se fornecido) - APENAS SE NÃO HOUVER chat_id específico
    if (agents && agents.trim() && !chat_id) {
      const agentIds = agents.split(',').map(id => id.trim());
      const { data: agentChats, error: chatsError } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('organization_id', targetOrganizationId)
        .in('assigned_agent_id', agentIds);
      
      if (!chatsError && agentChats && agentChats.length > 0) {
        chatIds = agentChats.map(c => c.id);
        messagesQuery = messagesQuery.in('chat_id', chatIds);
      } else {
        // Se não tem conversas para esses agentes, retornar array vazio
        return res.json({ success: true, messages: [], total: 0 });
      }
    }

    // ✅ Aplicar ordenação e limite
    messagesQuery = messagesQuery
      .order('created_at', { ascending: false })
      .limit(limit);

    console.log('🔍 [API] Executando query de mensagens...');
    
    // ✅ Buscar mensagens
    let messages = [];
    let messagesError = null;
    
    try {
      const result = await messagesQuery;
      messages = result.data || [];
      messagesError = result.error;
      
      if (messagesError) {
        console.error('❌ [API] Erro retornado pela query:', messagesError);
        console.error('❌ [API] Código do erro:', messagesError.code);
        console.error('❌ [API] Mensagem do erro:', messagesError.message);
        console.error('❌ [API] Detalhes completos:', JSON.stringify(messagesError, null, 2));
      } else {
        console.log(`✅ [API] Query executada com sucesso. Mensagens encontradas: ${messages.length}`);
        if (chat_id) {
          // ✅ VALIDAÇÃO: Verificar se todas as mensagens pertencem ao chat_id correto
          const invalidMessages = messages.filter(m => m.chat_id !== chat_id);
          if (invalidMessages.length > 0) {
            console.error(`🚨 [SEGURANÇA] ${invalidMessages.length} mensagens de outros chats detectadas!`, {
              expectedChatId: chat_id,
              invalidMessages: invalidMessages.map(m => ({ id: m.id, chat_id: m.chat_id }))
            });
            // Filtrar mensagens inválidas
            messages = messages.filter(m => m.chat_id === chat_id);
            console.log(`✅ [SEGURANÇA] Mensagens filtradas. Total válido: ${messages.length}`);
          } else {
            console.log(`✅ [SEGURANÇA] Todas as ${messages.length} mensagens pertencem ao chat_id correto`);
          }
        }
      }
    } catch (queryError) {
      console.error('❌ [API] Exceção ao executar query:', queryError);
      console.error('❌ [API] Stack trace:', queryError.stack);
      messagesError = queryError;
    }

    if (messagesError) {
      return res.status(500).json({ 
        success: false, 
        error: `Erro ao buscar mensagens: ${messagesError.message || messagesError.code || 'Erro desconhecido'}`,
        details: process.env.NODE_ENV === 'development' ? messagesError : undefined
      });
    }
    
    // ✅ Buscar dados dos chats separadamente para enriquecer as mensagens
    if (messages.length > 0) {
      const chatIds = [...new Set(messages.map(m => m.chat_id).filter(Boolean))];
      if (chatIds.length > 0) {
        try {
          const { data: chatsData, error: chatsError } = await supabaseAdmin
            .from('chats')
            .select('id, name, platform, assigned_agent_id, contact_name, contact_phone')
            .in('id', chatIds);
          
          if (!chatsError && chatsData) {
            const chatsMap = new Map(chatsData.map(c => [c.id, c]));
            messages = messages.map(msg => ({
              ...msg,
              chats: chatsMap.get(msg.chat_id) || null
            }));
            console.log(`✅ [API] Dados de chats enriquecidos: ${chatsData.length} chats encontrados`);
          } else if (chatsError) {
            console.warn('⚠️ [API] Erro ao buscar chats (continuando sem enriquecimento):', chatsError.message);
          }
        } catch (chatsException) {
          console.warn('⚠️ [API] Exceção ao buscar chats (continuando sem enriquecimento):', chatsException.message);
        }
      }
    }

    // ✅ Buscar count separadamente (mais eficiente e evita problemas com relacionamentos)
    // ✅ CORREÇÃO: Usar supabaseAdmin para garantir acesso completo
    let countQuery = supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', targetOrganizationId);

    // Aplicar os mesmos filtros no count
    if (dateStart) {
      try {
        const startDate = new Date(dateStart);
        if (!isNaN(startDate.getTime())) {
          startDate.setUTCHours(0, 0, 0, 0);
          countQuery = countQuery.gte('created_at', startDate.toISOString());
        }
      } catch (dateError) {
        console.warn('⚠️ [API] Erro ao processar data de início no count:', dateError);
      }
    }

    if (dateEnd) {
      try {
        const endDate = new Date(dateEnd);
        if (!isNaN(endDate.getTime())) {
          endDate.setUTCHours(23, 59, 59, 999);
          countQuery = countQuery.lte('created_at', endDate.toISOString());
        }
      } catch (dateError) {
        console.warn('⚠️ [API] Erro ao processar data de fim no count:', dateError);
      }
    }

    if (keyword && keyword.trim()) {
      countQuery = countQuery.ilike('content', `%${keyword.trim()}%`);
    }

    // ✅ Aplicar filtros de chat_id no count se houver
    if (chatIds && chatIds.length > 0) {
      countQuery = countQuery.in('chat_id', chatIds);
    }

    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.warn('⚠️ [API] Erro ao buscar count (usando length como fallback):', countError);
    }

    console.log(`✅ [API] Mensagens encontradas: ${messages?.length || 0}, Total: ${totalCount || messages?.length || 0}`);
    
    res.json({ 
      success: true, 
      messages: messages || [], 
      total: totalCount || messages?.length || 0 
    });
  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar mensagens:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// GET /api/messages/recent - Buscar mensagens recentes
router.get('/recent', auth, async (req, res) => {
  try {
    const { user } = req;
    
    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const { 
      dateStart, 
      dateEnd, 
      limit = 10,
      organization_id // 🎯 PARÂMETRO OPCIONAL DO FRONTEND
    } = req.query;

    // 🎯 USAR ORGANIZATION_ID DO PARÂMETRO OU DO USUÁRIO
    const targetOrganizationId = organization_id || user.organization_id;

    // 🎯 VERIFICAR ROLE DO USUÁRIO PARA FILTRAR DADOS SE FOR AGENTE
    let isAgent = false;
    
    try {
      // ✅ CORREÇÃO: Usar supabaseAdmin para garantir acesso completo
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role_id')
        .eq('id', user.id)
        .single();

      if (!profileError && userProfile?.role_id) {
        const { data: role, error: roleError } = await supabaseAdmin
          .from('roles')
          .select('name')
          .eq('id', userProfile.role_id)
          .single();

        if (!roleError && role?.name) {
          isAgent = role.name.toLowerCase().includes('agente') || role.name.toLowerCase().includes('agent');
        }
      }
    } catch (error) {
      // Erro silencioso
      console.error('❌ [API] Erro ao verificar role do usuário:', error);
    }

    // ✅ CORREÇÃO: Usar supabaseAdmin para garantir acesso completo
    let messagesQuery = supabaseAdmin
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        is_from_me,
        created_at,
        sender_name,
        chats (
          id,
          name,
          platform,
          assigned_agent_id
        )
      `)
      .eq('organization_id', targetOrganizationId) // 🎯 USAR TARGET ORGANIZATION ID
      .order('created_at', { ascending: false });
    
    // 🎯 FILTRO POR AGENTE: Se for agente, filtrar mensagens de conversas atribuídas a ele
    if (isAgent) {
      // ✅ CORREÇÃO: Usar supabaseAdmin para garantir acesso completo
      const { data: agentChats, error: chatsError } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('organization_id', targetOrganizationId)
        .eq('assigned_agent_id', user.id);
      
      if (!chatsError && agentChats && agentChats.length > 0) {
        const chatIds = agentChats.map(c => c.id);
        messagesQuery = messagesQuery.in('chat_id', chatIds);
      } else {
        // Se não tem conversas, não retornar mensagens
        messagesQuery = messagesQuery.eq('chat_id', '00000000-0000-0000-0000-000000000000'); // UUID inválido
      }
    }
    
    messagesQuery = messagesQuery.limit(parseInt(limit));

    // Aplicar filtros de data se fornecidos
    if (dateStart) {
      const startDate = new Date(dateStart);
      startDate.setHours(0, 0, 0, 0);
      messagesQuery = messagesQuery.gte('created_at', startDate.toISOString());
    }
    if (dateEnd) {
      const endDate = new Date(dateEnd);
      endDate.setHours(23, 59, 59, 999);
      messagesQuery = messagesQuery.lte('created_at', endDate.toISOString());
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      console.error('❌ [API] Erro ao buscar mensagens recentes:', messagesError);
      return res.status(500).json({ 
        success: false,
        error: 'Erro ao buscar mensagens recentes',
        details: messagesError.message 
      });
    }

    // Processar mensagens para o formato esperado
    const processedMessages = messages?.map(msg => ({
      id: msg.id,
      content: msg.content,
      is_from_me: msg.is_from_me,
      created_at: msg.created_at,
      sender_name: msg.sender_name || (msg.is_from_me ? 'Agente' : 'Cliente'),
      sender: msg.is_from_me ? 'agent' : 'customer',
      chat_name: msg.chats?.name || 'Chat',
      platform: msg.chats?.platform || 'whatsapp'
    })) || [];

    res.json({
      success: true,
      messages: processedMessages,
      total: processedMessages.length
    });

  } catch (error) {
    console.error('❌ [API] Erro completo ao buscar mensagens recentes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// GET /api/messages/stats - Buscar estatísticas de mensagens
router.get('/stats', auth, async (req, res) => {
  try {
    console.log('📊 [API] Rota /api/messages/stats chamada');
    console.log('🚨 [API] PARÂMETROS RECEBIDOS:', req.query);
    console.log('📊 [API] User:', req.user);
    
    const { user } = req;
    const { 
      dateStart, 
      dateEnd, 
      userId, 
      teamId, 
      department, 
      messageType, 
      status, 
      limit = 1000,
      organizationId
    } = req.query;

    // Buscar role_id e role_name reais do banco
    let role_id = null;
    let role_name = null;
    if (user && user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', user.id)
        .single();
      if (profile && profile.role_id) {
        role_id = profile.role_id;
        const { data: role } = await supabase
          .from('roles')
          .select('name')
          .eq('id', profile.role_id)
          .single();
        if (role) {
          role_name = role.name;
        }
      }
    }

    // Validar parâmetros obrigatórios
    if (!dateStart || !dateEnd) {
      console.log('❌ [API] Parâmetros de data não fornecidos');
      return res.status(400).json({ 
        success: false, 
        error: 'Parâmetros dateStart e dateEnd são obrigatórios' 
      });
    }

    console.log('🚨 [API] DATAS RECEBIDAS:', { dateStart, dateEnd });

    // Validar formato de data
    const startDate = new Date(dateStart);
    const endDate = new Date(dateEnd);
    
    console.log('🚨 [API] DATAS CONVERTIDAS:', {
      dateStart,
      dateEnd,
      startDateValid: !isNaN(startDate.getTime()),
      endDateValid: !isNaN(endDate.getTime()),
      startDateISO: startDate.toISOString(),
      endDateISO: endDate.toISOString()
    });
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.log('❌ [API] Datas inválidas');
      return res.status(400).json({ 
        success: false, 
        error: 'Formato de data inválido. Use YYYY-MM-DD' 
      });
    }

    if (startDate > endDate) {
      console.log('❌ [API] Data de início maior que data de fim');
      return res.status(400).json({ 
        success: false, 
        error: 'Data de início deve ser anterior à data de fim' 
      });
    }

    // Determinar organização - usar organizationId do query ou do usuário autenticado
    const targetOrganizationId = organizationId || user.organization_id;
    console.log('📊 [API] Buscando dados para organização:', targetOrganizationId);

    if (!targetOrganizationId) {
      console.log('❌ [API] Sem organização definida');
      return res.status(400).json({ 
        success: false, 
        error: 'organization_id é obrigatório' 
      });
    }

    console.log('🚨 [API] CHAMANDO getUnifiedData com:', {
      organization: targetOrganizationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // 🎯 USAR FONTE UNIFICADA DE DADOS
    const unifiedData = await getUnifiedData(targetOrganizationId, startDate, endDate, {});
    
    const { messages, conversations, users, metrics } = unifiedData;

    console.log('📊 [API] Dados unificados coletados:', {
      messages: messages.length,
      conversations: conversations.length,
      users: users.length,
      globalMetrics: metrics.global
    });
    
    console.log('👥 [API] Lista de usuários da organização:', users.map(u => ({ id: u.id, name: u.name })));

    // Verificar permissões usando role_name real
    console.log('🔍 [API] Role do usuário:', { role_id, role_name, userId: user.id });
    const canViewAllUsers = ['admin', 'super_admin'].includes(role_name);
    const canViewAllTeams = ['admin', 'super_admin'].includes(role_name);
    console.log('🔍 [API] Permissões:', { canViewAllUsers, canViewAllTeams });

    // 🎯 BUSCAR TODOS OS USUÁRIOS DA ORGANIZAÇÃO (copiado exatamente do /reports/messages-received)
    console.log(`🔍 [API] Buscando usuários da organização ${targetOrganizationId}...`);
    
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
      .eq('organization_id', targetOrganizationId)
      .order('name', { ascending: true });

    if (agentsError) {
      console.error('❌ [API] Erro ao buscar agentes:', agentsError);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    console.log(`📊 [API] Agentes encontrados: ${agentsData?.length || 0}`);

    // Retornar diretamente todos os usuários da organização
    const filteredUsers = agentsData?.map(agent => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      department: agent.department || 'Sem departamento',
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      avgResponseTime: 0,
      productivity: 0,
      isOnline: agent.is_online
    })) || [];
    
    console.log('📊 [API] Usuários finais para retorno:', filteredUsers.length);
    console.log('📊 [API] Primeiros 3 usuários:', filteredUsers.slice(0, 3).map(u => ({ id: u.id, name: u.name })));
    
    // Se não há usuários, retornar erro
    if (filteredUsers.length === 0) {
      console.log('❌ [API] Nenhum usuário encontrado');
      return res.status(404).json({ 
        success: false, 
        error: 'Nenhum usuário encontrado na organização' 
      });
    }

    // Aplicar filtros adicionais (removido filtro de departamento que estava causando problema)
    // if (department) {
    //   filteredUsers = filteredUsers.filter(u => u.department === department);
    // }

    // Calcular estatísticas totais
    const totalStats = {
      totalMessages: metrics.global.totalMessages,
      sentMessages: metrics.global.sentMessages,
      receivedMessages: metrics.global.receivedMessages,
      messagesByType: {},
      messagesByStatus: [],
      messagesByDepartment: [],
      messagesByDate: metrics.byDate,
      topUsers: filteredUsers.sort((a, b) => b.totalMessages - a.totalMessages).slice(0, 5),
      departments: [...new Set(filteredUsers.map(u => u.department))],
      messageTypes: [],
      messageStatuses: [],
      avgResponseTime: metrics.global.avgResponseTime
    };

    // Gerar resposta unificada
    const response = {
      success: true,
      data: {
        stats: filteredUsers,
        totalStats,
        filters: {
          dateStart,
          dateEnd,
          userId: userId || 'all',
          teamId: teamId || 'all',
          department: department || 'all',
          messageType: messageType || 'all',
          status: status || 'all',
          limit: parseInt(limit),
          organizationId: targetOrganizationId
        },
        permissions: {
          canViewAllUsers,
          canViewAllTeams,
          role_id,
          role_name
        },
        searchScope: 'organization',
        summary: {
          totalUsers: filteredUsers.length,
          totalMessages: totalStats.totalMessages,
          dateRange: { start: dateStart, end: dateEnd },
          departments: totalStats.departments,
          messageTypes: totalStats.messageTypes,
          messageStatuses: totalStats.messageStatuses,
          searchType: 'global'
        }
      }
    };

    console.log('✅ [API] Resposta unificada gerada:', {
      userCount: response.data.stats.length,
      totalMessages: response.data.totalStats.totalMessages,
      avgProductivity: filteredUsers.length > 0 ? 
        Math.round(filteredUsers.reduce((sum, u) => sum + u.productivity, 0) / filteredUsers.length) : 0
    });

    res.json(response);

  } catch (error) {
    console.error('❌ [API] Erro na rota stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Rota para adicionar/remover reação em uma mensagem
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction, userId } = req.body;

    console.log('🎯 Adicionando reação:', { messageId, reaction, userId });

    if (!reaction || !userId) {
      return res.status(400).json({ error: 'Reação e userId são obrigatórios' });
    }

    // Buscar a mensagem atual
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('reactions, metadata')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Obter reações atuais
    const currentReactions = message.reactions || {};
    const currentUsers = currentReactions[reaction] || [];

    let updatedReactions;
    if (currentUsers.includes(userId)) {
      // Remover reação
      updatedReactions = {
        ...currentReactions,
        [reaction]: currentUsers.filter(id => id !== userId)
      };
      
      // Remover a reação se não houver mais usuários
      if (updatedReactions[reaction].length === 0) {
        delete updatedReactions[reaction];
      }
    } else {
      // Adicionar reação
      updatedReactions = {
        ...currentReactions,
        [reaction]: [...currentUsers, userId]
      };
    }

    // Atualizar no banco
    const { error: updateError } = await supabase
      .from('messages')
      .update({ reactions: updatedReactions })
      .eq('id', messageId);

    if (updateError) {
      console.error('❌ Erro ao atualizar reação:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar reação' });
    }

    console.log('✅ Reação atualizada com sucesso');
    res.json({ success: true, reactions: updatedReactions });

  } catch (error) {
    console.error('❌ Erro na rota de reação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para encaminhar mensagem
router.post('/forward', auth, async (req, res) => {
  try {
    const { messageId, targetChatId, originalChatId } = req.body;

    console.log('📤 Encaminhando mensagem:', { messageId, targetChatId, originalChatId });

    if (!messageId || !targetChatId || !originalChatId) {
      return res.status(400).json({ error: 'messageId, targetChatId e originalChatId são obrigatórios' });
    }

    // Buscar a mensagem original
    const { data: originalMessage, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !originalMessage) {
      return res.status(404).json({ error: 'Mensagem original não encontrada' });
    }

    // Buscar o chat de destino
    const { data: targetChat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', targetChatId)
      .single();

    if (chatError || !targetChat) {
      return res.status(404).json({ error: 'Chat de destino não encontrado' });
    }

    // Criar nova mensagem encaminhada
    const { data: forwardedMessage, error: forwardError } = await supabase
      .from('messages')
      .insert({
        chat_id: targetChatId,
        content: originalMessage.content,
        message_type: originalMessage.message_type,
        media_url: originalMessage.media_url,
        is_from_me: true, // Sempre será do agente
        sender_name: 'Você',
        status: 'sent',
        organization_id: targetChat.organization_id,
        metadata: {
          ...originalMessage.metadata,
          forwarded_from: messageId,
          forwarded_from_chat: originalChatId,
          forwarded_at: new Date().toISOString(),
          is_forwarded: true
        }
      })
      .select()
      .single();

    if (forwardError) {
      console.error('❌ Erro ao encaminhar mensagem:', forwardError);
      return res.status(500).json({ error: 'Erro ao encaminhar mensagem' });
    }

    console.log('✅ Mensagem encaminhada com sucesso');
    res.json({ 
      success: true, 
      message: 'Mensagem encaminhada com sucesso',
      forwardedMessage 
    });

  } catch (error) {
    console.error('❌ Erro na rota de encaminhamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para buscar chats disponíveis para encaminhamento
router.get('/chats', auth, async (req, res) => {
  try {
    const { data: chats, error } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid, status, organization_id')
      .eq('organization_id', req.user.organization_id)
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error('❌ Erro ao buscar chats:', error);
      return res.status(500).json({ error: 'Erro ao buscar chats' });
    }

    res.json(chats);

  } catch (error) {
    console.error('❌ Erro na rota de busca de chats:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 