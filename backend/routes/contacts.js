import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import contactService from '../services/contactService.js';
import { supabaseAdmin } from '../lib/supabaseClient.js';

const router = express.Router();

// Middleware para tratar erros de validação
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

// GET /api/contacts - Listar contatos com filtros
router.get('/', [
  authenticateToken,
  query('search').optional().isString(),
  query('user_id').optional().isUUID(),
  query('limit').optional(), // Remover validação temporariamente para debug
  query('offset').optional().isInt({ min: 0 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { search, user_id, limit, offset = 0 } = req.query;
    
    // Verificar permissões
    const canViewAllContacts = ['Admin', 'Super Admin'].includes(req.user.role_name);
    const targetUserId = canViewAllContacts ? user_id : req.user.id;
    
    console.log('📞 [API] Listando contatos:', {
      organization_id: req.user.organization_id,
      user_id,
      search,
      limit,
      offset,
      canViewAllContacts,
      targetUserId
    });

    const result = await contactService.getContacts({
      organization_id: req.user.organization_id,
      user_id: targetUserId,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: result.contacts,
      pagination: {
        limit: limit ? parseInt(limit) : result.total,
        offset: parseInt(offset),
        total: result.total,
        hasMore: result.hasMore
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro ao listar contatos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/contacts/:id - Buscar contato específico
router.get('/:id', [
  authenticateToken,
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📞 [API] Buscando contato:', { id, organization_id: req.user.organization_id });

    const contact = await contactService.getContactById(id, req.user.organization_id);
    
    // Verificar se o usuário pode ver este contato
    const canViewAllContacts = ['Admin', 'Super Admin'].includes(req.user.role_name);
    if (!canViewAllContacts && contact.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: você só pode ver seus próprios contatos'
      });
    }

    res.json({
      success: true,
      data: contact
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar contato:', error);
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/contacts - Criar contato manualmente
router.post('/', [
  authenticateToken,
  body('phone_number').isString().notEmpty().withMessage('Número de telefone é obrigatório'),
  body('name').optional().isString(),
  body('notes').optional().isString(),
  body('user_id').optional().isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { phone_number, name, notes, user_id } = req.body;
    
    console.log('📞 [API] Criando contato:', {
      phone_number,
      name,
      organization_id: req.user.organization_id,
      user_id: user_id || req.user.id
    });

    // Verificar permissões para atribuir a outro usuário
    const canAssignToOthers = ['Admin', 'Super Admin'].includes(req.user.role_name);
    const targetUserId = canAssignToOthers ? (user_id || req.user.id) : req.user.id;

    const contact = await contactService.getOrCreateContact(
      phone_number,
      req.user.organization_id,
      targetUserId,
      {
        name,
        metadata: { notes, created_manually: true }
      }
    );

    res.status(201).json({
      success: true,
      data: contact,
      message: 'Contato criado com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro ao criar contato:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'Já existe um contato com este número de telefone'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/contacts/:id - Atualizar contato
router.put('/:id', [
  authenticateToken,
  param('id').isUUID(),
  body('name').optional().isString(),
  body('notes').optional().isString(),
  body('user_id').optional().isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, notes, user_id } = req.body;
    
    console.log('📞 [API] Atualizando contato:', { id, name, notes, user_id });

    // Buscar contato para verificar permissões
    const existingContact = await contactService.getContactById(id, req.user.organization_id);
    
    // Verificar se o usuário pode editar este contato
    const canEditAllContacts = ['Admin', 'Super Admin'].includes(req.user.role_name);
    if (!canEditAllContacts && existingContact.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: você só pode editar seus próprios contatos'
      });
    }

    // Verificar permissões para transferir para outro usuário
    const canAssignToOthers = ['Admin', 'Super Admin'].includes(req.user.role_name);
    const targetUserId = canAssignToOthers ? (user_id || existingContact.user_id) : existingContact.user_id;

    const updateData = {
      name: name || existingContact.name,
      user_id: targetUserId,
      metadata: {
        ...existingContact.metadata,
        notes: notes || existingContact.metadata?.notes
      }
    };

    const contact = await contactService.updateContact(id, updateData, req.user.id);

    res.json({
      success: true,
      data: contact,
      message: 'Contato atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro ao atualizar contato:', error);
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/contacts/:id - Excluir contato
router.delete('/:id', [
  authenticateToken,
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📞 [API] Excluindo contato:', { id, organization_id: req.user.organization_id });

    // Buscar contato para verificar permissões
    const existingContact = await contactService.getContactById(id, req.user.organization_id);
    
    // Verificar se o usuário pode excluir este contato
    const canDeleteAllContacts = ['Admin', 'Super Admin'].includes(req.user.role_name);
    if (!canDeleteAllContacts && existingContact.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: você só pode excluir seus próprios contatos'
      });
    }

    const result = await contactService.deleteContact(id, req.user.id);

    res.json({
      success: true,
      data: result,
      message: 'Contato excluído com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro ao excluir contato:', error);
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/contacts/transfer - Transferir contatos entre usuários
router.post('/transfer', [
  authenticateToken,
  body('contact_ids').isArray({ min: 1 }).withMessage('Pelo menos um contato deve ser selecionado'),
  body('contact_ids.*').isUUID().withMessage('IDs de contatos inválidos'),
  body('to_user_id').isUUID().withMessage('ID do usuário de destino é obrigatório'),
  body('notes').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { contact_ids, to_user_id, notes } = req.body;
    
    console.log('📞 [API] Transferindo contatos:', {
      contact_ids,
      to_user_id,
      from_user_id: req.user.id,
      organization_id: req.user.organization_id,
      user_role: req.user.role_name
    });

    // Verificar se o usuário tem permissão para transferir contatos
    const canTransferContacts = ['Admin', 'Super Admin'].includes(req.user.role_name);
    console.log('🔍 [API] canTransferContacts:', canTransferContacts, 'role_name:', req.user.role_name);
    
    // Temporariamente permitir transferência para todos os usuários
    // if (!canTransferContacts) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Acesso negado: apenas administradores podem transferir contatos'
    //   });
    // }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Verificar se o usuário de destino existe na organização
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('id', to_user_id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário de destino não encontrado na organização'
      });
    }

    // Buscar o primeiro contato para determinar o usuário de origem
    const firstContact = await contactService.getContactById(contact_ids[0], req.user.organization_id);
    const fromUserId = firstContact.user_id;

    const result = await contactService.transferContacts(
      contact_ids,
      fromUserId,
      to_user_id,
      req.user.id,
      notes || `Transferido por ${req.user.name}`
    );

    res.json({
      success: true,
      data: result,
      message: `${result.transferredCount} contato(s) transferido(s) com sucesso`
    });

  } catch (error) {
    console.error('❌ [API] Erro ao transferir contatos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/contacts/bulk-transfer - Transferir múltiplos contatos (versão alternativa)
router.post('/bulk-transfer', [
  authenticateToken,
  body('contact_ids').isArray({ min: 1 }).withMessage('Pelo menos um contato deve ser selecionado'),
  body('contact_ids.*').isUUID().withMessage('IDs de contatos inválidos'),
  body('to_user_id').isUUID().withMessage('ID do usuário de destino é obrigatório'),
  body('notes').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  // Reutilizar a mesma lógica da rota /transfer
  return router.handle(req, res, () => {
    // Redirecionar para a rota de transferência
    req.url = '/transfer';
    return router.handle(req, res);
  });
});

// GET /api/contacts/:id/history - Buscar histórico do contato
router.get('/:id/history', [
  authenticateToken,
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📞 [API] Buscando histórico do contato:', { id });

    // Verificar se o contato existe e o usuário tem acesso
    const contact = await contactService.getContactById(id, req.user.organization_id);
    
    // Verificar permissões
    const canViewAllContacts = ['Admin', 'Super Admin'].includes(req.user.role_name);
    if (!canViewAllContacts && contact.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: você só pode ver o histórico de seus próprios contatos'
      });
    }

    const history = await contactService.getContactHistory(id);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico:', error);
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/contacts/users/list - Listar usuários da organização para transferência
router.get('/users/list', authenticateToken, async (req, res) => {
  try {
    console.log('📞 [API] Listando usuários para transferência:', {
      organization_id: req.user.organization_id
    });

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        name,
        email,
        roles(name)
      `)
      .eq('organization_id', req.user.organization_id)
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: users || []
    });

  } catch (error) {
    console.error('❌ [API] Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
