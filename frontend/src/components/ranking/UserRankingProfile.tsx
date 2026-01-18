import React from 'react';
import { Trophy, Medal, Star, TrendingUp, TrendingDown, Minus, Crown, Zap } from 'lucide-react';
import { UserRankingProfile as UserRankingProfileType } from '@/types/ranking';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UserRankingProfileProps {
  profile: UserRankingProfileType;
  className?: string;
}

const getAchievementIcon = (type: string) => {
  switch (type) {
    case 'badge':
      return <Medal className="w-4 h-4" />;
    case 'points':
      return <Star className="w-4 h-4" />;
    case 'title':
      return <Crown className="w-4 h-4" />;
    default:
      return <Trophy className="w-4 h-4" />;
  }
};

const getRankingIcon = (type: string) => {
  switch (type) {
    case 'messages_sent':
      return <Trophy className="w-4 h-4 text-blue-600" />;
    case 'response_speed':
      return <Zap className="w-4 h-4 text-green-600" />;
    case 'engagement_balance':
      return <Star className="w-4 h-4 text-purple-600" />;
    case 'consistency':
      return <TrendingUp className="w-4 h-4 text-orange-600" />;
    case 'evolution':
      return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    default:
      return <Crown className="w-4 h-4 text-muted-foreground" />;
  }
};

const getTrendIcon = (trend: string) => {
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

export const UserRankingProfile: React.FC<UserRankingProfileProps> = ({ profile, className }) => {
  return (
    <Card className={cn(
      "hover:shadow-lg transition-shadow",
      className
    )}>
      <CardHeader>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl">
            {profile.userId?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <CardTitle className="text-xl mb-2">Seu Perfil de Ranking</CardTitle>
          <div className="text-2xl text-yellow-600">
            #{profile.overallRank}
          </div>
          <div className="text-sm text-muted-foreground">Ranking Geral</div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl">{profile.stats.totalScore}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Score Total</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl">{profile.stats.averageRank}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Rank Médio</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl">#{profile.stats.bestRank}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Melhor Rank</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl">{profile.stats.streak}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Sequência</div>
          </div>
        </div>

        {/* Individual Rankings */}
        <div className="mb-6">
          <h4 className="text-lg mb-4">Rankings Individuais</h4>
          <div className="space-y-3">
            {Object.entries(profile.rankings).map(([type, ranking]) => (
              <div
                key={type}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getRankingIcon(type)}
                  <div>
                    <div className="capitalize">
                      {type.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Score: {ranking.score.toFixed(1)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="">
                      #{ranking.currentRank}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Melhor: #{ranking.bestRank}
                    </div>
                  </div>
                  {getTrendIcon(ranking.trend)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        {profile.achievements.length > 0 && (
          <div>
            <h4 className="text-lg mb-4">Conquistas</h4>
            <div className="grid grid-cols-1 gap-3">
              {profile.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                    {getAchievementIcon(achievement.reward?.type || 'badge')}
                  </div>
                  <div className="flex-1">
                    <div className="">{achievement.name}</div>
                    <div className="text-xs text-muted-foreground">{achievement.description}</div>
                  </div>
                  {achievement.unlockedAt && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Participation Stats */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg">{profile.stats.participationDays}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Dias Ativos</div>
            </div>
            <div>
              <div className="text-lg">
                {profile.achievements.length}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Conquistas</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
