import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Smile, 
  AlertTriangle, 
  TrendingUp,
  Star,
  CheckCircle,
  Heart,
  Frown
} from 'lucide-react';

interface SentimentAnalysisCardProps {
  sentimentData: {
    positive?: number;
    negative?: number;
    neutral?: number;
    overall_sentiment?: string;
    sentiment_score?: number;
    positive_percentage?: number;
    neutral_percentage?: number;
    negative_percentage?: number;
    sentiment_breakdown?: {
      positive: string[];
      negative: string[];
      neutral: string[];
    };
  } | null;
}

export const SentimentAnalysisCard: React.FC<SentimentAnalysisCardProps> = ({
  sentimentData
}) => {
  if (!sentimentData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-blue-600" />
            Análise de Sentimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Dados de sentimento serão exibidos aqui após gerar o relatório.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Função para calcular score visual de 0 a 5
  const getVisualScore = () => {
    const positive = sentimentData.positive_percentage || sentimentData.positive || 0;
    const negative = sentimentData.negative_percentage || sentimentData.negative || 0;
    const neutral = sentimentData.neutral_percentage || sentimentData.neutral || 0;
    
    // Calcular score baseado na diferença entre positivo e negativo
    // Neutro contribui menos para o score
    const score = ((positive - negative) / 100) * 2.5 + 2.5; // Escala de 0-5
    return Math.max(0, Math.min(5, score));
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-500';
    if (score >= 2) return 'text-orange-500';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 4.5) return 'Excelente';
    if (score >= 3.5) return 'Muito Bom';
    if (score >= 2.5) return 'Bom';
    if (score >= 1.5) return 'Regular';
    return 'Precisa Melhorar';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-blue-600" />
          Análise de Sentimento
          <Badge variant="secondary" className="ml-auto">
            IA
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Sentimento Geral */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg">Sentimento Geral</h4>
            </div>
            
            {/* Escala Visual de 0 a 5 */}
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-4xl ${getScoreColor(getVisualScore())}`}>
                  {getVisualScore().toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {getScoreLabel(getVisualScore())}
                </div>
                
                {/* Escala de Estrelas */}
                <div className="flex justify-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const score = getVisualScore();
                    const isActive = star <= score;
                    const isHalfActive = star - 0.5 <= score && score < star;
                    
                    return (
                      <div key={star} className="relative">
                        <Star 
                          className={`h-6 w-6 ${
                            isActive ? 'text-yellow-500 fill-yellow-500' : 
                            isHalfActive ? 'text-yellow-500 fill-yellow-500 opacity-50' : 
                            'text-gray-300'
                          }`} 
                        />
                        {isHalfActive && (
                          <div className="absolute inset-0 overflow-hidden w-1/2">
                            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Barra de Progresso Visual */}
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      getVisualScore() >= 4 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                      getVisualScore() >= 3 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                      getVisualScore() >= 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{ width: `${(getVisualScore() / 5) * 100}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>2.5</span>
                  <span>5.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Exemplos de Sentimentos */}
          {sentimentData.sentiment_breakdown && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Positivo */}
              {sentimentData.sentiment_breakdown.positive.length > 0 && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <h5 className="text-green-800 mb-2 flex items-center gap-2">
                    <Smile className="h-4 w-4" />
                    Exemplos Positivos
                  </h5>
                  <ul className="space-y-1">
                    {sentimentData.sentiment_breakdown.positive.slice(0, 3).map((example, index) => (
                      <li key={index} className="text-sm text-green-700">
                        • {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Neutro */}
              {sentimentData.sentiment_breakdown.neutral.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <h5 className="text-yellow-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Exemplos Neutros
                  </h5>
                  <ul className="space-y-1">
                    {sentimentData.sentiment_breakdown.neutral.slice(0, 3).map((example, index) => (
                      <li key={index} className="text-sm text-yellow-700">
                        • {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Negativo */}
              {sentimentData.sentiment_breakdown.negative.length > 0 && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <h5 className="text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Exemplos Negativos
                  </h5>
                  <ul className="space-y-1">
                    {sentimentData.sentiment_breakdown.negative.slice(0, 3).map((example, index) => (
                      <li key={index} className="text-sm text-red-700">
                        • {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 