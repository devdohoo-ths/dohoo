import React from 'react';
import { Users, BarChart3, Settings, Database, MessageCircle, Workflow, Building2, Shield, Bell, FileText, Calendar, Target, Activity, TrendingUp, Download, Upload, Search, Plus, Edit, Trash2, Eye, Lock, Unlock, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: string;
  children?: React.ReactNode;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  'bar-chart-3': BarChart3,
  settings: Settings,
  database: Database,
  'message-circle': MessageCircle,
  workflow: Workflow,
  'building-2': Building2,
  shield: Shield,
  bell: Bell,
  'file-text': FileText,
  calendar: Calendar,
  target: Target,
  activity: Activity,
  'trending-up': TrendingUp,
  download: Download,
  upload: Upload,
  search: Search,
  plus: Plus,
  edit: Edit,
  'trash-2': Trash2,
  eye: Eye,
  lock: Lock,
  unlock: Unlock,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'alert-triangle': AlertTriangle,
  info: Info
};

export function PageHeader({ title, description, icon, children }: PageHeaderProps) {
  const IconComponent = icon ? iconMap[icon] : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        {IconComponent && (
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <IconComponent className="h-6 w-6 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-gray-900 font-bold">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
