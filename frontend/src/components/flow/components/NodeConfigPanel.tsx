import { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FlowNode } from '../types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FLOW_BLOCKS } from '../flowBlocks';
import { useOrganization } from '@/hooks/useOrganization';
import { HorariosField } from './HorariosField';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface NodeConfigPanelProps {
  node: FlowNode;
  onClose: () => void;
  onSave: (config: any) => void;
  onSaveToBackend?: () => Promise<void>;
  onDelete?: (nodeId: string) => void; // Nova prop para deletar
  availableBlocks?: any[]; // Blocos customizados (opcional)
}

interface Agente {
  id: string;
  nome: string;
  email: string;
}

interface AgenteIA {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  personality?: string;
}

interface Departamento {
  id: string;
  name: string;
  description?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
}

export const NodeConfigPanel = ({ node, onClose, onSave, onSaveToBackend, onDelete, availableBlocks }: NodeConfigPanelProps) => {
  // Usar blocos fornecidos ou padrão FLOW_BLOCKS
  const blocks = availableBlocks || FLOW_BLOCKS;
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(node.data?.config || {});
  const [label, setLabel] = useState(node.data?.label || node.type);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [agentesIA, setAgentesIA] = useState<AgenteIA[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Para opções dinâmicas
  const isOptionsNode = node.type === 'opcoes';
  const [optionsList, setOptionsList] = useState<string[]>(
    Array.isArray(config.opcoes)
      ? config.opcoes
      : typeof config.opcoes === 'string' && config.opcoes
        ? config.opcoes.split('\n').map((o: string) => o.trim()).filter(Boolean)
        : ['']
  );
  
  // Sincronizar com mudanças do node
  useEffect(() => {
    setLabel(node.data.label || '');
    setConfig(node.data.config || {});
    
    // Atualizar optionsList se for um nó de opções
    if (isOptionsNode) {
      const newOptions = Array.isArray(node.data.config?.opcoes)
        ? node.data.config.opcoes
        : typeof node.data.config?.opcoes === 'string' && node.data.config.opcoes
          ? node.data.config.opcoes.split('\n').map((o: string) => o.trim()).filter(Boolean)
          : [''];
      setOptionsList(newOptions);
    }
    
    // Sincronizar horários
    if (node.type === 'horario') {
      const newHorarios = Array.isArray(node.data.config?.horarios)
        ? node.data.config.horarios
        : [{ horaInicio: '09:00', horaFim: '18:00' }];
      setConfig(prev => ({ ...prev, horarios: newHorarios }));
    }
  }, [node, isOptionsNode]);

  useEffect(() => {
    if (node.type === 'transferencia_agente' || node.type === 'transferencia_departamento') {
      carregarDadosReais();
    }
    if (isOptionsNode) {
      setConfig((c) => ({ ...c, opcoes: optionsList }));
    }
  }, [node.id, isOptionsNode, optionsList]);

  // Carregar dados reais apenas uma vez quando o painel abrir
  useEffect(() => {
    if (organization?.id) {
      carregarDadosReais();
    }
  }, [organization?.id]); // Só executa quando organization.id mudar

  // Atualizar departamentoId se o valor atual não existir na lista
  useEffect(() => {
    if (!departamentos.length) return;
    const currentDeptId = config['departamentoId'];
    const exists = departamentos.some(d => d.id === currentDeptId);
    if (currentDeptId && !exists) {
      setConfig(prev => ({ ...prev, departamentoId: '' }));
    }
  }, [departamentos]);

  // Atualizar agenteId se o valor atual não existir na lista
  useEffect(() => {
    if (!agentes.length) return;
    const currentAgenteId = config['agenteId'];
    const exists = agentes.some(a => a.id === currentAgenteId);
    if (currentAgenteId && !exists) {
      setConfig(prev => ({ ...prev, agenteId: '' }));
    }
  }, [agentes]);

  // Atualizar agenteIaId se o valor atual não existir na lista
  useEffect(() => {
    if (!agentesIA.length) return;
    const currentAgenteIaId = config['agenteIaId'];
    const exists = agentesIA.some(a => a.id === currentAgenteIaId);
    if (currentAgenteIaId && !exists) {
      setConfig(prev => ({ ...prev, agenteIaId: '' }));
    }
  }, [agentesIA]);

  const carregarDadosReais = async () => {
    if (!organization?.id) {
      return;
    }
    setLoading(true);
    try {
      // Carregar departamentos reais
      const responseDept = await fetch(`/api/departments/list?organization_id=${organization.id}`);
      const deptData = await responseDept.json();
      if (deptData.success && deptData.departments) {
        setDepartamentos(deptData.departments);
      } else {
        setDepartamentos([]);
      }
      
      // Carregar agentes reais via API do backend
      const headers = await getAuthHeaders();
      const usersResponse = await fetch(`${apiBase}/api/users?organization_id=${organization.id}`, {
        headers
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        const users = usersData.users || usersData.data || [];
        const formattedAgentes = users.map((u: any) => ({
          id: u.id,
          name: u.name || u.full_name || 'Usuário',
          email: u.email || ''
        }));
        console.log('🔍 [NodeConfigPanel] Agentes carregados:', formattedAgentes.length);
        setAgentes(formattedAgentes);
      } else {
        console.error('❌ [NodeConfigPanel] Erro ao carregar agentes:', usersResponse.status);
        setAgentes([]);
      }

      // Carregar agentes de IA
      const responseAgentesIA = await fetch(`/api/ai/agents?organization_id=${organization.id}`);
      const agentesIAData = await responseAgentesIA.json();
      if (agentesIAData.success && agentesIAData.agents) {
        setAgentesIA(agentesIAData.agents);
      } else {
        setAgentesIA([]);
      }

      // Carregar times via API do backend
      const teamsResponse = await fetch(`${apiBase}/api/teams?organization_id=${organization.id}`, {
        headers: await getAuthHeaders()
      });
      
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        const teamsList = teamsData.teams || teamsData.data || [];
        const formattedTeams = teamsList.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description || ''
        }));
        console.log('🔍 [NodeConfigPanel] Times carregados:', formattedTeams.length);
        setTeams(formattedTeams);
      } else {
        console.error('❌ [NodeConfigPanel] Erro ao carregar times:', teamsResponse.status);
        setTeams([]);
      }
    } catch (error) {
      console.error('[NodeConfigPanel] Erro ao carregar dados:', error);
      setDepartamentos([]);
      setAgentes([]);
      setAgentesIA([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const configToSave = { ...config, label };
    onSave(configToSave);
    
    // Mostrar toast de sucesso
    toast({ title: 'Configuração salva', description: 'Bloco configurado com sucesso!' });
    
    // Fechar o painel
    onClose();
    
    // Após 2 segundos, chamar o atualizar automaticamente
    setTimeout(() => {
      if (onSaveToBackend) {
        onSaveToBackend().then(() => {
          toast({ title: 'Atualizado', description: 'Bloco atualizado no backend!' });
        }).catch((e) => {
          toast({ title: 'Erro', description: 'Erro ao atualizar no backend', variant: 'destructive' });
        });
      }
    }, 2000);
  };

  const updateConfig = (key: string, value: any) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig, [key]: value };
      return newConfig;
    });
  };

  const handleOptionChange = (idx: number, value: string) => {
    setOptionsList((opts) => opts.map((opt, i) => (i === idx ? value : opt)));
  };
  const handleAddOption = () => setOptionsList((opts) => [...opts, '']);
  const handleRemoveOption = (idx: number) => setOptionsList((opts) => opts.filter((_, i) => i !== idx));

  // Renderização dinâmica dos campos de configuração
  const blockDef = blocks.find(b => b.type === node.type);

  const renderDynamicFields = () => {
    if (!blockDef) {
      return <div className="text-red-500">Tipo de bloco não encontrado: {node.type}</div>;
    }
    
    return blockDef.configFields.map(field => {
      switch (field.type) {
        case 'text':
          return (
            <div key={field.key} className="mb-4">
              <Label htmlFor={field.key}>{field.label}{field.required && ' *'}</Label>
              <Input
                id={field.key}
                name={field.key}
                value={config[field.key] || ''}
                onChange={e => updateConfig(field.key, e.target.value)}
                required={field.required}
              />
            </div>
          );
        case 'textarea':
          return (
            <div key={field.key} className="mb-4">
              <Label htmlFor={field.key}>{field.label}{field.required && ' *'}</Label>
              <Textarea
                id={field.key}
                name={field.key}
                value={config[field.key] || ''}
                onChange={e => updateConfig(field.key, e.target.value)}
                required={field.required}
                className="min-h-[80px]"
              />
            </div>
          );
        case 'select':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <Select
                key={`${field.key}-${config[field.key] || 'empty'}`}
                value={config[field.key] || ''}
                onValueChange={value => {
                  updateConfig(field.key, value);
                }}
                name={field.key}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma opção">
                    {config[field.key] || "Selecione uma opção"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map(opt => {
                    // Suportar tanto strings quanto objetos {value, label}
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    const optLabel = typeof opt === 'string' ? opt : opt.label;
                    return (
                      <SelectItem key={optValue} value={optValue}>
                        {optLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">
                Valor atual: "{config[field.key] || 'vazio'}"
              </div>
            </div>
          );
        case 'options':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <div className="flex flex-col gap-2">
                {(config[field.key] || ['']).map((opt: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={e => {
                        const newOpts = [...(config[field.key] || [])];
                        newOpts[idx] = e.target.value;
                        updateConfig(field.key, newOpts);
                      }}
                      placeholder={`Opção ${idx + 1}`}
                    />
                    {(config[field.key]?.length > 1) && (
                      <Button variant="ghost" size="icon" onClick={() => {
                        const newOpts = [...(config[field.key] || [])];
                        newOpts.splice(idx, 1);
                        updateConfig(field.key, newOpts);
                      }}><X className="w-4 h-4" /></Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                  updateConfig(field.key, [...(config[field.key] || []), '']);
                }}>Adicionar Opção</Button>
              </div>
            </div>
          );
        case 'diasSemana':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                {['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].map(dia => (
                  <div key={dia} className="flex items-center gap-2">
                    <Checkbox
                      id={`dia-${dia}`}
                      checked={config[field.key]?.[dia] || false}
                      onCheckedChange={(checked) => {
                        const newDias = { ...(config[field.key] || {}) };
                        newDias[dia] = checked;
                        updateConfig(field.key, newDias);
                      }}
                    />
                    <Label htmlFor={`dia-${dia}`} className="capitalize text-sm font-normal">{dia}</Label>
                  </div>
                ))}
              </div>
            </div>
          );
        case 'file':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <Input
                type="file"
                accept={field.accept}
                onChange={e => updateConfig(field.key, e.target.files?.[0] || null)}
              />
            </div>
          );
        case 'time':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <Input
                type="time"
                id={field.key}
                name={field.key}
                value={config[field.key] || ''}
                onChange={e => updateConfig(field.key, e.target.value)}
              />
            </div>
          );
        case 'selectAgente':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <Select
                value={config[field.key] || ''}
                onValueChange={value => {
                  const selectedAgente = agentes.find(a => a.id === value);
                  setConfig(prevConfig => ({
                    ...prevConfig,
                    [field.key]: value,
                    agenteNome: selectedAgente?.name || ''
                  }));
                }}
                disabled={loading || agentes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente">
                    {agentes.find(a => a.id === config[field.key])?.name || 'Selecione um agente'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agentes.length === 0 ? (
                    <div className="px-4 py-2 text-gray-500">Nenhum agente disponível</div>
                  ) : (
                    agentes.map(agente => (
                      <SelectItem key={agente.id} value={agente.id}>
                        {agente.name} ({agente.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">
                Valor atual: "{config[field.key] || 'vazio'}"
                {config.agenteNome && ` - ${config.agenteNome}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Agentes disponíveis: {agentes.length}
              </div>
            </div>
          );
        case 'selectDepartamento':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <Select
                value={config[field.key] || ''}
                onValueChange={value => {
                  const selectedDept = departamentos.find(d => d.id === value);
                  setConfig(prevConfig => ({
                    ...prevConfig,
                    [field.key]: value,
                    departamentoNome: selectedDept?.name || ''
                  }));
                }}
                disabled={loading || departamentos.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento">
                    {departamentos.find(d => d.id === config[field.key])?.name || 'Selecione um departamento'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departamentos.length === 0 ? (
                    <div className="px-4 py-2 text-gray-500">Nenhum departamento disponível</div>
                  ) : (
                    departamentos.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">
                Valor atual: "{config[field.key] || 'vazio'}"
                {config.departamentoNome && ` - ${config.departamentoNome}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Departamentos disponíveis: {departamentos.length}
              </div>
            </div>
          );
        case 'selectTeam':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <Select
                value={config[field.key] || ''}
                onValueChange={value => {
                  const selectedTeam = teams.find(t => t.id === value);
                  setConfig(prevConfig => ({
                    ...prevConfig,
                    [field.key]: value,
                    teamNome: selectedTeam?.name || ''
                  }));
                }}
                disabled={loading || teams.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um time">
                    {teams.find(t => t.id === config[field.key])?.name || 'Selecione um time'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.length === 0 ? (
                    <div className="px-4 py-2 text-gray-500">Nenhum time disponível</div>
                  ) : (
                    teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">
                Valor atual: "{config[field.key] || 'vazio'}"
                {config.teamNome && ` - ${config.teamNome}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Times disponíveis: {teams.length}
              </div>
            </div>
          );
        case 'selectAgenteIA':
          return (
            <div key={field.key} className="mb-4">
              <Label>{field.label}{field.required && ' *'}</Label>
              <Select
                value={config[field.key] || ''}
                onValueChange={value => {
                  const selectedAgente = agentesIA.find(a => a.id === value);
                  setConfig(prevConfig => ({
                    ...prevConfig,
                    [field.key]: value,
                    agenteIaNome: selectedAgente?.name || ''
                  }));
                }}
                disabled={loading || agentesIA.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente de IA">
                    {agentesIA.find(a => a.id === config[field.key])?.name || 'Selecione um agente de IA'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agentesIA.length === 0 ? (
                    <div className="px-4 py-2 text-gray-500">Nenhum agente de IA disponível</div>
                  ) : (
                    agentesIA.map(agente => (
                      <SelectItem key={agente.id} value={agente.id}>
                        {agente.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">
                Valor atual: "{config[field.key] || 'vazio'}"
                {config.agenteIaNome && ` - ${config.agenteIaNome}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Agentes de IA disponíveis: {agentesIA.length}
              </div>
            </div>
          );
        case 'horarios':
          return (
            <HorariosField
              value={config[field.key] || [{ horaInicio: '09:00', horaFim: '18:00' }]}
              onChange={(newHorarios) => updateConfig(field.key, newHorarios)}
            />
          );
        // Adicione outros tipos customizados conforme necessário
        default:
          return null;
      }
    });
  };

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja deletar este bloco?')) {
      if (onDelete) {
        onDelete(node.id);
        onClose();
      }
    }
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg">Configurar Bloco</h2>
        <div className="flex gap-1">
          {onDelete && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Deletar bloco"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
      </div>
      <div className="mb-4">
        <Label>Nome do Bloco *</Label>
        <Input value={label} onChange={e => setLabel(e.target.value)} required name="label" />
      </div>
      {renderDynamicFields()}
      <Button className="mt-4 w-full" type="button" onClick={handleSave} disabled={loading}>
        Salvar Configurações
      </Button>
      
      {onDelete && (
        <Button 
          variant="destructive" 
          className="mt-2 w-full" 
          type="button" 
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Deletar Bloco
        </Button>
      )}
      
      <div className="mt-6">
        <Label>Preview da Configuração:</Label>
        <pre className="bg-gray-100 rounded p-2 text-xs mt-2">{JSON.stringify({ label, ...config }, null, 2)}</pre>
      </div>
    </div>
  );
};
