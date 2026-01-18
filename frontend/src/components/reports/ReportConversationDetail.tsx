import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Phone, 
  Clock, 
  MessageCircle, 
  FileText, 
  Download, 
  Send,
  FileAudio,
  FileVideo,
  File,
  Image,
  MapPin,
  Eye,
  FileArchive
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders
import type { ConversationDetail } from '@/types/reports';

interface ReportConversationDetailProps {
  open: boolean;
  onClose: () => void;
  detail: ConversationDetail | null;
  onExport: (format: 'pdf' | 'excel') => void;
  onAnalyzeAI: () => void;
  loading?: boolean;
}

interface AIAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  onAnalyze: (context: string) => void;
  loading?: boolean;
}

const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  open,
  onClose,
  onAnalyze,
  loading = false
}) => {
  const [selectedContext, setSelectedContext] = useState('');

  const analysisOptions = [
    {
      id: 'summary',
      title: 'Resumo da Conversa',
      description: 'Gerar um resumo completo da conversa com principais pontos',
      color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      id: 'sentiment',
      title: 'Análise de Sentimento',
      description: 'Analisar o sentimento do cliente durante a conversa',
      color: 'bg-green-50 border-green-200 text-green-700'
    },
    {
      id: 'satisfaction',
      title: 'Nível de Satisfação',
      description: 'Avaliar o nível de satisfação do cliente',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-700'
    },
    {
      id: 'resolution',
      title: 'Resolução do Problema',
      description: 'Verificar se o problema foi resolvido adequadamente',
      color: 'bg-purple-50 border-purple-200 text-purple-700'
    },
    {
      id: 'keywords',
      title: 'Palavras-chave',
      description: 'Extrair palavras-chave e temas principais',
      color: 'bg-orange-50 border-orange-200 text-orange-700'
    },
    {
      id: 'improvement',
      title: 'Sugestões de Melhoria',
      description: 'Identificar oportunidades de melhoria no atendimento',
      color: 'bg-pink-50 border-pink-200 text-pink-700'
    }
  ];

  const handleAnalyze = () => {
    if (selectedContext) {
      onAnalyze(selectedContext);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-purple-600" />
              Análise com IA
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione o tipo de análise que deseja realizar nesta conversa:
          </p>
          
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {analysisOptions.map(option => (
              <div
                key={option.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 p-3 rounded-lg border",
                  selectedContext === option.id
                    ? `${option.color} border-2 shadow-md`
                    : 'hover:bg-gray-50 border-gray-200'
                )}
                onClick={() => setSelectedContext(option.id)}
              >
                <div className="text-sm">{option.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleAnalyze} 
              disabled={!selectedContext || loading}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? 'Analisando...' : 'Analisar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Função utilitária para identificar o ícone do arquivo
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return <File className="w-5 h-5 text-blue-500" />;

  // Documentos
  if (["pdf"].includes(ext)) return <FileText className="w-5 h-5 text-red-500" />;
  if (["doc", "docx"].includes(ext)) return <FileText className="w-5 h-5 text-blue-600" />;
  if (["xls", "xlsx"].includes(ext)) return <FileText className="w-5 h-5 text-green-600" />;
  if (["ppt", "pptx"].includes(ext)) return <FileText className="w-5 h-5 text-orange-600" />;
  if (["txt"].includes(ext)) return <FileText className="w-5 h-5 text-gray-600" />;

  // Arquivos compactados
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return <FileArchive className="w-5 h-5 text-yellow-600" />;

  // Áudio
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) return <FileAudio className="w-5 h-5 text-purple-500" />;

  // Vídeo
  if (["mp4", "mov", "avi", "mkv", "wmv", "flv", "3gp"].includes(ext)) return <FileVideo className="w-5 h-5 text-red-500" />;

  // Imagens
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext)) return <Image className="w-5 h-5 text-green-500" />;

  // Outros
  return <FileText className="w-5 h-5 text-blue-500" />;
};

// Função para deixar o nome do arquivo mais amigável
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
  try {
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }
    
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
  } catch (error) {
    console.error('Erro ao formatar data:', date, error);
    return 'Data inválida';
  }
}

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

