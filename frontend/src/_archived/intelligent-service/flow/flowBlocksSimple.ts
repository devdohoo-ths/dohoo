// Definição dos blocos SIMPLIFICADOS para Atendimento Inteligente
// Removidos: Integrações (API), Dados (Variáveis/Condições), IA, Mídia complexa

export const FLOW_BLOCKS_SIMPLE = [
  // === INÍCIO ===
  {
    type: 'inicio',
    label: 'Início',
    icon: 'Play',
    category: 'basico',
    configFields: [
      { 
        key: 'mensagemInicial', 
        label: 'Mensagem Inicial', 
        type: 'textarea', 
        required: true,
        placeholder: 'Digite a mensagem de boas-vindas...'
      },
    ],
    color: 'green',
    description: 'Ponto inicial do fluxo de atendimento'
  },

  // === MENSAGENS ===
  {
    type: 'mensagem',
    label: 'Mensagem',
    icon: 'MessageSquare',
    category: 'basico',
    configFields: [
      { 
        key: 'texto', 
        label: 'Texto da Mensagem', 
        type: 'textarea', 
        required: true,
        placeholder: 'Digite a mensagem que será enviada...'
      },
    ],
    color: 'blue',
    description: 'Envia uma mensagem de texto'
  },

  // === INTERAÇÕES ===
  {
    type: 'opcoes',
    label: 'Menu de Opções',
    icon: 'List',
    category: 'interacao',
    configFields: [
      { 
        key: 'pergunta', 
        label: 'Pergunta', 
        type: 'textarea', 
        required: true,
        placeholder: 'Ex: Escolha uma opção:'
      },
      { 
        key: 'opcoes', 
        label: 'Opções', 
        type: 'options', 
        required: true,
        placeholder: 'Digite as opções (uma por linha)'
      },
      { 
        key: 'tipoApresentacao', 
        label: 'Tipo de Apresentação', 
        type: 'select', 
        options: [
          { value: 'lista', label: 'Lista Numerada' },
          { value: 'botoes', label: 'Botões' }
        ], 
        required: true 
      },
    ],
    color: 'blue',
    description: 'Menu com múltiplas opções'
  },

  {
    type: 'decisao',
    label: 'Pergunta Sim/Não',
    icon: 'GitBranch',
    category: 'interacao',
    configFields: [
      { 
        key: 'pergunta', 
        label: 'Pergunta', 
        type: 'textarea', 
        required: true,
        placeholder: 'Ex: Deseja continuar?'
      },
      { 
        key: 'opcaoSim', 
        label: 'Texto da Opção "Sim"', 
        type: 'text', 
        required: true,
        defaultValue: 'Sim'
      },
      { 
        key: 'opcaoNao', 
        label: 'Texto da Opção "Não"', 
        type: 'text', 
        required: true,
        defaultValue: 'Não'
      },
      { 
        key: 'tipoResposta', 
        label: 'Tipo de Resposta', 
        type: 'select', 
        options: [
          { value: 'texto', label: 'Texto Livre' },
          { value: 'botoes', label: 'Botões' }
        ], 
        required: true 
      },
    ],
    color: 'yellow',
    description: 'Pergunta com duas opções'
  },

  {
    type: 'coletar_dados',
    label: 'Coletar Informação',
    icon: 'Pencil',
    category: 'interacao',
    configFields: [
      { 
        key: 'pergunta', 
        label: 'Pergunta', 
        type: 'textarea', 
        required: true,
        placeholder: 'Ex: Qual seu nome?'
      },
      { 
        key: 'tipoDado', 
        label: 'Tipo de Dado', 
        type: 'select', 
        options: [
          { value: 'texto', label: 'Texto' },
          { value: 'numero', label: 'Número' },
          { value: 'email', label: 'E-mail' },
          { value: 'telefone', label: 'Telefone' }
        ], 
        required: true 
      },
      { 
        key: 'nomeVariavel', 
        label: 'Salvar como', 
        type: 'text', 
        required: true,
        placeholder: 'Ex: nome_cliente'
      },
    ],
    color: 'cyan',
    description: 'Coleta informações do usuário'
  },

  // === FINALIZAÇÃO ===
  {
    type: 'transferencia_time',
    label: 'Transferir para Time',
    icon: 'Users',
    category: 'finalizacao',
    configFields: [
      { 
        key: 'teamId', 
        label: 'Time', 
        type: 'selectTeam', 
        required: true,
        placeholder: 'Selecione o time de atendimento'
      },
      { 
        key: 'mensagem', 
        label: 'Mensagem antes de transferir', 
        type: 'textarea', 
        required: false,
        placeholder: 'Ex: Aguarde, você será atendido por nossa equipe...'
      },
    ],
    color: 'indigo',
    description: 'Transfere para um time de atendimento'
  },

  {
    type: 'transferencia_agente',
    label: 'Transferir para Agente',
    icon: 'User',
    category: 'finalizacao',
    configFields: [
      { 
        key: 'agenteId', 
        label: 'Agente', 
        type: 'selectAgente', 
        required: true,
        placeholder: 'Selecione o agente'
      },
      { 
        key: 'mensagem', 
        label: 'Mensagem antes de transferir', 
        type: 'textarea', 
        required: false,
        placeholder: 'Ex: Você será atendido por um de nossos especialistas...'
      },
    ],
    color: 'cyan',
    description: 'Transfere para um agente específico'
  },

  {
    type: 'encerrar',
    label: 'Encerrar Atendimento',
    icon: 'XCircle',
    category: 'finalizacao',
    configFields: [
      { 
        key: 'mensagem', 
        label: 'Mensagem de Encerramento', 
        type: 'textarea', 
        required: false,
        placeholder: 'Ex: Obrigado por entrar em contato!'
      },
    ],
    color: 'red',
    description: 'Finaliza o atendimento'
  },
];

// Categorias para organizar os blocos na paleta
export const BLOCK_CATEGORIES = [
  {
    id: 'basico',
    label: 'Básico',
    icon: 'Layers',
    description: 'Blocos essenciais para iniciar'
  },
  {
    id: 'interacao',
    label: 'Interação',
    icon: 'MessageCircle',
    description: 'Perguntas e coleta de dados'
  },
  {
    id: 'finalizacao',
    label: 'Finalização',
    icon: 'CheckCircle',
    description: 'Encerramento ou transferência'
  },
];

export type FlowBlockTypeSimple = typeof FLOW_BLOCKS_SIMPLE[number]['type'];

// Helper para buscar bloco por tipo
export const getBlockByType = (type: string) => {
  return FLOW_BLOCKS_SIMPLE.find(block => block.type === type);
};

// Helper para buscar blocos por categoria
export const getBlocksByCategory = (category: string) => {
  return FLOW_BLOCKS_SIMPLE.filter(block => block.category === category);
};

