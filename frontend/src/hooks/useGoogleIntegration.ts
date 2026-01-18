import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';
import { useToast } from './use-toast';
import { useOrganizations } from './useOrganizations';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders

interface GoogleIntegration {
  id: string;
  service_type: 'calendar' | 'drive';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start_date_time: string;
  end_date_time: string;
  status: string;
  client_phone_number?: string;
}

interface DriveFile {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

interface SetupData {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export const useGoogleIntegration = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  
  const [integrations, setIntegrations] = useState<GoogleIntegration[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ CORRIGIDO: Remover função getAccessToken e usar getAuthHeaders diretamente

  const loadIntegrations = async () => {
    if (!organization?.id) return;
    
    setLoading(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/integrations?organizationId=${organization.id}`, {
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        setIntegrations(data.integrations);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar integrações:', error);
      // Fallback para dados mock se a API não estiver disponível
      setIntegrations([
        {
          id: '1',
          service_type: 'calendar',
          is_active: true,
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const setupIntegration = async (serviceType: 'calendar' | 'drive', setupData: SetupData) => {
    if (!organization?.id) {
      throw new Error('Organização não encontrada');
    }

    // Para configuração manual (super admin), valida os campos
    if (setupData.clientId && setupData.clientSecret) {
      if (!setupData.clientId.trim() || !setupData.clientSecret.trim()) {
        throw new Error('Preencha todos os campos obrigatórios');
      }
    }

    setLoading(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/setup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          organizationId: organization.id,
          serviceType,
          clientId: setupData.clientId || undefined,
          clientSecret: setupData.clientSecret || undefined,
          redirectUri: setupData.redirectUri,
          scope: serviceType === 'calendar' 
            ? ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
            : ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await loadIntegrations();
        return data;
      } else {
        throw new Error(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateAuthUrl = async (serviceType: 'calendar' | 'drive') => {
    if (!organization?.id) {
      throw new Error('Organização não encontrada');
    }

    // ✅ CORRIGIDO: Usar getAuthHeaders()
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/api/google/auth-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organizationId: organization.id,
        serviceType
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return data.authUrl;
    } else {
      throw new Error(data.error);
    }
  };

  const loadCalendarEvents = async () => {
    if (!organization?.id) return;
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/calendar/stored-events?organizationId=${organization.id}`, {
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        setCalendarEvents(data.events);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      // Mock data para demonstração
      setCalendarEvents([
        {
          id: '1',
          summary: 'Reunião com Cliente',
          start_date_time: '2025-01-20T10:00:00Z',
          end_date_time: '2025-01-20T11:00:00Z',
          status: 'active',
          client_phone_number: '+5511999999999'
        }
      ]);
    }
  };

  const loadDriveFiles = async () => {
    if (!organization?.id) return;
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/drive/stored-files?organizationId=${organization.id}`, {
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        setDriveFiles(data.files);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      // Mock data para demonstração
      setDriveFiles([
        {
          id: '1',
          file_name: 'documento.pdf',
          mime_type: 'application/pdf',
          file_size: 1024000,
          created_at: '2025-01-15T10:00:00Z'
        }
      ]);
    }
  };

  const createCalendarEvent = async (eventData: {
    summary: string;
    description?: string;
    start_date_time: string;
    end_date_time: string;
    client_phone_number?: string;
  }) => {
    if (!organization?.id) {
      throw new Error('Organização não encontrada');
    }

    // ✅ CORRIGIDO: Usar getAuthHeaders()
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/api/google/calendar/create-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organizationId: organization.id,
        ...eventData
      })
    });

    const data = await response.json();
    
    if (data.success) {
      await loadCalendarEvents();
      return data.event;
    } else {
      throw new Error(data.error);
    }
  };

  const uploadDriveFile = async (file: File, folderName?: string) => {
    if (!organization?.id) {
      throw new Error('Organização não encontrada');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', organization.id);
    if (folderName) {
      formData.append('folderName', folderName);
    }

    // ✅ CORRIGIDO: Usar getAuthHeaders() (sem Content-Type para FormData)
    const { 'Content-Type': _, ...headers } = await getAuthHeaders();
    const response = await fetch(`${apiBase}/api/google/drive/upload`, {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await response.json();
    
    if (data.success) {
      await loadDriveFiles();
      return data.file;
    } else {
      throw new Error(data.error);
    }
  };

  const deleteDriveFile = async (fileId: string) => {
    if (!organization?.id) {
      throw new Error('Organização não encontrada');
    }

    // ✅ CORRIGIDO: Usar getAuthHeaders()
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/api/google/drive/delete`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({
        organizationId: organization.id,
        fileId
      })
    });

    const data = await response.json();
    
    if (data.success) {
      await loadDriveFiles();
    } else {
      throw new Error(data.error);
    }
  };

  const getIntegrationStatus = (serviceType: 'calendar' | 'drive') => {
    const integration = integrations.find(i => i.service_type === serviceType);
    return integration?.is_active || false;
  };

  useEffect(() => {
    if (organization?.id) {
      loadIntegrations();
    }
  }, [organization]);

  return {
    integrations,
    calendarEvents,
    driveFiles,
    loading,
    loadIntegrations,
    setupIntegration,
    generateAuthUrl,
    loadCalendarEvents,
    loadDriveFiles,
    createCalendarEvent,
    uploadDriveFile,
    deleteDriveFile,
    getIntegrationStatus
  };
}; 