export const ReportConversationDetail: React.FC<ReportConversationDetailProps> = ({
  open,
  onClose,
  detail,
  onExport,
  onAnalyzeAI,
  loading = false
}) => {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();

  // Se o modal está aberto mas não temos detalhes, mostrar loading
  if (open && !detail) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Conversa</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando detalhes da conversa...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Se não está aberto ou não temos detalhes, não renderizar nada
  if (!open || !detail) return null;

  const { conversation, messages, timeline } = detail;

  console.log('🔍 [Modal] Dados recebidos:', { conversation, messages: messages?.length, timeline: timeline?.length });
  console.log('🔍 [Modal] Mensagens:', messages);
  
  // Debug: verificar campos das mensagens
  if (messages && messages.length > 0) {
    console.log('🔍 [Modal] Primeira mensagem completa:', messages[0]);
    console.log('🔍 [Modal] Campos disponíveis na primeira mensagem:', Object.keys(messages[0]));
    console.log('🔍 [Modal] is_from_me da primeira mensagem:', (messages[0] as any).is_from_me);
    console.log('🔍 [Modal] sender da primeira mensagem:', (messages[0] as any).sender);
    console.log('🔍 [Modal] senderName da primeira mensagem:', (messages[0] as any).senderName);
    console.log('🔍 [Modal] agentName da conversa:', conversation.agentName);
    console.log('🔍 [Modal] Comparação senderName === agentName:', (messages[0] as any).senderName === conversation.agentName);
    console.log('🔍 [Modal] Tipo senderName:', typeof (messages[0] as any).senderName);
    console.log('🔍 [Modal] Tipo agentName:', typeof conversation.agentName);
    
    // Log de todos os senderName
    console.log('🔍 [Modal] Todos os senderName das mensagens:', messages.map((msg: any) => msg.senderName));
    console.log('🔍 [Modal] Contagem por senderName:', messages.reduce((acc: any, msg: any) => {
      acc[msg.senderName] = (acc[msg.senderName] || 0) + 1;
      return acc;
    }, {}));
  }

  const handleAIAnalyze = (context: string) => {
    console.log('Analisando com contexto:', context);
    onAnalyzeAI();
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) return;
    
    setSendingEmail(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/reports/send-conversation-email`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: detail.conversation.id,
          email: emailAddress.trim()
        })
      });

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Histórico enviado por email com sucesso!',
        });
        setEmailModalOpen(false);
        setEmailAddress('');
      } else {
        throw new Error('Erro ao enviar email');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao enviar email. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Função para obter ícone do canal
  const getChannelIcon = (channel: string) => {
    switch (channel?.toLowerCase()) {
      case 'whatsapp':
        return '💬';
      case 'instagram':
        return '📷';
      case 'telegram':
        return '✈️';
      default:
        return '💬';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-white flex flex-col">
          {/* Header Navbar Horizontal */}
          <div className="flex-shrink-0 bg-white border-b shadow-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-sm text-gray-600">Cliente:</span>
                  <span className="ml-2 text-gray-800">{conversation.customerName}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Operador:</span>
                  <span className="ml-2 text-gray-800">{conversation.agentName || 'Não atribuído'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Data:</span>
                  <span className="ml-2 text-gray-800">
                    {(() => {
                      try {
                        const date = conversation.startTime instanceof Date ? conversation.startTime : new Date(conversation.startTime);
                        if (isNaN(date.getTime())) {
                          return 'Data inválida';
                        }
                        return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
                      } catch (error) {
                        console.error('Erro ao formatar data da conversa:', conversation.startTime, error);
                        return 'Data inválida';
                      }
                    })()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEmailModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Enviar por Email
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-gray-100">
                  <span className="text-lg">×</span>
                </Button>
              </div>
            </div>
          </div>
          {/* Área de Conversa */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 p-6 min-h-0">
              <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
                <div className="flex-shrink-0 p-4 rounded-t-lg border-b">
                  <h3 className="flex items-center gap-2 text-gray-800">
                    Conversa ({messages?.length || 0} mensagens)
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  {!messages || messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <MessageCircle className="h-12 w-12 mb-4" />
                      <p className="text-lg">Nenhuma mensagem encontrada</p>
                      <p className="text-sm">Esta conversa não possui mensagens registradas.</p>
                    </div>
                  ) : (
                    (() => {
                      let lastDate: string | null = null;
                      return messages.map((message, idx) => {
                        const msgDate = (() => {
                          try {
                            return message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
                          } catch (error) {
                            console.error('Erro ao converter timestamp:', message.timestamp, error);
                            return new Date(); // fallback para data atual
                          }
                        })();
                        const dateLabel = getDateLabel(msgDate);
                        const showDivider = dateLabel !== lastDate;
                        lastDate = dateLabel;
                        return (
                          <div key={message.id}>
                            {showDivider && (
                              <div className="flex items-center my-4">
                                <div className="flex-grow border-t border-gray-200" />
                                <span className="mx-4 text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full shadow-sm">
                                  {dateLabel}
                                </span>
                                <div className="flex-grow border-t border-gray-200" />
                              </div>
                            )}
                            <div className={cn(
                              "flex mb-4",
                              // Se senderName for igual ao agentName, é agente (direita)
                              (message as any).senderName === conversation.agentName ? "justify-end" : "justify-start"
                            )}>
                              <div className={cn(
                                "max-w-[70%] min-w-[200px]",
                                (message as any).senderName === conversation.agentName ? "ml-auto" : "mr-auto"
                              )}>
                                <div className={cn(
                                  "text-xs mb-2 px-2",
                                  (message as any).senderName === conversation.agentName ? "text-right text-green-700" : "text-left text-blue-700"
                                )}>
                                  {(message as any).senderName || 'Remetente'}
                                </div>
                                <div className={cn(
                                  "p-4 rounded-2xl shadow-sm border",
                                  (message as any).senderName === conversation.agentName
                                    ? "bg-green-50 border-green-200 text-gray-800"
                                    : "bg-blue-50 border-blue-200 text-gray-800"
                                )}>
                                  <div className="text-sm leading-relaxed">{message.content}</div>
                                  <div className={cn(
                                    "text-xs text-gray-500 mt-2",
                                    (message as any).senderName === conversation.agentName ? "text-right" : "text-left"
                                  )}>
                                    {(() => {
                                      try {
                                        if (isNaN(msgDate.getTime())) {
                                          return '--:--';
                                        }
                                        return format(msgDate, 'HH:mm');
                                      } catch (error) {
                                        console.error('Erro ao formatar hora da mensagem:', msgDate, error);
                                        return '--:--';
                                      }
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Análise IA */}
      <AIAnalysisModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onAnalyze={handleAIAnalyze}
        loading={loading}
      />

      {/* Modal de Envio por Email */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Histórico por Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email de Destino</Label>
              <Input
                id="email"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="Digite o email para enviar o histórico"
                className="mt-1"
              />
            </div>
            <div className="text-sm text-gray-600">       O histórico completo da conversa será enviado para o email informado.
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setEmailModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleSendEmail} 
                disabled={!emailAddress.trim() || sendingEmail}
                className="flex-1"
              >
                {sendingEmail ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}; 