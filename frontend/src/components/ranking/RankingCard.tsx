import React from 'react';
import { Trophy, Medal, Zap, TrendingUp, TrendingDown, Minus, Crown, Star } from 'lucide-react';
import { RankingData, RankingEntry } from '@/types/ranking';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RankingCardProps {
  ranking: RankingData;
  className?: string;
  showTop?: number;
  compact?: boolean;
}

const getRankingIcon = (type: string) => {
  switch (type) {
    case 'messages_sent':
      return <Trophy className="w-5 h-5 text-blue-600" />;
    case 'response_speed':
      return <Zap className="w-5 h-5 text-green-600" />;
    case 'engagement_balance':
      return <Star className="w-5 h-5 text-purple-600" />;
    case 'consistency':
      return <TrendingUp className="w-5 h-5 text-orange-600" />;
    case 'evolution':
      return <TrendingUp className="w-5 h-5 text-emerald-600" />;
    default:
      return <Crown className="w-5 h-5 text-muted-foreground" />;
  }
};

const getBadgeIcon = (badge: string) => {
  switch (badge) {
    case 'gold':
      return <Medal className="w-4 h-4 text-yellow-600" />;
    case 'silver':
      return <Medal className="w-4 h-4 text-gray-500" />;
    case 'bronze':
      return <Medal className="w-4 h-4 text-orange-600" />;
    default:
      return null;
  }
};

const getTrendIcon = (trend?: string) => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-3 h-3 text-green-600" />;
    case 'down':
      return <TrendingDown className="w-3 h-3 text-red-600" />;
    case 'stable':
      return <Minus className="w-3 h-3 text-muted-foreground" />;
    default:
      return null;
  }
};

const getPositionColor = (position: number) => {
  if (position === 1) return 'bg-yellow-500 text-white';
  if (position === 2) return 'bg-gray-400 text-white';
  if (position === 3) return 'bg-orange-500 text-white';
  if (position <= 10) return 'bg-blue-600 text-white';
  return 'bg-muted text-muted-foreground';
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

export const RankingCard: React.FC<RankingCardProps> = ({ 
  ranking, 
  className, 
  showTop = 10,
  compact = false 
}) => {
  const topEntries = ranking.entries.slice(0, showTop);

  return (
    <Card className={cn(
      "hover:shadow-lg transition-shadow",
      className
    )}>
      <CardHeader className={compact ? "pb-2" : "pb-4"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getRankingIcon(ranking.type)}
            <div>
              <CardTitle className="text-lg">{ranking.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{ranking.description}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="outline" className="text-xs">
              {ranking.period === 'today' ? 'Hoje' :
               ranking.period === 'week' ? 'Esta Semana' :
               ranking.period === 'month' ? 'Este Mês' :
               ranking.period === 'quarter' ? 'Este Trimestre' :
               'Este Ano'}
            </Badge>
            <div className="text-xs text-muted-foreground mt-1">
              {ranking.totalUsers} participantes
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Ranking List */}
        <div className="space-y-2">
          {topEntries.map((entry, index) => (
            <div
              key={entry.user.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                "hover:bg-muted/50",
                index < 3 ? "bg-muted/30 border" : "bg-background"
              )}
            >
            {/* Position */}
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-sm",
              getPositionColor(entry.position)
            )}>
              {entry.position}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm">
                  {entry.user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    {entry.user.name || 'Usuário Anônimo'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {entry.user.role_name || entry.user.department || 'Sem função'}
                  </div>
                </div>
              </div>
            </div>

            {/* Score and Badge */}
            <div className="flex items-center gap-2">
              {entry.badge && entry.badge !== 'none' && (
                <div className="flex items-center gap-1">
                  {getBadgeIcon(entry.badge)}
                </div>
              )}
              
              <div className="text-right">
                <div className="">
                  {formatScore(entry.score, ranking.type)}
                </div>
                {entry.change && (
                  <div className="flex items-center gap-1 text-xs">
                    {getTrendIcon(entry.trend)}
                    <span className={cn(
                      entry.trend === 'up' ? 'text-green-600' :
                      entry.trend === 'down' ? 'text-red-600' :
                      'text-muted-foreground'
                    )}>
                      {entry.change > 0 ? '+' : ''}{entry.change.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        </div>

        {/* Footer */}
        {ranking.metadata && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Média</div>
                <div className="text-sm">
                  {ranking.metadata.averageScore?.toFixed(1) || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Melhor</div>
                <div className="text-sm">
                  {ranking.metadata.topScore?.toFixed(1) || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Participação</div>
                <div className="text-sm">
                  {ranking.metadata.participationRate?.toFixed(1) || 'N/A'}%
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
