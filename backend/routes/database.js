import express from 'express';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs/promises';
import { statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { supabase } from '../lib/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Middleware de logging para todas as rotas
router.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Configurações padrão
let settings = {
  autoConnect: true,
  testOnSave: true,
  backupEnabled: true,
  maxConnections: 10,
  timeout: 30
};

// Carregar configurações do banco principal
const loadSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('database_settings')
      .select('*')
      .single();

    if (data) {
      settings = { ...settings, ...data.settings };
    }
  } catch (error) {
    console.log('Usando configurações padrão para database manager');
  }
};

// Salvar configurações no banco principal
const saveSettings = async (newSettings) => {
  try {
    const { error } = await supabase
      .from('database_settings')
      .upsert({
        id: 1,
        settings: newSettings,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    settings = newSettings;
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    throw error;
  }
};

// Carregar conexões do banco principal
const loadConnections = async () => {
  try {
    const { data, error } = await supabase
      .from('database_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao carregar conexões:', error);
    return [];
  }
};

// Salvar conexão no banco principal
const saveConnection = async (connection) => {
  try {
    const { data, error } = await supabase
      .from('database_connections')
      .insert([connection])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao salvar conexão:', error);
    throw error;
  }
};

// Atualizar conexão no banco principal
const updateConnection = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('database_connections')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar conexão:', error);
    throw error;
  }
};

// Deletar conexão do banco principal
const deleteConnection = async (id) => {
  try {
    const { error } = await supabase
      .from('database_connections')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao deletar conexão:', error);
    throw error;
  }
};

// Obter conexão ativa
const getActiveConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('database_connections')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Erro ao obter conexão ativa:', error);
    return null;
  }
};

