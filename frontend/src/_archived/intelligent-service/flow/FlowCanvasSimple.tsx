/**
 * FlowCanvas SIMPLIFICADO com suporte a FLOW_BLOCKS_SIMPLE
 * Baseado no FlowCanvas original mas adaptado para blocos simplificados
 */
import React, { useCallback, useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FlowNode as FlowNodeType, FlowEdge, Flow } from '@/components/flow/types';
import { FlowNode } from '@/components/flow/components/FlowNode';
import { FLOW_BLOCKS_SIMPLE } from './flowBlocksSimple';

const nodeTypes = {
  flowNode: FlowNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#64748b',
  },
  style: {
    strokeWidth: 2,
    stroke: '#64748b',
  },
};

interface FlowCanvasSimpleProps {
  onNodeSelect: (node: FlowNodeType | null) => void;
  onUpdate: () => void;
  onPublish: () => void;
  onFlowChange: (nodes: FlowNodeType[], edges: FlowEdge[]) => void;
  onNodeConfigSave?: (nodeId: string, config: any) => void;
  draggedBlockType: string | null;
  currentFlow?: Flow | null;
  initialNodes: FlowNodeType[];
  initialEdges: FlowEdge[];
}

export const FlowCanvasSimple = forwardRef<any, FlowCanvasSimpleProps>(({ 
  onNodeSelect, 
  onUpdate, 
  onPublish,
  onFlowChange,
  onNodeConfigSave,
  draggedBlockType,
  currentFlow,
  initialNodes,
  initialEdges
}, ref) => {
  
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const hasInitialized = useRef(false);
  const lastFlowId = useRef<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Carregar nós e edges iniciais
  useEffect(() => {
    if (currentFlow?.id !== lastFlowId.current) {
      hasInitialized.current = false;
      lastFlowId.current = currentFlow?.id || null;
    }

    if (!hasInitialized.current && initialNodes.length >= 0) {
      console.log('🔄 [FlowCanvasSimple] Carregando nodes iniciais:', initialNodes);
      
      const formattedNodes = initialNodes.map(n => ({
        id: n.id,
        type: 'flowNode',
        position: n.position,
        data: {
          label: n.data.label,
          nodeType: n.type,
          config: n.data.config || {},
          color: FLOW_BLOCKS_SIMPLE.find(b => b.type === n.type)?.color || 'blue'
        }
      }));

      setNodes(formattedNodes);
      setEdges(initialEdges as Edge[]);
      hasInitialized.current = true;
    }
  }, [currentFlow?.id, initialNodes, initialEdges, setNodes, setEdges]);

  // Sincronizar config dos nodes quando initialNodes mudar (para atualizar configurações)
  // REMOVIDO: Estava causando loop infinito e sobrescrevendo as mudanças
  // A sincronização agora é feita diretamente pelo handleNodeConfigSave no FlowManager

  // Sincronizar mudanças com o parent
  useEffect(() => {
    if (hasInitialized.current) {
      const flowNodes: FlowNodeType[] = nodes.map(n => ({
        id: n.id,
        type: n.data.nodeType,
        position: n.position,
        data: {
          label: n.data.label,
          config: n.data.config || {}
        }
      }));

      console.log('🔄 [FlowCanvasSimple] Chamando onFlowChange:', {
        nodesCount: flowNodes.length,
        edgesCount: edges.length,
        flowNodes,
        edges
      });
      
      onFlowChange(flowNodes, edges as FlowEdge[]);
    } else {
      console.log('⏸️ [FlowCanvasSimple] hasInitialized.current é false, pulando onFlowChange');
    }
  }, [nodes, edges, onFlowChange]);

  // Deletar nodes com Delete ou Backspace
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        setNodes((nds) => {
          const selectedNodes = nds.filter(n => n.selected);
          if (selectedNodes.length > 0) {
            console.log('🗑️ [FlowCanvasSimple] Deletando nodes:', selectedNodes.map(n => n.id));
            // Fechar painel de configuração se algum node selecionado for deletado
            if (selectedNodes.length > 0) {
              onNodeSelect(null);
            }
            // Remover nodes selecionados
            return nds.filter(n => !n.selected);
          }
          return nds;
        });
        
        // Também remover edges conectados aos nodes deletados
        setEdges((eds) => {
          const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
          return eds.filter(e => 
            !selectedNodeIds.includes(e.source) && 
            !selectedNodeIds.includes(e.target)
          );
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [nodes, setNodes, setEdges, onNodeSelect]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      ...defaultEdgeOptions,
    }, eds));
  }, [setEdges]);

  // Função auxiliar para criar nó
  const createNodeFromBlock = useCallback((event: React.DragEvent, blockDef: any) => {
    console.log('🏗️ [FlowCanvasSimple] createNodeFromBlock chamado para:', blockDef.type);
    
    // Usar screenToFlowPosition para converter coordenadas da tela para coordenadas do flow
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    console.log('📍 [FlowCanvasSimple] Posição calculada:', position);

    // Monta config default
    const config: any = {};
    blockDef.configFields.forEach((field: any) => {
      if ('defaultValue' in field) {
        config[field.key] = field.defaultValue;
      } else if (field.type === 'options') {
        config[field.key] = [''];
      } else if (field.type === 'diasSemana') {
        config[field.key] = {};
      } else if (field.type === 'horarios') {
        config[field.key] = [];
      } else {
        config[field.key] = '';
      }
    });

    const newNode: Node = {
      id: `${blockDef.type}-${Date.now()}`,
      type: 'flowNode',
      position,
      data: {
        label: blockDef.label,
        nodeType: blockDef.type,
        config,
        color: blockDef.color
      },
    };

    console.log('✅ [FlowCanvasSimple] Novo nó criado:', newNode);
    setNodes((nds) => {
      console.log('📦 [FlowCanvasSimple] Adicionando nó aos nodes existentes:', nds.length);
      return nds.concat(newNode);
    });
  }, [setNodes, screenToFlowPosition]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    console.log('🎯 [FlowCanvasSimple] ====== DROP DETECTADO ======');
    console.log('🎯 [FlowCanvasSimple] draggedBlockType (prop):', draggedBlockType);
    console.log('🎯 [FlowCanvasSimple] Event dataTransfer:', event.dataTransfer.getData('blockType'));
    console.log('🎯 [FlowCanvasSimple] Event coordinates:', { x: event.clientX, y: event.clientY });

    // Tentar pegar do prop primeiro, depois do dataTransfer
    let blockTypeToUse = draggedBlockType || event.dataTransfer.getData('blockType');
    
    if (!blockTypeToUse) {
      console.error('❌ [FlowCanvasSimple] Nenhum blockType encontrado (nem prop nem dataTransfer)!');
      return;
    }

    console.log('✅ [FlowCanvasSimple] Usando blockType:', blockTypeToUse);

    const blockDef = FLOW_BLOCKS_SIMPLE.find(b => b.type === blockTypeToUse);
    if (!blockDef) {
      console.warn(`⚠️ [FlowCanvasSimple] Bloco não encontrado no FLOW_BLOCKS_SIMPLE: ${blockTypeToUse}`);
      console.log('📋 [FlowCanvasSimple] Blocos disponíveis:', FLOW_BLOCKS_SIMPLE.map(b => b.type));
      return;
    }

    console.log('✅ [FlowCanvasSimple] Bloco encontrado:', blockDef);
    createNodeFromBlock(event, blockDef);
  }, [draggedBlockType, createNodeFromBlock]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const flowNode: FlowNodeType = {
      id: node.id,
      type: node.data.nodeType as FlowNodeType['type'],
      position: node.position,
      data: {
        label: node.data.label as string,
        config: node.data.config || {}
      }
    };
    onNodeSelect(flowNode);
  }, [onNodeSelect]);

  const onSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
    // Seleção de múltiplos nós (futuro)
  }, []);

  useImperativeHandle(ref, () => ({
    getNodes: () => nodes,
    getEdges: () => edges,
    updateNodeConfig: (nodeId: string, newConfig: any) => {
      console.log('🔧 [FlowCanvasSimple] updateNodeConfig:', { nodeId, newConfig });
      setNodes(prevNodes => 
        prevNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                config: newConfig
              }
            };
          }
          return node;
        })
      );
    },
    deleteNode: (nodeId: string) => {
      console.log('🗑️ [FlowCanvasSimple] deleteNode chamado:', nodeId);
      
      // Remover node
      setNodes(prevNodes => {
        const filtered = prevNodes.filter(node => node.id !== nodeId);
        console.log('✅ [FlowCanvasSimple] Nodes após deletar:', filtered.length);
        return filtered;
      });
      
      // Remover edges conectados
      setEdges(prevEdges => {
        const filtered = prevEdges.filter(edge => 
          edge.source !== nodeId && edge.target !== nodeId
        );
        console.log('✅ [FlowCanvasSimple] Edges após deletar:', filtered.length);
        return filtered;
      });
    }
  }));

  return (
    <div className="w-full h-full" style={{ minHeight: '500px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        style={{ width: '100%', height: '100%' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const color = node.data.color || 'blue';
            const colorMap: Record<string, string> = {
              green: '#22c55e',
              blue: '#3b82f6',
              yellow: '#eab308',
              cyan: '#06b6d4',
              indigo: '#6366f1',
              red: '#ef4444',
              purple: '#a855f7',
              orange: '#f97316',
              pink: '#ec4899',
            };
            return colorMap[color] || '#3b82f6';
          }}
        />
      </ReactFlow>
    </div>
  );
});

FlowCanvasSimple.displayName = 'FlowCanvasSimple';

// Wrapper com ReactFlowProvider
const FlowCanvasSimpleWithProvider = forwardRef((props: any, ref) => {
  return (
    <ReactFlowProvider>
      <FlowCanvasSimple {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

FlowCanvasSimpleWithProvider.displayName = 'FlowCanvasSimpleWithProvider';

export default FlowCanvasSimpleWithProvider;
