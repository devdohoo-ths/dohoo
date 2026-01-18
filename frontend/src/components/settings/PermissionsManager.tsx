import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Trophy
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

  useEffect(() => {
    if (canAccessPage === true) { // Só carregar se for true (não null)
      fetchRoles();
      fetchModules();
      fetchDefaultRoles();
    }
  }, [canAccessPage]);

  const fetchRoles = async () => {
    try {
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
    }
  };

  const fetchModules = async () => {
    try {
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
    }
  };

  const fetchDefaultRoles = async () => {
    try {
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
    }
  };

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

  // Estrutura das permissões baseada no modelo do banco
  const permissionSections = [
    {
      key: 'dashboard',
      name: 'Dashboard',
      description: 'Acesso ao painel principal',
      icon: Home,
      color: 'bg-blue-100 text-blue-600',
      emoji: '📊',
      permissions: {
        view_dashboard: {
          name: 'Acesso ao Dashboard',
          description: 'Pode visualizar o painel principal'
        }
      }
    },
    {
      key: 'contacts',
      name: 'Contatos',
      description: 'Acesso à gestão de contatos',
      icon: Users,
      color: 'bg-emerald-100 text-emerald-600',
      emoji: '👥',
      permissions: {
        access_contacts: {
          name: 'Acessar Contatos',
          description: 'Pode acessar a tela de contatos'
        }
      }
    },
    {
      key: 'chat',
      name: 'Chat',
      description: 'Gerenciamento de conversas e mensagens',
      icon: MessageCircle,
      color: 'bg-green-100 text-green-600',
      emoji: '💬',
      permissions: {
        view_chat: {
          name: 'Visualizar Chat',
          description: 'Pode visualizar o chat'
        },
        view_history: {
          name: 'Acessar Histórico',
          description: 'Pode visualizar histórico de conversas'
        },
        send_messages: {
          name: 'Enviar Mensagens',
          description: 'Pode enviar mensagens para contatos'
        },
        reply_messages: {
          name: 'Responder Mensagens',
          description: 'Pode responder mensagens recebidas'
        },
        manage_conversations: {
          name: 'Gerenciar Conversas',
          description: 'Pode arquivar, marcar como lida, etc.'
        },
        configure_automations: {
          name: 'Configurar Automações',
          description: 'Pode criar e editar automações de chat'
        }
      }
    },
    {
      key: 'support',
      name: 'Suporte',
      description: 'Acesso ao suporte',
      icon: LifeBuoy,
      color: 'bg-teal-100 text-teal-600',
      emoji: '🆘',
      permissions: {
        access_support: {
          name: 'Acessar Suporte',
          description: 'Pode acessar o sistema de suporte'
        }
      }
    },
    {
      key: 'analytics',
      name: 'Analytics & Relatórios',
      description: 'Relatórios e análises de dados',
      icon: BarChart3,
      color: 'bg-orange-100 text-orange-600',
      emoji: '📈',
      permissions: {
        manage_rules: {
          name: 'Gerenciar Regras',
          description: 'Pode gerenciar regras de relatórios'
        },
        view_attendance_report: {
          name: 'Relatório de Atendimento',
          description: 'Pode visualizar relatório de atendimento'
        },
        view_conversation_report: {
          name: 'Relatório de Conversas',
          description: 'Pode visualizar relatório de conversas'
        }
      }
    },
    {
      key: 'productivity',
      name: 'Produtividade',
      description: 'Relatórios e métricas de produtividade',
      icon: CheckCircleIcon,
      color: 'bg-lime-100 text-lime-600',
      emoji: '⏱️',
      permissions: {
        access_productivity: {
          name: 'Acessar Produtividade',
          description: 'Pode acessar a tela de produtividade'
        }
      }
    },
    {
      key: 'ranking',
      name: 'Ranking',
      description: 'Acesso ao ranking gamificado',
      icon: Trophy,
      color: 'bg-yellow-100 text-yellow-700',
      emoji: '🏆',
      permissions: {
        access_ranking: {
          name: 'Acessar Ranking',
          description: 'Pode acessar o ranking'
        }
      }
    },
    {
      key: 'campaigns',
      name: 'Campanhas',
      description: 'Acesso às campanhas inteligentes',
      icon: Zap,
      color: 'bg-pink-100 text-pink-600',
      emoji: '📣',
      permissions: {
        access_campaigns: {
          name: 'Acessar Campanhas',
          description: 'Pode acessar campanhas inteligentes'
        }
      }
    },
    {
      key: 'automation',
      name: 'Automação',
      description: 'Funcionalidades de inteligência artificial',
      icon: Brain,
      color: 'bg-purple-100 text-purple-600',
      emoji: '🤖',
      permissions: {
        manage_flows: {
          name: 'Gerenciar Fluxos',
          description: 'Pode criar e gerenciar fluxos de automação'
        },
        use_ai_assistant: {
          name: 'Usar Assistente IA',
          description: 'Pode usar o assistente de IA'
        },
        configure_prompts: {
          name: 'Configurar Prompts',
          description: 'Pode configurar prompts de IA'
        },
        manage_ai_credits: {
          name: 'Gerenciar Créditos',
          description: 'Pode gerenciar créditos de IA'
        },
        manage_scheduling: {
          name: 'Gerenciar Agendamento',
          description: 'Pode configurar agendamentos'
        },
        manage_agent_limits: {
          name: 'Gerenciar Limites de Agentes',
          description: 'Pode gerenciar limites de agentes'
        },
        access_ai_playground: {
          name: 'Acessar Playground',
          description: 'Pode acessar o playground de IA'
        }
      }
    },
    {
      key: 'marketplace',
      name: 'Marketplace',
      description: 'Configurações de integrações',
      icon: Store,
      color: 'bg-indigo-100 text-indigo-600',
      emoji: '🛒',
      permissions: {
        access_marketplace: {
          name: 'Acessar Marketplace',
          description: 'Pode acessar o marketplace'
        },
        configure_integrations: {
          name: 'Configurar Integrações',
          description: 'Pode configurar integrações'
        }
      }
    },
    {
      key: 'intelligent_service',
      name: 'Atendimento Inteligente',
      description: 'Módulo de atendimento automatizado com flows, times e chat',
      icon: Brain,
      color: 'bg-purple-100 text-purple-600',
      emoji: '🧠',
      permissions: {
        view_intelligent_service: {
          name: 'Visualizar Dashboard',
          description: 'Pode visualizar o dashboard do Atendimento Inteligente'
        },
        manage_intelligent_service: {
          name: 'Gerenciar Módulo',
          description: 'Pode gerenciar o módulo completo'
        },
        manage_products: {
          name: 'Gerenciar Produtos',
          description: 'Pode criar, editar e deletar produtos de atendimento'
        },
        configure_flows: {
          name: 'Configurar Fluxos',
          description: 'Pode configurar fluxos de atendimento'
        },
        configure_team_strategies: {
          name: 'Configurar Estratégias de Time',
          description: 'Pode configurar estratégias de distribuição'
        },
        configure_chat_interface: {
          name: 'Configurar Interface de Chat',
          description: 'Pode configurar chat interno e externo'
        },
        view_metrics: {
          name: 'Visualizar Métricas',
          description: 'Pode visualizar métricas de performance'
        },
        export_data: {
          name: 'Exportar Dados',
          description: 'Pode exportar dados e relatórios'
        }
      }
    },
    {
      key: 'administration',
      name: 'Administração',
      description: 'Configurações administrativas do sistema',
      icon: Building2,
      color: 'bg-red-100 text-red-600',
      emoji: '⚙️',
      permissions: {
        manage_teams: {
          name: 'Gerenciar Times',
          description: 'Pode gerenciar times'
        },
        manage_users: {
          name: 'Cadastrar Usuários',
          description: 'Pode cadastrar novos usuários'
        },
        manage_accounts: {
          name: 'Gerenciar Contas WhatsApp',
          description: 'Pode gerenciar contas do WhatsApp'
        },
        manage_connections: {
          name: 'Gerenciar Conexões',
          description: 'Pode gerenciar conexões do sistema'
        },
        manage_departments: {
          name: 'Gerenciar Departamentos',
          description: 'Pode gerenciar departamentos'
        }
      }
    },
    {
      key: 'advanced_settings',
      name: 'Configurações Avançadas',
      description: 'Configurações avançadas do sistema',
      icon: Settings,
      color: 'bg-gray-100 text-gray-600',
      emoji: '🔧',
      permissions: {
        access_logs: {
          name: 'Acessar Logs',
          description: 'Pode acessar logs do sistema'
        },
        manage_users: {
          name: 'Gerenciar Usuários',
          description: 'Pode gerenciar usuários do sistema'
        },
        manage_database: {
          name: 'Gerenciar Bancos de Dados',
          description: 'Pode gerenciar bancos de dados'
        },
        define_permissions: {
          name: 'Definir Permissões',
          description: 'Pode definir permissões do sistema'
        },
        manage_organizations: {
          name: 'Gerenciar Organizações',
          description: 'Pode gerenciar organizações'
        },
        manage_google_integration: {
          name: 'Gerenciar Integração Google',
          description: 'Pode gerenciar integração com Google'
        }
      }
    }
  ];

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
                {permissionSections.map((section) => (
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