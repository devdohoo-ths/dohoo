import { PlusCircle, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Horario {
  horaInicio: string;
  horaFim: string;
}

interface HorariosFieldProps {
  value: Horario[];
  onChange: (value: Horario[]) => void;
}

export const HorariosField = ({ value = [], onChange }: HorariosFieldProps) => {

  const handleAddHorario = () => {
    onChange([...value, { horaInicio: '09:00', horaFim: '18:00' }]);
  };

  const handleRemoveHorario = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleHorarioChange = (index: number, field: keyof Horario, fieldValue: string) => {
    onChange(value.map((horario, i) => (i === index ? { ...horario, [field]: fieldValue } : horario)));
  };

  return (
    <div className="space-y-4">
      <Label>Intervalos de Atendimento</Label>
      {value.map((horario, index) => (
        <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50">
          <Clock className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <Label htmlFor={`horaInicio-${index}`} className="text-xs text-gray-600">Início</Label>
            <Input
              id={`horaInicio-${index}`}
              type="time"
              value={horario.horaInicio}
              onChange={(e) => handleHorarioChange(index, 'horaInicio', e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={`horaFim-${index}`} className="text-xs text-gray-600">Fim</Label>
            <Input
              id={`horaFim-${index}`}
              type="time"
              value={horario.horaFim}
              onChange={(e) => handleHorarioChange(index, 'horaFim', e.target.value)}
              className="w-full"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveHorario(index)}
            className="text-red-500 hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddHorario}
        className="w-full flex items-center gap-2"
      >
        <PlusCircle className="w-4 h-4" />
        Adicionar Intervalo
      </Button>
    </div>
  );
}; 