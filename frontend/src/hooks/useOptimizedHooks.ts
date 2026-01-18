/**
 * Hooks Otimizados para React
 * 
 * Este módulo implementa hooks customizados otimizados para
 * melhorar performance e reduzir re-renders desnecessários.
 */

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { logger } from './logger';

/**
 * Hook de debouncing para inputs
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook de throttling para eventos
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * Hook para busca otimizada com cache
 */
export function useOptimizedSearch<T>(
  searchFunction: (query: string, filters?: any) => Promise<T[]>,
  initialValue: T[] = [],
  delay: number = 500
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});
  
  const debouncedQuery = useDebounce(query, delay);
  const cacheRef = useRef<Map<string, T[]>>(new Map());

  const search = useCallback(async (searchQuery: string, searchFilters: any = {}) => {
    const cacheKey = `${searchQuery}:${JSON.stringify(searchFilters)}`;
    
    // Verificar cache
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey)!);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchFunction(searchQuery, searchFilters);
      
      // Armazenar no cache
      cacheRef.current.set(cacheKey, searchResults);
      
      setResults(searchResults);
      logger.debug(`Busca executada: "${searchQuery}" - ${searchResults.length} resultados`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na busca';
      setError(errorMessage);
      logger.error('Erro na busca:', err);
    } finally {
      setLoading(false);
    }
  }, [searchFunction]);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      search(debouncedQuery, filters);
    } else {
      setResults(initialValue);
    }
  }, [debouncedQuery, filters, search, initialValue]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    logger.debug('Cache de busca limpo');
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    filters,
    setFilters,
    search,
    clearCache
  };
}

/**
 * Hook para paginação otimizada
 */
export function useOptimizedPagination<T>(
  fetchFunction: (page: number, pageSize: number, filters?: any) => Promise<{
    data: T[];
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }>,
  initialPageSize: number = 20,
  initialFilters: any = {}
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [data, setData] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  
  const cacheRef = useRef<Map<string, any>>(new Map());

  const fetchData = useCallback(async (page: number, size: number, searchFilters: any) => {
    const cacheKey = `page:${page}:size:${size}:${JSON.stringify(searchFilters)}`;
    
    // Verificar cache
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      setData(cached.data);
      setTotalCount(cached.totalCount);
      return cached;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFunction(page, size, searchFilters);
      
      // Armazenar no cache
      cacheRef.current.set(cacheKey, result);
      
      setData(result.data);
      setTotalCount(result.totalCount);
      
      logger.debug(`Página ${page} carregada: ${result.data.length} itens`);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(errorMessage);
      logger.error('Erro na paginação:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= Math.ceil(totalCount / pageSize)) {
      setCurrentPage(page);
      fetchData(page, pageSize, filters);
    }
  }, [pageSize, totalCount, filters, fetchData]);

  const changePageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    fetchData(1, newPageSize, filters);
  }, [filters, fetchData]);

  const updateFilters = useCallback((newFilters: any) => {
    setFilters(newFilters);
    setCurrentPage(1);
    fetchData(1, pageSize, newFilters);
  }, [pageSize, fetchData]);

  const refresh = useCallback(() => {
    fetchData(currentPage, pageSize, filters);
  }, [currentPage, pageSize, filters, fetchData]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    logger.debug('Cache de paginação limpo');
  }, []);

  const paginationInfo = useMemo(() => ({
    currentPage,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    hasNextPage: currentPage < Math.ceil(totalCount / pageSize),
    hasPrevPage: currentPage > 1,
    startIndex: (currentPage - 1) * pageSize + 1,
    endIndex: Math.min(currentPage * pageSize, totalCount)
  }), [currentPage, pageSize, totalCount]);

  useEffect(() => {
    fetchData(currentPage, pageSize, filters);
  }, []);

  return {
    data,
    loading,
    error,
    paginationInfo,
    goToPage,
    changePageSize,
    updateFilters,
    refresh,
    clearCache
  };
}

/**
 * Hook para lazy loading de componentes
 */
export function useLazyComponent<T extends React.ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component) return Component;

    setLoading(true);
    setError(null);

    try {
      const module = await importFunction();
      setComponent(() => module.default);
      logger.debug('Componente lazy carregado com sucesso');
      return module.default;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao carregar componente');
      setError(error);
      logger.error('Erro ao carregar componente lazy:', err);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [Component, importFunction]);

  return {
    Component: Component || fallback || null,
    loading,
    error,
    loadComponent
  };
}

/**
 * Hook para virtualização de listas
 */
export function useVirtualization(
  itemCount: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, itemCount]);

  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      items.push({
        index: i,
        top: i * itemHeight,
        height: itemHeight
      });
    }
    return items;
  }, [visibleRange, itemHeight]);

  const totalHeight = itemCount * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  };
}

/**
 * Hook para performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const mountTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const renderTime = now - lastRenderTime.current;
    
    logger.debug(`Render ${componentName}: #${renderCount.current}, tempo: ${renderTime}ms`);
    
    lastRenderTime.current = now;
  });

  useEffect(() => {
    const mountDuration = Date.now() - mountTime.current;
    logger.debug(`Componente ${componentName} montado em ${mountDuration}ms`);
    
    return () => {
      const totalDuration = Date.now() - mountTime.current;
      logger.debug(`Componente ${componentName} desmontado após ${totalDuration}ms, ${renderCount.current} renders`);
    };
  }, [componentName]);

  return {
    renderCount: renderCount.current,
    mountTime: mountTime.current
  };
}

/**
 * Componente memo otimizado
 */
export const OptimizedMemo = memo(function OptimizedMemo<T extends React.ComponentType<any>>(
  Component: T,
  areEqual?: (prevProps: React.ComponentProps<T>, nextProps: React.ComponentProps<T>) => boolean
) {
  return memo(Component, areEqual);
});

/**
 * Hook para detecção de mudanças profundas
 */
export function useDeepCompareMemo<T>(value: T): T {
  const ref = useRef<T>(value);
  const signalRef = useRef(0);

  if (!deepEqual(ref.current, value)) {
    ref.current = value;
    signalRef.current += 1;
  }

  return useMemo(() => ref.current, [signalRef.current]);
}

/**
 * Função auxiliar para comparação profunda
 */
function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}
