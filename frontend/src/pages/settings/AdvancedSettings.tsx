import React from 'react';
import PermissionsManager from '@/components/settings/PermissionsManager';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Crown, UserCheck } from 'lucide-react';

const AdvancedSettings: React.FC = () => {
  const { profile } = useAuth();

  // 🎯 DETERMINAR NÍVEL DO USUÁRIO
  const userLevel = React.useMemo(() => {
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

  // 🎯 VERIFICAR SE PODE ACESSAR
  const canAccess = ['super_admin', 'admin'].includes(userLevel);

  if (!canAccess) {
    return (
      <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
        <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl text-red-600 mb-4">Acesso Negado</h1>
            <p className="text-gray-600 mb-2">
              Você não tem permissão para acessar as Gestão de Permissões.
            </p>
            <p className="text-sm text-gray-500">
              Apenas Administradores e Super Administradores podem acessar esta área.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <UserCheck className="w-4 h-4" />
              <span>Seu nível: {userLevel === 'super_admin' ? 'Super Admin' : userLevel === 'admin' ? 'Admin' : 'Usuário'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
      <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
        {/* 🎯 HEADER COM NÍVEL DO USUÁRIO */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <UserCheck className="w-4 h-4" />
            <span>Nível: {userLevel === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
            {userLevel === 'super_admin' && (
              <Crown className="w-4 h-4 text-yellow-500" />
            )}
          </div>
        </div>

        {/* Conteúdo da Gestão de Permissões */}
        <PermissionsManager />
      </div>
    </div>
  );
};

export default AdvancedSettings; 