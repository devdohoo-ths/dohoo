import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useRoles } from '@/hooks/useRoles';
import { UnifiedDashboard } from '@/components/dashboard/UnifiedDashboard';
import { MetricsOverview } from '@/components/dashboard/MetricsOverview';
import { IndividualMetrics } from '@/components/IndividualMetrics';
import { DashboardProvider, useDashboardContext } from '@/contexts/DashboardContext';
import { Calendar } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { user, profile } = useAuth();
  const { organization } = useOrganization();
  const { roles } = useRoles();
  const { selectedPeriod, setSelectedPeriod } = useDashboardContext();

  if (!user || !profile) {
    return <div>Carregando...</div>;
  }

  const currentRole = roles.find(r => r.id === profile?.role_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Bem-vindo, {user.name || user.email} • {organization?.name || 'Organização'}
            {currentRole && ` • ${currentRole.name}`}
          </p>
        </div>
        
        {/* Filtro de período global */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="individual">Individual</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <UnifiedDashboard />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <MetricsOverview selectedPeriod={selectedPeriod} />
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <IndividualMetrics periodRange={{ start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() }} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Dashboard: React.FC = () => {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
};

export default Dashboard; 