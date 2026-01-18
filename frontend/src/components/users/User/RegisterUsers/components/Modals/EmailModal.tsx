import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface EmailModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  newUsersForEmail: any[];
}

const EmailModal: React.FC<EmailModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading,
  newUsersForEmail
}) => {
  // ✅ ADICIONADO: Debug logs
  useEffect(() => {
    if (open) {
      console.log(` [EmailModal] Modal aberto com ${newUsersForEmail.length} usuários:`, newUsersForEmail);
    }
  }, [open, newUsersForEmail]);

  // ✅ ADICIONADO: Handlers com logs
  const handleClose = () => {
    console.log(' [EmailModal] Botão Pular clicado');
    onClose();
  };

  const handleConfirm = () => {
    console.log(' [EmailModal] Botão Enviar Emails clicado');
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar emails de boas-vindas</DialogTitle>
          <DialogDescription>
            Deseja enviar emails de boas-vindas para os novos usuários importados?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-blue-900 mb-2"> Novos usuários que receberão email ({newUsersForEmail.length}):</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {newUsersForEmail.length > 0 ? (
                newUsersForEmail.map((user, index) => (
                  <div key={index} className="text-sm text-blue-800 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="">{user.name}</span>
                      <span className="text-blue-600 text-xs">{user.email}</span>
                    </div>
                    <div className="text-xs text-blue-600">
                      Senha: {user.password}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-blue-600 italic">
                  Nenhum usuário novo para enviar email
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-xs">ℹ</span>
              </div>
              <h4 className="text-yellow-900">Informação</h4>
            </div>
            <p className="text-sm text-yellow-800 mt-2">
              Os emails conterão as credenciais de acesso e instruções para primeiro login.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={loading}
            type="button" // ✅ ADICIONADO: Garantir que é um botão
          >
            Pular
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading || newUsersForEmail.length === 0}
            type="button" // ✅ ADICIONADO: Garantir que é um botão
          >
            {loading ? 'Enviando...' : `Enviar Emails (${newUsersForEmail.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmailModal;