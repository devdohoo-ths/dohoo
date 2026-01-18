import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export interface AIReportHistory {
  id: string;
  report_name: string;
  date_start: string;
  date_end: string;
  total_messages: number;
  total_agents: number;
  sentiment_analysis: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topic_analysis: Record<string, number>;
  insights: string;
  created_at: string;
  updated_at: string;
}

export interface SaveAIReportData {
  reportName: string;
  dateStart: string;
  dateEnd: string;
  reportData: any;
  totalMessages: number;
  totalAgents: number;
  sentimentAnalysis: any;
  topicAnalysis: any;
  insights: string;
}

export const useAIReportsHistory = () => {
  const [reports, setReports] = useState<AIReportHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar histórico de relatórios
  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/reports/ai-history`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar histórico');
      }

      const data = await response.json();
      
      if (data.success) {
        setReports(data.reports || []);
      } else {
        throw new Error(data.error || 'Erro ao buscar histórico');
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Salvar relatório no histórico
  const saveReport = async (reportData: SaveAIReportData) => {
    try {
      setLoading(true);
      setError(null);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/reports/save-ai-report`, {
        method: 'POST',
        headers,
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar relatório');
      }

      const data = await response.json();
      
      if (data.success) {
        // Atualizar lista após salvar
        await fetchHistory();
        return data.report;
      } else {
        throw new Error(data.error || 'Erro ao salvar relatório');
      }
    } catch (err) {
      console.error('Erro ao salvar relatório:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Buscar relatório específico
  const getReport = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/reports/ai-history/${id}`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar relatório');
      }

      const data = await response.json();
      
      if (data.success) {
        return data.report;
      } else {
        throw new Error(data.error || 'Erro ao buscar relatório');
      }
    } catch (err) {
      console.error('Erro ao buscar relatório:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Deletar relatório do histórico
  const deleteReport = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // ✅ CORRIGIDO: Usar getAuthHeaders()
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/reports/ai-history/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar relatório');
      }

      const data = await response.json();
      
      if (data.success) {
        // Atualizar lista após deletar
        await fetchHistory();
        return true;
      } else {
        throw new Error(data.error || 'Erro ao deletar relatório');
      }
    } catch (err) {
      console.error('Erro ao deletar relatório:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico ao inicializar
  useEffect(() => {
    fetchHistory();
  }, []);

  return {
    reports,
    loading,
    error,
    fetchHistory,
    saveReport,
    getReport,
    deleteReport
  };
}; 