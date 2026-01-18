import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// 🎯 CONTROLE DE LOGS DE DEBUG
// Use DEBUG_DASHBOARD=true para habilitar logs detalhados
const DEBUG_DASHBOARD = process.env.DEBUG_DASHBOARD === 'true' || process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (DEBUG_DASHBOARD) {
    console.log(...args);
  }
};

// Rota de teste para dashboard
router.get('/test', (req, res) => {
  logger.debug('Dashboard test route accessed');
  res.json({ 
    success: true, 
    message: 'Dashboard routes working!',
    timestamp: new Date().toISOString()
  });
});

// GET /api/dashboard/stats - Buscar estatísticas do dashboard (usando mesma lógica do relatório)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { user_id, organization_id, dateStart, dateEnd } = req.query;
    const { user } = req;
    
    logger.database('Dashboard stats requested', { user_id, organization_id, dateStart, dateEnd, user_org: user?.organization_id });
    
    // 🎯 DEBUG DETALHADO DO ORGANIZATION_ID
    logger.debug('Debug - Parâmetros recebidos', {
      queryOrganizationId: organization_id,
      userOrganizationId: user?.organization_id,
      userData: user ? {
        id: user.id,
        organization_id: user.organization_id,
        user_role: user.user_role
      } : null,
      headers: {
        'x-user-id': req.headers['x-user-id'],
        'x-user-role': req.headers['x-user-role'],
        'x-organization-id': req.headers['x-organization-id'],
        'x-request-id': req.headers['x-request-id'],
        'authorization': req.headers['authorization'] ? 'present' : 'missing'
      }
    });
    
    // 🎯 DEBUG: Verificar se as datas estão sendo recebidas
    logger.debug('Debug das datas recebidas', {
      dateStart,
      dateEnd,
      dateStartType: typeof dateStart,
      dateEndType: typeof dateEnd,
      today: new Date().toISOString().split('T')[0],
      isToday: dateStart === new Date().toISOString().split('T')[0]
    });

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id é obrigatório' });
    }

    // 🎯 USAR ORGANIZATION_ID DO PARÂMETRO OU DO USUÁRIO AUTENTICADO (MESMA LÓGICA DO /individual-metrics)
    const targetOrganizationId = organization_id || user?.organization_id;
    
    debugLog('🎯 [Dashboard] Organization ID final (parâmetro ou usuário autenticado):', {
      queryOrganizationId: organization_id,
      userOrganizationId: user?.organization_id,
      targetOrganizationId,
      willUseParam: !!organization_id,
      willUseUser: !organization_id && !!user?.organization_id
    });
    
    // 🎯 VERIFICAR ISOLAMENTO DE ORGANIZAÇÃO
    const headerOrgId = req.headers['x-organization-id'];
    
    if (!targetOrganizationId) {
      return res.status(400).json({ success: false, error: 'Usuário não possui organização válida' });
    }

    // 🎯 VERIFICAR SE O TARGET_ORGANIZATION_ID É VÁLIDO
    debugLog('🔍 [Dashboard] Verificando se organization_id é válido:', targetOrganizationId);
    
    // Verificar se a organização existe
    const { data: orgCheck, error: orgCheckError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', targetOrganizationId)
      .single();
    
    if (orgCheckError || !orgCheck) {
      return res.status(400).json({ success: false, error: 'Organization_id inválido' });
    }
    
    debugLog('✅ [Dashboard] Organization_id válido:', { id: orgCheck.id, name: orgCheck.name });

    // 🎯 VERIFICAR ROLE DO USUÁRIO PARA FILTRAR DADOS SE FOR AGENTE
    let userRoleName = 'agent'; // Padrão
    let isAgent = false;
    
    try {
      // Buscar profile do usuário com role
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', user_id)
        .single();

      if (!profileError && userProfile?.role_id) {
        // Buscar nome da role
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('name')
          .eq('id', userProfile.role_id)
          .single();

        if (!roleError && role?.name) {
          userRoleName = role.name;
          // Verificar se é agente (case insensitive)
          isAgent = role.name.toLowerCase().includes('agente') || role.name.toLowerCase().includes('agent');
        }
      }
    } catch (error) {
      // Erro silencioso
    }

    debugLog('🎯 [Dashboard] Role do usuário:', {
      user_id,
      userRoleName,
      isAgent,
      willFilterByAgent: isAgent
    });

    // 🎯 USAR EXATAMENTE A MESMA LÓGICA DO RELATÓRIO DE ATTENDANCE
    debugLog('📊 [Dashboard] Iniciando busca de dados usando lógica do relatório');

    // Buscar usuários da organização (filtrar por agente se necessário)
    debugLog('🔍 [Dashboard] Buscando agentes com organization_id:', targetOrganizationId);
    let agentsQuery = supabase
      .from('profiles')
      .select('id, name, email, department, is_online, role_id, created_at, updated_at, organization_id')
      .eq('organization_id', targetOrganizationId)
      .is('deleted_at', null); // 🎯 EXCLUIR USUÁRIOS DELETADOS
    
    // 🎯 FILTRO POR AGENTE: Se for agente, mostrar apenas ele mesmo
    if (isAgent) {
      agentsQuery = agentsQuery.eq('id', user_id);
      debugLog('🔒 [Dashboard] Filtrando agentes: apenas o próprio usuário (agente)');
    }
    
    agentsQuery = agentsQuery.order('name', { ascending: true });
    
    let { data: agentsData, error: agentsError } = await agentsQuery;

    if (agentsError) {
      console.error('❌ Erro ao buscar usuários:', agentsError);
      // Em vez de retornar erro, continuar com array vazio
      agentsData = [];
    }

    debugLog(`📊 [Dashboard] Agentes encontrados: ${agentsData?.length || 0}`);

    // 🎯 NOVO: Buscar times da organização para métricas
    debugLog('🔍 [Dashboard] Buscando times da organização:', targetOrganizationId);
    let { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, description, created_at, organization_id')
      .eq('organization_id', targetOrganizationId)
      .is('deleted_at', null);

    if (teamsError) {
      teamsData = [];
    }

    debugLog(`📊 [Dashboard] Times encontrados: ${teamsData?.length || 0}`);

    // Buscar dados de conversas da organização (mesmo que relatório)
    debugLog('🔍 [Dashboard] Buscando conversas com organization_id:', targetOrganizationId);
    let conversationsQuery = supabase
      .from('chats')
      .select(`
        id, 
        status, 
        assigned_agent_id, 
        created_at,
        updated_at,
        platform,
        organization_id,
        messages:messages(id, created_at, is_from_me, content, sender_id),
        analytics:conversation_analytics(*)
      `)
      .eq('organization_id', targetOrganizationId);

    // 🎯 FILTRO POR AGENTE: Se for agente, mostrar apenas conversas atribuídas a ele
    if (isAgent) {
      conversationsQuery = conversationsQuery.eq('assigned_agent_id', user_id);
      debugLog('🔒 [Dashboard] Filtrando conversas: apenas as atribuídas ao agente');
    }

    // Aplicar filtros de data se fornecidos
    if (dateStart) {
      const startDate = new Date(dateStart);
      startDate.setHours(0, 0, 0, 0);
      conversationsQuery = conversationsQuery.gte('created_at', startDate.toISOString());
    }
    if (dateEnd) {
      const endDate = new Date(dateEnd);
      endDate.setHours(23, 59, 59, 999);
      conversationsQuery = conversationsQuery.lte('created_at', endDate.toISOString());
    }

    let { data: conversationsData, error: conversationsError } = await conversationsQuery;

    if (conversationsError) {
      console.error('❌ Erro ao buscar conversas:', conversationsError);
      // Em vez de retornar erro, continuar com array vazio
      conversationsData = [];
    }

    debugLog(`📊 [Dashboard] Conversas encontradas: ${conversationsData?.length || 0}`);

    // 🎯 USAR A MESMA LÓGICA DO ENDPOINT /individual-metrics
    debugLog('🔍 [Dashboard] Buscando mensagens com organization_id (lógica individual-metrics):', targetOrganizationId);
    
    // 🎯 DEBUG: Verificar datas recebidas
    debugLog('📅 [Dashboard] Debug - Datas recebidas na API:', {
      dateStart,
      dateEnd,
      dateStartType: typeof dateStart,
      dateEndType: typeof dateEnd,
      today: new Date().toISOString().split('T')[0],
      isToday: dateStart === new Date().toISOString().split('T')[0]
    });
    
    // 🎯 CORRIGIR PROCESSAMENTO DE DATAS - CONVERTER PARA RANGES COMPLETOS DO DIA
    let processedDateStart, processedDateEnd;
    
    // 🎯 CORREÇÃO: Verificar se as datas são válidas e não estão vazias
    let hasValidDates = dateStart && dateEnd && 
                         dateStart.trim() !== '' && dateEnd.trim() !== '' &&
                         dateStart !== 'undefined' && dateEnd !== 'undefined' &&
                         dateStart !== 'null' && dateEnd !== 'null';
    
    if (hasValidDates) {
      // Converter para início e fim do dia em UTC
      const startDate = new Date(dateStart);
      const endDate = new Date(dateEnd);
      
      // Verificar se as datas são válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        hasValidDates = false;
      } else {
        // Início do dia (00:00:00.000)
        startDate.setUTCHours(0, 0, 0, 0);
        processedDateStart = startDate.toISOString();
        
        // Fim do dia (23:59:59.999)
        endDate.setUTCHours(23, 59, 59, 999);
        processedDateEnd = endDate.toISOString();
        
      }
    }
    
    if (!hasValidDates) {
      // Fallback para últimos 30 dias se não houver datas válidas
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
      now.setUTCHours(23, 59, 59, 999);
      
      processedDateStart = thirtyDaysAgo.toISOString();
      processedDateEnd = now.toISOString();
      
      logger.debug('Usando fallback de datas (últimos 30 dias)', {
        reason: 'Datas não fornecidas ou inválidas',
        dateStart,
        dateEnd,
        processedDateStart,
        processedDateEnd
      });
    }
    
    // 🎯 BUSCAR CONVERSAS DO AGENTE PRIMEIRO (se for agente) para otimizar queries
    let agentChatIds = [];
    if (isAgent) {
      const { data: agentChats, error: chatsError } = await supabase
        .from('chats')
        .select('id')
        .eq('organization_id', targetOrganizationId)
        .eq('assigned_agent_id', user_id);
      
      if (!chatsError && agentChats && agentChats.length > 0) {
        agentChatIds = agentChats.map(c => c.id);
      } else {
        agentChatIds = []; // Array vazio para forçar retorno vazio
      }
    }

    // 🎯 BUSCAR MENSAGENS COM FILTRO DE DATA CORRIGIDO (MESMA LÓGICA DO /individual-metrics)
    // ✅ ATUALIZADO: Buscar count total de mensagens (sem limite de 1000)
    let messagesCountQuery = supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null);
    
    // 🎯 FILTRO POR AGENTE: Se for agente, filtrar mensagens de conversas atribuídas a ele
    if (isAgent) {
      if (agentChatIds.length > 0) {
        messagesCountQuery = messagesCountQuery.in('chat_id', agentChatIds);
      } else {
        // Se não tem conversas, não retornar mensagens (forçar count = 0)
        messagesCountQuery = messagesCountQuery.eq('chat_id', '00000000-0000-0000-0000-000000000000'); // UUID inválido para não retornar nada
      }
    }
    
    const { count: totalMessagesCount, error: countError } = await messagesCountQuery;
    
    
    if (countError) {
      // Erro silencioso
    }

    logger.database('Total de mensagens encontradas (count)', totalMessagesCount || 0);

    // ✅ ATUALIZADO: Buscar todas as mensagens (sem limite de 1000)
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
        chats(id, name, whatsapp_jid, assigned_agent_id, platform, status, department, priority, created_at, last_message_at)
      `)
      .eq('organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null);
    
    // 🎯 FILTRO POR AGENTE: Se for agente, usar os chatIds já buscados acima
    if (isAgent) {
      if (agentChatIds.length > 0) {
        messagesQuery = messagesQuery.in('chat_id', agentChatIds);
      } else {
        // Se não tem conversas, não retornar mensagens
        messagesQuery = messagesQuery.eq('chat_id', '00000000-0000-0000-0000-000000000000'); // UUID inválido
      }
    }
    
    // ✅ REMOVIDO: .limit(1000) - Removido limite para buscar todas as mensagens
    
    // ✅ REMOVIDO: Limite de 1000 - Usar range para buscar todas as mensagens (Supabase limita a 1000 por padrão)
    const { data: foundMessages, error: allError } = await messagesQuery.range(0, 999999);
    
    let messagesData = foundMessages || [];
    const messagesError = allError;

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      // Em vez de retornar erro, continuar com array vazio
      messagesData = [];
    }

    // 🎯 VERIFICAÇÃO ADICIONAL: Se for agente, garantir que todas as mensagens pertencem às conversas dele
    if (isAgent && agentChatIds.length > 0 && messagesData.length > 0) {
      messagesData = messagesData.filter(msg => agentChatIds.includes(msg.chat_id));
    }


    // 🎯 DEBUG: Verificar mensagens com e sem filtro
    if (dateStart && dateEnd) {
      const startDate = new Date(dateStart);
      const endDate = new Date(dateEnd);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      const messagesInPeriod = messagesData?.filter(msg => {
        const msgDate = new Date(msg.created_at);
        return msgDate >= startDate && msgDate <= endDate;
      }) || [];
      
    }

    // Buscar créditos de IA da organização
    let { data: aiCreditsData, error: aiCreditsError } = await supabase
      .from('ai_credits')
      .select('credits_purchased, credits_used, last_purchase_at, organization_id')
      .eq('organization_id', targetOrganizationId)
      .is('user_id', null) // Registro organizacional
      .maybeSingle();

    if (aiCreditsError) {
      console.error('❌ Erro ao buscar créditos de IA:', aiCreditsError);
      // Em vez de retornar erro, continuar com dados vazios
      aiCreditsData = null;
    }


    // Buscar assistentes IA criados na organização
    let { data: aiSettingsData, error: aiSettingsError } = await supabase
      .from('ai_assistants')
      .select('id, name, is_organizational, organization_id')
      .eq('organization_id', targetOrganizationId);

    if (aiSettingsError) {
      console.error('❌ Erro ao buscar assistentes IA:', aiSettingsError);
      aiSettingsData = [];
    }


    // 🎯 CALCULAR ESTATÍSTICAS USANDO A MESMA LÓGICA DO /individual-metrics
    const agents = agentsData || [];
    const conversations = conversationsData || [];
    const messages = messagesData || [];
    const teams = teamsData || [];
    
    // 🎯 USAR MENSAGENS DIRETAMENTE DA QUERY (JÁ FILTRADAS PELO SUPABASE)
    const finalFilteredMessages = messages;
    
    // Log removido para reduzir poluição no console
    // debugLog('📊 [Dashboard] Dados coletados:', { ... });
    
    // Usuários (mesmo que relatório)
    const totalUsers = agents.length;
    const activeUsers = agents.filter(agent => agent.is_online).length;
    
    // 🎯 NOVO: Métricas de times COM FILTRO DE DATA
    // Contar times que tiveram atividade no período selecionado
    const activeTeamsInPeriod = teams.filter(team => {
      // Verificar se o time tem membros
      const teamMembers = agents.filter(agent => agent.department === team.name);
      if (teamMembers.length === 0) return false;
      
      // Verificar se o time teve atividade no período (mensagens ou conversas)
      const teamMemberIds = teamMembers.map(member => member.id);
      
      // Verificar se há mensagens de membros do time no período
      // Considerar user_id (quem criou a mensagem) e assigned_agent_id (agente responsável pelo chat)
      const teamMessagesInPeriod = finalFilteredMessages.filter(msg => 
        teamMemberIds.includes(msg.user_id) || // Mensagem criada pelo usuário
        (msg.chats && teamMemberIds.includes(msg.chats.assigned_agent_id)) // Usuário responsável pelo chat
      );
      
      // Verificar se há conversas atribuídas a membros do time no período
      const teamConversationsInPeriod = conversationsData.filter(chat => 
        teamMemberIds.includes(chat.assigned_agent_id)
      );
      
      return teamMessagesInPeriod.length > 0 || teamConversationsInPeriod.length > 0;
    });
    
    const totalTeams = activeTeamsInPeriod.length;
    const teamsWithMembers = activeTeamsInPeriod.length;
    
    // 🎯 CONVERTER MENSAGENS PARA CONVERSAS ÚNICAS (MESMA LÓGICA DO /individual-metrics)
    const uniqueChats = new Map();
    
    finalFilteredMessages.forEach(msg => {
      if (msg.chat_id) {
        const chatId = msg.chat_id;
        if (!uniqueChats.has(chatId)) {
          uniqueChats.set(chatId, {
            id: msg.chats?.id || chatId,
            name: msg.chats?.name || msg.chats?.whatsapp_jid || 'Conversa sem nome',
            platform: msg.chats?.platform || 'whatsapp',
            status: msg.chats?.status || 'active',
            priority: msg.chats?.priority || 'normal',
            department: msg.chats?.department,
            assigned_agent_id: msg.chats?.assigned_agent_id,
            created_at: msg.chats?.created_at || msg.created_at,
            updated_at: msg.created_at,
            last_message_at: msg.chats?.last_message_at || msg.created_at,
            metadata: {},
            unread_count: 0,
            totalMessages: 0,
            sentMessages: 0,
            receivedMessages: 0
          });
        }
        // Incrementar contadores de mensagens para este chat
        const chat = uniqueChats.get(chatId);
        chat.totalMessages++;
        
        if (msg.is_from_me) {
          chat.sentMessages++;
        } else {
          chat.receivedMessages++;
        }
      }
    });
    
    const uniqueChatsArray = Array.from(uniqueChats.values());
    debugLog('🔍 [Dashboard] Conversas únicas encontradas:', uniqueChatsArray.length);
    
    // Log removido para reduzir poluição no console
    
    // 🎯 CORRIGIR: Todas as métricas devem respeitar o filtro de data selecionado
    // Conversas (usando conversas únicas baseadas nas mensagens filtradas por data)
    const activeConversations = uniqueChatsArray.filter(chat => 
      chat.status === 'active' || chat.status === 'pending'
    ).length;
    
    const finishedConversations = uniqueChatsArray.filter(chat => 
      chat.status === 'finished' || chat.status === 'closed'
    ).length;
    
    // Mensagens (usando o count real em vez do tamanho do array limitado)
    // 🎯 VALIDAÇÃO CRÍTICA: Para agentes, usar apenas mensagens filtradas
    let totalMessages = totalMessagesCount || 0;
    
    // 🎯 SE FOR AGENTE: Garantir que usa apenas mensagens das conversas dele
    if (isAgent) {
      if (agentChatIds.length === 0) {
        // Agente sem conversas = 0 mensagens
        totalMessages = 0;
      } else {
        // Validar que o totalMessagesCount realmente reflete apenas as conversas do agente
        // Se houver inconsistência, usar o tamanho do array filtrado como fallback
        if (finalFilteredMessages.length === 0 && totalMessages > 0) {
          totalMessages = 0;
        } else if (finalFilteredMessages.length > 0 && totalMessages === 0) {
          totalMessages = finalFilteredMessages.length;
        }
      }
    }
    
    // Para mensagens enviadas e recebidas, usar proporção baseada na amostra FILTRADA
    const sampleSize = finalFilteredMessages.length;
    const sampleSentMessages = finalFilteredMessages.filter(msg => msg.is_from_me).length;
    const sampleReceivedMessages = finalFilteredMessages.filter(msg => !msg.is_from_me).length;
    
    // Calcular proporções da amostra
    let sentRatio = 0.5;
    let receivedRatio = 0.5;
    
    if (sampleSize > 0) {
      sentRatio = sampleSentMessages / sampleSize;
      receivedRatio = sampleReceivedMessages / sampleSize;
    }
    
    // 🎯 SE FOR AGENTE: Usar valores calculados diretamente da amostra filtrada quando possível
    // ou aplicar proporções ao total filtrado
    let sentMessages;
    let receivedMessages;
    
    if (isAgent) {
      // Para agentes, usar valores diretos da amostra ou extrapolar apenas se necessário
      if (sampleSize > 0 && totalMessages > 1000) {
        // Se temos todas as mensagens, usar dados diretos (sem proporção)
        sentMessages = Math.round(totalMessages * sentRatio);
        receivedMessages = Math.round(totalMessages * receivedRatio);
      } else {
        // Se temos todas as mensagens ou poucas, usar contagem direta
        sentMessages = sampleSentMessages;
        receivedMessages = sampleReceivedMessages;
      }
      
      // Validação final: se sem conversas ou sem mensagens, garantir zero
      if (agentChatIds.length === 0 || totalMessages === 0) {
        sentMessages = 0;
        receivedMessages = 0;
      }
    } else {
      // Para não-agentes, usar proporção normal
      sentMessages = Math.round(totalMessages * sentRatio);
      receivedMessages = Math.round(totalMessages * receivedRatio);
    }
    
    const aiResponses = sentMessages; // Mensagens enviadas por agentes
    
    // Logs removidos para reduzir poluição no console
    
    // Assistentes IA
    const assistantsCreated = aiSettingsData?.length || 0;
    const aiCredits = aiCreditsData ? (aiCreditsData.credits_purchased || 0) - (aiCreditsData.credits_used || 0) : 0;
    
    // 🎯 CALCULAR PRODUTIVIDADE USANDO A MESMA LÓGICA DO RELATÓRIO
    let totalProductivity = 0;
    let agentsWithActivity = 0;
    
    agents.forEach(agent => {
      // Buscar conversas atribuídas ao agente (usando conversas únicas)
      const agentConversations = uniqueChatsArray.filter(chat => chat.assigned_agent_id === agent.id);
      const agentMessages = finalFilteredMessages.filter(msg => {
        const chat = uniqueChatsArray.find(c => c.id === msg.chat_id);
        return chat && chat.assigned_agent_id === agent.id && msg.is_from_me;
      });
      
      if (agentConversations.length > 0 || agentMessages.length > 0) {
        agentsWithActivity++;
        
        // Calcular produtividade individual (mesma lógica do relatório)
        const totalAttendances = agentConversations.length;
        const resolvedAttendances = agentConversations.filter(chat => 
          chat.status === 'finished' || 
          (chat.analytics && chat.analytics[0]?.resolution_status === 'resolved')
        ).length;
        
        // Calcular satisfação (mesma lógica do relatório)
        let customerSatisfaction = 75; // Valor padrão
        let totalSatisfaction = 0;
        let satisfactionCount = 0;
        
        agentConversations.forEach(chat => {
          const analytics = chat.analytics?.[0];
          if (analytics?.customer_satisfaction) {
            totalSatisfaction += analytics.customer_satisfaction;
            satisfactionCount++;
          }
        });
        
        if (satisfactionCount > 0) {
          customerSatisfaction = (totalSatisfaction / satisfactionCount) * 20; // Converter de 1-5 para 0-100
        } else {
          // Calcular satisfação baseada no sentimento das mensagens (mesma lógica do relatório)
          let positiveMessages = 0;
          let negativeMessages = 0;
          let totalMessages = 0;
          
          agentConversations.forEach(chat => {
            const chatMessages = chat.messages || [];
            chatMessages.forEach(msg => {
              if (!msg.is_from_me) { // Apenas mensagens do cliente
                totalMessages++;
                const content = msg.content?.toLowerCase() || '';
                
                // Palavras positivas (mesma lista do relatório)
                const positiveWords = ['obrigado', 'valeu', 'perfeito', 'excelente', 'ótimo', 'muito bom', 'resolvido', 'ajudou', 'satisfeito', 'gostei', 'funcionou', 'claro', 'entendi', 'top', 'show', 'legal', 'bom', 'bem', 'certo', 'sim', 'concordo', 'exato', 'preciso', 'maravilhoso', 'fantástico', 'incrível', 'demais', 'massa', 'irado', 'sucesso', 'consegui', 'deu certo'];
                
                // Palavras negativas (mesma lista do relatório)
                const negativeWords = ['ruim', 'péssimo', 'horrível', 'insatisfeito', 'não gostei', 'problema', 'erro', 'falha', 'lento', 'demorado', 'confuso', 'difícil', 'não funciona', 'não entendo', 'não consigo', 'não deu certo', 'frustrado', 'irritado', 'chateado', 'decepcionado', 'não resolveu', 'não ajudou', 'perda de tempo', 'inútil', 'sem sentido', 'não serve', 'quebrado', 'defeituoso', 'mal', 'terrível', 'desastre', 'catástrofe', 'bug'];
                
                const hasPositive = positiveWords.some(word => content.includes(word));
                const hasNegative = negativeWords.some(word => content.includes(word));
                
                if (hasPositive) positiveMessages++;
                else if (hasNegative) negativeMessages++;
              }
            });
          });
          
          if (totalMessages > 0) {
            const positiveRatio = positiveMessages / totalMessages;
            const negativeRatio = negativeMessages / totalMessages;
            customerSatisfaction = (positiveRatio * 100) - (negativeRatio * 50) + 50; // Score entre 0-100
          }
        }
        
        // Calcular tempo de resposta (mesma lógica do relatório)
        let totalResponseTime = 0;
        let responseCount = 0;
        
        agentConversations.forEach(chat => {
          const chatMessages = agentMessages.filter(msg => msg.chat_id === chat.id);
          if (chatMessages.length > 0) {
            // Buscar primeira mensagem do cliente nesta conversa
            const clientMessages = finalFilteredMessages.filter(msg => 
              msg.chat_id === chat.id && !msg.is_from_me
            ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            
            if (clientMessages.length > 0) {
              const firstClientMsg = clientMessages[0];
              const firstAgentMsg = chatMessages[0];
              
              const clientTime = new Date(firstClientMsg.created_at);
              const agentTime = new Date(firstAgentMsg.created_at);
              
              if (agentTime > clientTime) {
                const responseTime = (agentTime.getTime() - clientTime.getTime()) / 1000;
                if (responseTime > 0) {
                  totalResponseTime += responseTime;
                  responseCount++;
                }
              }
            }
          }
        });
        
        const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
        
        // Calcular produtividade (mesma fórmula do relatório)
        const resolutionRate = totalAttendances > 0 ? (resolvedAttendances / totalAttendances) * 100 : 0;
        const responseTimeScore = averageResponseTime > 0 ? Math.max(0, 100 - (averageResponseTime / 60)) : 0;
        const activityScore = totalAttendances > 0 ? Math.min(100, totalAttendances * 10) : 0;
        
        const agentProductivity = Math.round(
          (resolutionRate * 0.4) +
          (customerSatisfaction * 0.3) +
          (responseTimeScore * 0.2) +
          (activityScore * 0.1)
        );
        
        totalProductivity += agentProductivity;
      }
    });
    
    const productivity = agentsWithActivity > 0 ? Math.round(totalProductivity / agentsWithActivity) : 0;
    
    // Calcular tempo médio de resposta geral (mesma lógica do relatório)
    let totalResponseTime = 0;
    let responseCount = 0;
    
    uniqueChatsArray.forEach(conversation => {
      const conversationMessages = finalFilteredMessages.filter(msg => msg.chat_id === conversation.id);
      if (conversationMessages.length > 0) {
        // Buscar primeira mensagem do cliente e primeira resposta do agente
        const clientMessages = conversationMessages.filter(msg => !msg.is_from_me);
        const agentMessages = conversationMessages.filter(msg => msg.is_from_me);
        
        if (clientMessages.length > 0 && agentMessages.length > 0) {
          const firstClientMsg = clientMessages[0];
          const firstAgentMsg = agentMessages[0];
          
          const clientTime = new Date(firstClientMsg.created_at);
          const agentTime = new Date(firstAgentMsg.created_at);
          
          if (agentTime > clientTime) {
            const responseTime = (agentTime.getTime() - clientTime.getTime()) / 1000; // em segundos
            if (responseTime > 0) {
              totalResponseTime += responseTime;
              responseCount++;
            }
          }
        }
      }
    });
    
    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    const stats = {
      totalMessages,
      // 🎯 NOVO: Métricas de mensagens com filtro de data
      sentMessages,
      receivedMessages,
      ai_credits: aiCredits,
      active_conversations: activeConversations,
      finished_conversations: finishedConversations,
      ai_responses: aiResponses,
      assistants_created: assistantsCreated,
      users: totalUsers,
      activeUsers: activeUsers,
      productivity: productivity,
      response_time: avgResponseTime,
      // 🎯 NOVO: Métricas de times com filtro de data
      total_teams: totalTeams,
      teams_with_members: teamsWithMembers,
      trends: {
        messages: 0,
        users: 0,
        conversations: 0,
        ai_responses: 0
      },
      last_updated: new Date().toISOString()
    };

    // 🎯 LOGS DETALHADOS REMOVIDOS - Use DEBUG_DASHBOARD=true para habilitar
    // Os logs detalhados foram movidos para debugLog() para reduzir poluição no console
    

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    
    // Retornar dados de fallback em caso de erro
    res.json({
      success: true,
      stats: {
        totalMessages: 0,
        ai_credits: 0,
        active_conversations: 0,
        finished_conversations: 0,
        ai_responses: 0,
        assistants_created: 0,
        users: 0,
        activeUsers: 0,
        productivity: 0,
        response_time: 0,
        total_teams: 0,
        teams_with_members: 0,
        trends: {
          messages: 0,
          users: 0,
          conversations: 0,
          ai_responses: 0
        },
        last_updated: new Date().toISOString()
      }
    });
  }
});

// GET /api/dashboard/individual-metrics - Buscar métricas individuais para dashboard
router.get('/individual-metrics', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { organization_id, dateStart, dateEnd } = req.query;
    
    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // 🎯 CORREÇÃO: Usar organization_id do parâmetro ou do usuário autenticado
    const targetOrganizationId = organization_id || user.organization_id;
    
    if (!targetOrganizationId) {
      return res.status(400).json({ error: 'organization_id é obrigatório' });
    }

    //  CORREÇÃO: Melhorar validação de datas
    let processedDateStart, processedDateEnd;
    
    if (dateStart && dateEnd) {
      const startDate = new Date(dateStart);
      const endDate = new Date(dateEnd);
      
      // Validar se as datas são válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Formato de data inválido' });
      }
      
      // Início do dia (00:00:00.000)
      startDate.setUTCHours(0, 0, 0, 0);
      processedDateStart = startDate.toISOString();
      
      // Fim do dia (23:59:59.999)
      endDate.setUTCHours(23, 59, 59, 999);
      processedDateEnd = endDate.toISOString();
    } else {
      //  CORREÇÃO: Fallback para hoje em vez de 30 dias
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endDate = new Date(today);
      
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);
      
      processedDateStart = startDate.toISOString();
      processedDateEnd = endDate.toISOString();
    }
    
    // ✅ ATUALIZADO: Buscar count total de mensagens (sem limite de 1000)
    const { count: totalMessagesCount, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null);

    if (countError) {
      // Erro silencioso
    }

    logger.database('Total de mensagens encontradas (count)', totalMessagesCount || 0);

    // ✅ ATUALIZADO: Buscar todas as mensagens (sem limite de 1000)
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
        chats(id, name, whatsapp_jid, assigned_agent_id, platform, status, department, priority, created_at, last_message_at)
      `)
      .eq('organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null);

    // ✅ REMOVIDO: Limite de 1000 - Usar range para buscar todas as mensagens (Supabase limita a 1000 por padrão)
    const { data: foundMessages, error: allError } = await messagesQuery.range(0, 999999);
    
    const messages = foundMessages || [];
    
    if (allError) {
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    // 🎯 CONVERTER MENSAGENS PARA CONVERSAS ÚNICAS (MESMA LÓGICA DO RELATÓRIO)
    const uniqueChats = new Map();
    
    // 🎯 USAR MENSAGENS DIRETAMENTE DA QUERY (JÁ FILTRADAS PELO SUPABASE)
    const filteredMessages = messages;
    
    (filteredMessages || []).forEach(msg => {
      if (msg.chat_id) {
        const chatId = msg.chat_id;
        if (!uniqueChats.has(chatId)) {
          uniqueChats.set(chatId, {
            id: msg.chats?.id || chatId,
            name: msg.chats?.name || msg.chats?.whatsapp_jid || 'Conversa sem nome',
            platform: msg.chats?.platform || 'whatsapp',
            status: msg.chats?.status || 'active',
            priority: msg.chats?.priority || 'normal',
            department: msg.chats?.department,
            assigned_agent_id: msg.chats?.assigned_agent_id,
            created_at: msg.chats?.created_at || msg.created_at,
            updated_at: msg.created_at,
            last_message_at: msg.chats?.last_message_at || msg.created_at,
            metadata: {},
            unread_count: 0,
            totalMessages: 0, // Contador de mensagens
            sentMessages: 0,  // Contador de mensagens enviadas
            receivedMessages: 0 // Contador de mensagens recebidas
          });
        }
        // Incrementar contadores de mensagens para este chat
        const chat = uniqueChats.get(chatId);
        chat.totalMessages++;
        
        if (msg.is_from_me) {
          chat.sentMessages++;
        } else {
          chat.receivedMessages++;
        }
      }
    });

    const chats = Array.from(uniqueChats.values());

    // 🎯 BUSCAR TODOS OS USUÁRIOS DA ORGANIZAÇÃO
    
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
      .is('deleted_at', null) // 🎯 EXCLUIR USUÁRIOS DELETADOS
      .order('name', { ascending: true });

    if (agentsError) {
      return res.status(500).json({ error: 'Erro ao buscar agentes' });
    }

    // 🎯 FILTRAR APENAS USUÁRIOS REAIS
    const realUsers = agentsData?.filter(agent => {
      const isRealUser = !agent.name?.toLowerCase().includes('exemplo') && 
                        !agent.name?.toLowerCase().includes('test') &&
                        !agent.name?.toLowerCase().includes('demo') &&
                        !agent.email?.toLowerCase().includes('exemplo') &&
                        !agent.email?.toLowerCase().includes('test') &&
                        !agent.email?.toLowerCase().includes('demo');
      
      return isRealUser;
    }) || [];

    // 🎯 PROCESSAR DADOS DE CONVERSAS POR AGENTE
    const processedAgentsData = realUsers?.map(agent => {
      // Filtrar conversas do agente
      const agentChats = chats?.filter(chat => chat.assigned_agent_id === agent.id) || [];
      
      // Calcular estatísticas totais do agente
      const totalMessages = agentChats.reduce((sum, chat) => sum + chat.totalMessages, 0);
      const sentMessages = agentChats.reduce((sum, chat) => sum + chat.sentMessages, 0);
      const receivedMessages = agentChats.reduce((sum, chat) => sum + chat.receivedMessages, 0);
      
      // ⏱️ CALCULAR TEMPO MÉDIO DE RESPOSTA
      let totalResponseTime = 0;
      let responseCount = 0;
      let bestResponseTime = 0;

      agentChats.forEach((chat) => {
        // Buscar mensagens desta conversa
        const chatMessages = messages?.filter(msg => msg.chat_id === chat.id).sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ) || [];

        if (chatMessages.length >= 2) {
          const firstCustomerMsg = chatMessages.find(msg => !msg.is_from_me);
          const firstAgentMsg = chatMessages.find(msg => msg.is_from_me);

          if (firstCustomerMsg && firstAgentMsg) {
            const customerTime = new Date(firstCustomerMsg.created_at);
            const agentTime = new Date(firstAgentMsg.created_at);
            
            if (agentTime > customerTime) {
              const responseTime = (agentTime.getTime() - customerTime.getTime()) / 1000; // em segundos
              totalResponseTime += responseTime;
              responseCount++;
              
              if (bestResponseTime === 0 || responseTime < bestResponseTime) {
                bestResponseTime = responseTime;
              }
            }
          }
        }
      });

      const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
      
      const agentResult = {
        id: agent.id,
        name: agent.name || agent.email?.split('@')[0] || 'Agente',
        email: agent.email,
        department: agent.department,
        is_online: agent.is_online,
        user_role: agent.roles?.name || 'agent',
        
        // Métricas de mensagens (mesma lógica do relatório)
        totalMessages,
        sentMessages,
        receivedMessages,
        
        // ⏱️ TEMPO MÉDIO DE RESPOSTA
        averageResponseTime: Math.round(averageResponseTime),
        bestResponseTime: Math.round(bestResponseTime),
        
        // Informações adicionais
        totalChats: agentChats.length,
        activeChats: agentChats.filter(chat => chat.status === 'active').length,
        finishedChats: agentChats.filter(chat => chat.status === 'finished').length
      };
      
      return agentResult;
    }) || [];

    // Calcular totais usando o count real de mensagens
    const totalMessages = totalMessagesCount || 0;
    
    // Para mensagens enviadas e recebidas, usar proporção baseada na amostra processada
    const sampleTotalMessages = processedAgentsData.reduce((sum, agent) => sum + agent.totalMessages, 0);
    const sampleSentMessages = processedAgentsData.reduce((sum, agent) => sum + agent.sentMessages, 0);
    const sampleReceivedMessages = processedAgentsData.reduce((sum, agent) => sum + agent.receivedMessages, 0);
    
    // Calcular proporções da amostra
    const sentRatio = sampleTotalMessages > 0 ? sampleSentMessages / sampleTotalMessages : 0.5;
    const receivedRatio = sampleTotalMessages > 0 ? sampleReceivedMessages / sampleTotalMessages : 0.5;
    
    // Aplicar proporções ao total real
    const totalSentMessages = Math.round(totalMessages * sentRatio);
    const totalReceivedMessages = Math.round(totalMessages * receivedRatio);
    const totalChats = processedAgentsData.reduce((sum, agent) => sum + agent.totalChats, 0);

    // Calcular médias
    const averageMessagesPerAgent = processedAgentsData.length > 0 ? 
      Math.round(totalMessages / processedAgentsData.length) : 0;
    const averageMessagesPerChat = totalChats > 0 ? 
      Math.round(totalMessages / totalChats) : 0;

    const stats = {
      totalMessages,
      totalSentMessages,
      totalReceivedMessages,
      totalChats,
      averageMessagesPerAgent,
      averageMessagesPerChat,
      totalAgents: processedAgentsData.length,
      onlineAgents: processedAgentsData.filter(a => a.is_online).length,
      offlineAgents: processedAgentsData.filter(a => !a.is_online).length
    };

    res.json({
      success: true,
      agents: processedAgentsData,
      stats,
      total: processedAgentsData.length
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/dashboard/heatmap-data - Buscar dados para heatmap de atividade
router.get('/heatmap-data', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { organization_id, dateStart, dateEnd } = req.query;
    
    // Usar organization_id do parâmetro ou do usuário autenticado
    const targetOrganizationId = organization_id || user?.organization_id;
    
    if (!targetOrganizationId) {
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }

    // 🎯 VERIFICAR ROLE DO USUÁRIO PARA FILTRAR DADOS SE FOR AGENTE
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

    // Processar datas
    let processedDateStart, processedDateEnd;
    
    if (dateStart && dateEnd) {
      const startDate = new Date(dateStart);
      const endDate = new Date(dateEnd);
      
      // Início do dia (00:00:00.000)
      startDate.setUTCHours(0, 0, 0, 0);
      processedDateStart = startDate.toISOString();
      
      // Fim do dia (23:59:59.999)
      endDate.setUTCHours(23, 59, 59, 999);
      processedDateEnd = endDate.toISOString();
    } else {
      // Fallback: últimos 7 dias
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);
      
      sevenDaysAgo.setUTCHours(0, 0, 0, 0);
      now.setUTCHours(23, 59, 59, 999);
      
      processedDateStart = sevenDaysAgo.toISOString();
      processedDateEnd = now.toISOString();
    }

    // Buscar mensagens com filtro de data e organização
    let messagesQuery = supabase
      .from('messages')
      .select(`
        id,
        created_at,
        chat_id,
        is_from_me,
        organization_id
      `)
      .eq('organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd);
    
    // 🎯 FILTRO POR AGENTE: Se for agente, filtrar mensagens de conversas atribuídas a ele
    if (isAgent) {
      // Buscar IDs das conversas atribuídas ao agente
      const { data: agentChats, error: chatsError } = await supabase
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
    
    // ✅ REMOVIDO: Limite de 1000 - Usar range para buscar todas as mensagens (Supabase limita a 1000 por padrão)
    const { data: messages, error: messagesError } = await messagesQuery.range(0, 999999);

    if (messagesError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do heatmap'
      });
    }

    // Processar dados para heatmap
    const heatmapData = [];
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Inicializar matriz de dados (7 dias x 24 horas) - garantir que todos os valores sejam 0 inicialmente
    const activityMatrix = Array(7).fill(null).map(() => Array(24).fill(0));
    
    // Processar cada mensagem
    messages?.forEach(message => {
      const messageDate = new Date(message.created_at);
      const dayOfWeek = messageDate.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      const hour = messageDate.getHours();
      
      activityMatrix[dayOfWeek][hour]++;
    });
    
    // Converter matriz para formato esperado pelo frontend - SEMPRE gerar todos os pontos
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({
          hour,
          day,
          value: activityMatrix[day][hour], // Pode ser 0, e isso é esperado
          dayName: days[day]
        });
      }
    }

    res.json({
      success: true,
      heatmap: heatmapData,
      total: heatmapData.length,
      period: {
        start: processedDateStart,
        end: processedDateEnd
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/dashboard/trend-data - Buscar dados para tendência temporal
router.get('/trend-data', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { organization_id, dateStart, dateEnd } = req.query;
    
    // Usar organization_id do parâmetro ou do usuário autenticado
    const targetOrganizationId = organization_id || user?.organization_id;
    
    if (!targetOrganizationId) {
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }

    // Processar datas
    let processedDateStart, processedDateEnd;
    
    if (dateStart && dateEnd) {
      const startDate = new Date(dateStart);
      const endDate = new Date(dateEnd);
      
      // Início do dia (00:00:00.000)
      startDate.setUTCHours(0, 0, 0, 0);
      processedDateStart = startDate.toISOString();
      
      // Fim do dia (23:59:59.999)
      endDate.setUTCHours(23, 59, 59, 999);
      processedDateEnd = endDate.toISOString();
    } else {
      // Fallback: últimos 30 dias
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 29);
      
      thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
      now.setUTCHours(23, 59, 59, 999);
      
      processedDateStart = thirtyDaysAgo.toISOString();
      processedDateEnd = now.toISOString();
    }

    // Buscar mensagens com filtro de data e organização
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        created_at,
        is_from_me,
        chat_id,
        chats!inner(organization_id)
      `)
      .eq('chats.organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd);

    if (messagesError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de tendência'
      });
    }

    // Buscar usuários ativos no período (que enviaram mensagens)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        is_online,
        last_seen,
        organization_id
      `)
      .eq('organization_id', targetOrganizationId);

    // Buscar dados de tempo de resposta real
    const { data: responseData, error: responseError } = await supabase
      .from('messages')
      .select(`
        id,
        created_at,
        is_from_me,
        chat_id,
        chats!inner(organization_id)
      `)
      .eq('chats.organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .order('created_at', { ascending: true });

    // Determinar granularidade baseada no período
    const startDate = new Date(processedDateStart);
    const endDate = new Date(processedDateEnd);
    const diffInDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    let trends = [];
    
    if (diffInDays <= 1) {
      // Dados por hora (hoje)
      trends = generateHourlyTrends(messages, users, responseData);
    } else if (diffInDays <= 7) {
      // Dados por dia (semana)
      trends = generateDailyTrends(messages, users, startDate, endDate, responseData);
    } else {
      // Dados por semana (mês)
      trends = generateWeeklyTrends(messages, users, startDate, endDate, responseData);
    }

    res.json({
      success: true,
      trends,
      total: trends.length,
      period: {
        start: processedDateStart,
        end: processedDateEnd,
        granularity: diffInDays <= 1 ? 'hourly' : diffInDays <= 7 ? 'daily' : 'weekly'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Função auxiliar para gerar tendências por hora
function generateHourlyTrends(messages, users, responseData) {
  const trends = [];
  const hourlyData = Array(24).fill(null).map(() => ({
    messages: 0,
    sentMessages: 0,
    receivedMessages: 0,
    activeUsers: new Set(),
    responseTimes: []
  }));

  // Processar mensagens por hora
  messages?.forEach(message => {
    const hour = new Date(message.created_at).getHours();
    hourlyData[hour].messages++;
    
    if (message.is_from_me) {
      hourlyData[hour].sentMessages++;
      // Adicionar usuário ativo
      if (message.user_id) {
        hourlyData[hour].activeUsers.add(message.user_id);
      }
    } else {
      hourlyData[hour].receivedMessages++;
    }
  });

  // Calcular tempos de resposta reais por hora
  if (responseData && responseData.length > 0) {
    const chatMessages = new Map();
    
    // Agrupar mensagens por chat
    responseData.forEach(msg => {
      if (!chatMessages.has(msg.chat_id)) {
        chatMessages.set(msg.chat_id, []);
      }
      chatMessages.get(msg.chat_id).push(msg);
    });

    // Calcular tempos de resposta para cada chat
    chatMessages.forEach(chatMsgs => {
      for (let i = 1; i < chatMsgs.length; i++) {
        const prevMsg = chatMsgs[i - 1];
        const currMsg = chatMsgs[i];
        
        // Se a mensagem anterior foi do cliente e a atual do agente
        if (!prevMsg.is_from_me && currMsg.is_from_me) {
          const responseTime = (new Date(currMsg.created_at) - new Date(prevMsg.created_at)) / 1000; // em segundos
          const hour = new Date(currMsg.created_at).getHours();
          
          if (responseTime > 0 && responseTime < 3600) { // Max 1 hora
            hourlyData[hour].responseTimes.push(responseTime);
          }
        }
      }
    });
  }
  
  // Gerar dados finais
  for (let hour = 0; hour < 24; hour++) {
    const hourData = hourlyData[hour];
    const avgResponseTime = hourData.responseTimes.length > 0 
      ? hourData.responseTimes.reduce((sum, time) => sum + time, 0) / hourData.responseTimes.length
      : 0;
    
    trends.push({
      period: `${hour.toString().padStart(2, '0')}:00`,
      messages: hourData.messages,
      sentMessages: hourData.sentMessages,
      receivedMessages: hourData.receivedMessages,
      activeUsers: hourData.activeUsers.size,
      avgResponseTime: Math.round(avgResponseTime)
    });
  }

  return trends;
}

// Função auxiliar para gerar tendências por dia
function generateDailyTrends(messages, users, startDate, endDate, responseData) {
  const trends = [];
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dailyData = new Map();

  // Inicializar dados para cada dia
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayKey = d.toISOString().split('T')[0];
    dailyData.set(dayKey, {
      messages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      activeUsers: new Set(),
      responseTimes: []
    });
  }

  // Processar mensagens por dia
  messages?.forEach(message => {
    const dayKey = new Date(message.created_at).toISOString().split('T')[0];
    if (dailyData.has(dayKey)) {
      const dayData = dailyData.get(dayKey);
      dayData.messages++;
      
      if (message.is_from_me) {
        dayData.sentMessages++;
        // Adicionar usuário ativo
        if (message.user_id) {
          dayData.activeUsers.add(message.user_id);
        }
      } else {
        dayData.receivedMessages++;
      }
    }
  });

  // Calcular tempos de resposta reais por dia
  if (responseData && responseData.length > 0) {
    const chatMessages = new Map();
    
    // Agrupar mensagens por chat
    responseData.forEach(msg => {
      if (!chatMessages.has(msg.chat_id)) {
        chatMessages.set(msg.chat_id, []);
      }
      chatMessages.get(msg.chat_id).push(msg);
    });

    // Calcular tempos de resposta para cada chat
    chatMessages.forEach(chatMsgs => {
      for (let i = 1; i < chatMsgs.length; i++) {
        const prevMsg = chatMsgs[i - 1];
        const currMsg = chatMsgs[i];
        
        // Se a mensagem anterior foi do cliente e a atual do agente
        if (!prevMsg.is_from_me && currMsg.is_from_me) {
          const responseTime = (new Date(currMsg.created_at) - new Date(prevMsg.created_at)) / 1000; // em segundos
          const dayKey = new Date(currMsg.created_at).toISOString().split('T')[0];
          
          if (dailyData.has(dayKey) && responseTime > 0 && responseTime < 86400) { // Max 1 dia
            dailyData.get(dayKey).responseTimes.push(responseTime);
          }
        }
      }
    });
  }

  // Gerar dados finais
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayKey = d.toISOString().split('T')[0];
    const dayData = dailyData.get(dayKey);
    const avgResponseTime = dayData.responseTimes.length > 0 
      ? dayData.responseTimes.reduce((sum, time) => sum + time, 0) / dayData.responseTimes.length
      : 0;
    
    trends.push({
      period: days[d.getDay()],
      messages: dayData.messages,
      sentMessages: dayData.sentMessages,
      receivedMessages: dayData.receivedMessages,
      activeUsers: dayData.activeUsers.size,
      avgResponseTime: Math.round(avgResponseTime)
    });
  }

  return trends;
}

// Função auxiliar para gerar tendências por semana
function generateWeeklyTrends(messages, users, startDate, endDate, responseData) {
  const trends = [];
  const weeklyData = new Map();

  // Calcular semanas
  let currentWeek = 1;
  let weekStart = new Date(startDate);
  
  while (weekStart <= endDate) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    weeklyData.set(currentWeek, {
      messages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      activeUsers: new Set(),
      responseTimes: [],
      startDate: new Date(weekStart),
      endDate: new Date(weekEnd)
    });
    
    currentWeek++;
    weekStart.setDate(weekStart.getDate() + 7);
  }

  // Processar mensagens por semana
  messages?.forEach(message => {
    const messageDate = new Date(message.created_at);
    
    for (const [weekNum, weekData] of weeklyData.entries()) {
      if (messageDate >= weekData.startDate && messageDate <= weekData.endDate) {
        weekData.messages++;
        
        if (message.is_from_me) {
          weekData.sentMessages++;
          // Adicionar usuário ativo
          if (message.user_id) {
            weekData.activeUsers.add(message.user_id);
          }
        } else {
          weekData.receivedMessages++;
        }
        break;
      }
    }
  });

  // Calcular tempos de resposta reais por semana
  if (responseData && responseData.length > 0) {
    const chatMessages = new Map();
    
    // Agrupar mensagens por chat
    responseData.forEach(msg => {
      if (!chatMessages.has(msg.chat_id)) {
        chatMessages.set(msg.chat_id, []);
      }
      chatMessages.get(msg.chat_id).push(msg);
    });

    // Calcular tempos de resposta para cada chat
    chatMessages.forEach(chatMsgs => {
      for (let i = 1; i < chatMsgs.length; i++) {
        const prevMsg = chatMsgs[i - 1];
        const currMsg = chatMsgs[i];
        
        // Se a mensagem anterior foi do cliente e a atual do agente
        if (!prevMsg.is_from_me && currMsg.is_from_me) {
          const responseTime = (new Date(currMsg.created_at) - new Date(prevMsg.created_at)) / 1000; // em segundos
          const messageDate = new Date(currMsg.created_at);
          
          for (const [weekNum, weekData] of weeklyData.entries()) {
            if (messageDate >= weekData.startDate && messageDate <= weekData.endDate) {
              if (responseTime > 0 && responseTime < 604800) { // Max 1 semana
                weekData.responseTimes.push(responseTime);
              }
              break;
            }
          }
        }
      }
    });
  }

  // Gerar dados finais
  for (const [weekNum, weekData] of weeklyData.entries()) {
    const avgResponseTime = weekData.responseTimes.length > 0 
      ? weekData.responseTimes.reduce((sum, time) => sum + time, 0) / weekData.responseTimes.length
      : 0;
    
    trends.push({
      period: `Semana ${weekNum}`,
      messages: weekData.messages,
      sentMessages: weekData.sentMessages,
      receivedMessages: weekData.receivedMessages,
      activeUsers: weekData.activeUsers.size,
      avgResponseTime: Math.round(avgResponseTime)
    });
  }

  return trends;
}

// GET /api/dashboard/whatsapp-report - Relatório de uso do WhatsApp
router.get('/whatsapp-report', authenticateToken, async (req, res) => {
  try {
    const { user_id, organization_id, dateStart, dateEnd, selectedUser } = req.query;
    
    console.log('📊 [WhatsApp Report] Parâmetros recebidos:', {
      user_id,
      organization_id,
      dateStart,
      dateEnd,
      selectedUser
    });

    // Validar organização
    const targetOrganizationId = organization_id || req.user?.organization_id;
    if (!targetOrganizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID é obrigatório'
      });
    }

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

    console.log('📅 [WhatsApp Report] Período processado:', {
      processedDateStart,
      processedDateEnd
    });

    // 🎯 BUSCAR COUNT TOTAL DE MENSAGENS (contorna limite de 1000 do Supabase)
    let countQuery = supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null);

    // Aplicar filtro por usuário se especificado
    if (selectedUser && selectedUser !== 'all') {
      countQuery = countQuery.eq('user_id', selectedUser);
    }

    const { count: totalMessagesCount, error: countError } = await countQuery;

    if (countError) {
      console.error('❌ Erro ao contar mensagens:', countError);
    }

    console.log(`📊 [WhatsApp Report] Total de mensagens encontradas (count): ${totalMessagesCount || 0}`);

    // 🎯 BUSCAR AMOSTRA DE MENSAGENS PARA PROCESSAMENTO
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
        metadata,
        chats(id, name, whatsapp_jid, assigned_agent_id, platform, status, department, priority, created_at, last_message_at)
      `)
      .eq('organization_id', targetOrganizationId)
      .gte('created_at', processedDateStart)
      .lte('created_at', processedDateEnd)
      .not('content', 'is', null)
      .limit(10000); // Limite maior para melhor amostragem

    // Aplicar filtro por usuário se especificado
    if (selectedUser && selectedUser !== 'all') {
      messagesQuery = messagesQuery.eq('user_id', selectedUser);
    }

    const { data: foundMessages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar mensagens'
      });
    }

    const messages = foundMessages || [];
    console.log('🔍 [WhatsApp Report] Amostra de mensagens encontradas:', messages.length);

    // Retornar dados com count real
    res.json({
      success: true,
      data: {
        messages: messages,
        totalCount: totalMessagesCount || 0, // Count real das mensagens
        sampleSize: messages.length,
        period: {
          start: processedDateStart,
          end: processedDateEnd
        },
        filters: {
          organization_id: targetOrganizationId,
          selectedUser: selectedUser || 'all'
        }
      }
    });

  } catch (error) {
    console.error('❌ [WhatsApp Report] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

export default router; 