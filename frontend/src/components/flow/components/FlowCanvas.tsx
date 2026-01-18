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
  ConnectionLineType,
  MarkerType,
  BackgroundVariant,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  BaseEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FlowNode as FlowNodeType, FlowEdge, Flow } from '../types';
import { FlowNode } from './FlowNode';
import { FlowHeader } from './FlowHeader';
import { FLOW_BLOCKS } from '../flowBlocks';

const nodeTypes = {
  flowNode: FlowNode,
};

// Configurações de estilo para edges
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

// Custom edge com botão de remover
function RemovableEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style } = props;
  // Usar getSmoothStepPath com borderRadius 0 para linhas ortogonais
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <circle cx={labelX} cy={labelY} r={8} fill="#bfdbfe" stroke="#2563eb" strokeWidth={2} />
      <foreignObject x={labelX - 12} y={labelY - 12} width={24} height={24} style={{ overflow: 'visible' }}>
        <button
          onClick={() => props.data?.onRemove?.(id)}
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '50%',
            width: 24,
            height: 24,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 16 }}>×</span>
        </button>
      </foreignObject>
    </>
  );
}

const edgeTypes = {
  removable: RemovableEdge,
};

interface FlowCanvasProps {
  onNodeSelect: (node: FlowNodeType | null) => void;
  onUpdate: (nodes: FlowNodeType[], edges: FlowEdge[]) => void;
  onPublish: () => void;
  onFlowChange: (nodes: FlowNodeType[], edges: FlowEdge[]) => void;
  onFlowUpdate: (flow: Flow) => void;
  onNodeConfigSave?: (nodeId: string, config: any, label: string) => void;
  draggedBlockType: string | null;
  currentFlow?: Flow | null;
  initialNodes: FlowNodeType[];
  initialEdges: FlowEdge[];
}

