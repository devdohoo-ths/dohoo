#!/usr/bin/env node

/**
 * Script para Substituir Logs Excessivos no Frontend
 * 
 * Este script substitui console.log por logger nos arquivos do frontend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Substituindo logs excessivos no frontend...\n');

// Função para processar um arquivo
function processFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Arquivo não encontrado: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Verificar se já tem import do logger
    if (!content.includes("import { logger } from '@/utils/logger'")) {
      // Adicionar import do logger após outros imports
      const importMatch = content.match(/import.*from.*;\n/g);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertIndex = lastImportIndex + lastImport.length;
        
        content = content.slice(0, insertIndex) + 
                 "import { logger } from '@/utils/logger';\n" + 
                 content.slice(insertIndex);
        modified = true;
      }
    }

    // Substituições específicas para report-detailed-conversations.tsx
    const replacements = [
      // Logs de debug específicos
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Calculando estatísticas das conversas filtradas:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Calculando estatísticas das conversas filtradas',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Estatísticas calculadas:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Estatísticas calculadas',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Sem organização, pulando busca'\);/g,
        replacement: "logger.debug('[Relatório Detalhado] Sem organização, pulando busca');"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Iniciando busca de conversas com filtros:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Iniciando busca de conversas com filtros',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Filtro de agente aplicado:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Filtro de agente aplicado',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Sem filtro de agente - buscando todos os usuários'\);/g,
        replacement: "logger.debug('[Relatório Detalhado] Sem filtro de agente - buscando todos os usuários');"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Buscando dados diretamente do Supabase\.\.\.'\);/g,
        replacement: "logger.debug('[Relatório Detalhado] Buscando dados diretamente do Supabase');"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Datas sendo usadas:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Datas sendo usadas',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Aplicando filtro de palavras-chave:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Aplicando filtro de palavras-chave',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Dados dos usuários recebidos:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Dados dos usuários recebidos',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Usuários encontrados:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Usuários encontrados',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Mapeamento de usuários:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Mapeamento de usuários',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Processando mensagens para conversas:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Processando mensagens para conversas',"
      },
      {
        pattern: /console\.log\(`\[Relatório Detalhado\] Processando mensagem \$\{index \+ 1\}:`,/g,
        replacement: "logger.debug(`[Relatório Detalhado] Processando mensagem ${index + 1}:`,"
      },
      {
        pattern: /console\.log\(`\[Relatório Detalhado\] Nova conversa criada: \$\{chatId\} - \$\{chatName\} \(Usuário: \$\{userName\}\)`\);/g,
        replacement: "logger.debug(`[Relatório Detalhado] Nova conversa criada: ${chatId} - ${chatName} (Usuário: ${userName})`);"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Conversas extraídas das mensagens:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Conversas extraídas das mensagens',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Primeiras 3 conversas:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Primeiras 3 conversas',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Estrutura de dados criada:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Estrutura de dados criada',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Conversas carregadas, calculando estatísticas\.\.\.'\);/g,
        replacement: "logger.debug('[Relatório Detalhado] Conversas carregadas, calculando estatísticas');"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Processando conversas com detalhes:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Processando conversas com detalhes',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Primeira conversa para processar:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Primeira conversa para processar',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Conversas processadas:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Conversas processadas',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Primeira conversa processada:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Primeira conversa processada',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Estado conversations atualizado com:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Estado conversations atualizado com',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Filtros aplicados, verificando estado filteredConversations\.\.\.'\);/g,
        replacement: "logger.debug('[Relatório Detalhado] Filtros aplicados, verificando estado filteredConversations');"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Aplicando filtros:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Aplicando filtros',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Após filtro de cliente:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Após filtro de cliente',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Após filtro de usuário:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Após filtro de usuário',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Filtro de palavras-chave já aplicado na query do servidor'\);/g,
        replacement: "logger.debug('[Relatório Detalhado] Filtro de palavras-chave já aplicado na query do servidor');"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Conversas filtradas finais:',/g,
        replacement: "logger.debug('[Relatório Detalhado] Conversas filtradas finais',"
      },
      {
        pattern: /console\.log\('\[Relatório Detalhado\] Conversas filtradas atualizadas, calculando estatísticas\.\.\.'\);/g,
        replacement: "logger.debug('[Relatório Detalhado] Conversas filtradas atualizadas, calculando estatísticas');"
      }
    ];

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
      return true;
    } else {
      console.log(`⏭️ Nenhuma alteração necessária: ${filePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    return false;
  }
}

// Arquivos para processar
const filesToProcess = [
  'frontend/src/pages/report-detailed-conversations.tsx',
  'frontend/src/components/layout/Sidebar.tsx',
  'frontend/src/hooks/chat/useRealtimeChat.ts'
];

// Processar arquivos
let processedCount = 0;
let errorCount = 0;

filesToProcess.forEach(filePath => {
  const fullPath = path.resolve(__dirname, '..', '..', filePath);
  if (processFile(fullPath)) {
    processedCount++;
  } else {
    errorCount++;
  }
});

console.log('\n📊 Resumo da Substituição:');
console.log(`✅ Arquivos processados: ${processedCount}`);
console.log(`❌ Erros encontrados: ${errorCount}`);

if (errorCount === 0) {
  console.log('\n🎉 Logs excessivos substituídos com sucesso!');
  console.log('\n📝 Próximos passos:');
  console.log('1. Configure VITE_DEBUG_MODE=false no frontend');
  console.log('2. Reinicie o servidor de desenvolvimento');
  console.log('3. Os logs agora só aparecerão quando VITE_DEBUG_MODE=true');
} else {
  console.log('\n⚠️ Alguns erros foram encontrados. Verifique os arquivos acima.');
}
