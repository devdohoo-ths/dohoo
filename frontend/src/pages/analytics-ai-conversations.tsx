import React from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ConversationList } from '@/components/analytics/ConversationList';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

const AIConversationsPage = () => {
  const { analytics, loading } = useAnalytics();
  if (loading) return <div className="p-8">Carregando...</div>;
  return (
          <PermissionGuard requiredPermissions={['access_ai_analytics']}>
      <div className="p-8">
        <h1 className="text-2xl mb-6">💬 Conversas IA</h1>
        <ConversationList analytics={analytics} />
      </div>
    </PermissionGuard>
  );
};
export default AIConversationsPage; 