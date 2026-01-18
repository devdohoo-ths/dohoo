import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Search, Filter } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Crown } from 'lucide-react';
import { getAuthHeaders } from '@/utils/apiBase';

interface StatusChange {
  id: string;
  account_id: string;
  account_name: string;
  organization_id: string;
  old_status: string;
  new_status: string;
  reason: string;
  metadata: any;
  created_at: string;
}

interface Statistics {
  total: number;
  byStatus: Record<string, number>;
  byReason: Record<string, number>;
  regressions: number;
  connections: number;
  disconnections: number;
  errors: number;
}

const WhatsAppAuditPage: React.FC = () => {
  // ✅ DEBUG: Log quando componente é montado
  console.log('🔍 [WHATSAPP_AUDIT] Componente WhatsAppAuditPage montado');
  
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [days, setDays] = useState(7);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchAccount, setSearchAccount] = useState('');

  // ✅ DEBUG: Log para verificar se o componente está sendo renderizado
  React.useEffect(() => {
    console.log('🔍 [WHATSAPP_AUDIT] Componente renderizado:', {
      profile,
      rolesName: profile?.roles?.name,
      userRole: profile?.user_role,
      roleId: profile?.role_id
    });
  }, [profile]);

  // Verificar se é super admin
  const userLevel = React.useMemo(() => {
    if (!profile?.roles?.name) {
      console.log('⚠️ [WHATSAPP_AUDIT] Profile sem roles.name, retornando agent');
      return 'agent';
    }
    const roleName = profile.roles.name;
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    const level = roleMapping[roleName as keyof typeof roleMapping] || 'agent';
    console.log('🔍 [WHATSAPP_AUDIT] User level calculado:', { roleName, level });
    return level;
  }, [profile]);

  const isSuperAdmin = userLevel === 'super_admin';
  
  console.log('🔍 [WHATSAPP_AUDIT] isSuperAdmin:', isSuperAdmin);

  useEffect(() => {
    console.log('🔍 [WHATSAPP_AUDIT] useEffect executado:', { isSuperAdmin, page, days, filterStatus });
    if (isSuperAdmin) {
      fetchData();
      fetchStatistics();
    } else {
      console.log('⚠️ [WHATSAPP_AUDIT] Não é super admin, não buscando dados');
    }
  }, [isSuperAdmin, page, days, filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        days: days.toString()
      });

      if (filterStatus) {
        params.append('status', filterStatus);
      }

      if (searchAccount) {
        params.append('accountId', searchAccount);
      }

      const response = await fetch(`/api/whatsapp-audit/status-changes?${params.toString()}`, {
        headers
      });

      const data = await response.json();

      if (data.success) {
        setStatusChanges(data.data);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Erro ao buscar mudanças de status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ days: days.toString() });
      
      const response = await fetch(`/api/whatsapp-audit/statistics?${params.toString()}`, {
        headers
      });

      const data = await response.json();

      if (data.success) {
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      connected: 'bg-green-100 text-green-800',
      connecting: 'bg-yellow-100 text-yellow-800',
      disconnected: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getChangeType = (oldStatus: string, newStatus: string) => {
    if (oldStatus === 'connected' && newStatus === 'connecting') {
      return { icon: AlertTriangle, color: 'text-red-600', label: '⚠️ Regressão' };
    }
    if (oldStatus === 'connecting' && newStatus === 'connected') {
      return { icon: TrendingUp, color: 'text-green-600', label: '✅ Conexão' };
    }
    if (newStatus === 'disconnected') {
      return { icon: TrendingDown, color: 'text-gray-600', label: '🔌 Desconexão' };
    }
    if (newStatus === 'error') {
      return { icon: AlertTriangle, color: 'text-red-600', label: '❌ Erro' };
    }
    return { icon: Activity, color: 'text-blue-600', label: '🔄 Mudança' };
  };

  // ✅ NÃO redirecionar - apenas mostrar mensagem de acesso negado
  // O componente deve ser renderizado mesmo sem permissão para não causar redirecionamento
  if (!isSuperAdmin) {
    console.log('❌ [WHATSAPP_AUDIT] Acesso negado - não é Super Admin');
    return (
      <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
        <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl text-red-600 mb-4">Acesso Negado</h1>
            <p className="text-gray-600 mb-2">
              Você não tem permissão para acessar a Auditoria de Status WhatsApp.
            </p>
            <p className="text-sm text-gray-500">
              Apenas Super Administradores podem acessar esta área.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <span>Seu nível: {userLevel === 'super_admin' ? 'Super Admin' : userLevel === 'admin' ? 'Admin' : 'Usuário'}</span>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              <p>Debug: profile?.roles?.name = {profile?.roles?.name || 'undefined'}</p>
              <p>Debug: userLevel = {userLevel}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 sm:p-8 bg-white">
      <div className="max-w-7xl mx-auto pt-8 sm:pt-16">
        {/* Header */}
        <div className="mb-6 border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl flex items-center gap-2">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                Auditoria de Status WhatsApp
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Monitore e analise mudanças de status das contas WhatsApp
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Crown className="w-4 h-4 text-yellow-500" />
              <span>Super Admin</span>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Período (dias)</label>
                <select
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value={1}>Últimas 24 horas</option>
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Todos</option>
                  <option value="connected">Conectado</option>
                  <option value="connecting">Conectando</option>
                  <option value="disconnected">Desconectado</option>
                  <option value="error">Erro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Buscar Conta</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchAccount}
                    onChange={(e) => setSearchAccount(e.target.value)}
                    placeholder="ID da conta..."
                    className="flex-1 px-3 py-2 border rounded-md"
                  />
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total de Mudanças</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.total}</div>
              </CardContent>
            </Card>
            <Card className={statistics.regressions > 0 ? 'border-red-200 bg-red-50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Regressões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{statistics.regressions}</div>
                <p className="text-xs text-muted-foreground mt-1">connected → connecting</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Conexões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{statistics.connections}</div>
                <p className="text-xs text-muted-foreground mt-1">connecting → connected</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Desconexões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{statistics.disconnections}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Mudanças */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Histórico de Mudanças</CardTitle>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">Carregando...</p>
              </div>
            ) : statusChanges.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Nenhuma mudança encontrada no período selecionado</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Data/Hora</th>
                        <th className="text-left p-2">Conta</th>
                        <th className="text-left p-2">Mudança</th>
                        <th className="text-left p-2">Motivo</th>
                        <th className="text-left p-2">Status Anterior</th>
                        <th className="text-left p-2">Status Novo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusChanges.map((change) => {
                        const changeType = getChangeType(change.old_status, change.new_status);
                        const ChangeIcon = changeType.icon;
                        return (
                          <tr key={change.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              {new Date(change.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-2">
                              <div className="font-medium">{change.account_name || change.account_id}</div>
                              <div className="text-xs text-gray-500">{change.account_id}</div>
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <ChangeIcon className={`w-4 h-4 ${changeType.color}`} />
                                <span className={changeType.color}>{changeType.label}</span>
                              </div>
                            </td>
                            <td className="p-2">
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {change.reason || 'N/A'}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(change.old_status || 'N/A')}`}>
                                {change.old_status || 'N/A'}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(change.new_status)}`}>
                                {change.new_status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border rounded-md disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-gray-600">
                      Página {page} de {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border rounded-md disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppAuditPage;

