import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Search, User, Phone, MessageCircle, Eye, Filter, RefreshCw, Brain } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
import { logger } from '@/utils/logger';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import io, { Socket } from 'socket.io-client';

interface DetailedConversation {
  id: string;
  date: string;
  user_name: string;
  customer_name: string;
  customer_phone: string;
  customer_name_whatsapp: string; // ✅ NOVA: Nome do WhatsApp
  customer_avatar_url?: string; // ✅ NOVA: Foto do cliente
  messages_sent: number;
  messages_received: number;
  total_messages: number;
  last_message_time: string;
  chat_id: string;
  status: string;
  // 🎯 NOVAS: Propriedades para estatísticas
  totalMessages?: number;
  actualSentMessages?: number;
  actualReceivedMessages?: number;
}

interface ConversationMessage {
  id: string;
  content: string;
  message_type: string;
  media_url?: string;
  is_from_me: boolean;
  sender_name: string;
  created_at: string;
  metadata?: {
    is_broadcast_message?: boolean;
    broadcast_list?: string;
    recipient_count?: number;
    recipient_phone?: string;
    is_group_message?: boolean;
    [key: string]: any;
  };
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  userId: string;
  customerName: string;
  keyword: string;
}

const ReportDetailedConversations: React.FC = () => {
  const { organization } = useOrganization();
  const { toast } = useToast();
  
  const [conversations, setConversations] = useState<DetailedConversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<DetailedConversation[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<DetailedConversation | null>(null);
  const [conversationDetails, setConversationDetails] = useState<ConversationMessage[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  
  // Estados para resumo com IA
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [conversationSummary, setConversationSummary] = useState<string>('');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  
  // 🎯 NOVO: Estado para estatísticas corretas do dashboard
  const [stats, setStats] = useState({
    totalMessages: 0,
    sentMessages: 0,
    receivedMessages: 0,
    totalConversations: 0
  });

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  
  // Usar apenas o dia atual por padrão
  const getDefaultDateRange = () => {
    const today = new Date();
    
    return {
      startDate: format(today, 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd')
    };
  };
  
  const [filters, setFilters] = useState<ReportFilters>({
    ...getDefaultDateRange(),
    userId: '',
    customerName: '',
    keyword: ''
  });

  // 🎯 NOVO: Estado para armazenar o count real de mensagens
  const [realTotalMessages, setRealTotalMessages] = useState(0);

  // Função para calcular estatísticas baseadas nas conversas filtradas
  const calculateStatsFromConversations = useCallback(() => {
    logger.debug('[Relatório Detalhado] Calculando estatísticas das conversas filtradas', {
      totalConversations: filteredConversations.length,
      sampleConversation: filteredConversations[0]
    });

    if (filteredConversations.length === 0) {
      setStats({
        totalMessages: 0,
        sentMessages: 0,
        receivedMessages: 0,
        totalConversations: 0
      });
      return;
    }

    // 🎯 CORREÇÃO: Usar count real para total de mensagens, calcular proporções para enviadas/recebidas
    const totalMessages = realTotalMessages; // Usar o count real obtido da query
    const sentMessages = filteredConversations.reduce((sum, conv) => sum + (conv.actualSentMessages || 0), 0);
    const receivedMessages = filteredConversations.reduce((sum, conv) => sum + (conv.actualReceivedMessages || 0), 0);
    const totalConversations = filteredConversations.length;

    logger.debug('[Relatório Detalhado] Estatísticas calculadas', {
      totalMessages,
      sentMessages,
      receivedMessages,
      totalConversations,
      sampleConversation: filteredConversations[0] ? {
        id: filteredConversations[0].id,
        totalMessages: filteredConversations[0].totalMessages,
        actualSentMessages: filteredConversations[0].actualSentMessages,
        actualReceivedMessages: filteredConversations[0].actualReceivedMessages
      } : null
    });

    setStats({
      totalMessages,
      sentMessages,
      receivedMessages,
      totalConversations
    });
  }, [filteredConversations, realTotalMessages]);

  // Funções para paginação
  const getPaginatedConversations = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredConversations.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredConversations.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = getTotalPages();
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Buscar todos os usuários da organização
  const fetchAllUsers = useCallback(async () => {
    if (!organization?.id) {
      return;
    }
    
    try {
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users?organization_id=${organization.id}`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Erro na requisição de usuários: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar usuários');
      }
      
      const usersList = (result.users || []).map((user: any) => ({
        id: user.id,
        full_name: user.name || user.full_name || 'Usuário sem nome'
      }));
      
    setUsers(usersList);
      
    } catch (error) {
      // Em caso de erro, tentar extrair usuários das conversas como fallback
    }
  }, [organization?.id]);



  // Buscar conversas usando a mesma abordagem do dashboard
  const fetchConversations = useCallback(async () => {
    if (!organization?.id) {
      logger.debug('[Relatório Detalhado] Sem organização, pulando busca');
      return;
    }
    
    console.log('🔍 [Relatório Detalhado] Iniciando busca de conversas...');
    setLoading(true);
    setError(null);
    
    try {
      logger.debug('[Relatório Detalhado] Iniciando busca de conversas com filtros', filters);
      console.log('🔍 [Relatório Detalhado] Filtros aplicados:', filters);
      
      // Montar parâmetros da requisição igual aos outros relatórios
      const params = new URLSearchParams();
      
      // ✅ CORREÇÃO: Usar EXATAMENTE a mesma lógica do teste
      // O teste usa new Date() que cria no timezone local, então vamos fazer igual
      // Quando você faz new Date('2025-11-18'), isso cria em UTC, não local
      // Precisamos criar a data a partir dos componentes (ano, mês, dia) no timezone local
      
      // Parsear a data do filtro no formato yyyy-MM-dd
      const parseLocalDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        // month - 1 porque Date usa 0-11 para meses
        return new Date(year, month - 1, day);
      };
      
      const startDateObj = parseLocalDate(filters.startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = parseLocalDate(filters.endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      const startDate = startDateObj;
      const endDate = endDateObj;
      
      // Usar formato de data sem horário para compatibilidade com o backend
      params.append('dateStart', startDate.toISOString().split('T')[0]);
      params.append('dateEnd', endDate.toISOString().split('T')[0]);
      
      // Filtro por agente
      if (filters.userId) {
        params.append('agents', filters.userId);
        logger.debug('[Relatório Detalhado] Filtro de agente aplicado', filters.userId);
      } else {
        logger.debug('[Relatório Detalhado] Sem filtro de agente - buscando todos os usuários');
      }
      
      // 🎯 MIGRADO: Buscar dados via API do backend
      logger.debug('[Relatório Detalhado] Buscando dados via API do backend');
      logger.debug('[Relatório Detalhado] Datas sendo usadas', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        organizationId: organization.id
      });
      
      // Buscar mensagens via API do backend
      const messagesParams = new URLSearchParams({
        organization_id: organization.id,
        dateStart: startDate.toISOString().split('T')[0],
        dateEnd: endDate.toISOString().split('T')[0],
        limit: '100000' // Buscar todas as mensagens
      });

      if (filters.keyword && filters.keyword.trim()) {
        messagesParams.append('keyword', filters.keyword.trim());
      }

      if (filters.userId) {
        messagesParams.append('agents', filters.userId);
      }

      const headers = await getAuthHeaders();
      const messagesResponse = await fetch(`${apiBase}/api/messages?${messagesParams}`, {
        headers
      });

      if (!messagesResponse.ok) {
        throw new Error(`Erro ao buscar mensagens: ${messagesResponse.status}`);
      }

      const messagesResult = await messagesResponse.json();
      const messages = messagesResult.messages || messagesResult.data || [];
      
      // Obter count total de mensagens
      const totalMessagesCount = messagesResult.total || messages.length;
      logger.database('[Relatório Detalhado] Total de mensagens encontradas', totalMessagesCount);
      
      // 🎯 NOVO: Armazenar o count real para usar nas estatísticas
      setRealTotalMessages(totalMessagesCount);

      logger.debug('[Relatório Detalhado] Mensagens encontradas via API', messages?.length || 0);
      
      // ✅ DEBUG: Verificar estrutura das mensagens recebidas
      if (messages && messages.length > 0) {
        const sampleMessages = messages.slice(0, 3).map((msg: any) => ({
          id: msg.id,
          chat_id: msg.chat_id,
          hasChat: !!msg.chat,
          chatIsNull: msg.chat === null,
          chatIsArray: Array.isArray(msg.chat),
          chatType: typeof msg.chat,
          chatKeys: msg.chat ? Object.keys(msg.chat) : null,
          content: msg.content?.substring(0, 50),
          created_at: msg.created_at
        }));
        
        logger.debug('[Relatório Detalhado] Amostra de mensagens recebidas:', sampleMessages);
        
        // Verificar quantas mensagens têm chats válidos
        const messagesWithChats = messages.filter((m: any) => m.chat && m.chat !== null);
        const messagesWithoutChats = messages.filter((m: any) => !m.chat || m.chat === null);
        
        logger.debug('[Relatório Detalhado] Estatísticas de mensagens:', {
          total: messages.length,
          withChats: messagesWithChats.length,
          withoutChats: messagesWithoutChats.length,
          percentageWithChats: messages.length > 0 ? ((messagesWithChats.length / messages.length) * 100).toFixed(2) + '%' : '0%'
        });
      } else {
        logger.warn('[Relatório Detalhado] Nenhuma mensagem encontrada!');
      }
      
      // 🎯 NOVO: Buscar dados dos usuários via API (mesma usada em /accounts)
      logger.debug('[Relatório Detalhado] Buscando dados dos usuários via API');
      
      const headers = await getAuthHeaders();
      const usersResponse = await fetch(`${apiBase}/api/users?organization_id=${organization.id}`, {
        headers
      });

      let userMap = new Map();
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        logger.debug('[Relatório Detalhado] Dados dos usuários recebidos', usersData);
        
        if (usersData.success && usersData.users) {
          usersData.users.forEach((user: any) => {
            userMap.set(user.id, user.name || user.full_name || user.email || 'Usuário');
          });
        }
      }
      
      logger.debug('[Relatório Detalhado] Usuários encontrados', userMap.size);
      logger.debug('[Relatório Detalhado] Mapeamento de usuários', Array.from(userMap.entries()));
      
      // Criar estrutura compatível com o código existente
      const recentMessagesData = {
        success: true,
        messages: messages || [],
        userMap: userMap
      };
      
      // 🎯 NOVO: Converter mensagens em conversas únicas (versão simplificada)
      // ✅ CORREÇÃO: Usar Map para agrupar por telefone normalizado em vez de apenas chatId
      const uniqueChats = new Map(); // Key: telefone normalizado, Value: conversa
      const chatIdToPhoneMap = new Map(); // Mapear chatId -> telefone normalizado
      logger.debug('[Relatório Detalhado] Processando mensagens para conversas', recentMessagesData.messages?.length || 0);
      
      // ✅ MIGRADO: Buscar todos os chats que estão faltando no join de uma vez via API
      const messagesWithoutChats = (recentMessagesData.messages || []).filter((m: any) => !m.chat || m.chat === null);
      const uniqueChatIdsToFetch = [...new Set(messagesWithoutChats.map((m: any) => m.chat_id).filter(Boolean))];
      
      let fetchedChatsMap = new Map();
      if (uniqueChatIdsToFetch.length > 0) {
        logger.debug(`[Relatório Detalhado] Buscando ${uniqueChatIdsToFetch.length} chats que faltaram no join...`);
        try {
          // Buscar chats via API do backend
          const chatIdsParam = uniqueChatIdsToFetch.join(',');
          const chatsResponse = await fetch(`${apiBase}/api/chat-operations/chats?ids=${chatIdsParam}&organization_id=${organization.id}`, {
            headers: await getAuthHeaders()
          });
          
          if (chatsResponse.ok) {
            const chatsResult = await chatsResponse.json();
            const fetchedChats = chatsResult.chats || chatsResult.data || [];
            fetchedChats.forEach((chat: any) => {
              fetchedChatsMap.set(chat.id, chat);
            });
            logger.debug(`[Relatório Detalhado] ${fetchedChats.length} chats encontrados separadamente`);
          } else {
            logger.warn(`[Relatório Detalhado] Erro ao buscar chats separadamente:`, chatsResponse.status);
          }
        } catch (fetchError) {
          logger.warn(`[Relatório Detalhado] Erro ao buscar chats em batch:`, fetchError);
        }
      }
      
      // ✅ DEBUG: Verificar estrutura das mensagens recebidas
      if (recentMessagesData.messages && recentMessagesData.messages.length > 0) {
        logger.debug('[Relatório Detalhado] Exemplo de mensagem recebida:', {
          firstMessage: {
            id: recentMessagesData.messages[0].id,
            chat_id: recentMessagesData.messages[0].chat_id,
            hasChats: !!recentMessagesData.messages[0].chats,
            chatsStructure: recentMessagesData.messages[0].chats ? Object.keys(recentMessagesData.messages[0].chats) : null,
            content: recentMessagesData.messages[0].content?.substring(0, 50),
            is_from_me: recentMessagesData.messages[0].is_from_me,
            user_id: recentMessagesData.messages[0].user_id
          }
        });
      }
      
      (recentMessagesData.messages || []).forEach((msg: any, index: number) => {
        // ✅ CORREÇÃO: Verificar se mensagem tem chat_id
        const chatId = msg.chat_id;
        
        if (!chatId) {
          logger.warn(`[Relatório Detalhado] Mensagem ${msg.id} sem chat_id, pulando...`);
          return;
        }
        
        // ✅ MIGRADO: O join da API pode retornar null se o chat não existir
        // Usar o chat do join ou buscar do mapa de chats buscados separadamente
        let chatData = msg.chat || msg.chats;
        
        // ✅ NOVO: Se chat for null, usar o chat buscado separadamente
        if (!chatData || chatData === null) {
          const fetchedChat = fetchedChatsMap.get(chatId);
          if (fetchedChat) {
            chatData = fetchedChat;
            logger.debug(`[Relatório Detalhado] Usando chat ${chatId} do mapa de chats buscados`);
          } else {
            logger.warn(`[Relatório Detalhado] Chat ${chatId} não encontrado nem no join nem no mapa`);
          }
        }
        
        // ✅ DEBUG: Log da estrutura do chat
        if (index < 3) {
          logger.debug(`[Relatório Detalhado] Mensagem ${index + 1} - chatData:`, {
            hasChatData: !!chatData,
            chatDataKeys: chatData ? Object.keys(chatData) : null,
            chatDataName: chatData?.name,
            chatDataWhatsappJid: chatData?.whatsapp_jid,
            chatDataRemoteJid: chatData?.remote_jid,
            chatDataIsGroup: chatData?.is_group
          });
        }
        
        // 🎯 CORREÇÃO: Melhorar extração do nome do grupo
        let chatName = 'Conversa sem nome';
        
        if (chatData?.is_group) {
          // Para grupos, tentar extrair nome do metadata primeiro
          const groupInfo = chatData?.metadata?.group_info;
          if (groupInfo?.name) {
            chatName = groupInfo.name;
          } else if (chatData?.name && !chatData.name.match(/^\d+$/)) {
            // Se o nome não é apenas números, usar ele
            chatName = chatData.name;
          } else {
            // Fallback para ID do grupo formatado
            chatName = `Grupo ${chatId.substring(0, 8)}`;
          }
        } else {
          // Para conversas individuais, usar lógica normal
          chatName = chatData?.name || chatData?.whatsapp_jid || chatData?.remote_jid || `Cliente ${chatId.substring(0, 8)}`;
        }
        
        // 🎯 NOVO: Determinar o nome do usuário real
        let userName = 'Usuário';
        logger.debug(`[Debug] Determinando usuário para mensagem ${index + 1}:`, {
          msgUserId: msg.user_id,
          assignedAgentId: chatData?.assigned_agent_id,
          senderName: msg.sender_name,
          userMapKeys: Array.from(recentMessagesData.userMap.keys()),
          userMapValues: Array.from(recentMessagesData.userMap.values())
        });
        
        if (msg.user_id && recentMessagesData.userMap.has(msg.user_id)) {
          userName = recentMessagesData.userMap.get(msg.user_id);
          logger.debug(`[Debug] Usuário encontrado por msg.user_id: ${userName}`);
        } else if (chatData?.assigned_agent_id && recentMessagesData.userMap.has(chatData.assigned_agent_id)) {
          userName = recentMessagesData.userMap.get(chatData.assigned_agent_id);
          logger.debug(`[Debug] Usuário encontrado por assigned_agent_id: ${userName}`);
        } else if (msg.sender_name) {
          userName = msg.sender_name;
          logger.debug(`[Debug] Usuário encontrado por sender_name: ${userName}`);
        } else {
          logger.debug(`[Debug] Usuário não encontrado, usando fallback: ${userName}`);
        }
        
        // ✅ CORREÇÃO: Normalizar telefone para unificar conversas do mesmo número
        const normalizePhone = (phone: string | null | undefined): string => {
          if (!phone || phone === 'N/A' || phone === 'Grupo') return phone || 'N/A';
          
          // Se termina com @s.whatsapp.net ou similar, extrair apenas o número
          if (phone.includes('@')) {
            const jidPart = phone.split('@')[0];
            // Remover caracteres não numéricos do JID
            return jidPart.replace(/\D/g, '');
          }
          
          // Remover caracteres não numéricos
          const cleaned = phone.replace(/\D/g, '');
          
          return cleaned || phone;
        };
        
        // Extrair telefone do chat
        const rawPhone = chatData?.whatsapp_jid || chatData?.remote_jid;
        const phoneNumber = normalizePhone(rawPhone);
        
        // ✅ CORREÇÃO: Usar telefone normalizado como chave única, mas manter fallback para grupos/chats sem telefone
        // Para grupos ou chats sem telefone válido, usar chatId como chave
        const normalizedPhone = (phoneNumber && phoneNumber !== 'N/A' && phoneNumber !== 'Grupo' && phoneNumber.length >= 10) 
          ? phoneNumber 
          : `chat_${chatId}`;
        
        logger.debug(`[Relatório Detalhado] Processando mensagem ${index + 1}:`, {
          chatId,
          chatName,
          userName,
          phoneNumber,
          normalizedPhone,
          userId: msg.user_id,
          assignedAgentId: chatData?.assigned_agent_id,
          isFromMe: msg.is_from_me,
          content: msg.content?.substring(0, 50) + '...',
          isGroup: chatData?.is_group,
          groupMetadata: chatData?.metadata?.group_info,
          originalName: chatData?.name,
          chatData
        });
        
        // ✅ CORREÇÃO: Agrupar por telefone normalizado em vez de chatId
        // Mapear chatId para telefone normalizado
        chatIdToPhoneMap.set(chatId, normalizedPhone);
        
        if (!uniqueChats.has(normalizedPhone)) {
          uniqueChats.set(normalizedPhone, {
            id: normalizedPhone, // Usar telefone normalizado como ID único
            chatId: chatId, // Manter referência ao primeiro chatId encontrado
            chatIds: [chatId], // ✅ NOVO: Lista de todos os chatIds que pertencem a esta conversa
            customerName: chatName,
            customerPhone: phoneNumber,
            customer_name_whatsapp: chatName,
            customer_avatar_url: chatData?.avatar_url || undefined, // ✅ NOVA: Foto do cliente
            channel: chatData?.platform || 'whatsapp',
            agentName: userName,
            agentId: msg.user_id || chatData?.assigned_agent_id,
            startTime: msg.created_at,
            endTime: msg.created_at,
            duration: 0,
            status: 'active',
            tags: [],
            totalMessages: 0,
            priority: 'normal',
            department: null,
            satisfaction: undefined,
            sentiment: undefined,
            category: undefined,
            internalNotes: undefined,
            transfers: [],
            unreadCount: 0,
            aiAnalysis: undefined,
            actualSentMessages: 0,
            actualReceivedMessages: 0,
            actualPhone: phoneNumber,
            actualCustomerName: chatName,
            actualWhatsappName: chatName
          });
          logger.debug(`[Relatório Detalhado] Nova conversa criada: ${normalizedPhone} (${phoneNumber}) - ${chatName} (Usuário: ${userName}, ChatId: ${chatId})`);
        } else {
          // ✅ NOVO: Se já existe conversa com este telefone, adicionar chatId à lista
          const existingChat = uniqueChats.get(normalizedPhone);
          if (existingChat && !existingChat.chatIds.includes(chatId)) {
            existingChat.chatIds.push(chatId);
            logger.debug(`[Relatório Detalhado] Chat ${chatId} unificado com conversa existente ${normalizedPhone}`);
          }
        }
        
        // Incrementar contadores usando telefone normalizado
        const chat = uniqueChats.get(normalizedPhone);
        if (chat) {
          chat.totalMessages++;
          if (msg.is_from_me) {
            chat.actualSentMessages++;
          } else {
            chat.actualReceivedMessages++;
          }
          
          // ✅ NOVA: Atualizar avatar_url se disponível e ainda não tiver
          if (chatData?.avatar_url && !chat.customer_avatar_url) {
            chat.customer_avatar_url = chatData.avatar_url;
          }
          
          // ✅ CORREÇÃO: Atualizar timestamps para considerar todas as mensagens
          const msgTime = new Date(msg.created_at);
          const startTime = new Date(chat.startTime);
          const endTime = new Date(chat.endTime);
          
          if (msgTime < startTime) {
            chat.startTime = msg.created_at;
          }
          if (msgTime > endTime) {
            chat.endTime = msg.created_at;
          }
          
          // 🎯 NOVO: Atualizar o nome do usuário se encontramos um melhor
          if (msg.user_id && recentMessagesData.userMap.has(msg.user_id)) {
            const newUserName = recentMessagesData.userMap.get(msg.user_id);
            if (newUserName !== 'Usuário' && newUserName !== chat.agentName) {
              logger.debug(`[Debug] Atualizando nome do usuário de "${chat.agentName}" para "${newUserName}"`);
              chat.agentName = newUserName;
              chat.agentId = msg.user_id;
            }
          } else if (chatData?.assigned_agent_id && recentMessagesData.userMap.has(chatData.assigned_agent_id)) {
            const newUserName = recentMessagesData.userMap.get(chatData.assigned_agent_id);
            if (newUserName !== 'Usuário' && newUserName !== chat.agentName) {
              logger.debug(`[Debug] Atualizando nome do usuário de "${chat.agentName}" para "${newUserName}"`);
              chat.agentName = newUserName;
              chat.agentId = chatData.assigned_agent_id;
            }
          }
          
          // ✅ NOVO: Atualizar nome do cliente se encontramos um melhor
          if (chatName && chatName !== 'Conversa sem nome' && chatName !== chat.customerName) {
            // Preferir nomes mais descritivos
            if (chatName.length > chat.customerName.length || chat.customerName === 'Cliente') {
              chat.customerName = chatName;
              chat.actualCustomerName = chatName;
              chat.actualWhatsappName = chatName;
            }
          }
        } else {
          logger.warn(`[Relatório Detalhado] Conversa não encontrada para telefone normalizado: ${normalizedPhone}`);
        }
      });
      
      const conversations = Array.from(uniqueChats.values());
      logger.debug('[Relatório Detalhado] Conversas extraídas das mensagens', conversations.length);
      logger.debug('[Relatório Detalhado] Primeiras 3 conversas', conversations.slice(0, 3));
      
      // ✅ CORREÇÃO: Verificar se há conversas antes de continuar
      if (conversations.length === 0) {
        logger.warn('[Relatório Detalhado] Nenhuma conversa encontrada após processamento');
        logger.debug('[Relatório Detalhado] Debug - Mensagens processadas:', {
          totalMessages: messages?.length || 0,
          messagesWithChatId: messages?.filter((m: any) => m.chat_id).length || 0,
          messagesWithoutChatId: messages?.filter((m: any) => !m.chat_id).length || 0,
          sampleMessages: messages?.slice(0, 3).map((m: any) => ({
            id: m.id,
            hasChatId: !!m.chat_id,
            chatId: m.chat_id,
            hasChats: !!m.chats,
            content: m.content?.substring(0, 50)
          })) || []
        });
        
        setConversations([]);
        setFilteredConversations([]);
        setLoading(false);
        return;
      }
      
      // Criar estrutura compatível com o código existente
      const data = {
        success: true,
        conversations: conversations
      };
      
      logger.debug('[Relatório Detalhado] Estrutura de dados criada', {
        success: data.success,
        conversationsCount: data.conversations.length,
        firstConversation: data.conversations[0]
      });

      // 🎯 CORREÇÃO: Calcular estatísticas baseadas nas conversas filtradas
      logger.debug('[Relatório Detalhado] Conversas carregadas, calculando estatísticas');
      
      // As estatísticas serão calculadas no useEffect quando filteredConversations mudar
      
      // Buscar todos os usuários da organização
      await fetchAllUsers();
      
      // Debug: Verificar estrutura da tabela chats via API
      try {
        const headers = await getAuthHeaders();
        const sampleChatResponse = await fetch(`${apiBase}/api/chat-operations/chats?organization_id=${organization.id}&limit=1`, {
          headers
        });
          
        if (sampleChatResponse.ok) {
          const sampleChatResult = await sampleChatResponse.json();
          const sampleChat = sampleChatResult.chats?.[0] || sampleChatResult.data?.[0];
          if (sampleChat) {
            logger.debug('[Debug] Estrutura da tabela chats:', Object.keys(sampleChat));
            logger.debug('[Debug] Exemplo de chat completo:', sampleChat);
          }
        } else {
          logger.debug('[Debug] Erro ao buscar exemplo de chat:', sampleChatResponse.status);
        }
      } catch (debugError) {
        logger.debug('[Debug] Erro no debug da tabela chats:', debugError);
      }
      
      // 🚀 OTIMIZAÇÃO: Buscar dados em batch ao invés de N+1 queries
      // ✅ CORREÇÃO: Coletar todos os chatIds de todas as conversas unificadas
      const allChatIds = new Set<string>();
      (data.conversations || []).forEach((conv: any) => {
        if (conv.chatIds && Array.isArray(conv.chatIds)) {
          conv.chatIds.forEach((cid: string) => allChatIds.add(cid));
        } else if (conv.chatId) {
          allChatIds.add(conv.chatId);
        } else if (conv.id && conv.id.startsWith('chat_')) {
          // Se o ID é um chatId, adicionar também
          allChatIds.add(conv.id.replace('chat_', ''));
        }
      });
      
      const conversationIds = Array.from(allChatIds);
      logger.debug(`[Debug] Buscando dados em batch para ${conversationIds.length} chats únicos (${data.conversations.length} conversas unificadas)`);
      
      // 1. Buscar todas as mensagens de uma vez para todos os chats via API
      const messagesParams = new URLSearchParams({
        organization_id: organization.id,
        dateStart: startDate.toISOString().split('T')[0],
        dateEnd: endDate.toISOString().split('T')[0],
        chatIds: conversationIds.join(','),
        limit: '100000'
      });
      
      if (filters.userId) {
        messagesParams.append('agents', filters.userId);
        logger.debug(`[Debug] Aplicando filtro de usuário ${filters.userId} para todas as mensagens`);
      }
      
      // 2. Buscar todos os chats de uma vez via API
      const chatIdsParam = conversationIds.join(',');
      const headers = await getAuthHeaders();
      
      const [allMessagesResponse, allChatsResponse] = await Promise.all([
        fetch(`${apiBase}/api/messages?${messagesParams}`, { headers }),
        fetch(`${apiBase}/api/chat-operations/chats?ids=${chatIdsParam}&organization_id=${organization.id}`, { headers })
      ]);
      
      let allMessagesData: any[] = [];
      let allChatsData: any[] = [];
      
      if (allMessagesResponse.ok) {
        const messagesResult = await allMessagesResponse.json();
        allMessagesData = messagesResult.messages || messagesResult.data || [];
      } else {
        logger.error('[Debug] Erro ao buscar mensagens em batch:', allMessagesResponse.status);
      }
      
      if (allChatsResponse.ok) {
        const chatsResult = await allChatsResponse.json();
        allChatsData = chatsResult.chats || chatsResult.data || [];
      } else {
        logger.error('[Debug] Erro ao buscar chats em batch:', allChatsResponse.status);
      }
      
      // Criar mapas para acesso rápido
      const messagesByChatId = new Map<string, any[]>();
      const chatsById = new Map<string, any>();
      
      // Agrupar mensagens por chat_id
      allMessagesData.forEach((msg: any) => {
        if (!messagesByChatId.has(msg.chat_id)) {
          messagesByChatId.set(msg.chat_id, []);
        }
        messagesByChatId.get(msg.chat_id)!.push(msg);
      });
      
      // Mapear chats por id
      allChatsData.forEach((chat: any) => {
        chatsById.set(chat.id, chat);
      });
      
      logger.debug(`[Debug] Mensagens agrupadas por chat: ${messagesByChatId.size} chats`);
      logger.debug(`[Debug] Chats encontrados: ${chatsById.size}`);
      
      // 3. Processar dados em memória
      const conversationsWithDetails = (data.conversations || []).map((conv: any) => {
        try {
          // ✅ CORREÇÃO: Agregar mensagens de todos os chatIds desta conversa unificada
          const chatIdsToProcess = conv.chatIds && Array.isArray(conv.chatIds) 
            ? conv.chatIds 
            : [conv.chatId || conv.id];
          
          // Coletar todas as mensagens de todos os chats desta conversa
          const allChatMessages: any[] = [];
          chatIdsToProcess.forEach((cid: string) => {
            const messages = messagesByChatId.get(cid) || [];
            allChatMessages.push(...messages);
          });
          
          // Calcular mensagens enviadas/recebidas de todos os chats unificados
          const sentCount = allChatMessages.filter((m: any) => m.is_from_me).length;
          const receivedCount = allChatMessages.filter((m: any) => !m.is_from_me).length;
          
          // Buscar dados do primeiro chat (ou melhor chat disponível)
          let chatData = null;
          for (const cid of chatIdsToProcess) {
            const foundChat = chatsById.get(cid);
            if (foundChat) {
              chatData = foundChat;
              break; // Usar o primeiro chat encontrado
            }
          }
          
          // Se não encontrou nenhum chat, tentar usar conv.id diretamente
          if (!chatData) {
            chatData = chatsById.get(conv.id) || chatsById.get(conv.chatId);
          }
          
          // ✅ CORREÇÃO: Extrair telefone e nome de forma mais robusta
          let phoneNumber = 'N/A';
          let customerName = conv.customerName || 'Cliente';
          let whatsappName = 'N/A';
          let avatarUrl = conv.customer_avatar_url || undefined;
          
          if (chatData) {
            const jid = chatData.remote_jid || chatData.whatsapp_jid;
            
            // ✅ NOVO: Verificar se é grupo do WhatsApp
            if (jid && jid.endsWith('@g.us')) {
              // É um grupo
              whatsappName = chatData.name || 'Grupo';
              phoneNumber = 'Grupo';
              // ✅ NOVA: Para grupos, também buscar avatar_url
              if (chatData.avatar_url) {
                avatarUrl = chatData.avatar_url;
              }
            } else if (jid && jid.endsWith('@s.whatsapp.net')) {
              // É conversa individual
              phoneNumber = jid.replace('@s.whatsapp.net', '');
              whatsappName = chatData.name || phoneNumber;
              // ✅ NOVA: Para conversas individuais, buscar avatar_url
              if (chatData.avatar_url) {
                avatarUrl = chatData.avatar_url;
              }
            } else if (jid) {
              // Outros tipos de JID
              whatsappName = chatData.name || 'Contato';
              phoneNumber = jid.split('@')[0];
              // ✅ NOVA: Para outros tipos, também buscar avatar_url
              if (chatData.avatar_url) {
                avatarUrl = chatData.avatar_url;
              }
            }
            
            // Usar o nome do chat se disponível
            if (chatData.name) {
              customerName = chatData.name;
            }
            
            // ✅ NOVA: Priorizar avatar_url do chatData se disponível (fallback caso não tenha sido atribuído acima)
            if (chatData.avatar_url && !avatarUrl) {
              avatarUrl = chatData.avatar_url;
            }
          } else {
            // Tentar extrair do nome do cliente se contiver números
            if (conv.customerName) {
              const phoneFromName = conv.customerName.match(/\d{10,}/);
              if (phoneFromName) {
                phoneNumber = phoneFromName[0];
                whatsappName = conv.customerName;
              }
            }
          }
          
          
          return {
            ...conv,
            actualSentMessages: sentCount,
            actualReceivedMessages: receivedCount,
            actualPhone: phoneNumber,
            actualCustomerName: customerName,
            actualWhatsappName: whatsappName,
            customer_avatar_url: avatarUrl // ✅ NOVA: Foto do cliente
          };
        } catch (error) {
          return conv;
        }
      });
      
      // Processar dados da API para o formato da tabela
      logger.debug('[Relatório Detalhado] Processando conversas com detalhes', conversationsWithDetails.length);
      logger.debug('[Relatório Detalhado] Primeira conversa para processar', conversationsWithDetails[0]);
      
      const processedConversations: DetailedConversation[] = conversationsWithDetails.map((conv: any) => {
        return {
          id: conv.id,
          date: format(new Date(conv.startTime), 'dd/MM/yyyy', { locale: ptBR }),
          user_name: conv.agentName || 'Não atribuído',
          customer_name: conv.actualCustomerName || 'Cliente',
          customer_phone: conv.actualPhone || 'N/A',
          customer_name_whatsapp: conv.actualWhatsappName || 'N/A', // ✅ NOVA: Nome do WhatsApp
          customer_avatar_url: conv.customer_avatar_url || undefined, // ✅ NOVA: Foto do cliente
          messages_sent: conv.actualSentMessages || 0,
          messages_received: conv.actualReceivedMessages || 0,
          total_messages: conv.totalMessages || 0,
          last_message_time: conv.endTime ? 
            format(new Date(conv.endTime), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 
            format(new Date(conv.startTime), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
          chat_id: conv.chatId || conv.id,
          status: conv.status || 'active',
          // 🎯 CORREÇÃO: Adicionar propriedades para estatísticas
          totalMessages: conv.totalMessages || 0,
          actualSentMessages: conv.actualSentMessages || 0,
          actualReceivedMessages: conv.actualReceivedMessages || 0
        };
      });
      
      logger.debug('[Relatório Detalhado] Conversas processadas', processedConversations.length);
      logger.debug('[Relatório Detalhado] Primeira conversa processada', processedConversations[0]);
      
      setConversations(processedConversations);
      logger.debug('[Relatório Detalhado] Estado conversations atualizado com', processedConversations.length, 'conversas');
      
      applyClientFilters(processedConversations);
      logger.debug('[Relatório Detalhado] Filtros aplicados, verificando estado filteredConversations');
      
      toast({
        title: "Sucesso",
        description: `${processedConversations.length} conversas encontradas com ${stats.totalMessages} mensagens totais`,
      });
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao buscar conversas');
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, filters.startDate, filters.endDate, filters.userId, filters.keyword, toast]);

  // Aplicar filtros do lado do cliente
  const applyClientFilters = (data: DetailedConversation[], customFilters?: ReportFilters) => {
    const currentFilters = customFilters || filters;
    let filtered = [...data];
    
    logger.debug('[Relatório Detalhado] Aplicando filtros', {
      totalData: data.length,
      customerName: currentFilters.customerName,
      userId: currentFilters.userId,
      keyword: currentFilters.keyword
    });
    
    if (currentFilters.customerName) {
      filtered = filtered.filter(conv => 
        conv.customer_name.toLowerCase().includes(currentFilters.customerName.toLowerCase()) ||
        conv.customer_phone.includes(currentFilters.customerName)
      );
      logger.debug('[Relatório Detalhado] Após filtro de cliente', filtered.length);
    }
    
    if (currentFilters.userId) {
      // Buscar o nome do usuário selecionado
      const selectedUser = users.find(user => user.id === currentFilters.userId);
      if (selectedUser) {
        filtered = filtered.filter(conv => conv.user_name === selectedUser.full_name);
      }
      logger.debug('[Relatório Detalhado] Após filtro de usuário', filtered.length);
    }
    
    // 🎯 NOVO: Filtro de palavras-chave (já aplicado na query do Supabase)
    // Este filtro é aplicado no servidor, mas mantemos aqui para consistência
    if (currentFilters.keyword && currentFilters.keyword.trim()) {
      logger.debug('[Relatório Detalhado] Filtro de palavras-chave já aplicado na query do servidor');
    }
    
    logger.debug('[Relatório Detalhado] Conversas filtradas finais', filtered.length);
    setFilteredConversations(filtered);
    
    // 🎯 NOVO: As estatísticas serão calculadas automaticamente no useEffect
  };

  // Buscar detalhes da conversa
  const fetchConversationDetails = async (chatId: string) => {
    setDetailsLoading(true);
    try {
      // ✅ NOVA: Aplicar os mesmos filtros de data usados no relatório
      const parseLocalDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      
      const startDateObj = parseLocalDate(filters.startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = parseLocalDate(filters.endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      const startDate = startDateObj.toISOString();
      const endDate = endDateObj.toISOString();
      
      // Buscar mensagens via API do backend
      const messagesParams = new URLSearchParams({
        chat_id: chatId,
        organization_id: organization?.id || '',
        dateStart: startDate.split('T')[0],
        dateEnd: endDate.split('T')[0]
      });
      
      if (filters.keyword && filters.keyword.trim()) {
        messagesParams.append('keyword', filters.keyword.trim());
      }
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/messages?${messagesParams}`, {
        headers
      });
        
      if (!response.ok) {
        throw new Error(`Erro ao buscar mensagens: ${response.status}`);
      }
      
      const result = await response.json();
      const data = result.messages || result.data || [];
      
      setConversationDetails(data || []);
    } catch (error) {
      console.error('[Relatório Detalhado] Erro ao buscar detalhes da conversa:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Exportar para PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Relatório de Conversas Detalhado', 20, 20);
    
    // Período
    doc.setFontSize(12);
    doc.text(`Período: ${filters.startDate} a ${filters.endDate}`, 20, 30);
    doc.text(`Total de conversas: ${filteredConversations.length}`, 20, 40);
    
    // Dados da tabela
    const tableData = filteredConversations.map(conv => [
      conv.date,
      conv.user_name,
      conv.customer_name_whatsapp, // ✅ NOVA: Nome do WhatsApp
      conv.customer_phone,
      conv.messages_sent.toString(),
      conv.messages_received.toString()
    ]);
    
    autoTable(doc, {
      head: [['Data', 'Usuário', 'Nome WhatsApp', 'Telefone', 'Enviadas', 'Recebidas']], // ✅ NOVA: Coluna Nome WhatsApp
      body: tableData,
      startY: 50,
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255
      }
    });
    
    doc.save(`relatorio-conversas-detalhado-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Exportar para CSV
  const exportToCSV = () => {
    const wsData = [
      ['Data', 'Usuário', 'Nome WhatsApp', 'Telefone', 'Mensagens Enviadas', 'Mensagens Recebidas', 'Última Mensagem'], // ✅ NOVA: Coluna Nome WhatsApp
      ...filteredConversations.map(conv => [
        conv.date,
        conv.user_name,
        conv.customer_name_whatsapp, // ✅ NOVA: Nome do WhatsApp
        conv.customer_phone,
        conv.messages_sent,
        conv.messages_received,
        conv.last_message_time
      ])
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Ajustar largura das colunas
    const wscols = [
      { wch: 12 }, // Data
      { wch: 20 }, // Usuário
      { wch: 20 }, // Nome WhatsApp ✅ NOVA
      { wch: 15 }, // Telefone
      { wch: 12 }, // Enviadas
      { wch: 12 }, // Recebidas
      { wch: 18 }  // Última Mensagem
    ];
    ws['!cols'] = wscols;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Conversas');
    XLSX.writeFile(wb, `relatorio-conversas-detalhado-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleFilterChange = (field: keyof ReportFilters, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    
    // Se mudou filtro de cliente, aplicar imediatamente
    if (field === 'customerName') {
      applyClientFilters(conversations, newFilters);
    }
    
    // Para outros filtros, só buscar novamente quando necessário
    // (usuário clicará no botão Buscar)
  };

  const handleSearch = () => {
    fetchConversations();
  };

  const handleImageClick = (imageUrl: string) => {
    // Construir URL completa se for um caminho relativo
    let fullUrl = imageUrl;
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      // Garantir que comece com / se não tiver
      if (!imageUrl.startsWith('/')) {
        fullUrl = `/${imageUrl}`;
      }
      fullUrl = `${apiBase}${fullUrl}`;
    }
    setSelectedImageUrl(fullUrl);
    setImageModalOpen(true);
  };


  // Função para gerar resumo com IA
  const generateSummary = async (chatId: string, customerName: string) => {
    setSummaryLoading(true);
    setSummaryError(null);
    setConversationSummary('');
    setSummaryModalOpen(true);

    try {
      // ✅ NOVA: Aplicar os mesmos filtros de data usados no relatório
      const parseLocalDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      
      const startDateObj = parseLocalDate(filters.startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = parseLocalDate(filters.endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      // Usar a URL correta com /api prefix
      const response = await fetch(`${apiBase}/api/ai/summarize-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ 
          chat_id: chatId,
          startDate: startDateObj.toISOString(), // ✅ NOVA: Filtro de data inicial
          endDate: endDateObj.toISOString(), // ✅ NOVA: Filtro de data final
          keyword: filters.keyword || undefined // ✅ NOVA: Filtro de palavras-chave
        })
      });

      // Verificar se a resposta é JSON válido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        throw new Error('Resposta inválida do servidor');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar resumo');
      }

      // Limpar formatação markdown se houver
      const cleanSummary = data.summary
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **texto**
        .replace(/\*(.*?)\*/g, '$1') // Remove *texto*
        .replace(/#{1,6}\s*/g, '') // Remove # ## ### etc
        .replace(/`(.*?)`/g, '$1') // Remove `código`
        .trim();

      setConversationSummary(cleanSummary);
      toast({
        title: "Resumo gerado com sucesso!",
        description: `Resumo da conversa com ${customerName} foi criado usando IA.`,
      });

    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Erro ao gerar resumo');
      toast({
        title: "Erro ao gerar resumo",
        description: "Não foi possível gerar o resumo da conversa. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  // ✅ MIGRADO: getAuthHeaders já importado do apiBase

  const renderMessageContent = (message: ConversationMessage) => {
    // ✅ NOVO: Verificar se é mensagem de broadcast
    const isBroadcast = message.metadata?.is_broadcast_message === true;
    const broadcastInfo = isBroadcast ? (
      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
        <span className="font-semibold text-blue-700">📢 Lista de Transmissão</span>
        {message.metadata?.recipient_count && (
          <span className="ml-2 text-blue-600">
            ({message.metadata.recipient_count} destinatário{message.metadata.recipient_count > 1 ? 's' : ''})
          </span>
        )}
        {message.metadata?.recipient_phone && (
          <span className="ml-2 text-blue-600">
            Para: {message.metadata.recipient_phone}
          </span>
        )}
      </div>
    ) : null;

    if (message.message_type === 'text') {
      return (
        <div>
          {broadcastInfo}
          <span>{message.content}</span>
        </div>
      );
    } else if (message.message_type === 'image' || message.message_type === 'sticker') {
      // ✅ CORREÇÃO: Construir URL da imagem corretamente
      let imageUrl = null;
      if (message.media_url) {
        if (message.media_url.startsWith('http://') || message.media_url.startsWith('https://')) {
          imageUrl = message.media_url;
        } else if (message.media_url.startsWith('/')) {
          imageUrl = `${apiBase}${message.media_url}`;
        } else {
          imageUrl = `${apiBase}/${message.media_url}`;
        }
      } else if (message.metadata?.localPath) {
        const localPath = message.metadata.localPath;
        if (localPath.startsWith('/')) {
          imageUrl = `${apiBase}${localPath}`;
        } else {
          imageUrl = `${apiBase}/${localPath}`;
        }
      }

      return (
        <div className="flex flex-col gap-2">
          {broadcastInfo}
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={message.message_type === 'sticker' ? 'Sticker' : 'Imagem'}
                className="max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => handleImageClick(imageUrl!)}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'text-xs text-gray-500 p-2 bg-gray-50 rounded';
                    errorDiv.innerHTML = `❌ Imagem não disponível<br/><span class="text-gray-400">${imageUrl}</span>`;
                    parent.appendChild(errorDiv);
                  }
                }}
                loading="lazy"
              />
              {message.content && message.content !== '[Mídia não suportada]' && (
                <div className="text-xs text-gray-600 mt-1">{message.content}</div>
              )}
            </>
          ) : (
            <div className="text-xs text-gray-500">
              📷 {message.message_type === 'sticker' ? 'Sticker' : 'Imagem'} não disponível
            </div>
          )}
        </div>
      );
    } else if (message.message_type === 'audio') {
      // ✅ CORREÇÃO: Construir URL do áudio corretamente
      let audioUrl = null;
      if (message.media_url) {
        if (message.media_url.startsWith('http://') || message.media_url.startsWith('https://')) {
          audioUrl = message.media_url;
        } else if (message.media_url.startsWith('/')) {
          audioUrl = `${apiBase}${message.media_url}`;
        } else {
          audioUrl = `${apiBase}/${message.media_url}`;
        }
      } else if (message.metadata?.localPath) {
        // Tentar usar localPath se media_url não estiver disponível
        const localPath = message.metadata.localPath;
        if (localPath.startsWith('/')) {
          audioUrl = `${apiBase}${localPath}`;
        } else {
          audioUrl = `${apiBase}/${localPath}`;
        }
      }

      const hasTranscription = message.metadata?.transcription;
      const isTranscribing = message.metadata?.transcribing === true;

      return (
        <div className="flex flex-col gap-2">
          {broadcastInfo}
          <div className="flex items-center gap-2 flex-wrap">
            <span>🎵 Áudio</span>
            {audioUrl ? (
              <audio controls className="flex-1 min-w-[200px]">
                <source src={audioUrl} type="audio/ogg" />
                <source src={audioUrl} type="audio/mpeg" />
                <source src={audioUrl} type="audio/wav" />
                Seu navegador não suporta o elemento de áudio.
              </audio>
            ) : (
              <span className="text-xs text-gray-500">Áudio não disponível</span>
            )}
            {isTranscribing && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Transcrevendo...
              </span>
            )}
          </div>
          {hasTranscription && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
              <p className="font-semibold text-xs text-gray-600 mb-1">Transcrição:</p>
              <p className="text-gray-800">{message.metadata.transcription}</p>
            </div>
          )}
        </div>
      );
    } else if (message.message_type === 'video') {
      // ✅ CORREÇÃO: Construir URL do vídeo corretamente
      let videoUrl = null;
      if (message.media_url) {
        if (message.media_url.startsWith('http://') || message.media_url.startsWith('https://')) {
          videoUrl = message.media_url;
        } else if (message.media_url.startsWith('/')) {
          videoUrl = `${apiBase}${message.media_url}`;
        } else {
          videoUrl = `${apiBase}/${message.media_url}`;
        }
      } else if (message.metadata?.localPath) {
        const localPath = message.metadata.localPath;
        if (localPath.startsWith('/')) {
          videoUrl = `${apiBase}${localPath}`;
        } else {
          videoUrl = `${apiBase}/${localPath}`;
        }
      }

      return (
        <div className="flex flex-col gap-2">
          {broadcastInfo}
          {videoUrl ? (
            <>
              <video
                controls
                className="max-w-xs max-h-64 rounded-lg"
                src={videoUrl}
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'text-xs text-gray-500 p-2 bg-gray-50 rounded';
                    errorDiv.innerHTML = `❌ Vídeo não disponível<br/><span class="text-gray-400">${videoUrl}</span>`;
                    parent.appendChild(errorDiv);
                  }
                }}
              >
                Seu navegador não suporta vídeo.
              </video>
              {message.content && message.content !== '[Mídia não suportada]' && (
                <div className="text-xs text-gray-600 mt-1">{message.content}</div>
              )}
            </>
          ) : (
            <div className="text-xs text-gray-500">🎥 Vídeo não disponível</div>
          )}
        </div>
      );
    } else if (message.message_type === 'file') {
      // ✅ CORREÇÃO: Construir URL do arquivo corretamente
      let fileUrl = null;
      if (message.media_url) {
        if (message.media_url.startsWith('http://') || message.media_url.startsWith('https://')) {
          fileUrl = message.media_url;
        } else if (message.media_url.startsWith('/')) {
          fileUrl = `${apiBase}${message.media_url}`;
        } else {
          fileUrl = `${apiBase}/${message.media_url}`;
        }
      } else if (message.metadata?.localPath) {
        const localPath = message.metadata.localPath;
        if (localPath.startsWith('/')) {
          fileUrl = `${apiBase}${localPath}`;
        } else {
          fileUrl = `${apiBase}/${localPath}`;
        }
      }

      const filename = message.metadata?.filename || message.media_url?.split('/').pop() || 'arquivo';
      const ext = filename.split('.').pop()?.toLowerCase();

      return (
        <div className="flex flex-col gap-2">
          {broadcastInfo}
          <div className="flex items-center gap-2 flex-wrap">
            <span>📎 {filename}</span>
            {fileUrl && (
              <a 
                href={fileUrl} 
                download={filename}
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-500 underline hover:text-blue-700"
              >
                Download
              </a>
            )}
            {message.metadata?.fileSize && (
              <span className="text-xs text-gray-500">
                ({(message.metadata.fileSize / 1024).toFixed(2)} KB)
              </span>
            )}
          </div>
          {message.content && message.content !== '[Mídia não suportada]' && (
            <div className="text-xs text-gray-600 mt-1">{message.content}</div>
          )}
        </div>
      );
    }
    return (
      <div>
        {broadcastInfo}
        <span>{message.content || 'Mensagem não suportada'}</span>
      </div>
    );
  };

  // Carregar usuários quando a organização estiver disponível
  useEffect(() => {
    if (organization?.id) {
      fetchAllUsers();
    }
  }, [fetchAllUsers]);

  // ✅ NOVO: Listener para atualizações de transcrição via Socket.IO
  useEffect(() => {
    if (!organization?.id) return;

    const socket: Socket = io(apiBase);

    socket.on('connect', () => {
      socket.emit('join-organization', { organizationId: organization.id });
    });

    socket.on('message-transcription-updated', (data: { messageId: string; transcription: string }) => {
      setConversationDetails(prev => prev.map(msg =>
        msg.id === data.messageId
          ? {
              ...msg,
              metadata: {
                ...msg.metadata,
                transcription: data.transcription,
                transcribing: false
              }
            }
          : msg
      ));
    });

    return () => {
      socket.disconnect();
    };
  }, [organization?.id]);

  // Carregamento inicial das conversas
  useEffect(() => {
    if (organization?.id) {
      fetchConversations();
    }
  }, [organization?.id, fetchConversations]);

  // 🎯 CORREÇÃO: Calcular estatísticas quando as conversas filtradas mudarem
  useEffect(() => {
    logger.debug('[Relatório Detalhado] Conversas filtradas atualizadas, calculando estatísticas');
    
    // Calcular estatísticas baseadas nas conversas filtradas
    calculateStatsFromConversations();
  }, [calculateStatsFromConversations]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.startDate, filters.endDate, filters.userId, filters.customerName, filters.keyword]);

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">Relatório de Conversas Detalhado</h1>
          <p className="text-gray-600">Visualize dados detalhados das conversas com histórico completo</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button 
            onClick={fetchConversations} 
            variant="outline" 
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Buscar
          </Button>
          <Button onClick={exportToPDF} variant="outline" disabled={!filteredConversations.length}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={exportToCSV} variant="outline" disabled={!filteredConversations.length}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <MessageCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="userId">Usuário</Label>
                <select
                  id="userId"
                  value={filters.userId}
                  onChange={(e) => handleFilterChange('userId', e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Todos os usuários</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="customerName">Cliente/Telefone</Label>
                <Input
                  id="customerName"
                  placeholder="Nome ou telefone..."
                  value={filters.customerName}
                  onChange={(e) => handleFilterChange('customerName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="keyword">Palavras-chave</Label>
                <Input
                  id="keyword"
                  placeholder="Digite palavras-chave para buscar nas mensagens..."
                  value={filters.keyword}
                  onChange={(e) => handleFilterChange('keyword', e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas - usando dados corretos do dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total de Mensagens</p>
                <p className="text-2xl">{stats.totalMessages}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <User className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Mensagens Enviadas</p>
                <p className="text-2xl">{stats.sentMessages}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Phone className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Mensagens Recebidas</p>
                <p className="text-2xl">{stats.receivedMessages}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Total de Conversas</p>
                <p className="text-2xl">{stats.totalConversations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Conversas */}
      <Card>
        <CardHeader>
          <CardTitle>Conversas Detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
              <p>Carregando conversas...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">Nenhuma conversa encontrada</p>
              <p className="text-sm text-gray-400">
                {conversations.length === 0 
                  ? `Nenhuma conversa encontrada para o período ${filters.startDate} a ${filters.endDate}. Clique em 'Buscar' para recarregar ou ajuste os filtros de data.`
                  : `Filtros aplicados não retornaram resultados. Total de conversas disponíveis: ${conversations.length}`
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nome WhatsApp</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Enviadas</TableHead>
                  <TableHead>Recebidas</TableHead>
                  <TableHead>Última Mensagem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getPaginatedConversations().map(conversation => (
                  <TableRow key={conversation.id}>
                    <TableCell>
                      {conversation.customer_avatar_url ? (
                        <img
                          src={conversation.customer_avatar_url}
                          alt={conversation.customer_name_whatsapp}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Substituir por fallback quando erro (403, URL expirada, etc)
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.avatar-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'avatar-fallback w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center';
                              const userIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                              userIcon.setAttribute('class', 'h-5 w-5 text-gray-400');
                              userIcon.setAttribute('fill', 'none');
                              userIcon.setAttribute('viewBox', '0 0 24 24');
                              userIcon.setAttribute('stroke', 'currentColor');
                              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                              path.setAttribute('stroke-linecap', 'round');
                              path.setAttribute('stroke-linejoin', 'round');
                              path.setAttribute('stroke-width', '2');
                              path.setAttribute('d', 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z');
                              userIcon.appendChild(path);
                              fallback.appendChild(userIcon);
                              parent.appendChild(fallback);
                            }
                          }}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{conversation.date}</TableCell>
                    <TableCell>{conversation.user_name}</TableCell>
                    <TableCell>
                      <span className="">
                        {conversation.customer_name_whatsapp}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {conversation.customer_phone}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{conversation.messages_sent}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{conversation.messages_received}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {conversation.last_message_time}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedConversation(conversation);
                                fetchConversationDetails(conversation.chat_id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Histórico da Conversa - {selectedConversation?.customer_name_whatsapp} {/* ✅ NOVA: Usar Nome WhatsApp */}
                            </DialogTitle>
                            <DialogDescription>
                              Visualize todas as mensagens desta conversa
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {detailsLoading ? (
                              <div className="text-center py-8">Carregando histórico...</div>
                            ) : (
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {conversationDetails.map(message => (
                                  <div
                                    key={message.id}
                                    className={`p-3 rounded-lg ${
                                      message.is_from_me
                                        ? 'bg-blue-100 ml-auto max-w-[80%]'
                                        : 'bg-gray-100 mr-auto max-w-[80%]'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="text-sm">
                                        {message.is_from_me ? 'Agente' : message.sender_name || 'Cliente'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {format(new Date(message.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                      </span>
                                    </div>
                                    <div className="text-sm">
                                      {renderMessageContent(message)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateSummary(conversation.chat_id, conversation.customer_name_whatsapp)}
                        title="Resumir conversa com IA"
                      >
                        <Brain className="h-4 w-4" />
                      </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Controles de Paginação */}
      {filteredConversations.length > itemsPerPage && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredConversations.length)} de {filteredConversations.length} conversas
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                
                <div className="flex items-center space-x-1">
                  {(() => {
                    const totalPages = getTotalPages();
                    const maxVisiblePages = 5;
                    const pages = [];
                    
                    if (totalPages <= maxVisiblePages) {
                      // Mostrar todas as páginas se são poucas
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Mostrar páginas com ellipsis
                      if (currentPage <= 3) {
                        // Páginas iniciais
                        for (let i = 1; i <= 4; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      } else if (currentPage >= totalPages - 2) {
                        // Páginas finais
                        pages.push(1);
                        pages.push('...');
                        for (let i = totalPages - 3; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Páginas do meio
                        pages.push(1);
                        pages.push('...');
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      }
                    }
                    
                    return pages.map((page, index) => (
                      page === '...' ? (
                        <span key={index} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page as number)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      )
                    ));
                  })()}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === getTotalPages()}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal para visualização de imagem/vídeo */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Mídia</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedImageUrl && (
              <div className="max-w-full max-h-[70vh] overflow-auto">
                {selectedImageUrl.match(/\.(mp4|avi|mov|wmv|flv|webm)$/i) ? (
                  <video 
                    controls 
                    className="max-w-full max-h-full rounded-lg"
                    src={selectedImageUrl}
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="flex items-center justify-center p-8 text-gray-500">
                            <div class="text-center">
                              <div class="text-4xl mb-2">🎥</div>
                              <p>Vídeo não pôde ser carregado</p>
                              <p class="text-sm text-gray-400 mt-1">URL: ${selectedImageUrl}</p>
                              <p class="text-xs text-gray-300 mt-2">Verifique se o arquivo existe no servidor</p>
                            </div>
                          </div>
                        `;
                      }
                    }}
                  >
                    Seu navegador não suporta vídeo.
                  </video>
                ) : (
                  <img 
                    src={selectedImageUrl} 
                    alt="Imagem da conversa"
                    className="max-w-full max-h-full rounded-lg shadow-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.error-message')) {
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'error-message flex items-center justify-center p-8 text-gray-500';
                        errorDiv.innerHTML = `
                          <div class="text-center">
                            <div class="text-4xl mb-2">📷</div>
                            <p class="font-medium">Imagem não pôde ser carregada</p>
                            <p class="text-sm text-gray-400 mt-2 break-all">URL: ${selectedImageUrl}</p>
                            <p class="text-xs text-gray-300 mt-2">Verifique se o arquivo existe no servidor</p>
                            <p class="text-xs text-gray-300 mt-1">O arquivo pode ter sido movido ou excluído</p>
                          </div>
                        `;
                        parent.appendChild(errorDiv);
                      }
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para resumo da conversa */}
      <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              Resumo da Conversa - IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {summaryLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600">Gerando resumo com IA...</p>
                <p className="text-sm text-gray-400 mt-2">Isso pode levar alguns segundos</p>
              </div>
            ) : summaryError ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-4">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2" />
                  <p className="">Erro ao gerar resumo</p>
                </div>
                <p className="text-gray-600 mb-4">{summaryError}</p>
                <Button 
                  onClick={() => setSummaryModalOpen(false)}
                  variant="outline"
                >
                  Fechar
                </Button>
              </div>
            ) : conversationSummary ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-blue-900 mb-2">Resumo Gerado pela IA</h4>
                      <div className="text-sm text-blue-800 whitespace-pre-wrap">
                        {conversationSummary}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end items-center pt-4 border-t">
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => navigator.clipboard.writeText(conversationSummary)}
                      variant="outline"
                      size="sm"
                    >
                      Copiar Resumo
                    </Button>
                    <Button 
                      onClick={() => setSummaryModalOpen(false)}
                      variant="outline"
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Nenhum resumo disponível</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportDetailedConversations;
