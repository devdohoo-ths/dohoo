import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desativar usuário?</DialogTitle>
          <DialogDescription>
            Esta ação pode ser revertida! Este usuário será desativado e não poderá mais acessar o sistema. Os dados serão mantidos para fins de auditoria e esta ação pode ser revertida posteriormente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-yellow-600 mb-2">Esta ação pode ser revertida!</div>
        <div className="mb-4 text-sm text-muted-foreground">
          Este usuário será desativado e não poderá mais acessar o sistema. Os dados serão mantidos para fins de auditoria e esta ação pode ser revertida posteriormente.
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Desativando...' : 'Desativar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteModal;