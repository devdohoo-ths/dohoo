import React, { useState } from 'react';
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  UserCheck, 
  Phone, 
  Calendar,
  User,
  MessageSquare,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Contact } from '@/hooks/useContacts';
import { ProfilePic } from './ProfilePic';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactsTableProps {
  contacts: Contact[];
  loading: boolean;
  selectedContacts: string[];
  onSelectContact: (contactId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contact: Contact) => void;
  onTransferContacts: (contactIds: string[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  canTransfer: boolean;
  // Propriedades de paginação
  totalContacts?: number;
  currentPage?: number;
  itemsPerPage?: number;
}

export function ContactsTable({
  contacts,
  loading,
  selectedContacts,
  onSelectContact,
  onSelectAll,
  onEditContact,
  onDeleteContact,
  onTransferContacts,
  canEdit,
  canDelete,
  canTransfer,
  totalContacts,
  currentPage = 1,
  itemsPerPage = 50
}: ContactsTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

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

  const formatLastInteraction = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'Data inválida';
    }
  };

  const getContactStatus = (contact: Contact) => {
    if (!contact.last_interaction_at) {
      return { label: 'Novo', variant: 'secondary' as const };
    }
    
    const lastInteraction = new Date(contact.last_interaction_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      return { label: 'Ativo', variant: 'default' as const };
    } else if (daysDiff <= 7) {
      return { label: 'Recente', variant: 'secondary' as const };
    } else if (daysDiff <= 30) {
      return { label: 'Inativo', variant: 'outline' as const };
    } else {
      return { label: 'Inativo', variant: 'destructive' as const };
    }
  };

  const allSelected = contacts.length > 0 && selectedContacts.length === contacts.length;
  const someSelected = selectedContacts.length > 0 && selectedContacts.length < contacts.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg text-gray-900 mb-2">
          Nenhum contato encontrado
        </h3>
        <p className="text-gray-500">
          {selectedContacts.length > 0 
            ? 'Nenhum contato corresponde aos filtros aplicados.'
            : 'Comece adicionando contatos manualmente ou aguarde a captura automática.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {totalContacts ? (
              `Mostrando ${((currentPage - 1) * itemsPerPage) + 1} a ${Math.min(currentPage * itemsPerPage, totalContacts)} de ${totalContacts} contatos`
            ) : (
              `${contacts.length} contato(s) encontrado(s)`
            )}
          </span>
          {selectedContacts.length > 0 && (
            <Badge variant="secondary">
              {selectedContacts.length} selecionado(s)
            </Badge>
          )}
        </div>
        
        {selectedContacts.length > 0 && canTransfer && (
          <Button
            onClick={() => onTransferContacts(selectedContacts)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Transferir Selecionados
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onCheckedChange={(checked) => onSelectAll(checked as boolean)}
                />
              </TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última Interação</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => {
              const isSelected = selectedContacts.includes(contact.id);
              const status = getContactStatus(contact);
              const canEditThis = canEdit && (contact.user_id === contact.user?.id || canEdit);
              const canDeleteThis = canDelete && (contact.user_id === contact.user?.id || canDelete);

              return (
                <TableRow
                  key={contact.id}
                  className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  onMouseEnter={() => setHoveredRow(contact.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelectContact(contact.id, checked as boolean)}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProfilePic 
                        phoneNumber={contact.phone_number} 
                        name={contact.name || 'Cliente'}
                        size="md"
                      />
                      <div>
                        <div className="text-gray-900">
                          {contact.name || 'Cliente'}
                        </div>
                        {contact.notes && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {contact.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="font-mono text-sm">
                        {formatPhoneNumber(contact.phone_number)}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        {contact.user?.name || 'Não atribuído'}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatLastInteraction(contact.last_interaction_at)}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEditThis && (
                          <DropdownMenuItem onClick={() => onEditContact(contact)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        
                        {canTransfer && (
                          <DropdownMenuItem 
                            onClick={() => onTransferContacts([contact.id])}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Transferir
                          </DropdownMenuItem>
                        )}
                        
                        {(canEditThis || canDeleteThis) && <DropdownMenuSeparator />}
                        
                        {canDeleteThis && (
                          <DropdownMenuItem 
                            onClick={() => onDeleteContact(contact)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
