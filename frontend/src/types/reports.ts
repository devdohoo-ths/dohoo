export interface ConversationReport {
  id: string;
  chatId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerDocument?: string;
  channel: 'whatsapp' | 'instagram' | 'telegram' | 'internal';
  agentName?: string;
  agentId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // em segundos
  status: 'in_progress' | 'closed' | 'unattended' | 'chatbot';
  tags: string[];
  totalMessages: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  department?: string;
  satisfaction?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  category?: string;
  internalNotes?: string;
  transfers: string[];
  aiAnalysis?: AIAnalysis;
}

export interface ReportFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  keywords?: string;
  channels?: string[];
  agents?: string[];
  departments?: string[];
  statuses?: string[];
  tags?: string[];
  priority?: string[];
  customers?: string[];
  conversationTypes?: string[];
}

export interface ReportStats {
  totalConversations: number;
  averageDuration: number;
  averageSatisfaction: number;
  abandonmentRate: number;
  channelDistribution: Record<string, number>;
  agentPerformance: Array<{
    agentId: string;
    agentName: string;
    totalConversations: number;
    averageDuration: number;
    averageSatisfaction: number;
    resolutionRate: number;
  }>;
  statusDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
  topKeywords: string[];
  peakHours: Array<{
    hour: number;
    count: number;
  }>;
}

export interface ConversationDetail {
  id: string;
  conversation: ConversationReport;
  messages: Array<{
    id: string;
    content: string;
    sender: 'agent' | 'customer';
    senderName?: string;
    timestamp: Date;
    message_type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker' | 'contact' | 'location';
    media_url?: string;
    isInternal?: boolean;
    isImportant?: boolean;
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    metadata?: {
      filename?: string;
      mimetype?: string;
      fileSize?: number;
      isVoiceMessage?: boolean;
      ai_generated?: boolean;
      bot_generated?: boolean;
      assistant_id?: string;
      tokens_used?: number;
      transcription?: string;
      agent_name?: string;
      show_name_in_chat?: boolean;
    };
  }>;
  timeline: Array<{
    timestamp: Date;
    event: string;
    description: string;
  }>;
}

export interface AIAnalysis {
  id: string;
  conversationId: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  category: string;
  keywords: string[];
  suggestions: string[];
  satisfaction: number;
  createdAt: Date;
  filters: ReportFilters;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeMessages?: boolean;
  includeAnalytics?: boolean;
  includeDetails?: boolean;
  includeAI?: boolean;
  includeStats?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: ReportFilters;
} 