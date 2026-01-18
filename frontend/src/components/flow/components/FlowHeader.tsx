import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Upload, Trash2, Edit3, Check, X, Smartphone } from 'lucide-react';
import { Flow } from '../types';

interface FlowHeaderProps {
  currentFlow: Flow | null;
  selectedNodeIds: string[];
  onFlowUpdate: (flow: Flow) => void;
  onDeleteNodes: () => void;
  onUpdate: () => void;
  onPublish: () => void;
  isAutoSaving?: boolean;
}

export const FlowHeader = ({
  currentFlow,
  selectedNodeIds,
  onFlowUpdate,
  onDeleteNodes,
  onUpdate,
  onPublish,
  isAutoSaving = false
}: FlowHeaderProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempName, setTempName] = useState(currentFlow?.nome || '');
  const [tempDescription, setTempDescription] = useState(currentFlow?.descricao || '');

  const handleSaveName = () => {
    if (currentFlow && tempName.trim()) {
      onFlowUpdate({
        ...currentFlow,
        nome: tempName.trim()
      });
    }
    setIsEditingName(false);
  };

  const handleSaveDescription = () => {
    if (currentFlow) {
      onFlowUpdate({
        ...currentFlow,
        descricao: tempDescription.trim()
      });
    }
    setIsEditingDescription(false);
  };

  const handleCancelName = () => {
    setTempName(currentFlow?.nome || '');
    setIsEditingName(false);
  };

  const handleCancelDescription = () => {
    setTempDescription(currentFlow?.descricao || '');
    setIsEditingDescription(false);
  };

  return (
    <div className="p-4 bg-white border-b shadow-sm flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          {/* Nome do fluxo */}
          <div className="flex items-center space-x-2 mb-1">
            {isEditingName ? (
              <div className="flex items-center space-x-2 flex-1">
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="text-lg h-8 px-2"
                  placeholder="Nome do fluxo"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelName();
                  }}
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={handleSaveName}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelName}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => {
                setTempName(currentFlow?.nome || '');
                setIsEditingName(true);
              }}>
                <h2 className="text-lg text-gray-800 truncate">
                  {currentFlow?.nome || 'Novo Fluxo'}
                </h2>
                <Edit3 className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Descrição do fluxo */}
          <div className="flex items-center space-x-2 mb-2">
            {isEditingDescription ? (
              <div className="flex items-center space-x-2 flex-1">
                <Textarea
                  value={tempDescription}
                  onChange={(e) => setTempDescription(e.target.value)}
                  className="text-sm h-16 px-2 py-1 resize-none"
                  placeholder="Descrição do fluxo (opcional)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) handleSaveDescription();
                    if (e.key === 'Escape') handleCancelDescription();
                  }}
                  autoFocus
                />
                <div className="flex flex-col space-y-1">
                  <Button size="sm" variant="ghost" onClick={handleSaveDescription}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelDescription}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => {
                setTempDescription(currentFlow?.descricao || '');
                setIsEditingDescription(true);
              }}>
                <p className="text-sm text-gray-600 truncate">
                  {currentFlow?.descricao || 'Clique para adicionar uma descrição'}
                </p>
                <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Indicador de salvamento automático */}
        {isAutoSaving && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span>Salvando...</span>
          </div>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onDeleteNodes}
          disabled={selectedNodeIds.length === 0}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir ({selectedNodeIds.length})
        </Button>
        
        <div className="h-6 w-px bg-gray-300"></div>
        
        <Button variant="outline" size="sm" onClick={onUpdate}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
        <Button 
          size="sm" 
          onClick={onPublish} 
          className="bg-green-600 hover:bg-green-700"
          disabled={!currentFlow?.id}
        >
          <Upload className="h-4 w-4 mr-2" />
          Publicar
        </Button>
      </div>
    </div>
  );
};
