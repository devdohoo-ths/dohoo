import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

// Listar todas as categorias de tags
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('tag_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data });
});

// Adicionar nova categoria de tag
router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { data, error } = await supabase
    .from('tag_categories')
    .insert([{ name, color }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ category: data[0] });
});

// Editar categoria de tag
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  const { data, error } = await supabase
    .from('tag_categories')
    .update({ name, color })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ category: data[0] });
});

// Deletar categoria de tag
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('tag_categories')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Categoria removida com sucesso' });
});

export default router; 