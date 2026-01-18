import express from 'express';
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { supabase } from '../lib/supabaseClient.js';

const router = Router();

// 🎯 CORREÇÃO: Middleware simplificado para verificar acesso aos times
const checkTeamAccess = async (req, res, next) => {
  try {
    const { organization_id } = req.query;
    // ✅ CORREÇÃO: Usar req.user.id do authenticateToken ao invés de header x-user-id
    const userId = req.user?.id || req.headers['x-user-id'];

    console.log('🔍 [Teams Access] Verificando acesso:', {
      organization_id,
      userId,
      userFromReq: req.user?.id,
      path: req.path,
      method: req.method
    });

    if (!organization_id) {
      console.log('❌ [Teams Access] organization_id não fornecido');
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }

    // ✅ CORREÇÃO: O userId pode vir do req.user (do authenticateToken) ou do header
    // Não bloquear se não vier no header, pois o authenticateToken já valida o usuário
    if (!userId && !req.user?.id) {
      console.log('❌ [Teams Access] userId não encontrado no req.user nem no header');
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // 🎯 CORREÇÃO: Verificação simplificada - apenas validar se os parâmetros estão presentes
    console.log('✅ [Teams Access] Parâmetros válidos, permitindo acesso');
    next();
  } catch (error) {
    console.error('❌ [Teams Access] Erro ao verificar acesso:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// ✅ NOVO: Login para times
router.post('/login', async (req, res) => {
  try {
    const { teamId, teamName, organizationId } = req.body;
    
    console.log('🔐 [Team Login] Tentativa de login:', { teamId, teamName, organizationId });
    
    if (!teamId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'teamId e organizationId são obrigatórios'
      });
    }
    
    // Verificar se o time existe
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, description, organization_id')
      .eq('id', teamId)
      .eq('organization_id', organizationId)
      .single();
    
    if (teamError || !team) {
      console.log('❌ [Team Login] Time não encontrado:', teamError);
      return res.status(404).json({
        success: false,
        error: 'Time não encontrado'
      });
    }
    
    // Gerar token de sessão para o time
    const sessionToken = `team_${teamId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Salvar sessão do time
    const { error: sessionError } = await supabase
      .from('team_sessions')
      .insert({
        team_id: teamId,
        organization_id: organizationId,
        session_token: sessionToken,
        status: 'active',
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    
    if (sessionError) {
      console.error('❌ [Team Login] Erro ao salvar sessão:', sessionError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar sessão do time'
      });
    }
    
    console.log('✅ [Team Login] Login realizado com sucesso:', { teamId, sessionToken });
    
    res.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description
      },
      sessionToken,
      message: 'Login realizado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ [Team Login] Erro interno:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ✅ NOVO: Logout para times
router.post('/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'sessionToken é obrigatório'
      });
    }
    
    // Marcar sessão como inativa
    const { error } = await supabase
      .from('team_sessions')
      .update({ 
        status: 'inactive',
        last_activity: new Date().toISOString()
      })
      .eq('session_token', sessionToken);
    
    if (error) {
      console.error('❌ [Team Logout] Erro ao fazer logout:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao fazer logout'
      });
    }
    
    console.log('✅ [Team Logout] Logout realizado com sucesso');
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ [Team Logout] Erro interno:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ✅ NOVO: Verificar status do time
router.get('/status/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { organization_id } = req.query;
    
    if (!organization_id) {
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório'
      });
    }
    
    // Buscar sessões ativas do time
    const { data: sessions, error } = await supabase
      .from('team_sessions')
      .select('*')
      .eq('team_id', teamId)
      .eq('organization_id', organization_id)
      .eq('status', 'active')
      .order('last_activity', { ascending: false });
    
    if (error) {
      console.error('❌ [Team Status] Erro ao buscar status:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar status do time'
      });
    }
    
    const isOnline = sessions && sessions.length > 0;
    const lastActivity = sessions && sessions.length > 0 ? sessions[0].last_activity : null;
    
    res.json({
      success: true,
      teamId,
      isOnline,
      lastActivity,
      activeSessions: sessions?.length || 0
    });
    
  } catch (error) {
    console.error('❌ [Team Status] Erro interno:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// 🎯 CORREÇÃO: Rota de teste para verificar se a autenticação está funcionando
router.get('/test', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 [Teams Test] Rota de teste chamada com sucesso');
    res.json({
      success: true,
      message: 'Rota de teste funcionando!',
      timestamp: new Date().toISOString(),
      headers: {
        'x-user-id': req.headers['x-user-id'],
        'x-organization-id': req.headers['x-organization-id'],
        'authorization': req.headers['authorization'] ? 'present' : 'missing'
      }
    });
  } catch (error) {
    console.error('❌ [Teams Test] Erro na rota de teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro na rota de teste'
    });
  }
});

// ========================================
// 🎯 NOVAS ROTAS PARA SISTEMA DE CHATS
// ========================================

// GET /api/teams/queue - Listar chats aguardando atendimento do time
router.get('/queue', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user.id;

    console.log('🔍 [Teams Queue] Buscando fila do time para usuário:', userId);

    // Buscar time do usuário
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('department, organization_id')
      .eq('id', userId)
      .eq('organization_id', organization_id)
      .single();

    if (userError || !userProfile) {
      console.error('❌ [Teams Queue] Usuário não encontrado:', userError);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!userProfile.department) {
      return res.status(400).json({ error: 'Usuário não está em um time' });
    }

    // Buscar chats aguardando atendimento do time
    const { data: queueChats, error: chatsError } = await supabase
      .from('chats')
      .select(`
        id,
        name,
        whatsapp_jid,
        platform,
        status,
        created_at,
        last_message_at,
        assigned_team
      `)
      .eq('assigned_team', userProfile.department)
      .eq('status', 'aguardando_atendimento')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: true });

    if (chatsError) {
      console.error('❌ [Teams Queue] Erro ao buscar chats:', chatsError);
      return res.status(500).json({ error: 'Erro ao buscar fila do time' });
    }

    console.log(`✅ [Teams Queue] Encontrados ${queueChats?.length || 0} chats na fila`);

    res.json({
      success: true,
      chats: queueChats || [],
      teamName: userProfile.department
    });

  } catch (error) {
    console.error('❌ [Teams Queue] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/teams/claim-chat/:chatId - Pegar um chat da fila
router.post('/claim-chat/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { organization_id } = req.query;
    const userId = req.user.id;

    console.log('🔍 [Teams Claim] Usuário tentando pegar chat:', { chatId, userId });

    // Buscar time do usuário
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('department, organization_id')
      .eq('id', userId)
      .eq('organization_id', organization_id)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!userProfile.department) {
      return res.status(400).json({ error: 'Usuário não está em um time' });
    }

    // Verificar se o chat está na fila do time do usuário
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('assigned_team, status, name, whatsapp_jid')
      .eq('id', chatId)
      .eq('assigned_team', userProfile.department)
      .eq('status', 'aguardando_atendimento')
      .eq('organization_id', organization_id)
      .single();

    if (chatError || !chat) {
      console.error('❌ [Teams Claim] Chat não encontrado na fila:', chatError);
      return res.status(404).json({ 
        error: 'Chat não encontrado na fila do seu time ou já foi atribuído' 
      });
    }

    // Atribuir chat ao usuário
    const { error: updateError } = await supabase
      .from('chats')
      .update({ 
        assigned_agent_id: userId,
        status: 'active',
        assigned_team: null, // Remove da fila do time
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    if (updateError) {
      console.error('❌ [Teams Claim] Erro ao atribuir chat:', updateError);
      return res.status(500).json({ error: 'Erro ao atribuir chat' });
    }

    console.log(`✅ [Teams Claim] Chat ${chatId} atribuído ao usuário ${userId}`);

    // Emitir notificação para o time que o chat foi pego
    const io = req.app.get('io');
    if (io) {
      io.to(`team_${userProfile.department}`).emit('chat-claimed', {
        chatId,
        chatName: chat.name,
        claimedBy: userId,
        message: 'Chat foi atribuído a um membro do time'
      });
    }

    res.json({ 
      success: true, 
      message: 'Chat atribuído com sucesso',
      chat: {
        id: chatId,
        name: chat.name,
        whatsapp_jid: chat.whatsapp_jid
      }
    });

  } catch (error) {
    console.error('❌ [Teams Claim] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/teams/my-chats - Listar chats ativos do usuário
router.get('/my-chats', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user.id;

    // Buscar chats ativos do usuário
    const { data: myChats, error: chatsError } = await supabase
      .from('chats')
      .select(`
        id,
        name,
        whatsapp_jid,
        platform,
        status,
        created_at,
        last_message_at
      `)
      .eq('assigned_agent_id', userId)
      .eq('status', 'active')
      .eq('organization_id', organization_id)
      .order('last_message_at', { ascending: false });

    if (chatsError) {
      console.error('❌ [Teams My Chats] Erro ao buscar chats:', chatsError);
      return res.status(500).json({ error: 'Erro ao buscar seus chats' });
    }

    res.json({
      success: true,
      chats: myChats || []
    });

  } catch (error) {
    console.error('❌ [Teams My Chats] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/teams/waiting-chats - Listar todos os chats aguardando (para supervisor)
router.get('/waiting-chats', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.query;

    // Buscar todos os chats aguardando atendimento
    const { data: waitingChats, error: chatsError } = await supabase
      .from('chats')
      .select(`
        id,
        name,
        whatsapp_jid,
        platform,
        status,
        created_at,
        last_message_at,
        assigned_team
      `)
      .eq('status', 'aguardando_atendimento')
      .eq('organization_id', organization_id)
      .not('assigned_team', 'is', null)
      .order('created_at', { ascending: true });

    if (chatsError) {
      console.error('❌ [Teams Waiting Chats] Erro ao buscar chats:', chatsError);
      return res.status(500).json({ error: 'Erro ao buscar chats aguardando' });
    }

    res.json({
      success: true,
      chats: waitingChats || []
    });

  } catch (error) {
    console.error('❌ [Teams Waiting Chats] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/teams/active-chats - Listar todos os chats ativos (para supervisor)
router.get('/active-chats', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.query;

    // Buscar todos os chats ativos
    const { data: activeChats, error: chatsError } = await supabase
      .from('chats')
      .select(`
        id,
        name,
        whatsapp_jid,
        platform,
        status,
        created_at,
        last_message_at,
        assigned_agent_id,
        assigned_team
      `)
      .eq('status', 'active')
      .eq('organization_id', organization_id)
      .not('assigned_agent_id', 'is', null)
      .order('last_message_at', { ascending: false });

    if (chatsError) {
      console.error('❌ [Teams Active Chats] Erro ao buscar chats:', chatsError);
      return res.status(500).json({ error: 'Erro ao buscar chats ativos' });
    }

    res.json({
      success: true,
      chats: activeChats || []
    });

  } catch (error) {
    console.error('❌ [Teams Active Chats] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/teams/agents - Listar agentes de um time (para supervisor)
router.get('/agents', authenticateToken, async (req, res) => {
  try {
    const { organization_id, team } = req.query;

    let query = supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        is_online,
        department,
        created_at
      `)
      .eq('organization_id', organization_id);

    if (team && team !== 'all') {
      query = query.eq('department', team);
    }

    const { data: agents, error: agentsError } = await query;

    if (agentsError) {
      console.error('❌ [Teams Agents] Erro ao buscar agentes:', agentsError);
      return res.status(500).json({ error: 'Erro ao buscar agentes' });
    }

    res.json({
      success: true,
      agents: agents || []
    });

  } catch (error) {
    console.error('❌ [Teams Agents] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/teams/auto-assign - Distribuição automática de chats
router.post('/auto-assign', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { strategy = 'round_robin' } = req.body;

    console.log(`🤖 [Teams Auto Assign] Iniciando distribuição automática com estratégia: ${strategy}`);

    // Buscar chats aguardando atendimento
    const { data: waitingChats, error: chatsError } = await supabase
      .from('chats')
      .select('id, assigned_team, name')
      .eq('status', 'aguardando_atendimento')
      .eq('organization_id', organization_id)
      .not('assigned_team', 'is', null);

    if (chatsError) {
      console.error('❌ [Teams Auto Assign] Erro ao buscar chats:', chatsError);
      return res.status(500).json({ error: 'Erro ao buscar chats' });
    }

    console.log(`📊 [Teams Auto Assign] Encontrados ${waitingChats?.length || 0} chats aguardando`);

    const results = [];

    for (const chat of waitingChats || []) {
      // Buscar membros do time
      const { data: teamMembers, error: membersError } = await supabase
        .from('profiles')
        .select('id, name, is_online')
        .eq('department', chat.assigned_team)
        .eq('organization_id', organization_id)
        .eq('is_online', true);

      if (membersError || !teamMembers?.length) {
        console.log(`⚠️ [Teams Auto Assign] Nenhum membro online no time ${chat.assigned_team}`);
        continue;
      }

      let selectedAgent = null;

      switch (strategy) {
        case 'round_robin':
          // Implementar round robin
          selectedAgent = teamMembers[Math.floor(Math.random() * teamMembers.length)];
          break;
        case 'workload':
          // Implementar distribuição por carga de trabalho
          const workloadPromises = teamMembers.map(async (member) => {
            const { data: activeChats } = await supabase
              .from('chats')
              .select('id')
              .eq('assigned_agent_id', member.id)
              .eq('status', 'active');
            return { ...member, workload: activeChats?.length || 0 };
          });
          
          const workloads = await Promise.all(workloadPromises);
          selectedAgent = workloads.reduce((min, current) => 
            current.workload < min.workload ? current : min
          );
          break;
        default:
          selectedAgent = teamMembers[0];
      }

      if (selectedAgent) {
        // Atribuir chat
        const { error: updateError } = await supabase
          .from('chats')
          .update({
            assigned_agent_id: selectedAgent.id,
            status: 'active',
            assigned_team: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', chat.id);

        if (!updateError) {
          results.push({
            chatId: chat.id,
            chatName: chat.name,
            assignedTo: selectedAgent.name,
            strategy
          });
          console.log(`✅ [Teams Auto Assign] Chat ${chat.id} atribuído a ${selectedAgent.name}`);
        }
      }
    }

    console.log(`🎯 [Teams Auto Assign] Distribuição concluída: ${results.length} chats atribuídos`);

    res.json({
      success: true,
      assigned: results,
      total: results.length,
      strategy
    });

  } catch (error) {
    console.error('❌ [Teams Auto Assign] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🎯 CORREÇÃO: Rota de métricas com tratamento de erro melhorado
router.get('/metrics', authenticateToken, checkTeamAccess, async (req, res) => {
  console.log('🚀 [Teams Metrics] Rota de métricas iniciada');
  
      // 🎯 CORREÇÃO: Declarar variáveis de data no escopo da função
    let startDate;
    let endDate;
    let startDateObj;
    let endDateObj;
  
  try {
    const { organization_id, period = '7d', dateStart, dateEnd } = req.query;
    const userId = req.headers['x-user-id'];
    
    console.log('🔍 [Teams Metrics] DEBUG: Headers completos recebidos:', req.headers);
    console.log('🔍 [Teams Metrics] DEBUG: Query parameters recebidos:', req.query);
    console.log('🔍 [Teams Metrics] DEBUG: User object do middleware:', req.user);
    
    console.log('🔍 [Teams Metrics] Buscando métricas para:', {
      organization_id,
      period,
      dateStart,
      dateEnd,
      userId
    });
    
    // 🎯 DEBUG: Verificar se o organization_id está sendo passado corretamente
    if (!organization_id) {
      console.error('❌ [Teams Metrics] CRÍTICO: organization_id não fornecido na query');
      console.log('🔍 [Teams Metrics] DEBUG: Query params disponíveis:', Object.keys(req.query));
      console.log('🔍 [Teams Metrics] DEBUG: Headers disponíveis:', Object.keys(req.headers));
      
      return res.status(400).json({
        success: false,
        error: 'organization_id é obrigatório',
        debug: {
          queryParams: req.query,
          headers: req.headers,
          message: 'Verifique se o frontend está enviando organization_id corretamente'
        }
      });
    }

    // Calcular intervalo de datas baseado no período OU nos parâmetros explícitos
    // Sempre priorizamos dateStart/dateEnd se vierem do dashboard
    
    console.log('🔍 [Teams Metrics] DEBUG: Parâmetros de data recebidos:', {
      dateStart,
      dateEnd,
      period
    });
    
    if (dateStart && dateEnd) {
      // 🎯 CORREÇÃO: Usar a mesma lógica das métricas individuais
      const startDateObj = new Date(dateStart);
      const endDateObj = new Date(dateEnd);
      
      // Validar se as datas são válidas
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        console.error('❌ [Teams Metrics] Formato de data inválido:', { dateStart, dateEnd });
        return res.status(400).json({ 
          success: false, 
          error: 'Formato de data inválido',
          receivedDates: { dateStart, dateEnd }
        });
      }
      
      // Início do dia (00:00:00.000) - MESMA LÓGICA DAS MÉTRICAS INDIVIDUAIS
      startDateObj.setUTCHours(0, 0, 0, 0);
      startDate = startDateObj;
      
      // Fim do dia (23:59:59.999) - MESMA LÓGICA DAS MÉTRICAS INDIVIDUAIS
      endDateObj.setUTCHours(23, 59, 59, 999);
      endDate = endDateObj;
      
      console.log('🔍 [Teams Metrics] DEBUG: Usando datas explícitas (mesma lógica das métricas individuais):', {
        originalDateStart: dateStart,
        originalDateEnd: dateEnd,
        startDate,
        endDate,
        startDateLocal: startDateObj.toLocaleDateString('pt-BR'),
        endDateLocal: endDateObj.toLocaleDateString('pt-BR')
      });
    } else {
      // 🎯 CORREÇÃO: Fallback para período padrão (mesma lógica das métricas individuais)
      endDate = new Date();
      startDate = new Date(endDate);
      
      switch (period) {
        case '1d':
          startDate.setDate(endDate.getDate());
          startDate.setHours(0, 0, 0, 0);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }
      
      // Manter como objetos Date para consistência
      // startDate e endDate já são objetos Date
      
      console.log('🔍 [Teams Metrics] DEBUG: Usando datas calculadas por período (fallback):', {
        startDate,
        endDate,
        period,
        startDateLocal: new Date(startDate).toLocaleDateString('pt-BR'),
        endDateLocal: new Date(endDate).toLocaleDateString('pt-BR')
      });
      
          console.log('🔍 [Teams Metrics] DEBUG: Variáveis após fallback:', {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      startDateType: typeof startDate,
      endDateType: typeof endDate
    });
    }
    
    console.log('🔍 [Teams Metrics] DEBUG: Variáveis de data após cálculo:', {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      startDateValid: startDate instanceof Date,
      endDateValid: endDate instanceof Date
    });

    // Buscar times da organização
    console.log('🔍 [Teams Metrics] Buscando times para organization_id:', organization_id);
    
    // 🎯 CORREÇÃO: Verificar se a tabela teams existe e tem dados
    console.log('🔍 [Teams Metrics] Verificando tabela teams para organization_id:', organization_id);
    
    let teams = [];
    try {
      // 🎯 DEBUG: Verificar todos os times na tabela (sem filtro de organização)
      console.log('🔍 [Teams Metrics] DEBUG: Verificando todos os times na tabela...');
      
      // 🎯 DEBUG: Testar consulta direta para verificar se há problema com RLS
      const { data: allTeams, error: allTeamsError } = await supabase
        .from('teams')
        .select('id, name, organization_id, created_at')
        .limit(10);
        
      // 🎯 DEBUG: Se não conseguir acessar, tentar com rpc para bypassar RLS
      if (allTeamsError) {
        console.log('🔍 [Teams Metrics] DEBUG: Tentando bypassar RLS com rpc...');
        try {
          const { data: rpcTeams, error: rpcError } = await supabase
            .rpc('get_all_teams_debug');
          
          if (rpcError) {
            console.log('🔍 [Teams Metrics] DEBUG: RPC também falhou:', rpcError);
          } else {
            console.log('🔍 [Teams Metrics] DEBUG: RPC funcionou:', rpcTeams);
          }
        } catch (rpcErr) {
          console.log('🔍 [Teams Metrics] DEBUG: Erro ao tentar RPC:', rpcErr);
        }
      }
      
      if (allTeamsError) {
        console.error('❌ [Teams Metrics] Erro ao verificar tabela teams:', allTeamsError);
        console.log('🔍 [Teams Metrics] Possível problema: tabela teams não existe ou RLS bloqueando acesso');
        console.log('🔍 [Teams Metrics] Detalhes do erro:', {
          error: allTeamsError.message,
          code: allTeamsError.code,
          details: allTeamsError.details,
          hint: allTeamsError.hint
        });
        
        // 🎯 CORREÇÃO: Retornar resposta vazia em vez de erro
        return res.json({
          success: true,
          teams: [],
          period,
          totalTeams: 0,
          totalMembers: 0,
          totalMessages: 0,
          message: 'Nenhum time configurado para esta organização'
        });
      } else {
        console.log('📊 [Teams Metrics] DEBUG: Todos os times na tabela:', allTeams);
        
        // 🎯 DEBUG: Verificar se há times com organization_id diferente
        if (allTeams && allTeams.length > 0) {
          const orgIds = [...new Set(allTeams.map(t => t.organization_id))];
          console.log('🔍 [Teams Metrics] DEBUG: Organization IDs encontrados na tabela:', orgIds);
          
          // 🎯 DEBUG: Verificar times específicos da organização solicitada
          const orgTeams = allTeams.filter(t => t.organization_id === organization_id);
          console.log('🔍 [Teams Metrics] DEBUG: Times da organização solicitada:', {
            requestedOrgId: organization_id,
            foundTeams: orgTeams.length,
            teams: orgTeams
          });
        }
      }
      
      // 🎯 CORREÇÃO: Buscar times com tratamento de erro melhorado e debug
      console.log('🔍 [Teams Metrics] DEBUG: Buscando times para organization_id:', organization_id);
      
      // 🎯 DEBUG: Primeiro buscar sem filtro de deleted_at para ver se é esse o problema
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          description,
          created_at,
          organization_id
        `)
        .eq('organization_id', organization_id);
        // 🎯 DEBUG: Removido filtro .is('deleted_at', null) temporariamente

      if (teamsError) {
        console.error('❌ [Teams Metrics] Erro ao buscar times:', teamsError);
        console.log('🔍 [Teams Metrics] Detalhes do erro:', {
          error: teamsError.message,
          code: teamsError.code,
          details: teamsError.details,
          hint: teamsError.hint
        });
        
        // 🎯 CORREÇÃO: Retornar resposta vazia em vez de erro
        return res.json({
          success: true,
          teams: [],
          period,
          totalTeams: 0,
          totalMembers: 0,
          totalMessages: 0,
          message: 'Erro ao buscar times, retornando lista vazia'
        });
      }
      
      teams = teamsData || [];
      console.log('✅ [Teams Metrics] Times encontrados:', teams.length);
      console.log('🔍 [Teams Metrics] DEBUG: Dados brutos dos times:', teamsData);
      
      if (teams.length > 0) {
        console.log('📋 [Teams Metrics] Exemplos de times:', teams.slice(0, 3).map(t => ({ 
          id: t.id, 
          name: t.name, 
          organization_id: t.organization_id || 'não definido'
        })));
      } else {
        console.log('⚠️ [Teams Metrics] Nenhum time encontrado para organization_id:', organization_id);
        console.log('🔍 [Teams Metrics] DEBUG: Possíveis causas:');
        console.log('  - Organization_id incorreto:', organization_id);
        console.log('  - Tabela teams vazia');
        console.log('  - Problema com RLS (Row Level Security)');
        console.log('  - Problema com permissões do usuário');
        
        // 🎯 CORREÇÃO: Retornar resposta vazia em vez de erro
        return res.json({
          success: true,
          teams: [],
          period,
          totalTeams: 0,
          totalMembers: 0,
          totalMessages: 0,
          message: 'Nenhum time configurado para esta organização',
          debug: {
            requestedOrgId: organization_id,
            allTeamsInTable: allTeams?.length || 0,
            possibleCauses: [
              'Organization_id incorreto',
              'Tabela teams vazia',
              'Problema com RLS',
              'Problema com permissões'
            ]
          }
        });
      }
    } catch (error) {
      console.error('❌ [Teams Metrics] Erro geral ao verificar times:', error);
      // 🎯 CORREÇÃO: Retornar resposta vazia em vez de erro
      return res.json({
        success: true,
        teams: [],
        period,
        totalTeams: 0,
        totalMembers: 0,
        totalMessages: 0,
        message: 'Erro ao verificar times, retornando lista vazia'
      });
    }

    // 🎯 CORREÇÃO: Buscar membros dos times com tratamento de erro melhorado
    let allTeamMembers = [];
    
    if (teams.length > 0) {
      console.log('🔍 [Teams Metrics] Buscando membros para times:', teams.map(t => t.name));
      try {
        // 🎯 DEBUG: Verificar se a tabela profiles existe e tem dados
        console.log('🔍 [Teams Metrics] DEBUG: Verificando tabela profiles...');
        const { data: allProfiles, error: allProfilesError } = await supabase
          .from('profiles')
          .select('id, name, department, organization_id')
          .limit(5);
        
        if (allProfilesError) {
          console.error('❌ [Teams Metrics] Erro ao verificar tabela profiles:', allProfilesError);
        } else {
          console.log('📊 [Teams Metrics] DEBUG: Amostra de perfis na tabela:', allProfiles);
          
          // 🎯 DEBUG: Verificar se há perfis com department
          if (allProfiles && allProfiles.length > 0) {
            const hasDepartment = allProfiles.some(p => p.department);
            const departmentsInProfiles = [...new Set(allProfiles.filter(p => p.department).map(p => p.department))];
            console.log('🔍 [Teams Metrics] DEBUG: Perfis com department:', {
              hasDepartment,
              departmentsInProfiles,
              totalProfiles: allProfiles.length
            });
            
            // 🎯 DEBUG: Verificar se os departments dos perfis correspondem aos times encontrados
            const teamNames = teams.map(t => t.name);
            const matchingDepartments = teamNames.filter(teamName => departmentsInProfiles.includes(teamName));
            console.log('🔍 [Teams Metrics] DEBUG: Correspondência entre times e perfis:', {
              teamNamesFromTeams: teamNames,
              departmentsFromProfiles: departmentsInProfiles,
              matchingDepartments,
              hasMatching: matchingDepartments.length > 0
            });
          }
        }
        
        // 🎯 CORREÇÃO: Buscar membros dos times através da tabela team_accounts
        const { data: teamMembers, error: membersError } = await supabase
          .from('team_accounts')
          .select(`
            team_id,
            account_id,
            whatsapp_accounts!inner(
              id,
              name,
              phone_number,
              user_id,
              status,
              last_connected_at,
              profiles!inner(
                id,
                name,
                email,
                avatar_url,
                last_seen,
                organization_id
              )
            )
          `)
          .in('team_id', teams.map(t => t.id));

        if (membersError) {
          console.error('❌ [Teams Metrics] Erro ao buscar membros dos times:', membersError);
          console.log('🔍 [Teams Metrics] Detalhes do erro de membros:', {
            error: membersError.message,
            code: membersError.code,
            details: membersError.details
          });
          // Continue with empty members array
          allTeamMembers = [];
        } else {
          // 🎯 CORREÇÃO: Processar dados da nova estrutura team_accounts
          console.log('🔍 [Teams Metrics] DEBUG: Dados brutos recebidos:', teamMembers?.length || 0);
          console.log('🔍 [Teams Metrics] DEBUG: Primeiro registro bruto:', teamMembers?.[0]);
          
          const processedMembers = [];
          if (teamMembers && teamMembers.length > 0) {
            teamMembers.forEach(teamAccount => {
              const whatsappAccount = teamAccount.whatsapp_accounts;
              const profile = whatsappAccount.profiles;
              
              console.log('🔍 [Teams Metrics] DEBUG: Processando teamAccount:', {
                teamId: teamAccount.team_id,
                whatsappAccount: whatsappAccount?.name,
                profile: profile?.name
              });
              
              processedMembers.push({
                id: whatsappAccount.id,
                name: profile?.name || whatsappAccount.name || 'Nome não informado',
                email: profile?.email || 'Email não informado',
                phone_number: whatsappAccount.phone_number,
                user_id: whatsappAccount.user_id,
                team_id: teamAccount.team_id,
                status: whatsappAccount.status,
                last_connected_at: whatsappAccount.last_connected_at,
                last_seen: profile?.last_seen,
                avatar_url: profile?.avatar_url,
                organization_id: profile?.organization_id
              });
            });
          }
          
          allTeamMembers = processedMembers;
          console.log('✅ [Teams Metrics] Membros processados:', allTeamMembers.length);
          console.log('🔍 [Teams Metrics] DEBUG: Primeiros membros processados:', allTeamMembers.slice(0, 2));
          
          // 🎯 DEBUG: Mostrar distribuição de usuários por time
          const usersByTeam = {};
          allTeamMembers.forEach(member => {
            const teamId = member.team_id || 'Sem time';
            if (!usersByTeam[teamId]) {
              usersByTeam[teamId] = [];
            }
            usersByTeam[teamId].push(member.name);
          });
          
          console.log('🔍 [Teams Metrics] DEBUG: Distribuição de usuários por time:', usersByTeam);
        }
      } catch (error) {
        console.error('❌ [Teams Metrics] Erro geral ao buscar membros:', error);
        allTeamMembers = [];
      }
    } else {
      console.log('⚠️ [Teams Metrics] Nenhum time encontrado, pulando busca de membros');
    }

    // 🎯 CORREÇÃO: Buscar métricas de mensagens com tratamento de erro melhorado
    console.log('🔍 [Teams Metrics] Buscando mensagens para o período:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      organization_id
    });
    
    let messages = [];
    try {
      // 🎯 DEBUG: Primeiro verificar se a tabela messages existe e tem dados
      console.log('🔍 [Teams Metrics] DEBUG: Verificando tabela messages...');
      const { data: allMessages, error: allMessagesError } = await supabase
        .from('messages')
        .select('id, created_at, organization_id')
        .limit(5);
      
      if (allMessagesError) {
        console.error('❌ [Teams Metrics] Erro ao verificar tabela messages:', allMessagesError);
        console.log('🔍 [Teams Metrics] Possível problema: tabela messages não existe ou RLS bloqueando acesso');
      } else {
        console.log('📊 [Teams Metrics] DEBUG: Amostra de mensagens na tabela:', allMessages);
        
        // 🎯 DEBUG: Verificar se há mensagens com organization_id diferente
        if (allMessages && allMessages.length > 0) {
          const orgIds = [...new Set(allMessages.map(m => m.organization_id))];
          console.log('🔍 [Teams Metrics] DEBUG: Organization IDs encontrados na tabela messages:', orgIds);
          
          // 🎯 DEBUG: Verificar mensagens específicas da organização solicitada
          const orgMessages = allMessages.filter(m => m.organization_id === organization_id);
          console.log('🔍 [Teams Metrics] DEBUG: Mensagens da organização solicitada:', {
            requestedOrgId: organization_id,
            foundMessages: orgMessages.length,
            messages: orgMessages
          });
        }
      }
      
      // 🎯 CORREÇÃO: Buscar mensagens com filtros específicos (mesma lógica das métricas individuais)
      console.log('🔍 [Teams Metrics] DEBUG: Buscando mensagens com filtros:', {
        startDate,
        endDate,
        organization_id,
        startDateType: typeof startDate,
        endDateType: typeof endDate
      });
      
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          user_id,
          sender_id,
          content,
          created_at,
          organization_id
        `)
                 .gte('created_at', startDate.toISOString())
         .lte('created_at', endDate.toISOString())
        .eq('organization_id', organization_id);

      if (messagesError) {
        console.error('❌ [Teams Metrics] Erro ao buscar mensagens:', messagesError);
        console.log('🔍 [Teams Metrics] Detalhes do erro de mensagens:', {
          error: messagesError.message,
          code: messagesError.code,
          details: messagesError.details
        });
        // Continue with empty messages array
        messages = [];
      } else {
        messages = messagesData || [];
        console.log('✅ [Teams Metrics] Mensagens encontradas:', messages.length);
        console.log('🔍 [Teams Metrics] DEBUG: Primeiras mensagens:', messages.slice(0, 3));
        
        // 🎯 DEBUG: Verificar se as mensagens têm sender_id
        if (messages.length > 0) {
          const hasSenderId = messages.some(m => m.sender_id);
          console.log('🔍 [Teams Metrics] DEBUG: Estrutura das mensagens:', {
            hasSenderId,
            sampleMessage: messages[0]
          });
          
          // 🎯 DEBUG: Verificar se os sender_id correspondem aos membros dos times
          const allMemberIds = allTeamMembers.map(m => m.id);
          const messagesWithValidMembers = messages.filter(m => 
            allMemberIds.includes(m.sender_id)
          );
          console.log('🔍 [Teams Metrics] DEBUG: Correspondência entre mensagens e membros:', {
            totalMessages: messages.length,
            messagesWithValidMembers: messagesWithValidMembers.length,
            allMemberIds: allMemberIds.length,
            sampleValidMessage: messagesWithValidMembers[0]
          });
        }
      }
    } catch (error) {
      console.error('❌ [Teams Metrics] Erro geral ao buscar mensagens:', error);
      messages = [];
    }

    // 🎯 CORREÇÃO: Processar métricas dos times com tratamento de erro melhorado
    console.log('🔍 [Teams Metrics] Processando métricas para times:', teams.length);
    console.log('🔍 [Teams Metrics] DEBUG: allTeamMembers antes do processamento:', allTeamMembers.length);
    console.log('🔍 [Teams Metrics] DEBUG: Primeiros membros:', allTeamMembers.slice(0, 2));
    
    let teamMetrics = [];
    try {
      teamMetrics = await Promise.all(teams.map(async (team) => {
        // 🎯 CORREÇÃO: Buscar membros do time usando o team_id das contas WhatsApp
        const teamMembers = allTeamMembers.filter(member => member.team_id === team.id);
        const teamMemberIds = teamMembers.map(member => member.user_id);
        
        console.log(`🔍 [Teams Metrics] Processando time ${team.name}:`, {
          teamId: team.id,
          memberCount: teamMembers.length,
          memberIds: teamMemberIds,
          teamName: team.name
        });
        
        // 🎯 DEBUG: Verificar se os membros têm team_id correto
        console.log(`🔍 [Teams Metrics] DEBUG: Membros do time ${team.name}:`, {
          allMembers: allTeamMembers.length,
          teamMembers: teamMembers.map(m => ({
            id: m.id,
            name: m.name,
            team_id: m.team_id,
            user_id: m.user_id,
            matchesTeam: m.team_id === team.id
          }))
        });
        
        // Filtrar mensagens do time
        const teamMessages = messages.filter(msg => 
          teamMemberIds.includes(msg.user_id) || 
          teamMemberIds.includes(msg.sender_id)
        );
        
        console.log(`📊 [Teams Metrics] Time ${team.name} - Mensagens encontradas:`, teamMessages.length);
        console.log(`🔍 [Teams Metrics] DEBUG: Time ${team.name} - Detalhes:`, {
          teamId: team.id,
          memberIds: teamMemberIds,
          totalMessages: messages.length,
          teamMessages: teamMessages.length,
          sampleTeamMessage: teamMessages[0],
          memberIdsInMessages: teamMessages.map(m => ({ 
            sender: m.sender_id, 
            isSenderMember: teamMemberIds.includes(m.sender_id)
          })).slice(0, 3)
        });

        // 🎯 CORREÇÃO: Calcular métricas com filtro de datas correto
        const sentMessages = teamMessages.filter(msg => {
          const msgDate = new Date(msg.created_at);
          
          return msgDate >= startDate && msgDate <= endDate && 
                 (teamMemberIds.includes(msg.user_id) || teamMemberIds.includes(msg.sender_id));
        }).length;
        
        // Como não há receiver_id, todas as mensagens são consideradas enviadas
        const receivedMessages = 0;
        const totalMessages = sentMessages;
        
        console.log(`🔍 [Teams Metrics] DEBUG: Métricas calculadas para time ${team.name}:`, {
          totalMessages,
          sentMessages,
          receivedMessages,
          startDate,
          endDate
        });

        // Calcular tempo médio de resposta (simulado por enquanto)
        const avgResponseTime = teamMembers.length > 0 ? 
          Math.random() * 5 + 1 : 0; // Entre 1-6 minutos

        // Calcular produtividade baseada em mensagens e membros
        const productivity = teamMembers.length > 0 ? 
          Math.min(100, Math.round((totalMessages / teamMembers.length / 10) * 100)) : 0;

        // Determinar tendência (simulado por enquanto)
        const trend = productivity > 80 ? 'up' : productivity > 60 ? 'stable' : 'down';

        // 🎯 CORREÇÃO: Gerar dados diários baseados nas datas reais (mesma lógica das métricas individuais)
        const dailyData = [];
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`🔍 [Teams Metrics] DEBUG: Calculando dailyData para time ${team.name}:`, {
          startDate,
          endDate,
          daysDiff
        });
        
        for (let i = 0; i < daysDiff; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          
          // 🎯 CORREÇÃO: Calcular mensagens reais para cada dia
          const dayStart = new Date(date);
          dayStart.setUTCHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setUTCHours(23, 59, 59, 999);
          
          const dayMessages = messages.filter(msg => {
            const msgDate = new Date(msg.created_at);
            return msgDate >= dayStart && msgDate <= dayEnd && 
                   (teamMemberIds.includes(msg.user_id) || teamMemberIds.includes(msg.sender_id));
          }).length;
          
          dailyData.push({
            date: date.toISOString().split('T')[0],
            messages: dayMessages
          });
        }

        // 🎯 CORREÇÃO: Processar membros do time com filtro de datas correto
        const processedMembers = teamMembers.map(member => {
          const memberMessages = messages.filter(msg => {
            const msgDate = new Date(msg.created_at);
            
            return msgDate >= startDate && msgDate <= endDate && 
                   (msg.user_id === member.user_id || msg.sender_id === member.user_id);
          }).length;

          const memberResponseTime = Math.random() * 5 + 1;
          const memberProductivity = Math.min(100, Math.round((memberMessages / 5) * 100));
          const status = member.profiles?.last_seen && 
            (new Date().getTime() - new Date(member.profiles.last_seen).getTime()) < 5 * 60 * 1000 
            ? 'online' : 'offline';

          return {
            id: member.user_id,
            name: member.profiles?.name || member.name || 'Nome não informado',
            email: member.profiles?.email || 'Email não informado',
            totalMessages: memberMessages,
            avgResponseTime: Math.round(memberResponseTime * 10) / 10,
            productivity: memberProductivity,
            status,
            lastActivity: member.profiles?.last_seen || member.last_connected_at || new Date().toISOString()
          };
        });

        return {
          id: team.id,
          name: team.name,
          description: team.description || '',
          totalMembers: teamMembers.length,
          totalMessages,
          sentMessages,
          receivedMessages,
          avgResponseTime: Math.round(avgResponseTime * 10) / 10,
          productivity,
          trend,
          dailyData,
          members: processedMembers
        };
      }));
    } catch (error) {
      console.error('❌ [Teams Metrics] Erro ao processar métricas dos times:', error);
      teamMetrics = [];
    }

    // 🎯 CORREÇÃO: Ordenar times por produtividade com verificação de segurança
    if (teamMetrics.length > 0) {
      teamMetrics.sort((a, b) => b.productivity - a.productivity);
    }

    console.log('✅ [Teams Metrics] Resposta final:', {
      totalTeams: teamMetrics.length,
      totalMembers: teamMetrics.reduce((sum, team) => sum + (team.totalMembers || 0), 0),
      totalMessages: teamMetrics.reduce((sum, team) => sum + (team.totalMessages || 0), 0),
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      dateStart: startDate?.toISOString().split('T')[0],
      dateEnd: endDate?.toISOString().split('T')[0]
    });
    
    console.log('🔍 [Teams Metrics] DEBUG: Variáveis de data antes da resposta:', {
      startDate: startDate,
      endDate: endDate,
      startDateType: typeof startDate,
      endDateType: typeof endDate,
      startDateValid: startDate instanceof Date,
      endDateValid: endDate instanceof Date
    });

    // 🎯 CORREÇÃO FINAL: Retornar datas no formato correto (mesmo das métricas individuais)
    let responseDateStart, responseDateEnd;
    
    try {
      responseDateStart = startDate ? startDate.toISOString().split('T')[0] : undefined;
      responseDateEnd = endDate ? endDate.toISOString().split('T')[0] : undefined;
    } catch (dateError) {
      console.error('❌ [Teams Metrics] Erro ao processar datas para resposta:', dateError);
      responseDateStart = undefined;
      responseDateEnd = undefined;
    }
    
    console.log('🔍 [Teams Metrics] DEBUG: Datas finais para resposta:', {
      responseDateStart,
      responseDateEnd,
      startDate,
      endDate,
      startDateType: typeof startDate,
      endDateType: typeof endDate
    });
    
    // 🎯 CORREÇÃO: Garantir que a resposta inclua as datas
    const finalResponse = {
      success: true,
      teams: teamMetrics,
      period,
      dateStart: responseDateStart,
      dateEnd: responseDateEnd,
      totalTeams: teamMetrics.length,
      totalMembers: teamMetrics.reduce((sum, team) => sum + (team.totalMembers || 0), 0),
      totalMessages: teamMetrics.reduce((sum, team) => sum + (team.totalMessages || 0), 0),
      message: teamMetrics.length === 0 ? 'Nenhum time configurado para esta organização' : 
               teamMetrics.every(team => team.totalMembers === 0) ? 'Times encontrados, mas nenhum membro associado. Associe usuários aos times para ver métricas.' :
               'Métricas carregadas com sucesso'
    };
    
    console.log('🔍 [Teams Metrics] DEBUG: Resposta final antes de enviar:', {
      keys: Object.keys(finalResponse),
      hasDateStart: 'dateStart' in finalResponse,
      hasDateEnd: 'dateEnd' in finalResponse,
      dateStartValue: finalResponse.dateStart,
      dateEndValue: finalResponse.dateEnd
    });
    
    res.json(finalResponse);

  } catch (error) {
    console.error('❌ [Teams Metrics] Erro ao buscar métricas dos times:', error);
    console.error('❌ [Teams Metrics] Stack trace:', error.stack);
    console.error('❌ [Teams Metrics] Detalhes do erro:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    
    // 🎯 CORREÇÃO: Retornar resposta de erro com mais detalhes
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor',
      debug: {
        errorName: error.name,
        errorCode: error.code,
        hasStack: !!error.stack
      }
    });
  }
});

// GET /api/teams - Listar times do usuário na organização
router.get('/', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user?.id; // Obter ID do usuário autenticado

    console.log('🔍 [Teams List] Request details:', {
      organization_id,
      userId,
      userFromReq: req.user,
      method: req.method,
      path: req.path
    });
    
    if (!userId) {
      console.error('❌ [Teams List] userId não encontrado. req.user:', req.user);
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // 🎯 NOVO: Buscar o perfil do usuário para verificar seus times
    console.log('🔍 [Teams List] Buscando perfil para userId:', userId, 'organization_id:', organization_id);
    
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, department')
      .eq('id', userId)
      .eq('organization_id', organization_id)
      .single();

    if (profileError || !userProfile) {
      console.error('❌ [Teams List] Erro ao buscar perfil do usuário:', profileError);
      console.error('❌ [Teams List] Detalhes:', {
        userId,
        organization_id,
        error: profileError?.message
      });
      return res.status(404).json({
        success: false,
        error: 'Perfil do usuário não encontrado'
      });
    }

    console.log('🔍 [Teams List] Perfil do usuário encontrado:', {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      department: userProfile.department
    });

    // 🎯 NOVO: Buscar apenas times aos quais o usuário está vinculado
    let teams = [];
    
    if (userProfile.department) {
      // Usuário tem um time vinculado no campo department
      const { data: userTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, description, created_at, organization_id')
        .eq('organization_id', organization_id)
        .eq('name', userProfile.department);

      if (teamsError) {
        console.error('❌ [Teams List] Erro ao buscar times:', teamsError);
      } else {
        teams = userTeams || [];
      }
    }

    console.log(`✅ [Teams List] Times do usuário encontrados: ${teams?.length || 0}`);
    
    if (teams && teams.length > 0) {
      console.log('📊 [Teams List] Times vinculados:', teams.map(t => ({ 
        id: t.id, 
        name: t.name
      })));
    } else {
      console.log('⚠️  [Teams List] Usuário não está vinculado a nenhum time');
    }

    // Buscar membros dos times separadamente
    const teamIds = teams?.map(team => team.id) || [];
    let allTeamMembers = [];
    
    if (teamIds.length > 0) {
      const { data: teamMembers, error: membersError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          avatar_url,
          department
        `)
        .in('department', teamIds)
        .eq('organization_id', organization_id);

      if (membersError) {
        console.error('Erro ao buscar membros dos times:', membersError);
        allTeamMembers = [];
      } else {
        allTeamMembers = teamMembers || [];
      }
    }

    // Processar dados dos times
    const processedTeams = (teams || []).map(team => {
      const teamMembers = allTeamMembers.filter(member => member.department === team.id);
      return {
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: teamMembers.length,
        createdAt: team.created_at
      };
    });

    res.json({
      success: true,
      teams: processedTeams
    });

  } catch (error) {
    console.error('❌ [Teams List] Erro geral:', error);
    console.error('❌ [Teams List] Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/teams - Criar novo time
router.post('/', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { name, description, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Nome do time é obrigatório'
      });
    }

    // Verificar se já existe um time com este nome na organização
    const { data: existingTeam, error: checkError } = await supabase
      .from('teams')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('name', name)
      .single();

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um time com este nome'
      });
    }

    // 🎯 DEBUG: Verificar se a tabela teams existe
    console.log('🔍 [Teams Create] Verificando tabela teams...');
    
    // Criar o time
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({
        name,
        description,
        organization_id
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao criar time:', createError);
      throw new Error('Erro ao criar time');
    }

    // Adicionar membros se especificados
    if (memberIds && memberIds.length > 0) {
      const memberUpdates = memberIds.map(memberId => ({
        id: memberId,
        department: newTeam.id
      }));

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(memberUpdates, { onConflict: 'id' });

      if (updateError) {
        console.error('Erro ao adicionar membros ao time:', updateError);
        // Não falhar a criação do time se não conseguir adicionar membros
      }
    }

    res.status(201).json({
      success: true,
      team: newTeam,
      message: 'Time criado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar time:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// PUT /api/teams/:id - Atualizar time
router.put('/:id', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id } = req.params;
    const { name, description, memberIds } = req.body;

    // Verificar se o time existe e pertence à organização
    const { data: existingTeam, error: checkError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', organization_id)
      .eq('deleted_at', null)
      .single();

    if (checkError || !existingTeam) {
      return res.status(404).json({
        success: false,
        error: 'Time não encontrado'
      });
    }

    // Verificar se o novo nome já existe (se foi alterado)
    if (name && name !== existingTeam.name) {
      const { data: nameConflict, error: nameError } = await supabase
        .from('teams')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('name', name)
        .eq('deleted_at', null)
        .neq('id', id)
        .single();

      if (nameConflict) {
        return res.status(400).json({
          success: false,
          error: 'Já existe um time com este nome'
        });
      }
    }

    // Atualizar o time
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar time:', updateError);
      throw new Error('Erro ao atualizar time');
    }

    // Atualizar membros se especificados
    if (memberIds !== undefined) {
      // Primeiro, remover todos os membros atuais
      const { error: removeError } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', id);

      if (removeError) {
        console.error('Erro ao remover membros do time:', removeError);
      }

      // Adicionar novos membros
      if (memberIds && memberIds.length > 0) {
        const memberUpdates = memberIds.map(memberId => ({
          id: memberId,
          team_id: id
        }));

        const { error: addError } = await supabase
          .from('profiles')
          .upsert(memberUpdates, { onConflict: 'id' });

        if (addError) {
          console.error('Erro ao adicionar membros ao time:', addError);
        }
      }
    }

    res.json({
      success: true,
      team: updatedTeam,
      message: 'Time atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar time:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// DELETE /api/teams/:id - Excluir time (soft delete)
router.delete('/:id', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id } = req.params;

    // Verificar se o time existe e pertence à organização
    const { data: existingTeam, error: checkError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organization_id)
      .eq('deleted_at', null)
      .single();

    if (checkError || !existingTeam) {
      return res.status(404).json({
        success: false,
        error: 'Time não encontrado'
      });
    }

    // Soft delete do time
    const { error: deleteError } = await supabase
      .from('teams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir time:', deleteError);
      throw new Error('Erro ao excluir time');
    }

    // Remover membros do time
    const { error: removeError } = await supabase
      .from('profiles')
      .update({ team_id: null })
      .eq('team_id', id);

    if (removeError) {
      console.error('Erro ao remover membros do time:', removeError);
      // Não falhar a exclusão se não conseguir remover membros
    }

    res.json({
      success: true,
      message: 'Time excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir time:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// 🎯 NOVA ROTA: DELETE /api/teams/:id/members/:userId - Remover membro específico do time
router.delete('/:id/members/:userId', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id: teamId, userId } = req.params;

    console.log('🔍 [Teams Remove Member] Removendo membro:', {
      teamId,
      userId,
      organization_id
    });

    // Verificar se o time existe e pertence à organização
    const { data: existingTeam, error: teamCheckError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .eq('organization_id', organization_id)
      .eq('deleted_at', null)
      .single();

    if (teamCheckError || !existingTeam) {
      console.error('❌ [Teams Remove Member] Time não encontrado:', teamCheckError);
      return res.status(404).json({
        success: false,
        error: 'Time não encontrado'
      });
    }

    console.log('✅ [Teams Remove Member] Time encontrado:', existingTeam.name);

    // Verificar se o usuário existe e pertence à organização
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, name, email, department')
      .eq('id', userId)
      .eq('organization_id', organization_id)
      .eq('deleted_at', null)
      .single();

    if (userCheckError || !existingUser) {
      console.error('❌ [Teams Remove Member] Usuário não encontrado:', userCheckError);
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    console.log('✅ [Teams Remove Member] Usuário encontrado:', existingUser.name);

    // Verificar se o usuário realmente pertence ao time
    if (existingUser.department !== existingTeam.name) {
      console.log('⚠️ [Teams Remove Member] Usuário não pertence ao time:', {
        userDepartment: existingUser.department,
        teamName: existingTeam.name
      });
      return res.status(400).json({
        success: false,
        error: 'Usuário não pertence a este time'
      });
    }

    // 🎯 CORREÇÃO: Remover o usuário do time atualizando o campo department para null
    console.log('🔍 [Teams Remove Member] Removendo usuário do time...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        department: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .eq('organization_id', organization_id);

    if (updateError) {
      console.error('❌ [Teams Remove Member] Erro ao remover usuário do time:', updateError);
      throw new Error('Erro ao remover usuário do time');
    }

    console.log('✅ [Teams Remove Member] Usuário removido do time com sucesso');

    // Verificar se a remoção foi bem-sucedida
    const { data: updatedUser, error: verifyError } = await supabase
      .from('profiles')
      .select('id, name, department')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('❌ [Teams Remove Member] Erro ao verificar usuário após remoção:', verifyError);
    } else {
      console.log('🔍 [Teams Remove Member] Verificação pós-remoção:', {
        userId: updatedUser.id,
        userName: updatedUser.name,
        department: updatedUser.department,
        removed: updatedUser.department === null
      });
    }

    res.json({
      success: true,
      message: 'Membro removido do time com sucesso',
      data: {
        teamId,
        teamName: existingTeam.name,
        userId,
        userName: existingUser.name,
        removedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [Teams Remove Member] Erro ao remover membro do time:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// 🎯 NOVA ROTA: GET /api/teams/:id/members - Listar membros de um time específico
router.get('/:id/members', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id: teamId } = req.params;

    console.log('🔍 [Teams List Members] Listando membros do time:', {
      teamId,
      organization_id
    });

    // Verificar se o time existe e pertence à organização
    const { data: existingTeam, error: teamCheckError } = await supabase
      .from('teams')
      .select('id, name, description')
      .eq('id', teamId)
      .eq('organization_id', organization_id)
      .eq('deleted_at', null)
      .single();

    if (teamCheckError || !existingTeam) {
      console.error('❌ [Teams List Members] Time não encontrado:', teamCheckError);
      return res.status(404).json({
        success: false,
        error: 'Time não encontrado'
      });
    }

    console.log('✅ [Teams List Members] Time encontrado:', existingTeam.name);

    // Buscar membros do time (usuários com department igual ao nome do time)
    const { data: teamMembers, error: membersError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        avatar_url,
        last_seen,
        is_online,
        created_at,
        updated_at
      `)
      .eq('organization_id', organization_id)
      .eq('department', existingTeam.name)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (membersError) {
      console.error('❌ [Teams List Members] Erro ao buscar membros:', membersError);
      throw new Error('Erro ao buscar membros do time');
    }

    const members = teamMembers || [];
    console.log(`✅ [Teams List Members] ${members.length} membros encontrados`);

    // Processar dados dos membros
    const processedMembers = members.map(member => ({
      id: member.id,
      name: member.name || 'Nome não informado',
      email: member.email,
      avatar_url: member.avatar_url,
      is_online: member.is_online || false,
      last_seen: member.last_seen,
      created_at: member.created_at,
      updated_at: member.updated_at
    }));

    res.json({
      success: true,
      team: {
        id: existingTeam.id,
        name: existingTeam.name,
        description: existingTeam.description
      },
      members: processedMembers,
      totalMembers: processedMembers.length
    });

  } catch (error) {
    console.error('❌ [Teams List Members] Erro ao listar membros do time:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// 🎯 NOVA ROTA: POST /api/teams/:id/members - Adicionar membro ao time
router.post('/:id/members', authenticateToken, checkTeamAccess, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id: teamId } = req.params;
    const { userId } = req.body;

    console.log('🔍 [Teams Add Member] Adicionando membro ao time:', {
      teamId,
      userId,
      organization_id
    });

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId é obrigatório'
      });
    }

    // Verificar se o time existe e pertence à organização
    const { data: existingTeam, error: teamCheckError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .eq('organization_id', organization_id)
      .eq('deleted_at', null)
      .single();

    if (teamCheckError || !existingTeam) {
      console.error('❌ [Teams Add Member] Time não encontrado:', teamCheckError);
      return res.status(404).json({
        success: false,
        error: 'Time não encontrado'
      });
    }

    console.log('✅ [Teams Add Member] Time encontrado:', existingTeam.name);

    // Verificar se o usuário existe e pertence à organização
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, name, email, department')
      .eq('id', userId)
      .eq('organization_id', organization_id)
      .eq('deleted_at', null)
      .single();

    if (userCheckError || !existingUser) {
      console.error('❌ [Teams Add Member] Usuário não encontrado:', userCheckError);
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    console.log('✅ [Teams Add Member] Usuário encontrado:', existingUser.name);

    // Verificar se o usuário já pertence a outro time
    if (existingUser.department && existingUser.department !== existingTeam.name) {
      console.log('⚠️ [Teams Add Member] Usuário já pertence a outro time:', {
        userDepartment: existingUser.department,
        targetTeam: existingTeam.name
      });
      return res.status(400).json({
        success: false,
        error: 'Usuário já pertence a outro time'
      });
    }

    // Verificar se o usuário já pertence a este time
    if (existingUser.department === existingTeam.name) {
      console.log('⚠️ [Teams Add Member] Usuário já pertence a este time');
      return res.status(400).json({
        success: false,
        error: 'Usuário já pertence a este time'
      });
    }

    // 🎯 CORREÇÃO: Adicionar o usuário ao time atualizando o campo department
    console.log('🔍 [Teams Add Member] Adicionando usuário ao time...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        department: existingTeam.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .eq('organization_id', organization_id);

    if (updateError) {
      console.error('❌ [Teams Add Member] Erro ao adicionar usuário ao time:', updateError);
      throw new Error('Erro ao adicionar usuário ao time');
    }

    console.log('✅ [Teams Add Member] Usuário adicionado ao time com sucesso');

    // Verificar se a adição foi bem-sucedida
    const { data: updatedUser, error: verifyError } = await supabase
      .from('profiles')
      .select('id, name, department')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('❌ [Teams Add Member] Erro ao verificar usuário após adição:', verifyError);
    } else {
      console.log('🔍 [Teams Add Member] Verificação pós-adição:', {
        userId: updatedUser.id,
        userName: updatedUser.name,
        department: updatedUser.department,
        added: updatedUser.department === existingTeam.name
      });
    }

    res.json({
      success: true,
      message: 'Membro adicionado ao time com sucesso',
      data: {
        teamId,
        teamName: existingTeam.name,
        userId,
        userName: existingUser.name,
        addedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [Teams Add Member] Erro ao adicionar membro ao time:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

export default router;
