import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Trash2, 
  FileText,
  User,
  Calendar,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTemplates } from '@/hooks/useTemplates';
import { TemplateDetalhes } from './TemplateDetalhes';
import { EditTemplateDialog } from './EditTemplateDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Template {
  id: string;
  nome: string;
  conteudo: string;
  variaveis: string[];
  criado_em: string;
  atualizado_em: string;
  criado_por_profile: {
    id: string;
    name: string;
    email: string;
  };
}

export function TemplatesList() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  
  const { 
    templates, 
    isLoading, 
    error, 
    deletarTemplate 
  } = useTemplates();

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    
    try {
      await deletarTemplate(deletingTemplate.id);
      setDeletingTemplate(null);
    } catch (error) {
      console.error('Erro ao deletar template:', error);
    }
  };


  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erro ao carregar templates. Tente novamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg mb-2">Nenhum template encontrado</h3>
          <p className="text-muted-foreground text-center mb-4">
            Crie seu primeiro template de mensagem para usar em campanhas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template: Template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{template.nome}</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Conteúdo */}
              <div className="space-y-2">
                <p className="text-sm">Conteúdo:</p>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  {truncateText(template.conteudo)}
                </p>
              </div>

              {/* Variáveis */}
              {template.variaveis && template.variaveis.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm">Variáveis:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.variaveis.map((variavel, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {`{${variavel}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadados */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{template.criado_por_profile.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(template.criado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTemplate(template.id)}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  Ver
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTemplate(template)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Editar
                </Button>


                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingTemplate(template)}
                  className="flex items-center gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Diálogo de detalhes */}
      {selectedTemplate && (
        <TemplateDetalhes
          templateId={selectedTemplate}
          open={!!selectedTemplate}
          onOpenChange={(open) => !open && setSelectedTemplate(null)}
        />
      )}

      {/* Diálogo de edição */}
      {editingTemplate && (
        <EditTemplateDialog
          template={editingTemplate}
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
        />
      )}

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={() => setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{deletingTemplate?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
