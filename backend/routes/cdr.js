import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// ============================================
// ROTAS DE CONFIGURAÇÃO CDR
// ============================================

// GET /api/cdr/configs - Listar configurações CDR da organização
router.get('/configs', async (req, res) => {
  try {
    const { user } = req;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Buscar configurações
    const { data: configs, error } = await supabase
      .from('cdr_configs')
      .select('*')
      .eq('organization_id', user.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [CDR] Erro ao buscar configurações:', error);
      return res.status(500).json({ error: 'Erro ao buscar configurações CDR' });
    }

    // Buscar dados das contas WhatsApp relacionadas
    if (configs && configs.length > 0) {
      const accountIds = [...new Set(configs.map(c => c.account_id))];
      const { data: accountsData, error: accountsError } = await supabase
        .from('whatsapp_accounts')
        .select('account_id, name, phone_number, status')
        .in('account_id', accountIds);

      if (!accountsError && accountsData) {
        const accountsMap = accountsData.reduce((acc, account) => {
          acc[account.account_id] = account;
          return acc;
        }, {});

        // Adicionar dados das contas às configurações
        configs.forEach(config => {
          config.whatsapp_accounts = accountsMap[config.account_id] || null;
        });
      }
    }

    res.json({ success: true, configs });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/cdr/configs/:id - Buscar configuração CDR específica
router.get('/configs/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Buscar configuração
    const { data: config, error } = await supabase
      .from('cdr_configs')
      .select('*')
      .eq('id', id)
      .eq('organization_id', user.organization_id)
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao buscar configuração:', error);
      return res.status(500).json({ error: 'Erro ao buscar configuração CDR' });
    }

    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    // Buscar dados da conta WhatsApp
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, phone_number, status')
      .eq('account_id', config.account_id)
      .single();

    if (!accountError && accountData) {
      config.whatsapp_accounts = accountData;
    }

    // Buscar opções da configuração
    const { data: optionsData, error: optionsError } = await supabase
      .from('cdr_options')
      .select('*')
      .eq('cdr_config_id', id)
      .order('option_number', { ascending: true });

    if (!optionsError && optionsData && optionsData.length > 0) {
      // Buscar grupos relacionados às opções
      const groupIds = [...new Set(optionsData.map(o => o.group_id).filter(id => id))];
      let groupsMap = {};
      
      if (groupIds.length > 0) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('cdr_groups')
          .select('id, name')
          .in('id', groupIds);

        if (!groupsError && groupsData) {
          groupsMap = groupsData.reduce((acc, group) => {
            acc[group.id] = group;
            return acc;
          }, {});
        }
      }

      // Adicionar grupos às opções
      optionsData.forEach(option => {
        if (option.group_id && groupsMap[option.group_id]) {
          option.cdr_groups = groupsMap[option.group_id];
        }
      });

      config.cdr_options = optionsData;
    } else {
      config.cdr_options = [];
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cdr/configs - Criar nova configuração CDR
router.post('/configs', async (req, res) => {
  try {
    const { user } = req;
    const { account_id, name, welcome_message, distribution_mode } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    if (!account_id || !name || !welcome_message) {
      return res.status(400).json({ error: 'Campos obrigatórios: account_id, name, welcome_message' });
    }

    // Verificar se já existe configuração para esta conta
    const { data: existing } = await supabase
      .from('cdr_configs')
      .select('id')
      .eq('account_id', account_id)
      .eq('organization_id', user.organization_id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Já existe uma configuração CDR para esta conta' });
    }

    const { data: config, error } = await supabase
      .from('cdr_configs')
      .insert({
        organization_id: user.organization_id,
        account_id,
        name,
        welcome_message,
        distribution_mode: distribution_mode || 'sequential',
        active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao criar configuração:', error);
      return res.status(500).json({ error: 'Erro ao criar configuração CDR' });
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/cdr/configs/:id - Atualizar configuração CDR
router.put('/configs/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { name, welcome_message, distribution_mode, active } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (welcome_message !== undefined) updateData.welcome_message = welcome_message;
    if (distribution_mode !== undefined) updateData.distribution_mode = distribution_mode;
    if (active !== undefined) updateData.active = active;

    const { data: config, error } = await supabase
      .from('cdr_configs')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', user.organization_id)
      .select()
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao atualizar configuração:', error);
      return res.status(500).json({ error: 'Erro ao atualizar configuração CDR' });
    }

    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/cdr/configs/:id - Deletar configuração CDR
router.delete('/configs/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const { error } = await supabase
      .from('cdr_configs')
      .delete()
      .eq('id', id)
      .eq('organization_id', user.organization_id);

    if (error) {
      console.error('❌ [CDR] Erro ao deletar configuração:', error);
      return res.status(500).json({ error: 'Erro ao deletar configuração CDR' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================
// ROTAS DE OPÇÕES CDR
// ============================================

// GET /api/cdr/configs/:configId/options - Listar opções de uma configuração
router.get('/configs/:configId/options', async (req, res) => {
  try {
    const { user } = req;
    const { configId } = req.params;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Verificar se a configuração pertence à organização
    const { data: config } = await supabase
      .from('cdr_configs')
      .select('id')
      .eq('id', configId)
      .eq('organization_id', user.organization_id)
      .single();

    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    const { data: options, error } = await supabase
      .from('cdr_options')
      .select(`
        *,
        cdr_groups (
          id,
          name
        )
      `)
      .eq('cdr_config_id', configId)
      .order('option_number', { ascending: true });

    if (error) {
      console.error('❌ [CDR] Erro ao buscar opções:', error);
      return res.status(500).json({ error: 'Erro ao buscar opções CDR' });
    }

    res.json({ success: true, options });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cdr/configs/:configId/options - Criar nova opção
router.post('/configs/:configId/options', async (req, res) => {
  try {
    const { user } = req;
    const { configId } = req.params;
    const { option_number, option_text, group_id } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    if (!option_number || !option_text) {
      return res.status(400).json({ error: 'Campos obrigatórios: option_number, option_text' });
    }

    if (!group_id) {
      return res.status(400).json({ error: 'É necessário selecionar um grupo para a opção' });
    }

    // Verificar se a configuração pertence à organização
    const { data: config } = await supabase
      .from('cdr_configs')
      .select('id')
      .eq('id', configId)
      .eq('organization_id', user.organization_id)
      .single();

    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    // Verificar se já existe opção com este número
    const { data: existing } = await supabase
      .from('cdr_options')
      .select('id')
      .eq('cdr_config_id', configId)
      .eq('option_number', option_number)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Já existe uma opção com este número' });
    }

    const { data: option, error } = await supabase
      .from('cdr_options')
      .insert({
        cdr_config_id: configId,
        option_number,
        option_text,
        group_id: group_id || null,
        active: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao criar opção:', error);
      return res.status(500).json({ error: 'Erro ao criar opção CDR' });
    }

    res.json({ success: true, option });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/cdr/options/:id - Atualizar opção
router.put('/options/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { option_number, option_text, group_id, active } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Verificar se a opção pertence à organização
    const { data: optionData } = await supabase
      .from('cdr_options')
      .select(`
        *,
        cdr_configs!inner (
          organization_id
        )
      `)
      .eq('id', id)
      .eq('cdr_configs.organization_id', user.organization_id)
      .single();

    if (!optionData) {
      return res.status(404).json({ error: 'Opção não encontrada' });
    }

    const updateData = {};
    if (option_number !== undefined) updateData.option_number = option_number;
    if (option_text !== undefined) updateData.option_text = option_text;
    if (group_id !== undefined) updateData.group_id = group_id;
    if (active !== undefined) updateData.active = active;

    const { data: option, error } = await supabase
      .from('cdr_options')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao atualizar opção:', error);
      return res.status(500).json({ error: 'Erro ao atualizar opção CDR' });
    }

    res.json({ success: true, option });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/cdr/options/:id - Deletar opção
router.delete('/options/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Verificar se a opção pertence à organização
    const { data: optionData } = await supabase
      .from('cdr_options')
      .select(`
        *,
        cdr_configs!inner (
          organization_id
        )
      `)
      .eq('id', id)
      .eq('cdr_configs.organization_id', user.organization_id)
      .single();

    if (!optionData) {
      return res.status(404).json({ error: 'Opção não encontrada' });
    }

    const { error } = await supabase
      .from('cdr_options')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [CDR] Erro ao deletar opção:', error);
      return res.status(500).json({ error: 'Erro ao deletar opção CDR' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================
// ROTAS DE GRUPOS CDR
// ============================================

// GET /api/cdr/groups - Listar grupos da organização
router.get('/groups', async (req, res) => {
  try {
    const { user } = req;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const { data: groups, error } = await supabase
      .from('cdr_groups')
      .select(`
        *,
        cdr_group_users (
          *,
          profiles (
            id,
            name,
            email
          )
        )
      `)
      .eq('organization_id', user.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [CDR] Erro ao buscar grupos:', error);
      return res.status(500).json({ error: 'Erro ao buscar grupos CDR' });
    }

    res.json({ success: true, groups });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cdr/groups - Criar novo grupo
router.post('/groups', async (req, res) => {
  try {
    const { user } = req;
    const { name, description } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Campo obrigatório: name' });
    }

    const { data: group, error } = await supabase
      .from('cdr_groups')
      .insert({
        organization_id: user.organization_id,
        name,
        description: description || null,
        active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao criar grupo:', error);
      return res.status(500).json({ error: 'Erro ao criar grupo CDR' });
    }

    res.json({ success: true, group });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/cdr/groups/:id - Atualizar grupo
router.put('/groups/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { name, description, active } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (active !== undefined) updateData.active = active;

    const { data: group, error } = await supabase
      .from('cdr_groups')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', user.organization_id)
      .select()
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao atualizar grupo:', error);
      return res.status(500).json({ error: 'Erro ao atualizar grupo CDR' });
    }

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    res.json({ success: true, group });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/cdr/groups/:id - Deletar grupo
router.delete('/groups/:id', async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const { error } = await supabase
      .from('cdr_groups')
      .delete()
      .eq('id', id)
      .eq('organization_id', user.organization_id);

    if (error) {
      console.error('❌ [CDR] Erro ao deletar grupo:', error);
      return res.status(500).json({ error: 'Erro ao deletar grupo CDR' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================
// ROTAS DE USUÁRIOS DOS GRUPOS
// ============================================

// GET /api/cdr/groups/:groupId/users - Listar usuários de um grupo
router.get('/groups/:groupId/users', async (req, res) => {
  try {
    const { user } = req;
    const { groupId } = req.params;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Verificar se o grupo pertence à organização
    const { data: group } = await supabase
      .from('cdr_groups')
      .select('id')
      .eq('id', groupId)
      .eq('organization_id', user.organization_id)
      .single();

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    const { data: groupUsers, error } = await supabase
      .from('cdr_group_users')
      .select(`
        *,
        profiles (
          id,
          name,
          email
        )
      `)
      .eq('group_id', groupId)
      .order('priority', { ascending: false });

    if (error) {
      console.error('❌ [CDR] Erro ao buscar usuários do grupo:', error);
      return res.status(500).json({ error: 'Erro ao buscar usuários do grupo' });
    }

    res.json({ success: true, users: groupUsers });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/cdr/groups/:groupId/users - Adicionar usuário ao grupo
router.post('/groups/:groupId/users', async (req, res) => {
  try {
    const { user } = req;
    const { groupId } = req.params;
    const { user_id, phone_number, priority } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'Campo obrigatório: user_id' });
    }

    // Verificar se o grupo pertence à organização
    const { data: group } = await supabase
      .from('cdr_groups')
      .select('id')
      .eq('id', groupId)
      .eq('organization_id', user.organization_id)
      .single();

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    // Verificar se o usuário já está no grupo
    const { data: existing } = await supabase
      .from('cdr_group_users')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Usuário já está no grupo' });
    }

    const { data: groupUser, error } = await supabase
      .from('cdr_group_users')
      .insert({
        group_id: groupId,
        user_id,
        phone_number: phone_number || null,
        priority: priority || 0,
        active: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [CDR] Erro ao adicionar usuário ao grupo:', error);
      return res.status(500).json({ error: 'Erro ao adicionar usuário ao grupo' });
    }

    res.json({ success: true, user: groupUser });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/cdr/groups/:groupId/users/:userId - Remover usuário do grupo
router.delete('/groups/:groupId/users/:userId', async (req, res) => {
  try {
    const { user } = req;
    const { groupId, userId } = req.params;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Verificar se o grupo pertence à organização
    const { data: group } = await supabase
      .from('cdr_groups')
      .select('id')
      .eq('id', groupId)
      .eq('organization_id', user.organization_id)
      .single();

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    const { error } = await supabase
      .from('cdr_group_users')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [CDR] Erro ao remover usuário do grupo:', error);
      return res.status(500).json({ error: 'Erro ao remover usuário do grupo' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================
// ROTAS DE SESSÕES E ATIVOS
// ============================================

// GET /api/cdr/sessions - Listar sessões ativas
router.get('/sessions', async (req, res) => {
  try {
    const { user } = req;
    const { status } = req.query;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    let query = supabase
      .from('cdr_sessions')
      .select(`
        *,
        cdr_configs!inner (
          id,
          name,
          organization_id
        ),
        cdr_groups (
          id,
          name
        ),
        profiles:assigned_to (
          id,
          name,
          email
        )
      `)
      .eq('cdr_configs.organization_id', user.organization_id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('❌ [CDR] Erro ao buscar sessões:', error);
      return res.status(500).json({ error: 'Erro ao buscar sessões' });
    }

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/cdr/actives - Listar histórico de ativos
router.get('/actives', async (req, res) => {
  try {
    const { user } = req;
    const { session_id, group_id } = req.query;

    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    let query = supabase
      .from('cdr_actives')
      .select(`
        *,
        cdr_sessions!inner (
          cdr_configs!inner (
            organization_id
          )
        ),
        cdr_groups (
          id,
          name
        ),
        profiles:user_id (
          id,
          name,
          email
        )
      `)
      .eq('cdr_sessions.cdr_configs.organization_id', user.organization_id)
      .order('created_at', { ascending: false });

    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    if (group_id) {
      query = query.eq('group_id', group_id);
    }

    const { data: actives, error } = await query;

    if (error) {
      console.error('❌ [CDR] Erro ao buscar ativos:', error);
      return res.status(500).json({ error: 'Erro ao buscar ativos' });
    }

    res.json({ success: true, actives });
  } catch (error) {
    console.error('❌ [CDR] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;

