import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Users, MessageSquare, Clock, Activity, Eye } from 'lucide-react';

interface TeamStats {
  teamId: string;
  teamName: string;
  description?: string;
  isOnline: boolean;
  lastActivity?: string;
  activeSessions: number;
  waitingChats: number;
  activeChats: number;
  totalAgents: number;
  onlineAgents: number;
}

interface TeamCardProps {
  team: TeamStats;
  onViewDetails: (teamId: string) => void;
  onViewChats: (teamId: string) => void;
}

export const TeamCard: React.FC<TeamCardProps> = ({ 
  team, 
  onViewDetails, 
  onViewChats 
}) => {
  const formatLastActivity = (lastActivity?: string) => {
    if (!lastActivity) return 'Nunca';
    
    const date = new Date(lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${diffDays}d atrás`;
  };

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? 'bg-green-500' : 'bg-gray-400';
  };

  const getStatusText = (isOnline: boolean) => {
    return isOnline ? 'Online' : 'Offline';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(team.isOnline)}`} />
              <CardTitle className="text-lg">{team.teamName}</CardTitle>
            </div>
            <Badge variant={team.isOnline ? 'default' : 'secondary'}>
              {getStatusText(team.isOnline)}
            </Badge>
          </div>
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <Activity className="w-4 h-4" />
            <span>{formatLastActivity(team.lastActivity)}</span>
          </div>
        </div>
        
        {team.description && (
          <CardDescription className="text-sm">
            {team.description}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Estatísticas do Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>Agentes</span>
            </div>
            <div className="text-2xl">
              {team.onlineAgents}/{team.totalAgents}
            </div>
            <div className="text-xs text-gray-500">
              {team.onlineAgents > 0 ? 'Online' : 'Offline'}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <MessageSquare className="w-4 h-4" />
              <span>Chats</span>
            </div>
            <div className="text-2xl">
              {team.activeChats}
            </div>
            <div className="text-xs text-gray-500">
              Ativos
            </div>
          </div>
        </div>

        {/* Chats Aguardando */}
        {team.waitingChats > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-orange-700">
              <Clock className="w-4 h-4" />
              <span className="">{team.waitingChats} chat(s) aguardando</span>
            </div>
            <div className="text-sm text-orange-600 mt-1">
              Atendimento necessário
            </div>
          </div>
        )}

        {/* Sessões Ativas */}
        {team.activeSessions > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-blue-700">
              <Activity className="w-4 h-4" />
              <span className="">{team.activeSessions} sessão(ões) ativa(s)</span>
            </div>
            <div className="text-sm text-blue-600 mt-1">
              Time conectado
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex space-x-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onViewDetails(team.teamId)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            Detalhes
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onViewChats(team.teamId)}
            className="flex-1"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Ver Chats
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
