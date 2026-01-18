import express from 'express';
import { supabase, supabaseAdmin, createAuthenticatedClient } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { filterBlacklistedMessages } from '../utils/blacklistFilter.js';

const router = express.Router();

// Listar regras da organização
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [RULES] Listando regras da organização:', req.user?.organization?.name);
    
    if (!req.user) {
      console.log('❌ [RULES] Usuário não autenticado');
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }
    
    if (!req.user.organization_id) {
      console.log('❌ [RULES] Usuário sem organização');
      return res.status(400).json({ success: false, error: 'Usuário sem organização' });
    }
    
    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Buscar apenas regras da organização do usuário
    const { data: rules, error } = await supabaseAdmin
      .from('monitoring_rules')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar regras:', error);
      throw new Error(`Erro ao buscar regras: ${error.message}`);
    }

    console.log('✅ [RULES] Regras encontradas:', rules?.length || 0);
    res.json({ success: true, rules: rules || [] });
  } catch (error) {
    console.error('Erro ao listar regras:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar nova regra
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [RULES] Criando nova regra');
    console.log('🔍 [RULES] Usuário:', req.user);
    console.log('🔍 [RULES] Body:', req.body);
    
    // Validações de segurança
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: 'Usuário não autenticado ou sem organização' });
    }

    const { name, keywords, description } = req.body;

    if (!name || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      console.log('❌ [RULES] Validação falhou:', { name, keywords, isArray: Array.isArray(keywords) });
      return res.status(400).json({ 
        success: false, 
        error: 'Nome e palavras-chave são obrigatórios' 
      });
    }

    // Validar se todas as palavras-chave são strings válidas
    const validKeywords = keywords.filter(keyword => 
      typeof keyword === 'string' && keyword.trim().length > 0
    );

    if (validKeywords.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Pelo menos uma palavra-chave válida é obrigatória' 
      });
    }

    // ✅ CORREÇÃO: Usar cliente admin (bypass RLS) porque:
    // 1. As permissões já são validadas manualmente no middleware authenticateToken
    // 2. O organization_id e user_id são validados antes da inserção
    // 3. O Supabase RLS não funciona bem com tokens em operações server-side sem sessão completa
    // Esta abordagem é segura porque todas as validações de segurança são feitas no middleware
    console.log('🔍 [RULES] Usando cliente admin (validações de segurança feitas no middleware)');
    const clientToUse = supabaseAdmin;

    const { data: rule, error } = await clientToUse
      .from('monitoring_rules')
      .insert([{
        organization_id: req.user.organization_id,
        user_id: req.user.id,
        name: name.trim(),
        keywords: validKeywords.map(k => k.trim()),
        description: description?.trim() || null
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [RULES] Erro ao inserir regra:', error);
      throw error;
    }

    console.log('✅ [RULES] Regra criada com sucesso:', rule);
    res.json({ success: true, rule });
  } catch (error) {
    console.error('Erro ao criar regra:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar regra
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, keywords, description, is_active } = req.body;

    // Validações de segurança
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: 'Usuário não autenticado ou sem organização' });
    }

    if (!name || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome e palavras-chave são obrigatórios' 
      });
    }

    // ✅ CORREÇÃO: Usar cliente admin
    // Primeiro verificar se a regra existe e pertence à organização
    const { data: existingRule, error: checkError } = await supabaseAdmin
      .from('monitoring_rules')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (checkError || !existingRule) {
      return res.status(404).json({ 
        success: false, 
        error: 'Regra não encontrada ou você não tem permissão para editá-la' 
      });
    }

    // Atualizar a regra
    const { data: rule, error } = await supabaseAdmin
      .from('monitoring_rules')
      .update({
        name,
        keywords,
        description,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, rule });
  } catch (error) {
    console.error('Erro ao atualizar regra:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deletar regra
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validações de segurança
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: 'Usuário não autenticado ou sem organização' });
    }

    // ✅ CORREÇÃO: Usar cliente admin
    // Primeiro verificar se a regra existe e pertence à organização
    const { data: existingRule, error: checkError } = await supabaseAdmin
      .from('monitoring_rules')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (checkError || !existingRule) {
      return res.status(404).json({ 
        success: false, 
        error: 'Regra não encontrada ou você não tem permissão para deletá-la' 
      });
    }

    // Deletar a regra
    const { error } = await supabaseAdmin
      .from('monitoring_rules')
      .delete()
      .eq('id', id)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar regra:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gerar relatório de ocorrências
