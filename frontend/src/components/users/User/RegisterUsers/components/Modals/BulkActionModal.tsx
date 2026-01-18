import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, UserMinus, RotateCcw, Trash2 } from 'lucide-react';
import { BulkActionType, User } from '../../types';
import { getImageUrl } from '../../utils/userHelpers';

interface BulkActionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  action: BulkActionType | null;
  selectedUsers: string[];
  users: User[];
}

const BulkActionModal: React.FC<BulkActionModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading,
  action,
  selectedUsers,
  users
}) => {
  const selectedUserObjects = users.filter(user => selectedUsers.includes(user.id));

  const getActionInfo = () => {
    switch (action) {
      case 'invite':
        return {
          icon: <Send className="w-8 h-8 text-green-600" />,
          title: `Enviar convites para ${selectedUsers.length} usuários?`,
          description: 'Convites serão enviados para todos os usuários selecionados.',
          bgColor: 'bg-green-100',
          buttonText: 'Enviar Convites',
          buttonVariant: 'default' as const
        };
      case 'delete':
        return {
          icon: <UserMinus className="w-8 h-8 text-orange-600" />,
          title: `Desativar ${selectedUsers.length} usuários?`,
          description: 'Os usuários selecionados serão desativados mas podem ser reativados posteriormente.',
          bgColor: 'bg-orange-100',
          buttonText: 'Desativar Usuários',
          buttonVariant: 'destructive' as const
        };
      case 'restore':
        return {
          icon: <RotateCcw className="w-8 h-8 text-blue-600" />,
          title: `Reativar ${selectedUsers.length} usuários?`,
          description: 'Os usuários selecionados serão reativados e poderão acessar o sistema novamente.',
          bgColor: 'bg-blue-100',
          buttonText: 'Reativar Usuários',
          buttonVariant: 'default' as const
        };
      case 'hardDelete':
        return {
          icon: <Trash2 className="w-8 h-8 text-red-600" />,
          title: `Excluir permanentemente ${selectedUsers.length} usuários?`,
          description: 'Esta ação é irreversível! Os usuários serão removidos permanentemente do sistema.',
          bgColor: 'bg-red-100',
          buttonText: 'Excluir Permanentemente',
          buttonVariant: 'destructive' as const
        };
      default:
        return {
          icon: null,
          title: '',
          description: '',
          bgColor: 'bg-gray-100',
          buttonText: '',
          buttonVariant: 'default' as const
        };
    }
  };

  const actionInfo = getActionInfo();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === 'invite' && 'Enviar Convites em Massa'}
            {action === 'delete' && 'Desativar Usuários em Massa'}
            {action === 'restore' && 'Reativar Usuários em Massa'}
            {action === 'hardDelete' && 'Excluir Usuários Permanentemente'}
          </DialogTitle>
          <DialogDescription>
            {actionInfo.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center">
              <div className={`${actionInfo.bgColor} rounded-full p-3`}>
                {actionInfo.icon}
              </div>
            </div>
            <h3 className="text-lg">{actionInfo.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{actionInfo.description}</p>
          </div>
          
          {/* Aviso especial para hard delete */}
          {action === 'hardDelete' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xs">!</span>
                </div>
                <h4 className="text-red-900">Ação Irreversível</h4>
              </div>
              <p className="text-sm text-red-800 mt-2">
                Esta ação não pode ser desfeita. Todos os dados dos usuários selecionados serão perdidos permanentemente.
              </p>
            </div>
          )}

          {/* Lista dos usuários selecionados */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-gray-900 mb-2">Usuários selecionados:</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {selectedUserObjects.map(user => (
                <div key={user.id} className="text-sm text-gray-700 flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    {user.avatar_url ? (
                      <img src={getImageUrl(user.avatar_url) || ''} alt={user.name} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {user.name}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user.deleted_at 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {user.deleted_at ? 'Desativado' : 'Ativo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            variant={actionInfo.buttonVariant}
            onClick={onConfirm} 
            disabled={loading}
            className={action === 'hardDelete' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {loading ? 'Processando...' : actionInfo.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkActionModal;