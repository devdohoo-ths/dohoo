
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, TrendingUp } from 'lucide-react';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';

interface ConversationsWidgetProps {
  className?: string;
}

export const ConversationsWidget: React.FC<ConversationsWidgetProps> = ({ className }) => {
  const { dashboardStats } = useDashboardWidgets();
  
  const activeConversations = dashboardStats?.active_conversations || 0;
  const finishedConversations = dashboardStats?.finished_conversations || 0;
  
  // Calcular percentual de crescimento (simulado)
  const growthPercentage = finishedConversations > 0 ? 
    Math.round(((activeConversations - finishedConversations) / finishedConversations) * 100) : 12;

  return (
    <Card className={`bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm opacity-90">Conversas Ativas</CardTitle>
        <MessageCircle className="h-5 w-5 opacity-80" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl md:text-3xl">{activeConversations}</div>
        <div className="flex items-center text-xs opacity-80 mt-1">
          <TrendingUp className="w-3 h-3 mr-1" />
          {growthPercentage > 0 ? '+' : ''}{growthPercentage}% vs. ontem
        </div>
      </CardContent>
    </Card>
  );
};
