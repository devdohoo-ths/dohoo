
import React, { useState } from 'react';
import { Star, MessageCircle, Phone, Video, MoreVertical, Bell, Archive, Users } from 'lucide-react';
import { Chat } from '@/types/chat';
import { cn } from '@/lib/utils';
import ChatSearch from './ChatSearch';
import ChatNotifications from './ChatNotifications';

interface ChatListProps {
  chats: Chat[];
  activeChat?: string;
  onChatSelect: (chatId: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filter: string;
  onFilterChange: (filter: any) => void;
}

// ✅ OTIMIZAÇÃO: Memoizar componente para evitar re-renderizações desnecessárias
const ChatList = React.memo(({ 
  chats, 
  activeChat, 
  onChatSelect, 
  searchTerm, 
  onSearchChange,
  filter,
  onFilterChange 
}: ChatListProps) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const filterTabs = [
    { key: 'all', label: 'Todos', count: chats.length, icon: MessageCircle },
    { key: 'active', label: 'Ativos', count: chats.filter(c => c.status === 'active').length, icon: MessageCircle },
    { key: 'internal', label: 'Interno', count: chats.filter(c => c.platform === 'internal').length, icon: Users },
    { key: 'finished', label: 'Finalizados', count: chats.filter(c => c.status === 'finished').length, icon: Archive },
    { key: 'favorite', label: 'Favoritos', count: chats.filter(c => c.status === 'favorite').length, icon: Star },
  ];

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'whatsapp': return 'text-green-500';
      case 'instagram': return 'text-pink-500';
      case 'telegram': return 'text-blue-500';
      case 'internal': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  const mockNotifications = [
    {
      id: '1',
      chatId: '1',
      message: 'Nova mensagem de João Silva',
      type: 'message' as const,
      timestamp: new Date(),
      read: false
    }
  ];

  return (
    <div className="w-80 bg-card border-r border-border h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="">Conversas</h2>
            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-2 py-0.5 rounded font-medium">
              Dev
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-accent transition-colors relative"
            >
              <Bell size={18} />
              {mockNotifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {mockNotifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            <button className="p-2 rounded-lg hover:bg-accent transition-colors">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {showNotifications ? (
          <ChatNotifications
            notifications={mockNotifications}
            onMarkAsRead={(id) => console.log('Mark as read:', id)}
            onClearAll={() => console.log('Clear all notifications')}
          />
        ) : (
          <>
            <ChatSearch
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
              onFilterApply={(filters) => console.log('Apply filters:', filters)}
            />
            
            <div className="grid grid-cols-2 gap-1 mt-4">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onFilterChange(tab.key)}
                  className={cn(
                    "flex items-center justify-center px-3 py-2 text-xs rounded-md transition-colors",
                    filter === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <tab.icon size={14} className="mr-1" />
                  <span className="truncate">{tab.label}</span>
                  <span className="ml-1 opacity-75">({tab.count})</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onChatSelect(chat.id)}
            className={cn(
              "p-4 border-b border-border cursor-pointer transition-colors hover:bg-accent border-l-4",
              activeChat === chat.id ? "bg-accent" : "",
              getPriorityColor(chat.priority)
            )}
          >
            <div className="flex items-start space-x-3">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white">
                  {chat.platform === 'internal' ? (
                    <Users size={20} />
                  ) : (
                    chat.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card",
                  chat.isOnline ? "bg-green-500" : "bg-gray-400"
                )} />
                {chat.isTyping && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="truncate">{chat.name}</h3>
                    {chat.platform === 'internal' && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        Interno
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    {chat.status === 'favorite' && (
                      <Star className="text-yellow-500" size={14} />
                    )}
                    <MessageCircle className={getPlatformColor(chat.platform)} size={14} />
                  </div>
                </div>
                
                <p className={cn(
                  "text-sm truncate mt-1",
                  chat.lastMessage.isInternal ? "text-purple-600" : "text-muted-foreground"
                )}>
                  {chat.lastMessage.isImportant && "⭐ "}
                  {chat.lastMessage.isInternal && "🔒 "}
                  {chat.lastMessage.content}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {chat.assignedAgent && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {chat.assignedAgent}
                      </span>
                    )}
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>

                {chat.department && (
                  <div className="mt-1">
                    <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded">
                      {chat.department}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ChatList.displayName = 'ChatList';

export default ChatList;
