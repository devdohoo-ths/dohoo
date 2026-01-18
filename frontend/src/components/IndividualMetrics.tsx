import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Download, FileText, File, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiBase, getAuthHeaders } from "@/utils/apiBase";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface UserMetrics {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  avgResponseTime: string | number;
  isOnline?: boolean;
  isDemoData?: boolean;
  // 🎯 CAMPOS ADICIONAIS DO RELATÓRIO DE ATTENDANCE
  customerSatisfaction?: number;
  efficiency?: number;
  qualityScore?: number;
  bestResponseTime?: number;
}

interface IndividualMetricsProps {
  periodRange: { start: Date; end: Date };
}

interface APIUserStats {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userDepartment: string;
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  messagesByType: Record<string, number>;
  messagesByStatus: Array<{ status: string; count: number }>;
  messagesByDate: Array<{ date: string; count: number }>;
  firstMessage: string | null;
  lastMessage: string | null;
  avgResponseTime: number;
}

export const IndividualMetrics: React.FC<IndividualMetricsProps> = ({ periodRange }) => {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllUsers, setShowAllUsers] = useState(false); // Por padrão, mostrar apenas conectados
  const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
  const [totalStats, setTotalStats] = useState<{
    totalMessages: number;
    sentMessages: number;
    receivedMessages: number;
  } | null>(null);

  // Adicionar indicador visual do período selecionado
  const periodInfo = periodRange ? {
    start: periodRange.start.toISOString().split('T')[0],
    end: periodRange.end.toISOString().split('T')[0]
  } : null;

  // Verificar se periodRange é válido
  if (!periodRange || !periodRange.start || !periodRange.end) {
    return <div className="text-center text-muted-foreground py-8">Selecione um período válido para visualizar as métricas.</div>;
  }

  // Buscar métricas dos usuários
  useEffect(() => {
    const fetchUserMetrics = async () => {
      if (!user || !profile) return;

      setLoading(true);
      try {
        // 🎯 PRIMEIRO: Buscar contas WhatsApp conectadas para obter user_ids
        const headers = await getAuthHeaders();
        let connectedUserIdsList: string[] = [];
        
        try {
          const accountsResponse = await fetch(`${apiBase}/api/whatsapp-accounts`, { headers });
          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            if (accountsData.success && accountsData.accounts) {
              // Filtrar apenas contas conectadas e extrair user_ids únicos
              connectedUserIdsList = [...new Set(
                accountsData.accounts
                  .filter((account: any) => account.status === 'connected')
                  .map((account: any) => account.user_id)
                  .filter((userId: string) => userId) // Remover valores nulos/undefined
              )];
              setConnectedUserIds(connectedUserIdsList);
            }
          }
        } catch (accountsError) {
          console.warn('[IndividualMetrics] Erro ao buscar contas WhatsApp:', accountsError);
          // Continuar mesmo se falhar ao buscar contas
        }

        // 🎯 SEGUNDO: Buscar métricas individuais (que já incluem dados dos usuários)
        const metricsParams = new URLSearchParams({
          organization_id: profile.organization_id || '',
          dateStart: periodRange.start.toISOString().split('T')[0],
          dateEnd: periodRange.end.toISOString().split('T')[0],
        });

        // 🎯 PRIMEIRO: Buscar estatísticas totais reais (com count real)
        const statsParams = new URLSearchParams({
          user_id: user.id,
          organization_id: profile.organization_id || '',
          dateStart: periodRange.start.toISOString().split('T')[0],
          dateEnd: periodRange.end.toISOString().split('T')[0],
        });

        const statsResponse = await fetch(`${apiBase}/api/dashboard/stats?${statsParams}`, { headers });
        let totalStats = null;
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.success && statsData.stats) {
            totalStats = statsData.stats;
            setTotalStats({
              totalMessages: statsData.stats.totalMessages || 0,
              sentMessages: statsData.stats.sentMessages || 0,
              receivedMessages: statsData.stats.receivedMessages || 0
            });
          }
        }

        // 🎯 SEGUNDO: Buscar métricas individuais (para dados por usuário)
        const metricsResponse = await fetch(`${apiBase}/api/dashboard/individual-metrics?${metricsParams}`, { headers });

        if (!metricsResponse.ok) {
          const errorText = await metricsResponse.text();
          console.error('❌ [IndividualMetrics] Erro na requisição de métricas:', {
            status: metricsResponse.status,
            statusText: metricsResponse.statusText,
            error: errorText
          });
          throw new Error(`Erro HTTP metrics: ${metricsResponse.status} - ${errorText}`);
        }

        const metricsData = await metricsResponse.json();
        
        if (metricsData.success && metricsData.agents) {
          // 🎯 CORREÇÃO: Usar diretamente os dados das métricas (já incluem info dos usuários)
          const agentsData = metricsData.agents || [];
          
          // Agrupar dados de métricas por agente
          const agentStats: Record<string, {
            totalMessages: number;
            sentMessages: number;
            receivedMessages: number;
            averageResponseTime: number;
            bestResponseTime: number;
          }> = {};
          
          agentsData.forEach((agent: any) => {
            agentStats[agent.id] = {
              totalMessages: agent.totalMessages || 0,
              sentMessages: agent.sentMessages || 0,
              receivedMessages: agent.receivedMessages || 0,
              averageResponseTime: agent.averageResponseTime || 0,
              bestResponseTime: agent.bestResponseTime || 0
            };
          });
          
          // 🎯 COMBINAR USUÁRIOS COM DADOS DE MÉTRICAS
          const transformedMetrics = agentsData.map((agent: any) => {
            const userStats = agentStats[agent.id] || {
              totalMessages: 0,
              sentMessages: 0,
              receivedMessages: 0,
              averageResponseTime: 0,
              bestResponseTime: 0
            };
            
            const result: UserMetrics = {
              id: agent.id,
              name: agent.name || agent.email?.split('@')[0] || 'Usuário',
              email: agent.email || '',
              totalMessages: userStats.totalMessages,
              sentMessages: userStats.sentMessages,
              receivedMessages: userStats.receivedMessages,
              avgResponseTime: userStats.averageResponseTime,
              bestResponseTime: userStats.bestResponseTime,
              isOnline: agent.is_online || false,
              isDemoData: false
            };
            
            return result;
          });
          
          setUsers(transformedMetrics);
        } else {
          console.warn('[IndividualMetrics] Resposta da API de métricas sem sucesso:', metricsData);
          setUsers([]);
        }
      } catch (error) {
        console.error('[IndividualMetrics] Erro ao buscar métricas:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserMetrics();
  }, [user, profile, periodRange]);

  // Filtrar usuários baseado no termo de busca e status de conexão
  const filteredUsers = users.filter(user => {
    // Filtrar por termo de busca
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Se showAllUsers estiver desmarcado (padrão), mostrar apenas usuários com número conectado
    if (!showAllUsers) {
      return connectedUserIds.includes(user.id);
    }
    
    // Se showAllUsers estiver marcado, mostrar todos
    return true;
  });

  const formatResponseTime = (timeInSeconds: number) => {
    if (timeInSeconds === 0) return '-';
    
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatDateForExport = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Métricas Individuais', 20, 20);
    
    // Período
    doc.setFontSize(12);
    doc.text(`Período: ${formatDateForExport(periodRange.start)} a ${formatDateForExport(periodRange.end)}`, 20, 30);
    
    // Dados da tabela
    const tableData = filteredUsers.map(user => [
      user.name,
      user.totalMessages.toString(),
      user.sentMessages.toString(),
      user.receivedMessages.toString(),
      formatResponseTime(user.avgResponseTime as number)
    ]);
    
    autoTable(doc, {
      head: [['Colaborador', 'Mensagens', 'Enviadas', 'Recebidas', 'Tempo Médio']],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255
      }
    });
    
    doc.save(`metricas-individuais-${formatDateForExport(new Date()).replace(/\//g, '-')}.pdf`);
  };

  const exportToCSV = () => {
    const wb = XLSX.utils.book_new();
    
    // Preparar dados para exportação
    const exportData = filteredUsers.map(user => ({
      'Colaborador': user.name,
      'Email': user.email,
      'Mensagens': user.totalMessages,
      'Mensagens Enviadas': user.sentMessages,
      'Mensagens Recebidas': user.receivedMessages,
      'Tempo Médio de Resposta': formatResponseTime(user.avgResponseTime as number),
      'Status': user.isOnline ? 'Online' : 'Offline'
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Definir largura das colunas
    const colWidths = [
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Métricas Individuais');
    
    // Salvar arquivo
    const fileName = `metricas-individuais-${formatDateForExport(new Date()).replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas Individuais</CardTitle>
          <div className="text-muted-foreground text-sm">
            Desempenho detalhado por colaborador
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Métricas Individuais</CardTitle>
            <div className="text-muted-foreground text-sm">
              Desempenho detalhado por colaborador
            </div>

          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
              <Checkbox
                id="show-all-users"
                checked={showAllUsers}
                onCheckedChange={(checked) => setShowAllUsers(checked === true)}
              />
              <Label
                htmlFor="show-all-users"
                className="text-sm font-normal cursor-pointer"
              >
                Exibir todos os usuários
              </Label>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <File className="h-4 w-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Nota sobre dados de demonstração */}
        {users.some(user => user.isDemoData) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">Dados de Demonstração</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Como não há dados reais de conversas no período selecionado, estamos exibindo dados simulados para demonstrar como as métricas apareceriam com atividade real.
            </p>
          </div>
        )}
        
        <div className="rounded-md border overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center">Mensagens</TableHead>
                <TableHead className="text-center">Enviadas</TableHead>
                <TableHead className="text-center">Recebidas</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Tempo Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1 text-sm">
                          {user.name}
                          <div className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} 
                               title={user.isOnline ? 'Online' : 'Offline'} />
                          {user.isDemoData && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded-full" title="Dados de demonstração">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">{user.totalMessages.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                        Total
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-green-600 text-sm">{user.sentMessages.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                        Enviadas
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-blue-600 text-sm">{user.receivedMessages.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                        Recebidas
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">{formatResponseTime(user.avgResponseTime as number)}</span>
                      {user.bestResponseTime && user.bestResponseTime > 0 && (
                        <span className="text-xs text-green-600">
                          Melhor: {formatResponseTime(user.bestResponseTime)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {/* 🎯 LINHA DE TOTAL */}
              {filteredUsers.length > 0 && (
                <TableRow className="bg-gray-50">
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-gray-900 text-sm">TOTAL GERAL</div>
                        <div className="text-xs text-muted-foreground">
                          {filteredUsers.length} colaborador{filteredUsers.length !== 1 ? 'es' : ''}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-900 text-sm">
                        {totalStats ? totalStats.totalMessages.toLocaleString() : filteredUsers.reduce((sum, user) => sum + user.totalMessages, 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Total
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-green-700 text-sm">
                        {totalStats ? totalStats.sentMessages.toLocaleString() : filteredUsers.reduce((sum, user) => sum + user.sentMessages, 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Enviadas
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-blue-700 text-sm">
                        {totalStats ? totalStats.receivedMessages.toLocaleString() : filteredUsers.reduce((sum, user) => sum + user.receivedMessages, 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Recebidas
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-900 text-sm">
                        {(() => {
                          // 🎯 SÓ CALCULAR MÉDIA SE PELO MENOS UM USUÁRIO TEM TEMPO DE RESPOSTA
                          const usersWithResponseTime = filteredUsers.filter(user => 
                            Number(user.avgResponseTime) > 0
                          );
                          
                          if (usersWithResponseTime.length === 0) {
                            return '-';
                          }
                          
                          const totalTime = usersWithResponseTime.reduce((sum, user) => {
                            const time = Number(user.avgResponseTime);
                            return sum + time;
                          }, 0);
                          
                          const avgTime = totalTime / usersWithResponseTime.length;
                          return formatResponseTime(avgTime);
                        })()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(() => {
                          const usersWithResponseTime = filteredUsers.filter(user => 
                            Number(user.avgResponseTime) > 0
                          );
                          return usersWithResponseTime.length > 0 
                            ? `Média de ${usersWithResponseTime.length} usuário${usersWithResponseTime.length !== 1 ? 's' : ''}`
                            : 'Média geral';
                        })()}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {users.length === 0 ? 'Nenhum usuário encontrado na organização' : 'Nenhum colaborador encontrado'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}