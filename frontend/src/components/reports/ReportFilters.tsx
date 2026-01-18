import React, { useState } from 'react';
import { Search, Filter, Users, MessageCircle, Clock, User, Plus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ReportFilters } from '@/types/reports';
import { KeywordManager } from './KeywordManager';
import { StatusManager } from './StatusManager';
import { TagManager } from './TagManager';
import { useReportFilterData } from '@/hooks/useReportFilterData';
import { useKeywords } from '@/hooks/useKeywords';
import { useStatus } from '@/hooks/useStatus';
import { useTags } from '@/hooks/useTags';

interface ReportFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: Partial<ReportFilters>) => void;
  onSearch: () => void;
  onClear: () => void;
  loading?: boolean;
}

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'instagram', label: 'Instagram', icon: MessageCircle },
  { value: 'facebook', label: 'Facebook', icon: MessageCircle },
  { value: 'telegram', label: 'Telegram', icon: MessageCircle },
  { value: 'web', label: 'Chat Web', icon: MessageCircle },
];

// Componente CustomMultiSelect melhorado para palavras-chave
const CustomKeywordSelect = ({ 
  options, 
  selectedValues = [], 
  onSelectionChange, 
  placeholder, 
  loading = false
}: {
  options: Array<{ id: string; name: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder: string;
  loading?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);

  const addCustomKeyword = (keyword: string) => {
    if (keyword.trim() && !selectedValues.includes(keyword.trim())) {
      onSelectionChange([...selectedValues, keyword.trim()]);
    }
    setInputValue('');
    setShowInput(false);
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedValues.filter(v => v !== optionValue));
  };

  const toggleOption = (optionValue: string) => {
    if (selectedValues.includes(optionValue)) {
      onSelectionChange(selectedValues.filter(v => v !== optionValue));
    } else {
      onSelectionChange([...selectedValues, optionValue]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomKeyword(inputValue);
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue('');
    }
  };

  const filteredOptions = options.filter(option => 
    option.name.toLowerCase().includes(inputValue.toLowerCase()) &&
    !selectedValues.includes(option.name)
  );

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between min-h-[38px] h-auto p-2"
            onClick={() => setIsOpen(true)}
          >
            <div className="flex flex-wrap gap-1 flex-1 text-left">
              {selectedValues.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedValues.map(value => (
                  <Badge 
                    key={value} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => removeOption(value, e)}
                  >
                    {value}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="max-h-60 overflow-auto">
            {/* Campo de entrada para palavras customizadas */}
            <div className="p-2 border-b">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma palavra-chave..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => addCustomKeyword(inputValue)}
                  disabled={!inputValue.trim()}
                >
                  Adicionar
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pressione Enter para adicionar ou Escape para cancelar
              </div>
            </div>

            {/* Lista de palavras cadastradas */}
            <div className="p-1">
              {loading ? (
                <div className="p-2 text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : filteredOptions.length === 0 && !inputValue ? (
                <div className="p-2 text-sm text-muted-foreground">
                  Nenhuma palavra-chave cadastrada
                </div>
              ) : (
                <>
                  {/* Palavras cadastradas */}
                  {filteredOptions.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-muted-foreground px-2 py-1">
                        Palavras cadastradas:
                      </div>
                      {filteredOptions.map(option => (
                        <div
                          key={option.id}
                          className="flex items-center justify-between p-2 text-sm cursor-pointer hover:bg-accent rounded"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            toggleOption(option.name);
                          }}
                        >
                          <span>{option.name}</span>
                          <Plus className="h-4 w-4 ml-2 text-primary" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sugestão de palavra customizada */}
                  {inputValue && !filteredOptions.some(opt => opt.name.toLowerCase() === inputValue.toLowerCase()) && (
                    <div className="border-t pt-2">
                      <div className="text-xs text-muted-foreground px-2 py-1">
                        Adicionar palavra customizada:
                      </div>
                      <div
                        className="flex items-center justify-between p-2 text-sm cursor-pointer hover:bg-accent rounded border border-dashed"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addCustomKeyword(inputValue);
                        }}
                      >
                        <span className="">"{inputValue}"</span>
                        <Plus className="h-4 w-4 ml-2 text-primary" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

// Componente CustomMultiSelect original (mantido para outros filtros)
const CustomMultiSelect = ({ 
  options, 
  selectedValues = [], 
  onSelectionChange, 
  placeholder, 
  loading = false,
  optionType = 'object'
}: {
  options: Array<{ id: string; name: string } | { value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder: string;
  loading?: boolean;
  optionType?: 'object' | 'valueLabel';
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getOptionValue = (option: any) => {
    return optionType === 'valueLabel' ? option.value : option.name;
  };

  const getOptionLabel = (option: any) => {
    return optionType === 'valueLabel' ? option.label : option.name;
  };

  const getOptionKey = (option: any) => {
    return optionType === 'valueLabel' ? option.value : option.id;
  };

  const toggleOption = (optionValue: string) => {
    if (selectedValues.includes(optionValue)) {
      onSelectionChange(selectedValues.filter(v => v !== optionValue));
    } else {
      onSelectionChange([...selectedValues, optionValue]);
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedValues.filter(v => v !== optionValue));
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between min-h-[38px] h-auto p-2"
          >
            <div className="flex flex-wrap gap-1 flex-1 text-left">
              {selectedValues.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedValues.map(value => (
                  <Badge 
                    key={value} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => removeOption(value, e)}
                  >
                    {value}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="max-h-60 overflow-auto">
            {loading ? (
              <div className="p-2 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : options.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                Nenhuma opção disponível
              </div>
            ) : (
              options.map(option => {
                const optionValue = getOptionValue(option);
                const optionLabel = getOptionLabel(option);
                const optionKey = getOptionKey(option);
                return (
                  <div
                    key={optionKey}
                    className={cn(
                      "flex items-center justify-between p-2 text-sm cursor-pointer hover:bg-accent",
                      selectedValues.includes(optionValue) && "bg-accent"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleOption(optionValue);
                    }}
                  >
                    <span>{optionLabel}</span>
                    {selectedValues.includes(optionValue) && (
                      <Plus className="h-4 w-4 ml-2 text-primary" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  loading = false
}) => {
  // Hooks - movidos para dentro do componente
  const { keywords, loading: keywordsLoading } = useKeywords();
  // const { status, loading: statusLoading } = useStatus(); // COMENTADO - Removido filtro de Status
  // const { tags, loading: tagsLoading } = useTags(); // COMENTADO - Removido filtro de Tags
  const { 
    operators, 
    // tags: reportTags, // COMENTADO - Removido filtro de Tags
    departments, 
    loading: dataLoading, 
    refreshData 
  } = useReportFilterData();

  // Estados para os modais - movidos para dentro do componente
  const [showKeywordManager, setShowKeywordManager] = useState(false);
  // const [showStatusManager, setShowStatusManager] = useState(false); // COMENTADO - Removido filtro de Status
  // const [showTagManager, setShowTagManager] = useState(false); // COMENTADO - Removido filtro de Tags

  const handleDateChange = (field: 'start' | 'end', date: Date | undefined) => {
    if (date) {
      onFiltersChange({
        dateRange: {
          ...filters.dateRange,
          [field]: date
        }
      });
    }
  };

  const handleMultiSelect = (field: keyof ReportFilters, value: string, checked: boolean) => {
    const currentValues = (filters[field] as string[]) || [];
    const newValues = checked 
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    onFiltersChange({ [field]: newValues });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    // if (filters.channels?.length) count += filters.channels.length; // COMENTADO - Removido filtro de Canal
    if (filters.agents?.length) count += filters.agents.length;
    // if (filters.statuses?.length) count += filters.statuses.length; // COMENTADO - Removido filtro de Status
    // if (filters.tags?.length) count += filters.tags.length; // COMENTADO - Removido filtro de Tags
    // if (filters.departments?.length) count += filters.departments.length; // COMENTADO - Removido filtro de Departamentos
    if (filters.keywords) count += 1;
    return count;
  };

  const clearAllFilters = () => {
    onClear();
  };

  const handleSelectKeyword = (keyword: string) => {
    const currentKeywords = filters.keywords || '';
    const newKeywords = currentKeywords 
      ? `${currentKeywords}, ${keyword}`
      : keyword;
    
    onFiltersChange({ keywords: newKeywords });
  };

  // Handlers para multiselect
  const handleKeywordsChange = (selectedKeywords: string[]) => {
    console.log('[Filtros] handleKeywordsChange chamado com:', selectedKeywords);
    const keywordsString = selectedKeywords.join(', ');
    console.log('[Filtros] Keywords string:', keywordsString);
    onFiltersChange({ keywords: keywordsString });
  };

  // const handleStatusChange = (selectedStatus: string[]) => { // COMENTADO - Removido filtro de Status
  //   onFiltersChange({ statuses: selectedStatus });
  // };

  // const handleTagsChange = (selectedTags: string[]) => { // COMENTADO - Removido filtro de Tags
  //   onFiltersChange({ tags: selectedTags });
  // };

  // Handlers para botões "Usar" dos modais
  const handleUseKeyword = (keyword: string) => {
    const currentKeywords = filters.keywords ? filters.keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
    if (!currentKeywords.includes(keyword)) {
      handleKeywordsChange([...currentKeywords, keyword]);
    }
  };

  // const handleUseStatus = (status: string) => { // COMENTADO - Removido filtro de Status
  //   const currentStatus = filters.statuses || [];
  //   if (!currentStatus.includes(status)) {
  //     handleStatusChange([...currentStatus, status]);
  //   }
  // };

  // const handleUseTag = (tag: string) => { // COMENTADO - Removido filtro de Tags
  //   const currentTags = filters.tags || [];
  //   if (!currentTags.includes(tag)) {
  //     handleTagsChange([...currentTags, tag]);
  //   }
  // };

  // Handlers para multiselect operadores e departamentos
  const handleOperatorsChange = (selectedOperators: string[]) => {
    onFiltersChange({ agents: selectedOperators });
  };

  // const handleDepartmentsChange = (selectedDepartments: string[]) => { // COMENTADO - Removido filtro de Departamentos
  //   onFiltersChange({ departments: selectedDepartments });
  // };

  // const handleChannelsChange = (selectedChannels: string[]) => { // COMENTADO - Removido filtro de Canal
  //   onFiltersChange({ channels: selectedChannels });
  // };

  // Converter keywords string para array para o multiselect
  const selectedKeywords = filters.keywords ? filters.keywords.split(',').map(k => k.trim()).filter(Boolean) : [];

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros Avançados
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getActiveFiltersCount()} ativo{getActiveFiltersCount() !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshData}
                disabled={dataLoading}
                className="flex items-center gap-1"
                title="Atualizar dados dos filtros"
              >
                <RefreshCw className={cn("h-4 w-4", dataLoading && "animate-spin")} />
              </Button>
              {getActiveFiltersCount() > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-destructive hover:text-destructive"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filtros principais sempre visíveis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Período */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Período
              </Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateRange.start && "text-muted-foreground"
                      )}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {filters.dateRange.start ? (
                        format(filters.dateRange.start, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Data inicial</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateRange.start}
                      onSelect={(date: Date | undefined) => handleDateChange('start', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateRange.end && "text-muted-foreground"
                      )}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {filters.dateRange.end ? (
                        format(filters.dateRange.end, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Data final</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateRange.end}
                      onSelect={(date: Date | undefined) => handleDateChange('end', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Palavras-chave */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Palavras-chave
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowKeywordManager(true); }}
                  className="h-6 w-6 p-0"
                  title="Gerenciar palavras-chave"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <CustomKeywordSelect
                options={keywords}
                selectedValues={selectedKeywords}
                onSelectionChange={handleKeywordsChange}
                placeholder="Selecione ou digite palavras-chave"
                loading={keywordsLoading}
              />
            </div>

            {/* Status - COMENTADO */}
            {/* <div className="space-y-2">
              <Label className="flex items-center gap-2 group cursor-pointer hover:text-primary transition-colors">
                <Clock className="h-4 w-4" />
                Status
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowStatusManager(true); }}
                  className="h-6 w-6 p-0 ml-1"
                  title="Gerenciar status"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </Label>
              <CustomMultiSelect
                options={status}
                selectedValues={filters.statuses || []}
                onSelectionChange={handleStatusChange}
                placeholder="Selecione status"
                loading={statusLoading}
              />
            </div> */}

            {/* Tags - COMENTADO */}
            {/* <div className="space-y-2">
              <Label className="flex items-center gap-2 group cursor-pointer hover:text-primary transition-colors">
                <MessageCircle className="h-4 w-4" />
                Tags
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowTagManager(true); }}
                  className="h-6 w-6 p-0 ml-1"
                  title="Gerenciar tags"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </Label>
              <CustomMultiSelect
                options={tags}
                selectedValues={filters.tags || []}
                onSelectionChange={handleTagsChange}
                placeholder="Selecione tags"
                loading={tagsLoading}
              />
            </div> */}

            {/* Operadores */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Operadores
              </Label>
              <CustomMultiSelect
                options={operators}
                selectedValues={filters.agents || []}
                onSelectionChange={handleOperatorsChange}
                placeholder="Selecione operadores"
                loading={dataLoading}
                optionType="valueLabel"
              />
            </div>

            {/* Departamentos - COMENTADO */}
            {/* <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Departamentos
              </Label>
              <CustomMultiSelect
                options={departments}
                selectedValues={filters.departments || []}
                onSelectionChange={handleDepartmentsChange}
                placeholder="Selecione departamentos"
                loading={dataLoading}
                optionType="valueLabel"
              />
            </div> */}

            {/* Canal - COMENTADO */}
            {/* <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Canal
              </Label>
              <CustomMultiSelect
                options={CHANNELS}
                selectedValues={filters.channels || []}
                onSelectionChange={handleChannelsChange}
                placeholder="Selecione canais"
                loading={false}
                optionType="valueLabel"
              />
            </div> */}
          </div>

          {/* Botões de ação */}
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-sm text-muted-foreground">
              {filters.dateRange.start && filters.dateRange.end && (
                <span>
                  Período: {format(filters.dateRange.start, "dd/MM/yyyy", { locale: ptBR })} - {format(filters.dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClear}
                disabled={getActiveFiltersCount() === 0}
              >
                Limpar Filtros
              </Button>
              <Button
                onClick={onSearch}
                disabled={loading}
                className="min-w-[120px]"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modais de gerenciamento */}
      <KeywordManager
        open={showKeywordManager}
        onClose={() => setShowKeywordManager(false)}
        onSelectKeyword={handleUseKeyword}
      />
      
      {/* StatusManager - COMENTADO */}
      {/* <StatusManager
        open={showStatusManager}
        onClose={() => setShowStatusManager(false)}
        onSelectStatus={handleUseStatus}
      /> */}
      
      {/* TagManager - COMENTADO */}
      {/* <TagManager
        open={showTagManager}
        onClose={() => setShowTagManager(false)}
        onSelectTag={handleUseTag}
      /> */}
    </>
  );
}; 