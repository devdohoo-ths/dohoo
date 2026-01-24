#!/usr/bin/env node

/**
 * Script de inicialização do sistema
 * 
 * Garante que existe pelo menos:
 * - Uma organização padrão
 * - Um usuário admin padrão para acessar o sistema
 * 
 * Uso:
 *   node scripts/setup-initial-data.js
 * 
 * Variáveis de ambiente necessárias:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

// Configurar dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias!');
  console.error('   Configure essas variáveis no arquivo .env do backend');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Configurações padrão
const DEFAULT_ORG_NAME = 'Organização Padrão';
const DEFAULT_ORG_DOMAIN = 'default';
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@dohoo.local';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456';
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Administrador';

async function setupInitialData() {
  console.log('🚀 Iniciando setup de dados iniciais...\n');

  // Verificar se as tabelas básicas existem
  console.log('🔍 Verificando se o banco de dados está configurado...');
  const { error: testError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .limit(1);

  if (testError) {
    if (testError.message.includes('schema cache') || testError.message.includes('not found')) {
      console.error('\n❌ ERRO: Tabelas do banco de dados não encontradas!\n');
      console.error('   Isso geralmente significa que as migrações ainda não foram executadas.\n');
      console.error('   Por favor, execute primeiro:\n');
      console.error('   1. Acesse o Supabase Dashboard → SQL Editor');
      console.error('   2. Execute o arquivo: backend/supabase/schema-complete.sql');
      console.error('   3. Ou execute as migrações individuais em: backend/supabase/migrations/\n');
      console.error('   Depois, execute este script novamente.\n');
      process.exit(1);
    }
    throw new Error(`Erro ao verificar banco de dados: ${testError.message}`);
  }
  console.log('✅ Banco de dados configurado corretamente\n');

  try {
    // 1. Verificar/Criar organização padrão
    console.log('📦 Verificando organização padrão...');
    let defaultOrg = await getOrCreateDefaultOrganization();
    console.log(`✅ Organização: ${defaultOrg.name} (ID: ${defaultOrg.id})\n`);

    // 2. Verificar/Criar role de Super Admin
    console.log('👤 Verificando role de Super Admin...');
    let adminRole = await getOrCreateAdminRole(defaultOrg.id);
    console.log(`✅ Role: ${adminRole.name} (ID: ${adminRole.id})\n`);

    // 3. Verificar/Criar usuário admin padrão
    console.log('🔐 Verificando usuário admin padrão...');
    let adminUser = await getOrCreateAdminUser(defaultOrg.id, adminRole.id);
    console.log(`✅ Usuário admin: ${adminUser.email} (ID: ${adminUser.id})\n`);

    console.log('✨ Setup concluído com sucesso!\n');
    console.log('📋 Credenciais de acesso:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Senha: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log(`\n⚠️  IMPORTANTE: Altere a senha padrão após o primeiro login!\n`);

  } catch (error) {
    console.error('❌ Erro durante o setup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

async function getOrCreateDefaultOrganization() {
  // Verificar se já existe organização padrão
  const { data: existingOrgs, error: fetchError } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('domain', DEFAULT_ORG_DOMAIN)
    .limit(1);

  if (fetchError) {
    // Se a tabela não existe, provavelmente as migrações não foram executadas
    if (fetchError.message.includes('schema cache') || fetchError.message.includes('not found')) {
      throw new Error(
        `Tabela 'organizations' não encontrada. ` +
        `Certifique-se de que as migrações do banco de dados foram executadas primeiro.\n` +
        `Execute o schema-complete.sql no Supabase SQL Editor ou execute as migrações individuais.`
      );
    }
    throw new Error(`Erro ao buscar organização: ${fetchError.message}`);
  }

  if (existingOrgs && existingOrgs.length > 0) {
    return existingOrgs[0];
  }

  // Criar organização padrão
  console.log(`   Criando organização "${DEFAULT_ORG_NAME}"...`);
  const { data: newOrg, error: createError } = await supabaseAdmin
    .from('organizations')
    .insert([{
      name: DEFAULT_ORG_NAME,
      domain: DEFAULT_ORG_DOMAIN,
      max_users: 100,
      status: 'active',
      settings: { whatsapp_api: 'baileys' }
    }])
    .select()
    .single();

  if (createError) {
    throw new Error(`Erro ao criar organização: ${createError.message}`);
  }

  return newOrg;
}

async function getOrCreateAdminRole(organizationId) {
  // Verificar se já existe role de Super Admin
  const { data: existingRoles, error: fetchError } = await supabaseAdmin
    .from('roles')
    .select('*')
    .eq('name', 'Super Admin')
    .eq('organization_id', organizationId)
    .limit(1);

  if (fetchError) {
    throw new Error(`Erro ao buscar role: ${fetchError.message}`);
  }

  if (existingRoles && existingRoles.length > 0) {
    const existingRole = existingRoles[0];
    
    // ✅ CORREÇÃO: Verificar se a role tem a estrutura de permissões correta
    const hasAdvancedSettings = existingRole.permissions?.advanced_settings?.manage_organizations === true;
    
    if (!hasAdvancedSettings) {
      console.log(`   Atualizando permissões da role "Super Admin"...`);
      // Atualizar permissões com estrutura correta
      const updatedPermissions = {
        ...existingRole.permissions,
        advanced_settings: {
          access_logs: true,
          manage_users: true,
          manage_database: true,
          define_permissions: true,
          manage_organizations: true,
          manage_google_integration: true
        },
        dashboard: {
          view_dashboard: true
        },
        administration: {
          manage_connections: true,
          manage_accounts: true,
          manage_users: true,
          manage_departments: true,
          manage_teams: true
        },
        automation: {
          use_ai_assistant: true,
          access_ai_playground: true,
          manage_flows: true,
          configure_prompts: true,
          manage_ai_credits: true,
          manage_scheduling: true
        },
        marketplace: {
          access_marketplace: true,
          configure_integrations: true
        },
        support: {
          access_support: true
        }
      };
      
      const { data: updatedRole, error: updateError } = await supabaseAdmin
        .from('roles')
        .update({ permissions: updatedPermissions })
        .eq('id', existingRole.id)
        .select()
        .single();
      
      if (updateError) {
        console.warn(`   ⚠️ Aviso: Não foi possível atualizar permissões: ${updateError.message}`);
        return existingRole;
      }
      
      return updatedRole;
    }
    
    return existingRole;
  }

  // Criar role de Super Admin
  console.log(`   Criando role "Super Admin"...`);
  // ✅ CORREÇÃO: Estrutura de permissões correta conforme esperado pelo backend
  const adminPermissions = {
    chat: true,
    users: true,
    settings: true,
    analytics: true,
    organizations: true,
    all: true,
    // ✅ ADICIONADO: Permissões avançadas com estrutura correta
    advanced_settings: {
      access_logs: true,
      manage_users: true,
      manage_database: true,
      define_permissions: true,
      manage_organizations: true,
      manage_google_integration: true
    },
    dashboard: {
      view_dashboard: true
    },
    administration: {
      manage_connections: true,
      manage_accounts: true,
      manage_users: true,
      manage_departments: true,
      manage_teams: true
    },
    automation: {
      use_ai_assistant: true,
      access_ai_playground: true,
      manage_flows: true,
      configure_prompts: true,
      manage_ai_credits: true,
      manage_scheduling: true
    },
    marketplace: {
      access_marketplace: true,
      configure_integrations: true
    },
    support: {
      access_support: true
    }
  };

  const { data: newRole, error: createError } = await supabaseAdmin
    .from('roles')
    .insert([{
      id: randomUUID(),
      name: 'Super Admin',
      description: 'Administrador com acesso total ao sistema',
      organization_id: organizationId,
      permissions: adminPermissions,
      is_default: false
    }])
    .select()
    .single();

  if (createError) {
    throw new Error(`Erro ao criar role: ${createError.message}`);
  }

  return newRole;
}

async function getOrCreateAdminUser(organizationId, roleId) {
  // Verificar se já existe usuário com esse email no auth
  const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (listError) {
    throw new Error(`Erro ao listar usuários: ${listError.message}`);
  }

  let existingAuthUser = authUsers?.users?.find(u => u.email === DEFAULT_ADMIN_EMAIL);
  let userId = existingAuthUser?.id;

  // Se não existe, criar usuário no auth
  if (!existingAuthUser) {
    console.log(`   Criando usuário no Auth: ${DEFAULT_ADMIN_EMAIL}...`);
    const { data: newUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: DEFAULT_ADMIN_NAME
      }
    });

    if (createAuthError) {
      throw new Error(`Erro ao criar usuário no Auth: ${createAuthError.message}`);
    }

    userId = newUser.user.id;
    existingAuthUser = newUser.user;
  }

  // Verificar se já existe profile
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = not found
    throw new Error(`Erro ao buscar profile: ${profileError.message}`);
  }

  // Se não existe profile, criar
  if (!existingProfile) {
    console.log(`   Criando profile para o usuário...`);
    const { error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: userId,
        name: DEFAULT_ADMIN_NAME,
        email: DEFAULT_ADMIN_EMAIL,
        organization_id: organizationId,
        role_id: roleId,
        permissions: {
          chat: true,
          users: true,
          settings: true,
          analytics: true
        },
        platform_permissions: {
          whatsapp: { view: true, create: true, manage: true, viewAll: true },
          telegram: { view: true, create: true, manage: true, viewAll: true },
          facebook: { view: true, create: true, manage: true, viewAll: true },
          instagram: { view: true, create: true, manage: true, viewAll: true },
          api: { view: true, create: true, manage: true, viewAll: true }
        }
      }]);

    if (createProfileError) {
      throw new Error(`Erro ao criar profile: ${createProfileError.message}`);
    }
  } else {
    // Atualizar profile existente para garantir que está associado à org e role corretas
    console.log(`   Atualizando profile existente...`);
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        organization_id: organizationId,
        role_id: roleId
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Erro ao atualizar profile: ${updateError.message}`);
    }
  }

  return {
    id: userId,
    email: DEFAULT_ADMIN_EMAIL,
    name: DEFAULT_ADMIN_NAME
  };
}

// Executar setup
setupInitialData();

