// Script para verificar detalhes dos contatos da campanha mais recente
import { supabase } from '../lib/supabaseClient.js';

async function verificarContatosCampanha() {
  try {
    console.log('🔍 Verificando contatos da campanha mais recente...');

    // Buscar campanha mais recente
    const { data: campanha, error: campanhaError } = await supabase
      .from('campanhas')
      .select('id, nome, status')
      .order('criado_em', { ascending: false })
      .limit(1)
      .single();

    if (campanhaError) {
      throw new Error(`Erro ao buscar campanha: ${campanhaError.message}`);
    }

    console.log(`📋 Campanha: ${campanha.nome}`);
    console.log(`🆔 ID: ${campanha.id}`);
    console.log(`📊 Status: ${campanha.status}`);

    // Buscar contatos desta campanha
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
        respondido_em,
        enviado_por
      `)
      .eq('campanha_id', campanha.id);

    if (contatosError) {
      throw new Error(`Erro ao buscar contatos: ${contatosError.message}`);
    }

    console.log(`\n👥 Contatos encontrados: ${contatos?.length || 0}`);
    
    contatos?.forEach((contato, index) => {
      console.log(`\n${index + 1}. ${contato.contato_nome} (${contato.contato_telefone})`);
      console.log(`   Status: ${contato.status}`);
      console.log(`   Enviado por: ${contato.enviado_por || 'N/A'}`);
      console.log(`   Enviado em: ${contato.enviado_em || 'Não enviado'}`);
      console.log(`   Respondido em: ${contato.respondido_em || 'Não respondido'}`);
      if (contato.erro_detalhes) {
        console.log(`   ❌ Erro: ${contato.erro_detalhes}`);
      }
      if (contato.mensagem_enviada) {
        console.log(`   📝 Mensagem: ${contato.mensagem_enviada.substring(0, 50)}...`);
      }
    });

    // Buscar remetentes desta campanha
    console.log(`\n📤 Remetentes da campanha:`);
    const { data: remetentes, error: remetentesError } = await supabase
      .from('campanha_remetentes')
      .select(`
        id,
        usuario_id,
        numero_whatsapp,
        ativo,
        mensagens_enviadas,
        ultima_mensagem
      `)
      .eq('campanha_id', campanha.id);

    if (remetentesError) {
      console.log(`❌ Erro ao buscar remetentes: ${remetentesError.message}`);
    } else {
      remetentes?.forEach((remetente, index) => {
        console.log(`\n${index + 1}. Usuário: ${remetente.usuario_id}`);
        console.log(`   Número: ${remetente.numero_whatsapp || 'N/A'}`);
        console.log(`   Ativo: ${remetente.ativo}`);
        console.log(`   Mensagens enviadas: ${remetente.mensagens_enviadas}`);
        console.log(`   Última mensagem: ${remetente.ultima_mensagem || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar
verificarContatosCampanha();