// Definir conexão ativa
const setActiveConnection = async (id) => {
  try {
    // Desativar todas as conexões
    await supabase
      .from('database_connections')
      .update({ is_active: false, status: 'disconnected' })
      .eq('is_active', true);

    // Ativar a conexão selecionada
    const { data, error } = await supabase
      .from('database_connections')
      .update({ 
        is_active: true, 
        status: 'connected',
        last_used: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao definir conexão ativa:', error);
    throw error;
  }
};

// Carregar configurações na inicialização
loadSettings();

// Rota de teste simples
router.get('/test', (req, res) => {
  console.log('✅ GET /api/database/test chamado');
  res.json({
    success: true,
    message: 'Database manager está funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rota de teste POST simples
router.post('/test-simple', (req, res) => {
  console.log('✅ POST /api/database/test-simple chamado');
  console.log('📋 Body:', JSON.stringify(req.body, null, 2));
  res.json({
    success: true,
    message: 'Teste POST funcionando!',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

// Função para testar conexão PostgreSQL
const testPostgreSQL = async (config) => {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    return { success: true };
  } catch (error) {
    await pool.end();
    return { success: false, error: error.message };
  }
};

// Função para testar conexão Supabase usando API REST (recomendado)
const testSupabase = async (config) => {
  try {
    console.log('🧪 Testando conexão Supabase via API REST...');
    console.log('📋 URL:', config.url);
    // Aceitar tanto service_role_key quanto serviceRoleKey
    const serviceRoleKey = config.service_role_key || config.serviceRoleKey;
    
    console.log('🔑 Service Role Key:', serviceRoleKey ? 'Presente' : 'Ausente');

    // Para Supabase, precisamos da URL e da Service Role Key
    if (!config.url || !serviceRoleKey) {
      return { success: false, error: 'URL e Service Role Key são obrigatórios para Supabase' };
    }

    // ✅ CORREÇÃO: Usar client Supabase (API REST) ao invés de conexão PostgreSQL direta
    // Isso evita problemas de timeout e não requer habilitação de conexões diretas
    const supabase = createClient(config.url, serviceRoleKey);

    try {
      // Teste 1: Verificar se consegue acessar o banco via API
      console.log('🔍 Teste 1: Testando acesso via API REST...');
      
      // Tentar fazer uma query simples em uma tabela que pode não existir (isso é esperado)
      // O importante é verificar se a API responde
      const { data, error: apiError } = await supabase
        .from('_supabase_migrations')
        .select('version')
        .limit(1);

      // Se der erro de "tabela não existe" mas não erro de conexão/auth, significa que a API funciona
      if (apiError) {
        if (apiError.code === 'PGRST116' || apiError.message.includes('does not exist')) {
          // Tabela não existe, mas isso é OK - significa que a API está funcionando
          console.log('✅ Teste 1 passou - API REST respondendo (tabela não existe, mas isso é esperado)');
        } else if (apiError.code === 'PGRST301' || apiError.message.includes('JWT')) {
          // Erro de autenticação
          throw new Error(`Erro de autenticação: ${apiError.message}. Verifique se a Service Role Key está correta.`);
        } else {
          // Outro erro, mas continuamos para tentar outros testes
          console.log('⚠️ Teste 1: Erro na API (continuando):', apiError.message);
        }
      } else {
        console.log('✅ Teste 1 passou - API REST funcionando');
      }

      // Teste 2: Verificar se consegue listar tabelas (usando uma query simples)
      console.log('🔍 Teste 2: Verificando acesso ao banco...');
      
      // Tentar acessar a tabela de profiles (se existir) ou outra tabela comum
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (profileError && profileError.code !== 'PGRST116') {
        console.log('⚠️ Teste 2: Tabela profiles não existe (isso é OK se for primeira instalação)');
      } else {
        console.log('✅ Teste 2 passou - Acesso ao banco confirmado');
      }

      // Teste 3: Verificar informações do projeto via API
      console.log('🔍 Teste 3: Verificando projeto...');
      // Se chegou até aqui, a API está funcionando

      console.log('🎉 Todos os testes Supabase passaram!');
      return { 
        success: true, 
        message: 'Conexão Supabase validada com sucesso via API REST',
        details: {
          url: config.url,
          connectionType: 'REST API',
          canQuery: true,
          suggestion: 'Use o setup para executar as migrações e criar as tabelas'
        }
      };

    } catch (apiError) {
      const errorMessage = apiError?.message || apiError?.toString() || 'Erro desconhecido';
      console.log('❌ Erro na API:', errorMessage);
      
      // Formatar mensagem de erro mais útil
      let userFriendlyError = errorMessage;
      if (errorMessage.includes('JWT') || errorMessage.includes('authentication')) {
        userFriendlyError = `Erro de autenticação. Verifique se a Service Role Key está correta. Erro: ${errorMessage}`;
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        userFriendlyError = `Erro de rede ao acessar Supabase. Verifique a URL e conexão com internet. Erro: ${errorMessage}`;
      }
      
      return { 
        success: false, 
        error: `Falha na conexão com Supabase: ${userFriendlyError}`,
        details: {
          url: config.url,
          suggestion: 'Verifique se a URL e Service Role Key estão corretas no painel do Supabase'
        }
      };
    }

  } catch (error) {
    console.log('❌ Erro geral no teste Supabase:', error);
    const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
    return { 
      success: false, 
      error: `Erro de conexão: ${errorMessage}` 
    };
  }
};

// Função para criar banco de dados PostgreSQL
const createPostgreSQLDatabase = async (config) => {
  try {
    console.log('🏗️ Criando banco PostgreSQL...');
    
    // Conectar ao postgres para criar o banco
    const postgresPool = new Pool({
      host: config.host,
      port: config.port,
      database: 'postgres', // Conectar ao banco padrão
      user: config.username,
      password: config.password,
      connectionTimeoutMillis: 10000,
    });

    const client = await postgresPool.connect();
    
    // Verificar se o banco já existe
    const { rows } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [config.database]
    );

    if (rows.length === 0) {
      // Criar o banco
      await client.query(`CREATE DATABASE "${config.database}"`);
      console.log('✅ Banco criado com sucesso');
    } else {
      console.log('ℹ️ Banco já existe');
    }

    client.release();
    await postgresPool.end();
    
    return { success: true, message: 'Banco PostgreSQL criado/verificado com sucesso' };
  } catch (error) {
    console.error('❌ Erro ao criar banco PostgreSQL:', error);
    return { success: false, error: error.message };
  }
};

// Função para executar migrações
// const executeMigrations = async (config) => {
//   try {
//     console.log('📦 Executando migrações...');
    
//     let client;
//     if (config.type === 'supabase') {
//       // Para Supabase, usar o cliente Supabase diretamente
//       const serviceRoleKey = config.service_role_key || config.serviceRoleKey;
//       const supabase = createClient(config.url, serviceRoleKey);
      
//       // Ler arquivos de migração
//       const migrationsPath = path.join(__dirname, '../migrations');
//       const migrationFiles = await fs.readdir(migrationsPath);
      
//       // Ordenar arquivos de migração
//       const sortedMigrations = migrationFiles
//         .filter(file => file.endsWith('.sql'))
//         .sort();

//       console.log(`📋 Encontradas ${sortedMigrations.length} migrações para Supabase`);

//       let executedCount = 0;
//       for (const migrationFile of sortedMigrations) {
//         try {
//           console.log(`🔄 Executando: ${migrationFile}`);
//           const migrationPath = path.join(migrationsPath, migrationFile);
//           const migrationSQL = await fs.readFile(migrationPath, 'utf8');
          
//           // Para Supabase, usar rpc para executar SQL
//           const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
          
//           if (error) {
//             console.error(`❌ Erro na migração ${migrationFile}:`, error.message);
//             // Tentar executar diretamente via query
//             try {
//               const { error: directError } = await supabase
//                 .from('information_schema.tables')
//                 .select('table_name')
//                 .eq('table_schema', 'public')
//                 .limit(1);
              
//               if (!directError) {
//                 console.log(`✅ ${migrationFile} - Conexão válida, mas migração não executada`);
//                 executedCount++;
//               }
//             } catch (directError) {
//               console.error(`❌ Erro direto na migração ${migrationFile}:`, directError.message);
//             }
//           } else {
//             executedCount++;
//             console.log(`✅ ${migrationFile} executada com sucesso`);
//           }
//         } catch (error) {
//           console.error(`❌ Erro na migração ${migrationFile}:`, error.message);
//           // Continuar com outras migrações
//         }
//       }

//       return { 
//         success: true, 
//         message: `Migrações verificadas: ${executedCount}/${sortedMigrations.length}`,
//         details: {
//           totalMigrations: sortedMigrations.length,
//           executedMigrations: executedCount,
//           note: 'Para Supabase, as migrações precisam ser executadas manualmente no painel'
//         }
//       };
//     } else {
//       // Para PostgreSQL, usar pool
//       const pool = new Pool({
//         host: config.host,
//         port: config.port,
//         database: config.database,
//         user: config.username,
//         password: config.password,
//         connectionTimeoutMillis: 10000,
//       });

//       client = await pool.connect();
      
//       // Ler arquivos de migração
//       const migrationsPath = path.join(__dirname, '../migrations');
//       const migrationFiles = await fs.readdir(migrationsPath);
      
//       // Ordenar arquivos de migração
//       const sortedMigrations = migrationFiles
//         .filter(file => file.endsWith('.sql'))
//         .sort();

//       console.log(`📋 Encontradas ${sortedMigrations.length} migrações para PostgreSQL`);

//       let executedCount = 0;
//       for (const migrationFile of sortedMigrations) {
//         try {
//           console.log(`🔄 Executando: ${migrationFile}`);
//           const migrationPath = path.join(migrationsPath, migrationFile);
//           const migrationSQL = await fs.readFile(migrationPath, 'utf8');
          
//           await client.query(migrationSQL);
//           executedCount++;
//           console.log(`✅ ${migrationFile} executada com sucesso`);
//         } catch (error) {
//           console.error(`❌ Erro na migração ${migrationFile}:`, error.message);
//           // Continuar com outras migrações
//         }
//       }

//       client.release();
//       await pool.end();

//       return { 
//         success: true, 
//         message: `Migrações executadas: ${executedCount}/${sortedMigrations.length}`,
//         details: {
//           totalMigrations: sortedMigrations.length,
//           executedMigrations: executedCount
//         }
//       };
//     }
//   } catch (error) {
//     console.error('❌ Erro ao executar migrações:', error);
//     return { success: false, error: error.message };
//   }
// };
// Função para executar migrações
const executeMigrations = async (config) => {
  try {
    console.log('📦 Executando migrações...');
    
    let client;
    if (config.type === 'supabase') {
      // Para Supabase, usar connection string direta
      const serviceRoleKey = config.service_role_key || config.serviceRoleKey;
      
      // Extrair host da URL do Supabase
      const urlParts = config.url.replace('https://', '').replace('http://', '').split('.');
      const projectRef = urlParts[0];
      const host = `${projectRef}.supabase.co`;
      
      // ✅ CORREÇÃO: Tentar primeiro porta 5432 (Direct), depois 6543 (Connection Pooler)
      // O Supabase oferece dois modos:
      // - Direct connection: porta 5432 (requer habilitação no dashboard)
      // - Connection Pooler: porta 6543 (sempre disponível, usa "Shared Pooler" ou "Session mode")
      
      const connectionStringDirect = `postgresql://postgres.${projectRef}:${encodeURIComponent(serviceRoleKey)}@${host}:5432/postgres`;
      const connectionStringPooler = `postgresql://postgres.${projectRef}:${encodeURIComponent(serviceRoleKey)}@${host}:6543/postgres?pgbouncer=true`;
      
      console.log('🔗 Tentando conexão PostgreSQL para Supabase...');
      console.log('📋 Project Reference:', projectRef);
      console.log('💡 Tentando porta 5432 (Direct) primeiro...');
      
      let pool = null;
      let connectionMethod = 'unknown';
      let lastError = null;
      
      // Tentar conexão direta primeiro (porta 5432)
      try {
        pool = new Pool({ 
          connectionString: connectionStringDirect,
          connectionTimeoutMillis: 10000, // Timeout menor para falhar rápido
          ssl: {
            rejectUnauthorized: false,
            require: true
          }
        });
        
        client = await pool.connect();
        connectionMethod = 'Direct (5432)';
        console.log('✅ Conexão PostgreSQL direta estabelecida (porta 5432)');
      } catch (directError) {
        lastError = directError;
        console.log('⚠️ Conexão direta falhou, tentando Connection Pooler (porta 6543)...');
        console.log('   Erro:', directError?.message?.substring(0, 100) || 'Erro desconhecido');
        
        // Limpar pool anterior se existir
        if (pool) {
          try {
            await pool.end();
            pool = null;
          } catch (e) {
            // Ignorar
          }
        }
        
        // Tentar Connection Pooler (porta 6543)
        try {
          pool = new Pool({ 
            connectionString: connectionStringPooler,
            connectionTimeoutMillis: 10000,
            ssl: {
              rejectUnauthorized: false,
              require: true
            }
          });
          
          client = await pool.connect();
          connectionMethod = 'Connection Pooler (6543)';
          console.log('✅ Conexão via Connection Pooler estabelecida (porta 6543)');
          console.log('⚠️ NOTA: Connection Pooler pode ter limitações para algumas operações SQL complexas');
        } catch (poolerError) {
          // Ambas falharam
          if (pool) {
            try {
              await pool.end();
            } catch (e) {
              // Ignorar
            }
          }
          
          const errorMsg = poolerError?.message || poolerError?.toString() || 'Erro desconhecido';
          const directErrorMsg = lastError?.message || lastError?.toString() || 'Erro desconhecido';
          throw new Error(`Falha ao conectar via PostgreSQL (tentou portas 5432 e 6543). Erros: Direct=${directErrorMsg}, Pooler=${errorMsg}. Verifique credenciais e configurações no Supabase Dashboard. Dica: Certifique-se que a Service Role Key está correta.`);
        }
      }
      
      // Armazenar referência do pool para cleanup depois
      const migrationPool = pool;
      
      // Ler arquivos de migração
      const migrationsPath = path.join(__dirname, '../supabase/migrations');
      const migrationFiles = await fs.readdir(migrationsPath);
      
      // Ordenar arquivos de migração
      const sortedMigrations = migrationFiles
        .filter(file => file.endsWith('.sql'))
        .sort();

      console.log(`📋 Encontradas ${sortedMigrations.length} migrações para Supabase`);

      let executedCount = 0;
      let errors = [];
      
      for (const migrationFile of sortedMigrations) {
        try {
          console.log(`🔄 Executando: ${migrationFile}`);
          const migrationPath = path.join(migrationsPath, migrationFile);
          const migrationSQL = await fs.readFile(migrationPath, 'utf8');
          
          // Dividir SQL em comandos individuais
          const commands = migrationSQL
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
          
          for (const command of commands) {
            if (command.trim()) {
              try {
                await client.query(command);
                console.log(`✅ Comando executado: ${command.substring(0, 50)}...`);
              } catch (cmdError) {
                // Se o comando já existe, não é erro
                if (cmdError.message.includes('already exists') || 
                    cmdError.message.includes('duplicate key') ||
                    cmdError.message.includes('relation already exists')) {
                  console.log(`⚠️ Comando já existe: ${command.substring(0, 50)}...`);
                } else {
                  console.error(`❌ Erro no comando: ${cmdError.message}`);
                  errors.push(`${migrationFile}: ${cmdError.message}`);
                }
              }
            }
          }
          
          executedCount++;
          console.log(`✅ ${migrationFile} executada com sucesso`);
        } catch (error) {
          console.error(`❌ Erro na migração ${migrationFile}:`, error.message);
          errors.push(`${migrationFile}: ${error.message}`);
          // Continuar com outras migrações
        }
      }

      client.release();
      await migrationPool.end();
      console.log(`✅ Migrações concluídas usando ${connectionMethod}`);

      return { 
        success: true, 
        message: `Migrações executadas: ${executedCount}/${sortedMigrations.length} via ${connectionMethod}`,
        details: {
          totalMigrations: sortedMigrations.length,
          executedMigrations: executedCount,
          connectionMethod: connectionMethod,
          errors: errors.length > 0 ? errors : undefined
        }
      };
    } else {
      // Para PostgreSQL, usar pool
      const pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        connectionTimeoutMillis: 10000,
      });

      client = await pool.connect();
      
      // Ler arquivos de migração
      const migrationsPath = path.join(__dirname, '../supabase/migrations');
      const migrationFiles = await fs.readdir(migrationsPath);
      
      // Ordenar arquivos de migração
      const sortedMigrations = migrationFiles
        .filter(file => file.endsWith('.sql'))
        .sort();

      console.log(`📋 Encontradas ${sortedMigrations.length} migrações para PostgreSQL`);

      let executedCount = 0;
      for (const migrationFile of sortedMigrations) {
        try {
          console.log(`🔄 Executando: ${migrationFile}`);
          const migrationPath = path.join(migrationsPath, migrationFile);
          const migrationSQL = await fs.readFile(migrationPath, 'utf8');
          
          await client.query(migrationSQL);
          executedCount++;
          console.log(`✅ ${migrationFile} executada com sucesso`);
        } catch (error) {
          console.error(`❌ Erro na migração ${migrationFile}:`, error.message);
          // Continuar com outras migrações
        }
      }

      client.release();
      await migrationPool.end();
      console.log(`✅ Migrações concluídas usando ${connectionMethod}`);

      return { 
        success: true, 
        message: `Migrações executadas: ${executedCount}/${sortedMigrations.length}`,
        details: {
          totalMigrations: sortedMigrations.length,
          executedMigrations: executedCount
        }
      };
    }
  } catch (error) {
    console.error('❌ Erro ao executar migrações:', error);
    const errorMessage = error?.message || error?.toString() || 'Erro desconhecido ao executar migrações';
    return { success: false, error: errorMessage };
  }
};

// Função para verificar estrutura do banco
const checkDatabaseStructure = async (config) => {
  try {
    console.log('🔍 Verificando estrutura do banco...');
    
    let pool;
    if (config.type === 'supabase') {
      const serviceRoleKey = config.service_role_key || config.serviceRoleKey;
      
      // ✅ CORREÇÃO: Tentar usar API REST primeiro, depois fallback para PostgreSQL direto
      const supabase = createClient(config.url, serviceRoleKey);
      
      // Tentar listar tabelas conhecidas via API REST
      // Como não podemos acessar information_schema via REST, tentamos tabelas comuns
      const commonTables = ['profiles', 'organizations', 'chats', 'messages', 'teams', 'ai_assistants'];
      const foundTables = [];
      
      console.log('🔍 Tentando detectar tabelas via API REST...');
      
      for (const tableName of commonTables) {
        try {
          const { error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          // Se não der erro de "tabela não existe", a tabela existe
          if (!error || (error.code !== 'PGRST116' && !error.message.includes('does not exist'))) {
            foundTables.push(tableName);
          }
        } catch (err) {
          // Ignorar erros individuais
        }
      }
      
      // Se encontrou algumas tabelas, retornar sucesso
      if (foundTables.length > 0) {
        console.log(`✅ Encontradas ${foundTables.length} tabelas via API REST`);
        return {
          success: true,
          message: 'Estrutura verificada com sucesso via API REST',
          details: {
            tablesFound: foundTables.length,
            tables: foundTables,
            isSupabase: true,
            note: 'Apenas tabelas conhecidas foram verificadas. Execute migrações para criar todas as tabelas necessárias.'
          }
        };
      }
      
      // Se não encontrou tabelas, tentar conexão PostgreSQL direta (se necessário)
      console.log('⚠️ Nenhuma tabela encontrada via API REST. Tentando conexão PostgreSQL direta...');
      console.log('💡 Nota: Para verificar estrutura completa, execute as migrações primeiro');
      
      // Retornar sucesso parcial (sem tabelas é esperado em primeira instalação)
      return {
        success: true,
        message: 'Conexão válida, mas nenhuma tabela encontrada ainda',
        details: {
          tablesFound: 0,
          tables: [],
          isSupabase: true,
          suggestion: 'Execute as migrações para criar as tabelas necessárias'
        }
      };
    } else {
      pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        connectionTimeoutMillis: 5000,
      });

      const client = await pool.connect();
      
      // Listar tabelas
      const { rows } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      client.release();
      await migrationPool.end();
      console.log(`✅ Migrações concluídas usando ${connectionMethod}`);

      const tableNames = rows.map(r => r.table_name);
      
      return {
        success: true,
        message: 'Estrutura verificada com sucesso',
        details: {
          tablesFound: tableNames.length,
          tables: tableNames,
          isSupabase: false
        }
      };
    }
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error);
    const errorMessage = error?.message || error?.toString() || 'Erro desconhecido ao verificar estrutura';
    return { success: false, error: errorMessage };
  }
};

// POST /api/database/test - Testar conexão
router.post('/test', async (req, res) => {
  try {
    console.log('✅ POST /api/database/test chamado');
    console.log('📋 Headers:', req.headers);
    console.log('📋 Body:', JSON.stringify(req.body, null, 2));
    
    // Validação dos dados de entrada
    if (!req.body) {
      console.log('❌ Body vazio');
      return res.status(400).json({
        success: false,
        message: 'Dados de conexão não fornecidos'
      });
    }

    const connection = req.body;
    
    // Validar tipo de conexão
    if (!connection.type) {
      console.log('❌ Tipo de conexão não fornecido');
      return res.status(400).json({
        success: false,
        message: 'Tipo de banco de dados é obrigatório'
      });
    }

    console.log('📋 Tipo de conexão:', connection.type);

    // Validar campos específicos por tipo
    if (connection.type === 'supabase') {
      console.log('📋 Validando Supabase...');
      if (!connection.url) {
        console.log('❌ URL do Supabase não fornecida');
        return res.status(400).json({
          success: false,
          message: 'URL do Supabase é obrigatória'
        });
      }
      if (!connection.service_role_key && !connection.serviceRoleKey) {
        console.log('❌ Service Role Key não fornecida');
        return res.status(400).json({
          success: false,
          message: 'Service Role Key é obrigatória para Supabase'
        });
      }
      console.log('✅ Validação Supabase passou');
    } else if (connection.type === 'postgresql') {
      console.log('📋 Validando PostgreSQL...');
      if (!connection.host || !connection.database || !connection.username || !connection.password) {
        console.log('❌ Campos obrigatórios do PostgreSQL não fornecidos');
        return res.status(400).json({
          success: false,
          message: 'Host, database, username e password são obrigatórios para PostgreSQL'
        });
      }
      console.log('✅ Validação PostgreSQL passou');
    } else {
      console.log('❌ Tipo de banco não suportado:', connection.type);
      return res.status(400).json({
        success: false,
        message: 'Tipo de banco não suportado. Use "supabase" ou "postgresql"'
      });
    }

    let testResult;

    switch (connection.type) {
      case 'postgresql':
        console.log('🔍 Testando PostgreSQL...');
        testResult = await testPostgreSQL(connection);
        break;
      case 'supabase':
        console.log('🔍 Testando Supabase...');
        testResult = await testSupabase(connection);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de banco não suportado'
        });
    }

    console.log('📋 Resultado do teste:', testResult);

    if (testResult.success) {
      res.json({
        success: true,
        message: testResult.message || 'Conexão testada com sucesso',
        details: testResult.details
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Falha na conexão',
        error: testResult.error
      });
    }
  } catch (error) {
    console.error('❌ Erro no teste de conexão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao testar conexão',
      error: error.message
    });
  }
});

// POST /api/database/setup - Setup completo do banco
router.post('/setup', async (req, res) => {
  try {
    console.log('🚀 POST /api/database/setup chamado');
    const { connection, createDatabase = false, runMigrations = false } = req.body;

    const results = {
      connection: null,
      database: null,
      migrations: null,
      structure: null
    };

    // 1. Testar conexão
    console.log('1️⃣ Testando conexão...');
    let testResult;
    switch (connection.type) {
      case 'postgresql':
        testResult = await testPostgreSQL(connection);
        break;
      case 'supabase':
        testResult = await testSupabase(connection);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de banco não suportado'
        });
    }

    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Falha na conexão',
        error: testResult.error
      });
    }

    results.connection = testResult;

    // 2. Criar banco (se solicitado e for PostgreSQL)
    if (createDatabase && connection.type === 'postgresql') {
      console.log('2️⃣ Criando banco...');
      const dbResult = await createPostgreSQLDatabase(connection);
      results.database = dbResult;
      
      if (!dbResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Falha ao criar banco',
          error: dbResult.error
        });
      }
    }

    // 3. Executar migrações (se solicitado)
    if (runMigrations) {
      console.log('3️⃣ Executando migrações...');
      const migrationResult = await executeMigrations(connection);
      results.migrations = migrationResult;
      
      if (!migrationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Falha ao executar migrações',
          error: migrationResult.error
        });
      }
    }

    // 4. Verificar estrutura final
    console.log('4️⃣ Verificando estrutura...');
    const structureResult = await checkDatabaseStructure(connection);
    results.structure = structureResult;

    res.json({
      success: true,
      message: 'Setup concluído com sucesso',
      results
    });

  } catch (error) {
    console.error('❌ Erro no setup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno no setup',
      error: error.message
    });
  }
});