export const FlowCanvas = forwardRef(({ 
  onNodeSelect, 
  onUpdate, 
  onPublish,
  onFlowChange,
  onFlowUpdate,
  onNodeConfigSave,
  draggedBlockType,
  currentFlow,
  initialNodes,
  initialEdges
}: FlowCanvasProps, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const hasInitialized = useRef(false);
  const lastFlowId = useRef<string | null>(null);
  const lastNodesString = useRef<string>('');

  // Carregar nós e edges iniciais e reagir a mudanças do currentFlow
  useEffect(() => {
    // Se é um novo fluxo (ID diferente), resetar a inicialização
    if (currentFlow?.id !== lastFlowId.current) {
      hasInitialized.current = false;
      lastFlowId.current = currentFlow?.id || null;
    }

    // Se não foi inicializado ainda e há dados para carregar
    if (!hasInitialized.current && (initialNodes.length > 0 || initialEdges.length > 0)) {
      const flowNodes = initialNodes.map(node => ({
        id: node.id,
        type: 'flowNode',
        position: node.position,
        data: {
          label: node.data.label,
          nodeType: node.type,
          config: node.data.config || {}
        },
        // Adicionar key única para forçar re-renderização
        key: `${node.id}-${JSON.stringify(node.data.config)}-${node.data.label}`
      }));

      // Filtrar edges duplicadas baseando-se no source, target e sourceHandle
      const seenEdges = new Set();
      const flowEdges = initialEdges.filter(edge => {
        const edgeKey = `${edge.source}-${edge.target}-${edge.sourceHandle || 'default'}`;
        if (seenEdges.has(edgeKey)) {
          return false;
        }
        seenEdges.add(edgeKey);
        return true;
      }).map((edge, index) => {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        const uniqueId = edge.id || `edge-${edge.source}-${edge.target}-${edge.sourceHandle || 'default'}-${timestamp}-${index}`;
        
        return {
          ...edge,
          id: uniqueId,
          type: 'removable',
          data: { onRemove: (id: string) => setEdges((eds) => eds.filter(e => e.id !== id)) },
          ...defaultEdgeOptions
        };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
      hasInitialized.current = true;
      lastNodesString.current = JSON.stringify(currentFlow?.nodes || []);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, currentFlow?.id]);

  // Monitorar mudanças específicas nos nós e edges do currentFlow
  useEffect(() => {
    if (hasInitialized.current && currentFlow) {
      const newNodesString = JSON.stringify(currentFlow.nodes.map(n => ({ id: n.id, data: n.data })));
      
      // Só atualizar se realmente houve mudanças
      if (lastNodesString.current !== newNodesString) {
        lastNodesString.current = newNodesString;
        
        const updatedNodes = currentFlow.nodes.map(node => ({
          id: node.id,
          type: 'flowNode',
          position: node.position,
          data: {
            label: node.data.label,
            nodeType: node.type,
            config: node.data.config || {}
          },
          key: `${node.id}-${JSON.stringify(node.data.config)}-${node.data.label}`
        }));

        const seenEdges = new Set();
        const updatedEdges = currentFlow.edges.filter(edge => {
          const edgeKey = `${edge.source}-${edge.target}-${edge.sourceHandle || 'default'}`;
          if (seenEdges.has(edgeKey)) {
            return false;
          }
          seenEdges.add(edgeKey);
          return true;
        }).map((edge, index) => {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substr(2, 9);
          const uniqueId = edge.id || `edge-${edge.source}-${edge.target}-${edge.sourceHandle || 'default'}-${timestamp}-${index}`;
          
          return {
            ...edge,
            id: uniqueId,
            type: 'removable',
            data: { onRemove: (id: string) => setEdges((eds) => eds.filter(e => e.id !== id)) },
            ...defaultEdgeOptions
          };
        });

        setNodes(updatedNodes);
        setEdges(updatedEdges);
      }
    }
  }, [currentFlow, hasInitialized.current]);

  // Notificar mudanças no fluxo com debounce
  const notifyFlowChange = useCallback(() => {
    if (!hasInitialized.current) return;
    
    const updatedFlowNodes: FlowNodeType[] = nodes.map(node => ({
      id: node.id,
      type: node.data.nodeType as FlowNodeType['type'],
      position: node.position,
      data: {
        label: node.data.label as string,
        config: node.data.config || {}
      }
    }));

    // Filtrar edges duplicadas na notificação também
    const seenEdges = new Set();
    const updatedFlowEdges: FlowEdge[] = edges.filter(edge => {
      const edgeKey = `${edge.source}-${edge.target}-${edge.sourceHandle || 'default'}`;
      if (seenEdges.has(edgeKey)) {
        return false;
      }
      seenEdges.add(edgeKey);
      return true;
    }).map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label as string,
      type: edge.type,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    }));

    onFlowChange(updatedFlowNodes, updatedFlowEdges);
  }, [nodes, edges, onFlowChange]);

  // Debounce para evitar muitas chamadas
  useEffect(() => {
    if (hasInitialized.current) {
      const timeout = setTimeout(notifyFlowChange, 500);
      return () => clearTimeout(timeout);
    }
  }, [notifyFlowChange]);

  const onConnect = useCallback((connection: Connection) => {
    const newEdge = {
      ...connection,
      id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle || 'default'}-${Date.now()}`,
      type: 'removable',
      data: { onRemove: (id: string) => setEdges((eds) => eds.filter(e => e.id !== id)) },
      ...defaultEdgeOptions
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    if (!draggedBlockType) return;

    const blockDef = FLOW_BLOCKS.find(b => b.type === draggedBlockType);
    if (!blockDef) return;

    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const position = {
      x: event.clientX - reactFlowBounds.left - 100,
      y: event.clientY - reactFlowBounds.top - 50,
    };

    // Monta config default
    const config: any = {};
    blockDef.configFields.forEach(field => {
      if (field.type === 'options') config[field.key] = [''];
      else if (field.type === 'diasSemana') config[field.key] = {};
      else config[field.key] = '';
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

    setNodes((nds) => nds.concat(newNode));
  }, [draggedBlockType, setNodes]);

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
    const nodeIds = params.nodes.map(node => node.id);
    setSelectedNodeIds(nodeIds);
  }, []);

  const handleDeleteNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

    setNodes((nds) => nds.filter(node => !selectedNodeIds.includes(node.id)));
    setEdges((eds) => eds.filter(edge => 
      !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
    ));

    setSelectedNodeIds([]);
    onNodeSelect(null);
  }, [selectedNodeIds, setNodes, setEdges, onNodeSelect]);

  const isTypingInInput = useCallback(() => {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' || 
      (activeElement as HTMLElement).contentEditable === 'true' ||
      activeElement.getAttribute('role') === 'textbox'
    );
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Delete' && selectedNodeIds.length > 0 && !isTypingInInput()) {
      event.preventDefault();
      handleDeleteNodes();
    }
  }, [selectedNodeIds, handleDeleteNodes, isTypingInInput]);

  React.useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const handleSave = () => {
    const flowNodes: FlowNodeType[] = nodes.map(node => ({
      id: node.id,
      type: node.data.nodeType as FlowNodeType['type'],
      position: node.position,
      data: {
        label: node.data.label as string,
        config: node.data.config || {}
      }
    }));

    // Filtrar edges duplicadas no salvamento também
    const seenEdges = new Set();
    const flowEdges: FlowEdge[] = edges.filter(edge => {
      const edgeKey = `${edge.source}-${edge.target}-${edge.sourceHandle || 'default'}`;
      if (seenEdges.has(edgeKey)) {
        return false;
      }
      seenEdges.add(edgeKey);
      return true;
    }).map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label as string,
      type: edge.type,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    }));

    onUpdate(flowNodes, flowEdges);
  };

  // Função para atualizar config de um nó
  const handleNodeConfigSave = useCallback((nodeId: string, config: any, label: string) => {
    setNodes((nds) => nds.map(node =>
      node.id === nodeId
        ? {
            ...node,
            data: {
              ...node.data,
              config,
              label: label || node.data.label
            }
          }
        : node
    ));
  }, [setNodes]);

  useImperativeHandle(ref, () => ({
    getCurrentNodesAndEdges: () => ({
      nodes,
      edges
    })
  }), [nodes, edges]);

  // Antes do render do ReactFlow, garantir que todas as edges têm type: 'removable' e data.onRemove
  const edgesWithRemovableType = edges.map(edge => ({
    ...edge,
    type: 'removable',
    data: { onRemove: (id: string) => setEdges((eds) => eds.filter(e => e.id !== id)) },
  }));
  edgesWithRemovableType.forEach(e => console.log('[DEBUG EDGE]', e));

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Canvas principal */}
      <div 
        className="flex-1 relative"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edgesWithRemovableType}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.5,
            maxZoom: 1.5
          }}
          className="bg-gray-50"
          minZoom={0.1}
          maxZoom={2}
          multiSelectionKeyCode="Shift"
          deleteKeyCode={null}
        >
          <Controls 
            className="bg-white shadow-lg rounded-lg border border-gray-200"
            showZoom={true}
            showFitView={true}
            showInteractive={false}
          />
          
          <MiniMap 
            className="bg-white border border-gray-200 rounded-lg shadow-lg"
            nodeStrokeWidth={2}
            maskColor="rgba(0,0,0,0.1)"
            position="bottom-left"
            nodeColor={(node) => {
              const nodeType = node.data.nodeType;
              switch (nodeType) {
                case 'inicio': return '#10b981';
                case 'encerrar': return '#ef4444';
                case 'transferencia': return '#ef4444';
                case 'ia': return '#ef4444';
                case 'decisao': return '#f59e0b';
                case 'variavel': return '#8b5cf6';
                case 'condicao': return '#06b6d4';
                default: return '#6b7280';
              }
            }}
          />
          
          <Background 
            variant={BackgroundVariant.Lines}
            gap={20} 
            size={1}
            color="#e5e7eb"
          />
        </ReactFlow>

        {/* Instruções quando vazio */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-gray-200 max-w-md">
              <div className="text-xl mb-4">🚀</div>
              <h3 className="text-lg text-gray-800 mb-2">
                Canvas vazio
              </h3>
              <p className="text-gray-600 text-sm">
                Arraste blocos do painel lateral para começar a construir seu fluxo
              </p>
            </div>
          </div>
        )}

        {/* Informações de seleção */}
        {selectedNodeIds.length > 0 && (
          <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="text-sm text-gray-700">
              <strong>{selectedNodeIds.length}</strong> bloco(s) selecionado(s)
              <div className="text-xs text-gray-500 mt-1">
                Pressione Delete para excluir
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
