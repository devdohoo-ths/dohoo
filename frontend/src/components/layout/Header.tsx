import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useNavigate } from 'react-router-dom';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { useNotifications } from '@/hooks/useNotifications';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, ChevronDown, Inbox, X, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { OrganizationChat } from '@/components/chat/OrganizationChat';
import OrganizationSelector from './OrganizationSelector';

export const Header: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { accounts } = useWhatsAppAccounts({ disableErrorToasts: true });
  const { notifications, unreadCount, markAsRead, removeNotification } = useNotifications();
  const { hasPermission } = usePermissions();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Obter iniciais do nome ou email
  const getInitials = () => {
    if (profile?.name) {
      const names = profile.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return profile.name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Obter nome para exibir
  const getDisplayName = () => {
    if (profile?.name && profile.name !== user?.email) {
      return profile.name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuário';
  };

  // Obter nome da organização
  const getOrganizationName = () => {
    return organization?.name || profile?.organization?.name || 'Organização';
  };

  // Obter nome da role
  const getRoleName = () => {
    if (profile?.roles?.name) {
      return profile.roles.name;
    }
    if (profile?.role_name) {
      return profile.role_name;
    }
    return 'Usuário';
  };

  // Obter conta principal do usuário
  const mainAccount = useMemo(() => {
    const userAccounts = accounts.filter(acc => acc.user_id === user?.id);
    return userAccounts.find(acc => acc.status === 'connected') || userAccounts[0];
  }, [accounts, user?.id]);

  // Obter número de telefone
  const getPhoneNumber = () => {
    if (mainAccount?.phone_number) {
      return mainAccount.phone_number;
    }
    return null;
  };

  // Obter status da conta
  const getAccountStatus = () => {
    if (!mainAccount) return 'disconnected';
    return mainAccount.status || 'disconnected';
  };

  // Obter label do status
  const getStatusLabel = (status: string) => {
    const labels = {
      connected: 'Conectado',
      connecting: 'Conectando...',
      error: 'Erro',
      disconnected: 'Desconectado'
    };
    return labels[status as keyof typeof labels] || 'Desconectado';
  };

  // Obter cor do status
  const getStatusColor = (status: string) => {
    const colors = {
      connected: 'bg-green-500',
      connecting: 'bg-yellow-500',
      error: 'bg-red-500',
      disconnected: 'bg-gray-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const phoneNumber = getPhoneNumber();
  const accountStatus = getAccountStatus();
  const statusLabel = getStatusLabel(accountStatus);
  const statusColor = getStatusColor(accountStatus);

  return (
    <header className="w-full bg-transparent">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 border-b border-gray-200 mx-4 sm:mx-6 gap-4">
        {/* Seletor de Instância / Organização */}
        <div className="flex items-center">
          <OrganizationSelector 
            organization={organization} 
            variant="header" 
          />
        </div>

        {/* Status e Perfil à direita */}
        <div className="flex items-center gap-4">
        {/* Atalho para Contas WhatsApp */}
        {hasPermission('manage_accounts', true) && (
          <button
            onClick={() => navigate('/accounts')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
            title="Contas WhatsApp"
          >
            <Smartphone className="h-4 w-4 text-gray-600" />
            <span className="hidden sm:inline text-sm text-gray-700 font-medium">Contas WhatsApp</span>
          </button>
        )}

        {/* Chat com Assistente Virtual */}
        <OrganizationChat />

        {/* Ícone de Inbox com Notificações */}
        <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Inbox className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <div className="px-2 py-1.5 border-b">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Notificações</p>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Nenhuma notificação
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100",
                      !notification.read && "bg-blue-50"
                    )}
                    onClick={() => {
                      markAsRead(notification.id);
                      setIsNotificationsOpen(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          !notification.read && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="h-3 w-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status ao lado esquerdo do perfil */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-0.5 bg-white">
            {statusLabel}
          </span>
        </div>

        {/* Perfil alinhado à direita */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center text-gray-600">
                <User className="h-5 w-5" />
              </div>
              
              {/* Nome e role */}
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium text-gray-900">
                  {getDisplayName()}
                </span>
                <span className="text-xs text-gray-500">
                  {getRoleName()}
                </span>
              </div>
              
              {/* Ícone de dropdown */}
              <ChevronDown className={cn(
                "h-4 w-4 text-gray-500 transition-transform",
                isOpen && "rotate-180"
              )} />
            </button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-gray-900">{getDisplayName()}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              <p className="text-xs text-gray-500 mt-1">{getOrganizationName()}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              navigate('/user-settings');
              setIsOpen(false);
            }}>
              <User className="h-4 w-4 mr-2" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

