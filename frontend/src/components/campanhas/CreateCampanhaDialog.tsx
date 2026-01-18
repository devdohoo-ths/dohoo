import React, { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Clock, Users, Star, Settings, CheckCircle } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { useCampanhas } from '@/hooks/useCampanhas';
import { SelecaoContatos } from './SelecaoContatos';
import type { ContatoComHistorico } from '@/hooks/useCampanhasContatos';

interface CreateCampanhaDialogProps {
  onCampanhaCreated?: () => void;
}

export function CreateCampanhaDialog({ onCampanhaCreated }: CreateCampanhaDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados do formulário
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [contatos, setContatos] = useState<ContatoComHistorico[]>([]);
  const [numerosSelecionados, setNumerosSelecionados] = useState<string[]>([]);
  const [usarIa, setUsarIa] = useState(false);
  const [dataInicio, setDataInicio] = useState('');

  // Configurações avançadas
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(30);
  const [intervalBetweenMessages, setIntervalBetweenMessages] = useState(2000);
  const [maxMessagesPerUser, setMaxMessagesPerUser] = useState(1);

  const { templates, isLoading: isLoadingTemplates } = useTemplates();
  const { criarCampanha } = useCampanhas();

  const handleContatosSelecionados = (contatosSelecionados: ContatoComHistorico[]) => {
    setContatos(contatosSelecionados);
  };

  const handleNumerosSelecionados = (numeros: string[]) => {
    setNumerosSelecionados(numeros);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!nome.trim() || !templateId || contatos.length === 0) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const campanhaData = {
        nome,
        descricao,
        template_id: templateId,
        contatos: contatos.map(c => ({
          id: c.contato_phone, // Usar telefone como ID temporário
          name: c.contato_name || 'Cliente',
          phone: c.contato_phone
        })),
        usuarios_remetentes: numerosSelecionados, // Por enquanto usar números, depois mapear para user IDs
        usar_ia: usarIa,
        data_inicio: dataInicio || new Date().toISOString(),
        configuracoes: {
          rate_limit_per_minute: rateLimitPerMinute,
          interval_between_messages: intervalBetweenMessages,
          max_messages_per_user: maxMessagesPerUser,
          numeros_whatsapp: numerosSelecionados
        }
      };

      await criarCampanha(campanhaData);
      
      // Limpar formulário
      setNome('');
      setDescricao('');
      setTemplateId('');
      setContatos([]);
      setNumerosSelecionados([]);
      setUsarIa(false);
      setDataInicio('');
      setMostrarSelecaoContatos(false);
      
      setOpen(false);
      onCampanhaCreated?.();
      
    } catch (err) {
      console.error('Erro ao criar campanha:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Campanha com Template
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Criar Nova Campanha
            </div>
          </DialogTitle>
          <DialogDescription>
            Configure uma nova campanha inteligente com seleção de contatos baseada no histórico
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome da Campanha *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)}
                placeholder="Ex: Promoção Black Friday"
                required
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescricao(e.target.value)}
                placeholder="Descreva o objetivo da campanha..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="template">Template *</Label>
              <Select value={templateId} onValueChange={setTemplateId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingTemplates ? (
                    <SelectItem value="loading" disabled>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Carregando templates...
                    </SelectItem>
                  ) : (
                    templates?.map((template: any) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.nome}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Seleção de Contatos */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Seleção de Contatos
              </h3>
              <p className="text-sm text-muted-foreground">
                Selecione números conectados e contatos com histórico
              </p>
            </div>

            <SelecaoContatos
              onContatosSelecionados={handleContatosSelecionados}
              onNumerosSelecionados={handleNumerosSelecionados}
            />

            {contatos.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="">Contatos Selecionados</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total:</span> {contatos.length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Números:</span> {numerosSelecionados.length}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Configurações de IA */}
          <div className="space-y-4">
            <h3 className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações de IA
            </h3>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="usar-ia"
                checked={usarIa}
                onCheckedChange={setUsarIa}
              />
              <Label htmlFor="usar-ia">
                Usar IA para personalização e análise
              </Label>
            </div>
            
            {usarIa && (
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  A IA será usada para personalizar mensagens e analisar respostas dos clientes.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Configurações Avançadas */}
          <div className="space-y-4">
            <h3 className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Configurações Avançadas
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data-inicio">Data de Início</Label>
                <Input
                  id="data-inicio"
                  type="datetime-local"
                  value={dataInicio}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDataInicio(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="rate-limit">Mensagens por Minuto</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  value={rateLimitPerMinute.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRateLimitPerMinute(Number(e.target.value))}
                  min="1"
                  max="60"
                />
              </div>

              <div>
                <Label htmlFor="interval">Intervalo entre Mensagens (ms)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={intervalBetweenMessages.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntervalBetweenMessages(Number(e.target.value))}
                  min="1000"
                  max="10000"
                />
              </div>

              <div>
                <Label htmlFor="max-messages">Máx. Mensagens por Contato</Label>
                <Input
                  id="max-messages"
                  type="number"
                  value={maxMessagesPerUser.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxMessagesPerUser(Number(e.target.value))}
                  min="1"
                  max="5"
                />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Campanha
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
