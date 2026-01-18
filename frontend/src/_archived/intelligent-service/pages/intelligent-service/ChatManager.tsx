import React from 'react';
import { SupervisorChatActive } from '@/components/supervisor/SupervisorChatActive';
import { useAuth } from '@/hooks/useAuth';

/**
 * Página de Gestão de Chat
 * Integra o chat existente com funcionalidades de supervisor
 */
export default function ChatManager() {
  const { user, profile } = useAuth();
  
  // Usar dados do contexto de autenticação
  const organizationId = profile?.organization?.id || 'default-org';
  const userToken = user?.access_token || 'default-token';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <SupervisorChatActive 
          organizationId={organizationId}
          userToken={userToken}
        />
      </div>
    </div>
  );
}

