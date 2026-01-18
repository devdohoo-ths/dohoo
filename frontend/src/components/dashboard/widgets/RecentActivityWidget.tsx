
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, MessageCircle, Bot, Users, Clock } from 'lucide-react';

interface RecentActivityWidgetProps {
  className?: string;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({ className }) => {
  const activities = [
    { id: 1, type: 'message', content: 'Nova mensagem de João Silva', time: '2 min atrás', icon: MessageCircle },
    { id: 2, type: 'ai', content: 'IA respondeu automaticamente', time: '5 min atrás', icon: Bot },
    { id: 3, type: 'account', content: 'WhatsApp Business conectado', time: '1 hora atrás', icon: Users },
    { id: 4, type: 'chat', content: 'Chat finalizado com Maria Santos', time: '2 horas atrás', icon: Clock },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent transition-colors">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <activity.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm">{activity.content}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