router.post('/report', authenticateToken, async (req, res) => {
  try {
    const { dateStart, dateEnd, ruleId } = req.body;

    console.log('🔍 [DEBUG] Gerando relatório');
    console.log('🔍 [DEBUG] Parâmetros:', { dateStart, dateEnd, ruleId });
    console.log('🔍 [DEBUG] Usuário:', req.user);

    // Validações de segurança
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: 'Usuário não autenticado ou sem organização' });
    }

    if (!dateStart || !dateEnd) {
      return res.status(400).json({ 
        success: false, 
        error: 'Data inicial e final são obrigatórias' 
      });
    }

    // ✅ CORREÇÃO: Usar cliente admin
    // Buscar regras da organização
    let rulesQuery = supabaseAdmin
      .from('monitoring_rules')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .eq('is_active', true);

    if (ruleId) {
      rulesQuery = rulesQuery.eq('id', ruleId);
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) throw rulesError;

    console.log('🔍 [DEBUG] Regras encontradas:', rules?.length || 0);
    if (rules && rules.length > 0) {
      rules.forEach(rule => {
        console.log('🔍 [DEBUG] Regra:', rule.name, 'Keywords:', rule.keywords);
      });
    }

    if (!rules || rules.length === 0) {
      return res.json({ 
        success: true, 
        occurrences: [],
        total: 0,
        message: 'Nenhuma regra ativa encontrada'
      });
    }

    // Buscar mensagens no período
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        organization_id,
        chats(name, whatsapp_jid, assigned_agent_id)
      `)
      .eq('organization_id', req.user.organization_id)
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd)
      .not('content', 'is', null);

    if (messagesError) throw messagesError;

    console.log('🔍 [DEBUG] Mensagens encontradas:', messages?.length || 0);
    if (messages && messages.length > 0) {
      console.log('🔍 [DEBUG] Primeiras 3 mensagens:');
      messages.slice(0, 3).forEach(msg => {
        console.log('🔍 [DEBUG] - ID:', msg.id, 'Content:', msg.content?.substring(0, 50), 'Org:', msg.organization_id);
      });
    }

    // 🎯 APLICAR FILTRO DE BLACKLIST
    console.log('🚫 [BLACKLIST] Aplicando filtro de blacklist...');
    const filteredMessages = await filterBlacklistedMessages(messages || [], req.user.organization_id);
    console.log('🚫 [BLACKLIST] Mensagens após filtro:', filteredMessages.length);

    // Processar mensagens contra as regras
    const reportData = [];
    let occurrenceId = 1;
    for (const message of filteredMessages || []) {
      const content = message.content.toLowerCase();
      console.log('🔍 [DEBUG] Processando mensagem ID:', message.id);
      
      for (const rule of rules) {
        for (const keyword of rule.keywords) {
          const keywordLower = keyword.toLowerCase();
          
          if (content.includes(keywordLower)) {
            console.log('🔍 [DEBUG] MATCH ENCONTRADO! Regra:', rule.name, 'Keyword:', keyword);
            
            // Buscar nome do agente (se assigned_agent_id existir)
            let agentName = 'Agente';
            if (message.chats?.assigned_agent_id) {
              const { data: agentProfile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', message.chats.assigned_agent_id)
                .eq('organization_id', req.user.organization_id) // ✅ CORREÇÃO: Filtrar por organização
                .single();
              if (agentProfile && agentProfile.name) {
                agentName = agentProfile.name;
              }
            }
            // Adicionar ao relatório
            reportData.push({
              id: occurrenceId++,
              rule_name: rule.name,
              matched_keyword: keyword,
              customer_name: message.chats?.name || 'Cliente',
              customer_phone: message.chats?.whatsapp_jid || 'N/A',
              agent_name: agentName,
              message_content: message.content,
              message_timestamp: message.created_at,
              chat_id: message.chat_id,
              message_id: message.id
            });
          }
        }
      }
    }

    console.log('🔍 [DEBUG] Relatório final:', reportData.length, 'ocorrências');

    res.json({ 
      success: true, 
      occurrences: reportData,
      total: reportData.length
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Processar mensagens existentes para verificar regras (para dados históricos)
router.post('/process-historical', authenticateToken, async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.body;

    console.log('🔍 [DEBUG] Processamento histórico iniciado');
    console.log('🔍 [DEBUG] Usuário:', req.user);
    console.log('🔍 [DEBUG] Período:', { dateStart, dateEnd });

    // Validações de segurança
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: 'Usuário não autenticado ou sem organização' });
    }

    if (!dateStart || !dateEnd) {
      return res.status(400).json({ 
        success: false, 
        error: 'Data inicial e final são obrigatórias' 
      });
    }

    // Buscar regras ativas da organização
    const { data: rules, error: rulesError } = await supabase
      .from('monitoring_rules')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .eq('is_active', true);

    if (rulesError) throw rulesError;

    console.log('🔍 [DEBUG] Regras encontradas:', rules?.length || 0);
    if (rules && rules.length > 0) {
      rules.forEach(rule => {
        console.log('🔍 [DEBUG] Regra:', rule.name, 'Keywords:', rule.keywords);
      });
    }

    if (!rules || rules.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Nenhuma regra ativa encontrada',
        processed: 0 
      });
    }

    // Buscar mensagens no período
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        organization_id,
        chats(name, whatsapp_jid, assigned_agent_id),
        profiles(name)
      `)
      .eq('organization_id', req.user.organization_id)
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd)
      .not('content', 'is', null);

    if (messagesError) throw messagesError;

    console.log('🔍 [DEBUG] Mensagens encontradas:', messages?.length || 0);
    if (messages && messages.length > 0) {
      console.log('🔍 [DEBUG] Primeiras 3 mensagens:');
      messages.slice(0, 3).forEach(msg => {
        console.log('🔍 [DEBUG] - ID:', msg.id, 'Content:', msg.content?.substring(0, 50), 'Org:', msg.organization_id);
      });
    }

    let processedCount = 0;

    // Processar cada mensagem contra as regras
    for (const message of messages || []) {
      const content = message.content.toLowerCase();
      console.log('🔍 [DEBUG] Processando mensagem ID:', message.id);
      console.log('🔍 [DEBUG] Conteúdo:', message.content);
      console.log('🔍 [DEBUG] Conteúdo (lowercase):', content);
      
      for (const rule of rules) {
        for (const keyword of rule.keywords) {
          const keywordLower = keyword.toLowerCase();
          console.log('🔍 [DEBUG] Verificando keyword:', keyword, 'vs', keywordLower);
          
          if (content.includes(keywordLower)) {
            console.log('🔍 [DEBUG] MATCH ENCONTRADO! Regra:', rule.name, 'Keyword:', keyword);
            
            // Verificar se já existe uma ocorrência para esta mensagem e regra
            const { data: existing } = await supabase
              .from('rule_occurrences')
              .select('id')
              .eq('rule_id', rule.id)
              .eq('message_id', message.id)
              .eq('matched_keyword', keyword)
              .single();

            if (!existing) {
              console.log('🔍 [DEBUG] Criando nova ocorrência...');
              
              // Buscar nome do agente
              const agentName = message.profiles?.name || 'Agente';
              
              // ✅ CORREÇÃO: Verificar se o agente pertence à organização
              if (message.profiles && message.profiles.organization_id !== req.user.organization_id) {
                console.log('🔍 [DEBUG] Agente de outra organização detectado, pulando...');
                continue;
              }

              // Criar ocorrência
              const { data: newOccurrence, error: insertError } = await supabase
                .from('rule_occurrences')
                .insert({
                  rule_id: rule.id,
                  chat_id: message.chat_id,
                  message_id: message.id,
                  matched_keyword: keyword,
                  message_content: message.content,
                  message_timestamp: message.created_at,
                  customer_name: message.chats?.name,
                  customer_phone: message.chats?.whatsapp_jid,
                  agent_name: agentName
                })
                .select()
                .single();

              if (insertError) {
                console.log('🔍 [DEBUG] Erro ao inserir ocorrência:', insertError);
              } else {
                console.log('🔍 [DEBUG] Ocorrência criada com sucesso:', newOccurrence.id);
                processedCount++;
              }
            } else {
              console.log('🔍 [DEBUG] Ocorrência já existe, pulando...');
            }
          } else {
            console.log('🔍 [DEBUG] Não encontrou match para:', keyword);
          }
        }
      }
    }

    console.log('🔍 [DEBUG] Processamento concluído. Total de ocorrências:', processedCount);
    
    res.json({ 
      success: true, 
      message: `Processamento concluído. ${processedCount} ocorrências encontradas.`,
      processed: processedCount
    });
  } catch (error) {
    console.error('Erro ao processar dados históricos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router; 