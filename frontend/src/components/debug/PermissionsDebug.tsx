import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const PermissionsDebug = () => {
  const { user, profile } = useAuth();
  const { permissions, loading, initialized } = usePermissions();
  const { roles } = useRoles();

  if (!user || !profile) {
    return <div>Usuário não logado</div>;
  }

  if (loading || !initialized) {
    return <div>Carregando permissões...</div>;
  }

  const currentRole = roles.find(r => r.id === profile?.role_id);

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>🔍 Debug de Permissões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="mb-2">Dados do Usuário</h3>
            <div className="space-y-1 text-sm">
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Nome:</strong> {profile.name}</p>
              <p><strong>Role ID:</strong> {profile.role_id}</p>
              <p><strong>Role Nome:</strong> {currentRole?.name || 'N/A'}</p>
            </div>
          </div>
          <div>
            <h3 className="mb-2">Organização</h3>
            <div className="space-y-1 text-sm">
              <p><strong>ID:</strong> {profile.organization_id}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2">Permissões JSON</h3>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(permissions, null, 2)}
          </pre>
        </div>

        <div>
          <h3 className="mb-2">Permissões por Módulo</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(permissions).map(([module, perms]) => (
              <div key={module} className="border rounded p-3">
                <h4 className="mb-2 capitalize">{module}</h4>
                {typeof perms === 'object' && perms !== null ? (
                  <div className="space-y-1">
                    {Object.entries(perms).map(([perm, value]) => (
                      <div key={perm} className="flex items-center gap-2">
                        <Badge variant={value ? "default" : "secondary"}>
                          {value ? "✅" : "❌"}
                        </Badge>
                        <span className="text-xs">{perm}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Badge variant={perms ? "default" : "secondary"}>
                    {perms ? "✅ Habilitado" : "❌ Desabilitado"}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 