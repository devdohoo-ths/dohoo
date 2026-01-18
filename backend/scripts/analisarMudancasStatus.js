/**
 * Script para analisar mudanças de status de contas WhatsApp
 * 
 * Este script consulta o histórico de mudanças de status no banco de dados
 * e identifica padrões de falhas/intermitências
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Analisa mudanças de status de uma conta específica
 */
async function analisarMudancasStatus(accountId, dias = 7) {
  console.log(`\n🔍 Analisando mudanças de status para conta: ${accountId}`);
  console.log(`📅 Período: últimos ${dias} dias\n`);

  try {
    // Buscar histórico de atualizações (usando updated_at como proxy)
    // Nota: Isso não captura todas as mudanças, apenas quando updated_at foi alterado
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    
    const { data: conta, error: contaError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status, phone_number, updated_at, created_at')
      .eq('account_id', accountId)
      .single();

    if (contaError || !conta) {
      console.error(`❌ Conta não encontrada: ${accountId}`);
      return;
    }

    console.log(`📱 Conta: ${conta.name}`);
    console.log(`📞 Telefone: ${conta.phone_number || 'N/A'}`);
    console.log(`📊 Status Atual: ${conta.status}`);
    console.log(`🕐 Última Atualização: ${new Date(conta.updated_at).toLocaleString('pt-BR')}`);
    console.log(`📅 Criada em: ${new Date(conta.created_at).toLocaleString('pt-BR')}\n`);

    // Buscar todas as contas da mesma organização para comparar
    const { data: todasContas, error: orgError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status, updated_at, organization_id')
      .eq('organization_id', conta.organization_id || '')
      .gte('updated_at', dataInicio.toISOString())
      .order('updated_at', { ascending: false });

    if (orgError) {
      console.warn(`⚠️ Erro ao buscar contas da organização:`, orgError.message);
    } else {
      console.log(`\n📊 Estatísticas da Organização (últimos ${dias} dias):`);
      const statusCount = {};
      todasContas?.forEach(acc => {
        statusCount[acc.status] = (statusCount[acc.status] || 0) + 1;
      });
      
      console.log(`   - Total de atualizações: ${todasContas?.length || 0}`);
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });
    }

    // Análise de padrões
    console.log(`\n🔍 Análise de Padrões:`);
    
    // Verificar se há muitas mudanças recentes
    const atualizacoesRecentes = todasContas?.filter(
      acc => acc.account_id === accountId && 
      new Date(acc.updated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) || [];

    if (atualizacoesRecentes.length > 5) {
      console.log(`   ⚠️ ALERTA: ${atualizacoesRecentes.length} atualizações nas últimas 24h (pode indicar intermitência)`);
    }

    // Verificar se está em 'connecting' há muito tempo
    if (conta.status === 'connecting') {
      const tempoConnecting = Date.now() - new Date(conta.updated_at).getTime();
      const minutosConnecting = Math.floor(tempoConnecting / (60 * 1000));
      
      if (minutosConnecting > 10) {
        console.log(`   ⚠️ ALERTA: Status 'connecting' há ${minutosConnecting} minutos (pode estar travado)`);
      }
    }

    // Verificar se mudou de 'connected' para 'connecting' recentemente
    if (conta.status === 'connecting') {
      console.log(`   ⚠️ Status atual é 'connecting' - verificar se houve desconexão indevida`);
    }

    console.log(`\n✅ Análise concluída\n`);

  } catch (error) {
    console.error(`❌ Erro ao analisar mudanças:`, error);
  }
}

/**
 * Lista todas as contas com mudanças recentes de status
 */
async function listarMudancasRecentes(dias = 1, statusFiltro = null) {
  console.log(`\n📋 Listando mudanças de status (últimos ${dias} dias)`);
  if (statusFiltro) {
    console.log(`🔍 Filtro: status = '${statusFiltro}'\n`);
  } else {
    console.log(`\n`);
  }

  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    
    let query = supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status, phone_number, updated_at, organization_id')
      .gte('updated_at', dataInicio.toISOString())
      .order('updated_at', { ascending: false })
      .limit(100);

    if (statusFiltro) {
      query = query.eq('status', statusFiltro);
    }

    const { data: contas, error } = await query;

    if (error) {
      console.error(`❌ Erro ao buscar contas:`, error);
      return;
    }

    if (!contas || contas.length === 0) {
      console.log(`ℹ️ Nenhuma mudança encontrada no período\n`);
      return;
    }

    console.log(`📊 Total de contas com mudanças: ${contas.length}\n`);

    // Agrupar por status
    const porStatus = {};
    contas.forEach(conta => {
      if (!porStatus[conta.status]) {
        porStatus[conta.status] = [];
      }
      porStatus[conta.status].push(conta);
    });

    Object.entries(porStatus).forEach(([status, lista]) => {
      console.log(`\n📌 Status: ${status} (${lista.length} contas)`);
      lista.slice(0, 10).forEach(conta => {
        const tempoAtras = Math.floor((Date.now() - new Date(conta.updated_at).getTime()) / (60 * 1000));
        console.log(`   - ${conta.name} (${conta.phone_number || 'N/A'}) - há ${tempoAtras} minutos`);
      });
      if (lista.length > 10) {
        console.log(`   ... e mais ${lista.length - 10} contas`);
      }
    });

    console.log(`\n✅ Listagem concluída\n`);

  } catch (error) {
    console.error(`❌ Erro ao listar mudanças:`, error);
  }
}

// Executar script
const args = process.argv.slice(2);
const comando = args[0];
const parametro1 = args[1];
const parametro2 = args[2];

if (comando === 'conta' && parametro1) {
  const dias = parametro2 ? parseInt(parametro2) : 7;
  analisarMudancasStatus(parametro1, dias);
} else if (comando === 'listar') {
  const dias = parametro1 ? parseInt(parametro1) : 1;
  const statusFiltro = parametro2 || null;
  listarMudancasRecentes(dias, statusFiltro);
} else {
  console.log(`
📋 Script de Análise de Mudanças de Status WhatsApp

Uso:
  node analisarMudancasStatus.js conta <account_id> [dias]
    - Analisa mudanças de status de uma conta específica
    - Exemplo: node analisarMudancasStatus.js conta abc123 7

  node analisarMudancasStatus.js listar [dias] [status]
    - Lista todas as contas com mudanças recentes
    - Exemplo: node analisarMudancasStatus.js listar 1 connecting

Parâmetros:
  account_id  - ID da conta WhatsApp
  dias        - Número de dias para analisar (padrão: 7 para conta, 1 para listar)
  status      - Filtrar por status específico (connected, connecting, disconnected, error)
  `);
}

