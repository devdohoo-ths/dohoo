import { supabase } from '../lib/supabaseClient.js';

export class WhatsAppProductivityService {
  
  // Calcular tempo de uso baseado nas mensagens
  static calculateUsageTime(messages, userId, date) {
    const userMessages = messages.filter(msg => 
      msg.user_id === userId && 
      new Date(msg.created_at).toDateString() === new Date(date).toDateString()
    );
    
    if (userMessages.length === 0) return 0;
    
    // Ordenar mensagens por timestamp
    const sortedMessages = userMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const firstMessage = sortedMessages[0];
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    
    const startTime = new Date(firstMessage.created_at);
    const endTime = new Date(lastMessage.created_at);
    
    // Calcular tempo total em minutos
    const totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    return totalMinutes;
  }
  
  // Calcular tempo ativo (baseado em intervalos entre mensagens)
  static calculateActiveTime(messages, userId, date) {
    const userMessages = messages.filter(msg => 
      msg.user_id === userId && 
      new Date(msg.created_at).toDateString() === new Date(date).toDateString()
    );
    
    if (userMessages.length < 2) return 0;
    
    const sortedMessages = userMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    let activeTime = 0;
    const MAX_IDLE_TIME = 5 * 60 * 1000; // 5 minutos em ms
    
    for (let i = 0; i < sortedMessages.length - 1; i++) {
      const current = new Date(sortedMessages[i].created_at);
      const next = new Date(sortedMessages[i + 1].created_at);
      const interval = next.getTime() - current.getTime();
      
      // Se o intervalo for menor que 5 minutos, considera tempo ativo
      if (interval <= MAX_IDLE_TIME) {
        activeTime += interval;
      }
    }
    
    return Math.round(activeTime / (1000 * 60)); // converter para minutos
  }
  
  // Calcular tempo de resposta médio
  static calculateAverageResponseTime(messages, userId, date) {
    const userMessages = messages.filter(msg => 
      msg.user_id === userId && 
      new Date(msg.created_at).toDateString() === new Date(date).toDateString()
    );
    
    if (userMessages.length < 2) return 0;
    
    const sortedMessages = userMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (let i = 0; i < sortedMessages.length - 1; i++) {
      const current = sortedMessages[i];
      const next = sortedMessages[i + 1];
      
      // Se a mensagem atual é do cliente e a próxima é do agente
      if (!current.is_from_me && next.is_from_me) {
        const responseTime = (new Date(next.created_at).getTime() - new Date(current.created_at).getTime()) / 1000;
        totalResponseTime += responseTime;
        responseCount++;
      }
    }
    
    return responseCount > 0 ? totalResponseTime / responseCount : 0;
  }
  
