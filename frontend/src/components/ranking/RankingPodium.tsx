import React from 'react';
import { Trophy, Medal, Crown } from 'lucide-react';
import { RankingData } from '@/types/ranking';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RankingPodiumProps {
  ranking: RankingData;
  className?: string;
}

const getPodiumHeight = (position: number) => {
  switch (position) {
    case 1: return 'h-24'; // Mais alto
    case 2: return 'h-20'; // Médio
    case 3: return 'h-16'; // Mais baixo
    default: return 'h-12';
  }
};

const getPodiumColor = (position: number) => {
  switch (position) {
    case 1: return 'bg-yellow-500';
    case 2: return 'bg-gray-400';
    case 3: return 'bg-orange-500';
    default: return 'bg-muted';
  }
};

const getPodiumIcon = (position: number) => {
  switch (position) {
    case 1: return <Crown className="w-6 h-6 text-white" />;
    case 2: return <Medal className="w-5 h-5 text-white" />;
    case 3: return <Medal className="w-5 h-5 text-white" />;
    default: return <Trophy className="w-4 h-4 text-white" />;
  }
};

const formatScore = (score: number, type: string) => {
  switch (type) {
    case 'response_speed':
      return `${score.toFixed(1)}s`;
    case 'messages_sent':
      return score.toLocaleString();
    case 'engagement_balance':
      return `${score.toFixed(1)}%`;
    case 'consistency':
      return `${score.toFixed(1)}%`;
    case 'evolution':
      return `${score > 0 ? '+' : ''}${score.toFixed(1)}%`;
    default:
      return score.toLocaleString();
  }
};

export const RankingPodium: React.FC<RankingPodiumProps> = ({ ranking, className }) => {
  const topThree = ranking.entries.slice(0, 3);
  
  // Garantir que temos pelo menos 3 posições
  const podiumEntries = [
    topThree[0] || null,
    topThree[1] || null,
    topThree[2] || null
  ];

  return (
    <Card className={cn(
      "hover:shadow-lg transition-shadow",
      className
    )}>
      <CardHeader>
        <div className="text-center">
          <CardTitle className="text-xl mb-2">{ranking.title}</CardTitle>
          <p className="text-muted-foreground text-sm">{ranking.description}</p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Podium */}
        <div className="flex items-end justify-center gap-4 mb-6">
        {/* 2º Lugar */}
        {podiumEntries[1] && (
          <div className="flex flex-col items-center">
            <div className="relative mb-2">
              <div className={cn(
                "w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg mb-2",
                "shadow-lg border-2 border-border"
              )}>
                {podiumEntries[1].user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="absolute -top-2 -right-2 bg-gray-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                2
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm">
                {podiumEntries[1].user.name || 'Usuário Anônimo'}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatScore(podiumEntries[1].score, ranking.type)}
              </div>
            </div>
            <div className={cn(
              "w-20 mt-2 rounded-t-lg flex items-center justify-center",
              getPodiumColor(2),
              getPodiumHeight(2)
            )}>
              {getPodiumIcon(2)}
            </div>
          </div>
        )}

        {/* 1º Lugar */}
        {podiumEntries[0] && (
          <div className="flex flex-col items-center">
            <div className="relative mb-2">
              <div className={cn(
                "w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xl mb-2",
                "shadow-xl border-2 border-yellow-300"
              )}>
                {podiumEntries[0].user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">
                1
              </div>
            </div>
            <div className="text-center">
              <div className="text-base">
                {podiumEntries[0].user.name || 'Usuário Anônimo'}
              </div>
              <div className="text-yellow-600 text-sm">
                {formatScore(podiumEntries[0].score, ranking.type)}
              </div>
            </div>
            <div className={cn(
              "w-24 mt-2 rounded-t-lg flex items-center justify-center",
              getPodiumColor(1),
              getPodiumHeight(1)
            )}>
              {getPodiumIcon(1)}
            </div>
          </div>
        )}

        {/* 3º Lugar */}
        {podiumEntries[2] && (
          <div className="flex flex-col items-center">
            <div className="relative mb-2">
              <div className={cn(
                "w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg mb-2",
                "shadow-lg border-2 border-border"
              )}>
                {podiumEntries[2].user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                3
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm">
                {podiumEntries[2].user.name || 'Usuário Anônimo'}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatScore(podiumEntries[2].score, ranking.type)}
              </div>
            </div>
            <div className={cn(
              "w-20 mt-2 rounded-t-lg flex items-center justify-center",
              getPodiumColor(3),
              getPodiumHeight(3)
            )}>
              {getPodiumIcon(3)}
            </div>
          </div>
        )}
        </div>

        {/* Stats */}
        {ranking.metadata && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Participantes</div>
              <div className="text-lg">{ranking.totalUsers}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Melhor Score</div>
              <div className="text-lg">
                {ranking.metadata.topScore?.toFixed(1) || 'N/A'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Média</div>
              <div className="text-lg">
                {ranking.metadata.averageScore?.toFixed(1) || 'N/A'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
