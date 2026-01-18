import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAgentLimits } from '@/hooks/useAgentLimits';
import { Settings, AlertTriangle } from 'lucide-react';

export const AgentLimitCard = () => {
  const { myLimit, loading } = useAgentLimits();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Meu Limite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!myLimit) {
    return null; // Não mostrar se não há limite configurado
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  const monthlyPercentage = getUsagePercentage(myLimit.current_month_used, myLimit.monthly_limit);
  const dailyPercentage = getUsagePercentage(myLimit.current_day_used, myLimit.daily_limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Meu Limite
          {!myLimit.is_active && (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Limite Mensal */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Mensal</span>
              <Badge variant={myLimit.monthly_remaining > 0 ? "default" : "destructive"}>
                {myLimit.current_month_used} / {myLimit.monthly_limit}
              </Badge>
            </div>
            <Progress 
              value={monthlyPercentage} 
              className="h-2 mb-1"
            />
            <p className={`text-xs ${getUsageColor(monthlyPercentage)}`}>
              Restantes: {myLimit.monthly_remaining}
            </p>
          </div>

          {/* Limite Diário */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Diário</span>
              <Badge variant={myLimit.daily_remaining > 0 ? "default" : "destructive"}>
                {myLimit.current_day_used} / {myLimit.daily_limit}
              </Badge>
            </div>
            <Progress 
              value={dailyPercentage} 
              className="h-2 mb-1"
            />
            <p className={`text-xs ${getUsageColor(dailyPercentage)}`}>
              Restantes: {myLimit.daily_remaining}
            </p>
          </div>

          {!myLimit.is_active && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              ⚠️ Limites desativados
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};