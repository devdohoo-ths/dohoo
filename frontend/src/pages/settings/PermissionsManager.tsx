import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

const PermissionsDebugPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { permissions, loading, initialized, hasPermission } = usePermissions();

  if (!profile) {
    return <div>Loading profile...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl">Debug Super Admin Access</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h2 className="text-lg mb-4">User Information</h2>
        <div className="space-y-2 text-sm">
          <p><strong>User ID:</strong> {user?.id}</p>
          <p><strong>User Role:</strong> {profile.user_role}</p>
          <p><strong>Is Super Admin:</strong> {profile.user_role === 'super_admin' ? 'YES' : 'NO'}</p>
          <p><strong>Organization ID:</strong> {profile.organization_id}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg mb-4">Permissions Status</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Loading:</strong> {loading ? 'YES' : 'NO'}</p>
          <p><strong>Initialized:</strong> {initialized ? 'YES' : 'NO'}</p>
          <p><strong>Has Dashboard Permission:</strong> {hasPermission('view_dashboard') ? 'YES' : 'NO'}</p>
          <p><strong>Has Admin Permission:</strong> {hasPermission('manage_users') ? 'YES' : 'NO'}</p>
          <p><strong>Has Chat Permission:</strong> {hasPermission('view_chat') ? 'YES' : 'NO'}</p>
          <p><strong>Has AI Permission:</strong> {hasPermission('use_ai_assistant') ? 'YES' : 'NO'}</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h2 className="text-lg mb-4">Raw Permissions</h2>
        <pre className="text-xs bg-white p-2 rounded border overflow-auto">
          {JSON.stringify(permissions, null, 2)}
        </pre>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h2 className="text-lg mb-4">Test Access</h2>
        <div className="space-y-2">
          <p>Dashboard: {hasPermission('view_dashboard') ? '✅ Access' : '❌ No Access'}</p>
          <p>Administration: {hasPermission('manage_users') ? '✅ Access' : '❌ No Access'}</p>
          <p>Chat: {hasPermission('view_chat') ? '✅ Access' : '❌ No Access'}</p>
          <p>AI: {hasPermission('use_ai_assistant') ? '✅ Access' : '❌ No Access'}</p>
          <p>Analytics: {hasPermission('view_dashboard') ? '✅ Access' : '❌ No Access'}</p>
          <p>Settings: {hasPermission('define_permissions') ? '✅ Access' : '❌ No Access'}</p>
        </div>
      </div>
    </div>
  );
};

export default PermissionsDebugPage; 