/**
 * Wrapper Otimizado para Supabase Queries
 * 
 * Este módulo fornece métodos otimizados para queries comuns,
 * incluindo monitoramento de performance e cache automático
 */

import { supabase } from '../lib/supabaseClient.js';
import logger from '../utils/logger.js';

class OptimizedSupabase {
  constructor() {
    this.queryCache = new Map();
    this.cacheConfig = {
      messages: { ttl: 2 * 60 * 1000, maxSize: 100 }, // 2 min, 100 queries
      chats: { ttl: 5 * 60 * 1000, maxSize: 50 },     // 5 min, 50 queries
      users: { ttl: 10 * 60 * 1000, maxSize: 20 },    // 10 min, 20 queries
      analytics: { ttl: 15 * 60 * 1000, maxSize: 30 } // 15 min, 30 queries
    };
  }

  // Método principal para executar queries com monitoramento
  async executeQuery(queryName, queryFn, cacheKey = null, cacheConfig = null) {
    const startTime = Date.now();
    
    try {
      // Verificar cache se disponível
      if (cacheKey && cacheConfig) {
        const cached = this.getFromCache(cacheKey, cacheConfig);
        if (cached) {
          const duration = Date.now() - startTime;
          logger.query(`${queryName} (cached)`, duration, cached.length);
          return { data: cached, error: null };
        }
      }

      // Executar query
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      // Log de performance
      logger.query(queryName, duration, result.data?.length);
      
      // Armazenar no cache se disponível
      if (cacheKey && cacheConfig && result.data) {
        this.setCache(cacheKey, result.data, cacheConfig);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Query ${queryName} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  // Cache management
  getFromCache(key, config) {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < config.ttl) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data, config) {
    // Limpar cache se exceder tamanho máximo
    if (this.queryCache.size >= config.maxSize) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Métodos otimizados para queries comuns

  // Buscar mensagens com paginação e filtros otimizados
  async getMessagesOptimized(params) {
    const {
      organizationId,
      startDate,
      endDate,
      chatIds = null,
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      ascending = false
    } = params;

    const cacheKey = `messages_${organizationId}_${startDate}_${endDate}_${limit}_${offset}`;
    
    return this.executeQuery(
      'getMessagesOptimized',
      async () => {
        let query = supabase
          .from('messages')
          .select(`
            id,
            chat_id,
            content,
            is_from_me,
            created_at,
            sender_name,
            user_id,
            chats (
              id,
              name,
              platform,
              whatsapp_jid,
              assigned_agent_id
            )
          `)
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .not('content', 'is', null);

        if (chatIds && chatIds.length > 0) {
          query = query.in('chat_id', chatIds);
        }

        return query
          .order(orderBy, { ascending })
          .range(offset, offset + limit - 1);
      },
      cacheKey,
      this.cacheConfig.messages
    );
  }

  // Buscar conversas com stats otimizados
  async getChatsWithStatsOptimized(organizationId, assignedAgentId = null) {
    const cacheKey = `chats_stats_${organizationId}_${assignedAgentId || 'all'}`;
    
    return this.executeQuery(
      'getChatsWithStatsOptimized',
      async () => {
        let query = supabase
          .from('chats')
          .select(`
            id,
            name,
            platform,
            status,
            priority,
            department,
            created_at,
            updated_at,
            assigned_agent_id,
            organization_id,
            last_message_at
          `)
          .eq('organization_id', organizationId);

        if (assignedAgentId) {
          query = query.eq('assigned_agent_id', assignedAgentId);
        }

        return query.order('updated_at', { ascending: false });
      },
      cacheKey,
      this.cacheConfig.chats
    );
  }

  // Contar mensagens de forma otimizada
  async countMessagesOptimized(organizationId, startDate, endDate, filters = {}) {
    const cacheKey = `count_messages_${organizationId}_${startDate}_${endDate}_${JSON.stringify(filters)}`;
    
    return this.executeQuery(
      'countMessagesOptimized',
      async () => {
        let query = supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .not('content', 'is', null);

        // Aplicar filtros adicionais
        if (filters.chatIds && filters.chatIds.length > 0) {
          query = query.in('chat_id', filters.chatIds);
        }
        
        if (filters.isFromMe !== undefined) {
          query = query.eq('is_from_me', filters.isFromMe);
        }

        return query;
      },
      cacheKey,
      { ttl: 1 * 60 * 1000, maxSize: 50 } // Cache mais curto para counts
    );
  }

  // Buscar usuários com roles otimizado
  async getUsersWithRolesOptimized(organizationId) {
    const cacheKey = `users_roles_${organizationId}`;
    
    return this.executeQuery(
      'getUsersWithRolesOptimized',
      async () => {
        return supabase
          .from('profiles')
          .select(`
            id,
            name,
            email,
            organization_id,
            role_id,
            roles (
              id,
              name,
              description,
              permissions
            )
          `)
          .eq('organization_id', organizationId)
          .not('role_id', 'is', null);
      },
      cacheKey,
      this.cacheConfig.users
    );
  }

  // Buscar analytics otimizado
  async getAnalyticsOptimized(organizationId, startDate, endDate) {
    const cacheKey = `analytics_${organizationId}_${startDate}_${endDate}`;
    
    return this.executeQuery(
      'getAnalyticsOptimized',
      async () => {
        return supabase
          .from('conversation_analytics')
          .select(`
            *,
            chats (
              id,
              name,
              platform,
              status
            )
          `)
          .eq('organization_id', organizationId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false });
      },
      cacheKey,
      this.cacheConfig.analytics
    );
  }

  // Limpar cache específico
  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }
  }

  // Estatísticas do cache
  getCacheStats() {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys()),
      config: this.cacheConfig
    };
  }
}

// Instância singleton
const optimizedSupabase = new OptimizedSupabase();

export default optimizedSupabase;
