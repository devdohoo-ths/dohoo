
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'agent' | 'manager';
  department: string;
  isOnline: boolean;
  lastSeen: Date;
  permissions: UserPermission[];
  settings: UserSettings;
  createdAt: Date;
}

export interface UserPermission {
  id: string;
  name: string;
  description: string;
  module: 'chat' | 'ai' | 'accounts' | 'settings' | 'analytics';
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'pt' | 'en' | 'es';
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
    desktop: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
  };
  chat: {
    autoReply: boolean;
    showTypingIndicator: boolean;
    messagePreview: boolean;
  };
}

export interface InternalChat {
  id: string;
  participants: User[];
  messages: InternalMessage[];
  isGroup: boolean;
  groupName?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface InternalMessage {
  id: string;
  chatId: string;
  senderId: string;
  sender: User;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  timestamp: Date;
  readBy: string[];
  mentions?: string[];
  replyTo?: string;
}
