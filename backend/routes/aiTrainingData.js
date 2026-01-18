import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// GET /api/ai-training-data/:assistantId - Listar dados de treinamento de um assistente
router.get('/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    
    console.log('🤖 [API] Buscando dados de treinamento para assistente:', assistantId);
    
    // Verificar se o assistente pertence ao usuário
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('id, user_id')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }

    if (assistant.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado - Assistente não pertence ao usuário' });
    }

    const { data: trainingData, error } = await supabase
      .from('ai_training_data')
      .select('*')
      .eq('assistant_id', assistantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro ao buscar dados de treinamento:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados de treinamento' });
    }

    console.log(`✅ [API] ${trainingData?.length || 0} dados de treinamento encontrados`);
    
    res.json({ 
      success: true,
      trainingData: trainingData || []
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar dados de treinamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/ai-training-data - Criar novo dado de treinamento
router.post('/', async (req, res) => {
  try {
    const { assistant_id, question, answer, category = 'Geral', tags = [] } = req.body;
    
    if (!assistant_id || !question || !answer) {
      return res.status(400).json({ error: 'assistant_id, question e answer são obrigatórios' });
    }

    console.log('🤖 [API] Criando novo dado de treinamento para assistente:', assistant_id);
    
    // Verificar se o assistente pertence ao usuário
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('id, user_id')
      .eq('id', assistant_id)
      .single();

    if (assistantError || !assistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }

    if (assistant.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado - Assistente não pertence ao usuário' });
    }

    const { data: trainingData, error } = await supabase
      .from('ai_training_data')
      .insert([{
        assistant_id,
        question,
        answer,
        category,
        tags: Array.isArray(tags) ? tags : [],
        validated: false
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao criar dado de treinamento:', error);
      return res.status(500).json({ error: 'Erro ao criar dado de treinamento' });
    }

    console.log('✅ [API] Dado de treinamento criado com sucesso:', trainingData.id);
    
    res.json({ 
      success: true,
      trainingData 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao criar dado de treinamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/ai-training-data/:assistantId/categories - Listar categorias disponíveis
router.get('/:assistantId/categories', async (req, res) => {
  try {
    const { assistantId } = req.params;
    
    console.log('🤖 [API] Buscando categorias de dados de treinamento para assistente:', assistantId);
    
    // Verificar se o assistente pertence ao usuário
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('id, user_id')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }

    if (assistant.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado - Assistente não pertence ao usuário' });
    }

    const { data: categories, error } = await supabase
      .from('ai_training_data')
      .select('category')
      .eq('assistant_id', assistantId)
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

// GET /api/ai-training-data/:assistantId/:id - Obter dado de treinamento específico
router.get('/:assistantId/:id', async (req, res) => {
  try {
    const { assistantId, id } = req.params;
    
    console.log('🤖 [API] Buscando dado de treinamento:', id);
    
    // Verificar se o assistente pertence ao usuário
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('id, user_id')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }

    if (assistant.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado - Assistente não pertence ao usuário' });
    }

    const { data: trainingData, error } = await supabase
      .from('ai_training_data')
      .select('*')
      .eq('id', id)
      .eq('assistant_id', assistantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Dado de treinamento não encontrado' });
      }
      console.error('❌ [API] Erro ao buscar dado de treinamento:', error);
      return res.status(500).json({ error: 'Erro ao buscar dado de treinamento' });
    }

    res.json({ 
      success: true,
      trainingData 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar dado de treinamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/ai-training-data/:assistantId/:id - Atualizar dado de treinamento
router.patch('/:assistantId/:id', async (req, res) => {
  try {
    const { assistantId, id } = req.params;
    const { question, answer, category, tags, validated } = req.body;
    
    console.log('🤖 [API] Atualizando dado de treinamento:', id, req.body);
    
    // Verificar se o assistente pertence ao usuário
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('id, user_id')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }

    if (assistant.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado - Assistente não pertence ao usuário' });
    }

    const updateData = {};
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (validated !== undefined) updateData.validated = validated;
    
    updateData.updated_at = new Date().toISOString();

    const { data: trainingData, error } = await supabase
      .from('ai_training_data')
      .update(updateData)
      .eq('id', id)
      .eq('assistant_id', assistantId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Dado de treinamento não encontrado' });
      }
      console.error('❌ [API] Erro ao atualizar dado de treinamento:', error);
      return res.status(500).json({ error: 'Erro ao atualizar dado de treinamento' });
    }

    console.log('✅ [API] Dado de treinamento atualizado com sucesso');
    
    res.json({ 
      success: true,
      trainingData 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar dado de treinamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/ai-training-data/:assistantId/:id - Deletar dado de treinamento
router.delete('/:assistantId/:id', async (req, res) => {
  try {
    const { assistantId, id } = req.params;
    
    console.log('🤖 [API] Deletando dado de treinamento:', id);
    
    // Verificar se o assistente pertence ao usuário
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('id, user_id')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }

    if (assistant.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado - Assistente não pertence ao usuário' });
    }

    const { error } = await supabase
      .from('ai_training_data')
      .delete()
      .eq('id', id)
      .eq('assistant_id', assistantId);

    if (error) {
      console.error('❌ [API] Erro ao deletar dado de treinamento:', error);
      return res.status(500).json({ error: 'Erro ao deletar dado de treinamento' });
    }

    console.log('✅ [API] Dado de treinamento deletado com sucesso');
    
    res.json({ 
      success: true,
      message: 'Dado de treinamento deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao deletar dado de treinamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 