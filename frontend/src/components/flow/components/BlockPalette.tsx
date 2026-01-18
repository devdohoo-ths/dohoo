
import { BLOCK_TYPES, ICON_MAP } from '../constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlockType } from '../types';

interface BlockPaletteProps {
  onDragStart: (blockType: string) => void;
}

export const BlockPalette = ({ onDragStart }: BlockPaletteProps) => {
  const categories = {
    'Básico': 'Início',
    'Comunicação': 'Ações',
    'IA': 'IA',
    'Lógica': 'Condições',
    'Condições': 'Condições',
    'Atendimento': 'Finalização',
    'Integração': 'Integração',
    'Dados': 'Dados'
  };

  const groupedBlocks = BLOCK_TYPES.reduce((acc, block) => {
    if (!acc[block.category]) {
      acc[block.category] = [];
    }
    acc[block.category].push(block);
    return acc;
  }, {} as Record<string, BlockType[]>);

  return (
    <div className="h-full flex flex-col bg-white lg:bg-transparent">
      <div className="p-4 border-b lg:border-b-0">
        <h2 className="text-lg">Blocos de Construção</h2>
        <p className="text-sm text-gray-500 mt-1">Arraste os blocos para o canvas</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.entries(groupedBlocks).map(([category, blocks]) => (
          <div key={category}>
            <h3 className="text-sm text-gray-600 mb-3">
              {categories[category as keyof typeof categories] || category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {blocks.map((block) => {
                const IconComponent = ICON_MAP[block.icon as keyof typeof ICON_MAP];
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => onDragStart(block.type)}
                    className="p-3 border rounded-lg cursor-grab hover:shadow-md transition-all bg-white hover:bg-gray-50 touch-manipulation"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${block.color} rounded-md flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{block.label}</div>
                        <div className="text-xs text-gray-500 line-clamp-2">{block.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
