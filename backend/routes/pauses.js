import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// ROTAS PARA TIPOS DE PAUSAS
// =====================================================

/**
 * GET /api/pauses/types
 * Lista todos os tipos de pausas da organização
 */
router.get('/types', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.user;

    const { data: pauseTypes, error } = await supabase
      .from('pause_types')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    res.json({ success: true, pauseTypes });
  } catch (error) {
    console.error('❌ Erro ao buscar tipos de pausas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar tipos de pausas',
      details: error.message 
    });
  }
});

/**
 * POST /api/pauses/types
 * Cria um novo tipo de pausa (apenas admin)
 */
router.post('/types', authenticateToken, async (req, res) => {
  try {
    const { organization_id, user_id, role_name } = req.user;
    const { name, description, icon, color, duration_minutes, requires_justification, max_uses_per_day } = req.body;

    // Verificar permissão
    if (!['Admin', 'Super Admin', 'Owner'].includes(role_name)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Apenas administradores podem criar tipos de pausas' 
      });
    }

    const { data: pauseType, error } = await supabase
      .from('pause_types')
      .insert({
        organization_id,
        name,
        description,
        icon: icon || 'Clock',
        color: color || 'blue',
        duration_minutes: duration_minutes || 15,
        requires_justification: requires_justification || false,
        max_uses_per_day,
        is_system: false,
        created_by: user_id
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, pauseType });
  } catch (error) {
    console.error('❌ Erro ao criar tipo de pausa:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao criar tipo de pausa',
      details: error.message 
    });
  }
});

/**
 * PUT /api/pauses/types/:id
 * Atualiza um tipo de pausa (apenas admin)
 */
