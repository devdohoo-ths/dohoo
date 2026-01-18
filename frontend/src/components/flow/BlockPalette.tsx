import { FLOW_BLOCKS } from './flowBlocks';
import { LucideIcon, Play, List, GitBranch, Clock, Image, Mic, FileText, Bot, User, Users, XCircle, Star } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { Play, List, GitBranch, Clock, Image, Mic, FileText, Bot, User, Users, XCircle, Star };

export const BlockPalette = ({ onDragStart }: { onDragStart: (type: string) => void }) => (
  <div className="p-4 space-y-2">
    <h3 className="mb-2">Blocos</h3>
    {FLOW_BLOCKS.map(block => {
      const Icon = ICONS[block.icon] || Play;
      return (
        <div
          key={block.type}
          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 border-l-4 border-${block.color}-500`}
          draggable
          onDragStart={() => onDragStart(block.type)}
        >
          <Icon className={`w-5 h-5 text-${block.color}-500`} />
          <span className="">{block.label}</span>
        </div>
      );
    })}
  </div>
); 