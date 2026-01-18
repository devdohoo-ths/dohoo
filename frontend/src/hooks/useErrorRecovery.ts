import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRecovery?: () => void;
  onMaxRetriesExceeded?: () => void;
}

export const useErrorRecovery = (options: ErrorRecoveryOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRecovery,
    onMaxRetriesExceeded
  } = options;

  const [retryCount, setRetryCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const { toast } = useToast();

  const clearCache = useCallback((type: 'specific' | 'all' = 'specific') => {
    if (type === 'all') {
      localStorage.clear();
      sessionStorage.clear();
    } else {
      // Limpar apenas cache problemático
      const problematicKeys = [
        'accounts_cache',
        'assistants_cache',
        'flows_cache',
        'user_permissions_cache',
        'role_permissions_cache'
      ];
      
      problematicKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    }
    
    console.log(`🧹 [ErrorRecovery] Cache ${type} limpo`);
  }, []);

  const retryOperation = useCallback(async (
    operation: () => Promise<any>,
    operationName: string = 'operação'
  ) => {
    if (retryCount >= maxRetries) {
      console.error(`❌ [ErrorRecovery] Máximo de tentativas excedido para: ${operationName}`);
      
      toast({
        title: "Erro persistente",
        description: `Não foi possível completar ${operationName} após ${maxRetries} tentativas.`,
        variant: "destructive",
      });

      if (onMaxRetriesExceeded) {
        onMaxRetriesExceeded();
      }
      
      return null;
    }

    setIsRecovering(true);
    
    try {
      console.log(`🔄 [ErrorRecovery] Tentativa ${retryCount + 1}/${maxRetries} para: ${operationName}`);
      
      // Limpar cache específico antes de tentar
      clearCache('specific');
      
      // Aguardar um pouco antes de tentar novamente
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
      }
      
      const result = await operation();
      
      // Sucesso! Resetar contador
      setRetryCount(0);
      setIsRecovering(false);
      
      if (onRecovery) {
        onRecovery();
      }
      
      toast({
        title: "Recuperado!",
        description: `${operationName} foi concluído com sucesso.`,
      });
      
      return result;
      
    } catch (error) {
      console.error(`❌ [ErrorRecovery] Erro na tentativa ${retryCount + 1}:`, error);
      
      setRetryCount(prev => prev + 1);
      setIsRecovering(false);
      
      toast({
        title: "Erro na recuperação",
        description: `Tentativa ${retryCount + 1} falhou. Tentando novamente...`,
        variant: "destructive",
      });
      
      return null;
    }
  }, [retryCount, maxRetries, retryDelay, clearCache, onRecovery, onMaxRetriesExceeded, toast]);

  const resetRecovery = useCallback(() => {
    setRetryCount(0);
    setIsRecovering(false);
    console.log('🔄 [ErrorRecovery] Estado de recuperação resetado');
  }, []);

  const forceRecovery = useCallback(async (operation: () => Promise<any>) => {
    console.log('🚀 [ErrorRecovery] Forçando recuperação...');
    
    // Limpar todo cache
    clearCache('all');
    
    // Resetar contador
    setRetryCount(0);
    
    // Tentar operação
    return await retryOperation(operation, 'recuperação forçada');
  }, [clearCache, retryOperation]);

  return {
    retryCount,
    isRecovering,
    retryOperation,
    resetRecovery,
    forceRecovery,
    clearCache
  };
};
