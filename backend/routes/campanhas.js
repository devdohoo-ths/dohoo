import express from 'express';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// CORS local para garantir cabeçalhos mesmo em respostas de erro deste router (e liberar OPTIONS sem auth)
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-user-id, x-user-role, x-request-id');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

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
    await supabaseAdminAdmin.from('campanha_logs').insert({
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
// ROTAS DE TEMPLATES
// =====================================================

// GET /api/campanhas/templates - Listar templates
router.get('/templates', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('aprovado').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { page = 1, limit = 20, aprovado } = req.query;
    const offset = (page - 1) * limit;

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    let query = supabaseAdmin
      .from('campanha_templates')
      .select(`
        *,
        criado_por_profile:profiles!campanha_templates_criado_por_fkey(
          id,
          name,
          email
        )
      `)
      .eq('organization_id', req.user.organization_id)
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (aprovado !== undefined) {
      query = query.eq('aprovado', aprovado === 'true');
    }

    const { data: templates, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar templates:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/templates - Criar template
router.post('/templates', [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('conteudo').notEmpty().withMessage('Conteúdo é obrigatório'),
  body('variaveis').optional().isArray(),
  body('media_files').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { nome, conteudo, variaveis = [], media_files = [] } = req.body;

    // Extrair variáveis automaticamente do conteúdo
    const variaveisDetectadas = [...conteudo.matchAll(/\{([^}]+)\}/g)]
      .map(match => match[1])
      .filter((v, i, arr) => arr.indexOf(v) === i); // remover duplicatas

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    const { data: template, error } = await supabaseAdminAdmin
      .from('campanha_templates')
      .insert({
        organization_id: req.user.organization_id,
        nome,
        conteudo,
        variaveis: variaveisDetectadas,
        media_files: media_files, // Adicionar suporte a arquivos de mídia
        aprovado: true, // Todos os templates são aprovados automaticamente
        criado_por: req.user.id
      })
      .select(`
        *,
        criado_por_profile:profiles!campanha_templates_criado_por_fkey(
          id,
          name,
          email
        )
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template criado e aprovado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar template:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/templates/:id - Buscar template específico
router.get('/templates/:id', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    const { data: template, error } = await supabaseAdminAdmin
      .from('campanha_templates')
      .select(`
        *,
        criado_por_profile:profiles!campanha_templates_criado_por_fkey(
          id,
          name,
          email
        )
      `)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Template não encontrado'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('❌ Erro ao buscar template:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/campanhas/templates/:id - Atualizar template
router.put('/templates/:id', [
  param('id').isUUID(),
  body('nome').optional().notEmpty(),
  body('conteudo').optional().notEmpty(),
  body('aprovado').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Se o conteúdo foi alterado, reextrair variáveis
    if (updates.conteudo) {
      updates.variaveis = [...updates.conteudo.matchAll(/\{([^}]+)\}/g)]
        .map(match => match[1])
        .filter((v, i, arr) => arr.indexOf(v) === i);
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    const { data: template, error } = await supabaseAdminAdmin
      .from('campanha_templates')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .select(`
        *,
        criado_por_profile:profiles!campanha_templates_criado_por_fkey(
          id,
          name,
          email
        )
      `)
      .single();

    if (error) throw error;

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      data: template,
      message: 'Template atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar template:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/campanhas/templates/:id - Deletar template
router.delete('/templates/:id', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Verificar se o template está sendo usado em alguma campanha
    const { data: campanhasUsando, error: checkError } = await supabaseAdminAdmin
      .from('campanhas')
      .select('id, nome')
      .eq('template_id', id)
      .eq('organization_id', req.user.organization_id);

    if (checkError) throw checkError;

    if (campanhasUsando && campanhasUsando.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Template não pode ser deletado pois está sendo usado em campanhas',
        campanhas: campanhasUsando
      });
    }

    const { error } = await supabaseAdminAdmin
      .from('campanha_templates')
      .delete()
      .eq('id', id)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Template deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar template:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// CONFIGURAÇÃO DO MULTER PARA UPLOAD DE ARQUIVOS
// =====================================================

// Configuração do multer para salvar arquivos em /uploads/campanhas/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'campanhas');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // ✅ AUMENTADO: 100MB (antes era 50MB)
    files: 10 // Limite de arquivos por requisição
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 Multer processando arquivo de campanha:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Aceitar todos os tipos de arquivo para campanhas
    cb(null, true);
  }
});

// =====================================================
// ROTAS DE CAMPANHAS
// =====================================================

// GET /api/campanhas - Listar campanhas
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    let query = supabaseAdmin
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
      .eq('organization_id', req.user.organization_id)
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    // ✅ CORREÇÃO: Suporte a múltiplos status separados por vírgula
    if (status) {
      const statusList = status.split(',').map(s => s.trim());
      if (statusList.length === 1) {
        query = query.eq('status', statusList[0]);
      } else {
        query = query.in('status', statusList);
      }
    }

    const { data: campanhas, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: campanhas,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar campanhas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/:id - Detalhar campanha
router.get('/:id', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    const { data: campanha, error } = await supabaseAdmin
      .from('campanhas')
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo, variaveis),
        created_by_profile:profiles!campanhas_created_by_fkey(
          id,
          name,
          email
        ),
        remetentes:campanha_remetentes(
          id,
          usuario_id,
          numero_whatsapp,
          ativo,
          mensagens_enviadas,
          ultima_mensagem,
          usuario:profiles(id, name, email)
        )
      `)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error) throw error;

    if (!campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    // Buscar estatísticas dos contatos
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('campanha_contatos')
      .select('status')
      .eq('campanha_id', id);

    if (statsError) throw statsError;

    const estatisticas = {
      total: stats.length,
      pendente: stats.filter(s => s.status === 'pendente').length,
      enviado: stats.filter(s => s.status === 'enviado').length,
      respondido: stats.filter(s => s.status === 'respondido').length,
      erro: stats.filter(s => s.status === 'erro').length
    };

    // ✅ ATUALIZAR: Calcular respondidos e taxa de resposta baseado nos dados reais
    const respondidos = estatisticas.respondido || 0;
    const enviados = estatisticas.enviado || 0;
    // ✅ CORREÇÃO: Taxa = respondidos / enviados * 100
    const taxaResposta = enviados > 0 
      ? ((respondidos / enviados) * 100)
      : 0;

    // ✅ DEBUG: Log dos valores calculados
    console.log('📊 [Campanha Detalhes] Estatísticas calculadas:', {
      campanha_id: id,
      total: estatisticas.total,
      pendente: estatisticas.pendente,
      enviado: enviados,
      respondido: respondidos,
      erro: estatisticas.erro,
      taxa_resposta: taxaResposta.toFixed(1) + '%',
      stats_raw: stats?.slice(0, 5) // Primeiros 5 status para debug
    });

    const responseData = {
      ...campanha,
      enviados: enviados || 0, // ✅ Usar valor real
      respondidos: respondidos || 0, // ✅ Usar valor real
      taxa_resposta: parseFloat(taxaResposta.toFixed(1)), // ✅ Adicionar taxa de resposta
      estatisticas
    };

    // ✅ DEBUG: Log da resposta final
    console.log('📊 [Campanha Detalhes] Resposta final:', {
      enviados: responseData.enviados,
      respondidos: responseData.respondidos,
      taxa_resposta: responseData.taxa_resposta
    });

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Erro ao detalhar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/:id/debug-respostas - Diagnóstico de respostas e taxa real
router.get('/:id/debug-respostas', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar campanha da organização
    const { data: campanha, error: campanhaError } = await supabaseAdmin
      .from('campanhas')
      .select('id, organization_id, nome, status')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (campanhaError || !campanha) {
      return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
    }

    // Buscar contatos com status e possíveis respostas
    const { data: contatos, error: contatosError } = await supabaseAdmin
      .from('campanha_contatos')
      .select('id, status, enviado_em, respondido_em, resposta_cliente, contato_nome, contato_telefone')
      .eq('campanha_id', id);

    if (contatosError) {
      console.error('❌ [DebugRespostas] Erro ao buscar campanha_contatos:', contatosError);
      return res.status(500).json({ success: false, error: 'Erro ao buscar contatos da campanha' });
    }

    const total = contatos.length;
    const enviados = contatos.filter(c => c.status === 'enviado' || c.status === 'respondido').length;
    const respondidos = contatos.filter(c => c.status === 'respondido').length;
    const taxa_resposta = enviados > 0 ? parseFloat(((respondidos / enviados) * 100).toFixed(2)) : 0;

    // Pegar últimas 10 respostas
    const respostasRecentes = contatos
      .filter(c => c.status === 'respondido')
      .sort((a, b) => new Date(b.respondido_em || 0) - new Date(a.respondido_em || 0))
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        respondido_em: c.respondido_em,
        resposta_cliente: c.resposta_cliente,
        contato: {
          name: c.contato_nome || 'Sem nome',
          phone: c.contato_telefone || 'N/A'
        }
      }));

    // Amostra de contatos (para verificar nome/telefone)
    const amostraContatos = contatos.slice(0, 5).map(c => ({
      id: c.id,
      status: c.status,
      enviado_em: c.enviado_em,
      respondido_em: c.respondido_em,
      contato_nome: c.contato_nome,
      contato_telefone: c.contato_telefone
    }));

    // Logs úteis no servidor
    console.log('📊 [/api/campanhas/:id/debug-respostas] Diagnóstico:', {
      campanha_id: id,
      total,
      enviados,
      respondidos,
      taxa_resposta,
      respostasRecentes: respostasRecentes.length
    });

    return res.json({
      success: true,
      data: {
        campanha: { id: campanha.id, nome: campanha.nome, status: campanha.status },
        total,
        enviados,
        respondidos,
        taxa_resposta,
        respostasRecentes,
        amostraContatos
      }
    });
  } catch (error) {
    console.error('❌ [DebugRespostas] Erro geral:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/campanhas/:id/contatos - Listar contatos da campanha
router.get('/:id/contatos', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se a campanha existe e pertence à organização
    const { data: campanha, error: campanhaError } = await supabaseAdmin
      .from('campanhas')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (campanhaError || !campanha) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    // Buscar contatos da campanha com informações relacionadas
    const { data: contatos, error: contatosError } = await supabaseAdmin
      .from('campanha_contatos')
      .select(`
        id,
        contato_id,
        contato_nome,
        contato_telefone,
        status,
        enviado_em,
        respondido_em,
        resposta_cliente,
        resumo_ia,
        sentimento_ia,
        contato:contacts(
          id,
          name,
          phone_number
        )
      `)
      .eq('campanha_id', id)
      .order('enviado_em', { ascending: false, nullsFirst: false });

    if (contatosError) {
      console.error('❌ Erro ao buscar contatos da campanha:', contatosError);
      throw contatosError;
    }

    // Formatar dados para o frontend
    const contatosFormatados = (contatos || []).map(cc => {
      // ✅ USAR contato_nome e contato_telefone diretamente quando o join não retornar dados
      const nomeContato = cc.contato?.name || cc.contato_nome || null;
      const telefoneContato = cc.contato?.phone_number || cc.contato_telefone || null;
      
      // ✅ DEBUG: Log de cada contato processado
      if (!nomeContato || !telefoneContato) {
        console.log('⚠️ [Campanha Contatos] Contato sem nome/telefone:', {
          id: cc.id,
          contato_id: cc.contato_id,
          contato_nome: cc.contato_nome,
          contato_telefone: cc.contato_telefone,
          contato_from_db: cc.contato
        });
      }
      
      return {
        id: cc.id,
        contato_id: cc.contato_id,
        contato: {
          id: cc.contato?.id || null,
          name: nomeContato || 'Sem nome',
          phone: telefoneContato || 'N/A'
        },
        status: cc.status || 'pendente',
        enviado_em: cc.enviado_em,
        respondido_em: cc.respondido_em,
        resposta_cliente: cc.resposta_cliente || null, // ✅ Mostrar primeira resposta
        resumo_ia: cc.resumo_ia || null,
        sentimento_ia: cc.sentimento_ia || null
      };
    });

    // ✅ DEBUG: Log do resultado final
    console.log('📊 [Campanha Contatos] Total de contatos formatados:', contatosFormatados.length);
    if (contatosFormatados.length > 0) {
      console.log('📊 [Campanha Contatos] Primeiro contato:', {
        name: contatosFormatados[0].contato?.name,
        phone: contatosFormatados[0].contato?.phone,
        status: contatosFormatados[0].status
      });
    }

    res.json({
      success: true,
      data: contatosFormatados
    });

  } catch (error) {
    console.error('❌ Erro ao buscar contatos da campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas - Criar campanha
router.post('/', [
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
  body('template_id').optional().custom((value) => {
    if (value === null || value === undefined) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }).withMessage('Template ID deve ser um UUID válido ou null'),
  body('contatos').isArray({ min: 1 }).withMessage('Pelo menos um contato é obrigatório'),
  body('usuarios_remetentes').isArray({ min: 1 }).withMessage('Pelo menos um remetente é obrigatório'),
  body('usar_ia').optional().isBoolean(),
  body('data_inicio').optional().isISO8601(),
  body('configuracoes').optional().isObject(),
  body('message_content').optional().isString(),
  body('media_files').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    console.log('📥 Dados recebidos para criar campanha:', JSON.stringify(req.body, null, 2));
    
    const { 
      nome, 
      template_id, 
      contatos, 
      usuarios_remetentes, 
      usar_ia = false, 
      data_inicio,
      configuracoes = {},
      message_content,
      media_files = []
    } = req.body;

    // Verificar se o template existe e pertence à organização (apenas se template_id for fornecido)
    let template = null;
    if (template_id) {
      // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
      const { data: templateData, error: templateError } = await supabaseAdminAdmin
        .from('campanha_templates')
        .select('id')
        .eq('id', template_id)
        .eq('organization_id', req.user.organization_id)
        .single();

      if (templateError || !templateData) {
        return res.status(400).json({
          success: false,
          error: 'Template não encontrado'
        });
      }
      
      template = templateData;
    }

    // Verificar se há mensagem ou template
    if (!template_id && !message_content) {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer um template ou conteúdo da mensagem'
      });
    }

    // Verificar se os contatos existem e pertencem à organização
    // Como não temos tabela contacts, vamos usar uma abordagem genérica
    // Assumindo que os contatos são passados com nome e telefone
    const contatosValidos = contatos.map(contato => ({
      id: contato.id || contato,
      name: contato.name || contato.nome || 'Cliente',
      phone: contato.phone || contato.telefone || contato.phone_number || ''
    }));
    
    // ✅ DEBUG: Log dos contatos recebidos
    console.log('📋 [Campanha Create] Contatos recebidos:', {
      total: contatosValidos.length,
      primeiro: contatosValidos[0],
      contatos_com_nome: contatosValidos.filter(c => c.name && c.name !== 'Cliente').length,
      contatos_com_phone: contatosValidos.filter(c => c.phone && c.phone !== '').length
    });

    // Verificar se os usuários remetentes existem e pertencem à organização
    // usuarios_remetentes pode ser array de UUIDs (user IDs) ou números de WhatsApp
    let usuariosValidos = [];
    
    // Verificar se são UUIDs ou números de telefone
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    
    if (usuarios_remetentes.length > 0 && isUUID(usuarios_remetentes[0])) {
      // São UUIDs de usuários - buscar contas WhatsApp conectadas
      const { data: contasWhatsApp, error: contasError } = await supabaseAdmin
        .from('whatsapp_accounts')
        .select('id, user_id, phone_number, name, status')
        .in('user_id', usuarios_remetentes)
        .eq('organization_id', req.user.organization_id)
        .eq('status', 'connected');

      if (contasError) throw contasError;
      
      if (!contasWhatsApp || contasWhatsApp.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhuma conta WhatsApp conectada encontrada para os usuários selecionados'
        });
      }
      
      usuariosValidos = contasWhatsApp.map(conta => ({
        id: conta.user_id,
        numero_whatsapp: conta.phone_number,
        name: conta.name
      }));
    } else {
      // São números de WhatsApp - mapear para usuários
      console.log('🔍 Mapeando números de WhatsApp para usuários:', usuarios_remetentes);
      
      // Buscar contas WhatsApp conectadas para estes números
      const { data: whatsappAccounts, error: whatsappError } = await supabaseAdmin
        .from('whatsapp_accounts')
        .select('id, phone_number, name, organization_id')
        .eq('organization_id', req.user.organization_id)
        .in('phone_number', usuarios_remetentes);

      if (whatsappError) throw whatsappError;
      
      console.log('📱 Contas WhatsApp encontradas:', whatsappAccounts?.length || 0);
      
      if (!whatsappAccounts || whatsappAccounts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum número de WhatsApp conectado encontrado'
        });
      }
      
      // Para campanhas, vamos usar o usuário atual como remetente
      // Em um cenário real, seria melhor ter uma tabela de associação
      usuariosValidos = [{
        id: req.user.id,
        name: req.user.name || 'Usuário',
        email: req.user.email || ''
      }];
      
      console.log('👤 Usuário remetente:', usuariosValidos[0]);
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Criar a campanha
    const { data: campanha, error: campanhaError } = await supabaseAdminAdmin
      .from('campanhas')
      .insert({
        organization_id: req.user.organization_id,
        nome,
        template_id,
        created_by: req.user.id,
        total_destinatarios: contatos.length,
        usar_ia,
        data_inicio: data_inicio || new Date().toISOString(),
        configuracoes: {
          ...configuracoes,
          message_content: message_content,
          media_files: media_files
        }
      })
      .select()
      .single();

    if (campanhaError) throw campanhaError;

    // Usar distribuição inteligente baseada no histórico
    console.log('🔄 Iniciando distribuição de contatos...');
    console.log('📊 Contatos válidos:', contatosValidos.length);
    console.log('👤 Usuários válidos:', usuariosValidos.length);
    
    const CampanhaService = (await import('../services/campanhaService.js')).default;
    const distribuicao = await CampanhaService.distribuirContatosInteligentemente(
      campanha.id,
      contatosValidos,
      usuariosValidos,
      req.user.organization_id
    );
    
    console.log('✅ Distribuição concluída:', distribuicao);

    // Inserir remetentes da campanha
    const remetentesCampanha = usuariosValidos.map(usuario => ({
      campanha_id: campanha.id,
      usuario_id: usuario.id,
      numero_whatsapp: usuario.numero_whatsapp // Usar o número WhatsApp da conta conectada
    }));

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    const { error: remetentesInsertError } = await supabaseAdminAdmin
      .from('campanha_remetentes')
      .insert(remetentesCampanha);

    if (remetentesInsertError) throw remetentesInsertError;

    // Log da ação (opcional - comentado por enquanto)
    // await logCampanhaAction(campanha.id, req.user.id, 'campanha_criada', {
    //   nome,
    //   total_contatos: contatos.length,
    //   total_remetentes: usuarios_remetentes.length,
    //   usar_ia
    // }, req);

    res.status(201).json({
      success: true,
      data: campanha,
      message: 'Campanha criada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/campanhas/:id - Atualizar campanha
router.put('/:id', [
  param('id').isUUID(),
  body('nome').optional().notEmpty(),
  body('status').optional().isIn(['rascunho', 'em_execucao', 'finalizada', 'erro', 'pausada']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verificar se a campanha existe e pertence à organização
    const { data: campanhaExistente, error: checkError } = await supabaseAdmin
      .from('campanhas')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (checkError || !campanhaExistente) {
      return res.status(404).json({
        success: false,
        error: 'Campanha não encontrada'
      });
    }

    // Não permitir edição de campanhas finalizadas
    if (campanhaExistente.status === 'finalizada' && updates.status !== 'finalizada') {
      return res.status(400).json({
        success: false,
        error: 'Campanha finalizada não pode ser editada'
      });
    }

    const { data: campanha, error } = await supabaseAdmin
      .from('campanhas')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo),
        created_by_profile:profiles!campanhas_created_by_fkey(
          id,
          name,
          email
        )
      `)
      .single();

    if (error) throw error;

    // Log da ação
    await logCampanhaAction(id, req.user.id, 'campanha_atualizada', updates, req);

    res.json({
      success: true,
      data: campanha,
      message: 'Campanha atualizada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/campanhas/:id - Deletar campanha
router.delete('/:id', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se a campanha pode ser deletada (apenas rascunhos)
    const { data: campanha, error: checkError } = await supabaseAdmin
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

    // Permitir deleção de campanhas em qualquer status
    // Removida a restrição que limitava deleção apenas para campanhas em rascunho

    const { error } = await supabaseAdmin
      .from('campanhas')
      .delete()
      .eq('id', id)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;

    // Log da ação
    await logCampanhaAction(id, req.user.id, 'campanha_deletada', {
      nome: campanha.nome
    }, req);

    res.json({
      success: true,
      message: 'Campanha deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar campanha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/:id/restart - Reiniciar campanha finalizada/pausada e reenfileirar contatos
router.post('/:id/restart', [
  param('id').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;

    // Verificar campanha
    const { data: campanha, error: campErr } = await supabaseAdmin
      .from('campanhas')
      .select('id, organization_id, status, configuracoes')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (campErr || !campanha) {
      return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
    }

    // Resetar contatos para pendente
    const { error: resetContatosErr } = await supabaseAdmin
      .from('campanha_contatos')
      .update({ status: 'pendente', enviado_em: null, respondido_em: null, resposta_cliente: null })
      .eq('campanha_id', id);

    if (resetContatosErr) throw resetContatosErr;

    // Resetar contadores e status da campanha
    const { error: updCampErr } = await supabaseAdmin
      .from('campanhas')
      .update({ status: 'em_execucao', enviados: 0, respondidos: 0, data_inicio: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (updCampErr) throw updCampErr;

    // Buscar contatos e remetentes
    const { data: contatos } = await supabaseAdmin
      .from('campanha_contatos')
      .select('id, contato_nome, contato_telefone')
      .eq('campanha_id', id);

    const { data: remetentes } = await supabaseAdmin
      .from('campanha_remetentes')
      .select('usuario_id, numero_whatsapp')
      .eq('campanha_id', id);

    // Não redistribuir/inserir contatos novamente para evitar duplicidade.
    // Apenas iniciar o processamento com os contatos resetados.
    const CampanhaService = (await import('../services/campanhaService.js')).default;
    CampanhaService.processarCampanha(id).catch(err => {
      console.error('❌ Erro ao processar campanha após reinício:', err);
    });

    return res.json({ success: true, message: 'Campanha reiniciada', data: { contatos_resetados: contatos?.length || 0, remetentes: remetentes?.length || 0 } });
  } catch (error) {
    console.error('❌ Erro ao reiniciar campanha:', error);
    return res.status(500).json({ success: false, error: 'Erro interno ao reiniciar campanha' });
  }
});

// =====================================================
// ROTAS DE VALIDAÇÃO E SUGESTÃO DE TEMPLATES
// =====================================================

// POST /api/campanhas/templates/validar - Validar template com IA
router.post('/templates/validar', [
  body('conteudo').notEmpty().withMessage('Conteúdo é obrigatório'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { conteudo } = req.body;

    // Importar AIService dinamicamente
    const { AIService } = await import('../services/aiService.js');

    // Validar template com IA
    const resultado = await AIService.validarTemplate(conteudo);

    res.json({
      success: true,
      data: resultado
    });

  } catch (error) {
    console.error('❌ Erro ao validar template:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/templates/sugerir-melhorias - Sugerir melhorias para template
router.post('/templates/sugerir-melhorias', [
  body('conteudo').notEmpty().withMessage('Conteúdo é obrigatório'),
  body('estatisticas').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { conteudo, estatisticas } = req.body;

    // Importar AIService dinamicamente
    const { AIService } = await import('../services/aiService.js');

    // Gerar sugestões de melhorias
    const sugestoes = await AIService.sugerirMelhorias(conteudo, estatisticas);

    res.json({
      success: true,
      data: {
        sugestoes: sugestoes
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar sugestões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// ROTAS DE DASHBOARD DE CAMPANHAS
// =====================================================

// GET /api/campanhas/dashboard/stats - Estatísticas do dashboard
router.get('/dashboard/stats', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    // Buscar estatísticas gerais
    const { data: campanhas, error: campanhasError } = await supabaseAdmin
      .from('campanhas')
      .select('status, usar_ia, total_destinatarios, enviados, respondidos')
      .eq('organization_id', organizationId);

    if (campanhasError) throw campanhasError;

    // Calcular estatísticas
    const stats = {
      total_campanhas: campanhas.length,
      campanhas_ativas: campanhas.filter(c => c.status === 'em_execucao').length,
      total_mensagens_enviadas: campanhas.reduce((sum, c) => sum + (c.enviados || 0), 0),
      total_respostas: campanhas.reduce((sum, c) => sum + (c.respondidos || 0), 0),
      taxa_resposta_media: 0,
      campanhas_com_ia: campanhas.filter(c => c.usar_ia).length,
      campanhas_por_status: []
    };

    // Calcular taxa de resposta média
    const totalEnviados = stats.total_mensagens_enviadas;
    if (totalEnviados > 0) {
      stats.taxa_resposta_media = (stats.total_respostas / totalEnviados) * 100;
    }

    // Contar campanhas por status
    const statusCounts = {};
    campanhas.forEach(campanha => {
      statusCounts[campanha.status] = (statusCounts[campanha.status] || 0) + 1;
    });

    stats.campanhas_por_status = Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value
    }));

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas do dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/dashboard/performance-diaria - Performance dos últimos 7 dias
router.get('/dashboard/performance-diaria', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: campanhas, error } = await supabaseAdmin
      .from('campanhas')
      .select('data_inicio, enviados, respondidos')
      .eq('organization_id', organizationId)
      .gte('data_inicio', sevenDaysAgo.toISOString())
      .order('data_inicio', { ascending: true });

    if (error) throw error;

    // Agrupar por data
    const performancePorDia = {};
    campanhas.forEach(campanha => {
      const data = new Date(campanha.data_inicio).toISOString().split('T')[0];
      if (!performancePorDia[data]) {
        performancePorDia[data] = { enviados: 0, respostas: 0 };
      }
      performancePorDia[data].enviados += campanha.enviados || 0;
      performancePorDia[data].respostas += campanha.respondidos || 0;
    });

    // Converter para array
    const result = Object.entries(performancePorDia).map(([data, metrics]) => ({
      data,
      ...metrics
    }));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Erro ao buscar performance diária:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/dashboard/sentimentos - Distribuição de sentimentos
router.get('/dashboard/sentimentos', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    // Por enquanto, retornar dados mockados
    // TODO: Implementar análise real de sentimentos quando disponível
    const sentimentosDistribuicao = [
      { sentimento: 'Positivo', quantidade: 45 },
      { sentimento: 'Neutro', quantidade: 30 },
      { sentimento: 'Negativo', quantidade: 25 }
    ];

    res.json({
      success: true,
      data: sentimentosDistribuicao
    });

  } catch (error) {
    console.error('❌ Erro ao buscar análise de sentimentos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/dashboard/realtime - Dados em tempo real
router.get('/dashboard/realtime', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    // Buscar campanhas ativas
    const { data: campanhasAtivas, error } = await supabaseAdmin
      .from('campanhas')
      .select('id, nome, status, enviados, total_destinatarios')
      .eq('organization_id', organizationId)
      .eq('status', 'em_execucao');

    if (error) throw error;

    const realtimeData = {
      campanhas_ativas: campanhasAtivas.length,
      mensagens_enviadas_hoje: 0, // TODO: Implementar contagem real
      respostas_recebidas_hoje: 0, // TODO: Implementar contagem real
      campanhas_ativas_detalhes: campanhasAtivas.map(c => ({
        id: c.id,
        nome: c.nome,
        progresso: c.total_destinatarios > 0 ? (c.enviados / c.total_destinatarios) * 100 : 0
      }))
    };

    res.json({
      success: true,
      data: realtimeData
    });

  } catch (error) {
    console.error('❌ Erro ao buscar dados em tempo real:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/upload - Upload de arquivos para campanhas
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    // 🎯 TRATAR ERRO DE ARQUIVO MUITO GRANDE
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        console.error('❌ [Upload] Arquivo muito grande:', err.message);
        return res.status(413).json({
          success: false,
          error: 'Arquivo muito grande. Tamanho máximo permitido: 100MB'
        });
      }
      console.error('❌ [Upload] Erro do Multer:', err);
      return res.status(400).json({
        success: false,
        error: `Erro no upload: ${err.message}`
      });
    }
    if (err) {
      console.error('❌ [Upload] Erro desconhecido:', err);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar upload'
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo não enviado'
      });
    }

    console.log('📁 Upload de arquivo para campanha:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      organizationId: req.user.organization_id
    });

    // Caminho relativo para servir o arquivo
    const relativePath = `/uploads/campanhas/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        id: req.file.filename,
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        url: relativePath,
        path: req.file.path
      }
    });

  } catch (error) {
    console.error('❌ Erro no upload de arquivo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
