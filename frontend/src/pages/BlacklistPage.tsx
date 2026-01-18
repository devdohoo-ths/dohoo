import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Eye, 
  EyeOff, 
  Phone, 
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeaders } from '@/utils/apiBase';
import { logger } from '@/utils/logger';

interface BlacklistItem {
  id: string;
  numero_telefone: string;
  motivo: string;
  ativo: boolean;
  criado_em: string;
  criado_por_profile?: {
    name: string;
    email: string;
  };
}

interface BlacklistLog {
  id: string;
  acao: string;
  numero_telefone: string;
  motivo: string;
  criado_em: string;
  usuario_profile?: {
    name: string;
    email: string;
  };
}

const BlacklistPage = () => {
  const { user } = useAuth();
  
  // Debug para verificar se o componente está sendo renderizado
  console.log('🔍 [BLACKLIST] Componente BlacklistPage renderizado');
  logger.debug('🔍 [BLACKLIST] Componente BlacklistPage renderizado');
  
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [logs, setLogs] = useState<BlacklistLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BlacklistItem | null>(null);
  const [newItem, setNewItem] = useState({
    numero_telefone: '',
    motivo: ''
  });

  // ✅ MIGRADO: Usa getAuthHeaders do apiBase

  // Carregar dados da blacklist
  const loadBlacklist = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/blacklist', {
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar blacklist');
      }

      const data = await response.json();
      if (data.success) {
        setBlacklist(data.blacklist);
        logger.info('Blacklist carregada com sucesso');
      } else {
        throw new Error(data.error || 'Erro ao carregar blacklist');
      }
    } catch (error) {
      logger.error('Erro ao carregar blacklist:', error);
      toast.error('Erro ao carregar blacklist');
    } finally {
      setLoading(false);
    }
  };

  // Carregar logs da blacklist
  const loadLogs = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/blacklist/logs', {
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar logs');
      }

      const data = await response.json();
      if (data.success) {
        setLogs(data.logs);
        logger.info('Logs da blacklist carregados com sucesso');
      } else {
        throw new Error(data.error || 'Erro ao carregar logs');
      }
    } catch (error) {
      logger.error('Erro ao carregar logs:', error);
      toast.error('Erro ao carregar logs da blacklist');
    }
  };

  // Adicionar novo item à blacklist
  const handleAddItem = async () => {
    if (!newItem.numero_telefone.trim()) {
      toast.error('Número de telefone é obrigatório');
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/blacklist', {
        method: 'POST',
        headers,
        body: JSON.stringify(newItem)
      });

      if (!response.ok) {
        throw new Error('Erro ao adicionar à blacklist');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Número adicionado à blacklist com sucesso');
        setNewItem({ numero_telefone: '', motivo: '' });
        setIsAddDialogOpen(false);
        loadBlacklist();
        loadLogs();
      } else {
        throw new Error(data.error || 'Erro ao adicionar à blacklist');
      }
    } catch (error) {
      logger.error('Erro ao adicionar à blacklist:', error);
      toast.error(error.message || 'Erro ao adicionar à blacklist');
    }
  };

  // Atualizar item da blacklist
  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/blacklist/${editingItem.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          motivo: editingItem.motivo,
          ativo: editingItem.ativo
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar item');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Item atualizado com sucesso');
        setIsEditDialogOpen(false);
        setEditingItem(null);
        loadBlacklist();
        loadLogs();
      } else {
        throw new Error(data.error || 'Erro ao atualizar item');
      }
    } catch (error) {
      logger.error('Erro ao atualizar item:', error);
      toast.error(error.message || 'Erro ao atualizar item');
    }
  };

  // Remover item da blacklist
  const handleRemoveItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este número da blacklist?')) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/blacklist/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao remover item');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Número removido da blacklist com sucesso');
        loadBlacklist();
        loadLogs();
      } else {
        throw new Error(data.error || 'Erro ao remover item');
      }
    } catch (error) {
      logger.error('Erro ao remover item:', error);
      toast.error(error.message || 'Erro ao remover item');
    }
  };

  // Filtrar blacklist por termo de busca
  const filteredBlacklist = blacklist.filter(item =>
    item.numero_telefone.includes(searchTerm) ||
    item.motivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.criado_por_profile?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Formatar número de telefone
  const formatPhoneNumber = (phone: string) => {
    // Adicionar formatação brasileira se necessário
    if (phone.startsWith('55') && phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  useEffect(() => {
    loadBlacklist();
    loadLogs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando blacklist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-600" />
            Blacklist de Números
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie números bloqueados que não aparecerão em relatórios
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Número
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar à Blacklist</DialogTitle>
              <DialogDescription>
                Adicione um número de telefone que será bloqueado em todo o sistema.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="numero">Número de Telefone</Label>
                <Input
                  id="numero"
                  placeholder="Ex: 5511999999999"
                  value={newItem.numero_telefone}
                  onChange={(e) => setNewItem({ ...newItem, numero_telefone: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="motivo">Motivo (opcional)</Label>
                <Textarea
                  id="motivo"
                  placeholder="Motivo do bloqueio..."
                  value={newItem.motivo}
                  onChange={(e) => setNewItem({ ...newItem, motivo: e.target.value })}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddItem}>
                Adicionar à Blacklist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert de informação */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Números na blacklist não aparecerão em nenhum relatório ou métrica do sistema.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs defaultValue="blacklist" className="space-y-4">
        <TabsList>
          <TabsTrigger value="blacklist" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Blacklist ({blacklist.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Logs ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Blacklist */}
        <TabsContent value="blacklist" className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por número, motivo ou usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabela */}
          <Card>
            <CardHeader>
              <CardTitle>Números Bloqueados</CardTitle>
              <CardDescription>
                Lista de todos os números na blacklist da organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredBlacklist.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum número na blacklist</p>
                  {searchTerm && (
                    <p className="text-sm mt-2">Tente ajustar os termos de busca</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado por</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlacklist.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {formatPhoneNumber(item.numero_telefone)}
                          </div>
                        </TableCell>
                        <TableCell>{item.motivo || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={item.ativo ? "destructive" : "secondary"}>
                            {item.ativo ? (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Bloqueado
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativo
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {item.criado_por_profile?.name || 'Sistema'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {formatDate(item.criado_em)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Histórico de todas as ações realizadas na blacklist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum log encontrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant={
                            log.acao === 'adicionado' ? 'destructive' :
                            log.acao === 'removido' ? 'default' :
                            log.acao === 'ativado' ? 'destructive' : 'secondary'
                          }>
                            {log.acao === 'adicionado' && 'Adicionado'}
                            {log.acao === 'removido' && 'Removido'}
                            {log.acao === 'ativado' && 'Ativado'}
                            {log.acao === 'desativado' && 'Desativado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {formatPhoneNumber(log.numero_telefone)}
                          </div>
                        </TableCell>
                        <TableCell>{log.motivo || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {log.usuario_profile?.name || 'Sistema'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {formatDate(log.criado_em)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Item da Blacklist</DialogTitle>
            <DialogDescription>
              Modifique as informações do número bloqueado.
            </DialogDescription>
          </DialogHeader>
          
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-numero">Número de Telefone</Label>
                <Input
                  id="edit-numero"
                  value={editingItem.numero_telefone}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-motivo">Motivo</Label>
                <Textarea
                  id="edit-motivo"
                  placeholder="Motivo do bloqueio..."
                  value={editingItem.motivo}
                  onChange={(e) => setEditingItem({ ...editingItem, motivo: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-ativo"
                  checked={editingItem.ativo}
                  onChange={(e) => setEditingItem({ ...editingItem, ativo: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="edit-ativo">Ativo (bloqueado)</Label>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateItem}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlacklistPage;
