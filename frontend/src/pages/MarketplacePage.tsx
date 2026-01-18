import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Search, 
  Filter,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Brain,
  MessageCircle,
  Settings,
  Zap,
  Chrome,
  Video,
  Cloud,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useToast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { apiBase } from '@/utils/apiBase';

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'available' | 'connected' | 'coming_soon';
  category: string;
  features: string[];
  color: string;
}

const integrations: IntegrationCard[] = [
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Integre com Gmail, Calendar, Drive e outros serviços Google',
    icon: Chrome,
    status: 'available',
    category: 'Produtividade',
    features: ['Gmail', 'Calendar', 'Drive', 'Meet'],
    color: 'bg-blue-500'
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Conecte com Teams para comunicação e colaboração',
    icon: MessageSquare,
    status: 'available',
    category: 'Comunicação',
    features: ['Chat', 'Reuniões', 'Canais', 'Arquivos'],
    color: 'bg-purple-500'
  },
  {
    id: 'goto',
    name: 'GoTo Meeting',
    description: 'Integração com GoTo para webinars e reuniões',
    icon: Video,
    status: 'available',
    category: 'Comunicação',
    features: ['Reuniões', 'Webinars', 'Gravações'],
    color: 'bg-green-500'
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Sincronize dados com Salesforce CRM',
    icon: Cloud,
    status: 'coming_soon',
    category: 'CRM',
    features: ['Leads', 'Oportunidades', 'Contatos', 'Relatórios'],
    color: 'bg-blue-600'
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Integre com HubSpot para marketing e vendas',
    icon: Zap,
    status: 'coming_soon',
    category: 'Marketing',
    features: ['Leads', 'Email Marketing', 'Analytics', 'CRM'],
    color: 'bg-orange-500'
  }
];

export const MarketplacePage: React.FC = () => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500 text-white">Conectado</Badge>;
      case 'available':
        return <Badge className="bg-blue-500 text-white">Disponível</Badge>;
      case 'coming_soon':
        return <Badge variant="secondary">Em Breve</Badge>;
      default:
        return <Badge variant="outline">Indisponível</Badge>;
    }
  };

  const handleConnect = (integration: IntegrationCard) => {
    if (integration.status === 'connected') {
      // Navegar para configurações
      console.log('Configurar:', integration.name);
    } else if (integration.status === 'available') {
      // Iniciar processo de conexão
      if (integration.id === 'google') {
        window.location.href = `${apiBase}/google-connect`;
      } else {
        console.log('Conectar:', integration.name);
      }
    }
  };

  const getActionButton = (integration: IntegrationCard) => {
    if (integration.status === 'connected') {
      return (
        <Button variant="outline" size="sm" onClick={() => handleConnect(integration)}>
          <Settings size={16} className="mr-2" />
          Configurar
        </Button>
      );
    } else if (integration.status === 'available') {
      return (
        <Button size="sm" onClick={() => handleConnect(integration)}>
          <ExternalLink size={16} className="mr-2" />
          Conectar
        </Button>
      );
    } else {
      return (
        <Button variant="outline" size="sm" disabled>
          Em Breve
        </Button>
      );
    }
  };

  return (
    <PermissionGuard requiredPermissions={['access_marketplace']}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl text-gray-900 font-bold">Marketplace de Integrações</h1>
          <p className="text-gray-600">
            Conecte o Dohoo com suas ferramentas favoritas para automatizar seu trabalho
          </p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Todas</Button>
          <Button variant="outline" size="sm">Produtividade</Button>
          <Button variant="outline" size="sm">Comunicação</Button>
          <Button variant="outline" size="sm">CRM</Button>
          <Button variant="outline" size="sm">Marketing</Button>
        </div>

        {/* Grid de Integrações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <Card key={integration.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${integration.color}`}>
                      <integration.icon size={24} className="text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      <p className="text-sm text-gray-500">{integration.category}</p>
                    </div>
                  </div>
                  {getStatusBadge(integration.status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  {integration.description}
                </p>
                
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Funcionalidades
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {integration.features.map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="pt-2">
                  {getActionButton(integration)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}; 