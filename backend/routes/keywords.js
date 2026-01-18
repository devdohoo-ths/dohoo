import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

// Listar todas as palavras-chave
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('keywords')
    .select('*')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ keywords: data });
});

// Adicionar nova palavra-chave
router.post('/', async (req, res) => {
  const { name, category_id, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { data, error } = await supabase
    .from('keywords')
    .insert([{ name, category_id, color }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ keyword: data });
});

// Editar palavra-chave
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category_id, color } = req.body;

  const { data, error } = await supabase
    .from('keywords')
    .update({ name, category_id, color })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ keyword: data });
});

// Deletar palavra-chave
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('keywords')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;