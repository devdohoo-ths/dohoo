
import React from 'react';
import { Bot, Edit, Pause, Play, Star, Trash2, Mic, Image } from 'lucide-react';
import { AIAssistant } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface AIAssistantCardProps {
  assistant: AIAssistant;
  onEdit: (assistant: AIAssistant) => void;
  onDelete: (id: string) => void;
  onToggleActive: (assistant: AIAssistant) => void;
  isUpdating: boolean;
}

export const AIAssistantCard: React.FC<AIAssistantCardProps> = ({ assistant, onEdit, onDelete, onToggleActive, isUpdating }) => {
  const performance = assistant.performance || { totalInteractions: 0, averageRating: 0, responseTime: 0 };
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white">
              <Bot size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">{assistant.name}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant={assistant.is_active ? 'default' : 'secondary'}>
                  {assistant.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {!assistant.is_organizational ? 'Individual' : 'Organizacional'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {assistant.provider} • {assistant.model}
                </span>
              </div>
            </div>
          </div>
          <Switch
            checked={assistant.is_active}
            onCheckedChange={() => onToggleActive(assistant)}
            disabled={isUpdating}
            aria-label="Toggle assistant status"
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground min-h-[2.5rem]">{assistant.description}</p>
        
        {/* Additional Info */}
        <div className="space-y-2 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Modelo:</span>
            <span className="">{assistant.model}</span>
          </div>
          <div className="flex justify-between">
            <span>Provedor:</span>
            <span className="">{assistant.provider}</span>
          </div>
          <div className="flex justify-between">
            <span>Criado:</span>
            <span className="">
              {new Date(assistant.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
        
        {assistant.tags && assistant.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assistant.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Audio and Image Configuration Status - Always render to maintain alignment */}
        <div className="flex items-center gap-2 min-h-[1.5rem]">
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
          {/* Invisible spacer to maintain consistent height when no badges are shown */}
          {!assistant.audio_enabled && !assistant.image_enabled && (
            <div className="h-5"></div>
          )}
        </div>

        <div className="flex space-x-2 pt-2 border-t mt-auto">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(assistant)}>
            <Edit size={14} className="mr-1" />
            Editar
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={() => onDelete(assistant.id)}>
            <Trash2 size={14} className="mr-1" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
