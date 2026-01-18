import OpenAI from 'openai';
import { supabase } from '../lib/supabaseClient.js';

/**
 * Serviço de IA para campanhas inteligentes
 * Suporta OpenAI e DeepSeek
 */
export class AIService {
  
  static openaiClient = null;
  static deepseekClient = null;

  /**
   * Inicializa clientes de IA
   */
  static initialize() {
    try {
      // Cliente OpenAI (prioridade 1)
      if (process.env.OPENAI_API_KEY) {
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✅ Cliente OpenAI inicializado');
      }

      // Cliente ChatGPT (fallback para OpenAI)
      if (!this.openaiClient && process.env.CHATGPT_API_KEY) {
        this.openaiClient = new OpenAI({
          apiKey: process.env.CHATGPT_API_KEY
        });
        console.log('✅ Cliente ChatGPT inicializado como fallback');
      }

      // Cliente DeepSeek
      if (process.env.DEEPSEEK_API_KEY) {
        this.deepseekClient = new OpenAI({
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseURL: 'https://api.deepseek.com'
        });
        console.log('✅ Cliente DeepSeek inicializado');
      }

      if (!this.openaiClient && !this.deepseekClient) {
        console.warn('⚠️ Nenhuma chave de API de IA configurada (OPENAI_API_KEY, CHATGPT_API_KEY ou DEEPSEEK_API_KEY)');
      }

    } catch (error) {
      console.error('❌ Erro ao inicializar serviços de IA:', error);
    }
  }

  /**
   * Obtém cliente de IA preferencial
   */
  static getClient() {
    // Priorizar DeepSeek por custo-benefício
    return this.deepseekClient || this.openaiClient;
  }

  /**
   * Processa texto genérico com IA
   */
  static async processarTexto(prompt, maxTokens = 150) {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Nenhum cliente de IA disponível');
      }

      const response = await client.chat.completions.create({
        model: this.deepseekClient ? 'deepseek-chat' : 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especializado em comunicação empresarial via WhatsApp. Seja conciso, profissional e empático.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content?.trim() || null;

    } catch (error) {
      console.error('❌ Erro no processamento de texto com IA:', error);
      return null;
    }
  }

  /**
   * Personaliza mensagem baseada no histórico do cliente
   */
  static async personalizarMensagem(mensagemOriginal, contato, historico = []) {
    try {
      const contextoHistorico = historico.length > 0 
        ? historico.map(h => `${h.is_from_user ? 'Cliente' : 'Atendente'}: ${h.content}`).join('\n')
        : 'Nenhum histórico disponível';

      const prompt = `
        Personalize esta mensagem de campanha para o cliente, mantendo a essência mas adaptando o tom:

        Mensagem original: "${mensagemOriginal}"
        
        Cliente: ${contato.name || 'Cliente'}
        
        Histórico recente:
        ${contextoHistorico}
        
        Instruções:
        - Mantenha o objetivo da mensagem original
        - Adapte o tom baseado no histórico (formal/informal)
        - Use o nome do cliente naturalmente
        - Máximo 280 caracteres
        - Seja empático e profissional
        - Responda apenas com a mensagem personalizada, sem explicações
      `;

      const mensagemPersonalizada = await this.processarTexto(prompt, 100);
      
      // Fallback para mensagem original se a IA falhar
      return mensagemPersonalizada || mensagemOriginal;

    } catch (error) {
      console.error('❌ Erro na personalização de mensagem:', error);
      return mensagemOriginal;
    }
  }

  /**
   * Gera resumo de uma resposta do cliente
   */
  static async gerarResumo(resposta) {
    try {
      if (!resposta || resposta.length < 10) {
        return 'Resposta muito curta';
      }

      const prompt = `
        Resuma esta resposta de cliente em até 100 caracteres, focando na intenção principal:
        
        Resposta: "${resposta}"
        
        Instruções:
        - Seja objetivo e claro
        - Identifique a intenção principal
        - Use linguagem profissional
        - Máximo 100 caracteres
        - Responda apenas com o resumo
      `;

      const resumo = await this.processarTexto(prompt, 50);
      
      return resumo || 'Resposta recebida';

    } catch (error) {
      console.error('❌ Erro ao gerar resumo:', error);
      return 'Erro ao processar resposta';
    }
  }

