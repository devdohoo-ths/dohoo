import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock, AlertTriangle } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

const SystemLogs: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermissions={['define_permissions']}
      showAlert={true}
      fallback={
        <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
          <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
            <div className="text-center">
              <h1 className="text-2xl text-red-600 mb-4">Acesso Negado</h1>
              <p className="text-gray-600">
                Você não tem permissão para acessar os Logs do Sistema.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Entre em contato com o administrador do sistema para solicitar acesso.
              </p>
            </div>
          </div>
        </div>
      }
    >
      <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Header responsivo */}
          <div className="mb-6 border-b pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl flex items-center gap-2">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  Logs do Sistema
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Visualize logs de atividades e erros do sistema
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo em desenvolvimento */}
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-center max-w-md">
              <div className="mb-6">
                <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <Clock className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              </div>
              
              <h2 className="text-xl mb-2">Em Desenvolvimento</h2>
              <p className="text-muted-foreground mb-4">
                A funcionalidade de Logs do Sistema está sendo implementada.
              </p>
              
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-600" />
                    Funcionalidades Planejadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Logs de atividades dos usuários</li>
                    <li>• Logs de erros do sistema</li>
                    <li>• Logs de integrações</li>
                    <li>• Filtros e busca avançada</li>
                    <li>• Exportação de relatórios</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default SystemLogs; 