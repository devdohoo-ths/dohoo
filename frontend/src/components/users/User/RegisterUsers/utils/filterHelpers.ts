import { User, UserFilters } from '../types';

export function filterUsers(users: User[], filters: UserFilters): User[] {
  const { search, activeTab } = filters;
  
  // Primeiro filtrar por aba (ativo/inativo)
  const tabFilteredUsers = activeTab === 'active' 
    ? users.filter(user => !user.deleted_at)
    : users.filter(user => user.deleted_at);
  
  // Depois filtrar por busca
  if (!search.trim()) {
    return tabFilteredUsers;
  }
  
  const searchLower = search.toLowerCase().trim();
  return tabFilteredUsers.filter(user =>
    user.name?.toLowerCase().includes(searchLower) ||
    user.email?.toLowerCase().includes(searchLower)
  );
}

export function paginateUsers(
  users: User[], 
  currentPage: number, 
  itemsPerPage: number
): {
  paginatedUsers: User[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
} {
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);
  
  return {
    paginatedUsers,
    totalPages,
    startIndex,
    endIndex
  };
}

export function getUserStats(users: User[]): {
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
} {
  const activeUsers = users.filter(user => !user.deleted_at);
  const inactiveUsers = users.filter(user => user.deleted_at);
  
  return {
    activeCount: activeUsers.length,
    inactiveCount: inactiveUsers.length,
    totalCount: users.length
  };
}