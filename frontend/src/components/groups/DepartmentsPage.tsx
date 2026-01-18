import React, { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { Plus, Edit, Trash2, Search, Users, Building2, UserPlus, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from '@/components/ui/command';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// Tipo do departamento
export interface Department {
  id: string;
  name: string;
  description?: string;
  delivery_strategy?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentMember {
  id: string;
  user_id: string;
  department_id: string;
  role: string;
  created_at: string;
  profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  user_role?: string;
  department?: string;
}

const DELIVERY_STRATEGIES = [
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'broadcast', label: 'Todos recebem' },
];

const DepartmentsPage: React.FC = () => {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '', delivery_strategy: 'round_robin' });
  const [tab, setTab] = useState<'dados' | 'membros'>('dados');
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/departments/list`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch departments: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      setDepartments(result.departments || result.data || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao buscar departamentos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Buscar membros do departamento
  const fetchMembers = async (departmentId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/departments/${departmentId}/members`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const result = await response.json();
        setMembers(result.members || result.data || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  // Buscar todos os usuários
  const fetchAllUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const result = await response.json();
        const users = result.users || result.data || [];
        // Mapear para o formato esperado
        setAllUsers(users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          user_role: user.user_role,
          department: user.department
        })));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchAllUsers();
  }, []);

  // Abrir modal para novo ou editar
  const openModal = async (dept?: Department) => {
    if (dept) {
      setEditing(dept);
      setForm({
        name: dept.name,
        description: dept.description || '',
        delivery_strategy: dept.delivery_strategy || 'round_robin',
      });
      await fetchMembers(dept.id);
    } else {
      setEditing(null);
      setForm({ name: '', description: '', delivery_strategy: 'round_robin' });
      setMembers([]);
    }
    setTab('dados');
    setModalOpen(true);
  };

  // Salvar departamento
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const url = editing ? `${apiBase}/api/departments/${editing.id}` : `${apiBase}/api/departments`;
      const method = editing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          delivery_strategy: form.delivery_strategy
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to ${editing ? 'update' : 'create'} department: ${response.statusText} - ${errorText}`);
      }

      toast({ title: `Departamento ${editing ? 'atualizado' : 'criado'}` });
      fetchDepartments();
      setModalOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || `Erro ao ${editing ? 'atualizar' : 'criar'} departamento`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Excluir departamento
  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`Excluir departamento "${dept.name}"?`)) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/departments/${dept.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete department: ${response.statusText} - ${errorText}`);
      }

      toast({ title: 'Departamento excluído' });
      fetchDepartments();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir departamento', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Adicionar membro
  const handleAddMember = async (user: UserProfile) => {
    setAddingUser(true);
    if (!editing) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/departments/${editing.id}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: user.id })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add member: ${response.statusText} - ${errorText}`);
      }

      toast({ title: 'Membro adicionado' });
      fetchMembers(editing.id);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao adicionar membro', variant: 'destructive' });
    } finally {
      setAddingUser(false);
    }
  };

  // Remover membro
  const handleRemoveMember = async (member: DepartmentMember) => {
    if (!editing) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/departments/${editing.id}/members/${member.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to remove member: ${response.statusText} - ${errorText}`);
      }

      toast({ title: 'Membro removido' });
      fetchMembers(editing.id);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao remover membro', variant: 'destructive' });
    }
  };

  // Filtro de busca
  const filtered = departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  // Adicionar função handleRemoveMemberByUserId
  const handleRemoveMemberByUserId = (userId: string) => {
    const member = members.find(m => m.user_id === userId);
    if (member) handleRemoveMember(member);
  };

  return (
    <PermissionGuard requiredPermissions={['manage_departments']}>
      <div className="max-w-7xl mx-auto w-full py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-7 w-7 text-primary" />
            <h1 className="text-3xl tracking-tight">Departamentos</h1>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">{departments.length}</span>
          </div>
          <Button onClick={() => openModal()} className="gap-2" variant="default">
            <Plus className="h-4 w-4" /> Novo Departamento
          </Button>
        </div>
        <div className="mb-4">
          <Input
            placeholder="Buscar departamento..."
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
                <TableHead>Estratégia</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum departamento encontrado
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(dept => (
                <TableRow key={dept.id}>
                  <TableCell className="">{dept.name}</TableCell>
                  <TableCell>{dept.description || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-muted/60 text-foreground">
                      {DELIVERY_STRATEGIES.find(s => s.value === dept.delivery_strategy)?.label || dept.delivery_strategy}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-full px-2">
                      {dept.department_members ? dept.department_members.length : '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>{dept.created_at ? new Date(dept.created_at).toLocaleString() : '-'}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => openModal(dept)} title="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(dept)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Modal de criar/editar */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl p-0 sm:p-0">
            <DialogHeader className="border-b px-6 pt-6 pb-2">
              <DialogTitle className="text-lg">{editing ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
            </DialogHeader>
            <div className="px-6 pt-6 pb-2">
              <Tabs value={tab} onValueChange={v => setTab(v as any)} className="mt-2">
                <TabsList className="mb-4">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="membros">Membros</TabsTrigger>
                </TabsList>
                <TabsContent value="dados">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="delivery_strategy">Estratégia de Entrega</Label>
                        <Select
                          value={form.delivery_strategy}
                          onValueChange={v => setForm(f => ({ ...f, delivery_strategy: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DELIVERY_STRATEGIES.map(strategy => (
                              <SelectItem key={strategy.value} value={strategy.value}>
                                {strategy.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
                    <Button onClick={handleSave} loading={loading} type="button">
                      {editing ? 'Salvar' : 'Criar'}
                    </Button>
                  </DialogFooter>
                </TabsContent>
                <TabsContent value="membros">
                  <div className="mb-4 flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="block mb-2">Adicionar membro</Label>
                      <select
                        className="form-select block w-full p-2 border rounded focus:outline-none focus:ring focus:border-primary bg-background text-foreground"
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        aria-label="Selecione um usuário"
                      >
                        <option value="">Selecione um usuário...</option>
                        {allUsers.filter(u => !members.some(m => m.user_id === u.id)).map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-10 mt-6"
                      onClick={() => {
                        const user = allUsers.find(u => u.id === selectedUserId);
                        if (user && !members.some(m => m.user_id === user.id)) {
                          handleAddMember(user);
                          setSelectedUserId('');
                        }
                      }}
                      disabled={!selectedUserId}
                    >
                      Adicionar
                    </Button>
                  </div>
                  {/* Chips dos membros adicionados */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {members.map(member => {
                      const user = allUsers.find(u => u.id === member.user_id);
                      if (!user) return null;
                      return (
                        <Badge key={user.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                          {user.name}
                          <button type="button" onClick={() => handleRemoveMemberByUserId(user.id)} className="ml-1">
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
};

export default DepartmentsPage; 