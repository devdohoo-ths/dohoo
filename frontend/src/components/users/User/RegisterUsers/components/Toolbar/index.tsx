import React from 'react';
import { UserStats, UserFilters } from '../../types';
import ActionButtons from './ActionButtons';
import SearchBar from './SearchBar';

interface ToolbarProps {
  userStats: UserStats;
  filters: UserFilters;
  onSearchChange: (search: string) => void;
  onTabChange: (tab: 'active' | 'inactive') => void;
  onOpenUserForm: () => void;
  onCsvDownload: () => void;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  csvUploading: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  userStats,
  filters,
  onSearchChange,
  onTabChange,
  onOpenUserForm,
  onCsvDownload,
  onCsvUpload,
  csvUploading
}) => {
  return (
    <div className="flex flex-col gap-4 mb-6 border-b pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl">Usuários da Organização</h1>
        <div className="text-sm text-muted-foreground">
          Usuários cadastrados: <b>{userStats.activeCount}</b> / {userStats.maxUsers} permitidos
        </div>
      </div>
      
      {/* Action Buttons */}
      <ActionButtons
        onOpenUserForm={onOpenUserForm}
        onCsvDownload={onCsvDownload}
        onCsvUpload={onCsvUpload}
        csvUploading={csvUploading}
      />

      {/* Search and Tabs */}
      <SearchBar
        userStats={userStats}
        filters={filters}
        onSearchChange={onSearchChange}
        onTabChange={onTabChange}
      />
    </div>
  );
};

export default Toolbar;