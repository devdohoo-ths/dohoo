import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/hooks/useOrganization';
import { useRoles } from '@/hooks/useRoles';
// ✅ REMOVIDO: Import Supabase - não mais necessário
import { Search, CheckCircle, RotateCcw, Plus, Users, Clock, XCircle, Edit, Trash, LogIn } from 'lucide-react';
import { apiBase, getAuthHeadersWithUser } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import PocConfiguration from './PocConfiguration';

const RegisterOrganization: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const { roles, loading: rolesLoading } = useRoles();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<any | null>(null);
  const [editModalTab, setEditModalTab] = useState<'general' | 'poc'>('general');
  
  // Estados para paginação e filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pocFilter, setPocFilter] = useState<'all' | 'poc' | 'non-poc'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const [form, setForm] = useState<{
    name: string;
    domain: string;
    logo_url: string;
    cpf_cnpj: string;
    max_users: number;
    financial_email: string;
    price_per_user: number;
    proxy: string;
    whatsapp_api: string;
  }>({
    name: '',
    domain: '',
    logo_url: '',
    cpf_cnpj: '',
    max_users: 10,
    financial_email: '',
    price_per_user: 0,
    proxy: '',
    whatsapp_api: 'baileys',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<string | null>(null);

  // Estados para o modal de criação de usuários
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [selectedOrgForUser, setSelectedOrgForUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role_id: '',
    password: '',
    show_name_in_chat: true,
  });

  // Estados para o modal de criação com usuários
  const [createWithUsersModalOpen, setCreateWithUsersModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'organization' | 'poc'>('organization');
  const [organizationForm, setOrganizationForm] = useState({
    name: '',
    domain: '',
    logo_url: '',
    cpf_cnpj: '',
    max_users: 10,
    financial_email: '',
    price_per_user: 0,
    proxy: '',
    whatsapp_api: 'baileys',
  });
  
  // Estados para configuração POC
  const [pocConfig, setPocConfig] = useState({
    is_poc: false,
    poc_duration_days: 30,
    poc_start_date: '',
    poc_contact_email: '',
    poc_contact_phone: '',
  });
  const [usersToCreate, setUsersToCreate] = useState<Array<{
    name: string;
    email: string;
    role_id: string;
    password: string;
  }>>([]);

  // No componente RegisterOrganization.tsx
  const handleSwitchOrganization = async (orgId: string, orgName: string) => {
    try {
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/organizations/${orgId}/switch`, {
        method: 'POST',
        headers
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: `Agora você está acessando como ${orgName}`,
        });

        // Recarregar dados do usuário
        window.location.reload();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao trocar de organização",
        variant: "destructive",
      });
    }
  };


  // Adicionar estado para controle de email
  const [sendEmail, setSendEmail] = useState(true);
  const [emailTemplate, setEmailTemplate] = useState('welcome'); // 'welcome' | 'credentials'

  useEffect(() => {
    // Aguardar apenas se ainda está carregando a autenticação
    if (authLoading) {
      return;
    }

    fetchOrganizations();
  }, [user, profile, authLoading, currentPage, itemsPerPage]);

  // ✅ OTIMIZAÇÃO: Debounce na busca para evitar requisições excessivas
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchOrganizations();
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [search, statusFilter, pocFilter]);

  async function fetchOrganizations() {
    setLoading(true);
    try {
      console.log('🔄 Buscando organizações...');

      const headers = await getAuthHeadersWithUser(user, profile);

      // Construir parâmetros da query
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: search,
        show_inactive: (statusFilter === 'inactive').toString()
      });
      
      console.log('📤 Parâmetros enviados:', {
        statusFilter,
        show_inactive: statusFilter === 'inactive'
      });

      // Adicionar filtro POC se não for 'all'
      if (pocFilter !== 'all') {
        params.append('is_poc', pocFilter === 'poc' ? 'true' : 'false');
      }

      const response = await fetch(`${apiBase}/api/organizations?${params}`, {
        headers
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao carregar organizações');
      }

      setOrganizations(result.organizations || []);
      
      // Atualizar informações de paginação
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages);
        setTotalItems(result.pagination.totalItems);
      }
      
      console.log('✅ Organizações carregadas:', result.organizations?.length || 0);
    } catch (err) {
      console.error('❌ Erro ao buscar organizações:', err);
      setError('Erro ao carregar organizações');
    } finally {
      setLoading(false);
    }
  }

  async function openModal(org: any = null) {
    setEditOrg(org);
    
    let proxyValue = '';
    let whatsappApiValue = 'baileys';
    if (org) {
      // Buscar configurações da organização para obter o proxy e API
      try {
        const headers = await getAuthHeadersWithUser(user, profile);
        const settingsResponse = await fetch(`${apiBase}/api/organizations/${org.id}/settings`, {
          headers
        });
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          proxyValue = settingsData.settings?.proxy || '';
          whatsappApiValue = settingsData.settings?.whatsapp_api || 'baileys';
        }
      } catch (error) {
        console.warn('Erro ao buscar configurações:', error);
      }
    }
    
    setForm(org ? {
      name: org.name || '',
      domain: org.domain || '',
      logo_url: org.logo_url || '',
      cpf_cnpj: org.cpf_cnpj || '',
      max_users: org.max_users || 10,
      financial_email: org.financial_email || '',
      price_per_user: org.price_per_user || 0,
      proxy: proxyValue,
      whatsapp_api: whatsappApiValue,
    } : {
      name: '',
      domain: '',
      logo_url: '',
      cpf_cnpj: '',
      max_users: 10,
      financial_email: '',
      price_per_user: 0,
      proxy: '',
      whatsapp_api: 'baileys',
    });
    setModalOpen(true);
    setSuccess('');
    setError('');
  }

  function openCreateWithUsersModal() {
    setCreateWithUsersModalOpen(true);
    setActiveTab('organization');
    setOrganizationForm({
      name: '',
      domain: '',
      logo_url: '',
      cpf_cnpj: '',
      max_users: 10,
      financial_email: '',
      price_per_user: 0,
      proxy: '',
      whatsapp_api: 'baileys',
    });
    setUsersToCreate([]);
    setSuccess('');
    setError('');
  }

  function closeCreateWithUsersModal() {
    setCreateWithUsersModalOpen(false);
    setActiveTab('organization');
    setOrganizationForm({
      name: '',
      domain: '',
      logo_url: '',
      cpf_cnpj: '',
      max_users: 10,
      financial_email: '',
      price_per_user: 0,
      proxy: '',
      whatsapp_api: 'baileys',
    });
    setUsersToCreate([]);
    setSuccess('');
    setError('');
  }

  function openCreateUserModal(org: any) {
    setSelectedOrgForUser(org);
    setUserForm({
      name: '',
      email: '',
      role_id: '',
      password: '',
      show_name_in_chat: true,
    });
    setCreateUserModalOpen(true);
  }

  function closeCreateUserModal() {
    setCreateUserModalOpen(false);
    setSelectedOrgForUser(null);
    setUserForm({
      name: '',
      email: '',
      role_id: '',
      password: '',
      show_name_in_chat: true,
    });
  }

  function closeModal() {
    setModalOpen(false);
    setEditOrg(null);
    setForm({ 
      name: '', 
      domain: '', 
      logo_url: '', 
      cpf_cnpj: '', 
      max_users: 10, 
      financial_email: '', 
      price_per_user: 0,
      proxy: '',
      whatsapp_api: 'baileys'
    });
    setSuccess('');
    setError('');
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    if (type === 'number') {
      if (name === 'price_per_user') {
        setForm(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
      } else {
        setForm(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }

    // Gerar domínio automaticamente quando o nome da organização for alterado
    if (name === 'name' && value.trim()) {
      const generateSubdomain = (orgName: string) => {
        // Converter para lowercase e remover caracteres especiais
        let subdomain = orgName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[^a-z0-9]/g, '') // Remove caracteres especiais, mantém apenas letras e números
          .replace(/\s+/g, ''); // Remove espaços

        // Se ficou vazio após a limpeza, usar um fallback
        if (!subdomain) {
          subdomain = 'empresa';
        }

        return `${subdomain}.dohoo.app`;
      };

      const domain = generateSubdomain(value);
      setForm(prev => ({ ...prev, domain }));
    }
  }

  function handleOrganizationFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    console.log('🔍 handleOrganizationFormChange:', { name, value, type });

    if (type === 'number') {
      setOrganizationForm(prev => {
        const newForm = { ...prev, [name]: parseInt(value) || 0 };
        console.log('🔍 Novo organizationForm (number):', newForm);
        return newForm;
      });
    } else {
      setOrganizationForm(prev => {
        const newForm = { ...prev, [name]: value };
        console.log('🔍 Novo organizationForm (text):', newForm);
        return newForm;
      });
    }

    // Gerar subdomínio automaticamente quando o nome da organização for alterado
    if (name === 'name' && value.trim()) {
      const generateSubdomain = (orgName: string) => {
        // Converter para lowercase e remover caracteres especiais
        let subdomain = orgName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[^a-z0-9]/g, '') // Remove caracteres especiais, mantém apenas letras e números
          .replace(/\s+/g, ''); // Remove espaços

        // Se ficou vazio após a limpeza, usar um fallback
        if (!subdomain) {
          subdomain = 'org';
        }

        return `${subdomain}.dohoo.app`;
      };

      const domain = generateSubdomain(value);
      setOrganizationForm(prev => ({ ...prev, domain }));
    }
  }

  function handlePocConfigChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setPocConfig(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setPocConfig(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setPocConfig(prev => ({ ...prev, [name]: value }));
    }
  }


  function handleCreateUserFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setUserForm(prev => ({ ...prev, [name]: target.checked }));
    } else {
      setUserForm(prev => ({ ...prev, [name]: value }));
    }
  }



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!form.name) {
        setError('Nome é obrigatório');
        setLoading(false);
        return;
      }

      // Preparar dados para envio
      const requestData = {
        name: form.name,
        domain: form.domain || null,
        logo_url: form.logo_url || null,
        cpf_cnpj: form.cpf_cnpj || null,
        max_users: form.max_users || 10,
        financial_email: form.financial_email || null,
        price_per_user: form.price_per_user || 0
      };

      console.log('📤 Dados para envio:', requestData);

      if (editOrg) {
        // Update via API
        const headers = await getAuthHeadersWithUser(user, profile);
        const response = await fetch(`${apiBase}/api/organizations/${editOrg.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(requestData)
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao atualizar organização');
        }

        // Atualizar configurações com proxy e whatsapp_api
        if (form.proxy !== undefined || form.whatsapp_api !== undefined) {
          try {
            // Buscar configurações atuais
            const settingsResponse = await fetch(`${apiBase}/api/organizations/${editOrg.id}/settings`, {
              headers
            });
            let currentSettings = {};
            if (settingsResponse.ok) {
              const settingsData = await settingsResponse.json();
              currentSettings = settingsData.settings || {};
            }
            
            // Verificar se a API mudou
            const currentApi = currentSettings.whatsapp_api || 'baileys';
            const newApi = form.whatsapp_api || 'baileys';
            const apiChanged = currentApi !== newApi;
            
            // Atualizar com proxy e whatsapp_api
            const updatedSettings = {
              ...currentSettings,
              proxy: form.proxy !== undefined ? (form.proxy || null) : currentSettings.proxy,
              whatsapp_api: form.whatsapp_api || 'baileys'
            };
            
            const settingsUpdateResponse = await fetch(`${apiBase}/api/organizations/${editOrg.id}/settings`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ settings: updatedSettings })
            });
            
            const settingsResult = await settingsUpdateResponse.json();
            
            // Mostrar aviso se a API mudou
            if (apiChanged && settingsResult.warning) {
              toast({
                title: "⚠️ API WhatsApp Alterada",
                description: settingsResult.warning,
                variant: "warning",
                duration: 10000,
              });
            }
          } catch (proxyError) {
            console.warn('Erro ao atualizar configurações:', proxyError);
          }
        }

        setSuccess('Organização atualizada com sucesso!');
      } else {
        // Create via API
        const headers = await getAuthHeadersWithUser(user, profile);
        const response = await fetch(`${apiBase}/api/organizations`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestData)
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar organização');
        }

        // Criar configurações com proxy se fornecido
        if (form.proxy && result.organization?.id) {
          try {
            const settingsResponse = await fetch(`${apiBase}/api/organizations/${result.organization.id}/settings`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                settings: {
                  disabledModules: [],
                  features: {
                    automation: true,
                    advancedSettings: true,
                    marketplace: true,
                    aiPlayground: true
                  },
                  proxy: form.proxy || null
                }
              })
            });
            if (!settingsResponse.ok) {
              console.warn('Erro ao criar configurações com proxy');
            }
          } catch (proxyError) {
            console.warn('Erro ao criar proxy:', proxyError);
          }
        }

        setSuccess('Organização criada com sucesso!');
      }

      fetchOrganizations();
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err: any) {
      console.error('Erro ao salvar organização:', err);
      setError(err.message || 'Erro ao salvar organização');
    }
    setLoading(false);
  }

  async function handleCreateWithUsers(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      console.log('🔍 Verificando dados da organização:', organizationForm);
      console.log('🔍 Usuários a serem criados:', usersToCreate);

      if (!organizationForm.name) {
        console.log('❌ Nome da organização está vazio');
        setError('Nome da organização é obrigatório');
        setLoading(false);
        return;
      }


      // Primeiro, criar a organização
      console.log('🏢 Criando organização...');
      console.log('📤 Dados da organização:', organizationForm);

      const headers = await getAuthHeadersWithUser(user, profile);
      console.log('🔧 Headers enviados:', headers);

      // Dados da organização incluindo configuração POC
      const testData = {
        name: organizationForm.name,
        domain: organizationForm.domain || null,
        logo_url: organizationForm.logo_url || null,
        cpf_cnpj: organizationForm.cpf_cnpj || null,
        max_users: organizationForm.max_users || 10,
        financial_email: organizationForm.financial_email || null,
        price_per_user: organizationForm.price_per_user || 0,
        // Configuração POC
        is_poc: pocConfig.is_poc,
        poc_duration_days: pocConfig.is_poc ? pocConfig.poc_duration_days : null,
        poc_start_date: pocConfig.is_poc && pocConfig.poc_start_date ? pocConfig.poc_start_date : null,
        poc_contact_email: pocConfig.is_poc ? pocConfig.poc_contact_email : null,
        poc_contact_phone: pocConfig.is_poc ? pocConfig.poc_contact_phone : null,
      };

      console.log('📤 Dados de teste:', testData);

      const orgResponse = await fetch(`${apiBase}/api/organizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testData)
      });

      const orgResult = await orgResponse.json();
      if (!orgResponse.ok) {
        throw new Error(orgResult.error || 'Erro ao criar organização');
      }

      const newOrganization = orgResult.organization;
      console.log('✅ Organização criada:', newOrganization);

      // Criar configurações com proxy e whatsapp_api se fornecido
      if ((organizationForm.proxy || organizationForm.whatsapp_api) && newOrganization?.id) {
        try {
          await fetch(`${apiBase}/api/organizations/${newOrganization.id}/settings`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              settings: {
                disabledModules: [],
                features: {
                  automation: true,
                  advancedSettings: true,
                  marketplace: true,
                  aiPlayground: true
                },
                proxy: organizationForm.proxy || null,
                whatsapp_api: organizationForm.whatsapp_api || 'baileys'
              }
            })
          });
        } catch (proxyError) {
          console.warn('Erro ao criar configurações com proxy/whatsapp_api:', proxyError);
        }
      }

      setSuccess(`Organização "${organizationForm.name}" criada com sucesso!`);

      // Limpar formulário
    setOrganizationForm({
      name: '',
      domain: '',
      logo_url: '',
      cpf_cnpj: '',
      max_users: 10,
      financial_email: '',
      price_per_user: 0,
      proxy: '',
      whatsapp_api: 'baileys',
    });
    setPocConfig({
        is_poc: false,
        poc_duration_days: 30,
        poc_start_date: '',
        poc_contact_email: '',
        poc_contact_phone: '',
      });
      setUsersToCreate([]);
      setSendEmail(true);
      setEmailTemplate('welcome');

      // Recarregar a lista de organizações
      await fetchOrganizations();
      
      // Fechar modal após um tempo
      setTimeout(() => {
        closeCreateWithUsersModal();
      }, 2000);

    } catch (err: any) {
      console.error('❌ Erro ao criar organização com usuários:', err);
      setError(err.message || 'Erro ao criar organização com usuários');
    }
    setLoading(false);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!selectedOrgForUser) {
        throw new Error('Organização não selecionada');
      }

      if (!userForm.name || !userForm.email || !userForm.password) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      const userRequestData = {
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role_id: userForm.role_id,
        organization_id: selectedOrgForUser.id,
        show_name_in_chat: userForm.show_name_in_chat,
        send_email: sendEmail,
        email_template: emailTemplate,
      };

      console.log('📤 Criando usuário:', userRequestData);

      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/users/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify(userRequestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      const emailStatus = sendEmail ? 'com email enviado' : 'sem envio de email';
      setSuccess(`Usuário "${userForm.name}" criado com sucesso na organização "${selectedOrgForUser.name}" ${emailStatus}!`);

      // Limpar formulário
      setUserForm({
        name: '',
        email: '',
        role_id: '',
        password: '',
        show_name_in_chat: true,
      });
      setSendEmail(true);
      setEmailTemplate('welcome');

      // Fechar modal após um tempo
      setTimeout(() => {
        closeCreateUserModal();
      }, 2000);

    } catch (err: any) {
      console.error('❌ Erro ao criar usuário:', err);
      setError(err.message || 'Erro ao criar usuário');
    }
    setLoading(false);
  }

  async function handleDelete(orgId: string) {
    setOrgToDelete(orgId);
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!orgToDelete) return;
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/organizations/${orgToDelete}`, {
        method: 'DELETE',
        headers
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Falha ao desativar organização');
      }

      setSuccess('Organização desativada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
      fetchOrganizations();
    } catch (err: any) {
      setError(err.message || 'Erro ao desativar organização');
    } finally {
      setDeleteModalOpen(false);
      setOrgToDelete(null);
      setLoading(false);
    }
  }

  async function handleRestore(orgId: string) {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/organizations/${orgId}/restore`, {
        method: 'PATCH',
        headers
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Falha ao reativar organização');
      }

      setSuccess('Organização reativada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
      fetchOrganizations();
    } catch (err: any) {
      setError(err.message || 'Erro ao reativar organização');
    } finally {
      setLoading(false);
    }
  }

  async function handleHardDelete(orgId: string) {
    if (!window.confirm('Tem certeza que deseja remover DEFINITIVAMENTE esta organização? Esta ação é irreversível.')) return;
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeadersWithUser(user, profile);
      const response = await fetch(`${apiBase}/api/organizations/${orgId}/hard`, {
        method: 'DELETE',
        headers
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Falha ao remover organização');
      }

      setSuccess('Organização removida definitivamente!');
      setTimeout(() => setSuccess(''), 3000);
      fetchOrganizations();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover organização');
    } finally {
      setLoading(false);
    }
  }


  // Mostrar loading apenas se ainda não carregou nada
  if (loading && organizations.length === 0) {
    return (
      <div className="w-full min-h-screen p-8 bg-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando organizações...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Adicionar função para obter roles disponíveis
  const getAvailableRoles = () => {
    if (!roles || !selectedOrgForUser) return [];

    // Incluir roles globais (organization_id = null) + roles customizadas da organização
    const availableRoles = roles.filter(role =>
      role.organization_id === null || role.organization_id === selectedOrgForUser.id
    );

    console.log('🔍 Roles disponíveis:', {
      total: roles.length,
      globais: roles.filter(r => r.organization_id === null).length,
      customizadas: roles.filter(r => r.organization_id === selectedOrgForUser.id).length,
      disponíveis: availableRoles.length
    });

    return availableRoles;
  };

  return (
    <div className="w-full min-h-screen p-8 bg-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b pb-4">
          <h1 className="text-2xl">Organizações</h1>
          <div className="text-sm text-muted-foreground mt-2">
            Total de organizações: <b>{totalItems}</b>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={openCreateWithUsersModal} variant="default" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Users className="w-4 h-4 mr-1" /> Cadastrar Organização
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou e-mail financeiro"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-4">
              {/* Filtro por Tipo (POC) */}
              <div className="flex items-center gap-2">
                <Label htmlFor="poc-filter" className="text-sm">Tipo:</Label>
                <Select value={pocFilter} onValueChange={(value: 'all' | 'poc' | 'non-poc') => setPocFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="poc">POC</SelectItem>
                    <SelectItem value="non-poc">Não POC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro por Status */}
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm">Status:</Label>
                <Select value={statusFilter} onValueChange={(value: 'active' | 'inactive') => setStatusFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativas</SelectItem>
                    <SelectItem value="inactive">Desativadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Informações de paginação */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Mostrando {organizations.length} de {totalItems} organizações
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="items-per-page" className="text-sm">Itens por página:</Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value: string) => setItemsPerPage(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg">
          <table className="min-w-full border text-sm rounded-lg table-fixed">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left w-16">Logo</th>
                <th className="p-2 text-left w-48">Nome</th>
                <th className="p-2 text-left w-48">CNPJ</th>
                <th className="p-2 text-left w-40">E-Mail Financeiro</th>
                <th className="p-2 text-left w-32">Limite Usuários</th>
                <th className="p-2 text-left w-32">Valor/Usuário</th>
                <th className="p-2 text-left w-32">Status</th>
                <th className="p-2 text-left w-36">Data</th>
                <th className="p-2 text-center w-48">Ações</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map(org => (
                <tr key={org.id} className={`border-b ${org.deleted_at ? 'bg-red-50 hover:bg-red-50' : 'hover:bg-gray-50'}`}>
                  <td className="p-2">
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt={org.name}
                        className={`w-8 h-8 rounded-full object-cover ${org.deleted_at ? 'opacity-50' : ''}`}
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 ${org.deleted_at ? 'opacity-50' : ''}`}>
                        {org.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </td>
                  <td className={`p-2 truncate ${org.deleted_at ? 'text-gray-600' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span>{org.name}</span>
                      {org.is_poc && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          POC
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className={`p-2 truncate ${org.deleted_at ? 'text-gray-600' : ''}`}>
                    {org.cpf_cnpj || '-'}
                  </td>
                  <td className={`p-2 truncate ${org.deleted_at ? 'text-gray-600' : ''}`}>
                    {org.financial_email || '-'}
                  </td>
                  <td className={`p-2 truncate ${org.deleted_at ? 'text-gray-600' : ''}`}>
                    {org.max_users || 10}
                  </td>
                  <td className={`p-2 truncate ${org.deleted_at ? 'text-gray-600' : ''}`}>
                    R$ {org.price_per_user ? org.price_per_user.toFixed(2) : '0,00'}
                  </td>
                  <td className="p-2">
                    {org.deleted_at ? (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> Ativa
                      </span>
                    )}
                  </td>
                  <td className={`p-2 truncate ${org.deleted_at ? 'text-gray-600' : ''}`}>
                    {org.deleted_at ? (
                      new Date(org.deleted_at).toLocaleDateString()
                    ) : (
                      org.created_at ? new Date(org.created_at).toLocaleString() : '-'
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openModal(org)}
                        disabled={!!org.deleted_at}
                        title={org.deleted_at ? 'Não é possível editar organização desativada' : 'Editar organização'}
                        className={org.deleted_at ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!org.deleted_at && (() => {
                        // Verificar se é Super Admin usando diferentes campos possíveis
                        const roleName = profile?.role_name || profile?.roles?.name;
                        const isSuperAdmin = roleName === 'Super Admin' || roleName === 'super_admin' || roleName === 'SuperAdmin';
                        return isSuperAdmin;
                      })() && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSwitchOrganization(org.id, org.name)}
                          title="Entrar nesta organização"
                          className="border-blue-300 text-blue-600 hover:bg-blue-50"
                        >
                          <LogIn className="w-4 h-4" />
                        </Button>
                      )}
                      {!org.deleted_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCreateUserModal(org)}
                          title="Criar usuários para esta organização"
                          className="border-green-300 text-green-600 hover:bg-green-50"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                      )}
                      {org.deleted_at ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(org.id)}
                            disabled={loading}
                            title="Reativar organização"
                            className="border-blue-300 text-blue-600 hover:bg-blue-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleHardDelete(org.id)}
                            disabled={loading}
                            title="Excluir permanentemente"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(org.id)}
                          title="Desativar organização"
                          className="border-orange-300 text-orange-600 hover:bg-orange-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr><td colSpan={7} className="text-center p-4 text-muted-foreground">Nenhuma organização encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        )}

        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
        {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
      </div>

      {/* Modal de cadastro/edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editOrg ? 'Editar Organização' : 'Cadastrar Organização'}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {editOrg ? (
              // Modal de edição com abas
              <Tabs value={editModalTab} onValueChange={(value: string) => setEditModalTab(value as 'general' | 'poc')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="general" className="flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Geral
                  </TabsTrigger>
                  <TabsTrigger value="poc" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    POC
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" name="name" value={form.name} onChange={handleFormChange} required />
                    </div>
                    <div>
                      <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
                      <Input id="cpf_cnpj" name="cpf_cnpj" value={form.cpf_cnpj} onChange={handleFormChange} placeholder="00.000.000/0001-00 ou 00000000000000" required />
                    </div>
                    <div>
                      <Label htmlFor="financial_email">E-Mail Financeiro *</Label>
                      <Input id="financial_email" name="financial_email" type="email" value={form.financial_email} onChange={handleFormChange} placeholder="financeiro@empresa.com" required />
                    </div>
                    <div>
                      <Label htmlFor="max_users">Quantidade de Usuários *</Label>
                      <Input id="max_users" name="max_users" type="number" value={form.max_users.toString()} onChange={handleFormChange} min="1" max="1000" required />
                    </div>
                    <div>
                      <Label htmlFor="price_per_user">Valor por Usuário (R$) *</Label>
                      <Input id="price_per_user" name="price_per_user" type="number" step="0.01" value={form.price_per_user.toString()} onChange={handleFormChange} placeholder="0.00" required />
                    </div>
                    <div>
                      <Label htmlFor="logo_url">Logo (URL)</Label>
                      <Input id="logo_url" name="logo_url" value={form.logo_url} onChange={handleFormChange} placeholder="https://exemplo.com/logo.png" />
                    </div>
                    <div>
                      <Label htmlFor="whatsapp_api">API WhatsApp *</Label>
                      <Select 
                        value={form.whatsapp_api || 'baileys'} 
                        onValueChange={(value) => setForm(prev => ({ ...prev, whatsapp_api: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baileys">Baileys</SelectItem>
                          <SelectItem value="wppconnect">WPPConnect</SelectItem>
                          <SelectItem value="whatsapp-web.js">whatsapp-web.js</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Escolha a API para conexões WhatsApp desta organização
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="proxy">Proxy (Opcional)</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Configure um proxy para conexões WhatsApp. Formatos suportados: http://, https://, socks4://, socks5://
                      </p>
                      <Input
                        id="proxy"
                        name="proxy"
                        type="text"
                        value={form.proxy || ''}
                        onChange={handleFormChange}
                        placeholder="http://proxy.example.com:8080 ou socks5://proxy.example.com:1080"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Exemplo: http://usuario:senha@proxy.example.com:8080
                      </p>
                    </div>
                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    {success && <div className="text-green-600 text-sm">{success}</div>}
                  </form>
                </TabsContent>

                <TabsContent value="poc" className="space-y-4 mt-4">
                  {editOrg && (
                    <PocConfiguration 
                      organizationId={editOrg.id} 
                      onUpdate={async (pocData) => {
                        // Atualizar dados da organização se necessário
                        console.log('POC atualizada:', pocData);
                        // Recarregar a lista de organizações
                        await fetchOrganizations();
                      }}
                    />
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              // Modal de criação simples
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" value={form.name} onChange={handleFormChange} required />
                </div>
                <div>
                  <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
                  <Input id="cpf_cnpj" name="cpf_cnpj" value={form.cpf_cnpj} onChange={handleFormChange} placeholder="00.000.000/0001-00 ou 00000000000000" required />
                </div>
                <div>
                  <Label htmlFor="financial_email">E-Mail Financeiro *</Label>
                  <Input id="financial_email" name="financial_email" type="email" value={form.financial_email} onChange={handleFormChange} placeholder="financeiro@empresa.com" required />
                </div>
                <div>
                  <Label htmlFor="max_users">Quantidade de Usuários *</Label>
                  <Input id="max_users" name="max_users" type="number" value={form.max_users.toString()} onChange={handleFormChange} min="1" max="1000" required />
                </div>
                <div>
                  <Label htmlFor="price_per_user">Valor por Usuário (R$) *</Label>
                  <Input id="price_per_user" name="price_per_user" type="number" step="0.01" value={form.price_per_user.toString()} onChange={handleFormChange} placeholder="0.00" required />
                </div>
                <div>
                  <Label htmlFor="logo_url">Logo (URL)</Label>
                  <Input id="logo_url" name="logo_url" value={form.logo_url} onChange={handleFormChange} placeholder="https://exemplo.com/logo.png" />
                </div>
                <div>
                  <Label htmlFor="whatsapp_api">API WhatsApp *</Label>
                  <Select 
                    value={form.whatsapp_api || 'baileys'} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, whatsapp_api: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baileys">Baileys</SelectItem>
                      <SelectItem value="wppconnect">WPPConnect</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escolha a API para conexões WhatsApp desta organização
                  </p>
                </div>
                <div>
                  <Label htmlFor="proxy">Proxy (Opcional)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Configure um proxy para conexões WhatsApp. Formatos suportados: http://, https://, socks4://, socks5://
                  </p>
                  <Input
                    id="proxy"
                    name="proxy"
                    type="text"
                    value={form.proxy || ''}
                    onChange={handleFormChange}
                    placeholder="http://proxy.example.com:8080 ou socks5://proxy.example.com:1080"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemplo: http://usuario:senha@proxy.example.com:8080
                  </p>
                </div>
                <div>
                  <Label htmlFor="company_url">URL da Empresa</Label>
                  <Input 
                    id="company_url" 
                    name="company_url" 
                    value={form.domain || ''} 
                    readOnly 
                    className="bg-gray-50 text-gray-600"
                    placeholder="empresa.dohoo.app"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL gerada automaticamente para acesso à plataforma
                  </p>
                </div>
                {error && <div className="text-red-500 text-sm">{error}</div>}
                {success && <div className="text-green-600 text-sm">{success}</div>}
              </form>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            {!editOrg && (
              <Button type="submit" disabled={loading} onClick={handleSubmit}>
                {loading ? 'Salvando...' : 'Cadastrar'}
              </Button>
            )}
            {editOrg && editModalTab === 'general' && (
              <Button type="submit" disabled={loading} onClick={handleSubmit}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar organização?</DialogTitle>
          </DialogHeader>
          <div className="text-yellow-600 mb-2">Esta ação pode ser revertida!</div>
          <div className="mb-4 text-sm text-muted-foreground">
            Esta organização será desativada e não poderá mais ser usada. Os dados serão mantidos para fins de auditoria e esta ação pode ser revertida posteriormente.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={loading}>{loading ? 'Desativando...' : 'Desativar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de criação de usuário */}
      <Dialog open={createUserModalOpen} onOpenChange={setCreateUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Criar Usuário para {selectedOrgForUser?.name}
              </div>
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateUser}>
            <div>
              <Label htmlFor="user-name">Nome *</Label>
              <Input
                id="user-name"
                name="name"
                value={userForm.name}
                onChange={handleCreateUserFormChange}
                placeholder="Nome completo"
                required
              />
            </div>
            <div>
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                name="email"
                type="email"
                value={userForm.email}
                onChange={handleCreateUserFormChange}
                placeholder="email@exemplo.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="user-role">Nível de Acesso</Label>
              <Select
                value={userForm.role_id}
                onValueChange={(value: string) => setUserForm(prev => ({ ...prev, role_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                      {role.organization_id === null && ' (Global)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="user-password">Senha *</Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                value={userForm.password}
                onChange={handleCreateUserFormChange}
                placeholder="Digite uma senha"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-name-in-chat"
                checked={userForm.show_name_in_chat}
                onCheckedChange={(checked: boolean) => setUserForm(prev => ({ ...prev, show_name_in_chat: checked }))}
              />
              <Label htmlFor="show-name-in-chat">Mostrar nome no chat</Label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="send-email"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                />
                <Label htmlFor="send-email">Enviar email de boas-vindas</Label>
              </div>

              {sendEmail && (
                <div className="space-y-2">
                  <Label htmlFor="email-template">Tipo de Email</Label>
                  <Select
                    value={emailTemplate}
                    onValueChange={(value: string) => setEmailTemplate(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Email de Boas-vindas</SelectItem>
                      <SelectItem value="credentials">Email com Credenciais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">{success}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCreateUserModal}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Criando...' : 'Criar Usuário'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de criação com usuários */}
      <Dialog open={createWithUsersModalOpen} onOpenChange={setCreateWithUsersModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] sm:max-w-4xl flex flex-col">
          <div className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100">
            <DialogHeader>
              <DialogTitle>
                <div className="text-lg sm:text-xl flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Criar Organização com Usuários
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'organization' | 'poc')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="organization" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Organização
                </TabsTrigger>
                <TabsTrigger value="poc" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  POC
                </TabsTrigger>
              </TabsList>

              <TabsContent value="organization" className="space-y-4 mt-4">
                <form onSubmit={(e) => {
                  console.log('🔍 Form submit chamado');
                  e.preventDefault();
                  handleCreateWithUsers(e);
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="org-name">Nome da Organização *</Label>
                    <Input
                      id="org-name"
                      name="name"
                      value={organizationForm.name}
                      onChange={handleOrganizationFormChange}
                      required
                      placeholder="Digite o nome da organização"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-cpf_cnpj">CPF/CNPJ *</Label>
                    <Input
                      id="org-cpf_cnpj"
                      name="cpf_cnpj"
                      value={organizationForm.cpf_cnpj}
                      onChange={handleOrganizationFormChange}
                      placeholder="00.000.000/0001-00 ou 00000000000000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-max_users">Limite de Usuários</Label>
                    <Input
                      id="org-max_users"
                      name="max_users"
                      type="number"
                      value={organizationForm.max_users.toString()}
                      onChange={handleOrganizationFormChange}
                      min="1"
                      max="1000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-logo_url">Logo (URL)</Label>
                    <Input
                      id="org-logo_url"
                      name="logo_url"
                      value={organizationForm.logo_url}
                      onChange={handleOrganizationFormChange}
                      placeholder="https://exemplo.com/logo.png"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-whatsapp_api">API WhatsApp *</Label>
                    <Select 
                      value={organizationForm.whatsapp_api || 'baileys'} 
                      onValueChange={(value) => setOrganizationForm(prev => ({ ...prev, whatsapp_api: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baileys">Baileys</SelectItem>
                        <SelectItem value="wppconnect">WPPConnect</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Escolha a API para conexões WhatsApp desta organização
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="org-proxy">Proxy (Opcional)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Configure um proxy para conexões WhatsApp. Formatos suportados: http://, https://, socks4://, socks5://
                    </p>
                    <Input
                      id="org-proxy"
                      name="proxy"
                      type="text"
                      value={organizationForm.proxy || ''}
                      onChange={handleOrganizationFormChange}
                      placeholder="http://proxy.example.com:8080 ou socks5://proxy.example.com:1080"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Exemplo: http://usuario:senha@proxy.example.com:8080
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="org-financial_email">E-Mail Financeiro *</Label>
                    <Input
                      id="org-financial_email"
                      name="financial_email"
                      type="email"
                      value={organizationForm.financial_email}
                      onChange={handleOrganizationFormChange}
                      placeholder="financeiro@empresa.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-price_per_user">Valor por Usuário (R$) *</Label>
                    <Input
                      id="org-price_per_user"
                      name="price_per_user"
                      type="number"
                      step="0.01"
                      value={organizationForm.price_per_user.toString()}
                      onChange={handleOrganizationFormChange}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Campo de domínio gerado automaticamente (somente leitura) */}
                  {organizationForm.domain && (
                    <div>
                      <Label htmlFor="org-domain">Subdomínio Gerado</Label>
                      <Input
                        id="org-domain"
                        name="domain"
                        value={organizationForm.domain}
                        readOnly
                        className="bg-gray-50 text-gray-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Subdomínio gerado automaticamente baseado no nome da organização
                      </p>
                    </div>
                  )}
                </form>
              </TabsContent>


              <TabsContent value="poc" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <h3 className="text-blue-900">Configuração POC (Proof of Concept)</h3>
                    </div>
                    <p className="text-sm text-blue-800 mt-2">
                      Configure se esta organização será uma POC e defina os parâmetros de avaliação.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is-poc"
                        checked={pocConfig.is_poc}
                        onCheckedChange={(checked: boolean) => setPocConfig(prev => ({ ...prev, is_poc: checked }))}
                      />
                      <Label htmlFor="is-poc" className="">Esta é uma organização POC</Label>
                    </div>

                    {pocConfig.is_poc && (
                      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="poc-duration">Duração da POC (dias) *</Label>
                            <Input
                              id="poc-duration"
                              name="poc_duration_days"
                              type="number"
                              value={pocConfig.poc_duration_days.toString()}
                              onChange={handlePocConfigChange}
                              min="1"
                              max="365"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="poc-start-date">Data de Início</Label>
                            <Input
                              id="poc-start-date"
                              name="poc_start_date"
                              type="date"
                              value={pocConfig.poc_start_date}
                              onChange={handlePocConfigChange}
                            />
                            <p className="text-xs text-gray-500 mt-1">Deixe em branco para usar a data atual</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="poc-contact-email">Email de Contato POC</Label>
                            <Input
                              id="poc-contact-email"
                              name="poc_contact_email"
                              type="email"
                              value={pocConfig.poc_contact_email}
                              onChange={handlePocConfigChange}
                              placeholder="contato@empresa.com"
                            />
                          </div>
                          <div>
                            <Label htmlFor="poc-contact-phone">Telefone de Contato POC</Label>
                            <Input
                              id="poc-contact-phone"
                              name="poc_contact_phone"
                              type="tel"
                              value={pocConfig.poc_contact_phone}
                              onChange={handlePocConfigChange}
                              placeholder="(11) 99999-9999"
                            />
                          </div>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-yellow-100 rounded-full flex items-center justify-center">
                              <span className="text-yellow-600 text-xs">!</span>
                            </div>
                            <p className="text-sm text-yellow-800">Importante</p>
                          </div>
                          <p className="text-xs text-yellow-700 mt-1">
                            As notificações de POC serão enviadas para o email e telefone informados quando a POC estiver próxima do vencimento.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-t border-gray-100">
            <DialogFooter>
              <Button variant="outline" onClick={closeCreateWithUsersModal}>
                Cancelar
              </Button>
              <Button
                onClick={(e) => {
                  console.log('🔍 Botão criar clicado');
                  e.preventDefault();
                  handleCreateWithUsers(e);
                }}
                disabled={loading || !organizationForm.name}
                className={`${loading || !organizationForm.name
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                title={
                  !organizationForm.name
                    ? 'Preencha o nome da organização'
                    : 'Criar organização'
                }
              >
                {loading ? 'Criando...' : 'Criar Organização'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegisterOrganization; 