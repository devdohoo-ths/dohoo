#!/usr/bin/env node

/**
 * Script para verificar templates de campanhas
 */

import { supabase } from '../lib/supabaseClient.js';

async function checkTemplates() {
  console.log('🔍 Verificando templates de campanhas...');
  
  try {
    const { data: templates, error } = await supabase
      .from('campanha_templates')
      .select('*')
      .order('criado_em', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar templates:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`📝 Encontrados ${templates.length} templates:`);
    templates.forEach(t => {
      console.log(`  - ${t.nome} (ID: ${t.id})`);
      console.log(`    Conteúdo: ${t.conteudo.substring(0, 50)}...`);
      console.log(`    Variáveis: ${JSON.stringify(t.variaveis)}`);
      console.log(`    Aprovado: ${t.aprovado}`);
      console.log(`    Criado em: ${t.criado_em}`);
      console.log('');
    });

    // Verificar campanhas que usam templates
    console.log('🔍 Verificando campanhas que usam templates...');
    const { data: campanhasComTemplate, error: campanhasError } = await supabase
      .from('campanhas')
      .select(`
        *,
        template:campanha_templates(id, nome, conteudo)
      `)
      .not('template_id', 'is', null);

    if (campanhasError) {
      console.error('❌ Erro ao buscar campanhas com template:', campanhasError);
      return { success: false, error: campanhasError.message };
    }

    console.log(`📊 Encontradas ${campanhasComTemplate.length} campanhas com template:`);
    campanhasComTemplate.forEach(c => {
      console.log(`  - ${c.nome} (Status: ${c.status})`);
      if (c.template) {
        console.log(`    Template: ${c.template.nome}`);
      } else {
        console.log(`    ⚠️ Template não encontrado (ID: ${c.template_id})`);
      }
    });

    return { 
      success: true, 
      templates: templates.length,
      campanhasComTemplate: campanhasComTemplate.length
    };
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    return { success: false, error: error.message };
  }
}

// Executar verificação
checkTemplates()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 Verificação concluída!');
      console.log(`📝 ${result.templates} templates encontrados`);
      console.log(`📊 ${result.campanhasComTemplate} campanhas com template`);
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
