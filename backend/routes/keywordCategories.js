import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

// Listar todas as categorias de palavras-chave
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('keyword_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data });
});

// Adicionar nova categoria (opcional)
router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { data, error } = await supabase
    .from('keyword_categories')
    .insert([{ name, color }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ category: data });
});

// Editar categoria (opcional)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  const { data, error } = await supabase
    .from('keyword_categories')
    .update({ name, color })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ category: data });
});

// Deletar categoria (opcional)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('keyword_categories')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;