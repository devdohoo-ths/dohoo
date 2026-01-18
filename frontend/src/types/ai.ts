export interface AIProvider {
  id: string;
  name: string;
  models: string[];
  features: {
    text: boolean;
    audio: boolean;
    image: boolean;
  };
  pricing?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AISession {
  id: string;
  title: string;
  provider: string;
  model: string;
  messages: any[];
  createdAt: Date;
  rating?: number;
  assistant?: AIAssistant;
}

export interface AIAssistant {
  id: string;
  user_id?: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  avatar_url: string | null;
  personality: string | null;
  instructions: string;
  model: string;
  provider: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tags: string[] | null;
  business_hours: any | null;
  assistant_type?: 'individual' | 'organizational';
  is_organizational: boolean;
  performance?: {
    totalInteractions: number;
    averageRating: number;
    responseTime: number;
  };
  // Audio configuration
  audio_enabled?: boolean;
  audio_transcription?: boolean;
  audio_synthesis?: boolean;
  audio_voice?: string;
  audio_provider?: string;
  audio_model?: string;
  
  // Image configuration
  image_enabled?: boolean;
  image_provider?: string;
  image_model?: string;
  image_size?: string;
}

export interface TrainingData {
  id: string;
  assistant_id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[] | null;
  validated: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  assistant_id: string;
  title: string;
  content: string;
  type: 'faq' | 'procedure' | 'policy' | 'general';
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
} 