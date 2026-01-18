import React, { useState, useEffect } from 'react';
import { Calendar, FolderOpen, ExternalLink, CheckCircle, AlertCircle, RefreshCw, Settings, Plus, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import GoogleOAuthHelp from './GoogleOAuthHelp';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

const GoogleConnect = () => {
  const { user } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  
  // Estados para configuração rápida
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(`${apiBase}/api/auth/google/callback`);

  // Função para obter o token de acesso
  const getAccessToken = async () => {
    const headers = await getAuthHeaders();
    return headers['Authorization']?.replace('Bearer ', '') || null;
  };

  // Verificar se o usuário é super admin
  useEffect(() => {
    if (organization) {
      // Verificar se é super admin baseado em outras propriedades ou remover esta verificação
      setIsSuperAdmin(false); // Temporariamente desabilitado
    }
  }, [organization]);

  // Verificar status das conexões e configuração OAuth2
  useEffect(() => {
    if (organization?.id) {
      checkConnectionStatus();
      checkOAuthConfig();
    }
  }, [organization]);

  // Listener para mensagens da janela popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('📨 Mensagem recebida:', event.data);
      
      if (event.data.type === 'GOOGLE_CONNECTED') {
        console.log('✅ Mensagem GOOGLE_CONNECTED recebida!');
        const service = event.data.service;
        console.log('📋 Service:', service);
        
        if (service === 'calendar') {
          setCalendarConnected(true);
          console.log('📅 Calendar conectado');
        } else if (service === 'drive') {
          setDriveConnected(true);
          console.log('📁 Drive conectado');
        }
        
        toast({
          title: "Sucesso",
          description: `${service === 'calendar' ? 'Google Calendar' : 'Google Drive'} conectado com sucesso!`,
        });
        
        // Verifica status atualizado
        console.log('🔄 Verificando status atualizado...');
        checkConnectionStatus();
      }
    };

    console.log('👂 Listener de mensagens configurado');
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkConnectionStatus = async () => {
    if (!organization?.id) return;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/status/${organization.id}`, {
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        setCalendarConnected(data.status.calendar);
        setDriveConnected(data.status.drive);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const checkOAuthConfig = async () => {
    if (!organization?.id) return;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/config/status/${organization.id}`, {
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        setOauthConfigured(data.isConfigured);
        if (data.isConfigured && data.config) {
          setClientId(data.config.client_id || '');
          setRedirectUri(data.config.redirect_uri || `${apiBase}/api/auth/google/callback`);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar configuração OAuth2:', error);
    }
  };

  const saveQuickOAuthConfig = async () => {
    if (!organization?.id) {
      toast({
        title: "Erro",
        description: "Organização não encontrada",
        variant: "destructive"
      });
      return;
    }

    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: "Erro",
        description: "Preencha Client ID e Client Secret",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/config/setup`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: organization.id,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: redirectUri.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Credenciais OAuth2 configuradas com sucesso!",
        });
        setOauthConfigured(true);
        setShowQuickConfig(false);
        setClientSecret('••••••••••••••••'); // Ocultar o secret
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao configurar credenciais",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleAccount = async (service: 'calendar' | 'drive') => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    if (!organization?.id) {
      toast({
        title: "Erro",
        description: "Organização não encontrada. Tente recarregar a página.",
        variant: "destructive"
      });
      return;
    }

    console.log('🔗 Conectando Google:', { service, organizationId: organization.id });

    setLoading(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      console.log('🎫 Headers obtidos:', !!headers);
      
      // Criar um controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout
      
      const response = await fetch(`${apiBase}/api/google/connect`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: organization.id,
          service
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('📡 Resposta recebida:', response.status);
      const data = await response.json();
      console.log('📋 Dados da resposta:', data);
      
      if (data.success) {
        if (data.authUrl) {
          console.log('🔗 URL de autorização recebida:', data.authUrl);
          
          // Abre a URL de autorização em nova aba
          const popup = window.open(data.authUrl, '_blank', 'width=600,height=700');
          
          if (!popup) {
            toast({
              title: "Popup Bloqueado",
              description: "O navegador bloqueou a janela popup. Permita popups para este site e tente novamente.",
              variant: "destructive"
            });
            return;
          }
          
          console.log('✅ Popup aberto com sucesso');
          
          toast({
            title: "Autorização Necessária",
            description: `Uma nova janela foi aberta para conectar ${service === 'calendar' ? 'Google Calendar' : 'Google Drive'}. Complete a autorização e feche a janela.`,
          });
        } else {
          toast({
            title: "Sucesso",
            description: data.message,
          });
        }
      } else {
        // Verifica se é erro de configuração
        if (data.error && data.error.includes('Configurações OAuth')) {
          toast({
            title: "Configuração Necessária",
            description: "As configurações do Google OAuth não estão disponíveis. Configure as credenciais primeiro.",
            variant: "destructive"
          });
          setShowQuickConfig(true);
        } else {
          throw new Error(data.error);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao conectar:', error);
      
      if (error.name === 'AbortError') {
        toast({
          title: "Timeout",
          description: "A requisição demorou muito para responder. Tente novamente.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao conectar conta Google",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const disconnectGoogleAccount = async (service: 'calendar' | 'drive') => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    if (!organization?.id) {
      toast({
        title: "Erro",
        description: "Organização não encontrada. Tente recarregar a página.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/disconnect`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: organization.id,
          service
        })
      });

      const data = await response.json();
      
      if (data.success) {
        if (service === 'calendar') {
          setCalendarConnected(false);
        } else {
          setDriveConnected(false);
        }
        
        toast({
          title: "Sucesso",
          description: `${service === 'calendar' ? 'Google Calendar' : 'Google Drive'} desconectado com sucesso!`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao desconectar",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading enquanto carrega a organização
  if (orgLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando configurações da organização...</p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar erro se não conseguir carregar a organização
  if (!organization) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertDescription>
            <strong>Erro ao carregar organização:</strong> Não foi possível carregar as informações da sua organização. 
            Tente recarregar a página ou entre em contato com o suporte.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
          <PermissionGuard requiredPermissions={['manage_google_integration']}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl">
            Integração Google
          </h1>
          <p className="text-muted-foreground">
            Configure e conecte as integrações Google Calendar e Drive da sua organização
          </p>
        </div>

        {/* Configuração Rápida OAuth2 */}
        {!oauthConfigured && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings size={20} />
                <span>Configuração OAuth2</span>
                <Badge variant="secondary">Necessário</Badge>
              </CardTitle>
              <CardDescription>
                Configure as credenciais OAuth2 do Google para conectar Calendar e Drive
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showQuickConfig ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle size={16} />
                    <AlertDescription>
                      <strong>Primeiro passo:</strong> Configure as credenciais OAuth2 do Google Cloud Console 
                      para permitir que o sistema conecte Calendar e Drive.
                    </AlertDescription>
                  </Alert>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => setShowQuickConfig(true)}
                      className="flex-1"
                    >
                      <Plus size={16} className="mr-2" />
                      Configurar Credenciais OAuth2
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowHelp(!showHelp)}
                    >
                      <HelpCircle size={16} className="mr-2" />
                      {showHelp ? 'Ocultar Ajuda' : 'Ver Ajuda'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="clientId">Client ID</Label>
                      <Input
                        id="clientId"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="Digite o Client ID do Google"
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientSecret">Client Secret</Label>
                      <Input
                        id="clientSecret"
                        type="password"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder="Digite o Client Secret do Google"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="redirectUri">Redirect URI</Label>
                    <Input
                      id="redirectUri"
                      value={redirectUri}
                      onChange={(e) => setRedirectUri(e.target.value)}
                      placeholder={`${apiBase}/api/auth/google/callback`}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={saveQuickOAuthConfig}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={16} className="mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Settings size={16} className="mr-2" />
                          Salvar Configuração
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowQuickConfig(false)}
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                  </div>
                  <Alert>
                    <AlertCircle size={16} />
                    <AlertDescription>
                      <strong>Como obter as credenciais:</strong> Acesse o Google Cloud Console, 
                      crie um projeto, ative as APIs Calendar e Drive, e configure as credenciais OAuth2.
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-blue-600"
                        onClick={() => setShowHelp(!showHelp)}
                      >
                        Clique aqui para ver o guia completo
                      </Button>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Componente de Ajuda */}
        {showHelp && (
          <GoogleOAuthHelp />
        )}

        {/* Status da Configuração OAuth2 */}
        {oauthConfigured && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings size={20} />
                <span>Status da Configuração OAuth2</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Configurado
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-green-600">
                  ✅ Credenciais OAuth2 configuradas. Você pode conectar Calendar e Drive.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar size={20} />
                <span>Google Calendar</span>
                <Badge variant={calendarConnected ? 'default' : 'secondary'}>
                  {calendarConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Eventos criados automaticamente na agenda da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {calendarConnected ? (
                <>
                  <div className="flex items-center space-x-2 text-sm text-green-600">
                    <CheckCircle size={16} />
                    <span>Agenda da organização está ativa</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Eventos são criados automaticamente na agenda da organização quando agendamentos são confirmados.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => disconnectGoogleAccount('calendar')}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} className="mr-2" />
                        Desconectar Calendar
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {oauthConfigured 
                      ? 'Conecte a agenda da organização para que eventos sejam criados automaticamente.'
                      : 'A agenda da organização não está conectada. Configure as credenciais OAuth2 primeiro.'
                    }
                  </p>
                  <Button 
                    onClick={() => connectGoogleAccount('calendar')}
                    disabled={loading || !oauthConfigured}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <ExternalLink size={16} className="mr-2" />
                        Conectar Google Calendar
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Google Drive */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FolderOpen size={20} />
                <span>Google Drive</span>
                <Badge variant={driveConnected ? 'default' : 'secondary'}>
                  {driveConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Arquivos salvos automaticamente no Drive da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {driveConnected ? (
                <>
                  <div className="flex items-center space-x-2 text-sm text-green-600">
                    <CheckCircle size={16} />
                    <span>Drive da organização está ativo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Arquivos são salvos automaticamente no Drive da organização.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => disconnectGoogleAccount('drive')}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} className="mr-2" />
                        Desconectar Drive
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {oauthConfigured 
                      ? 'Conecte o Drive da organização para que arquivos sejam salvos automaticamente.'
                      : 'O Drive da organização não está conectado. Configure as credenciais OAuth2 primeiro.'
                    }
                  </p>
                  <Button 
                    onClick={() => connectGoogleAccount('drive')}
                    disabled={loading || !oauthConfigured}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <ExternalLink size={16} className="mr-2" />
                        Conectar Google Drive
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {!oauthConfigured && !calendarConnected && !driveConnected && (
          <Alert>
            <AlertCircle size={16} />
            <AlertDescription>
              <strong>Integração não configurada:</strong> Configure as credenciais OAuth2 primeiro 
              para conectar Calendar e Drive da sua organização.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </PermissionGuard>
  );
};

export default GoogleConnect; 