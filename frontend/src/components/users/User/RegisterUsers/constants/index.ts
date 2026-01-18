export const CSV_TEMPLATE = `name;email;role_name;password\nJoão Silva;joao@email.com;Admin;Dohoo@1234\nMaria Souza;maria@email.com;Agente;Dohoo@5678`;

export const ITEMS_PER_PAGE = 10;

export const ROLE_STYLES = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
  AGENT: 'bg-green-100 text-green-800 border-green-200',
  DEFAULT: 'bg-gray-100 text-gray-800 border-gray-200'
};

export const USER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline'
} as const;

export const BULK_ACTIONS = {
  INVITE: 'invite',
  DELETE: 'delete',
  RESTORE: 'restore',
  HARD_DELETE: 'hardDelete'
} as const;

export const MODAL_TYPES = {
  USER_FORM: 'userForm',
  SUCCESS: 'success',
  DELETE: 'delete',
  BULK_ACTION: 'bulkAction',
  IMPORT: 'import',
  EMAIL: 'email'
} as const;

export const TABS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const;

export const PASSWORD_MIN_LENGTH = 6;

export const CACHE_TTL = 10 * 60 * 1000; // 10 minutos 