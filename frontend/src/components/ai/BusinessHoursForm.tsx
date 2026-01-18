
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BusinessHours {
  [key: string]: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface BusinessHoursFormProps {
  hours: BusinessHours;
  onChange: (hours: BusinessHours) => void;
}

const daysOfWeek = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export const BusinessHoursForm: React.FC<BusinessHoursFormProps> = ({
  hours,
  onChange
}) => {
  const handleDayChange = (day: string, field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    const updatedHours = {
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value
      }
    };
    onChange(updatedHours);
  };

  return (
    <div className="space-y-3 rounded-lg border p-4 bg-gray-50/50">
      <div>
        <h4 className="text-sm">Horário de Funcionamento</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Defina os horários em que o assistente estará ativo.
        </p>
      </div>
      
      {daysOfWeek.map(({ key, label }) => (
        <div key={key} className="grid grid-cols-4 items-center gap-3">
          <Label className="col-span-1 text-sm">{label}</Label>
          <div className="col-span-3 flex items-center space-x-2">
            <Switch
              checked={hours[key]?.enabled || false}
              onCheckedChange={(checked) => handleDayChange(key, 'enabled', checked)}
              aria-label={`Ativar ${label}`}
            />
            <Input
              type="time"
              value={hours[key]?.start || '09:00'}
              onChange={(e) => handleDayChange(key, 'start', e.target.value)}
              disabled={!hours[key]?.enabled}
              className="w-20 h-8 text-sm"
            />
            <span className="text-xs text-gray-600">às</span>
            <Input
              type="time"
              value={hours[key]?.end || '18:00'}
              onChange={(e) => handleDayChange(key, 'end', e.target.value)}
              disabled={!hours[key]?.enabled}
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
};
