import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Plus, 
  Send, 
  Clock, 
  Users, 
  Image, 
  Video, 
  FileText, 
  Mic,
  X,
  CheckCircle,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCampanhas } from '@/hooks/useCampanhas';
import { useTemplates } from '@/hooks/useTemplates';
import { SelecaoContatos } from './SelecaoContatos';
import type { ContatoComHistorico } from '@/hooks/useCampanhasContatos';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface BulkMessageDialogProps {
  onMessageSent?: () => void;
}

interface SelectedContact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
}

interface MediaFile {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  preview?: string;
}

export function BulkMessageDialog({ onMessageSent }: BulkMessageDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'select' | 'compose' | 'preview'>('select');

  // Estados do formulário
  const [message, setMessage] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { criarCampanha, iniciarCampanha } = useCampanhas();
  const { templatesAprovados, isLoading: isLoadingTemplates } = useTemplates();
  const { user } = useAuth();

  const handleContactsSelected = (contatos: ContatoComHistorico[]) => {
    const contacts: SelectedContact[] = contatos.map(c => ({
      id: c.contato_phone,
      name: c.contato_name || 'Cliente',
      phone: c.contato_phone
    }));
    setSelectedContacts(contacts);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId) {
      const template = templatesAprovados?.find(t => t.id === templateId);
      if (template) {
        setMessage(template.conteudo);
        // Adicionar arquivos de mídia do template
        if (template.media_files && template.media_files.length > 0) {
          const templateMediaFiles: MediaFile[] = template.media_files.map(file => ({
            id: file.id,
            file: new File([], file.name, { type: file.type }),
            type: file.type as 'image' | 'video' | 'audio' | 'document',
            preview: file.url
          }));
          setMediaFiles(templateMediaFiles);
        }
      }
    } else {
      setMessage('');
      setMediaFiles([]);
    }
  };

  const handleNumbersSelected = (numeros: string[]) => {
    setSelectedNumbers(numeros);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const mediaFile: MediaFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        type: getFileType(file.type)
      };

      // Criar preview para imagens
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          mediaFile.preview = e.target?.result as string;
          setMediaFiles(prev => [...prev, mediaFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setMediaFiles(prev => [...prev, mediaFile]);
      }
    });
  };

  const getFileType = (mimeType: string): 'image' | 'video' | 'audio' | 'document' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const removeMediaFile = (id: string) => {
    setMediaFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSendNow = async () => {
    if (!message.trim() || selectedContacts.length === 0) {
      setError('Preencha a mensagem e selecione pelo menos um contato');
      return;
    }

    if (selectedNumbers.length === 0) {
      setError('Selecione pelo menos um número WhatsApp conectado para envio');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Upload dos arquivos de mídia primeiro
      const uploadedFiles = [];
      for (const mediaFile of mediaFiles) {
        const formData = new FormData();
        formData.append('file', mediaFile.file);
        
        // ✅ CORRIGIDO: Usar apiBase e getAuthHeaders como o resto do código
        const headers = await getAuthHeaders();
        // Remover Content-Type para deixar o browser definir automaticamente (necessário para FormData)
        delete headers['Content-Type'];
        
        const uploadResponse = await fetch(`${apiBase}/api/campanhas/upload`, {
          method: 'POST',
          headers: headers,
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error(`Erro ao fazer upload do arquivo ${mediaFile.file.name}`);
        }

        const uploadResult = await uploadResponse.json();
        if (uploadResult.success) {
          uploadedFiles.push({
            id: uploadResult.data.id,
            name: uploadResult.data.name,
            type: mediaFile.type,
            size: uploadResult.data.size,
            url: uploadResult.data.url,
            path: uploadResult.data.path
          });
        }
      }

      // Criar campanha simples com ou sem template
      const campanhaData = {
        nome: `Campanha em Massa - ${new Date().toLocaleString()}`,
        template_id: selectedTemplate || null,
        contatos: selectedContacts.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone
        })),
        usuarios_remetentes: selectedNumbers,
        usar_ia: false,
        data_inicio: new Date().toISOString(),
        configuracoes: {
          rate_limit_per_minute: 30,
          interval_between_messages: 2000,
          max_messages_per_user: 1,
          numeros_whatsapp: selectedNumbers,
          media_files: uploadedFiles
        },
        message_content: message, // Conteúdo da mensagem
        media_files: uploadedFiles
      };

      const resultado = await criarCampanha(campanhaData);
      
      // Iniciar a campanha automaticamente
      if (resultado?.data?.id) {
        try {
          await iniciarCampanha(resultado.data.id);
          console.log('✅ Campanha iniciada automaticamente');
        } catch (error) {
          console.error('❌ Erro ao iniciar campanha:', error);
        }
      }
      
      // Limpar formulário
      setMessage('');
      setSelectedContacts([]);
      setSelectedNumbers([]);
      setMediaFiles([]);
      setScheduleDate('');
      setCurrentStep('select');
      
      setOpen(false);
      onMessageSent?.();
      
    } catch (err) {
      console.error('Erro ao enviar mensagem em massa:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) {
      setError('Selecione uma data e hora para agendar');
      return;
    }

    // Verificar se a data é no futuro
    const scheduledDateTime = new Date(scheduleDate);
    const now = new Date();
    
    if (scheduledDateTime <= now) {
      setError('A data e hora devem ser no futuro');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Upload dos arquivos de mídia primeiro
      const uploadedFiles = [];
      for (const mediaFile of mediaFiles) {
        const formData = new FormData();
        formData.append('file', mediaFile.file);
        
        // ✅ CORRIGIDO: Usar apiBase e getAuthHeaders como o resto do código
        const headers = await getAuthHeaders();
        // Remover Content-Type para deixar o browser definir automaticamente (necessário para FormData)
        delete headers['Content-Type'];
        
        const uploadResponse = await fetch(`${apiBase}/api/campanhas/upload`, {
          method: 'POST',
          headers: headers,
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error(`Erro ao fazer upload do arquivo ${mediaFile.file.name}`);
        }

        const uploadResult = await uploadResponse.json();
        if (uploadResult.success) {
          uploadedFiles.push({
            id: uploadResult.data.id,
            name: uploadResult.data.name,
            type: mediaFile.type,
            size: uploadResult.data.size,
            url: uploadResult.data.url,
            path: uploadResult.data.path
          });
        }
      }

      // Criar campanha com data agendada
      const campanhaData = {
        nome: `Campanha Agendada - ${new Date(scheduleDate).toLocaleString()}`,
        template_id: selectedTemplate || null,
        contatos: selectedContacts.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone
        })),
        usuarios_remetentes: selectedNumbers,
        usar_ia: false,
        data_inicio: scheduleDate, // Usar a data agendada
        configuracoes: {
          rate_limit_per_minute: 30,
          interval_between_messages: 2000,
          max_messages_per_user: 1,
          numeros_whatsapp: selectedNumbers,
          media_files: uploadedFiles
        },
        message_content: message,
        media_files: uploadedFiles
      };

      const resultado = await criarCampanha(campanhaData);
      
      // Limpar formulário
      setMessage('');
      setSelectedContacts([]);
      setSelectedNumbers([]);
      setMediaFiles([]);
      setScheduleDate('');
      setCurrentStep('select');
      
      setOpen(false);
      onMessageSent?.();
      
    } catch (err) {
      console.error('Erro ao agendar mensagem:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      <div className="flex items-center space-x-4">
        <div className={`flex items-center space-x-2 ${currentStep === 'select' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'select' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Users className="h-4 w-4" />
          </div>
          <span className="text-sm">Números Conectados</span>
        </div>
        
        <div className="w-8 h-px bg-gray-300"></div>
        
        <div className={`flex items-center space-x-2 ${currentStep === 'compose' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'compose' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <MessageSquare className="h-4 w-4" />
          </div>
          <span className="text-sm">Escrever Mensagem</span>
        </div>
        
        <div className="w-8 h-px bg-gray-300"></div>
        
        <div className={`flex items-center space-x-2 ${currentStep === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'preview' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Send className="h-4 w-4" />
          </div>
          <span className="text-sm">Visualizar & Enviar</span>
        </div>
      </div>
    </div>
  );

  const renderContactSelection = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Seleção de Contatos
        </h3>
        <p className="text-sm text-muted-foreground">
          Selecione os grupos e contatos para envio
        </p>
      </div>

      <SelecaoContatos
        onContatosSelecionados={handleContactsSelected}
        onNumerosSelecionados={handleNumbersSelected}
      />

      {selectedContacts.length > 0 && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="">{selectedContacts.length} Contatos Selecionados</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedContacts.slice(0, 5).map(contact => (
              <Badge key={contact.id} variant="secondary" className="flex items-center gap-1">
                {contact.name}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setSelectedContacts(prev => prev.filter(c => c.id !== contact.id))}
                />
              </Badge>
            ))}
            {selectedContacts.length > 5 && (
              <Badge variant="outline">
                +{selectedContacts.length - 5} mais
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderMessageComposer = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Composer */}
      <div className="space-y-4">
        {/* Seleção de Template */}
        <div>
          <Label htmlFor="template">Usar Template (Opcional)</Label>
          <select
            id="template"
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoadingTemplates}
          >
            <option value="">Criar mensagem personalizada</option>
            {templatesAprovados?.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nome}
              </option>
            ))}
          </select>
          {isLoadingTemplates && (
            <p className="text-sm text-gray-500 mt-1">Carregando templates...</p>
          )}
        </div>

        <div>
          <Label htmlFor="message">Escrever Mensagem</Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem aqui..."
            rows={8}
            className="resize-none"
          />
        </div>

        {/* Anexos */}
        <div className="space-y-2">
          <Label>Anexos</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Image className="h-4 w-4" />
              Imagens
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Video className="h-4 w-4" />
              Vídeos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Documentos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Mic className="h-4 w-4" />
              Áudio
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />

          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              {mediaFiles.map(file => (
                <div key={file.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                  {file.type === 'image' && file.preview && (
                    <img src={file.preview} alt={file.file.name} className="w-8 h-8 object-cover rounded" />
                  )}
                  <span className="text-sm flex-1 truncate">{file.file.name}</span>
                  <X 
                    className="h-4 w-4 cursor-pointer text-red-500" 
                    onClick={() => removeMediaFile(file.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <Label>Visualizar Mensagem</Label>
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">D</span>
            </div>
            <div>
              <div className="text-sm">Dohoo</div>
              <div className="text-xs text-gray-500">Hoje</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 shadow-sm">
            {message ? (
              <div className="whitespace-pre-wrap text-sm">{message}</div>
            ) : (
              <div className="text-gray-400 text-sm italic">Digite sua mensagem para visualizar...</div>
            )}
            
            {mediaFiles.length > 0 && (
              <div className="mt-2 space-y-2">
                {mediaFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-2">
                    {file.type === 'image' && file.preview ? (
                      <div className="flex items-center gap-2">
                        <img 
                          src={file.preview} 
                          alt={file.file.name} 
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                        <div className="text-xs text-gray-600">{file.file.name}</div>
                      </div>
                    ) : file.type === 'video' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-500" />
                        </div>
                        <div className="text-xs text-gray-600">{file.file.name}</div>
                      </div>
                    ) : file.type === 'audio' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Mic className="w-6 h-6 text-gray-500" />
                        </div>
                        <div className="text-xs text-gray-600">{file.file.name}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-gray-500" />
                        </div>
                        <div className="text-xs text-gray-600">{file.file.name}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-xs text-gray-400 mt-2">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          Mensagem em Massa
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Mensagem em Massa
          </DialogTitle>
          <DialogDescription>
            Envie mensagens para múltiplos contatos de forma rápida e eficiente
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="space-y-6">
          {currentStep === 'select' && renderContactSelection()}
          
          {currentStep === 'compose' && renderMessageComposer()}
          
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg mb-2">Resumo da Mensagem</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-muted rounded">
                    <div className="">Contatos</div>
                    <div className="text-2xl text-blue-600">{selectedContacts.length}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="">Anexos</div>
                    <div className="text-2xl text-blue-600">{mediaFiles.length}</div>
                  </div>
                </div>
              </div>
              
              {/* Pré-visualização realista do WhatsApp */}
              <div className="space-y-4">
                <div className="">Como ficará no WhatsApp:</div>
                
                {/* Campo de agendamento */}
                <div className="p-4 border rounded-lg bg-blue-50">
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Agendar Envio
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="schedule-date">Data</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduleDate ? scheduleDate.split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value;
                          const time = scheduleDate ? scheduleDate.split('T')[1] : '09:00';
                          setScheduleDate(`${date}T${time}`);
                        }}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-time">Hora</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduleDate ? scheduleDate.split('T')[1] : '09:00'}
                        onChange={(e) => {
                          const time = e.target.value;
                          const date = scheduleDate ? scheduleDate.split('T')[0] : new Date().toISOString().split('T')[0];
                          setScheduleDate(`${date}T${time}`);
                        }}
                      />
                    </div>
                  </div>
                  {scheduleDate && (
                    <div className="mt-2 text-sm text-gray-600">
                      📅 Agendado para: {new Date(scheduleDate).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">D</span>
                    </div>
                    <div>
                      <div className="text-sm">Dohoo</div>
                      <div className="text-xs text-gray-500">Hoje</div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 shadow-sm max-w-xs">
                    {message && (
                      <div className="whitespace-pre-wrap text-sm mb-2">{message}</div>
                    )}
                    
                    {/* Mostrar anexos como apareceriam no WhatsApp */}
                    {mediaFiles.length > 0 && (
                      <div className="space-y-2">
                        {mediaFiles.map(file => (
                          <div key={file.id}>
                            {file.type === 'image' && file.preview ? (
                              <div className="rounded-lg overflow-hidden">
                                <img 
                                  src={file.preview} 
                                  alt={file.file.name} 
                                  className="w-full max-w-48 h-auto rounded-lg"
                                />
                                {file.file.name && (
                                  <div className="text-xs text-gray-500 mt-1 px-1">
                                    {file.file.name}
                                  </div>
                                )}
                              </div>
                            ) : file.type === 'video' ? (
                              <div className="bg-gray-200 rounded-lg p-4 flex items-center gap-2">
                                <Video className="w-6 h-6 text-gray-500" />
                                <div className="text-sm">{file.file.name}</div>
                              </div>
                            ) : file.type === 'audio' ? (
                              <div className="bg-gray-200 rounded-lg p-4 flex items-center gap-2">
                                <Mic className="w-6 h-6 text-gray-500" />
                                <div className="text-sm">{file.file.name}</div>
                              </div>
                            ) : (
                              <div className="bg-gray-200 rounded-lg p-4 flex items-center gap-2">
                                <FileText className="w-6 h-6 text-gray-500" />
                                <div className="text-sm">{file.file.name}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-2">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {currentStep !== 'select' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (currentStep === 'compose') setCurrentStep('select');
                  if (currentStep === 'preview') setCurrentStep('compose');
                }}
              >
                Voltar
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            
            {currentStep === 'select' && (
              <Button
                onClick={() => setCurrentStep('compose')}
                disabled={selectedContacts.length === 0}
              >
                Próximo
              </Button>
            )}
            
            {currentStep === 'compose' && (
              <Button
                onClick={() => setCurrentStep('preview')}
                disabled={!message.trim()}
              >
                Visualizar
              </Button>
            )}
            
            {currentStep === 'preview' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSchedule}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Agendar
                </Button>
                <Button
                  onClick={handleSendNow}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar Agora
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
