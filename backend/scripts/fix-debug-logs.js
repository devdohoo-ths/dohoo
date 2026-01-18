#!/usr/bin/env node

/**
 * Script para Substituir Logs de Debug Restantes
 * 
 * Este script substitui os logs de debug que ainda estão aparecendo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Substituindo logs de debug restantes...\n');

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

    // Substituições específicas para logs de debug
    const replacements = [
      // Logs de debug específicos
      {
        pattern: /console\.log\(`\[Debug\] Determinando usuário para mensagem \$\{index \+ 1\}:`,/g,
        replacement: "logger.debug(`[Debug] Determinando usuário para mensagem ${index + 1}:`,"
      },
      {
        pattern: /console\.log\(`\[Debug\] Usuário encontrado por msg\.user_id: \$\{userName\}`\);/g,
        replacement: "logger.debug(`[Debug] Usuário encontrado por msg.user_id: ${userName}`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Usuário encontrado por assigned_agent_id: \$\{userName\}`\);/g,
        replacement: "logger.debug(`[Debug] Usuário encontrado por assigned_agent_id: ${userName}`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Usuário encontrado por sender_name: \$\{userName\}`\);/g,
        replacement: "logger.debug(`[Debug] Usuário encontrado por sender_name: ${userName}`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Usuário não encontrado, usando fallback: \$\{userName\}`\);/g,
        replacement: "logger.debug(`[Debug] Usuário não encontrado, usando fallback: ${userName}`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Atualizando nome do usuário de "\$\{chat\.agentName\}" para "\$\{newUserName\}"`\);/g,
        replacement: "logger.debug(`[Debug] Atualizando nome do usuário de \"${chat.agentName}\" para \"${newUserName}\"`);"
      },
      {
        pattern: /console\.log\('\[Debug\] Estrutura da tabela chats:',/g,
        replacement: "logger.debug('[Debug] Estrutura da tabela chats:',"
      },
      {
        pattern: /console\.log\('\[Debug\] Exemplo de chat completo:',/g,
        replacement: "logger.debug('[Debug] Exemplo de chat completo:',"
      },
      {
        pattern: /console\.log\('\[Debug\] Erro ao buscar exemplo de chat:',/g,
        replacement: "logger.debug('[Debug] Erro ao buscar exemplo de chat:',"
      },
      {
        pattern: /console\.log\('\[Debug\] Erro no debug da tabela chats:',/g,
        replacement: "logger.debug('[Debug] Erro no debug da tabela chats:',"
      },
      {
        pattern: /console\.log\(`\[Debug\] Buscando dados para conversa \$\{conv\.id\}`\);/g,
        replacement: "logger.debug(`[Debug] Buscando dados para conversa ${conv.id}`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Aplicando filtro de usuário \$\{filters\.userId\} para conversa \$\{conv\.id\}`\);/g,
        replacement: "logger.debug(`[Debug] Aplicando filtro de usuário ${filters.userId} para conversa ${conv.id}`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Resultado mensagens para \$\{conv\.id\}:`,/g,
        replacement: "logger.debug(`[Debug] Resultado mensagens para ${conv.id}:`,"
      },
      {
        pattern: /console\.log\(`\[Debug\] Resultado chat para \$\{conv\.id\}:`,/g,
        replacement: "logger.debug(`[Debug] Resultado chat para ${conv.id}:`,"
      },
      {
        pattern: /console\.log\(`\[Debug\] Grupo detectado para \$\{conv\.id\}: \$\{whatsappName\}`\);/g,
        replacement: "logger.debug(`[Debug] Grupo detectado para ${conv.id}: ${whatsappName}`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Conversa individual para \$\{conv\.id\}: \$\{whatsappName\} \(\$\{phoneNumber\}\)`\);/g,
        replacement: "logger.debug(`[Debug] Conversa individual para ${conv.id}: ${whatsappName} (${phoneNumber})`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Outro tipo de JID para \$\{conv\.id\}: \$\{whatsappName\} \(\$\{phoneNumber\}\)`\);/g,
        replacement: "logger.debug(`[Debug] Outro tipo de JID para ${conv.id}: ${whatsappName} (${phoneNumber})`);"
      },
      {
        pattern: /console\.log\(`\[Debug\] Não foi possível extrair dados para \$\{conv\.id\}:`,/g,
        replacement: "logger.debug(`[Debug] Não foi possível extrair dados para ${conv.id}:`,"
      },
      {
        pattern: /console\.log\(`\[Debug\] Dados extraídos do nome do cliente: \$\{whatsappName\} \(\$\{phoneNumber\}\)`\);/g,
        replacement: "logger.debug(`[Debug] Dados extraídos do nome do cliente: ${whatsappName} (${phoneNumber})`);"
      },
      {
        pattern: /console\.log\('[Debug] Conversa processada:',/g,
        replacement: "logger.debug('[Debug] Conversa processada:',"
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
  'frontend/src/pages/report-detailed-conversations.tsx'
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
  console.log('\n🎉 Logs de debug substituídos com sucesso!');
  console.log('\n📝 Próximos passos:');
  console.log('1. Configure VITE_DEBUG_MODE=false no frontend');
  console.log('2. Reinicie o servidor de desenvolvimento');
  console.log('3. Os logs agora só aparecerão quando VITE_DEBUG_MODE=true');
} else {
  console.log('\n⚠️ Alguns erros foram encontrados. Verifique os arquivos acima.');
}
