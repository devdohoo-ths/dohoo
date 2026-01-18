export interface FlowNode {
  id: string;
  type: 'inicio' | 'mensagem' | 'decisao' | 'opcoes' | 'horario' | 'dentro_horario' | 'fora_horario' | 'transferencia' | 'transferencia_agente' | 'transferencia_departamento' | 'api' | 'variavel' | 'condicao' | 'ia' | 'encerrar';
  position: { x: number; y: number };
  data: {
    label: string;
    config?: any;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface Flow {
  id?: string;
  nome: string;
  descricao?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  ativo: boolean;
  canal?: string;
  organization_id: string;
  user_id?: string;
  created_at?: string;
}

export interface BlockType {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  category: string;
}