router.put('/types/:id', authenticateToken, async (req, res) => {
  try {
    const { organization_id, role_name } = req.user;
    const { id } = req.params;
    const updates = req.body;

    // Verificar permissão
    if (!['Admin', 'Super Admin', 'Owner'].includes(role_name)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Apenas administradores podem atualizar tipos de pausas' 
      });
    }

    // Não permitir atualizar pausas do sistema
    const { data: existing } = await supabase
      .from('pause_types')
      .select('is_system')
      .eq('id', id)
      .eq('organization_id', organization_id)
      .single();

    if (existing?.is_system) {
      return res.status(403).json({ 
        success: false, 
        error: 'Não é possível modificar pausas do sistema' 
      });
    }

    const { data: pauseType, error } = await supabase
      .from('pause_types')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, pauseType });
  } catch (error) {
    console.error('❌ Erro ao atualizar tipo de pausa:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao atualizar tipo de pausa',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/pauses/types/:id
 * Desativa um tipo de pausa (apenas admin)
 */
router.delete('/types/:id', authenticateToken, async (req, res) => {
  try {
    const { organization_id, role_name } = req.user;
    const { id } = req.params;

    // Verificar permissão
    if (!['Admin', 'Super Admin', 'Owner'].includes(role_name)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Apenas administradores podem deletar tipos de pausas' 
      });
    }

    // Não permitir deletar pausas do sistema
    const { data: existing } = await supabase
      .from('pause_types')
      .select('is_system')
      .eq('id', id)
      .eq('organization_id', organization_id)
      .single();

    if (existing?.is_system) {
      return res.status(403).json({ 
        success: false, 
        error: 'Não é possível deletar pausas do sistema' 
      });
    }

    // Soft delete - apenas desativa
    const { error } = await supabase
      .from('pause_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organization_id);

    if (error) throw error;

    res.json({ success: true, message: 'Tipo de pausa desativado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar tipo de pausa:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao deletar tipo de pausa',
      details: error.message 
    });
  }
});

// =====================================================
// ROTAS PARA HISTÓRICO DE PAUSAS
// =====================================================

/**
 * POST /api/pauses/start
 * Inicia uma nova pausa
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { organization_id, user_id } = req.user;
    const { pause_type_id, custom_name, justification, team_id } = req.body;

    // Buscar informações do tipo de pausa
    const { data: pauseType, error: typeError } = await supabase
      .from('pause_types')
      .select('*')
      .eq('id', pause_type_id)
      .eq('organization_id', organization_id)
      .single();

    if (typeError || !pauseType) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tipo de pausa não encontrado' 
      });
    }

    // Verificar se já existe uma pausa ativa para este usuário
    const { data: activePause } = await supabase
      .from('pause_history')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single();

    if (activePause) {
      return res.status(400).json({ 
        success: false, 
        error: 'Você já possui uma pausa ativa' 
      });
    }

    // Verificar limite de usos por dia
    if (pauseType.max_uses_per_day) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('pause_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('pause_type_id', pause_type_id)
        .gte('started_at', today.toISOString());

      if (count >= pauseType.max_uses_per_day) {
        return res.status(400).json({ 
          success: false, 
          error: `Limite de ${pauseType.max_uses_per_day} pausas deste tipo por dia atingido` 
        });
      }
    }

    // Verificar se requer justificativa
    if (pauseType.requires_justification && !justification) {
      return res.status(400).json({ 
        success: false, 
        error: 'Este tipo de pausa requer justificativa' 
      });
    }

    const startedAt = new Date();
    const expectedEndAt = new Date(startedAt.getTime() + pauseType.duration_minutes * 60000);

    // Criar registro de pausa
    const { data: pauseHistory, error } = await supabase
      .from('pause_history')
      .insert({
        organization_id,
        user_id,
        team_id,
        pause_type_id,
        pause_name: pauseType.name,
        custom_name,
        justification,
        started_at: startedAt.toISOString(),
        expected_end_at: expectedEndAt.toISOString(),
        duration_minutes: pauseType.duration_minutes,
        status: 'active',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      pause: pauseHistory,
      pauseType: {
        name: pauseType.name,
        duration: pauseType.duration_minutes,
        icon: pauseType.icon,
        color: pauseType.color
      }
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar pausa:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao iniciar pausa',
      details: error.message 
    });
  }
});

/**
 * POST /api/pauses/end/:id
 * Finaliza uma pausa
 */
router.post('/end/:id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    const { notes } = req.body;

    // Buscar pausa ativa
    const { data: pause, error: fetchError } = await supabase
      .from('pause_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single();

    if (fetchError || !pause) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pausa ativa não encontrada' 
      });
    }

    const endedAt = new Date();

    // Atualizar pausa (trigger calculará duração e status automaticamente)
    const { data: updatedPause, error } = await supabase
      .from('pause_history')
      .update({
        ended_at: endedAt.toISOString(),
        notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      pause: updatedPause,
      message: updatedPause.status === 'exceeded' 
        ? `Pausa finalizada. Tempo excedido: ${updatedPause.exceeded_minutes} minutos`
        : 'Pausa finalizada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao finalizar pausa:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao finalizar pausa',
      details: error.message 
    });
  }
});

/**
 * GET /api/pauses/active
 * Busca pausa ativa do usuário
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data: pause, error } = await supabase
      .from('pause_history')
      .select(`
        *,
        pause_type:pause_types(name, icon, color, duration_minutes)
      `)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ success: true, pause: pause || null });
  } catch (error) {
    console.error('❌ Erro ao buscar pausa ativa:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar pausa ativa',
      details: error.message 
    });
  }
});

/**
 * GET /api/pauses/history
 * Lista histórico de pausas com filtros
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { organization_id, user_id, role_name } = req.user;
    const { 
      start_date, 
      end_date, 
      user_filter, 
      status, 
      exceeded_only,
      limit = 100,
      offset = 0 
    } = req.query;

    let query = supabase
      .from('pause_history')
      .select(`
        *,
        user:profiles(id, name, email),
        team:teams(id, name),
        pause_type:pause_types(name, icon, color)
      `, { count: 'exact' })
      .eq('organization_id', organization_id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Se não for admin/supervisor, mostrar apenas próprias pausas
    if (!['Admin', 'Super Admin', 'Owner', 'Supervisor', 'Manager'].includes(role_name)) {
      query = query.eq('user_id', user_id);
    } else if (user_filter) {
      query = query.eq('user_id', user_filter);
    }

    if (start_date) {
      query = query.gte('started_at', start_date);
    }

    if (end_date) {
      query = query.lte('started_at', end_date);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (exceeded_only === 'true') {
      query = query.gt('exceeded_minutes', 0);
    }

    const { data: history, error, count } = await query;

    if (error) throw error;

    res.json({ success: true, history, total: count });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico de pausas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar histórico de pausas',
      details: error.message 
    });
  }
});

/**
 * GET /api/pauses/reports/summary
 * Relatório resumido de pausas
 */
