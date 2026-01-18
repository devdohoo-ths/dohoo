/**
 * Sistema de Debouncing Inteligente
 * 
 * Este módulo implementa debouncing avançado para otimizar
 * chamadas de API, inputs de usuário e operações custosas.
 */

import logger from './logger.js';

class DebounceManager {
  constructor() {
    this.timers = new Map();
    this.callbacks = new Map();
    this.stats = {
      totalDebounces: 0,
      successfulExecutions: 0,
      cancelledExecutions: 0,
      averageDelay: 0
    };
  }

  /**
   * Debounce básico com callback
   */
  debounce(key, callback, delay = 300) {
    // Cancelar timer anterior se existir
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.stats.cancelledExecutions++;
    }

    // Armazenar callback
    this.callbacks.set(key, callback);

    // Criar novo timer
    const timer = setTimeout(async () => {
      try {
        await callback();
        this.stats.successfulExecutions++;
        logger.debug(`Debounce executado: ${key}`);
      } catch (error) {
        logger.error(`Erro no debounce ${key}:`, error);
      } finally {
        this.timers.delete(key);
        this.callbacks.delete(key);
      }
    }, delay);

    this.timers.set(key, timer);
    this.stats.totalDebounces++;

    return timer;
  }

  /**
   * Debounce com parâmetros dinâmicos
   */
  debounceWithParams(key, callback, delay = 300, params = {}) {
    // Cancelar timer anterior
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.stats.cancelledExecutions++;
    }

    // Armazenar callback com parâmetros
    this.callbacks.set(key, { callback, params });

    // Criar novo timer
    const timer = setTimeout(async () => {
      try {
        const { callback: storedCallback, params: storedParams } = this.callbacks.get(key);
        await storedCallback(storedParams);
        this.stats.successfulExecutions++;
        logger.debug(`Debounce com parâmetros executado: ${key}`);
      } catch (error) {
        logger.error(`Erro no debounce ${key}:`, error);
      } finally {
        this.timers.delete(key);
        this.callbacks.delete(key);
      }
    }, delay);

    this.timers.set(key, timer);
    this.stats.totalDebounces++;

    return timer;
  }

  /**
   * Debounce para busca com cache
   */
  debounceSearch(key, searchFunction, delay = 500, cacheKey = null) {
    return this.debounceWithParams(key, async (params) => {
      const { query, filters = {} } = params;
      
      // Verificar cache se fornecido
      if (cacheKey) {
        const cachedResult = await this.getCachedSearch(cacheKey, query, filters);
        if (cachedResult) {
          logger.debug(`Resultado de busca obtido do cache: ${key}`);
          return cachedResult;
        }
      }

      // Executar busca
      const result = await searchFunction(query, filters);
      
      // Armazenar no cache se fornecido
      if (cacheKey) {
        await this.cacheSearchResult(cacheKey, query, filters, result);
      }

      return result;
    }, delay);
  }

  /**
   * Debounce para formulários com validação
   */
  debounceFormValidation(key, validationFunction, delay = 300) {
    return this.debounceWithParams(key, async (params) => {
      const { formData, fieldName } = params;
      
      try {
        const validationResult = await validationFunction(formData, fieldName);
        return validationResult;
      } catch (error) {
        logger.error(`Erro na validação do formulário ${key}:`, error);
        throw error;
      }
    }, delay);
  }

  /**
   * Debounce para operações de API
   */
  debounceAPI(key, apiFunction, delay = 1000, retryCount = 3) {
    return this.debounceWithParams(key, async (params) => {
      const { endpoint, data, method = 'GET' } = params;
      
      let lastError;
      
      for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
          const result = await apiFunction(endpoint, data, method);
          logger.debug(`API call bem-sucedida: ${key} (tentativa ${attempt})`);
          return result;
        } catch (error) {
          lastError = error;
          logger.warn(`Tentativa ${attempt} falhou para ${key}:`, error.message);
          
          if (attempt < retryCount) {
            // Aguardar antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }
      
      throw lastError;
    }, delay);
  }

  /**
   * Debounce para operações de arquivo
   */
  debounceFileOperation(key, fileFunction, delay = 200) {
    return this.debounceWithParams(key, async (params) => {
      const { file, operation } = params;
      
      try {
        const result = await fileFunction(file, operation);
        logger.debug(`Operação de arquivo executada: ${key}`);
        return result;
      } catch (error) {
        logger.error(`Erro na operação de arquivo ${key}:`, error);
        throw error;
      }
    }, delay);
  }

  /**
   * Cancelar debounce específico
   */
  cancelDebounce(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
      this.callbacks.delete(key);
      this.stats.cancelledExecutions++;
      logger.debug(`Debounce cancelado: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Cancelar todos os debounces
   */
  cancelAllDebounces() {
    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
    }
    
    this.timers.clear();
    this.callbacks.clear();
    
    logger.info('Todos os debounces foram cancelados');
  }

  /**
   * Executar debounce imediatamente
   */
  async executeDebounce(key) {
    if (this.callbacks.has(key)) {
      const callback = this.callbacks.get(key);
      
      // Cancelar timer
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      
      // Executar callback
      try {
        if (typeof callback === 'function') {
          await callback();
        } else if (callback.callback) {
          await callback.callback(callback.params);
        }
        
        this.callbacks.delete(key);
        this.stats.successfulExecutions++;
        logger.debug(`Debounce executado imediatamente: ${key}`);
      } catch (error) {
        logger.error(`Erro na execução imediata do debounce ${key}:`, error);
        throw error;
      }
    }
  }

  /**
   * Verificar se debounce está ativo
   */
  isDebounceActive(key) {
    return this.timers.has(key);
  }

  /**
   * Obter estatísticas de debouncing
   */
  getStats() {
    const total = this.stats.totalDebounces;
    const successRate = total > 0 ? (this.stats.successfulExecutions / total * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      activeDebounces: this.timers.size,
      averageDelay: this.calculateAverageDelay()
    };
  }

  /**
   * Calcular delay médio
   */
  calculateAverageDelay() {
    // Implementação simplificada - em produção seria mais complexa
    return 300; // Valor padrão
  }

  /**
   * Cache para resultados de busca
   */
  async getCachedSearch(cacheKey, query, filters) {
    // Implementação básica - em produção usaria Redis
    const key = `${cacheKey}:${JSON.stringify({ query, filters })}`;
    const cached = sessionStorage.getItem(key);
    
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const cacheAge = now - timestamp;
      
      // Cache válido por 5 minutos
      if (cacheAge < 5 * 60 * 1000) {
        return data;
      }
    }
    
    return null;
  }

  /**
   * Armazenar resultado de busca no cache
   */
  async cacheSearchResult(cacheKey, query, filters, result) {
    const key = `${cacheKey}:${JSON.stringify({ query, filters })}`;
    const data = {
      data: result,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Limpar cache de busca
   */
  clearSearchCache(cacheKey) {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(cacheKey)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

// Instância singleton
const debounceManager = new DebounceManager();

export default debounceManager;
