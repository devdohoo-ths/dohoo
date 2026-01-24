import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function consolidateMigrations() {
  try {
    console.log('🔄 Consolidando migrações SQL...\n');
    
    // Caminho para as migrações
    const migrationsPath = path.join(__dirname, '../supabase/migrations');
    const outputPath = path.join(__dirname, '../supabase/schema-complete.sql');
    
    // Ler todos os arquivos SQL
    const files = await fs.readdir(migrationsPath);
    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ordenar alfabeticamente (ordem cronológica)
    
    console.log(`📋 Encontrados ${sqlFiles.length} arquivos de migração\n`);
    
    let consolidatedSQL = `-- ============================================
-- SCHEMA COMPLETO - DOHOO BACKEND
-- ============================================
-- Este arquivo contém todas as migrações consolidadas
-- Execute este arquivo no SQL Editor do Supabase
-- Data de geração: ${new Date().toISOString()}
-- Total de migrações: ${sqlFiles.length}
-- ============================================

-- Desabilitar temporariamente verificações que podem causar erros
SET check_function_bodies = false;

-- ============================================
-- SEÇÃO 1: TABELAS BASE (Devem ser criadas PRIMEIRO)
-- ============================================

-- Criar função update_updated_at_column (necessária para triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar enum para roles do sistema (necessário para várias tabelas)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela organizations (BASE - referenciada por várias outras)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela profiles (BASE - referenciada por várias outras)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  department TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  organization_id UUID REFERENCES public.organizations(id),
  user_role public.user_role DEFAULT 'agent',
  permissions JSONB DEFAULT '{"chat": true, "analytics": false, "users": false, "settings": false}',
  show_name_in_chat BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela chats (BASE - referenciada por messages)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'whatsapp',
  remote_jid TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active',
  priority TEXT DEFAULT 'medium',
  assigned_agent_id UUID REFERENCES auth.users(id),
  department TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  participants JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela messages (BASE - referenciada por várias outras)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  is_from_me BOOLEAN DEFAULT FALSE,
  is_internal BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'sent',
  message_id TEXT,
  reply_to UUID REFERENCES public.messages(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela whatsapp_accounts (BASE - referenciada por várias outras)
CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting', 'error')),
  qr_code TEXT,
  session_data JSONB DEFAULT '{}',
  account_id TEXT UNIQUE NOT NULL,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela ai_credits (BASE - referenciada/modificada por várias migrações)
CREATE TABLE IF NOT EXISTS public.ai_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  credits_purchased INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_remaining INTEGER GENERATED ALWAYS AS (credits_purchased - credits_used) STORED,
  last_purchase_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela ai_token_usage (BASE - referenciada por várias outras)
CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  assistant_id UUID REFERENCES public.ai_assistants(id),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  tokens_used INTEGER NOT NULL,
  model_used TEXT NOT NULL,
  cost_in_credits INTEGER NOT NULL,
  message_type TEXT DEFAULT 'chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela credit_transactions (BASE - referenciada por várias outras)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund')),
  credits_amount INTEGER NOT NULL,
  cost_usd DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela ai_assistants (BASE - referenciada por várias outras)
CREATE TABLE IF NOT EXISTS public.ai_assistants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  personality TEXT,
  instructions TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SEÇÃO 2: MIGRAÇÕES EM ORDEM
-- ============================================

`;

    let fileCount = 0;
    let totalSize = 0;
    
    // Processar cada arquivo
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsPath, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Adicionar separador com nome do arquivo
      consolidatedSQL += `\n-- ============================================\n`;
      consolidatedSQL += `-- Migração: ${file}\n`;
      consolidatedSQL += `-- ============================================\n\n`;
      
      // Limpar conteúdo: remover linhas vazias excessivas no início
      let cleanedContent = content.trim();
      
      // Remover comentários de timestamp se existirem
      cleanedContent = cleanedContent.replace(/^--.*\d{4}-\d{2}-\d{2}.*$/gm, '');
      
      // Remover criações de tabelas base que já foram criadas na seção 1
      // Isso evita duplicação e conflitos de dependências
      if (file.includes('20250614110827')) {
        // Remover criação de organizations e user_role (já criados na seção 1)
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.organizations[^;]*;/gis, '-- organizations já criada na seção 1');
        cleanedContent = cleanedContent.replace(/CREATE\s+TYPE\s+(IF\s+NOT\s+EXISTS\s+)?public\.user_role[^;]*;/gis, '-- user_role já criado na seção 1');
      }
      
      if (file.includes('20250614102324')) {
        // Remover criação de chats e messages (já criados na seção 1)
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.chats[^;]*;/gis, '-- chats já criada na seção 1');
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.messages[^;]*;/gis, '-- messages já criada na seção 1');
        cleanedContent = cleanedContent.replace(/DROP\s+TABLE\s+IF\s+EXISTS\s+public\.whatsapp_messages[^;]*;/gis, '-- whatsapp_messages já removida na seção 1');
      }
      
      if (file.includes('20250623000001-create-profiles-table')) {
        // Remover criação de profiles (já criada na seção 1)
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.profiles[^;]*;/gis, '-- profiles já criada na seção 1');
      }
      
      if (file.includes('20250614175634') || file.includes('0ffc7855-8f19-477a-b276-f46f81238fa4')) {
        // Remover criação de whatsapp_accounts (já criada na seção 1)
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.whatsapp_accounts[^;]*;/gis, '-- whatsapp_accounts já criada na seção 1');
      }
      
      if (file.includes('20250617005038') || file.includes('2ab116a1-02b9-4162-b28e-f6dff92a8e68')) {
        // Remover criação de ai_credits, ai_token_usage e credit_transactions (já criadas na seção 1)
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.ai_credits[^;]*;/gis, '-- ai_credits já criada na seção 1');
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.ai_token_usage[^;]*;/gis, '-- ai_token_usage já criada na seção 1');
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.credit_transactions[^;]*;/gis, '-- credit_transactions já criada na seção 1');
      }
      
      if (file.includes('20250615203659') || file.includes('887ae191-1cd9-4ad7-9f77-3fe1f11db30c')) {
        // Remover criação de ai_assistants (já criada na seção 1)
        cleanedContent = cleanedContent.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.ai_assistants[^;]*;/gis, '-- ai_assistants já criada na seção 1');
      }
      
      // Remover função update_updated_at_column se já foi criada (já está na seção 1)
      cleanedContent = cleanedContent.replace(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+update_updated_at_column\(\).*?END;\s*\$\$[^;]*;/gis, '-- update_updated_at_column já criada na seção 1');
      
      // Remover função update_updated_at (alias) também
      cleanedContent = cleanedContent.replace(/EXECUTE\s+FUNCTION\s+public\.update_updated_at\(\)/gis, 'EXECUTE FUNCTION public.update_updated_at_column()');
      
      // Garantir que termina com ponto-e-vírgula ou nova linha
      if (!cleanedContent.endsWith(';') && !cleanedContent.endsWith('\n')) {
        cleanedContent += ';\n';
      } else if (!cleanedContent.endsWith('\n')) {
        cleanedContent += '\n';
      }
      
      consolidatedSQL += cleanedContent + '\n\n';
      
      fileCount++;
      totalSize += content.length;
      console.log(`✅ Processado: ${file} (${(content.length / 1024).toFixed(2)} KB)`);
    }
    
    // Adicionar comentário final
    consolidatedSQL += `\n-- ============================================\n`;
    consolidatedSQL += `-- FIM DAS MIGRAÇÕES\n`;
    consolidatedSQL += `-- Total: ${fileCount} arquivos consolidados\n`;
    consolidatedSQL += `-- ============================================\n`;
    
    // Salvar arquivo consolidado
    await fs.writeFile(outputPath, consolidatedSQL, 'utf8');
    
    const fileSizeKB = (totalSize / 1024).toFixed(2);
    const outputSizeKB = (consolidatedSQL.length / 1024).toFixed(2);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ CONSOLIDAÇÃO CONCLUÍDA!');
    console.log('='.repeat(50));
    console.log(`📁 Arquivo gerado: supabase/schema-complete.sql`);
    console.log(`📊 Total de migrações: ${fileCount}`);
    console.log(`📦 Tamanho total: ${outputSizeKB} KB`);
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('   1. Acesse o Supabase Dashboard');
    console.log('   2. Vá em SQL Editor');
    console.log('   3. Abra o arquivo: backend/supabase/schema-complete.sql');
    console.log('   4. Copie TODO o conteúdo');
    console.log('   5. Cole no SQL Editor do Supabase');
    console.log('   6. Clique em "Run" (ou Ctrl+Enter)');
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   - O arquivo pode ser grande, aguarde a execução');
    console.log('   - Alguns erros de "already exists" são normais');
    console.log('   - Verifique os logs para confirmar criação das tabelas');
    console.log('='.repeat(50) + '\n');
    
    return {
      success: true,
      file: outputPath,
      fileCount,
      size: consolidatedSQL.length
    };
    
  } catch (error) {
    console.error('❌ Erro ao consolidar migrações:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('consolidate-migrations')) {
  consolidateMigrations()
    .then(() => {
      console.log('✅ Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro:', error);
      process.exit(1);
    });
}

export { consolidateMigrations };

