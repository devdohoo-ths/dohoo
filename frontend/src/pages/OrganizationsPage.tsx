import React from 'react';
import RegisterOrganization from '@/components/organizations/RegisterOrganization';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

const OrganizationsPage: React.FC = () => {
  return (
    <PermissionGuard requiredPermissions={['manage_organizations']}>
      <RegisterOrganization />
    </PermissionGuard>
  );
};

export default OrganizationsPage; 