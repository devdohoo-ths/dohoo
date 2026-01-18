import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MessageCircle, 
  Clock, 
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReportStats as ReportStatsType } from '@/types/reports';

interface ReportStatsProps {
  stats: ReportStatsType;
  className?: string;
}

// Função utilitária para formatar duração
function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

// Função para obter cor do status
function getStatusColor(status: string) {
  switch (status) {
    case 'attended':
      return 'bg-green-500';
    case 'unattended':
      return 'bg-red-500';
    case 'closed':
      return 'bg-blue-500';
    case 'in_progress':
      return 'bg-yellow-500';
    case 'chatbot':
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
}

export const ReportStats: React.FC<ReportStatsProps> = ({ stats, className = '' }) => {
  const getChannelIcon = (channel: string) => {
    return <MessageCircle className="h-4 w-4" />;
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ${className}`}>
      {/* Total de Conversas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Total de Conversas</CardTitle>
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl">{stats.totalConversations}</div>
          <p className="text-xs text-muted-foreground">
            No período selecionado
          </p>
        </CardContent>
      </Card>

      {/* Duração Média */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Duração Média</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl">
            {formatDuration(stats.averageDuration)}
          </div>
          <p className="text-xs text-muted-foreground">
            Por atendimento
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export const ReportDetailedStats: React.FC<ReportStatsProps> = ({ stats, className = '' }) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Distribuição por Canal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Distribuição por Canal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.channelDistribution || {}).map(([channel, count]) => {
              const percentage = (count / stats.totalConversations) * 100;
              return (
                <div key={channel} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span className="capitalize">{channel}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                  <div className="flex items-center gap-2 w-32">
                    <Progress value={percentage} className="flex-1" />
                    <span className="text-sm text-muted-foreground min-w-[3rem]">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 