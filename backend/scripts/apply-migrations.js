import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL não encontrada no arquivo .env');
  console.log('📝 Por favor, adicione sua SUPABASE_URL no arquivo .env');
  process.exit(1);
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no arquivo .env');
  console.log('📝 Por favor, adicione sua SUPABASE_SERVICE_ROLE_KEY no arquivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(migrationFile) {
  try {
    console.log(`📄 Aplicando migração: ${migrationFile}`);
    
    const migrationPath = path.join(__dirname, '../supabase/migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Dividir o SQL em comandos individuais
    const commands = sql.split(';').filter(cmd => cmd.trim().length > 0);
    
    for (const command of commands) {
      if (command.trim()) {
        console.log(`🔧 Executando: ${command.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: command });
        
        if (error) {
          console.error(`❌ Erro ao executar comando:`, error);
          console.error(`Comando: ${command}`);
          return false;
        }
      }
    }
    
    console.log(`✅ Migração ${migrationFile} aplicada com sucesso!`);
    return true;
    
  } catch (error) {
    console.error(`❌ Erro ao aplicar migração ${migrationFile}:`, error);
    return false;
  }
}

async function applyMigrations() {
  console.log('🚀 Iniciando aplicação das migrações...');
  
  const migrations = [
    '20250623000002-add-scheduling-config.sql',
    '20250623000003-human-support-requests.sql'
  ];
  
  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (!success) {
      console.error(`❌ Falha ao aplicar migração ${migration}`);
      process.exit(1);
    }
  }
  
  console.log('🎉 Todas as migrações foram aplicadas com sucesso!');
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  applyMigrations().catch(console.error);
} 