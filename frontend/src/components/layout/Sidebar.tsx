import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { logger } from '@/utils/logger';
import {
  MessageCircle,
  Users,
  Settings,
  Home,
  ChevronDown,
  ChevronRight,
  Brain,
  BookOpen,
  BarChart3,
  Zap,
  ChevronLeft,
  User as UserIcon,
  TrendingUp,
  LogOut,
  Calendar,
  FolderOpen,
  Smile,
  Cloud,
  Search,
  CheckCircle,
  Building2,
  Clock,
  AlertCircle,
  WifiOff,
  Smartphone,
  Database,
  Store,
  Shield,
  Trophy,
  HelpCircle,
  LifeBuoy,
  Activity,
  Menu,
  Plus,
  FileText,
  BarChart,
  Timer,
  Target,
  TrendingDown,
  PieChart,
  LineChart,
  Eye,
  Sparkles,
  Heart,
  Tag,
  MapPin,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
// ✅ CORREÇÃO: Usar o hook correto do AuthProvider
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganization } from '@/hooks/useOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { useRoles } from '@/hooks/useRoles';
import { useNavigate, useLocation } from 'react-router-dom';
import Tooltip from './Tooltip';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { Badge } from '@/components/ui/badge';
import { useSupabaseChat } from '@/hooks/useSupabaseChat';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';


// Componente para adicionar padding-top no mobile
const MobileSpacer = () => (
  <div className="md:hidden h-16" /> /* Altura do header mobile */
);

