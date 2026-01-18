import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { CampanhaService } from '../services/campanhaService.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// =====================================================
// UTILITÁRIOS E VALIDAÇÕES
// =====================================================

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

const logCampanhaAction = async (campanhaId, usuarioId, acao, detalhes = {}, req = null) => {
  try {
    await supabase.from('campanha_logs').insert({
      campanha_id: campanhaId,
      usuario_id: usuarioId,
      acao,
      detalhes,
      ip_address: req?.ip || null,
      user_agent: req?.get('User-Agent') || null
    });
  } catch (error) {
    console.error('❌ Erro ao registrar log da campanha:', error);
  }
};

// =====================================================
// ROTAS DE EXECUÇÃO DE CAMPANHAS
// =====================================================

// POST /api/campanhas/:id/start - Iniciar campanha
router.post('/:id/start', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se a campanha existe e pode ser iniciada
    const { data: campanha, error: campanhaError } = await supabase
      .from('campanhas')
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo, variaveis),
        remetentes:campanha_remetentes(
          id,
          usuario_id,
          usuario:profiles(id, name, email)
        )
      `)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (campanhaError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    if (campanha.status !== 'rascunho') {
      return res.status(400).json({
        success: false,
        error: 'Apenas campanhas em rascunho podem ser iniciadas'
      });
    }

    // Verificar se há template ou conteúdo de mensagem
    if (!campanha.template && !campanha.configuracoes?.message_content) {
      return res.status(400).json({
        success: false,
        error: 'Campanha deve ter um template ou conteúdo de mensagem definido'
      });
    }

    if (!campanha.remetentes || campanha.remetentes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum remetente configurado para a campanha'
      });
    }

    // Verificar se há contatos pendentes
    console.log(`🔍 [INICIAR CAMPANHA] Verificando contatos pendentes para campanha ${id}`);
    
    const { data: todosContatos, error: todosContatosError } = await supabase
      .from('campanha_contatos')
      .select('id, status, contato_nome, contato_telefone')
      .eq('campanha_id', id);

    if (todosContatosError) throw todosContatosError;
    
    console.log(`🔍 [INICIAR CAMPANHA] Total de contatos na campanha: ${todosContatos?.length || 0}`);
    if (todosContatos) {
      const statusCount = todosContatos.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`🔍 [INICIAR CAMPANHA] Status dos contatos:`, statusCount);
    }

    const { data: contatosPendentes, error: contatosError } = await supabase
      .from('campanha_contatos')
      .select('id')
      .eq('campanha_id', id)
      .eq('status', 'pendente');

    if (contatosError) throw contatosError;

    console.log(`🔍 [INICIAR CAMPANHA] Contatos pendentes: ${contatosPendentes?.length || 0}`);

    if (!contatosPendentes || contatosPendentes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum contato pendente para envio'
      });
    }

    // Atualizar status da campanha para "em_execucao"
    const { error: updateError } = await supabase
      .from('campanhas')
      .update({
        status: 'em_execucao',
        data_inicio: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Log da ação
    await logCampanhaAction(id, req.user.id, 'campanha_iniciada', {
      contatos_pendentes: contatosPendentes.length,
      remetentes: campanha.remetentes.length
    }, req);

    // Iniciar processamento assíncrono da campanha
    CampanhaService.processarCampanha(id).catch(error => {
      console.error('❌ Erro no processamento da campanha:', error);
    });

    res.json({
      success: true,
      message: 'Campanha iniciada com sucesso',
      data: {
        id,
        status: 'em_execucao',
        contatos_pendentes: contatosPendentes.length
      }
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/:id/pause - Pausar campanha
router.post('/:id/pause', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se a campanha pode ser pausada
    const { data: campanha, error: checkError } = await supabase
      .from('campanhas')
      .select('id, status, nome')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (checkError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    if (campanha.status !== 'em_execucao') {
      return res.status(400).json({
        success: false,
        error: 'Apenas campanhas em execução podem ser pausadas'
      });
    }

    // Atualizar status para pausada
    const { error: updateError } = await supabase
      .from('campanhas')
      .update({ status: 'pausada' })
      .eq('id', id);

    if (updateError) throw updateError;

    // Log da ação
    await logCampanhaAction(id, req.user.id, 'campanha_pausada', {
      nome: campanha.nome
    }, req);

    res.json({
      success: true,
      message: 'Campanha pausada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao pausar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/:id/resume - Retomar campanha pausada
router.post('/:id/resume', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se a campanha pode ser retomada
    const { data: campanha, error: checkError } = await supabase
      .from('campanhas')
      .select('id, status, nome')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (checkError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    if (campanha.status !== 'pausada') {
      return res.status(400).json({
        success: false,
        error: 'Apenas campanhas pausadas podem ser retomadas'
      });
    }

    // Atualizar status para em_execucao
    const { error: updateError } = await supabase
      .from('campanhas')
      .update({ status: 'em_execucao' })
      .eq('id', id);

    if (updateError) throw updateError;

    // Log da ação
    await logCampanhaAction(id, req.user.id, 'campanha_retomada', {
      nome: campanha.nome
    }, req);

    // Retomar processamento da campanha
    CampanhaService.processarCampanha(id).catch(error => {
      console.error('❌ Erro no processamento da campanha:', error);
    });

    res.json({
      success: true,
      message: 'Campanha retomada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao retomar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/:id/contatos - Listar contatos da campanha
router.get('/:id/contatos', [
  param('id').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pendente', 'enviado', 'erro', 'respondido']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    // Verificar se a campanha pertence à organização
    const { data: campanha, error: campanhaError } = await supabase
      .from('campanhas')
      .select('id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (campanhaError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    let query = supabase
      .from('campanha_contatos')
      .select(`
        *,
        enviado_por_profile:profiles!campanha_contatos_enviado_por_fkey(
          id,
          name,
          email
        )
      `)
      .eq('campanha_id', id)
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: contatos, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: contatos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar contatos da campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/:id/logs - Listar logs da campanha
router.get('/:id/logs', [
  param('id').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Verificar se a campanha pertence à organização
    const { data: campanha, error: campanhaError } = await supabase
      .from('campanhas')
      .select('id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (campanhaError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    const { data: logs, error, count } = await supabase
      .from('campanha_logs')
      .select(`
        *,
        usuario:profiles(
          id,
          name,
          email
        )
      `)
      .eq('campanha_id', id)
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar logs da campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/:id/relatorio - Relatório detalhado da campanha
router.get('/:id/relatorio', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se a campanha pertence à organização
    const { data: campanha, error: campanhaError } = await supabase
      .from('campanhas')
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo),
        created_by_profile:profiles!campanhas_created_by_fkey(
          id,
          name,
          email
        )
      `)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (campanhaError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    // Estatísticas gerais
    const { data: contatos, error: contatosError } = await supabase
      .from('campanha_contatos')
      .select('status, enviado_em, respondido_em, sentimento_ia')
      .eq('campanha_id', id);

    if (contatosError) throw contatosError;

    const estatisticas = {
      total: contatos.length,
      pendente: contatos.filter(c => c.status === 'pendente').length,
      enviado: contatos.filter(c => c.status === 'enviado').length,
      respondido: contatos.filter(c => c.status === 'respondido').length,
      erro: contatos.filter(c => c.status === 'erro').length,
      taxa_resposta: contatos.length > 0 
        ? ((contatos.filter(c => c.status === 'respondido').length / contatos.filter(c => c.status === 'enviado' || c.status === 'respondido').length) * 100).toFixed(2)
        : 0
    };

    // Análise de sentimento (se IA estiver ativa)
    let sentimentos = null;
    if (campanha.usar_ia) {
      const respostasComSentimento = contatos.filter(c => c.sentimento_ia);
      sentimentos = {
        total: respostasComSentimento.length,
        positivo: respostasComSentimento.filter(c => c.sentimento_ia === 'positivo').length,
        neutro: respostasComSentimento.filter(c => c.sentimento_ia === 'neutro').length,
        negativo: respostasComSentimento.filter(c => c.sentimento_ia === 'negativo').length
      };
    }

    // Distribuição por remetente
    const { data: remetentes, error: remetentesError } = await supabase
      .from('campanha_remetentes')
      .select(`
        *,
        usuario:profiles(id, name, email)
      `)
      .eq('campanha_id', id);

    if (remetentesError) throw remetentesError;

    // Gráfico temporal de envios (últimos 7 dias)
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const enviosPorDia = [];
    for (let i = 6; i >= 0; i--) {
      const data = new Date(agora.getTime() - i * 24 * 60 * 60 * 1000);
      const dataStr = data.toISOString().split('T')[0];
      
      const enviosNoDia = contatos.filter(c => 
        c.enviado_em && c.enviado_em.startsWith(dataStr)
      ).length;
      
      enviosPorDia.push({
        data: dataStr,
        envios: enviosNoDia
      });
    }

    res.json({
      success: true,
      data: {
        campanha,
        estatisticas,
        sentimentos,
        remetentes,
        envios_por_dia: enviosPorDia
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar relatório da campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/:id/test - Enviar mensagem de teste
router.post('/:id/test', [
  param('id').isUUID(),
  body('contato_id').isUUID().withMessage('ID do contato é obrigatório'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { contato_id } = req.body;

    // Verificar se a campanha existe
    const { data: campanha, error: campanhaError } = await supabase
      .from('campanhas')
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo, variaveis)
      `)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (campanhaError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    // Verificar se o contato existe
    const { data: contato, error: contatoError } = await supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('id', contato_id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (contatoError || !contato) {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }

    // Renderizar mensagem de teste
    const mensagemTeste = CampanhaService.renderizarMensagem(
      campanha.template.conteudo,
      contato
    );

    // Log da ação
    await logCampanhaAction(id, req.user.id, 'teste_mensagem', {
      contato_id,
      contato_nome: contato.name,
      mensagem: mensagemTeste
    }, req);

    res.json({
      success: true,
      data: {
        contato,
        mensagem_original: campanha.template.conteudo,
        mensagem_renderizada: mensagemTeste,
        variaveis_detectadas: campanha.template.variaveis
      },
      message: 'Mensagem de teste gerada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao gerar teste de mensagem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
