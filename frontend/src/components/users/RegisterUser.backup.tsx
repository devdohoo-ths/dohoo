import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/hooks/useOrganization';
import { useRoles } from '@/hooks/useRoles';
import { useAuth } from '@/hooks/useAuth';
import { 
  User as UserIcon, 
  Edit, 
  Trash2, 
  Shield, 
  Upload, 
  Download, 
  Search, 
  CheckCircle, 
  XCircle, 
  Mail, 
  MessageCircle, 
  RotateCcw, 
  UserMinus, 
  Camera, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  Users 
} from 'lucide-react';
import { apiBase } from '@/utils/apiBase';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// Função para construir URL completa da imagem
const getImageUrl = (imagePath: string | null) => {
  if (!imagePath) return null;
  
  // Se já é uma URL completa, retorna como está
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Se é um caminho relativo, adiciona o apiBase
  if (imagePath.startsWith('/')) {
    return `${apiBase}${imagePath}`;
  }
  
  // Se não tem barra, adiciona o apiBase com barra
  return `${apiBase}/${imagePath}`;
};

// Permissões agora são gerenciadas via sistema de roles

function generatePassword() {
  // Gera uma senha forte padrão
  return 'Dohoo@' + Math.floor(1000 + Math.random() * 9000);
}

const csvTemplate = `name;email;role_name;password\nJoão Silva;joao@email.com;Admin;Dohoo@1234\nMaria Souza;maria@email.com;Agente;Dohoo@5678`;

