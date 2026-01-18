import { 
  Play, 
  MessageSquare, 
  GitBranch, 
  Clock, 
  Users, 
  Database, 
  Zap, 
  Variable, 
  Target, 
  Bot, 
  Square,
  UserCheck,
  Building2,
  List,
  Image,
  Mic,
  FileText,
  Star,
  Pencil,
  User,
  XCircle
} from 'lucide-react';
import { BlockType } from './types';

export const ICON_MAP = {
  Play,
  MessageSquare,
  GitBranch,
  Clock,
  Users,
  Database,
  Zap,
  Variable,
  Target,
  Bot,
  Square,
  UserCheck,
  Building2,
  List,
  Image,
  Mic,
  FileText,
  Star,
  Pencil,
  User,
  XCircle
};

export const BLOCK_TYPES: BlockType[] = [
  {
    id: 'inicio',
    type: 'inicio',
    label: 'Início',
    description: 'Bloco inicial do fluxo',
    icon: 'Play',
    color: 'bg-green-500',
    category: 'Básico'
  },
  {
    id: 'mensagem',
    type: 'mensagem', 
    label: 'Mensagem',
    description: 'Enviar uma mensagem de texto',
    icon: 'MessageSquare',
    color: 'bg-blue-500',
    category: 'Comunicação'
  },
  {
    id: 'decisao',
    type: 'decisao',
    label: 'Decisão',
    description: 'Pergunta com opções Sim/Não',
    icon: 'GitBranch',
    color: 'bg-orange-500',
    category: 'Lógica'
  },
  {
    id: 'opcoes',
    type: 'opcoes',
    label: 'Opções',
    description: 'Lista de opções numeradas para o usuário escolher',
    icon: 'List',
    color: 'bg-purple-500',
    category: 'Lógica'
  },
  {
    id: 'horario',
    type: 'horario',
    label: 'Horário',
    description: 'Verificar horário de funcionamento',
    icon: 'Clock',
    color: 'bg-indigo-500',
    category: 'Condições'
  },
  {
    id: 'imagem',
    type: 'imagem',
    label: 'Imagem',
    description: 'Enviar uma imagem',
    icon: 'Image',
    color: 'bg-pink-500',
    category: 'Comunicação'
  },
  {
    id: 'audio',
    type: 'audio',
    label: 'Áudio',
    description: 'Enviar um áudio',
    icon: 'Mic',
    color: 'bg-orange-500',
    category: 'Comunicação'
  },
  {
    id: 'documento',
    type: 'documento',
    label: 'Documento',
    description: 'Enviar um documento',
    icon: 'FileText',
    color: 'bg-gray-500',
    category: 'Comunicação'
  },
  {
    id: 'transferencia_agente',
    type: 'transferencia_agente',
    label: 'Transferir p/ Agente',
    description: 'Transferir para um agente específico',
    icon: 'UserCheck',
    color: 'bg-red-500',
    category: 'Atendimento'
  },
  {
    id: 'transferencia_departamento',
    type: 'transferencia_departamento',
    label: 'Transferir p/ Depto',
    description: 'Transferir para um departamento',
    icon: 'Building2',
    color: 'bg-red-600',
    category: 'Atendimento'
  },
  {
    id: 'transferencia',
    type: 'transferencia',
    label: 'Transferência',
    description: 'Transferir para atendimento humano',
    icon: 'Users',
    color: 'bg-red-500',
    category: 'Atendimento'
  },
  {
    id: 'api',
    type: 'api',
    label: 'API',
    description: 'Chamar uma API externa',
    icon: 'Zap',
    color: 'bg-yellow-500',
    category: 'Integração'
  },
  {
    id: 'variavel',
    type: 'variavel',
    label: 'Variável',
    description: 'Definir ou capturar variáveis',
    icon: 'Variable',
    color: 'bg-purple-500',
    category: 'Dados'
  },
  {
    id: 'condicao',
    type: 'condicao',
    label: 'Condição',
    description: 'Avaliar condições de variáveis',
    icon: 'Target',
    color: 'bg-cyan-500',
    category: 'Condições'
  },
  {
    id: 'ia',
    type: 'ia',
    label: 'IA',
    description: 'Transferir para assistente de IA',
    icon: 'Bot',
    color: 'bg-pink-500',
    category: 'IA'
  },
  {
    id: 'transferencia_ia',
    type: 'transferencia_ia',
    label: 'Transferir p/ IA',
    description: 'Transferir para assistente de IA',
    icon: 'Bot',
    color: 'bg-teal-500',
    category: 'IA'
  },
  {
    id: 'pesquisa_satisfacao',
    type: 'pesquisa_satisfacao',
    label: 'Pesquisa',
    description: 'Pesquisa de satisfação',
    icon: 'Star',
    color: 'bg-amber-500',
    category: 'Atendimento'
  },
  {
    id: 'encerrar',
    type: 'encerrar',
    label: 'Encerrar',
    description: 'Finalizar o atendimento',
    icon: 'Square',
    color: 'bg-gray-500',
    category: 'Atendimento'
  }
];
