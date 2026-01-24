// ✅ CONFIGURAÇÃO DE MÓDULOS E PERMISSÕES
// Esta constante define todos os módulos e permissões disponíveis no sistema
// Baseado no menu lateral: Dashboard, Administração, Agentes de IA, Chat, etc.

export const PERMISSION_MODULES = {
  dashboard: {
    name: 'Dashboard',
    description: 'Acesso ao painel principal',
    icon_name: 'Home',
    permissions: {
      view_dashboard: {
        name: 'Acesso ao Dashboard',
        description: 'Pode visualizar o painel principal'
      }
    }
  },
  administration: {
    name: 'Administração',
    description: 'Configurações administrativas do sistema',
    icon_name: 'Building2',
    permissions: {
      manage_users: {
        name: 'Gerenciar Usuários',
        description: 'Pode cadastrar e gerenciar usuários'
      },
      manage_organizations: {
        name: 'Gerenciar Organizações',
        description: 'Pode gerenciar organizações (apenas Super Admin)'
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
      },
      manage_teams: {
        name: 'Gerenciar Times',
        description: 'Pode gerenciar times'
      },
      manage_blacklist: {
        name: 'Gerenciar Blacklist',
        description: 'Pode gerenciar lista de bloqueio'
      },
      define_permissions: {
        name: 'Gestão de Permissões',
        description: 'Pode gerenciar permissões do sistema'
      }
    }
  },
  automation: {
    name: 'Agentes de IA',
    description: 'Funcionalidades de inteligência artificial',
    icon_name: 'Zap',
    permissions: {
      use_ai_assistant: {
        name: 'Usar Assistente IA',
        description: 'Pode usar assistentes de IA'
      },
      access_ai_playground: {
        name: 'Acessar Playground',
        description: 'Pode acessar o playground de IA'
      },
      manage_flows: {
        name: 'Gerenciar Fluxos',
        description: 'Pode criar e gerenciar fluxos de automação'
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
        name: 'Gerenciar Limites por Agente',
        description: 'Pode gerenciar limites de agentes'
      }
    }
  },
  chat: {
    name: 'Chat',
    description: 'Gerenciamento de conversas e mensagens',
    icon_name: 'MessageCircle',
    permissions: {
      view_chat: {
        name: 'Visualizar Chat',
        description: 'Pode visualizar o chat'
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
      view_history: {
        name: 'Acessar Histórico',
        description: 'Pode visualizar histórico de conversas'
      },
      configure_automations: {
        name: 'Configurar Automações',
        description: 'Pode criar e editar automações de chat'
      }
    }
  },
  'supervisor-virtual': {
    name: 'Supervisor Virtual',
    description: 'Análises inteligentes e relatórios avançados',
    icon_name: 'Eye',
    permissions: {
      view_ai_analysis: {
        name: 'Análise com Inteligência Artificial',
        description: 'Pode visualizar análises com IA'
      },
      view_sentiment_analysis: {
        name: 'Análise de Sentimento',
        description: 'Pode visualizar análise de sentimento'
      },
      view_topics: {
        name: 'Tópicos/Temas Identificados',
        description: 'Pode visualizar tópicos identificados'
      },
      view_agent_performance: {
        name: 'Performance de Agentes',
        description: 'Pode visualizar performance de agentes'
      }
    }
  },
  cdr: {
    name: 'CDR',
    description: 'Conexão Direta ao Responsável (URA)',
    icon_name: 'Phone',
    permissions: {
      access_cdr: {
        name: 'Acessar CDR',
        description: 'Pode acessar o módulo CDR'
      }
    }
  },
  campanhas: {
    name: 'Campanhas',
    description: 'Acesso às campanhas inteligentes',
    icon_name: 'Zap',
    permissions: {
      access_campaigns: {
        name: 'Acessar Campanhas',
        description: 'Pode acessar campanhas inteligentes'
      },
      access_contacts: {
        name: 'Acessar Contatos',
        description: 'Pode acessar a tela de contatos'
      },
      manage_templates: {
        name: 'Gerenciar Templates',
        description: 'Pode gerenciar templates de campanha'
      },
      view_campaign_reports: {
        name: 'Visualizar Relatórios',
        description: 'Pode visualizar relatórios de campanha'
      }
    }
  },
  analytics: {
    name: 'Relatórios',
    description: 'Relatórios e análises de dados',
    icon_name: 'BarChart3',
    permissions: {
      view_attendance_report: {
        name: 'Relatório de Atendimento',
        description: 'Pode visualizar relatório de atendimento'
      },
      view_conversation_report: {
        name: 'Relatório de Conversas',
        description: 'Pode visualizar relatório de conversas'
      },
      view_geographic_heatmap: {
        name: 'Mapa de Calor Geográfico',
        description: 'Pode visualizar mapa de calor geográfico'
      },
      export_reports: {
        name: 'Exportar Relatórios',
        description: 'Pode exportar relatórios'
      },
      access_advanced_metrics: {
        name: 'Métricas Avançadas',
        description: 'Pode acessar métricas avançadas'
      }
    }
  },
  rules: {
    name: 'Regras',
    description: 'Gerenciamento de regras de monitoramento',
    icon_name: 'AlertCircle',
    permissions: {
      manage_rules: {
        name: 'Gerenciar Regras',
        description: 'Pode criar e gerenciar regras de monitoramento'
      },
      view_rules_report: {
        name: 'Visualizar Relatório de Regras',
        description: 'Pode visualizar relatório de regras'
      }
    }
  },
  advanced: {
    name: 'Avançado',
    description: 'Configurações avançadas do sistema',
    icon_name: 'Settings',
    permissions: {
      manage_organizations: {
        name: 'Gerenciar Organizações',
        description: 'Pode gerenciar organizações'
      },
      manage_google_integration: {
        name: 'Gerenciar Integração Google',
        description: 'Pode gerenciar integração com Google'
      },
      access_logs: {
        name: 'Acessar Logs',
        description: 'Pode acessar logs do sistema'
      },
      access_whatsapp_audit: {
        name: 'Auditoria WhatsApp',
        description: 'Pode acessar auditoria WhatsApp'
      }
    }
  }
};

// ✅ Função auxiliar para obter todas as chaves de permissões de um módulo
export function getModulePermissionKeys(moduleKey) {
  const module = PERMISSION_MODULES[moduleKey];
  if (!module) return [];
  return Object.keys(module.permissions || {});
}

// ✅ Função auxiliar para obter todas as chaves de módulos
export function getAllModuleKeys() {
  return Object.keys(PERMISSION_MODULES);
}

// ✅ Função auxiliar para criar estrutura de permissões com todas as permissões ativadas
export function createFullPermissions() {
  const permissions = {};
  for (const [moduleKey, module] of Object.entries(PERMISSION_MODULES)) {
    const modulePermissions = {};
    for (const permissionKey of Object.keys(module.permissions)) {
      modulePermissions[permissionKey] = true;
    }
    permissions[moduleKey] = modulePermissions;
  }
  return permissions;
}

