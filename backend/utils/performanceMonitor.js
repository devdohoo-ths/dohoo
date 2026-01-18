/**
 * Sistema de Monitoramento de Performance
 * 
 * Este módulo monitora e reporta métricas de performance do sistema,
 * incluindo queries lentas, operações demoradas e uso de recursos
 */

import logger from '../utils/logger.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      queries: [],
      operations: [],
      errors: [],
      slowQueries: [],
      slowOperations: []
    };
    
    this.thresholds = {
      slowQuery: 2000,      // 2 segundos
      slowOperation: 1000,  // 1 segundo
      maxQueries: 1000,     // Máximo de queries para manter em memória
      maxOperations: 500    // Máximo de operações para manter em memória
    };
    
    this.isEnabled = process.env.PERFORMANCE_MONITORING === 'true' || 
                     process.env.NODE_ENV === 'development';
  }

  // Monitorar query do Supabase
  trackQuery(queryName, startTime, endTime, rowCount = null, error = null) {
    if (!this.isEnabled) return;

    const duration = endTime - startTime;
    const queryMetric = {
      name: queryName,
      duration,
      rowCount,
      timestamp: new Date().toISOString(),
      error: error?.message || null
    };

    this.metrics.queries.push(queryMetric);

    // Detectar queries lentas
    if (duration > this.thresholds.slowQuery) {
      this.metrics.slowQueries.push(queryMetric);
      logger.warn(`Slow query detected: ${queryName} took ${duration}ms${rowCount ? ` (${rowCount} rows)` : ''}`);
    }

    // Limitar tamanho do array
    if (this.metrics.queries.length > this.thresholds.maxQueries) {
      this.metrics.queries = this.metrics.queries.slice(-this.thresholds.maxQueries);
    }

    // Log de performance
    logger.query(queryName, duration, rowCount);
  }

  // Monitorar operação genérica
  trackOperation(operationName, startTime, endTime, metadata = {}, error = null) {
    if (!this.isEnabled) return;

    const duration = endTime - startTime;
    const operationMetric = {
      name: operationName,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
      error: error?.message || null
    };

    this.metrics.operations.push(operationMetric);

    // Detectar operações lentas
    if (duration > this.thresholds.slowOperation) {
      this.metrics.slowOperations.push(operationMetric);
      logger.warn(`Slow operation detected: ${operationName} took ${duration}ms`, metadata);
    }

    // Limitar tamanho do array
    if (this.metrics.operations.length > this.thresholds.maxOperations) {
      this.metrics.operations = this.metrics.operations.slice(-this.thresholds.maxOperations);
    }

    // Log de performance
    logger.performance(operationName, duration, metadata);
  }

  // Monitorar erro
  trackError(errorName, error, context = {}) {
    if (!this.isEnabled) return;

    const errorMetric = {
      name: errorName,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };

    this.metrics.errors.push(errorMetric);

    // Manter apenas os últimos 100 erros
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-100);
    }

    logger.error(`Error tracked: ${errorName}`, error.message, context);
  }

  // Decorator para monitorar funções automaticamente
  monitorFunction(functionName, fn) {
    return async (...args) => {
      const startTime = Date.now();
      try {
        const result = await fn(...args);
        const endTime = Date.now();
        this.trackOperation(functionName, startTime, endTime, { args: args.length });
        return result;
      } catch (error) {
        const endTime = Date.now();
        this.trackOperation(functionName, startTime, endTime, { args: args.length }, error);
        this.trackError(functionName, error, { args: args.length });
        throw error;
      }
    };
  }

  // Decorator para monitorar queries do Supabase
  monitorQuery(queryName, queryFn) {
    return async (...args) => {
      const startTime = Date.now();
      try {
        const result = await queryFn(...args);
        const endTime = Date.now();
        this.trackQuery(queryName, startTime, endTime, result.data?.length);
        return result;
      } catch (error) {
        const endTime = Date.now();
        this.trackQuery(queryName, startTime, endTime, null, error);
        throw error;
      }
    };
  }

  // Obter estatísticas de performance
  getStats() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const last24Hours = now - (24 * 60 * 60 * 1000);

    // Filtrar métricas por período
    const recentQueries = this.metrics.queries.filter(q => 
      new Date(q.timestamp).getTime() > lastHour
    );
    const recentOperations = this.metrics.operations.filter(o => 
      new Date(o.timestamp).getTime() > lastHour
    );
    const recentErrors = this.metrics.errors.filter(e => 
      new Date(e.timestamp).getTime() > last24Hours
    );

    // Calcular estatísticas
    const avgQueryTime = recentQueries.length > 0 
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length 
      : 0;

    const avgOperationTime = recentOperations.length > 0 
      ? recentOperations.reduce((sum, o) => sum + o.duration, 0) / recentOperations.length 
      : 0;

    const slowQueriesCount = this.metrics.slowQueries.filter(q => 
      new Date(q.timestamp).getTime() > lastHour
    ).length;

    const slowOperationsCount = this.metrics.slowOperations.filter(o => 
      new Date(o.timestamp).getTime() > lastHour
    ).length;

    return {
      summary: {
        totalQueries: this.metrics.queries.length,
        totalOperations: this.metrics.operations.length,
        totalErrors: this.metrics.errors.length,
        recentQueries: recentQueries.length,
        recentOperations: recentOperations.length,
        recentErrors: recentErrors.length
      },
      performance: {
        avgQueryTime: Math.round(avgQueryTime),
        avgOperationTime: Math.round(avgOperationTime),
        slowQueriesCount,
        slowOperationsCount,
        slowQueriesRate: recentQueries.length > 0 ? (slowQueriesCount / recentQueries.length * 100).toFixed(2) : 0,
        slowOperationsRate: recentOperations.length > 0 ? (slowOperationsCount / recentOperations.length * 100).toFixed(2) : 0
      },
      thresholds: this.thresholds,
      isEnabled: this.isEnabled
    };
  }

  // Obter queries mais lentas
  getSlowestQueries(limit = 10) {
    return this.metrics.slowQueries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // Obter operações mais lentas
  getSlowestOperations(limit = 10) {
    return this.metrics.slowOperations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // Obter erros mais frequentes
  getMostFrequentErrors(limit = 10) {
    const errorCounts = {};
    this.metrics.errors.forEach(error => {
      const key = `${error.name}: ${error.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([error, count]) => ({ error, count }));
  }

  // Limpar métricas antigas
  cleanup() {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 horas

    this.metrics.queries = this.metrics.queries.filter(q => 
      new Date(q.timestamp).getTime() > cutoff
    );
    this.metrics.operations = this.metrics.operations.filter(o => 
      new Date(o.timestamp).getTime() > cutoff
    );
    this.metrics.errors = this.metrics.errors.filter(e => 
      new Date(e.timestamp).getTime() > cutoff
    );
  }

  // Relatório de performance
  generateReport() {
    const stats = this.getStats();
    const slowestQueries = this.getSlowestQueries(5);
    const slowestOperations = this.getSlowestOperations(5);
    const frequentErrors = this.getMostFrequentErrors(5);

    return {
      timestamp: new Date().toISOString(),
      stats,
      slowestQueries,
      slowestOperations,
      frequentErrors,
      recommendations: this.generateRecommendations(stats)
    };
  }

  // Gerar recomendações baseadas nas métricas
  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.performance.slowQueriesRate > 10) {
      recommendations.push({
        type: 'query_optimization',
        priority: 'high',
        message: `${stats.performance.slowQueriesRate}% das queries estão lentas. Considere otimizar índices ou implementar cache.`
      });
    }

    if (stats.performance.slowOperationsRate > 15) {
      recommendations.push({
        type: 'operation_optimization',
        priority: 'medium',
        message: `${stats.performance.slowOperationsRate}% das operações estão lentas. Revise algoritmos e processamento.`
      });
    }

    if (stats.summary.recentErrors > 10) {
      recommendations.push({
        type: 'error_handling',
        priority: 'high',
        message: `${stats.summary.recentErrors} erros nas últimas 24h. Revise tratamento de erros.`
      });
    }

    if (stats.performance.avgQueryTime > 1000) {
      recommendations.push({
        type: 'database_optimization',
        priority: 'medium',
        message: `Tempo médio de query (${stats.performance.avgQueryTime}ms) está alto. Considere otimizações no banco.`
      });
    }

    return recommendations;
  }
}

// Instância singleton
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
