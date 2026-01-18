import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

// Listar todos os status
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('status')
    .select('*')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ status: data });
});

// Adicionar novo status
router.post('/', async (req, res) => {
  const { name, category_id, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { data, error } = await supabase
    .from('status')
    .insert([{ name, category_id, color }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ status: data[0] });
});

// Editar status
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category_id, color } = req.body;

  const { data, error } = await supabase
    .from('status')
    .update({ name, category_id, color })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ status: data[0] });
});

// Deletar status
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('status')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Status removido com sucesso' });
});

export default router; 