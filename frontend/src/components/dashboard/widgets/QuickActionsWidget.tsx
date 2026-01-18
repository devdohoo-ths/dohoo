
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Bot, Users, Zap, ShoppingCart, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionsWidgetProps {
  className?: string;
}

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ className }) => {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Novo Chat',
      description: 'Iniciar conversa',
      icon: MessageCircle,
      color: 'text-blue-600',
      route: '/chat',
      onClick: (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
          window.open('/chat', '_blank');
        } else {
          navigate('/chat');
        }
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/chat', '_blank');
        }
      },
      onAuxClick: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/chat', '_blank');
        }
      }
    },
    {
      title: 'Playground IA',
      description: 'Testar assistente',
      icon: Bot,
      color: 'text-purple-600',
      route: '/ai/playground',
      onClick: (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
          window.open('/ai/playground', '_blank');
        } else {
          navigate('/ai/playground');
        }
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/ai/playground', '_blank');
        }
      },
      onAuxClick: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/ai/playground', '_blank');
        }
      }
    },
    {
      title: 'Conectar Conta',
      description: 'WhatsApp Business',
      icon: Users,
      color: 'text-green-600',
      route: '/accounts',
      onClick: (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
          window.open('/accounts', '_blank');
        } else {
          navigate('/accounts');
        }
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/accounts', '_blank');
        }
      },
      onAuxClick: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/accounts', '_blank');
        }
      }
    },
    {
      title: 'Comprar Créditos',
      description: 'Adquirir tokens',
      icon: ShoppingCart,
      color: 'text-orange-600',
      route: '/ai/credits',
      onClick: (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
          window.open('/ai/credits', '_blank');
        } else {
          navigate('/ai/credits');
        }
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/ai/credits', '_blank');
        }
      },
      onAuxClick: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/ai/credits', '_blank');
        }
      }
    },
    {
      title: 'Ver Analytics',
      description: 'Relatórios IA',
      icon: BarChart3,
      color: 'text-indigo-600',
      route: '/analytics',
      onClick: (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
          window.open('/analytics', '_blank');
        } else {
          navigate('/analytics');
        }
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/analytics', '_blank');
        }
      },
      onAuxClick: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/analytics', '_blank');
        }
      }
    },
    {
      title: 'Configurar IA',
      description: 'Assistentes',
      icon: Zap,
      color: 'text-pink-600',
      route: '/ai',
      onClick: (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
          window.open('/ai', '_blank');
        } else {
          navigate('/ai');
        }
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/ai', '_blank');
        }
      },
      onAuxClick: (e: React.MouseEvent) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open('/ai', '_blank');
        }
      }
    }
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {actions.map((action) => (
            <Button
              key={action.title}
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2 hover:scale-105 transition-transform"
              onClick={action.onClick}
              onMouseDown={action.onMouseDown}
              onAuxClick={action.onAuxClick}
            >
              <action.icon className={`w-6 h-6 ${action.color}`} />
              <div className="text-center">
                <div className="text-sm">{action.title}</div>
                <div className="text-xs text-muted-foreground">{action.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
