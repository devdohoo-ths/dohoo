import express from 'express';
import { supabase } from '../integrations/supabase/client.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// =====================================================
// CONFIGURAÇÕES DE ATENDIMENTO (CONFIGS)
// =====================================================

/**
 * GET /api/intelligent-service/configs
 * Lista todas as configurações de atendimento da organização
 */
router.get('/configs', async (req, res) => {
  try {
    const { organization_id } = req.user;

    console.log('📋 [Intelligent Service] Buscando configurações para organização:', organization_id);

    const { data: configs, error } = await supabase
      .from('intelligent_service_products')
      .select(`
        *,
        teams:team_id (
          id,
          name,
          description
        )
      `)
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [Intelligent Service] Erro ao buscar configurações:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar configurações'
      });
    }

    console.log(`✅ [Intelligent Service] ${configs?.length || 0} configurações encontradas`);

    res.json({
      success: true,
      configs: configs || []
    });

  } catch (error) {
    console.error('❌ [Intelligent Service] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/intelligent-service/configs/:id
 * Busca uma configuração específica
 */
router.get('/configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { organization_id } = req.user;

    console.log('🔍 [Intelligent Service] Buscando configuração:', id);

    const { data: config, error } = await supabase
      .from('intelligent_service_products')
      .select(`
        *,
        teams:team_id (
          id,
          name,
          description
        )
      `)
      .eq('id', id)
      .eq('organization_id', organization_id)
      .single();

    if (error) {
      console.error('❌ [Intelligent Service] Erro ao buscar configuração:', error);
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    console.log('✅ [Intelligent Service] Configuração encontrada:', config.name);

    res.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('❌ [Intelligent Service] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/intelligent-service/configs
 * Cria uma nova configuração de atendimento
 */
router.post('/configs', async (req, res) => {
  try {
    const { name, description, flow_id, team_id, chat_config, is_active } = req.body;
    const { organization_id, id: user_id } = req.user;

    console.log('➕ [Intelligent Service] Criando nova configuração:', name);

    // Validações básicas
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório'
      });
    }

    if (!team_id) {
      return res.status(400).json({
        success: false,
        error: 'Time é obrigatório'
      });
    }

    // Verificar se o time pertence à organização
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, organization_id')
      .eq('id', team_id)
      .eq('organization_id', organization_id)
      .single();

    if (teamError || !team) {
      return res.status(400).json({
        success: false,
        error: 'Time não encontrado ou não pertence à sua organização'
      });
    }

    // Criar configuração
    const { data: config, error } = await supabase
      .from('intelligent_service_products')
      .insert([{
        name: name.trim(),
        description: description?.trim() || null,
        flow_id: flow_id || null,
        team_id,
        chat_config: chat_config || {
          type: 'hybrid',
          internal_enabled: true,
          external_enabled: true,
          auto_routing: false
        },
        is_active: is_active !== undefined ? is_active : true,
        organization_id,
        created_by: user_id
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [Intelligent Service] Erro ao criar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar configuração'
      });
    }

    console.log('✅ [Intelligent Service] Configuração criada com sucesso:', config.id);

    res.status(201).json({
      success: true,
      config,
      message: 'Configuração criada com sucesso'
    });

  } catch (error) {
    console.error('❌ [Intelligent Service] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * PUT /api/intelligent-service/configs/:id
 * Atualiza uma configuração existente
 */
router.put('/configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, flow_id, team_id, chat_config, is_active } = req.body;
    const { organization_id } = req.user;

    console.log('✏️ [Intelligent Service] Atualizando configuração:', id);

    // Verificar se a configuração existe e pertence à organização
    const { data: existingConfig, error: checkError } = await supabase
      .from('intelligent_service_products')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organization_id)
      .single();

    if (checkError || !existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    // Validações
    if (name && name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome não pode ser vazio'
      });
    }

    // Se mudou o team_id, verificar se pertence à organização
    if (team_id) {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('id', team_id)
        .eq('organization_id', organization_id)
        .single();

      if (teamError || !team) {
        return res.status(400).json({
          success: false,
          error: 'Time não encontrado ou não pertence à sua organização'
        });
      }
    }

    // Preparar dados para atualização
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (flow_id !== undefined) updateData.flow_id = flow_id;
    if (team_id !== undefined) updateData.team_id = team_id;
    if (chat_config !== undefined) updateData.chat_config = chat_config;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Atualizar
    const { data: config, error } = await supabase
      .from('intelligent_service_products')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();

    if (error) {
      console.error('❌ [Intelligent Service] Erro ao atualizar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar configuração'
      });
    }

    console.log('✅ [Intelligent Service] Configuração atualizada com sucesso');

    res.json({
      success: true,
      config,
      message: 'Configuração atualizada com sucesso'
    });

  } catch (error) {
    console.error('❌ [Intelligent Service] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * DELETE /api/intelligent-service/configs/:id
 * Deleta uma configuração
 */
router.delete('/configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { organization_id } = req.user;

    console.log('🗑️ [Intelligent Service] Deletando configuração:', id);

    // Verificar se existe
    const { data: existingConfig, error: checkError } = await supabase
      .from('intelligent_service_products')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', organization_id)
      .single();

    if (checkError || !existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    // Deletar
    const { error } = await supabase
      .from('intelligent_service_products')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization_id);

    if (error) {
      console.error('❌ [Intelligent Service] Erro ao deletar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar configuração'
      });
    }

    console.log('✅ [Intelligent Service] Configuração deletada com sucesso:', existingConfig.name);

    res.json({
      success: true,
      message: 'Configuração deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ [Intelligent Service] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// ESTRATÉGIAS DE TIME
// =====================================================

/**
 * GET /api/intelligent-service/strategies
 * Lista todas as estratégias de time da organização
 */
router.get('/strategies', async (req, res) => {
  try {
    const { organization_id } = req.user;

    console.log('📋 [Intelligent Service] Buscando estratégias para organização:', organization_id);

    // Buscar estratégias dos times da organização
    const { data: strategies, error } = await supabase
      .from('team_delivery_strategies')
      .select(`
        *,
        teams:team_id (
          id,
          name,
          organization_id
        )
      `)
      .eq('teams.organization_id', organization_id);

    if (error) {
      console.error('❌ [Intelligent Service] Erro ao buscar estratégias:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar estratégias'
      });
    }

    console.log(`✅ [Intelligent Service] ${strategies?.length || 0} estratégias encontradas`);

    res.json({
      success: true,
      strategies: strategies || []
    });

  } catch (error) {
    console.error('❌ [Intelligent Service] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/intelligent-service/strategies
 * Cria ou atualiza estratégia de um time
 */
router.post('/strategies', async (req, res) => {
  try {
    const { team_id, strategy_type, config, is_active } = req.body;
    const { organization_id } = req.user;

    console.log('➕ [Intelligent Service] Criando/atualizando estratégia para time:', team_id);

    // Validações
    if (!team_id || !strategy_type) {
      return res.status(400).json({
        success: false,
        error: 'Team ID e tipo de estratégia são obrigatórios'
      });
    }

    const validTypes = ['round_robin', 'priority', 'broadcast', 'workload'];
    if (!validTypes.includes(strategy_type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de estratégia inválido'
      });
    }

    // Verificar se o time pertence à organização
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', team_id)
      .eq('organization_id', organization_id)
      .single();

    if (teamError || !team) {
      return res.status(400).json({
        success: false,
        error: 'Time não encontrado ou não pertence à sua organização'
      });
    }

    // Verificar se já existe estratégia para este time
    const { data: existing } = await supabase
      .from('team_delivery_strategies')
      .select('id')
      .eq('team_id', team_id)
      .single();

    let strategy;
    let error;

    if (existing) {
      // Atualizar existente
      const result = await supabase
        .from('team_delivery_strategies')
        .update({
          strategy_type,
          config: config || {},
          is_active: is_active !== undefined ? is_active : true
        })
        .eq('id', existing.id)
        .select()
        .single();

      strategy = result.data;
      error = result.error;
    } else {
      // Criar nova
      const result = await supabase
        .from('team_delivery_strategies')
        .insert([{
          team_id,
          strategy_type,
          config: config || {},
          is_active: is_active !== undefined ? is_active : true
        }])
        .select()
        .single();

      strategy = result.data;
      error = result.error;
    }

    if (error) {
      console.error('❌ [Intelligent Service] Erro ao salvar estratégia:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar estratégia'
      });
    }

    console.log('✅ [Intelligent Service] Estratégia salva com sucesso');

    res.json({
      success: true,
      strategy,
      message: 'Estratégia salva com sucesso'
    });

  } catch (error) {
    console.error('❌ [Intelligent Service] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;

