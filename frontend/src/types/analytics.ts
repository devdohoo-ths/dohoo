
export interface ConversationAnalytics {
  id: string;
  chat_id: string;
  organization_id: string;
  analysis_data: {
    summary: string;
    topics: string[];
    issues: string[];
    satisfaction_indicators: string[];
    resolution_suggestions: string[];
  };
  keywords: string[];
  sentiment_score: number;
  interaction_count: number;
  resolution_status: 'pending' | 'resolved' | 'escalated' | 'closed';
  priority_level: 'low' | 'medium' | 'high' | 'urgent';
  customer_satisfaction: number;
  response_time_avg: number;
  created_at: Date;
  updated_at: Date;
  chats?: any;
}

export interface AnalyticsFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'all';
  resolution_status: string[];
  priority_level: string[];
  organization_id?: string;
}

export interface AnalyticsSummary {
  total_conversations: number;
  avg_sentiment: number;
  avg_satisfaction: number;
  avg_response_time: number;
  resolution_rate: number;
  top_keywords: Array<{ keyword: string; count: number }>;
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  priority_distribution: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  logo_url?: string;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface UserProfile {
  id: string;
  name?: string;
  organization_id?: string;
  user_role: 'super_admin' | 'admin' | 'agent';
  permissions: {
    chat: boolean;
    analytics: boolean;
    users: boolean;
    settings: boolean;
  };
  department?: string;
  avatar_url?: string;
}
