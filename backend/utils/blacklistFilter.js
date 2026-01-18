import { supabase } from '../lib/supabaseClient.js';
import logger from '../utils/logger.js';

/**
 * Verifica se um número de telefone está na blacklist da organização
 * @param {string} organizationId - ID da organização
 * @param {string} phoneNumber - Número de telefone a verificar
 * @returns {Promise<boolean>} - true se o número está na blacklist
 */
export async function isNumberBlacklisted(organizationId, phoneNumber) {
  try {
    if (!organizationId || !phoneNumber) {
      return false;
    }

    // Normalizar número de telefone (remover caracteres especiais)
    const normalizedNumber = phoneNumber.replace(/\D/g, '');
    
    const { data, error } = await supabase
      .from('blacklist')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('numero_telefone', normalizedNumber)
      .eq('ativo', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Erro ao verificar blacklist:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    logger.error('Erro ao verificar blacklist:', error);
    return false;
  }
}

/**
 * Filtra uma lista de mensagens removendo números que estão na blacklist
 * @param {Array} messages - Lista de mensagens
 * @param {string} organizationId - ID da organização
 * @returns {Promise<Array>} - Lista filtrada de mensagens
 */
export async function filterBlacklistedMessages(messages, organizationId) {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return messages;
    }

    // Buscar todos os números da blacklist de uma vez para otimizar performance
    const { data: blacklistNumbers, error } = await supabase
      .from('blacklist')
      .select('numero_telefone')
      .eq('organization_id', organizationId)
      .eq('ativo', true);

    if (error) {
      logger.error('Erro ao buscar blacklist:', error);
      return messages; // Retorna todas as mensagens em caso de erro
    }

    const blacklistedNumbers = new Set(
      (blacklistNumbers || []).map(item => item.numero_telefone)
    );

    // Filtrar mensagens que não estão na blacklist
    const filteredMessages = messages.filter(message => {
      // Extrair número de telefone do sender_name ou whatsapp_jid
      let phoneNumber = null;
      
      if (message.sender_name) {
        // Tentar extrair número do sender_name
        const phoneMatch = message.sender_name.match(/\d{10,}/);
        if (phoneMatch) {
          phoneNumber = phoneMatch[0];
        }
      }
      
      if (!phoneNumber && message.chats?.whatsapp_jid) {
        // Tentar extrair número do whatsapp_jid
        const jidMatch = message.chats.whatsapp_jid.match(/(\d+)@/);
        if (jidMatch) {
          phoneNumber = jidMatch[1];
        }
      }

      if (!phoneNumber) {
        return true; // Manter mensagem se não conseguir extrair número
      }

      // Normalizar número para comparação
      const normalizedNumber = phoneNumber.replace(/\D/g, '');
      
      // Verificar se está na blacklist
      return !blacklistedNumbers.has(normalizedNumber);
    });

    logger.info(`Filtradas ${messages.length - filteredMessages.length} mensagens da blacklist`);
    return filteredMessages;
  } catch (error) {
    logger.error('Erro ao filtrar mensagens da blacklist:', error);
    return messages; // Retorna todas as mensagens em caso de erro
  }
}

/**
 * Filtra uma lista de chats removendo números que estão na blacklist
 * @param {Array} chats - Lista de chats
 * @param {string} organizationId - ID da organização
 * @returns {Promise<Array>} - Lista filtrada de chats
 */
export async function filterBlacklistedChats(chats, organizationId) {
  try {
    if (!chats || !Array.isArray(chats) || chats.length === 0) {
      return chats;
    }

    // Buscar todos os números da blacklist de uma vez para otimizar performance
    const { data: blacklistNumbers, error } = await supabase
      .from('blacklist')
      .select('numero_telefone')
      .eq('organization_id', organizationId)
      .eq('ativo', true);

    if (error) {
      logger.error('Erro ao buscar blacklist:', error);
      return chats; // Retorna todos os chats em caso de erro
    }

    const blacklistedNumbers = new Set(
      (blacklistNumbers || []).map(item => item.numero_telefone)
    );

    // Filtrar chats que não estão na blacklist
    const filteredChats = chats.filter(chat => {
      // Extrair número de telefone do whatsapp_jid ou name
      let phoneNumber = null;
      
      if (chat.whatsapp_jid) {
        // Tentar extrair número do whatsapp_jid
        const jidMatch = chat.whatsapp_jid.match(/(\d+)@/);
        if (jidMatch) {
          phoneNumber = jidMatch[1];
        }
      }
      
      if (!phoneNumber && chat.name) {
        // Tentar extrair número do name
        const phoneMatch = chat.name.match(/\d{10,}/);
        if (phoneMatch) {
          phoneNumber = phoneMatch[0];
        }
      }

      if (!phoneNumber) {
        return true; // Manter chat se não conseguir extrair número
      }

      // Normalizar número para comparação
      const normalizedNumber = phoneNumber.replace(/\D/g, '');
      
      // Verificar se está na blacklist
      return !blacklistedNumbers.has(normalizedNumber);
    });

    logger.info(`Filtrados ${chats.length - filteredChats.length} chats da blacklist`);
    return filteredChats;
  } catch (error) {
    logger.error('Erro ao filtrar chats da blacklist:', error);
    return chats; // Retorna todos os chats em caso de erro
  }
}

/**
 * Middleware para aplicar filtro de blacklist automaticamente em rotas de relatórios
 * @param {Function} handler - Função handler da rota
 * @returns {Function} - Handler modificado com filtro de blacklist
 */
export function withBlacklistFilter(handler) {
  return async (req, res, next) => {
    try {
      // Executar handler original
      const originalSend = res.send;
      res.send = function(data) {
        try {
          // Se a resposta contém dados de mensagens ou chats, aplicar filtro
          if (data && typeof data === 'string') {
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.success && parsedData.data) {
                // Aplicar filtro se necessário
                if (Array.isArray(parsedData.data)) {
                  // Assumir que é uma lista de mensagens ou chats
                  filterBlacklistedMessages(parsedData.data, req.user?.organization_id)
                    .then(filteredData => {
                      parsedData.data = filteredData;
                      originalSend.call(this, JSON.stringify(parsedData));
                    })
                    .catch(error => {
                      logger.error('Erro ao aplicar filtro de blacklist:', error);
                      originalSend.call(this, data);
                    });
                  return;
                }
              }
            } catch (parseError) {
              // Se não conseguir fazer parse, enviar dados originais
            }
          }
          originalSend.call(this, data);
        } catch (error) {
          logger.error('Erro no middleware de blacklist:', error);
          originalSend.call(this, data);
        }
      };
      
      await handler(req, res, next);
    } catch (error) {
      logger.error('Erro no middleware de blacklist:', error);
      next(error);
    }
  };
}
