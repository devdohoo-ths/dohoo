import React, { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Sparkles, 
  Brain,
  Lightbulb
} from 'lucide-react';
import { useTemplates, useValidarTemplate, useSugerirMelhorias } from '@/hooks/useTemplates';
import { toast } from 'sonner';

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

interface EditTemplateDialogProps {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTemplateDialog({ template, open, onOpenChange }: EditTemplateDialogProps) {
  const { atualizarTemplate, isUpdating } = useTemplates();
  const { mutateAsync: validarTemplate, isPending: isValidating } = useValidarTemplate();
  const { mutateAsync: sugerirMelhorias, isPending: isSuggesting } = useSugerirMelhorias();

  const [formData, setFormData] = useState({
    nome: template.nome,
    conteudo: template.conteudo
  });

  const [variaveisDetectadas, setVariaveisDetectadas] = useState<string[]>([]);
  const [validacao, setValidacao] = useState<{ aprovado: boolean; motivo?: string } | null>(null);
  const [sugestoes, setSugestoes] = useState<string | null>(null);

  // Resetar form quando template mudar
  useEffect(() => {
    setFormData({
      nome: template.nome,
      conteudo: template.conteudo
    });
    setValidacao(null);
    setSugestoes(null);
  }, [template]);

  // Detectar variáveis automaticamente
  useEffect(() => {
    const regex = /\{([^}]+)\}/g;
    const matches = [...formData.conteudo.matchAll(regex)];
    const variaveis = matches.map(match => match[1]).filter((v, i, arr) => arr.indexOf(v) === i);
    setVariaveisDetectadas(variaveis);
  }, [formData.conteudo]);

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
      await atualizarTemplate({
        id: template.id,
        data: {
          nome: formData.nome,
          conteudo: formData.conteudo,
          aprovado: formData.aprovado
        }
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
    }
  };

  const handleValidar = async () => {
    if (!formData.conteudo.trim()) {
      toast.error('Digite o conteúdo do template primeiro');
      return;
    }

    try {
      const resultado = await validarTemplate(formData.conteudo);
      setValidacao(resultado.data);
    } catch (error) {
      console.error('Erro ao validar template:', error);
    }
  };

  const handleSugerir = async () => {
    if (!formData.conteudo.trim()) {
      toast.error('Digite o conteúdo do template primeiro');
      return;
    }

    try {
      const resultado = await sugerirMelhorias({ conteudo: formData.conteudo });
      setSugestoes(resultado.data);
    } catch (error) {
      console.error('Erro ao gerar sugestões:', error);
    }
  };

  const hasChanges = 
    formData.nome !== template.nome ||
    formData.conteudo !== template.conteudo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Editar Template: {template.nome}
          </DialogTitle>
          <DialogDescription>
            Faça alterações no template e use IA para validar e melhorar o conteúdo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações básicas */}
          <div className="space-y-4">
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

          </div>

          <Separator />

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

          <Separator />

          {/* Ferramentas de IA */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleValidar}
                disabled={isValidating}
                className="flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                {isValidating ? 'Validando...' : 'Validar com IA'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSugerir}
                disabled={isSuggesting}
                className="flex items-center gap-2"
              >
                <Lightbulb className="h-4 w-4" />
                {isSuggesting ? 'Gerando...' : 'Sugerir Melhorias'}
              </Button>
            </div>

            {/* Resultado da validação */}
            {validacao && (
              <Alert variant={validacao.aprovado ? 'default' : 'destructive'}>
                {validacao.aprovado ? (
                  <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                ) : (
                  <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-xs">✗</span>
                  </div>
                )}
                <AlertDescription>
                  {validacao.aprovado 
                    ? '✅ Template aprovado! Está em conformidade com as políticas do WhatsApp.'
                    : `❌ Template rejeitado: ${validacao.motivo}`
                  }
                </AlertDescription>
              </Alert>
            )}

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
          </div>


          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isUpdating || !hasChanges}
              className="flex items-center gap-2"
            >
              {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
