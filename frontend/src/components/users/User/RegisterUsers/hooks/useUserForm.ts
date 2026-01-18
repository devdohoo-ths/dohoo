import { useState, useCallback } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { UserForm, User } from '../types';
import { generatePassword } from '../utils/userHelpers';
import { getDefaultRole } from '../utils/roleHelpers';
import { Role } from '@/hooks/useRoles';

interface UseUserFormProps {
  roles: Role[];
  onSuccess: () => void;
  onUserCreated?: () => void;
}

export const useUserForm = ({ roles, onSuccess, onUserCreated }: UseUserFormProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const defaultRole = getDefaultRole(roles);
  
  const [form, setForm] = useState<UserForm>({
    name: '',
    email: '',
    role_id: defaultRole?.id || '',
    password: generatePassword(),
    show_name_in_chat: true,
    newPassword: ''
  });

  const openModal = useCallback((user?: User) => {
    console.log('🚀 openModal chamado:', { user, roles });
    
    setEditUser(user || null);

    if (user) {
      // Modo edição
      setForm({
        name: user.name || '',
        email: user.email || '',
        role_id: user.role_id || defaultRole?.id || '',
        password: '',
        show_name_in_chat: user.show_name_in_chat ?? true,
        newPassword: ''
      });
    } else {
      // Modo criação
      setForm({
        name: '',
        email: '',
        role_id: defaultRole?.id || '',
        password: generatePassword(),
        show_name_in_chat: true,
        newPassword: ''
      });
    }

    setShowPassword('');
    setModalOpen(true);
    setSuccess('');
    setError('');
    setAvatarFile(null);
    setAvatarPreview('');
  }, [roles, defaultRole]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditUser(null);
    setForm({
      name: '',
      email: '',
      role_id: defaultRole?.id || '',
      password: generatePassword(),
      show_name_in_chat: true,
      newPassword: ''
    });
    setShowPassword('');
    setSuccess('');
    setError('');
    setAvatarFile(null);
    setAvatarPreview('');
  }, [defaultRole]);

  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const uploadAvatar = async (userId: string) => {
    if (!avatarFile) return;
    
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      
      // ✅ CORRIGIDO: Usar await getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users/${userId}/avatar`, {
        method: 'POST',
        headers,
        body: formData
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro no upload do avatar.');
      
      return result;
    } catch (err: any) {
      console.error('Erro no upload do avatar:', err);
      throw err;
    }
  };

  const submitForm = useCallback(async (organizationId?: string) => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!form.name || !form.email || !form.role_id) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }

      // ✅ CORRIGIDO: Usar await getAuthHeaders()
      const headers = await getAuthHeaders();

      if (editUser) {
        // Atualizar usuário
        const response = await fetch(`${apiBase}/api/users/${editUser.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            role_id: form.role_id,
            show_name_in_chat: form.show_name_in_chat,
          })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao atualizar usuário.');

        // Upload do avatar se houver
        if (avatarFile) {
          await uploadAvatar(editUser.id);
        }

        // Alterar senha se fornecida
        if (form.newPassword && form.newPassword.length >= 6) {
          const response = await fetch(`${apiBase}/api/users/${editUser.id}/password`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ password: form.newPassword })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Erro ao alterar senha.');
        }

        setSuccess('Usuário atualizado com sucesso!');
      } else {
        // Criar novo usuário
        const response = await fetch(`${apiBase}/api/users/invite`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role_id: form.role_id,
            organization_id: organizationId,
            show_name_in_chat: form.show_name_in_chat,
          })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao cadastrar usuário.');

        setSuccess('Usuário cadastrado com sucesso!');
        setShowPassword(form.password);
        
        if (onUserCreated) {
          onUserCreated();
        }
      }
      
      onSuccess();
      
      if (!editUser) {
        setTimeout(closeModal, 3000);
      } else {
        setTimeout(closeModal, 1500);
      }
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setError(err.message || 'Erro ao salvar usuário.');
    } finally {
      setLoading(false);
    }
  }, [form, editUser, avatarFile, onSuccess, onUserCreated, closeModal]);

  return {
    // Estado
    modalOpen,
    editUser,
    form,
    loading,
    error,
    success,
    showPassword,
    avatarFile,
    avatarPreview,
    
    // Ações
    openModal,
    closeModal,
    handleFormChange,
    handleAvatarChange,
    submitForm,
    setForm
  };
};