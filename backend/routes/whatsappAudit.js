/**
 * Rotas para auditoria de status WhatsApp
 * Apenas super admins podem acessar
 */

import express from 'express';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Todas as rotas requerem autenticação e super admin
router.use(authenticateToken);
router.use(requireSuperAdmin);

/**
 * GET /api/whatsapp-audit/status-changes
 * Lista mudanças de status com filtros
 */
router.get('/status-changes', async (req, res) => {
  try {
    const {
      accountId,
      organizationId,
      status,
      days = 7,
      page = 1,
      limit = 50,
      startDate,
      endDate
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir query
    let query = supabase
      .from('whatsapp_status_audit')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // ✅ NOVO: Se organizationId foi fornecido, validar também pelo user_id
    if (organizationId) {
      // Buscar contas da organização e validar user_id
      const { data: accounts } = await supabase
        .from('whatsapp_accounts')
        .select('account_id, user_id')
        .eq('organization_id', organizationId);

      if (accounts && accounts.length > 0) {
        // Validar quais contas têm user_id pertencente à organização
        const validAccountIds = [];
        for (const account of accounts) {
          if (account.user_id) {
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('organization_id')
              .eq('id', account.user_id)
              .single();

            if (userProfile && userProfile.organization_id === organizationId) {
              validAccountIds.push(account.account_id);
            }
          }
        }

        // Filtrar apenas contas válidas
        if (validAccountIds.length > 0) {
          query = query.in('account_id', validAccountIds);
        } else {
          // Se não há contas válidas, retornar vazio
          return res.json({
            success: true,
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0
            }
          });
        }
      } else {
        // Se não há contas na organização, retornar vazio
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Filtros adicionais
    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    if (status) {
      query = query.eq('new_status', status);
    }

    // Filtro de data
    if (startDate) {
      query = query.gte('created_at', startDate);
    } else {
      // Padrão: últimos N dias
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - parseInt(days));
      query = query.gte('created_at', defaultStartDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Paginação
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar mudanças de status:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar mudanças de status'
      });
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Erro ao processar requisição:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/whatsapp-audit/statistics
 * Estatísticas de mudanças de status
 */
router.get('/statistics', async (req, res) => {
  try {
    const { days = 7, organizationId } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let query = supabase
      .from('whatsapp_status_audit')
      .select('new_status, old_status, reason')
      .gte('created_at', startDate.toISOString());

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar estatísticas'
      });
    }

    // Calcular estatísticas
    const stats = {
      total: data?.length || 0,
      byStatus: {},
      byReason: {},
      regressions: 0, // connected -> connecting
      connections: 0, // connecting -> connected
      disconnections: 0, // qualquer -> disconnected
      errors: 0 // qualquer -> error
    };

    data?.forEach(change => {
      // Por status
      stats.byStatus[change.new_status] = (stats.byStatus[change.new_status] || 0) + 1;

      // Por motivo
      stats.byReason[change.reason] = (stats.byReason[change.reason] || 0) + 1;

      // Regressões (connected -> connecting)
      if (change.old_status === 'connected' && change.new_status === 'connecting') {
        stats.regressions++;
      }

      // Conexões (connecting -> connected)
      if (change.old_status === 'connecting' && change.new_status === 'connected') {
        stats.connections++;
      }

      // Desconexões
      if (change.new_status === 'disconnected') {
        stats.disconnections++;
      }

      // Erros
      if (change.new_status === 'error') {
        stats.errors++;
      }
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erro ao processar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/whatsapp-audit/accounts
 * Lista contas com mais mudanças (possível intermitência)
 */
router.get('/accounts', async (req, res) => {
  try {
    const { days = 1, minChanges = 5, organizationId } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let query = supabase
      .from('whatsapp_status_audit')
      .select('account_id, account_name, organization_id')
      .gte('created_at', startDate.toISOString());

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar contas:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar contas'
      });
    }

    // Agrupar por conta
    const accountMap = {};
    data?.forEach(change => {
      if (!accountMap[change.account_id]) {
        accountMap[change.account_id] = {
          account_id: change.account_id,
          account_name: change.account_name,
          organization_id: change.organization_id,
          changes: 0
        };
      }
      accountMap[change.account_id].changes++;
    });

    // Filtrar e ordenar
    const accounts = Object.values(accountMap)
      .filter(acc => acc.changes >= parseInt(minChanges))
      .sort((a, b) => b.changes - a.changes);

    res.json({
      success: true,
      data: accounts
    });

  } catch (error) {
    console.error('❌ Erro ao processar contas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/whatsapp-audit/timeline
 * Timeline de mudanças para uma conta específica
 */
router.get('/timeline/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const { data, error } = await supabase
      .from('whatsapp_status_audit')
      .select('*')
      .eq('account_id', accountId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar timeline:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar timeline'
      });
    }

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('❌ Erro ao processar timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;

