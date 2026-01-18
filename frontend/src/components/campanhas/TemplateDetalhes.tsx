import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  User, 
  Calendar,
  Image,
  Video,
  Mic,
  File
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTemplate } from '@/hooks/useTemplates';
import { Skeleton } from '@/components/ui/skeleton';

interface TemplateDetalhesProps {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateDetalhes({ templateId, open, onOpenChange }: TemplateDetalhesProps) {
  const { data: template, isLoading } = useTemplate(templateId);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {template.nome}
          </DialogTitle>
          <DialogDescription>
            Visualize os detalhes e informações do template de mensagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status e informações básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Informações do Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Criado por
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {template.criado_por_profile?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {template.criado_por_profile?.email}
                  </p>
                </div>
                
                <div>
                  <h4 className="mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data de Criação
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(template.criado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                  {template.atualizado_em !== template.criado_em && (
                    <p className="text-xs text-muted-foreground">
                      Atualizado em: {format(new Date(template.atualizado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conteúdo do template */}
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo da Mensagem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg">
                <p className="whitespace-pre-wrap text-sm">{template.conteudo}</p>
              </div>
            </CardContent>
          </Card>

          {/* Arquivos de mídia */}
          {template.media_files && template.media_files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Anexos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {template.media_files.map((file: any, index: number) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      {file.type === 'image' ? (
                        <Image className="h-8 w-8 text-blue-500" />
                      ) : file.type === 'video' ? (
                        <Video className="h-8 w-8 text-purple-500" />
                      ) : file.type === 'audio' ? (
                        <Mic className="h-8 w-8 text-green-500" />
                      ) : (
                        <File className="h-8 w-8 text-gray-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      {file.type === 'image' && file.url && (
                        <img 
                          src={file.url} 
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
