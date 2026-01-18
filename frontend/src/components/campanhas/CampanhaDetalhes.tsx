import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Brain,
  Calendar,
  User,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCampanha, useCampanhaContatos, useCampanhaRelatorio } from '@/hooks/useCampanhas';
import { Skeleton } from '@/components/ui/skeleton';

interface CampanhaDetalhesProps {
  campanhaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors = {
  pendente: 'secondary',
  enviado: 'default',
  respondido: 'success',
  erro: 'destructive'
} as const;

const statusLabels = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  respondido: 'Respondido',
  erro: 'Erro'
};

const sentimentColors = {
  positivo: '#10B981',
  neutro: '#6B7280',
  negativo: '#EF4444'
};

export function CampanhaDetalhes({ campanhaId, open, onOpenChange }: CampanhaDetalhesProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: campanha, isLoading: isLoadingCampanha } = useCampanha(campanhaId);
  const { data: contatos, isLoading: isLoadingContatos } = useCampanhaContatos(campanhaId);
  const { data: relatorio, isLoading: isLoadingRelatorio } = useCampanhaRelatorio(campanhaId);

  if (isLoadingCampanha) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!campanha) {
    return null;
  }

  const getProgressPercentage = () => {
    if (campanha.total_destinatarios === 0) return 0;
    return (campanha.enviados / campanha.total_destinatarios) * 100;
  };

  const getTaxaResposta = () => {
    const enviados = campanha.enviados || 0;
    const respondidos = campanha.respondidos || 0;
    if (enviados === 0) return 0;
    return (respondidos / enviados) * 100;
  };

  // ✅ Garantir que taxa_resposta seja exibida corretamente
  const taxaRespostaFinal = campanha.taxa_resposta !== undefined && campanha.taxa_resposta !== null
    ? campanha.taxa_resposta
    : getTaxaResposta();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campanha.nome}
            {campanha.usar_ia && (
              <Brain className="h-5 w-5 text-purple-500" title="IA Ativada" />
            )}
          </DialogTitle>
          <DialogDescription>
            Detalhes e métricas da campanha de mensagens
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="contatos">Contatos</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Cards de métricas */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total de Contatos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{campanha.total_destinatarios}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Mensagens Enviadas</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{campanha.enviados || 0}</div>
                  <Progress value={getProgressPercentage()} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Respostas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{campanha.respondidos || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {taxaRespostaFinal.toFixed(1)}% de taxa de resposta
                  </p>
                </CardContent>
              </Card>

              {/* Card de Taxa de Resposta - Adicionado */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Taxa de Resposta</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">
                    {taxaRespostaFinal.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {campanha.respondidos || 0} de {campanha.enviados || 0} respondidas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Status</CardTitle>
                  {campanha.status === 'em_execucao' && <Play className="h-4 w-4 text-blue-500" />}
                  {campanha.status === 'finalizada' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {campanha.status === 'pausada' && <Pause className="h-4 w-4 text-yellow-500" />}
                  {campanha.status === 'erro' && <AlertCircle className="h-4 w-4 text-red-500" />}
                </CardHeader>
                <CardContent>
                  <Badge variant={
                    campanha.status === 'finalizada' ? 'success' :
                    campanha.status === 'em_execucao' ? 'default' :
                    campanha.status === 'erro' ? 'destructive' : 'secondary'
                  }>
                    {campanha.status === 'em_execucao' ? 'Em Execução' :
                     campanha.status === 'finalizada' ? 'Finalizada' :
                     campanha.status === 'pausada' ? 'Pausada' :
                     campanha.status === 'erro' ? 'Erro' : 'Rascunho'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Informações da campanha */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Campanha</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="mb-2">Template Utilizado</h4>
                    <p className="text-sm text-muted-foreground">{campanha.template?.nome}</p>
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm">{campanha.template?.conteudo}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2">Criado por</h4>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="text-sm">{campanha.created_by_profile?.name}</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="mb-2">Data de Criação</h4>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">
                          {format(new Date(campanha.criado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    {campanha.data_inicio && (
                      <div>
                        <h4 className="mb-2">Data de Início</h4>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm">
                            {format(new Date(campanha.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Remetentes */}
            {campanha.remetentes && campanha.remetentes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Usuários Remetentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {campanha.remetentes.map((remetente) => (
                      <div key={remetente.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4" />
                          <div>
                            <p className="">{remetente.usuario?.name}</p>
                            <p className="text-sm text-muted-foreground">{remetente.numero_whatsapp || 'Número não definido'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{remetente.mensagens_enviadas} enviadas</p>
                          {remetente.ultima_mensagem && (
                            <p className="text-xs text-muted-foreground">
                              Última: {format(new Date(remetente.ultima_mensagem), 'dd/MM HH:mm', { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="contatos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Contatos</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingContatos ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead>Resposta</TableHead>
                        {campanha.usar_ia && <TableHead>Sentimento</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contatos && contatos.length > 0 ? (
                        contatos.map((contato) => {
                          // ✅ CORREÇÃO: Fallback robusto para nome e telefone
                          // Primeiro tenta contato.contato, depois propriedades diretas (caso API retorne diferente)
                          const nome = contato.contato?.name 
                            || (contato as any).contato_nome 
                            || (contato as any).name 
                            || 'Sem nome';
                          
                          const telefone = contato.contato?.phone 
                            || (contato as any).contato_telefone 
                            || (contato as any).phone 
                            || (contato as any).phone_number 
                            || 'N/A';

                          return (
                            <TableRow key={contato.id}>
                              <TableCell>
                                <div>
                                  <p className="">{nome}</p>
                                  <p className="text-sm text-muted-foreground">{telefone}</p>
                                </div>
                              </TableCell>
                          <TableCell>
                            <Badge variant={statusColors[contato.status]}>
                              {statusLabels[contato.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {contato.enviado_em ? (
                              <span className="text-sm">
                                {format(new Date(contato.enviado_em), 'dd/MM HH:mm', { locale: ptBR })}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {contato.resposta_cliente ? (
                              <div className="max-w-xs">
                                <p className="text-sm truncate">{contato.resposta_cliente}</p>
                                {contato.resumo_ia && (
                                  <p className="text-xs text-muted-foreground mt-1">{contato.resumo_ia}</p>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          {campanha.usar_ia && (
                            <TableCell>
                              {contato.sentimento_ia ? (
                                <Badge 
                                  variant="outline" 
                                  style={{ 
                                    borderColor: sentimentColors[contato.sentimento_ia],
                                    color: sentimentColors[contato.sentimento_ia]
                                  }}
                                >
                                  {contato.sentimento_ia}
                                </Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          )}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={campanha.usar_ia ? 5 : 4} className="text-center text-muted-foreground py-8">
                            Nenhum contato encontrado para esta campanha
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {isLoadingRelatorio ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : relatorio ? (
              <>
                {/* Gráfico de envios por dia */}
                {relatorio.envios_por_dia && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Envios por Dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={relatorio.envios_por_dia}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="data" 
                            tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                          />
                          <Line type="monotone" dataKey="envios" stroke="#3B82F6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Análise de sentimentos */}
                {campanha.usar_ia && relatorio.sentimentos && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        Análise de Sentimentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Positivo', value: relatorio.sentimentos.positivo, color: sentimentColors.positivo },
                              { name: 'Neutro', value: relatorio.sentimentos.neutro, color: sentimentColors.neutro },
                              { name: 'Negativo', value: relatorio.sentimentos.negativo, color: sentimentColors.negativo }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[
                              { name: 'Positivo', value: relatorio.sentimentos.positivo, color: sentimentColors.positivo },
                              { name: 'Neutro', value: relatorio.sentimentos.neutro, color: sentimentColors.neutro },
                              { name: 'Negativo', value: relatorio.sentimentos.negativo, color: sentimentColors.negativo }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Nenhum dado de analytics disponível</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Logs da Campanha</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Logs em desenvolvimento...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
