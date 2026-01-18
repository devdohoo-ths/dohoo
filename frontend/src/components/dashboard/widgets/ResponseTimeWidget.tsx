
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Timer } from 'lucide-react';

interface ResponseTimeWidgetProps {
  className?: string;
}

export const ResponseTimeWidget: React.FC<ResponseTimeWidgetProps> = ({ className }) => {
  return (
    <Card className={`bg-gradient-to-br from-orange-500 to-red-600 text-white border-0 shadow-lg ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm opacity-90">Tempo Médio</CardTitle>
        <Clock className="h-5 w-5 opacity-80" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl md:text-3xl">2.3s</div>
        <div className="flex items-center text-xs opacity-80 mt-1">
          <Timer className="w-3 h-3 mr-1" />
          -15% vs. semana anterior
        </div>
      </CardContent>
    </Card>
  );
};