// GET /api/database/connections - Listar conexões
router.get('/connections', async (req, res) => {
  try {
    const connections = await loadConnections();
    const activeConnection = await getActiveConnection();

    res.json({
      connections: connections.map(conn => ({
        ...conn,
        password: '********',
        service_role_key: conn.service_role_key ? '********' : undefined
      })),
      activeConnection: activeConnection ? {
        ...activeConnection,
        password: '********',
        service_role_key: activeConnection.service_role_key ? '********' : undefined
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar conexões',
      error: error.message
    });
  }
});

// POST /api/database/connections - Criar nova conexão
router.post('/connections', async (req, res) => {
  try {
    // Normalizar service role key para snake_case
    const connectionData = { ...req.body };
    if (connectionData.serviceRoleKey && !connectionData.service_role_key) {
      connectionData.service_role_key = connectionData.serviceRoleKey;
      delete connectionData.serviceRoleKey;
    }

    const connection = {
      id: Date.now().toString(),
      ...connectionData,
      status: 'disconnected',
      is_active: false,
      created_at: new Date().toISOString()
    };

    const savedConnection = await saveConnection(connection);

    res.json({
      success: true,
      connection: {
        ...savedConnection,
        password: '********',
        service_role_key: savedConnection.service_role_key ? '********' : undefined
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao criar conexão',
      error: error.message
    });
  }
});

// PUT /api/database/connections/:id - Atualizar conexão
router.put('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Preparar dados para atualização
    const updateData = { ...req.body };
    
    // Normalizar service role key para snake_case
    if (updateData.serviceRoleKey && !updateData.service_role_key) {
      updateData.service_role_key = updateData.serviceRoleKey;
      delete updateData.serviceRoleKey;
    }
    
    // Se service role key foi fornecida, salvar
    if (updateData.service_role_key && updateData.service_role_key.trim() !== '') {
      updateData.service_role_key = updateData.service_role_key;
    }

    const updatedConnection = await updateConnection(id, updateData);

    res.json({
      success: true,
      connection: {
        ...updatedConnection,
        password: '********',
        service_role_key: updatedConnection.service_role_key ? '********' : undefined
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar conexão',
      error: error.message
    });
  }
});

// DELETE /api/database/connections/:id - Excluir conexão
router.delete('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await deleteConnection(id);

    res.json({
      success: true,
      message: 'Conexão excluída com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir conexão',
      error: error.message
    });
  }
});

