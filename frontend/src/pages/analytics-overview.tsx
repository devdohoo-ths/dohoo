import React from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

const AnalyticsOverviewPage = () => {
  const { summary, loading } = useAnalytics();
  if (loading) return <div className="p-8">Carregando...</div>;
  return (
          <PermissionGuard requiredPermissions={['view_dashboard']}>
      <div className="p-8">
        <h1 className="text-2xl mb-6">📊 Visão Geral</h1>
        <AnalyticsOverview summary={summary} />
      </div>
    </PermissionGuard>
  );
};
export default AnalyticsOverviewPage; 