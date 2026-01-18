
const { supabase } = require('@config/supabase');
const { gerarRespostaIA } = require("./iaToolsService");

exports.handleIAMessage = async (req, res) => {
  const { clientId, mensagem, contexto = [], treinamento, assistantId } = req.body;
  
  try {
    // 🎯 NOVA ESTRUTURA: Buscar assistente ativo em vez de ai_configuracoes
    const { data: assistant, error: assistantError } = await supabase
      .from('ai_assistants')
      .select('*')
      .eq('id', assistantId || null)
      .eq('is_active', true)
      .single();

    if (assistantError || !assistant) {
      return res.status(403).json({ error: "Assistente de IA não encontrado ou inativo" });
    }

    // 🎯 VERIFICAR CRÉDITOS ORGANIZACIONAIS em vez de tokens individuais
    const organizationId = assistant.organization_id;
    
    if (!organizationId) {
      return res.status(403).json({ error: "Assistente sem organização definida" });
    }

    // Buscar créditos da organização
    const { data: credits, error: creditsError } = await supabase
      .from('ai_credits')
      .select('credits_remaining')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (creditsError || !credits || credits.credits_remaining <= 0) {
      return res.status(403).json({ error: "Sem créditos disponíveis na organização" });
    }

    // 🎯 PREPARAR CONFIGURAÇÕES BASEADAS NO ASSISTENTE
    const iaConfig = {
      configuracoes: {
        modelo: assistant.model,
        temperature: 0.7, // Default se não especificado
        max_tokens: 1000,  // Default se não especificado
        provider: assistant.provider
      },
      // Manter compatibilidade com código existente
      id: assistant.id,
      user_id: assistant.user_id,
      organization_id: assistant.organization_id
    };

    // Preparar treinamento baseado no assistente
    const assistantTraining = `Você é ${assistant.name}. ${assistant.instructions}

Personalidade: ${assistant.personality || 'Profissional e prestativo'}`;

    const { respostaIA, role, tokensUsados } = await gerarRespostaIA({ 
      clientId, 
      mensagem, 
      contexto, 
      iaConfig, 
      treinamento: assistantTraining // Usar treinamento do assistente
    });

    // 🎯 DEDUZIR CRÉDITOS ORGANIZACIONAIS usando a função existente
    const { data: creditDeducted, error: deductError } = await supabase.rpc('deduct_organization_ai_credits', {
      p_organization_id: organizationId,
      p_tokens_used: tokensUsados,
      p_model: assistant.model,
      p_user_id: clientId, // Para rastreamento
      p_assistant_id: assistant.id
    });

    if (deductError || !creditDeducted) {
      console.error('Erro ao deduzir créditos:', deductError);
      // Continuar mesmo com erro de créditos, mas registrar
    }

    // Buscar créditos restantes após dedução
    const { data: remainingCredits } = await supabase
      .from('ai_credits')
      .select('credits_remaining')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return res.json({ 
      resposta: respostaIA.content || respostaIA, 
      role, 
      tokensUsados,
      tokensRestantes: remainingCredits?.credits_remaining || 0,
      assistant: {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        provider: assistant.provider
      }
    });
    
  } catch (error) {
    console.error("Erro IA:", error);
    // 🔕 Não enviar erros técnicos para o cliente final
    res.status(500).json({ error: "Erro ao processar a mensagem" });
  }
};

exports.getIAConfig = async (req, res) => {
  const { assistantId } = req.params;
  
  try {
    // 🎯 NOVA ESTRUTURA: Buscar assistente em vez de ai_configuracoes
    const { data: assistant, error } = await supabase
      .from('ai_assistants')
      .select('*')
      .eq('id', assistantId)
      .eq('is_active', true)
      .single();

    if (error) {
      return res.status(404).json({ error: "Assistente de IA não encontrado" });
    }

    // Retornar no formato esperado pelo frontend
    const configResponse = {
      id: assistant.id,
      name: assistant.name,
      description: assistant.description,
      instructions: assistant.instructions,
      personality: assistant.personality,
      model: assistant.model,
      provider: assistant.provider,
      is_active: assistant.is_active,
      configuracoes: {
        modelo: assistant.model,
        provider: assistant.provider,
        temperature: 0.7, // Default
        max_tokens: 1000   // Default
      }
    };

    res.json(configResponse);
    
  } catch (error) {
    console.error("Erro ao buscar config IA:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🎯 NOVA FUNÇÃO: Buscar assistentes por organização
exports.getAssistantsByOrganization = async (req, res) => {
  const { organizationId } = req.params;
  
  try {
    const { data: assistants, error } = await supabase
      .from('ai_assistants')
      .select('id, name, description, model, provider, is_active, assistant_type, is_organizational')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Erro ao buscar assistentes" });
    }

    res.json(assistants || []);
    
  } catch (error) {
    console.error("Erro ao buscar assistentes:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🎯 ATUALIZAR: Usar ai_assistants em vez de ai_fluxos
exports.getIAFluxos = async (userId) => {
  try {
    // Se ainda usar fluxos, manter a implementação original
    // Ou adaptar para buscar assistentes do usuário
    const { data: assistants, error } = await supabase
      .from('ai_assistants')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar assistentes:', error);
      return [];
    }

    return assistants || [];
  } catch (error) {
    console.error('Erro ao buscar assistentes:', error);
    return [];
  }
};

// 🎯 NOVA FUNÇÃO: Salvar interação com assistente
exports.saveIAInteraction = async (userId, assistantId, prompt, resposta, metadata = {}) => {
  try {
    // Usar ai_token_usage para registrar a interação
    const { error } = await supabase
      .from('ai_token_usage')
      .insert({
        user_id: userId,
        assistant_id: assistantId,
        organization_id: metadata.organization_id,
        tokens_used: metadata.tokens_used || 0,
        model_used: metadata.model || 'gpt-3.5-turbo',
        cost_in_credits: metadata.cost_in_credits || 0,
        message_type: 'api_call'
      });

    if (error) {
      console.error('Erro ao salvar interação IA:', error);
    }
  } catch (error) {
    console.error('Erro ao salvar interação IA:', error);
  }
};
