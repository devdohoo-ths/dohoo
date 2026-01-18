import { CsvUser } from '../types';
import { PASSWORD_MIN_LENGTH } from '../constants';

export function validateCsvData(
  lines: string[], 
  organizationId?: string
): CsvUser[] {
  const [header, ...rows] = lines;
  const columns = header.split(';');
  
  // Validar cabeçalho
  const requiredColumns = ['name', 'email', 'role_name', 'password'];
  const missingColumns = requiredColumns.filter(col => !columns.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
  }
  
  const usersToInsert = rows.map((row, index) => {
    const values = row.split(';');
    
    // Validar se tem o número correto de colunas
    if (values.length !== columns.length) {
      throw new Error(`Linha ${index + 2}: Número incorreto de colunas`);
    }
    
    const user: any = {};
    columns.forEach((col, i) => {
      user[col] = values[i]?.trim() || '';
    });
    
    // Validações básicas
    if (!user.name || !user.email || !user.role_name || !user.password) {
      throw new Error(`Linha ${index + 2}: Todos os campos são obrigatórios`);
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      throw new Error(`Linha ${index + 2}: Email inválido`);
    }
    
    // Validar role_name
    if (!user.role_name || user.role_name.trim() === '') {
      throw new Error(`Linha ${index + 2}: role_name é obrigatório`);
    }
    
    // Validar senha
    if (user.password.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`Linha ${index + 2}: Senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`);
    }
    
    // Configurações padrão
    user.organization_id = organizationId;
    user.show_name_in_chat = true;
    
    return user as CsvUser;
  });

  if (usersToInsert.length === 0) {
    throw new Error('Nenhum usuário válido encontrado no CSV');
  }

  return usersToInsert;
}

export function downloadCsvTemplate(template: string) {
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_usuarios.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function readCsvFile(file: File): Promise<string[]> {
  const text = await file.text();
  return text.split(/\r?\n/).filter(Boolean);
}