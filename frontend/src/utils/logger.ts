/**
 * Sistema de Logging Condicional para Frontend
 * 
 * Este módulo substitui console.log por um sistema inteligente que:
 * - Só exibe logs em desenvolvimento quando DEBUG_MODE=true
 * - Sempre exibe erros críticos
 * - Permite diferentes níveis de log
 * - Reduz drasticamente o output em produção
 */

const isDevelopment = import.meta.env.DEV;
const isDebugMode = import.meta.env.VITE_DEBUG_MODE === 'true';
const isVerboseMode = import.meta.env.VITE_VERBOSE_MODE === 'true';

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
  const envLogLevel = import.meta.env.VITE_LOG_LEVEL;
  if (envLogLevel) {
    return LOG_LEVELS[envLogLevel.toUpperCase()] || LOG_LEVELS.ERROR;
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
const log = (level: number, message: string, ...args: any[]) => {
  if (level <= currentLogLevel) {
    const timestamp = new Date().toISOString();
    
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
export const logger = {
  // Sempre exibe erros
  error: (message: string, ...args: any[]) => log(LOG_LEVELS.ERROR, message, ...args),
  
  // Warnings apenas em desenvolvimento
  warn: (message: string, ...args: any[]) => log(LOG_LEVELS.WARN, message, ...args),
  
  // Info apenas em desenvolvimento
  info: (message: string, ...args: any[]) => log(LOG_LEVELS.INFO, message, ...args),
  
  // Debug apenas quando VITE_DEBUG_MODE=true
  debug: (message: string, ...args: any[]) => log(LOG_LEVELS.DEBUG, message, ...args),
  
  // Verbose apenas quando VITE_VERBOSE_MODE=true
  verbose: (message: string, ...args: any[]) => log(LOG_LEVELS.VERBOSE, message, ...args),
  
  // Logs específicos para diferentes módulos
  auth: (message: string, ...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[AUTH] ${message}`, ...args);
    }
  },
  
  database: (message: string, ...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[DB] ${message}`, ...args);
    }
  },
  
  api: (message: string, ...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[API] ${message}`, ...args);
    }
  },
  
  realtime: (message: string, ...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[REALTIME] ${message}`, ...args);
    }
  },
  
  whatsapp: (message: string, ...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[WHATSAPP] ${message}`, ...args);
    }
  },
  
  // Métricas de performance
  performance: (operation: string, duration: number, ...args: any[]) => {
    if (duration > 1000) { // Operações > 1s
      log(LOG_LEVELS.WARN, `[PERF] Slow operation: ${operation} took ${duration}ms`, ...args);
    } else if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[PERF] ${operation}: ${duration}ms`, ...args);
    }
  },
  
  // Log de queries Supabase
  query: (queryName: string, duration: number, rowCount?: number) => {
    if (duration > 2000) { // Queries > 2s
      log(LOG_LEVELS.WARN, `[QUERY] Slow query: ${queryName} took ${duration}ms${rowCount ? ` (${rowCount} rows)` : ''}`);
    } else if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[QUERY] ${queryName}: ${duration}ms${rowCount ? ` (${rowCount} rows)` : ''}`);
    }
  },
  
  // Log de componentes React
  component: (componentName: string, message: string, ...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[${componentName}] ${message}`, ...args);
    }
  },
  
  // Log de hooks
  hook: (hookName: string, message: string, ...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      log(LOG_LEVELS.DEBUG, `[${hookName}] ${message}`, ...args);
    }
  }
};

// Função para substituir console.log em arquivos existentes
export const replaceConsoleLog = (originalLog: typeof console.log) => {
  return (...args: any[]) => {
    if (isDevelopment && isDebugMode) {
      originalLog(...args);
    }
  };
};

export default logger;
