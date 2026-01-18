
import React from 'react';
import { Users, MessageSquare, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const InternalChatDashboard = () => {
  console.log('InternalChatDashboard: Renderizando dashboard de chat interno');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl">Chat Interno</h1>
        <p className="text-muted-foreground">Comunicação interna da equipe</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuários Online</p>
                <p className="text-2xl">--</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mensagens Hoje</p>
                <p className="text-2xl">--</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl">--</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipe Online</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['Ana Oliveira', 'Carlos Lima', 'Beatriz Santos'].map((name, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white">
                  {name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="">{name}</p>
                  <p className="text-sm text-muted-foreground">Atendimento</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InternalChatDashboard;
