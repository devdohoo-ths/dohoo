import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  importedUsers: any[];
  loading: boolean;
}

const ImportModal: React.FC<ImportModalProps> = ({
  open,
  onClose,
  onConfirm,
  importedUsers,
  loading
}) => {
  // ✅ ADICIONADO: Timeout de segurança para evitar carregamento infinito
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Timeout de segurança: Importação demorou mais de 30 segundos');
        // Aqui você pode adicionar lógica para forçar o reset se necessário
      }, 30000); // 30 segundos

      return () => clearTimeout(timeout);
    }
  }, [loading]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirmar Importação</DialogTitle>
          <DialogDescription>
            Confirme os dados dos usuários que serão importados. Verifique se todas as informações estão corretas antes de prosseguir.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <span className="text-blue-900">Importação em Lote</span>
            </div>
            <p className="text-sm text-blue-800">
              {importedUsers.length} usuário(s) serão importados. Cada usuário receberá um email de boas-vindas automaticamente.
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {importedUsers.map((user, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="">{user.name}</div>
                  <div className="text-sm text-gray-600">{user.email}</div>
                  <div className="text-xs text-gray-500">Role: {user.role_name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {user.show_name_in_chat ? 'Nome no Chat: Sim' : 'Nome no Chat: Não'}
                  </Badge>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Importando...' : `Importar ${importedUsers.length} usuário(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportModal;