import { useState, useCallback, useEffect, useRef } from 'react';
import { BlockPalette } from './components/BlockPalette';
import { FlowCanvas } from './components/FlowCanvas';
import { NodeConfigPanel } from './components/NodeConfigPanel';
import { FlowListPage } from './FlowListPage';
import { FlowNode, FlowEdge, Flow } from './types';
import { useFlows } from './hooks/useFlows';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { FlowHeader } from './components/FlowHeader';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export const FlowBuilderPage = () => {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [draggedBlockType, setDraggedBlockType] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'builder'>('list');
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, any>>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const { flows, saveFlow, deleteFlow, toggleActive, loading, updateFlowInList } = useFlows();
  const { toast } = useToast();
  const [latestNodes, setLatestNodes] = useState<FlowNode[]>([]);
  const [latestEdges, setLatestEdges] = useState<FlowEdge[]>([]);
  const flowCanvasRef = useRef<any>(null);

  // Sincronizar currentFlow com o estado global flows
  useEffect(() => {
    if (flowId && flows.length > 0) {
      const flow = flows.find(f => f.id === flowId);
      if (flow) {
        // Só atualizar se o currentFlow for diferente ou não existir
        if (!currentFlow || currentFlow.id !== flow.id) {
          setCurrentFlow(flow);
          setCurrentView('builder');
          
          // Inicializar nodeConfigs com as configs existentes do flow
          const initialConfigs: { [key: string]: any } = {};
          flow.nodes.forEach(node => {
            if (node.data.config) {
              initialConfigs[node.id] = node.data.config;
            }
          });
          setNodeConfigs(initialConfigs);
        }
      } else {
        // Se não encontrar, volta para a lista
        navigate('/flows');
      }
    }
  }, [flowId, flows, navigate, currentFlow]);

  // Função para sincronizar mudanças locais com o estado global
  const syncFlowToGlobal = useCallback((updatedFlow: Flow) => {
    if (updateFlowInList) {
      updateFlowInList(updatedFlow);
    }
  }, [updateFlowInList]);

  useEffect(() => {
    if (selectedNode) {
      // Log removido para evitar spam
    }
  }, [selectedNode]);

  // Atualizar selectedNode quando currentFlow mudar
  useEffect(() => {
    if (selectedNode && currentFlow) {
      const updatedNode = currentFlow.nodes.find(n => n.id === selectedNode.id);
      if (updatedNode && JSON.stringify(updatedNode) !== JSON.stringify(selectedNode)) {
        setSelectedNode(updatedNode);
      }
    }
  }, [currentFlow, selectedNode]);

  // Auto-save quando houver mudanças nos blocos (com debounce)
  useEffect(() => {
    if (currentFlow && currentFlow.id) {
      const timeout = setTimeout(() => {
        // Verificar se há mudanças reais comparando com o estado salvo
        const hasChanges = Object.keys(nodeConfigs).length > 0;
        if (hasChanges) {
          // Salvar silenciosamente (sem toast)
          const silentUpdate = async () => {
            setIsAutoSaving(true);
            try {
              const cleanNodes = currentFlow.nodes.map((node: any) => {
                const savedConfig = nodeConfigs[node.id];
                return {
                  id: node.id,
                  type: node.type,
                  position: node.position,
                  data: {
                    label: node.data.label,
                    config: savedConfig || node.data.config || {}
                  }
                };
              });
              
              const cleanEdges = currentFlow.edges.map((edge: any) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.label,
                type: edge.type,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle
              }));
              
              const flowToSave = {
                ...currentFlow,
                nodes: cleanNodes,
                edges: cleanEdges
              };
              
              await saveFlow(flowToSave);
            } finally {
              setIsAutoSaving(false);
            }
          };
          
          silentUpdate();
        }
      }, 3000); // 3 segundos de debounce

      return () => clearTimeout(timeout);
    }
  }, [nodeConfigs, currentFlow?.id, currentFlow?.nodes, currentFlow?.edges, saveFlow]);

  const handleNodeSelect = useCallback((node: FlowNode | null) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }
    
    // Buscar o node mais atualizado do currentFlow
    if (currentFlow) {
      const updatedNode = currentFlow.nodes.find(n => n.id === node.id);
      if (updatedNode) {
        setSelectedNode(updatedNode);
        return;
      }
    }
    
    // Se não encontrar no currentFlow, usar o node passado
    setSelectedNode(node);
  }, [currentFlow]);

  const handleNodeConfigSaveCanvas = (nodeId: string, config: any, label: string) => {
    if (!currentFlow) return;
    const updatedNodes = currentFlow.nodes.map(node =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, config, label: label || node.data.label } }
        : node
    );
    const updatedFlow = { ...currentFlow, nodes: updatedNodes };
    setCurrentFlow(updatedFlow);
    
    // Sincronizar com o estado global
    syncFlowToGlobal(updatedFlow);
  };

  const handleNodeConfigSave = useCallback(async (configToSave: any) => {
    if (!selectedNode) return;
    
    // Extrair config e label do configToSave
    const { label, ...config } = configToSave;
    
    // Salvar no estado global
    setNodeConfigs(prev => ({
      ...prev,
      [selectedNode.id]: config
    }));
    
    // Atualizar selectedNode com a nova config
    const updatedSelectedNode = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        config,
        label: label || selectedNode.data.label
      }
    };
    setSelectedNode(updatedSelectedNode);
    
    // Atualizar currentFlow localmente (sem sincronização automática)
    setCurrentFlow(prev => {
      if (!prev) return prev;
      const updatedNodes = prev.nodes.map(node =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, config, label: label || node.data.label } }
          : node
      );
      return { ...prev, nodes: updatedNodes };
    });
    
    // Não fazer toast aqui - será feito no NodeConfigPanel
    // Não sincronizar automaticamente - será feito quando clicar em "Salvar Configurações"
  }, [selectedNode]);

  const handleDragStart = useCallback((blockType: string) => {
    setDraggedBlockType(blockType);
    setShowPalette(false);
  }, []);

  const handleFlowChange = useCallback((nodes: FlowNode[], edges: FlowEdge[]) => {
    setLatestNodes(nodes);
    setLatestEdges(edges);
    if (currentFlow) {
      const updatedFlow = { ...currentFlow, nodes, edges };
      setCurrentFlow(updatedFlow);
      
      // Sincronizar com o estado global
      syncFlowToGlobal(updatedFlow);
    }
  }, [currentFlow, syncFlowToGlobal]);

  const handleFlowUpdate = useCallback((updatedFlow: Flow) => {
    setCurrentFlow(updatedFlow);
    
    // Sincronizar com o estado global
    syncFlowToGlobal(updatedFlow);
  }, [syncFlowToGlobal]);

  const handleUpdate = async () => {
    if (!currentFlow) return;
    
    // Usar as configs salvas no estado global
    const cleanNodes = currentFlow.nodes.map((node: any) => {
      const savedConfig = nodeConfigs[node.id];
      
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          label: node.data.label,
          config: savedConfig || node.data.config || {}
        }
      };
    });
    
    const cleanEdges = currentFlow.edges.map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: edge.type,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    }));
    
    const flowToSave = {
      ...currentFlow,
      nodes: cleanNodes,
      edges: cleanEdges
    };
    
    const success = await saveFlow(flowToSave);
    if (success) {
      // Atualizar o currentFlow com os dados que foram realmente salvos
      setCurrentFlow(flowToSave);
      
      // Atualizar também o selectedNode se ele existir
      if (selectedNode) {
        const updatedNode = cleanNodes.find(node => node.id === selectedNode.id);
        if (updatedNode) {
          setSelectedNode(updatedNode);
        }
      }
      
      toast({
        title: "Fluxo atualizado",
        description: "Seu fluxo foi atualizado com sucesso!",
      });
    }
  };

  const handlePublish = useCallback(async () => {
    if (!currentFlow) return;
    
    const flowToPublish = {
      ...currentFlow,
      ativo: true
    };
    
    const success = await saveFlow(flowToPublish);
    if (success) {
      setCurrentFlow(flowToPublish);
      toast({
        title: "Fluxo publicado",
        description: "Seu fluxo foi publicado e está ativo!",
      });
    }
  }, [currentFlow, saveFlow, toast]);

  const handleCreateNew = useCallback(() => {
    const newFlow = {
      nome: 'Novo Fluxo',
      descricao: '',
      nodes: [],
      edges: [],
      ativo: false,
      canal: 'whatsapp',
      organization_id: ''
    };
    setCurrentFlow(newFlow);
    setCurrentView('builder');
    setSelectedNode(null);
    setNodeConfigs({});
  }, []);

  const handleEditFlow = useCallback((flow: Flow) => {
    setCurrentFlow(flow);
    setCurrentView('builder');
    setSelectedNode(null);
    
    // A inicialização dos nodeConfigs agora é feita no useEffect principal
    // para evitar duplicação e garantir sincronização
    navigate(`/flows/${flow.id}`);
  }, [navigate]);

  const handleBackToList = useCallback(() => {
    navigate('/flows');
  }, [navigate]);

  return (
    <PermissionGuard requiredPermissions={['manage_flows']}>
      {currentView === 'list' ? (
        <FlowListPage 
          flows={flows}
          loading={loading}
          onCreateNew={handleCreateNew}
          onEditFlow={handleEditFlow}
          onDeleteFlow={deleteFlow}
          onToggleActive={toggleActive}
        />
      ) : (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header principal: botão de voltar + FlowHeader (com ações) */}
        <div className="w-full bg-white shadow-sm px-6 py-2 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar à Lista
          </Button>
          <div className="flex-1 min-w-0">
            <FlowHeader
              currentFlow={currentFlow}
              selectedNodeIds={[]}
              onFlowUpdate={handleFlowUpdate}
              onDeleteNodes={() => {}}
              onUpdate={handleUpdate}
              onPublish={handlePublish}
              isAutoSaving={isAutoSaving}
            />
          </div>
        </div>
        {/* Layout principal: painel de blocos, canvas, painel de configuração */}
        <div className="flex flex-1 min-h-0">
          {/* Painel lateral de blocos */}
          <div className="w-80 bg-white border-r border-gray-200 h-full overflow-y-auto">
            <BlockPalette onDragStart={handleDragStart} />
          </div>
          {/* Canvas central */}
          <div className="flex-1 flex flex-col min-h-0">
            <FlowCanvas
              ref={flowCanvasRef}
              onNodeSelect={handleNodeSelect}
              onUpdate={handleUpdate}
              onPublish={handlePublish}
              onFlowChange={handleFlowChange}
              onFlowUpdate={handleFlowUpdate}
              onNodeConfigSave={handleNodeConfigSaveCanvas}
              draggedBlockType={draggedBlockType}
              currentFlow={currentFlow}
              initialNodes={currentFlow?.nodes || []}
              initialEdges={currentFlow?.edges || []}
            />
          </div>
          {/* Painel de configuração do node */}
          {selectedNode && (
            <div className="w-full max-w-sm bg-white border-l border-gray-200 h-full shadow-xl">
              <NodeConfigPanel
                key={selectedNode.id}
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onSave={handleNodeConfigSave}
                onSaveToBackend={handleUpdate}
              />
            </div>
          )}
        </div>
      </div>
      )}
    </PermissionGuard>
  );
};
