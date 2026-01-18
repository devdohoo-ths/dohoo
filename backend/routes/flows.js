import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

// Salvar fluxo (criar ou atualizar)
router.post('/save', async (req, res) => {
  try {
    const { flow } = req.body;
    
    if (!flow || !flow.nome || !flow.organization_id) {
      return res.status(400).json({ error: 'Dados do fluxo incompletos.' });
    }
    
    const cleanNodes = (flow.nodes || []).map(node => ({
      id: node.id,
      type: node.data?.nodeType || node.type,
      position: node.position,
      data: {
        label: node.data?.label,
        config: node.data?.config || {}
      }
    }));
    
    const cleanEdges = (flow.edges || []).map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: edge.type,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    }));
    
    let result;
    // Se o ID começa com 'temp-', é um novo flow
    const isNewFlow = !flow.id || flow.id.startsWith('temp-');
    
    if (!isNewFlow) {
      // Atualizar flow existente
      result = await supabase
        .from('fluxos')
        .update({
          nome: flow.nome,
          descricao: flow.descricao,
          nodes: cleanNodes,
          edges: cleanEdges,
          ativo: flow.ativo,
          canal: flow.canal
        })
        .eq('id', flow.id)
        .eq('organization_id', flow.organization_id)
        .select();
    } else {
      // Criar novo flow
      result = await supabase
        .from('fluxos')
        .insert([{
          nome: flow.nome,
          descricao: flow.descricao,
          nodes: cleanNodes,
          edges: cleanEdges,
          ativo: flow.ativo,
          canal: flow.canal,
          organization_id: flow.organization_id,
          user_id: flow.user_id
        }])
        .select();
    }
    
    if (result.error) {
      console.error('[flows.js] Erro do Supabase:', result.error);
      throw result.error;
    }
    
    const savedId = !isNewFlow ? flow.id : result.data?.[0]?.id;
    
    res.json({ success: true, id: savedId, flow: result.data?.[0] });
  } catch (error) {
    console.error('[flows.js] Erro ao salvar fluxo:', error);
    res.status(500).json({ error: 'Erro ao salvar fluxo.' });
  }
});

// Listar fluxos por organização
router.get('/list', async (req, res) => {
  try {
    const { organization_id } = req.query;
    if (!organization_id) {
      return res.status(400).json({ error: 'organization_id é obrigatório.' });
    }
    const { data, error } = await supabase
      .from('fluxos')
      .select('*')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, flows: data });
  } catch (error) {
    console.error('[flows.js] Erro ao listar fluxos:', error);
    res.status(500).json({ error: 'Erro ao listar fluxos.' });
  }
});

// Excluir fluxo
router.delete('/delete', async (req, res) => {
  try {
    const { id, organization_id } = req.body;
    if (!id || !organization_id) {
      return res.status(400).json({ error: 'ID e organization_id são obrigatórios.' });
    }
    const { error } = await supabase
      .from('fluxos')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[flows.js] Erro ao excluir fluxo:', error);
    res.status(500).json({ error: 'Erro ao excluir fluxo.' });
  }
});

// Alternar status ativo do fluxo
router.post('/toggle-active', async (req, res) => {
  try {
    const { id, organization_id, ativo } = req.body;
    if (!id || !organization_id) {
      return res.status(400).json({ error: 'ID e organization_id são obrigatórios.' });
    }
    
    // Se está ativando, verificar se já existe um fluxo ativo
    if (ativo) {
      const { data: existingActive } = await supabase
        .from('fluxos')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('ativo', true)
        .neq('id', id)
        .single();
      
      if (existingActive) {
        return res.status(400).json({ error: 'Já existe um fluxo ativo para esta organização.' });
      }
    }
    
    const { error } = await supabase
      .from('fluxos')
      .update({ ativo })
      .eq('id', id)
      .eq('organization_id', organization_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[flows.js] Erro ao alternar status do fluxo:', error);
    res.status(500).json({ error: 'Erro ao alternar status do fluxo.' });
  }
});

export default router; 