
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  MessageCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  Bot,
  Calendar,
  User,
  Activity
} from 'lucide-react';
import { AIConversationAssistant } from './AIConversationAssistant';
import type { ConversationAnalytics } from '@/types/analytics';

interface ConversationListProps {
  analytics: ConversationAnalytics[];
}

export const ConversationList: React.FC<ConversationListProps> = ({ analytics }) => {
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationAnalytics | null>(null);

  const getSentimentColor = (score: number) => {
    if (score >= 0.1) return 'text-green-600 bg-green-50';
    if (score <= -0.1) return 'text-red-600 bg-red-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 0.1) return 'Positivo';
    if (score <= -0.1) return 'Negativo';
    return 'Neutro';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return 'Média';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'default';
      case 'pending': return 'secondary';
      case 'escalated': return 'destructive';
      case 'closed': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'resolved': return 'Resolvido';
      case 'pending': return 'Pendente';
      case 'escalated': return 'Escalado';
      case 'closed': return 'Fechado';
      default: return 'Pendente';
    }
  };

  const openAIAssistant = (conversation: ConversationAnalytics) => {
    setSelectedConversation(conversation);
    setAiAssistantOpen(true);
  };

  if (analytics.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <MessageCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl mb-2">Nenhuma conversa encontrada</h3>
          <p className="text-muted-foreground">Ajuste os filtros para ver os dados ou aguarde novas conversas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg">Conversas Analisadas</h3>
            <p className="text-muted-foreground">{analytics.length} conversas encontradas</p>
          </div>
          <Button
            onClick={() => setAiAssistantOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Bot className="w-4 h-4 mr-2" />
            Assistente IA
          </Button>
        </div>

        {/* Conversations */}
        {analytics.map((conversation) => (
          <Card key={conversation.id} className="hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <MessageCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg">
                      {conversation.chats?.name || `Chat ${conversation.chat_id.slice(0, 8)}`}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {conversation.created_at.toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {conversation.created_at.toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        {conversation.interaction_count} interações
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant={getPriorityColor(conversation.priority_level)}>
                    {getPriorityLabel(conversation.priority_level)}
                  </Badge>
                  <Badge variant={getStatusColor(conversation.resolution_status)}>
                    {getStatusLabel(conversation.resolution_status)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAIAssistant(conversation)}
                    className="flex items-center gap-1"
                  >
                    <Bot className="w-4 h-4" />
                    IA
                  </Button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-green-800">Sentimento</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getSentimentColor(conversation.sentiment_score)}`}>
                        {getSentimentLabel(conversation.sentiment_score)}
                      </span>
                    </div>
                    <Progress 
                      value={((conversation.sentiment_score + 1) / 2) * 100} 
                      className="h-2" 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <span className="text-sm text-blue-800">Interações</span>
                    <p className="text-xl text-blue-600">{conversation.interaction_count}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <div>
                    <span className="text-sm text-orange-800">Tempo Médio</span>
                    <p className="text-xl text-orange-600">
                      {Math.round(conversation.response_time_avg / 60)}min
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                  <User className="w-5 h-5 text-purple-600" />
                  <div>
                    <span className="text-sm text-purple-800">Satisfação</span>
                    <p className="text-xl text-purple-600">
                      {(conversation.customer_satisfaction * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              {conversation.analysis_data.summary && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Resumo da Análise IA
                  </h4>
                  <p className="text-sm text-gray-700">
                    {conversation.analysis_data.summary}
                  </p>
                </div>
              )}

              {/* Keywords and Issues */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {conversation.keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm mb-3 text-gray-700">Palavras-chave Identificadas</h4>
                    <div className="flex gap-1 flex-wrap">
                      {conversation.keywords.slice(0, 6).map((keyword, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                      {conversation.keywords.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{conversation.keywords.length - 6} mais
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {conversation.analysis_data.issues && conversation.analysis_data.issues.length > 0 && (
                  <div>
                    <h4 className="text-sm mb-3 text-gray-700">Problemas Detectados</h4>
                    <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-orange-700">
                          {conversation.analysis_data.issues.join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Assistant Modal */}
      <AIConversationAssistant
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        conversationData={selectedConversation}
      />
    </>
  );
};
