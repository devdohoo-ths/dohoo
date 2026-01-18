import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Clock, 
  Mail,
  Loader2,
  Trash2
} from 'lucide-react';

interface Account {
  id?: string;
  account_id?: string;
  name: string;
  status: string;
  phone_number?: string;
  assistant_id?: string;
  flow_id?: string;
  mode?: string;
  platform?: string;
  account_type?: 'official' | 'unofficial';
  created_at: string;
  updated_at: string;
  last_connection?: string;
  user_id?: string;
  organization_id?: string;
  assigned_to?: string;
  assigned_user?: {
    id: string;
    name: string;
    email: string;
  };
  created_user?: {
    id: string;
    name: string;
    email: string;
  };
  config?: {
    phone_number?: string;
    account_type?: 'official' | 'unofficial';
    assistant_id?: string;
    flow_id?: string;
    mode?: string;
    [key: string]: any;
  };
}

// Tipo unificado que aceita tanto Account quanto Connection
type UnifiedAccount = Account | {
  id: string;
  account_id?: string; // ✅ ADICIONADO: account_id opcional
  name: string;
  status: string;
  platform: string;
  user_id: string;
  organization_id: string;
  assigned_to: string;
  phone_number?: string; // ✅ ADICIONADO: phone_number opcional
  responsible_user?: string; // ✅ ADICIONADO: responsible_user opcional
  assigned_user?: {
    id: string;
    name: string;
    email: string;
  };
  created_user?: {
    id: string;
    name: string;
    email: string;
  };
  config: {
    phone_number?: string;
    account_type?: 'official' | 'unofficial';
    [key: string]: any;
  };
  account_type?: 'official' | 'unofficial'; // ✅ ADICIONADO: account_type opcional
  created_at: string;
  updated_at: string;
};

interface AccountsCardsProps {
  accounts: UnifiedAccount[];
  assistants?: any[]; // ✅ ADICIONAR ESTA LINHA
  onSendInvite: (accountId: string) => void; // ✅ NOVO: Para enviar convite
  onDisconnect: (accountId: string) => void; // ✅ ADICIONADO: Para desconectar conta
  onDelete: (accountId: string, accountName: string) => void; // ✅ ADICIONADO: Para excluir conta
  loading: boolean;
  sendingInvite?: string | null; // ✅ NOVO: Rastrear qual conta está enviando convite
}

