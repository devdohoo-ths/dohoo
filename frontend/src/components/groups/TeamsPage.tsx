import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTeams } from '../../hooks/useTeams';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { Plus, Search, Users, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useOrganization } from '@/hooks/useOrganization';

// Tipo do time
export interface Team {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_at?: string;
  updated_at?: string;
}

// Tipo da conta
export interface Account {
  id: string;
  name: string;
  phone_number?: string;
  platform: 'whatsapp-unofficial' | 'whatsapp-official' | 'instagram' | 'telegram';
  status: 'active' | 'expired' | 'error' | 'disconnected' | 'connected' | 'connecting';
  user_id: string;
  organization_id: string;
  created_at: string;
}

const TeamsPage: React.FC = () => {
  const { toast } = useToast();
  const { teams, loading, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, getTeamMembers } = useTeams();
  const { organization } = useOrganization();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [tab, setTab] = useState<'dados' | 'contas'>('dados');
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [teamAccounts, setTeamAccounts] = useState<Account[]>([]);
  const [teamAccountCounts, setTeamAccountCounts] = useState<Record<string, number>>({});

  // Buscar todas as contas da organização
  const fetchAllAccounts = async () => {
    if (!organization?.id) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/whatsapp-accounts`, { headers });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.error || 'Erro ao buscar contas');
      const data = (json.accounts || []) as Account[];
      setAllAccounts(data);
    } catch (e) {
      // ✅ REMOVIDO: Fallback Supabase - usar apenas API do backend
      console.error('Erro ao buscar contas:', e);
      setAllAccounts([]);
    }
  };

  // Buscar contagem de contas para cada time
  const fetchTeamAccountCounts = async () => {
    if (!organization?.id) return;

    try {
      // ✅ MIGRADO: Buscar via API do backend (endpoint de teams deve incluir contagem de contas)
      // Por enquanto, usar dados dos times retornados pelo hook useTeams
      // TODO: Criar endpoint específico se necessário: GET /api/teams/:teamId/accounts-count
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams?organization_id=${organization.id}`, { headers });
      
      if (!response.ok) {
        console.error('Erro ao buscar times:', response.statusText);
        return;
      }

      const data = await response.json();
      if (data.success && data.teams) {
        // Extrair contagem de contas se disponível nos dados dos times
        const counts: Record<string, number> = {};
        // Por enquanto, inicializar com 0 - pode ser atualizado quando houver endpoint específico
        data.teams.forEach((team: any) => {
          counts[team.id] = team.accountCount || 0;
        });
        setTeamAccountCounts(counts);
      }
    } catch (error) {
      console.error('Erro ao buscar contagem de contas dos times:', error);
    }
  };

  useEffect(() => {
    fetchAllAccounts();
    fetchTeamAccountCounts();
  }, [organization?.id]);

  // Filtrar contas conectadas e desconectadas
  const connectedAccounts = allAccounts.filter(acc => 
    acc.status === 'connected' || 
    acc.status === 'active'
  );
  const disconnectedAccounts = allAccounts.filter(acc => 
    acc.status !== 'connected' && 
    acc.status !== 'active'
  );

  // Abrir modal para novo ou editar
  const openModal = async (team?: Team) => {
    if (team) {
      setEditing(team);
      setForm({
        name: team.name,
        description: team.description || '',
      });
      // Carregar contas do time
      await loadTeamAccounts(team.id);
    } else {
      setEditing(null);
      setForm({ name: '', description: '' });
      setTeamAccounts([]);
    }
    setTab('dados');
    setSelectedAccountIds([]);
    setModalOpen(true);
  };

  // Carregar contas do time via API do backend
  const loadTeamAccounts = async (teamId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/teams/${teamId}/accounts`, {
        headers
      });

      if (!response.ok) {
        console.error('Erro ao carregar contas do time:', response.status);
        setTeamAccounts([]);
        return;
      }

      const result = await response.json();
      const accounts = result.accounts || result.data || [];
      setTeamAccounts(accounts);
    } catch (error) {
      console.error('Erro ao carregar contas do time:', error);
      setTeamAccounts([]);
    }
  };

  // Salvar time
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    
    try {
      if (editing) {
        const success = await updateTeam(editing.id, form);
        if (success) {
          // Salvar contas do time
          await saveTeamAccounts(editing.id);
          setModalOpen(false);
        }
      } else {
        const newTeam = await createTeam(form);
        if (newTeam) {
          // Salvar contas do time
          await saveTeamAccounts(newTeam.id);
          setModalOpen(false);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar time:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar time',
        variant: 'destructive'
      });
    }
  };

  // Salvar contas do time via API do backend
  const saveTeamAccounts = async (teamId: string) => {
    try {
      const headers = await getAuthHeaders();
      const accountIds = teamAccounts.map(account => account.id);
      
      const response = await fetch(`${apiBase}/api/teams/${teamId}/accounts`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account_ids: accountIds })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao salvar contas: ${response.status}`);
      }

      // Atualizar contagem de contas
      await fetchTeamAccountCounts();
    } catch (error) {
      console.error('Erro ao salvar contas do time:', error);
      throw error;
    }
  };

  // Excluir time
  const handleDelete = async (team: Team) => {
    if (!window.confirm(`Excluir time "${team.name}"?`)) return;
    await deleteTeam(team.id);
  };

  // Adicionar contas selecionadas ao time
  const handleAddSelectedAccounts = () => {
    if (selectedAccountIds.length === 0) {
      toast({ title: 'Selecione pelo menos uma conta', variant: 'destructive' });
      return;
    }

    const accountsToAdd = connectedAccounts.filter(acc => 
      selectedAccountIds.includes(acc.id) && 
      !teamAccounts.some(teamAcc => teamAcc.id === acc.id)
    );

    setTeamAccounts(prev => [...prev, ...accountsToAdd]);
    setSelectedAccountIds([]);
    
    toast({ 
      title: 'Contas adicionadas', 
      description: `${accountsToAdd.length} conta(s) adicionada(s) ao time` 
    });
  };

  // Remover conta do time
  const handleRemoveAccount = async (accountId: string) => {
    if (!editing?.id) {
      toast({ title: 'Erro', description: 'Time não selecionado', variant: 'destructive' });
      return;
    }

    try {
      console.log('🔍 [TeamsPage] Removendo conta do time:', { teamId: editing.id, accountId });
      
      // 🎯 CORREÇÃO: Chamar a API para remover do banco
      const success = await removeTeamMember(editing.id, accountId);
      
      if (success) {
        // Atualizar lista local após sucesso na API
        setTeamAccounts(prev => prev.filter(acc => acc.id !== accountId));
        
        // Atualizar contagem de contas
        await fetchTeamAccountCounts();
        
        toast({ 
          title: 'Sucesso', 
          description: 'Conta removida do time com sucesso!' 
        });
      } else {
        toast({ 
          title: 'Erro', 
          description: 'Falha ao remover conta do time', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('❌ [TeamsPage] Erro ao remover conta do time:', error);
      toast({ 
        title: 'Erro', 
        description: 'Erro ao remover conta do time', 
        variant: 'destructive' 
      });
    }
  };

  // Filtro de busca
  const filtered = teams.filter((t: Team) => t.name.toLowerCase().includes(search.toLowerCase()));

  // Filtrar contas conectadas que ainda não foram adicionadas ao time
  const availableConnectedAccounts = connectedAccounts.filter(acc => 
    !teamAccounts.some(teamAcc => teamAcc.id === acc.id)
  );

  return (
    <AuthGuard>
      <PermissionGuard requiredPermissions={['manage_teams']}>
        <div className="max-w-7xl mx-auto w-full py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-primary" />
              <h1 className="text-3xl tracking-tight">Times</h1>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">{teams.length}</span>
            </div>
            <Button onClick={() => openModal()} className="gap-2" variant="default">
              <Plus className="h-4 w-4" /> Novo Time
            </Button>
          </div>
          
          <div className="mb-4">
            <Input
              placeholder="Buscar time..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-md"
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Contas</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum time encontrado
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((team: Team) => (
                  <TableRow key={team.id}>
                    <TableCell className="">{team.name}</TableCell>
                    <TableCell>{team.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-full px-2">
                        {teamAccountCounts[team.id] || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>{team.created_at ? new Date(team.created_at).toLocaleString() : '-'}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openModal(team)} title="Editar">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(team)} title="Excluir">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Modal de criar/editar */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Time' : 'Novo Time'}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <Tabs value={tab} onValueChange={(v: string) => setTab(v as 'dados' | 'contas')}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="dados">Dados</TabsTrigger>
                    <TabsTrigger value="contas">Contas</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="dados">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">Nome</Label>
                          <Input
                            id="name"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            autoFocus
                            required
                            maxLength={60}
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Descrição</Label>
                          <Input
                            id="description"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            maxLength={120}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="contas">
                    <div className="space-y-6">
                      {/* Seção de Contas Conectadas */}
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                          <div>
                            <Label className="block text-green-700">Contas Conectadas</Label>
                            <p className="text-sm text-muted-foreground">Selecione as contas que deseja adicionar ao time</p>
                          </div>
                          <Button
                            onClick={handleAddSelectedAccounts}
                            disabled={selectedAccountIds.length === 0}
                            className="gap-2 w-full sm:w-auto"
                          >
                            <Plus className="h-4 w-4" />
                            Adicionar Selecionadas ({selectedAccountIds.length})
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                          {availableConnectedAccounts.map(account => (
                            <div key={account.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                              <Checkbox
                                id={account.id}
                                checked={selectedAccountIds.includes(account.id)}
                                onCheckedChange={(checked: boolean) => {
                                  if (checked) {
                                    setSelectedAccountIds(prev => [...prev, account.id]);
                                  } else {
                                    setSelectedAccountIds(prev => prev.filter(id => id !== account.id));
                                  }
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="truncate">{account.name}</span>
                                  <Badge variant="outline" className="text-xs flex-shrink-0">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Conectada
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {account.phone_number ? `📱 ${account.phone_number}` : '📱 Número não informado'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Criada em {new Date(account.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                          {availableConnectedAccounts.length === 0 && (
                            <div className="col-span-full text-center py-8 text-muted-foreground">
                              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                              <p>Nenhuma conta conectada disponível para adicionar</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Seção de Contas Desconectadas (apenas visualização) */}
                      {disconnectedAccounts.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Label className="block text-red-700">Contas Desconectadas</Label>
                            <Badge variant="outline" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Não disponíveis para adição
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                            {disconnectedAccounts.map(account => (
                              <div key={account.id} className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-gray-500 truncate">{account.name}</span>
                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      {account.status}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {account.phone_number ? `📱 ${account.phone_number}` : '📱 Número não informado'}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Conecte a conta para adicioná-la ao time
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Seção de Contas do Time */}
                      <div>
                        <Label className="block mb-4">Contas do Time ({teamAccounts.length})</Label>
                        {teamAccounts.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Users className="w-8 h-8 mx-auto mb-2" />
                            <p>Nenhuma conta adicionada ao time</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {teamAccounts.map(account => (
                              <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="truncate">{account.name}</span>
                                      <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">
                                        Conectada
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                      {account.phone_number ? `📱 ${account.phone_number}` : '📱 Número não informado'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAccount(account.id)}
                                  className="text-red-600 hover:text-red-700 flex-shrink-0"
                                >
                                  <AlertCircle className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
                <Button onClick={handleSave} loading={loading} type="button">
                  {editing ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PermissionGuard>
    </AuthGuard>
  );
};

export default TeamsPage; 