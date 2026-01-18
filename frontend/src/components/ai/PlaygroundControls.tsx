
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AIAssistant } from '@/types';

interface PlaygroundControlsProps {
  assistants: AIAssistant[];
  selectedAssistant: string | null;
  setSelectedAssistant: (value: string | null) => void;
}

const PlaygroundControls: React.FC<PlaygroundControlsProps> = ({
  assistants,
  selectedAssistant,
  setSelectedAssistant,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Controle do Playground</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm mb-2 block">Contexto (Assistente)</label>
            <Select
              value={selectedAssistant || ''}
              onValueChange={(value) => setSelectedAssistant(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum (padrão)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (padrão)</SelectItem>
                {assistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.id}>
                    {assistant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Selecione um assistente para fornecer contexto ao chat. O modelo do assistente será usado.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaygroundControls;
