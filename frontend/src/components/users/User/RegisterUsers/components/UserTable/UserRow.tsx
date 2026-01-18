import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageCircle, CheckCircle, XCircle } from 'lucide-react';
import { useRoles } from '@/hooks/useRoles';
import { User, LoadingStates } from '../../types';
import { getImageUrl, getRoleStyle } from '../../utils/userHelpers';
import UserActions from './UserActions';

interface UserRowProps {
  user: User;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onInvite: () => void;
  onGenerateLink: () => void;
  onRestore: () => void;
  onHardDelete: () => void;
  loadingStates: LoadingStates;
  inviteLoadingStates: LoadingStates;
  linkLoadingStates: LoadingStates;
  deleteLoadingStates: LoadingStates;
  isActive: boolean;
}

const UserRow: React.FC<UserRowProps> = ({
  user,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onInvite,
  onGenerateLink,
  onRestore,
  onHardDelete,
  loadingStates,
  inviteLoadingStates,
  linkLoadingStates,
  deleteLoadingStates,
  isActive
}) => {
  const { roles, loading: rolesLoading } = useRoles();
  
  const getUserRole = () => {
    if (rolesLoading) {
      return {
        name: 'Carregando...',
        style: 'bg-gray-100 text-gray-600'
      };
    }
    
    // Buscar role pelo role_id
    const userRole = roles.find(r => r.id === user.role_id);
    
    // Determinar role name
    let roleName = 'N/A';
    if (userRole) {
      roleName = userRole.name;
    } else if (user.user_role) {
      roleName = user.user_role;
    }
    
    // Aplicar opacidade para usuários inativos
    const baseStyle = getRoleStyle(roleName);
    const style = !isActive ? `${baseStyle} opacity-75` : baseStyle;
    
    return { name: roleName, style };
  };

  const roleInfo = getUserRole();
  const rowClass = isActive 
    ? "border-b hover:bg-gray-50" 
    : "border-b bg-red-50/60 hover:bg-red-50/80";

  return (
    <tr className={rowClass}>
      {/* Seleção */}
      <td className="p-1 sm:p-2 text-center">
        <Checkbox 
          checked={isSelected}
          onCheckedChange={onSelect}
          className="h-3 w-3 sm:h-4 sm:w-4"
        />
      </td>

      {/* Avatar */}
      <td className="p-1 sm:p-2">
        {user.avatar_url ? (
          <img 
            src={getImageUrl(user.avatar_url) || ''} 
            alt={user.name} 
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover ${!isActive ? 'opacity-50' : ''}`}
          />
        ) : (
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs sm:text-sm ${!isActive ? 'opacity-50' : ''}`}>
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </td>

      {/* Nome */}
      <td className={`p-1 sm:p-2 truncate text-xs sm:text-sm ${!isActive ? 'text-gray-600' : ''}`}>
        {user.name}
      </td>

      {/* Email */}
      <td className={`p-1 sm:p-2 truncate hidden md:table-cell text-xs sm:text-sm ${!isActive ? 'text-gray-600' : ''}`}>
        {user.email || '-'}
      </td>

      {/* Role */}
      <td className="p-1 sm:p-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${roleInfo.style}`}>
          {roleInfo.name}
        </span>
      </td>

      {/* Nome no Chat */}
      <td className="p-1 sm:p-2 truncate hidden lg:table-cell">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <MessageCircle className="text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
          <span className={`text-xs px-1 sm:px-2 py-1 rounded-full ${
            user.show_name_in_chat 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-700'
          } ${!isActive ? 'opacity-75' : ''}`}>
            {user.show_name_in_chat ? 'Ativado' : 'Desativado'}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="p-1 sm:p-2">
        {isActive ? (
          user.is_online ? (
            <span className="flex items-center gap-1 text-green-600 text-xs sm:text-sm">
              <CheckCircle className="w-3 h-3" /> 
              <span className="hidden sm:inline">Online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
              <XCircle className="w-3 h-3" /> 
              <span className="hidden sm:inline">Offline</span>
            </span>
          )
        ) : (
          <span className="flex items-center gap-1 text-red-600 opacity-75 text-xs sm:text-sm">
            <XCircle className="w-3 h-3" /> 
            <span className="hidden sm:inline">Desativado</span>
          </span>
        )}
      </td>

      {/* Data */}
      <td className={`p-1 sm:p-2 truncate hidden md:table-cell text-xs ${!isActive ? 'text-gray-600' : ''}`}>
        {isActive 
          ? (user.last_seen ? new Date(user.last_seen).toLocaleString() : '-')
          : (user.deleted_at ? new Date(user.deleted_at).toLocaleDateString() : '-')
        }
      </td>

      {/* Ações */}
      <td className="p-1 sm:p-2 text-center">
        <UserActions
          user={user}
          isActive={isActive}
          onEdit={onEdit}
          onDelete={onDelete}
          onInvite={onInvite}
          onGenerateLink={onGenerateLink}
          onRestore={onRestore}
          onHardDelete={onHardDelete}
          loadingStates={loadingStates}
          inviteLoadingStates={inviteLoadingStates}
          linkLoadingStates={linkLoadingStates}
          deleteLoadingStates={deleteLoadingStates}
        />
      </td>
    </tr>
  );
};

export default UserRow;