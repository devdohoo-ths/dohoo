import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useContacts, ContactFilters } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';

interface ContactFiltersProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
  onClearFilters: () => void;
}

export function ContactFiltersComponent({ 
  filters, 
  onFiltersChange, 
  onClearFilters 
}: ContactFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [selectedUserId, setSelectedUserId] = useState(filters.user_id || 'all');
  const [users, setUsers] = useState<Array<{id: string; name: string; email: string; roles: {name: string}}>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const { user } = useAuth();
  const { getUsers } = useContacts();

  // Carregar usuários para o filtro (sempre carregar)
  useEffect(() => {
    const loadUsers = async () => {
      if (!user?.token) {
        console.log('🔍 [ContactFilters] Aguardando autenticação...');
        return;
      }

      setLoadingUsers(true);
      try {
        const usersData = await getUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [getUsers, user?.token]);

  // Aplicar filtros com debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFiltersChange({
        ...filters,
        search: searchTerm || undefined,
        user_id: selectedUserId === 'all' ? undefined : (selectedUserId || undefined),
        offset: 0 // Reset offset when filters change
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedUserId]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedUserId('all');
    onClearFilters();
  };

  const hasActiveFilters = searchTerm || (selectedUserId && selectedUserId !== 'all');

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm text-gray-700">Filtros</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {[searchTerm && 'Busca', selectedUserId && 'Usuário'].filter(Boolean).join(', ')}
            </Badge>
          )}
        </div>
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Campo de busca */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600">
            Buscar por nome ou telefone
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Digite nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtro por usuário */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600">
            Filtrar por usuário
          </label>
          <Select
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            disabled={loadingUsers}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{user.name}</span>
                    <span className="text-xs text-gray-500">({user.roles?.name || 'Usuário'})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo dos filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {searchTerm && (
            <Badge variant="outline" className="text-xs">
              Busca: "{searchTerm}"
            </Badge>
          )}
          {selectedUserId && (
            <Badge variant="outline" className="text-xs">
              Usuário: {users.find(u => u.id === selectedUserId)?.name || 'Carregando...'}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
