import { supabase } from '../lib/supabaseClient.js';
import { AIService } from './aiService.js';
import { sendMessageByAccount, sendImageByAccount, sendDocumentByAccount, sendAudioByAccount } from './multiWhatsapp.js';
import path from 'path';
import fs from 'fs';

/**
 * Serviço principal para processamento de campanhas inteligentes
 */
export class CampanhaService {
  
  // Rate limits por organização (mensagens por minuto)
  static rateLimits = new Map();
  
  // Campanhas em processamento
  static processandoCampanhas = new Set();

  /**
   * Processa uma campanha completa
   */
  static async processarCampanha(campanhaId) {
    try {
      console.log(`🚀 Iniciando processamento da campanha ${campanhaId}`);

      // Evitar processamento duplicado
      if (this.processandoCampanhas.has(campanhaId)) {
        console.log(`⚠️ Campanha ${campanhaId} já está sendo processada`);
        return;
      }

      this.processandoCampanhas.add(campanhaId);

      // Buscar dados da campanha
      const { data: campanha, error: campanhaError } = await supabase
        .from('campanhas')
        .select(`
          *,
          template:campanha_templates(id, nome, conteudo, variaveis),
          remetentes:campanha_remetentes(
            id,
            usuario_id,
            numero_whatsapp,
            ativo,
            usuario:profiles(id, name, email)
          )
        `)
        .eq('id', campanhaId)
        .single();

      if (campanhaError || !campanha) {
        throw new Error(`Campanha não encontrada: ${campanhaError?.message}`);
      }

      // Verificar se a campanha ainda pode ser processada
      if (!['em_execucao'].includes(campanha.status)) {
        console.log(`⚠️ Campanha ${campanhaId} não está em execução (status: ${campanha.status})`);
        return;
      }

      // Buscar contatos pendentes
      const { data: contatosPendentes, error: contatosError } = await supabase
        .from('campanha_contatos')
        .select('*')
        .eq('campanha_id', campanhaId)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true });

      if (contatosError) {
        throw new Error(`Erro ao buscar contatos: ${contatosError.message}`);
      }

      if (!contatosPendentes || contatosPendentes.length === 0) {
        console.log(`✅ Campanha ${campanhaId} finalizada - nenhum contato pendente`);
        await this.finalizarCampanha(campanhaId);
        return;
      }

      console.log(`📊 Processando ${contatosPendentes.length} contatos pendentes`);

      // Obter números ativos dos remetentes
      const numerosAtivos = await this.obterNumerosAtivos(campanha.organization_id, campanha.remetentes);
      
      if (numerosAtivos.length === 0) {
        throw new Error('Nenhum número ativo encontrado para envio');
      }

      console.log(`📱 ${numerosAtivos.length} números ativos disponíveis`);

      // ✅ MELHORADO: Configurações de rate limit mais conservadoras para evitar banimentos
      const rateLimitConfig = campanha.configuracoes?.rate_limit || {
        mensagens_por_minuto: 20, // ✅ REDUZIDO: 20 msg/min (antes: 30)
        intervalo_entre_mensagens: 4000 // ✅ AUMENTADO: 4 segundos (antes: 2s)
      };

      // Processar contatos em lotes
      let contatoIndex = 0;
      for (const contatoCampanha of contatosPendentes) {
        // Verificar se a campanha ainda está ativa
        const { data: statusAtual } = await supabase
          .from('campanhas')
          .select('status')
          .eq('id', campanhaId)
          .single();

        if (statusAtual?.status === 'pausada') {
          console.log(`⏸️ Campanha ${campanhaId} foi pausada`);
          break;
        }

        if (!['em_execucao'].includes(statusAtual?.status)) {
          console.log(`⏹️ Campanha ${campanhaId} foi interrompida (status: ${statusAtual?.status})`);
          break;
        }

        // Selecionar remetente (distribuição round-robin)
        const remetenteAtual = numerosAtivos[contatoIndex % numerosAtivos.length];
        
        try {
          await this.enviarMensagemContato(
            campanha,
            contatoCampanha,
            remetenteAtual,
            rateLimitConfig
          );

          // Aguardar intervalo entre mensagens
          await this.delay(rateLimitConfig.intervalo_entre_mensagens);

        } catch (error) {
          console.error(`❌ Erro ao enviar para contato ${contatoCampanha.contato.name}:`, error);
          
          // Marcar como erro
          await supabase
            .from('campanha_contatos')
            .update({
              status: 'erro',
              erro_detalhes: error.message
            })
            .eq('id', contatoCampanha.id);
        }

        contatoIndex++;
      }

