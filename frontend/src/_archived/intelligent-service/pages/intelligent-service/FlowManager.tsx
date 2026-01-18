import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Plus, ArrowLeft, Eye, EyeOff, Save, Play, Pencil, Check, X, Trash2, Power, PowerOff } from 'lucide-react';
import { useFlows } from '@/components/flow/hooks/useFlows';
import { useToast } from '@/hooks/use-toast';
import { NodeConfigPanel } from '@/components/flow/components/NodeConfigPanel';
import { Flow, FlowNode, FlowEdge } from '@/components/flow/types';
import BlockPaletteSimple from '../flow/BlockPaletteSimple';
import FlowCanvasSimple from '../flow/FlowCanvasSimple';
import { FLOW_BLOCKS_SIMPLE } from '../flow/flowBlocksSimple';

/**
 * Página de Gestão de Fluxos SIMPLIFICADA
 * Focada em fluxos básicos de atendimento
 */
export default function FlowManager() {
  const navigate = useNavigate();
  const { flowId } = useParams();
  const [currentView, setCurrentView] = useState<'list' | 'builder'>('list');
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [draggedBlockType, setDraggedBlockType] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempFlowName, setTempFlowName] = useState('');
  const [tempFlowDesc, setTempFlowDesc] = useState('');
  
  const { flows, saveFlow, deleteFlow, toggleActive, loading } = useFlows();
  const { toast } = useToast();
  const flowCanvasRef = useRef<any>(null);

  // Detectar flowId na URL e carregar flow
  useEffect(() => {
    console.log('🔍 [FlowManager] useEffect URL - flowId:', flowId, 'flows:', flows.length, 'currentFlow:', currentFlow?.id, 'currentView:', currentView);
    
    if (flowId && flows.length > 0) {
      // Só carregar se não temos um flow ativo ou se o ID é diferente
      if (!currentFlow || currentFlow.id !== flowId) {
        const flow = flows.find(f => f.id === flowId);
        if (flow) {
          console.log('📋 [FlowManager] Carregando flow da URL:', flowId);
          setCurrentFlow(flow);
          setTempFlowName(flow.nome);
          setTempFlowDesc(flow.descricao || '');
          setCurrentView('builder');
        } else {
          console.warn('⚠️ [FlowManager] Flow não encontrado:', flowId);
          navigate('/flow-manager', { replace: true }); // replace para não adicionar ao histórico
        }
      } else {
        console.log('✅ [FlowManager] Flow já está carregado, pulando');
        // Garantir que está na view builder se tem flowId
        if (currentView !== 'builder') {
          console.log('🔄 [FlowManager] Mudando para builder');
          setCurrentView('builder');
        }
      }
    } else if (flowId && flows.length === 0) {
      console.log('⏳ [FlowManager] Aguardando carregar flows...');
      // Manter na view builder enquanto carrega
      if (currentView !== 'builder') {
        console.log('🔄 [FlowManager] Mudando para builder (aguardando)');
        setCurrentView('builder');
      }
    } else if (!flowId && !currentFlow && currentView !== 'list') {
      // Só mudar para lista se NÃO tem flowId E NÃO tem currentFlow
      console.log('📝 [FlowManager] Sem flowId e sem currentFlow, mostrando lista');
      setCurrentView('list');
    }
  }, [flowId, flows]); // Removido currentView das dependências para evitar loop

  // Criar novo flow
  const handleCreateFlow = () => {
    const tempId = `temp-${Date.now()}`;
    const newFlow: Flow = {
      id: tempId,
      nome: 'Novo Fluxo de Atendimento',
      descricao: '',
      nodes: [
        {
          id: `inicio-${Date.now()}`,
          type: 'inicio',
          position: { x: 250, y: 100 },
          data: {
            label: 'Início',
            config: {
              mensagemInicial: 'Olá! Como posso ajudar você hoje?'
            }
          }
        }
      ],
      edges: [],
      ativo: false,
      canal: 'whatsapp',
      organization_id: '',
      user_id: '',
      created_at: new Date().toISOString()
    };
    setCurrentFlow(newFlow);
    setCurrentView('builder');
    navigate(`/flow-manager/${tempId}`); // ← Adicionar na URL
  };

  // Editar flow existente
  const handleEditFlow = (flow: Flow) => {
    console.log('✏️ [FlowManager] handleEditFlow chamado:', flow.id, flow.nome);
    setCurrentFlow(flow);
    setTempFlowName(flow.nome);
    setTempFlowDesc(flow.descricao || '');
    setCurrentView('builder');
    navigate(`/flow-manager/${flow.id}`); // ← Adicionar na URL
  };

  // Editar nome do flow
  const handleStartEditName = () => {
    setTempFlowName(currentFlow?.nome || '');
    setTempFlowDesc(currentFlow?.descricao || '');
    setIsEditingName(true);
  };

  const handleSaveFlowName = () => {
    if (!currentFlow) return;
    if (!tempFlowName.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome do fluxo não pode estar vazio',
        variant: 'destructive'
      });
      return;
    }

    setCurrentFlow({
      ...currentFlow,
      nome: tempFlowName.trim(),
      descricao: tempFlowDesc.trim()
    });
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setTempFlowName(currentFlow?.nome || '');
    setTempFlowDesc(currentFlow?.descricao || '');
    setIsEditingName(false);
  };

  // Voltar para lista
  const handleBackToList = () => {
    setCurrentView('list');
    setCurrentFlow(null);
    setSelectedNode(null);
    navigate('/flow-manager'); // ← Limpar URL
  };

  // Salvar flow
  const handleSaveFlow = async () => {
    if (!currentFlow) {
      console.error('❌ [FlowManager] handleSaveFlow: currentFlow é null!');
      return;
    }

    console.log('💾 [FlowManager] handleSaveFlow - currentFlow ID:', currentFlow.id);
    console.log('💾 [FlowManager] handleSaveFlow - currentFlow nome:', currentFlow.nome);
    console.log('💾 [FlowManager] Nodes:', currentFlow.nodes?.length || 0);
    console.log('💾 [FlowManager] Edges:', currentFlow.edges?.length || 0);
    console.log('💾 [FlowManager] É novo flow?', currentFlow.id?.startsWith('temp-'));

    setIsAutoSaving(true);
    const success = await saveFlow(currentFlow);
    setIsAutoSaving(false);

    if (success) {
      toast({
        title: 'Sucesso',
        description: 'Fluxo salvo com sucesso!'
      });
    }
  };

  // Deletar flow
  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Tem certeza que deseja deletar este fluxo?')) return;

    const success = await deleteFlow(flowId);
    if (success) {
      toast({
        title: 'Sucesso',
        description: 'Fluxo deletado com sucesso!'
      });
    }
  };

  // Callbacks do Canvas
  const handleNodeSelect = (node: FlowNode | null) => {
    console.log('🎯 [FlowManager] Node selecionado:', node);
    if (node) {
      // Garantir que o node tem a estrutura correta
      const validNode: FlowNode = {
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          label: node.data?.label || node.type,
          config: node.data?.config || {}
        }
      };
      console.log('✅ [FlowManager] Node validado:', validNode);
      setSelectedNode(validNode);
    } else {
      setSelectedNode(null);
    }
  };

  const handleDragStart = (blockType: string) => {
    setDraggedBlockType(blockType);
  };

  const handleFlowChange = useCallback((nodes: FlowNode[], edges: FlowEdge[]) => {
    console.log('📊 [FlowManager] handleFlowChange chamado:', { 
      nodesCount: nodes.length, 
      edgesCount: edges.length,
      nodes,
      edges 
    });
    
    setCurrentFlow(prev => {
      if (!prev) {
        console.warn('⚠️ [FlowManager] currentFlow é null, não pode atualizar!');
        return prev;
      }
      
      const updatedFlow = {
        ...prev,
        nodes,
        edges
      };
      console.log('📊 [FlowManager] Atualizando currentFlow:', updatedFlow);
      return updatedFlow;
    });
  }, []);

  const handleNodeConfigSave = (configData: any) => {
    console.log('💾 [FlowManager] handleNodeConfigSave chamado:', { configData, selectedNode });
    
    if (!currentFlow || !selectedNode) {
      console.error('❌ [FlowManager] currentFlow ou selectedNode é null!');
      return;
    }

    // Separar label do resto do config
    const { label: newLabel, ...actualConfig } = configData;
    
    console.log('📝 [FlowManager] Label:', newLabel);
    console.log('⚙️ [FlowManager] Config:', actualConfig);
    
    // Atualizar nodes no currentFlow
    const updatedNodes = currentFlow.nodes.map(node => {
      if (node.id === selectedNode.id) {
        return { 
          ...node, 
          data: { 
            label: newLabel || node.data.label,
            config: actualConfig
          } 
        };
      }
      return node;
    });

    console.log('✅ [FlowManager] Nodes atualizados:', updatedNodes);

    // Atualizar currentFlow (isso vai persistir ao salvar)
    setCurrentFlow({
      ...currentFlow,
      nodes: updatedNodes
    });

    // Atualizar também o canvas diretamente (para refletir visualmente)
    if (flowCanvasRef.current?.updateNodeConfig) {
      flowCanvasRef.current.updateNodeConfig(selectedNode.id, actualConfig);
    }

    setSelectedNode(null);
  };

  const handleNodeDelete = (nodeId: string) => {
    console.log('🗑️ [FlowManager] Deletando node:', nodeId);
    
    if (!currentFlow) return;

    // Deletar no canvas via ref (atualização visual imediata)
    if (flowCanvasRef.current?.deleteNode) {
      console.log('🔧 [FlowManager] Chamando deleteNode no canvas');
      flowCanvasRef.current.deleteNode(nodeId);
    }

    // Remover do currentFlow (para persistir ao salvar)
    const updatedNodes = currentFlow.nodes.filter(n => n.id !== nodeId);
    const updatedEdges = currentFlow.edges.filter(e => e.source !== nodeId && e.target !== nodeId);

    setCurrentFlow({
      ...currentFlow,
      nodes: updatedNodes,
      edges: updatedEdges
    });

    setSelectedNode(null);

    toast({
      title: 'Bloco deletado',
      description: 'O bloco foi removido do fluxo.'
    });
  };

  // VIEW: Lista de Flows
  if (currentView === 'list') {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-600" />
              Gestão de Fluxos
            </h1>
            <p className="text-muted-foreground mt-2">
              Fluxos simplificados para atendimento automatizado
            </p>
          </div>
          <Button onClick={handleCreateFlow}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>

        {/* Lista de Flows */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Carregando...</p>
              </CardContent>
            </Card>
          ) : flows.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="p-12 text-center">
                <Zap className="w-12 h-12 mx-auto mb-4 text-blue-600 opacity-50" />
                <h3 className="text-lg mb-2">
                  Nenhum fluxo criado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro fluxo de atendimento automatizado
                </p>
                <Button onClick={handleCreateFlow}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Fluxo
                </Button>
              </CardContent>
            </Card>
          ) : (
            flows.map(flow => (
              <Card key={flow.id} className="hover:shadow-lg transition-all duration-200 border-l-4" 
                    style={{ borderLeftColor: flow.ativo ? '#3b82f6' : '#9ca3af' }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-600" />
                        {flow.nome}
                      </CardTitle>
                      {flow.descricao && (
                        <p className="text-sm text-muted-foreground mt-1.5">
                          {flow.descricao}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant={flow.ativo ? "default" : "secondary"}
                      className={flow.ativo ? "bg-green-500" : ""}
                    >
                      {flow.ativo ? (
                        <><Power className="w-3 h-3 mr-1" /> Ativo</>
                      ) : (
                        <><PowerOff className="w-3 h-3 mr-1" /> Inativo</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="">{flow.nodes?.length || 0}</span>
                      <span>blocos</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="">{flow.edges?.length || 0}</span>
                      <span>conexões</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditFlow(flow)}
                      className="flex-1 border-gray-300 hover:bg-gray-50"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button 
                      size="sm" 
                      variant={flow.ativo ? "outline" : "default"}
                      onClick={() => toggleActive(flow)}
                      className={flow.ativo 
                        ? "px-3 border-gray-300" 
                        : "px-3 bg-green-500 hover:bg-green-600 text-white"
                      }
                      title={flow.ativo ? "Desativar fluxo" : "Ativar fluxo"}
                    >
                      {flow.ativo ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDeleteFlow(flow.id)}
                      className="px-3 border-red-300 text-red-600 hover:bg-red-50"
                      title="Deletar fluxo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // VIEW: Builder
  
  // Loading state: quando tem flowId na URL mas flow ainda não carregou
  if (flowId && !currentFlow && loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-pulse" />
          <h3 className="text-lg mb-2">Carregando fluxo...</h3>
          <p className="text-muted-foreground">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  // Se não tem currentFlow e não está carregando, redirecionar para lista
  if (!currentFlow) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-4 text-blue-600 opacity-50" />
          <h3 className="text-lg mb-2">Fluxo não encontrado</h3>
          <p className="text-muted-foreground mb-4">O fluxo que você está procurando não existe</p>
          <Button onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header do Builder */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          {isEditingName ? (
            <div className="flex-1 max-w-md space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={tempFlowName}
                  onChange={(e) => setTempFlowName(e.target.value)}
                  placeholder="Nome do fluxo"
                  className=""
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={handleSaveFlowName}>
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEditName}>
                  <X className="w-4 h-4 text-red-600" />
                </Button>
              </div>
              <Input
                value={tempFlowDesc}
                onChange={(e) => setTempFlowDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="text-sm"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div>
                <h2 className="">{currentFlow?.nome || 'Novo Fluxo'}</h2>
                {currentFlow?.descricao && (
                  <p className="text-xs text-muted-foreground">{currentFlow.descricao}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {currentFlow?.nodes?.length || 0} blocos • {currentFlow?.edges?.length || 0} conexões
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleStartEditName}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowPalette(!showPalette)}
          >
            {showPalette ? 'Ocultar Blocos' : 'Mostrar Blocos'}
          </Button>
          <Button 
            size="sm"
            onClick={handleSaveFlow}
            disabled={isAutoSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isAutoSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex min-h-0">
        {/* Paleta de Blocos SIMPLIFICADA */}
        {showPalette && (
          <div className="w-80 border-r bg-white">
            <BlockPaletteSimple onDragStart={handleDragStart} />
          </div>
        )}

        {/* Canvas Central SIMPLIFICADO */}
        <div className="flex-1">
          <FlowCanvasSimple
            ref={flowCanvasRef}
            onNodeSelect={handleNodeSelect}
            onUpdate={handleSaveFlow}
            onPublish={handleSaveFlow}
            onFlowChange={handleFlowChange}
            onNodeConfigSave={handleNodeConfigSave}
            draggedBlockType={draggedBlockType}
            currentFlow={currentFlow}
            initialNodes={currentFlow?.nodes || []}
            initialEdges={currentFlow?.edges || []}
          />
        </div>

        {/* Painel de Configuração */}
        {selectedNode && (
          <div className="w-96 border-l bg-white shadow-lg">
            <NodeConfigPanel
              key={selectedNode.id}
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onSave={handleNodeConfigSave}
              onSaveToBackend={handleSaveFlow}
              onDelete={handleNodeDelete}
              availableBlocks={FLOW_BLOCKS_SIMPLE}
            />
          </div>
        )}
      </div>
    </div>
  );
}
