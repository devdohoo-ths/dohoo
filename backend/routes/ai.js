import express from 'express';
import { generateAIResponse } from '../services/ai/generateAIResponse.js';
import { loadAISettings, validateAIEnabled, getAIProcessingConfig } from '../services/ai/aiSettingsMiddleware.js';
import { authenticateToken } from '../middleware/auth.js';
import { supabase } from '../lib/supabaseClient.js';
import path from 'path';
import OpenAI from 'openai';
import fs from 'fs';
import https from 'https';
import http from 'http';
import logger from '../utils/logger.js';

console.log('🤖 [AI ROUTES] generateAIResponse importado:', typeof generateAIResponse);


const router = express.Router();

// Rota de teste para WhatsApp
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'AI routes funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rota de teste simples para Supabase (sem autenticação)
router.get('/test-supabase', async (req, res) => {
  try {
    console.log('🧪 [SUPABASE TEST] Testando conexão com Supabase...');
    console.log('🧪 [SUPABASE TEST] Variáveis de ambiente:', {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'Definida' : 'Não definida',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Definida' : 'Não definida'
    });
    
    // Verificar se as variáveis de ambiente estão definidas
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ [SUPABASE TEST] Variáveis de ambiente não definidas');
      return res.status(500).json({ 
        success: false, 
        error: 'Variáveis de ambiente do Supabase não definidas',
        details: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas'
      });
    }
    
    // Testar busca simples de organizações
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(5);

    if (orgError) {
      console.error('❌ [SUPABASE TEST] Erro ao buscar organizações:', orgError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao conectar com Supabase',
        details: orgError.message
      });
    }

    // Testar busca simples de perfis
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, organization_id')
      .limit(5);

    if (profileError) {
      console.error('❌ [SUPABASE TEST] Erro ao buscar perfis:', profileError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar perfis',
        details: profileError.message
      });
    }

    res.json({
      success: true,
      message: 'Supabase funcionando!',
      data: {
        organizationsCount: orgs?.length || 0,
        profilesCount: profiles?.length || 0,
        sampleOrganizations: orgs?.slice(0, 2) || [],
        sampleProfiles: profiles?.slice(0, 2) || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SUPABASE TEST] Erro geral:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno no teste do Supabase',
      details: error.message
    });
  }
});

// Rota de teste para OpenAI (sem autenticação)
router.get('/test-openai', async (req, res) => {
  try {
    console.log('🧪 [OPENAI TEST] Testando conexão com OpenAI...');
    console.log('🧪 [OPENAI TEST] Variáveis de ambiente:', {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Definida' : 'Não definida'
    });
    
    // Verificar se a chave da API está definida
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ [OPENAI TEST] Chave da API não definida');
      return res.status(500).json({ 
        success: false, 
        error: 'Chave da API do OpenAI não definida',
        details: 'OPENAI_API_KEY não encontrada'
      });
    }

    // Testar uma chamada simples para a IA
    const testPrompt = "Responda apenas 'Teste OK' se você conseguir me ouvir.";
    const iaConfig = {
      configuracoes: {
        modelo: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 50
      }
    };

    console.log('🧪 [OPENAI TEST] Fazendo chamada de teste para OpenAI...');
    const { respostaIA, tokensUsados } = await generateAIResponse(
      testPrompt,
      'Você é um assistente de teste. Responda apenas com "Teste OK".',
      [],
      iaConfig
    );

    console.log('✅ [OPENAI TEST] Resposta recebida:', respostaIA);
    console.log('✅ [OPENAI TEST] Tokens usados:', tokensUsados);

    res.json({
      success: true,
      message: 'OpenAI funcionando!',
      data: {
        response: respostaIA,
        tokensUsed: tokensUsados,
        apiKeyConfigured: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [OPENAI TEST] Erro geral:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno no teste do OpenAI',
      details: error.message
    });
  }
});

// Rota de teste simplificada para resumo da operação (sem autenticação)
router.post('/test-operation-summary-simple', async (req, res) => {
  try {
    console.log('🧪 [SIMPLE TEST] Testando resumo simplificado...');
    const { period = 'today' } = req.body;
    
    // Dados mockados para teste
    const mockData = {
      totalMessages: 10,
      sentMessages: 5,
      receivedMessages: 5,
      uniqueChats: 3,
      uniqueUsers: 3
    };

    // Prompt simplificado
    const simplePrompt = `Analise estes dados de operação e responda em JSON:
    
    Dados:
    - Total de mensagens: ${mockData.totalMessages}
    - Mensagens enviadas: ${mockData.sentMessages}
    - Mensagens recebidas: ${mockData.receivedMessages}
    - Conversas únicas: ${mockData.uniqueChats}
    - Usuários únicos: ${mockData.uniqueUsers}
    
    Responda APENAS com JSON:
    {
      "summary": "Resumo da operação",
      "sentiment": {
        "overall": "neutro",
        "description": "Operação normal"
      },
      "insights": ["Insight 1", "Insight 2"],
      "recommendations": ["Recomendação 1", "Recomendação 2"]
    }`;

    const iaConfig = {
      configuracoes: {
        modelo: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 500
      }
    };

    console.log('🧪 [SIMPLE TEST] Gerando resumo com IA...');
    const { respostaIA, tokensUsados } = await generateAIResponse(
      simplePrompt,
      'Você é um analista de operações. Responda apenas com JSON válido.',
      [],
      iaConfig
    );

    console.log('✅ [SIMPLE TEST] Resposta recebida:', respostaIA);

    // Tentar fazer parse do JSON
    let analysisResult;
    try {
      const jsonString = respostaIA.content || respostaIA;
      analysisResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ [SIMPLE TEST] Erro ao fazer parse:', parseError);
      analysisResult = {
        summary: "Análise concluída",
        sentiment: { overall: "neutro", description: "Operação normal" },
        insights: ["Análise em andamento"],
        recommendations: ["Aguardando análise completa"]
      };
    }

    res.json({
      success: true,
      data: analysisResult,
      tokensUsed: tokensUsados,
      period: period,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SIMPLE TEST] Erro geral:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno no teste simplificado',
      details: error.message
    });
  }
});

// Rota de teste para operação summary
router.get('/test-operation-summary', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 [TEST] Rota de teste chamada');
    console.log('🧪 [TEST] Headers recebidos:', req.headers);
    console.log('🧪 [TEST] User object:', req.user);

    const userId = req.user?.id;
    const userOrgId = req.user?.organization_id;

    console.log('🧪 [TEST] Testando operação summary:', {
      userId,
      userOrgId,
      userEmail: req.user?.email,
      userRole: req.user?.role_name
    });

    if (!userId) {
      console.error('❌ [TEST] User ID não encontrado');
      return res.status(400).json({ 
        success: false, 
        error: 'User ID não encontrado no token' 
      });
    }

    if (!userOrgId) {
      console.error('❌ [TEST] Organization ID não encontrado');
      return res.status(400).json({ 
        success: false, 
        error: 'Organization ID não encontrado no token' 
      });
    }

    // Testar busca de conversas
    const { data: conversations, error: conversationsError } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid, created_at')
      .eq('organization_id', userOrgId)
      .limit(5);

    if (conversationsError) {
      console.error('❌ [TEST] Erro ao buscar conversas:', conversationsError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar conversas de teste',
        details: conversationsError.message
      });
    }

    // Testar busca de mensagens
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, created_at, is_from_me, chat_id')
      .eq('organization_id', userOrgId)
      .limit(10);

    if (messagesError) {
      console.error('❌ [TEST] Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar mensagens de teste',
        details: messagesError.message
      });
    }

    res.json({
      success: true,
      message: 'Teste de operação summary funcionando!',
      data: {
        userId,
        userOrgId,
        conversationsCount: conversations?.length || 0,
        messagesCount: messages?.length || 0,
        sampleConversations: conversations?.slice(0, 2) || [],
        sampleMessages: messages?.slice(0, 3) || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [TEST] Erro no teste:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno no teste',
      details: error.message
    });
  }
});

