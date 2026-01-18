import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

// Listar todas as tags
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ tags: data });
});

// Adicionar nova tag
router.post('/', async (req, res) => {
  const { name, category_id, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { data, error } = await supabase
    .from('tags')
    .insert([{ name, category_id, color, usage_count: 0 }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ tag: data[0] });
});

// Editar tag
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category_id, color } = req.body;

  const { data, error } = await supabase
    .from('tags')
    .update({ name, category_id, color })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ tag: data[0] });
});

// Deletar tag
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Tag removida com sucesso' });
});

export default router; 