      // Verificar se a campanha foi finalizada
      const { data: contatosRestantes } = await supabase
        .from('campanha_contatos')
        .select('id')
        .eq('campanha_id', campanhaId)
        .eq('status', 'pendente');

      if (!contatosRestantes || contatosRestantes.length === 0) {
        await this.finalizarCampanha(campanhaId);
      }

      console.log(`✅ Processamento da campanha ${campanhaId} concluído`);

    } catch (error) {
      console.error(`❌ Erro no processamento da campanha ${campanhaId}:`, error);
      
      // Marcar campanha como erro
      await supabase
        .from('campanhas')
        .update({
          status: 'erro',
          data_fim: new Date().toISOString()
        })
        .eq('id', campanhaId);

      // Log do erro
      await supabase.from('campanha_logs').insert({
        campanha_id: campanhaId,
        usuario_id: null,
        acao: 'erro_processamento',
        detalhes: { erro: error.message }
      });

    } finally {
      this.processandoCampanhas.delete(campanhaId);
    }
  }

  /**
   * Envia mensagem para um contato específico
   */
  static async enviarMensagemContato(campanha, contatoCampanha, remetente, rateLimitConfig) {
    try {
      // Dados do contato já estão na tabela campanha_contatos
      const contato = {
        name: contatoCampanha.contato_nome,
        phone: contatoCampanha.contato_telefone,
        id: contatoCampanha.contato_id
      };
      
      // Renderizar mensagem com dados do contato ou usar mensagem direta
      let mensagem = '';
      if (campanha.template && campanha.template.conteudo) {
        mensagem = this.renderizarMensagem(campanha.template.conteudo, contato);
      } else if (campanha.configuracoes?.message_content) {
        mensagem = campanha.configuracoes.message_content;
      } else {
        throw new Error('Nenhuma mensagem definida para a campanha');
      }

      // Personalizar com IA se ativado
      if (campanha.usar_ia) {
        mensagem = await this.personalizarMensagemComIA(mensagem, contato, campanha);
      }

      // Obter arquivos de mídia se existirem
      const mediaFiles = campanha.configuracoes?.media_files || [];

      // Enviar via WhatsApp (Baileys)
      const resultadoEnvio = await this.enviarViaWhatsApp(
        remetente.numero,
        contato.phone,
        mensagem,
        campanha.organization_id,
        mediaFiles,
        remetente.account_id
      );

      if (!resultadoEnvio.success) {
        throw new Error(resultadoEnvio.error);
      }

      // Atualizar status do contato
      await supabase
        .from('campanha_contatos')
        .update({
          status: 'enviado',
          enviado_por: remetente.usuario_id,
          mensagem_enviada: mensagem,
          enviado_em: new Date().toISOString(),
          contato_nome: contato.name || contatoCampanha.contato_nome,
          contato_telefone: contato.phone || contatoCampanha.contato_telefone
        })
        .eq('id', contatoCampanha.id);

      // Atualizar contador do remetente
      await supabase
        .from('campanha_remetentes')
        .update({
          mensagens_enviadas: remetente.mensagens_enviadas + 1,
          ultima_mensagem: new Date().toISOString()
        })
        .eq('id', remetente.id);

      // ✅ ATUALIZAR CONTADORES NA TABELA CAMPANHAS após envio
      const { data: statsAposEnvio } = await supabase
        .from('campanha_contatos')
        .select('status')
        .eq('campanha_id', campanha.id);

      if (statsAposEnvio) {
        const enviados = statsAposEnvio.filter(s => s.status === 'enviado' || s.status === 'respondido').length;
        const respondidos = statsAposEnvio.filter(s => s.status === 'respondido').length;

        await supabase
          .from('campanhas')
          .update({
            enviados: enviados,
            respondidos: respondidos
          })
          .eq('id', campanha.id);

        console.log(`✅ [CampanhaService] Contadores atualizados após envio: enviados=${enviados}, respondidos=${respondidos}`);
      }

      console.log(`✅ Mensagem enviada para ${contato.name} via ${remetente.numero}`);

      // Emitir evento via Socket.IO se disponível
      if (global.io) {
        global.io.to(`org_${campanha.organization_id}`).emit('campanha_mensagem_enviada', {
          campanha_id: campanha.id,
          contato_id: contato.id,
          contato_nome: contato.name,
          remetente: remetente.numero
        });
      }

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${contatoCampanha.contato_nome}:`, error);
      throw error;
    }
  }

  /**
   * Renderiza mensagem substituindo placeholders
   */
  static renderizarMensagem(template, contato) {
    let mensagem = template;

    // Substituições básicas
    const substituicoes = {
      nome: contato.name || 'Cliente',
      telefone: contato.phone || '',
      email: contato.email || ''
    };

    // Adicionar campos customizados se existirem
    if (contato.custom_fields) {
      Object.assign(substituicoes, contato.custom_fields);
    }

    // Aplicar substituições
    for (const [chave, valor] of Object.entries(substituicoes)) {
      const regex = new RegExp(`\\{${chave}\\}`, 'gi');
      mensagem = mensagem.replace(regex, valor);
    }

    return mensagem;
  }

  /**
   * Personaliza mensagem usando IA
   */
  static async personalizarMensagemComIA(mensagem, contato, campanha) {
    try {
      // Buscar histórico de conversas do contato para contexto
      const { data: historicoMensagens } = await supabase
        .from('messages')
        .select('content, is_from_user')
        .eq('contact_id', contato.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const contexto = historicoMensagens?.map(m => 
        `${m.is_from_user ? 'Cliente' : 'Atendente'}: ${m.content}`
      ).join('\n') || '';

      const prompt = `
        Personalize esta mensagem de campanha para o cliente, mantendo o tom profissional mas adaptando ao contexto:
        
        Mensagem original: ${mensagem}
        
        Nome do cliente: ${contato.name}
        
        Histórico recente de conversas:
        ${contexto}
        
        Instruções:
        - Mantenha a essência da mensagem original
        - Adapte o tom baseado no histórico (mais formal/informal)
        - Não altere informações factuais
        - Máximo 300 caracteres
        - Responda apenas com a mensagem personalizada
      `;

      const mensagemPersonalizada = await AIService.processarTexto(prompt);
      
      return mensagemPersonalizada || mensagem; // Fallback para mensagem original

    } catch (error) {
      console.error('❌ Erro na personalização com IA:', error);
      return mensagem; // Retorna mensagem original em caso de erro
    }
  }

  /**
   * Envia mensagem via WhatsApp usando Baileys
   */
  static async enviarViaWhatsApp(numeroRemetente, numeroDestino, mensagem, organizationId, mediaFiles = [], accountId = null) {
    try {
      // ✅ CORREÇÃO: Usar sistema multiWhatsapp.js em vez do sistema antigo
      const { sendMessageByAccount } = await import('./multiWhatsapp.js');
      
      // ✅ CORREÇÃO: Obter account_id se não fornecido
      if (!accountId) {
        const { data: account } = await supabase
          .from('whatsapp_accounts')
          .select('account_id')
          .eq('phone_number', numeroRemetente)
          .eq('organization_id', organizationId)
          .eq('status', 'connected')
          .single();
        
        if (!account) {
          throw new Error(`Conta WhatsApp não encontrada para o número ${numeroRemetente}`);
        }
        
        accountId = account.account_id;
      }
      
      console.log(`📱 Enviando via conta ${accountId} (${numeroRemetente})`);
      
      // Formatar número de destino
      const numeroFormatado = this.formatarNumeroWhatsApp(numeroDestino);
      
      // ✅ CORREÇÃO: Aguardar um pouco para conexão estar pronta
      console.log('⏳ Aguardando conexão estar pronta...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar 3 segundos
      
      // Enviar mensagem de texto
      const temMidias = Array.isArray(mediaFiles) && mediaFiles.length > 0;
      if (!temMidias && mensagem && mensagem.trim()) {
        const resultadoTexto = await sendMessageByAccount(accountId, numeroFormatado, mensagem);
        
        // ✅ CORREÇÃO: Se está reconectando, aguardar mais tempo
        if (!resultadoTexto.success && resultadoTexto.reconnecting) {
          console.log('🔄 Conta está reconectando, aguardando mais tempo...');
          await new Promise(resolve => setTimeout(resolve, 10000)); // Aguardar mais 10 segundos
          
          // Tentar novamente
          const resultadoRetry = await sendMessageByAccount(accountId, numeroFormatado, mensagem);
          if (!resultadoRetry.success) {
            throw new Error(resultadoRetry.error);
          }
          
          console.log(`✅ Mensagem enviada via conta ${accountId} (retry):`, resultadoRetry.whatsapp_message_id);
        } else if (!resultadoTexto.success) {
          throw new Error(resultadoTexto.error);
        } else {
          console.log(`✅ Mensagem enviada via conta ${accountId}:`, resultadoTexto.whatsapp_message_id);
        }
      }
      
      // Enviar arquivos de mídia se existirem
      if (temMidias) {
        // Enviar mídias: apenas a primeira recebe legenda; as demais sem legenda para agrupar como álbum
        for (let idx = 0; idx < mediaFiles.length; idx++) {
          const mediaFile = mediaFiles[idx];
          try {
            // Resolver caminho do arquivo de forma robusta
            const candidates = [];
            if (mediaFile.path) {
              candidates.push(mediaFile.path); // caminho absoluto do Multer
              // se veio como "/uploads/...", transformar em absoluto baseado no cwd
              if (mediaFile.path.startsWith('/uploads/')) {
                candidates.push(path.join(process.cwd(), mediaFile.path.replace(/^\/+/, '')));
              }
            }
            if (mediaFile.localPath) {
              candidates.push(mediaFile.localPath.startsWith('/')
                ? mediaFile.localPath
                : path.join(process.cwd(), mediaFile.localPath)
              );
            }

            // Selecionar o primeiro arquivo existente
            let filePath = null;
            for (const c of candidates) {
              if (c && fs.existsSync(c)) { filePath = c; break; }
            }
            // Fallback: se enviaram url relativa "/uploads/campanhas/xxx", montar absoluto
            if (!filePath && mediaFile.url && mediaFile.url.startsWith('/uploads/')) {
              const abs = path.join(process.cwd(), mediaFile.url.replace(/^\/+/, ''));
              if (fs.existsSync(abs)) filePath = abs;
            }

            if (!filePath) {
              console.warn(`⚠️ Arquivo não encontrado para mídia:`, mediaFile);
              throw new Error('Arquivo de mídia não encontrado no servidor');
            }

            // Legenda somente na primeira mídia
            const captionForThisMedia = idx === 0 ? (mensagem || '') : '';

            // Enviar baseado no tipo
            let resultadoMidia;
            switch (mediaFile.type) {
              case 'image':
                resultadoMidia = await sendImageByAccount(accountId, numeroFormatado, filePath, captionForThisMedia);
                break;
              case 'document':
                resultadoMidia = await sendDocumentByAccount(accountId, numeroFormatado, filePath, mediaFile.type, mediaFile.name, captionForThisMedia);
                break;
              case 'audio':
                resultadoMidia = await sendAudioByAccount(accountId, numeroFormatado, filePath, mediaFile.type, captionForThisMedia);
                break;
              case 'video':
                // Para vídeos, usar sendDocumentByAccount por enquanto
                resultadoMidia = await sendDocumentByAccount(accountId, numeroFormatado, filePath, mediaFile.type, mediaFile.name, captionForThisMedia);
                break;
              default:
                // Para outros tipos, tratar como documento
                resultadoMidia = await sendDocumentByAccount(accountId, numeroFormatado, filePath, mediaFile.type, mediaFile.name, captionForThisMedia);
            }
            
            if (!resultadoMidia.success) {
              console.error(`❌ Erro ao enviar ${mediaFile.name}:`, resultadoMidia.error);
              throw new Error(`Erro ao enviar arquivo ${mediaFile.name}: ${resultadoMidia.error}`);
            }
            
            console.log(`✅ Arquivo ${mediaFile.name} enviado com sucesso`);
            
            // Pequeno intervalo para preservar ordem sem quebrar o agrupamento do WhatsApp
            await new Promise(resolve => setTimeout(resolve, 150));
            
          } catch (error) {
            console.error(`❌ Erro ao processar arquivo ${mediaFile.name}:`, error);
            throw new Error(`Erro ao enviar arquivo ${mediaFile.name}: ${error.message}`);
          }
        }
      }
      
      return {
        success: true,
        messageId: 'bulk_message_sent'
      };

    } catch (error) {
      console.error('❌ Erro ao enviar via WhatsApp:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Formata número para WhatsApp
   */
  static formatarNumeroWhatsApp(numero) {
    // Remove caracteres não numéricos
    const numeroLimpo = numero.replace(/\D/g, '');
    
    // Adiciona código do país se necessário (Brasil = 55)
    if (numeroLimpo.length === 11 && numeroLimpo.startsWith('11')) {
      return `55${numeroLimpo}@s.whatsapp.net`;
    } else if (numeroLimpo.length === 10) {
      return `55${numeroLimpo}@s.whatsapp.net`;
    } else if (numeroLimpo.length === 13 && numeroLimpo.startsWith('55')) {
      return `${numeroLimpo}@s.whatsapp.net`;
    }
    
    return `${numeroLimpo}@s.whatsapp.net`;
  }

  /**
   * Obtém números ativos para envio
   */
  static async obterNumerosAtivos(organizationId, remetentes) {
    try {
      const numerosAtivos = [];

      for (const remetente of remetentes) {
        if (!remetente.ativo) continue;

        // Verificar se o usuário tem conexão ativa no WhatsApp
        const { data: conexao } = await supabase
          .from('whatsapp_accounts')
          .select('phone_number, status, account_id')
          .eq('user_id', remetente.usuario_id)
          .eq('organization_id', organizationId)
          .eq('status', 'connected')
          .single();

        if (conexao) {
          numerosAtivos.push({
            ...remetente,
            numero: conexao.phone_number,
            account_id: conexao.account_id
          });
        }
      }

      return numerosAtivos;

    } catch (error) {
      console.error('❌ Erro ao obter números ativos:', error);
      return [];
    }
  }

  /**
   * Finaliza uma campanha
   */
  static async finalizarCampanha(campanhaId) {
    try {
      await supabase
        .from('campanhas')
        .update({
          status: 'finalizada',
          data_fim: new Date().toISOString()
        })
        .eq('id', campanhaId);

      // Log da finalização
      await supabase.from('campanha_logs').insert({
        campanha_id: campanhaId,
        usuario_id: null,
        acao: 'campanha_finalizada',
        detalhes: { data_fim: new Date().toISOString() }
      });

      console.log(`✅ Campanha ${campanhaId} finalizada`);

      // Emitir evento via Socket.IO
      if (global.io) {
        const { data: campanha } = await supabase
          .from('campanhas')
          .select('organization_id, nome')
          .eq('id', campanhaId)
          .single();

        if (campanha) {
          global.io.to(`org_${campanha.organization_id}`).emit('campanha_finalizada', {
            campanha_id: campanhaId,
            nome: campanha.nome
          });
        }
      }

    } catch (error) {
      console.error(`❌ Erro ao finalizar campanha ${campanhaId}:`, error);
    }
  }

  /**
   * Processa resposta de cliente para análise com IA
   */
  static async processarRespostaCliente(campanhaId, campanhaContatosId, resposta) {
    try {
      console.log(`📨 [CampanhaService] Processando resposta para campanha ${campanhaId}, campanha_contatos_id: ${campanhaContatosId}`);
      
      // Verificar se a campanha existe
      const { data: campanha, error: campanhaError } = await supabase
        .from('campanhas')
        .select('usar_ia, organization_id, status')
        .eq('id', campanhaId)
        .single();

      if (campanhaError || !campanha) {
        console.error('❌ [CampanhaService] Campanha não encontrada:', campanhaError);
        return;
      }

      // ✅ CORREÇÃO: Processar resposta SEMPRE, não só quando usar_ia
      // Verificar se já está respondido (evitar processar duas vezes)
      const { data: contatoAtual, error: contatoAtualError } = await supabase
        .from('campanha_contatos')
        .select('status, resposta_cliente')
        .eq('id', campanhaContatosId)
        .single();

      if (contatoAtualError) {
        console.error('❌ [CampanhaService] Erro ao buscar campanha_contatos:', contatoAtualError);
        return;
      }

      if (contatoAtual?.status === 'respondido') {
        console.log(`⚠️ [CampanhaService] Contato já está marcado como respondido, pulando...`);
        return;
      }

      // Atualizar contato como respondido - ✅ CORREÇÃO: Usar ID do campanha_contatos
      const { error: updateError } = await supabase
        .from('campanha_contatos')
        .update({
          status: 'respondido',
          resposta_cliente: resposta,
          respondido_em: new Date().toISOString()
        })
        .eq('id', campanhaContatosId); // ✅ CORREÇÃO: Usar ID direto

      if (updateError) {
        console.error('❌ [CampanhaService] Erro ao atualizar status:', updateError);
        return;
      }

      console.log(`✅ [CampanhaService] Status atualizado para "respondido"`);

      // ✅ Processar com IA apenas se a campanha usar IA
      if (campanha.usar_ia) {
        try {
          const resumo = await AIService.gerarResumo(resposta);
          const sentimento = await AIService.analisarSentimento(resposta);

          // Salvar análise da IA
          await supabase
            .from('campanha_contatos')
            .update({
              resumo_ia: resumo,
              sentimento_ia: sentimento
            })
            .eq('id', campanhaContatosId); // ✅ CORREÇÃO: Usar ID direto
        } catch (iaError) {
          console.error('⚠️ [CampanhaService] Erro ao processar com IA (não crítico):', iaError);
        }
      }

      // ✅ ATUALIZAR CONTADORES NA TABELA CAMPANHAS
      const { data: statsCampanha } = await supabase
        .from('campanha_contatos')
        .select('status')
        .eq('campanha_id', campanhaId);

      if (statsCampanha) {
        const enviados = statsCampanha.filter(s => s.status === 'enviado' || s.status === 'respondido').length;
        const respondidos = statsCampanha.filter(s => s.status === 'respondido').length;

        await supabase
          .from('campanhas')
          .update({
            enviados: enviados,
            respondidos: respondidos
          })
          .eq('id', campanhaId);

        console.log(`✅ [CampanhaService] Contadores atualizados: enviados=${enviados}, respondidos=${respondidos}`);
      }

      // Emitir evento
      if (global.io) {
        global.io.to(`org_${campanha.organization_id}`).emit('campanha_resposta_processada', {
          campanha_id: campanhaId,
          campanha_contatos_id: campanhaContatosId,
          resposta: resposta.substring(0, 100)
        });
      }

    } catch (error) {
      console.error('❌ Erro ao processar resposta com IA:', error);
    }
  }

  /**
   * Utilitário para delay
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obter estatísticas de uma campanha
   */
  static async obterEstatisticas(campanhaId) {
    try {
      const { data: contatos } = await supabase
        .from('campanha_contatos')
        .select('status, enviado_em, respondido_em, sentimento_ia')
        .eq('campanha_id', campanhaId);

      if (!contatos) return null;

      const stats = {
        total: contatos.length,
        pendente: contatos.filter(c => c.status === 'pendente').length,
        enviado: contatos.filter(c => c.status === 'enviado').length,
        respondido: contatos.filter(c => c.status === 'respondido').length,
        erro: contatos.filter(c => c.status === 'erro').length
      };

      // Taxa de resposta
      const totalEnviados = stats.enviado + stats.respondido;
      stats.taxa_resposta = totalEnviados > 0 
        ? ((stats.respondido / totalEnviados) * 100).toFixed(2)
        : 0;

      // Análise de sentimento
      const respostasComSentimento = contatos.filter(c => c.sentimento_ia);
      stats.sentimentos = {
        total: respostasComSentimento.length,
        positivo: respostasComSentimento.filter(c => c.sentimento_ia === 'positivo').length,
        neutro: respostasComSentimento.filter(c => c.sentimento_ia === 'neutro').length,
        negativo: respostasComSentimento.filter(c => c.sentimento_ia === 'negativo').length
      };

      return stats;

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  /**
   * Distribui contatos entre usuários remetentes baseado no histórico
   */
  static async distribuirContatosInteligentemente(campanhaId, contatos, usuariosRemetentes, organizationId) {
    try {
      console.log(`🔄 Distribuindo ${contatos.length} contatos entre ${usuariosRemetentes.length} usuários...`);

      // Buscar histórico de mensagens para distribuição inteligente
      const contatosPhones = contatos.map(c => c.phone);
      const numerosUsuarios = usuariosRemetentes.map(u => u.numero_whatsapp);
      
      console.log('📱 Contatos phones:', contatosPhones);
      console.log('📞 Números usuários:', numerosUsuarios);

      const { data: historico, error: historicoError } = await supabase
        .from('messages')
        .select('sender_jid, user_id, created_at')
        .in('user_id', usuariosRemetentes.map(u => u.id))
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      console.log('📊 Histórico encontrado:', historico?.length || 0, 'mensagens');

      if (historicoError) {
        console.warn('⚠️ Erro ao buscar histórico, usando distribuição simples:', historicoError);
        return this.distribuirContatosSimplesmente(contatos, usuariosRemetentes);
      }

      // Criar mapa de distribuição baseado no histórico
      const distribuicao = {};
      usuariosRemetentes.forEach(usuario => {
        distribuicao[usuario.id] = {
          usuario,
          contatos: [],
          total_mensagens: 0
        };
      });

      // Processar histórico e distribuir contatos
      const contatosProcessados = new Set();
      
      historico.forEach(msg => {
        const usuarioId = usuariosRemetentes.find(u => u.numero_whatsapp === msg.from_number)?.id;
        const contato = contatos.find(c => c.phone === msg.contact_phone);
        
        if (usuarioId && contato && !contatosProcessados.has(msg.contact_phone)) {
          distribuicao[usuarioId].contatos.push(contato);
          distribuicao[usuarioId].total_mensagens += 1;
          contatosProcessados.add(msg.contact_phone);
        }
      });

      // Distribuir contatos restantes de forma equilibrada
      const contatosRestantes = contatos.filter(c => !contatosProcessados.has(c.phone));
      let usuarioIndex = 0;
      
      contatosRestantes.forEach(contato => {
        const usuarioId = usuariosRemetentes[usuarioIndex % usuariosRemetentes.length].id;
        distribuicao[usuarioId].contatos.push(contato);
        usuarioIndex++;
      });

      // ✅ CORREÇÃO: Buscar contatos existentes na tabela contacts antes de inserir
      const telefones = [...new Set(Object.values(distribuicao).flatMap(g => g.contatos.map(c => c.phone)))];
      
      // Buscar contatos existentes
      const { data: contatosExistentes, error: contatosExistError } = await supabase
        .from('contacts')
        .select('id, phone_number, name')
        .in('phone_number', telefones)
        .eq('organization_id', organizationId);

      const mapaContatos = {};
      if (!contatosExistError && contatosExistentes) {
        contatosExistentes.forEach(c => {
          mapaContatos[c.phone_number] = c.id; // Mapear telefone -> ID real
        });
      }

      // Inserir contatos na tabela campanha_contatos
      const contatosParaInserir = [];
      Object.values(distribuicao).forEach(grupo => {
        grupo.contatos.forEach(contato => {
          // ✅ USAR ID REAL DO CONTATO se existir, senão gerar UUID
          const contatoIdReal = mapaContatos[contato.phone] || crypto.randomUUID();
          
          contatosParaInserir.push({
            campanha_id: campanhaId,
            contato_id: contatoIdReal, // ✅ CORREÇÃO: Usar ID real do contato
            contato_nome: contato.name,
            contato_telefone: contato.phone,
            enviado_por: grupo.usuario.id,
            status: 'pendente'
          });
        });
      });

      console.log(`🔍 [CAMPANHA] Inserindo ${contatosParaInserir.length} contatos na campanha ${campanhaId}`);
      console.log(`🔍 [CAMPANHA] Primeiro contato para inserir:`, JSON.stringify(contatosParaInserir[0], null, 2));
      
      // ✅ DEBUG: Verificar se há contatos sem nome ou telefone
      const contatosInvalidos = contatosParaInserir.filter(c => !c.contato_nome || !c.contato_telefone);
      if (contatosInvalidos.length > 0) {
        console.error(`⚠️ [CAMPANHA] ${contatosInvalidos.length} contatos sem nome ou telefone!`);
        console.error('⚠️ [CAMPANHA] Exemplo de contato inválido:', contatosInvalidos[0]);
      }

      const { data: insertedContatos, error: insertError } = await supabase
        .from('campanha_contatos')
        .insert(contatosParaInserir)
        .select('id, status, contato_nome, contato_telefone');

      if (insertError) {
        console.error('❌ [CAMPANHA] Erro ao inserir contatos:', insertError);
        throw insertError;
      }

      console.log(`✅ [CAMPANHA] ${insertedContatos?.length || 0} contatos inseridos com sucesso`);
      console.log(`✅ [CAMPANHA] Status dos contatos inseridos:`, insertedContatos?.map(c => c.status));
      
      // ✅ DEBUG: Verificar se os dados foram salvos corretamente
      if (insertedContatos && insertedContatos.length > 0) {
        const primeiro = insertedContatos[0];
        console.log(`✅ [CAMPANHA] Primeiro contato inserido:`, {
          id: primeiro.id,
          status: primeiro.status,
          contato_nome: primeiro.contato_nome || 'VAZIO',
          contato_telefone: primeiro.contato_telefone || 'VAZIO'
        });
      }

      console.log(`✅ Contatos distribuídos inteligentemente:`);
      Object.values(distribuicao).forEach(grupo => {
        console.log(`   ${grupo.usuario.name}: ${grupo.contatos.length} contatos`);
      });

      return distribuicao;

    } catch (error) {
      console.error('❌ Erro na distribuição inteligente:', error);
      // Fallback para distribuição simples
      return this.distribuirContatosSimplesmente(contatos, usuariosRemetentes, campanhaId);
    }
  }

  /**
   * Distribui contatos de forma simples e equilibrada
   */
  static async distribuirContatosSimplesmente(contatos, usuariosRemetentes, campanhaId) {
    console.log(`🔄 Distribuindo ${contatos.length} contatos de forma simples...`);
    
    const distribuicao = {};
    usuariosRemetentes.forEach(usuario => {
      distribuicao[usuario.id] = {
        usuario,
        contatos: [],
        total_mensagens: 0
      };
    });

    // Distribuir contatos de forma equilibrada
    contatos.forEach((contato, index) => {
      const usuarioId = usuariosRemetentes[index % usuariosRemetentes.length].id;
      distribuicao[usuarioId].contatos.push(contato);
    });

    // ✅ CORREÇÃO: Buscar contatos existentes antes de inserir
    const telefones = [...new Set(Object.values(distribuicao).flatMap(g => g.contatos.map(c => c.phone)))];
    
    // Buscar contatos existentes (precisamos do organization_id - buscar da campanha)
    const { data: campanhaData, error: campanhaDataError } = await supabase
      .from('campanhas')
      .select('organization_id')
      .eq('id', campanhaId)
      .single();

    const organizationId = campanhaData?.organization_id;
    
    const { data: contatosExistentes } = await supabase
      .from('contacts')
      .select('id, phone_number, name')
      .in('phone_number', telefones)
      .eq('organization_id', organizationId || '');

    const mapaContatos = {};
    if (contatosExistentes) {
      contatosExistentes.forEach(c => {
        mapaContatos[c.phone_number] = c.id;
      });
    }

    // Inserir contatos na tabela campanha_contatos
    const contatosParaInserir = [];
    Object.values(distribuicao).forEach(grupo => {
      grupo.contatos.forEach(contato => {
        // ✅ USAR ID REAL DO CONTATO se existir
        const contatoIdReal = mapaContatos[contato.phone] || crypto.randomUUID();
        
        contatosParaInserir.push({
          campanha_id: campanhaId,
          contato_id: contatoIdReal, // ✅ CORREÇÃO: Usar ID real
          contato_nome: contato.name,
          contato_telefone: contato.phone,
          enviado_por: grupo.usuario.id,
          status: 'pendente'
        });
      });
    });

    console.log(`🔍 Inserindo ${contatosParaInserir.length} contatos na campanha ${campanhaId}`);
    
    // ✅ DEBUG: Verificar dados antes de inserir
    if (contatosParaInserir.length > 0) {
      console.log(`🔍 [CAMPANHA-SIMPLES] Primeiro contato para inserir:`, JSON.stringify(contatosParaInserir[0], null, 2));
      
      const contatosInvalidos = contatosParaInserir.filter(c => !c.contato_nome || !c.contato_telefone);
      if (contatosInvalidos.length > 0) {
        console.error(`⚠️ [CAMPANHA-SIMPLES] ${contatosInvalidos.length} contatos sem nome ou telefone!`);
      }
    }

    const { data: insertedContatos, error: insertError } = await supabase
      .from('campanha_contatos')
      .insert(contatosParaInserir)
      .select('id, status, contato_nome, contato_telefone');

    if (insertError) {
      console.error('❌ Erro ao inserir contatos:', insertError);
      throw insertError;
    }

    console.log(`✅ ${insertedContatos?.length || 0} contatos inseridos com sucesso`);
    
    // ✅ DEBUG: Verificar se os dados foram salvos corretamente
    if (insertedContatos && insertedContatos.length > 0) {
      const primeiro = insertedContatos[0];
      console.log(`✅ [CAMPANHA-SIMPLES] Primeiro contato inserido:`, {
        id: primeiro.id,
        status: primeiro.status,
        contato_nome: primeiro.contato_nome || 'VAZIO',
        contato_telefone: primeiro.contato_telefone || 'VAZIO'
      });
    }

    return distribuicao;
  }
}

export default CampanhaService;
