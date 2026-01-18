import React from 'react';
import { Label } from '@/components/ui/label';

const PermissionsInfo: React.FC = () => {
  return (
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
  );
};

export default PermissionsInfo;