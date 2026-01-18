import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Sparkles,
  Image,
  Video,
  Mic,
  X
} from 'lucide-react';
import { useTemplates, useSugerirMelhorias } from '@/hooks/useTemplates';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MediaFile {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  preview?: string;
}

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const { criarTemplate, isCreating } = useTemplates();
  const { mutateAsync: sugerirMelhorias, isPending: isSuggesting } = useSugerirMelhorias();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    nome: '',
    conteudo: ''
  });

  const [variaveisDetectadas, setVariaveisDetectadas] = useState<string[]>([]);
  const [sugestoes, setSugestoes] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detectar variáveis automaticamente
  useEffect(() => {
    const regex = /\{([^}]+)\}/g;
    const matches = [...formData.conteudo.matchAll(regex)];
    const variaveis = matches.map(match => match[1]).filter((v, i, arr) => arr.indexOf(v) === i);
    setVariaveisDetectadas(variaveis);
  }, [formData.conteudo]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }

    if (!formData.conteudo.trim()) {
      toast.error('Conteúdo do template é obrigatório');
      return;
    }

    try {
      // Upload dos arquivos de mídia primeiro
      const uploadedFiles = [];
      for (const mediaFile of mediaFiles) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', mediaFile.file);

        // ✅ CORRIGIDO: Usar apiBase e getAuthHeaders como o resto do código
        const headers = await getAuthHeaders();
        // Remover Content-Type para deixar o browser definir automaticamente (necessário para FormData)
        delete headers['Content-Type'];
        
        const uploadResponse = await fetch(`${apiBase}/api/campanhas/upload`, {
          method: 'POST',
          headers: headers,
          body: uploadFormData,
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

      await criarTemplate({
        nome: formData.nome,
        conteudo: formData.conteudo,
        variaveis: variaveisDetectadas,
        media_files: uploadedFiles
      });

      // Reset form
      setFormData({ nome: '', conteudo: '' });
      setVariaveisDetectadas([]);
      setSugestoes(null);
      setMediaFiles([]);
      
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar template:', error);
      toast.error('Erro ao criar template');
    }
  };

  const handleSugerir = async () => {
    if (!formData.conteudo.trim()) {
      toast.error('Digite o conteúdo do template primeiro');
      return;
    }

    try {
      const resultado = await sugerirMelhorias({ conteudo: formData.conteudo });
      setSugestoes(resultado.data.sugestoes);
    } catch (error) {
      console.error('Erro ao gerar sugestões:', error);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Novo Template de Mensagem
          </DialogTitle>
          <DialogDescription>
            Crie um template reutilizável para suas campanhas com variáveis dinâmicas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Template</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Promoção Black Friday"
                  required
                />
              </div>

              <div>
                <Label htmlFor="conteudo">Conteúdo da Mensagem</Label>
                <Textarea
                  id="conteudo"
                  value={formData.conteudo}
                  onChange={(e) => setFormData(prev => ({ ...prev, conteudo: e.target.value }))}
                  placeholder="Digite sua mensagem aqui... Use {nome}, {produto}, etc. para variáveis dinâmicas"
                  rows={8}
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Use chaves para criar variáveis: {'{nome}'}, {'{produto}'}, {'{empresa}'}
                </p>
              </div>

              {/* Anexos */}
              <div className="space-y-2">
                <Label>Anexos (Opcional)</Label>
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

              {/* Variáveis detectadas */}
              {variaveisDetectadas.length > 0 && (
                <div>
                  <Label>Variáveis Detectadas</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {variaveisDetectadas.map((variavel, index) => (
                      <Badge key={index} variant="secondary">
                        {`{${variavel}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ferramentas de IA */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSugerir}
                  disabled={isSuggesting}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {isSuggesting ? 'Gerando...' : 'Sugerir Melhorias'}
                </Button>
              </div>

              {/* Sugestões de melhoria */}
              {sugestoes && (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    <strong>💡 Sugestões de Melhoria:</strong>
                    <div className="mt-2 whitespace-pre-wrap text-sm">
                      {sugestoes}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isCreating}
            className="flex items-center gap-2"
          >
            {isCreating ? 'Criando...' : 'Criar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
