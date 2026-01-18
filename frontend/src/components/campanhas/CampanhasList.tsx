import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Eye, 
  Edit, 
  Trash2, 
  Brain, 
  Users, 
  MessageSquare,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCampanhas } from '@/hooks/useCampanhas';
import { CampanhaDetalhes } from './CampanhaDetalhes';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Campanha {
  id: string;
  nome: string;
  status: 'rascunho' | 'em_execucao' | 'finalizada' | 'erro' | 'pausada';
  total_destinatarios: number;
  enviados: number;
  respondidos: number;
  usar_ia: boolean;
  data_inicio: string;
  data_fim?: string;
  criado_em: string;
  template: {
    id: string;
    nome: string;
    conteudo: string;
  };
  created_by_profile: {
    id: string;
    name: string;
    email: string;
  };
}

const statusColors = {
  rascunho: 'secondary',
  em_execucao: 'default',
  finalizada: 'success',
  erro: 'destructive',
  pausada: 'warning'
} as const;

const statusLabels = {
  rascunho: 'Rascunho',
  em_execucao: 'Em Execução',
  finalizada: 'Finalizada',
  erro: 'Erro',
  pausada: 'Pausada'
};

export function CampanhasList() {
  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null);
  const { campanhas, isLoading, error, iniciarCampanha, pausarCampanha, retomarCampanha } = useCampanhas();
  const { reiniciarCampanha, isRestarting } = useCampanhas() as any;

  const handleAction = async (campanhaId: string, action: 'start' | 'pause' | 'resume') => {
    try {
      switch (action) {
        case 'start':
          await iniciarCampanha(campanhaId);
          break;
        case 'pause':
          await pausarCampanha(campanhaId);
          break;
        case 'resume':
          await retomarCampanha(campanhaId);
          break;
      }
    } catch (error) {
      console.error('Erro na ação da campanha:', error);
    }
  };

  const getProgressPercentage = (campanha: Campanha) => {
    if (campanha.total_destinatarios === 0) return 0;
    return (campanha.enviados / campanha.total_destinatarios) * 100;
  };

  const getTaxaResposta = (campanha: Campanha) => {
    if (campanha.enviados === 0) return 0;
    return (campanha.respondidos / campanha.enviados) * 100;
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erro ao carregar campanhas. Tente novamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!campanhas || campanhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg mb-2">Nenhuma campanha encontrada</h3>
          <p className="text-muted-foreground text-center mb-4">
            Crie sua primeira campanha inteligente para começar a enviar mensagens personalizadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campanhas.map((campanha: Campanha) => (
          <Card key={campanha.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {campanha.nome}
                    {campanha.usar_ia && (
                      <Brain className="h-4 w-4 text-purple-500" title="IA Ativada" />
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {campanha.template.nome}
                  </p>
                </div>
                <Badge variant={statusColors[campanha.status]}>
                  {statusLabels[campanha.status]}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Progresso */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{campanha.enviados}/{campanha.total_destinatarios}</span>
                </div>
                <Progress value={getProgressPercentage(campanha)} className="h-2" />
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>{campanha.total_destinatarios} contatos</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span>{getTaxaResposta(campanha).toFixed(1)}% resposta</span>
                </div>
              </div>

              {/* Data */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {campanha.data_inicio 
                    ? format(new Date(campanha.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                    : 'Não iniciada'
                  }
                </span>
              </div>

              {/* Ações - responsivo */}
              <div className="flex flex-wrap gap-2 pt-2 sm:flex-nowrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCampanha(campanha.id)}
                  className="flex items-center gap-1 w-full sm:w-auto"
                >
                  <Eye className="h-3 w-3" />
                  Ver
                </Button>

                {campanha.status === 'rascunho' && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(campanha.id, 'start')}
                    className="flex items-center gap-1 w-full sm:w-auto"
                  >
                    <Play className="h-3 w-3" />
                    Iniciar
                  </Button>
                )}

                {campanha.status === 'em_execucao' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(campanha.id, 'pause')}
                    className="flex items-center gap-1 w-full sm:w-auto"
                  >
                    <Pause className="h-3 w-3" />
                    Pausar
                  </Button>
                )}

                {campanha.status === 'pausada' && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(campanha.id, 'resume')}
                    className="flex items-center gap-1 w-full sm:w-auto"
                  >
                    <Play className="h-3 w-3" />
                    Retomar
                  </Button>
                )}

                {(campanha.status === 'finalizada' || campanha.status === 'pausada' || campanha.status === 'erro') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reiniciarCampanha(campanha.id)}
                    className="flex items-center gap-1 w-full sm:w-auto"
                    disabled={isRestarting}
                  >
                    {/* ícone simples de reinício */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                      <path d="M12 5V1l5 5-5 5V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z" />
                    </svg>
                    {isRestarting ? 'Reiniciando...' : 'Reiniciar'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedCampanha && (
        <CampanhaDetalhes
          campanhaId={selectedCampanha}
          open={!!selectedCampanha}
          onOpenChange={(open) => !open && setSelectedCampanha(null)}
        />
      )}
    </>
  );
}
