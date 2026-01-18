// Script para verificar status da campanha
import { supabase } from '../lib/supabaseClient.js';

async function verificarCampanhas() {
  try {
    console.log('🔍 Verificando campanhas...');

    // Buscar campanhas recentes
    const { data: campanhas, error } = await supabase
      .from('campanhas')
      .select(`
        id,
        nome,
        status,
        total_destinatarios,
        enviados,
        respondidos,
        data_inicio,
        data_fim,
        configuracoes
      `)
      .order('criado_em', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error(`Erro ao buscar campanhas: ${error.message}`);
    }

    console.log(`📊 Encontradas ${campanhas?.length || 0} campanhas:`);
    
    campanhas?.forEach((campanha, index) => {
      console.log(`\n${index + 1}. ${campanha.nome}`);
      console.log(`   ID: ${campanha.id}`);
      console.log(`   Status: ${campanha.status}`);
      console.log(`   Destinatários: ${campanha.total_destinatarios}`);
      console.log(`   Enviados: ${campanha.enviados}`);
      console.log(`   Respondidos: ${campanha.respondidos}`);
      console.log(`   Início: ${campanha.data_inicio}`);
      console.log(`   Fim: ${campanha.data_fim || 'Não finalizada'}`);
    });

    // Buscar contatos da campanha mais recente
    if (campanhas && campanhas.length > 0) {
      const campanhaMaisRecente = campanhas[0];
      console.log(`\n🔍 Contatos da campanha "${campanhaMaisRecente.nome}":`);

      const { data: contatos, error: contatosError } = await supabase
        .from('campanha_contatos')
        .select(`
          id,
          contato_nome,
          contato_telefone,
          status,
          mensagem_enviada,
          erro_detalhes,
          enviado_em,
          respondido_em
        `)
        .eq('campanha_id', campanhaMaisRecente.id);

      if (contatosError) {
        console.log(`❌ Erro ao buscar contatos: ${contatosError.message}`);
      } else {
        contatos?.forEach((contato, index) => {
          console.log(`\n   ${index + 1}. ${contato.contato_nome} (${contato.contato_telefone})`);
          console.log(`      Status: ${contato.status}`);
          console.log(`      Enviado em: ${contato.enviado_em || 'Não enviado'}`);
          console.log(`      Respondido em: ${contato.respondido_em || 'Não respondido'}`);
          if (contato.erro_detalhes) {
            console.log(`      Erro: ${contato.erro_detalhes}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar
verificarCampanhas();
