
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';
import { useToast } from './use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface AICredits {
  id: string;
  credits_purchased: number;
  credits_used: number;
  credits_remaining: number;
  last_purchase_at?: string;
}

interface TokenUsage {
  id: string;
  tokens_used: number;
  model_used: string;
  cost_in_credits: number;
  message_type: string;
  created_at: string;
  assistant_id?: string;
  chat_id?: string;
  user_id?: string; // Para rastreamento de quem usou
}

interface CreditTransaction {
  id: string;
  transaction_type: 'purchase' | 'usage' | 'refund';
  credits_amount: number;
  cost_usd?: number;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  description?: string;
  created_at: string;
  user_id?: string; // Para rastreamento de quem comprou
}

export const useAICredits = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [credits, setCredits] = useState<AICredits | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Cache em memória por organização (TTL 5min) para reduzir chamadas RPC
  // @ts-ignore
  const cache: Map<string, { ts: number; credits: AICredits | null; tokenUsage: TokenUsage[]; transactions: CreditTransaction[] }> = (useAICredits as any)._cache || new Map();
  // @ts-ignore
  (useAICredits as any)._cache = cache;
  const TTL = 5 * 60 * 1000; // 5 minutos
  const orgKey = organization?.id || 'no-org';

  const fetchCredits = async () => {
    if (!organization?.id) return;

    try {
      // ✅ Cache: retornar se ainda válido
      const cached = cache.get(orgKey);
      if (cached && Date.now() - cached.ts < TTL && cached.credits !== undefined) {
        setCredits(cached.credits);
        return;
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/credits?organization_id=${organization.id}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch credits: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const creditData = result.credit || result.success?.credit;
      
      // Se não há dados, criar estrutura vazia
      if (!creditData || (!creditData.credits_purchased && !creditData.credits_used)) {
        const emptyCredits = {
          id: '',
          credits_purchased: 0,
          credits_used: 0,
          credits_remaining: 0
        };
        setCredits(emptyCredits);
        cache.set(orgKey, { ts: Date.now(), credits: emptyCredits, tokenUsage: cached?.tokenUsage || [], transactions: cached?.transactions || [] });
      } else {
        const orgCredits = {
          id: creditData.id || '',
          credits_purchased: creditData.credits_purchased || 0,
          credits_used: creditData.credits_used || 0,
          credits_remaining: creditData.credits_remaining || 0,
          last_purchase_at: creditData.last_purchase_at
        };
        setCredits(orgCredits);
        cache.set(orgKey, { ts: Date.now(), credits: orgCredits, tokenUsage: cached?.tokenUsage || [], transactions: cached?.transactions || [] });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTokenUsage = async (limit = 50) => {
    if (!organization?.id) return;

    try {
      // ✅ Cache: retornar se válido
      const cached = cache.get(orgKey);
      if (cached && Date.now() - cached.ts < TTL && cached.tokenUsage?.length) {
        setTokenUsage(cached.tokenUsage);
        return;
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/credits/usage?organization_id=${organization.id}&limit=${limit}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        // Se endpoint não existe ainda, retornar array vazio (pode ser implementado depois)
        if (response.status === 404) {
          setTokenUsage([]);
          return;
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch token usage: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const usage = result.usage || result.data || [];
      setTokenUsage(usage);
      const cachedNow = cache.get(orgKey) || { ts: 0, credits: null, tokenUsage: [], transactions: [] };
      cache.set(orgKey, { ...cachedNow, ts: Date.now(), tokenUsage: usage });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTransactions = async (limit = 50) => {
    if (!organization?.id) return;

    try {
      // ✅ Cache: opcional (menos crítico). Reutilizar se válido
      const cached = cache.get(orgKey);
      if (cached && Date.now() - cached.ts < TTL && cached.transactions?.length) {
        setTransactions(cached.transactions);
        return;
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/credits/transactions?organization_id=${organization.id}&limit=${limit}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        // Se endpoint não existe ainda, retornar array vazio (pode ser implementado depois)
        if (response.status === 404) {
          setTransactions([]);
          return;
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch transactions: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const data = result.transactions || result.data || [];
      
      // Type-safe mapping
      const typedTransactions: CreditTransaction[] = (data || []).map((item: any) => ({
        id: item.id,
        transaction_type: item.transaction_type as 'purchase' | 'usage' | 'refund',
        credits_amount: item.credits_amount,
        cost_usd: item.cost_usd,
        payment_status: item.payment_status as 'pending' | 'completed' | 'failed' | 'refunded',
        description: item.description,
        created_at: item.created_at,
        user_id: item.user_id
      }));
      
      setTransactions(typedTransactions);
      const cachedNow = cache.get(orgKey) || { ts: 0, credits: null, tokenUsage: [], transactions: [] };
      cache.set(orgKey, { ...cachedNow, ts: Date.now(), transactions: typedTransactions });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const purchaseCredits = async (creditsAmount: number, costUsd: number) => {
    if (!user || !organization?.id) throw new Error('User or organization not found');

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/ai/credits/purchase`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          organization_id: organization.id,
          credits_amount: creditsAmount,
          user_id: user.id,
          cost_usd: costUsd
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to purchase credits: ${response.statusText} - ${errorText}`);
      }

      // Recarregar dados
      await fetchCredits();
      await fetchTransactions();

      return { success: true };
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getUsageStats = () => {
    if (!tokenUsage.length) return null;

    const today = new Date().toDateString();
    const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return {
      today: tokenUsage.filter(u => new Date(u.created_at).toDateString() === today)
        .reduce((sum, u) => sum + u.cost_in_credits, 0),
      thisWeek: tokenUsage.filter(u => new Date(u.created_at) >= thisWeek)
        .reduce((sum, u) => sum + u.cost_in_credits, 0),
      thisMonth: tokenUsage.filter(u => new Date(u.created_at) >= thisMonth)
        .reduce((sum, u) => sum + u.cost_in_credits, 0),
      byModel: tokenUsage.reduce((acc, u) => {
        acc[u.model_used] = (acc[u.model_used] || 0) + u.cost_in_credits;
        return acc;
      }, {} as Record<string, number>),
      byUser: tokenUsage.reduce((acc, u) => {
        if (u.user_id) {
          acc[u.user_id] = (acc[u.user_id] || 0) + u.cost_in_credits;
        }
        return acc;
      }, {} as Record<string, number>)
    };
  };

  useEffect(() => {
    if (organization?.id) {
      // Primeiro tenta cache para resposta instantânea
      const cached = cache.get(orgKey);
      if (cached && Date.now() - cached.ts < TTL) {
        setCredits(cached.credits || null);
        setTokenUsage(cached.tokenUsage || []);
        setTransactions(cached.transactions || []);
        setLoading(false);
        // Atualiza em background
        Promise.all([fetchCredits(), fetchTokenUsage()]).catch(() => {}).finally(() => {});
      } else {
        Promise.all([fetchCredits(), fetchTokenUsage()]).finally(() => {
          setLoading(false);
        });
      }
    }
  }, [organization?.id]);

  return {
    credits,
    tokenUsage,
    transactions,
    loading,
    error,
    purchaseCredits,
    getUsageStats,
    refetch: () => {
      fetchCredits();
      fetchTokenUsage();
      fetchTransactions();
    }
  };
};