const AccountsCards: React.FC<AccountsCardsProps> = ({
  accounts,
  assistants = [],
  onSendInvite,
  onDisconnect,
  onDelete,
  loading,
  sendingInvite = null
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="text-emerald-600" size={16} />;
      case 'connecting':
        return <Clock className="text-amber-600" size={16} />;
      case 'disconnected':
        return <WifiOff className="text-slate-600" size={16} />;
      default:
        return <Smartphone className="text-slate-600" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'connecting':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'disconnected':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando...';
      case 'disconnected':
        return 'Desconectado';
      case 'error':
        return 'Erro';
      default:
        return status;
    }
  };

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
  const getWhatsAppProfilePicture = (account: UnifiedAccount) => {
    // Verificar se há foto de perfil nos dados da conta
    if (account.config?.profile_picture) {
      return account.config.profile_picture;
    }
    
    // Verificar se há foto de perfil diretamente na conta
    if ((account as any).profile_picture) {
      return (account as any).profile_picture;
    }
    
    return null;
  };

  // Função para obter cor do status sem gradientes
  const getStatusColorRefined = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200'
        };
      case 'connecting':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200'
        };
      default:
        return {
          bg: 'bg-white',
          border: 'border-slate-200'
        };
    }
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'whatsapp':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#25D366" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M20.52 3.478a11.812 11.812 0 0 0-16.707 0 11.812 11.812 0 0 0-2.67 12.524L0 24l8.236-2.118a11.79 11.79 0 0 0 5.271 1.282h.005c3.14 0 6.092-1.222 8.315-3.445 4.594-4.593 4.594-12.041 0-16.641zM12 21.754a9.76 9.76 0 0 1-4.982-1.368l-.357-.21-4.891 1.26 1.297-4.77-.232-.366A9.8 9.8 0 0 1 2.248 12c0-5.388 4.363-9.752 9.752-9.752 2.607 0 5.06 1.016 6.906 2.861a9.732 9.732 0 0 1 0 13.792A9.697 9.697 0 0 1 12 21.754zm5.443-7.334c-.299-.15-1.77-.875-2.044-.973-.273-.098-.472-.149-.67.15-.199.299-.768.973-.941 1.172-.173.199-.348.224-.647.075s-1.262-.464-2.402-1.478c-.888-.791-1.489-1.766-1.662-2.065-.173-.299-.018-.46.13-.609.134-.133.299-.348.448-.522.149-.174.199-.299.299-.498.1-.199.05-.374-.025-.523-.075-.15-.67-1.613-.916-2.211-.242-.579-.488-.5-.67-.51-.173-.007-.373-.009-.573-.009a1.09 1.09 0 0 0-.796.373c-.273.299-1.042 1.017-1.042 2.48 0 1.463 1.066 2.876 1.214 3.074.149.199 2.1 3.211 5.09 4.502.711.306 1.264.489 1.696.626.713.227 1.362.195 1.874.118.572-.085 1.77-.723 2.021-1.422.25-.699.25-1.298.174-1.422-.074-.124-.273-.199-.572-.348z"/>
          </svg>
        );
      case 'instagram':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#E1306C" viewBox="0 0 24 24" className="w-8 h-8">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.355 3.608 1.33.975.975 1.268 2.242 1.33 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.355 2.633-1.33 3.608-.975.975-2.242 1.268-3.608 1.33-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.355-3.608-1.33-.975-.975-1.268-2.242-1.33-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.355-2.633 1.33-3.608C4.538 2.588 5.805 2.295 7.171 2.233 8.437 2.175 8.817 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.773.13 4.548.435 3.523 1.46 2.497 2.486 2.192 3.711 2.134 4.99.875 6.27.863 6.679.863 10c0 3.321.012 3.73.072 5.01.058 1.279.363 2.504 1.389 3.529 1.025 1.026 2.25 1.331 3.529 1.389 1.279.06 1.688.072 5.01.072s3.73-.012 5.01-.072c1.279-.058 2.504-.363 3.529-1.389 1.026-1.025 1.331-2.25 1.389-3.529.06-1.279.072-1.688.072-5.01s-.012-3.73-.072-5.01c-.058-1.279-.363-2.504-1.389-3.529C19.954.435 18.729.13 17.45.072 16.17.013 15.761 0 12 0z"/>
            <path d="M12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zM18.406 4.594a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
          </svg>
        );
      case 'telegram':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#0088CC" viewBox="0 0 24 24" className="w-8 h-8">
            <path d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm5.543 7.53-2.2 10.372c-.166.743-.596.923-1.207.574l-3.338-2.462-1.61 1.552c-.177.177-.327.327-.67.327l.24-3.402 6.203-5.608c.27-.24-.058-.374-.418-.133l-7.662 4.823-3.298-1.03c-.717-.225-.73-.717.15-1.06l12.86-4.955c.594-.22 1.112.144.922 1.06z"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1877F2" viewBox="0 0 24 24" className="w-8 h-8">
            <path d="M22.675 0h-21.35C.595 0 0 .593 0 1.326v21.348C0 23.406.595 24 1.326 24h11.495v-9.294H9.691v-3.622h3.13V8.413c0-3.1 1.894-4.788 4.659-4.788 1.325 0 2.463.099 2.794.143v3.24h-1.917c-1.504 0-1.796.716-1.796 1.765v2.31h3.588l-.467 3.622h-3.12V24h6.116C23.405 24 24 23.406 24 22.674V1.326C24 .593 23.405 0 22.675 0z"/>
          </svg>
        );
      default:
        // WhatsApp como padrão
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#25D366" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M20.52 3.478a11.812 11.812 0 0 0-16.707 0 11.812 11.812 0 0 0-2.67 12.524L0 24l8.236-2.118a11.79 11.79 0 0 0 5.271 1.282h.005c3.14 0 6.092-1.222 8.315-3.445 4.594-4.593 4.594-12.041 0-16.641zM12 21.754a9.76 9.76 0 0 1-4.982-1.368l-.357-.21-4.891 1.26 1.297-4.77-.232-.366A9.8 9.8 0 0 1 2.248 12c0-5.388 4.363-9.752 9.752-9.752 2.607 0 5.06 1.016 6.906 2.861a9.732 9.732 0 0 1 0 13.792A9.697 9.697 0 0 1 12 21.754zm5.443-7.334c-.299-.15-1.77-.875-2.044-.973-.273-.098-.472-.149-.67.15-.199.299-.768.973-.941 1.172-.173.199-.348.224-.647.075s-1.262-.464-2.402-1.478c-.888-.791-1.489-1.766-1.662-2.065-.173-.299-.018-.46.13-.609.134-.133.299-.348.448-.522.149-.174.199-.299.299-.498.1-.199.05-.374-.025-.523-.075-.15-.67-1.613-.916-2.211-.242-.579-.488-.5-.67-.51-.173-.007-.373-.009-.573-.009a1.09 1.09 0 0 0-.796.373c-.273.299-1.042 1.017-1.042 2.48 0 1.463 1.066 2.876 1.214 3.074.149.199 2.1 3.211 5.09 4.502.711.306 1.264.489 1.696.626.713.227 1.362.195 1.874.118.572-.085 1.77-.723 2.021-1.422.25-.699.25-1.298.174-1.422-.074-.124-.273-.199-.572-.348z"/>
          </svg>
        );
    }
  };

  const getCardColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-50 border-emerald-200';
      case 'connecting':
        return 'bg-amber-50 border-amber-200';
      case 'disconnected':
        return 'bg-slate-50 border-slate-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-white border-slate-200';
    }
  };

  // ✅ NOVO: Botão para enviar convite (só aparece se status = disconnected)
  const getInviteButton = (account: UnifiedAccount) => {
    if (account.status !== 'disconnected') {
      return null; // Não mostrar botão se não estiver desconectado
    }

    const accountId = account.account_id || account.id;
    const isSending = sendingInvite === accountId;

    return (
      <Button
        size="sm"
        onClick={() => onSendInvite(accountId)}
        disabled={isSending || loading}
        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSending ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Mail size={16} className="mr-2" />
            Enviar Convite
          </>
        )}
      </Button>
    );
  };

  // ✅ NOVO: Botão para desconectar (só aparece se status = connected)
  const getDisconnectButton = (account: UnifiedAccount) => {
    if (account.status !== 'connected') {
      return null; // Não mostrar botão se não estiver conectado
    }

    const accountId = account.account_id || account.id;

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDisconnect(accountId)}
        disabled={loading}
        className="border-red-200 text-red-700 hover:bg-red-50 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <WifiOff size={16} className="mr-2" />
        Desconectar
      </Button>
    );
  };

  // ✅ NOVO: Botão para excluir conta (sempre visível)
  const getDeleteButton = (account: UnifiedAccount) => {
    const accountId = account.account_id || account.id;
    const accountName = account.name || 'Conta';

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDelete(accountId, accountName)}
        disabled={loading}
        className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 size={16} className="mr-2" />
        Excluir
      </Button>
    );
  };

  // ✅ ADICIONAR ESTAS FUNÇÕES
  const getAssistantName = (assistantId: string | null) => {
    if (!assistantId) return 'Nenhum';
    const assistant = assistants.find(a => a.id === assistantId);
    return assistant?.name || 'Desconhecido';
  };

  const getFlowName = (flowId: string | null) => {
    if (!flowId) return 'Nenhum';
    // Você pode adicionar flows aqui se necessário
    return 'Flow'; // Placeholder
  };

  const showSkeletonCards = loading && accounts.length === 0;

  if (showSkeletonCards) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-white border-0 shadow-lg animate-pulse">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                  <div className="h-6 bg-slate-200 rounded w-20"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-full"></div>
                  <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="flex space-x-2">
                  <div className="h-8 bg-slate-200 rounded flex-1"></div>
                  <div className="h-8 bg-slate-200 rounded w-8"></div>
                  <div className="h-8 bg-slate-200 rounded w-8"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
      {accounts.map((account) => {
        const statusColors = getStatusColorRefined(account.status);
        return (
        <Card key={account.id || account.account_id} className={`${statusColors.bg} ${statusColors.border} shadow-lg hover:shadow-xl transition-all duration-300 group border-2`}>
          <CardContent className="p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Avatar com foto de perfil do WhatsApp */}
                <div className="flex-shrink-0 relative">
                  <Avatar className="w-12 h-12 border-2 border-white shadow-md">
                    <AvatarImage 
                      src={getWhatsAppProfilePicture(account)} 
                      alt={`Foto de perfil de ${account.name}`}
                    />
                    <AvatarFallback className="bg-green-600 text-white">
                      {getAvatarFallback(account.name)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Removido: Indicador de status redundante */}
                  {/* Removido: Ícone da plataforma */}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-slate-900 truncate">
                      {account.name}
                    </h3>
                  </div>
                  {(account.phone_number || account.config?.phone_number) && (
                    <p className="text-sm text-slate-500 truncate">
                      {account.phone_number || account.config?.phone_number}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className={`ml-2 flex-shrink-0 ${getStatusColor(account.status)}`}>
                  <span className="w-2 h-2 rounded-full mr-2 bg-current"></span>
                  {getStatusText(account.status)}
                </Badge>
              </div>
            </div>

            {/* Details - Informações simplificadas */}
            <div className="space-y-3 mb-4">
              <div className="space-y-2">
                {/* ✅ REMOVIDO: Log excessivo que causava loops de re-render */}
                
                {/* Modo e Configuração */}
                {account.mode && (
                  <div className="flex items-center gap-2">
                    <Badge variant={account.mode === 'ia' ? 'default' : 'outline'} className="text-xs">
                      {account.mode === 'ia' ? '🤖 IA' : '⚡ Flow'}
                    </Badge>
                    {account.mode === 'ia' && account.assistant_id && (
                      <span className="text-xs text-slate-600">
                        {getAssistantName(account.assistant_id)}
                      </span>
                    )}
                    {account.mode === 'flow' && account.flow_id && (
                      <span className="text-xs text-slate-600 text-green-600">
                        ✓ Flow Ativo
                      </span>
                    )}
                  </div>
                )}
                
                {/* Apenas informações essenciais */}
                {account.responsible_user ? (
                  <div className="flex items-center text-sm text-slate-600">
                    <span className="mr-2">Responsável:</span>
                    <span>{account.responsible_user.name}</span>
                  </div>
                ) : account.user_id && (
                  <div className="flex items-center text-sm text-slate-600">
                    <span className="mr-2">Responsável:</span>
                    <span>ID: {account.user_id}</span>
                  </div>
                )}
                
                {account.last_connection && (
                  <div className="flex items-center text-sm text-slate-600">
                    <span className="mr-2">Última conexão:</span>
                    <span>{account.last_connection}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions - Botões de ação baseados no status */}
            <div className="flex flex-col sm:flex-row gap-2">
              {getInviteButton(account)}
              {getDisconnectButton(account)}
              {getDeleteButton(account)}
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
};

export default AccountsCards;
