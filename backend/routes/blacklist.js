import express from 'express';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * GET /api/blacklist
 * Lista todos os números da blacklist da organização
 */
router.get('/', async (req, res) => {
  try {
    logger.info('🔍 [BLACKLIST] Listando números da blacklist da organização:', req.user?.organization?.name);
    
    if (!req.user) {
      logger.error('❌ [BLACKLIST] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!req.user.organization_id) {
      logger.error('❌ [BLACKLIST] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    const { data: blacklist, error } = await supabaseAdmin
      .from('blacklist')
      .select(`
        *,
        criado_por_profile:profiles!blacklist_criado_por_fkey(
          id,
          name,
          email
        )
      `)
      .eq('organization_id', req.user.organization_id)
      .order('criado_em', { ascending: false });

    if (error) {
      logger.error('❌ [BLACKLIST] Erro ao buscar blacklist:', error);
      throw new Error(`Erro ao buscar blacklist: ${error.message}`);
    }

    logger.info(`✅ [BLACKLIST] Encontrados ${blacklist?.length || 0} números na blacklist`);
    res.json({ success: true, blacklist: blacklist || [] });
  } catch (error) {
    logger.error('❌ [BLACKLIST] Erro ao listar blacklist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blacklist
 * Adiciona um novo número à blacklist
 */
router.post('/', async (req, res) => {
  try {
    const { numero_telefone, motivo } = req.body;
    
    logger.info('➕ [BLACKLIST] Adicionando número à blacklist:', numero_telefone);
    
    if (!req.user) {
      logger.error('❌ [BLACKLIST] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!req.user.organization_id) {
      logger.error('❌ [BLACKLIST] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }

    if (!numero_telefone) {
      logger.error('❌ [BLACKLIST] Número de telefone é obrigatório');
      return res.status(400).json({ success: false, error: 'Número de telefone é obrigatório' });
    }

    // Normalizar número de telefone (remover caracteres especiais)
    const numeroNormalizado = numero_telefone.replace(/\D/g, '');
    
    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Verificar se o número já está na blacklist
    const { data: existing } = await supabaseAdmin
      .from('blacklist')
      .select('id')
      .eq('organization_id', req.user.organization_id)
      .eq('numero_telefone', numeroNormalizado)
      .single();

    if (existing) {
      logger.warn('⚠️ [BLACKLIST] Número já está na blacklist:', numeroNormalizado);
      return res.status(400).json({ success: false, error: 'Este número já está na blacklist' });
    }

    // Adicionar à blacklist
    const { data: newBlacklistItem, error } = await supabaseAdmin
      .from('blacklist')
      .insert({
        organization_id: req.user.organization_id,
        numero_telefone: numeroNormalizado,
        motivo: motivo || 'Bloqueio manual',
        criado_por: req.user.id
      })
      .select(`
        *,
        criado_por_profile:profiles!blacklist_criado_por_fkey(
          id,
          name,
          email
        )
      `)
      .single();

    if (error) {
      logger.error('❌ [BLACKLIST] Erro ao adicionar à blacklist:', error);
      throw new Error(`Erro ao adicionar à blacklist: ${error.message}`);
    }

    logger.info('✅ [BLACKLIST] Número adicionado à blacklist com sucesso:', numeroNormalizado);
    res.json({ success: true, blacklistItem: newBlacklistItem });
  } catch (error) {
    logger.error('❌ [BLACKLIST] Erro ao adicionar à blacklist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/blacklist/:id
 * Atualiza um item da blacklist
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, ativo } = req.body;
    
    logger.info('✏️ [BLACKLIST] Atualizando item da blacklist:', id);
    
    if (!req.user) {
      logger.error('❌ [BLACKLIST] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!req.user.organization_id) {
      logger.error('❌ [BLACKLIST] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Verificar se o item existe e pertence à organização
    const { data: existingItem } = await supabaseAdmin
      .from('blacklist')
      .select('id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (!existingItem) {
      logger.error('❌ [BLACKLIST] Item não encontrado ou não pertence à organização');
      return res.status(404).json({ success: false, error: 'Item não encontrado' });
    }

    // Atualizar item
    const updateData = {};
    if (motivo !== undefined) updateData.motivo = motivo;
    if (ativo !== undefined) updateData.ativo = ativo;
    updateData.atualizado_em = new Date().toISOString();

    const { data: updatedItem, error } = await supabaseAdmin
      .from('blacklist')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        criado_por_profile:profiles!blacklist_criado_por_fkey(
          id,
          name,
          email
        )
      `)
      .single();

    if (error) {
      logger.error('❌ [BLACKLIST] Erro ao atualizar item:', error);
      throw new Error(`Erro ao atualizar item: ${error.message}`);
    }

    logger.info('✅ [BLACKLIST] Item atualizado com sucesso:', id);
    res.json({ success: true, blacklistItem: updatedItem });
  } catch (error) {
    logger.error('❌ [BLACKLIST] Erro ao atualizar item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/blacklist/:id
 * Remove um item da blacklist
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info('🗑️ [BLACKLIST] Removendo item da blacklist:', id);
    
    if (!req.user) {
      logger.error('❌ [BLACKLIST] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!req.user.organization_id) {
      logger.error('❌ [BLACKLIST] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Verificar se o item existe e pertence à organização
    const { data: existingItem } = await supabaseAdmin
      .from('blacklist')
      .select('id, numero_telefone')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (!existingItem) {
      logger.error('❌ [BLACKLIST] Item não encontrado ou não pertence à organização');
      return res.status(404).json({ success: false, error: 'Item não encontrado' });
    }

    // Remover item
    const { error } = await supabaseAdmin
      .from('blacklist')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('❌ [BLACKLIST] Erro ao remover item:', error);
      throw new Error(`Erro ao remover item: ${error.message}`);
    }

    logger.info('✅ [BLACKLIST] Item removido com sucesso:', existingItem.numero_telefone);
    res.json({ success: true, message: 'Item removido da blacklist com sucesso' });
  } catch (error) {
    logger.error('❌ [BLACKLIST] Erro ao remover item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blacklist/check/:numero
 * Verifica se um número está na blacklist
 */
router.get('/check/:numero', async (req, res) => {
  try {
    const { numero } = req.params;
    
    logger.info('🔍 [BLACKLIST] Verificando se número está na blacklist:', numero);
    
    if (!req.user) {
      logger.error('❌ [BLACKLIST] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!req.user.organization_id) {
      logger.error('❌ [BLACKLIST] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }

    // Normalizar número de telefone
    const numeroNormalizado = numero.replace(/\D/g, '');
    
    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Verificar se está na blacklist
    const { data: blacklistItem } = await supabaseAdmin
      .from('blacklist')
      .select('id, motivo, ativo')
      .eq('organization_id', req.user.organization_id)
      .eq('numero_telefone', numeroNormalizado)
      .eq('ativo', true)
      .single();

    const isBlacklisted = !!blacklistItem;
    
    logger.info(`✅ [BLACKLIST] Número ${numeroNormalizado} ${isBlacklisted ? 'está' : 'não está'} na blacklist`);
    
    res.json({ 
      success: true, 
      isBlacklisted,
      blacklistItem: blacklistItem || null
    });
  } catch (error) {
    logger.error('❌ [BLACKLIST] Erro ao verificar blacklist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blacklist/logs
 * Lista os logs da blacklist
 */
router.get('/logs', async (req, res) => {
  try {
    logger.info('📋 [BLACKLIST] Listando logs da blacklist');
    
    if (!req.user) {
      logger.error('❌ [BLACKLIST] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!req.user.organization_id) {
      logger.error('❌ [BLACKLIST] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    const { data: logs, error } = await supabaseAdmin
      .from('blacklist_logs')
      .select(`
        *,
        usuario_profile:profiles!blacklist_logs_usuario_id_fkey(
          id,
          name,
          email
        )
      `)
      .eq('organization_id', req.user.organization_id)
      .order('criado_em', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('❌ [BLACKLIST] Erro ao buscar logs:', error);
      throw new Error(`Erro ao buscar logs: ${error.message}`);
    }

    logger.info(`✅ [BLACKLIST] Encontrados ${logs?.length || 0} logs`);
    res.json({ success: true, logs: logs || [] });
  } catch (error) {
    logger.error('❌ [BLACKLIST] Erro ao listar logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