// 🔧 ASSISTANTS ENDPOINTS
// Listar assistentes
// Listar assistentes
router.get('/assistants', authenticateToken, async (req, res) => {
  try {
    const { organization_id, is_organizational } = req.query;
    const userOrgId = req.user?.organization_id;
    const userId = req.user?.id;
    const userRoleId = req.user?.role_id;
    
    console.log('🔍 Buscando assistentes com filtros:', { 
      organization_id, 
      is_organizational, 
      userOrgId, 
      userId, 
      userRoleId 
    });
    console.log('👤 Usuário completo:', req.user);
    
    // 🎯 BUSCAR ROLE DO USUÁRIO DINAMICAMENTE (sem hardcode)
    let userRoleName = null;
    let canViewAllAssistants = false;
    
    if (userRoleId) {
      try {
        // ✅ CORREÇÃO: Buscar role em default_roles OU roles
        let roleData = null;
        
        // Primeiro tentar buscar em default_roles
        const { data: defaultRole, error: defaultRoleError } = await supabase
          .from('default_roles')
          .select('name, permissions')
          .eq('id', userRoleId)
          .eq('is_active', true)
          .single();
        
        if (defaultRole && !defaultRoleError) {
          roleData = defaultRole;
        } else {
          // Se não encontrou em default_roles, buscar em roles
          const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('name, permissions')
            .eq('id', userRoleId)
            .single();
          
          if (roleError) {
            console.error('❌ Erro ao buscar role do usuário:', roleError);
            return res.status(500).json({ error: 'Erro ao validar permissões do usuário' });
          }
          
          if (role) {
            roleData = role;
          }
        }
        
        if (!roleData) {
          console.error('❌ Role não encontrada para role_id:', userRoleId);
          return res.status(500).json({ error: 'Role do usuário não encontrada' });
        }
        
        userRoleName = roleData?.name;
        
        // 🎯 VALIDAR PERMISSÕES DINAMICAMENTE (sem hardcode)
        // Super Admin, Admin e Administrador podem ver todos os assistentes
        // Agente só pode ver o próprio
        canViewAllAssistants = ['Super Admin', 'Admin', 'Administrador'].includes(userRoleName);
        
        console.log('🔐 Role do usuário:', userRoleName);
        console.log('🔐 Pode ver todos assistentes:', canViewAllAssistants);
        
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar role:', error);
        return res.status(500).json({ error: 'Erro interno ao validar permissões' });
      }
    } else {
      console.warn('⚠️ Usuário sem role_id definido');
      return res.status(403).json({ error: 'Usuário sem permissões definidas' });
    }
    
    let query = supabase
      .from('ai_assistants')
      .select('*');
    
    // 🎯 APLICAR FILTROS BASEADO NAS PERMISSÕES VALIDADAS
    if (canViewAllAssistants) {
      // Super Admin, Admin e Administrador podem ver todos os assistentes
      console.log(`🔐 [${userRoleName}] Permitindo acesso a todos os assistentes`);
      
      // Filtrar por organização se especificada, senão mostrar da organização do usuário
      if (organization_id) {
        query = query.eq('organization_id', organization_id);
      } else if (userOrgId) {
        query = query.eq('organization_id', userOrgId);
      }
      
      // Filtrar por tipo de assistente se especificado
      if (is_organizational !== undefined) {
        query = query.eq('is_organizational', is_organizational === 'true');
      }
      
    } else if (userRoleName === 'Agente') {
      // Agente só pode ver seu próprio assistente
      console.log('🔐 [AGENTE] Restringindo acesso apenas ao próprio assistente');
      query = query.eq('user_id', userId);
      
    } else {
      // Outras roles: acesso restrito apenas aos próprios assistentes
      console.log(`🔐 [${userRoleName}] Acesso restrito aos próprios assistentes`);
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Erro ao buscar assistentes:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Assistentes encontrados:', data?.length || 0);
    console.log('📋 Filtros aplicados para role:', userRoleName);
    
    res.json(data || []);
    
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar assistentes:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/credits - Buscar créditos de IA da organização
router.get('/credits', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.query;
    const userOrgId = req.user?.organization_id;
    const userId = req.user?.id;
    
    // Usar organization_id da query ou do usuário autenticado
    const targetOrgId = organization_id || userOrgId;
    
    if (!targetOrgId) {
      return res.status(400).json({ 
        success: false,
        error: 'organization_id é obrigatório' 
      });
    }
    
    // Buscar créditos da organização
    const { data: creditsData, error: creditsError } = await supabase
      .from('ai_credits')
      .select('*')
      .eq('organization_id', targetOrgId)
      .is('user_id', null) // Apenas créditos organizacionais (não individuais)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (creditsError) {
      console.error('❌ Erro ao buscar créditos de IA:', creditsError);
      return res.status(500).json({ 
        success: false,
        error: creditsError.message 
      });
    }
    
    // Se não houver créditos, retornar objeto vazio com valores zerados
    const credits = creditsData || {
      credits_remaining: 0,
      credits_purchased: 0,
      credits_used: 0,
      organization_id: targetOrgId,
      last_purchase_at: null
    };
    
    res.json({
      success: true,
      credit: credits
    });
    
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar créditos de IA:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/ai/credits/usage - Buscar histórico de uso de tokens da organização
router.get('/credits/usage', authenticateToken, async (req, res) => {
  try {
    const { organization_id, limit = 50 } = req.query;
    const userOrgId = req.user?.organization_id;
    
    // Usar organization_id da query ou do usuário autenticado
    const targetOrgId = organization_id || userOrgId;
    
    if (!targetOrgId) {
      return res.status(400).json({ 
        success: false,
        error: 'organization_id é obrigatório' 
      });
    }
    
    // Buscar histórico de uso de tokens da organização
    let query = supabase
      .from('ai_token_usage')
      .select('id, tokens_used, model_used, cost_in_credits, message_type, created_at, assistant_id, chat_id, user_id')
      .eq('organization_id', targetOrgId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit) || 50);
    
    const { data: usageData, error: usageError } = await query;
    
    if (usageError) {
      console.error('❌ Erro ao buscar uso de tokens:', usageError);
      return res.status(500).json({ 
        success: false,
        error: usageError.message 
      });
    }
    
    res.json({
      success: true,
      usage: usageData || []
    });
    
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar uso de tokens:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/ai/credits/transactions - Buscar transações de créditos da organização
router.get('/credits/transactions', authenticateToken, async (req, res) => {
  try {
    const { organization_id, limit = 50 } = req.query;
    const userOrgId = req.user?.organization_id;
    
    // Usar organization_id da query ou do usuário autenticado
    const targetOrgId = organization_id || userOrgId;
    
    if (!targetOrgId) {
      return res.status(400).json({ 
        success: false,
        error: 'organization_id é obrigatório' 
      });
    }
    
    // Buscar transações de créditos da organização
    let query = supabase
      .from('credit_transactions')
      .select('id, transaction_type, credits_amount, cost_usd, payment_status, description, created_at, user_id')
      .eq('organization_id', targetOrgId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit) || 50);
    
    const { data: transactionsData, error: transactionsError } = await query;
    
    if (transactionsError) {
      console.error('❌ Erro ao buscar transações de créditos:', transactionsError);
      return res.status(500).json({ 
        success: false,
        error: transactionsError.message 
      });
    }
    
    res.json({
      success: true,
      transactions: transactionsData || []
    });
    
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar transações de créditos:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// POST /api/ai/credits/purchase - Comprar créditos de IA para a organização
router.post('/credits/purchase', authenticateToken, async (req, res) => {
  try {
    const { organization_id, credits_amount, user_id, cost_usd } = req.body;
    const userOrgId = req.user?.organization_id;
    const userId = req.user?.id;
    
    // Usar organization_id do body ou do usuário autenticado
    const targetOrgId = organization_id || userOrgId;
    const targetUserId = user_id || userId;
    
    if (!targetOrgId) {
      return res.status(400).json({ 
        success: false,
        error: 'organization_id é obrigatório' 
      });
    }
    
    if (!credits_amount || credits_amount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'credits_amount deve ser maior que zero' 
      });
    }
    
    // Usar função RPC para adicionar créditos
    const { data, error: rpcError } = await supabase.rpc('add_organization_ai_credits', {
      p_organization_id: targetOrgId,
      p_credits_amount: parseInt(credits_amount),
      p_user_id: targetUserId,
      p_cost_usd: cost_usd ? parseFloat(cost_usd) : null
    });
    
    if (rpcError) {
      console.error('❌ Erro ao comprar créditos:', rpcError);
      return res.status(500).json({ 
        success: false,
        error: rpcError.message 
      });
    }
    
    res.json({
      success: true,
      message: `Créditos adicionados com sucesso: ${credits_amount}`,
      credits_added: credits_amount
    });
    
  } catch (error) {
    console.error('❌ Erro inesperado ao comprar créditos:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Criar assistente

router.post('/assistants', authenticateToken, async (req, res) => {
  try {
    const { name, description, is_organizational = false, ...rest } = req.body;
    const userOrgId = req.user?.organization_id;
    const userId = req.user?.id;
    const userRoleId = req.user?.role_id;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    
    // 🎯 BUSCAR ROLE DO USUÁRIO DINAMICAMENTE (sem hardcode)
    let userRoleName = null;
    
    if (userRoleId) {
      try {
        // ✅ CORREÇÃO: Buscar role em default_roles OU roles
        let roleData = null;
        
        // Primeiro tentar buscar em default_roles
        const { data: defaultRole, error: defaultRoleError } = await supabase
          .from('default_roles')
          .select('name, permissions')
          .eq('id', userRoleId)
          .eq('is_active', true)
          .single();
        
        if (defaultRole && !defaultRoleError) {
          roleData = defaultRole;
        } else {
          // Se não encontrou em default_roles, buscar em roles
          const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('name, permissions')
            .eq('id', userRoleId)
            .single();
          
          if (roleError) {
            console.error('❌ Erro ao buscar role do usuário:', roleError);
            return res.status(500).json({ error: 'Erro ao validar permissões do usuário' });
          }
          
          if (role) {
            roleData = role;
          }
        }
        
        if (!roleData) {
          console.error('❌ Role não encontrada para role_id:', userRoleId);
          return res.status(500).json({ error: 'Role do usuário não encontrada' });
        }
        
        userRoleName = roleData?.name;
        console.log('🔐 Role do usuário para criação:', userRoleName);
        
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar role:', error);
        return res.status(500).json({ error: 'Erro interno ao validar permissões' });
      }
    } else {
      console.warn('⚠️ Usuário sem role_id definido');
      return res.status(403).json({ error: 'Usuário sem permissões definidas' });
    }
    
    // 🎯 VERIFICAR SE AGENTE JÁ TEM UM ASSISTENTE (sem hardcode)
    if (userRoleName === 'Agente') {
      console.log('🔍 [AGENTE] Verificando se usuário já possui assistente...');
      
      const { data: existingAssistant, error: checkError } = await supabase
        .from('ai_assistants')
        .select('id, name')
        .eq('user_id', userId)
        .single();
      
      console.log('🔍 [AGENTE] Resultado da verificação:', { existingAssistant, checkError });
      
      if (existingAssistant && !checkError) {
        console.log('❌ [AGENTE] Usuário já possui um assistente:', existingAssistant.name);
        return res.status(400).json({ 
          error: 'Você já possui um assistente de IA. Cada agente pode ter apenas um assistente.' 
        });
      }
      
      // Agentes só podem criar assistentes individuais
      if (is_organizational) {
        console.log('❌ [AGENTE] Tentativa de criar assistente organizacional bloqueada');
        return res.status(403).json({ 
          error: 'Agentes não podem criar assistentes organizacionais.' 
        });
      }
      
      console.log('✅ [AGENTE] Verificação aprovada - pode criar assistente');
    }
    
    // Preparar dados do assistente baseado no tipo
    const assistantData = {
      name,
      description,
      is_organizational,
      ...rest
    };
    
    if (!is_organizational) {
      // Assistente individual: user_id obrigatório, organization_id opcional
      assistantData.user_id = userId;
      assistantData.organization_id = userOrgId || null;
    } else {
      // Assistente organizacional: organization_id obrigatório, user_id opcional
      if (!userOrgId) {
        return res.status(400).json({ error: 'organization_id é obrigatório para assistentes organizacionais' });
      }
      assistantData.organization_id = userOrgId;
      assistantData.user_id = null; // Assistente da organização não tem dono específico
    }
    
    console.log('🔧 Criando assistente:', { 
      name, 
      user_id: assistantData.user_id, 
      organization_id: assistantData.organization_id,
      user_role: userRoleName,
      is_organizational: assistantData.is_organizational
    });
    
    const { data, error } = await supabase
      .from('ai_assistants')
      .insert([assistantData])
      .select();
      
    if (error) {
      console.error('❌ Erro ao criar assistente:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Assistente criado:', data[0]);
    res.json(data[0]);
  } catch (error) {
    console.error('❌ Erro inesperado ao criar assistente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Editar assistente
router.put('/assistants/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_organizational, ...rest } = req.body;
    const userOrgId = req.user?.organization_id;
    const userId = req.user?.id;
    const userRoleId = req.user?.role_id;
    
    // Buscar assistente existente para verificar permissões
    const { data: existingAssistant, error: checkError } = await supabase
      .from('ai_assistants')
      .select('organization_id, user_id, is_organizational')
      .eq('id', id)
      .single();
    
    if (checkError || !existingAssistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }
    
    // 🎯 BUSCAR ROLE DO USUÁRIO DINAMICAMENTE (sem hardcode)
    let userRoleName = null;
    let canEditAllAssistants = false;
    
    if (userRoleId) {
      try {
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('name, permissions')
          .eq('id', userRoleId)
          .single();
        
        if (roleError) {
          console.error('❌ Erro ao buscar role do usuário:', roleError);
          return res.status(500).json({ error: 'Erro ao validar permissões do usuário' });
        }
        
        userRoleName = roleData?.name;
        canEditAllAssistants = ['Super Admin', 'Admin', 'Administrador'].includes(userRoleName);
        
        console.log('🔐 Role do usuário para edição:', userRoleName);
        console.log('🔐 Pode editar todos assistentes:', canEditAllAssistants);
        
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar role:', error);
        return res.status(500).json({ error: 'Erro interno ao validar permissões' });
      }
    } else {
      console.warn('⚠️ Usuário sem role_id definido');
      return res.status(403).json({ error: 'Usuário sem permissões definidas' });
    }
    
    // Verificar permissões baseado no role do usuário
    let hasPermission = false;
    
    if (canEditAllAssistants) {
      // Super Admin, Admin e Administrador podem editar qualquer assistente da organização
      hasPermission = existingAssistant.organization_id === userOrgId;
      console.log(`🔐 [${userRoleName}] Verificando permissão para editar assistente:`, hasPermission);
    } else if (userRoleName === 'Agente') {
      // Agente só pode editar seu próprio assistente
      hasPermission = existingAssistant.user_id === userId;
      console.log('🔐 [AGENTE] Verificando permissão para editar assistente:', hasPermission);
    } else {
      // Outros roles: apenas o dono pode editar
      hasPermission = existingAssistant.user_id === userId;
      console.log(`🔐 [${userRoleName}] Verificando permissão para editar assistente:`, hasPermission);
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Acesso negado - Você não tem permissão para editar este assistente' });
    }
    
    // Preparar dados de atualização
    const updateData = { name, description, ...rest };
    
    // Se is_organizational está sendo alterado, ajustar user_id/organization_id
    if (is_organizational !== undefined && is_organizational !== existingAssistant.is_organizational) {
      // Verificar se o usuário tem permissão para alterar o tipo
      if (userRoleName === 'Agente') {
        return res.status(403).json({ 
          error: 'Agentes não podem alterar o tipo de assistente para organizacional' 
        });
      }
      
      updateData.is_organizational = is_organizational;
      
      if (!is_organizational) {
        // Mudando para individual: user_id obrigatório, organization_id opcional
        updateData.user_id = userId;
        updateData.organization_id = userOrgId || null;
      } else {
        // Mudando para organizacional: organization_id obrigatório, user_id null
        if (!userOrgId) {
          return res.status(400).json({ error: 'organization_id é obrigatório para assistentes organizacionais' });
        }
        updateData.organization_id = userOrgId;
        updateData.user_id = null;
      }
    }
    
    console.log('🔧 Editando assistente:', { 
      id, 
      user_role: userRoleName,
      is_organizational: updateData.is_organizational || existingAssistant.is_organizational,
      user_id: updateData.user_id,
      organization_id: updateData.organization_id
    });
    
    const { data, error } = await supabase
      .from('ai_assistants')
      .update(updateData)
      .eq('id', id)
      .select();
      
    if (error) {
      console.error('❌ Erro ao editar assistente:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Assistente editado:', data[0]);
    res.json(data[0]);
  } catch (error) {
    console.error('❌ Erro inesperado ao editar assistente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar assistente
router.delete('/assistants/:id', authenticateToken, async (req, res) => {
  console.log('🚀 Rota DELETE chamada');
  console.log('📋 Parâmetros:', req.params);
  console.log('👤 Usuário:', req.user);
  
  try {
    const { id } = req.params;
    const userOrgId = req.user?.organization_id;
    const userId = req.user?.id;
    const userRoleId = req.user?.role_id;
    
    console.log('🔍 Tentando deletar assistente:', { id, userRoleId, userId });
    
    if (!id) {
      console.error('❌ ID não fornecido');
      return res.status(400).json({ error: 'ID do assistente é obrigatório' });
    }
    
    // Buscar assistente existente para verificar permissões
    const { data: existingAssistant, error: checkError } = await supabase
      .from('ai_assistants')
      .select('organization_id, user_id, is_organizational')
      .eq('id', id)
      .single();
    
    if (checkError || !existingAssistant) {
      return res.status(404).json({ error: 'Assistente não encontrado' });
    }
    
    // 🎯 BUSCAR ROLE DO USUÁRIO DINAMICAMENTE (sem hardcode)
    let userRoleName = null;
    let canDeleteAllAssistants = false;
    
    if (userRoleId) {
      try {
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('name, permissions')
          .eq('id', userRoleId)
          .single();
        
        if (roleError) {
          console.error('❌ Erro ao buscar role do usuário:', roleError);
          return res.status(500).json({ error: 'Erro ao validar permissões do usuário' });
        }
        
        userRoleName = roleData?.name;
        canDeleteAllAssistants = ['Super Admin', 'Admin', 'Administrador'].includes(userRoleName);
        
        console.log('🔐 Role do usuário para exclusão:', userRoleName);
        console.log('🔐 Pode deletar todos assistentes:', canDeleteAllAssistants);
        
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar role:', error);
        return res.status(500).json({ error: 'Erro interno ao validar permissões' });
      }
    } else {
      console.warn('⚠️ Usuário sem role_id definido');
      return res.status(403).json({ error: 'Usuário sem permissões definidas' });
    }
    
    // Verificar permissões baseado no role do usuário
    let hasPermission = false;
    
    if (canDeleteAllAssistants) {
      // Super Admin, Admin e Administrador podem deletar qualquer assistente da organização
      hasPermission = existingAssistant.organization_id === userOrgId;
      console.log(`🔐 [${userRoleName}] Verificando permissão para deletar assistente:`, hasPermission);
    } else if (userRoleName === 'Agente') {
      // Agente só pode deletar seu próprio assistente
      hasPermission = existingAssistant.user_id === userId;
      console.log('🔐 [AGENTE] Verificando permissão para deletar assistente:', hasPermission);
    } else {
      // Outros roles: apenas o dono pode deletar
      hasPermission = existingAssistant.user_id === userId;
      console.log(`🔐 [${userRoleName}] Verificando permissão para deletar assistente:`, hasPermission);
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Acesso negado - Você não tem permissão para deletar este assistente' });
    }
    
    // Verificar se há dados relacionados antes de deletar
    console.log('🔍 Verificando dados relacionados...');
    
    // Verificar ai_token_usage
    const { data: tokenUsage, error: tokenError } = await supabase
      .from('ai_token_usage')
      .select('id')
      .eq('assistant_id', id)
      .limit(1);
    
    if (tokenUsage && tokenUsage.length > 0) {
      console.log('⚠️ Assistente tem registros de uso de tokens');
      return res.status(400).json({ 
        error: 'Não é possível deletar este assistente pois ele possui histórico de uso. Considere desativá-lo em vez de deletá-lo.' 
      });
    }
    
    // Verificar ai_training_data
    const { data: trainingData, error: trainingError } = await supabase
      .from('ai_training_data')
      .select('id')
      .eq('assistant_id', id)
      .limit(1);
    
    if (trainingData && trainingData.length > 0) {
      console.log('⚠️ Assistente tem dados de treinamento');
      return res.status(400).json({ 
        error: 'Não é possível deletar este assistente pois ele possui dados de treinamento. Considere desativá-lo em vez de deletá-lo.' 
      });
    }
    
    // Verificar knowledge_base
    const { data: knowledgeBase, error: knowledgeError } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('assistant_id', id)
      .limit(1);
    
    if (knowledgeBase && knowledgeBase.length > 0) {
      console.log('⚠️ Assistente tem base de conhecimento');
      return res.status(400).json({ 
        error: 'Não é possível deletar este assistente pois ele possui base de conhecimento. Considere desativá-lo em vez de deletá-lo.' 
      });
    }
    
    console.log('✅ Nenhum dado relacionado encontrado, prosseguindo com a exclusão...');
    
    const { error } = await supabase
      .from('ai_assistants')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('❌ Erro ao deletar assistente:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Assistente deletado:', id);
    res.status(200).json({ 
      success: true, 
      message: 'Assistente deletado com sucesso' 
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao deletar assistente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware de autenticação (apenas para rotas que precisam)
router.use(authenticateToken);

// Processar mensagem com IA (compatível com playground)
router.post('/process', async (req, res) => {
  const { message, conversation_history, assistant, settings } = req.body;
  console.log("Processando mensagem...")
  console.log("req", req.body)
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Carregar configurações de IA da organização
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    console.log('🔧 Carregando configurações de IA para organização:', organizationId);
    const aiSettings = await loadAISettings(organizationId);
    
    // Validar se a IA está habilitada
    //validateAIEnabled(aiSettings);
    
    // Obter configurações formatadas para processamento
    const processingConfig = getAIProcessingConfig(aiSettings);
    
    console.log('⚙️ Configurações de IA carregadas:', {
      model: processingConfig.model,
      temperature: processingConfig.temperature,
      maxTokens: processingConfig.maxTokens,
      provider: processingConfig.provider
    });

    // Preparar contexto para a função generateAIResponse
    const context = conversation_history || [];
    
    // Preparar configuração do assistente usando as configurações da organização
    const iaConfig = {
      configuracoes: {
        modelo: processingConfig.model,
        temperature: processingConfig.temperature,
        max_tokens: processingConfig.maxTokens
      }
    };

    // Preparar treinamento baseado no assistente
    let training = 'Você é um assistente de IA útil e prestativo.';
    
    if (assistant) {
      training = `Você é ${assistant.name}. ${assistant.instructions || 'Você é um assistente de IA útil e prestativo.'}\n\nPersonalidade: ${assistant.personality || 'Profissional e prestativo'}`;
      
      // Adicionar base de conhecimento se disponível
      if (assistant.knowledge_base && assistant.knowledge_base.length > 0) {
        const knowledge = assistant.knowledge_base.map((kb) => `${kb.title}: ${kb.content}`).join('\n\n');
        training += `\n\nBase de Conhecimento:\n${knowledge}`;
      }

      // Adicionar dados de treinamento se disponíveis
      if (assistant.training_data && assistant.training_data.length > 0) {
        const training = assistant.training_data.map((td) => `P: ${td.question}\nR: ${td.answer}`).join('\n\n');
        training += `\n\nExemplos de Treinamento:\n${training}`;
      }
    }

    // Usar a função generateAIResponse que já funciona no Baileys
    const result = await generateAIResponse(message, training, context, iaConfig);
    
    if (!result || !result.respostaIA) {
      throw new Error('Falha ao gerar resposta da IA');
    }

    // Calcular créditos baseado nos tokens usados
    const tokensUsed = result.tokensUsados || 100;
    const creditsUsed = Math.ceil(tokensUsed / 75); // Taxa padrão

    res.json({
      response: result.respostaIA.content || result.respostaIA,
      tokens_used: tokensUsed,
      prompt_tokens: Math.ceil(tokensUsed * 0.7), // Estimativa
      completion_tokens: Math.ceil(tokensUsed * 0.3), // Estimativa
      credits_used: creditsUsed,
      model_used: processingConfig.model,
      timestamp: new Date().toISOString(),
      settings_used: {
        model: processingConfig.model,
        temperature: processingConfig.temperature,
        maxTokens: processingConfig.maxTokens,
        provider: processingConfig.provider
      }
    });
  } catch (error) {
    console.error('Error processing AI request:', error);
    
    // Retornar erro específico baseado no tipo
    if (error.message.includes('disabled')) {
      return res.status(403).json({ 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Treinar assistente
router.post('/train', (req, res) => {
  const { data } = req.body;
  
  console.log('Treinando IA com dados:', data);
  
  res.json({ 
    success: true, 
    message: 'Treinamento iniciado' 
  });
});

// Rota para testar geração e envio de áudio
router.post('/test-audio-send', async (req, res) => {
  try {
    const { text, accountId, to, organizationId, voiceId } = req.body;
    
    if (!text || !accountId || !to || !organizationId) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: text, accountId, to, organizationId' 
      });
    }

    console.log('🧪 Teste de geração e envio de áudio:', {
      text: text.substring(0, 50) + '...',
      accountId,
      to,
      organizationId,
      voiceId
    });

    // 1. Gerar áudio
    const audioUrl = await gerarAudioElevenLabs(text, organizationId, voiceId);
    if (!audioUrl) {
      return res.status(500).json({ error: 'Falha na geração de áudio' });
    }

    // 2. Converter para caminho absoluto
    const audioPath = path.join(__dirname, '..', audioUrl);
    console.log('🎵 Caminho do áudio:', audioPath);

    // 3. Verificar se arquivo existe
    const fs = await import('fs');
    if (!fs.existsSync(audioPath)) {
      return res.status(500).json({ error: 'Arquivo de áudio não encontrado' });
    }

    // 4. Verificar tamanho
    const stats = fs.statSync(audioPath);
    console.log('📊 Tamanho do arquivo:', (stats.size / 1024).toFixed(2), 'KB');

    // 5. Enviar via WhatsApp
    const { sendAudioByAccount } = await import('../services/multiWhatsapp.js');
    const result = await sendAudioByAccount(accountId, to, audioPath, 'audio/mpeg');

    if (result.success) {
      res.json({
        success: true,
        message: 'Áudio gerado e enviado com sucesso',
        audioUrl,
        audioPath,
        fileSize: stats.size,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        error: 'Falha no envio do áudio',
        details: result.error
      });
    }

  } catch (error) {
    console.error('❌ Erro no teste de áudio:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/agents?organization_id=... (sem autenticação)
router.get('/agents', async (req, res) => {
  const { organization_id, is_organizational } = req.query;
  
  if (!organization_id) {
    return res.status(400).json({ success: false, error: 'organization_id é obrigatório' });
  }

  try {
    // Buscar assistentes de IA da organização
    let query = supabase
      .from('ai_assistants')
      .select('id, name, description, instructions, personality, is_organizational')
      .eq('organization_id', organization_id)
      .eq('is_active', true);
    
    // Filtrar por tipo de assistente se especificado
    if (is_organizational !== undefined) {
      query = query.eq('is_organizational', is_organizational === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      agents: data || []
    });
  } catch (error) {
    console.error('Erro ao buscar agentes de IA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para resumir conversas com IA
router.post('/summarize-conversation', authenticateToken, async (req, res) => {
  try {
    console.log('🤖 [SUMMARIZE] Iniciando resumo de conversa');
    const { chat_id, startDate, endDate, keyword } = req.body;
    const organizationId = req.user.organization_id;
    
    console.log('🤖 [SUMMARIZE] Dados recebidos:', { chat_id, organizationId, startDate, endDate, keyword });
    
    if (!chat_id) {
      return res.status(400).json({ error: 'chat_id é obrigatório' });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('🤖 [SUMMARIZE] OpenAI API key não configurada');
      return res.status(500).json({ error: 'OpenAI API key não configurada' });
    }

    // ✅ NOVA: Buscar mensagens da conversa com filtros de data
    console.log('🤖 [SUMMARIZE] Buscando mensagens para chat_id:', chat_id);
    let messagesQuery = supabase
      .from('messages')
      .select('content, is_from_me, sender_name, created_at, message_type, metadata')
      .eq('chat_id', chat_id)
      .eq('organization_id', organizationId);
    
    // ✅ NOVA: Aplicar filtros de data se fornecidos
    if (startDate) {
      messagesQuery = messagesQuery.gte('created_at', startDate);
      console.log('🤖 [SUMMARIZE] Filtro de data inicial aplicado:', startDate);
    }
    
    if (endDate) {
      messagesQuery = messagesQuery.lte('created_at', endDate);
      console.log('🤖 [SUMMARIZE] Filtro de data final aplicado:', endDate);
    }
    
    // ✅ NOVA: Aplicar filtro de palavras-chave se fornecido
    if (keyword && keyword.trim()) {
      messagesQuery = messagesQuery.ilike('content', `%${keyword.trim()}%`);
      console.log('🤖 [SUMMARIZE] Filtro de palavras-chave aplicado:', keyword);
    }
    
    const { data: messages, error: messagesError } = await messagesQuery
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('🤖 [SUMMARIZE] Erro ao buscar mensagens:', messagesError);
      return res.status(500).json({ error: 'Erro ao buscar mensagens da conversa' });
    }

    console.log('🤖 [SUMMARIZE] Mensagens encontradas:', messages?.length || 0);

    if (!messages || messages.length === 0) {
      console.log('🤖 [SUMMARIZE] Nenhuma mensagem encontrada');
      return res.status(404).json({ error: 'Nenhuma mensagem encontrada para esta conversa' });
    }

    // ✅ NOVA: Contar mensagens com transcrição
    const messagesWithTranscription = messages.filter(msg => 
      msg.message_type === 'audio' && msg.metadata?.transcription
    );
    console.log(`🤖 [SUMMARIZE] Mensagens de áudio com transcrição: ${messagesWithTranscription.length}`);

    // ✅ NOVA: Preparar contexto das mensagens para a IA, incluindo transcrições de áudio
    const conversationContext = messages
      .filter(msg => {
        // Incluir mensagens com conteúdo de texto OU com transcrição de áudio
        const hasTextContent = msg.content && msg.content.trim();
        const hasTranscription = msg.metadata?.transcription && msg.metadata.transcription.trim();
        return hasTextContent || hasTranscription;
      })
      .map(msg => {
        const sender = msg.is_from_me ? 'Agente' : 'Cliente';
        let content = '';
        
        // ✅ NOVA: Priorizar transcrição se for mensagem de áudio
        if (msg.message_type === 'audio' && msg.metadata?.transcription) {
          content = `${sender} [Áudio transcrito]: ${msg.metadata.transcription}`;
          console.log(`🤖 [SUMMARIZE] Incluindo transcrição de áudio: ${msg.metadata.transcription.substring(0, 50)}...`);
        } else if (msg.content && msg.content.trim()) {
          // Usar conteúdo de texto normal
          content = `${sender}: ${msg.content}`;
        } else {
          // Fallback: indicar tipo de mídia se não houver conteúdo nem transcrição
          content = `${sender} [${msg.message_type || 'mensagem'}]`;
        }
        
        return {
          role: msg.is_from_me ? 'assistant' : 'user',
          content: content
        };
      });
    
    console.log(`🤖 [SUMMARIZE] Contexto preparado com ${conversationContext.length} mensagens (incluindo ${messagesWithTranscription.length} transcrições de áudio)`);

    // Preparar prompt para resumo
    const summaryPrompt = `Analise esta conversa de atendimento e crie um resumo conciso e útil em texto simples, sem formatação markdown ou caracteres especiais como ** ou ##.

    O resumo deve incluir:
    1. Assunto principal da conversa
    2. Problema ou necessidade do cliente
    3. Solução oferecida pelo agente
    4. Status da conversa (resolvida, pendente, etc.)
    5. Próximos passos se houver
    
    IMPORTANTE: Use apenas texto simples, sem asteriscos, hashtags ou qualquer formatação. Seja objetivo e mantenha o foco nas informações mais importantes para o atendimento.`;

    // Preparar configuração da IA
    const iaConfig = {
      configuracoes: {
        modelo: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 500
      }
    };

    // Gerar resumo usando a IA
    console.log('🤖 [SUMMARIZE] Gerando resumo com IA...');
    console.log('🤖 [SUMMARIZE] Contexto preparado:', conversationContext.length, 'mensagens');
    
    const { respostaIA, tokensUsados } = await generateAIResponse(
      summaryPrompt,
      'Você é um assistente especializado em análise de conversas de atendimento. Sua função é criar resumos claros e objetivos em texto simples, sem usar formatação markdown, asteriscos, hashtags ou qualquer caracteres especiais. Use apenas texto puro e direto.',
      conversationContext,
      iaConfig
    );
    
    console.log('🤖 [SUMMARIZE] Resumo gerado com sucesso, tokens usados:', tokensUsados);

    // Deduzir créditos da organização
    const { data: creditDeducted, error: deductError } = await supabase.rpc('deduct_organization_ai_credits', {
      p_organization_id: organizationId,
      p_tokens_used: tokensUsados,
      p_model: 'gpt-4o-mini',
      p_user_id: req.user.id,
      p_assistant_id: null
    });

    if (deductError) {
      console.error('Erro ao deduzir créditos:', deductError);
      // Continuar mesmo com erro de créditos
    }

    res.json({
      success: true,
      summary: respostaIA.content || respostaIA,
      tokensUsed: tokensUsados,
      messageCount: messages.length
    });

  } catch (error) {
    console.error('Erro ao resumir conversa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/ai/generate-operation-summary - Gerar resumo da operação com IA
router.post('/generate-operation-summary', authenticateToken, async (req, res) => {
  try {
    const { period, organization_id } = req.body;
    const userId = req.user?.id;
    const userOrgId = req.user?.organization_id || organization_id;


    if (!userOrgId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID da organização é obrigatório' 
      });
    }

    // Definir período de análise
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        endDate = now;
    }


    // 🎯 VERIFICAR ROLE DO USUÁRIO PARA FILTRAR DADOS SE FOR AGENTE
    let isAgent = false;
    
    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', userId)
        .single();

      if (!profileError && userProfile?.role_id) {
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('name')
          .eq('id', userProfile.role_id)
          .single();

        if (!roleError && role?.name) {
          isAgent = role.name.toLowerCase().includes('agente') || role.name.toLowerCase().includes('agent');
        }
      }
    } catch (error) {
      console.error('❌ [OPERATION SUMMARY] Erro ao buscar role do usuário:', error);
    }


    // Buscar dados da operação (versão simplificada)

    // Buscar métricas básicas
    let metricsQuery = supabase
      .from('messages')
      .select('id, created_at, is_from_me, chat_id')
      .eq('organization_id', userOrgId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    // 🎯 FILTRO POR AGENTE: Se for agente, filtrar mensagens de conversas atribuídas a ele
    if (isAgent) {
      // Buscar IDs das conversas atribuídas ao agente
      const { data: agentChats, error: chatsError } = await supabase
        .from('chats')
        .select('id')
        .eq('organization_id', userOrgId)
        .eq('assigned_agent_id', userId);
      
      if (!chatsError && agentChats && agentChats.length > 0) {
        const chatIds = agentChats.map(c => c.id);
        metricsQuery = metricsQuery.in('chat_id', chatIds);
      } else {
        // Se não tem conversas, não retornar mensagens
        metricsQuery = metricsQuery.eq('chat_id', '00000000-0000-0000-0000-000000000000'); // UUID inválido
      }
    }
    
    // ✅ REMOVIDO: Limite de 1000 - Usar range para buscar todas as mensagens (Supabase limita a 1000 por padrão)
    const { data: metricsData, error: metricsError } = await metricsQuery.range(0, 999999);

    if (metricsError) {
      console.error('❌ [OPERATION SUMMARY] Erro ao buscar métricas:', metricsError);
      throw metricsError;
    }

    // Calcular métricas básicas
    const totalMessages = metricsData?.length || 0;
    const sentMessages = metricsData?.filter(m => m.is_from_me).length || 0;
    const receivedMessages = metricsData?.filter(m => !m.is_from_me).length || 0;
    const uniqueChats = new Set(metricsData?.map(m => m.chat_id)).size;


    // Prompt simplificado (baseado na rota que funcionou)
    const analysisPrompt = `Analise estes dados de operação e responda em JSON:

Dados:
- Total de mensagens: ${totalMessages}
- Mensagens enviadas: ${sentMessages}
- Mensagens recebidas: ${receivedMessages}
- Conversas únicas: ${uniqueChats}
- Período: ${period}

Responda APENAS com JSON:
{
  "summary": "Resumo da operação em texto simples",
  "sentiment": {
    "overall": "positivo/negativo/neutro",
    "description": "Descrição do sentimento geral"
  },
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Recomendação 1", "Recomendação 2", "Recomendação 3"]
}`;

    const iaConfig = {
      configuracoes: {
        modelo: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 1000
      }
    };

    const { respostaIA, tokensUsados } = await generateAIResponse(
      analysisPrompt,
      'Você é um analista de operações. Responda apenas com JSON válido.',
      [],
      iaConfig
    );


    // Tentar fazer parse do JSON
    let analysisData;
    try {
      const jsonString = respostaIA.content || respostaIA;
      analysisData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ [OPERATION SUMMARY] Erro ao fazer parse:', parseError);
      analysisData = {
        summary: "Análise da operação concluída com sucesso",
        sentiment: { overall: "neutro", description: "Operação dentro dos parâmetros normais" },
        insights: ["Operação funcionando normalmente", "Volume de mensagens adequado"],
        recommendations: ["Continuar monitoramento", "Manter qualidade do atendimento"]
      };
    }

    // Deduzir créditos da organização
    try {
      const { data: creditDeducted, error: deductError } = await supabase.rpc('deduct_organization_ai_credits', {
        p_organization_id: userOrgId,
        p_tokens_used: tokensUsados,
        p_model: 'gpt-4o-mini',
        p_user_id: userId,
        p_assistant_id: null
      });

      if (deductError) {
        console.error('⚠️ [OPERATION SUMMARY] Erro ao deduzir créditos:', deductError);
        // Não falhar a operação por causa dos créditos
      } else {
      }
    } catch (creditError) {
      console.error('⚠️ [OPERATION SUMMARY] Erro geral na dedução de créditos:', creditError);
      // Não falhar a operação por causa dos créditos
    }

    // Criar objeto de resumo
    const operationSummary = {
      id: `summary_${Date.now()}`,
      timestamp: new Date().toISOString(),
      period: period,
      summary: analysisData.summary || 'Resumo não disponível',
      sentiment: analysisData.sentiment || {
        overall: 'neutral',
        description: 'Operação normal'
      },
      metrics: {
        total_messages: totalMessages,
        active_chats: uniqueChats,
        sent_messages: sentMessages,
        received_messages: receivedMessages
      },
      insights: analysisData.insights || ['Análise em andamento'],
      recommendations: analysisData.recommendations || ['Aguardando análise completa'],
      status: 'completed'
    };


    res.json({
      success: true,
      summary: operationSummary,
      tokens_used: tokensUsados,
      period: period
    });

  } catch (error) {
    console.error('❌ [OPERATION SUMMARY] Erro ao gerar resumo da operação:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor ao gerar resumo da operação' 
    });
  }
});

// GET /api/ai/check-user-organization - Verificar organização do usuário
// Rota para transcrever áudio usando OpenAI Whisper
router.post('/transcribe-audio', authenticateToken, async (req, res) => {
  try {
    const { audioUrl, messageId } = req.body;
    const organizationId = req.user.organization_id;

    if (!audioUrl) {
      return res.status(400).json({ success: false, error: 'audioUrl é obrigatório' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key não configurada' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Baixar o áudio da URL
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.ogg`);
    
    // Baixar arquivo
    const protocol = audioUrl.startsWith('https') ? https : http;
    const file = fs.createWriteStream(tempFilePath);

    await new Promise((resolve, reject) => {
      protocol.get(audioUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Erro ao baixar áudio: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(null);
        });
      }).on('error', (err) => {
        fs.unlinkSync(tempFilePath);
        reject(err);
      });
    });

    // Transcrever usando OpenAI Whisper
    const audioStream = fs.createReadStream(tempFilePath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "pt",
      response_format: "text"
    });

    // Limpar arquivo temporário
    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.warn('Erro ao remover arquivo temporário:', err);
    }

    // Se messageId foi fornecido, atualizar o metadata da mensagem
    if (messageId) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('metadata')
        .eq('id', messageId)
        .eq('organization_id', organizationId)
        .single();

      if (!messageError && message) {
        const metadata = message.metadata || {};
        metadata.transcription = transcription;
        
        const { error: updateError } = await supabase
          .from('messages')
          .update({ metadata })
          .eq('id', messageId)
          .eq('organization_id', organizationId);

        if (updateError) {
          console.error('Erro ao atualizar metadata da mensagem:', updateError);
        }
      }
    }

    return res.json({
      success: true,
      transcription: transcription
    });

  } catch (error) {
    console.error('Erro ao transcrever áudio:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao transcrever áudio'
    });
  }
});

router.get('/check-user-organization', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Usuário não autenticado' 
      });
    }

    console.log('🔍 [CHECK ORG] Verificando organização do usuário:', userId);

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        organization_id,
        roles (
          id,
          name,
          description
        )
      `)
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ [CHECK ORG] Erro ao buscar perfil:', profileError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar perfil do usuário' 
      });
    }

    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Perfil do usuário não encontrado' 
      });
    }

    console.log('✅ [CHECK ORG] Perfil encontrado:', {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      organization_id: profile.organization_id
    });

    // Se não tem organização, tentar encontrar uma organização padrão
    if (!profile.organization_id) {
      console.log('⚠️ [CHECK ORG] Usuário sem organização, buscando organização padrão...');
      
      // Buscar primeira organização disponível (para desenvolvimento)
      const { data: defaultOrg, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, domain')
        .limit(1)
        .single();

      if (orgError || !defaultOrg) {
        console.error('❌ [CHECK ORG] Nenhuma organização encontrada:', orgError);
        return res.json({
          success: false,
          hasOrganization: false,
          profile: {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            organization_id: null,
            role: profile.roles?.name || 'agent'
          },
          message: 'Nenhuma organização disponível no sistema'
        });
      }

      // Associar usuário à organização padrão
      console.log('🔧 [CHECK ORG] Associando usuário à organização padrão:', defaultOrg.name);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          organization_id: defaultOrg.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ [CHECK ORG] Erro ao associar usuário à organização:', updateError);
        return res.status(500).json({ 
          success: false, 
          error: 'Erro ao associar usuário à organização' 
        });
      }

      console.log('✅ [CHECK ORG] Usuário associado à organização com sucesso');

      return res.json({
        success: true,
        hasOrganization: true,
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          organization_id: defaultOrg.id,
          role: profile.roles?.name || 'agent'
        },
        organization: defaultOrg,
        message: 'Usuário associado à organização padrão'
      });
    }

    // Buscar dados da organização
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, domain, status')
      .eq('id', profile.organization_id)
      .single();

    if (orgError) {
      console.error('❌ [CHECK ORG] Erro ao buscar organização:', orgError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar dados da organização' 
      });
    }

    console.log('✅ [CHECK ORG] Organização encontrada:', organization);

    return res.json({
      success: true,
      hasOrganization: true,
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        organization_id: profile.organization_id,
        role: profile.roles?.name || 'agent'
      },
      organization: organization,
      message: 'Usuário possui organização válida'
    });

  } catch (error) {
    console.error('❌ [CHECK ORG] Erro geral:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

/**
 * POST /api/ai/organization-chat
 * Chat com assistente virtual da organização que pode acessar dados do banco
 */
router.post('/organization-chat', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { message, conversation_history = [] } = req.body;

    if (!user || !user.organization_id) {
      return res.status(401).json({ 
        error: 'Usuário não autenticado ou sem organização' 
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ 
        error: 'Mensagem é obrigatória' 
      });
    }

    logger.debug('💬 [Organization Chat] Nova mensagem recebida', {
      userId: user.id,
      organizationId: user.organization_id,
      messageLength: message.length
    });

    // Carregar configurações de IA da organização
    const aiSettings = await loadAISettings(user.organization_id);
    const processingConfig = getAIProcessingConfig(aiSettings);

    // Buscar informações básicas da organização
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .eq('id', user.organization_id)
      .single();

    if (orgError) {
      logger.error('❌ [Organization Chat] Erro ao buscar organização:', orgError);
    }

    // Buscar estatísticas básicas da organização para contexto
    const stats = await getOrganizationStats(user.organization_id);

    // Preparar contexto do sistema com informações da organização
    const systemPrompt = `Você é um assistente virtual dedicado da organização "${organization?.name || 'Organização'}".

SUAS CAPACIDADES:
- Responder perguntas sobre dados e métricas da organização
- Analisar conversas, mensagens e estatísticas
- Fornecer insights sobre operações e performance
- Buscar dados específicos do banco de dados quando necessário

DADOS DA ORGANIZAÇÃO (disponíveis no contexto):
${JSON.stringify(stats, null, 2)}

BUSCA DINÂMICA DE DADOS:
Se o usuário pedir dados específicos que não estão no contexto acima, você pode solicitar uma busca dinâmica usando o seguinte formato JSON:

{
  "needsData": true,
  "queryType": "tipo_da_busca",
  "filters": {
    "campo": "valor"
  },
  "response": "sua resposta inicial enquanto busca os dados"
}

TIPOS DE BUSCA DISPONÍVEIS:
- "chats": Buscar conversas (filtros: status, assigned_agent_id, dateStart, dateEnd, limit)
- "messages": Buscar mensagens (filtros: chat_id, dateStart, dateEnd, limit, search)
- "users": Buscar usuários/agentes (filtros: department, is_online, limit)
- "contacts": Buscar contatos (filtros: search, limit)
- "accounts": Buscar contas WhatsApp (filtros: status, limit)
- "stats": Buscar estatísticas específicas (filtros: dateStart, dateEnd)

INSTRUÇÕES:
- Seja útil, profissional e objetivo
- Use os dados fornecidos para responder perguntas
- Se o usuário pedir dados específicos que não estão no contexto, use o formato JSON acima para solicitar busca
- Mantenha respostas concisas mas completas
- Sempre inclua uma resposta inicial no campo "response" mesmo quando solicitar busca

IMPORTANTE:
- Se os dados já estão no contexto, responda diretamente sem solicitar busca
- Use busca dinâmica apenas quando realmente necessário
- Sempre forneça uma resposta inicial enquanto os dados são buscados`;

    // Preparar histórico de conversa
    const formattedHistory = conversation_history.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));

    // Configuração da IA
    const iaConfig = {
      configuracoes: {
        modelo: processingConfig.model || "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 1000,
        tokens_available: 1000000
      }
    };

    // Gerar resposta com IA
    const { respostaIA } = await generateAIResponse(
      message,
      systemPrompt,
      formattedHistory,
      iaConfig
    );

    let response = respostaIA.content || respostaIA || 'Desculpe, não consegui processar sua mensagem.';
    let dynamicData = null;

    // Verificar se a IA solicitou busca dinâmica de dados
    try {
      const jsonMatch = response.match(/\{[\s\S]*"needsData"[\s\S]*\}/);
      if (jsonMatch) {
        const dataRequest = JSON.parse(jsonMatch[0]);
        
        if (dataRequest.needsData && dataRequest.queryType) {
          logger.debug('🔍 [Organization Chat] Busca dinâmica solicitada:', dataRequest.queryType);
          
          // Buscar dados dinamicamente
          dynamicData = await fetchDynamicData(
            user.organization_id,
            dataRequest.queryType,
            dataRequest.filters || {}
          );

          // Gerar resposta final com os dados buscados
          const finalPrompt = `O usuário perguntou: "${message}"

Você já respondeu inicialmente: "${dataRequest.response}"

Agora você recebeu os dados buscados do banco de dados:
${JSON.stringify(dynamicData, null, 2)}

Forneça uma resposta completa e detalhada usando os dados buscados. Seja específico e cite números reais quando possível.`;

          const { respostaIA: finalResponse } = await generateAIResponse(
            finalPrompt,
            "Você é um assistente virtual. Use os dados fornecidos para dar uma resposta completa e detalhada.",
            [],
            iaConfig
          );

          response = finalResponse.content || finalResponse || dataRequest.response;
        }
      }
    } catch (parseError) {
      // Se não conseguir parsear JSON, usar resposta original
      logger.debug('ℹ️ [Organization Chat] Resposta não contém solicitação de busca dinâmica');
    }

    logger.debug('✅ [Organization Chat] Resposta gerada com sucesso');

    res.json({
      success: true,
      response,
      dynamicData: dynamicData ? { queryType: dynamicData.queryType, count: dynamicData.count || 0 } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [Organization Chat] Erro ao processar mensagem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * Busca dados dinamicamente baseado no tipo de query solicitado
 */
async function fetchDynamicData(organizationId, queryType, filters = {}) {
  try {
    logger.debug('🔍 [Organization Chat] Buscando dados:', { queryType, filters });

    switch (queryType) {
      case 'chats': {
        let query = supabase
          .from('chats')
          .select('id, name, status, assigned_agent_id, created_at, platform, department')
          .eq('organization_id', organizationId);

        if (filters.status) {
          if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
          } else {
            query = query.eq('status', filters.status);
          }
        }

        if (filters.assigned_agent_id) {
          query = query.eq('assigned_agent_id', filters.assigned_agent_id);
        }

        if (filters.dateStart) {
          query = query.gte('created_at', new Date(filters.dateStart).toISOString());
        }

        if (filters.dateEnd) {
          query = query.lte('created_at', new Date(filters.dateEnd).toISOString());
        }

        const limit = filters.limit || 50;
        const { data, error, count } = await query.limit(limit);

        if (error) throw error;

        return {
          queryType: 'chats',
          count: count || data?.length || 0,
          data: data || []
        };
      }

      case 'messages': {
        let query = supabase
          .from('messages')
          .select('id, content, created_at, is_from_me, sender_name, chat_id')
          .eq('organization_id', organizationId);

        if (filters.chat_id) {
          query = query.eq('chat_id', filters.chat_id);
        }

        if (filters.dateStart) {
          query = query.gte('created_at', new Date(filters.dateStart).toISOString());
        }

        if (filters.dateEnd) {
          query = query.lte('created_at', new Date(filters.dateEnd).toISOString());
        }

        if (filters.search) {
          query = query.ilike('content', `%${filters.search}%`);
        }

        const limit = filters.limit || 50;
        const { data, error, count } = await query.order('created_at', { ascending: false }).limit(limit);

        if (error) throw error;

        return {
          queryType: 'messages',
          count: count || data?.length || 0,
          data: data || []
        };
      }

      case 'users': {
        let query = supabase
          .from('profiles')
          .select('id, name, email, department, is_online, last_seen')
          .eq('organization_id', organizationId)
          .is('deleted_at', null);

        if (filters.department) {
          query = query.eq('department', filters.department);
        }

        if (filters.is_online !== undefined) {
          query = query.eq('is_online', filters.is_online);
        }

        const limit = filters.limit || 50;
        const { data, error, count } = await query.order('name', { ascending: true }).limit(limit);

        if (error) throw error;

        return {
          queryType: 'users',
          count: count || data?.length || 0,
          data: data || []
        };
      }

      case 'contacts': {
        let query = supabase
          .from('contacts')
          .select('id, name, phone_number, last_interaction_at, user_id')
          .eq('organization_id', organizationId);

        if (filters.search) {
          query = query.or(`name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`);
        }

        const limit = filters.limit || 50;
        const { data, error, count } = await query.order('last_interaction_at', { ascending: false }).limit(limit);

        if (error) throw error;

        return {
          queryType: 'contacts',
          count: count || data?.length || 0,
          data: data || []
        };
      }

      case 'accounts': {
        let query = supabase
          .from('whatsapp_accounts')
          .select('id, name, phone_number, status, account_id')
          .eq('organization_id', organizationId);

        if (filters.status) {
          query = query.eq('status', filters.status);
        }

        const limit = filters.limit || 50;
        const { data, error, count } = await query.limit(limit);

        if (error) throw error;

        return {
          queryType: 'accounts',
          count: count || data?.length || 0,
          data: data || []
        };
      }

      case 'stats': {
        const dateStart = filters.dateStart ? new Date(filters.dateStart) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dateEnd = filters.dateEnd ? new Date(filters.dateEnd) : new Date();

        const [chatsResult, messagesResult, activeChatsResult] = await Promise.all([
          supabase
            .from('chats')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .gte('created_at', dateStart.toISOString())
            .lte('created_at', dateEnd.toISOString()),
          
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .gte('created_at', dateStart.toISOString())
            .lte('created_at', dateEnd.toISOString()),
          
          supabase
            .from('chats')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .in('status', ['active', 'pending'])
        ]);

        return {
          queryType: 'stats',
          dateRange: {
            start: dateStart.toISOString(),
            end: dateEnd.toISOString()
          },
          data: {
            totalChats: chatsResult.count || 0,
            totalMessages: messagesResult.count || 0,
            activeChats: activeChatsResult.count || 0
          }
        };
      }

      default:
        return {
          queryType,
          error: 'Tipo de busca não suportado',
          data: []
        };
    }
  } catch (error) {
    logger.error('❌ [Organization Chat] Erro ao buscar dados dinamicamente:', error);
    return {
      queryType,
      error: error.message,
      data: []
    };
  }
}

/**
 * Busca estatísticas básicas da organização para contexto
 */
async function getOrganizationStats(organizationId) {
  try {
    // Buscar contagens básicas
    const [chatsResult, messagesResult, usersResult, accountsResult] = await Promise.all([
      supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('deleted_at', null),
      
      supabase
        .from('whatsapp_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
    ]);

    // Buscar conversas ativas
    const { count: activeChats } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('status', ['active', 'pending']);

    // Buscar mensagens recentes (últimas 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: recentMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', yesterday.toISOString());

    return {
      totalChats: chatsResult.count || 0,
      totalMessages: messagesResult.count || 0,
      totalUsers: usersResult.count || 0,
      totalAccounts: accountsResult.count || 0,
      activeChats: activeChats || 0,
      recentMessages24h: recentMessages || 0,
      organizationId
    };
  } catch (error) {
    logger.error('❌ [Organization Chat] Erro ao buscar estatísticas:', error);
    return {
      totalChats: 0,
      totalMessages: 0,
      totalUsers: 0,
      totalAccounts: 0,
      activeChats: 0,
      recentMessages24h: 0,
      organizationId
    };
  }
}

export default router;
