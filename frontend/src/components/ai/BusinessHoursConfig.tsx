import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock } from 'lucide-react';

interface BusinessHours {
  [key: string]: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface BusinessHoursConfigProps {
  businessHours: BusinessHours;
  onChange: (businessHours: BusinessHours) => void;
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

export const BusinessHoursConfig: React.FC<BusinessHoursConfigProps> = ({
  businessHours,
  onChange
}) => {
  const getDayConfig = (day: string) => {
    return businessHours[day] || { enabled: false, start: '09:00', end: '18:00' };
  };

  const handleDayChange = (day: string, enabled: boolean) => {
    const updatedHours = {
      ...businessHours,
      [day]: {
        ...getDayConfig(day),
        enabled
      }
    };
    onChange(updatedHours);
  };

  const handleTimeChange = (day: string, field: 'start' | 'end', value: string) => {
    const updatedHours = {
      ...businessHours,
      [day]: {
        ...getDayConfig(day),
        [field]: value
      }
    };
    onChange(updatedHours);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg mb-2">Horário de Funcionamento</h3>
        <p className="text-sm text-gray-600 mb-3">
          Defina os horários em que o assistente estará ativo.
        </p>
      </div>

      <div className="space-y-2">
        {daysOfWeek.map(({ key, label }) => {
          const dayConfig = getDayConfig(key);
          const isEnabled = dayConfig.enabled;

          return (
            <div
              key={key}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                isEnabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Switch
                  id={`${key}-enabled`}
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleDayChange(key, checked)}
                />
                <Label
                  htmlFor={`${key}-enabled`}
                  className={`text-sm ${!isEnabled ? 'text-gray-500' : 'text-gray-900'}`}
                >
                  {label}
                </Label>
              </div>

              <div className={`flex items-center space-x-2 ${!isEnabled ? 'opacity-50' : ''}`}>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="time"
                    value={dayConfig.start}
                    onChange={(e) => handleTimeChange(key, 'start', e.target.value)}
                    disabled={!isEnabled}
                    className="pl-8 w-20 h-8 text-sm"
                  />
                </div>
                <span className={`text-xs ${!isEnabled ? 'text-gray-400' : 'text-gray-600'}`}>
                  às
                </span>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="time"
                    value={dayConfig.end}
                    onChange={(e) => handleTimeChange(key, 'end', e.target.value)}
                    disabled={!isEnabled}
                    className="pl-8 w-20 h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 