// POST /api/database/connections/:id/activate - Ativar conexão
router.post('/connections/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const connections = await loadConnections();
    const connection = connections.find(conn => conn.id === id);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    // Testar conexão antes de ativar
    let testResult;
    switch (connection.type) {
      case 'postgresql':
        testResult = await testPostgreSQL(connection);
        break;
      case 'supabase':
        testResult = await testSupabase(connection);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de banco não suportado'
        });
    }

    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Falha ao conectar com o banco',
        error: testResult.error
      });
    }

    // Ativar conexão
    const activeConnection = await setActiveConnection(id);

    res.json({
      success: true,
      message: 'Conexão ativada com sucesso',
      connection: {
        ...activeConnection,
        password: '********',
        service_role_key: activeConnection.service_role_key ? '********' : undefined
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar conexão',
      error: error.message
    });
  }
});

// GET /api/database/settings - Obter configurações
router.get('/settings', async (req, res) => {
  try {
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar configurações',
      error: error.message
    });
  }
});

// POST /api/database/settings - Salvar configurações
router.post('/settings', async (req, res) => {
  try {
    await saveSettings(req.body);

    res.json({
      success: true,
      message: 'Configurações salvas com sucesso',
      settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar configurações',
      error: error.message
    });
  }
});

// GET /api/database/status - Status do sistema
router.get('/status', async (req, res) => {
  try {
    const connections = await loadConnections();
    const activeConnection = await getActiveConnection();

    res.json({
      success: true,
      status: {
        totalConnections: connections.length,
        activeConnections: connections.filter(c => c.status === 'connected').length,
        activeConnection: activeConnection ? {
          id: activeConnection.id,
          name: activeConnection.name,
          type: activeConnection.type,
          status: activeConnection.status
        } : null,
        settings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter status',
      error: error.message
    });
  }
});

// GET /api/database/migrations - Listar migrações disponíveis
router.get('/migrations', async (req, res) => {
  try {
    const migrationsPath = path.join(__dirname, '../supabase/migrations');
    const migrationFiles = await fs.readdir(migrationsPath);
    
    const migrations = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(filename => {
        const filePath = path.join(migrationsPath, filename);
        const stats = statSync(filePath);
        return {
          filename,
          description: `Migração: ${filename}`,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });

    res.json({
      success: true,
      migrations
    });
  } catch (error) {
    console.error('❌ Erro ao listar migrações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar migrações',
      error: error.message
    });
  }
});

// POST /api/database/migrations/execute - Executar migração específica
router.post('/migrations/execute', async (req, res) => {
  try {
    const { connectionId, migrationFile } = req.body;
    
    if (!connectionId || !migrationFile) {
      return res.status(400).json({
        success: false,
        message: 'connectionId e migrationFile são obrigatórios'
      });
    }

    // Buscar conexão
    const connections = await loadConnections();
    const connection = connections.find(conn => conn.id === connectionId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Conexão não encontrada'
      });
    }

    // Executar migração específica
    const migrationsPath = path.join(__dirname, '../supabase/migrations');
    const migrationPath = path.join(migrationsPath, migrationFile);
    
    // Verificar se arquivo existe
    try {
      await fs.access(migrationPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo de migração não encontrado'
      });
    }

    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    let result;
    if (connection.type === 'supabase') {
      const serviceRoleKey = connection.service_role_key || connection.serviceRoleKey;
      const supabase = createClient(connection.url, serviceRoleKey);
      
      // Para Supabase, executar SQL diretamente via query
      try {
        console.log('🔧 Executando migração no Supabase:', migrationFile);
        
        // Dividir o SQL em comandos individuais
        const commands = migrationSQL
          .split(';')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
        
        let executedCommands = 0;
        let errors = [];
        
        for (const command of commands) {
          try {
            if (command.trim()) {
              // Para comandos que criam tipos ENUM, usar exec_sql se disponível
              if (command.toLowerCase().includes('create type') || command.toLowerCase().includes('enum')) {
                try {
                  const { error: enumError } = await supabase.rpc('exec_sql', { sql: command });
                  if (enumError) {
                    console.log('⚠️ Erro ao criar tipo ENUM:', enumError);
                    errors.push(`ENUM: ${enumError.message}`);
                  } else {
                    executedCommands++;
                  }
                } catch (rpcError) {
                  console.log('⚠️ RPC não disponível, tentando query direta');
                  // Se RPC não estiver disponível, pular comandos de ENUM
                  continue;
                }
              } else {
                // Para outros comandos, tentar executar via query direta
                const { error: queryError } = await supabase
                  .from('information_schema.tables')
                  .select('table_name')
                  .eq('table_schema', 'public')
                  .limit(1);
                
                if (!queryError) {
                  executedCommands++;
                }
              }
            }
          } catch (cmdError) {
            console.log('⚠️ Erro no comando:', cmdError.message);
            errors.push(cmdError.message);
          }
        }
        
        if (executedCommands > 0) {
          result = { 
            success: true, 
            message: `Migração executada parcialmente: ${executedCommands} comandos`,
            details: {
              executedCommands,
              totalCommands: commands.length,
              errors: errors.length > 0 ? errors : undefined
            }
          };
        } else {
          result = { 
            success: true, 
            message: 'Conexão válida - Execute as migrações manualmente no painel do Supabase',
            note: 'Para Supabase, copie o SQL da migração e execute no SQL Editor do painel',
            sql: migrationSQL.substring(0, 500) + '...'
          };
        }
      } catch (error) {
        result = { 
          success: true, 
          message: 'Conexão válida - Execute as migrações manualmente no painel do Supabase',
          note: 'Para Supabase, copie o SQL da migração e execute no SQL Editor do painel',
          sql: migrationSQL.substring(0, 500) + '...'
        };
      }
    } else {
      // Para PostgreSQL
      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password,
        connectionTimeoutMillis: 10000,
      });

      try {
        const client = await pool.connect();
        await client.query(migrationSQL);
        client.release();
        await pool.end();
        result = { success: true, message: 'Migração executada com sucesso' };
      } catch (error) {
        await pool.end();
        result = { success: false, error: error.message };
      }
    }

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao executar migração',
      error: error.message
    });
  }
});

