
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Sparkles } from 'lucide-react';

interface AIResponsesWidgetProps {
  usageStats: any;
  className?: string;
}

export const AIResponsesWidget: React.FC<AIResponsesWidgetProps> = ({ usageStats, className }) => {
  return (
    <Card className={`bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0 shadow-lg ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm opacity-90">Respostas da IA</CardTitle>
        <Bot className="h-5 w-5 opacity-80" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl md:text-3xl">
          {usageStats?.today || 0}
        </div>
        <div className="flex items-center text-xs opacity-80 mt-1">
          <Sparkles className="w-3 h-3 mr-1" />
          Hoje: {usageStats?.today || 0} tokens
        </div>
      </CardContent>
    </Card>
  );
};
