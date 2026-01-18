import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Coffee,
  Utensils,
  Phone,
  Wrench,
  Users,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface PauseType {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  duration_minutes: number;
  is_active: boolean;
  requires_justification: boolean;
  max_uses_per_day?: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
  pauseTypes: string[]; // IDs dos tipos de pausa
}

export default function PauseManagement() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [pauseTypes, setPauseTypes] = useState<PauseType[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPause, setEditingPause] = useState<PauseType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: 15,
    icon: 'Clock',
    color: 'blue',
    requires_justification: false,
    max_uses_per_day: undefined as number | undefined
  });

  const iconOptions = [
    { value: 'Clock', label: 'Relógio', icon: Clock, color: 'gray' },
    { value: 'Coffee', label: 'Café', icon: Coffee, color: 'orange' },
    { value: 'Utensils', label: 'Almoço', icon: Utensils, color: 'green' },
    { value: 'Phone', label: 'Telefone', icon: Phone, color: 'blue' },
    { value: 'Wrench', label: 'Técnico', icon: Wrench, color: 'red' },
    { value: 'Users', label: 'Reunião', icon: Users, color: 'indigo' }
  ];

  // Helper para pegar o token de autenticação
  const getAuthToken = () => {
    return user?.token || user?.access_token;
  };

  // Carregar dados
  useEffect(() => {
    if (user && profile) {
    loadData();
    }
  }, [user, profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();

      if (!token) {
        console.error('❌ Token não encontrado. User:', user, 'Profile:', profile);
        toast({
          title: "Erro de autenticação",
          description: "Não foi possível obter o token de autenticação. Tente fazer login novamente.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      console.log('✅ Token encontrado, carregando dados de pausas...');

      // Buscar tipos de pausas
      const response = await fetch(`${API_URL}/api/pauses/types`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar tipos de pausas');
      }

      const data = await response.json();
      setPauseTypes(data.pauseTypes || []);

      // Buscar times (opcional)
      try {
        const teamsResponse = await fetch(`${API_URL}/api/teams`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          setTeams(teamsData.teams || []);
        }
      } catch (error) {
        console.error('Erro ao carregar times:', error);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os tipos de pausas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePause = async () => {
    setSubmitting(true);
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Não autenticado');

      const response = await fetch(`${API_URL}/api/pauses/types`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar tipo de pausa');
      }

      const data = await response.json();
      
      toast({
        title: "Sucesso!",
        description: "Tipo de pausa criado com sucesso"
      });

      await loadData();
      resetForm();
    setShowCreateModal(false);
    } catch (error: any) {
      console.error('Erro ao criar pausa:', error);
      toast({
        title: "Erro ao criar pausa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPause = (pause: PauseType) => {
    setEditingPause(pause);
    setFormData({
      name: pause.name,
      description: pause.description || '',
      duration_minutes: pause.duration_minutes,
      icon: pause.icon,
      color: pause.color,
      requires_justification: pause.requires_justification,
      max_uses_per_day: pause.max_uses_per_day
    });
    setShowCreateModal(true);
  };

  const handleUpdatePause = async () => {
    if (!editingPause) return;

    setSubmitting(true);
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Não autenticado');

      const response = await fetch(`${API_URL}/api/pauses/types/${editingPause.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar tipo de pausa');
      }

      toast({
        title: "Sucesso!",
        description: "Tipo de pausa atualizado com sucesso"
      });

      await loadData();
      resetForm();
    setShowCreateModal(false);
    } catch (error: any) {
      console.error('Erro ao atualizar pausa:', error);
      toast({
        title: "Erro ao atualizar pausa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePause = async (pauseId: string, pauseName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o tipo de pausa "${pauseName}"?`)) {
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Não autenticado');

      const response = await fetch(`${API_URL}/api/pauses/types/${pauseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir tipo de pausa');
      }

      toast({
        title: "Sucesso!",
        description: "Tipo de pausa excluído com sucesso"
      });

      await loadData();
    } catch (error: any) {
      console.error('Erro ao excluir pausa:', error);
      toast({
        title: "Erro ao excluir pausa",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const togglePauseStatus = async (pauseId: string) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Não autenticado');

      const pause = pauseTypes.find(p => p.id === pauseId);
      if (!pause) return;

      const response = await fetch(`${API_URL}/api/pauses/types/${pauseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !pause.is_active })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar status');
      }

      toast({
        title: "Sucesso!",
        description: `Tipo de pausa ${!pause.is_active ? 'ativado' : 'desativado'} com sucesso`
      });

      await loadData();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration_minutes: 15,
      icon: 'Clock',
      color: 'blue',
      requires_justification: false,
      max_uses_per_day: undefined
    });
    setEditingPause(null);
  };

  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find(option => option.value === iconName);
    return iconOption ? iconOption.icon : Clock;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl flex items-center gap-3">
          <Clock className="w-8 h-8 text-purple-600" />
          Gestão de Pausas
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure tipos de pausas personalizadas para os times
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm">Total de Pausas</p>
                <p className="text-2xl text-blue-500">{pauseTypes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm">Times Ativos</p>
                <p className="text-2xl text-green-500">{teams.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm">Pausas Ativas</p>
                <p className="text-2xl text-orange-500">
                  {pauseTypes.filter(p => p.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl">Tipos de Pausa</h2>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Pausa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingPause ? 'Editar Pausa' : 'Nova Pausa'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Pausa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Café, Almoço, Telefone..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional da pausa..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (minutos) *</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                  min="1"
                  max="480"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon">Ícone</Label>
                <Select value={formData.icon} onValueChange={(value) => {
                  const selected = iconOptions.find(opt => opt.value === value);
                  setFormData({ ...formData, icon: value, color: selected?.color || 'blue' });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <option.icon className="w-4 h-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_uses">Limite de usos por dia (opcional)</Label>
                <Input
                  id="max_uses"
                  type="number"
                  value={formData.max_uses_per_day || ''}
                  onChange={(e) => setFormData({ ...formData, max_uses_per_day: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Deixe vazio para ilimitado"
                  min="1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requires_justification"
                  checked={formData.requires_justification}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_justification: checked as boolean })}
                />
                <Label htmlFor="requires_justification" className="cursor-pointer">
                  Requer justificativa ao usar
                </Label>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  onClick={editingPause ? handleUpdatePause : handleCreatePause}
                  disabled={!formData.name.trim() || submitting}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {submitting ? 'Salvando...' : (editingPause ? 'Atualizar' : 'Criar')}
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }} disabled={submitting}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Pausas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pauseTypes.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum tipo de pausa cadastrado</p>
            <p className="text-sm text-gray-500 mt-2">Clique em "Nova Pausa" para começar</p>
          </div>
        ) : (
          pauseTypes.map((pause) => {
          const IconComponent = getIconComponent(pause.icon);
          return (
              <Card key={pause.id} className={!pause.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="w-5 h-5 text-purple-600" />
                      <div>
                    <h3 className="">{pause.name}</h3>
                        {pause.is_system && (
                          <Badge variant="outline" className="text-xs mt-1">Sistema</Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant={pause.is_active ? 'default' : 'secondary'}>
                      {pause.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  
                  {pause.description && (
                    <p className="text-xs text-gray-600 mb-2">{pause.description}</p>
                  )}
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                      <span>{formatDuration(pause.duration_minutes)}</span>
                  </div>
                  
                    {pause.max_uses_per_day && (
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <AlertCircle className="w-3 h-3" />
                        <span>Máx. {pause.max_uses_per_day}x/dia</span>
                      </div>
                    )}

                    {pause.requires_justification && (
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <AlertCircle className="w-3 h-3" />
                        <span>Requer justificativa</span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-1 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPause(pause)}
                        disabled={pause.is_system}
                    >
                        <Edit className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePauseStatus(pause.id)}
                    >
                        {pause.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                      {!pause.is_system && (
                    <Button
                      variant="outline"
                      size="sm"
                          onClick={() => handleDeletePause(pause.id, pause.name)}
                      className="text-red-600 hover:text-red-700"
                    >
                          <Trash2 className="w-3 h-3" />
                    </Button>
                      )}
                    </div>
                </div>
              </CardContent>
            </Card>
          );
          })
        )}
      </div>

      {/* Atribuição de Pausas aos Times */}
      <div className="mt-8">
        <h2 className="text-xl mb-4">Atribuição de Pausas aos Times</h2>
        <div className="space-y-4">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <h3 className="">{team.name}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {team.pauseTypes.length} pausas atribuídas
                    </span>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      Gerenciar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
