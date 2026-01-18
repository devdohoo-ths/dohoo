import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

const API_BASE = apiBase;

export interface Contact {
  id: string;
  phone_number: string;
  name: string;
  organization_id: string;
  user_id: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_interaction_at?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ContactFilters {
  search?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
}

export interface CreateContactData {
  phone_number: string;
  name?: string;
  notes?: string;
  user_id?: string;
}

export interface UpdateContactData {
  name?: string;
  notes?: string;
  user_id?: string;
}

export interface TransferContactsData {
  contact_ids: string[];
  to_user_id: string;
  notes?: string;
}

export interface ContactHistory {
  id: string;
  contact_id: string;
  action_type: 'created' | 'transferred' | 'updated' | 'deleted' | 'assigned';
  from_user_id?: string;
  to_user_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  metadata?: Record<string, any>;
  from_user?: {
    id: string;
    name: string;
    email: string;
  };
  to_user?: {
    id: string;
    name: string;
    email: string;
  };
  created_by_user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ContactsResponse {
  success: boolean;
  data: Contact[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ContactResponse {
  success: boolean;
  data: Contact;
}

export interface ContactHistoryResponse {
  success: boolean;
  data: ContactHistory[];
}

export interface UsersResponse {
  success: boolean;
  users: Array<{
    id: string;
    name: string;
    email: string;
    roles: {
      name: string;
    };
  }>;
  total: number;
}

export function useContacts(filters: ContactFilters = {}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { organization } = useOrganization();
  
  // Mostrar loading inicial enquanto aguarda autenticação
  const isLoading = loading || !user?.token;

  const fetchContacts = async (newFilters: ContactFilters = {}) => {
    if (!user?.token) {
      setError('Aguardando autenticação...');
      setLoading(false);
      return;
    }

    if (!organization?.id) {
      setError('Aguardando dados da organização...');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Construir query string com filtros
      const queryParams = new URLSearchParams();
      if (newFilters.search) {
        queryParams.append('search', newFilters.search);
      }
      if (newFilters.user_id) {
        queryParams.append('user_id', newFilters.user_id);
      }
      if (newFilters.limit) {
        queryParams.append('limit', newFilters.limit.toString());
      }
      if (newFilters.offset) {
        queryParams.append('offset', newFilters.offset.toString());
      }

      const queryString = queryParams.toString();
      const url = `${API_BASE}/api/contacts${queryString ? `?${queryString}` : ''}`;

      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      const data: ContactsResponse = await response.json();

      if (data.success) {
        setContacts(data.data);
      } else {
        throw new Error('Erro ao buscar contatos');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (contactData: CreateContactData): Promise<Contact> => {
    if (!user) throw new Error('Usuário não autenticado');

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/contacts`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ${response.status}`);
    }

    const data: ContactResponse = await response.json();
    
    if (data.success) {
      // Atualizar lista local
      setContacts(prev => [data.data, ...prev]);
      return data.data;
    } else {
      throw new Error('Erro ao criar contato');
    }
  };

  const updateContact = async (contactId: string, updateData: UpdateContactData): Promise<Contact> => {
    if (!user) throw new Error('Usuário não autenticado');

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ${response.status}`);
    }

    const data: ContactResponse = await response.json();
    
    if (data.success) {
      // Atualizar lista local
      setContacts(prev => 
        prev.map(contact => 
          contact.id === contactId ? data.data : contact
        )
      );
      return data.data;
    } else {
      throw new Error('Erro ao atualizar contato');
    }
  };

  const deleteContact = async (contactId: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // Remover da lista local
      setContacts(prev => prev.filter(contact => contact.id !== contactId));
    } else {
      throw new Error('Erro ao excluir contato');
    }
  };

  const transferContacts = async (transferData: TransferContactsData): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/contacts/transfer`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transferData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // Atualizar lista local - remover contatos transferidos
      setContacts(prev => 
        prev.filter(contact => !transferData.contact_ids.includes(contact.id))
      );
    } else {
      throw new Error('Erro ao transferir contatos');
    }
  };

  const getContactById = async (contactId: string): Promise<Contact> => {
    if (!user) throw new Error('Usuário não autenticado');

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ${response.status}`);
    }

    const data: ContactResponse = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error('Erro ao buscar contato');
    }
  };

  const getContactHistory = async (contactId: string): Promise<ContactHistory[]> => {
    if (!user) throw new Error('Usuário não autenticado');

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/contacts/${contactId}/history`, {
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ${response.status}`);
    }

    const data: ContactHistoryResponse = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error('Erro ao buscar histórico do contato');
    }
  };

  const getUsers = useCallback(async (): Promise<Array<{id: string; name: string; email: string; roles: {name: string}}>> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/contacts/users/list`, {
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      return data.data || [];
    } else {
      throw new Error('Erro ao buscar usuários');
    }
  }, [user]);

  const refreshContacts = () => {
    fetchContacts(filters);
  };

  // Carregar contatos quando o hook é montado ou os filtros mudam
  useEffect(() => {
    // Só fazer a chamada se o usuário estiver autenticado E a organização estiver carregada
    if (user && organization?.id) {
      fetchContacts(filters);
    }
  }, [user, organization?.id, filters.search, filters.user_id]);

  return {
    contacts,
    loading: isLoading,
    error,
    createContact,
    updateContact,
    deleteContact,
    transferContacts,
    getContactById,
    getContactHistory,
    getUsers,
    refreshContacts
  };
}

// Hook para um contato específico
export function useContact(contactId: string | null) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();

  const fetchContact = async () => {
    if (!user || !contactId) return;

    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data: ContactResponse = await response.json();
      
      if (data.success) {
        setContact(data.data);
      } else {
        throw new Error('Erro ao buscar contato');
      }
    } catch (err) {
      console.error('Erro ao buscar contato:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contactId) {
      fetchContact();
    } else {
      setContact(null);
    }
  }, [user, contactId]);

  return {
    contact,
    loading,
    error,
    refreshContact: fetchContact
  };
}