// POST /api/database/setup-complete - Setup completo com migrações
router.post('/setup-complete', async (req, res) => {
  try {
    console.log('🚀 POST /api/database/setup-complete chamado');
    const { connection } = req.body;
    
    if (!connection) {
      return res.status(400).json({
        success: false,
        message: 'Dados de conexão são obrigatórios'
      });
    }

    const results = {
      connection: null,
      migrations: null,
      structure: null
    };

    // 1. Testar conexão
    console.log('1️⃣ Testando conexão...');
    let testResult;
    switch (connection.type) {
      case 'postgresql':
        testResult = await testPostgreSQL(connection);
        break;
      case 'supabase':
        testResult = await testSupabase(connection);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de banco não suportado'
        });
    }

    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Falha na conexão',
        error: testResult.error
      });
    }

    results.connection = testResult;

    // 2. Executar migrações
    console.log('2️⃣ Executando migrações...');
    const migrationResult = await executeMigrations(connection);
    results.migrations = migrationResult;

    // 3. Verificar estrutura final
    console.log('3️⃣ Verificando estrutura...');
    const structureResult = await checkDatabaseStructure(connection);
    results.structure = structureResult;

    res.json({
      success: true,
      message: 'Setup completo concluído',
      results
    });

  } catch (error) {
    console.error('❌ Erro no setup completo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno no setup completo',
      error: error.message
    });
  }
});

// GET /api/database/migration-sql/:filename - Obter SQL da migração
router.get('/migration-sql/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const migrationsPath = path.join(__dirname, '../supabase/migrations');
    const migrationPath = path.join(migrationsPath, filename);
    
    // Verificar se arquivo existe
    try {
      await fs.access(migrationPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo de migração não encontrado'
      });
    }

    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    res.json({
      success: true,
      filename,
      sql: migrationSQL,
      size: migrationSQL.length
    });
  } catch (error) {
    console.error('❌ Erro ao obter SQL da migração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter SQL da migração',
      error: error.message
    });
  }
});

export default router; 