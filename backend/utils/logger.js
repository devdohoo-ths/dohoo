/**
 * Sistema de Logging Condicional para Otimização de Performance
 * 
 * Este módulo substitui console.log por um sistema inteligente que:
 * - Só exibe logs em desenvolvimento quando DEBUG_MODE=true
 * - Sempre exibe erros críticos
 * - Permite diferentes níveis de log
 * - Reduz drasticamente o output em produção
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugMode = process.env.DEBUG_MODE === 'true';
const isVerboseMode = process.env.VERBOSE_MODE === 'true';

// Níveis de log
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  VERBOSE: 4
};

// Configuração baseada no ambiente
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.ERROR;
  }
  
  if (isDevelopment && isDebugMode) {
    return LOG_LEVELS.DEBUG;
  }
  
  if (isDevelopment) {
    return LOG_LEVELS.INFO;
  }
  
  return LOG_LEVELS.ERROR; // Produção: apenas erros
};

const currentLogLevel = getLogLevel();

// Função principal de logging
const log = (level, message, ...args) => {
  if (level <= currentLogLevel) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS)[level];
    
    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(`[${timestamp}] ❌ ERROR:`, message, ...args);
        break;
      case LOG_LEVELS.WARN:
        console.warn(`[${timestamp}] ⚠️ WARN:`, message, ...args);
        break;
      case LOG_LEVELS.INFO:
        console.log(`[${timestamp}] ℹ️ INFO:`, message, ...args);
        break;
      case LOG_LEVELS.DEBUG:
        if (isDevelopment && isDebugMode) {
          console.log(`[${timestamp}] 🔍 DEBUG:`, message, ...args);
        }
        break;
      case LOG_LEVELS.VERBOSE:
        if (isDevelopment && isVerboseMode) {
          console.log(`[${timestamp}] 📝 VERBOSE:`, message, ...args);
        }
        break;
    }
  }
};

// Interface pública do logger
const logger = {
  // Sempre exibe erros
  error: (message, ...args) => log(LOG_LEVELS.ERROR, message, ...args),
  
  // Warnings apenas em desenvolvimento
  warn: (message, ...args) => log(LOG_LEVELS.WARN, message, ...args),
  
  // Info apenas em desenvolvimento
  info: (message, ...args) => log(LOG_LEVELS.INFO, message, ...args),
  
  // Debug apenas quando DEBUG_MODE=true
  debug: (message, ...args) => log(LOG_LEVELS.DEBUG, message, ...args),
  
  // Verbose apenas quando VERBOSE_MODE=true
  verbose: (message, ...args) => log(LOG_LEVELS.VERBOSE, message, ...args),
  
  // Logs específicos para diferentes módulos
  auth: (message, ...args) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[AUTH] ${message}`, ...args);
    }
  },
  
  database: (message, ...args) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[DB] ${message}`, ...args);
    }
  },
  
  api: (message, ...args) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[API] ${message}`, ...args);
    }
  },
  
  realtime: (message, ...args) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[REALTIME] ${message}`, ...args);
    }
  },
  
  whatsapp: (message, ...args) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[WHATSAPP] ${message}`, ...args);
    }
  },
  
  // Métricas de performance
  performance: (operation, duration, ...args) => {
    if (duration > 1000) { // Operações > 1s
      log(LOG_LEVELS.WARN, `[PERF] Slow operation: ${operation} took ${duration}ms`, ...args);
    } else if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[PERF] ${operation}: ${duration}ms`, ...args);
    }
  },
  
  // Log de queries Supabase
  query: (queryName, duration, rowCount = null) => {
    if (duration > 2000) { // Queries > 2s
      log(LOG_LEVELS.WARN, `[QUERY] Slow query: ${queryName} took ${duration}ms${rowCount ? ` (${rowCount} rows)` : ''}`);
    } else if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[QUERY] ${queryName}: ${duration}ms${rowCount ? ` (${rowCount} rows)` : ''}`);
    }
  }
};

// Função para substituir console.log em arquivos existentes
const replaceConsoleLog = (originalLog) => {
  return (...args) => {
    if (isDevelopment && isDebugMode) {
      originalLog(...args);
    }
  };
};

export default logger;
