#!/usr/bin/env node

/**
 * Script de Aplicação da Fase 1 - Otimizações de Performance
 * 
 * Este script aplica todas as mudanças da Fase 1 automaticamente
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Aplicando Fase 1 - Otimizações de Performance\n');

// Função para verificar se um arquivo existe
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Função para verificar se um arquivo já tem o import do logger
function hasLoggerImport(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('import logger from') || content.includes('import { logger }');
  } catch (error) {
    return false;
  }
}

// Função para aplicar mudanças em um arquivo
function applyChanges(filePath, changes) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    changes.forEach(change => {
      if (change.type === 'replace') {
        const newContent = content.replace(change.pattern, change.replacement);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      } else if (change.type === 'addImport') {
        if (!content.includes(change.import)) {
          // Adicionar import após outros imports
          const importMatch = content.match(/import.*from.*;\n/g);
          if (importMatch) {
            const lastImport = importMatch[importMatch.length - 1];
            const lastImportIndex = content.lastIndexOf(lastImport);
            const insertIndex = lastImportIndex + lastImport.length;
            
            content = content.slice(0, insertIndex) + 
                     change.import + '\n' + 
                     content.slice(insertIndex);
            modified = true;
          }
        }
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Aplicado: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️ Nenhuma mudança necessária: ${filePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    return false;
  }
}

// Lista de arquivos para processar com suas mudanças
const filesToProcess = [
  {
    path: 'routes/dashboard.js',
    changes: [
      {
        type: 'addImport',
        import: "import logger from '../utils/logger.js';"
      },
      {
        type: 'replace',
        pattern: /console\.log\('🔍 \[Dashboard\] Debug - Parâmetros recebidos:',/g,
        replacement: "logger.debug('Debug - Parâmetros recebidos',"
      },
      {
        type: 'replace',
        pattern: /console\.log\('📅 \[Dashboard\] Debug das datas recebidas:',/g,
        replacement: "logger.debug('Debug das datas recebidas',"
      }
    ]
  },
  {
    path: 'routes/reports.js',
    changes: [
      {
        type: 'addImport',
        import: "import logger from '../utils/logger.js';"
      },
      {
        type: 'replace',
        pattern: /console\.log\('🔍 \[getUserRole\] Buscando role para usuário:',/g,
        replacement: "logger.database('Buscando role para usuário',"
      }
    ]
  },
  {
    path: 'services/unifiedDataService.js',
    changes: [
      {
        type: 'addImport',
        import: "import optimizedSupabase from '../utils/optimizedSupabase.js';"
      },
      {
        type: 'addImport',
        import: "import performanceMonitor from '../utils/performanceMonitor.js';"
      }
    ]
  }
];

// Processar arquivos
let processedCount = 0;
let errorCount = 0;

filesToProcess.forEach(file => {
  if (fileExists(file.path)) {
    if (applyChanges(file.path, file.changes)) {
      processedCount++;
    }
  } else {
    console.log(`⚠️ Arquivo não encontrado: ${file.path}`);
    errorCount++;
  }
});

// Verificar se os arquivos de configuração existem
console.log('\n📋 Verificando arquivos de configuração...');

const configFiles = [
  'utils/logger.js',
  '../frontend/src/utils/logger.ts',
  'utils/optimizedSupabase.js',
  '../frontend/src/utils/optimizedSupabase.ts',
  'utils/performanceMonitor.js',
  'routes/performance.js'
];

configFiles.forEach(file => {
  if (fileExists(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Arquivo não encontrado`);
    errorCount++;
  }
});

// Verificar se as rotas foram registradas
console.log('\n🔧 Verificando configurações do servidor...');

try {
  const serverContent = fs.readFileSync('server.js', 'utf8');
  if (serverContent.includes("import performanceRoutes from './routes/performance.js'")) {
    console.log('✅ Rota de performance importada no server.js');
  } else {
    console.log('❌ Rota de performance não encontrada no server.js');
    errorCount++;
  }

  if (serverContent.includes("app.use('/api/performance', performanceRoutes)")) {
    console.log('✅ Rota de performance registrada no server.js');
  } else {
    console.log('❌ Rota de performance não registrada no server.js');
    errorCount++;
  }
} catch (error) {
  console.log('❌ Erro ao verificar server.js:', error.message);
  errorCount++;
}

// Resumo final
console.log('\n📊 Resumo da Aplicação:');
console.log(`✅ Arquivos processados: ${processedCount}`);
console.log(`❌ Erros encontrados: ${errorCount}`);

if (errorCount === 0) {
  console.log('\n🎉 Fase 1 aplicada com sucesso!');
  console.log('\n📝 Próximos passos:');
  console.log('1. Configure as variáveis de ambiente:');
  console.log('   - Backend: LOG_LEVEL=ERROR, DEBUG_MODE=false');
  console.log('   - Frontend: VITE_LOG_LEVEL=ERROR, VITE_DEBUG_MODE=false');
  console.log('2. Reinicie os servidores (backend e frontend)');
  console.log('3. Teste as APIs de performance: GET /api/performance/stats');
  console.log('4. Monitore as métricas em produção');
} else {
  console.log('\n⚠️ Alguns erros foram encontrados. Verifique os arquivos acima.');
}

console.log('\n🔗 Documentação completa: PHASE1_OPTIMIZATION_GUIDE.md');
