#!/usr/bin/env node

/**
 * Script para Verificar e Corrigir Imports do Logger
 * 
 * Este script verifica se todos os arquivos que usam logger têm o import correto
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verificando imports do logger...\n');

// Função para verificar se um arquivo usa logger mas não tem import
function checkLoggerImport(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Arquivo não encontrado: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar se usa logger
    const usesLogger = content.includes('logger.');
    
    // Verificar se tem import do logger
    const hasLoggerImport = content.includes("import { logger } from '@/utils/logger'") || 
                           content.includes("import logger from '@/utils/logger'");
    
    if (usesLogger && !hasLoggerImport) {
      console.log(`❌ ${filePath} - USA logger mas NÃO tem import`);
      return false;
    } else if (usesLogger && hasLoggerImport) {
      console.log(`✅ ${filePath} - USA logger e TEM import`);
      return true;
    } else if (!usesLogger && hasLoggerImport) {
      console.log(`⚠️ ${filePath} - TEM import mas NÃO usa logger`);
      return true;
    } else {
      console.log(`⏭️ ${filePath} - NÃO usa logger`);
      return true;
    }

  } catch (error) {
    console.error(`❌ Erro ao verificar ${filePath}:`, error.message);
    return false;
  }
}

// Função para adicionar import do logger
function addLoggerImport(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Adicionar import do logger após outros imports
    const importMatch = content.match(/import.*from.*;\n/g);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;
      
      content = content.slice(0, insertIndex) + 
               "import { logger } from '@/utils/logger';\n" + 
               content.slice(insertIndex);
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Import adicionado: ${filePath}`);
      return true;
    } else {
      console.log(`❌ Não foi possível adicionar import: ${filePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Erro ao adicionar import em ${filePath}:`, error.message);
    return false;
  }
}

// Arquivos para verificar
const filesToCheck = [
  'frontend/src/pages/report-detailed-conversations.tsx',
  'frontend/src/components/layout/Sidebar.tsx',
  'frontend/src/hooks/chat/useChatOperations.ts',
  'frontend/src/hooks/chat/useRealtimeChat.ts'
];

// Verificar arquivos
let allGood = true;
let fixedCount = 0;

filesToCheck.forEach(filePath => {
  const fullPath = path.resolve(__dirname, '..', '..', filePath);
  const isGood = checkLoggerImport(fullPath);
  
  if (!isGood) {
    allGood = false;
    // Tentar adicionar import
    if (addLoggerImport(fullPath)) {
      fixedCount++;
    }
  }
});

console.log('\n📊 Resumo da Verificação:');
if (allGood) {
  console.log('✅ Todos os arquivos estão corretos!');
} else {
  console.log(`✅ ${fixedCount} arquivos corrigidos`);
  console.log('⚠️ Verifique se ainda há erros');
}

console.log('\n📝 Próximos passos:');
console.log('1. Reinicie o servidor de desenvolvimento');
console.log('2. Verifique se os erros de "logger is not defined" foram resolvidos');
console.log('3. Configure VITE_DEBUG_MODE=false para desativar logs');
