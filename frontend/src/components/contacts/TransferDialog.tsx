import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  UserCheck, 
  Users, 
  AlertCircle, 
  CheckCircle,
  Phone,
  User
} from 'lucide-react';
import { Contact, TransferContactsData } from '@/hooks/useContacts';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  contactIds: string[];
  onTransfer: (data: TransferContactsData) => Promise<void>;
  users: Array<{id: string; name: string; email: string; roles: {name: string}}>;
  loading?: boolean;
}

export function TransferDialog({
  open,
  onOpenChange,
  contacts,
  contactIds,
  onTransfer,
  users,
  loading = false
}: TransferDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar contatos selecionados
  const selectedContacts = contacts.filter(contact => contactIds.includes(contact.id));

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedUserId('');
      setNotes('');
      setErrors({});
    }
  }, [open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedUserId) {
      newErrors.user_id = 'Selecione um usuário de destino';
    } else if (!users.find(u => u.id === selectedUserId)) {
      newErrors.user_id = 'Usuário selecionado não é válido';
    }

    if (notes && notes.length > 500) {
      newErrors.notes = 'Observações devem ter no máximo 500 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const transferData: TransferContactsData = {
        contact_ids: contactIds,
        to_user_id: selectedUserId,
        notes: notes.trim() || undefined
      };

      await onTransfer(transferData);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao transferir contatos:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'user_id') {
      setSelectedUserId(value);
    } else if (field === 'notes') {
      setNotes(value);
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Formatar número brasileiro: 5511999999999 -> +55 (11) 99999-9999
    if (phone.length === 13 && phone.startsWith('55')) {
      const ddd = phone.substring(2, 4);
      const firstPart = phone.substring(4, 9);
      const secondPart = phone.substring(9);
      return `+55 (${ddd}) ${firstPart}-${secondPart}`;
    }
    return phone;
  };

  const getCurrentUser = (contact: Contact) => {
    return users.find(u => u.id === contact.user_id);
  };

  const getTargetUser = () => {
    return users.find(u => u.id === selectedUserId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Transferir Contatos
          </DialogTitle>
          <DialogDescription>
            Transfira {selectedContacts.length} contato(s) selecionado(s) para outro usuário.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lista de contatos selecionados */}
          <div className="space-y-3">
            <Label className="text-sm">Contatos selecionados:</Label>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
              {selectedContacts.map((contact) => {
                const currentUser = getCurrentUser(contact);
                return (
                  <div key={contact.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm">
                          {contact.name || 'Cliente'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(contact.phone_number)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Atual:</div>
                      <div className="text-sm">
                        {currentUser?.name || 'Não atribuído'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seleção do usuário de destino */}
          <div className="space-y-2">
            <Label htmlFor="user_id" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Transferir para *
            </Label>
            <Select
              value={selectedUserId}
              onValueChange={(value) => handleInputChange('user_id', value)}
            >
              <SelectTrigger className={errors.user_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecione o usuário de destino" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <span>{user.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.roles?.name || 'Usuário'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.user_id && (
              <p className="text-sm text-red-600">{errors.user_id}</p>
            )}
            
            {selectedUserId && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded text-sm">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800">
                  Transferindo para: <strong>{getTargetUser()?.name}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Observações (opcional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Motivo da transferência ou observações adicionais..."
              className={errors.notes ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes}</p>
            )}
            <p className="text-xs text-gray-500">
              {notes.length}/500 caracteres
            </p>
          </div>

          {/* Aviso sobre a transferência */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> Esta ação transferirá {selectedContacts.length} contato(s) 
              para o usuário selecionado. O histórico de interações será mantido, mas a responsabilidade 
              pelos contatos será alterada.
            </AlertDescription>
          </Alert>

          {/* Erro geral */}
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || loading || !selectedUserId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <UserCheck className="h-4 w-4 mr-2" />
              Transferir {selectedContacts.length} Contato(s)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
