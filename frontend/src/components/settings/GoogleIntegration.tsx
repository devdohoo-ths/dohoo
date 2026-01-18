import React, { useState, useEffect } from 'react';
import { Calendar, FolderOpen, Settings, Save, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase

const GoogleIntegration = () => {
  const { user, profile } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Campos de configuração OAuth2
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(`${apiBase}/api/google/callback`);
  const [isConfigured, setIsConfigured] = useState(false);

  // Função para obter o token de acesso
  const getAccessToken = async () => {
    const headers = await getAuthHeaders();
    return headers['Authorization']?.replace('Bearer ', '') || null;
  };

  // Verificar se o usuário é super admin
  useEffect(() => {
    console.log('🔍 Verificando permissões de super admin...');
    console.log('👤 Profile:', profile);
    console.log('🏢 Organization:', organization);
    
    if (profile) {
      const isAdmin = profile.user_role === 'super_admin';
      console.log('🔐 User role:', profile.user_role, 'Is super admin:', isAdmin);
      setIsSuperAdmin(isAdmin);
    }
  }, [profile, organization]);

  // Verificar se já está configurado
  useEffect(() => {
    if (organization?.id) {
      checkConfigurationStatus();
    }
  }, [organization]);

  const checkConfigurationStatus = async () => {
    if (!organization?.id) return;

    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/google/config/status/${organization.id}`, {
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        setIsConfigured(data.isConfigured);
        if (data.isConfigured) {
          setClientId(data.config.client_id || '');
          setClientSecret('••••••••••••••••'); // Não mostrar o secret
          setRedirectUri(data.config.redirect_uri || `${apiBase}/api/google/callback`);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status da configuração:', error);
    }
  };

  const saveOAuthConfig = async () => {
    console.log('🔧 Iniciando configuração OAuth2...');
    console.log('📋 Dados:', { 
      organizationId: organization?.id, 
      clientId: clientId ? 'Preenchido' : 'Vazio',
      clientSecret: clientSecret ? 'Preenchido' : 'Vazio',
      redirectUri: redirectUri 
    });

    if (!organization?.id) {
      console.log('❌ Organização não encontrada');
      toast({
        title: "Erro",
        description: "Organização não encontrada",
        variant: "destructive"
      });
      return;
    }

    if (!clientId.trim() || !clientSecret.trim()) {
      console.log('❌ Campos obrigatórios não preenchidos');
      toast({
        title: "Erro",
        description: "Preencha Client ID e Client Secret",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    console.log('🔄 Iniciando requisição para /api/google/config/setup...');
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      console.log('🎫 Headers obtidos:', !!headers);
      
      const requestData = {
        organizationId: organization.id,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        redirectUri: redirectUri.trim()
      };
      
      console.log('📤 Enviando dados:', { ...requestData, clientSecret: '***' });
      
      // Criar um controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout
      
      const response = await fetch(`${apiBase}/api/google/config/setup`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('📡 Resposta recebida:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📋 Dados da resposta:', data);
      
      if (data.success) {
        console.log('✅ Configuração salva com sucesso');
        toast({
          title: "Sucesso",
          description: "Credenciais OAuth2 configuradas com sucesso!",
        });
        setIsConfigured(true);
        setClientSecret('••••••••••••••••'); // Ocultar o secret
      } else {
        console.log('❌ Erro na resposta:', data.error);
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('❌ Erro ao configurar OAuth2:', error);
      
      if (error.name === 'AbortError') {
        toast({
          title: "Timeout",
          description: "A requisição demorou muito para responder. Tente novamente.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao configurar credenciais",
          variant: "destructive"
        });
      }
    } finally {
      console.log('🏁 Finalizando configuração OAuth2');
      setLoading(false);
    }
  };

  const updateOAuthConfig = async () => {
    if (!organization?.id) {
      toast({
        title: "Erro",
        description: "Organização não encontrada",
        variant: "destructive"
      });
      return;
    }

    if (!clientId.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o Client ID",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const updateData = {
        organizationId: organization.id,
        clientId: clientId.trim(),
        redirectUri: redirectUri.trim()
      };

      // Só incluir client secret se foi alterado
      if (clientSecret !== '••••••••••••••••') {
        updateData.clientSecret = clientSecret.trim();
      }

      const response = await fetch(`${apiBase}/api/google/config/update`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Credenciais OAuth2 atualizadas com sucesso!",
        });
        setClientSecret('••••••••••••••••'); // Ocultar o secret
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar credenciais",
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando configurações da organização...</p>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se é super admin
  if (!isSuperAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertDescription>
            <strong>Acesso Negado:</strong> Apenas super administradores podem configurar integrações Google.
          </AlertDescription>
        </Alert>
        
        {/* Informações de debug */}
        <Card>
          <CardHeader>
            <CardTitle>Informações de Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Usuário:</strong> {user?.email}</p>
              <p><strong>User Role:</strong> {profile?.user_role || 'Não definido'}</p>
              <p><strong>Organização:</strong> {organization?.name || 'Não carregada'}</p>
              <p><strong>É Super Admin:</strong> {isSuperAdmin ? 'Sim' : 'Não'}</p>
              <p><strong>Profile ID:</strong> {profile?.id || 'Não encontrado'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl">Configuração OAuth2 Google</h1>
        <p className="text-muted-foreground">
          Configure as credenciais OAuth2 do Google para sua organização
        </p>
      </div>

      <Alert>
        <AlertCircle size={16} />
        <AlertDescription>
          <strong>Configuração OAuth2:</strong> Esta tela permite configurar as credenciais OAuth2 do Google. 
          Após a configuração, os usuários poderão conectar suas contas Google na tela "Conectar Google".
        </AlertDescription>
      </Alert>

      {/* Status da Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings size={20} />
            <span>Status da Configuração</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              isConfigured 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {isConfigured ? 'Configurado' : 'Não Configurado'}
            </span>
          </CardTitle>
          <CardDescription>
            {isConfigured 
              ? 'As credenciais OAuth2 estão configuradas. Os usuários podem conectar suas contas Google.'
              : 'Configure as credenciais OAuth2 para permitir conexões Google.'
            }
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Configuração OAuth2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings size={20} />
            <span>Credenciais OAuth2</span>
          </CardTitle>
          <CardDescription>
            Configure as credenciais do Google Cloud Console
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                type="text"
                placeholder="Seu Client ID do Google"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder={isConfigured ? "••••••••••••••••" : "Seu Client Secret do Google"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
              {isConfigured && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para manter o secret atual
                </p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="redirectUri">Redirect URI</Label>
            <Input
              id="redirectUri"
              type="text"
              placeholder="URL de redirecionamento"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Configure esta URL no Google Cloud Console como URI de redirecionamento autorizado
            </p>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button 
              onClick={isConfigured ? updateOAuthConfig : saveOAuthConfig}
              disabled={loading || !clientId || (!isConfigured && !clientSecret)}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isConfigured ? 'Atualizando...' : 'Configurando...'}
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  {isConfigured ? 'Atualizar Configuração' : 'Salvar Configuração'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Próximos Passos */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-sm">1</span>
                </div>
                <div>
                  <h4 className="">Configuração OAuth2 Concluída</h4>
                  <p className="text-sm text-muted-foreground">
                    As credenciais OAuth2 estão configuradas e prontas para uso.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm">2</span>
                </div>
                <div>
                  <h4 className="">Conectar Contas Google</h4>
                  <p className="text-sm text-muted-foreground">
                    Acesse "Integrações {'>'} Conectar Google" para conectar as contas Calendar e Drive da organização.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-purple-600 text-sm">3</span>
                </div>
                <div>
                  <h4 className="">Usar Integrações</h4>
                  <p className="text-sm text-muted-foreground">
                    Após a conexão, os usuários poderão usar Calendar e Drive automaticamente.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GoogleIntegration; 