import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAICredits } from '@/hooks/useAICredits';
import { useOrganization } from '@/hooks/useOrganization';
import { Brain, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface UserUsage {
  user_id: string;
  user_name: string;
  user_email: string;
  total_credits_used: number;
  total_tokens_used: number;
  last_usage: string;
}

export const OrganizationCreditsOverview = () => {
  const { credits, tokenUsage, loading } = useAICredits();
  const { organization } = useOrganization();
  const [userUsage, setUserUsage] = useState<UserUsage[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const fetchUserUsage = async () => {
    if (!organization?.id) return;

    try {
      // Buscar uso por usuário via API do backend
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/credits/usage?organization_id=${organization.id}&limit=1000`, {
        headers
      });

      if (!response.ok) {
        // Se endpoint não existe, usar dados do tokenUsage já disponível
        if (response.status === 404) {
          processTokenUsageData(tokenUsage);
          setLoadingUsers(false);
          return;
        }
        throw new Error(`Erro ao buscar uso: ${response.status}`);
      }

      const result = await response.json();
      const usageData = result.usage || result.data || [];

      // Buscar usuários da organização
      const usersResponse = await fetch(`${apiBase}/api/users?organization_id=${organization.id}`, {
        headers
      });
      const usersResult = await usersResponse.json();
      const users = usersResult.users || usersResult.data || [];
      const userMap = new Map(users.map((u: any) => [u.id, { name: u.name || u.full_name || 'Usuário', email: u.email || '' }]));

      // Agrupar por usuário
      const usageByUser = usageData.reduce((acc: Record<string, UserUsage>, usage: any) => {
        const userId = usage.user_id;
        if (!userId) return acc;

        const userInfo = userMap.get(userId) || { name: 'Usuário', email: '' };

        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            user_name: userInfo.name,
            user_email: userInfo.email,
            total_credits_used: 0,
            total_tokens_used: 0,
            last_usage: usage.created_at
          };
        }

        acc[userId].total_credits_used += usage.cost_in_credits || 0;
        acc[userId].total_tokens_used += usage.tokens_used || 0;

        if (new Date(usage.created_at) > new Date(acc[userId].last_usage)) {
          acc[userId].last_usage = usage.created_at;
        }

        return acc;
      }, {} as Record<string, UserUsage>);

      setUserUsage(Object.values(usageByUser));
    } catch (error) {
      console.error('Erro ao buscar uso por usuário:', error);
      // Fallback: usar dados do tokenUsage já disponível
      processTokenUsageData(tokenUsage);
    } finally {
      setLoadingUsers(false);
    }
  };

  const processTokenUsageData = async (usageData: any[]) => {
    if (!usageData || usageData.length === 0) {
      setUserUsage([]);
      return;
    }

    try {
      // Buscar usuários da organização
      const headers = await getAuthHeaders();
      const usersResponse = await fetch(`${apiBase}/api/users?organization_id=${organization?.id}`, {
        headers
      });
      const usersResult = await usersResponse.json();
      const users = usersResult.users || usersResult.data || [];
      const userMap = new Map(users.map((u: any) => [u.id, { name: u.name || u.full_name || 'Usuário', email: u.email || '' }]));

      // Agrupar por usuário
      const usageByUser = usageData.reduce((acc: Record<string, UserUsage>, usage: any) => {
        const userId = usage.user_id;
        if (!userId) return acc;

        const userInfo = userMap.get(userId) || { name: 'Usuário', email: '' };

        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            user_name: userInfo.name,
            user_email: userInfo.email,
            total_credits_used: 0,
            total_tokens_used: 0,
            last_usage: usage.created_at
          };
        }

        acc[userId].total_credits_used += usage.cost_in_credits || 0;
        acc[userId].total_tokens_used += usage.tokens_used || 0;

        if (new Date(usage.created_at) > new Date(acc[userId].last_usage)) {
          acc[userId].last_usage = usage.created_at;
        }

        return acc;
      }, {} as Record<string, UserUsage>);

      setUserUsage(Object.values(usageByUser));
    } catch (error) {
      console.error('Erro ao processar dados de uso:', error);
      setUserUsage([]);
    }
  };

  useEffect(() => {
    fetchUserUsage();
  }, [organization?.id, tokenUsage]);

  const getUsageStats = () => {
    if (!tokenUsage.length) return null;

    const today = new Date().toDateString();
    const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return {
      today: tokenUsage.filter(u => new Date(u.created_at).toDateString() === today)
        .reduce((sum, u) => sum + u.cost_in_credits, 0),
      thisWeek: tokenUsage.filter(u => new Date(u.created_at) >= thisWeek)
        .reduce((sum, u) => sum + u.cost_in_credits, 0),
      thisMonth: tokenUsage.filter(u => new Date(u.created_at) >= thisMonth)
        .reduce((sum, u) => sum + u.cost_in_credits, 0)
    };
  };

  const stats = getUsageStats();

  if (loading || loadingUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Visão Geral dos Créditos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo dos Créditos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Créditos da Organização
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl text-blue-600">
                {credits?.credits_remaining || 0}
              </div>
              <div className="text-sm text-gray-600">Créditos Restantes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-green-600">
                {credits?.credits_purchased || 0}
              </div>
              <div className="text-sm text-gray-600">Total Comprado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl text-orange-600">
                {credits?.credits_used || 0}
              </div>
              <div className="text-sm text-gray-600">Total Usado</div>
            </div>
          </div>

          {/* Barra de Progresso */}
          {credits && credits.credits_purchased > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Uso de Créditos</span>
                <span>{Math.round((credits.credits_used / credits.credits_purchased) * 100)}%</span>
              </div>
              <Progress 
                value={(credits.credits_used / credits.credits_purchased) * 100} 
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas de Uso */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estatísticas de Uso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl text-blue-600">
                  {stats.today}
                </div>
                <div className="text-sm text-gray-600">Hoje</div>
              </div>
              <div className="text-center">
                <div className="text-xl text-green-600">
                  {stats.thisWeek}
                </div>
                <div className="text-sm text-gray-600">Esta Semana</div>
              </div>
              <div className="text-center">
                <div className="text-xl text-orange-600">
                  {stats.thisMonth}
                </div>
                <div className="text-sm text-gray-600">Este Mês</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uso por Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Uso por Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userUsage.length > 0 ? (
            <div className="space-y-4">
              {userUsage
                .sort((a, b) => b.total_credits_used - a.total_credits_used)
                .map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="">{user.user_name}</div>
                      <div className="text-sm text-gray-600">{user.user_email}</div>
                      <div className="text-xs text-gray-500">
                        Último uso: {new Date(user.last_usage).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-600">
                        {user.total_credits_used} créditos
                      </div>
                      <div className="text-sm text-gray-600">
                        {user.total_tokens_used.toLocaleString()} tokens
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum uso registrado ainda
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};