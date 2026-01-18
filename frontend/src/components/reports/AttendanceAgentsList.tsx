import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Star,
  AlertTriangle,
  Users,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import type { AttendanceAgent } from '@/hooks/useAttendanceReports';

interface AttendanceAgentsListProps {
  agents: AttendanceAgent[];
  topPerformers: AttendanceAgent[];
  needsAttention: AttendanceAgent[];
}

export const AttendanceAgentsList: React.FC<AttendanceAgentsListProps> = ({ 
  agents, 
  topPerformers, 
  needsAttention 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('resolutionRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filtrar e ordenar agentes
  const filteredAndSortedAgents = useMemo(() => {
    let filtered = agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = departmentFilter === 'all' || agent.department === departmentFilter;
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
      
      let matchesPerformance = true;
      if (performanceFilter === 'excellent') {
        matchesPerformance = agent.resolutionRate >= 90;
      } else if (performanceFilter === 'good') {
        matchesPerformance = agent.resolutionRate >= 80 && agent.resolutionRate < 90;
      } else if (performanceFilter === 'regular') {
        matchesPerformance = agent.resolutionRate >= 70 && agent.resolutionRate < 80;
      } else if (performanceFilter === 'needs_attention') {
        matchesPerformance = agent.resolutionRate < 70;
      }

      return matchesSearch && matchesDepartment && matchesStatus && matchesPerformance;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'resolutionRate':
          aValue = a.resolutionRate || 0;
          bValue = b.resolutionRate || 0;
          break;
        case 'bestResponseTime':
          aValue = a.bestResponseTime || 0;
          bValue = b.bestResponseTime || 0;
          break;
        case 'averageResponseTime':
          aValue = a.averageResponseTime || 0;
          bValue = b.averageResponseTime || 0;
          break;
        case 'totalChats':
          aValue = a.totalChats || 0;
          bValue = b.totalChats || 0;
          break;
        case 'activeContacts':
          aValue = a.activeContacts || 0;
          bValue = b.activeContacts || 0;
          break;
        case 'newContacts':
          aValue = a.newContacts || 0;
          bValue = b.newContacts || 0;
          break;
        case 'name':
          aValue = a.name.localeCompare(b.name);
          bValue = 0;
          break;
        default:
          aValue = a.resolutionRate || 0;
          bValue = b.resolutionRate || 0;
      }

      if (sortBy === 'name') {
        return sortOrder === 'asc' ? aValue : -aValue;
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [agents, searchTerm, departmentFilter, statusFilter, performanceFilter, sortBy, sortOrder]);

  // Estatísticas dos filtros
  const stats = useMemo(() => {
    const total = agents.length;
    const online = agents.filter(a => a.status === 'online').length;
    const offline = agents.filter(a => a.status === 'offline').length;
    const excellent = agents.filter(a => a.resolutionRate >= 90).length;
    const good = agents.filter(a => a.resolutionRate >= 80 && a.resolutionRate < 90).length;
    const regular = agents.filter(a => a.resolutionRate >= 70 && a.resolutionRate < 80).length;
    const needsAttention = agents.filter(a => a.resolutionRate < 70).length;

    return { total, online, offline, excellent, good, regular, needsAttention };
  }, [agents]);

  // Departamentos únicos
  const departments = useMemo(() => {
    const depts = [...new Set(agents.map(a => a.department))];
    return depts.sort();
  }, [agents]);

  const handleExport = () => {
    console.log('Exportando dados dos agentes:', filteredAndSortedAgents);
  };

  const handleViewDetails = (agent: AttendanceAgent) => {
    console.log('Visualizando detalhes do agente:', agent);
  };

  return (
    <div className="space-y-6">
             {/* Estatísticas Gerais */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Card>
           <CardContent className="p-4 text-center">
             <div className="text-2xl text-blue-600">{stats.total}</div>
             <div className="text-sm text-muted-foreground">Total</div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 text-center">
             <div className="text-2xl text-green-600">{stats.online}</div>
             <div className="text-sm text-muted-foreground">Online</div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 text-center">
             <div className="text-2xl text-gray-600">{stats.offline}</div>
             <div className="text-sm text-muted-foreground">Offline</div>
           </CardContent>
         </Card>
       </div>

      

      {/* Top Performers */}
      {topPerformers && topPerformers.length > 0 && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Star className="h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topPerformers.map((agent) => (
                <div key={agent.id} className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-green-800">{agent.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{agent.department}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Contatos Ativos:</span>
                      <span className="ml-1">{agent.activeContacts}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Novos Contatos:</span>
                      <span className="ml-1">{agent.newContacts}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      

      {/* Todos os Agentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Todos os Agentes ({filteredAndSortedAgents.length} de {agents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedAgents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum agente encontrado com os filtros aplicados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedAgents.map((agent) => {
                const performanceLevel = agent.resolutionRate >= 90 ? 'Excelente' : 
                                        agent.resolutionRate >= 80 ? 'Bom' : 
                                        agent.resolutionRate >= 70 ? 'Regular' : 'Necessita Melhoria';
                
                const performanceColor = agent.resolutionRate >= 90 ? 'text-green-600' : 
                                       agent.resolutionRate >= 80 ? 'text-blue-600' : 
                                       agent.resolutionRate >= 70 ? 'text-yellow-600' : 'text-red-600';

                return (
                  <div key={agent.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm text-gray-600">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="">{agent.name}</h3>
                          <p className="text-sm text-muted-foreground">{agent.department}</p>
                        </div>
                      </div>
                      
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Melhor Resp.</div>
                        <div className="text-lg text-green-600">
                          {Math.round(agent.bestResponseTime / 60)}min
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Chats</div>
                        <div className="text-lg text-blue-600">
                          {agent.totalChats}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Contatos Ativos</div>
                        <div className="text-lg text-purple-600">
                          {agent.activeContacts}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Novos Contatos</div>
                        <div className="text-lg text-orange-600">
                          {agent.newContacts}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Mensagens</div>
                        <div className="text-lg text-indigo-600">
                          {agent.messagesSent}
                        </div>
                      </div>
                    </div>
                    
                    
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
