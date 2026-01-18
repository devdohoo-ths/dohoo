import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BLOCK_TYPES, ICON_MAP } from '../constants';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface FlowNodeProps {
  data: {
    label: string;
    nodeType: string;
    config: any;
  };
  selected?: boolean;
}

export const FlowNode = memo(({ data, selected }: FlowNodeProps) => {
  const blockType = BLOCK_TYPES.find(block => block.type === data.nodeType);
  const IconComponent = blockType ? ICON_MAP[blockType.icon as keyof typeof ICON_MAP] : null;

  const isStartNode = data.nodeType === 'inicio';
  const isEndNode = data.nodeType === 'encerrar';
  const isTransferNode = data.nodeType === 'transferencia' || 
                        data.nodeType === 'transferencia_agente' || 
                        data.nodeType === 'transferencia_departamento' || 
                        data.nodeType === 'transferencia_ia';
  const isIANode = data.nodeType === 'ia';
  const isDecisionNode = data.nodeType === 'decisao';
  const isConditionNode = data.nodeType === 'condicao';
  const isOptionsNode = data.nodeType === 'opcoes';
  const isHorarioNode = data.nodeType === 'horario';
  
  // Nós finais não devem ter saída
  const isFinalNode = isEndNode || isTransferNode || isIANode;

  // Extrair opções do config (array de strings ou string)
  let opcoes: string[] = [];
  if (isOptionsNode && data.config) {
    if (Array.isArray(data.config.opcoes)) {
      opcoes = data.config.opcoes.filter(Boolean);
    } else if (typeof data.config.opcoes === 'string') {
      opcoes = data.config.opcoes.split('\n').map((o: string) => o.trim()).filter(Boolean);
    }
  }

  return (
    <div className={`
      relative bg-white rounded-xl shadow-lg border-2 transition-all duration-200
      ${selected ? 'border-blue-500 shadow-xl scale-105' : 'border-gray-200 hover:border-gray-300'}
      ${isStartNode ? 'bg-gradient-to-br from-green-50 to-green-100' : ''}
      ${isFinalNode ? 'bg-gradient-to-br from-red-50 to-red-100' : ''}
      ${isDecisionNode || isConditionNode ? 'bg-gradient-to-br from-orange-50 to-orange-100' : ''}
      min-w-[180px] max-w-[260px] px-0 py-0
    `}>
      {/* Handle de entrada - superior */}
      {!isStartNode && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-gray-400 border-2 border-white rounded-full hover:bg-blue-500 transition-colors"
        />
      )}

      {/* Bloco especial para opções */}
      {isOptionsNode ? (
        <div className="flex flex-col w-full">
          {/* Título */}
          <div className="bg-gray-200 px-3 py-2 rounded-t-xl border-b border-gray-300 flex items-center justify-between">
            <span className="text-xs text-gray-700 truncate">{data.label || blockType?.label || 'Opções'}</span>
          </div>
          {/* Mensagem principal */}
          {data.config?.pergunta && (
            <div className="px-3 py-2 text-xs text-gray-700 bg-white border-b border-gray-200">
              {data.config.pergunta}
            </div>
          )}
          {/* Opções */}
          <div className="flex flex-col w-full px-2 py-2 bg-white">
            {opcoes.map((opcao, idx) => (
              <div key={"opcao_btn_"+idx} className="relative flex items-center group mb-1 last:mb-0">
                <div
                  className="flex-1 py-2 px-2 text-xs text-blue-700 text-center bg-white border border-gray-300 rounded cursor-pointer select-none transition-colors hover:bg-gray-50"
                  style={{ minHeight: 28 }}
                >
                  <span className="text-blue-600 mr-1">[{idx + 1}]</span>
                  {opcao}
                </div>
                {/* Handle de saída para cada opção - voltando para a lateral */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Handle
                      key={"opcao_" + idx}
                      type="source"
                      position={Position.Right}
                      id={"opcao_" + idx}
                      className="w-3 h-3 bg-blue-400 border-2 border-white rounded-full hover:bg-blue-600 transition-colors absolute right-[-10px] top-1/2 -translate-y-1/2"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {opcao || `Opção ${idx + 1}`}
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Conteúdo principal
        <div className="p-4">
          {/* Header com ícone e título */}
          <div className="flex items-center space-x-3 mb-2">
            {IconComponent && blockType && (
              <div className={`w-8 h-8 ${blockType.color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <IconComponent className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex items-center">
              {/* Para blocos de transferência, mostrar ícone + nome do tipo */}
              {isTransferNode ? (
                <span className="text-sm text-gray-800 truncate flex items-center">
                  {/* Espaço entre ícone e texto */}
                  {data.nodeType === 'transferencia_departamento' && <span>Departamento</span>}
                  {data.nodeType === 'transferencia_agente' && <span>Agente</span>}
                  {data.nodeType === 'transferencia_ia' && <span>Agente IA</span>}
                </span>
              ) : (
                <h3 className="text-sm text-gray-800 truncate">
                  {data.label}
                </h3>
              )}
              {/* Sub-label para outros blocos */}
              {blockType && !isTransferNode && (
                <p className="text-xs text-gray-500 capitalize">
                  {blockType.label}
                  {isFinalNode && <span className="text-red-500 ml-1">(Final)</span>}
                  {isTransferNode && <span className="text-red-500 ml-1">(Transferência)</span>}
                </p>
              )}
            </div>
          </div>

          {/* Status de configuração */}
          {data.config && Object.keys(data.config).length > 0 && (
            <div className="flex items-center space-x-1 mt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-600">Configurado</span>
            </div>
          )}

          {/* Informação adicional para blocos de transferência */}
          {isTransferNode && data.config && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
              {data.nodeType === 'transferencia_departamento' && data.config.departamentoId && (
                <div className="text-red-700">
                  <strong>Departamento:</strong> {data.config.departamentoNome || 'Não configurado'}
                </div>
              )}
              {data.nodeType === 'transferencia_agente' && data.config.agenteId && (
                <div className="text-red-700">
                  <strong>Agente:</strong> {data.config.agenteNome || 'Não configurado'}
                </div>
              )}
              {data.nodeType === 'transferencia_ia' && data.config.agenteIaId && (
                <div className="text-red-700">
                  <strong>Agente IA:</strong> {data.config.agenteIaNome || 'Não configurado'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Handle de saída - inferior (apenas para nós não finais e não opções/decisão/condição) */}
      {!isFinalNode && !isDecisionNode && !isConditionNode && !isOptionsNode && !isHorarioNode && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-gray-400 border-2 border-white rounded-full hover:bg-blue-500 transition-colors"
        />
      )}

      {/* Handles especiais para nó de decisão */}
      {isDecisionNode && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Handle
                type="source"
                position={Position.Right}
                id="sim"
                className="w-3 h-3 bg-green-500 border-2 border-white rounded-full hover:bg-green-600 transition-colors"
                style={{ top: '50%' }}
              />
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              {data.config?.opcaoSim || 'Sim'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Handle
                type="source"
                position={Position.Left}
                id="nao"
                className="w-3 h-3 bg-red-500 border-2 border-white rounded-full hover:bg-red-600 transition-colors"
                style={{ top: '50%' }}
              />
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              {data.config?.opcaoNao || 'Não'}
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Handles especiais para nó de condição */}
      {isConditionNode && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="verdadeiro"
            className="w-3 h-3 bg-green-500 border-2 border-white rounded-full hover:bg-green-600 transition-colors"
            style={{ top: '50%' }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="falso"
            className="w-3 h-3 bg-red-500 border-2 border-white rounded-full hover:bg-red-600 transition-colors"
            style={{ top: '50%' }}
          />
          {/* Labels para as saídas */}
          <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 text-xs text-green-600">
            Verdadeiro
          </div>
          <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 text-xs text-red-600">
            Falso
          </div>
        </>
      )}

      {/* Handles especiais para nó de horário */}
      {isHorarioNode && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Handle
                type="source"
                position={Position.Right}
                id="true"
                className="w-3 h-3 bg-green-500 border-2 border-white rounded-full hover:bg-green-600 transition-colors"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              Dentro do Horário
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Handle
                type="source"
                position={Position.Left}
                id="false"
                className="w-3 h-3 bg-red-500 border-2 border-white rounded-full hover:bg-red-600 transition-colors"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              Fora do Horário
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
});

FlowNode.displayName = 'FlowNode';
