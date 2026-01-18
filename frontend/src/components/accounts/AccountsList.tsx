import React from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  Clock,
  Mail,
  Loader2,
  Bot,
  Trash2
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WhatsAppAccount } from '@/hooks/useWhatsAppAccounts';
import { AIAssistant } from '@/types';
import { useFlows } from '../flow/hooks/useFlows';

interface AccountsListProps {
  accounts: WhatsAppAccount[];
  assistants: AIAssistant[]; 
  onSendInvite: (accountId: string) => void; // ✅ NOVO: Para enviar convite
  onDisconnect: (accountId: string) => void; // ✅ ADICIONADO: Para desconectar conta
  onDelete: (accountId: string, accountName: string) => void; // ✅ ADICIONADO: Para excluir conta
  loading?: boolean;
  sendingInvite?: string | null; // ✅ NOVO: Rastrear qual conta está enviando convite
}

const AccountsList: React.FC<AccountsListProps> = ({
  accounts,
  assistants,
  onSendInvite,
  onDisconnect,
  onDelete,
  loading = false,
  sendingInvite = null
}) => {
  const { flows } = useFlows();

  // Função para gerar avatar com iniciais
  const getAvatarFallback = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Função para obter foto de perfil do WhatsApp
  const getWhatsAppProfilePicture = (account: WhatsAppAccount) => {
    // Verificar se há foto de perfil nos dados da conta
    if ((account as any).config?.profile_picture) {
      return (account as any).config.profile_picture;
    }
    
    // Verificar se há foto de perfil diretamente na conta
    if ((account as any).profile_picture) {
      return (account as any).profile_picture;
    }
    
    return null;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'connecting':
        return <Clock className="text-yellow-500 animate-spin" size={16} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={16} />;
      default:
        return <WifiOff className="text-gray-500" size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: { variant: 'default' as const, label: 'Conectado', color: 'bg-green-500' },
      connecting: { variant: 'secondary' as const, label: 'Conectando...', color: 'bg-yellow-500' },
      error: { variant: 'destructive' as const, label: 'Erro', color: 'bg-red-500' },
      disconnected: { variant: 'outline' as const, label: 'Desconectado', color: 'bg-gray-500' }
    };

    const config = variants[status as keyof typeof variants] || variants.disconnected;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const getAssistantName = (assistantId: string | null) => {
    if (!assistantId) return 'Nenhum';
    const assistant = assistants.find(a => a.id === assistantId);
    return assistant?.name || 'Desconhecido';
  };

  const getFlowName = (flowId: string | null) => {
    if (!flowId) return 'Nenhum';
    const flow = flows.find(f => f.id === flowId);
    return flow?.nome || 'Desconhecido';
  };

  const getActiveService = (account: WhatsAppAccount) => {
    if (account.mode === 'flow') {
      return {
        type: 'Fluxo',
        name: getFlowName(account.flow_id),
        icon: <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 3v6a3 3 0 0 0 3 3h6"/><path d="M18 21v-6a3 3 0 0 0-3-3H9"/></svg>
      };
    } else {
      return {
        type: 'Assistente IA',
        name: getAssistantName(account.assistant_id),
        icon: <Bot className="w-4 h-4 text-blue-500" />
      };
    }
  };

  return (
    <div className="space-y-3">
      {accounts.map((account) => {
        const activeService = getActiveService(account);
        return (
          <div 
            key={account.id}
            className="bg-white dark:bg-slate-800 border rounded-lg p-4 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-10 h-10 border-2 border-white shadow-md">
                      <AvatarImage 
                        src={getWhatsAppProfilePicture(account)} 
                        alt={`Foto de perfil de ${account.name}`}
                      />
                      <AvatarFallback className="bg-green-600 text-white text-sm">
                        {getAvatarFallback(account.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1">
                      {getStatusIcon(account.status)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg truncate">{account.name}</h3>
                    {account.phone_number && (
                      <p className="text-sm text-muted-foreground font-mono">
                        {account.phone_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground">Status</div>
                    {getStatusBadge(account.status)}
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">{activeService.type}</div>
                    <div className="flex items-center gap-1">
                      {activeService.icon}
                      {activeService.name}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Criada em</div>
                    <div className="">
                      {new Date(account.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {account.status === 'disconnected' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onSendInvite(account.account_id)}
                    disabled={sendingInvite === account.account_id || loading}
                    className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingInvite === account.account_id ? (
                      <>
                        <Loader2 size={14} className="mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail size={14} className="mr-2" />
                        Enviar Convite
                      </>
                    )}
                  </Button>
                )}
                {account.status === 'connected' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onDisconnect(account.account_id)}
                    disabled={loading}
                    className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <WifiOff size={14} className="mr-2" />
                    Desconectar
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDelete(account.account_id, account.name || 'Conta')}
                  disabled={loading}
                  className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} className="mr-2" />
                  Excluir
                </Button>
              </div>
            </div>

            {/* Informações móveis */}
            <div className="md:hidden mt-3 pt-3 border-t space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{activeService.type}:</span>
                <span className="text-sm flex items-center gap-1">
                  {activeService.icon}
                  {activeService.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Criada em:</span>
                <span className="text-sm">
                  {new Date(account.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AccountsList;
