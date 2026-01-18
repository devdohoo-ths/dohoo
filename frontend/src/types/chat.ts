
export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  type: 'text' | 'image' | 'audio' | 'file';
  isInternal?: boolean;
  isImportant?: boolean;
  status: 'sent' | 'delivered' | 'read';
  attachments?: Attachment[];
  replyTo?: string;
  edited?: boolean;
  editedAt?: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'audio' | 'video';
  url: string;
  size: number;
  thumbnail?: string;
}

export interface Chat {
  id: string;
  name: string;
  lastMessage: Message;
  unreadCount: number;
  status: 'active' | 'finished' | 'favorite' | 'archived';
  platform: 'whatsapp' | 'instagram' | 'telegram' | 'internal';
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  tags?: string[];
  assignedAgent?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isTyping?: boolean;
  participants?: string[];
  department?: string;
}

export interface ChatState {
  chats: Chat[];
  activeChat?: string;
  searchTerm: string;
  filter: 'all' | 'active' | 'finished' | 'favorite' | 'internal' | 'archived';
  selectedMessages: string[];
  isTyping: Record<string, boolean>;
  notifications: Notification[];
}

export interface Notification {
  id: string;
  chatId: string;
  message: string;
  type: 'message' | 'assignment' | 'mention' | 'priority';
  timestamp: Date;
  read: boolean;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

// Adicionar interface para contas WhatsApp
export interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  qr_code?: string;
  session_data?: any;
  created_at: Date;
  updated_at: Date;
  user_id: string;
}
