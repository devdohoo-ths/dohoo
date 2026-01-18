/**
 * ✅ OTIMIZAÇÃO: Request Deduplication
 * Evita requisições duplicadas simultâneas ao Supabase
 */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly TTL = 5000; // 5 segundos - se uma requisição demorar mais que isso, permite duplicatas

  /**
   * Deduplica requisições - se uma requisição idêntica já está em andamento,
   * retorna a promise existente ao invés de fazer uma nova requisição
   */
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    
    // Verificar se já existe uma requisição em andamento
    const existing = this.pendingRequests.get(key);
    if (existing) {
      const age = now - existing.timestamp;
      
      // Se a requisição ainda está "fresca" (menos de TTL), reutilizar
      if (age < this.TTL) {
        return existing.promise as Promise<T>;
      } else {
        // Requisição muito antiga, limpar e fazer nova
        console.warn(`⚠️ [DEDUP] Requisição antiga detectada, fazendo nova: ${key}`);
        this.pendingRequests.delete(key);
      }
    }

    // Criar nova requisição
    const promise = requestFn()
      .then((result) => {
        // Remover após completar com sucesso
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        // Remover após erro
        this.pendingRequests.delete(key);
        throw error;
      });

    // Armazenar requisição pendente
    this.pendingRequests.set(key, {
      promise,
      timestamp: now
    });

    return promise;
  }

  /**
   * Limpar requisições antigas (mais de 10 segundos)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > 10000) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Limpar todas as requisições pendentes
   */
  clear() {
    this.pendingRequests.clear();
  }

  /**
   * Obter chave única para uma requisição
   */
  static getKey(table: string, operation: string, filters: any = {}): string {
    const filterStr = JSON.stringify(filters);
    return `${table}_${operation}_${filterStr}`;
  }
}

// Instância singleton
export const requestDeduplicator = new RequestDeduplicator();

// Limpar requisições antigas a cada 30 segundos
if (typeof window !== 'undefined') {
  setInterval(() => {
    requestDeduplicator.cleanup();
  }, 30000);
}

