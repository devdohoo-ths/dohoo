import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// ✅ MIGRADO: Usa getAuthHeaders do apiBase (importado acima)

const CDRPage = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [configOptions, setConfigOptions] = useState<any[]>([]);

  // Estados para formulários
  const [configForm, setConfigForm] = useState({
    account_id: '',
    name: '',
    welcome_message: '',
    distribution_mode: 'sequential'
  });

  const [optionForm, setOptionForm] = useState({
    option_number: '',
    option_text: '',
    group_id: ''
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    // Verificar se organization_id está disponível antes de fazer queries
    if (!profile?.organization_id) {
      console.warn('⚠️ [CDR] organization_id não disponível, pulando carregamento de dados');
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      
      // Carregar configurações via API do backend
      const configsResponse = await fetch(`${apiBase}/api/cdr/configs?organization_id=${profile.organization_id}`, {
        headers
      });

      if (!configsResponse.ok) {
        throw new Error(`Erro ao carregar configurações: ${configsResponse.status}`);
      }

      const configsResult = await configsResponse.json();
      const configsData = configsResult.configs || configsResult.data || [];

      // As opções e grupos já vêm junto com as configurações na API
      if (configsData) setConfigs(configsData);

      // Carregar grupos via API do backend
      const groupsResponse = await fetch(`${apiBase}/api/cdr/groups?organization_id=${profile.organization_id}`, {
        headers
      });

      if (!groupsResponse.ok) {
        throw new Error(`Erro ao carregar grupos: ${groupsResponse.status}`);
      }

      const groupsResult = await groupsResponse.json();
      const groupsData = groupsResult.groups || groupsResult.data || [];

      if (groupsData) setGroups(groupsData);

      // Carregar contas WhatsApp via API do backend
      const accountsResponse = await fetch(`${apiBase}/api/whatsapp-accounts?organization_id=${profile.organization_id}&status=connected`, {
        headers
      });

      if (!accountsResponse.ok) {
        throw new Error(`Erro ao carregar contas WhatsApp: ${accountsResponse.status}`);
      }

      const accountsResult = await accountsResponse.json();
      const accountsData = accountsResult.accounts || accountsResult.data || [];

      if (accountsData) setAccounts(accountsData);

      // Carregar usuários via API do backend
      const usersResponse = await fetch(`${apiBase}/api/users?organization_id=${profile.organization_id}`, {
        headers
      });

      if (!usersResponse.ok) {
        throw new Error(`Erro ao carregar usuários: ${usersResponse.status}`);
      }

      const usersResult = await usersResponse.json();
      const usersData = usersResult.users || usersResult.data || [];
      const formattedUsers = usersData.map((u: any) => ({
        id: u.id,
        name: u.name || u.full_name || 'Usuário',
        email: u.email || ''
      }));

      if (formattedUsers) setUsers(formattedUsers);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados do CDR',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createConfig = async () => {
    if (!configForm.account_id || !configForm.name || !configForm.welcome_message) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/cdr/configs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(configForm)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Configuração CDR criada com sucesso'
        });
        setConfigForm({ account_id: '', name: '', welcome_message: '', distribution_mode: 'sequential' });
        loadData();
      } else {
        throw new Error(result.error || 'Erro ao criar configuração');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar configuração CDR',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createOption = async (configId: string) => {
    if (!optionForm.option_number || !optionForm.option_text || !optionForm.group_id) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios (número, texto e grupo)',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/cdr/configs/${configId}/options`, {
        method: 'POST',
        headers,
        body: JSON.stringify(optionForm)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Opção criada com sucesso'
        });
        setOptionForm({ option_number: '', option_text: '', group_id: '' });
        // Recarregar opções
        const headers2 = await getAuthHeaders();
        const response2 = await fetch(`${apiBase}/api/cdr/configs/${configId}/options`, {
          headers: headers2
        });
        const result2 = await response2.json();
        if (result2.success) {
          setConfigOptions(result2.options || []);
        }
      } else {
        throw new Error(result.error || 'Erro ao criar opção');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar opção',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async () => {
    if (!groupForm.name) {
      toast({
        title: 'Erro',
        description: 'Preencha o nome do grupo',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/cdr/groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify(groupForm)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Grupo criado com sucesso'
        });
        setGroupForm({ name: '', description: '' });
        loadData();
      } else {
        throw new Error(result.error || 'Erro ao criar grupo');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar grupo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const addUserToGroup = async (groupId: string, userId: string, phoneNumber?: string) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/cdr/groups/${groupId}/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, phone_number: phoneNumber })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Usuário adicionado ao grupo'
        });
        loadData();
      } else {
        throw new Error(result.error || 'Erro ao adicionar usuário');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar usuário ao grupo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const removeUserFromGroup = async (groupId: string, userId: string) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/cdr/groups/${groupId}/users/${userId}`, {
        method: 'DELETE',
        headers
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Usuário removido do grupo'
        });
        loadData();
      } else {
        throw new Error(result.error || 'Erro ao remover usuário');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover usuário do grupo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CDR - Conexão Direta ao Responsável</h1>
          <p className="text-gray-600 mt-2">Configure sua URA (Unidade de Resposta Audível) para WhatsApp</p>
        </div>
      </div>

      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs">Configurações</TabsTrigger>
          <TabsTrigger value="groups">Grupos</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nova Configuração CDR</CardTitle>
              <CardDescription>Crie uma nova configuração CDR para um número tronco</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Número Tronco (Conta WhatsApp)</Label>
                  <Select
                    value={configForm.account_id}
                    onValueChange={(value) => setConfigForm({ ...configForm, account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id}>
                          {account.name} - {account.phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome da Configuração</Label>
                  <Input
                    value={configForm.name}
                    onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                    placeholder="Ex: Atendimento Geral"
                  />
                </div>
              </div>
              <div>
                <Label>Mensagem de Boas-vindas</Label>
                <Textarea
                  value={configForm.welcome_message}
                  onChange={(e) => setConfigForm({ ...configForm, welcome_message: e.target.value })}
                  placeholder="Olá! Bem-vindo ao nosso atendimento..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Modo de Distribuição</Label>
                <Select
                  value={configForm.distribution_mode}
                  onValueChange={(value) => setConfigForm({ ...configForm, distribution_mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequencial</SelectItem>
                    <SelectItem value="random">Aleatório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createConfig} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Configuração
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {configs.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{config.name}</CardTitle>
                      <CardDescription>
                        {config.whatsapp_accounts?.name} - {config.whatsapp_accounts?.phone_number}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setSelectedConfig(config);
                          // Carregar opções da configuração
                          try {
                            const headers = await getAuthHeaders();
                            const response = await fetch(`${apiBase}/api/cdr/configs/${config.id}/options`, {
                              headers
                            });
                            const result = await response.json();
                            if (result.success) {
                              setConfigOptions(result.options || []);
                            }
                          } catch (error) {
                            console.error('Erro ao carregar opções:', error);
                          }
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar Opções
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm"><strong>Mensagem:</strong> {config.welcome_message}</p>
                      <p className="text-sm"><strong>Distribuição:</strong> {config.distribution_mode === 'sequential' ? 'Sequencial' : 'Aleatório'}</p>
                      <p className="text-sm"><strong>Status:</strong> {config.active ? 'Ativo' : 'Inativo'}</p>
                    </div>
                    {config.cdr_options && config.cdr_options.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-semibold mb-2">Opções configuradas:</p>
                        <div className="space-y-1">
                          {config.cdr_options.map((option: any) => (
                            <div key={option.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <span><strong>{option.option_number}</strong> - {option.option_text}</span>
                              {option.cdr_groups && (
                                <span className="text-xs text-blue-600">→ {option.cdr_groups.name}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Novo Grupo</CardTitle>
              <CardDescription>Crie um grupo de usuários que receberão os ativos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do Grupo</Label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ex: Equipe de Vendas"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="Descrição do grupo..."
                  rows={3}
                />
              </div>
              <Button onClick={createGroup} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Grupo
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {groups.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{group.name}</CardTitle>
                      <CardDescription>{group.description}</CardDescription>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar Usuário
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adicionar Usuário ao Grupo</DialogTitle>
                          <DialogDescription>Selecione um usuário para adicionar ao grupo</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Usuário</Label>
                            <Select
                              onValueChange={(userId) => {
                                const user = users.find(u => u.id === userId);
                                addUserToGroup(group.id, userId, user?.phone);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um usuário" />
                              </SelectTrigger>
                              <SelectContent>
                                {users
                                  .filter(u => !group.cdr_group_users?.some((gu: any) => gu.user_id === u.id))
                                  .map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.name} ({user.email})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Usuários no grupo:</p>
                    {group.cdr_group_users && group.cdr_group_users.length > 0 ? (
                      <div className="space-y-2">
                        {group.cdr_group_users.map((gu: any) => (
                          <div key={gu.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span>{gu.profiles?.name || gu.profiles?.email}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeUserFromGroup(group.id, gu.user_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum usuário no grupo</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar opções */}
      {selectedConfig && (
        <Dialog open={!!selectedConfig} onOpenChange={() => {
          setSelectedConfig(null);
          setConfigOptions([]);
          setOptionForm({ option_number: '', option_text: '', group_id: '' });
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Opções do Menu - {selectedConfig.name}</DialogTitle>
              <DialogDescription>
                Configure as opções do menu CDR. Quando o cliente escolher uma opção, um ativo será enviado para o grupo selecionado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Lista de opções existentes */}
              {configOptions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Opções configuradas:</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const headers = await getAuthHeaders();
                          const response = await fetch(`${apiBase}/api/cdr/configs/${selectedConfig.id}/options`, {
                            headers
                          });
                          const result = await response.json();
                          if (result.success) {
                            setConfigOptions(result.options || []);
                          }
                        } catch (error) {
                          console.error('Erro ao recarregar opções:', error);
                        }
                      }}
                    >
                      Atualizar
                    </Button>
                  </div>
                  <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                    {configOptions.map((option) => (
                      <div key={option.id} className="flex items-center justify-between p-3 bg-white rounded border">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-blue-600">{option.option_number}</span>
                            <span className="text-sm">{option.option_text}</span>
                          </div>
                          {option.cdr_groups ? (
                            <div className="mt-1 text-xs text-gray-600">
                              → Direciona para: <span className="font-semibold text-blue-600">{option.cdr_groups.name}</span>
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-yellow-600">
                              ⚠️ Nenhum grupo configurado
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (confirm('Tem certeza que deseja excluir esta opção?')) {
                              try {
                                const headers = await getAuthHeaders();
                                const response = await fetch(`${apiBase}/api/cdr/options/${option.id}`, {
                                  method: 'DELETE',
                                  headers
                                });
                                const result = await response.json();
                                if (result.success) {
                                  toast({
                                    title: 'Sucesso',
                                    description: 'Opção removida com sucesso'
                                  });
                                  // Recarregar opções
                                  const headers2 = await getAuthHeaders();
                                  const response2 = await fetch(`${apiBase}/api/cdr/configs/${selectedConfig.id}/options`, {
                                    headers: headers2
                                  });
                                  const result2 = await response2.json();
                                  if (result2.success) {
                                    setConfigOptions(result2.options || []);
                                  }
                                }
                              } catch (error: any) {
                                toast({
                                  title: 'Erro',
                                  description: error.message || 'Erro ao remover opção',
                                  variant: 'destructive'
                                });
                              }
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulário para adicionar nova opção */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-4">Adicionar nova opção:</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Número da Opção *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={optionForm.option_number}
                        onChange={(e) => setOptionForm({ ...optionForm, option_number: e.target.value })}
                        placeholder="Ex: 1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Número que o cliente digitará</p>
                    </div>
                    <div className="col-span-2">
                      <Label>Texto da Opção *</Label>
                      <Input
                        value={optionForm.option_text}
                        onChange={(e) => setOptionForm({ ...optionForm, option_text: e.target.value })}
                        placeholder="Ex: Falar com atendente de vendas"
                      />
                      <p className="text-xs text-gray-500 mt-1">Texto exibido no menu</p>
                    </div>
                  </div>
                  <div>
                    <Label>Grupo de Destino *</Label>
                    <Select
                      value={optionForm.group_id}
                      onValueChange={(value) => setOptionForm({ ...optionForm, group_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um grupo que receberá o ativo" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.length === 0 ? (
                          <SelectItem value="" disabled>Crie um grupo primeiro na aba "Grupos"</SelectItem>
                        ) : (
                          groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} {group.cdr_group_users && `(${group.cdr_group_users.length} usuários)`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Quando o cliente escolher esta opção, os usuários deste grupo receberão um ativo
                    </p>
                  </div>
                  <Button
                    onClick={() => createOption(selectedConfig.id)}
                    disabled={loading || !optionForm.option_number || !optionForm.option_text || !optionForm.group_id}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Opção
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CDRPage;

