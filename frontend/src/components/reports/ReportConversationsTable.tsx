import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Eye, FileText, Download, MessageCircle, AlertTriangle } from 'lucide-react';
import type { ConversationReport } from '@/types/reports';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportConversationsTableProps {
  conversations: ConversationReport[];
  onViewDetail: (conversation: ConversationReport) => void;
  onExport: (conversation: ConversationReport, format: 'pdf' | 'excel') => void;
  onAnalyzeAI: (conversation: ConversationReport) => void;
  loading?: boolean;
}

const statusColors: Record<string, string> = {
  attended: 'bg-green-100 text-green-800',
  closed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-blue-50 text-blue-600',
  unattended: 'bg-red-100 text-red-800',
  chatbot: 'bg-yellow-100 text-yellow-800',
};

const statusLabels: Record<string, string> = {
  attended: 'Atendida',
  closed: 'Encerrada',
  in_progress: 'Em andamento',
  unattended: 'Não atendida',
  chatbot: 'Chatbot',
};

export const ReportConversationsTable: React.FC<ReportConversationsTableProps> = ({
  conversations,
  onViewDetail,
  onExport,
  onAnalyzeAI,
  loading = false
}) => {
  return (
    <div className="overflow-x-auto rounded shadow border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Data/Hora</TableHead>
            <TableHead className="text-center">Cliente</TableHead>
            <TableHead className="text-center">Canal</TableHead>
            <TableHead className="text-center">Número</TableHead>
            <TableHead className="text-center">Operador</TableHead>
            <TableHead className="text-center">Duração</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Tags</TableHead>
            <TableHead className="text-center">Total de Mensagens</TableHead>
            <TableHead className="text-center">Opções</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                Nenhuma conversa encontrada para os filtros selecionados.
              </TableCell>
            </TableRow>
          )}
          {conversations.map((conv) => (
            <TableRow key={conv.id} className="text-center">
              <TableCell>
                {(() => {
                  try {
                    const date = conv.startTime instanceof Date ? conv.startTime : new Date(conv.startTime);
                    if (isNaN(date.getTime())) {
                      return 'Data inválida';
                    }
                    return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
                  } catch (error) {
                    console.error('Erro ao formatar data:', conv.startTime, error);
                    return 'Data inválida';
                  }
                })()}
              </TableCell>
              <TableCell>{conv.customerName}</TableCell>
              <TableCell className="capitalize">
                <div className="flex items-center gap-2 justify-center">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  {conv.channel}
                </div>
              </TableCell>
              <TableCell>{conv.customerPhone || '-'}</TableCell>
              <TableCell>{conv.agentName || '-'}</TableCell>
              <TableCell>
                {Math.floor(conv.duration / 60)}min
              </TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded text-xs ${statusColors[conv.status] || 'bg-gray-100 text-gray-800'}`}>{statusLabels[conv.status] || conv.status}</span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 justify-center">
                  {conv.tags && conv.tags.length > 0 ? conv.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  )) : <span className="text-xs text-muted-foreground">-</span>}
                </div>
              </TableCell>
              <TableCell>{conv.totalMessages}</TableCell>
              <TableCell>
                <TooltipProvider>
                  <div className="flex gap-2 justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => onViewDetail(conv)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver detalhes</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => onAnalyzeAI(conv)}>
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Analisar com IA</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => onExport(conv, 'pdf')}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Exportar PDF</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => onExport(conv, 'excel')}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Exportar Excel</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mr-4" />
          <span className="text-muted-foreground">Carregando conversas...</span>
        </div>
      )}
    </div>
  );
}; 