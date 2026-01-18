import { Contact } from '@/hooks/useContacts';

export function exportContactsToCSV(contacts: Contact[], filename: string = 'contatos.csv') {
  if (!contacts || contacts.length === 0) {
    console.warn('Nenhum contato para exportar');
    return;
  }

  // Cabeçalhos do CSV
  const headers = [
    'Nome',
    'Telefone',
    'Email',
    'Responsável',
    'Observações',
    'Status',
    'Última Interação',
    'Data de Criação'
  ];

  // Converter contatos para formato CSV
  const csvRows = [
    headers.join(','), // Cabeçalho
    ...contacts.map(contact => {
      const row = [
        `"${(contact.name || 'Cliente').replace(/"/g, '""')}"`, // Escapar aspas duplas
        `"${contact.phone_number || ''}"`,
        `"${contact.email || ''}"`,
        `"${contact.user?.name || ''}"`,
        `"${(contact.notes || '').replace(/"/g, '""')}"`, // Escapar aspas duplas
        `"${contact.is_active ? 'Ativo' : 'Inativo'}"`,
        `"${contact.last_interaction_at ? new Date(contact.last_interaction_at).toLocaleString('pt-BR') : 'Nunca'}"`,
        `"${contact.created_at ? new Date(contact.created_at).toLocaleString('pt-BR') : ''}"`
      ];
      return row.join(',');
    })
  ];

  // Criar conteúdo CSV
  const csvContent = csvRows.join('\n');

  // Criar e baixar arquivo
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function formatContactsForExport(contacts: Contact[]) {
  return contacts.map(contact => ({
    nome: contact.name || 'Cliente',
    telefone: contact.phone_number || '',
    email: contact.email || '',
    responsavel: contact.user?.name || '',
    observacoes: contact.notes || '',
    status: contact.is_active ? 'Ativo' : 'Inativo',
    ultimaInteracao: contact.last_interaction_at ? new Date(contact.last_interaction_at).toLocaleString('pt-BR') : 'Nunca',
    dataCriacao: contact.created_at ? new Date(contact.created_at).toLocaleString('pt-BR') : ''
  }));
}
