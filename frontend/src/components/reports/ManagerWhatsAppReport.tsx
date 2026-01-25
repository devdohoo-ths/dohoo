import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  Legend
} from 'recharts';
import {
  Users,
  Clock,
  TrendingUp,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { DatePickerWithRange } from '@/components/DateRangePicker';
import { exportToExcel, exportToCSV, generatePDFReport, ExportData } from '@/utils/reportExporter';
import { useOrganization } from '@/hooks/useOrganization';

// ✅ REMOVIDO: getAuthHeaders local - usar função de apiBase.ts

interface UserUsageData {
  userId: string;
  userName: string;
  userEmail: string;
  dailyUsage: {
    date: string;
    totalMinutes: number;
    activeMinutes: number;
    idleMinutes: number;
    messagesSent: number;
    messagesReceived: number;
    firstMessageTime: string;
    lastMessageTime: string;
    sessions: number;
    avgSessionMinutes: number;
    longestSessionMinutes: number;
    windowMinutes: number;
  }[];
  totalUsage: number;
  avgDailyUsage: number;
  peakUsageDay: string;
  peakUsageMinutes: number;
  totalSessions: number;
  avgSessionDuration: number;
}

interface ManagerReportData {
  users: UserUsageData[];
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalUsageTime: number;
    avgUsageTime: number;
    totalMessages: number;
    avgResponseTime: number;
    peakUsageDay: string;
    peakUsageMinutes: number;
  };
  trends: {
    date: string;
    totalUsage: number;
    activeUsers: number;
    messagesSent: number;
    avgSessionTime: number;
  }[];
  allUsers?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

const ManagerWhatsAppReport: React.FC = () => {
  const { profile } = useAuth();
  const { organization: orgFromHook } = useOrganization();
  const [reportData, setReportData] = useState<ManagerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('yesterday');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const [showHelp, setShowHelp] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // ✅ CORREÇÃO: Usar organização do hook ou do perfil como fallback
  const organization = orgFromHook || (profile?.organization ? {
    id: profile.organization.id,
    name: profile.organization.name,
    status: profile.organization.status
  } : null);

  useEffect(() => {
    fetchReportData();
  }, [selectedPeriod, selectedUser, dateRange, organization]);

  const fetchReportData = async () => {
    if (!organization?.id) {
      console.log('[ManagerReport] Sem organização, pulando busca. Profile:', profile?.organization);
      return;
    }

    try {
      setLoading(true);
      
      let startDate: Date;
      let endDate: Date;
      
      if (dateRange) {
        startDate = new Date(dateRange.from.toISOString().split('T')[0] + 'T00:00:00.000Z');
        endDate = new Date(dateRange.to.toISOString().split('T')[0] + 'T23:59:59.999Z');
      } else {
        let end = new Date();
        let start = new Date();
        
        switch (selectedPeriod) {
          case 'yesterday':
            // D-1: Ontem das 00:00 às 23:59
            start = new Date();
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            break;
          case '24h':
            start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            // Padrão: D-1 (ontem)
            start = new Date();
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
        }
        
        startDate = new Date(start.toISOString().split('T')[0] + 'T00:00:00.000Z');
        endDate = new Date(end.toISOString().split('T')[0] + 'T23:59:59.999Z');
      }
      
      console.log('🏢 [ManagerReport] Organization ID:', organization.id);
      console.log('📅 [ManagerReport] Período:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });
      
      // Buscar dados dos usuários via API primeiro
      console.log('[ManagerReport] Buscando dados dos usuários via API...');
      
      const headers = await getAuthHeaders();
      const usersResponse = await fetch(`${apiBase}/api/users?organization_id=${organization.id}`, {
        headers
      });

      let allUsers = [];
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        console.log('[ManagerReport] Dados dos usuários recebidos:', usersData);
        
        if (usersData.success && usersData.users) {
          allUsers = usersData.users;
        }
      } else {
        console.error('[ManagerReport] Erro ao buscar usuários:', usersResponse.status);
      }

      // Buscar mensagens via API backend (contorna limitação de 1000 do Supabase)
      console.log('[ManagerReport] Buscando mensagens via API backend...');
      console.log('[ManagerReport] Filtro por usuário:', selectedUser);
      const params = new URLSearchParams({
        organization_id: organization.id,
        dateStart: startDate.toISOString(),
        dateEnd: endDate.toISOString(),
        selectedUser: selectedUser || 'all'
      });

      const response = await fetch(`${apiBase}/api/dashboard/whatsapp-report?${params}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const apiData = await response.json();
      
      if (!apiData.success) {
        throw new Error(apiData.error || 'Erro ao buscar dados');
      }

      const messages = apiData.data.messages || [];
      const totalMessagesCount = apiData.data.totalCount || 0;
      
      console.log('[ManagerReport] Dados recebidos da API:', {
        totalCount: totalMessagesCount,
        sampleSize: messages.length,
        period: apiData.data.period
      });

      // Processar dados das mensagens para criar estatísticas por usuário
      const userStats = processMessagesData(messages || [], allUsers, startDate, endDate);
      
      const summary = calculateSummary(userStats, totalMessagesCount);
      const trends = generateTrendData(userStats, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
      
      console.log('[ManagerReport] Dados calculados:', {
        userStats: userStats.length,
        summary,
        trends: trends.length,
        allUsers: allUsers.length
      });
      
      const adaptedData = {
        users: userStats,
        summary,
        trends,
        allUsers: allUsers
      };
      
      console.log('[ManagerReport] Dados finais para setState:', adaptedData);
      setReportData(adaptedData);
      
    } catch (error) {
      console.error('❌ [ManagerReport] Erro ao buscar dados do relatório:', error);
      setReportData({
        users: [],
        summary: {
          totalUsers: 0,
          activeUsers: 0,
          totalUsageTime: 0,
          avgUsageTime: 0,
          totalMessages: 0,
          avgResponseTime: 0,
          peakUsageDay: '',
          peakUsageMinutes: 0
        },
        trends: [],
        allUsers: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para processar dados das mensagens e criar estatísticas por usuário
  const processMessagesData = (messages: any[], allUsers: any[], startDate: Date, endDate: Date): UserUsageData[] => {
    console.log('[ManagerReport] Processando mensagens:', messages.length);
    console.log('[ManagerReport] Usuários disponíveis:', allUsers.length);
    
    // 🎯 CORREÇÃO: Se não há mensagens, retornar array vazio
    if (!messages || messages.length === 0) {
      console.log('[ManagerReport] Nenhuma mensagem encontrada, retornando dados vazios');
      return [];
    }
    
    // Agrupar mensagens por usuário
    const messagesByUser = new Map();
    
    messages.forEach(message => {
      if (message.user_id) {
        if (!messagesByUser.has(message.user_id)) {
          messagesByUser.set(message.user_id, []);
        }
        messagesByUser.get(message.user_id).push(message);
      }
    });
    
    console.log('[ManagerReport] Usuários com mensagens:', messagesByUser.size);
    
    const userStats: UserUsageData[] = [];
    
    // Processar cada usuário que tem mensagens
    messagesByUser.forEach((userMessages, userId) => {
      const user = allUsers.find(u => u.id === userId);
      if (!user) return;
      
      console.log(`[ManagerReport] Processando usuário ${user.name}: ${userMessages.length} mensagens`);
      
      // Calcular dados de uso diário
      const dailyUsage = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const usage = calculateUsageTime(userMessages, userId, dateStr);
        
        // Contar mensagens do dia
        const dayMessages = userMessages.filter(msg => {
          const msgDate = new Date(msg.created_at).toISOString().split('T')[0];
          return msgDate === dateStr;
        });
        
        // Separar mensagens individuais e de grupos
        const individualMessages = dayMessages.filter(msg => !msg.metadata?.is_group_message);
        const groupMessages = dayMessages.filter(msg => msg.metadata?.is_group_message);
        
        const sentMessages = individualMessages.filter(msg => msg.is_from_me).length;
        const receivedMessages = individualMessages.filter(msg => !msg.is_from_me).length;
        
        // Contar mensagens de grupos separadamente
        const groupMessagesSent = groupMessages.filter(msg => msg.is_from_me).length;
        const groupMessagesReceived = groupMessages.filter(msg => !msg.is_from_me).length;
        
        if (dayMessages.length > 0) {
          console.log(`[ManagerReport] ${dateStr}: ${dayMessages.length} mensagens (${sentMessages} enviadas, ${receivedMessages} recebidas)`);
        }
        
        dailyUsage.push({
          date: dateStr,
          totalMinutes: usage.totalMinutes,
          activeMinutes: usage.activeMinutes,
          idleMinutes: usage.idleMinutes,
          messagesSent: sentMessages,
          messagesReceived: receivedMessages,
          groupMessagesSent: groupMessagesSent,
          groupMessagesReceived: groupMessagesReceived,
          firstMessageTime: usage.firstMessageTime,
          lastMessageTime: usage.lastMessageTime,
          sessions: usage.sessions,
          avgSessionMinutes: usage.avgSessionMinutes,
          longestSessionMinutes: usage.longestSessionMinutes,
          windowMinutes: usage.windowMinutes
        });
      }
      
      const totalUsage = dailyUsage.reduce((sum, day) => sum + day.totalMinutes, 0);
      
      // 🎯 CORREÇÃO: Calcular média apenas dos dias com atividade (> 0 minutos)
      const activeDays = dailyUsage.filter(day => day.totalMinutes > 0);
      const avgDailyUsage = activeDays.length > 0 ? totalUsage / activeDays.length : 0;
      
      console.log(`[ManagerReport] ${user.name}: ${totalUsage}min total, ${activeDays.length} dias ativos de ${dailyUsage.length} dias, média: ${Math.round(avgDailyUsage)}min/dia`);
      
      // Calcular métricas de sessão
      const totalSessions = dailyUsage.reduce((sum, day) => sum + day.sessions, 0);
      const avgSessionDuration = totalSessions > 0 ? Math.round(totalUsage / totalSessions) : 0;
      
      // Encontrar dia de pico
      const peakDay = dailyUsage.reduce((max, day) => 
        day.totalMinutes > max.totalMinutes ? day : max, dailyUsage[0] || { totalMinutes: 0, date: '' });
      
      userStats.push({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        dailyUsage,
        totalUsage,
        avgDailyUsage,
        peakUsageDay: peakDay.date,
        peakUsageMinutes: peakDay.totalMinutes,
        totalSessions,
        avgSessionDuration
      });
    });
    
    console.log('[ManagerReport] Usuários processados:', userStats.length);
    return userStats;
  };

  // Função para calcular resumo geral
  const calculateSummary = (userStats: UserUsageData[], realTotalMessages?: number) => {
    // 🎯 CORREÇÃO: Se não há usuários com dados, retornar resumo vazio
    if (!userStats || userStats.length === 0) {
      console.log('[ManagerReport] Nenhum usuário com dados, retornando resumo vazio');
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalUsageTime: 0,
        avgUsageTime: 0,
        totalMessages: realTotalMessages || 0,
        avgResponseTime: 0,
        peakUsageDay: '',
        peakUsageMinutes: 0
      };
    }
    
    const totalUsers = userStats.length;
    const activeUsers = userStats.filter(user => user.totalUsage > 0).length;
    
    const totalUsageTime = userStats.reduce((sum, user) => sum + user.totalUsage, 0);
    
    // Usar o count real da API se fornecido, senão calcular da amostra
    const totalMessages = realTotalMessages !== undefined ? realTotalMessages : userStats.reduce((sum, user) => {
      const userMessages = user.dailyUsage.reduce((daySum, day) => daySum + day.messagesSent + day.messagesReceived, 0);
      console.log(`[ManagerReport] Usuário ${user.userName}: ${userMessages} mensagens`);
      return sum + userMessages;
    }, 0);
    
    console.log(`[ManagerReport] Total de mensagens ${realTotalMessages !== undefined ? '(count real da API)' : '(calculado da amostra)'}: ${totalMessages}`);
    
    const avgUsageTime = activeUsers > 0 ? totalUsageTime / activeUsers : 0;
    
    // Encontrar dia de pico geral
    const allDailyUsage = userStats.flatMap(user => user.dailyUsage);
    const peakDay = allDailyUsage.reduce((max, day) => 
      day.totalMinutes > max.totalMinutes ? day : max, allDailyUsage[0] || { totalMinutes: 0, date: '' });
    
    const result = {
      totalUsers,
      activeUsers,
      totalUsageTime,
      avgUsageTime,
      totalMessages,
      avgResponseTime: 0, // Não calculado neste relatório
      peakUsageDay: peakDay.date,
      peakUsageMinutes: peakDay.totalMinutes
    };
    
    console.log('[ManagerReport] Summary calculado:', result);
    return result;
  };

  // Função para calcular tempo de uso baseado em sessões ativas
  const calculateUsageTime = (messages: any[], userId: string, date: string) => {
    const userMessages = messages.filter(msg => {
      const msgDate = new Date(msg.created_at).toISOString().split('T')[0];
      return msg.user_id === userId && msgDate === date;
    });
    
    if (userMessages.length === 0) {
      return { 
        totalMinutes: 0, 
        activeMinutes: 0, 
        idleMinutes: 0,
        firstMessageTime: '',
        lastMessageTime: '',
        sessions: 0,
        avgSessionMinutes: 0,
        longestSessionMinutes: 0
      };
    }
    
    // Ordenar mensagens por timestamp
    const sortedMessages = userMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const firstMessage = sortedMessages[0];
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    
    const startTime = new Date(firstMessage.created_at);
    const endTime = new Date(lastMessage.created_at);
    
    // 🎯 NOVA LÓGICA: Calcular sessões ativas
    const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutos de inatividade = nova sessão
    const MIN_SESSION_TIME = 1; // Mínimo 1 minuto por sessão
    
    const sessions = [];
    let currentSession = {
      start: new Date(sortedMessages[0].created_at),
      end: new Date(sortedMessages[0].created_at),
      messages: 1
    };
    
    // Agrupar mensagens em sessões
    for (let i = 1; i < sortedMessages.length; i++) {
      const currentMsg = new Date(sortedMessages[i].created_at);
      const timeSinceLastMsg = currentMsg.getTime() - currentSession.end.getTime();
      
      if (timeSinceLastMsg <= SESSION_TIMEOUT) {
        // Continua na mesma sessão
        currentSession.end = currentMsg;
        currentSession.messages++;
      } else {
        // Nova sessão
        sessions.push(currentSession);
        currentSession = {
          start: currentMsg,
          end: currentMsg,
          messages: 1
        };
      }
    }
    
    // Adicionar última sessão
    sessions.push(currentSession);
    
    // Calcular métricas das sessões
    let totalActiveMinutes = 0;
    let longestSessionMinutes = 0;
    
    sessions.forEach(session => {
      const sessionDuration = Math.max(
        MIN_SESSION_TIME, 
        Math.round((session.end.getTime() - session.start.getTime()) / (1000 * 60))
      );
      totalActiveMinutes += sessionDuration;
      longestSessionMinutes = Math.max(longestSessionMinutes, sessionDuration);
    });
    
    const avgSessionMinutes = sessions.length > 0 ? Math.round(totalActiveMinutes / sessions.length) : 0;
    
    // Janela total (primeira até última mensagem) - para referência
    const totalWindowMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    const result = {
      totalMinutes: totalActiveMinutes, // 🎯 AGORA É O TEMPO REAL DE USO
      activeMinutes: totalActiveMinutes,
      idleMinutes: Math.max(0, totalWindowMinutes - totalActiveMinutes),
      firstMessageTime: startTime.toLocaleTimeString('pt-BR'),
      lastMessageTime: endTime.toLocaleTimeString('pt-BR'),
      sessions: sessions.length,
      avgSessionMinutes,
      longestSessionMinutes,
      windowMinutes: totalWindowMinutes // Janela total para referência
    };
    
    console.log(`[ManagerReport] 📊 CÁLCULO DE SESSÕES PARA ${date}:`);
    console.log(`  📨 ${userMessages.length} mensagens encontradas`);
    console.log(`  ⏱️ Janela total: ${totalWindowMinutes}min (${startTime.toLocaleTimeString()} → ${endTime.toLocaleTimeString()})`);
    console.log(`  🎯 ${sessions.length} sessões ativas identificadas:`);
    
    sessions.forEach((session, index) => {
      const duration = Math.max(MIN_SESSION_TIME, Math.round((session.end.getTime() - session.start.getTime()) / (1000 * 60)));
      console.log(`    📍 Sessão ${index + 1}: ${session.start.toLocaleTimeString()} → ${session.end.toLocaleTimeString()} = ${duration}min (${session.messages} msgs)`);
    });
    
    console.log(`  ✅ TEMPO REAL DE USO: ${totalActiveMinutes} minutos`);
    console.log(`  📈 Eficiência: ${totalActiveMinutes}min de ${totalWindowMinutes}min = ${Math.round((totalActiveMinutes/totalWindowMinutes)*100)}%`);
    return result;
  };

  // Funções antigas removidas - agora usando lógica direta do Supabase

  const generateTrendData = (users: UserUsageData[], startDate: string, endDate: string) => {
    // 🎯 CORREÇÃO: Se não há usuários com dados, retornar array vazio
    if (!users || users.length === 0) {
      console.log('[ManagerReport] Nenhum usuário com dados, retornando trends vazios');
      return [];
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const trends = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayData = users.flatMap(user => 
        user.dailyUsage.filter(day => day.date === dateStr)
      );
      
      const totalUsage = dayData.reduce((sum, day) => sum + day.totalMinutes, 0);
      const activeUsers = dayData.length;
      const messagesSent = dayData.reduce((sum, day) => sum + day.messagesSent, 0);
      const avgSessionTime = dayData.length > 0 ? totalUsage / dayData.length : 0;
      
      trends.push({
        date: d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        totalUsage,
        activeUsers,
        messagesSent,
        avgSessionTime
      });
    }
    
    return trends;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReportData();
    setRefreshing(false);
  };

  // Função para converter dados para formato de exportação
  const convertToExportData = (data: ManagerReportData): ExportData => {
    return {
      summary: {
        totalUsers: data.summary.totalUsers,
        activeUsers: data.summary.activeUsers,
        totalUsageTime: data.summary.totalUsageTime,
        avgUsageTime: data.summary.avgUsageTime,
        totalMessages: data.summary.totalMessages,
        avgResponseTime: data.summary.avgResponseTime,
        avgProductivity: 0, // Não calculamos mais
        avgEfficiency: 0 // Não calculamos mais
      },
      users: data.users.map(user => {
        // Calcular totais de mensagens do usuário (mesmo cálculo da interface web)
        const totalMessages = user.dailyUsage.reduce((sum, day) => 
          sum + day.messagesSent + day.messagesReceived, 0
        );
        const totalMessagesSent = user.dailyUsage.reduce((sum, day) => sum + day.messagesSent, 0);
        const totalMessagesReceived = user.dailyUsage.reduce((sum, day) => sum + day.messagesReceived, 0);
        
        return {
          user: {
            id: user.userId,
            name: user.userName,
            email: user.userEmail
          },
          // 🎯 CORREÇÃO: Criar apenas uma entrada com totais consolidados
          metrics: [{
            date: 'total', // Indicador de que são dados consolidados
            total_usage_time_minutes: user.totalUsage,
            active_time_minutes: user.totalUsage, // Usando o mesmo valor (tempo real de sessões)
            idle_time_minutes: 0,
            total_messages_sent: totalMessages, // 🎯 USANDO TOTAL COMBINADO
            total_messages_received: 0, // Zerando para evitar duplicação
            avg_response_time_seconds: 0,
            productivity_score: 0,
            efficiency_score: 0
          }]
        };
      }),
      trends: data.trends.map(trend => ({
        date: trend.date,
        total_usage: trend.totalUsage,
        active_usage: trend.totalUsage,
        users_online: trend.activeUsers,
        messages_sent: trend.messagesSent
      }))
    };
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatSeconds = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };


  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Carregando relatório de uso do WhatsApp...</span>
        </div>
      </div>
    );
  }

  // Sempre mostrar a interface, mesmo sem dados
  console.log('[ManagerReport] reportData no render:', reportData);

  const { summary, trends, users, allUsers } = reportData || { summary: { totalUsers: 0, activeUsers: 0, totalUsageTime: 0, avgUsageTime: 0, totalMessages: 0, avgResponseTime: 0, peakUsageDay: '', peakUsageMinutes: 0 }, trends: [], users: [], allUsers: [] };
  
  console.log('[ManagerReport] Dados desestruturados:', { 
    summary: {
      totalUsers: summary.totalUsers,
      activeUsers: summary.activeUsers,
      totalMessages: summary.totalMessages,
      totalUsageTime: summary.totalUsageTime
    }, 
    trends: trends.length, 
    users: users.length, 
    allUsers: allUsers.length 
  });
  
  // Resetar filtro se o usuário selecionado não existe mais nos dados
  const selectedUserExists = selectedUser === 'all' || users.some(u => u.userId === selectedUser);
  if (!selectedUserExists && users.length > 0) {
    setSelectedUser('all');
  }
  
  const filteredUsers = selectedUser === 'all' ? users : users.filter(u => u.userId === selectedUser);
  
  console.log('🔍 [ManagerReport] Filtro aplicado:', {
    selectedUser,
    filteredUsersCount: filteredUsers.length,
    filteredUsers: filteredUsers.map(u => ({ id: u.userId, name: u.userName }))
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl text-gray-900 font-bold">Relatório de Uso do WhatsApp</h1>
          <p className="text-sm text-gray-600 mt-1">Tempo de uso diário por usuário (00:01 - 23:59)</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setShowHelp(true)}
            variant="outline"
            size="sm"
            title="Ajuda - Como funciona este relatório"
            className="text-xs"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Ajuda
          </Button>
          
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {/* Botões de Exportação */}
          <div className="flex items-center gap-1">
            <Button
              onClick={() => reportData && exportToExcel(convertToExportData(reportData))}
              variant="outline"
              size="sm"
              disabled={!reportData}
              className="text-xs px-2"
              title="Exportar para Excel"
            >
              <Download className="h-3 w-3 mr-1" />
              Excel
            </Button>
            
            <Button
              onClick={() => reportData && exportToCSV(convertToExportData(reportData))}
              variant="outline"
              size="sm"
              disabled={!reportData}
              className="text-xs px-2"
              title="Exportar para CSV"
            >
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
            
            <Button
              onClick={() => reportData && generatePDFReport(convertToExportData(reportData))}
              variant="outline"
              size="sm"
              disabled={!reportData}
              className="text-xs px-2"
              title="Exportar para PDF"
            >
              <Download className="h-3 w-3 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yesterday">D-1 (Ontem)</SelectItem>
            <SelectItem value="24h">Últimas 24h</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={selectedUser} 
          onValueChange={setSelectedUser}
          disabled={!allUsers || allUsers.length === 0}
        >
          <SelectTrigger className="w-48">
          <SelectValue placeholder={
            !allUsers || allUsers.length === 0 
              ? "Carregando usuários..." 
              : selectedUser === '' 
                ? "Selecionar usuário"
                : selectedUser === 'all'
                  ? "Todos os usuários"
                  : (allUsers || []).find(u => u.id === selectedUser)?.name || "Usuário selecionado"
          } />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {(allUsers || users.map(u => ({ id: u.userId, name: u.userName }))).map(user => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPeriod === 'custom' && (
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
        )}
      </div>

      {/* Mensagem quando não há dados */}
      {(!reportData || reportData.users.length === 0) && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg text-gray-900 mb-2">Nenhum dado encontrado</h3>
              <p className="text-gray-600 mb-2">Não há usuários com atividade de mensagens no período selecionado.</p>
              <p className="text-sm text-gray-500">
                Tente selecionar um período diferente ou verifique se há mensagens no sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      )}


      {reportData && reportData.users.length > 0 && (
        <>
          {/* Tabela de Tempo de Uso do WhatsApp */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4 text-blue-600" />
                Resumo de Tempo de Uso do WhatsApp
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Visão rápida do tempo de uso por usuário para análise gerencial
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3">Usuário</th>
                      <th className="text-center p-3">Tempo Total</th>
                    <th className="text-center p-3 bg-green-100 border-l-4 border-green-500 text-green-800">
                      Tempo Médio/Dia Ativo
                      <div className="text-xs font-normal text-green-600">Tempo Real de Uso</div>
                    </th>
                    <th className="text-center p-3">Sessões</th>
                    <th className="text-center p-3">Sessão Média</th>
                    <th className="text-center p-3">Tempo Ocioso</th>
                    <th className="text-center p-3">Msgs Enviadas</th>
                    <th className="text-center p-3">Msgs Recebidas</th>
                    <th className="text-center p-3">Total Msgs</th>
                    <th className="text-center p-3">Grupos Enviadas</th>
                    <th className="text-center p-3">Grupos Recebidas</th>
                    <th className="text-center p-3">Primeira Mensagem</th>
                    <th className="text-center p-3">Última Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => {
                      // Calcular tempo ocioso total somando os idleMinutes de todos os dias
                      const totalIdleTime = user.dailyUsage.reduce((sum, day) => sum + day.idleMinutes, 0);
                      
                      // Calcular mensagens enviadas, recebidas e total
                      const messagesSent = user.dailyUsage.reduce((sum, day) => sum + day.messagesSent, 0);
                      const messagesReceived = user.dailyUsage.reduce((sum, day) => sum + day.messagesReceived, 0);
                      const totalMessages = messagesSent + messagesReceived;
                      
                      // Calcular mensagens de grupos (usando metadata.is_group_message)
                      const groupMessagesSent = user.dailyUsage.reduce((sum, day) => sum + (day.groupMessagesSent || 0), 0);
                      const groupMessagesReceived = user.dailyUsage.reduce((sum, day) => sum + (day.groupMessagesReceived || 0), 0);
                      
                      // Encontrar primeira e última mensagem de todos os dias do usuário
                      let firstMessageTime = null;
                      let lastMessageTime = null;
                      
                      user.dailyUsage.forEach(day => {
                        if (day.firstMessageTime && day.lastMessageTime) {
                          if (!firstMessageTime || day.firstMessageTime < firstMessageTime) {
                            firstMessageTime = day.firstMessageTime;
                          }
                          if (!lastMessageTime || day.lastMessageTime > lastMessageTime) {
                            lastMessageTime = day.lastMessageTime;
                          }
                        }
                      });
                      
                      return (
                        <tr key={user.userId} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-3">
                            <div className="flex items-center">
                              <div>
                                <div className="text-gray-900">{user.userName}</div>
                              </div>
                            </div>
                          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {formatTime(user.totalUsage)}
            </div>
          </td>
          <td className="p-3 text-center bg-green-50 border-l-4 border-green-500">
            <div className="text-green-700">
              {formatTime(user.avgDailyUsage)}
            </div>
            <div className="text-xs text-green-600">
              tempo real/dia
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {user.totalSessions}
            </div>
            <div className="text-xs text-gray-500">
              sessões
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {formatTime(user.avgSessionDuration)}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {formatTime(totalIdleTime)}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {messagesSent.toLocaleString()}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {messagesReceived.toLocaleString()}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {totalMessages.toLocaleString()}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {groupMessagesSent.toLocaleString()}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {groupMessagesReceived.toLocaleString()}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {firstMessageTime || '--:--'}
            </div>
          </td>
          <td className="p-3 text-center">
            <div className="text-black">
              {lastMessageTime || '--:--'}
            </div>
          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Legenda Expansível */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <button 
                  onClick={() => setIsLegendOpen(!isLegendOpen)}
                  className="flex items-center gap-2 w-full text-left text-gray-700 hover:text-gray-900"
                >
                  <span>Legenda</span>
                  <span className="text-sm">
                    {isLegendOpen ? '▼' : '▶'}
                  </span>
                </button>
                
                {isLegendOpen && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Tempo Médio/Dia Ativo:</span>
                      <span>Média apenas dos dias com atividade (exclui dias sem uso)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Sessões:</span>
                      <span>Número de sessões ativas (intervalo ≤ 10min)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Sessão Média:</span>
                      <span>Duração média de cada sessão de uso</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Tempo Ocioso:</span>
                      <span>Tempo total menos tempo ativo (intervalos &gt; 5min)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Msgs Enviadas:</span>
                      <span>Total de mensagens enviadas pelo usuário</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Msgs Recebidas:</span>
                      <span>Total de mensagens recebidas pelo usuário</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Total Msgs:</span>
                      <span>Soma de mensagens enviadas e recebidas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Grupos Enviadas:</span>
                      <span>Mensagens enviadas em grupos/canais</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Grupos Recebidas:</span>
                      <span>Mensagens recebidas em grupos/canais</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Primeira Mensagem:</span>
                      <span>Horário da primeira mensagem no período</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Última Mensagem:</span>
                      <span>Horário da última mensagem no período</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gráficos lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Curva de Crescimento - Evolução Temporal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Evolução do Uso do WhatsApp
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Tendência de uso ao longo do período
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Data', position: 'insideBottom', offset: -5, style: { fontSize: 12 } }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Tempo (min)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Quantidade', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'totalUsage' || name === 'avgSessionTime' ? formatTime(value as number) : value,
                      name === 'totalUsage' ? 'Tempo Total' : 
                      name === 'activeUsers' ? 'Usuários Ativos' :
                      name === 'messagesSent' ? 'Mensagens Enviadas' : 'Tempo Médio por Sessão'
                    ]}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    iconType="line"
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalUsage"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    name="Tempo Total"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="activeUsers"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Usuários Ativos"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="messagesSent"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Mensagens Enviadas"
                  />
                </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Barras - Comparação por Usuário */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  Comparação por Usuário
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo total vs média diária por usuário
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={filteredUsers.map(user => ({
                    name: user.userName.split(' ')[0],
                    totalUsage: user.totalUsage,
                    avgDailyUsage: user.avgDailyUsage,
                    peakUsage: user.peakUsageMinutes
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Usuário', position: 'insideBottom', offset: -5, style: { fontSize: 12 } }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Tempo (min)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        formatTime(value as number),
                        name === 'totalUsage' ? 'Tempo Total' : 
                        name === 'avgDailyUsage' ? 'Média Diária' : 'Pico Diário'
                      ]}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    />
                    <Bar dataKey="totalUsage" fill="#3b82f6" name="Tempo Total" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgDailyUsage" fill="#10b981" name="Média Diária" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>


        </>
      )}

      {/* Modal de Ajuda */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <AlertCircle className="h-5 w-5 text-blue-600" />
              Como funciona o Relatório de Uso do WhatsApp
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Visão Geral */}
            <div>
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Visão Geral
              </h3>
              <p className="text-gray-700 mb-3">
                Este relatório analisa o tempo de uso do WhatsApp por cada usuário da sua organização, 
                calculando métricas de produtividade baseadas nas mensagens enviadas e recebidas.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-blue-800 text-sm">
                  <strong>💡 Importante:</strong> Os cálculos são baseados em dados reais das mensagens 
                  armazenadas no sistema, garantindo precisão nas métricas apresentadas.
                </p>
              </div>
            </div>

            {/* Como Funciona */}
            <div>
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Como Calculamos o Tempo de Uso
              </h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="text-blue-900 mb-3">🎯 1. Como Calculamos o Tempo Real de Uso</h4>
                  
                  <div className="space-y-3">
                  <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                      <h5 className="text-blue-800 mb-2">📋 Metodologia de Sessões Ativas:</h5>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• <strong>Sessão:</strong> Grupo de mensagens com intervalo ≤ 10 minutos</li>
                        <li>• <strong>Nova Sessão:</strong> Criada após 10+ minutos de inatividade</li>
                        <li>• <strong>Tempo Real:</strong> Soma apenas das sessões ativas</li>
                      </ul>
                    </div>

                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      <h5 className="text-green-800 mb-2">💡 Exemplo Prático Detalhado:</h5>
                      <div className="text-xs text-green-700 space-y-2">
                        <div><strong>Mensagens do usuário:</strong></div>
                        <div className="ml-2 space-y-1">
                          <div>• 08:00 - "Bom dia!"</div>
                          <div>• 08:05 - "Como está?"</div>
                          <div>• 08:15 - "Perfeito!"</div>
                          <div className="text-red-600">• [25 minutos sem mensagens]</div>
                          <div>• 08:40 - "Vou almoçar"</div>
                          <div className="text-red-600">• [3 horas sem mensagens]</div>
                          <div>• 14:30 - "Voltei"</div>
                          <div>• 14:35 - "Vamos continuar"</div>
                          <div>• 14:45 - "Até mais"</div>
                        </div>
                        
                        <div className="mt-3 p-2 bg-white rounded">
                          <div><strong>Cálculo das Sessões:</strong></div>
                          <div className="ml-2 space-y-1">
                            <div>📍 <strong>Sessão 1:</strong> 08:00 → 08:15 = 15 minutos</div>
                            <div>📍 <strong>Sessão 2:</strong> 08:40 → 08:40 = 1 minuto (mínimo)</div>
                            <div>📍 <strong>Sessão 3:</strong> 14:30 → 14:45 = 15 minutos</div>
                            <div className="text-green-800">🎯 <strong>Tempo Real:</strong> 15 + 1 + 15 = 31 minutos</div>
                          </div>
                        </div>

                        <div className="mt-2 p-2 bg-red-50 rounded text-red-700">
                          <strong>❌ Método Antigo (Incorreto):</strong><br/>
                          08:00 → 14:45 = 6h 45min (irreal!)
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                      <h5 className="text-yellow-800 mb-2">⚙️ Configurações:</h5>
                      <div className="text-xs text-yellow-700 space-y-1">
                        <div>• <strong>Timeout de Sessão:</strong> 10 minutos</div>
                        <div>• <strong>Sessão Mínima:</strong> 1 minuto</div>
                        <div>• <strong>Precisão:</strong> Arredondado para minutos</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-gray-900 mb-2">2. Tempo Ativo</h4>
                  <p className="text-gray-700 text-sm mb-2">
                    Soma dos intervalos entre mensagens consecutivas ≤ 5 minutos:
                  </p>
                  <div className="bg-white p-3 rounded border-l-4 border-green-500">
                    <code className="text-sm text-green-700">
                      Se intervalo ≤ 5min → Tempo Ativo{'\n'}
                      Se intervalo {'>'} 5min → Tempo Ocioso
                    </code>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-gray-900 mb-2">3. Tempo Ocioso</h4>
                  <p className="text-gray-700 text-sm mb-2">
                    Diferença entre o tempo total e o tempo ativo:
                  </p>
                  <div className="bg-white p-3 rounded border-l-4 border-yellow-500">
                    <code className="text-sm text-yellow-700">
                      Tempo Ocioso = Tempo Total - Tempo Ativo
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div>
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Métricas Calculadas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-blue-900 mb-2">📊 Usuários Ativos</h4>
                  <p className="text-blue-800 text-sm">
                    Usuários que enviaram ou receberam pelo menos uma mensagem no período selecionado.
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="text-green-900 mb-2">⏱️ Tempo Médio</h4>
                  <p className="text-green-800 text-sm">
                    Média do tempo total de uso dividido pelo número de usuários ativos.
                  </p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="text-orange-900 mb-2">⏸️ Tempo Ocioso</h4>
                  <p className="text-orange-800 text-sm">
                    Tempo em que o usuário não estava ativamente usando o WhatsApp (intervalos maiores que 5 minutos).
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="text-purple-900 mb-2">🕐 Primeira/Última Mensagem</h4>
                  <p className="text-purple-800 text-sm">
                    Horário da primeira e última mensagem do dia selecionado. Reseta quando os filtros são alterados.
                  </p>
                </div>
              </div>
            </div>

            {/* Gráficos */}
            <div>
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                Gráficos Disponíveis
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="">Evolução do Uso do WhatsApp</h4>
                    <p className="text-sm text-gray-600">
                      Gráfico combinado mostrando tempo total, usuários ativos e mensagens enviadas ao longo do tempo.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="">Comparação por Usuário</h4>
                    <p className="text-sm text-gray-600">
                      Gráfico de barras comparando tempo total e média diária de cada usuário.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="">Crescimento Individual</h4>
                    <p className="text-sm text-gray-600">
                      Gráfico de linha mostrando a evolução do uso de cada usuário ao longo dos dias.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div>
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-600" />
                Como Usar os Filtros
              </h3>
              <div className="space-y-3">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="text-yellow-900 mb-2">📅 Seleção de Período</h4>
                  <ul className="text-yellow-800 text-sm space-y-1">
                    <li>• <strong>D-1 (Ontem):</strong> Dados consolidados do dia anterior (00:00 às 23:59)</li>
                    <li>• <strong>Últimas 24h:</strong> Dados das últimas 24 horas</li>
                    <li>• <strong>Últimos 7 dias:</strong> Dados da última semana</li>
                    <li>• <strong>Últimos 30 dias:</strong> Dados do último mês</li>
                    <li>• <strong>Personalizado:</strong> Escolha datas específicas</li>
                  </ul>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="text-green-900 mb-2">👥 Filtro de Usuários</h4>
                  <p className="text-green-800 text-sm">
                    Selecione "Todos os usuários" para ver dados gerais ou escolha um usuário específico 
                    para análise individual detalhada.
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela de Resumo */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-600" />
                Tabela de Resumo de Uso
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">📊</span>
                  <span><strong>Tempo Total:</strong> Tempo total de uso do WhatsApp no período selecionado</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">⏱️</span>
                  <span><strong>Tempo Médio/Dia:</strong> Média de tempo de uso por dia</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">⏸️</span>
                  <span><strong>Tempo Ocioso:</strong> Períodos de inatividade (intervalos maiores que 5 minutos entre mensagens)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">🔄</span>
                  <span><strong>Sessões:</strong> Grupos de atividade contínua (intervalo ≤ 10 minutos)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">📤</span>
                  <span><strong>Msgs Enviadas:</strong> Total de mensagens enviadas pelo usuário no período</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">📥</span>
                  <span><strong>Msgs Recebidas:</strong> Total de mensagens recebidas pelo usuário no período</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-800">📊</span>
                  <span><strong>Total Msgs:</strong> Soma de todas as mensagens (enviadas + recebidas)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-600">👥📤</span>
                  <span><strong>Grupos Enviadas:</strong> Mensagens enviadas em grupos e canais do WhatsApp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600">👥📥</span>
                  <span><strong>Grupos Recebidas:</strong> Mensagens recebidas em grupos e canais do WhatsApp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">🕐</span>
                  <span><strong>Primeira Mensagem:</strong> Horário da primeira mensagem enviada ou recebida no período</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600">🕕</span>
                  <span><strong>Última Mensagem:</strong> Horário da última mensagem enviada ou recebida no período</span>
                </li>
              </ul>
            </div>

            {/* Dicas */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Dicas de Uso
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">💡</span>
                  <span>Use períodos menores (24h-7d) para análises detalhadas de produtividade diária.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">📈</span>
                  <span>Períodos maiores (30d) são ideais para identificar tendências e padrões de uso.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">🎯</span>
                  <span>Compare usuários individuais para identificar melhores práticas e oportunidades de melhoria.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">⚡</span>
                  <span>Use os dados de tempo de uso e mensagens para tomar decisões baseadas em dados.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowHelp(false)} className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerWhatsAppReport;
