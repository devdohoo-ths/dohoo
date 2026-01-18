import React from 'react';
import { DashboardSupervisorV2 } from '@/components/supervisor/DashboardSupervisorV2';

const SupervisorPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <DashboardSupervisorV2 />
      </div>
    </div>
  );
};

export default SupervisorPage;
