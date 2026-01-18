
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface AIKnowledgeBaseProps {
  assistantId: string;
}

export const AIKnowledgeBase: React.FC<AIKnowledgeBaseProps> = ({ assistantId }) => {
  return (
    <div className="space-y-6">
       <Card>
            <CardHeader>
              <CardTitle>Base de Conhecimento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Gerencie documentos e políticas que seus assistentes podem consultar. Esta funcionalidade está em desenvolvimento.
              </p>
              <Button disabled>
                <Plus size={16} className="mr-2" />
                Adicionar Documento
              </Button>
            </CardContent>
          </Card>
    </div>
  );
};
