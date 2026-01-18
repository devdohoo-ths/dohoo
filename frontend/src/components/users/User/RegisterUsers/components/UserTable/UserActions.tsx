import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Mail, UserMinus, RotateCcw, Trash2, Link } from 'lucide-react';
import { User, LoadingStates } from '../../types';

interface UserActionsProps {
  user: User;
  isActive: boolean;
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
}

const UserActions: React.FC<UserActionsProps> = ({
  user,
  isActive,
  onEdit,
  onDelete,
  onInvite,
  onGenerateLink,
  onRestore,
  onHardDelete,
  loadingStates,
  inviteLoadingStates,
  linkLoadingStates,
  deleteLoadingStates
}) => {
  if (isActive) {
    // Ações para usuários ativos
    return (
      <div className="flex items-center justify-center gap-1">
        {/* Editar */}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onEdit} 
          title="Editar usuário"
          className="h-6 w-6 sm:h-8 sm:w-8 p-0"
        >
          <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
        </Button>

        {/* Enviar convite */}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onInvite}
          disabled={inviteLoadingStates[user.id]}
          title="Enviar convite WhatsApp"
          className="border-green-300 text-green-600 hover:bg-green-50 h-6 w-6 sm:h-8 sm:w-8 p-0"
        >
          {inviteLoadingStates[user.id] ? (
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
        </Button>

        {/* Gerar link de conexão */}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onGenerateLink}
          disabled={linkLoadingStates[user.id]}
          title="Gerar link de conexão"
          className="border-blue-300 text-blue-600 hover:bg-blue-50 h-6 w-6 sm:h-8 sm:w-8 p-0"
        >
          {linkLoadingStates[user.id] ? (
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Link className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
        </Button>

        {/* Desativar */}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onDelete} 
          disabled={deleteLoadingStates[user.id]}
          title="Desativar usuário"
          className="border-orange-300 text-orange-600 hover:bg-orange-50 h-6 w-6 sm:h-8 sm:w-8 p-0"
        >
          {deleteLoadingStates[user.id] ? (
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <UserMinus className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
        </Button>
      </div>
    );
  } else {
    // Ações para usuários inativos
    return (
      <div className="flex items-center justify-center gap-1">
        {/* Reativar */}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onRestore} 
          disabled={loadingStates[user.id]}
          title="Reativar usuário"
          className="border-blue-300 text-blue-600 hover:bg-blue-50 h-6 w-6 sm:h-8 sm:w-8 p-0"
        >
          {loadingStates[user.id] ? (
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
        </Button>

        {/* Excluir permanentemente */}
        <Button 
          size="sm" 
          variant="destructive" 
          onClick={onHardDelete} 
          disabled={loadingStates[user.id]}
          title="Excluir permanentemente"
          className="h-6 w-6 sm:h-8 sm:w-8 p-0"
        >
          {loadingStates[user.id] ? (
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
        </Button>
      </div>
    );
  }
};

export default UserActions;