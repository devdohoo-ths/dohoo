import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Search, Filter, Grid3X3, List, Bot, Mic, Image, Settings, Trash2, Star, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAIAssistants } from '@/hooks/ai/useAIAssistants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuth } from '@/hooks/useAuth';
import { AIAssistant } from '@/types';
import { AIAssistantCard } from './AIAssistantCard';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { BusinessHoursConfig } from './BusinessHoursConfig';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ViewMode = 'cards' | 'list';

const AIAssistants = () => {
  console.log('=== AI ASSISTANTS PAGE RENDERIZADA ===');

  const {
    assistants,
    isLoading,
    createAssistant,
    updateAssistant,
    deleteAssistant,
    isUpdating
  } = useAIAssistants();

  const { toast } = useToast();
  const { user, profile } = useAuth();

  // Get user's organization
  const userOrganizationId = profile?.organization_id || '';

  // Verificar se agente já tem assistente
  const userRole = profile?.roles?.name || 'agent'; // Usar o nome do role da tabela roles
  const isAgent = userRole === 'Agente';
  const hasAssistant = assistants && assistants.length > 0;
  
  // Determinar se o botão deve estar desabilitado
  const isCreateButtonDisabled = isAgent && hasAssistant;

  // Debug: Log dos valores para verificar
  console.log('🔍 AI Assistants Debug:', {
    isAgent,
    userRole,
    assistantsCount: assistants?.length || 0,
    hasAssistant,
    isCreateButtonDisabled,
    profile: {
      id: profile?.id,
      role_id: profile?.role_id,
      role_name: profile?.roles?.name,
      organization_id: profile?.organization_id
    }
  });

  // Log adicional para debug do botão
  console.log('🔘 Botão Debug:', {
    isAgent,
    hasAssistant,
    isCreateButtonDisabled,
    assistants: assistants?.map(a => ({ id: a.id, name: a.name }))
  });

  // Mensagem do tooltip
  const getTooltipMessage = () => {
    if (isAgent && hasAssistant) {
      return "Como agente, você pode ter apenas um assistente de IA. Você já possui um assistente criado.";
    }
    return "";
  };

  // Mensagem de informação para agentes
  const getAgentInfoMessage = () => {
    if (isAgent) {
      if (hasAssistant) {
        return "Como agente, você pode ter apenas um assistente de IA. Aqui está o seu assistente pessoal.";
      } else {
        return "Como agente, você pode criar apenas um assistente de IA pessoal.";
      }
    }
    return "";
  };

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assistantToEdit, setAssistantToEdit] = useState<AIAssistant | null>(null);
  const [assistantToDelete, setAssistantToDelete] = useState<AIAssistant | null>(null);
  const [showDeactivateOption, setShowDeactivateOption] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personality: '',
    instructions: '',
    model: 'gpt-4o-mini',
    provider: 'openai',
    is_active: true,
    tags: [] as string[],
    organization_id: '',
    is_organizational: false,
    // Audio configuration
    audio_enabled: false,
    audio_transcription: false,
    audio_synthesis: false,
    audio_voice: 'alloy',
    audio_provider: 'elevenlabs',
    audio_model: 'eleven_multilingual_v2',
    // Image configuration
    image_enabled: false,
    image_provider: 'openai',
    image_model: 'dall-e-3',
    image_size: '1024x1024',
    // Business hours configuration
    business_hours: {
      monday: { enabled: true, start: '09:00', end: '18:00' },
      tuesday: { enabled: true, start: '09:00', end: '18:00' },
      wednesday: { enabled: true, start: '09:00', end: '18:00' },
      thursday: { enabled: true, start: '09:00', end: '18:00' },
      friday: { enabled: true, start: '09:00', end: '18:00' },
      saturday: { enabled: true, start: '09:00', end: '18:00' },
      sunday: { enabled: false, start: '09:00', end: '20:00' }
    }
  });

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [showFilters, setShowFilters] = useState(false);

  // Determinar o role do usuário usando a mesma lógica do useAIAssistants


  // Reset form when modal opens/closes
  useEffect(() => {
    if (!showCreateModal) {
      const newFormData = {
        name: '',
        description: '',
        personality: '',
        instructions: '',
        model: 'gpt-4o-mini',
        provider: 'openai',
        is_active: true,
        tags: [],
        organization_id: userOrganizationId,
        is_organizational: false,
        audio_enabled: false,
        audio_transcription: false,
        audio_synthesis: false,
        audio_voice: 'alloy',
        audio_provider: 'elevenlabs',
        audio_model: 'eleven_multilingual_v2',
        image_enabled: false,
        image_provider: 'openai',
        image_model: 'dall-e-3',
        image_size: '1024x1024',
        business_hours: {
          monday: { enabled: true, start: '09:00', end: '18:00' },
          tuesday: { enabled: true, start: '09:00', end: '18:00' },
          wednesday: { enabled: true, start: '09:00', end: '18:00' },
          thursday: { enabled: true, start: '09:00', end: '18:00' },
          friday: { enabled: true, start: '09:00', end: '18:00' },
          saturday: { enabled: true, start: '09:00', end: '18:00' },
          sunday: { enabled: false, start: '09:00', end: '20:00' }
        }
      };
      console.log('🔍 Debug - Reset formData.model:', newFormData.model);
      setFormData(newFormData);
      setAssistantToEdit(null);
    }
  }, [showCreateModal, userOrganizationId]);

  // Set form data when editing
  useEffect(() => {
    if (assistantToEdit) {
      setFormData({
        name: assistantToEdit.name,
        description: assistantToEdit.description || '',
        personality: assistantToEdit.personality || '',
        instructions: assistantToEdit.instructions,
        model: assistantToEdit.model,
        provider: assistantToEdit.provider,
        is_active: assistantToEdit.is_active,
        tags: assistantToEdit.tags || [],
        organization_id: assistantToEdit.organization_id || userOrganizationId,
        is_organizational: assistantToEdit.is_organizational || false,
        audio_enabled: assistantToEdit.audio_enabled || false,
        audio_transcription: assistantToEdit.audio_transcription || false,
        audio_synthesis: assistantToEdit.audio_synthesis || false,
        audio_voice: assistantToEdit.audio_voice || 'alloy',
        audio_provider: assistantToEdit.audio_provider || 'elevenlabs',
        audio_model: assistantToEdit.audio_model || 'eleven_multilingual_v2',
        image_enabled: assistantToEdit.image_enabled || false,
        image_provider: assistantToEdit.image_provider || 'openai',
        image_model: assistantToEdit.image_model || 'dall-e-3',
        image_size: assistantToEdit.image_size || '1024x1024',
        business_hours: assistantToEdit.business_hours || {
          monday: { enabled: true, start: '09:00', end: '18:00' },
          tuesday: { enabled: true, start: '09:00', end: '18:00' },
          wednesday: { enabled: true, start: '09:00', end: '18:00' },
          thursday: { enabled: true, start: '09:00', end: '18:00' },
          friday: { enabled: true, start: '09:00', end: '18:00' },
          saturday: { enabled: true, start: '09:00', end: '18:00' },
          sunday: { enabled: false, start: '09:00', end: '20:00' }
        }
      });
    }
  }, [assistantToEdit, userOrganizationId]);

  // Filtrar e buscar assistentes
  const filteredAssistants = useMemo(() => {
    let filtered = assistants || [];

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(assistant =>
        assistant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (assistant.description && assistant.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        assistant.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assistant.provider.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(assistant =>
        statusFilter === 'active' ? assistant.is_active : !assistant.is_active
      );
    }

    // Filtro por tipo (com base nas configurações de áudio/imagem)
    if (typeFilter !== 'all') {
      filtered = filtered.filter(assistant => {
        switch (typeFilter) {
          case 'audio':
            return assistant.audio_enabled;
          case 'image':
            return assistant.image_enabled;
          case 'text':
            return !assistant.audio_enabled && !assistant.image_enabled;
          default:
            return true;
        }
      });
    }

    // Filtro por propriedade (individual vs organizacional)
    if (ownershipFilter !== 'all') {
      filtered = filtered.filter(assistant => {
        if (!assistant.is_organizational) {
          return ownershipFilter === 'individual';
        } else {
          return ownershipFilter === 'organizational';
        }
      });
    }

    return filtered;
  }, [assistants, searchTerm, statusFilter, typeFilter, ownershipFilter]);

  // Paginação
  const totalPages = Math.ceil(filteredAssistants.length / itemsPerPage);
  const paginatedAssistants = filteredAssistants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Estatísticas
  const stats = useMemo(() => {
    const total = filteredAssistants.length;
    const active = filteredAssistants.filter(a => a.is_active).length;
    const audioEnabled = filteredAssistants.filter(a => a.audio_enabled).length;
    const imageEnabled = filteredAssistants.filter(a => a.image_enabled).length;
    const individual = filteredAssistants.filter(a => !a.is_organizational).length;
    const organizational = filteredAssistants.filter(a => a.is_organizational).length;

    return { total, active, audioEnabled, imageEnabled, individual, organizational };
  }, [filteredAssistants]);

  const exportData = () => {
    const csvContent = [
      ['Nome', 'Descrição', 'Provedor', 'Modelo', 'Status', 'Áudio', 'Imagem', 'Tags'],
      ...filteredAssistants.map(assistant => [
        assistant.name,
        assistant.description || '',
        assistant.provider,
        assistant.model,
        assistant.is_active ? 'Ativo' : 'Inativo',
        assistant.audio_enabled ? 'Sim' : 'Não',
        assistant.image_enabled ? 'Sim' : 'Não',
        (assistant.tags || []).join(', ')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assistentes-ia.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCreateAssistant = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    // Verificação adicional para agentes - bloquear criação se já tem assistente
    if (isAgent && hasAssistant) {
      toast({ 
        title: 'Limite Atingido', 
        description: 'Como agente, você pode ter apenas um assistente de IA. Você já possui um assistente criado.', 
        variant: 'destructive' 
      });
      return;
    }

    // Verificação adicional para agentes - forçar assistente individual
    if (isAgent && formData.is_organizational) {
      toast({ 
        title: 'Tipo Inválido', 
        description: 'Como agente, você só pode criar assistentes individuais.', 
        variant: 'destructive' 
      });
      return;
    }

    setCreateLoading(true);
    try {
      // Forçar assistente individual para agentes
      const isOrganizational = isAgent ? false : formData.is_organizational;
      
      await createAssistant({
        name: formData.name,
        description: formData.description,
        personality: formData.personality,
        instructions: formData.instructions,
        model: formData.model,
        provider: formData.provider,
        is_active: formData.is_active,
        tags: formData.tags,
        is_organizational: isOrganizational,
        organization_id: isOrganizational ? userOrganizationId : null,
        business_hours: formData.business_hours,
        audio_enabled: formData.audio_enabled,
        audio_transcription: formData.audio_transcription,
        audio_synthesis: formData.audio_synthesis,
        audio_voice: formData.audio_voice,
        audio_provider: formData.audio_provider,
        audio_model: formData.audio_model,
        image_enabled: formData.image_enabled,
        image_provider: formData.image_provider,
        image_model: formData.image_model,
        image_size: formData.image_size
      });
      
      setShowCreateModal(false);
    } catch (error: any) {
      console.error('Erro ao criar assistente:', error);
      // Verificar se é erro de agente já ter assistente
      if (error.message?.includes('já possui um assistente')) {
        toast({ 
          title: 'Limite Atingido', 
          description: 'Você já possui um assistente de IA. Cada agente pode ter apenas um assistente.', 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Erro', 
          description: error.message || 'Erro ao criar assistente', 
          variant: 'destructive' 
        });
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateAssistant = async () => {
    if (!assistantToEdit) return;

    setCreateLoading(true);
    try {
      // Preparar dados de atualização sem organization_id primeiro
      const updateData = {
        id: assistantToEdit.id,
        name: formData.name,
        description: formData.description,
        personality: formData.personality,
        instructions: formData.instructions,
        model: formData.model,
        provider: formData.provider,
        is_active: formData.is_active,
        tags: formData.tags,
        is_organizational: formData.is_organizational,
        business_hours: formData.business_hours,
        audio_enabled: formData.audio_enabled,
        audio_transcription: formData.audio_transcription,
        audio_synthesis: formData.audio_synthesis,
        audio_voice: formData.audio_voice,
        audio_provider: formData.audio_provider,
        audio_model: formData.audio_model,
        image_enabled: formData.image_enabled,
        image_provider: formData.image_provider,
        image_model: formData.image_model,
        image_size: formData.image_size
      };

      // Só incluir organization_id se o tipo de assistente estiver sendo alterado
      // O backend irá gerenciar o organization_id baseado na mudança de is_organizational
      const finalUpdateData: any = {
        ...updateData
      };

      await updateAssistant(finalUpdateData);
      
      setShowCreateModal(false);
    } catch (error) {
      console.error('Erro ao atualizar assistente:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = (assistant: AIAssistant) => {
    setAssistantToEdit(assistant);
    setShowCreateModal(true);
  };

  const handleDelete = (assistant: AIAssistant) => {
    console.log('🔍 handleDelete chamado com assistant:', assistant);
    console.log('🔍 ID do assistant:', assistant.id);
    setAssistantToDelete(assistant);
    setShowDeleteModal(true);
  };

  const handleDeleteById = (id: string) => {
    console.log('🔍 handleDeleteById chamado com ID:', id);
    const assistant = assistants?.find(a => a.id === id);
    if (assistant) {
      console.log('🔍 Assistente encontrado:', assistant);
      handleDelete(assistant);
    } else {
      console.error('❌ Assistente não encontrado com ID:', id);
    }
  };

  const handleConfirmDelete = async () => {
    if (!assistantToDelete) {
      console.error('❌ assistantToDelete é null');
      return;
    }

    console.log('🔍 Tentando deletar assistente:', {
      id: assistantToDelete.id,
      name: assistantToDelete.name,
      assistantToDelete: assistantToDelete
    });

    console.log('🔍 assistantToDelete.id type:', typeof assistantToDelete.id);
    console.log('🔍 assistantToDelete.id value:', assistantToDelete.id);

    if (!assistantToDelete.id) {
      console.error('❌ assistantToDelete.id é null/undefined');
      return;
    }

    try {
      await deleteAssistant(assistantToDelete.id);
      toast({
        title: 'Sucesso',
        description: 'Assistente deletado com sucesso!',
        variant: 'default'
      });
      setShowDeleteModal(false);
      setAssistantToDelete(null);
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao excluir assistente';
      const errorCode = error.code;
      
      // Se o erro for sobre histórico de uso, mostrar opção de desativar
      if (errorCode === 'HAS_USAGE_HISTORY' || errorMessage.includes('histórico de uso') || errorMessage.includes('dados de treinamento') || errorMessage.includes('base de conhecimento')) {
        // Fechar modal de delete e mostrar opção de desativar
        setShowDeleteModal(false);
        setShowDeactivateOption(true);
        toast({
          title: 'Não é possível deletar',
          description: errorMessage,
          variant: 'destructive',
          duration: 8000
        });
      } else {
        // Outros erros
        toast({
          title: 'Erro',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  };

  const handleToggleActive = async (assistant: AIAssistant) => {
    try {
      await updateAssistant({
        id: assistant.id,
        is_active: !assistant.is_active
      });
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  const handleTagChange = (value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData(prev => ({ ...prev, tags }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between"> 
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Assistentes de IA</h1>
          <p className="text-gray-600 mt-2">Gerencie seus assistentes de inteligência artificial personalizados</p>
          {isAgent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
              <p className="text-blue-800 text-sm">
                <strong>Informação para Agentes:</strong> {getAgentInfoMessage()}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          
          {/* Botão Novo Assistente com lógica condicional */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Button 
                    disabled={isCreateButtonDisabled}
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Assistente
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getTooltipMessage()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Dialog separado do botão */}
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogContent className="max-w-5xl h-[85vh] overflow-hidden flex flex-col">
                      <DialogHeader className="pb-4 border-b">
                        <DialogTitle className="text-xl">
                          {assistantToEdit ? 'Editar Assistente' : 'Criar Novo Assistente'}
                        </DialogTitle>
                      </DialogHeader>

                      <Tabs defaultValue="config" className="w-full flex-1 flex flex-col min-h-0">
                        <TabsList className="flex w-full bg-gray-50 border-b rounded-none p-1 mt-0">
                          <TabsTrigger 
                            value="config" 
                            className="flex-1 text-sm px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Configurações
                          </TabsTrigger>
                          <TabsTrigger 
                            value="knowledge" 
                            className="flex-1 text-sm px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md"
                          >
                            <Bot className="w-4 h-4 mr-2" />
                            Base de Conhecimento
                          </TabsTrigger>
                          <TabsTrigger 
                            value="business-hours" 
                            className="flex-1 text-sm px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md"
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Horário de Funcionamento
                          </TabsTrigger>
                          <TabsTrigger 
                            value="audio" 
                            className="flex-1 text-sm px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md"
                          >
                            <Mic className="w-4 h-4 mr-2" />
                            Processamento de Áudio
                          </TabsTrigger>
                          <TabsTrigger 
                            value="image" 
                            className="flex-1 text-sm px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md"
                          >
                            <Image className="w-4 h-4 mr-2" />
                            Processamento de Imagem
                          </TabsTrigger>
                        </TabsList>
                        
                        <div className="flex-1 overflow-y-auto p-6 min-h-0">
                          <TabsContent value="config" className="space-y-4 mt-0">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="name" className="text-sm">Nome *</Label>
                                <Input
                                  id="name"
                                  value={formData.name}
                                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="Nome do assistente"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="provider" className="text-sm">Provedor</Label>
                                <Select value={formData.provider} onValueChange={(value) => setFormData(prev => ({ ...prev, provider: value }))}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                    <SelectItem value="anthropic">Anthropic</SelectItem>
                                    <SelectItem value="google">Google</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="organization" className="text-sm">Organização</Label>
                              <Input
                                id="organization"
                                value={profile?.organization_name || 'Sua Organização'}
                                disabled
                                className="mt-1 bg-gray-50"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Assistente será criado para esta organização
                              </p>
                            </div>

                            <div>
                              <Label htmlFor="is_organizational" className="text-sm">Tipo de Assistente</Label>
                              {console.log('🔍 Debug - isAgent:', isAgent, 'userRole:', userRole)}
                              {isAgent ? (
                                <div className="mt-1">
                                  <Input
                                    value="Individual (1:1)"
                                    disabled
                                    className="bg-gray-50"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Como agente, você só pode criar assistentes individuais
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <Select 
                                    value={formData.is_organizational ? 'organizational' : 'individual'} 
                                    onValueChange={(value: 'individual' | 'organizational') => setFormData(prev => ({ ...prev, is_organizational: value === 'organizational' }))}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="individual">Individual (1:1)</SelectItem>
                                      <SelectItem value="organizational">Organizacional</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {!formData.is_organizational 
                                      ? 'Assistente pessoal - apenas você pode gerenciar' 
                                      : 'Assistente da organização - administradores podem gerenciar'
                                    }
                                  </p>
                                </>
                              )}
                            </div>

                            <div>
                              <Label htmlFor="description" className="text-sm">Descrição</Label>
                              <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Descrição do assistente"
                                rows={3}
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label htmlFor="personality" className="text-sm">Personalidade</Label>
                              <Textarea
                                id="personality"
                                value={formData.personality}
                                onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value }))}
                                placeholder="Personalidade do assistente"
                                rows={3}
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label htmlFor="instructions" className="text-sm">Instruções</Label>
                              <Textarea
                                id="instructions"
                                value={formData.instructions}
                                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                                placeholder="Instruções para o assistente"
                                rows={5}
                                className="mt-1"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="model" className="text-sm">Modelo</Label>
                                {console.log('🔍 Debug - formData.model no Select:', formData.model)}
                                <Select value={formData.model} onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione o modelo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                    <SelectItem value="claude-3">Claude 3</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="tags" className="text-sm">Tags</Label>
                                <Input
                                  id="tags"
                                  value={formData.tags.join(', ')}
                                  onChange={(e) => handleTagChange(e.target.value)}
                                  placeholder="tag1, tag2, tag3"
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                              <Switch
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                              />
                              <Label htmlFor="is_active" className="text-sm">Assistente ativo</Label>
                            </div>
                          </TabsContent>

                          <TabsContent value="knowledge" className="space-y-4 mt-0">
                            <div className="text-center py-12 text-gray-500">
                              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                              <p>Base de conhecimento será implementada em breve</p>
                            </div>
                          </TabsContent>

                          <TabsContent value="business-hours" className="space-y-4 mt-0">
                            <BusinessHoursConfig
                              businessHours={formData.business_hours}
                              onChange={(businessHours) => setFormData(prev => ({ ...prev, business_hours: businessHours }))}
                            />
                          </TabsContent>

                          <TabsContent value="audio" className="space-y-4 mt-0">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="audio_enabled"
                                checked={formData.audio_enabled}
                                onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, audio_enabled: checked }))}
                              />
                              <Label htmlFor="audio_enabled" className="text-sm">Habilitar processamento de áudio</Label>
                            </div>

                            {formData.audio_enabled && (
                              <>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      id="audio_transcription"
                                      checked={formData.audio_transcription}
                                      onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, audio_transcription: checked }))}
                                    />
                                    <Label htmlFor="audio_transcription" className="text-sm">Transcrição de áudio</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      id="audio_synthesis"
                                      checked={formData.audio_synthesis}
                                      onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, audio_synthesis: checked }))}
                                    />
                                    <Label htmlFor="audio_synthesis" className="text-sm">Síntese de áudio</Label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="audio_provider" className="text-sm">Provedor de Áudio</Label>
                                    <Select value={formData.audio_provider} onValueChange={(value) => setFormData(prev => ({ ...prev, audio_provider: value }))}>
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="audio_voice" className="text-sm">Voz</Label>
                                    <Select value={formData.audio_voice} onValueChange={(value) => setFormData(prev => ({ ...prev, audio_voice: value }))}>
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="alloy">Alloy</SelectItem>
                                        <SelectItem value="echo">Echo</SelectItem>
                                        <SelectItem value="fable">Fable</SelectItem>
                                        <SelectItem value="onyx">Onyx</SelectItem>
                                        <SelectItem value="nova">Nova</SelectItem>
                                        <SelectItem value="shimmer">Shimmer</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div>
                                  <Label htmlFor="audio_model" className="text-sm">Modelo de Áudio</Label>
                                  <Select value={formData.audio_model} onValueChange={(value) => setFormData(prev => ({ ...prev, audio_model: value }))}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
                                      <SelectItem value="eleven_turbo_v2">Eleven Turbo v2</SelectItem>
                                      <SelectItem value="tts-1">OpenAI TTS-1</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}
                          </TabsContent>

                          <TabsContent value="image" className="space-y-4 mt-0">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="image_enabled"
                                checked={formData.image_enabled}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, image_enabled: checked }))}
                              />
                              <Label htmlFor="image_enabled" className="text-sm">Habilitar processamento de imagem</Label>
                            </div>

                            {formData.image_enabled && (
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <Label htmlFor="image_provider" className="text-sm">Provedor de Imagem</Label>
                                  <Select value={formData.image_provider} onValueChange={(value) => setFormData(prev => ({ ...prev, image_provider: value }))}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="openai">OpenAI</SelectItem>
                                      <SelectItem value="anthropic">Anthropic</SelectItem>
                                      <SelectItem value="google">Google</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="image_model" className="text-sm">Modelo de Imagem</Label>
                                  <Select value={formData.image_model} onValueChange={(value) => setFormData(prev => ({ ...prev, image_model: value }))}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                                      <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                                      <SelectItem value="claude-3">Claude 3</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="image_size" className="text-sm">Tamanho</Label>
                                  <Select value={formData.image_size} onValueChange={(value) => setFormData(prev => ({ ...prev, image_size: value }))}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1024x1024">1024x1024</SelectItem>
                                      <SelectItem value="1792x1024">1792x1024</SelectItem>
                                      <SelectItem value="1024x1792">1024x1792</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </TabsContent>
                        </div>
                      </Tabs>

                      <div className="flex justify-end gap-3 pt-4 flex-shrink-0 border-t bg-white">
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                          Cancelar
                        </Button>
                        <Button
                          onClick={assistantToEdit ? handleUpdateAssistant : handleCreateAssistant}
                          disabled={createLoading}
                        >
                          {createLoading ? 'Salvando...' : (assistantToEdit ? 'Atualizar' : 'Criar')}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Ativos</CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Com Áudio</CardTitle>
            <Mic className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.audioEnabled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Com Imagem</CardTitle>
            <Image className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.imageEnabled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Individual</CardTitle>
            <div className="h-4 w-4 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.individual}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Organizacional</CardTitle>
            <div className="h-4 w-4 rounded-full bg-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.organizational}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <Grid3X3 className="w-4 h-4 mr-1" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-1" />
            Lista
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nome, descrição ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="text">Apenas Texto</SelectItem>
                  <SelectItem value="audio">Com Áudio</SelectItem>
                  <SelectItem value="image">Com Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Propriedade</Label>
              <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="organizational">Organizacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando assistentes...</p>
          </div>
        </div>
      ) : filteredAssistants.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg text-gray-900 mb-2">Nenhum assistente encontrado</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || ownershipFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : isAgent 
                ? 'Crie seu assistente de IA pessoal'
                : 'Crie seu primeiro assistente de IA'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && ownershipFilter === 'all' && !isCreateButtonDisabled && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Assistente
            </Button>
          )}
          {isAgent && !hasAssistant && !searchTerm && statusFilter === 'all' && typeFilter === 'all' && ownershipFilter === 'all' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 max-w-md mx-auto">
              <p className="text-blue-800 text-sm">
                <strong>Informação para Agentes:</strong> Como agente, você pode criar apenas um assistente de IA pessoal. 
                Este será o seu assistente exclusivo para uso individual.
              </p>
            </div>
          )}
          {isCreateButtonDisabled && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 max-w-md mx-auto">
              <p className="text-blue-800 text-sm">
                <strong>Limite Atingido:</strong> Como agente, você pode ter apenas um assistente de IA. 
                Você já possui um assistente criado.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedAssistants.map((assistant) => (
                <AIAssistantCard
                  key={assistant.id}
                  assistant={assistant}
                  onEdit={handleEdit}
                  onDelete={handleDeleteById}
                  onToggleActive={handleToggleActive}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">
                        Assistente
                      </th>
                      <th className="px-6 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">
                        Provedor/Modelo
                      </th>
                      <th className="px-6 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">
                        Recursos
                      </th>
                      <th className="px-6 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedAssistants.map((assistant) => (
                      <tr key={assistant.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm text-gray-900">{assistant.name}</div>
                            <div className="text-sm text-gray-500">{assistant.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{assistant.provider}</div>
                          <div className="text-sm text-gray-500">{assistant.model}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={assistant.is_active ? 'default' : 'secondary'}>
                            {assistant.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {assistant.audio_enabled && (
                              <Badge variant="outline" className="text-xs">
                                <Mic className="w-3 h-3 mr-1" />
                                Áudio
                              </Badge>
                            )}
                            {assistant.image_enabled && (
                              <Badge variant="outline" className="text-xs">
                                <Image className="w-3 h-3 mr-1" />
                                Imagem
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(assistant)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteById(assistant.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a{' '}
                {Math.min(currentPage * itemsPerPage, filteredAssistants.length)} de{' '}
                {filteredAssistants.length} assistentes
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-700">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Tem certeza que deseja excluir o assistente{' '}
              <strong>{assistantToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate Option Modal */}
      <Dialog open={showDeactivateOption} onOpenChange={setShowDeactivateOption}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Não é possível deletar</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700 mb-4">
              Este assistente possui histórico de uso, dados de treinamento ou base de conhecimento associados.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Em vez de deletar, você pode desativar o assistente. Ele não será mais usado, mas os dados históricos serão preservados.
            </p>
            {assistantToDelete && (
              <p className="text-sm font-medium">
                Assistente: <strong>{assistantToDelete.name}</strong>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setShowDeactivateOption(false);
              setAssistantToDelete(null);
            }}>
              Cancelar
            </Button>
            {assistantToDelete && !assistantToDelete.is_active ? (
              <Button variant="outline" disabled>
                Já está desativado
              </Button>
            ) : (
              <Button 
                variant="default" 
                onClick={async () => {
                  if (!assistantToDelete) return;
                  try {
                    await updateAssistant({
                      id: assistantToDelete.id,
                      is_active: false
                    });
                    toast({
                      title: 'Sucesso',
                      description: 'Assistente desativado com sucesso!',
                      variant: 'default'
                    });
                    setShowDeactivateOption(false);
                    setAssistantToDelete(null);
                  } catch (deactivateError: any) {
                    toast({
                      title: 'Erro',
                      description: deactivateError.message || 'Erro ao desativar assistente',
                      variant: 'destructive'
                    });
                  }
                }}
              >
                Desativar Assistente
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIAssistants; 