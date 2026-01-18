
import React from 'react';
import { TrendingUp, Users, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AnalyticsPage = () => {
  console.log('AnalyticsPage: Renderizando página de analytics');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl">Analytics & Relatórios</h1>
        <p className="text-muted-foreground">Acompanhe o desempenho do seu atendimento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Conversas</p>
                <p className="text-2xl">--</p>
                <p className="text-sm text-gray-500">Dados reais em breve</p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Resolução</p>
                <p className="text-2xl">--</p>
                <p className="text-sm text-gray-500">Dados reais em breve</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Únicos</p>
                <p className="text-2xl">--</p>
                <p className="text-sm text-gray-500">Dados reais em breve</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Satisfação</p>
                <p className="text-2xl">--</p>
                <p className="text-sm text-gray-500">Dados reais em breve</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Relatórios Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                'Relatório de Atendimento Diário',
                'Análise de Satisfação do Cliente',
                'Tempo Médio de Resposta',
                'Relatório de Performance da Equipe'
              ].map((report, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <span className="">{report}</span>
                  <button className="text-sm text-primary hover:underline">Gerar</button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">Pico de atendimento</p>
                <p className="text-xs text-blue-600">Terças-feiras às 14h têm mais conversas</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">Melhoria detectada</p>
                <p className="text-xs text-green-600">Tempo de resposta reduziu 15% esta semana</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-800">Atenção necessária</p>
                <p className="text-xs text-orange-600">3 clientes aguardam há mais de 1 hora</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
