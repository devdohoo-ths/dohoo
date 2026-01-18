import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Plus, Settings, Trash2, Edit, CheckCircle, AlertCircle, WifiOff, Play, TestTube, Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'supabase';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url?: string;
  serviceRoleKey?: string;
  status: 'connected' | 'disconnected' | 'error';
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

export default function DatabaseManagerPage() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<DatabaseConnection | null>(null);
  const [showNewConnectionModal, setShowNewConnectionModal] = useState(false);
  const [showEditConnectionModal, setShowEditConnectionModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showServiceRoleKey, setShowServiceRoleKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const { toast } = useToast();

  // Form state for new connection
  const [newConnection, setNewConnection] = useState<Partial<DatabaseConnection>>({
    name: '',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    url: '',
    serviceRoleKey: ''
  });

  // Form state for editing connection
  const [editingConnection, setEditingConnection] = useState<Partial<DatabaseConnection>>({
    name: '',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    url: '',
    serviceRoleKey: ''
  });

  // Setup state
  const [setupOptions, setSetupOptions] = useState({
    createDatabase: false,
    runMigrations: false
  });

  // Form state for settings
  const [settings, setSettings] = useState({
    autoConnect: true,
    testOnSave: true,
    backupEnabled: true,
    maxConnections: 10,
    timeout: 30
  });

  useEffect(() => {
    loadConnections();
    loadSettings();
  }, []);

  const loadConnections = async () => {
    try {
      const response = await fetch('/api/database/connections');
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
        setActiveConnection(data.activeConnection || null);
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      // Mock data para demonstração
      setConnections([
        {
          id: '1',
          name: 'Dohoo Production',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'dohoo_prod',
          username: 'dohoo_user',
          password: '********',
          status: 'connected',
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z',
          lastUsed: '2024-01-20T15:30:00Z'
        },
        {
          id: '2',
          name: 'Dohoo Development',
          type: 'supabase',
          host: 'supabase.co',
          port: 5432,
          database: 'dohoo_dev',
          username: 'postgres',
          password: '********',
          url: 'https://etdwggokrzgipjlgmjlo.supabase.co',
          serviceRoleKey: '********',
          status: 'disconnected',
          isActive: false,
          createdAt: '2024-01-10T14:00:00Z'
        }
      ]);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/database/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const testConnection = async (connection: Partial<DatabaseConnection>) => {
    setIsTesting(true);
    try {
      console.log('🧪 Testando conexão:', connection);
      const response = await fetch('/api/database/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connection)
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.details?.needsSetup) {
          toast({
            title: "Conexão válida!",
            description: "Conexão OK, mas as tabelas não existem. Use o setup para criar as tabelas.",
            variant: "default",
          });
          return true;
        } else {
          toast({
            title: "Conexão bem-sucedida!",
            description: "A conexão com o banco de dados foi estabelecida com sucesso.",
          });
          return true;
        }
      } else {
        const error = await response.json();
        toast({
          title: "Erro na conexão",
          description: error.message || "Não foi possível conectar ao banco de dados.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      toast({
        title: "Erro na conexão",
        description: "Erro interno ao testar a conexão.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  const saveConnection = async () => {
    // Validação específica para cada tipo de banco
    if (!newConnection.name) {
      toast({
        title: "Campo obrigatório",
        description: "Nome da conexão é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (newConnection.type === 'supabase') {
      if (!newConnection.url || !newConnection.serviceRoleKey) {
        toast({
          title: "Campos obrigatórios",
          description: "URL e Service Role Key são obrigatórios para Supabase.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!newConnection.database) {
        toast({
          title: "Campo obrigatório",
          description: "Nome do banco de dados é obrigatório.",
          variant: "destructive",
        });
        return;
      }
    }

    // Test connection first if enabled
    if (settings.testOnSave) {
      const isConnected = await testConnection(newConnection);
      if (!isConnected) return;
    }

    try {
      const response = await fetch('/api/database/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConnection)
      });

      if (response.ok) {
        toast({
          title: "Conexão salva!",
          description: "A nova conexão foi salva com sucesso.",
        });
        setShowNewConnectionModal(false);
        setNewConnection({
          name: '',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: '',
          username: '',
          password: '',
          url: '',
          serviceRoleKey: ''
        });
        loadConnections();
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a conexão.",
        variant: "destructive",
      });
    }
  };

  const editConnection = (connection: DatabaseConnection) => {
    setEditingConnection({
      ...connection,
      password: '', // Não carregar senha por segurança
      serviceRoleKey: '' // Campo vazio para nova entrada
    });
    setShowEditConnectionModal(true);
  };

  const updateConnection = async () => {
    if (!editingConnection.id) return;

    // Validação específica para cada tipo de banco
    if (!editingConnection.name) {
      toast({
        title: "Campo obrigatório",
        description: "Nome da conexão é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (editingConnection.type === 'supabase') {
      if (!editingConnection.url) {
        toast({
          title: "Campo obrigatório",
          description: "URL é obrigatória para Supabase.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!editingConnection.database) {
        toast({
          title: "Campo obrigatório",
          description: "Nome do banco de dados é obrigatório.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsUpdating(true);
    try {
      // Preparar dados para atualização (só enviar campos que foram alterados)
      const updateData = { ...editingConnection };
      
      // Se a senha não foi alterada, remover do payload
      if (!updateData.password) delete updateData.password;
      
      // Para service role key, sempre enviar se foi preenchida
      if (!updateData.serviceRoleKey || updateData.serviceRoleKey.trim() === '') {
        delete updateData.serviceRoleKey;
      }

      const response = await fetch(`/api/database/connections/${editingConnection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast({
          title: "Conexão atualizada!",
          description: "A conexão foi atualizada com sucesso.",
        });
        setShowEditConnectionModal(false);
        setEditingConnection({
          name: '',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: '',
          username: '',
          password: '',
          url: '',
          serviceRoleKey: ''
        });
        loadConnections();
      } else {
        const error = await response.json();
        toast({
          title: "Erro ao atualizar",
          description: error.message || "Não foi possível atualizar a conexão.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Erro interno ao atualizar a conexão.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const activateConnection = async (connectionId: string) => {
    setIsConnecting(true);
    try {
      const response = await fetch(`/api/database/connections/${connectionId}/activate`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: "Conexão ativada!",
          description: "A conexão foi ativada com sucesso.",
        });
        loadConnections();
      }
    } catch (error) {
      toast({
        title: "Erro ao ativar",
        description: "Não foi possível ativar a conexão.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conexão?')) return;

    try {
      const response = await fetch(`/api/database/connections/${connectionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Conexão excluída!",
          description: "A conexão foi excluída com sucesso.",
        });
        loadConnections();
      }
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a conexão.",
        variant: "destructive",
      });
    }
  };

  const saveSettings = async () => {
    try {
      const response = await fetch('/api/database/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast({
          title: "Configurações salvas!",
          description: "As configurações foram salvas com sucesso.",
        });
        setShowSettingsModal(false);
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
  };

  const setupDatabase = async (connection: DatabaseConnection) => {
    setIsSettingUp(true);
    try {
      console.log('🚀 Iniciando setup do banco:', connection);
      
      const response = await fetch('/api/database/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection,
          createDatabase: setupOptions.createDatabase,
          runMigrations: setupOptions.runMigrations
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Setup concluído:', result);
        
        toast({
          title: "Setup concluído!",
          description: `Banco configurado com sucesso. ${result.results.migrations?.details?.executedMigrations || 0} migrações executadas.`,
        });
        
        setShowSetupModal(false);
        loadConnections();
      } else {
        const error = await response.json();
        toast({
          title: "Erro no setup",
          description: error.message || "Não foi possível configurar o banco.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Erro no setup:', error);
      toast({
        title: "Erro no setup",
        description: "Erro interno ao configurar o banco.",
        variant: "destructive",
      });
    } finally {
      setIsSettingUp(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="text-green-500" size={16} />;
      case 'error': return <AlertCircle className="text-red-500" size={16} />;
      default: return <WifiOff className="text-gray-500" size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: { variant: 'default', label: 'Conectado', color: 'bg-green-500' },
      error: { variant: 'destructive', label: 'Erro', color: 'bg-red-500' },
      disconnected: { variant: 'outline', label: 'Desconectado', color: 'bg-gray-500' }
    };
    const config = variants[status as keyof typeof variants] || variants.disconnected;
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  return (
          <PermissionGuard requiredPermissions={['manage_database']}>
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl flex items-center gap-2">
                <Database className="h-8 w-8" />
                Gerenciador de Banco de Dados
              </h1>
              <p className="text-muted-foreground mt-2">
                Configure e gerencie suas conexões de banco de dados
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Configurações do Gerenciador</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="general">Geral</TabsTrigger>
                      <TabsTrigger value="advanced">Avançado</TabsTrigger>
                      <TabsTrigger value="backup">Backup</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Conexão automática</Label>
                          <Select value={settings.autoConnect ? 'true' : 'false'} onValueChange={(value) => setSettings({...settings, autoConnect: value === 'true'})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Ativada</SelectItem>
                              <SelectItem value="false">Desativada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Testar ao salvar</Label>
                          <Select value={settings.testOnSave ? 'true' : 'false'} onValueChange={(value) => setSettings({...settings, testOnSave: value === 'true'})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Ativado</SelectItem>
                              <SelectItem value="false">Desativado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="advanced" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Máximo de conexões</Label>
                          <Input 
                            type="number" 
                            value={settings.maxConnections} 
                            onChange={(e) => setSettings({...settings, maxConnections: parseInt(e.target.value)})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Timeout (segundos)</Label>
                          <Input 
                            type="number" 
                            value={settings.timeout} 
                            onChange={(e) => setSettings({...settings, timeout: parseInt(e.target.value)})}
                          />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="backup" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Backup automático</Label>
                        <Select value={settings.backupEnabled ? 'true' : 'false'} onValueChange={(value) => setSettings({...settings, backupEnabled: value === 'true'})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Ativado</SelectItem>
                            <SelectItem value="false">Desativado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setShowSettingsModal(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={saveSettings}>
                      Salvar Configurações
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showNewConnectionModal} onOpenChange={setShowNewConnectionModal}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Conexão
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nova Conexão de Banco</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Conexão *</Label>
                        <Input 
                          placeholder="Ex: Dohoo Production"
                          value={newConnection.name}
                          onChange={(e) => setNewConnection({...newConnection, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Banco</Label>
                        <Select value={newConnection.type} onValueChange={(value: any) => setNewConnection({...newConnection, type: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="postgresql">PostgreSQL</SelectItem>
                            <SelectItem value="mysql">MySQL</SelectItem>
                            <SelectItem value="sqlite">SQLite</SelectItem>
                            <SelectItem value="supabase">Supabase</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {newConnection.type === 'supabase' ? (
                      <>
                        <div className="space-y-2">
                          <Label>URL do Supabase *</Label>
                          <Input 
                            placeholder="https://your-project.supabase.co"
                            value={newConnection.url}
                            onChange={(e) => setNewConnection({...newConnection, url: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Service Role Key *</Label>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"}
                              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                              value={newConnection.serviceRoleKey}
                              onChange={(e) => setNewConnection({...newConnection, serviceRoleKey: e.target.value})}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Encontre esta chave em: Settings → API → service_role key
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Host</Label>
                            <Input 
                              placeholder="localhost"
                              value={newConnection.host}
                              onChange={(e) => setNewConnection({...newConnection, host: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Porta</Label>
                            <Input 
                              type="number"
                              placeholder="5432"
                              value={newConnection.port}
                              onChange={(e) => setNewConnection({...newConnection, port: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Nome do Banco *</Label>
                          <Input 
                            placeholder="nome_do_banco"
                            value={newConnection.database}
                            onChange={(e) => setNewConnection({...newConnection, database: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Usuário</Label>
                            <Input 
                              placeholder="username"
                              value={newConnection.username}
                              onChange={(e) => setNewConnection({...newConnection, username: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Senha</Label>
                            <div className="relative">
                              <Input 
                                type={showPassword ? "text" : "password"}
                                placeholder="password"
                                value={newConnection.password}
                                onChange={(e) => setNewConnection({...newConnection, password: e.target.value})}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setShowNewConnectionModal(false)}>
                      Cancelar
                    </Button>
                    <Button variant="outline" onClick={() => testConnection(newConnection)} disabled={isTesting}>
                      <TestTube className="h-4 w-4 mr-2" />
                      {isTesting ? 'Testando...' : 'Testar Conexão'}
                    </Button>
                    <Button onClick={saveConnection}>
                      Salvar Conexão
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Modal de Edição */}
              <Dialog open={showEditConnectionModal} onOpenChange={setShowEditConnectionModal}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Editar Conexão de Banco</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Conexão *</Label>
                        <Input 
                          placeholder="Ex: Dohoo Production"
                          value={editingConnection.name}
                          onChange={(e) => setEditingConnection({...editingConnection, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Banco</Label>
                        <Select value={editingConnection.type} onValueChange={(value: any) => setEditingConnection({...editingConnection, type: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="postgresql">PostgreSQL</SelectItem>
                            <SelectItem value="mysql">MySQL</SelectItem>
                            <SelectItem value="sqlite">SQLite</SelectItem>
                            <SelectItem value="supabase">Supabase</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {editingConnection.type === 'supabase' ? (
                      <>
                        <div className="space-y-2">
                          <Label>URL do Supabase *</Label>
                          <Input 
                            placeholder="https://your-project.supabase.co"
                            value={editingConnection.url}
                            onChange={(e) => setEditingConnection({...editingConnection, url: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Service Role Key</Label>
                          <div className="relative">
                            <Input 
                              type={showServiceRoleKey ? "text" : "password"}
                              placeholder="Deixe em branco para manter a atual"
                              value={editingConnection.serviceRoleKey}
                              onChange={(e) => setEditingConnection({...editingConnection, serviceRoleKey: e.target.value})}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowServiceRoleKey(!showServiceRoleKey)}
                            >
                              {showServiceRoleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Digite a nova chave para atualizar. Encontre esta chave em: Settings → API → service_role key
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Host</Label>
                            <Input 
                              placeholder="localhost"
                              value={editingConnection.host}
                              onChange={(e) => setEditingConnection({...editingConnection, host: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Porta</Label>
                            <Input 
                              type="number"
                              placeholder="5432"
                              value={editingConnection.port}
                              onChange={(e) => setEditingConnection({...editingConnection, port: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Nome do Banco *</Label>
                          <Input 
                            placeholder="nome_do_banco"
                            value={editingConnection.database}
                            onChange={(e) => setEditingConnection({...editingConnection, database: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Usuário</Label>
                            <Input 
                              placeholder="username"
                              value={editingConnection.username}
                              onChange={(e) => setEditingConnection({...editingConnection, username: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Senha</Label>
                            <div className="relative">
                              <Input 
                                type={showPassword ? "text" : "password"}
                                placeholder="Deixe em branco para manter a atual"
                                value={editingConnection.password}
                                onChange={(e) => setEditingConnection({...editingConnection, password: e.target.value})}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Deixe em branco para manter a senha atual
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setShowEditConnectionModal(false)}>
                      Cancelar
                    </Button>
                    <Button variant="outline" onClick={() => testConnection(editingConnection)} disabled={isTesting}>
                      <TestTube className="h-4 w-4 mr-2" />
                      {isTesting ? 'Testando...' : 'Testar Conexão'}
                    </Button>
                    <Button onClick={updateConnection} disabled={isUpdating}>
                      {isUpdating ? 'Atualizando...' : 'Atualizar Conexão'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Modal de Setup */}
              <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Setup do Banco de Dados</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="text-blue-900 mb-2">📋 O que será configurado:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• <strong>37 tabelas</strong> do sistema Dohoo</li>
                        <li>• <strong>Índices</strong> para performance</li>
                        <li>• <strong>Funções</strong> e triggers</li>
                        <li>• <strong>Tipos</strong> e enums personalizados</li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="createDatabase"
                          checked={setupOptions.createDatabase}
                          onChange={(e) => setSetupOptions({...setupOptions, createDatabase: e.target.checked})}
                          className="rounded"
                        />
                        <label htmlFor="createDatabase" className="text-sm">
                          Criar banco de dados (apenas PostgreSQL)
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="runMigrations"
                          checked={setupOptions.runMigrations}
                          onChange={(e) => setSetupOptions({...setupOptions, runMigrations: e.target.checked})}
                          className="rounded"
                        />
                        <label htmlFor="runMigrations" className="text-sm">
                          Executar migrações (criar tabelas)
                        </label>
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h4 className="text-yellow-900 mb-2">⚠️ Importante:</h4>
                      <ul className="text-sm text-yellow-800 space-y-1">
                        <li>• Este processo pode demorar alguns minutos</li>
                        <li>• Não interrompa o processo</li>
                        <li>• As tabelas existentes não serão sobrescritas</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setShowSetupModal(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => setupDatabase(activeConnection!)} 
                      disabled={isSettingUp || !activeConnection}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSettingUp ? 'Configurando...' : 'Iniciar Setup'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Total de Conexões</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{connections.length}</div>
                <p className="text-xs text-muted-foreground">
                  {connections.length === 0 ? 'Nenhuma conexão configurada' : 'Conexões configuradas'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Conexões Ativas</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-green-600">
                  {connections.filter(c => c.status === 'connected').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {connections.filter(c => c.status === 'connected').length === 0 ? 'Nenhuma conexão ativa' : 'Conexões funcionando'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Banco Ativo</CardTitle>
                <Play className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-blue-600">
                  {activeConnection ? '1' : '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeConnection ? activeConnection.name : 'Nenhum banco ativo'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Migrações</CardTitle>
                <Settings className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-purple-600">2</div>
                <p className="text-xs text-muted-foreground">
                  Migrações disponíveis
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Connections List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Conexões de Banco</CardTitle>
                <Button variant="outline" onClick={() => setShowManageModal(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Gerenciar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg mb-2">Nenhuma conexão configurada</h3>
                  <p className="text-muted-foreground mb-4">
                    Configure sua primeira conexão de banco de dados para começar.
                  </p>
                  <Button onClick={() => setShowNewConnectionModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeira Conexão
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {connections.map((connection) => (
                    <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(connection.status)}
                          <div>
                            <h4 className="">{connection.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {connection.type === 'supabase' 
                                ? `${connection.type.toUpperCase()} • ${connection.url}`
                                : `${connection.type.toUpperCase()} • ${connection.host}:${connection.port}`
                              }
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(connection.status)}
                        {connection.isActive && (
                          <Badge variant="default" className="bg-blue-500">
                            Ativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {!connection.isActive && (
                          <Button 
                            size="sm" 
                            onClick={() => activateConnection(connection.id)}
                            disabled={isConnecting}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Ativar
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => editConnection(connection)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => deleteConnection(connection.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Database Status */}
          {activeConnection && (
            <Card>
              <CardHeader>
                <CardTitle>Banco Ativo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div>
                      <h4 className="">{activeConnection.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {activeConnection.type === 'supabase'
                          ? `${activeConnection.type.toUpperCase()} • ${activeConnection.url}`
                          : `${activeConnection.type.toUpperCase()} • ${activeConnection.host}:${activeConnection.port} • ${activeConnection.database}`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Último uso: {new Date(activeConnection.lastUsed || activeConnection.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar URL
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSetupModal(true)}
                    >
                      <Database className="h-4 w-4 mr-1" />
                      Setup Banco
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Configurar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
} 