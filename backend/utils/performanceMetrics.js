/**
 * Sistema de Métricas de Performance Detalhado
 * 
 * Este módulo implementa monitoramento avançado de performance
 * para identificar gargalos e otimizar o sistema.
 */

import logger from './logger.js';
import redisCache from './redisCache.js';

class PerformanceMetrics {
  constructor() {
    this.metrics = {
      api: {
        requests: 0,
        totalTime: 0,
        averageTime: 0,
        slowRequests: 0,
        errors: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      database: {
        queries: 0,
        totalTime: 0,
        averageTime: 0,
        slowQueries: 0,
        errors: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      realtime: {
        subscriptions: 0,
        events: 0,
        totalTime: 0,
        averageTime: 0,
        errors: 0
      },
      frontend: {
        renders: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        slowRenders: 0,
        memoryUsage: 0,
        bundleSize: 0
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        networkLatency: 0,
        uptime: 0
      }
    };
    
    this.thresholds = {
      api: { slow: 1000, error: 5000 },
      database: { slow: 500, error: 2000 },
      realtime: { slow: 100, error: 1000 },
      frontend: { slow: 16, error: 100 }, // 16ms = 60fps
      system: { memory: 80, cpu: 80, disk: 90 }
    };
    
    this.alerts = [];
    this.startTime = Date.now();
  }

  /**
   * Registrar métrica de API
   */
  recordAPIMetric(endpoint, method, duration, success, fromCache = false) {
    this.metrics.api.requests++;
    this.metrics.api.totalTime += duration;
    this.metrics.api.averageTime = this.metrics.api.totalTime / this.metrics.api.requests;

    if (fromCache) {
      this.metrics.api.cacheHits++;
    } else {
      this.metrics.api.cacheMisses++;
    }

    if (duration > this.thresholds.api.slow) {
      this.metrics.api.slowRequests++;
      this.createAlert('api', 'slow_request', {
        endpoint,
        method,
        duration,
        threshold: this.thresholds.api.slow
      });
    }

    if (!success) {
      this.metrics.api.errors++;
      this.createAlert('api', 'error', {
        endpoint,
        method,
        duration
      });
    }

    logger.debug(`API ${method} ${endpoint}: ${duration}ms ${success ? '✅' : '❌'} ${fromCache ? '📦' : '🌐'}`);
  }

  /**
   * Registrar métrica de banco de dados
   */
  recordDatabaseMetric(table, operation, duration, success, fromCache = false) {
    this.metrics.database.queries++;
    this.metrics.database.totalTime += duration;
    this.metrics.database.averageTime = this.metrics.database.totalTime / this.metrics.database.queries;

    if (fromCache) {
      this.metrics.database.cacheHits++;
    } else {
      this.metrics.database.cacheMisses++;
    }

    if (duration > this.thresholds.database.slow) {
      this.metrics.database.slowQueries++;
      this.createAlert('database', 'slow_query', {
        table,
        operation,
        duration,
        threshold: this.thresholds.database.slow
      });
    }

    if (!success) {
      this.metrics.database.errors++;
      this.createAlert('database', 'error', {
        table,
        operation,
        duration
      });
    }

    logger.debug(`DB ${operation} ${table}: ${duration}ms ${success ? '✅' : '❌'} ${fromCache ? '📦' : '🗄️'}`);
  }

  /**
   * Registrar métrica de realtime
   */
  recordRealtimeMetric(eventType, duration, success) {
    this.metrics.realtime.events++;
    this.metrics.realtime.totalTime += duration;
    this.metrics.realtime.averageTime = this.metrics.realtime.totalTime / this.metrics.realtime.events;

    if (duration > this.thresholds.realtime.slow) {
      this.createAlert('realtime', 'slow_event', {
        eventType,
        duration,
        threshold: this.thresholds.realtime.slow
      });
    }

    if (!success) {
      this.metrics.realtime.errors++;
      this.createAlert('realtime', 'error', {
        eventType,
        duration
      });
    }

    logger.debug(`Realtime ${eventType}: ${duration}ms ${success ? '✅' : '❌'}`);
  }

  /**
   * Registrar métrica de frontend
   */
  recordFrontendMetric(componentName, renderTime, memoryUsage = 0) {
    this.metrics.frontend.renders++;
    this.metrics.frontend.totalRenderTime += renderTime;
    this.metrics.frontend.averageRenderTime = this.metrics.frontend.totalRenderTime / this.metrics.frontend.renders;

    if (memoryUsage > 0) {
      this.metrics.frontend.memoryUsage = memoryUsage;
    }

    if (renderTime > this.thresholds.frontend.slow) {
      this.metrics.frontend.slowRenders++;
      this.createAlert('frontend', 'slow_render', {
        component: componentName,
        renderTime,
        threshold: this.thresholds.frontend.slow
      });
    }

    logger.debug(`Frontend ${componentName}: ${renderTime}ms ${memoryUsage > 0 ? `(${memoryUsage}MB)` : ''}`);
  }

  /**
   * Registrar métrica de sistema
   */
  recordSystemMetric(type, value) {
    this.metrics.system[type] = value;

    const threshold = this.thresholds.system[type];
    if (threshold && value > threshold) {
      this.createAlert('system', 'high_usage', {
        type,
        value,
        threshold
      });
    }

    logger.debug(`System ${type}: ${value}%`);
  }

  /**
   * Criar alerta
   */
  createAlert(category, type, data) {
    const alert = {
      id: `${category}_${type}_${Date.now()}`,
      category,
      type,
      data,
      timestamp: new Date().toISOString(),
      severity: this.getSeverity(category, type, data)
    };

    this.alerts.push(alert);

    // Manter apenas os últimos 100 alertas
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    logger.warn(`🚨 Alerta ${category}: ${type}`, data);
  }

  /**
   * Determinar severidade do alerta
   */
  getSeverity(category, type, data) {
    if (type === 'error') return 'critical';
    if (type === 'slow_request' || type === 'slow_query' || type === 'slow_render') return 'warning';
    if (type === 'high_usage') return 'warning';
    return 'info';
  }

  /**
   * Obter estatísticas detalhadas
   */
  getDetailedStats() {
    const uptime = Date.now() - this.startTime;
    this.metrics.system.uptime = uptime;

    return {
      metrics: this.metrics,
      alerts: this.alerts.slice(-20), // Últimos 20 alertas
      summary: {
        totalRequests: this.metrics.api.requests + this.metrics.database.queries,
        totalErrors: this.metrics.api.errors + this.metrics.database.errors + this.metrics.realtime.errors,
        averageResponseTime: this.calculateAverageResponseTime(),
        cacheHitRate: this.calculateCacheHitRate(),
        systemHealth: this.calculateSystemHealth(),
        uptime: this.formatUptime(uptime)
      },
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Calcular tempo médio de resposta
   */
  calculateAverageResponseTime() {
    const totalRequests = this.metrics.api.requests + this.metrics.database.queries;
    const totalTime = this.metrics.api.totalTime + this.metrics.database.totalTime;
    
    return totalRequests > 0 ? (totalTime / totalRequests).toFixed(2) : 0;
  }

  /**
   * Calcular taxa de hit do cache
   */
  calculateCacheHitRate() {
    const totalCacheRequests = this.metrics.api.cacheHits + this.metrics.api.cacheMisses + 
                              this.metrics.database.cacheHits + this.metrics.database.cacheMisses;
    const totalHits = this.metrics.api.cacheHits + this.metrics.database.cacheHits;
    
    return totalCacheRequests > 0 ? (totalHits / totalCacheRequests * 100).toFixed(2) : 0;
  }

  /**
   * Calcular saúde do sistema
   */
  calculateSystemHealth() {
    const errorRate = this.calculateErrorRate();
    const slowRequestRate = this.calculateSlowRequestRate();
    
    if (errorRate > 10) return 'critical';
    if (errorRate > 5 || slowRequestRate > 20) return 'warning';
    if (errorRate < 1 && slowRequestRate < 5) return 'excellent';
    return 'good';
  }

  /**
   * Calcular taxa de erro
   */
  calculateErrorRate() {
    const totalRequests = this.metrics.api.requests + this.metrics.database.queries;
    const totalErrors = this.metrics.api.errors + this.metrics.database.errors;
    
    return totalRequests > 0 ? (totalErrors / totalRequests * 100) : 0;
  }

  /**
   * Calcular taxa de requisições lentas
   */
  calculateSlowRequestRate() {
    const totalRequests = this.metrics.api.requests + this.metrics.database.queries;
    const slowRequests = this.metrics.api.slowRequests + this.metrics.database.slowQueries;
    
    return totalRequests > 0 ? (slowRequests / totalRequests * 100) : 0;
  }

  /**
   * Gerar recomendações
   */
  generateRecommendations() {
    const recommendations = [];

    // Recomendações de cache
    const cacheHitRate = this.calculateCacheHitRate();
    if (cacheHitRate < 50) {
      recommendations.push({
        category: 'cache',
        priority: 'high',
        message: 'Taxa de hit do cache baixa. Considere aumentar TTL ou implementar cache mais agressivo.',
        impact: 'Reduzir consultas ao banco de dados'
      });
    }

    // Recomendações de performance
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > 1000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        message: 'Tempo médio de resposta alto. Considere otimizar consultas ou implementar paginação.',
        impact: 'Melhorar experiência do usuário'
      });
    }

    // Recomendações de erro
    const errorRate = this.calculateErrorRate();
    if (errorRate > 5) {
      recommendations.push({
        category: 'reliability',
        priority: 'critical',
        message: 'Taxa de erro alta. Verifique logs e implemente tratamento de erro mais robusto.',
        impact: 'Melhorar estabilidade do sistema'
      });
    }

    // Recomendações de frontend
    if (this.metrics.frontend.slowRenders > this.metrics.frontend.renders * 0.1) {
      recommendations.push({
        category: 'frontend',
        priority: 'medium',
        message: 'Muitos renders lentos. Considere usar React.memo ou otimizar componentes.',
        impact: 'Melhorar performance da interface'
      });
    }

    return recommendations;
  }

  /**
   * Formatar uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Limpar métricas antigas
   */
  clearOldMetrics() {
    // Manter apenas alertas dos últimos 24 horas
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > oneDayAgo
    );

    logger.debug('Métricas antigas limpas');
  }

  /**
   * Exportar métricas para análise
   */
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      stats: this.getDetailedStats(),
      rawMetrics: this.metrics
    };
  }

  /**
   * Resetar todas as métricas
   */
  reset() {
    this.metrics = {
      api: { requests: 0, totalTime: 0, averageTime: 0, slowRequests: 0, errors: 0, cacheHits: 0, cacheMisses: 0 },
      database: { queries: 0, totalTime: 0, averageTime: 0, slowQueries: 0, errors: 0, cacheHits: 0, cacheMisses: 0 },
      realtime: { subscriptions: 0, events: 0, totalTime: 0, averageTime: 0, errors: 0 },
      frontend: { renders: 0, totalRenderTime: 0, averageRenderTime: 0, slowRenders: 0, memoryUsage: 0, bundleSize: 0 },
      system: { memoryUsage: 0, cpuUsage: 0, diskUsage: 0, networkLatency: 0, uptime: 0 }
    };
    
    this.alerts = [];
    this.startTime = Date.now();
    
    logger.info('Métricas resetadas');
  }
}

// Instância singleton
const performanceMetrics = new PerformanceMetrics();

export default performanceMetrics;
