import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image, Smile, Star, Phone, Video, MoreVertical, MessageCircle, Reply, Forward, Copy, Flag, FileText, FileAudio, FileArchive, FileVideo, File, Download, Square, RotateCcw, User, MapPin, Eye, Loader2, RefreshCw, ThumbsUp, Heart, CheckCircle, Search, Plus, Clock, ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteMessagesPanel } from './FavoriteMessagesPanel';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiBase } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  content: string;
  sender: 'agent' | 'user';
  senderName?: string;
  timestamp: Date;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact' | 'location';
  isInternal?: boolean;
  isImportant?: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  media_url?: string;
  reactions?: { [key: string]: string[] }; // { "👍": ["user1", "user2"], "❤️": ["user3"] }
  metadata?: {
    filename?: string;
    mimetype?: string;
    timestamp?: string;
    fileSize?: number;
    localPath?: string;
    isVoiceMessage?: boolean;
    hasCaption?: boolean;
    ai_generated?: boolean;
    assistant_id?: string;
    tokens_used?: number;
    transcription?: string;
    transcribed_at?: string;
    agent_name?: string;
    show_name_in_chat?: boolean;
    bot_generated?: boolean;
    error?: string;
    failed_at?: string;
    resent_at?: string;
    reply_to?: string; // Adicionado para indicar a mensagem original que este reply responde
  };
}