  /**
   * Analisa sentimento de uma resposta
   */
  static async analisarSentimento(resposta) {
    try {
      if (!resposta || resposta.length < 5) {
        return 'neutro';
      }

      const prompt = `
        Analise o sentimento desta resposta de cliente e classifique como: positivo, neutro ou negativo
        
        Resposta: "${resposta}"
        
        Instruções:
        - Considere o contexto empresarial
        - Positivo: satisfação, interesse, aprovação
        - Neutro: informativo, questionamento neutro
        - Negativo: insatisfação, reclamação, rejeição
        - Responda apenas com: positivo, neutro ou negativo
      `;

      const sentimento = await this.processarTexto(prompt, 10);
      
      // Validar resposta
      const sentimentosValidos = ['positivo', 'neutro', 'negativo'];
      const sentimentoLimpo = sentimento?.toLowerCase().trim();
      
      return sentimentosValidos.includes(sentimentoLimpo) ? sentimentoLimpo : 'neutro';

    } catch (error) {
      console.error('❌ Erro na análise de sentimento:', error);
      return 'neutro';
    }
  }

  /**
   * Sugere melhorias para um template
   */
  static async sugerirMelhorias(template, estatisticas = null) {
    try {
      const contextoEstatisticas = estatisticas 
        ? `Taxa de resposta atual: ${estatisticas.taxa_resposta}%`
        : 'Sem estatísticas disponíveis';

      const prompt = `
        Analise este template de campanha e sugira melhorias para aumentar o engajamento:
        
        Template atual: "${template}"
        
        ${contextoEstatisticas}
        
        Instruções:
        - Sugira melhorias específicas
        - Foque em aumentar taxa de resposta
        - Mantenha tom profissional
        - Considere boas práticas de WhatsApp Business
        - Máximo 300 caracteres por sugestão
        - Forneça 2-3 sugestões práticas
      `;

      const sugestoes = await this.processarTexto(prompt, 200);
      
      return sugestoes || 'Nenhuma sugestão disponível no momento';

    } catch (error) {
      console.error('❌ Erro ao gerar sugestões:', error);
      return 'Erro ao gerar sugestões';
    }
  }

  /**
   * Detecta intenção em uma resposta do cliente
   */
  static async detectarIntencao(resposta) {
    try {
      const prompt = `
        Identifique a intenção principal desta resposta de cliente:
        
        Resposta: "${resposta}"
        
        Possíveis intenções:
        - interesse: cliente demonstra interesse no produto/serviço
        - duvida: cliente tem dúvidas ou precisa de mais informações
        - reclamacao: cliente está insatisfeito ou reclamando
        - agendamento: cliente quer agendar algo
        - compra: cliente quer comprar ou contratar
        - cancelamento: cliente quer cancelar algo
        - outro: outras intenções
        
        Responda apenas com a intenção identificada
      `;

      const intencao = await this.processarTexto(prompt, 20);
      
      const intencoesValidas = [
        'interesse', 'duvida', 'reclamacao', 
        'agendamento', 'compra', 'cancelamento', 'outro'
      ];
      
      const intencaoLimpa = intencao?.toLowerCase().trim();
      
      return intencoesValidas.includes(intencaoLimpa) ? intencaoLimpa : 'outro';

    } catch (error) {
      console.error('❌ Erro na detecção de intenção:', error);
      return 'outro';
    }
  }

  /**
   * Gera relatório inteligente de campanha
   */
  static async gerarRelatorioInteligente(campanhaId) {
    try {
      // Buscar dados da campanha
      const { data: campanha } = await supabase
        .from('campanhas')
        .select(`
          *,
          template:campanha_templates(nome, conteudo)
        `)
        .eq('id', campanhaId)
        .single();

      if (!campanha) {
        throw new Error('Campanha não encontrada');
      }

      // Buscar estatísticas dos contatos
      const { data: contatos } = await supabase
        .from('campanha_contatos')
        .select('status, sentimento_ia, resumo_ia, resposta_cliente')
        .eq('campanha_id', campanhaId);

      if (!contatos) {
        throw new Error('Dados dos contatos não encontrados');
      }

      // Calcular métricas
      const total = contatos.length;
      const enviados = contatos.filter(c => ['enviado', 'respondido'].includes(c.status)).length;
      const respondidos = contatos.filter(c => c.status === 'respondido').length;
      const taxaResposta = enviados > 0 ? ((respondidos / enviados) * 100).toFixed(1) : 0;

      // Análise de sentimentos
      const sentimentos = contatos.filter(c => c.sentimento_ia);
      const positivos = sentimentos.filter(c => c.sentimento_ia === 'positivo').length;
      const negativos = sentimentos.filter(c => c.sentimento_ia === 'negativo').length;

      // Principais respostas
      const respostasSignificativas = contatos
        .filter(c => c.resposta_cliente && c.resposta_cliente.length > 20)
        .slice(0, 5)
        .map(c => c.resposta_cliente);

      const prompt = `
        Gere um relatório inteligente desta campanha de WhatsApp:
        
        DADOS DA CAMPANHA:
        - Nome: ${campanha.nome}
        - Template: "${campanha.template?.conteudo}"
        - Total de contatos: ${total}
        - Mensagens enviadas: ${enviados}
        - Respostas recebidas: ${respondidos}
        - Taxa de resposta: ${taxaResposta}%
        - Sentimentos positivos: ${positivos}
        - Sentimentos negativos: ${negativos}
        
        PRINCIPAIS RESPOSTAS:
        ${respostasSignificativas.join('\n')}
        
        Instruções:
        - Analise o desempenho da campanha
        - Identifique pontos fortes e fracos
        - Sugira melhorias específicas
        - Seja objetivo e actionável
        - Máximo 500 palavras
        - Use linguagem profissional
      `;

      const relatorio = await this.processarTexto(prompt, 300);
      
      return relatorio || 'Relatório não disponível';

    } catch (error) {
      console.error('❌ Erro ao gerar relatório inteligente:', error);
      return 'Erro ao gerar relatório';
    }
  }

