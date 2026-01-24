import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Settings, 
  Plus, 
  Copy, 
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Home,
  MessageCircle,
  Building2,
  Smartphone,
  User as UserIcon,
  Brain,
  Zap,
  FolderOpen,
  BookOpen,
  Calendar,
  BarChart3,
  CheckCircle as CheckCircleIcon,
  Cloud,
  Smile,
  Store,
  Database,
  Shield,
  Activity,
  LifeBuoy,
  Crown,
  UserCheck,
  Trophy,
  Eye,
  Phone
} from 'lucide-react';
import { apiBase, getAuthHeadersWithUser } from '@/utils/apiBase';
import { useOrganization } from '@/hooks/useOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';

interface Permission {
  name: string;
  description: string;
}

interface Module {
  name: string;
  description: string;
  permissions: Record<string, Permission>;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, any>;
  is_default: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
  organization_id?: string; // Adicionado para identificar a organização
}

const PermissionsManager: React.FC = () => {
  const { organization } = useOrganization();
  const { refetch } = usePermissions();
  const { user, profile } = useAuth();
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Record<string, Module>>({});
  const [defaultRoles, setDefaultRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // ✅ REFs para evitar múltiplas chamadas
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const modulesFetchedRef = useRef(false);
  const defaultRolesFetchedRef = useRef(false);

  // Estados do formulário de role
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: {} as Record<string, any>,
    is_default: false,
    based_on_default_role: 'none'
  });

  // 🎯 DETERMINAR NÍVEL DO USUÁRIO
  const userLevel = useMemo(() => {
    if (!profile?.roles?.name) return 'agent';
    
    const roleName = profile.roles.name;
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    return roleMapping[roleName as keyof typeof roleMapping] || 'agent';
  }, [profile]);

  // 🎯 VERIFICAR SE OS DADOS DO USUÁRIO FORAM CARREGADOS
  const isUserDataLoaded = useMemo(() => {
    return profile !== null && profile !== undefined;
  }, [profile]);

  // 🎯 FUNÇÃO PARA VERIFICAR SE PODE EDITAR UMA ROLE ESPECÍFICA
  const canEditRole = useCallback((role: Role) => {
    if (userLevel === 'super_admin') {
      return true; // Super Admin pode editar qualquer role (incluindo globais)
    } else if (userLevel === 'admin') {
      // Admin só pode editar roles que não são default E que pertencem à sua organização
      return !role.is_default && role.organization_id === organization?.id;
    }
    return false;
  }, [userLevel, organization?.id]);

  // 🎯 FUNÇÃO PARA VERIFICAR SE PODE DELETAR UMA ROLE ESPECÍFICA
  const canDeleteRole = useCallback((role: Role) => {
    if (userLevel === 'super_admin') {
      return true; // Super Admin pode deletar qualquer role (incluindo globais)
    } else if (userLevel === 'admin') {
      // Admin só pode deletar roles que não são default E que pertencem à sua organização
      return !role.is_default && role.organization_id === organization?.id;
    }
    return false;
  }, [userLevel, organization?.id]);

  //  FILTRAR ROLES BASEADO NO NÍVEL DO USUÁRIO
  const filteredRoles = useMemo(() => {
    if (userLevel === 'super_admin') {
      // Super Admin vê todas as roles (globais + da organização atual)
      return roles;
    } else if (userLevel === 'admin') {
      // Admin vê apenas roles da sua organização que não são default
      return roles.filter(role => 
        !role.is_default && 
        (role.organization_id === organization?.id || role.organization_id === null)
      );
    } else {
      // Outros níveis não devem ver nenhuma role
      return [];
    }
  }, [roles, userLevel, organization?.id]);

  // 🎯 VERIFICAR SE USUÁRIO PODE ACESSAR A PÁGINA
  const canAccessPage = useMemo(() => {
    if (!isUserDataLoaded) return null; // Ainda carregando dados do usuário
    return ['super_admin', 'admin'].includes(userLevel);
  }, [userLevel, isUserDataLoaded]);

  // 🎯 VERIFICAR SE PODE CRIAR ROLES
  const canCreateRoles = useMemo(() => {
    return ['super_admin', 'admin'].includes(userLevel);
  }, [userLevel]);

  // ✅ MEMOIZAR funções de fetch para evitar recriações
  const fetchRoles = useCallback(async () => {
    if (isFetchingRef.current) return; // Evitar chamadas simultâneas
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/permissions/roles`, {
        headers
      });
      const data = await response.json();
      if (data.success) {
        setRoles(data.roles);
      }
    } catch (error) {
      console.error('Erro ao buscar roles:', error);
      setError('Erro ao carregar roles');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, profile]);

  const fetchModules = useCallback(async () => {
    // ✅ Módulos são estáticos, só buscar uma vez
    if (modulesFetchedRef.current) return;
    
    try {
      modulesFetchedRef.current = true;
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/permissions/modules`, {
        headers
      });
      const data = await response.json();
      if (data.success) {
        setModules(data.modules);
      }
    } catch (error) {
      console.error('Erro ao buscar módulos:', error);
      modulesFetchedRef.current = false; // Resetar em caso de erro
    }
  }, [user, profile]);

  const fetchDefaultRoles = useCallback(async () => {
    // ✅ Default roles raramente mudam, só buscar uma vez
    if (defaultRolesFetchedRef.current) return;
    
    try {
      defaultRolesFetchedRef.current = true;
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/permissions/default-roles`, {
        headers
      });
      const data = await response.json();
      if (data.success) {
        setDefaultRoles(data.roles);
      }
    } catch (error) {
      console.error('Erro ao buscar roles padrão:', error);
      defaultRolesFetchedRef.current = false; // Resetar em caso de erro
    }
  }, [user, profile]);

  // ✅ useEffect otimizado - só executa uma vez quando canAccessPage vira true
  useEffect(() => {
    if (canAccessPage === true && !hasFetchedRef.current && !isFetchingRef.current) {
      hasFetchedRef.current = true;
      // ✅ Executar em paralelo para ser mais rápido
      Promise.all([
        fetchRoles(),
        fetchModules(),
        fetchDefaultRoles()
      ]).catch(error => {
        console.error('Erro ao carregar dados iniciais:', error);
        hasFetchedRef.current = false; // Resetar em caso de erro
      });
    }
  }, [canAccessPage, fetchRoles, fetchModules, fetchDefaultRoles]);

  const openRoleModal = (role: Role | null = null) => {
    if (role) {
      setSelectedRole(role);
      setRoleForm({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions, // Carregar exatamente o que está no banco
        is_default: role.is_default,
        based_on_default_role: 'none'
      });
    } else {
      setSelectedRole(null);
      setRoleForm({
        name: '',
        description: '',
        permissions: {},
        is_default: false,
        based_on_default_role: 'none'
      });
    }
    setShowRoleModal(true);
  };

  const saveRole = async () => {
    try {
      setLoading(true);
      const url = selectedRole 
        ? `${apiBase}/api/permissions/roles/${selectedRole.id}`
        : `${apiBase}/api/permissions/roles`;
      
      const method = selectedRole ? 'PATCH' : 'POST';
      const headers = await getAuthHeadersWithUser(user, profile);
      
      // Log para debug
      console.log('🔍 [DEBUG] Dados sendo enviados:', JSON.stringify(roleForm, null, 2));
      
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(roleForm)
      });
      
      const data = await response.json();
      
      //  LOGS DE DEBUG PARA IDENTIFICAR O PROBLEMA
      console.log('🔍 [DEBUG] Status da resposta:', response.status);
      console.log('🔍 [DEBUG] Response ok:', response.ok);
      console.log('🔍 [DEBUG] Dados da resposta:', JSON.stringify(data, null, 2));
      console.log('🔍 [DEBUG] data.success:', data.success);
      console.log(' [DEBUG] data.error:', data.error);
      
      // 🎯 VERIFICAÇÃO MAIS ROBUSTA
      if (response.status >= 200 && response.status < 300 && data.success) {
        let successMessage = selectedRole ? 'Role atualizada com sucesso!' : 'Role criada com sucesso!';
        
        // Adicionar informação extra se foi marcada como padrão
        if (roleForm.is_default) {
          successMessage += ' Outras roles padrão foram automaticamente desativadas.';
        }
        
        // Adicionar aviso sobre logout se for uma atualização
        if (selectedRole && data.message) {
          successMessage += ' ' + data.message;
        }
        
        setSuccess(successMessage);
        setShowRoleModal(false);
        fetchRoles();
        refetch(); // Recarrega as permissões após salvar
      } else {
        // Se a resposta não foi ok OU se não tem success: true
        const errorMessage = data.error || `Erro ao salvar role (Status: ${response.status})`;
        console.error('❌ [DEBUG] Erro detectado:', errorMessage);
        console.error('❌ [DEBUG] Response status:', response.status);
        console.error('❌ [DEBUG] Data success:', data.success);
        setError(errorMessage);
      }
    } catch (error) {
      console.error('❌ [DEBUG] Erro de exceção:', error);
      setError('Erro ao salvar role');
    } finally {
      setLoading(false);
    }
  };

  const deleteRole = async () => {
    if (!roleToDelete) return;
    
    try {
      setLoading(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/permissions/roles/${roleToDelete.id}`, {
        method: 'DELETE',
        headers
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Role excluída com sucesso!');
        setShowDeleteModal(false);
        setRoleToDelete(null);
        // ✅ Resetar ref para permitir nova busca
        hasFetchedRef.current = false;
        fetchRoles();
      } else {
        setError(data.error || 'Erro ao excluir role');
      }
    } catch (error) {
      console.error('Erro ao excluir role:', error);
      setError('Erro ao excluir role');
    } finally {
      setLoading(false);
    }
  };

  const duplicateRole = (role: Role) => {
    setSelectedRole(null);
    setRoleForm({
      name: `${role.name} (Cópia)`,
      description: role.description || '',
      permissions: role.permissions, // Carregar exatamente o que está no banco
      is_default: false,
      based_on_default_role: 'none'
    });
    setShowRoleModal(true);
  };

  const updatePermission = (moduleKey: string, permissionKey: string, value: boolean) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...prev.permissions[moduleKey],
          [permissionKey]: value
        }
      }
    }));
  };

  const updateModulePermissions = (moduleKey: string, value: boolean) => {
    const modulePermissions = permissionSections.find(section => section.key === moduleKey)?.permissions || {};
    const updatedPermissions = {};
    
    Object.keys(modulePermissions).forEach(permissionKey => {
      updatedPermissions[permissionKey] = value;
    });
    
    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: updatedPermissions
      }
    }));
  };

  const isModuleFullyEnabled = (moduleKey: string) => {
    const modulePermissions = roleForm.permissions[moduleKey] || {};
    const allPermissions = Object.keys(modules[moduleKey]?.permissions || {});
    return allPermissions.every(permission => modulePermissions[permission] === true);
  };

  const isModulePartiallyEnabled = (moduleKey: string) => {
    const modulePermissions = roleForm.permissions[moduleKey] || {};
    const allPermissions = Object.keys(modules[moduleKey]?.permissions || {});
    const enabledCount = allPermissions.filter(permission => modulePermissions[permission] === true).length;
    return enabledCount > 0 && enabledCount < allPermissions.length;
  };

  // ✅ NOVO: Estrutura das permissões baseada nos dados do banco (módulos do menu)
  // ✅ Os módulos vêm do endpoint /api/permissions/modules que busca do banco
  const permissionSections = useMemo(() => {
    // Converter módulos do banco para o formato esperado pelo componente
    return Object.entries(modules).map(([moduleKey, moduleData]) => {
      // Mapear ícones baseado no icon_name do banco
      const iconMap: Record<string, any> = {
        'Home': Home,
        'Building2': Building2,
        'Zap': Zap,
        'MessageCircle': MessageCircle,
        'Eye': Eye,
        'Phone': Phone,
        'BarChart3': BarChart3,
        'AlertCircle': AlertCircle,
        'Settings': Settings
      };
      
      const ModuleIcon = iconMap[moduleData.icon_name] || Settings;
      
      // Mapear cores baseado no módulo
      const colorMap: Record<string, string> = {
        'dashboard': 'bg-blue-100 text-blue-600',
        'administration': 'bg-red-100 text-red-600',
        'automation': 'bg-purple-100 text-purple-600',
        'chat': 'bg-green-100 text-green-600',
        'supervisor-virtual': 'bg-indigo-100 text-indigo-600',
        'cdr': 'bg-teal-100 text-teal-600',
        'campanhas': 'bg-pink-100 text-pink-600',
        'analytics': 'bg-orange-100 text-orange-600',
        'rules': 'bg-yellow-100 text-yellow-600',
        'advanced': 'bg-gray-100 text-gray-600'
      };
      
      // Mapear emojis baseado no módulo
      const emojiMap: Record<string, string> = {
        'dashboard': '📊',
        'administration': '⚙️',
        'automation': '🤖',
        'chat': '💬',
        'supervisor-virtual': '👁️',
        'cdr': '📞',
        'campanhas': '📣',
        'analytics': '📈',
        'rules': '⚠️',
        'advanced': '🔧'
      };
      
      return {
        key: moduleKey,
        name: moduleData.name,
        description: moduleData.description,
        icon: ModuleIcon,
        color: colorMap[moduleKey] || 'bg-gray-100 text-gray-600',
        emoji: emojiMap[moduleKey] || '📋',
        permissions: moduleData.permissions || {}
      };
    }).sort((a, b) => {
      // Ordenar baseado na ordem do menu (mesma ordem do Sidebar)
      const order = ['dashboard', 'administration', 'automation', 'chat', 'supervisor-virtual', 'cdr', 'campanhas', 'analytics', 'rules', 'advanced'];
      const indexA = order.indexOf(a.key);
      const indexB = order.indexOf(b.key);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [modules]);

  // 🎯 RENDERIZAR LOADING ENQUANTO CARREGA DADOS DO USUÁRIO
  if (!isUserDataLoaded) {
    return (
      <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
        <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando permissões...</p>
          </div>
        </div>
      </div>
    );
  }

  // 🎯 RENDERIZAR ACESSO NEGADO
  if (canAccessPage === false) {
    return (
      <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
        <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl text-red-600 mb-4">Acesso Negado</h1>
            <p className="text-gray-600 mb-2">
              Você não tem permissão para acessar a Gestão de Permissões.
            </p>
            <p className="text-sm text-gray-500">
              Apenas Administradores e Super Administradores podem acessar esta área.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header com ações responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl">Gestão de Permissões</h2>
          <p className="text-sm text-muted-foreground">Gerencie roles e permissões do sistema</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {canCreateRoles && (
            <Button onClick={() => openRoleModal()} className="flex items-center gap-2 text-xs sm:text-sm">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              Nova Role
            </Button>
          )}
        </div>
      </div>

      {/* Lista de Roles */}
      <div className="grid gap-4 sm:gap-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando roles...</p>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {userLevel === 'admin' 
                ? 'Nenhuma role criada ainda. Crie sua primeira role de acesso.'
                : 'Nenhuma role encontrada.'
              }
            </p>
          </div>
        ) : (
          filteredRoles.map(role => (
            <Card key={role.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-base sm:text-lg">{role.name}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {role.is_default && (
                      <Badge variant="secondary" className="text-xs">Padrão</Badge>
                    )}
                    {!role.organization_id && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                        Global
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{role.user_count} usuários</Badge>
                    <div className="flex gap-1">
                      {canEditRole(role) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRoleModal(role)}
                          className="border-blue-300 text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
                          title={`Editar role${!role.organization_id ? ' global' : ''}`}
                          disabled={!canEditRole(role)}
                        >
                          <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateRole(role)}
                        className="border-green-300 text-green-600 hover:bg-green-50 h-8 w-8 p-0"
                        title="Duplicar role"
                      >
                        <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                      {canDeleteRole(role) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRoleToDelete(role);
                            setShowDeleteModal(true);
                          }}
                          className={`${
                            role.is_default 
                              ? 'border-red-300 text-red-400 hover:bg-red-50 cursor-not-allowed' 
                              : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                          } h-8 w-8 p-0`}
                          disabled={!canDeleteRole(role)}
                          title={
                            role.is_default 
                              ? "Roles padrão não podem ser excluídas" 
                              : `Excluir role${!role.organization_id ? ' global' : ''}`
                          }
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {/* Modal de Role */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRole ? 'Editar Role' : 'Nova Role'}
            </DialogTitle>
            <DialogDescription>
              {selectedRole
                ? 'Edite as permissões e configurações desta role.'
                : 'Crie uma nova role com permissões específicas.'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Aviso para Super Admin */}
          {selectedRole?.name === 'Super Admin' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm text-blue-900 mb-1">
                    Role Super Admin - Acesso Total
                  </h4>
                  <p className="text-sm text-blue-700">
                    Esta role tem acesso total a todas as funcionalidades do sistema, independente das permissões configuradas abaixo.
                    As configurações de permissões são mantidas apenas para referência e documentação.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Aviso para Role Global */}
          {selectedRole && !selectedRole.organization_id && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm text-yellow-900 mb-1">
                    Role Global - Acesso Multi-Organização
                  </h4>
                  <p className="text-sm text-yellow-700">
                    Esta é uma role global que pode ser usada por todas as organizações do sistema.
                    Alterações nesta role afetarão todas as organizações que a utilizam.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome da Role</Label>
                <Input
                  id="name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Agente de Suporte"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o propósito desta role..."
                />
              </div>
            </div>

            <div>
              <Label>Role padrão para novos usuários</Label>
              <div className="flex items-center space-x-2 mt-2">
                <Switch
                  checked={roleForm.is_default}
                  onCheckedChange={(checked) => setRoleForm(prev => ({ ...prev, is_default: checked }))}
                />
                <span className="text-sm text-muted-foreground">
                  Marcar como role padrão para novos usuários
                </span>
              </div>
              {roleForm.is_default && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-blue-600 text-xs">ℹ</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-800">Role Padrão</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Ao marcar esta role como padrão, todas as outras roles padrão da organização serão automaticamente desativadas.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Baseado em role padrão</Label>
              <Select
                value={roleForm.based_on_default_role}
                onValueChange={(value) => setRoleForm(prev => ({ ...prev, based_on_default_role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma role padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (criar do zero)</SelectItem>
                  {(defaultRoles || []).map(role => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base">Permissões do Sistema</Label>
              <p className="text-sm text-muted-foreground mb-4">Configure as permissões de acesso para esta role</p>
              
              <div className="space-y-6">
                {(permissionSections.length > 0 ? permissionSections : []).map((section) => (
                  <div key={section.key} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 ${section.color} rounded-lg flex items-center justify-center`}>
                          <span className="text-sm">{section.emoji}</span>
                        </div>
                        <div>
                          <h3 className="text-gray-900">{section.name}</h3>
                          <p className="text-sm text-gray-500">{section.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isModuleFullyEnabled(section.key)}
                          onCheckedChange={(checked) => updateModulePermissions(section.key, checked)}
                        />
                        <span className="text-sm text-muted-foreground">Todas</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 ml-10">
                      {Object.entries(section.permissions).map(([permissionKey, permission]) => (
                        <div key={permissionKey} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm">{permission.name}</p>
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                          </div>
                          <Switch
                            checked={roleForm.permissions[section.key]?.[permissionKey] || false}
                            onCheckedChange={(checked) => updatePermission(section.key, permissionKey, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleModal(false)}>
              Cancelar
            </Button>
            <Button onClick={saveRole} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a role "{roleToDelete?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteRole} disabled={loading}>
              {loading ? 'Excluindo...' : 'Excluir Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mensagens de sucesso/erro */}
      {success && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800">{success}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccess('')}
              className="ml-2 h-6 w-6 p-0 hover:bg-green-100"
            >
              <AlertCircle className="w-4 h-4 text-green-600" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError('')}
              className="ml-2 h-6 w-6 p-0 hover:bg-red-100"
            >
              <AlertCircle className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        </div>
      )}

      {/* Auto-hide success message after 3 seconds */}
      {success && (
        <div className="hidden">
          {setTimeout(() => setSuccess(''), 3000)}
        </div>
      )}
    </div>
  );
};

export default PermissionsManager; 