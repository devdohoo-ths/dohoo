import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Pause, Play, Clock, Coffee, Utensils, Phone, Wrench, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface PauseMenuProps {
  isPaused: boolean;
  pauseReason: string;
  pauseStartTime: Date | null;
  onPause: (reason: string, duration?: number) => void;
  onResume: () => void;
}

interface PauseType {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  duration_minutes: number;
  requires_justification: boolean;
  max_uses_per_day?: number;
  is_active: boolean;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isPaused,
  pauseReason,
  pauseStartTime,
  onPause,
  onResume
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pauseTypes, setPauseTypes] = useState<PauseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPauseId, setSelectedPauseId] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customDuration, setCustomDuration] = useState<number>(15);
  const [justification, setJustification] = useState<string>('');
  const [open, setOpen] = useState(false);

  // Buscar tipos de pausas do banco
  useEffect(() => {
    const fetchPauseTypes = async () => {
      try {
        const token = user?.token || user?.access_token;
        if (!token) return;

        const response = await fetch(`${API_URL}/api/pauses/types`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPauseTypes(data.pauseTypes || []);
        }
      } catch (error) {
        console.error('Erro ao buscar tipos de pausas:', error);
      } finally {
        setLoading(false);
      }
    };

    if (open && user) {
      fetchPauseTypes();
    }
  }, [open, user]);

  // Helper para pegar o componente de ícone
  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      'Clock': Clock,
      'Coffee': Coffee,
      'Utensils': Utensils,
      'Phone': Phone,
      'Wrench': Wrench,
      'Users': Users
    };
    return icons[iconName] || Clock;
  };

  const handlePause = () => {
    if (!selectedPauseId) {
      toast({
        title: "Selecione uma pausa",
        description: "Por favor, selecione o tipo de pausa",
        variant: "destructive"
      });
      return;
    }

    // Se for pausa customizada
    if (selectedPauseId === 'custom') {
      if (!customName.trim()) {
        toast({
          title: "Nome obrigatório",
          description: "Por favor, informe o nome da pausa personalizada",
          variant: "destructive"
        });
        return;
      }
      
      onPause(customName.trim(), customDuration);
      
      // Limpar formulário e fechar
      setSelectedPauseId('');
      setCustomName('');
      setCustomDuration(15);
      setJustification('');
      setOpen(false);
      return;
    }

    // Pausa normal do banco
    const selectedPause = pauseTypes.find(p => p.id === selectedPauseId);
    if (!selectedPause) return;

    // Verificar se requer justificativa
    if (selectedPause.requires_justification && !justification.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "Este tipo de pausa requer uma justificativa",
        variant: "destructive"
      });
      return;
    }

    // Passar o nome da pausa e a duração
    onPause(selectedPause.name, selectedPause.duration_minutes);
    
    // Limpar formulário e fechar
    setSelectedPauseId('');
    setCustomName('');
    setCustomDuration(15);
    setJustification('');
    setOpen(false);
  };

  return (
    <>
      {!isPaused ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
              title="Pausar"
            >
              <Pause className="w-3.5 h-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Selecionar Pausa</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Carregando pausas...</p>
                </div>
              ) : pauseTypes.length === 0 ? (
                <div className="text-center py-4">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Nenhum tipo de pausa disponível</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pause-type">Tipo de Pausa</Label>
                    <Select value={selectedPauseId} onValueChange={setSelectedPauseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de pausa" />
                      </SelectTrigger>
                      <SelectContent>
                        {pauseTypes.map((pauseType) => {
                          const IconComponent = getIconComponent(pauseType.icon);
                          return (
                            <SelectItem key={pauseType.id} value={pauseType.id}>
                              <div className="flex items-center space-x-2">
                                <IconComponent className="w-4 h-4" />
                                <span>{pauseType.name}</span>
                                <span className="text-sm text-gray-500">
                                  ({pauseType.duration_minutes}min)
                                </span>
                                {pauseType.max_uses_per_day && (
                                  <span className="text-xs text-orange-500">
                                    Máx. {pauseType.max_uses_per_day}x/dia
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                        {/* Opção Personalizada */}
                        <SelectItem value="custom">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>Personalizada</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedPauseId && selectedPauseId !== 'custom' && pauseTypes.find(p => p.id === selectedPauseId)?.description && (
                      <p className="text-xs text-gray-500">
                        {pauseTypes.find(p => p.id === selectedPauseId)?.description}
                      </p>
                    )}
                  </div>

                  {/* Campos para pausa personalizada */}
                  {selectedPauseId === 'custom' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="custom-name">Nome da Pausa *</Label>
                        <Input
                          id="custom-name"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="Ex: Reunião com cliente"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="custom-duration">Duração (minutos) *</Label>
                        <Input
                          id="custom-duration"
                          type="number"
                          value={customDuration}
                          onChange={(e) => setCustomDuration(Number(e.target.value))}
                          min="1"
                          max="480"
                        />
                      </div>
                    </>
                  )}

                  {/* Justificativa (se necessário para pausas normais) */}
                  {selectedPauseId && selectedPauseId !== 'custom' && pauseTypes.find(p => p.id === selectedPauseId)?.requires_justification && (
                    <div className="space-y-2">
                      <Label htmlFor="justification">
                        Justificativa *
                        <span className="text-xs text-gray-500 ml-1">(obrigatório)</span>
                      </Label>
                      <Textarea
                        id="justification"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="Descreva o motivo da pausa..."
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button 
                      onClick={handlePause} 
                      disabled={!selectedPauseId} 
                      className="flex-1"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Iniciar Pausa
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setOpen(false);
                      setSelectedPauseId('');
                      setCustomName('');
                      setCustomDuration(15);
                      setJustification('');
                    }}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onResume}
          className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
          title="Retomar"
        >
          <Play className="w-3.5 h-3.5" />
        </Button>
      )}
    </>
  );
};
