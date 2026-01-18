import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Download, FileText, File, Users, MessageCircle, Clock, TrendingUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiBase } from "@/utils/apiBase";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  totalMessages: number;
  avgResponseTime: number;
  lastActivity: string;
}

interface TeamData {
  id: string;
  name: string;
  totalMembers: number;
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  avgResponseTime: number;
  trend: 'up' | 'down' | 'stable';
  dailyData: { date: string; messages: number }[];
  members: TeamMember[];
}

interface TeamMetricsProps {
  periodRange: { start: Date; end: Date };
}

export function TeamMetrics({ periodRange }: TeamMetricsProps) {
  const { user, profile } = useAuth();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [totalStats, setTotalStats] = useState<{
    totalMessages: number;
    sentMessages: number;
    receivedMessages: number;
  } | null>(null);

  // Verificar se periodRange é válido
  if (!periodRange || !periodRange.start || !periodRange.end) {
    return <div className="text-center text-muted-foreground py-8">Selecione um período válido para visualizar as métricas.</div>;
  }

  // Buscar métricas dos times
  useEffect(() => {
    const fetchTeamMetrics = async () => {
      if (!user || !profile) return;

      setLoading(true);
      try {
        // 🎯 HEADERS: Definir headers antes de usar
        const headers = {
          'Authorization': 'Bearer dohoo_dev_token_2024',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-id': user?.id || '',
          'x-organization-id': profile?.organization_id || ''
        };

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
            console.log('📊 [TeamMetrics] Estatísticas totais reais:', totalStats);
          }
        } else {
          console.warn('⚠️ [TeamMetrics] Erro ao buscar estatísticas totais:', statsResponse.status);
        }

        // 🎯 SEGUNDO: Buscar métricas dos times
        const params = new URLSearchParams({
          organization_id: profile.organization_id || '',
          dateStart: periodRange.start.toISOString().split('T')[0],
          dateEnd: periodRange.end.toISOString().split('T')[0],
        });

        console.log('📊 [TeamMetrics] Parâmetros sendo enviados (unificados):', {
          organization_id: profile.organization_id || '',
          dateStart: periodRange.start.toISOString().split('T')[0],
          dateEnd: periodRange.end.toISOString().split('T')[0],
          periodRange: {
            start: periodRange.start.toISOString(),
            end: periodRange.end.toISOString()
          }
        });

        console.log('🔧 [TeamMetrics] Headers sendo enviados:', headers);

        // 🎯 CORREÇÃO: Usar a API de times
        const response = await fetch(`${apiBase}/api/teams/metrics?${params}`, { headers });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [TeamMetrics] Erro na requisição unificada:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        console.log('📊 [TeamMetrics] Resposta da API unificada:', data);
        
        if (data.success && data.teams) {
          // 🎯 CORREÇÃO: Usar dados diretos da API de times
          const teams = data.teams || [];
          
          console.log('📊 [TeamMetrics] Times recebidos da API:', teams);
          setTeams(teams);
          
          // 🎯 CORREÇÃO: Expandir times que têm membros por padrão
          const teamsWithMembers = teams.filter((team: any) => team.members && team.members.length > 0);
          if (teamsWithMembers.length > 0) {
            const teamIds = teamsWithMembers.map((team: any) => team.id);
            setExpandedTeams(new Set(teamIds));
            console.log('📊 [TeamMetrics] Expandindo times com membros:', teamIds);
          }
        } else {
          console.warn('[TeamMetrics] Resposta da API sem sucesso:', data);
          setTeams([]);
        }
      } catch (error) {
        console.error('[TeamMetrics] Erro ao buscar métricas unificadas:', error);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMetrics();
  }, [user, profile, periodRange]);

  // Filtrar times baseado no termo de busca
  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.members.some(member => 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const toggleTeamExpansion = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-red-500 transform rotate-180" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-500" />;
    }
  };


  const formatResponseTime = (timeInMinutes: number) => {
    if (timeInMinutes === 0) return '-';
    
    if (timeInMinutes < 1) {
      return `${Math.round(timeInMinutes * 60)}s`;
    } else if (timeInMinutes < 60) {
      return `${Math.round(timeInMinutes)}min`;
    } else {
      const hours = Math.floor(timeInMinutes / 60);
      const minutes = Math.round(timeInMinutes % 60);
      return `${hours}h ${minutes}min`;
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
    doc.text('Métricas de Times', 20, 20);
    
    // Período
    doc.setFontSize(12);
    doc.text(`Período: ${formatDateForExport(periodRange.start)} a ${formatDateForExport(periodRange.end)}`, 20, 30);
    
    // Dados da tabela
    const tableData = filteredTeams.map(team => [
      team.name,
      team.totalMembers.toString(),
      team.totalMessages.toString(),
      formatResponseTime(team.avgResponseTime)
    ]);
    
    autoTable(doc, {
      head: [['Time', 'Membros', 'Mensagens', 'Tempo Médio']],
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
    
    doc.save(`metricas-times-${formatDateForExport(new Date()).replace(/\//g, '-')}.pdf`);
  };

  const exportToCSV = () => {
    const wb = XLSX.utils.book_new();
    
    // Preparar dados para exportação
    const exportData = filteredTeams.flatMap(team => [
      {
        'Time': team.name,
        'Membro': 'TOTAL DO TIME',
        'Mensagens': team.totalMessages,
        'Tempo Médio de Resposta': formatResponseTime(team.avgResponseTime)
      },
      ...team.members.map(member => ({
        'Time': team.name,
        'Membro': member.name,
        'Mensagens': member.totalMessages,
        'Tempo Médio de Resposta': formatResponseTime(member.avgResponseTime)
      }))
    ]);
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Definir largura das colunas
    const colWidths = [
      { wch: 20 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Métricas de Times');
    
    // Salvar arquivo
    const fileName = `metricas-times-${formatDateForExport(new Date()).replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Times</CardTitle>
          <p className="text-sm text-muted-foreground">
            Desempenho comparativo entre equipes
          </p>
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
            <CardTitle>Métricas de Times</CardTitle>
            <p className="text-sm text-muted-foreground">
              Desempenho comparativo entre equipes
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar time ou membro..."
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
        {filteredTeams.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {teams.length === 0 ? 'Nenhum time encontrado na organização' : 'Nenhum time encontrado com os filtros aplicados'}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards de visão geral dos times */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeams.map((team) => (
                <Card key={team.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTeamExpansion(team.id)}
                        className="h-6 w-6 p-0"
                      >
                        {expandedTeams.has(team.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {team.totalMembers} membro{team.totalMembers !== 1 ? 's' : ''}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Mensagens</span>
                      </div>
                      <span className="">{team.totalMessages.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Tempo Médio</span>
                      </div>
                      <span className="">{formatResponseTime(team.avgResponseTime)}</span>
                    </div>
                    
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Tendência</span>
                      {getTrendIcon(team.trend)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabela detalhada com membros dos times */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Membro</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Métricas individuais dos membros de cada time
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Membro</TableHead>
                        <TableHead className="text-center">Mensagens</TableHead>
                        <TableHead className="text-center">Tempo Médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeams.flatMap((team) => [
                        // Linha do time (expandida)
                        <TableRow key={`team-${team.id}`} className="bg-gray-50">
                          <TableCell colSpan={6} className="py-2">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTeamExpansion(team.id)}
                                className="h-6 w-6 p-0"
                              >
                                {expandedTeams.has(team.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span className="">{team.name}</span>
                                <Badge variant="secondary">{team.totalMembers} membros</Badge>
                              </div>
                              <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Total: {team.totalMessages.toLocaleString()} msgs</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>,
                        // Membros do time (condicionalmente visíveis)
                        ...(expandedTeams.has(team.id) ? team.members.map((member) => (
                          <TableRow key={`member-${team.id}-${member.id}`} className="bg-white">
                            <TableCell className="py-2">
                              <div className="w-8 h-0.5 bg-gray-300 ml-8"></div>
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src="" alt={member.name} />
                                  <AvatarFallback className="text-xs">
                                    {member.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="text-sm">{member.name}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <span className="">{member.totalMessages.toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <span className="">{formatResponseTime(member.avgResponseTime)}</span>
                            </TableCell>
                          </TableRow>
                        )) : [])
                      ])}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* 🎯 LINHA DE TOTAL */}
            {filteredTeams.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo Geral</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl text-blue-600">{filteredTeams.length}</div>
                      <div className="text-sm text-muted-foreground">Times</div>
                    </div>
                    <div>
                      <div className="text-2xl text-green-600">
                        {filteredTeams.reduce((sum, team) => sum + team.totalMembers, 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total de Membros</div>
                    </div>
                    <div>
                      <div className="text-2xl text-purple-600">
                        {totalStats ? totalStats.totalMessages.toLocaleString() : filteredTeams.reduce((sum, team) => sum + team.totalMessages, 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total de Mensagens</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 