const RegisterUser: React.FC = () => {
  const { organization, loading: orgLoading } = useOrganization();
  const { roles, loading: rolesLoading } = useRoles();
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    role_id: string;
    password: string;
    show_name_in_chat: boolean;
    newPassword?: string;
  }>({
    name: '',
    email: '',
    role_id: '',
    password: '',
    show_name_in_chat: true,
    newPassword: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState('');
  const [search, setSearch] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [invitedUser, setInvitedUser] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [importedUsers, setImportedUsers] = useState<any[]>([]);
  const [newUsersForEmail, setNewUsersForEmail] = useState<any[]>([]);
  const [bulkActionModal, setBulkActionModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'invite' | 'delete' | 'restore' | 'hardDelete' | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);
  
  // Estados de loading específicos para evitar piscar dos ícones
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [inviteLoadingStates, setInviteLoadingStates] = useState<Record<string, boolean>>({});
  const [deleteLoadingStates, setDeleteLoadingStates] = useState<Record<string, boolean>>({});

  // Função para obter roles disponíveis baseado na hierarquia
  const getAvailableRoles = () => {
    if (!roles || !profile) return [];
    
    const currentUserRole = profile.user_role?.toLowerCase();
    
    // Filtrar roles baseado na hierarquia
    return roles.filter(role => {
      const roleName = role.name?.toLowerCase();
      
      // Agentes não podem ver nenhuma role
      if (currentUserRole === 'agent') {
        return false;
      }
      
      // Admins não podem ver roles de super admin
      if (currentUserRole === 'admin' && 
          (roleName?.includes('super') || roleName?.includes('super_admin'))) {
        return false;
      }
      
      return true;
    });
  };

  // Função para buscar usuários
  async function fetchUsers() {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/users?organization_id=${organization.id}`);
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Erro ao buscar usuários:', result.error);
        setError('Erro ao carregar usuários');
        return;
      }
      
      setUsers(
        (result.users || []).map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          user_role: user.user_role,
          role_id: user.role_id,
          created_at: user.created_at,
          avatar_url: user.avatar_url,
          is_online: user.is_online,
          last_seen: user.last_seen,
          show_name_in_chat: user.show_name_in_chat ?? true,
          deleted_at: user.deleted_at,
        }))
      );
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  // useEffect para buscar usuários
  useEffect(() => {
    if (organization?.id) {
      fetchUsers();
    }
  }, [organization?.id]);

  function openModal(user: any = null) {
    console.log('🚀 openModal chamado:', { user, roles, profile });
    
    setEditUser(user);

    // Buscar role padrão se não houver role selecionada
    const defaultRole = roles?.find(r => r.is_default);
    console.log('🎯 Role padrão:', defaultRole);
    
    const availableRoles = getAvailableRoles();
    console.log('📋 Roles disponíveis:', availableRoles.length);
    
    setForm(user ? {
      name: user.name || '',
      email: user.email || '',
      role_id: user.role_id || defaultRole?.id || '',
      password: '',
      show_name_in_chat: user.show_name_in_chat ?? true,
      newPassword: '',
    } : {
      name: '',
      email: '',
      role_id: defaultRole?.id || '',
      password: generatePassword(),
      show_name_in_chat: true,
      newPassword: '',
    });

    setShowPassword('');
    setModalOpen(true);
    setSuccess('');
    setError('');
  }

  function closeModal() {
    setModalOpen(false);
    setEditUser(null);
    const defaultRole = roles?.find(r => r.is_default);
    setForm({
      name: '',
      email: '',
      role_id: defaultRole?.id || '',
      password: '',
      show_name_in_chat: true,
      newPassword: '',
    });
    setShowPassword('');
    setSuccess('');
    setError('');
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    console.log('🔄 Iniciando cadastro de usuário...');
    console.log('📋 Dados do formulário:', form);
    console.log('🏢 Organização:', organization);

    // Permissões agora são gerenciadas via sistema de roles

    try {
      if (!form.name || !form.email || !form.role_id) {
        setError('Preencha todos os campos.');
        setLoading(false);
        return;
      }
              if (editUser) {
          // Atualizar usuário via backend
          console.log('✏️ Atualizando usuário existente...');
          const response = await fetch(`${apiBase}/api/users/${editUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
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

          // Se for para alterar senha
          if (form.newPassword && form.newPassword.length >= 6) {
            const response = await fetch(`${apiBase}/api/users/${editUser.id}/password`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: form.newPassword })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao alterar senha.');
          }

          setSuccess('Usuário atualizado com sucesso!');
          
          // Atualizar lista de usuários imediatamente
          fetchUsers();
      } else {
        // Chamar backend seguro para criar usuário
        console.log('👤 Criando novo usuário via backend...');
        const requestData = {
          name: form.name,
          email: form.email,
          password: form.password,
          role_id: form.role_id,
          organization_id: organization?.id,
          show_name_in_chat: form.show_name_in_chat,
        };
        
        console.log('📤 Dados enviados para o backend:', requestData);
        
        const response = await fetch(`${apiBase}/api/users/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        
        console.log('📥 Resposta do backend:', response.status, response.statusText);
        
        const result = await response.json();
        console.log('📋 Resultado do backend:', result);
        
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao cadastrar usuário.');
        }
              setSuccess('Usuário cadastrado com sucesso!');
      setShowPassword(form.password);
    }
    
    // Atualizar lista de usuários imediatamente
    fetchUsers();
    
    setSearch(''); // Limpar filtro de busca após cadastro
    if (!editUser) {
      // Se for um novo usuário, mostra a senha e fecha depois
      setTimeout(closeModal, 3000); // Dar mais tempo para ver a senha
    } else {
      // Se for edição, apenas fecha o modal
      setTimeout(closeModal, 1500);
    }
    } catch (err: any) {
      console.error('❌ Erro ao salvar usuário:', err);
      setError(err.message || 'Erro ao salvar usuário.');
    }
    setLoading(false);
  }

  async function handleDelete(userId: string) {
    setUserToDelete(userId);
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!userToDelete) return;
    
    // Set loading específico para este usuário
    setDeleteLoadingStates(prev => ({ ...prev, [userToDelete]: true }));
    
    try {
      const response = await fetch(`${apiBase}/api/users/${userToDelete}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao desativar usuário');
      }
      
      setSuccess('Usuário desativado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers();
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Erro ao desativar usuário:', err);
      setError(err.message);
    } finally {
      // Clear loading específico para este usuário
      setDeleteLoadingStates(prev => ({ ...prev, [userToDelete]: false }));
    }
  }

  // Função para enviar convite WhatsApp com loading específico
  const sendWhatsAppInvite = async (user: any) => {
    if (!organization) return;
    
    // Set loading específico para este usuário
    setInviteLoadingStates(prev => ({ ...prev, [user.id]: true }));
    setError('');
    
    try {
      const response = await fetch(`${apiBase}/api/invites/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.name,
          user_role: user.user_role || 'user', // Fallback se não tiver user_role
          permissions: user.permissions || {}, // Permissions da role do usuário
          organization_id: organization.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao enviar convite');
      }

      setSuccess(`Convite enviado com sucesso para ${user.email}!`);
      setTimeout(() => setSuccess(''), 5000);
      
      // Atualizar lista de usuários
      fetchUsers();
      
      // Mostrar modal de sucesso
      setInvitedUser(user);
      setShowSuccessModal(true);

    } catch (err: any) {
      console.error('Erro ao enviar convite:', err);
      setError(err.message);
    } finally {
      // Clear loading específico para este usuário
      setInviteLoadingStates(prev => ({ ...prev, [user.id]: false }));
    }
  };

  function handleCsvDownload() {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_usuarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  }



  // Separar usuários ativos e inativos
  const activeUsers = users.filter(user => !user.deleted_at);
  const inactiveUsersList = users.filter(user => user.deleted_at);

  // Filtro de busca baseado na aba ativa
  const currentTabUsers = activeTab === 'active' ? activeUsers : inactiveUsersList;
  const filteredUsers = currentTabUsers.filter(user =>
    user.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Limite de usuários permitido pela organização
  const maxUsers = organization?.max_users || 10;
  const userCount = activeUsers.length;
  
  // Debug: verificar valores
  console.log('🔍 Debug RegisterUser:', {
    organization: organization?.name,
    maxUsers,
    userCount,
    organizationData: organization
  });

  // Função para reativar usuário
  async function handleRestore(userId: string) {
    // Set loading específico para este usuário
    setLoadingStates(prev => ({ ...prev, [userId]: true }));
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/users/${userId}/restore`, {
        method: 'PATCH',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao reativar usuário.');
      setSuccess('Usuário reativado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers();
    } catch (err: any) {
      console.error('Erro ao reativar usuário:', err);
      setError(err.message);
    } finally {
      // Clear loading específico para este usuário
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  }

  // Função para hard delete
  async function handleHardDelete(userId: string) {
    // Set loading específico para este usuário
    setLoadingStates(prev => ({ ...prev, [userId]: true }));
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/users/${userId}/hard`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao excluir usuário.');
      setSuccess('Usuário excluído permanentemente!');
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers();
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      setError(err.message);
    } finally {
      // Clear loading específico para este usuário
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  }

  // Função para lidar com upload de avatar
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para fazer upload do avatar
  const uploadAvatar = async (userId: string) => {
    if (!avatarFile) return;

    const formData = new FormData();
    formData.append('avatar', avatarFile);

    try {
      const response = await fetch(`${apiBase}/api/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao fazer upload do avatar');

      setSuccess('Avatar atualizado com sucesso!');
      setAvatarFile(null);
      setAvatarPreview('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Funções para seleção em massa
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(currentUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  // Limpar seleção quando mudar de aba
  useEffect(() => {
    setSelectedUsers([]);
    setCurrentPage(1);
  }, [activeTab]);

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  // Função para ações em massa
  const handleBulkAction = async (action: 'invite' | 'delete' | 'restore' | 'hardDelete') => {
    if (selectedUsers.length === 0) return;

    setBulkAction(action);
    setBulkActionModal(true);
  };

  const confirmBulkAction = async () => {
    if (!bulkAction || selectedUsers.length === 0) return;

    setLoading(true);
    setError('');

    try {
      let successCount = 0;
      let errorCount = 0;

      if (bulkAction === 'invite') {
        // Enviar convites em massa
        for (const userId of selectedUsers) {
          try {
            const user = filteredUsers.find(u => u.id === userId);
            if (user) {
              await sendWhatsAppInvite(user);
              successCount++;
            }
          } catch (err) {
            console.error(`Erro ao enviar convite para ${userId}:`, err);
            errorCount++;
          }
        }
        
        if (errorCount > 0) {
          setSuccess(`${successCount} convites enviados com sucesso! ${errorCount} falharam.`);
        } else {
          setSuccess(`${successCount} convites enviados com sucesso!`);
        }
      } else if (bulkAction === 'delete') {
        // Desativar usuários em massa
        for (const userId of selectedUsers) {
          try {
            const response = await fetch(`${apiBase}/api/users/${userId}`, {
              method: 'DELETE',
            });
            const result = await response.json();
            if (response.ok) {
              successCount++;
            } else {
              console.error(`Erro ao desativar usuário ${userId}:`, result.error);
              errorCount++;
            }
          } catch (err) {
            console.error(`Erro ao desativar usuário ${userId}:`, err);
            errorCount++;
          }
        }
        
        if (errorCount > 0) {
          setSuccess(`${successCount} usuários desativados com sucesso! ${errorCount} falharam.`);
        } else {
          setSuccess(`${successCount} usuários desativados com sucesso!`);
        }
      } else if (bulkAction === 'restore') {
        // Reativar usuários em massa
        for (const userId of selectedUsers) {
          try {
            const response = await fetch(`${apiBase}/api/users/${userId}/restore`, {
              method: 'PATCH',
            });
            const result = await response.json();
            if (response.ok) {
              successCount++;
            } else {
              console.error(`Erro ao reativar usuário ${userId}:`, result.error);
              errorCount++;
            }
          } catch (err) {
            console.error(`Erro ao reativar usuário ${userId}:`, err);
            errorCount++;
          }
        }
        
        if (errorCount > 0) {
          setSuccess(`${successCount} usuários reativados com sucesso! ${errorCount} falharam.`);
        } else {
          setSuccess(`${successCount} usuários reativados com sucesso!`);
        }
      } else if (bulkAction === 'hardDelete') {
        // Excluir usuários permanentemente em massa
        for (const userId of selectedUsers) {
          try {
            const response = await fetch(`${apiBase}/api/users/${userId}/hard`, {
              method: 'DELETE',
            });
            const result = await response.json();
            if (response.ok) {
              successCount++;
            } else {
              console.error(`Erro ao excluir permanentemente usuário ${userId}:`, result.error);
              errorCount++;
            }
          } catch (err) {
            console.error(`Erro ao excluir permanentemente usuário ${userId}:`, err);
            errorCount++;
          }
        }
        
        if (errorCount > 0) {
          setSuccess(`${successCount} usuários removidos permanentemente! ${errorCount} falharam.`);
        } else {
          setSuccess(`${successCount} usuários removidos permanentemente!`);
        }
      }

      setSelectedUsers([]);
      setBulkActionModal(false);
      setBulkAction(null);
      
      // Recarregar lista de usuários
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para importar CSV melhorada
  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setCsvError('');
    setCsvSuccess('');
    setCsvUploading(true);
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const [header, ...rows] = lines;
      const columns = header.split(';'); // Usar ponto e vírgula
      
      // Validar cabeçalho
      const requiredColumns = ['name', 'email', 'role_name', 'password'];
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
      }
      
      const usersToInsert = rows.map((row, index) => {
        const values = row.split(';'); // Usar ponto e vírgula
        
        // Validar se tem o número correto de colunas
        if (values.length !== columns.length) {
          throw new Error(`Linha ${index + 2}: Número incorreto de colunas`);
        }
        
        const user: any = {};
        columns.forEach((col, i) => {
          user[col] = values[i]?.trim() || '';
        });
        
        // Validações básicas
        if (!user.name || !user.email || !user.role_name || !user.password) {
          throw new Error(`Linha ${index + 2}: Todos os campos são obrigatórios`);
        }
        
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
          throw new Error(`Linha ${index + 2}: Email inválido`);
        }
        
        // Validar role_name (será validado no backend)
        if (!user.role_name || user.role_name.trim() === '') {
          throw new Error(`Linha ${index + 2}: role_name é obrigatório`);
        }
        
        // Validar senha (mínimo 6 caracteres)
        if (user.password.length < 6) {
          throw new Error(`Linha ${index + 2}: Senha deve ter pelo menos 6 caracteres`);
        }
        
        // Configurações padrão
        user.organization_id = organization?.id;
        // Permissões removidas - agora gerenciadas via sistema de roles
        user.show_name_in_chat = true;
        
        return user;
      });

      if (usersToInsert.length === 0) {
        throw new Error('Nenhum usuário válido encontrado no CSV');
      }

      setImportedUsers(usersToInsert);
      setShowInviteModal(true);
    } catch (err: any) {
      setCsvError(err.message || 'Erro ao importar CSV. Verifique o formato.');
    }
    setCsvUploading(false);
  }

  // Função para confirmar importação e enviar convites
  // Função para enviar emails para novos usuários
  const sendEmailsToNewUsers = async () => {
    if (newUsersForEmail.length === 0) return;

    setSendingEmails(true);
    setError('');

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const user of newUsersForEmail) {
        try {
          const response = await fetch(`${apiBase}/api/users/send-welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              password: user.password,
              organization_name: organization?.name || 'Sua Organização'
            })
          });

          const result = await response.json();
          if (response.ok) {
            successCount++;
          } else {
            console.error(`Erro ao enviar email para ${user.email}:`, result.error);
            errorCount++;
          }
        } catch (err) {
          console.error(`Erro ao enviar email para ${user.email}:`, err);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        setCsvSuccess(`${successCount} emails enviados com sucesso! ${errorCount} falharam.`);
      } else {
        setCsvSuccess(`${successCount} emails enviados com sucesso!`);
      }

      setShowEmailModal(false);
      setNewUsersForEmail([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingEmails(false);
    }
  };

  const confirmImportAndInvite = async () => {
    if (importedUsers.length === 0) return;

    setLoading(true);
    setError('');

    try {
      let successCount = 0;
      let errorCount = 0;
      let newUsers = [];

      // Importar usuários um por um usando o backend
      for (const user of importedUsers) {
        try {
          const response = await fetch(`${apiBase}/api/users/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: user.name,
              email: user.email,
              password: user.password,
              role_name: user.role_name,
              // Permissões removidas - agora gerenciadas via sistema de roles
              organization_id: user.organization_id,
              show_name_in_chat: user.show_name_in_chat,
            })
          });

          const result = await response.json();
          if (response.ok) {
            successCount++;
            // Se o usuário foi criado com sucesso, adicionar à lista de novos usuários
            if (result.user && !result.existing) {
              newUsers.push({
                name: user.name,
                email: user.email,
                password: user.password
              });
            }
          } else {
            console.error(`Erro ao importar ${user.email}:`, result.error);
            errorCount++;
          }
        } catch (err) {
          console.error(`Erro ao importar ${user.email}:`, err);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        setCsvSuccess(`${successCount} usuários importados com sucesso! ${errorCount} falharam.`);
      } else {
        setCsvSuccess(`${successCount} usuários importados com sucesso!`);
      }

      setShowInviteModal(false);
      setImportedUsers([]);
      
      // Atualizar lista de usuários imediatamente
      fetchUsers();

      // Se há novos usuários, perguntar se quer enviar emails
      if (newUsers.length > 0) {
        setNewUsersForEmail(newUsers);
        setShowEmailModal(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Mostrar loading enquanto carrega a organização
  if (orgLoading) {
    return (
      <div className="w-full min-h-screen p-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando configurações da organização...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se a organização foi carregada
  if (!organization) {
    return (
      <div className="w-full min-h-screen p-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <h2 className="text-xl text-gray-900 mb-2">Organização não encontrada</h2>
            <p className="text-gray-600">Não foi possível carregar as informações da organização.</p>
            <p className="text-sm text-gray-500 mt-2">Entre em contato com o administrador do sistema.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-6 border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h1 className="text-xl sm:text-2xl">Usuários da Organização</h1>
            <div className="text-sm text-muted-foreground">
              Usuários cadastrados: <b>{userCount}</b> / {maxUsers} permitidos
            </div>
          </div>
          
          {/* Botões de ação reorganizados para mobile */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:justify-end">
            <Button 
              onClick={handleCsvDownload} 
              variant="outline" 
              size="sm"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar modelo CSV</span>
              <span className="sm:hidden">Modelo CSV</span>
            </Button>
            
            <label className="flex items-center justify-center gap-2 cursor-pointer border rounded px-3 py-2 bg-gray-50 hover:bg-gray-100 transition text-sm w-full sm:w-auto">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar CSV</span>
              <span className="sm:hidden">Importar</span>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
            </label>
            
            <Button 
              onClick={() => openModal()} 
              size="sm"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Cadastrar Usuário</span>
              <span className="sm:hidden">Cadastrar</span>
            </Button>
          </div>
        </div>
        {/* Abas de Usuários */}
        <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'active' | 'inactive')} className="w-full">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="grid w-full sm:w-auto grid-cols-2">
                <TabsTrigger value="active" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Usuários Ativos</span>
                  <span className="sm:hidden">Ativos</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{activeUsers.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="inactive" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Usuários Desativados</span>
                  <span className="sm:hidden">Desativados</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{inactiveUsersList.length}</Badge>
                </TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input 
                  placeholder={`Buscar ${activeTab === 'active' ? 'ativos' : 'desativados'}...`} 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="w-full sm:max-w-xs" 
                />
              </div>
            </div>
          </div>

          <TabsContent value="active" className="space-y-4">
            {/* Controles de seleção em massa para usuários ativos */}
            {selectedUsers.length > 0 && activeTab === 'active' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-green-50 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedUsers.length} selecionado(s)</Badge>
                    <span className="text-sm text-green-700 hidden sm:inline">Usuários ativos</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedUsers([])}>
                    Limpar seleção
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleBulkAction('invite')}
                    className="border-green-300 text-green-600 hover:bg-green-50 w-full sm:w-auto"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Enviar convites</span>
                    <span className="sm:hidden">Convites</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => handleBulkAction('delete')}
                    className="w-full sm:w-auto"
                  >
                    <UserMinus className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Desativar selecionados</span>
                    <span className="sm:hidden">Desativar</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Tabela de usuários ativos */}
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <div className="sm:hidden text-xs text-gray-500 p-2 bg-gray-50 border-b">
                ← Deslize horizontalmente para ver mais colunas →
              </div>
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-1 sm:p-2 text-center w-8 sm:w-12">
                      <Checkbox 
                        checked={currentUsers.length > 0 && currentUsers.every(user => selectedUsers.includes(user.id))}
                        onCheckedChange={handleSelectAll}
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
                  {currentUsers.map(user => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-1 sm:p-2 text-center">
                        <Checkbox 
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked: boolean) => handleSelectUser(user.id, checked)}
                          className="h-3 w-3 sm:h-4 sm:w-4"
                        />
                      </td>
                      <td className="p-1 sm:p-2">
                        {user.avatar_url ? (
                          <img src={getImageUrl(user.avatar_url) || ''} alt={user.name} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs sm:text-sm">
                            {user.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </td>
                      <td className="p-1 sm:p-2 truncate text-xs sm:text-sm">{user.name}</td>
                      <td className="p-1 sm:p-2 truncate hidden md:table-cell text-xs sm:text-sm">{user.email || '-'}</td>
                      <td className="p-1 sm:p-2">
                        {(() => {
                          // Debug: verificar se roles estão carregadas
                          if (rolesLoading) return (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                              Carregando...
                            </span>
                          );
                          
                          // Buscar role pelo role_id
                          const userRole = roles.find(r => r.id === user.role_id);
                          
                          // Debug: log para verificar
                          if (user.role_id && !userRole) {
                            console.log('⚠️ Role não encontrada:', { 
                              role_id: user.role_id, 
                              available_roles: roles.map(r => ({ id: r.id, name: r.name })),
                              user: user.name 
                            });
                          }
                          
                          // Determinar role name
                          let roleName = 'N/A';
                          if (userRole) {
                            roleName = userRole.name;
                          } else if (user.user_role) {
                            roleName = user.user_role;
                          }
                          
                          // Determinar estilo baseado na role
                          const getRoleStyle = (role: string) => {
                            const lowerRole = role.toLowerCase();
                            if (lowerRole.includes('super') || lowerRole.includes('super_admin')) {
                              return 'bg-purple-100 text-purple-800 border-purple-200';
                            } else if (lowerRole.includes('admin')) {
                              return 'bg-blue-100 text-blue-800 border-blue-200';
                            } else if (lowerRole.includes('agent') || lowerRole.includes('agente')) {
                              return 'bg-green-100 text-green-800 border-green-200';
                            } else {
                              return 'bg-gray-100 text-gray-800 border-gray-200';
                            }
                          };
                          
                          return (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRoleStyle(roleName)}`}>
                              {roleName}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-1 sm:p-2 truncate hidden lg:table-cell">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <MessageCircle className="text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                          <span className={`text-xs px-1 sm:px-2 py-1 rounded-full ${
                            user.show_name_in_chat 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {user.show_name_in_chat ? 'Ativado' : 'Desativado'}
                          </span>
                        </div>
                      </td>
                      <td className="p-1 sm:p-2">
                        {user.is_online ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs sm:text-sm">
                            <CheckCircle className="w-3 h-3" /> 
                            <span className="hidden sm:inline">Online</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
                            <XCircle className="w-3 h-3" /> 
                            <span className="hidden sm:inline">Offline</span>
                          </span>
                        )}
                      </td>
                      <td className="p-1 sm:p-2 truncate hidden md:table-cell text-xs">
                        {user.last_seen ? new Date(user.last_seen).toLocaleString() : '-'}
                      </td>
                      <td className="p-1 sm:p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => openModal(user)} 
                            title="Editar usuário"
                            className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                          >
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => sendWhatsAppInvite(user)}
                            disabled={inviteLoadingStates[user.id] || loading}
                            title="Enviar convite WhatsApp"
                            className="border-green-300 text-green-600 hover:bg-green-50 h-6 w-6 sm:h-8 sm:w-8 p-0"
                          >
                            {inviteLoadingStates[user.id] ? (
                              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDelete(user.id)} 
                            disabled={deleteLoadingStates[user.id] || loading}
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
                      </td>
                    </tr>
                  ))}
                  {currentUsers.length === 0 && (
                    <tr><td colSpan={9} className="text-center p-4 text-muted-foreground text-xs sm:text-sm">Nenhum usuário ativo encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="inactive" className="space-y-4">
            {/* Controles de seleção em massa para usuários inativos */}
            {selectedUsers.length > 0 && activeTab === 'inactive' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-red-50 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedUsers.length} selecionado(s)</Badge>
                    <span className="text-sm text-red-700 hidden sm:inline">Usuários desativados</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedUsers([])}>
                    Limpar seleção
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleBulkAction('restore')}
                    className="border-blue-300 text-blue-600 hover:bg-blue-50 w-full sm:w-auto"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Reativar selecionados</span>
                    <span className="sm:hidden">Reativar</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => handleBulkAction('hardDelete')}
                    className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Excluir permanentemente</span>
                    <span className="sm:hidden">Excluir</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Tabela de usuários inativos */}
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <div className="sm:hidden text-xs text-gray-500 p-2 bg-gray-50 border-b">
                ← Deslize horizontalmente para ver mais colunas →
              </div>
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-1 sm:p-2 text-center w-8 sm:w-12">
                      <Checkbox 
                        checked={currentUsers.length > 0 && currentUsers.every(user => selectedUsers.includes(user.id))}
                        onCheckedChange={handleSelectAll}
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
                  {currentUsers.map(user => (
                    <tr key={user.id} className="border-b bg-red-50/60 hover:bg-red-50/80">
                      <td className="p-1 sm:p-2 text-center">
                        <Checkbox 
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked: boolean) => handleSelectUser(user.id, checked)}
                          className="h-3 w-3 sm:h-4 sm:w-4"
                        />
                      </td>
                      <td className="p-1 sm:p-2">
                        {user.avatar_url ? (
                          <img src={getImageUrl(user.avatar_url) || ''} alt={user.name} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover opacity-50" />
                        ) : (
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 opacity-50 text-xs sm:text-sm">
                            {user.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </td>
                      <td className="p-1 sm:p-2 truncate text-gray-600 text-xs sm:text-sm">{user.name}</td>
                      <td className="p-1 sm:p-2 truncate hidden md:table-cell text-gray-600 text-xs sm:text-sm">{user.email || '-'}</td>
                      <td className="p-1 sm:p-2">
                        {(() => {
                          // Debug: verificar se roles estão carregadas
                          if (rolesLoading) return (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600 opacity-75">
                              Carregando...
                            </span>
                          );
                          
                          // Buscar role pelo role_id
                          const userRole = roles.find(r => r.id === user.role_id);
                          
                          // Determinar role name
                          let roleName = 'N/A';
                          if (userRole) {
                            roleName = userRole.name;
                          } else if (user.user_role) {
                            roleName = user.user_role;
                          }
                          
                          // Determinar estilo baseado na role (com opacidade para usuários inativos)
                          const getRoleStyle = (role: string) => {
                            const lowerRole = role.toLowerCase();
                            if (lowerRole.includes('super') || lowerRole.includes('super_admin')) {
                              return 'bg-purple-100 text-purple-800 border-purple-200 opacity-75';
                            } else if (lowerRole.includes('admin')) {
                              return 'bg-blue-100 text-blue-800 border-blue-200 opacity-75';
                            } else if (lowerRole.includes('agent') || lowerRole.includes('agente')) {
                              return 'bg-green-100 text-green-800 border-green-200 opacity-75';
                            } else {
                              return 'bg-gray-100 text-gray-800 border-gray-200 opacity-75';
                            }
                          };
                          
                          return (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRoleStyle(roleName)}`}>
                              {roleName}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Coluna de permissões removida - agora gerenciada via sistema de roles */}
                      <td className="p-1 sm:p-2 truncate hidden lg:table-cell">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <MessageCircle className="text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="text-xs px-1 sm:px-2 py-1 rounded-full opacity-75 bg-gray-100 text-gray-700">
                            {user.show_name_in_chat ? 'Ativado' : 'Desativado'}
                          </span>
                        </div>
                      </td>
                      <td className="p-1 sm:p-2">
                        <span className="flex items-center gap-1 text-red-600 opacity-75 text-xs sm:text-sm">
                          <XCircle className="w-3 h-3" /> 
                          <span className="hidden sm:inline">Desativado</span>
                        </span>
                      </td>
                      <td className="p-1 sm:p-2 truncate hidden md:table-cell text-gray-600 text-xs">
                        {new Date(user.deleted_at).toLocaleDateString()}
                      </td>
                      <td className="p-1 sm:p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleRestore(user.id)} 
                            disabled={loadingStates[user.id] || loading}
                            title="Reativar usuário"
                            className="border-blue-300 text-blue-600 hover:bg-blue-50 h-6 w-6 sm:h-8 sm:w-8 p-0"
                          >
                            {loadingStates[user.id] ? (
                              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleHardDelete(user.id)} 
                            disabled={loadingStates[user.id] || loading}
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
                      </td>
                    </tr>
                  ))}
                  {currentUsers.length === 0 && (
                    <tr><td colSpan={9} className="text-center p-4 text-muted-foreground text-xs sm:text-sm">Nenhum usuário desativado encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length} usuários
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else {
                    // Lógica para mostrar páginas centrais
                    if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-6 h-6 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        )}

        {csvError && <div className="text-red-500 text-xs sm:text-sm mt-2 p-2 bg-red-50 rounded border border-red-200">{csvError}</div>}
        {csvSuccess && <div className="text-green-600 text-xs sm:text-sm mt-2 p-2 bg-green-50 rounded border border-green-200">{csvSuccess}</div>}
        
        {/* Espaço extra para mobile */}
        <div className="pb-8 sm:pb-4"></div>
      </div>
      {/* Modal de cadastro/edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] sm:max-w-xl flex flex-col">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">{editUser ? 'Editar Usuário' : 'Cadastrar Usuário'}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <form id="user-form" className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            
            {/* Campo de Avatar */}
            <div className="space-y-2">
              <Label className="text-sm">Avatar</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="relative mx-auto sm:mx-0">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt="Preview" 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : editUser?.avatar_url ? (
                    <img 
                      src={getImageUrl(editUser.avatar_url) || ''} 
                      alt={editUser.name} 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                      <UserIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-1.5 sm:p-2 cursor-pointer hover:bg-blue-600 transition">
                    <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Clique na câmera para selecionar uma imagem
                  </p>
                  {avatarFile && (
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview('');
                      }}
                      className="mt-2 text-xs"
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="name" className="text-sm">Nome</Label>
              <Input 
                id="name" 
                name="name" 
                value={form.name} 
                onChange={handleFormChange} 
                required 
                className="mt-1"
                placeholder="Digite o nome completo"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm">E-mail</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                value={form.email} 
                onChange={handleFormChange} 
                required 
                className="mt-1"
                placeholder="Digite o email do usuário"
              />
            </div>
            <div>
              <Label htmlFor="role_id" className="text-sm">Nível de acesso</Label>
              <Select name="role_id" value={form.role_id} onValueChange={(val: string) => handleFormChange({ target: { name: 'role_id', value: val } } as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o nível de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {!profile ? (
                     <SelectItem value="" disabled>Carregando perfil...</SelectItem>
                   ) : rolesLoading ? (
                     <SelectItem value="" disabled>Carregando roles...</SelectItem>
                   ) : getAvailableRoles().length === 0 ? (
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
                    getAvailableRoles().map(role => (
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
              {form.role_id && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs sm:text-sm text-muted-foreground">
                  {(() => {
                    const selectedRole = getAvailableRoles().find(r => r.id === form.role_id);
                    if (selectedRole) {
                      const permissions = Object.entries(selectedRole.permissions)
                        .filter(([_, enabled]) => enabled)
                        .map(([key, _]) => key)
                        .join(', ');
                      return `Permissões: ${permissions || 'Nenhuma'}`;
                    }
                    return '';
                  })()}
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm">Permissões</Label>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mt-1">
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 text-sm">ℹ️</div>
                  <div>
                    <p className="text-sm sm:text-base text-blue-800">
                      Permissões gerenciadas via sistema de roles
                    </p>
                    <p className="text-xs sm:text-sm text-blue-700 mt-1">
                      As permissões são definidas através do sistema de roles. 
                      <span className="block sm:inline"> Acesse "Configurações Avançadas → Gestão de Permissões" para configurar.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border rounded-lg bg-gray-50 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="show-name-chat" className="text-sm sm:text-base">
                      Mostrar nome no chat
                    </Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {form.show_name_in_chat 
                        ? "O nome aparecerá antes das mensagens" 
                        : "As mensagens aparecerão sem nome"
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  id="show-name-chat"
                  checked={form.show_name_in_chat}
                  onCheckedChange={(checked: boolean) => setForm(prev => ({ ...prev, show_name_in_chat: checked }))}
                />
              </div>
            </div>
            {editUser && (
              <div>
                <Label htmlFor="newPassword" className="text-sm">Nova senha</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={form.newPassword || ''}
                  onChange={handleFormChange}
                  placeholder="Deixe em branco para não alterar"
                  minLength={6}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Preencha para alterar a senha do usuário (mínimo 6 caracteres).
                </p>
              </div>
            )}
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
          <div className="flex-shrink-0 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={closeModal} 
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

      {/* Modal de Sucesso do Convite */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Convite Enviado!
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg">Email enviado com sucesso!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                O convite foi enviado para <strong>{invitedUser?.email}</strong>
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-blue-900 mb-2">📧 O que acontece agora?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• O usuário receberá um email com um link seguro</li>
                <li>• O link permite conectar o WhatsApp de forma segura</li>
                <li>• O convite expira em 7 dias por segurança</li>
                <li>• Você pode reenviar o convite a qualquer momento</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSuccessModal(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar usuário?</DialogTitle>
          </DialogHeader>
          <div className="text-yellow-600 mb-2">Esta ação pode ser revertida!</div>
          <div className="mb-4 text-sm text-muted-foreground">
            Este usuário será desativado e não poderá mais acessar o sistema. Os dados serão mantidos para fins de auditoria e esta ação pode ser revertida posteriormente.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={loading}>{loading ? 'Desativando...' : 'Desativar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de importação */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Confirmar Importação
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg">Importar {importedUsers.length} usuários?</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Os usuários serão criados com as senhas fornecidas no CSV.
              </p>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="text-yellow-900 mb-2">📋 Usuários a serem importados:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importedUsers.map((user, index) => (
                  <div key={index} className="text-sm text-yellow-800 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="">{user.name}</span>
                      <span className="text-yellow-600 text-xs">{user.email}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        user.user_role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                        user.user_role === 'admin' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {user.user_role === 'super_admin' ? 'Super Admin' :
                         user.user_role === 'admin' ? 'Admin' : 'Agente'}
                      </span>
                      <span className="text-yellow-600 text-xs mt-1">Senha: {user.password}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmImportAndInvite} disabled={loading}>
              {loading ? 'Importando...' : 'Importar Usuários'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de ações em massa */}
      <Dialog open={bulkActionModal} onOpenChange={(open) => {
        setBulkActionModal(open);
        if (!open) {
          setBulkAction(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'invite' && 'Enviar Convites em Massa'}
              {bulkAction === 'delete' && 'Desativar Usuários em Massa'}
              {bulkAction === 'restore' && 'Reativar Usuários em Massa'}
              {bulkAction === 'hardDelete' && 'Excluir Usuários Permanentemente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center">
                {bulkAction === 'invite' && (
                  <div className="bg-green-100 rounded-full p-3">
                    <Send className="w-8 h-8 text-green-600" />
                  </div>
                )}
                {bulkAction === 'delete' && (
                  <div className="bg-orange-100 rounded-full p-3">
                    <UserMinus className="w-8 h-8 text-orange-600" />
                  </div>
                )}
                {bulkAction === 'restore' && (
                  <div className="bg-blue-100 rounded-full p-3">
                    <RotateCcw className="w-8 h-8 text-blue-600" />
                  </div>
                )}
                {bulkAction === 'hardDelete' && (
                  <div className="bg-red-100 rounded-full p-3">
                    <Trash2 className="w-8 h-8 text-red-600" />
                  </div>
                )}
              </div>
              <h3 className="text-lg">
                {bulkAction === 'invite' && `Enviar convites para ${selectedUsers.length} usuários?`}
                {bulkAction === 'delete' && `Desativar ${selectedUsers.length} usuários?`}
                {bulkAction === 'restore' && `Reativar ${selectedUsers.length} usuários?`}
                {bulkAction === 'hardDelete' && `Excluir permanentemente ${selectedUsers.length} usuários?`}
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {bulkAction === 'invite' && 'Convites serão enviados para todos os usuários selecionados.'}
                {bulkAction === 'delete' && 'Os usuários selecionados serão desativados mas podem ser reativados posteriormente.'}
                {bulkAction === 'restore' && 'Os usuários selecionados serão reativados e poderão acessar o sistema novamente.'}
                {bulkAction === 'hardDelete' && 'Esta ação é irreversível! Os usuários serão removidos permanentemente do sistema.'}
              </p>
            </div>
            
            {/* Aviso especial para hard delete */}
            {bulkAction === 'hardDelete' && (
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
                {currentUsers
                  .filter(user => selectedUsers.includes(user.id))
                  .map(user => (
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
            <Button variant="outline" onClick={() => setBulkActionModal(false)}>
              Cancelar
            </Button>
            <Button 
              variant={
                bulkAction === 'invite' ? 'default' :
                bulkAction === 'restore' ? 'default' :
                'destructive'
              }
              onClick={confirmBulkAction} 
              disabled={loading}
              className={
                bulkAction === 'hardDelete' ? 'bg-red-600 hover:bg-red-700' : ''
              }
            >
              {loading ? 'Processando...' : (
                bulkAction === 'invite' ? 'Enviar Convites' :
                bulkAction === 'delete' ? 'Desativar Usuários' :
                bulkAction === 'restore' ? 'Reativar Usuários' :
                'Excluir Permanentemente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para enviar emails para novos usuários */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar emails de boas-vindas</DialogTitle>
            <DialogDescription>
              Deseja enviar emails de boas-vindas para os novos usuários importados?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-blue-900 mb-2">📧 Novos usuários que receberão email:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {newUsersForEmail.map((user, index) => (
                  <div key={index} className="text-sm text-blue-800 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="">{user.name}</span>
                      <span className="text-blue-600 text-xs">{user.email}</span>
                    </div>
                    <div className="text-xs text-blue-600">
                      Senha: {user.password}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 text-xs">ℹ</span>
                </div>
                <h4 className="text-yellow-900">Informação</h4>
              </div>
              <p className="text-sm text-yellow-800 mt-2">
                Os emails conterão as credenciais de acesso e instruções para primeiro login.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>
              Pular
            </Button>
            <Button onClick={sendEmailsToNewUsers} disabled={sendingEmails}>
              {sendingEmails ? 'Enviando...' : 'Enviar Emails'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default RegisterUser; 