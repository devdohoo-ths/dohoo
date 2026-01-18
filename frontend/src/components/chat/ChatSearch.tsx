
import React, { useState } from 'react';
import { Search, Filter, X, Calendar, User, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onFilterApply: (filters: SearchFilters) => void;
}

interface SearchFilters {
  dateRange?: { start: Date; end: Date };
  platform?: string;
  priority?: string;
  assignedAgent?: string;
  tags?: string[];
}

const ChatSearch = ({ searchTerm, onSearchChange, onFilterApply }: ChatSearchProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const handleApplyFilters = () => {
    onFilterApply(filters);
    setShowAdvanced(false);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterApply({});
  };

  const hasActiveFilters = Object.keys(filters).some(key => 
    filters[key as keyof SearchFilters] !== undefined && 
    filters[key as keyof SearchFilters] !== null
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
        <input
          type="text"
          placeholder="Buscar conversas, mensagens..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors",
            (showAdvanced || hasActiveFilters) && "text-primary"
          )}
        >
          <Filter size={16} />
        </button>
      </div>

      {showAdvanced && (
        <div className="p-4 bg-card border border-border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="">Filtros Avançados</h4>
            <button
              onClick={() => setShowAdvanced(false)}
              className="p-1 rounded hover:bg-accent transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">
                <Calendar size={14} className="inline mr-1" />
                Período
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  className="w-full p-2 border border-border rounded text-sm"
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { 
                      ...prev.dateRange,
                      start: new Date(e.target.value) 
                    } as any
                  }))}
                />
                <input
                  type="date"
                  className="w-full p-2 border border-border rounded text-sm"
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { 
                      ...prev.dateRange,
                      end: new Date(e.target.value) 
                    } as any
                  }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">
                <User size={14} className="inline mr-1" />
                Plataforma
              </label>
              <select
                className="w-full p-2 border border-border rounded text-sm"
                onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value }))}
              >
                <option value="">Todas</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
                <option value="internal">Chat Interno</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2">
                <Tag size={14} className="inline mr-1" />
                Prioridade
              </label>
              <select
                className="w-full p-2 border border-border rounded text-sm"
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              >
                <option value="">Todas</option>
                <option value="urgent">Urgente</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2">
                <User size={14} className="inline mr-1" />
                Agente
              </label>
              <select
                className="w-full p-2 border border-border rounded text-sm"
                onChange={(e) => setFilters(prev => ({ ...prev, assignedAgent: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="Agent 1">Agente 1</option>
                <option value="Agent 2">Agente 2</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </button>
            <div className="space-x-2">
              <button
                onClick={() => setShowAdvanced(false)}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-muted-foreground">Filtros ativos:</span>
          <button
            onClick={clearFilters}
            className="flex items-center space-x-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition-colors"
          >
            <span>Filtros aplicados</span>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatSearch;
