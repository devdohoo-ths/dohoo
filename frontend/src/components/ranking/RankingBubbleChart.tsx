import React from 'react';
import { RankingData } from '@/types/ranking';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RankingBubbleChartProps {
  ranking: RankingData;
  className?: string;
  maxBubbles?: number;
}

const getBubbleSize = (score: number, maxScore: number, minSize = 20, maxSize = 80) => {
  if (maxScore === 0) return minSize;
  const ratio = score / maxScore;
  return minSize + (maxSize - minSize) * ratio;
};

const getBubbleColor = (position: number) => {
  if (position === 1) return 'bg-yellow-500';
  if (position === 2) return 'bg-gray-400';
  if (position === 3) return 'bg-orange-500';
  if (position <= 10) return 'bg-blue-600';
  return 'bg-purple-600';
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

export const RankingBubbleChart: React.FC<RankingBubbleChartProps> = ({ 
  ranking, 
  className,
  maxBubbles = 15 
}) => {
  const displayEntries = ranking.entries.slice(0, maxBubbles);
  const maxScore = Math.max(...displayEntries.map(entry => entry.score));
  const minScore = Math.min(...displayEntries.map(entry => entry.score));

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
        {/* Bubble Chart Container */}
        <div className="relative w-full h-80 overflow-hidden rounded-lg bg-muted/50 border">
          {/* Grid Lines */}
          <div className="absolute inset-0 opacity-20">
            <div className="grid grid-cols-4 grid-rows-4 h-full w-full">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="border border-border"></div>
              ))}
            </div>
          </div>

        {/* Bubbles */}
        <div className="absolute inset-0 p-4">
          {displayEntries.map((entry, index) => {
            const size = getBubbleSize(entry.score, maxScore);
            const bubbleColor = getBubbleColor(entry.position);
            
            // Posicionamento pseudo-aleatório baseado no índice para evitar sobreposição
            const x = (index % 4) * 25 + (Math.random() * 15) + 5; // 0-100%
            const y = Math.floor(index / 4) * 25 + (Math.random() * 15) + 5; // 0-100%
            
            return (
              <div
                key={entry.user.id}
                className={cn(
                  "absolute rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white/20",
                  "hover:scale-110 transition-all duration-300 cursor-pointer",
                  "group relative"
                )}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Bubble Background */}
                <div className={cn(
                  "w-full h-full rounded-full flex items-center justify-center",
                  bubbleColor
                )}>
                  {size > 30 ? (
                    <span className="text-sm">
                      {entry.user.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  ) : (
                    <span className="text-xs">
                      {entry.position}
                    </span>
                  )}
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="bg-card text-card-foreground text-xs rounded-lg px-3 py-2 shadow-lg border whitespace-nowrap">
                    <div className="">{entry.user.name || 'Usuário Anônimo'}</div>
                    <div className="text-muted-foreground">
                      #{entry.position} • {formatScore(entry.score, ranking.type)}
                    </div>
                    {entry.user.role_name && (
                      <div className="text-muted-foreground text-xs">
                        {entry.user.role_name}
                      </div>
                    )}
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-card"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 right-2">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Top 3</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600"></div>
              <span>Top 10</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-600"></div>
              <span>Outros</span>
            </div>
          </div>
        </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Participantes</div>
            <div className="text-lg">{ranking.totalUsers}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Melhor Score</div>
            <div className="text-lg">
              {ranking.metadata?.topScore?.toFixed(1) || 'N/A'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Média</div>
            <div className="text-lg">
              {ranking.metadata?.averageScore?.toFixed(1) || 'N/A'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