// Componente de Tooltip customizado para menus
const MenuTooltip = ({ children, content, show = true }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);

  const handleMouseEnter = (e) => {
    if (!show) return;
    setIsVisible(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.right + 8,
      y: rect.top + rect.height / 2
    });
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative"
      >
        {children}
      </div>
      {isVisible && (
        <div
          className="fixed z-50 px-2 py-1 bg-gray-900 text-white text-sm rounded-md shadow-lg whitespace-nowrap pointer-events-none"
          style={{
            left: position.x,
            top: position.y,
            transform: 'translateY(-50%)'
          }}
        >
          {content}
        </div>
      )}
    </>
  );
};

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // ✅ CORREÇÃO: Usar o hook correto
  const { user, profile, signOut } = useAuth();
  
  // ✅ DEBUG: Adicionar logs para ver o que está sendo carregado

  const { hasPermission, loading: permissionsLoading, initialized, permissions } = usePermissions();
  const { roles } = useRoles();

  const navigate = useNavigate();
  const location = useLocation();
  
  // Debug para verificar o pathname atual
  logger.debug(`Pathname atual: ${location.pathname}`);
  const [expandedMenus, setExpandedMenus] = useState([]);
  const timeoutRef = useRef(null);
  const { accounts } = useWhatsAppAccounts({ disableErrorToasts: true });
  const { chats } = useSupabaseChat();
  const { totalUnread } = useUnreadCount();
  const { isModuleEnabled, isFeatureEnabled } = useOrganizationSettings();

  // ✅ CORREÇÃO: Usar profile.organization em vez de hook separado
  const organization = profile?.organization;

  // ✅ OTIMIZAÇÃO: Memoizar filtros e cálculos pesados
  const userAccounts = useMemo(() => {
    return accounts.filter(acc => acc.user_id === user?.id);
  }, [accounts, user?.id]);

  const mainAccount = useMemo(() => {
    return userAccounts.find(acc => acc.status === 'connected') || userAccounts[0];
  }, [userAccounts]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="text-green-500" size={14} />;
      case 'connecting':
        return <Clock className="text-yellow-500 animate-spin" size={14} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={14} />;
      default:
        return <WifiOff className="text-gray-500" size={14} />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      connected: { variant: 'default', label: 'Conectado', color: 'bg-green-500' },
      connecting: { variant: 'secondary', label: 'Conectando...', color: 'bg-yellow-500' },
      error: { variant: 'destructive', label: 'Erro', color: 'bg-red-500' },
      disconnected: { variant: 'outline', label: 'Desconectado', color: 'bg-gray-500' }
    };
    const config = variants[status] || variants.disconnected;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  // Função para gerenciar o hover sem delay
  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsCollapsed(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsCollapsed(true);
    setExpandedMenus([]);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // ✅ OTIMIZAÇÃO: Memoizar função de verificação de permissões
  const shouldShowMenuItem = useCallback((item) => {
    // ✅ Verificação especial para super_admin (auditoria WhatsApp)
    // Pode ser string 'super_admin' ou array ['super_admin']
    const isSuperAdminCheck = item.requiredPermissions === 'super_admin' || 
                              (Array.isArray(item.requiredPermissions) && 
                               item.requiredPermissions.includes('super_admin'));
    
    if (isSuperAdminCheck) {
      // ✅ Verificar Super Admin de múltiplas formas para garantir compatibilidade
      const currentRole = roles.find(r => r.id === profile?.role_id);
      const isSuperAdmin = 
        currentRole?.name?.toLowerCase().includes('super admin') ||
        profile?.roles?.name === 'Super Admin' ||
        profile?.user_role === 'super_admin';
      
      return isSuperAdmin;
    }

    // Debug específico para blacklist
    if (item.id === 'blacklist') {
      logger.debug(`🔍 [BLACKLIST] Verificando permissões:`, {
        itemId: item.id,
        requiredPermissions: item.requiredPermissions,
        initialized,
        permissionsLoading,
        hasPermissionManageUsers: hasPermission('manage_users', true)
      });
    }
    
    // Debug específico para campanhas
    if (item.id === 'campanhas') {
      logger.debug(`Verificando campanhas:`, {
        initialized,
        permissionsLoading,
        isModuleEnabled: isModuleEnabled(item.id),
        requiredPermissions: item.requiredPermissions
      });
    }
    
    // ✅ CORREÇÃO: Para whatsapp-audit, automation, supervisor-virtual e cdr, 
    // verificar super admin ANTES de outras verificações
    // Isso evita que seja bloqueado por verificações de módulo/permissão
    const betaItems = ['whatsapp-audit', 'automation', 'supervisor-virtual', 'cdr'];
    if (betaItems.includes(item.id)) {
      const currentRole = roles.find(r => r.id === profile?.role_id);
      const isSuperAdmin = 
        currentRole?.name?.toLowerCase().includes('super admin') ||
        profile?.roles?.name === 'Super Admin' ||
        profile?.user_role === 'super_admin';
      
      return isSuperAdmin;
    }
    
    // Se ainda está carregando permissões, não mostra nada (evita flash)
    if (!initialized || permissionsLoading) {
      return false;
    }

    // ✅ Verificar configurações da organização (exceto campanhas e itens beta que são novos)
    const excludedFromModuleCheck = ['campanhas', 'cdr', 'whatsapp-audit', 'automation', 'supervisor-virtual'];
    if (!excludedFromModuleCheck.includes(item.id) && !isModuleEnabled(item.id)) {
      if (item.id === 'blacklist') {
        logger.debug(`❌ [BLACKLIST] Módulo não habilitado na organização`);
      }
      return false;
    }

    // Verificar features específicas
    // Nota: 'automation' agora é somente para super admin, não precisa verificar feature
    if (item.id === 'advanced' && !isFeatureEnabled('advancedSettings')) {
      return false;
    }


    // Se não tem permissão definida, sempre mostra
    if (!item.requiredPermissions) {
      if (item.id === 'blacklist') {
        logger.debug(`✅ [BLACKLIST] Item sem permissões - será exibido`);
      }
      return true;
    }

    // Se tem permissões definidas, verifica se o usuário tem pelo menos uma
    if (Array.isArray(item.requiredPermissions)) {
      const hasAnyPermission = item.requiredPermissions.some(permission => {
        return hasPermission(permission, true);
      });
      
      return hasAnyPermission;
    }

    // Se é uma string única
    return hasPermission(item.requiredPermissions, true);
  }, [initialized, permissionsLoading, isModuleEnabled, isFeatureEnabled, hasPermission, profile]);

  // ✅ OTIMIZAÇÃO: Memoizar função de verificação de submenu
  const shouldShowSubmenu = useCallback((item) => {
    if (!item.children) return true;

    // ✅ Verificar configurações da organização para o item pai (exceto para métricas)
    if (item.id !== 'metrics' && !isModuleEnabled(item.id)) {
      return false;
    }

    // Verifica se pelo menos um filho tem permissão
    return item.children.some(child => shouldShowMenuItem(child));
  }, [isModuleEnabled, shouldShowMenuItem]);

  // Nova estrutura dos menuItems com permissões
  const menuItems = [
    // 1. DASHBOARD - Sempre disponível
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      type: 'single',
      requiredPermissions: ['view_dashboard']
    },

    // 2. ADMINISTRAÇÃO - Apenas para quem tem permissões administrativas
    {
      id: 'administration',
      label: 'Administração',
      icon: Building2,
      type: 'expandable',
      requiredPermissions: ['manage_users', 'manage_accounts', 'manage_organizations'],
      children: [
        {
          id: 'register-user',
          label: 'Usuários',
          icon: UserIcon,
          requiredPermissions: ['manage_users']
        },
        {
          id: 'organizations',
          label: 'Organizações',
          icon: Building2,
          requiredPermissions: ['super_admin'] // Somente super admin
        },
        {
          id: 'accounts',
          label: 'Contas WhatsApp',
          icon: Smartphone,
          requiredPermissions: ['manage_accounts']
        },
        {
          id: 'blacklist',
          label: 'Blacklist',
          icon: Shield,
          requiredPermissions: ['manage_users']
        },
        {
          id: 'permissions',
          label: 'Gestão de Permissões',
          icon: Shield,
          requiredPermissions: ['super_admin'] // Somente super admin
        }
      ]
    },

    {
      id: 'automation',
      label: 'Agentes de IA',
      icon: Zap,
      type: 'expandable',
      requiredPermissions: ['super_admin'], // Somente super admin
      isBeta: 'dev', // Marca como dev
      children: [
        {
          id: 'ai-assistants',
          label: 'Assistentes',
          icon: Brain,
          requiredPermissions: ['use_ai_assistant']
        },
        {
          id: 'ai-playground',
          label: 'Playground',
          icon: Zap,
          requiredPermissions: ['access_ai_playground']
        },
        {
          id: 'agent-limits',
          label: 'Limites por Agente',
          icon: Users,
          requiredPermissions: ['manage_agent_limits']
        },
        {
          id: 'scheduling-settings',
          label: 'Agendamento',
          icon: Calendar,
          requiredPermissions: ['manage_scheduling']
        }
      ]
    },

    // 5. CHAT - Item direto na sidebar
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageCircle,
      type: 'single',
      requiredPermissions: ['view_chat'],
      isBeta: 'dev' // Marca como dev
    },

    // 6. SUPERVISOR VIRTUAL - Menu para relatórios e análises inteligentes
    {
      id: 'supervisor-virtual',
      label: 'Supervisor Virtual',
      icon: Eye,
      type: 'expandable',
      requiredPermissions: ['super_admin'], // Somente super admin
      isBeta: 'dev', // Marca como dev
      children: [
        {
          id: 'report-ai-analysis',
          label: 'Análise com Inteligência Artificial',
          icon: Sparkles,
          requiredPermissions: ['view_attendance_report']
        },
        {
          id: 'report-sentiment',
          label: 'Análise de Sentimento',
          icon: Heart,
          requiredPermissions: ['view_attendance_report']
        },
        {
          id: 'report-topics',
          label: 'Tópicos/Temas Identificados',
          icon: Tag,
          requiredPermissions: ['view_attendance_report']
        },
        {
          id: 'report-performance',
          label: 'Performance de Agentes',
          icon: BarChart3,
          requiredPermissions: ['view_attendance_report']
        }
      ]
    },

    // 7. MÉTRICAS - Temporariamente desabilitado
    // {
    //   id: 'metrics',
    //   label: 'Métricas',
    //   icon: BarChart3,
    //   type: 'expandable',
    //   children: [
    //     // Métricas WhatsApp
    //     {
    //       id: 'whatsapp-overview',
    //       label: 'Visão Geral',
    //       icon: PieChart
    //     },
    //     {
    //       id: 'whatsapp-productivity',
    //       label: 'Produtividade',
    //       icon: Target
    //     },
    //     {
    //       id: 'whatsapp-usage-time',
    //       label: 'Tempo de Uso',
    //       icon: Timer
    //     },
    //     {
    //       id: 'whatsapp-activity-heatmap',
    //       label: 'Mapa de Atividade',
    //       icon: Activity
    //     },
    //     {
    //       id: 'whatsapp-trends',
    //       label: 'Tendências',
    //       icon: LineChart
    //     }
    //   ]
    // },

    // 8. RANKING GAMIFICADO - Sempre disponível para todos os usuários
    // {
    //   id: 'ranking',
    //   label: 'Ranking',
    //   icon: Trophy,
    //   type: 'single',
    //   requiredPermissions: ['access_ranking']
    // },

    // 9. CDR - Conexão Direta ao Responsável (URA)
    {
      id: 'cdr',
      label: 'CDR',
      icon: Phone,
      type: 'single',
      requiredPermissions: ['super_admin'], // Somente super admin
      isBeta: 'dev' // Marca como dev
    },

    // 10. CAMPANHAS - Menu expandable com submenus
    {
      id: 'campanhas',
      label: 'Campanhas',
      icon: Zap,
      type: 'expandable',
      requiredPermissions: ['access_campaigns'],
      children: [
        {
          id: 'campanhas-list',
          label: 'Campanha',
          icon: Zap,
          requiredPermissions: ['access_campaigns']
        },
        {
          id: 'contacts',
          label: 'Contato',
          icon: Users,
          requiredPermissions: ['access_contacts']
        },
        {
          id: 'campanhas-templates',
          label: 'Template',
          icon: FileText,
          requiredPermissions: ['access_campaigns']
        },
        {
          id: 'campanhas-report',
          label: 'Relatório',
          icon: BarChart,
          requiredPermissions: ['access_campaigns']
        }
      ]
    },

    // 10. RELATÓRIO DE PRODUTIVIDADE - Sempre disponível
    // {
    //   id: 'productivity',
    //   label: 'Produtividade',
    //   icon: TrendingUp,
    //   type: 'single',
    //   requiredPermissions: ['access_productivity']
    // },

    // 11. RELATÓRIOS - Apenas para quem tem permissões de analytics (sem Análise Inteligente que foi movida)
    {
      id: 'analytics',
      label: 'Relatórios',
      icon: BarChart3,
      type: 'expandable',
      requiredPermissions: ['view_attendance_report', 'view_conversation_report', 'export_reports', 'access_advanced_metrics'],
      children: [
        {
          id: 'report-detailed-conversations',
          label: 'Relatório de Conversas Detalhado',
          icon: FileText,
          requiredPermissions: ['view_conversation_report']
        },
        {
          id: 'heatmap-geographic',
          label: 'Mapa de Calor Geográfico',
          icon: MapPin,
          requiredPermissions: ['view_conversation_report']
        },
        {
          id: 'manager-report',
          label: 'Relatório Gerencial WhatsApp',
          icon: BarChart,
          requiredPermissions: ['view_attendance_report']
        }
      ]
    },

    // 12. REGRAS - Menu principal com submenus
    {
      id: 'rules',
      label: 'Regras',
      icon: AlertCircle,
      type: 'expandable',
      requiredPermissions: ['manage_rules'],
      children: [
        {
          id: 'rules-new',
          label: 'Nova regra',
          icon: Plus,
          requiredPermissions: ['manage_rules']
        },
        {
          id: 'rules-report',
          label: 'Relatório',
          icon: FileText,
          requiredPermissions: ['manage_rules']
        }
      ]
    },

    {
      id: 'advanced',
      label: 'Avançado',
      icon: Settings,
      type: 'expandable',
      requiredPermissions: ['manage_organizations', 'manage_google_integration', 'access_logs', 'super_admin'],
      children: [
        {
          id: 'organization-settings',
          label: 'Configurações da Organização',
          icon: Settings,
          requiredPermissions: ['manage_organizations'],
          isBeta: 'beta' // Marca como beta
        },
        {
          id: 'google-integration',
          label: 'Configurações do Google',
          icon: Settings,
          requiredPermissions: ['manage_google_integration']
        },
        {
          id: 'system-logs',
          label: 'Logs do Sistema',
          icon: Activity,
          requiredPermissions: ['access_logs'],
          isBeta: 'dev' // Marca como dev
        },
        {
          id: 'whatsapp-audit',
          label: 'Auditoria WhatsApp',
          icon: Activity,
          requiredPermissions: ['super_admin'], // Apenas super admin
          route: '/whatsapp-audit',
          isBeta: 'beta' // Marca como beta
        }
      ]
    }
  ];

  // ✅ OTIMIZAÇÃO: Memoizar menuItems filtrados para evitar recálculos
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const shouldShow = item.type === 'expandable' ? shouldShowSubmenu(item) : shouldShowMenuItem(item);
      
      // Debug para campanhas
      if (item.id === 'campanhas') {
        logger.debug(`Campanhas filtrado:`, {
          shouldShow,
          type: item.type,
          expandable: item.type === 'expandable'
        });
      }
      
      return shouldShow;
    });
  }, [menuItems, shouldShowSubmenu, shouldShowMenuItem]);

  // Ajuste no renderMenuItem para remover ícones dos submenus e alinhar à esquerda
  const renderMenuItem = (item) => {
    // Debug para campanhas
    if (item.id === 'campanhas') {
      logger.debug(`Renderizando campanhas:`, {
        item,
        isActive: location.pathname.includes(item.id),
        hasSubmenu: !!item.children || !!item.submenu
      });
    }
    
    const isActive = location.pathname.includes(item.id);
    const isMenuExpanded = expandedMenus.includes(item.id);
    const hasSubmenu = !!item.children || !!item.submenu;
    
    // Verificar se algum submenu está ativo
    const hasActiveChild = hasSubmenu && (item.children || item.submenu)?.some(
      child => location.pathname.includes(child.id)
    );
    
    // Debug para campanhas
    if (item.id === 'campanhas') {
      logger.debug(`Campanhas isActive:`, {
        pathname: location.pathname,
        itemId: item.id,
        isActive
      });
    }

    return (
      <div key={item.id}>
        <MenuTooltip
          content={item.label}
          show={isCollapsed}
        >
          <button
            onClick={(e) => {
              if (item.disabled) return;
              if (hasSubmenu) {
                if (isCollapsed) {
                  setIsCollapsed(false);
                  setExpandedMenus([item.id]);
                } else {
                  setExpandedMenus((prev) =>
                    isMenuExpanded
                      ? prev.filter((id) => id !== item.id)
                      : [...prev, item.id]
                  );
                }
              } else {
                const route = getRouteForTab(item.id);
                console.log(`🎯 Navegando para: ${item.id} -> ${route}`);
                logger.debug(`🚀 [NAVIGATION] Clique no menu:`, {
                  itemId: item.id,
                  route: route,
                  currentPath: location.pathname
                });
                
                // Verificar se é Ctrl+clique, Shift+clique ou clique do meio
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
                  // Abrir em nova guia/janela
                  window.open(route, e.shiftKey ? '_blank' : '_blank');
                } else {
                  // Navegação normal
                  console.log(`🚀 Navegando para: ${route}`);
                  navigate(route);
                }
              }
            }}
            onMouseDown={(e) => {
              // Tratar clique do meio do mouse (button === 1)
              if (e.button === 1 && !item.disabled && !hasSubmenu) {
                e.preventDefault();
                const route = getRouteForTab(item.id);
                window.open(route, '_blank');
              }
            }}
            onAuxClick={(e) => {
              // Tratar clique do meio do mouse (button === 1)
              if (e.button === 1 && !item.disabled && !hasSubmenu) {
                e.preventDefault();
                const route = getRouteForTab(item.id);
                window.open(route, '_blank');
              }
            }}
            disabled={!!item.disabled}
            className={item.disabled
              ? 'w-full flex items-center justify-between rounded-lg transition-all duration-200 group relative px-4 py-3 text-muted-foreground opacity-60 cursor-not-allowed bg-transparent'
              : cn(
                'w-full flex items-center justify-between rounded-lg transition-all duration-200 group relative',
                isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3',
                isActive && !isCollapsed
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              )
            }
          >
            {/* Barra lateral azul quando colapsado e ativo (item principal ou submenu ativo) */}
            {(isActive || hasActiveChild) && isCollapsed && (
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full" />
            )}
            <span className="flex items-center min-w-0 relative">
              <item.icon 
                size={20} 
                className={cn(
                  isActive && isCollapsed ? 'text-primary' : '',
                  isActive && !isCollapsed ? 'text-primary-foreground' : ''
                )}
              />
              {item.id === 'chat' && totalUnread > 0 && (
                <span
                  className="absolute -top-2 -right-2 bg-[#D115F2] text-white text-xs rounded-full px-1.5 py-0.5 shadow"
                  style={{ minWidth: 18, minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
              {!isCollapsed && (
                <MenuTooltip
                  content={item.label}
                  show={true}
                >
                  <span className={cn(
                    'ml-3 truncate text-sm flex items-center gap-2',
                    item.disabled ? '!text-muted-foreground' : ''
                  )}>
                    {item.label}
                    {item.isBeta && (
                      <Badge variant="secondary" className={cn(
                        "text-xs px-1.5 py-0 h-4",
                        item.isBeta === 'beta' 
                          ? "bg-orange-100 text-orange-700 border-orange-200"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                      )}>
                        {item.isBeta === 'beta' ? 'Beta' : 'Dev'}
                      </Badge>
                    )}
                  </span>
                </MenuTooltip>
              )}
            </span>
            {!isCollapsed && hasSubmenu && (
              <span className="flex-shrink-0 ml-2">
                {isMenuExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            )}
          </button>
        </MenuTooltip>

        {/* Submenus - Removidos ícones e alinhados à esquerda */}
        {!isCollapsed && hasSubmenu && isMenuExpanded && (
          <div className="ml-4 flex flex-col space-y-1 mt-1">
            {(item.children || item.submenu)
              .filter((child) => shouldShowMenuItem(child))
              .map((child) => (
                <MenuTooltip
                  key={child.id}
                  content={child.label}
                  show={true}
                >
                  <button
                    className={cn(
                      'flex items-center w-full px-3 py-2 rounded transition-all duration-200 text-sm text-left relative',
                      location.pathname.includes(child.id)
                        ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                    onClick={(e) => {
                      // ✅ Usar route do item se disponível, senão usar getRouteForTab
                      const route = child.route || getRouteForTab(child.id);
                      
                      // Verificar se é Ctrl+clique, Shift+clique ou clique do meio
                      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
                        // Abrir em nova guia/janela
                        window.open(route, e.shiftKey ? '_blank' : '_blank');
                      } else {
                        // Navegação normal
                        navigate(route);
                      }
                    }}
                    onMouseDown={(e) => {
                      // Tratar clique do meio do mouse (button === 1)
                      if (e.button === 1) {
                        e.preventDefault();
                        const route = child.route || getRouteForTab(child.id);
                        window.open(route, '_blank');
                      }
                    }}
                    onAuxClick={(e) => {
                      // Tratar clique do meio do mouse (button === 1)
                      if (e.button === 1) {
                        e.preventDefault();
                        const route = child.route || getRouteForTab(child.id);
                        window.open(route, '_blank');
                      }
                    }}
                  >
                    {/* Barra lateral azul quando submenu está ativo e sidebar está colapsada */}
                    {location.pathname.includes(child.id) && isCollapsed && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full" />
                    )}
                    <span className="truncate flex items-center gap-2">
                      {child.label}
                      {child.isBeta && (
                        <Badge variant="secondary" className={cn(
                          "text-xs px-1.5 py-0 h-4",
                          child.isBeta === 'beta' 
                            ? "bg-orange-100 text-orange-700 border-orange-200"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        )}>
                          {child.isBeta === 'beta' ? 'Beta' : 'Dev'}
                        </Badge>
                      )}
                    </span>
                  </button>
                </MenuTooltip>
              ))}
          </div>
        )}
      </div>
    );
  };

  // Função utilitária para mapear id de tab para rota
  function getRouteForTab(tabId) {
    logger.debug(`getRouteForTab chamado com: ${tabId}`);
    let route;
    switch (tabId) {
      case 'dashboard': route = '/dashboard'; break;
      case 'contacts': route = '/contacts'; break;
      // case 'ranking': route = '/ranking'; break;
      case 'chat': route = '/chat'; break;
      case 'accounts': route = '/accounts'; break;
      case 'departments': route = '/departments'; break;
      case 'user-settings': route = '/user-settings'; break;
      case 'register-user': route = '/register-user'; break;
      case 'organizations': route = '/organizations'; break;
      case 'ai-assistants': route = '/ai-assistants'; break;
      case 'ai-playground': route = '/ai-playground'; break;
      case 'ai-settings': route = '/ai-settings'; break;
      case 'agent-limits': route = '/settings/agent-limits'; break;
      case 'google-connect': route = '/google-connect'; break;
      case 'google-integration': route = '/google-integration'; break;
      case 'scheduling-settings': route = '/scheduling-settings'; break;
      case 'report-attendance': route = '/report-attendance'; break;
      case 'report-ai-analysis': route = '/report-ai-analysis'; break;
      case 'report-sentiment': route = '/report-sentiment'; break;
      case 'report-topics': route = '/report-topics'; break;
      case 'report-performance': route = '/report-performance'; break;
      case 'report-detailed-conversations': route = '/report-detailed-conversations'; break;
      case 'heatmap-geographic': route = '/heatmap-geographic'; break;
      case 'permissions': route = '/settings/advanced'; break;
      case 'organization-settings': route = '/settings/organization'; break;
      case 'manager-report': route = '/manager-report'; break;
      case 'system-logs': route = '/system-logs'; break;
      case 'whatsapp-audit': route = '/whatsapp-audit'; break;
      case 'rules': route = '/rules'; break;
      case 'rules-new': route = '/rules'; break;
      case 'rules-report': route = '/rules/report'; break;
      case 'cdr': route = '/cdr'; break;
      case 'campanhas': route = '/campanhas'; break;
      case 'campanhas-list': route = '/campanhas'; break;
      case 'campanhas-templates': route = '/campanhas?tab=templates'; break;
      case 'campanhas-report': route = '/campanhas/report'; break;
      // case 'productivity': route = '/productivity'; break;
      case 'blacklist': 
        route = '/blacklist'; 
        break;
      
      // Rotas removidas do Atendimento Inteligente (arquivadas)
      // case 'product-dashboard': route = '/product-dashboard'; break;
      // case 'flow-manager': route = '/flow-manager'; break;
      // case 'team-strategy': route = '/team-strategy'; break;
      // case 'chat-manager': route = '/chat-manager'; break;
      // case 'pause-management': route = '/pause-management'; break;
      // case 'supervisor-dashboard': route = '/supervisor'; break;
      
      default: 
        route = '/dashboard'; 
        break;
    }

    return route;
  }

  // Removido: uso de supabase.auth.getUser - autenticação agora via useAuth hook

  return (
    <>
      {/* 🍔 MOBILE HEADER - Visível apenas em mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Menu Hambúrguer */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} className="text-gray-700" />
          </button>

          {/* Logo DO + Organização centralizado */}
          <div className="flex flex-col items-center justify-center flex-1">
            <span className="text-2xl text-gray-800 tracking-tighter" style={{ fontFamily: 'Cal Sans, Plus Jakarta Sans, sans-serif' }}>
              <span>D</span><span style={{ color: '#D115F2' }}>O</span>
            </span>
            {/* ✅ CORREÇÃO: Usar profile.organization */}
            {organization?.name && (
              <span className="text-xs text-blue-600 mt-1 truncate max-w-[120px]">
                {organization.name}
              </span>
            )}
          </div>

          {/* Perfil */}
          <button
            onClick={() => navigate('/user-settings')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <UserIcon size={20} className="text-gray-700" />
          </button>
        </div>
      </div>

      {/* 📱 MOBILE SIDEBAR OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 📱 MOBILE SIDEBAR */}
      <div className={cn(
        'md:hidden fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 ease-in-out',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Header da sidebar mobile */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <img 
              src="/logo_completo.png" 
              alt="Dohoo" 
              className="h-8 w-auto object-contain"
            />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-700" />
            </button>
          </div>

          {/* ✅ NOME DA ORGANIZAÇÃO - MOBILE */}
          {organization?.name && (
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 justify-center bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg py-2 px-3">
                <Building2 size={16} className="text-blue-600 flex-shrink-0" />
                <span className="text-sm text-blue-800 truncate">
                  {organization.name}
                </span>
              </div>
            </div>
          )}

          {/* Menu items */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-2 px-4">
              {filteredMenuItems.map(renderMenuItem)}
            </div>
          </div>

        </div>
      </div>

      {/* 🖥️ DESKTOP SIDEBAR - Visível apenas em desktop */}
      <div
        className={cn(
          'hidden md:flex bg-card border-r border-border h-screen flex-col justify-between py-4 transition-all duration-500 ease-in-out',
          isCollapsed ? 'w-16' : 'w-60',
          isHovered && !isCollapsed ? 'shadow-lg' : ''
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* TOPO: Logo customizado e menu de 3 pontos */}
        <div className={cn(
          'flex items-center justify-between mb-3 mt-2',
          isCollapsed ? 'px-2' : 'px-4'
        )}>
          {isCollapsed ? (
            <div className="flex w-full justify-center items-center select-none">
              <img 
                src="/logo_fechado.png" 
                alt="Dohoo" 
                className="h-8 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="flex w-full justify-start items-center select-none">
              <img 
                src="/logo_completo.png" 
                alt="Dohoo" 
                className="h-7 w-auto object-contain"
              />
            </div>
          )}
          
        </div>

        <div className="mx-3 my-3 border-t border-gray-200/80" />

        {/* MENUS */}
        <div className="flex flex-col w-full flex-1 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-none px-2 mt-0">
          {filteredMenuItems.map(renderMenuItem)}
        </div>

      </div>
    </>
  );
};

export { MobileSpacer };
export default Sidebar;
