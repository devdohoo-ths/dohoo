export interface RankingUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role_name?: string;
  department?: string;
  team?: string;
}

export interface RankingEntry {
  user: RankingUser;
  position: number;
  score: number;
  metric: number;
  change?: number; // Percentual de mudança comparado ao período anterior
  trend?: 'up' | 'down' | 'stable';
  badge?: 'gold' | 'silver' | 'bronze' | 'none';
}

export interface RankingData {
  id: string;
  title: string;
  description: string;
  type: RankingType;
  period: RankingPeriod;
  entries: RankingEntry[];
  totalUsers: number;
  lastUpdated: string;
  metadata?: {
    averageScore?: number;
    topScore?: number;
    participationRate?: number;
  };
}

export type RankingType = 
  | 'messages_sent'           // Top Respondentes
  | 'response_speed'          // Ranking de Velocidade
  | 'engagement_balance'      // Ranking por Equilíbrio
  | 'consistency'             // Ranking de Consistência
  | 'evolution'               // Ranking de Evolução
  | 'total_activity';         // Atividade Total

export type RankingPeriod = 
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export interface RankingFilters {
  period: RankingPeriod;
  department?: string[];
  team?: string[];
  role?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface RankingStats {
  totalMessages: number;
  averageResponseTime: number;
  totalUsers: number;
  activeUsers: number;
  engagementRate: number;
  consistencyScore: number;
}

export interface RankingLeaderboard {
  id: string;
  name: string;
  description: string;
  icon: string;
  rankings: RankingData[];
  isActive: boolean;
  sortOrder: number;
}

export interface RankingAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: {
    metric: string;
    threshold: number;
    period: RankingPeriod;
  };
  reward?: {
    type: 'badge' | 'points' | 'title';
    value: string | number;
  };
  unlockedAt?: string;
  userId?: string;
}

export interface UserRankingProfile {
  userId: string;
  overallRank: number;
  achievements: RankingAchievement[];
  stats: {
    totalScore: number;
    averageRank: number;
    bestRank: number;
    participationDays: number;
    streak: number;
  };
  rankings: {
    [key in RankingType]?: {
      currentRank: number;
      bestRank: number;
      score: number;
      trend: 'up' | 'down' | 'stable';
    };
  };
}
