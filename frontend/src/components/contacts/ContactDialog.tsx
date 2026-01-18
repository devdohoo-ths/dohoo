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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Phone, FileText, AlertCircle } from 'lucide-react';
import { Contact, CreateContactData, UpdateContactData } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSave: (data: CreateContactData | UpdateContactData) => Promise<void>;
  users: Array<{id: string; name: string; email: string; roles: {name: string}}>;
  loading?: boolean;
}

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
  users,
  loading = false
}: ContactDialogProps) {
  const [formData, setFormData] = useState({
    phone_number: '',
    name: '',
    notes: '',
    user_id: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useAuth();
  const isEdit = !!contact;
  const isAdmin = user?.role_name === 'Admin' || user?.role_name === 'Super Admin';

  // Reset form when dialog opens/closes or contact changes
  useEffect(() => {
    if (open) {
      if (contact) {
        setFormData({
          phone_number: contact.phone_number,
          name: contact.name || '',
          notes: contact.notes || '',
          user_id: contact.user_id || ''
        });
      } else {
        setFormData({
          phone_number: '',
          name: '',
          notes: '',
          user_id: user?.id || ''
        });
      }
      setErrors({});
    }
  }, [open, contact, user?.id]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'Número de telefone é obrigatório';
    } else if (!/^\d+$/.test(formData.phone_number.replace(/\D/g, ''))) {
      newErrors.phone_number = 'Número de telefone deve conter apenas dígitos';
    }

    if (formData.name && formData.name.length > 100) {
      newErrors.name = 'Nome deve ter no máximo 100 caracteres';
    }

    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = 'Observações devem ter no máximo 500 caracteres';
    }

    if (isAdmin && formData.user_id && !users.find(u => u.id === formData.user_id)) {
      newErrors.user_id = 'Usuário selecionado não é válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = {
        phone_number: formData.phone_number.replace(/\D/g, ''),
        name: formData.name.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        ...(isAdmin && formData.user_id ? { user_id: formData.user_id } : {})
      };

      await onSave(submitData);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format Brazilian phone number
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 4) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length <= 9) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else if (digits.length <= 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange('phone_number', formatted);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEdit ? 'Editar Contato' : 'Novo Contato'}
          </DialogTitle>
          <DialogDescription>
            {isEdit 
              ? 'Atualize as informações do contato.'
              : 'Adicione um novo contato à sua carteira.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Número de telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone_number" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Número de telefone *
            </Label>
            <Input
              id="phone_number"
              value={formData.phone_number}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(11) 99999-9999"
              className={errors.phone_number ? 'border-red-500' : ''}
              disabled={isEdit} // Não permitir editar telefone em contatos existentes
            />
            {errors.phone_number && (
              <p className="text-sm text-red-600">{errors.phone_number}</p>
            )}
            {isEdit && (
              <p className="text-xs text-gray-500">
                O número de telefone não pode ser alterado após a criação.
              </p>
            )}
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nome
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Nome do contato (opcional)"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Usuário responsável (apenas para admins) */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="user_id" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Usuário responsável
              </Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => handleInputChange('user_id', value)}
              >
                <SelectTrigger className={errors.user_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <span>{user.name}</span>
                        <span className="text-xs text-gray-500">({user.roles?.name || 'Usuário'})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.user_id && (
                <p className="text-sm text-red-600">{errors.user_id}</p>
              )}
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observações
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Observações sobre o contato (opcional)"
              className={errors.notes ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes}</p>
            )}
            <p className="text-xs text-gray-500">
              {formData.notes.length}/500 caracteres
            </p>
          </div>

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
              disabled={isSubmitting || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Atualizar' : 'Criar'} Contato
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
