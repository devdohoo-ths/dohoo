import React, { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { TrainingData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAITraining } from '@/hooks/ai/useAITraining';
import { Skeleton } from '@/components/ui/skeleton';

interface AITrainingDataProps {
  assistantId: string;
}

export const AITrainingData: React.FC<AITrainingDataProps> = ({ assistantId }) => {
  const { trainingData, isLoadingTraining, addTrainingData, updateTrainingData, deleteTrainingData } = useAITraining(assistantId);
  const [newTraining, setNewTraining] = useState({ question: '', answer: '', category: 'Geral', tags: '' });

  const handleAddTraining = async () => {
    if (newTraining.question && newTraining.answer) {
      await addTrainingData({
        assistant_id: assistantId,
        question: newTraining.question,
        answer: newTraining.answer,
        category: newTraining.category,
        tags: newTraining.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      });
      setNewTraining({ question: '', answer: '', category: 'Geral', tags: '' });
    }
  };
  
  const handleValidateTraining = async (item: TrainingData, validated: boolean) => {
    await updateTrainingData({ id: item.id, validated });
  };

  const handleDeleteTraining = async (id: string) => {
    await deleteTrainingData(id);
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2"><Plus size={20} /><span>Adicionar Novo Treinamento (Pergunta e Resposta)</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm mb-2 block">Pergunta</label>
              <Textarea value={newTraining.question} onChange={(e) => setNewTraining({...newTraining, question: e.target.value})} placeholder="Digite a pergunta..." rows={3}/>
            </div>
            <div>
              <label className="text-sm mb-2 block">Resposta</label>
              <Textarea value={newTraining.answer} onChange={(e) => setNewTraining({...newTraining, answer: e.target.value})} placeholder="Digite a resposta ideal..." rows={3}/>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm mb-2 block">Categoria</label>
              <Input value={newTraining.category} onChange={(e) => setNewTraining({...newTraining, category: e.target.value})} placeholder="Ex: Vendas, Suporte" />
            </div>
            <div>
              <label className="text-sm mb-2 block">Tags (separadas por vírgula)</label>
              <Input value={newTraining.tags} onChange={(e) => setNewTraining({...newTraining, tags: e.target.value})} placeholder="tag1, tag2, tag3"/>
            </div>
          </div>
          <Button onClick={handleAddTraining} className="w-full"><Plus size={16} className="mr-2" />Adicionar</Button>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <h3 className="text-lg">Dados de Treinamento Existentes</h3>
        {isLoadingTraining && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        {trainingData?.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="outline">{item.category}</Badge>
                    <Badge variant={item.validated ? "default" : "secondary"}>{item.validated ? "Validado" : "Pendente"}</Badge>
                    {item.tags?.map(tag => (<Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>))}
                  </div>
                  <div className="space-y-2">
                    <div><p className="text-sm text-muted-foreground">Pergunta:</p><p className="text-sm">{item.question}</p></div>
                    <div><p className="text-sm text-muted-foreground">Resposta:</p><p className="text-sm">{item.answer}</p></div>
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  {!item.validated ? (<Button size="sm" onClick={() => handleValidateTraining(item, true)} className="bg-green-500 hover:bg-green-600"><Check size={14} /></Button>) : (<Button size="sm" variant="outline" onClick={() => handleValidateTraining(item, false)}><X size={14} /></Button>)}
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteTraining(item.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoadingTraining && trainingData?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado de treinamento para este assistente ainda.</p>
        )}
      </div>
    </div>
  )
}
