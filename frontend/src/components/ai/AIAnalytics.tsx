
import React from 'react';
import { BarChart3, TrendingUp, MessageSquare, Clock, Star, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AIAnalytics = () => {
  const dailyInteractions = [
    { day: 'Seg', interactions: 420, resolved: 380 },
    { day: 'Ter', interactions: 580, resolved: 540 },
    { day: 'Qua', interactions: 320, resolved: 290 },
    { day: 'Qui', interactions: 720, resolved: 680 },
    { day: 'Sex', interactions: 890, resolved: 820 },
    { day: 'Sáb', interactions: 650, resolved: 590 },
    { day: 'Dom', interactions: 430, resolved: 400 }
  ];

  const assistantPerformance = [
    { name: 'Vendas', interactions: 1250, rating: 4.8, color: '#3B82F6' },
    { name: 'Suporte', interactions: 890, rating: 4.6, color: '#10B981' },
    { name: 'Geral', interactions: 650, rating: 4.5, color: '#8B5CF6' },
    { name: 'Técnico', interactions: 420, rating: 4.7, color: '#F59E0B' }
  ];

  const responseTimeData = [
    { hour: '00h', time: 1.2 },
    { hour: '04h', time: 0.8 },
    { hour: '08h', time: 2.1 },
    { hour: '12h', time: 3.2 },
    { hour: '16h', time: 2.8 },
    { hour: '20h', time: 1.9 }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Analytics de IA</h1>
          <p className="text-muted-foreground">Acompanhe o desempenho dos seus assistentes</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Interações Hoje</p>
                <p className="text-3xl">2,847</p>
                <p className="text-sm text-green-600 flex items-center">
                  <TrendingUp size={14} className="mr-1" />
                  +12% vs ontem
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Resolução</p>
                <p className="text-3xl">94.2%</p>
                <p className="text-sm text-green-600 flex items-center">
                  <TrendingUp size={14} className="mr-1" />
                  +2.1% vs semana passada
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio de Resposta</p>
                <p className="text-3xl">1.8s</p>
                <p className="text-sm text-green-600 flex items-center">
                  <TrendingUp size={14} className="mr-1" />
                  -0.3s vs média
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Satisfação Média</p>
                <p className="text-3xl">4.7</p>
                <p className="text-sm text-green-600 flex items-center">
                  <Star size={14} className="mr-1 fill-current" />
                  +0.2 vs mês passado
                </p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Interactions Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Interações por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyInteractions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="interactions" 
                  stackId="1" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.3}
                  name="Total"
                />
                <Area 
                  type="monotone" 
                  dataKey="resolved" 
                  stackId="2" 
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.3}
                  name="Resolvidas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo de Resposta por Horário</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="time" 
                  stroke="#8B5CF6" 
                  strokeWidth={3}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Assistant Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance por Assistente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={assistantPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="interactions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Interações</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={assistantPerformance}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="interactions"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {assistantPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Assistant Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Assistentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Assistente</th>
                  <th className="text-left p-2">Interações</th>
                  <th className="text-left p-2">Taxa de Resolução</th>
                  <th className="text-left p-2">Avaliação</th>
                  <th className="text-left p-2">Tempo Médio</th>
                </tr>
              </thead>
              <tbody>
                {assistantPerformance.map((assistant, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: assistant.color }}></div>
                        <span className="">{assistant.name}</span>
                      </div>
                    </td>
                    <td className="p-2">{assistant.interactions.toLocaleString()}</td>
                    <td className="p-2">
                      <span className="text-green-600">94.2%</span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-yellow-500 fill-current" />
                        <span>{assistant.rating}</span>
                      </div>
                    </td>
                    <td className="p-2">1.8s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAnalytics;
