
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Zap, ShoppingCart, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AICreditsWidgetProps {
  credits: any;
  className?: string;
}

export const AICreditsWidget: React.FC<AICreditsWidgetProps> = ({ credits, className }) => {
  const navigate = useNavigate();

  const usagePercentage = credits ? 
    (credits.credits_used / credits.credits_purchased) * 100 : 0;

  const getStatusColor = () => {
    if (usagePercentage < 50) return 'text-green-600';
    if (usagePercentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = () => {
    if (usagePercentage < 50) return 'bg-green-500';
    if (usagePercentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className={`bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-lg ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm opacity-90">Créditos de IA</CardTitle>
        <Zap className="h-5 w-5 opacity-80" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-2xl md:text-3xl">
            {credits?.credits_remaining?.toLocaleString() || 0}
          </div>
          <p className="text-xs opacity-80">
            de {credits?.credits_purchased?.toLocaleString() || 0} créditos
          </p>
        </div>

        {credits && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs opacity-80">
              <span>Usado</span>
              <span>{usagePercentage.toFixed(0)}%</span>
            </div>
            <Progress 
              value={usagePercentage} 
              className="h-2 bg-white/20"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-blue-600 border-white/20 hover:bg-white/10 text-xs"
            onClick={() => navigate('/ai/credits')}
          >
            <ShoppingCart className="w-3 h-3 mr-1" />
            Comprar
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-blue-600 border-white/20 hover:bg-white/10 text-xs"
            onClick={() => navigate('/analytics')}
          >
            <TrendingUp className="w-3 h-3 mr-1" />
            Ver Uso
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