  /**
   * Valida e aprova template automaticamente
   */
  static async validarTemplate(conteudo) {
    try {
      const prompt = `
        Analise este template de mensagem para WhatsApp Business e identifique possíveis problemas:
        
        Template: "${conteudo}"
        
        Verifique:
        - Compliance com políticas do WhatsApp
        - Tom profissional apropriado
        - Clareza da mensagem
        - Presença de spam indicators
        - Uso adequado de emojis
        - Tamanho apropriado
        
        Responda com:
        - APROVADO: se o template está adequado
        - REJEITADO: [motivo específico] se há problemas
      `;

      const validacao = await this.processarTexto(prompt, 100);
      
      if (!validacao) {
        return { aprovado: false, motivo: 'Erro na validação' };
      }

      const aprovado = validacao.toLowerCase().includes('aprovado');
      const motivo = aprovado ? null : validacao.replace(/rejeitado:?\s*/i, '').trim();

      return { aprovado, motivo };

    } catch (error) {
      console.error('❌ Erro na validação de template:', error);
      return { aprovado: false, motivo: 'Erro no sistema de validação' };
    }
  }

  /**
   * Otimiza horário de envio baseado em dados históricos
   */
  static async otimizarHorarioEnvio(organizationId) {
    try {
      // Buscar histórico de respostas por horário
      const { data: mensagens } = await supabase
        .from('messages')
        .select('created_at, is_from_user')
        .eq('organization_id', organizationId)
        .eq('is_from_user', true)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // últimos 30 dias
        .limit(1000);

      if (!mensagens || mensagens.length < 50) {
        return {
          melhor_horario: '10:00',
          melhor_dia: 'terça-feira',
          confianca: 'baixa'
        };
      }

      // Agrupar por hora e dia da semana
      const respostasPorHora = {};
      const respostasPorDia = {};

      mensagens.forEach(msg => {
        const data = new Date(msg.created_at);
        const hora = data.getHours();
        const dia = data.getDay(); // 0 = domingo, 1 = segunda, etc.

        respostasPorHora[hora] = (respostasPorHora[hora] || 0) + 1;
        respostasPorDia[dia] = (respostasPorDia[dia] || 0) + 1;
      });

      // Encontrar melhor horário e dia
      const melhorHora = Object.keys(respostasPorHora)
        .reduce((a, b) => respostasPorHora[a] > respostasPorHora[b] ? a : b);

      const melhorDia = Object.keys(respostasPorDia)
        .reduce((a, b) => respostasPorDia[a] > respostasPorDia[b] ? a : b);

      const diasSemana = [
        'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
        'quinta-feira', 'sexta-feira', 'sábado'
      ];

      return {
        melhor_horario: `${melhorHora}:00`,
        melhor_dia: diasSemana[melhorDia],
        confianca: mensagens.length > 200 ? 'alta' : 'média',
        dados_analisados: mensagens.length
      };

    } catch (error) {
      console.error('❌ Erro na otimização de horário:', error);
      return {
        melhor_horario: '10:00',
        melhor_dia: 'terça-feira',
        confianca: 'baixa'
      };
    }
  }
}

// Inicializar serviço
AIService.initialize();

export default AIService;
