import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Star,
  RefreshCw
} from 'lucide-react';

interface AIInsightsCardProps {
  insights: string | null;
  executiveSummary?: string | null;
  operationalStrengths?: string | null;
  criticalImprovementAreas?: string | null;
  strategicRecommendations?: {
    immediate?: string[];
    short_term?: string[];
    long_term?: string[];
  } | null;
  trendsAndPatterns?: string | null;
  recommendations?: {
    immediate?: string[];
    short_term?: string[];
    long_term?: string[];
  } | null;
  dateRange?: {
    start: string;
    end: string;
  };
  onGenerate: () => void;
  generating: boolean;
}

export const AIInsightsCard: React.FC<AIInsightsCardProps> = ({
  insights,
  executiveSummary,
  operationalStrengths,
  criticalImprovementAreas,
  strategicRecommendations,
  trendsAndPatterns,
  recommendations,
  dateRange,
  onGenerate,
  generating
}) => {

  // Função para limpar formatação Markdown dos insights
  const cleanMarkdownFormatting = (text: string) => {
    if (!text) return text;
    
    return text
      // Remover cabeçalhos Markdown (###, ##, #)
      .replace(/^#{1,6}\s*/gm, '')
      // Remover negrito Markdown (**texto** ou __texto__)
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      // Remover itálico Markdown (*texto* ou _texto_)
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remover links Markdown [texto](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remover código inline `código`
      .replace(/`([^`]+)`/g, '$1')
      // Remover listas Markdown (-, *, +)
      .replace(/^[-*+]\s*/gm, '• ')
      // Limpar espaços extras
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  };

  const parseInsights = (insightsText: string) => {
    // Limpar formatação Markdown antes de processar
    const cleanedText = cleanMarkdownFormatting(insightsText);
    
    const sections = {
      resumo: '',
      pontosPositivos: [] as string[],
      areasMelhoria: [] as string[],
      recomendacoes: [] as string[],
      tendencias: [] as string[]
    };

    const lines = cleanedText.split('\n');
    let currentSection = '';

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      if (trimmedLine.toLowerCase().includes('resumo executivo') || 
          trimmedLine.toLowerCase().includes('resumo')) {
        currentSection = 'resumo';
      } else if (trimmedLine.toLowerCase().includes('pontos positivos') || 
                 trimmedLine.toLowerCase().includes('positivos')) {
        currentSection = 'pontosPositivos';
      } else if (trimmedLine.toLowerCase().includes('áreas de melhoria') || 
                 trimmedLine.toLowerCase().includes('melhoria') ||
                 trimmedLine.toLowerCase().includes('melhorias')) {
        currentSection = 'areasMelhoria';
      } else if (trimmedLine.toLowerCase().includes('recomendações') || 
                 trimmedLine.toLowerCase().includes('ações') ||
                 trimmedLine.toLowerCase().includes('sugestões')) {
        currentSection = 'recomendacoes';
      } else if (trimmedLine.toLowerCase().includes('tendências') || 
                 trimmedLine.toLowerCase().includes('tendencia')) {
        currentSection = 'tendencias';
      } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
        const item = trimmedLine.replace(/^[-•*]\s*/, '');
        if (currentSection === 'pontosPositivos') {
          sections.pontosPositivos.push(item);
        } else if (currentSection === 'areasMelhoria') {
          sections.areasMelhoria.push(item);
        } else if (currentSection === 'recomendacoes') {
          sections.recomendacoes.push(item);
        } else if (currentSection === 'tendencias') {
          sections.tendencias.push(item);
        }
      } else if (currentSection === 'resumo') {
        sections.resumo += (sections.resumo ? ' ' : '') + trimmedLine;
      }
    });

    return sections;
  };

  // Usar os novos campos ou fallback para insights antigo
  const hasNewFormat = executiveSummary || operationalStrengths || criticalImprovementAreas || trendsAndPatterns;
  const finalRecommendations = strategicRecommendations || recommendations;

  if (!insights && !hasNewFormat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Análise com Inteligência Artificial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg mb-2">Análise Inteligente</h3>
            <p className="text-muted-foreground mb-4">
              Clique em "Gerar Relatório IA" para obter insights personalizados baseados nos seus dados reais.
            </p>
            {dateRange && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                📅 Período: {new Date(dateRange.start).toLocaleDateString('pt-BR')} até {new Date(dateRange.end).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card 1: RESUMO EXECUTIVO ESTRATÉGICO */}
      {(executiveSummary || insights) && (executiveSummary || insights || '').trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              RESUMO EXECUTIVO ESTRATÉGICO
              {dateRange && (
                <Badge variant="secondary" className="ml-auto">
                  📅 {new Date(dateRange.start).toLocaleDateString('pt-BR')} - {new Date(dateRange.end).toLocaleDateString('pt-BR')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {cleanMarkdownFormatting(executiveSummary || insights || '')}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 2: PONTOS FORTES OPERACIONAIS */}
      {operationalStrengths && operationalStrengths.trim && operationalStrengths.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              PONTOS FORTES OPERACIONAIS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-green-800">
                {cleanMarkdownFormatting(operationalStrengths)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 3: ÁREAS CRÍTICAS DE MELHORIA */}
      {criticalImprovementAreas && criticalImprovementAreas.trim && criticalImprovementAreas.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ÁREAS CRÍTICAS DE MELHORIA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-red-800">
                {cleanMarkdownFormatting(criticalImprovementAreas)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 4: RECOMENDAÇÕES ESTRATÉGICAS ACIONÁVEIS */}
      {finalRecommendations && (
        (finalRecommendations.immediate && finalRecommendations.immediate.length > 0) ||
        (finalRecommendations.short_term && finalRecommendations.short_term.length > 0) ||
        (finalRecommendations.long_term && finalRecommendations.long_term.length > 0)
      ) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-600" />
              RECOMENDAÇÕES ESTRATÉGICAS ACIONÁVEIS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ações Imediatas */}
              {finalRecommendations.immediate && finalRecommendations.immediate.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
                  <h5 className="text-red-800 mb-2">Ações Imediatas</h5>
                  <ul className="text-red-700 text-sm space-y-2">
                    {finalRecommendations.immediate.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Melhorias Curto Prazo */}
              {finalRecommendations.short_term && finalRecommendations.short_term.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                  <h5 className="text-yellow-800 mb-2">Curto Prazo</h5>
                  <ul className="text-yellow-700 text-sm space-y-2">
                    {finalRecommendations.short_term.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Estratégias Longo Prazo */}
              {finalRecommendations.long_term && finalRecommendations.long_term.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                  <h5 className="text-green-800 mb-2">Longo Prazo</h5>
                  <ul className="text-green-700 text-sm space-y-2">
                    {finalRecommendations.long_term.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 5: TENDÊNCIAS E PADRÕES OPERACIONAIS */}
      {trendsAndPatterns && trendsAndPatterns.trim && trendsAndPatterns.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              TENDÊNCIAS E PADRÕES OPERACIONAIS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-indigo-800">
                {cleanMarkdownFormatting(trendsAndPatterns)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 