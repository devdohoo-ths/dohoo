import express from 'express';
import { supabase } from '../integrations/supabase/client.js';

const router = express.Router();

// Função auxiliar para verificar se é Super Admin
async function getUserRoleName(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles(name)')
    .eq('id', userId)
    .single();
  
  return profile?.roles?.name || null;
}

// GET /api/poc-email-templates - Listar todos os templates
router.get('/', async (req, res) => {
  try {
    const { user } = req;
    const { type, is_active } = req.query;

    console.log('🎯 [API] GET /poc-email-templates - Listando templates:', { userId: user?.id, type, is_active });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem acessar templates');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    let query = supabase
      .from('poc_email_templates')
      .select(`
        *,
        profiles:created_by (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (type) {
      query = query.eq('type', type);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('❌ [API] Erro ao buscar templates:', error);
      return res.status(500).json({ error: 'Erro ao buscar templates' });
    }

    console.log('✅ [API] Templates encontrados:', templates?.length || 0);

    res.json({
      success: true,
      templates: templates || []
    });

  } catch (error) {
    console.error('❌ [API] Erro ao listar templates:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/poc-email-templates/:id - Buscar template específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    console.log('🎯 [API] GET /poc-email-templates/:id - Buscando template:', { id, userId: user?.id });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem acessar templates');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { data: template, error } = await supabase
      .from('poc_email_templates')
      .select(`
        *,
        profiles:created_by (
          id,
          name,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (error || !template) {
      console.log('❌ [API] Template não encontrado:', error);
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    console.log('✅ [API] Template encontrado:', template.name);

    res.json({
      success: true,
      template
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/poc-email-templates - Criar novo template
router.post('/', async (req, res) => {
  try {
    const { user } = req;
    const { name, subject, body, type, days_before, is_active } = req.body;

    console.log('🎯 [API] POST /poc-email-templates - Criando template:', { 
      userId: user?.id, 
      name, 
      type 
    });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem criar templates');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Validações
    if (!name || !subject || !body || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    if (type === 'expiring_soon' && !days_before) {
      return res.status(400).json({ error: 'days_before é obrigatório para templates do tipo expiring_soon' });
    }

    const { data: template, error } = await supabase
      .from('poc_email_templates')
      .insert({
        name,
        subject,
        body,
        type,
        days_before: type === 'expiring_soon' ? days_before : null,
        is_active: is_active !== undefined ? is_active : true,
        is_default: false,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao criar template:', error);
      return res.status(500).json({ error: 'Erro ao criar template' });
    }

    console.log('✅ [API] Template criado:', template.id);

    res.json({
      success: true,
      message: 'Template criado com sucesso',
      template
    });

  } catch (error) {
    console.error('❌ [API] Erro ao criar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/poc-email-templates/:id - Atualizar template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const { name, subject, body, type, days_before, is_active } = req.body;

    console.log('🎯 [API] PUT /poc-email-templates/:id - Atualizando template:', { 
      id, 
      userId: user?.id 
    });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem atualizar templates');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Verificar se o template existe
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('poc_email_templates')
      .select('is_default')
      .eq('id', id)
      .single();

    if (fetchError || !existingTemplate) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    // Não permitir edição de campos críticos em templates padrão
    if (existingTemplate.is_default) {
      // Apenas permitir ativar/desativar templates padrão
      if (is_active === undefined) {
        return res.status(400).json({ error: 'Templates padrão do sistema não podem ser editados, apenas ativados/desativados' });
      }
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    // Adicionar campos apenas se não for template padrão ou se for apenas is_active
    if (!existingTemplate.is_default) {
      if (name) updateData.name = name;
      if (subject) updateData.subject = subject;
      if (body) updateData.body = body;
      if (type) updateData.type = type;
      if (days_before !== undefined) updateData.days_before = days_before;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { data: template, error } = await supabase
      .from('poc_email_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao atualizar template:', error);
      return res.status(500).json({ error: 'Erro ao atualizar template' });
    }

    console.log('✅ [API] Template atualizado:', template.id);

    res.json({
      success: true,
      message: 'Template atualizado com sucesso',
      template
    });

  } catch (error) {
    console.error('❌ [API] Erro ao atualizar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/poc-email-templates/:id - Deletar template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    console.log('🎯 [API] DELETE /poc-email-templates/:id - Deletando template:', { 
      id, 
      userId: user?.id 
    });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem deletar templates');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Verificar se o template existe e se é padrão
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('poc_email_templates')
      .select('is_default')
      .eq('id', id)
      .single();

    if (fetchError || !existingTemplate) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    if (existingTemplate.is_default) {
      return res.status(400).json({ error: 'Templates padrão do sistema não podem ser deletados' });
    }

    const { error } = await supabase
      .from('poc_email_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [API] Erro ao deletar template:', error);
      return res.status(500).json({ error: 'Erro ao deletar template' });
    }

    console.log('✅ [API] Template deletado:', id);

    res.json({
      success: true,
      message: 'Template deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro ao deletar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/poc-email-templates/history/:organizationId - Histórico de emails enviados para uma organização
router.get('/history/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { user } = req;

    console.log('🎯 [API] GET /poc-email-templates/history/:organizationId - Buscando histórico:', { 
      organizationId, 
      userId: user?.id 
    });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem acessar histórico');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { data: history, error } = await supabase
      .from('poc_email_history')
      .select(`
        *,
        poc_email_templates (
          name,
          type
        )
      `)
      .eq('organization_id', organizationId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro ao buscar histórico:', error);
      return res.status(500).json({ error: 'Erro ao buscar histórico' });
    }

    console.log('✅ [API] Histórico encontrado:', history?.length || 0);

    res.json({
      success: true,
      history: history || []
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;

