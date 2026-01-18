import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield } from 'lucide-react';
import { User, LoadingStates } from '../../types';
import UserRow from './UserRow';

interface UserTableProps {
  users: User[];
  selectedUsers: string[];
  onSelectUser: (userId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onInvite: (user: User) => void;
  onGenerateLink: (user: User) => void;
  onRestore: (userId: string) => void;
  onHardDelete: (userId: string) => void;
  loadingStates: LoadingStates;
  inviteLoadingStates: LoadingStates;
  linkLoadingStates: LoadingStates;
  deleteLoadingStates: LoadingStates;
  isActive: boolean;
}

const UserTable: React.FC<UserTableProps> = ({
  users,
  selectedUsers,
  onSelectUser,
  onSelectAll,
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
  const allSelected = users.length > 0 && users.every(user => selectedUsers.includes(user.id));

  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <div className="sm:hidden text-xs text-gray-500 p-2 bg-gray-50 border-b">
        ← Deslize horizontalmente para ver mais colunas →
      </div>
      <table className="min-w-full text-xs sm:text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-1 sm:p-2 text-center w-8 sm:w-12">
              <Checkbox 
                checked={allSelected}
                onCheckedChange={onSelectAll}
                className="h-3 w-3 sm:h-4 sm:w-4"
              />
            </th>
            <th className="p-1 sm:p-2 text-left w-12 sm:w-16">Avatar</th>
            <th className="p-1 sm:p-2 text-left min-w-24 sm:min-w-32">Nome</th>
            <th className="p-1 sm:p-2 text-left min-w-32 sm:min-w-48 hidden md:table-cell">E-mail</th>
            <th className="p-1 sm:p-2 text-left w-20 sm:w-28">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                <span>Nível</span>
              </div>
            </th>
            <th className="p-1 sm:p-2 text-left w-20 sm:w-28 hidden lg:table-cell">Nome no Chat</th>
            <th className="p-1 sm:p-2 text-left w-16 sm:w-24">Status</th>
            <th className="p-1 sm:p-2 text-left w-24 sm:w-36 hidden md:table-cell">Data</th>
            <th className="p-1 sm:p-2 text-center w-20 sm:w-32">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <UserRow
              key={user.id}
              user={user}
              isSelected={selectedUsers.includes(user.id)}
              onSelect={(checked) => onSelectUser(user.id, checked)}
              onEdit={() => onEdit(user)}
              onDelete={() => onDelete(user.id)}
              onInvite={() => onInvite(user)}
              onGenerateLink={() => onGenerateLink(user)}
              onRestore={() => onRestore(user.id)}
              onHardDelete={() => onHardDelete(user.id)}
              loadingStates={loadingStates}
              inviteLoadingStates={inviteLoadingStates}
              linkLoadingStates={linkLoadingStates}
              deleteLoadingStates={deleteLoadingStates}
              isActive={isActive}
            />
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center p-4 text-muted-foreground text-xs sm:text-sm">
                {isActive ? 'Nenhum usuário ativo encontrado.' : 'Nenhum usuário desativado encontrado.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;