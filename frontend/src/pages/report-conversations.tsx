import React, { useState, useEffect } from 'react';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportStats, ReportDetailedStats } from '@/components/reports/ReportStats';
import { ReportConversationsTable } from '@/components/reports/ReportConversationsTable';
import { ReportConversationDetail } from '@/components/reports/ReportConversationDetail';
import { useConversationReports } from '@/hooks/useConversationReports';
import { ExportOptions, ConversationReport } from '@/types/reports';
import { Alert } from '@/components/ui/alert';
import { FileText, Download, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';

const ReportConversations: React.FC = () => {
  const {
    conversations,
    stats,
    loading,
    selectedConversation,
    filters,
    setFilters,
    applyFilters,
    fetchConversations,
    fetchConversationDetail,
    analyzeConversationWithAI,
    exportReport,
    setSelectedConversation
  } = useConversationReports();

  const { organization } = useOrganization();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Handlers
  const handleGenerateReport = () => {
    try {
      setError(null);
      setHasGenerated(true);
      console.log('[Página] Gerando relatório com filtros:', filters);
      console.log('[Página] Keywords nos filtros:', filters.keywords);
      fetchConversations({ ...filters });
    } catch (e) {
      setError('Erro ao gerar relatório. Tente novamente.');
    }
  };

  const handleSearch = () => {
    if (!hasGenerated) {
      handleGenerateReport();
    } else {
      try {
        setError(null);
        console.log('[Página] Buscando com filtros:', filters);
        console.log('[Página] Keywords nos filtros:', filters.keywords);
        fetchConversations({ ...filters });
      } catch (e) {
        setError('Erro ao buscar conversas. Tente novamente.');
      }
    }
  };

  const handleClear = () => {
    try {
      const defaultFilters = {
        dateRange: {
          start: new Date(), // Alterado: apenas o dia atual
          end: new Date()    // Alterado: apenas o dia atual
        }
      };
      setFilters(defaultFilters);
      setHasGenerated(false);
      setError(null);
    } catch (e) {
      setError('Erro ao limpar filtros.');
    }
  };

  const handleViewDetail = async (conv: ConversationReport) => {
    console.log('[DEBUG] Ver detalhes clicado:', conv);
    setDetailLoading(true);
    try {
      await fetchConversationDetail(conv.id);
      setDetailOpen(true);
      setError(null);
    } catch (e) {
      setError('Erro ao carregar detalhes da conversa.');
    }
    setDetailLoading(false);
  };

  const handleExport = (conv: ConversationReport, format: 'pdf' | 'excel') => {
    try {
      exportReport({
        format,
        includeDetails: true,
        includeAI: true,
        includeStats: true,
        filters,
      });
      setError(null);
    } catch (e) {
      setError('Erro ao exportar relatório.');
    }
  };

  const handleAnalyzeAI = async (conv: ConversationReport) => {
    try {
      await analyzeConversationWithAI(conv.id);
      if (selectedConversation && selectedConversation.conversation.id === conv.id) {
        await fetchConversationDetail(conv.id);
      }
      setError(null);
    } catch (e) {
      setError('Erro ao analisar conversa com IA.');
    }
  };

  // Fallback visual para ausência de dados ou organização
  const hasData = Array.isArray(conversations) && conversations.length > 0;
  const hasOrganization = organization?.id;

  return (
    <PermissionGuard requiredPermissions={['view_conversation_report']}>
      <ErrorBoundary>
        <div className="p-8 max-w-screen-2xl mx-auto">
          <h1 className="text-2xl mb-6">Relatório Geral de Conversas</h1>
          


          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {error}
            </Alert>
          )}

          {/* Filtros */}
          <ReportFilters
            filters={filters}
            onFiltersChange={applyFilters}
            onSearch={handleSearch}
            onClear={handleClear}
            loading={loading}
          />

          {/* Botão Gerar Relatório */}
          {!hasGenerated && (
            <div className="mb-6 flex justify-center">
              <Button
                onClick={handleGenerateReport}
                disabled={loading || !hasOrganization}
                className="flex items-center gap-2"
                size="lg"
              >
                <Search className="h-5 w-5" />
                {loading ? 'Gerando...' : 'Gerar Relatório'}
              </Button>
            </div>
          )}

          {/* Estatísticas - Só mostrar se já foi gerado */}
          {hasGenerated && stats && (
            <>
              <ReportStats stats={stats} className="mb-8" />
              <ReportDetailedStats stats={stats} className="mb-8" />
            </>
          )}

          {/* Botões de ação - Só mostrar se já foi gerado */}
          {hasGenerated && hasData && (
            <div className="flex items-center gap-2 mb-4">
              <Button
                onClick={() => exportReport({
                  format: 'excel',
                  includeDetails: true,
                  includeAI: true,
                  includeStats: true,
                  filters,
                })}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> Exportar Excel
              </Button>
              <Button
                onClick={() => exportReport({
                  format: 'pdf',
                  includeDetails: true,
                  includeAI: true,
                  includeStats: true,
                  filters,
                })}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" /> Exportar PDF
              </Button>
              <Button
                onClick={handleSearch}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
            </div>
          )}

          {/* Estado vazio - Só mostrar se já foi gerado */}
          {hasGenerated && !hasData && !loading && hasOrganization && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-4 text-yellow-500" />
              <div className="text-lg mb-2">Nenhuma conversa encontrada</div>
              <div className="mb-2">Não há conversas para os filtros selecionados ou sua organização ainda não possui dados.</div>
              <div className="text-xs">Dica: inicie conversas ou ajuste os filtros para visualizar resultados.</div>
            </div>
          )}

          {/* Estado sem organização */}
          {!hasOrganization && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mb-4 text-yellow-500" />
              <div className="text-lg mb-2">Organização não encontrada</div>
              <div className="mb-2">Você precisa estar associado a uma organização para visualizar relatórios.</div>
            </div>
          )}

          {/* Tabela de conversas - Só mostrar se já foi gerado */}
          {hasGenerated && (
            <ReportConversationsTable
              conversations={conversations}
              onViewDetail={handleViewDetail}
              onExport={handleExport}
              onAnalyzeAI={handleAnalyzeAI}
              loading={loading}
            />
          )}

          {/* Modal de detalhes */}
          <ReportConversationDetail
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
            detail={selectedConversation}
            onExport={(format) => {
              if (selectedConversation) handleExport(selectedConversation.conversation, format);
            }}
            onAnalyzeAI={async () => {
              if (selectedConversation) await handleAnalyzeAI(selectedConversation.conversation);
            }}
            loading={detailLoading}
          />
        </div>
      </ErrorBoundary>
    </PermissionGuard>
  );
};

export default ReportConversations; 