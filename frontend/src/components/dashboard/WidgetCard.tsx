import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  MessageCircle, 
  CheckCircle, 
  Bot, 
  Users, 
  TrendingUp, 
  Zap, 
  Activity,
  Settings,
  MoreHorizontal,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { Widget, WidgetData } from '@/hooks/useDashboardWidgets';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  widget: Widget;
  onRefresh?: () => void;
  onToggleVisibility?: () => void;
  onSettings?: () => void;
  className?: string;
}

// 🚀 WIDGET SYSTEM: Icon mapping for different widget types
const WIDGET_ICONS: Record<string, React.ComponentType<any>> = {
  ai_credits: Brain,
  active_conversations: MessageCircle,
  finished_conversations: CheckCircle,
  ai_responses: Bot,
  users: Users,
  productivity: TrendingUp,
  quick_actions: Zap,
  recent_activity: Activity,
};

// 🚀 WIDGET SYSTEM: Color mapping for different widget types
const WIDGET_COLORS: Record<string, string> = {
  ai_credits: 'text-blue-600 bg-blue-50',
  active_conversations: 'text-green-600 bg-green-50',
  finished_conversations: 'text-purple-600 bg-purple-50',
  ai_responses: 'text-orange-600 bg-orange-50',
  users: 'text-indigo-600 bg-indigo-50',
  productivity: 'text-emerald-600 bg-emerald-50',
  quick_actions: 'text-gray-600 bg-gray-50',
  recent_activity: 'text-cyan-600 bg-cyan-50',
};

// 🚀 WIDGET SYSTEM: Render widget content based on type
const renderWidgetContent = (widget: Widget) => {
  const { widget_type, data } = widget;

  switch (widget_type) {
    case 'ai_credits':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl text-blue-600">{data.value}</span>
            <Badge variant="outline" className="text-xs">
              {data.total ? `${Math.round((data.value / data.total) * 100)}%` : 'N/A'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{data.label}</p>
          {data.total && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (data.value / data.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      );

    case 'active_conversations':
    case 'finished_conversations':
    case 'ai_responses':
    case 'users':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xl">{data.value}</span>
            {data.trend !== undefined && (
              <Badge 
                variant={data.trend >= 0 ? "default" : "destructive"}
                className="text-xs"
              >
                {data.trend >= 0 ? '+' : ''}{data.trend}%
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{data.label}</p>
        </div>
      );

    case 'productivity':
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xl text-emerald-600">{data.value}%</span>
            <Badge variant="outline" className="text-xs">
              {data.trend >= 0 ? '↗' : '↘'} {Math.abs(data.trend || 0)}%
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{data.label}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${data.value}%` }}
            />
          </div>
        </div>
      );

    case 'quick_actions':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{data.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {data.actions?.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => console.log('Action:', action.action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      );

    case 'recent_activity':
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{data.label}</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {data.activities?.map((activity, index) => (
              <div key={index} className="flex items-start space-x-2 text-xs">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5",
                  activity.type === 'ai' ? 'bg-orange-500' : 'bg-blue-500'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{activity.text}</p>
                  <p className="text-muted-foreground">
                    {new Date(activity.time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          <span className="text-2xl">{data.value}</span>
          <p className="text-sm text-muted-foreground">{data.label}</p>
        </div>
      );
  }
};

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  onRefresh,
  onToggleVisibility,
  onSettings,
  className
}) => {
  const IconComponent = WIDGET_ICONS[widget.widget_type] || Settings;
  const colorClass = WIDGET_COLORS[widget.widget_type] || 'text-gray-600 bg-gray-50';

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200 hover:shadow-md",
      !widget.is_visible && "opacity-50",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "p-2 rounded-lg",
              colorClass
            )}>
              <IconComponent className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-normal">{widget.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{widget.description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            )}
            
            {onToggleVisibility && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleVisibility}
                className="h-6 w-6 p-0"
              >
                {widget.is_visible ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
              </Button>
            )}
            
            {onSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSettings}
                className="h-6 w-6 p-0"
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {renderWidgetContent(widget)}
      </CardContent>
      
      {/* Widget position indicator for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-1 right-1 text-xs text-muted-foreground bg-background/80 px-1 rounded">
          {widget.position_x},{widget.position_y}
        </div>
      )}
    </Card>
  );
}; 