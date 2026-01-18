import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ CORRIGIDO: Adicionar getAuthHeaders
import { 
  Database, 
  Plus, 
  TestTube, 
  Trash2, 
  RefreshCw, 
  Copy, 
  Download, 
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Settings,
  Activity
} from 'lucide-react';

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'supabase' | 'postgresql';
  url?: string;
  service_role_key?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  status: 'connected' | 'disconnected' | 'error';
  lastTested?: string;
}

interface Migration {
  filename: string;
  description: string;
  size: number;
  lastModified: string;
}

interface DatabaseStatus {
  totalConnections: number;
  activeConnections: number;
  errorConnections: number;
  lastUpdated: string;
}

export default function DatabaseManager() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    type: 'supabase' as 'supabase' | 'postgresql',
    url: '',
    service_role_key: '',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: ''
  });
  const { toast } = useToast();

  // Carregar dados iniciais
  useEffect(() => {
    loadConnections();
    loadMigrations();
    loadStatus();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/database/connections`, {
        headers
      });
      const data = await response.json();
      if (data.success) {
        setConnections(data.connections);
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar conexões de banco de dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMigrations = async () => {
    try {
      console.log('📦 Carregando migrações...');
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/database/migrations`, {
        headers
      });
      console.log('📋 Status da resposta de migrações:', response.status);
      const data = await response.json();
      console.log('📋 Dados das migrações:', data);
      if (data.success) {
        setMigrations(data.migrations);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar migrações:', error);
    }
  };

  const loadStatus = async () => {
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/database/status`, {
        headers
      });
      const data = await response.json();
      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  };

  const addConnection = async () => {
    try {
      setLoading(true);
      
      // Preparar dados baseados no tipo de conexão
      let connectionData;
      
      if (newConnection.type === 'supabase') {
        connectionData = {
          name: newConnection.name,
          type: newConnection.type,
          url: newConnection.url,
          service_role_key: newConnection.service_role_key
        };
      } else {
        connectionData = {
          name: newConnection.name,
          type: newConnection.type,
          host: newConnection.host,
          port: newConnection.port,
          database: newConnection.database,
          username: newConnection.username,
          password: newConnection.password
        };
      }
      
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/database/connections`, {
        method: 'POST',
        headers,
        body: JSON.stringify(connectionData)
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Conexão adicionada com sucesso",
        });
        setShowAddConnection(false);
        setNewConnection({
          name: '',
          type: 'supabase',
          url: '',
          service_role_key: '',
          host: '',
          port: 5432,
          database: '',
          username: '',
          password: ''
        });
        loadConnections();
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao adicionar conexão",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao adicionar conexão",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (id: string) => {
    try {
      toast({
        title: "Aviso",
        description: "Para testar uma conexão existente, edite-a primeiro para inserir as credenciais novamente.",
        variant: "default"
      });
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao testar conexão",
        variant: "destructive"
      });
    }
  };

  const testNewConnection = async () => {
    try {
      setTesting(true);
      
      // Preparar dados baseados no tipo de conexão
      let testData;
      
      if (newConnection.type === 'supabase') {
        testData = {
          type: newConnection.type,
          url: newConnection.url,
          service_role_key: newConnection.service_role_key
        };
      } else {
        testData = {
          type: newConnection.type,
          host: newConnection.host,
          port: newConnection.port,
          database: newConnection.database,
          username: newConnection.username,
          password: newConnection.password
        };
      }

      console.log('🧪 Dados sendo enviados para teste:', testData);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/database/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testData)
      });
      
      console.log('📋 Status da resposta:', response.status);
      const data = await response.json();
      console.log('📋 Dados da resposta:', data);
      
      if (data.success) {
        toast({
          title: "Teste de Conexão",
          description: data.message || "Conexão funcionando!",
          variant: "default"
        });
      } else {
        toast({
          title: "Erro no Teste",
          description: data.error || data.message || "Falha no teste de conexão",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao testar conexão",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const deleteConnection = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta conexão?')) return;
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/database/connections/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Conexão removida com sucesso",
        });
        loadConnections();
      }
    } catch (error) {
      console.error('Erro ao remover conexão:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover conexão",
        variant: "destructive"
      });
    }
  };

  const executeMigration = async (connectionId: string, migrationFile: string) => {
    if (!confirm(`Executar migração ${migrationFile}?`)) return;
    
    try {
      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/database/migrations/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ connectionId, migrationFile })
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Migração Executada",
          description: data.result.success ? "Migração executada com sucesso!" : data.result.error,
          variant: data.result.success ? "default" : "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao executar migração:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar migração",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-100 text-green-800">Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="secondary">Não Testado</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Gerenciador de Banco de Dados</h1>
          <p className="text-muted-foreground">
            Configure e gerencie suas conexões de banco de dados
          </p>
        </div>
        <Button onClick={() => setShowAddConnection(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conexão
        </Button>
      </div>

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Total de Conexões</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{status.totalConnections}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Conexões Ativas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-green-600">{status.activeConnections}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Conexões com Erro</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-red-600">{status.errorConnections}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Última Atualização</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {new Date(status.lastUpdated).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Conexões</TabsTrigger>
          <TabsTrigger value="migrations">Migrações</TabsTrigger>
          <TabsTrigger value="replication">Replicação</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conexões de Banco de Dados</CardTitle>
              <CardDescription>
                Gerencie suas conexões com diferentes instâncias do Supabase e PostgreSQL
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma conexão configurada</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowAddConnection(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeira Conexão
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {connections.map((connection) => (
                    <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(connection.status)}
                        <div>
                          <h3 className="">{connection.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {connection.type === 'supabase' ? 'Supabase' : 'PostgreSQL'}
                            {connection.url && ` • ${connection.url}`}
                            {connection.host && ` • ${connection.host}:${connection.port}`}
                          </p>
                          {connection.lastTested && (
                            <p className="text-xs text-muted-foreground">
                              Testado em: {new Date(connection.lastTested).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(connection.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testConnection(connection.id)}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
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
        </TabsContent>

        <TabsContent value="migrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Migrações</CardTitle>
              <CardDescription>
                Execute migrações em suas instâncias de banco de dados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {migrations.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma migração encontrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {migrations.map((migration) => (
                    <div key={migration.filename} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="">{migration.filename}</h3>
                        <p className="text-sm text-muted-foreground">{migration.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(migration.size)} • 
                          Modificado em: {new Date(migration.lastModified).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {connections.filter(c => c.status === 'connected').length > 0 ? (
                          <Select onValueChange={(value) => executeMigration(value, migration.filename)}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Executar em..." />
                            </SelectTrigger>
                            <SelectContent>
                              {connections
                                .filter(c => c.status === 'connected')
                                .map((connection) => (
                                  <SelectItem key={connection.id} value={connection.id}>
                                    {connection.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button variant="outline" size="sm" disabled>
                            Nenhuma conexão ativa
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Replicação de Dados</CardTitle>
              <CardDescription>
                Replique dados entre diferentes instâncias de banco de dados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Funcionalidade de replicação em desenvolvimento</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Em breve você poderá replicar dados entre diferentes instâncias
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para adicionar conexão */}
      {showAddConnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl mb-4">Nova Conexão</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Conexão</Label>
                <Input
                  id="name"
                  value={newConnection.name}
                  onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                  placeholder="Ex: Produção Supabase"
                />
              </div>

              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={newConnection.type}
                  onValueChange={(value: 'supabase' | 'postgresql') => 
                    setNewConnection({ ...newConnection, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supabase">Supabase</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newConnection.type === 'supabase' ? (
                <>
                  <div>
                    <Label htmlFor="url">URL do Supabase</Label>
                    <Input
                      id="url"
                      value={newConnection.url}
                      onChange={(e) => setNewConnection({ ...newConnection, url: e.target.value })}
                      placeholder="https://your-project.supabase.co"
                    />
                  </div>
                  <div>
                    <Label htmlFor="service_role_key">Service Role Key</Label>
                    <Input
                      id="service_role_key"
                      type="password"
                      value={newConnection.service_role_key}
                      onChange={(e) => setNewConnection({ ...newConnection, service_role_key: e.target.value })}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      value={newConnection.host}
                      onChange={(e) => setNewConnection({ ...newConnection, host: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      type="number"
                      value={newConnection.port}
                      onChange={(e) => setNewConnection({ ...newConnection, port: parseInt(e.target.value) || 5432 })}
                      placeholder="5432"
                    />
                  </div>
                  <div>
                    <Label htmlFor="database">Banco de Dados</Label>
                    <Input
                      id="database"
                      value={newConnection.database}
                      onChange={(e) => setNewConnection({ ...newConnection, database: e.target.value })}
                      placeholder="nome_do_banco"
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">Usuário</Label>
                    <Input
                      id="username"
                      value={newConnection.username}
                      onChange={(e) => setNewConnection({ ...newConnection, username: e.target.value })}
                      placeholder="postgres"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newConnection.password}
                      onChange={(e) => setNewConnection({ ...newConnection, password: e.target.value })}
                      placeholder="sua_senha"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddConnection(false)}
                disabled={loading || testing}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={testNewConnection}
                disabled={testing || !newConnection.name || 
                  (newConnection.type === 'supabase' && (!newConnection.url || !newConnection.service_role_key)) ||
                  (newConnection.type === 'postgresql' && (!newConnection.host || !newConnection.database || !newConnection.username || !newConnection.password))
                }
              >
                {testing ? 'Testando...' : 'Testar Conexão'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    console.log('🧪 Teste simples do endpoint...');
                    // ✅ CORRIGIDO: Usar getAuthHeaders()
                    const headers = await getAuthHeaders();
                    const response = await fetch(`${apiBase}/api/database/test`, {
                      method: 'GET',
                      headers
                    });
                    const data = await response.json();
                    console.log('📋 Resposta do teste simples:', data);
                    toast({
                      title: "Teste Simples",
                      description: data.message || "Endpoint funcionando!",
                      variant: "default"
                    });
                  } catch (error) {
                    console.error('❌ Erro no teste simples:', error);
                    toast({
                      title: "Erro",
                      description: "Falha no teste simples",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Teste GET
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    console.log(' Teste POST simples...');
                    const testData = {
                      type: 'supabase',
                      url: 'https://test.supabase.co',
                      service_role_key: 'test-key'
                    };
                    // ✅ CORRIGIDO: Usar getAuthHeaders()
                    const headers = await getAuthHeaders();
                    const response = await fetch(`${apiBase}/api/database/test-simple`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify(testData)
                    });
                    const data = await response.json();
                    console.log('📋 Resposta do teste POST simples:', data);
                    toast({
                      title: "Teste POST Simples",
                      description: data.message || "POST funcionando!",
                      variant: "default"
                    });
                  } catch (error) {
                    console.error('❌ Erro no teste POST simples:', error);
                    toast({
                      title: "Erro",
                      description: "Falha no teste POST simples",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Teste POST
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    console.log('🧪 Teste endpoint de migrações...');
                    // ✅ CORRIGIDO: Usar getAuthHeaders()
                    const headers = await getAuthHeaders();
                    const response = await fetch(`${apiBase}/api/database/migrations`, {
                      headers
                    });
                    const data = await response.json();
                    console.log('📋 Resposta do endpoint de migrações:', data);
                    toast({
                      title: "Teste Migrações",
                      description: data.success ? `Encontradas ${data.migrations?.length || 0} migrações` : data.message,
                      variant: data.success ? "default" : "destructive"
                    });
                  } catch (error) {
                    console.error('❌ Erro no teste de migrações:', error);
                    toast({
                      title: "Erro",
                      description: "Falha no teste de migrações",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Teste Migrações
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    console.log('🚀 Executando setup completo...');
                    const testData = {
                      type: newConnection.type,
                      url: newConnection.url,
                      service_role_key: newConnection.service_role_key,
                      host: newConnection.host,
                      port: newConnection.port,
                      database: newConnection.database,
                      username: newConnection.username,
                      password: newConnection.password
                    };
                    // ✅ CORRIGIDO: Usar getAuthHeaders()
                    const headers = await getAuthHeaders();
                    const response = await fetch(`${apiBase}/api/database/setup-complete`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({ connection: testData })
                    });
                    const data = await response.json();
                    console.log('📋 Resposta do setup completo:', data);
                    toast({
                      title: "Setup Completo",
                      description: data.success ? data.message : data.error,
                      variant: data.success ? "default" : "destructive"
                    });
                  } catch (error) {
                    console.error('❌ Erro no setup completo:', error);
                    toast({
                      title: "Erro",
                      description: "Falha no setup completo",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={!newConnection.name || 
                  (newConnection.type === 'supabase' && (!newConnection.url || !newConnection.service_role_key)) ||
                  (newConnection.type === 'postgresql' && (!newConnection.host || !newConnection.database || !newConnection.username || !newConnection.password))
                }
              >
                Setup Completo
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    console.log(' Obtendo SQL da migração...');
                    // ✅ CORRIGIDO: Usar getAuthHeaders()
                    const headers = await getAuthHeaders();
                    const response = await fetch(`${apiBase}/api/database/migration-sql/001_initial_schema.sql`, {
                      headers
                    });
                    const data = await response.json();
                    if (data.success) {
                      console.log(' SQL da migração:', data.sql.substring(0, 200) + '...');
                      // Copiar para clipboard
                      navigator.clipboard.writeText(data.sql);
                      toast({
                        title: "SQL Copiado",
                        description: "SQL da migração copiado para clipboard. Cole no SQL Editor do Supabase!",
                        variant: "default"
                      });
                    } else {
                      toast({
                        title: "Erro",
                        description: data.message,
                        variant: "destructive"
                      });
                    }
                  } catch (error) {
                    console.error('❌ Erro ao obter SQL:', error);
                    toast({
                      title: "Erro",
                      description: "Falha ao obter SQL da migração",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Copiar SQL
              </Button>
              <Button
                onClick={addConnection}
                disabled={loading || testing || !newConnection.name || 
                  (newConnection.type === 'supabase' && (!newConnection.url || !newConnection.service_role_key)) ||
                  (newConnection.type === 'postgresql' && (!newConnection.host || !newConnection.database || !newConnection.username || !newConnection.password))
                }
              >
                {loading ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 