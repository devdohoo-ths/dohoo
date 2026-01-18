import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Tag, 
  TrendingUp, 
  MessageSquare, 
  BarChart3,
  Sparkles,
  Hash,
  Activity,
  Zap
} from 'lucide-react';

interface Topic {
  name: string;
  description?: string;
  frequency?: string;
  keywords?: string[];
  count?: number;
  occurrences?: number;
}

interface TopicAnalysisCardProps {
  topicData: { 
    topics?: Topic[];
    [key: string]: any; // Para aceitar estrutura do backend onde topicAnalysis é um objeto
  } | null;
}

export const TopicAnalysisCard: React.FC<TopicAnalysisCardProps> = ({ topicData }) => {
  // Converter estrutura do backend para formato esperado
  const normalizeTopics = (): Topic[] => {
    if (!topicData) return [];
    
    // Se já tem topics como array
    if (topicData.topics && Array.isArray(topicData.topics)) {
      return topicData.topics;
    }
    
    // Se topicData é um objeto com chaves sendo nomes de tópicos e valores sendo números
    const topics: Topic[] = [];
    Object.entries(topicData).forEach(([key, value]) => {
      if (typeof value === 'number') {
        topics.push({
          name: key,
          count: value,
          occurrences: value,
          frequency: value > 50 ? 'Alta' : value > 20 ? 'Média' : 'Baixa',
          keywords: []
        });
      }
    });
    
    // Ordenar por frequência (maior para menor)
    return topics.sort((a, b) => (b.count || b.occurrences || 0) - (a.count || a.occurrences || 0));
  };

  const topics = normalizeTopics();

  // Calcular estatísticas gerais
  const totalOccurrences = topics.reduce((sum, topic) => sum + (topic.count || topic.occurrences || 0), 0);
  const maxOccurrences = topics.length > 0 ? Math.max(...topics.map(t => t.count || t.occurrences || 0)) : 0;

  // Função para obter cor baseada na frequência
  const getTopicColor = (topic: Topic) => {
    const count = topic.count || topic.occurrences || 0;
    const percentage = maxOccurrences > 0 ? (count / maxOccurrences) * 100 : 0;
    
    if (percentage >= 70) return 'from-red-500 to-orange-500';
    if (percentage >= 40) return 'from-blue-500 to-indigo-500';
    if (percentage >= 20) return 'from-green-500 to-emerald-500';
    return 'from-purple-500 to-pink-500';
  };

  // Função para obter cor de fundo
  const getTopicBgColor = (topic: Topic) => {
    const count = topic.count || topic.occurrences || 0;
    const percentage = maxOccurrences > 0 ? (count / maxOccurrences) * 100 : 0;
    
    if (percentage >= 70) return 'bg-red-50 border-red-200';
    if (percentage >= 40) return 'bg-blue-50 border-blue-200';
    if (percentage >= 20) return 'bg-green-50 border-green-200';
    return 'bg-purple-50 border-purple-200';
  };

  // Função para obter ícone baseado no nome do tópico
  const getTopicIcon = (topicName: string) => {
    const name = topicName.toLowerCase();
    if (name.includes('problema') || name.includes('erro') || name.includes('bug')) {
      return <Activity className="h-5 w-5 text-red-600" />;
    }
    if (name.includes('venda') || name.includes('compra') || name.includes('pagamento')) {
      return <TrendingUp className="h-5 w-5 text-green-600" />;
    }
    if (name.includes('atendimento') || name.includes('suporte') || name.includes('ajuda')) {
      return <MessageSquare className="h-5 w-5 text-blue-600" />;
    }
    if (name.includes('reclamação') || name.includes('insatisfeito')) {
      return <Zap className="h-5 w-5 text-orange-600" />;
    }
    return <Tag className="h-5 w-5 text-purple-600" />;
  };

  if (!topicData || topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-600" />
            Análise de Tópicos e Temas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Sparkles className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg mb-2">Nenhum Tópico Identificado</h3>
            <p className="text-muted-foreground">
              Os tópicos e temas identificados nas conversas serão exibidos aqui após gerar o relatório.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de Estatísticas Gerais */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Estatísticas de Tópicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">Total de Tópicos</span>
              </div>
              <div className="text-3xl text-blue-600">{topics.length}</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-indigo-600" />
                <span className="text-sm text-indigo-800">Total de Ocorrências</span>
              </div>
              <div className="text-3xl text-indigo-600">{totalOccurrences}</div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-800">Tópico Mais Frequente</span>
              </div>
              <div className="text-lg text-purple-600 truncate">
                {topics[0]?.name || 'N/A'}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {topics[0] ? (topics[0].count || topics[0].occurrences || 0) : 0} ocorrências
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Tópicos Individuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topics.map((topic, idx) => {
          const count = topic.count || topic.occurrences || 0;
          const percentage = maxOccurrences > 0 ? (count / maxOccurrences) * 100 : 0;
          const frequency = topic.frequency || (count > 50 ? 'Alta' : count > 20 ? 'Média' : 'Baixa');
          
          return (
            <Card 
              key={idx} 
              className={`${getTopicBgColor(topic)} border-2 hover:shadow-lg transition-all duration-300 hover:scale-105`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {getTopicIcon(topic.name)}
                    <CardTitle className="text-lg text-gray-800 line-clamp-2">
                      {topic.name}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Estatísticas do Tópico */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Ocorrências</span>
                    <Badge 
                      variant="secondary" 
                      className={`bg-gradient-to-r ${getTopicColor(topic)} text-white border-0`}
                    >
                      {count}
                    </Badge>
                  </div>
                  
                  {/* Barra de Progresso Visual */}
                  <div className="space-y-1">
                    <Progress 
                      value={percentage} 
                      className="h-3 bg-gray-200"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{percentage.toFixed(1)}% do máximo</span>
                      <Badge 
                        variant="outline" 
                        className={
                          frequency === 'Alta' ? 'border-red-300 text-red-700 bg-red-50' :
                          frequency === 'Média' ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
                          'border-gray-300 text-gray-700 bg-gray-50'
                        }
                      >
                        {frequency}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Descrição */}
                {topic.description && (
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {topic.description}
                  </p>
                )}

                {/* Palavras-chave */}
                {topic.keywords && topic.keywords.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Hash className="h-3 w-3" />
                      Palavras-chave
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {topic.keywords.slice(0, 4).map((keyword, keyIdx) => (
                        <Badge 
                          key={keyIdx} 
                          variant="outline" 
                          className="text-xs bg-white/50 border-gray-300 text-gray-700"
                        >
                          {keyword}
                        </Badge>
                      ))}
                      {topic.keywords.length > 4 && (
                        <Badge variant="outline" className="text-xs bg-white/50 border-gray-300 text-gray-700">
                          +{topic.keywords.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Indicador Visual de Importância */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 mb-1">Relevância</div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className={`h-2 w-2 rounded-full ${
                            star <= Math.ceil(percentage / 20)
                              ? 'bg-gradient-to-r ' + getTopicColor(topic)
                              : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Rank</div>
                    <div className="text-lg text-gray-800">#{idx + 1}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Card de Resumo Visual */}
      {topics.length > 0 && (
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Distribuição de Tópicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topics.slice(0, 5).map((topic, idx) => {
                const count = topic.count || topic.occurrences || 0;
                const percentage = totalOccurrences > 0 ? (count / totalOccurrences) * 100 : 0;
                
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-700 truncate">
                      {topic.name}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${getTopicColor(topic)} rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-700 w-16 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="w-12 text-center">
                      {count}
                    </Badge>
                  </div>
                );
              })}
              {topics.length > 5 && (
                <div className="text-center text-sm text-gray-600 pt-2">
                  +{topics.length - 5} tópico(s) adicional(is)
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
