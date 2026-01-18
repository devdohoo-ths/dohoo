#!/usr/bin/env node

/**
 * Script para Corrigir Erro de DOM Nesting
 * 
 * Este script remove espaços em branco desnecessários entre tags de tabela
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Corrigindo erro de DOM nesting...\n');

// Função para corrigir espaços em branco em tags de tabela
function fixTableWhitespace(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Arquivo não encontrado: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Padrões para corrigir espaços em branco problemáticos
    const fixes = [
      // Remover espaços entre TableRow e TableHead
      {
        pattern: /(<TableRow[^>]*>)\s*\n\s*(<TableHead[^>]*>)/g,
        replacement: '$1\n                  $2'
      },
      // Remover espaços entre TableRow e TableCell
      {
        pattern: /(<TableRow[^>]*>)\s*\n\s*(<TableCell[^>]*>)/g,
        replacement: '$1\n                    $2'
      },
      // Remover espaços entre TableHead e TableHead
      {
        pattern: /(<TableHead[^>]*>)\s*\n\s*(<TableHead[^>]*>)/g,
        replacement: '$1\n                  $2'
      },
      // Remover espaços entre TableCell e TableCell
      {
        pattern: /(<TableCell[^>]*>)\s*\n\s*(<TableCell[^>]*>)/g,
        replacement: '$1\n                    $2'
      },
      // Remover espaços entre TableRow de fechamento e abertura
      {
        pattern: /(<\/TableRow>)\s*\n\s*(<TableRow[^>]*>)/g,
        replacement: '$1\n                  $2'
      },
      // Remover espaços entre TableHead de fechamento e abertura
      {
        pattern: /(<\/TableHead>)\s*\n\s*(<TableHead[^>]*>)/g,
        replacement: '$1\n                  $2'
      },
      // Remover espaços entre TableCell de fechamento e abertura
      {
        pattern: /(<\/TableCell>)\s*\n\s*(<TableCell[^>]*>)/g,
        replacement: '$1\n                    $2'
      }
    ];

    // Aplicar correções
    fixes.forEach(({ pattern, replacement }) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Corrigido: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️ Nenhuma correção necessária: ${filePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Erro ao corrigir ${filePath}:`, error.message);
    return false;
  }
}

// Arquivos para corrigir
const filesToFix = [
  'frontend/src/pages/report-detailed-conversations.tsx'
];

// Corrigir arquivos
let fixedCount = 0;
let errorCount = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.resolve(__dirname, '..', '..', filePath);
  if (fixTableWhitespace(fullPath)) {
    fixedCount++;
  } else {
    errorCount++;
  }
});

console.log('\n📊 Resumo da Correção:');
console.log(`✅ Arquivos corrigidos: ${fixedCount}`);
console.log(`❌ Erros encontrados: ${errorCount}`);

if (fixedCount > 0) {
  console.log('\n🎉 Erro de DOM nesting corrigido!');
  console.log('\n📝 Próximos passos:');
  console.log('1. Reinicie o servidor de desenvolvimento');
  console.log('2. Verifique se o warning de DOM nesting foi resolvido');
} else {
  console.log('\n⚠️ Nenhuma correção foi aplicada. O problema pode estar em outro lugar.');
}
