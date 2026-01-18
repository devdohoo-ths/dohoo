export interface User {
  id: string;
  name: string;
  email: string;
  user_role: string;
  role_id: string;
  created_at: string;
  avatar_url?: string;
  is_online: boolean;
  last_seen?: string;
  show_name_in_chat: boolean;
  deleted_at?: string;
}

export interface UserForm {
  name: string;
  email: string;
  role_id: string;
  password: string;
  show_name_in_chat: boolean;
  newPassword?: string;
}

export interface BulkAction {
  type: 'invite' | 'delete' | 'restore' | 'hardDelete';
  userIds: string[];
}

export interface CsvUser {
  name: string;
  email: string;
  role_name: string;
  password: string;
  organization_id?: string;
  show_name_in_chat?: boolean;
}

export interface LoadingStates {
  [key: string]: boolean;
}

export interface UserTableProps {
  users: User[];
  selectedUsers: string[];
  onSelectUser: (userId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onInvite: (user: User) => void;
  onRestore: (userId: string) => void;
  onHardDelete: (userId: string) => void;
  loadingStates: LoadingStates;
  inviteLoadingStates: LoadingStates;
  deleteLoadingStates: LoadingStates;
  isActive: boolean;
}

export interface UserFilters {
  search: string;
  activeTab: 'active' | 'inactive';
  currentPage: number;
  itemsPerPage: number;
}

export interface UserStats {
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
  maxUsers: number;
}

export type BulkActionType = 'invite' | 'delete' | 'restore' | 'hardDelete';