import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MessageCircle } from 'lucide-react';
import { useRoles } from '@/hooks/useRoles';
import { useAuth } from '@/hooks/useAuth';
import { UserForm as UserFormType } from '../../types';
import { getAvailableRoles, getRolePermissionsText } from '../../utils/roleHelpers';
import AvatarUpload from './AvatarUpload';
import PermissionsInfo from './PermissionsInfo';

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  editUser: any | null;
  form: UserFormType;
  loading: boolean;
  error: string;
  success: string;
  showPassword: string;
  avatarFile: File | null;
  avatarPreview: string;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormUpdate: (updates: Partial<UserFormType>) => void;
}

const UserForm: React.FC<UserFormProps> = ({
  open,
  onClose,
  editUser,
  form,
  loading,
  error,
  success,
  showPassword,
  avatarFile,
  avatarPreview,
  onFormChange,
  onAvatarChange,
  onSubmit,
  onFormUpdate
}) => {
  const { roles, loading: rolesLoading } = useRoles();
  const { profile } = useAuth();
  
  const availableRoles = getAvailableRoles(roles, profile?.role_id);

  const handleSelectChange = (name: string, value: string) => {
    onFormChange({ target: { name, value } } as any);
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] sm:max-w-xl flex flex-col">
        <div className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editUser ? 'Editar Usuário' : 'Cadastrar Usuário'}
            </DialogTitle>
          </DialogHeader>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <form id="user-form" className="space-y-4 sm:space-y-6" onSubmit={onSubmit}>
            
            {/* Avatar Upload */}
            <AvatarUpload
              avatarPreview={avatarPreview}
              editUser={editUser}
              avatarFile={avatarFile}
              onAvatarChange={onAvatarChange}
            />

            {/* Nome */}
            <div>
              <Label htmlFor="name" className="text-sm">Nome</Label>
              <Input 
                id="name" 
                name="name" 
                value={form.name} 
                onChange={onFormChange} 
                required 
                className="mt-1"
                placeholder="Digite o nome completo"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-sm">E-mail</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                value={form.email} 
                onChange={onFormChange} 
                required 
                className="mt-1"
                placeholder="Digite o email do usuário"
              />
            </div>

            {/* Role */}
            <div>
              <Label htmlFor="role_id" className="text-sm">Nível de acesso</Label>
              <Select 
                value={form.role_id} 
                onValueChange={(value) => handleSelectChange('role_id', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o nível de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {!profile ? (
                    <SelectItem value="" disabled>Carregando perfil...</SelectItem>
                  ) : rolesLoading ? (
                    <SelectItem value="" disabled>Carregando roles...</SelectItem>
                  ) : availableRoles.length === 0 ? (
                    <SelectItem value="" disabled>
                      {(() => {
                        const currentUserRole = roles.find(role => role.id === profile.role_id);
                        const userRoleName = currentUserRole?.name?.toLowerCase();
                        return userRoleName?.includes('agent') 
                          ? 'Agentes não podem criar usuários' 
                          : 'Nenhuma role disponível para sua hierarquia';
                      })()}
                    </SelectItem>
                  ) : (
                    availableRoles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <span>{role.name}</span>
                          {role.is_default && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Padrão</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {/* Permissões da role selecionada */}
              {form.role_id && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs sm:text-sm text-muted-foreground">
                  {(() => {
                    const selectedRole = availableRoles.find(r => r.id === form.role_id);
                    if (selectedRole) {
                      const permissions = getRolePermissionsText(selectedRole);
                      return `Permissões: ${permissions}`;
                    }
                    return '';
                  })()}
                </div>
              )}
            </div>

            {/* Informações sobre permissões */}
            <PermissionsInfo />


            {/* Nova senha (apenas no modo edição) */}
            {editUser && (
              <div>
                <Label htmlFor="newPassword" className="text-sm">Nova senha</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={form.newPassword || ''}
                  onChange={onFormChange}
                  placeholder="Deixe em branco para não alterar"
                  minLength={6}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Preencha para alterar a senha do usuário (mínimo 6 caracteres).
                </p>
              </div>
            )}

            {/* Senha padrão (apenas no modo criação) */}
            {!editUser && (
              <div>
                <Label className="text-sm">Senha padrão do usuário</Label>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center mt-1">
                  <Input 
                    value={form.password} 
                    readOnly 
                    className="flex-1 font-mono text-sm bg-gray-50" 
                  />
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {navigator.clipboard.writeText(form.password)}}
                    className="w-full sm:w-auto"
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  O usuário poderá alterar a senha após o primeiro acesso.
                </p>
              </div>
            )}

            {/* Mensagens de erro e sucesso */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="text-red-500 text-sm">⚠️</div>
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="text-green-500 text-sm">✅</div>
                  <div className="text-green-700 text-sm">{success}</div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              form="user-form" 
              disabled={loading} 
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {loading ? 'Salvando...' : (editUser ? 'Salvar' : 'Cadastrar')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserForm;