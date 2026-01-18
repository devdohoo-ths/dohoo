import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Mail } from 'lucide-react';

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
  invitedUser: any | null;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  open,
  onClose,
  invitedUser
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Convite Enviado!
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg">Email enviado com sucesso!</h3>
            <p className="text-sm text-muted-foreground mt-2">
              O convite foi enviado para <strong>{invitedUser?.email}</strong>
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-blue-900 mb-2">📧 O que acontece agora?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• O usuário receberá um email com um link seguro</li>
              <li>• O link permite conectar o WhatsApp de forma segura</li>
              <li>• O convite expira em 7 dias por segurança</li>
              <li>• Você pode reenviar o convite a qualquer momento</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SuccessModal;