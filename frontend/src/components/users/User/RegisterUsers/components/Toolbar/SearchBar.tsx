import React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, CheckCircle, XCircle } from 'lucide-react';
import { UserStats, UserFilters } from '../../types';

interface SearchBarProps {
  userStats: UserStats;
  filters: UserFilters;
  onSearchChange: (search: string) => void;
  onTabChange: (tab: 'active' | 'inactive') => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  userStats,
  filters,
  onSearchChange,
  onTabChange
}) => {
  return (
    <Tabs 
      value={filters.activeTab} 
      onValueChange={(value: string) => onTabChange(value as 'active' | 'inactive')} 
      className="w-full"
    >
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Tabs */}
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="active" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Usuários Ativos</span>
              <span className="sm:hidden">Ativos</span>
              <Badge variant="secondary" className="ml-1 text-xs">{userStats.activeCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="inactive" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Usuários Desativados</span>
              <span className="sm:hidden">Desativados</span>
              <Badge variant="secondary" className="ml-1 text-xs">{userStats.inactiveCount}</Badge>
            </TabsTrigger>
          </TabsList>
          
          {/* Search */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input 
              placeholder={`Buscar ${filters.activeTab === 'active' ? 'ativos' : 'desativados'}...`} 
              value={filters.search} 
              onChange={(e) => onSearchChange(e.target.value)} 
              className="w-full sm:max-w-xs" 
            />
          </div>
        </div>
      </div>

      {/* Tab Content will be rendered by parent component */}
      <TabsContent value="active" className="mt-0">
        {/* Content will be provided by parent */}
      </TabsContent>
      <TabsContent value="inactive" className="mt-0">
        {/* Content will be provided by parent */}
      </TabsContent>
    </Tabs>
  );
};

export default SearchBar;