  // Calcular score de produtividade
  static calculateProductivityScore(metrics) {
    const {
      totalMessages,
      avgResponseTime,
      responseRate,
      resolutionRate,
      activeTime,
      totalUsageTime
    } = metrics;
    
    // Fatores de peso
    const messageWeight = 0.3;
    const responseTimeWeight = 0.25;
    const responseRateWeight = 0.25;
    const resolutionRateWeight = 0.2;
    
    // Normalizar métricas (0-100)
    const messageScore = Math.min(100, (totalMessages / 50) * 100); // 50 mensagens = 100%
    const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 60) * 10); // 6 min = 0%
    const responseRateScore = responseRate;
    const resolutionRateScore = resolutionRate;
    
    // Calcular score final
    const productivityScore = 
      (messageScore * messageWeight) +
      (responseTimeScore * responseTimeWeight) +
      (responseRateScore * responseRateWeight) +
      (resolutionRateScore * resolutionRateWeight);
    
    return Math.round(Math.max(0, Math.min(100, productivityScore)));
  }
  
  // Gerar mapa de calor de atividade
  static generateActivityHeatmap(messages, userId, date) {
    const userMessages = messages.filter(msg => 
      msg.user_id === userId && 
      new Date(msg.created_at).toDateString() === new Date(date).toDateString()
    );
    
    const heatmap = {};
    
    // Inicializar todas as horas com 0
    for (let hour = 0; hour < 24; hour++) {
      heatmap[hour] = 0;
    }
    
    // Contar mensagens por hora
    userMessages.forEach(msg => {
      const hour = new Date(msg.created_at).getHours();
      heatmap[hour]++;
    });
    
    return heatmap;
  }
  
  // Calcular horários de pico
  static calculatePeakHours(heatmap) {
    const hours = Object.entries(heatmap)
      .map(([hour, activity]) => ({ hour: parseInt(hour), activity }))
      .sort((a, b) => b.activity - a.activity);
    
    return hours.slice(0, 3).map(h => h.hour);
  }
  
  // Calcular métricas completas para um usuário
  static async calculateUserMetrics(userId, organizationId, date) {
    try {
      // Buscar mensagens do usuário no dia
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`);
      
      if (error) throw error;
      
      if (!messages || messages.length === 0) {
        return {
          total_usage_time_minutes: 0,
          active_time_minutes: 0,
          idle_time_minutes: 0,
          total_messages_sent: 0,
          total_messages_received: 0,
          avg_response_time_seconds: 0,
          productivity_score: 0,
          efficiency_score: 0,
          activity_heatmap: {},
          peak_hours: []
        };
      }
      
      // Calcular métricas básicas
      const totalUsageTime = this.calculateUsageTime(messages, userId, date);
      const activeTime = this.calculateActiveTime(messages, userId, date);
      const idleTime = totalUsageTime - activeTime;
      
      const sentMessages = messages.filter(m => m.is_from_me).length;
      const receivedMessages = messages.filter(m => !m.is_from_me).length;
      const totalMessages = sentMessages + receivedMessages;
      
      const avgResponseTime = this.calculateAverageResponseTime(messages, userId, date);
      const responseRate = receivedMessages > 0 ? (sentMessages / receivedMessages) * 100 : 0;
      const resolutionRate = 85; // Simulado por enquanto
      
      const heatmap = this.generateActivityHeatmap(messages, userId, date);
      const peakHours = this.calculatePeakHours(heatmap);
      
      // Calcular scores
      const productivityScore = this.calculateProductivityScore({
        totalMessages,
        avgResponseTime: avgResponseTime / 60, // converter para minutos
        responseRate,
        resolutionRate,
        activeTime,
        totalUsageTime
      });
      
      const efficiencyScore = Math.round(
        (responseRate * 0.5) + 
        (Math.max(0, 100 - (avgResponseTime / 60) * 10) * 0.5)
      );
      
      const engagementScore = Math.round(
        (activeTime / Math.max(1, totalUsageTime)) * 100
      );
      
      return {
        total_usage_time_minutes: totalUsageTime,
        active_time_minutes: activeTime,
        idle_time_minutes: idleTime,
        break_time_minutes: 0, // Implementar lógica de pausas
        total_messages_sent: sentMessages,
        total_messages_received: receivedMessages,
        conversations_started: 0, // Implementar lógica de conversas
        conversations_ended: 0,
        avg_response_time_seconds: avgResponseTime,
        response_rate: responseRate,
        resolution_rate: resolutionRate,
        productivity_score: productivityScore,
        efficiency_score: efficiencyScore,
        engagement_score: engagementScore,
        activity_heatmap: heatmap,
        peak_hours: peakHours
      };
      
    } catch (error) {
      console.error('Erro ao calcular métricas do usuário:', error);
      throw error;
    }
  }
  
  // Salvar métricas no banco
  static async saveUserMetrics(userId, organizationId, date, metrics) {
    try {
      // Verificar se já existe um registro para este usuário/organização/data
      const { data: existingRecord, error: checkError } = await supabase
        .from('whatsapp_productivity_metrics')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('date', date)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = "not found", que é esperado se não existir
        throw checkError;
      }
      
      const metricsData = {
        user_id: userId,
        organization_id: organizationId,
        date: date,
        ...metrics,
        updated_at: new Date().toISOString()
      };
      
      let result;
      
      if (existingRecord) {
        // Atualizar registro existente
        const { error: updateError } = await supabase
          .from('whatsapp_productivity_metrics')
          .update(metricsData)
          .eq('id', existingRecord.id);
        
        if (updateError) throw updateError;
        console.log(`✅ Métricas atualizadas para usuário ${userId} em ${date}`);
      } else {
        // Inserir novo registro
        const { error: insertError } = await supabase
          .from('whatsapp_productivity_metrics')
          .insert(metricsData);
        
        if (insertError) throw insertError;
        console.log(`✅ Métricas inseridas para usuário ${userId} em ${date}`);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar métricas:', error);
      throw error;
    }
  }
  
  // Buscar métricas de um usuário
  static async getUserMetrics(userId, organizationId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('whatsapp_productivity_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      throw error;
    }
  }
  
  // Buscar métricas agregadas de todos os usuários da organização
  static async getAggregatedMetrics(organizationId, date) {
    try {
      // Buscar todas as métricas da organização para o dia
      const { data: allMetrics, error } = await supabase
        .from('whatsapp_productivity_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('date', date);
      
      if (error) throw error;
      
      if (!allMetrics || allMetrics.length === 0) {
        return {
          total_usage_time_minutes: 0,
          active_time_minutes: 0,
          idle_time_minutes: 0,
          total_messages_sent: 0,
          total_messages_received: 0,
          avg_response_time_seconds: 0,
          productivity_score: 0,
          efficiency_score: 0,
          engagement_score: 0,
          activity_heatmap: {},
          peak_hours: [],
          total_users: 0,
          users_with_activity: 0
        };
      }
      
      // Agregar métricas
      const aggregated = {
        total_usage_time_minutes: allMetrics.reduce((sum, m) => sum + (m.total_usage_time_minutes || 0), 0),
        active_time_minutes: allMetrics.reduce((sum, m) => sum + (m.active_time_minutes || 0), 0),
        idle_time_minutes: allMetrics.reduce((sum, m) => sum + (m.idle_time_minutes || 0), 0),
        total_messages_sent: allMetrics.reduce((sum, m) => sum + (m.total_messages_sent || 0), 0),
        total_messages_received: allMetrics.reduce((sum, m) => sum + (m.total_messages_received || 0), 0),
        total_users: allMetrics.length,
        users_with_activity: allMetrics.filter(m => (m.total_messages_sent || 0) > 0 || (m.total_messages_received || 0) > 0).length
      };
      
      // Calcular médias
      const activeUsers = allMetrics.filter(m => (m.total_messages_sent || 0) > 0 || (m.total_messages_received || 0) > 0);
      
      if (activeUsers.length > 0) {
        aggregated.avg_response_time_seconds = activeUsers.reduce((sum, m) => sum + (m.avg_response_time_seconds || 0), 0) / activeUsers.length;
        aggregated.productivity_score = Math.round(activeUsers.reduce((sum, m) => sum + (m.productivity_score || 0), 0) / activeUsers.length);
        aggregated.efficiency_score = Math.round(activeUsers.reduce((sum, m) => sum + (m.efficiency_score || 0), 0) / activeUsers.length);
        aggregated.engagement_score = Math.round(activeUsers.reduce((sum, m) => sum + (m.engagement_score || 0), 0) / activeUsers.length);
      } else {
        aggregated.avg_response_time_seconds = 0;
        aggregated.productivity_score = 0;
        aggregated.efficiency_score = 0;
        aggregated.engagement_score = 0;
      }
      
      // Agregar heatmap de atividade
      const heatmap = {};
      for (let hour = 0; hour < 24; hour++) {
        heatmap[hour] = allMetrics.reduce((sum, m) => {
          const userHeatmap = m.activity_heatmap || {};
          return sum + (userHeatmap[hour] || 0);
        }, 0);
      }
      aggregated.activity_heatmap = heatmap;
      
      // Calcular horários de pico
      const hourlyActivity = Object.entries(heatmap)
        .map(([hour, activity]) => ({ hour: parseInt(hour), activity }))
        .sort((a, b) => b.activity - a.activity);
      
      aggregated.peak_hours = hourlyActivity.slice(0, 3).map(h => h.hour);
      
      return aggregated;
      
    } catch (error) {
      console.error('Erro ao buscar métricas agregadas:', error);
      throw error;
    }
  }

  // Processar métricas diárias para todos os usuários
  static async processDailyMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar todos os usuários ativos
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .not('organization_id', 'is', null);
      
      if (usersError) throw usersError;
      
      console.log(`🔄 Processando métricas diárias para ${users.length} usuários...`);
      
      for (const user of users) {
        try {
          const metrics = await this.calculateUserMetrics(user.id, user.organization_id, today);
          await this.saveUserMetrics(user.id, user.organization_id, today, metrics);
          console.log(`✅ Métricas processadas para usuário ${user.id}`);
        } catch (error) {
          console.error(`❌ Erro ao processar métricas para usuário ${user.id}:`, error);
        }
      }
      
      console.log('✅ Processamento de métricas diárias concluído');
      
    } catch (error) {
      console.error('❌ Erro no processamento de métricas diárias:', error);
      throw error;
    }
  }
}
