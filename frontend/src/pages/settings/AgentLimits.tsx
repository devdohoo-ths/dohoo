import React from 'react';
import { AgentLimitsManager } from '@/components/ai/AgentLimitsManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

const AgentLimitsPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading, error: orgError } = useOrganization();

  // Loading state
  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Carregando configurações...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (orgError) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg text-gray-900 mb-2">Erro ao carregar</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Não foi possível carregar as configurações da organização.
              </p>
              <p className="text-xs text-red-600">
                {orgError.message}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se usuário está autenticado
  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg text-gray-900 mb-2">Acesso Negado</h3>
              <p className="text-sm text-muted-foreground">
                Você precisa estar logado para acessar esta página.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl text-gray-900 font-bold">
              Gerenciamento de Agentes
            </h1>
            <p className="text-gray-600">
              Configure limites de créditos AI para cada agente da organização
            </p>
          </div>
        </div>

        {/* Informações sobre o sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sistema de Limites por Agente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="text-blue-900 mb-1">Limite Diário</h4>
                <p className="text-blue-700">
                  Controla quantos créditos cada agente pode usar por dia
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <h4 className="text-green-900 mb-1">Limite Mensal</h4>
                <p className="text-green-700">
                  Define o total de créditos disponíveis por mês
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <h4 className="text-orange-900 mb-1">Status Ativo</h4>
                <p className="text-orange-700">
                  Permite ativar/desativar agentes conforme necessário
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Componente principal */}
        <AgentLimitsManager />
      </div>
    </div>
  );
};

export default AgentLimitsPage;