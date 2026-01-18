
import React from 'react';
import { Calendar, Filter, Search, X, Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { AnalyticsFilters as FilterType } from '@/types/analytics';

interface AnalyticsFiltersProps {
  filters: FilterType;
  setFilters: (filters: Partial<FilterType>) => void;
}

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ filters, setFilters }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleKeywordAdd = (keyword: string) => {
    if (keyword.trim() && !filters.keywords.includes(keyword.trim())) {
      setFilters({
        keywords: [...filters.keywords, keyword.trim()]
      });
    }
  };

  const handleKeywordRemove = (keyword: string) => {
    setFilters({
      keywords: filters.keywords.filter(k => k !== keyword)
    });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.resolution_status.includes(status)
      ? filters.resolution_status.filter(s => s !== status)
      : [...filters.resolution_status, status];
    
    setFilters({ resolution_status: newStatuses });
  };

  const handlePriorityToggle = (priority: string) => {
    const newPriorities = filters.priority_level.includes(priority)
      ? filters.priority_level.filter(p => p !== priority)
      : [...filters.priority_level, priority];
    
    setFilters({ priority_level: newPriorities });
  };

  const clearAllFilters = () => {
    setFilters({
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      keywords: [],
      sentiment: 'all',
      resolution_status: [],
      priority_level: []
    });
  };

  const hasActiveFilters = filters.keywords.length > 0 || 
    filters.sentiment !== 'all' || 
    filters.resolution_status.length > 0 || 
    filters.priority_level.length > 0;

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-r from-white to-slate-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span className="text-xl">Filtros Avançados</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {filters.keywords.length + (filters.sentiment !== 'all' ? 1 : 0) + 
                   filters.resolution_status.length + filters.priority_level.length} ativos
                </Badge>
              )}
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Recolher' : 'Expandir'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Período */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700">Período</span>
            </div>
            <Select
              value={filters.dateRange.start ? 'custom' : '30days'}
              onValueChange={(value) => {
                const days = parseInt(value.replace('days', ''));
                setFilters({
                  dateRange: {
                    start: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
                    end: new Date()
                  }
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
                <SelectItem value="90days">Últimos 90 dias</SelectItem>
                <SelectItem value="365days">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sentimento */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 text-center">😊</span>
              <span className="text-gray-700">Sentimento</span>
            </div>
            <Select
              value={filters.sentiment}
              onValueChange={(value) => setFilters({ sentiment: value as any })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sentimentos</SelectItem>
                <SelectItem value="positive">😊 Positivo</SelectItem>
                <SelectItem value="neutral">😐 Neutro</SelectItem>
                <SelectItem value="negative">😞 Negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Busca por palavras-chave */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700">Buscar</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar palavra-chave..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleKeywordAdd((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Keywords Display */}
        {filters.keywords.length > 0 && (
          <div className="space-y-3">
            <span className="text-gray-700">Palavras-chave ativas:</span>
            <div className="flex gap-2 flex-wrap">
              {filters.keywords.map(keyword => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className="cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors"
                  onClick={() => handleKeywordRemove(keyword)}
                >
                  {keyword} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {isExpanded && (
          <>
            <Separator />
            
            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status de Resolução */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Status de Resolução</span>
                  <Badge variant="outline" className="text-xs">
                    {filters.resolution_status.length} selecionados
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'pending', label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                    { value: 'resolved', label: 'Resolvido', color: 'bg-green-100 text-green-800 border-green-200' },
                    { value: 'escalated', label: 'Escalado', color: 'bg-red-100 text-red-800 border-red-200' },
                    { value: 'closed', label: 'Fechado', color: 'bg-gray-100 text-gray-800 border-gray-200' }
                  ].map(status => (
                    <div
                      key={status.value}
                      className={`
                        p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                        ${filters.resolution_status.includes(status.value) 
                          ? status.color + ' border-opacity-100' 
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                      `}
                      onClick={() => handleStatusToggle(status.value)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="">{status.label}</span>
                        <Switch 
                          checked={filters.resolution_status.includes(status.value)}
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nível de Prioridade */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Nível de Prioridade</span>
                  <Badge variant="outline" className="text-xs">
                    {filters.priority_level.length} selecionados
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'low', label: 'Baixa', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '⬇️' },
                    { value: 'medium', label: 'Média', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '➡️' },
                    { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '⬆️' },
                    { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-800 border-red-200', icon: '🔥' }
                  ].map(priority => (
                    <div
                      key={priority.value}
                      className={`
                        p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                        ${filters.priority_level.includes(priority.value) 
                          ? priority.color + ' border-opacity-100' 
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                      `}
                      onClick={() => handlePriorityToggle(priority.value)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{priority.icon}</span>
                          <span className="">{priority.label}</span>
                        </div>
                        <Switch 
                          checked={filters.priority_level.includes(priority.value)}
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Filter Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Filtros aplicados em tempo real</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
