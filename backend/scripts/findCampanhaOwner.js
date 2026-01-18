#!/usr/bin/env node

/**
 * Script para encontrar o dono das campanhas
 */

import { supabase } from '../lib/supabaseClient.js';

async function findCampanhaOwner() {
  console.log('🔍 Encontrando o dono das campanhas...');
  
  try {
    const { data: campanhas, error } = await supabase
      .from('campanhas')
      .select('id, nome, created_by, organization_id')
      .limit(3);

    if (error) {
      console.error('❌ Erro ao buscar campanhas:', error);
      return { success: false, error: error.message };
    }

    console.log('📊 Campanhas encontradas:');
    campanhas.forEach(c => {
      console.log(`  - ${c.nome} (Criado por: ${c.created_by}, Org: ${c.organization_id})`);
    });

    // Buscar usuário que criou as campanhas
    if (campanhas.length > 0) {
      const userId = campanhas[0].created_by;
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, name, email, organization_id')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('❌ Erro ao buscar usuário:', userError);
        return { success: false, error: userError.message };
      }

      console.log('\n👤 Usuário que criou as campanhas:');
      console.log(`  - ${user.name} (${user.email})`);
      console.log(`  - ID: ${user.id}`);
      console.log(`  - Organização: ${user.organization_id}`);

      // Verificar campanhas deste usuário
      const { data: userCampanhas, error: userCampanhasError } = await supabase
        .from('campanhas')
        .select('id, nome, status')
        .eq('organization_id', user.organization_id)
        .limit(10);

      if (userCampanhasError) {
        console.error('❌ Erro ao buscar campanhas do usuário:', userCampanhasError);
      } else {
        console.log(`\n📊 Campanhas da organização ${user.organization_id}: ${userCampanhas.length}`);
        userCampanhas.forEach(c => {
          console.log(`  - ${c.nome} (${c.status})`);
        });
      }

      return { 
        success: true, 
        userId: user.id,
        userName: user.name,
        organizationId: user.organization_id,
        campanhasCount: userCampanhas?.length || 0
      };
    }

    return { success: true, campanhas: campanhas.length };
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    return { success: false, error: error.message };
  }
}

// Executar busca
findCampanhaOwner()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 Busca concluída!');
      if (result.userId) {
        console.log(`👤 Usuário: ${result.userName}`);
        console.log(`🏢 Organização: ${result.organizationId}`);
        console.log(`📊 Campanhas: ${result.campanhasCount}`);
        console.log('\n💡 Para testar no frontend:');
        console.log(`   1. Faça login com o usuário: ${result.userName}`);
        console.log(`   2. Verifique se a organização está correta`);
        console.log(`   3. As campanhas devem aparecer na página /campanhas`);
      }
      process.exit(0);
    } else {
      console.log('\n❌ Busca falhou!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Erro inesperado:', error);
    process.exit(1);
  });
