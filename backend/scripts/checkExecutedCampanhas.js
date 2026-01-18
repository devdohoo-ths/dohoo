#!/usr/bin/env node

/**
 * Script para verificar campanhas com template executadas
 */

import { supabase } from '../lib/supabaseClient.js';

async function checkExecutedCampanhas() {
  console.log('🔍 Verificando campanhas com template executadas...');
  
  try {
    const { data: campanhas, error } = await supabase
      .from('campanhas')
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo)
      `)
      .not('template_id', 'is', null)
      .in('status', ['em_execucao', 'finalizada'])
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar campanhas:', error);
      return { success: false, error: error.message };
    }

    console.log(`📊 Campanhas com template executadas: ${campanhas.length}`);
    campanhas.forEach(c => {
      console.log(`  - ${c.nome} (${c.status})`);
      console.log(`    Template: ${c.template?.nome || 'N/A'}`);
      console.log(`    Criado em: ${c.criado_em}`);
      console.log('');
    });

    // Verificar todas as campanhas com template (independente do status)
    const { data: todasCampanhasComTemplate, error: todasError } = await supabase
      .from('campanhas')
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo)
      `)
      .not('template_id', 'is', null)
      .order('criado_em', { ascending: false });

    if (todasError) {
      console.error('❌ Erro ao buscar todas as campanhas:', todasError);
      return { success: false, error: todasError.message };
    }

    console.log(`📊 Total de campanhas com template: ${todasCampanhasComTemplate.length}`);
    console.log('📋 Status das campanhas com template:');
    const statusCounts = {};
    todasCampanhasComTemplate.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });

    return { 
      success: true, 
      executadas: campanhas.length,
      total: todasCampanhasComTemplate.length
    };
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    return { success: false, error: error.message };
  }
}

// Executar verificação
checkExecutedCampanhas()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 Verificação concluída!');
      console.log(`📊 ${result.executadas} campanhas com template executadas`);
      console.log(`📊 ${result.total} total de campanhas com template`);
      
      if (result.executadas === 0) {
        console.log('\n💡 SOLUÇÃO: As campanhas com template estão em status "rascunho"');
        console.log('   Para aparecerem no painel, elas precisam ser executadas (status "em_execucao" ou "finalizada")');
      }
      
      process.exit(0);
    } else {
      console.log('\n❌ Verificação falhou!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Erro inesperado:', error);
    process.exit(1);
  });
