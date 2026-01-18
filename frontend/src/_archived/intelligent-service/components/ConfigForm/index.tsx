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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Zap, Users, MessageCircle } from 'lucide-react';
import type { IntelligentServiceProduct } from '../../types';
import { useConfigs } from '../../hooks/useConfigs';

interface ConfigFormProps {
  open: boolean;
  onClose: () => void;
  config?: IntelligentServiceProduct | null;
  teams: Array<{ id: string; name: string }>;
  flows?: Array<{ id: string; name: string }>;
}

/**
 * Formulário para criar ou editar uma configuração de atendimento
 */
export const ConfigForm: React.FC<ConfigFormProps> = ({
  open,
  onClose,
  config,
  teams,
  flows = []
}) => {
  const { createConfig, updateConfig } = useConfigs();
  const [loading, setLoading] = useState(false);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team_id: '',
    flow_id: '',
    chat_type: 'hybrid' as 'internal' | 'external' | 'hybrid',
    is_active: true
  });

  // Preencher formulário se estiver editando
  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name,
        description: config.description || '',
        team_id: config.team_id || '',
        flow_id: config.flow_id || '',
        chat_type: config.chat_config?.type || 'hybrid',
        is_active: config.is_active
      });
    } else {
      // Resetar formulário se estiver criando
      setFormData({
        name: '',
        description: '',
        team_id: '',
        flow_id: '',
        chat_type: 'hybrid',
        is_active: true
      });
    }
  }, [config, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    if (!formData.team_id) {
      return;
    }

    setLoading(true);

    const configData = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      team_id: formData.team_id,
      flow_id: formData.flow_id || undefined,
      chat_config: {
        type: formData.chat_type,
        internal_enabled: formData.chat_type === 'internal' || formData.chat_type === 'hybrid',
        external_enabled: formData.chat_type === 'external' || formData.chat_type === 'hybrid',
        auto_routing: false
      },
      is_active: formData.is_active
    };

    let success = false;

    if (config) {
      // Atualizar existente
      const result = await updateConfig(config.id, configData);
      success = !!result;
    } else {
      // Criar novo
      const result = await createConfig(configData);
      success = !!result;
    }

    setLoading(false);

    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config ? 'Editar Configuração' : 'Nova Configuração'}
          </DialogTitle>
          <DialogDescription>
            {config 
              ? 'Edite as informações da configuração de atendimento'
              : 'Crie uma nova configuração combinando fluxo, time e chat'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome da Configuração *
            </Label>
            <Input
              id="name"
              placeholder="Ex: Atendimento Vendas"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Descrição
            </Label>
            <Textarea
              id="description"
              placeholder="Descreva o propósito desta configuração..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="team" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Time *
            </Label>
            <Select
              value={formData.team_id}
              onValueChange={(value) => setFormData({ ...formData, team_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um time" />
              </SelectTrigger>
              <SelectContent>
                {teams.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum time disponível
                  </div>
                ) : (
                  teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Fluxo (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="flow" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Fluxo (Opcional)
            </Label>
            <Select
              value={formData.flow_id}
              onValueChange={(value) => setFormData({ ...formData, flow_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fluxo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {flows.map(flow => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Chat */}
          <div className="space-y-2">
            <Label htmlFor="chat_type" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Tipo de Chat
            </Label>
            <Select
              value={formData.chat_type}
              onValueChange={(value: any) => setFormData({ ...formData, chat_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hybrid">
                  Híbrido (Interno + Externo)
                </SelectItem>
                <SelectItem value="internal">
                  Apenas Interno
                </SelectItem>
                <SelectItem value="external">
                  Apenas Externo
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Ativo */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Configuração Ativa</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativa, esta configuração estará disponível para uso
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.name || !formData.team_id}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {config ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConfigForm;

