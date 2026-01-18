import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useSupabaseChat } from '@/hooks/useSupabaseChat';
// import { useChatOperations } from '@/hooks/chat/useChatOperations'; // ✅ REMOVIDO: não usado
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import ChatWindow from './ChatWindow';
import { FavoriteMessagesPanel } from './FavoriteMessagesPanel';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { 
  MessageCircle, 
  Search,
  Plus,
  Star,
  Archive,
  ChevronDown,
  CheckCircle,
  RefreshCw,
  Users, // Adicionar import para o ícone de usuários
  Clock, // Adicionar import para o ícone de relógio
  Trash2 // Adicionar import para o ícone de deletar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { useChatNotifications } from '@/hooks/chat/useChatNotifications';
import { NotificationSettings } from './NotificationSettings';
import { NotificationButton } from './NotificationButton';

type MessageData = any;
type ChatData = any;

// Transform database message to UI message format
const transformMessage = (dbMessage: MessageData) => ({
  id: dbMessage.id,
  content: dbMessage.content || '',
  sender: (dbMessage.is_from_me ? 'agent' : 'user') as 'agent' | 'user',
  senderName: dbMessage.sender_name || undefined,
  timestamp: new Date(dbMessage.created_at || Date.now()),
  message_type: (dbMessage.message_type as 'text' | 'image' | 'audio' | 'file') || 'text',
  isInternal: dbMessage.is_internal || false,
  isImportant: dbMessage.is_important || false,
  status: (dbMessage.status as 'sent' | 'delivered' | 'read') || 'sent',
  media_url: dbMessage.media_url || null,
  metadata: dbMessage.metadata || {}
});

// Função para formatar o nome do chat
const formatChatName = (name: string | null | undefined): string => {
  if (!name) return '';
  
  // Se começa com "Contato" (case-insensitive), remover o prefixo e manter só o número
  const nameLower = name.toLowerCase().trim();
  if (nameLower.startsWith('contato ')) {
    // Encontrar onde começa o número (após "contato ")
    const afterPrefix = name.substring(name.toLowerCase().indexOf('contato ') + 8).trim();
    return afterPrefix;
  }
  
  // Se tem nome de pessoa (não começa com "Contato"), manter o nome
  return name;
};

// Transform database chat to UI chat format
const transformChat = (dbChat: ChatData) => ({
  id: dbChat.id,
  name: formatChatName(dbChat.name),
  avatar_url: dbChat.avatar_url,
  platform: dbChat.platform as 'whatsapp' | 'instagram' | 'telegram' | 'internal',
  status: dbChat.status as 'active' | 'finished' | 'archived',
  priority: dbChat.priority as 'low' | 'medium' | 'high' | 'urgent',
  lastMessage: dbChat.last_message ? {
    id: dbChat.last_message.id,
    content: dbChat.last_message.content || '',
    sender: dbChat.last_message.sender_name || 'Unknown',
    timestamp: new Date(dbChat.last_message.created_at || ''),
    type: dbChat.last_message.message_type || 'text',
    status: dbChat.last_message.status || 'sent',
  } : {
    id: '',
    content: '',
    sender: '',
    timestamp: dbChat.last_message_at ? new Date(dbChat.last_message_at) : new Date(dbChat.created_at || Date.now()),
    type: 'text',
    status: 'sent',
  },
  unreadCount: dbChat.unread_count || 0,
  isOnline: Math.random() > 0.5, // TODO: Implementar status online real
  lastSeen: dbChat.last_message_at ? new Date(dbChat.last_message_at) : new Date(dbChat.created_at || Date.now())
});

const ChatDashboard = () => {
  return (
    <PermissionGuard requiredPermissions={['view_chat']}>
      <ChatDashboardContent />
    </PermissionGuard>
  );
};

const ChatDashboardContent = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  
  // 🎯 NOVO: Estado para controlar visualização mobile
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  
  // ✅ NOVO: Verificar se usuário é super admin
  const { profile } = useAuth();
  const { roles } = useRoles();
  const isSuperAdmin = profile?.role_id && roles.find(r => r.id === profile.role_id)?.name?.toLowerCase().includes('super admin');
  
  const {
    chats: orderedChats, // ✅ CORREÇÃO: Usar nome que indica que vêm ordenados
    messages: rawMessages,
    activeChat,
    loading,
    searchTerm,
    filter,
    setActiveChat,
    setSearchTerm,
    setFilter,
    sendMessage,
    resendMessage,
    createChat,
    markMessagesAsRead,
    fetchChats,
    fetchMessages,
    deleteChat
  } = useSupabaseChat();
  
  // const { fixChatNames } = useChatOperations(); // ✅ REMOVIDO: função não existe mais
  const { toast } = useToast();
  
  // ✅ SIMPLIFICADO: Hook de notificações
  const { notifyNewMessage } = useChatNotifications();

  // Funcionalidades de times e pausas removidas - chat simplificado 1:1

  // ✅ CORRIGIDO: Monitorar apenas mensagens que chegam em tempo real
  const previousMessageCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const currentChatRef = useRef<string | null>(null);

  useEffect(() => {
    // ✅ IGNORAR: Primeira carga de mensagens
    if (isInitialLoadRef.current) {
      previousMessageCountRef.current = rawMessages.length;
      isInitialLoadRef.current = false;
      return;
    }

    // ✅ IGNORAR: Se mudou de chat (carregamento inicial do novo chat)
    if (currentChatRef.current !== activeChat) {
      currentChatRef.current = activeChat;
      previousMessageCountRef.current = rawMessages.length;
      return;
    }

    // ✅ NOTIFICAR: Apenas se chegou uma mensagem nova no mesmo chat
    if (rawMessages.length > previousMessageCountRef.current) {
      const newMessages = rawMessages.slice(previousMessageCountRef.current);
      
      newMessages.forEach(message => {
        // ✅ NOTIFICAR: Apenas mensagens de clientes
        if (!message.is_from_me) {
          notifyNewMessage(message.id);
        }
      });
    }
    
    // ✅ ATUALIZAR: Contador de mensagens
    previousMessageCountRef.current = rawMessages.length;
  }, [rawMessages, activeChat, notifyNewMessage]);

  // ✅ ADICIONADO: Reset quando muda de chat
  useEffect(() => {
    if (activeChat) {
      currentChatRef.current = activeChat;
      // ✅ MARCAR: Como carregamento inicial para o novo chat
      isInitialLoadRef.current = true;
    }
  }, [activeChat]);

  // 🎯 NOVO: Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 🎯 NOVO: Reset mobile view quando muda de chat via URL
  useEffect(() => {
    if (chatId && isMobileView) {
      setShowChatOnMobile(true);
    }
  }, [chatId, isMobileView]);

  // 🎯 NOVO: Função para voltar à lista no mobile
  const handleBackToList = () => {
    setShowChatOnMobile(false);
    setActiveChat(null);
  };

  // 🎯 NOVO: Função para selecionar chat no mobile
  const handleSelectChatMobile = (chatId: string) => {
    handleSelectChat(chatId);
    setShowChatOnMobile(true);
  };

  // ✅ ADICIONADO: Função para ordenar chats por prioridade
  const sortChatsByPriority = useCallback((chats: any[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    return chats.sort((a, b) => {
      // ✅ PRIORIDADE 1: Chats não lidos (unread_count > 0)
      const aUnread = a.unread_count > 0;
      const bUnread = b.unread_count > 0;
      
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;
      
      // ✅ Se ambos têm a mesma condição de leitura, ordenar por data
      const aLastMessage = a.last_message_at ? new Date(a.last_message_at) : new Date(a.created_at);
      const bLastMessage = b.last_message_at ? new Date(b.last_message_at) : new Date(b.created_at);
      
      // ✅ PRIORIDADE 2: Chats do dia (hoje)
      const aIsToday = aLastMessage >= today;
      const bIsToday = bLastMessage >= today;
      
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      
      // ✅ PRIORIDADE 3: Chats de ontem
      const aIsYesterday = aLastMessage >= yesterday && aLastMessage < today;
      const bIsYesterday = bLastMessage >= yesterday && bLastMessage < today;
      
      if (aIsYesterday && !bIsYesterday) return -1;
      if (!aIsYesterday && bIsYesterday) return 1;
      
      // ✅ PRIORIDADE 4: Demais chats (ordenados por data mais recente)
      return bLastMessage.getTime() - aLastMessage.getTime();
    });
  }, []);

  // ✅ MELHORADO: Função para formatar timestamp estilo WhatsApp
  const formatTimestamp = useCallback((timestamp: Date | null | undefined) => {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // ✅ Se é hoje, mostrar hora
    if (messageDate >= today) {
      return messageDate.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // ✅ Se é ontem, mostrar "Ontem"
    if (messageDate >= yesterday) {
      return 'Ontem';
    }
    
    // ✅ Se é dentro da última semana, mostrar dia da semana
    if (messageDate >= weekAgo) {
      const dayNames = [
        'Domingo', 'Segunda', 'Terça', 'Quarta', 
        'Quinta', 'Sexta', 'Sábado'
      ];
      return dayNames[messageDate.getDay()];
    }
    
    // ✅ Se é mais antigo, mostrar data
    return messageDate.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  }, []);

  // ✅ REMOVIDO: Não precisamos mais ordenar aqui pois já vêm ordenados do useChatFilters

  // Efeito para abrir automaticamente o chat quando chatId está na URL
  useEffect(() => {
    if (chatId && !activeChat) {
      setActiveChat(chatId);
      markMessagesAsRead(chatId);
    }
  }, [chatId, activeChat, setActiveChat, markMessagesAsRead]);

  // Função para limpar chats duplicados via API
  const cleanDuplicateChats = async () => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      if (!headers) {
        console.error('Token de autenticação não encontrado');
        return;
      }

      const response = await fetch(`${apiBase}/api/chat/clean-duplicates`, {
        method: 'POST',
        headers
      });

      const result = await response.json();
      
      if (result.success) {
        // Recarregar lista de chats após limpeza
        window.location.reload();
      } else {
        console.error('❌ Erro na limpeza:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao limpar duplicatas:', error);
    }
  };

  // Função para corrigir chats misturados (correção de emergência)
  const fixMixedChats = async () => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      if (!headers) {
        console.error('Token de autenticação não encontrado');
        toast({
          title: "Erro",
          description: "Token de autenticação não encontrado",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "🚨 Correção de Emergência",
        description: "Corrigindo conversas misturadas entre usuários...",
      });

      const response = await fetch(`${apiBase}/api/chat/fix-mixed-chats`, {
        method: 'POST',
        headers
      });

      const result = await response.json();
      
      if (result.success) {
        
        toast({
          title: "🎉 Correção Concluída!",
          description: `${result.stats.clientsCorrected} clientes corrigidos. ${result.stats.duplicatesRemoved} duplicatas removidas. ${result.stats.messagesReassigned} mensagens reorganizadas.`,
          variant: "default",
        });
        
        // Recarregar lista de chats após correção
        await fetchChats();
      } else {
        console.error('❌ Erro na correção:', result.error);
        toast({
          title: "Erro na Correção",
          description: result.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Erro ao corrigir chats misturados:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao corrigir conversas misturadas",
        variant: "destructive",
      });
    }
  };

  const [showFavorites, setShowFavorites] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [countryCode, setCountryCode] = useState('55');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValidPhone, setIsValidPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [existingChat, setExistingChat] = useState<any>(null);
  const [platformFilter, setPlatformFilter] = useState<'whatsapp' | 'internal'>('whatsapp');
  const [orgUsers, setOrgUsers] = useState<{ id: string, name: string | null, avatar_url: string | null }[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);


  // 🔍 LOGS DETALHADOS para debuggar

  // ✅ CORREÇÃO: Transformar dados do banco para formato da UI usando os chats ordenados
  const displayChats = orderedChats.map(chat => transformChat(chat));
  
  // ✅ REMOVEU o filtro - rawMessages já vem filtrado pelo useSupabaseChat
  const displayMessages = rawMessages.map(transformMessage);
  
  const activeChatObject = activeChat ? orderedChats.find(c => c.id === activeChat) : null;

  // ✅ CORREÇÃO: Filtrar por plataforma MAS manter ordenação
  const filteredChats = displayChats.filter(chat => chat.platform === platformFilter);

  // Stats calculadas baseadas no filtro atual
  let chatsToCount = filteredChats;
  if (filter === 'active') chatsToCount = filteredChats.filter(chat => chat.status === 'active');
  if (filter === 'finished') chatsToCount = filteredChats.filter(chat => chat.status === 'finished');

  const totalChatsCount = chatsToCount.length;
  const pendingChatsCount = chatsToCount.filter(chat => chat.unreadCount > 0).length;
  const todayChatsCount = chatsToCount.filter(chat => {
    const today = new Date();
    const chatDate = chat.lastMessage?.timestamp;
    return chatDate && 
           chatDate.getDate() === today.getDate() &&
           chatDate.getMonth() === today.getMonth() &&
           chatDate.getFullYear() === today.getFullYear();
  }).length;

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact' | 'location' = 'text', replyTo?: string) => {
    if (activeChat) {
      await sendMessage(activeChat, content, type, replyTo);
    }
  };

  const handleSelectChat = (chatId: string) => {
    
    // Limpar mensagens imediatamente para evitar mostrar mensagens antigas
    // (o useSupabaseChat vai fazer setMessages([]) também, mas isso garante que seja imediato)
    
    setActiveChat(chatId);
    markMessagesAsRead(chatId);
  };

  // ✅ ADICIONAR indicador de loading para mensagens
  const isLoadingMessages = activeChat && displayMessages.length === 0 && !loading;

  // Formatar apenas o número (DDD + número) para exibição
  const formatPhoneNumber = (input: string) => {
    // Remove todos os caracteres não numéricos
    const cleaned = input.replace(/\D/g, '');
    
    // Se começar com 0, remove o 0
    const withoutLeadingZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
    
    // Formatação para exibição
    if (withoutLeadingZero.length >= 11) {
      // 11 dígitos: DDD + 9 dígitos
      const ddd = withoutLeadingZero.slice(0, 2);
      const firstPart = withoutLeadingZero.slice(2, 7);
      const secondPart = withoutLeadingZero.slice(7, 11);
      return `(${ddd}) ${firstPart}-${secondPart}`;
    }
    
    if (withoutLeadingZero.length >= 10) {
      // 10 dígitos: DDD + 8 dígitos
      const ddd = withoutLeadingZero.slice(0, 2);
      const firstPart = withoutLeadingZero.slice(2, 6);
      const secondPart = withoutLeadingZero.slice(6, 10);
      return `(${ddd}) ${firstPart}-${secondPart}`;
    }
    
    if (withoutLeadingZero.length >= 6) {
      // Parcial: DDD + início do número
      const ddd = withoutLeadingZero.slice(0, 2);
      const rest = withoutLeadingZero.slice(2);
      return `(${ddd}) ${rest}`;
    }
    
    if (withoutLeadingZero.length >= 2) {
      // Apenas DDD
      const ddd = withoutLeadingZero.slice(0, 2);
      const rest = withoutLeadingZero.slice(2);
      return `(${ddd}${rest ? ')' : ''} ${rest}`;
    }
    
    return withoutLeadingZero;
  };

  // Obter número completo (código do país + número)
  const getFullPhoneNumber = () => {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    const withoutLeadingZero = cleanedNumber.startsWith('0') ? cleanedNumber.slice(1) : cleanedNumber;
    return countryCode + withoutLeadingZero;
  };

  // Validar número de telefone
  const validatePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (!cleaned) {
      return { valid: false, error: 'Digite um número de telefone' };
    }
    
    // Deve ter pelo menos 10 dígitos (DDD + 8 dígitos)
    if (cleaned.length < 10) {
      return { valid: false, error: 'Número muito curto (mínimo 10 dígitos)' };
    }
    
    // Deve ter no máximo 11 dígitos (DDD + 9 dígitos)
    if (cleaned.length > 11) {
      return { valid: false, error: 'Número muito longo (máximo 11 dígitos)' };
    }
    
    // Validar DDD (deve estar entre 11 e 99)
    const ddd = cleaned.slice(0, 2);
    if (parseInt(ddd) < 11 || parseInt(ddd) > 99) {
      return { valid: false, error: 'DDD inválido (deve estar entre 11 e 99)' };
    }
    
    // Validar se é celular ou fixo
    const firstDigit = cleaned.charAt(2);
    if (cleaned.length === 11 && firstDigit !== '9') {
      return { valid: false, error: 'Celular deve começar com 9' };
    }
    
    if (cleaned.length === 10 && firstDigit === '9') {
      return { valid: false, error: 'Número fixo não pode começar com 9' };
    }
    
    return { valid: true, error: '' };
  };

  // Obter token de autenticação
  const getAuthToken = async () => {
    try {
      
      // Lista de possíveis chaves onde o Supabase armazena tokens
      const possibleKeys = [
        `sb-${window.location.hostname.replace(/\./g, '-')}-auth-token`,
        `sb-localhost-auth-token`,
        `sb-127-0-0-1-auth-token`,
        'sb-auth-token',
        'supabase.auth.token'
      ];
      
      // Buscar em todas as chaves possíveis
      for (const key of possibleKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.access_token || parsed.token) {
              const token = parsed.access_token || parsed.token;
              return token;
            }
          } catch (e) {
          }
        }
      }
      
      // Buscar qualquer chave que comece com 'sb-'
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              
              // Verificar diferentes estruturas possíveis
              if (parsed.access_token) {
                return parsed.access_token;
              }
              if (parsed.token) {
                return parsed.token;
              }
              if (parsed.session && parsed.session.access_token) {
                return parsed.session.access_token;
              }
              if (parsed.user && parsed.user.access_token) {
                return parsed.user.access_token;
              }
            } catch (e) {
            }
          }
        }
      }

      
      // Como último recurso, tentar obter via API do backend
      const response = await fetch(`${apiBase}/api/chat/session`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Para incluir cookies se necessário
      });

      if (!response.ok) {
        console.error('❌ [TOKEN] Erro ao obter sessão do backend:', response.status);
        return null;
      }

      const result = await response.json();
      if (result.success && result.session && result.session.access_token) {
        return result.session.access_token;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ [TOKEN] Erro ao obter token:', error);
      return null;
    }
  };

  // Verificar se chat já existe para o usuário atual
  const checkExistingChat = async (phone: string) => {
    if (!phone) return;
    
    setIsCheckingExisting(true);
    try {
      // Usar o número completo (código do país + número)
      const cleanedNumber = phone.replace(/\D/g, '');
      const withoutLeadingZero = cleanedNumber.startsWith('0') ? cleanedNumber.slice(1) : cleanedNumber;
      const fullPhoneNumber = countryCode + withoutLeadingZero;
      const whatsappJid = fullPhoneNumber + '@s.whatsapp.net';
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      if (!headers) {
        console.error('Token de autenticação não encontrado');
        setExistingChat(null);
        return;
      }
      
      // Fazer requisição para o backend
      const response = await fetch(`${apiBase}/api/chat/check-existing?whatsapp_jid=${encodeURIComponent(whatsappJid)}`, {
        method: 'GET',
        headers
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.error('Erro ao verificar chat existente:', result.error);
        setExistingChat(null);
        return;
      }
      
      setExistingChat(result.exists ? result.chat : null);
      
    } catch (error) {
      console.error('Erro ao verificar chat:', error);
      setExistingChat(null);
    } finally {
      setIsCheckingExisting(false);
    }
  };

  // Manipular mudança do número de telefone
  const handlePhoneChange = (value: string) => {
    // Armazenar o valor formatado para exibição
    const formattedForDisplay = formatPhoneNumber(value);
    setPhoneNumber(formattedForDisplay);
    
    const validation = validatePhoneNumber(value);
    setIsValidPhone(validation.valid);
    setPhoneError(validation.error);
    
    if (validation.valid) {
      // Debounce para verificar chat existente
      const timeoutId = setTimeout(() => {
        checkExistingChat(value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      setExistingChat(null);
    }
  };

    const handleCreateChat = async () => {
    if (platformFilter === 'whatsapp') {
      if (!isValidPhone) {
        setPhoneError('Digite um número válido');
        return;
      }
      
      // Usar o número completo (código do país + número)
      const fullPhoneNumber = getFullPhoneNumber();
      const whatsappJid = fullPhoneNumber + '@s.whatsapp.net';
      
      // Se o chat já existe, apenas selecionar ele
      if (existingChat) {
        handleSelectChat(existingChat.id);
        handleModalClose(false);
        return;
      }
      
      try {
        // ✅ CORRIGIDO: Usar getAuthHeaders()
        const headers = await getAuthHeaders();
        if (!headers) {
          setPhoneError('Erro de autenticação');
          return;
        }
        
        // Fazer requisição para o backend para criar o chat
        const response = await fetch(`${apiBase}/api/chat`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: fullPhoneNumber,
            platform: 'whatsapp',
            whatsapp_jid: whatsappJid
          })
        });
        
        const result = await response.json();
        
        if (!result.success) {
          console.error('Erro ao criar chat:', result.error);
          setPhoneError('Erro ao criar conversa: ' + result.error);
          return;
        }
        
        
        // ✨ ATUALIZAR A LISTA DE CHATS AUTOMATICAMENTE
        await fetchChats();
        
        // Selecionar o chat recém-criado
        handleSelectChat(result.chat.id);
        handleModalClose(false);
      } catch (error) {
        console.error('Erro ao criar chat:', error);
        setPhoneError('Erro ao criar conversa');
      }
    } else {
      // Chat interno
      if (newChatName.trim()) {
        await createChat(newChatName, platformFilter);
        handleModalClose(false);
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'whatsapp':
        return '📱';
      case 'instagram':
        return '📷';
      case 'telegram':
        return '✈️';
      default:
        return '💬';
    }
  };

  // Limpar campos ao fechar modal
  const handleModalClose = (open: boolean) => {
    setShowNewChatModal(open);
    if (!open) {
      setCountryCode('55');
      setPhoneNumber('');
      setNewChatName('');
      setIsValidPhone(false);
      setPhoneError('');
      setExistingChat(null);
      setIsCheckingExisting(false);
    }
  };

  useEffect(() => {
    async function fetchOrgUsers() {
      if (platformFilter !== 'internal') return;
      
      try {
        // Por enquanto, vamos deixar vazio para chat interno
        // TODO: Implementar rota no backend para buscar usuários da organização
        setOrgUsers([]);
      } catch (error) {
        console.error('Erro ao buscar usuários da organização:', error);
        setOrgUsers([]);
      }
    }
    fetchOrgUsers();
  }, [platformFilter]);

  const handleFinishChat = (chatId: string) => {
    // Aqui você pode implementar a lógica real de finalizar
    alert('Finalizar conversa: ' + chatId);
  };

  const handleFavoriteChat = (chatId: string) => {
    // Aqui você pode implementar a lógica real de favoritar
    alert('Salvar como favorito: ' + chatId);
  };

  // ✅ NOVA FUNÇÃO: Deletar conversa
  const handleDeleteChat = async (chatId: string) => {
    // Confirmar antes de deletar
    const chatName = orderedChats.find(c => c.id === chatId)?.name || 'esta conversa';
    if (!confirm(`Tem certeza que deseja deletar "${chatName}"?\n\nEsta ação não pode ser desfeita e todas as mensagens serão removidas permanentemente.`)) {
      return;
    }

    const success = await deleteChat(chatId);
    
    if (success) {
      // Se o chat deletado era o ativo, limpar o activeChat
      if (activeChat === chatId) {
        setActiveChat(null);
      }
      // Recarregar lista de chats
      fetchChats();
    }
  };

  // ✅ NOVA FUNÇÃO: Atualizar contatos
  const handleUpdateContacts = async () => {
    try {
      
      const headers = await getAuthHeaders();
      
      if (!headers) {
        toast({
          title: "Erro",
          description: "Token de autenticação não encontrado",
          variant: "destructive",
        });
        return;
      }

      
      const response = await fetch(`${apiBase}/api/chat-operations/update-contacts`, {
        method: 'POST',
        headers
      });


      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Atualização Iniciada",
          description: result.message,
        });
        
        // Recarregar lista de chats após atualização
        setTimeout(() => {
          fetchChats();
        }, 2000);
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao atualizar contatos",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao atualizar contatos:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao atualizar contatos",
        variant: "destructive",
      });
    }
  };

  // ✅ NOVA FUNÇÃO: Atualizar contato específico
  const handleUpdateSpecificContact = async (jid: string, chatName: string) => {
    try {
      
      const headers = await getAuthHeaders();
      
      if (!headers) {
        toast({
          title: "Erro",
          description: "Token de autenticação não encontrado",
          variant: "destructive",
        });
        return;
      }

      
      const response = await fetch(`${apiBase}/api/chat-operations/update-specific-contact`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jid })
      });


      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Contato Atualizado",
          description: result.message,
        });
        
        // Recarregar lista de chats após atualização
        setTimeout(() => {
          fetchChats();
        }, 1000);
      } else {
        toast({
          title: "Aviso",
          description: result.message || "Nenhum nome encontrado para o contato",
        });
      }
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao atualizar contato específico:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao atualizar contato",
        variant: "destructive",
      });
    }
  };

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // ✨ TESTE DIRETO: Forçar busca de mensagens quando activeChat muda
  useEffect(() => {
    if (activeChat) {
      // Chamar fetchMessages diretamente aqui para testar
      fetchMessages(activeChat);
    }
  }, [activeChat, fetchMessages]);

  // 🎯 DESKTOP: Layout original (duas colunas)
  if (!isMobileView) {
    return (
      <div className="h-screen flex bg-gray-100">
        {/* Sidebar com lista de conversas */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Header da sidebar */}
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <ul>
                <li className="text-3xl text-zinc-900 leading-tight">
                  <a href="/">
                    doh<span className="text-purple-600">o</span>o
                  </a>
                </li>
              </ul>
              <div className="flex items-center gap-2">
                {/* <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-gray-600 hover:bg-gray-100"
                  onClick={() => fixChatNames()}
                  title="Corrigir nomes dos chats"
                >
                  <Settings className="w-4 h-4" />
                </Button> */}
                {/* <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-red-600 hover:bg-red-50"
                  onClick={fixMixedChats}
                  title="🚨 Correção de Emergência: Corrigir conversas misturadas entre usuários"
                >
                  <AlertCircle className="w-4 h-4" />
                </Button> */}
                <Dialog open={showNewChatModal} onOpenChange={handleModalClose}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-gray-600 hover:bg-gray-100"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Conversa</DialogTitle>
                      <DialogDescription>
                        {platformFilter === 'whatsapp' 
                          ? 'Crie uma nova conversa do WhatsApp informando o número de telefone'
                          : 'Inicie uma nova conversa interna com um usuário da sua organização'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Seletor de plataforma */}
                      <div className="space-y-2">
                        <Label htmlFor="platform">Plataforma</Label>
                        <select
                          id="platform"
                          value={platformFilter}
                          onChange={(e) => setPlatformFilter(e.target.value as 'whatsapp' | 'internal')}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="whatsapp">WhatsApp</option>
                          <option value="internal">Chat Interno</option>
                        </select>
                      </div>

                      {/* Campos específicos do WhatsApp */}
                      {platformFilter === 'whatsapp' ? (
                        <div className="space-y-2">
                          <Label htmlFor="phone">Número do WhatsApp</Label>
                          <div className="flex gap-2">
                            {/* Campo do código do país */}
                            <div className="w-20">
                              <Input
                                id="countryCode"
                                type="text"
                                value={`+${countryCode}`}
                                disabled
                                className="text-center bg-gray-50 border-gray-300 text-gray-600 cursor-not-allowed"
                              />
                            </div>
                            {/* Campo do número */}
                            <div className="flex-1">
                              <Input
                                id="phone"
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="(11) 99999-9999"
                                className={cn(
                                  "w-full",
                                  phoneError && "border-red-500",
                                  isValidPhone && "border-green-500"
                                )}
                              />
                            </div>
                          </div>
                          {phoneError && (
                            <p className="text-sm text-red-500">{phoneError}</p>
                          )}
                          {isValidPhone && (
                            <p className="text-sm text-green-600">
                              ✓ Número válido: +{countryCode} {phoneNumber}
                            </p>
                          )}
                          
                          {/* Indicador de verificação */}
                          {isCheckingExisting && (
                            <p className="text-sm text-gray-500">
                              🔍 Verificando se conversa já existe...
                            </p>
                          )}
                          
                          {/* Chat existente encontrado */}
                          {existingChat && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                              <p className="text-sm text-yellow-800">
                                ⚠️ Conversa já existe com este número
                              </p>
                              <p className="text-xs text-yellow-600 mt-1">
                                Clique em "Abrir Conversa" para acessar a conversa existente
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Campos para chat interno */
                        <div className="space-y-2">
                          <Label htmlFor="name">Selecione o usuário</Label>
                          <select
                            id="name"
                            value={newChatName}
                            onChange={e => setNewChatName(e.target.value)}
                            className="w-full p-2 border rounded-md"
                          >
                            <option value="">Selecione um usuário</option>
                            {orgUsers.map(user => (
                              <option key={user.id} value={user.name || user.id}>
                                {user.name || user.id}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Botão de ação */}
                      <Button 
                        onClick={handleCreateChat}
                        disabled={platformFilter === 'whatsapp' ? !isValidPhone : !newChatName.trim()}
                        className="w-full bg-[#7C45D0] hover:bg-[#8C55E0] disabled:bg-gray-300"
                      >
                        {platformFilter === 'whatsapp' 
                          ? (existingChat ? 'Abrir Conversa' : 'Criar Conversa') 
                          : 'Iniciar Conversa'
                        }
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                {/* <Button 
                  size="sm" 
                  
                  className="text-white hover:bg-[#8C55E0]"
                  onClick={() => setShowFavorites(!showFavorites)}
                >
                  <Star className="w-4 h-4" />
                </Button> */}
                {/* ✅ ADICIONADO: Botão de notificação simples */}
                <NotificationButton onOpenSettings={() => setShowNotificationSettings(true)} />
                
                {/* ✅ NOVO: Botão para atualizar contatos */}
                {/* <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-blue-600 hover:bg-blue-50"
                  onClick={handleUpdateContacts}
                  title="Atualizar nomes e fotos dos contatos teste"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button> */}
              </div>
            </div>
            {/* Seletor de plataforma */}
            <div className="flex gap-2 mb-2">
              <Button
                size="sm"
                variant={platformFilter === 'whatsapp' ? 'default' : 'outline'}
                onClick={() => setPlatformFilter('whatsapp')}
                className="flex-1 text-xs"
              >
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant={platformFilter === 'internal' ? 'default' : 'outline'}
                onClick={() => setPlatformFilter('internal')}
                className="flex-1 text-xs"
              >
                Chat Interno
              </Button>
            </div>
            {/* Barra de pesquisa e filtros */}
            <div className="p-3 border-b border-gray-200 my-4">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Pesquisar conversas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  className="flex-1 text-xs"
                >
                  Todas
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'active' ? 'default' : 'outline'}
                  onClick={() => setFilter('active')}
                  className="flex-1 text-xs"
                >
                  Ativas
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'finished' ? 'default' : 'outline'}
                  onClick={() => setFilter('finished')}
                  className="flex-1 text-xs"
                >
                  <Archive className="w-3 h-3 mr-1" /> Finalizadas
                </Button>
              </div>
            </div>

            {/* Stats rápidas */}
            <div className="grid grid-cols-3 gap-1 text-sm my-1">
              <div className="text-center">
                <div className="text-gray-700">{totalChatsCount}</div>
                <div className="text-xs text-gray-500">
                  {filter === 'finished' ? 'Finalizadas' : filter === 'active' ? 'Ativas' : 'Todas'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-700">{pendingChatsCount}</div>
                <div className="text-xs text-gray-500">Aguardando</div>
              </div>
              <div className="text-center">
                <div className="text-gray-700">{todayChatsCount}</div>
                <div className="text-xs text-gray-500">Hoje</div>
              </div>
            </div>

          </div>

          

          {/* Lista de conversas */}
          <div className="flex-1 overflow-y-auto chat-list-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C45D0]"></div>
              </div>
            ) : (
              (filter === 'finished' ? filteredChats.filter(chat => chat.status === 'finished') : filteredChats)
                .length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma conversa encontrada</p>
                  <Button 
                    onClick={() => setShowNewChatModal(true)}
                    className="mt-3"
                    size="sm"
                  >
                    Iniciar Conversa
                  </Button>
                </div>
              ) : (
                (filter === 'finished' ? filteredChats.filter(chat => chat.status === 'finished') : filteredChats)
                  .map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className={cn(
                        "p-3 mx-2 my-1 rounded-lg cursor-pointer transition-all duration-200 group",
                        activeChat === chat.id 
                          ? "bg-[#E7F3FF] border border-[#B3D9FF]" 
                          : "hover:bg-gray-100 border border-transparent hover:border-gray-200"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg shadow-lg">
                            {(() => {
                              const validAvatarUrl = chat.avatar_url && !chat.avatar_url.includes('pps.whatsapp.net') && !chat.avatar_url.includes('whatsapp.net') ? chat.avatar_url : null;
                              return validAvatarUrl ? (
                                <img src={validAvatarUrl} alt={chat.name?.charAt(0)} className="rounded-full w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                chat.name?.charAt(0).toUpperCase()
                              );
                            })()}
                          </div>
                          {chat.isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-gray-900 truncate">{chat.name}</h3>
                            <span className="text-xs text-gray-500">
                              {/* ✅ CORRIGIDO: Formatação simples */}
                              {chat.lastMessage?.timestamp ? formatTimestamp(chat.lastMessage.timestamp) : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-gray-500 truncate flex-1">
                              {chat.lastMessage?.content
                                ? chat.lastMessage.content.length > 30
                                  ? chat.lastMessage.content.slice(0, 30) + '...'
                                  : chat.lastMessage.content
                                : 'Sem mensagens'}
                            </p>
                            {chat.unreadCount > 0 && (
                              <Badge variant="default" className="bg-[#7C45D0] ml-2">
                                {chat.unreadCount}
                              </Badge>
                            )}
                            <div className="relative ml-2">
                              <button
                                className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => { e.stopPropagation(); setMenuOpen(chat.id); }}
                              >
                                <ChevronDown size={18} />
                              </button>
                              {menuOpen === chat.id && (
                                <div ref={menuRef} className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-50">
                                  <button
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-100"
                                    onClick={e => { e.stopPropagation(); handleFinishChat(chat.id); setMenuOpen(null); }}
                                  >
                                    <CheckCircle size={18} className="text-green-600" />
                                    Finalizar conversa
                                  </button>
                                  <button
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-100"
                                    onClick={e => { e.stopPropagation(); handleFavoriteChat(chat.id); setMenuOpen(null); }}
                                  >
                                    <Star size={18} className="text-yellow-500" />
                                    Salvar como favorito
                                  </button>
                                  {/* ✅ NOVO: Botão para atualizar contato específico */}
                                  {chat.platform === 'whatsapp' && (
                                    <button
                                      className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-100"
                                      onClick={e => { 
                                        e.stopPropagation(); 
                                        // Buscar o JID real do chat no banco
                                        const originalChat = orderedChats.find(c => c.id === chat.id);
                                        const jid = originalChat?.whatsapp_jid;
                                        
                                        if (jid) {
                                          handleUpdateSpecificContact(jid, chat.name);
                                        } else {
                                          toast({
                                            title: "Aviso",
                                            description: "Não foi possível identificar o número do contato",
                                          });
                                        }
                                        setMenuOpen(null); 
                                      }}
                                    >
                                      <RefreshCw size={18} className="text-blue-600" />
                                      Atualizar contato
                                    </button>
                                  )}
                                  {/* ✅ NOVO: Botão para deletar conversa - Apenas para super admins */}
                                  {isSuperAdmin && (
                                    <button
                                      className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                                      onClick={e => { 
                                        e.stopPropagation(); 
                                        handleDeleteChat(chat.id);
                                        setMenuOpen(null); 
                                      }}
                                    >
                                      <Trash2 size={18} />
                                      Deletar conversa
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )
            )}
          </div>
        </div>

        {/* Área principal do chat */}
        <div className="flex-1">
          <ChatWindow
            chat={activeChatObject || undefined}
            messages={displayMessages}
            onSendMessage={handleSendMessage}
            onResendMessage={resendMessage}
            onBack={handleBackToList}
            // 🎯 NOVO: Props para time e pausas
          />
        </div>

        {/* Painel de mensagens favoritas */}
        {showFavorites && (
          <FavoriteMessagesPanel
            onClose={() => setShowFavorites(false)}
            onSelectMessage={handleSendMessage}
          />
        )}

        {/* Modal de configurações de notificação */}
        <NotificationSettings
          open={showNotificationSettings}
          onClose={() => setShowNotificationSettings(false)}
        />
      </div>
    );
  }

  // 🎯 MOBILE: Renderizar apenas a lista de conversas
  if (isMobileView && !showChatOnMobile) {
    return (
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Header da lista */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <ul>
              <li className="text-2xl text-zinc-900 leading-tight">
                <a href="/">
                  doh<span className="text-purple-600">o</span>o
                </a>
              </li>
            </ul>
            <div className="flex items-center gap-2">
              {/* ✅ MODIFICADO: Botão de notificação com funcionalidade de modal */}
              <NotificationButton onOpenSettings={() => setShowNotificationSettings(true)} />
            </div>
          </div>

          {/* Filtros de plataforma */}
          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant={platformFilter === 'whatsapp' ? 'default' : 'outline'}
              onClick={() => setPlatformFilter('whatsapp')}
              className="flex-1 text-xs"
            >
              WhatsApp
            </Button>
            <Button
              size="sm"
              variant={platformFilter === 'internal' ? 'default' : 'outline'}
              onClick={() => setPlatformFilter('internal')}
              className="flex-1 text-xs"
            >
              Chat Interno
            </Button>
          </div>

          {/* Filtros de status */}
          <div className="flex gap-1 mb-3">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className="flex-1 text-xs"
            >
              Todas
            </Button>
            <Button
              size="sm"
              variant={filter === 'active' ? 'default' : 'outline'}
              onClick={() => setFilter('active')}
              className="flex-1 text-xs"
            >
              Ativas
            </Button>
            <Button
              size="sm"
              variant={filter === 'finished' ? 'default' : 'outline'}
              onClick={() => setFilter('finished')}
              className="flex-1 text-xs"
            >
              <Archive className="w-3 h-3 mr-1" /> Finalizadas
            </Button>
          </div>

          {/* Stats rápidas */}
          <div className="grid grid-cols-3 gap-1 text-sm">
            <div className="text-center">
              <div className="text-gray-700">{totalChatsCount}</div>
              <div className="text-xs text-gray-500">
                {filter === 'finished' ? 'Finalizadas' : filter === 'active' ? 'Ativas' : 'Todas'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-700">{pendingChatsCount}</div>
              <div className="text-xs text-gray-500">Aguardando</div>
            </div>
            <div className="text-center">
              <div className="text-gray-700">{todayChatsCount}</div>
              <div className="text-xs text-gray-500">Hoje</div>
            </div>
          </div>

        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C45D0]"></div>
            </div>
          ) : (
            (filter === 'finished' ? filteredChats.filter(chat => chat.status === 'finished') : filteredChats)
              .length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma conversa encontrada</p>
                <Button 
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-3"
                  size="sm"
                >
                  Iniciar Conversa
                </Button>
              </div>
            ) : (
              (filter === 'finished' ? filteredChats.filter(chat => chat.status === 'finished') : filteredChats)
                .map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChatMobile(chat.id)}
                    className="p-3 mx-2 my-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg shadow-lg">
                          {(() => {
                            const validAvatarUrl = chat.avatar_url && !chat.avatar_url.includes('pps.whatsapp.net') && !chat.avatar_url.includes('whatsapp.net') ? chat.avatar_url : null;
                            return validAvatarUrl ? (
                              <img src={validAvatarUrl} alt={chat.name?.charAt(0)} className="rounded-full w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              chat.name?.charAt(0).toUpperCase()
                            );
                          })()}
                        </div>
                        {chat.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-gray-900 truncate">{chat.name}</h3>
                          <span className="text-xs text-gray-500">
                            {chat.lastMessage?.timestamp ? formatTimestamp(chat.lastMessage.timestamp) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-500 truncate flex-1">
                            {chat.lastMessage?.content
                              ? chat.lastMessage.content.length > 30
                                ? chat.lastMessage.content.slice(0, 30) + '...'
                                : chat.lastMessage.content
                              : 'Sem mensagens'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <Badge variant="default" className="bg-[#7C45D0] ml-2">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )
          )}
        </div>
      </div>
    );
  }

  // 🎯 MOBILE: Renderizar apenas o chat
  if (isMobileView && showChatOnMobile && activeChat) {
    return (
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Área do chat */}
        <div className="flex-1">
          <ChatWindow
            chat={activeChatObject || undefined}
            messages={displayMessages}
            onSendMessage={handleSendMessage}
            onResendMessage={resendMessage}
            onBack={handleBackToList}
          />
        </div>
      </div>
    );
  }

  // 🎯 DESKTOP: Layout original (duas colunas)
  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar com lista de conversas */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        {/* Header da sidebar */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <ul>
              <li className="text-3xl text-zinc-900 leading-tight">
                <a href="/">
                  doh<span className="text-purple-600">o</span>o
                </a>
              </li>
            </ul>
            <div className="flex items-center gap-2">
              {/* <Button 
                size="sm" 
                variant="ghost" 
                className="text-gray-600 hover:bg-gray-100"
                onClick={() => fixChatNames()}
                title="Corrigir nomes dos chats"
              >
                <Settings className="w-4 h-4" />
              </Button> */}
              {/* <Button 
                size="sm" 
                variant="ghost" 
                className="text-red-600 hover:bg-red-50"
                onClick={fixMixedChats}
                title="🚨 Correção de Emergência: Corrigir conversas misturadas entre usuários"
              >
                <AlertCircle className="w-4 h-4" />
              </Button> */}
              <Dialog open={showNewChatModal} onOpenChange={handleModalClose}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-gray-600 hover:bg-gray-100"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Conversa</DialogTitle>
                    <DialogDescription>
                      {platformFilter === 'whatsapp' 
                        ? 'Crie uma nova conversa do WhatsApp informando o número de telefone'
                        : 'Inicie uma nova conversa interna com um usuário da sua organização'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Seletor de plataforma */}
                    <div className="space-y-2">
                      <Label htmlFor="platform">Plataforma</Label>
                      <select
                        id="platform"
                        value={platformFilter}
                        onChange={(e) => setPlatformFilter(e.target.value as 'whatsapp' | 'internal')}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="internal">Chat Interno</option>
                      </select>
                    </div>

                    {/* Campos específicos do WhatsApp */}
                    {platformFilter === 'whatsapp' ? (
                      <div className="space-y-2">
                        <Label htmlFor="phone">Número do WhatsApp</Label>
                        <div className="flex gap-2">
                          {/* Campo do código do país */}
                          <div className="w-20">
                            <Input
                              id="countryCode"
                              type="text"
                              value={`+${countryCode}`}
                              disabled
                              className="text-center bg-gray-50 border-gray-300 text-gray-600 cursor-not-allowed"
                            />
                          </div>
                          {/* Campo do número */}
                          <div className="flex-1">
                            <Input
                              id="phone"
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => handlePhoneChange(e.target.value)}
                              placeholder="(11) 99999-9999"
                              className={cn(
                                "w-full",
                                phoneError && "border-red-500",
                                isValidPhone && "border-green-500"
                              )}
                            />
                          </div>
                        </div>
                        {phoneError && (
                          <p className="text-sm text-red-500">{phoneError}</p>
                        )}
                        {isValidPhone && (
                          <p className="text-sm text-green-600">
                            ✓ Número válido: +{countryCode} {phoneNumber}
                          </p>
                        )}
                        
                        {/* Indicador de verificação */}
                        {isCheckingExisting && (
                          <p className="text-sm text-gray-500">
                            🔍 Verificando se conversa já existe...
                          </p>
                        )}
                        
                        {/* Chat existente encontrado */}
                        {existingChat && (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <p className="text-sm text-yellow-800">
                              ⚠️ Conversa já existe com este número
                            </p>
                            <p className="text-xs text-yellow-600 mt-1">
                              Clique em "Abrir Conversa" para acessar a conversa existente
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Campos para chat interno */
                      <div className="space-y-2">
                        <Label htmlFor="name">Selecione o usuário</Label>
                        <select
                          id="name"
                          value={newChatName}
                          onChange={e => setNewChatName(e.target.value)}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="">Selecione um usuário</option>
                          {orgUsers.map(user => (
                            <option key={user.id} value={user.name || user.id}>
                              {user.name || user.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Botão de ação */}
                    <Button 
                      onClick={handleCreateChat}
                      disabled={platformFilter === 'whatsapp' ? !isValidPhone : !newChatName.trim()}
                      className="w-full bg-[#7C45D0] hover:bg-[#8C55E0] disabled:bg-gray-300"
                    >
                      {platformFilter === 'whatsapp' 
                        ? (existingChat ? 'Abrir Conversa' : 'Criar Conversa') 
                        : 'Iniciar Conversa'
                      }
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              
              
              {/* <Button 
                size="sm" 
                
                className="text-white hover:bg-[#8C55E0]"
                onClick={() => setShowFavorites(!showFavorites)}
              >
                <Star className="w-4 h-4" />
              </Button> */}
              {/* ✅ ADICIONADO: Botão de notificação simples */}
              <NotificationButton onOpenSettings={() => setShowNotificationSettings(true)} />
              
              
              {/* ✅ NOVO: Botão para atualizar contatos */}
              {/* <Button 
                size="sm" 
                variant="ghost" 
                className="text-blue-600 hover:bg-blue-50"
                onClick={handleUpdateContacts}
                title="Atualizar nomes e fotos dos contatos"
              >
                <RefreshCw className="w-4 h-4" />
              </Button> */}
            </div>
          </div>
          {/* Seletor de plataforma */}
          <div className="flex gap-2 mb-2">
            <Button
              size="sm"
              variant={platformFilter === 'whatsapp' ? 'default' : 'outline'}
              onClick={() => setPlatformFilter('whatsapp')}
              className="flex-1 text-xs"
            >
              WhatsApp
            </Button>
            <Button
              size="sm"
              variant={platformFilter === 'internal' ? 'default' : 'outline'}
              onClick={() => setPlatformFilter('internal')}
              className="flex-1 text-xs"
            >
              Chat Interno
            </Button>
          </div>
          {/* Barra de pesquisa e filtros */}
          <div className="p-3 border-b border-gray-200 my-4">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Pesquisar conversas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                className="flex-1 text-xs"
              >
                Todas
              </Button>
              <Button
                size="sm"
                variant={filter === 'active' ? 'default' : 'outline'}
                onClick={() => setFilter('active')}
                className="flex-1 text-xs"
              >
                Ativas
              </Button>
              <Button
                size="sm"
                variant={filter === 'finished' ? 'default' : 'outline'}
                onClick={() => setFilter('finished')}
                className="flex-1 text-xs"
              >
                <Archive className="w-3 h-3 mr-1" /> Finalizadas
              </Button>
            </div>
          </div>

          {/* Stats rápidas */}
          <div className="grid grid-cols-3 gap-1 text-sm my-1">
            <div className="text-center">
              <div className="text-gray-700">{totalChatsCount}</div>
              <div className="text-xs text-gray-500">
                {filter === 'finished' ? 'Finalizadas' : filter === 'active' ? 'Ativas' : 'Todas'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-700">{pendingChatsCount}</div>
              <div className="text-xs text-gray-500">Aguardando</div>
            </div>
            <div className="text-center">
              <div className="text-gray-700">{todayChatsCount}</div>
              <div className="text-xs text-gray-500">Hoje</div>
            </div>
          </div>
        </div>

        

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto chat-list-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C45D0]"></div>
            </div>
          ) : (
            (filter === 'finished' ? filteredChats.filter(chat => chat.status === 'finished') : filteredChats)
              .length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma conversa encontrada</p>
                <Button 
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-3"
                  size="sm"
                >
                  Iniciar Conversa
                </Button>
              </div>
            ) : (
              (filter === 'finished' ? filteredChats.filter(chat => chat.status === 'finished') : filteredChats)
                .map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat.id)}
                    className={cn(
                      "p-3 mx-2 my-1 rounded-lg cursor-pointer transition-all duration-200 group",
                      activeChat === chat.id 
                        ? "bg-[#E7F3FF] border border-[#B3D9FF]" 
                        : "hover:bg-gray-100 border border-transparent hover:border-gray-200"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg shadow-lg">
                          {(() => {
                            const validAvatarUrl = chat.avatar_url && !chat.avatar_url.includes('pps.whatsapp.net') && !chat.avatar_url.includes('whatsapp.net') ? chat.avatar_url : null;
                            return validAvatarUrl ? (
                              <img src={validAvatarUrl} alt={chat.name?.charAt(0)} className="rounded-full w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              chat.name?.charAt(0).toUpperCase()
                            );
                          })()}
                        </div>
                        {chat.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-gray-900 truncate">{chat.name}</h3>
                          <span className="text-xs text-gray-500">
                            {chat.lastMessage?.timestamp ? formatTimestamp(chat.lastMessage.timestamp) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-500 truncate flex-1">
                            {chat.lastMessage?.content
                              ? chat.lastMessage.content.length > 30
                                ? chat.lastMessage.content.slice(0, 30) + '...'
                                : chat.lastMessage.content
                              : 'Sem mensagens'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <Badge variant="default" className="bg-[#7C45D0] ml-2">
                              {chat.unreadCount}
                            </Badge>
                          )}
                          <div className="relative ml-2">
                            <button
                              className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => { e.stopPropagation(); setMenuOpen(chat.id); }}
                            >
                              <ChevronDown size={18} />
                            </button>
                            {menuOpen === chat.id && (
                              <div ref={menuRef} className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-50">
                                <button
                                  className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-100"
                                  onClick={e => { e.stopPropagation(); handleFinishChat(chat.id); setMenuOpen(null); }}
                                >
                                  <CheckCircle size={18} className="text-green-600" />
                                  Finalizar conversa
                                </button>
                                <button
                                  className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-100"
                                  onClick={e => { e.stopPropagation(); handleFavoriteChat(chat.id); setMenuOpen(null); }}
                                >
                                  <Star size={18} className="text-yellow-500" />
                                  Salvar como favorito
                                </button>
                                {/* ✅ NOVO: Botão para atualizar contato específico */}
                                {chat.platform === 'whatsapp' && (
                                  <button
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-gray-100"
                                    onClick={e => { 
                                      e.stopPropagation(); 
                                      // Buscar o JID real do chat no banco
                                      const originalChat = orderedChats.find(c => c.id === chat.id);
                                      const jid = originalChat?.whatsapp_jid;
                                      
                                      if (jid) {
                                        handleUpdateSpecificContact(jid, chat.name);
                                      } else {
                                        toast({
                                          title: "Aviso",
                                          description: "Não foi possível identificar o número do contato",
                                        });
                                      }
                                      setMenuOpen(null); 
                                    }}
                                  >
                                    <RefreshCw size={18} className="text-blue-600" />
                                    Atualizar contato
                                  </button>
                                )}
                                {/* ✅ NOVO: Botão para deletar conversa - Apenas para super admins */}
                                {isSuperAdmin && (
                                  <button
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                                    onClick={e => { 
                                      e.stopPropagation(); 
                                      handleDeleteChat(chat.id);
                                      setMenuOpen(null); 
                                    }}
                                  >
                                    <Trash2 size={18} />
                                    Deletar conversa
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )
          )}
        </div>
      </div>

      {/* Área principal do chat */}
      <div className="flex-1">
        <ChatWindow
          chat={activeChatObject || undefined}
          messages={displayMessages}
          onSendMessage={handleSendMessage}
          onResendMessage={resendMessage}
          onBack={handleBackToList}
        />
      </div>

      {/* Painel de mensagens favoritas */}
      {showFavorites && (
        <FavoriteMessagesPanel
          onClose={() => setShowFavorites(false)}
          onSelectMessage={handleSendMessage}
        />
      )}

      {/* Modal de configurações de notificação */}
      <NotificationSettings
        open={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </div>
  );
};

export default ChatDashboard;
