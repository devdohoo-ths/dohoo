import React from 'react';
import { TeamMetricsDashboard } from '@/components/dashboard/TeamMetricsDashboard';
import { PageHeader } from '@/components/layout/PageHeader';

export default function TeamMetricsPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Métricas dos Times"
        description="Analise o desempenho e produtividade das equipes da sua organização"
        icon="users"
      />
      
      <TeamMetricsDashboard 
        selectedPeriod="7d" 
        dateStart="2025-08-10"
        dateEnd="2025-08-12"
      />
    </div>
  );
}
