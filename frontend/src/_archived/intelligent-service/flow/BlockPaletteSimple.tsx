import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, MessageSquare, List, GitBranch, Users, XCircle, Pencil,
  Layers, MessageCircle, CheckCircle, ChevronDown, ChevronRight, User
} from 'lucide-react';
import { FLOW_BLOCKS_SIMPLE, BLOCK_CATEGORIES } from './flowBlocksSimple';
import { cn } from '@/lib/utils';

interface BlockPaletteSimpleProps {
  onDragStart?: (blockType: string) => void;
}

// Mapa de ícones
const iconMap: Record<string, React.ComponentType<any>> = {
  Play,
  MessageSquare,
  List,
  GitBranch,
  Users,
  User,
  XCircle,
  Pencil,
  Layers,
  MessageCircle,
  CheckCircle,
};

// Mapa de cores
const colorMap: Record<string, string> = {
  green: 'bg-green-100 border-green-300 text-green-700',
  blue: 'bg-blue-100 border-blue-300 text-blue-700',
  yellow: 'bg-yellow-100 border-yellow-300 text-yellow-700',
  cyan: 'bg-cyan-100 border-cyan-300 text-cyan-700',
  indigo: 'bg-indigo-100 border-indigo-300 text-indigo-700',
  red: 'bg-red-100 border-red-300 text-red-700',
};

export const BlockPaletteSimple: React.FC<BlockPaletteSimpleProps> = ({ onDragStart }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['basico']) // Categoria básica expandida por padrão
  );

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, blockType: string) => {
    console.log('🎯 [BlockPalette] Iniciando drag:', blockType);
    e.dataTransfer.setData('blockType', blockType);
    e.dataTransfer.effectAllowed = 'copy';
    if (onDragStart) {
      console.log('✅ [BlockPalette] Chamando onDragStart');
      onDragStart(blockType);
    } else {
      console.warn('⚠️ [BlockPalette] onDragStart não está definido!');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <h2 className="text-lg text-gray-900">Blocos de Fluxo</h2>
        <p className="text-sm text-gray-500 mt-1">
          Arraste os blocos para o canvas
        </p>
      </div>

      {/* Categorias e Blocos */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {BLOCK_CATEGORIES.map(category => {
          const CategoryIcon = iconMap[category.icon] || Layers;
          const isExpanded = expandedCategories.has(category.id);
          const blocksInCategory = FLOW_BLOCKS_SIMPLE.filter(
            block => block.category === category.id
          );

          return (
            <Card key={category.id} className="overflow-hidden">
              <CardHeader 
                className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="w-4 h-4 text-gray-600" />
                    <CardTitle className="text-sm">
                      {category.label}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {blocksInCategory.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {category.description}
                </p>
              </CardHeader>

              {isExpanded && (
                <CardContent className="p-2 space-y-2">
                  {blocksInCategory.map(block => {
                    const Icon = iconMap[block.icon] || MessageSquare;
                    const colorClass = colorMap[block.color] || colorMap.blue;

                    return (
                      <div
                        key={block.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, block.type)}
                        className={cn(
                          'p-3 border-2 border-dashed rounded-lg cursor-move transition-all',
                          'hover:shadow-md hover:scale-105',
                          colorClass
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              {block.label}
                            </p>
                            <p className="text-xs opacity-80 mt-0.5">
                              {block.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Footer com dica */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <MessageCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="">Dica</p>
            <p className="mt-1">
              Todo fluxo precisa começar com um bloco <strong>Início</strong> e 
              terminar com <strong>Encerrar</strong> ou <strong>Transferir para Time</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockPaletteSimple;

