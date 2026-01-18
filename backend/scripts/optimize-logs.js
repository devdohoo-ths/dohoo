#!/usr/bin/env node

/**
 * Script para substituir console.log por logger em arquivos do backend
 * Este script automatiza a substituição dos logs mais comuns
 */

const fs = require('fs');
const path = require('path');

// Padrões de substituição
const replacements = [
  // Logs de debug com emojis
  {
    pattern: /console\.log\('🔍 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.debug('$2',"
  },
  {
    pattern: /console\.log\('📊 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.database('$2',"
  },
  {
    pattern: /console\.log\('📅 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.debug('$2',"
  },
  {
    pattern: /console\.log\('✅ \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.info('$2',"
  },
  {
    pattern: /console\.log\('❌ \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.error('$2',"
  },
  {
    pattern: /console\.log\('⚠️ \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.warn('$2',"
  },
  {
    pattern: /console\.log\('🔄 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.debug('$2',"
  },
  {
    pattern: /console\.log\('🎯 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.debug('$2',"
  },
  {
    pattern: /console\.log\('💬 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.debug('$2',"
  },
  {
    pattern: /console\.log\('🔐 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.auth('$2',"
  },
  {
    pattern: /console\.log\('📨 \[([^\]]+)\] ([^']+)',/g,
    replacement: "logger.whatsapp('$2',"
  },
  
  // Logs simples sem emojis
  {
    pattern: /console\.log\('([^']+)',/g,
    replacement: "logger.debug('$1',"
  },
  
  // console.error -> logger.error
  {
    pattern: /console\.error\('([^']+)',/g,
    replacement: "logger.error('$1',"
  },
  
  // console.warn -> logger.warn
  {
    pattern: /console\.warn\('([^']+)',/g,
    replacement: "logger.warn('$1',"
  }
];

// Arquivos para processar (os com mais logs)
const filesToProcess = [
  'backend/routes/dashboard.js',
  'backend/routes/reports.js',
  'backend/routes/reports-simple.js',
  'backend/routes/ai.js',
  'backend/routes/organizations.js',
  'backend/routes/teams.js',
  'backend/routes/users.js',
  'backend/routes/google.js',
  'backend/routes/database.js',
  'backend/routes/accounts.js'
];

function processFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Arquivo não encontrado: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Verificar se já tem import do logger
    if (!content.includes("import logger from '../utils/logger.js'") && 
        !content.includes("import logger from '../utils/logger'")) {
      
      // Adicionar import do logger após os outros imports
      const importMatch = content.match(/import.*from.*;\n/g);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertIndex = lastImportIndex + lastImport.length;
        
        content = content.slice(0, insertIndex) + 
                 "import logger from '../utils/logger.js';\n" + 
                 content.slice(insertIndex);
        modified = true;
      }
    }

    // Aplicar substituições
    replacements.forEach(({ pattern, replacement }) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Processado: ${filePath}`);
    } else {
      console.log(`⏭️ Nenhuma alteração necessária: ${filePath}`);
    }

  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
  }
}

// Processar arquivos
console.log('🚀 Iniciando substituição de logs...\n');

filesToProcess.forEach(filePath => {
  processFile(filePath);
});

console.log('\n✅ Substituição de logs concluída!');
console.log('\n📝 Próximos passos:');
console.log('1. Verifique se os imports do logger estão corretos');
console.log('2. Teste os arquivos modificados');
console.log('3. Configure as variáveis de ambiente para controlar os logs');
