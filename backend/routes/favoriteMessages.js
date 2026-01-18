import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// GET /api/favorite-messages - Listar mensagens favoritas do usuário
router.get('/', async (req, res) => {
  try {
    console.log('📝 [API] Buscando mensagens favoritas do usuário:', req.user.id);
    
    const { data: messages, error } = await supabase
      .from('favorite_messages')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro ao buscar mensagens favoritas:', error);
      return res.status(500).json({ error: 'Erro ao buscar mensagens favoritas' });
    }

    console.log(`✅ [API] ${messages?.length || 0} mensagens favoritas encontradas`);
    
    res.json({ 
      success: true,
      messages: messages || []
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar mensagens favoritas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/favorite-messages - Criar nova mensagem favorita
router.post('/', async (req, res) => {
  try {
    const { title, content, category = 'geral' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    console.log('📝 [API] Criando nova mensagem favorita:', title);
    
    const { data: message, error } = await supabase
      .from('favorite_messages')
      .insert([{
        user_id: req.user.id,
        title,
        content,
        category
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao criar mensagem favorita:', error);
      return res.status(500).json({ error: 'Erro ao criar mensagem favorita' });
    }

    console.log('✅ [API] Mensagem favorita criada com sucesso:', message.id);
    
    res.json({ 
      success: true,
      message 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao criar mensagem favorita:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/favorite-messages/categories - Listar categorias disponíveis
router.get('/categories', async (req, res) => {
  try {
    console.log('📝 [API] Buscando categorias de mensagens favoritas');
    
    const { data: categories, error } = await supabase
      .from('favorite_messages')
      .select('category')
      .eq('user_id', req.user.id)
      .not('category', 'is', null);

    if (error) {
      console.error('❌ [API] Erro ao buscar categorias:', error);
      return res.status(500).json({ error: 'Erro ao buscar categorias' });
    }

    // Extrair categorias únicas
    const uniqueCategories = [...new Set(categories.map(c => c.category))];
    
    console.log(`✅ [API] ${uniqueCategories.length} categorias encontradas`);
    
    res.json({ 
      success: true,
      categories: uniqueCategories
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/favorite-messages/:id - Obter mensagem favorita específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📝 [API] Buscando mensagem favorita:', id);
    
    const { data: message, error } = await supabase
      .from('favorite_messages')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Mensagem favorita não encontrada' });
      }
      console.error('❌ [API] Erro ao buscar mensagem favorita:', error);
      return res.status(500).json({ error: 'Erro ao buscar mensagem favorita' });
    }

    res.json({ 
      success: true,
      message 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar mensagem favorita:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/favorite-messages/:id - Atualizar mensagem favorita
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category } = req.body;
    
    console.log('📝 [API] Atualizando mensagem favorita:', id, req.body);
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    
    updateData.updated_at = new Date().toISOString();

    const { data: message, error } = await supabase
      .from('favorite_messages')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Mensagem favorita não encontrada' });
      }
      console.error('❌ [API] Erro ao atualizar mensagem favorita:', error);
      return res.status(500).json({ error: 'Erro ao atualizar mensagem favorita' });
    }

    console.log('✅ [API] Mensagem favorita atualizada com sucesso');
    
    res.json({ 
      success: true,
      message 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar mensagem favorita:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/favorite-messages/:id - Deletar mensagem favorita
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📝 [API] Deletando mensagem favorita:', id);
    
    const { error } = await supabase
      .from('favorite_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('❌ [API] Erro ao deletar mensagem favorita:', error);
      return res.status(500).json({ error: 'Erro ao deletar mensagem favorita' });
    }

    console.log('✅ [API] Mensagem favorita deletada com sucesso');
    
    res.json({ 
      success: true,
      message: 'Mensagem favorita deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao deletar mensagem favorita:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 