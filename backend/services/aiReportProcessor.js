/**
 * AI Report Processor - Processamento otimizado de relatórios com IA
 * 
 * Este serviço implementa estratégias avançadas para processar grandes volumes
 * de dados com IA de forma eficiente:
 * - Processamento em chunks (lotes)
 * - Análise incremental
 * - Amostragem inteligente
 * - Agregação de resultados
 */

import { supabase } from '../lib/supabaseClient.js';

export class AIReportProcessor {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 50; // Mensagens por lote
    this.maxContextTokens = options.maxContextTokens || 8000; // Limite de contexto
    this.enableCache = options.enableCache !== false;
    this.parallelProcessing = options.parallelProcessing !== false;
    this.maxParallelChunks = options.maxParallelChunks || 3; // Máximo de chunks processados em paralelo
  }

  /**
   * Método principal: processa mensagens em lotes e agrega resultados
   */
  async processInChunks(messages, analysisType, filters = {}, organizationId) {
    try {
      console.log(`📊 [AI Report Processor] Iniciando processamento de ${messages.length} mensagens`);
      
      // 1. Pré-processar: calcular métricas básicas sem IA
      const basicMetrics = this.calculateBasicMetrics(messages);
      console.log(`✅ [AI Report Processor] Métricas básicas calculadas`);
      
      // 2. Amostragem inteligente: selecionar mensagens mais relevantes
      const sampledMessages = this.intelligentSampling(messages, analysisType);
      console.log(`📊 [AI Report Processor] Amostragem: ${messages.length} → ${sampledMessages.length} mensagens`);
      
      // 3. Dividir em chunks gerenciáveis
      const chunks = this.createChunks(sampledMessages, this.chunkSize);
      console.log(`📦 [AI Report Processor] Dividido em ${chunks.length} lotes de ~${this.chunkSize} mensagens`);
      
      // 4. Processar cada chunk
      const chunkResults = await this.processChunksParallel(chunks, analysisType, filters, organizationId);
      console.log(`✅ [AI Report Processor] ${chunkResults.length} lotes processados`);
      
      // 5. Agregar resultados de forma inteligente
      const aggregatedResult = this.aggregateResults(chunkResults, basicMetrics, analysisType);
      console.log(`🎯 [AI Report Processor] Resultados agregados com sucesso`);
      
      return aggregatedResult;
    } catch (error) {
      console.error('❌ [AI Report Processor] Erro no processamento:', error);
      throw error;
    }
  }

  /**
   * Calcula métricas básicas sem usar IA (rápido e preciso)
   */
  calculateBasicMetrics(messages) {
    const sentMessages = messages.filter(m => m.is_from_me);
    const receivedMessages = messages.filter(m => !m.is_from_me);
    const uniqueChats = new Set(messages.map(m => m.chat_id)).size;
    const uniqueAgents = new Set(messages.map(m => m.chats?.assigned_agent_id).filter(Boolean)).size;
    
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );

    const metrics = {
      totalMessages: messages.length,
      sentMessages: sentMessages.length,
      receivedMessages: receivedMessages.length,
      uniqueChats,
      uniqueAgents,
      dateRange: {
        start: sortedMessages.length > 0 ? sortedMessages[0].created_at : null,
        end: sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].created_at : null
      },
      // Análise de sentimento básica (palavras-chave)
      sentimentDistribution: this.quickSentimentAnalysis(messages),
      // Tópicos mais frequentes (palavras-chave)
      frequentTopics: this.extractFrequentTopics(messages),
      // Métricas de tempo
      averageMessagesPerChat: uniqueChats > 0 ? Math.round(messages.length / uniqueChats) : 0,
      averageMessagesPerAgent: uniqueAgents > 0 ? Math.round(messages.length / uniqueAgents) : 0
    };
    
    return metrics;
  }

  /**
   * Amostragem inteligente: seleciona mensagens mais relevantes para análise
   */
  intelligentSampling(messages, analysisType) {
    // Se temos poucas mensagens, usar todas
    if (messages.length <= 100) {
      return messages;
    }

    // Estratégias de amostragem baseadas no tipo de análise
    switch (analysisType) {
      case 'sentiment':
        // Priorizar mensagens do cliente com palavras-chave de sentimento
        return this.sampleBySentiment(messages);
      
      case 'topics':
        // Priorizar mensagens com conteúdo mais longo e diverso
        return this.sampleByContentDiversity(messages);
      
      case 'ai-analysis':
        // Amostragem estratificada: representar diferentes períodos, agentes, chats
        return this.stratifiedSampling(messages, 300);
      
      default:
        // Amostragem aleatória simples
        return this.randomSample(messages, 200);
    }
  }

  /**
   * Amostragem estratificada: garante representatividade
   */
  stratifiedSampling(messages, targetSize = 200) {
    // Agrupar por chat
    const byChat = new Map();
    messages.forEach(msg => {
      const chatId = msg.chat_id;
      if (!byChat.has(chatId)) {
        byChat.set(chatId, []);
      }
      byChat.get(chatId).push(msg);
    });

    // Selecionar amostras de cada chat proporcionalmente
    const sampled = [];
    const chats = Array.from(byChat.entries());
    const messagesPerChat = Math.ceil(targetSize / chats.length);
    
    chats.forEach(([chatId, chatMessages]) => {
      // Selecionar mensagens representativas do chat
      const chatSample = this.selectRepresentativeMessages(chatMessages, messagesPerChat);
      sampled.push(...chatSample);
    });

    // Se ainda precisar de mais, adicionar mensagens aleatórias
    if (sampled.length < targetSize) {
      const remaining = targetSize - sampled.length;
      const sampledIds = new Set(sampled.map(m => m.id));
      const available = messages.filter(m => !sampledIds.has(m.id));
      const additional = this.randomSample(available, remaining);
      sampled.push(...additional);
    }

    return sampled.slice(0, targetSize);
  }

  /**
   * Seleciona mensagens representativas de um chat
   */
  selectRepresentativeMessages(chatMessages, count) {
    if (chatMessages.length <= count) {
      return chatMessages;
    }

    // Ordenar por data
    const sorted = [...chatMessages].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );

    // Estratégia: primeira, última, e distribuídas no meio
    const selected = [];
    selected.push(sorted[0]); // Primeira
    
    if (sorted.length > 1) {
      selected.push(sorted[sorted.length - 1]); // Última
    }

    // Distribuir mensagens no meio
    const step = Math.max(1, Math.floor(sorted.length / (count - 2)));
    for (let i = step; i < sorted.length - 1 && selected.length < count; i += step) {
      selected.push(sorted[i]);
    }

    // Se ainda faltar, adicionar mensagens mais longas (mais conteúdo)
    if (selected.length < count) {
      const selectedIds = new Set(selected.map(m => m.id));
      const remaining = sorted.filter(m => !selectedIds.has(m.id));
      remaining.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));
      const needed = count - selected.length;
      selected.push(...remaining.slice(0, needed));
    }

    return selected.slice(0, count);
  }

  /**
   * Amostragem por sentimento
   */
  sampleBySentiment(messages, targetSize = 200) {
    const sentimentKeywords = {
      positive: ['obrigado', 'valeu', 'perfeito', 'excelente', 'ótimo', 'muito bom', 'resolvido', 'ajudou', 'satisfeito', 'gostei', 'funcionou'],
      negative: ['ruim', 'péssimo', 'horrível', 'insatisfeito', 'não gostei', 'problema', 'erro', 'falha', 'lento', 'demorado', 'confuso']
    };

    const positive = [];
    const negative = [];
    const neutral = [];

    messages.forEach(msg => {
      if (!msg.is_from_me && msg.content) {
        const lower = msg.content.toLowerCase();
        const hasPositive = sentimentKeywords.positive.some(kw => lower.includes(kw));
        const hasNegative = sentimentKeywords.negative.some(kw => lower.includes(kw));
        
        if (hasPositive && !hasNegative) positive.push(msg);
        else if (hasNegative && !hasPositive) negative.push(msg);
        else neutral.push(msg);
      }
    });

    // Amostrar proporcionalmente
    const samples = [];
    const ratio = targetSize / messages.length;
    samples.push(...this.randomSample(positive, Math.ceil(positive.length * ratio)));
    samples.push(...this.randomSample(negative, Math.ceil(negative.length * ratio)));
    samples.push(...this.randomSample(neutral, Math.ceil(neutral.length * ratio)));

    return samples.slice(0, targetSize);
  }

  /**
   * Amostragem por diversidade de conteúdo
   */
  sampleByContentDiversity(messages, targetSize = 200) {
    // Priorizar mensagens mais longas e diversas
    const sorted = [...messages].sort((a, b) => 
      (b.content?.length || 0) - (a.content?.length || 0)
    );

    // Pegar top mensagens + amostra aleatória
    const topMessages = sorted.slice(0, Math.floor(targetSize * 0.6));
    const randomSample = this.randomSample(sorted.slice(Math.floor(targetSize * 0.6)), Math.floor(targetSize * 0.4));
    
    return [...topMessages, ...randomSample].slice(0, targetSize);
  }

  /**
   * Amostragem aleatória simples
   */
  randomSample(array, size) {
    if (array.length <= size) return array;
    
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  /**
   * Cria chunks de mensagens
   */
  createChunks(messages, chunkSize) {
    const chunks = [];
    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push({
        index: Math.floor(i / chunkSize),
        messages: messages.slice(i, i + chunkSize),
        totalChunks: Math.ceil(messages.length / chunkSize)
      });
    }
    return chunks;
  }

  /**
   * Processa chunks em paralelo (ou sequencial se preferir)
   */
  async processChunksParallel(chunks, analysisType, filters, organizationId) {
    if (this.parallelProcessing && chunks.length > 1) {
      // Processar em paralelo (limitado para não sobrecarregar)
      const results = [];
      
      for (let i = 0; i < chunks.length; i += this.maxParallelChunks) {
        const batch = chunks.slice(i, i + this.maxParallelChunks);
        console.log(`🔄 [AI Report Processor] Processando lote ${i / this.maxParallelChunks + 1} (${batch.length} chunks em paralelo)`);
        
        const batchResults = await Promise.all(
          batch.map(chunk => this.processChunk(chunk, analysisType, filters, organizationId))
        );
        results.push(...batchResults);
      }
      
      return results;
    } else {
      // Processar sequencialmente
      const results = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`🔄 [AI Report Processor] Processando chunk ${i + 1}/${chunks.length}`);
        const result = await this.processChunk(chunks[i], analysisType, filters, organizationId);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * Processa um único chunk com IA
   */
  async processChunk(chunk, analysisType, filters, organizationId) {
    try {
      // Preparar contexto reduzido do chunk
      const chunkContext = this.prepareChunkContext(chunk.messages);
      
      // Criar prompt específico para o chunk
      const prompt = this.createChunkPrompt(chunkContext, analysisType, filters, {
        chunkIndex: chunk.index,
        totalChunks: chunk.totalChunks,
        isPartial: chunk.totalChunks > 1
      });

      // Chamar IA com contexto limitado
      const { generateAIResponse } = await import('./ai/generateAIResponse.js');
      const iaConfig = {
        configuracoes: {
          modelo: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 1500,
          tokens_available: 1000000
        }
      };

      const { respostaIA } = await generateAIResponse(
        prompt,
        "Você é um analista especializado em atendimento ao cliente. Analise este lote de conversas e forneça insights específicos e acionáveis.",
        [],
        iaConfig
      );

      return this.parseChunkResult(respostaIA, chunk);
    } catch (error) {
      console.error(`❌ [AI Report Processor] Erro ao processar chunk ${chunk.index + 1}:`, error);
      return this.createEmptyChunkResult();
    }
  }

  /**
   * Prepara contexto reduzido de um chunk
   */
  prepareChunkContext(messages) {
    // Resumir mensagens do chunk (não enviar todas completas)
    return messages.map(msg => {
      const sender = msg.sender_name || (msg.is_from_me ? 'Agente' : 'Cliente');
      const timestamp = new Date(msg.created_at).toLocaleString('pt-BR');
      const content = msg.content?.substring(0, 300) || ''; // Limitar tamanho
      return `[${timestamp}] ${sender}: ${content}`;
    }).join('\n\n');
  }

  /**
   * Cria prompt otimizado para um chunk
   */
  createChunkPrompt(chunkContext, analysisType, filters, chunkInfo) {
    const isPartial = chunkInfo.isPartial;
    const chunkNote = isPartial 
      ? `\n\nNOTA IMPORTANTE: Este é o lote ${chunkInfo.chunkIndex + 1} de ${chunkInfo.totalChunks}. Foque em identificar padrões e insights específicos deste lote. Seja objetivo e específico.`
      : '';

    const filtersNote = (filters.agents || filters.departments || filters.status) 
      ? `\nFILTROS APLICADOS: ${JSON.stringify(filters)}`
      : '';

    if (analysisType === 'ai-analysis') {
      return `Você é um analista especializado em atendimento ao cliente. Analise este lote de conversas do WhatsApp e forneça insights específicos e acionáveis.

CONVERSAS DO LOTE:
${chunkContext}${filtersNote}

FOCAR EM:
- Padrões específicos identificados neste lote
- Insights operacionais relevantes
- Problemas ou pontos fortes encontrados
- Tópicos principais discutidos
- Sentimento dos clientes

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
{
  "insights": ["insight específico 1", "insight específico 2"],
  "topics": {"tópico identificado": número_ocorrências},
  "sentiment": {"positive": número, "negative": número, "neutral": número},
  "strengths": ["ponto forte identificado"],
  "issues": ["problema identificado"],
  "recommendations": ["recomendação específica"]
}

DIRETRIZES:
- Seja específico e baseie-se apenas nos dados fornecidos
- Não invente informações
- Cite exemplos concretos quando possível
- Foque em insights acionáveis${chunkNote}`;
    }

    if (analysisType === 'sentiment') {
      return `Analise o sentimento dos clientes neste lote de conversas do WhatsApp.

CONVERSAS:
${chunkContext}${filtersNote}

FORMATO (JSON):
{
  "sentiment": {"positive": número, "negative": número, "neutral": número},
  "trends": ["tendência identificada"],
  "clientFeedback": ["feedback específico do cliente"]
}${chunkNote}`;
    }

    if (analysisType === 'topics') {
      return `Identifique os principais tópicos e temas discutidos neste lote de conversas.

CONVERSAS:
${chunkContext}${filtersNote}

FORMATO (JSON):
{
  "topics": {"tópico específico": número_ocorrências}
}

DIRETRIZES:
- Seja específico com os nomes dos tópicos
- Conte ocorrências reais
- Não invente tópicos${chunkNote}`;
    }

    return chunkContext;
  }

  /**
   * Parse do resultado de um chunk
   */
  parseChunkResult(respostaIA, chunk) {
    try {
      const content = respostaIA.content || respostaIA;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          ...parsed,
          chunkIndex: chunk.index
        };
      } else {
        // Tentar extrair informações mesmo sem JSON válido
        return this.extractInfoFromText(content, chunk);
      }
    } catch (error) {
      console.error(`❌ [AI Report Processor] Erro ao parsear resultado do chunk ${chunk.index + 1}:`, error);
      return this.createEmptyChunkResult();
    }
  }

  /**
   * Extrai informações de texto não estruturado
   */
  extractInfoFromText(text, chunk) {
    const result = {
      success: false,
      insights: [],
      topics: {},
      sentiment: { positive: 0, negative: 0, neutral: 0 },
      strengths: [],
      issues: [],
      recommendations: []
    };

    // Tentar extrair insights básicos
    const insightMatches = text.match(/insight[^:]*:?\s*([^\n]+)/gi);
    if (insightMatches) {
      result.insights = insightMatches.map(m => m.replace(/insight[^:]*:?\s*/i, '').trim());
    }

    return result;
  }

  /**
   * Cria resultado vazio para chunk com erro
   */
  createEmptyChunkResult() {
    return {
      success: false,
      insights: [],
      topics: {},
      sentiment: { positive: 0, negative: 0, neutral: 0 },
      strengths: [],
      issues: [],
      recommendations: []
    };
  }

  /**
   * Agrega resultados de múltiplos chunks
   */
  aggregateResults(chunkResults, basicMetrics, analysisType) {
    console.log(`🔄 [AI Report Processor] Agregando ${chunkResults.length} resultados de chunks`);
    
    // Combinar insights de todos os chunks
    const aggregated = {
      insights: [],
      topics: {},
      sentiment: { positive: 0, negative: 0, neutral: 0 },
      strengths: [],
      issues: [],
      recommendations: []
    };

    chunkResults.forEach((result, index) => {
      if (result.success !== false) {
        if (result.insights && Array.isArray(result.insights)) {
          aggregated.insights.push(...result.insights);
        }
        
        if (result.topics && typeof result.topics === 'object') {
          Object.entries(result.topics).forEach(([topic, count]) => {
            aggregated.topics[topic] = (aggregated.topics[topic] || 0) + (Number(count) || 0);
          });
        }
        
        if (result.sentiment && typeof result.sentiment === 'object') {
          aggregated.sentiment.positive += Number(result.sentiment.positive) || 0;
          aggregated.sentiment.negative += Number(result.sentiment.negative) || 0;
          aggregated.sentiment.neutral += Number(result.sentiment.neutral) || 0;
        }
        
        if (result.strengths && Array.isArray(result.strengths)) {
          aggregated.strengths.push(...result.strengths);
        }
        
        if (result.issues && Array.isArray(result.issues)) {
          aggregated.issues.push(...result.issues);
        }
        
        if (result.recommendations && Array.isArray(result.recommendations)) {
          aggregated.recommendations.push(...result.recommendations);
        }
      }
    });

    // Normalizar sentimentos
    const totalSentiment = aggregated.sentiment.positive + aggregated.sentiment.negative + aggregated.sentiment.neutral;
    if (totalSentiment > 0) {
      aggregated.sentiment.positive = Math.round((aggregated.sentiment.positive / totalSentiment) * 100);
      aggregated.sentiment.negative = Math.round((aggregated.sentiment.negative / totalSentiment) * 100);
      aggregated.sentiment.neutral = Math.round((aggregated.sentiment.neutral / totalSentiment) * 100);
    }

    // Remover duplicatas de insights, strengths, issues
    aggregated.insights = [...new Set(aggregated.insights)].slice(0, 20); // Limitar a 20
    aggregated.strengths = [...new Set(aggregated.strengths)].slice(0, 10);
    aggregated.issues = [...new Set(aggregated.issues)].slice(0, 10);
    aggregated.recommendations = [...new Set(aggregated.recommendations)].slice(0, 15);

    // Ordenar tópicos por frequência
    const sortedTopics = Object.entries(aggregated.topics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20) // Top 20 tópicos
      .reduce((acc, [topic, count]) => {
        acc[topic] = count;
        return acc;
      }, {});

    aggregated.topics = sortedTopics;

    // Gerar análise final consolidada se necessário
    if (analysisType === 'ai-analysis' && aggregated.insights.length > 0) {
      aggregated.executiveSummary = this.generateExecutiveSummary(aggregated, basicMetrics);
      aggregated.operationalStrengths = aggregated.strengths.join('. ') || 'Nenhum ponto forte específico identificado.';
      aggregated.criticalImprovementAreas = aggregated.issues.join('. ') || 'Nenhuma área crítica identificada.';
      aggregated.strategicRecommendations = {
        immediate: aggregated.recommendations.slice(0, 3),
        short_term: aggregated.recommendations.slice(3, 6),
        long_term: aggregated.recommendations.slice(6, 9)
      };
      aggregated.trendsAndPatterns = this.generateTrendsText(aggregated, basicMetrics);
    }

    // Combinar com métricas básicas
    return {
      ...basicMetrics,
      aiAnalysis: aggregated,
      sentimentAnalysis: aggregated.sentiment,
      topicAnalysis: aggregated.topics
    };
  }

  /**
   * Gera resumo executivo consolidado
   */
  generateExecutiveSummary(aggregated, basicMetrics) {
    const parts = [];
    
    parts.push(`Análise de ${basicMetrics.totalMessages} mensagens em ${basicMetrics.uniqueChats} conversas.`);
    
    if (basicMetrics.uniqueAgents > 0) {
      parts.push(`${basicMetrics.uniqueAgents} agente(s) envolvido(s).`);
    }
    
    if (aggregated.sentiment) {
      parts.push(`Sentimento geral: ${aggregated.sentiment.positive}% positivo, ${aggregated.sentiment.negative}% negativo, ${aggregated.sentiment.neutral}% neutro.`);
    }
    
    if (Object.keys(aggregated.topics).length > 0) {
      const topTopics = Object.entries(aggregated.topics).slice(0, 3).map(([topic]) => topic);
      parts.push(`Principais tópicos: ${topTopics.join(', ')}.`);
    }
    
    if (aggregated.insights.length > 0) {
      parts.push(`Principais insights: ${aggregated.insights.slice(0, 3).join('; ')}.`);
    }
    
    return parts.join(' ');
  }

  /**
   * Gera texto de tendências
   */
  generateTrendsText(aggregated, basicMetrics) {
    const trends = [];
    
    if (aggregated.sentiment) {
      if (aggregated.sentiment.positive > 60) {
        trends.push('Tendência positiva no sentimento dos clientes');
      } else if (aggregated.sentiment.negative > 40) {
        trends.push('Atenção necessária: alto índice de sentimento negativo');
      }
    }
    
    if (Object.keys(aggregated.topics).length > 0) {
      const topTopic = Object.entries(aggregated.topics)[0];
      trends.push(`Tópico mais frequente: ${topTopic[0]} (${topTopic[1]} ocorrências)`);
    }
    
    if (aggregated.issues.length > 0) {
      trends.push(`${aggregated.issues.length} área(s) crítica(s) identificada(s) requerendo atenção`);
    }
    
    return trends.length > 0 ? trends.join('. ') : 'Tendências não identificadas nos dados fornecidos.';
  }

  /**
   * Análise rápida de sentimento baseada em palavras-chave
   */
  quickSentimentAnalysis(messages) {
    const positiveKeywords = ['obrigado', 'valeu', 'perfeito', 'excelente', 'ótimo', 'muito bom', 'resolvido', 'ajudou', 'satisfeito', 'gostei', 'funcionou', 'claro', 'entendi', 'top', 'show', 'legal', 'bom', 'bem', 'certo', 'sim', 'concordo', 'exato', 'preciso'];
    const negativeKeywords = ['ruim', 'péssimo', 'horrível', 'insatisfeito', 'não gostei', 'problema', 'erro', 'falha', 'lento', 'demorado', 'confuso', 'difícil', 'não funciona', 'não entendo', 'não consigo', 'não deu certo', 'frustrado', 'irritado', 'chateado', 'decepcionado'];
    
    let pos = 0, neg = 0, neu = 0;
    
    messages.forEach(msg => {
      if (!msg.is_from_me && msg.content) {
        const lower = msg.content.toLowerCase();
        const hasPositive = positiveKeywords.some(p => lower.includes(p));
        const hasNegative = negativeKeywords.some(n => lower.includes(n));
        
        if (hasPositive && !hasNegative) pos++;
        else if (hasNegative && !hasPositive) neg++;
        else neu++;
      }
    });
    
    const total = pos + neg + neu;
    return {
      positive: total > 0 ? Math.round((pos / total) * 100) : 0,
      negative: total > 0 ? Math.round((neg / total) * 100) : 0,
      neutral: total > 0 ? Math.round((neu / total) * 100) : 0
    };
  }

  /**
   * Extrai tópicos frequentes por palavras-chave
   */
  extractFrequentTopics(messages) {
    const topics = {};
    const keywordTopics = {
      'venda': 'Vendas',
      'compra': 'Vendas',
      'preço': 'Vendas',
      'cotação': 'Vendas',
      'pagamento': 'Financeiro',
      'conta': 'Financeiro',
      'cobrança': 'Financeiro',
      'boleto': 'Financeiro',
      'problema': 'Suporte Técnico',
      'erro': 'Suporte Técnico',
      'bug': 'Suporte Técnico',
      'não funciona': 'Suporte Técnico',
      'atendimento': 'Atendimento',
      'suporte': 'Atendimento',
      'ajuda': 'Atendimento',
      'reclamação': 'Reclamações',
      'insatisfeito': 'Reclamações',
      'cancelamento': 'Cancelamentos',
      'cancelar': 'Cancelamentos',
      'entrega': 'Logística',
      'envio': 'Logística',
      'frete': 'Logística'
    };

    messages.forEach(msg => {
      if (msg.content) {
        const lower = msg.content.toLowerCase();
        Object.entries(keywordTopics).forEach(([keyword, topic]) => {
          if (lower.includes(keyword)) {
            topics[topic] = (topics[topic] || 0) + 1;
          }
        });
      }
    });

    return topics;
  }
}