router.get('/reports/summary', authenticateToken, async (req, res) => {
  try {
    const { organization_id, user_id, role_name } = req.user;
    const { start_date, end_date, user_filter } = req.query;

    // Verificar permissão para relatórios
    if (!['Admin', 'Super Admin', 'Owner', 'Supervisor', 'Manager'].includes(role_name) && user_filter && user_filter !== user_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Sem permissão para visualizar relatórios de outros usuários' 
      });
    }

    const targetUserId = user_filter || user_id;

    // Buscar dados do relatório
    let query = supabase
      .from('pause_report_by_user')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('user_id', targetUserId);

    if (start_date) {
      query = query.gte('pause_date', start_date);
    }

    if (end_date) {
      query = query.lte('pause_date', end_date);
    }

    const { data: report, error } = await query;

    if (error) throw error;

    // Calcular totais
    const summary = {
      total_pauses: report.reduce((sum, r) => sum + r.total_pauses, 0),
      total_minutes: report.reduce((sum, r) => sum + r.total_minutes, 0),
      exceeded_count: report.reduce((sum, r) => sum + r.exceeded_count, 0),
      total_exceeded_minutes: report.reduce((sum, r) => sum + r.total_exceeded_minutes, 0),
      by_date: report
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao gerar relatório',
      details: error.message 
    });
  }
});

/**
 * POST /api/pauses/initialize-system-types
 * Inicializa tipos de pausas padrão do sistema para uma organização
 * (Deve ser chamado ao criar uma nova organização)
 */
router.post('/initialize-system-types', authenticateToken, async (req, res) => {
  try {
    const { organization_id, user_id, role_name } = req.user;

    // Verificar permissão
    if (!['Admin', 'Super Admin', 'Owner'].includes(role_name)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Apenas administradores podem inicializar tipos de pausas' 
      });
    }

    const systemPauseTypes = [
      { name: 'Café', description: 'Pausa para café', icon: 'Coffee', color: 'orange', duration_minutes: 15 },
      { name: 'Almoço', description: 'Pausa para almoço', icon: 'Utensils', color: 'green', duration_minutes: 60 },
      { name: 'Telefone', description: 'Atendimento telefônico', icon: 'Phone', color: 'blue', duration_minutes: 10 },
      { name: 'Problema Técnico', description: 'Resolução de problemas técnicos', icon: 'Wrench', color: 'red', duration_minutes: 30 },
      { name: 'Banheiro', description: 'Pausa para banheiro', icon: 'Clock', color: 'purple', duration_minutes: 5 },
      { name: 'Reunião', description: 'Reunião interna', icon: 'Users', color: 'indigo', duration_minutes: 30 }
    ];

    const pauseTypesToInsert = systemPauseTypes.map(pt => ({
      ...pt,
      organization_id,
      is_system: true,
      is_active: true,
      created_by: user_id
    }));

    const { data: createdTypes, error } = await supabase
      .from('pause_types')
      .insert(pauseTypesToInsert)
      .select();

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Tipos de pausas do sistema inicializados com sucesso',
      pauseTypes: createdTypes 
    });
  } catch (error) {
    console.error('❌ Erro ao inicializar tipos de pausas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao inicializar tipos de pausas',
      details: error.message 
    });
  }
});

export default router;

