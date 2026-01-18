import { useState, useCallback } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ ADICIONADO: getAuthHeaders
import { CsvUser } from '../types';
import { validateCsvData, readCsvFile } from '../utils/csvHelpers';

interface UseCsvImportProps {
  organizationId?: string;
  organizationName?: string;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  onUsersUpdate: () => void;
}

export const useCsvImport = ({ 
  organizationId, 
  organizationName,
  onSuccess, 
  onError, 
  onUsersUpdate 
}: UseCsvImportProps) => {
  const [csvUploading, setCsvUploading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [importedUsers, setImportedUsers] = useState<CsvUser[]>([]);
  const [newUsersForEmail, setNewUsersForEmail] = useState<any[]>([]);
  const [sendingEmails, setSendingEmails] = useState(false);

  const handleCsvUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    onError(''); // Limpar erros anteriores

    try {
      const lines = await readCsvFile(file);
      const usersToInsert = validateCsvData(lines, organizationId);
      
      setImportedUsers(usersToInsert);
      setShowInviteModal(true);
    } catch (err: any) {
      onError(err.message || 'Erro ao importar CSV. Verifique o formato.');
    } finally {
      setCsvUploading(false);
    }
  }, [organizationId, onError]);

  const confirmImport = useCallback(async () => {
    if (importedUsers.length === 0) return;

    setCsvUploading(true);
    onError('');

    try {
      let successCount = 0;
      let errorCount = 0;
      let newUsers = [];
      let existingUsers = [];

      // ✅ CORRIGIDO: Obter headers de autenticação
      const headers = await getAuthHeaders();

      // Importar usuários um por um
      for (const user of importedUsers) {
        try {
          const response = await fetch(`${apiBase}/api/users/invite`, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: user.name,
              email: user.email,
              password: user.password,
              role_name: user.role_name,
              organization_id: user.organization_id,
              show_name_in_chat: user.show_name_in_chat,
            })
          });

          const result = await response.json();
          
          if (response.ok) {
            successCount++;
            
            // ✅ CORRIGIDO: Verificar se o usuário foi criado ou já existia
            if (result.existing) {
              // Usuário já existe
              existingUsers.push({
                name: user.name,
                email: user.email,
                message: 'Usuário já existe no sistema'
              });
              console.log(`⚠️ Usuário já existe: ${user.email}`);
            } else if (result.user) {
              // Usuário foi criado com sucesso
              newUsers.push({
                name: user.name,
                email: user.email,
                password: user.password
              });
              console.log(`✅ Usuário criado: ${user.email}`);
            }
          } else {
            // ✅ CORRIGIDO: Tratar erros específicos
            if (result.error && result.error.includes('already been registered')) {
              existingUsers.push({
                name: user.name,
                email: user.email,
                message: 'Usuário já existe no sistema'
              });
              console.log(`⚠️ Usuário já existe: ${user.email}`);
            } else {
              console.error(`❌ Erro ao importar ${user.email}:`, result.error);
              errorCount++;
            }
          }
        } catch (err: any) {
          console.error(`❌ Erro ao importar ${user.email}:`, err);
          errorCount++;
        }
      }

      // ✅ CORRIGIDO: Mensagem mais informativa
      let message = '';
      if (newUsers.length > 0 && existingUsers.length > 0) {
        message = `${newUsers.length} usuários criados com sucesso! ${existingUsers.length} já existiam no sistema.`;
      } else if (newUsers.length > 0) {
        message = `${newUsers.length} usuários importados com sucesso!`;
      } else if (existingUsers.length > 0) {
        message = `${existingUsers.length} usuários já existiam no sistema.`;
      } else if (errorCount > 0) {
        message = `${errorCount} usuários falharam na importação.`;
      }
      
      onSuccess(message);
      setShowInviteModal(false);
      setImportedUsers([]);
      onUsersUpdate();

      // ✅ CORRIGIDO: Só mostrar modal de email se há novos usuários
      if (newUsers.length > 0) {
        setNewUsersForEmail(newUsers);
        setShowEmailModal(true);
      }
    } catch (err: any) {
      console.error('❌ Erro geral na importação:', err);
      onError(err.message || 'Erro durante a importação');
    } finally {
      // ✅ CORRIGIDO: Garantir que o loading sempre é resetado
      setCsvUploading(false);
    }
  }, [importedUsers, onSuccess, onError, onUsersUpdate]);

  const sendEmailsToNewUsers = useCallback(async () => {
    if (newUsersForEmail.length === 0) return;

    setSendingEmails(true);
    onError('');

    try {
      // ✅ CORRIGIDO: Obter headers de autenticação
      const headers = await getAuthHeaders();
      let successCount = 0;
      let errorCount = 0;

      for (const user of newUsersForEmail) {
        try {
          console.log(`📧 Enviando email para: ${user.email}`);
          
          const response = await fetch(`${apiBase}/api/users/send-welcome-email`, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              password: user.password,
              organization_name: organizationName || 'Sua Organização'
            })
          });

          const result = await response.json();
          
          if (response.ok && result.success) {
            successCount++;
            console.log(`✅ Email enviado com sucesso para: ${user.email}`);
          } else {
            errorCount++;
            console.error(`❌ Erro ao enviar email para ${user.email}:`, result.error);
          }
        } catch (err: any) {
          errorCount++;
          console.error(`❌ Erro ao enviar email para ${user.email}:`, err);
        }
      }

      // ✅ CORRIGIDO: Mensagem mais informativa
      const message = errorCount > 0 
        ? `${successCount} emails enviados com sucesso! ${errorCount} falharam.`
        : `${successCount} emails enviados com sucesso!`;
      
      onSuccess(message);
      setShowEmailModal(false);
      setNewUsersForEmail([]);
    } catch (err: any) {
      console.error('❌ Erro geral ao enviar emails:', err);
      onError(err.message || 'Erro ao enviar emails');
    } finally {
      // ✅ CORRIGIDO: Garantir que o loading sempre é resetado
      setSendingEmails(false);
    }
  }, [newUsersForEmail, organizationName, onSuccess, onError]);

  // ✅ ADICIONADO: Função para resetar todos os estados
  const resetAllStates = useCallback(() => {
    setCsvUploading(false);
    setSendingEmails(false);
    setShowInviteModal(false);
    setShowEmailModal(false);
    setImportedUsers([]);
    setNewUsersForEmail([]);
    onError(''); // Limpar erros
  }, [onError]);

  // ✅ ADICIONADO: Função para fechar modais com reset
  const closeInviteModal = useCallback(() => {
    setShowInviteModal(false);
    setImportedUsers([]);
    setCsvUploading(false); // ✅ CORRIGIDO: Resetar loading
    
    // Reset automático do input file quando modal fecha
    setTimeout(() => {
      const fileInputs = document.querySelectorAll('input[type="file"][accept=".csv"]');
      fileInputs.forEach((input: any) => {
        input.value = '';
      });
    }, 100);
  }, []);

  const closeEmailModal = useCallback(() => {
    setShowEmailModal(false);
    setNewUsersForEmail([]);
    setSendingEmails(false); // ✅ CORRIGIDO: Resetar loading
  }, []);

  return {
    // Estado
    csvUploading,
    showInviteModal,
    showEmailModal,
    importedUsers,
    newUsersForEmail,
    sendingEmails,
    
    // Ações
    handleCsvUpload,
    confirmImport,
    sendEmailsToNewUsers,
    closeInviteModal,
    closeEmailModal,
    resetAllStates // ✅ ADICIONADO: Função para resetar tudo
  };
};