interface ChatWindowProps {
  chat: Tables<'chats'> | null;
  messages: Message[];
  onSendMessage: (content: string, type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact' | 'location', replyTo?: string) => void;
  selectedMessages?: string[];
  onToggleMessageSelection?: (messageId: string) => void;
  onMarkAsImportant?: (messageId: string) => void;
  onResendMessage?: (messageId: string) => void;
  onReactToMessage?: (messageId: string, reaction: string) => void;
  onReplyToMessage?: (messageId: string) => void;
  onForwardMessage?: (messageId: string) => void;
  onBack?: () => void; // Nova prop para voltar
}

const ChatWindow = ({
  chat,
  messages,
  onSendMessage,
  selectedMessages = [],
  onToggleMessageSelection,
  onMarkAsImportant,
  onResendMessage,
  onReactToMessage,
  onReplyToMessage,
  onForwardMessage,
  onBack
}: ChatWindowProps) => {
  const { profile } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showFavoriteMessages, setShowFavoriteMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<File | null>(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [fileUploadLoading, setFileUploadLoading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  // Estados para gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioUploadLoading, setAudioUploadLoading] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string>('audio/webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);

  // Adicionar estado para caption
  const [imageCaption, setImageCaption] = useState('');
  const [fileCaption, setFileCaption] = useState('');
  const [audioCaption, setAudioCaption] = useState('');

  // Reações disponíveis
  const availableReactions = [
    { emoji: '👍', label: 'Curtir' },
    { emoji: '❤️', label: 'Amar' },
    { emoji: '😂', label: 'Rir' },
    { emoji: '😮', label: 'Surpreso' },
    { emoji: '😢', label: 'Triste' },
    { emoji: '😡', label: 'Bravo' }
  ];

  const [isMenuOpen, setIsMenuOpen] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = messages.filter(message => 
        message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (message.senderName && message.senderName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (message.metadata?.transcription && message.metadata.transcription.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, messages]);

  // Helper function to highlight search terms
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-purple-200 text-purple-900">
          {part}
        </span>
      ) : part
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  // Cleanup de recursos de gravação
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      console.log('📤 Enviando mensagem com replyTo:', replyingTo?.id);
      onSendMessage(newMessage, 'text', replyingTo?.id);
      setNewMessage('');
      setReplyingTo(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectFavoriteMessage = (content: string) => {
    setNewMessage(content);
    setShowFavoriteMessages(false);
  };

  // Função para inserir emoji no texto
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const textBefore = newMessage.substring(0, cursor);
    const textAfter = newMessage.substring(cursor);
    const newText = textBefore + emojiData.emoji + textAfter;
    setNewMessage(newText);

    // Foca no textarea e posiciona o cursor após o emoji
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursor = cursor + emojiData.emoji.length;
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  // Funções para gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Verificar formatos suportados - priorizar formatos mais compatíveis
      const mimeTypes = [
        'audio/mp4',
        'audio/mp3',
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];

      let selectedMimeType = null;
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('Nenhum formato de áudio suportado');
      }

      console.log('🎵 Usando formato de áudio:', selectedMimeType);
      setSelectedMimeType(selectedMimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000 // 128kbps para melhor qualidade
      });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setShowAudioModal(true);

        // Parar todas as tracks do stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Iniciar contador de tempo
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev: number) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      alert('Erro ao acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

              // Parar todas as tracks do stream
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const quickReplies = [
    '👍 Obrigado!',
    '⏰ Vou verificar e retorno em breve',
    '❓ Poderia fornecer mais detalhes?',
    '✅ Problema resolvido!',
    '🙋‍♂️ Fico à disposição para outras dúvidas'
  ];

  // Função para testar conexão com o backend
  const testBackendConnection = async () => {
    try {
      console.log('🔍 Testando conexão com o backend...');
      const response = await axios.get(`${apiBase}/health`, { timeout: 5000 });
      console.log('✅ Backend conectado:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Backend não conectado:', error instanceof Error ? error.message : 'Erro desconhecido');
      return false;
    }
  };

  // Função para upload de arquivo
  const handleFileUpload = async (file: File | Blob, type: 'image' | 'file' | 'audio', caption?: string) => {
    if (!chat) return false;
    console.log('📁 Iniciando upload:', { type, fileType: file.constructor.name, fileSize: file.size });

    // Testar conexão com o backend primeiro
    const backendConnected = await testBackendConnection();
    if (!backendConnected) {
      setImageUploadError('Backend não está conectado');
      return false;
    }

    const formData = new FormData();

    try {
      // Se for um Blob (áudio), usar diretamente
      if (file && typeof file === 'object' && 'type' in file && !('name' in file)) {
        console.log('🎵 Processando Blob de áudio');
        console.log('�� Tipo MIME original:', file.type);
        // Criar um novo Blob com tipo MIME explícito
        const audioBlob = new Blob([file], { type: selectedMimeType });
        console.log('🎵 Tipo MIME após conversão:', audioBlob.type);

        // Determinar extensão baseada no tipo MIME
        let extension = 'webm';
        if (selectedMimeType.includes('mp4')) extension = 'm4a';
        else if (selectedMimeType.includes('mp3')) extension = 'mp3';
        else if (selectedMimeType.includes('ogg')) extension = 'ogg';
        else if (selectedMimeType.includes('webm')) extension = 'webm';

        formData.append('file', audioBlob, `audio_${Date.now()}.${extension}`);
      } else {
        console.log('📄 Processando arquivo normal');
        formData.append('file', file);
      }
      // Adicionar caption se existir
      if (caption && caption.trim() !== '') {
        formData.append('caption', caption.trim());
      }

      console.log('📋 FormData criado com sucesso');
      console.log('📋 FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }

      setImageUploadError(null);
      setImageUploadLoading(true);
      console.log('🚀 Fazendo requisição axios...');
      const res = await axios.post(`${apiBase}/api/chat/${chat.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000, // 30 segundos de timeout
        onUploadProgress: (progressEvent: any) => {
          console.log('📤 Progresso do upload:', progressEvent);
        }
      });

      console.log('✅ Resposta do servidor:', res.data);

      if (res.data && res.data.url) {
        // O backend já salvou a mensagem no banco, não precisamos chamar onSendMessage
        console.log('✅ Arquivo enviado com sucesso:', res.data.url);
        console.log('✅ Mensagem já salva no banco pelo backend');
        
        if (type === 'image') {
          setImagePreview(null);
          setImageFile(null);
          setImageCaption('');
        } else if (type === 'file') {
          setFileCaption('');
        } else if (type === 'audio') {
          setAudioCaption('');
        }
        setImageUploadLoading(false);
        setShowImageModal(false);
        setShowFileModal(false);
        setShowAudioModal(false);
        return true;
      }
      setImageUploadLoading(false);
      setImageUploadError('Erro ao enviar arquivo.');
      return false;
    } catch (err: any) {
      console.error('❌ Erro no upload:', err);
      console.error('❌ Detalhes do erro:', err.response?.data || err.message);
      console.error('❌ Status do erro:', err.response?.status);
      console.error('❌ Headers do erro:', err.response?.headers);
      setImageUploadLoading(false);
      setImageUploadError('Erro ao enviar arquivo.');
      return false;
    }
  };

  // Função utilitária para identificar o ícone do arquivo
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return <File className="w-8 h-8 text-blue-500" />;

    // Documentos
    if (["pdf"].includes(ext)) return <FileText className="w-8 h-8 text-red-500" />;
    if (["doc", "docx"].includes(ext)) return <FileText className="w-8 h-8 text-blue-600" />;
    if (["xls", "xlsx"].includes(ext)) return <FileText className="w-8 h-8 text-green-600" />;
    if (["ppt", "pptx"].includes(ext)) return <FileText className="w-8 h-8 text-orange-600" />;
    if (["txt"].includes(ext)) return <FileText className="w-8 h-8 text-gray-600" />;

    // Arquivos compactados
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return <FileArchive className="w-8 h-8 text-yellow-600" />;

    // Áudio
    if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) return <FileAudio className="w-8 h-8 text-purple-500" />;

    // Vídeo
    if (["mp4", "mov", "avi", "mkv", "wmv", "flv", "3gp"].includes(ext)) return <FileVideo className="w-8 h-8 text-red-500" />;

    // Imagens
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext)) return <Image className="w-8 h-8 text-green-500" />;

    // Outros
    return <FileText className="w-8 h-8 text-blue-500" />;
  };

  // Adiciona função para deixar o nome do arquivo mais amigável
  function beautifyFilename(filename: string, fileSize?: number) {
    // Remove prefixos tipo "file-<timestamp>-<random>-"
    const match = filename.match(/file-\d+-\d+-(.+)/);
    const clean = match ? match[1] : filename;

    // Limita tamanho e adiciona reticências
    const maxLen = 22;
    let displayName = clean;
    if (clean.length > maxLen) {
      const ext = clean.split('.').pop();
      const base = clean.slice(0, maxLen - (ext?.length || 0) - 3);
      displayName = base + '...' + (ext ? '.' + ext : '');
    }

    // Adicionar tamanho do arquivo se disponível
    if (fileSize) {
      const sizeInKB = Math.round(fileSize / 1024);
      const sizeInMB = Math.round(fileSize / (1024 * 1024) * 10) / 10;
      const sizeText = sizeInMB >= 1 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
      return `${displayName} (${sizeText})`;
    }

    return displayName;
  }

  // Função utilitária para exibir "Hoje", "Ontem" ou data
  function getDateLabel(date: Date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return 'Hoje';
    }
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return 'Ontem';
    }
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  const handleReaction = (messageId: string, reaction: string) => {
    if (onReactToMessage) {
      onReactToMessage(messageId, reaction);
    }
    setShowReactions(null);
  };

  const handleReply = (message: Message) => {
    console.log('🔄 Definindo mensagem para resposta:', message.id, message.content);
    if (onReplyToMessage) {
      onReplyToMessage(message.id);
    }
    setReplyingTo(message);
    textareaRef.current?.focus();
  };

  const handleForward = (messageId: string) => {
    if (onForwardMessage) {
      onForwardMessage(messageId);
    }
  };

  const handleCopyMessage = async (message: Message) => {
    const textToCopy = message.content || message.metadata?.filename || 'Mensagem copiada';
    try {
      await navigator.clipboard.writeText(textToCopy);
      // Aqui você pode adicionar um toast de sucesso
      console.log('Mensagem copiada para a área de transferência');
    } catch (err) {
      console.error('Erro ao copiar mensagem:', err);
    }
  };

  const getReactionCount = (message: Message, reaction: string) => {
    return message.reactions?.[reaction]?.length || 0;
  };

  const hasUserReacted = (message: Message, reaction: string) => {
    return message.reactions?.[reaction]?.includes(profile?.id || '') || false;
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 min-h-screen">
        <div className="text-center max-w-lg px-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageCircle size={36} className="text-primary" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">
            Bem-vindo ao Chat
          </h3>
          <p className="text-gray-600 mb-6 text-base">
            Selecione uma conversa da lista para começar a atender seus clientes
          </p>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-600 text-xs">💡</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 mb-1">Dica</p>
                <p className="text-sm text-gray-600">
                  Use mensagens favoritas para responder rapidamente aos seus clientes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] relative">
      {/* Chat Header - Fixed at top */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onBack || (() => window.history.back())}
              title="Voltar"
              className="mr-2 sm:hidden"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </Button>
            <div className="relative">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-white text-lg shadow-lg">
                {(() => {
                  const validAvatarUrl = chat.avatar_url && !chat.avatar_url.includes('pps.whatsapp.net') && !chat.avatar_url.includes('whatsapp.net') ? chat.avatar_url : null;
                  return validAvatarUrl ? (
                    <img src={validAvatarUrl} alt={chat.name?.charAt(0)} className="rounded-full w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (chat.is_group || chat.whatsapp_jid?.includes('@g.us')) ? (
                    <Users size={24} className="text-gray-600" />
                  ) : (
                    chat.name?.charAt(0).toUpperCase()
                  );
                })()}
              </div>
              {!(chat.is_group || chat.whatsapp_jid?.includes('@g.us')) && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <div>
              <h3 className="text-gray-800">
                {/* ✅ CORRIGIDO: Sempre mostrar o nome do grupo para grupos */}
                {(chat.is_group || chat.whatsapp_jid?.includes('@g.us')) 
                  ? (chat.name || 'Grupo') 
                  : chat.name
                }
              </h3>
              <div className="flex items-center space-x-2">
                {(chat.is_group || chat.whatsapp_jid?.includes('@g.us')) ? (
                  <span className="text-sm text-gray-500">
                    {/* ✅ CORRIGIDO: Mostrar participantes ou ID do grupo */}
                    {chat.participants?.length > 0 
                      ? chat.participants.map((p: any) => p.name).join(', ')
                      : (chat.whatsapp_jid?.split('@')[0] || 'Participantes')
                    }
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">{chat.whatsapp_jid?.split('@')[0]}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSearchModal(true)}
              title="Pesquisar mensagens"
            >
              <Search size={20} className="text-gray-600" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area - Scrollable */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6 space-y-2"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#f8fafc'
        }}
      >
        {(() => {
          let lastDate: string | null = null;
          console.log('🎵 Mensagens para renderizar:', messages);
          console.log("profile.name: ", profile?.name);
          return messages.map((message, idx) => {
            const msgDate = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
            const dateLabel = getDateLabel(msgDate);
            const showDivider = dateLabel !== lastDate;
            lastDate = dateLabel;
            // Buscar mensagem original se for reply
            let originalMessage: Message | undefined = undefined;
            if (message.reply_to) {
              originalMessage = messages.find(m => m.id === message.reply_to);
            }
            return (
              <div key={message.id} id={`message-${message.id}`}>
                {showDivider && (
                  <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-gray-200" />
                    <span className="mx-4 text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full shadow-sm">
                      {dateLabel}
                    </span>
                    <div className="flex-grow border-t border-gray-200" />
                  </div>
                )}
                <div
                  className={cn(
                    "flex group",
                    (message.sender === 'agent' || message.metadata?.bot_generated) ? "justify-end" : "justify-start"
                  )}
                >
                  <div className="max-w-[50%] relative">
                    {/* Bloco de reply visual */}
                    {originalMessage && (
                      <div className="flex items-center mb-2 bg-gray-100 rounded-lg border-l-4 border-blue-400 pl-2 py-1 pr-2">
                        <div className="text-xs text-blue-700 mr-2">
                          {originalMessage.senderName || (originalMessage.sender === 'agent' ? 'Você' : 'Usuário')}
                        </div>
                        <div className="text-xs text-gray-700 truncate max-w-[120px]">
                          {originalMessage.content || '[Mídia]'}
                        </div>
                      </div>
                    )}
                    {/* Nome do remetente */}
                    {message.metadata?.bot_generated ? (
                      <div className="text-xs mb-1 text-right text-blue-500">
                        🤖 Bot
                      </div>
                    ) : (
                      <div className={cn(
                        "text-xs mb-1",
                        message.sender === 'agent' ? "text-right" : "text-left",
                        message.sender === 'agent' ? "text-[#7C45D0]" : "text-gray-600"
                      )}>
                        {message.sender === 'agent'
                          ? (message.metadata?.ai_generated
                            ? '🤖 Assistente IA'
                            : (message.senderName || profile?.name || 'Você')
                          )
                          : (message.senderName || chat?.name || 'Usuário')
                        }
                      </div>
                    )}

                    <div
                      className={cn(
                        "p-3 rounded-2xl relative shadow-sm group break-words",
                        message.metadata?.bot_generated
                          ? "bg-blue-50 text-gray-900 rounded-br-md border-l-4 border-blue-200"
                          : message.sender === 'agent'
                            ? message.metadata?.ai_generated
                              ? "bg-purple-100 text-gray-900 rounded-br-md border-l-4 border-purple-400"
                              : "bg-blue-100 text-gray-900 rounded-br-md"
                            : "bg-white text-gray-800 rounded-bl-md border",
                        message.isImportant && "ring-2 ring-yellow-400",
                        message.isInternal && "bg-blue-500 text-white "
                      )}
                      onMouseEnter={() => setHoveredMessageId(message.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                    >
                      {/* Botão de menu (chevron) no canto superior direito */}
                      <div className={cn(
                        "absolute top-1 right-1 z-20",
                        (hoveredMessageId === message.id || isMenuOpen === message.id) ? "flex" : "hidden"
                      )}>
                        <Popover onOpenChange={open => setIsMenuOpen(open ? message.id : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full p-1 h-7 w-7">
                              <span className="text-gray-600">⋯</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-0 border border-gray-200 rounded-xl shadow-xl" side="top" align="center">
                            <ul className="py-2">
                              <li>
                                {/* Botão de reagir que abre o seletor de emojis */}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="w-full flex items-center gap-2 text-blue-600"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <Smile size={18} /> Reagir
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-2 border-0 shadow-xl rounded-xl" side="right" align="start">
                                    <div className="flex gap-1">
                                      {availableReactions.map((reaction) => (
                                        <Button
                                          key={reaction.emoji}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 hover:bg-gray-100 text-lg"
                                          onClick={() => handleReaction(message.id, reaction.emoji)}
                                          title={reaction.label}
                                        >
                                          {reaction.emoji}
                                        </Button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </li>
                              <li>
                                <Button
                                  variant="ghost"
                                  className="w-full flex items-center gap-2 text-blue-600"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleReply(message);
                                  }}
                                >
                                  <Reply size={18} /> Responder
                                </Button>
                              </li>
                              <li>
                                <Button
                                  variant="ghost"
                                  className="w-full flex items-center gap-2 text-blue-600"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleForward(message.id);
                                  }}
                                >
                                  <Forward size={18} /> Encaminhar
                                </Button>
                              </li>
                              <li>
                                <Button
                                  variant="ghost"
                                  className="w-full flex items-center gap-2 text-blue-600"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleCopyMessage(message);
                                  }}
                                >
                                  <Copy size={18} /> Copiar
                                </Button>
                              </li>
                            </ul>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Indicador de IA */}
                      {message.metadata?.ai_generated && (
                        <div className="absolute -top-2 -left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                          IA
                        </div>
                      )}

                      {/* Exibir reações existentes */}
                      {message.reactions && Object.keys(message.reactions).length > 0 && (
                        <div className="absolute -bottom-8 right-0 bg-white border rounded-full shadow-sm px-2 py-1 flex items-center gap-1">
                          {Object.entries(message.reactions).map(([reaction, users]) => (
                            <div
                              key={reaction}
                              className={cn(
                                "flex items-center gap-1 px-1 py-0.5 rounded-full text-xs",
                                hasUserReacted(message, reaction)
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                              )}
                            >
                              <span>{reaction}</span>
                              {users.length > 1 && (
                                <span className="text-xs">{users.length}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {message.message_type === 'image' && (message.media_url || message.content) && (
                        <>
                          <img
                            src={(message.media_url || message.content).startsWith('http') ? (message.media_url || message.content) : `${apiBase}${message.media_url || message.content}`}
                            alt="imagem"
                            className="rounded-lg max-w-xs mb-2 cursor-pointer"
                            style={{ maxHeight: '400px', objectFit: 'contain' }}
                            onClick={() => {
                              setImagePreview((message.media_url || message.content).startsWith('http') ? (message.media_url || message.content) : `${apiBase}${message.media_url || message.content}`);
                              setShowImageModal(true);
                            }}
                            onError={(e) => {
                              console.error('Erro ao carregar imagem:', message.media_url || message.content);
                              e.currentTarget.style.display = 'none';
                            }}
                            loading="lazy"
                          />
                          {/* Legenda da imagem */}
                          {message.content && message.content !== '[Mídia não suportada]' && (
                            <div className="text-xs text-gray-600 mt-1 whitespace-pre-line">{message.content}</div>
                          )}
                        </>
                      )}
                      {message.message_type === 'video' && (message.media_url || message.content) && (
                        <>
                          <div className="flex flex-col items-center mb-2 w-full" style={{ minWidth: 300 }}>
                            <video
                              controls
                              className="rounded-lg max-w-xs mb-2"
                              src={(message.media_url || message.content).startsWith('http') ? (message.media_url || message.content) : `${apiBase}${message.media_url || message.content}`}
                            >
                              Seu navegador não suporta vídeo.
                            </video>
                            <div className="flex items-center gap-2 mt-1 w-full" style={{ minWidth: 200 }}>
                              <FileVideo className="w-5 h-5 text-red-500" />
                              <span className="text-xs text-gray-700">Vídeo</span>
                            </div>
                          </div>
                          {/* Legenda do vídeo */}
                          {message.content && (
                            <div className="text-xs text-gray-600 mt-1 whitespace-pre-line">{message.content}</div>
                          )}
                        </>
                      )}
                      {message.message_type === 'audio' && (message.media_url || message.content) && (
                        <>
                          <div className="flex flex-col items-center mb-2 w-full" style={{ minWidth: 300 }}>
                            {(() => {
                              const audioUrl = (message.media_url || message.content).startsWith('http') 
                                ? (message.media_url || message.content) 
                                : `${apiBase}${message.media_url || message.content}`;
                              return (
                                <audio 
                                  controls 
                                  src={audioUrl} 
                                  style={{ width: '100%', minHeight: 40 }}
                                  onError={(e) => {
                                    console.error('Erro ao carregar áudio:', audioUrl);
                                  }}
                                >
                                  Seu navegador não suporta áudio.
                                </audio>
                              );
                            })()}
                            <div className="flex items-center gap-2 mt-1 w-full" style={{ minWidth: 200 }}>
                              <FileAudio className="w-5 h-5 text-purple-500" />
                              <span className="text-xs text-gray-700">{message.metadata?.isVoiceMessage ? 'Mensagem de voz' : 'Áudio gravado'}</span>
                            </div>
                            {/* Botão para mostrar transcrição se disponível */}
                            {message.metadata?.transcription && (
                              <div className="mt-2 w-full">
                                <ShowTranscriptButton transcription={message.metadata.transcription} />
                              </div>
                            )}
                            {/* Indicador de transcrição em andamento */}
                            {message.metadata?.transcribing === true && (
                              <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Transcrevendo áudio...</span>
                              </div>
                            )}
                          </div>
                          {/* Legenda do áudio */}
                          {message.content && message.content !== '[Mídia não suportada]' && (
                            <div className="text-xs text-gray-600 mt-1 whitespace-pre-line">{message.content}</div>
                          )}
                        </>
                      )}
                      {message.message_type === 'sticker' && (message.media_url || message.content) && (
                        <div className="flex flex-col items-center mb-2">
                          <img
                            src={(message.media_url || message.content).startsWith('http') ? (message.media_url || message.content) : `${apiBase}${message.media_url || message.content}`}
                            alt="sticker"
                            className="max-w-32 max-h-32 mb-2"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-700">Sticker</span>
                          </div>
                        </div>
                      )}
                      {message.message_type === 'contact' && (
                        <div className="flex items-center gap-2 mb-2 p-3 bg-blue-50 rounded-lg">
                          <User className="w-5 h-5 text-blue-500" />
                          <div className="text-sm">
                            <div className="">Contato</div>
                            <div className="text-gray-600 whitespace-pre-line">{message.content}</div>
                          </div>
                        </div>
                      )}
                      {message.message_type === 'location' && (
                        <div className="flex items-center gap-2 mb-2 p-3 bg-green-50 rounded-lg">
                          <MapPin className="w-5 h-5 text-green-500" />
                          <div className="text-sm">
                            <div className="">Localização</div>
                            <div className="text-gray-600 whitespace-pre-line">{message.content}</div>
                          </div>
                        </div>
                      )}
                      {message.message_type === 'file' && (message.media_url || message.content) && (
                        (() => {
                          const url = (message.media_url || message.content).startsWith('http') ? (message.media_url || message.content) : `${apiBase}${message.media_url || message.content}`;
                          const filename = message.metadata?.filename || url.split('/').pop() || 'arquivo';
                          const ext = filename.split('.').pop()?.toLowerCase();
                          if (["mp3", "wav", "ogg"].includes(ext || '')) {
                            // Player de áudio
                            return (
                              <>
                                <div className="flex flex-col items-center mb-2 w-full" style={{ minWidth: 300 }}>
                                  <audio controls src={url} style={{ width: '100%', minHeight: 40 }}>
                                    Seu navegador não suporta áudio.
                                  </audio>
                                  <div className="flex items-center gap-2 mt-1 w-full" style={{ minWidth: 200 }}>
                                    <FileAudio className="w-5 h-5 text-purple-500" />
                                    <span className="truncate max-w-[140px] text-xs text-gray-700" title={filename}>
                                      {beautifyFilename(filename, message.metadata?.fileSize)}
                                    </span>
                                  </div>
                                </div>
                                {/* Legenda do arquivo de áudio */}
                                {message.content && (
                                  <div className="text-xs text-gray-600 mt-1 whitespace-pre-line">{message.content}</div>
                                )}
                              </>
                            );
                          }
                          // Outros arquivos
                          return (
                            <>
                              <div className="flex items-center gap-2 mb-2 w-full" style={{ minWidth: 200 }}>
                                {getFileIcon(filename)}
                                <span className="truncate max-w-[140px] text-xs text-gray-700" title={filename}>
                                  {beautifyFilename(filename, message.metadata?.fileSize)}
                                </span>
                                <a href={url} download title="Baixar" className="ml-2 text-gray-600 hover:text-blue-600">
                                  <Download className="w-5 h-5" />
                                </a>
                              </div>
                              {/* Legenda do arquivo */}
                              {message.content && (
                                <div className="text-xs text-gray-600 mt-1 whitespace-pre-line">{message.content}</div>
                              )}
                            </>
                          );
                        })()
                      )}
                      {/* Mostrar conteúdo para mensagens de texto e legendas de mídia */}
                      {message.message_type === 'text' && message.content && message.content !== '[Mídia não suportada]' && (
                        <p className="text-sm leading-relaxed break-all whitespace-pre-wrap overflow-wrap-anywhere">
                          {message.content}
                        </p>
                      )}

                      <div className="flex items-center justify-end mt-2 gap-2">
                        {message.sender === 'agent' && (
                          <>
                            {message.metadata?.ai_generated && message.metadata?.tokens_used && (
                              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                {message.metadata.tokens_used} tokens
                              </span>
                            )}
                            {/* Status da mensagem com indicadores visuais melhorados */}
                            <div className="flex items-center gap-1">
                              {message.status === 'sending' && (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                  <span className="text-xs text-blue-500">Enviando...</span>
                                </>
                              )}
                              {message.status === 'failed' && (
                                <>
                                  <span className="text-xs text-red-500">Falhou</span>
                                  {onResendMessage && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onResendMessage(message.id)}
                                      className="h-5 w-5 p-0 hover:bg-red-50 ml-1"
                                      title="Reenviar mensagem"
                                    >
                                      <RefreshCw className="w-3 h-3 text-red-500" />
                                    </Button>
                                  )}
                                </>
                              )}
                              {(message.status === 'sent' || message.status === 'delivered' || message.status === 'read') && (
                                <span className="text-xs text-gray-500">
                                  {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓' : '✓'}
                                </span>
                              )}
                            </div>
                            {/* Mostrar erro se houver */}
                            {message.status === 'failed' && message.metadata?.error && (
                              <span className="text-xs text-red-400 max-w-[100px] truncate" title={message.metadata.error}>
                                {message.metadata.error}
                              </span>
                            )}
                          </>
                        )}
                        <span className="text-xs text-gray-500">
                          {message.timestamp && message.timestamp instanceof Date
                            ? message.timestamp.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            : 'Agora'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border p-3 rounded-2xl rounded-bl-md shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies - Fixed */}
      {showQuickReplies && (
        <div className="flex-none px-4 py-3 bg-white border-t">
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewMessage(reply);
                  setShowQuickReplies(false);
                }}
                className="text-xs"
              >
                {reply}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input - Fixed */}
      <div className="flex-none bg-white border-t p-4">
        {/* Área de resposta */}
        {replyingTo && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Respondendo a {replyingTo.senderName || 'mensagem'}</div>
                <div className="text-sm text-gray-700 truncate">
                  {replyingTo.content || (replyingTo.metadata?.filename ? `📎 ${replyingTo.metadata.filename}` : 'Mensagem')}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
                className="h-6 w-6 p-0 hover:bg-gray-200"
              >
                <span className="text-gray-500">×</span>
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex items-end">
          <div className="flex-1 relative">
            <div className="flex items-center bg-gray-100 rounded-3xl border">
              {/* Ícones do lado esquerdo */}
              <div className="flex items-center pl-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-gray-600">
                      <Plus size={20} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-white border border-gray-200 shadow-lg" side="top" align="start">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-1 p-3 h-auto bg-transparent hover:bg-gray-100 text-gray-700"
                      >
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                          <FileText size={16} className="text-white" />
                        </div>
                        <span className="text-xs">Documento</span>
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex flex-col items-center gap-1 p-3 h-auto bg-transparent hover:bg-gray-100 text-gray-700"
                      >
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                          <Image size={16} className="text-white" />
                        </div>
                        <span className="text-xs">Fotos e vídeos</span>
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFavoriteMessages(!showFavoriteMessages)}
                        className="flex flex-col items-center gap-1 p-3 h-auto bg-transparent hover:bg-gray-100 text-gray-700"
                      >
                        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                          <Star size={16} className="text-white" />
                        </div>
                        <span className="text-xs">Favoritas</span>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFilePreview(file);
                      setShowFileModal(true);
                    }
                  }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.mp3,.wav,.mp4,.mov,.avi,.ppt,.pptx"
                />
                <input
                  type="file"
                  ref={imageInputRef}
                  style={{ display: 'none' }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                      setShowImageModal(true);
                    }
                  }}
                  accept="image/*"
                />
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  className={cn(
                    "rounded-full transition-colors",
                    showQuickReplies ? "bg-blue-500 text-white" : "text-gray-600"
                  )}
                >
                  <MessageCircle size={18} />
                </Button>
              </div>

              {/* Área de texto */}
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-transparent p-3 resize-none focus:outline-none max-h-20 min-h-[1.5rem]"
                rows={1}
              />

              {/* Ícones do lado direito */}
              <div className="flex items-center pr-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full hover:bg-gray-200 transition-colors"
                    >
                      <Smile size={16} className="text-gray-600" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 border-0 shadow-xl rounded-xl overflow-hidden"
                    side="top"
                    align="end"
                  >
                    <EmojiPicker
                      onEmojiClick={handleEmojiClick}
                      width={350}
                      height={400}
                    />
                  </PopoverContent>
                </Popover>

                {/* Botão de áudio/enviar */}
                {isRecording ? (
                  <div className="flex items-center space-x-2 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelRecording}
                      className="rounded-full bg-red-500 hover:bg-red-600 text-white"
                    >
                      <RotateCcw size={16} />
                    </Button>
                    <div className="flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm">
                      <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                      {formatRecordingTime(recordingTime)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={stopRecording}
                      className="rounded-full bg-green-500 hover:bg-green-600 text-white"
                    >
                      <Square size={16} />
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Mostrar ícone de áudio quando não há texto */}
                    {!newMessage.trim() && !imagePreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={startRecording}
                        className="rounded-full hover:bg-gray-200 transition-colors ml-2"
                      >
                        <Mic size={20} className="text-gray-600" />
                      </Button>
                    )}
                    
                    {/* Mostrar botão de enviar quando há texto ou preview de imagem */}
                    {(newMessage.trim() || imagePreview) && (
                      <>
                        {/* Botão de enviar imagem se houver preview */}
                        {imagePreview && imageFile ? (
                          <Button
                            onClick={() => handleFileUpload(imageFile, 'image', imageCaption)}
                            className="rounded-full bg-[#7C45D0] hover:bg-[#6B3DB8] text-white shadow-lg ml-2 w-10 h-10 p-0"
                            size="sm"
                          >
                            <Send size={18} />
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            className="rounded-full bg-[#7C45D0] hover:bg-[#6B3DB8] text-white shadow-lg transition-colors ml-2 w-10 h-10 p-0"
                            size="sm"
                          >
                            <Send size={18} />
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Favorite Messages Panel */}
      {showFavoriteMessages && (
        <div className="absolute right-4 bottom-20 z-50">
          <FavoriteMessagesPanel
            onSelectMessage={handleSelectFavoriteMessage}
            onClose={() => setShowFavoriteMessages(false)}
          />
        </div>
      )}

      {/* Modal de preview de imagem */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pré-visualização da Imagem</DialogTitle>
            <DialogDescription>Confira a imagem antes de enviar para o cliente.</DialogDescription>
          </DialogHeader>
          {imagePreview && (
            <div className="flex justify-center py-2">
              <img src={imagePreview} alt="Pré-visualização" className="rounded-lg max-w-xs max-h-60 border shadow" />
            </div>
          )}
          {/* Campo de legenda */}
          <div className="mb-2">
            <input
              type="text"
              value={imageCaption}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageCaption(e.target.value)}
              placeholder="Adicionar legenda (opcional)"
              className="w-full border rounded px-2 py-1 text-sm"
              maxLength={200}
            />
          </div>
          {imageUploadError && (
            <div className="text-red-500 text-sm text-center mb-2">{imageUploadError}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImageModal(false); setImagePreview(null); setImageFile(null); setImageUploadError(null); setImageCaption(''); }} disabled={imageUploadLoading}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (imageFile) {
                  const ok = await handleFileUpload(imageFile, 'image', imageCaption);
                  if (ok) {
                    setShowImageModal(false);
                    setImageUploadError(null);
                    setImageCaption('');
                  }
                }
              }}
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={imageUploadLoading}
            >
              {imageUploadLoading ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de preview de arquivo */}
      <Dialog open={showFileModal} onOpenChange={setShowFileModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pré-visualização do Arquivo</DialogTitle>
            <DialogDescription>Confira o arquivo antes de enviar para o cliente.</DialogDescription>
          </DialogHeader>
          {filePreview && (
            <div className="flex flex-col items-center py-2">
              <div className="mb-2 text-center">
                <FileText className="w-10 h-10 mx-auto text-blue-500 mb-2" />
                <div className="">{filePreview.name}</div>
                <div className="text-xs text-gray-500">{filePreview.type || 'Tipo desconhecido'}</div>
                <div className="text-xs text-gray-500">{(filePreview.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
          )}
          {/* Campo de legenda */}
          <div className="mb-2">
            <input
              type="text"
              value={fileCaption}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFileCaption(e.target.value)}
              placeholder="Adicionar legenda (opcional)"
              className="w-full border rounded px-2 py-1 text-sm"
              maxLength={200}
            />
          </div>
          {fileUploadError && (
            <div className="text-red-500 text-sm text-center mb-2">{fileUploadError}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFileModal(false); setFilePreview(null); setFileUploadError(null); setFileCaption(''); }} disabled={fileUploadLoading}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (filePreview) {
                  setFileUploadLoading(true);
                  setFileUploadError(null);
                  try {
                    const ok = await handleFileUpload(filePreview, 'file', fileCaption);
                    setFileUploadLoading(false);
                    if (ok) {
                      setShowFileModal(false);
                      setFilePreview(null);
                      setFileUploadError(null);
                      setFileCaption('');
                    } else {
                      setFileUploadError('Erro ao enviar arquivo.');
                    }
                  } catch (err) {
                    setFileUploadLoading(false);
                    setFileUploadError('Erro ao enviar arquivo.');
                  }
                }
              }}
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={fileUploadLoading}
            >
              {fileUploadLoading ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de preview de áudio */}
      <Dialog open={showAudioModal} onOpenChange={setShowAudioModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pré-visualização do Áudio</DialogTitle>
            <DialogDescription>Ouça o áudio gravado antes de enviar para o cliente.</DialogDescription>
          </DialogHeader>
          {audioUrl && (
            <div className="flex flex-col items-center py-4">
              <div className="mb-4 text-center">
                <FileAudio className="w-16 h-16 mx-auto text-blue-500 mb-3" />
                <div className="text-lg">Áudio Gravado</div>
                <div className="text-sm text-gray-500">Duração: {formatRecordingTime(recordingTime)}</div>
              </div>
              <audio
                controls
                className="w-full max-w-md"
                src={audioUrl}
              >
                Seu navegador não suporta o elemento de áudio.
              </audio>
            </div>
          )}
          {/* Campo de legenda */}
          <div className="mb-2">
            <input
              type="text"
              value={audioCaption}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAudioCaption(e.target.value)}
              placeholder="Adicionar legenda (opcional)"
              className="w-full border rounded px-2 py-1 text-sm"
              maxLength={200}
            />
          </div>
          {audioUploadError && (
            <div className="text-red-500 text-sm text-center mb-2">{audioUploadError}</div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAudioModal(false);
                setAudioBlob(null);
                setAudioUrl(null);
                setAudioUploadError(null);
                setAudioCaption('');
                if (audioUrl) {
                  URL.revokeObjectURL(audioUrl);
                }
              }}
              disabled={audioUploadLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (audioBlob) {
                  setAudioUploadLoading(true);
                  setAudioUploadError(null);
                  try {
                    const ok = await handleFileUpload(audioBlob, 'audio', audioCaption);
                    setAudioUploadLoading(false);
                    if (ok) {
                      setShowAudioModal(false);
                      setAudioBlob(null);
                      setAudioUrl(null);
                      setAudioUploadError(null);
                      setAudioCaption('');
                      if (audioUrl) {
                        URL.revokeObjectURL(audioUrl);
                      }
                    } else {
                      setAudioUploadError('Erro ao enviar áudio.');
                    }
                  } catch (err) {
                    setAudioUploadLoading(false);
                    setAudioUploadError('Erro ao enviar áudio.');
                  }
                }
              }}
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={audioUploadLoading}
            >
              {audioUploadLoading ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Sidebar */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50">
          <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg text-gray-900">Pesquisar mensagens</h2>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-white">
              <div className="relative mb-4">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Search className="text-gray-400" size={20} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar mensagens..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 bg-white transition-all duration-200"
                  autoFocus
                />
              </div>

              {/* Search Suggestion */}
              <div className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-3">
                Pesquisar mensagens com {chat?.name || 'Usuário'} {chat?.phone_number}
              </div>

              {/* Search Results */}
              {searchQuery.trim() && (
                <div className="space-y-3">
                  <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">
                    {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {searchResults.map((message) => (
                      <div 
                        key={message.id} 
                        className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-all duration-200 bg-white"
                        onClick={() => {
                          // Scroll to message in chat
                          const messageElement = document.getElementById(`message-${message.id}`);
                          if (messageElement) {
                            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            messageElement.classList.add('bg-purple-100');
                            setTimeout(() => {
                              messageElement.classList.remove('bg-purple-100');
                            }, 2000);
                          }
                          setShowSearchModal(false);
                        }}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs text-gray-500">
                            {message.sender === 'agent' ? 'Agente' : 'Cliente'}
                            {message.senderName && ` - ${message.senderName}`}
                          </span>
                          <span className="text-xs text-gray-400">
                            {format(message.timestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-700">
                          {message.content ? (
                            highlightSearchTerm(message.content, searchQuery)
                          ) : message.metadata?.transcription ? (
                            <div>
                              <span className="text-xs text-gray-500">🎤 Transcrição: </span>
                              {highlightSearchTerm(message.metadata.transcription, searchQuery)}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Mensagem sem texto</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {searchResults.length === 0 && searchQuery.trim() && (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                      <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhuma mensagem encontrada</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ShowTranscriptButton({ transcription }: { transcription: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="w-full mt-2">
      {!show ? (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 text-xs"
          onClick={() => setShow(true)}
        >
          <Eye className="w-4 h-4" /> Mostrar Transcrição
        </Button>
      ) : (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg w-full">
          <div className="text-xs text-gray-500 mb-1">📝 Transcrição:</div>
          <div className="text-sm text-gray-700">{transcription}</div>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
