import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAIAssistants } from '@/hooks/ai/useAIAssistants';
import { useAICredits } from '@/hooks/useAICredits';
import { useAuth } from '@/hooks/useAuth';
import { Play, Bot, Loader2, Zap, MessageCircle, Settings, Trash2, Download, Upload, Edit, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAIBackend } from '@/hooks/ai/useAIBackend';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface PlaygroundMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  cost?: number;
}

interface AIPlaygroundProps {
  setActiveTab?: (tab: string) => void;
}

const AIPlayground: React.FC<AIPlaygroundProps> = ({ setActiveTab }) => {
  const { user, profile } = useAuth();
  const { assistants, isLoading: assistantsLoading } = useAIAssistants();
  const { credits, refetch: refetchCredits } = useAICredits();
  const [useLocalBackend, setUseLocalBackend] = useState(true);
  const { processMessage, isLoading: isProcessing, error: aiError } = useAIBackend(useLocalBackend);
  const [selectedAssistant, setSelectedAssistant] = useState<string>('');
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionName, setSessionName] = useState('Nova Sessão');
  const [systemPrompt, setSystemPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Verificar se o usuário é super admin
  const isSuperAdmin = profile?.user_role === 'super_admin';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Selecionar o primeiro assistente automaticamente se não houver nenhum selecionado
  useEffect(() => {
    if (assistants && assistants.length > 0 && !selectedAssistant) {
      setSelectedAssistant(assistants[0].id);
    }
  }, [assistants, selectedAssistant]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    if (!selectedAssistant) {
      toast.error('❌ Selecione um assistente para começar!');
      return;
    }

    if (!credits || credits.credits_remaining < 50) {
      toast.error('❌ Créditos insuficientes! Compre mais créditos para continuar.');
      return;
    }
    
    const userMessage: PlaygroundMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      // Preparar contexto da conversa
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Adicionar system prompt se definido
      if (systemPrompt && conversationHistory.length === 0) {
        conversationHistory.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      // Buscar assistente selecionado via API do backend
      const assistant = assistants?.find(a => a.id === selectedAssistant);
      
      if (!assistant) {
        throw new Error('Assistente não encontrado');
      }

      console.log('Enviando para playground:', {
        message: inputMessage,
        assistant: assistant.name,
        settings: { temperature: assistant.temperature || 0.7, maxTokens: assistant.max_tokens || 2000 }
      });

      const data = await processMessage({
        message: inputMessage,
        conversation_history: conversationHistory,
        assistant: assistant,
        settings: {
          temperature: assistant.temperature || 0.7,
          max_tokens: assistant.max_tokens || 2000,
          model: assistant.model || 'gpt-4o-mini'
        }
      });

      console.log('Resposta recebida:', data);

      const aiMessage: PlaygroundMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Resposta não recebida',
        timestamp: new Date(),
        tokens: data.tokens_used || 0,
        cost: data.credits_used || 0
      };

      setMessages(prev => [...prev, aiMessage]);

      // Atualizar créditos
      refetchCredits();

      // Mostrar informações de uso
      toast.success(`✅ Resposta gerada! Tokens: ${data.tokens_used || 0} • Créditos: ${data.credits_used || 0}`);

    } catch (error: any) {
      console.error('Erro no playground:', error);
      toast.error(`❌ Erro: ${error.message || 'Erro desconhecido'}`);
      
      const errorMessage: PlaygroundMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erro: ${error.message || 'Erro desconhecido'}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const clearSession = () => {
    setMessages([]);
    setSessionName('Nova Sessão');
    setSystemPrompt('');
    toast.success('🧹 Sessão limpa!');
  };

  const exportSession = () => {
    const sessionData = {
      name: sessionName,
      messages,
      settings: {
        systemPrompt,
        assistant: selectedAssistant
      },
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playground-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('📥 Sessão exportada!');
  };

  const importSession = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sessionData = JSON.parse(e.target?.result as string);
        setSessionName(sessionData.name || 'Sessão Importada');
        setMessages(sessionData.messages || []);
        setSystemPrompt(sessionData.settings?.systemPrompt || '');
        setSelectedAssistant(sessionData.settings?.assistant || '');
        
        toast.success('📤 Sessão importada com sucesso!');
      } catch (error) {
        console.error('Erro ao importar:', error);
        toast.error('❌ Erro ao importar sessão');
      }
    };
    reader.readAsText(file);
  };

  const handleBackendToggle = (checked: boolean) => {
    setUseLocalBackend(checked);
  };

  const handleEditAssistant = () => {
    // Navegar para a aba de assistentes usando o sistema de tabs
    if (setActiveTab) {
      setActiveTab('ai-assistants');
    } else {
      // Fallback para redirecionamento se setActiveTab não estiver disponível
      window.location.href = '/#ai-assistants';
    }
  };

  if (assistantsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
          <p className="text-lg">Carregando playground...</p>
        </div>
      </div>
    );
  }

  // Verificar se há assistentes disponíveis
  if (!assistants || assistants.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl text-gray-900 mb-2">Nenhum Assistente Criado</h2>
            <p className="text-gray-600 mb-6">
              Para testar a IA, você precisa criar pelo menos um assistente primeiro.
            </p>
            <Button 
              onClick={handleEditAssistant}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Assistente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentAssistant = assistants.find(a => a.id === selectedAssistant);

  return (
          <PermissionGuard requiredPermissions={['access_ai_playground']}>
      <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl">AI Playground</h1>
          {/* Mostrar switch apenas para super admins */}
          {isSuperAdmin && (
            <div className="flex items-center space-x-2">
              <Switch
                id="backend-toggle"
                checked={useLocalBackend}
                onCheckedChange={handleBackendToggle}
              />
              <Label htmlFor="backend-toggle">
                {useLocalBackend ? 'Usando Backend Local' : 'Usando Supabase'}
              </Label>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              🤖 AI Playground
            </h1>
            <p className="text-muted-foreground mt-2 text-base md:text-lg">
              Teste seus assistentes de IA em tempo real
            </p>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-3">
              <Badge variant="outline" className="text-green-600 border-green-300 text-xs md:text-sm">
                💰 {credits?.credits_remaining?.toLocaleString() || 0} créditos disponíveis
              </Badge>
              <Badge variant="outline" className="text-xs md:text-sm">
                🧠 {messages.length} mensagens na sessão
              </Badge>
              {isSuperAdmin && (
                <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs md:text-sm">
                  🔑 Super Admin
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full sm:w-48"
              placeholder="Nome da sessão"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearSession}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportSession}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="relative">
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept=".json"
                  onChange={importSession}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Configuration Panel - Simplificado */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configurações
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleEditAssistant}
                  className="text-xs"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lista de Assistentes */}
              <div>
                <label className="text-sm mb-3 block">Seus Assistentes</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {assistants?.map((assistant) => (
                    <div
                      key={assistant.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedAssistant === assistant.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedAssistant(assistant.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">{assistant.name}</span>
                            {assistant.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          {assistant.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {assistant.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {assistant.model}
                            </Badge>
                            {assistant.personality && (
                              <Badge variant="outline" className="text-xs">
                                {assistant.personality}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-sm mb-2 block">Prompt do Sistema (Opcional)</label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Instruções adicionais para a IA..."
                  rows={3}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Define comportamento adicional para esta sessão
                </p>
              </div>

              {/* Informações do Assistente Selecionado */}
              {currentAssistant && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm mb-2">Assistente Atual</h4>
                  <div className="space-y-1 text-xs">
                    <p><strong>Nome:</strong> {currentAssistant.name}</p>
                    <p><strong>Modelo:</strong> {currentAssistant.model}</p>
                    {currentAssistant.personality && (
                      <p><strong>Personalidade:</strong> {currentAssistant.personality}</p>
                    )}
                    {currentAssistant.instructions && (
                      <p><strong>Instruções:</strong> {currentAssistant.instructions.substring(0, 100)}...</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Interface */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="w-5 h-5" />
                Conversa
                {currentAssistant && (
                  <Badge variant="secondary" className="text-xs">
                    {currentAssistant.name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Messages */}
              <div className="h-80 md:h-96 overflow-y-auto p-4 border rounded-lg bg-background space-y-4 mb-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm md:text-base">Comece uma conversa com seu assistente!</p>
                    <p className="text-xs md:text-sm">Digite sua mensagem abaixo para começar.</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.role === 'system'
                            ? 'bg-gray-100 text-gray-800 border-l-4 border-gray-400'
                            : 'bg-white border shadow-sm'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {message.role === 'user' && <span className="text-xs opacity-75">Você</span>}
                          {message.role === 'assistant' && (
                            <div className="flex items-center gap-2">
                              <Bot className="w-3 h-3 md:w-4 md:h-4" />
                              <span className="text-xs text-muted-foreground">IA</span>
                            </div>
                          )}
                          {message.role === 'system' && <span className="text-xs opacity-75">Sistema</span>}
                          <span className="text-xs opacity-75">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          {message.tokens && message.tokens > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Zap className="w-2 h-2 mr-1" />
                              {message.tokens} tokens
                            </Badge>
                          )}
                        </div>
                        
                        <div className="whitespace-pre-wrap text-xs md:text-sm">{message.content}</div>
                        
                        {message.cost && message.cost > 0 && (
                          <div className="text-xs opacity-75 mt-2 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Custo: {message.cost} créditos
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-4 rounded-lg bg-white border shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">IA está pensando...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={currentAssistant ? `Digite sua mensagem para ${currentAssistant.name}...` : "Selecione um assistente primeiro..."}
                  disabled={isProcessing || !selectedAssistant}
                  className="flex-1 text-sm"
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!inputMessage.trim() || isProcessing || !selectedAssistant || !credits || credits.credits_remaining < 50}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
                  size="sm"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                Pressione Enter para enviar, Shift+Enter para nova linha • Custo mínimo: 50 créditos
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default AIPlayground;
