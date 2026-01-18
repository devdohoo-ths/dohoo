// Definição dos tipos de blocos disponíveis no Flow Builder
export const FLOW_BLOCKS = [
  {
    type: 'inicio',
    label: 'Início',
    icon: 'Play',
    configFields: [
      { key: 'mensagemInicial', label: 'Mensagem Inicial', type: 'textarea', required: true },
    ],
    color: 'green',
  },
  {
    type: 'mensagem',
    label: 'Mensagem',
    icon: 'MessageSquare',
    configFields: [
      { key: 'texto', label: 'Texto da Mensagem', type: 'textarea', required: true },
    ],
    color: 'blue',
  },
  {
    type: 'opcoes',
    label: 'Opções',
    icon: 'List',
    configFields: [
      { key: 'pergunta', label: 'Pergunta', type: 'textarea', required: true },
      { key: 'opcoes', label: 'Opções', type: 'options', required: true },
      { key: 'tipoApresentacao', label: 'Tipo de Apresentação', type: 'select', options: ['lista', 'botoes'], required: true },
    ],
    color: 'blue',
  },
  {
    type: 'decisao',
    label: 'Decisão',
    icon: 'GitBranch',
    configFields: [
      { key: 'pergunta', label: 'Pergunta', type: 'textarea', required: true },
      { key: 'opcaoSim', label: 'Texto da Opção "Sim"', type: 'text', required: true },
      { key: 'opcaoNao', label: 'Texto da Opção "Não"', type: 'text', required: true },
      { key: 'tipoResposta', label: 'Tipo de Resposta', type: 'select', options: ['texto', 'botoes'], required: true },
    ],
    color: 'yellow',
  },
  {
    type: 'horario',
    label: 'Horário de Funcionamento',
    icon: 'Clock',
    configFields: [
      { key: 'dias', label: 'Dias da Semana', type: 'diasSemana', required: true },
      { key: 'horarios', label: 'Intervalos de Horário', type: 'horarios', required: true },
    ],
    color: 'purple',
  },
  {
    type: 'dentro_horario',
    label: 'Dentro do Horário',
    icon: 'CheckCircle',
    configFields: [
      { key: 'texto', label: 'Mensagem', type: 'textarea', required: true },
    ],
    color: 'green',
  },
  {
    type: 'fora_horario',
    label: 'Fora do Horário',
    icon: 'XCircle',
    configFields: [
      { key: 'texto', label: 'Mensagem', type: 'textarea', required: true },
    ],
    color: 'red',
  },
  {
    type: 'imagem',
    label: 'Envio de Imagem',
    icon: 'Image',
    configFields: [
      { key: 'mensagem', label: 'Mensagem', type: 'textarea', required: false },
      { key: 'imagem', label: 'Imagem', type: 'file', accept: 'image/*', required: true },
    ],
    color: 'pink',
  },
  {
    type: 'audio',
    label: 'Envio de Áudio',
    icon: 'Mic',
    configFields: [
      { key: 'mensagem', label: 'Mensagem', type: 'textarea', required: false },
      { key: 'audio', label: 'Áudio', type: 'file', accept: 'audio/*', required: true },
    ],
    color: 'orange',
  },
  {
    type: 'documento',
    label: 'Envio de Documento',
    icon: 'FileText',
    configFields: [
      { key: 'mensagem', label: 'Mensagem', type: 'textarea', required: false },
      { key: 'documento', label: 'Documento', type: 'file', accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx', required: true },
    ],
    color: 'gray',
  },
  {
    type: 'api',
    label: 'API',
    icon: 'Zap',
    configFields: [
      { key: 'url', label: 'URL da API', type: 'text', required: true },
      { key: 'metodo', label: 'Método HTTP', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'textarea', required: false },
      { key: 'body', label: 'Body (JSON)', type: 'textarea', required: false },
    ],
    color: 'yellow',
  },
  {
    type: 'variavel',
    label: 'Variável',
    icon: 'Variable',
    configFields: [
      { key: 'nome', label: 'Nome da Variável', type: 'text', required: true },
      { key: 'valor', label: 'Valor', type: 'text', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['string', 'number', 'boolean'], required: true },
    ],
    color: 'purple',
  },
  {
    type: 'condicao',
    label: 'Condição',
    icon: 'Target',
    configFields: [
      { key: 'variavel', label: 'Variável', type: 'text', required: true },
      { key: 'operador', label: 'Operador', type: 'select', options: ['==', '!=', '>', '<', '>=', '<='], required: true },
      { key: 'valor', label: 'Valor', type: 'text', required: true },
    ],
    color: 'cyan',
  },
  {
    type: 'pesquisa_satisfacao',
    label: 'Pesquisa de Satisfação',
    icon: 'Star',
    configFields: [
      { key: 'pergunta', label: 'Pergunta', type: 'textarea', required: true },
      { key: 'tipoResposta', label: 'Tipo de Resposta', type: 'select', options: ['estrelas', 'texto'], required: true },
    ],
    color: 'amber',
  },
  // === FINALIZAÇÃO ===
  {
    type: 'transferencia_departamento',
    label: 'Transferir para Departamento',
    icon: 'Users',
    configFields: [
      { key: 'departamentoId', label: 'Departamento', type: 'selectDepartamento', required: true },
    ],
    color: 'indigo',
  },
  {
    type: 'transferencia_agente',
    label: 'Transferir para Agente',
    icon: 'User',
    configFields: [
      { key: 'agenteId', label: 'Agente', type: 'selectAgente', required: true },
    ],
    color: 'cyan',
  },
  {
    type: 'transferencia_ia',
    label: 'Transferir para IA',
    icon: 'Bot',
    configFields: [
      { key: 'agenteIaId', label: 'Agente de IA', type: 'selectAgenteIA', required: true },
    ],
    color: 'teal',
  },
  {
    type: 'encerrar',
    label: 'Encerrar',
    icon: 'XCircle',
    configFields: [
      { key: 'mensagem', label: 'Mensagem de Encerramento', type: 'textarea', required: false },
    ],
    color: 'red',
  },
];

export type FlowBlockType = typeof FLOW_BLOCKS[number]['type']; 