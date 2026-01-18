
import React from 'react';
import { Bell, X, MessageCircle, AlertTriangle, User } from 'lucide-react';
import { Notification } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ChatNotificationsProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

const ChatNotifications = ({ notifications, onMarkAsRead, onClearAll }: ChatNotificationsProps) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message': return <MessageCircle size={16} />;
      case 'assignment': return <User size={16} />;
      case 'mention': return <Bell size={16} />;
      case 'priority': return <AlertTriangle size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'message': return 'text-blue-500';
      case 'assignment': return 'text-green-500';
      case 'mention': return 'text-yellow-500';
      case 'priority': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Bell size={48} className="mx-auto mb-2 opacity-50" />
        <p>Nenhuma notificação</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bell size={18} />
          <span className="">Notificações</span>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar tudo
          </button>
        )}
      </div>

      <div className="space-y-1">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={cn(
              "p-3 border-b border-border cursor-pointer hover:bg-accent transition-colors",
              !notification.read && "bg-accent/50"
            )}
            onClick={() => onMarkAsRead(notification.id)}
          >
            <div className="flex items-start space-x-3">
              <div className={cn("mt-0.5", getNotificationColor(notification.type))}>
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm"
                )}>
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </p>
              </div>
              {!notification.read && (
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatNotifications;
