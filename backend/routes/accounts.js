import express from 'express';
import { 
  createWhatsAppConnection, 
  disconnectWhatsAppAccount, 
  sendMessageByAccount,
  getAllConnectionsStatus,
  getConnectionStatus,
  reconnectAllAccounts
} from '../services/multiWhatsapp.js';
import { supabase, supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendWhatsAppInvite } from '../services/emailService.js';
import crypto from 'crypto';

const router = express.Router(); 


// Criar nova conta WhatsApp e gerar QR Code
router.post('/whatsapp', async (req, res) => {
  const { name, accountId, inviteId, userId } = req.body;
  
  if (!name || !accountId) {
    return res.status(400).json({ 
      error: 'Nome da conta e ID são obrigatórios'  
    });
  }
  
  // ✅ CORREÇÃO: Se é um convite, buscar dados do convite
  if (inviteId) {
    try {
      // Buscar dados do convite
      // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (pode ser chamado sem autenticação)
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('whatsapp_invites')
        .select('organization_id, user_id, status')
        .eq('id', inviteId)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        return res.status(404).json({ error: 'Convite não encontrado ou já utilizado' });
      }

      console.log(`🔄 [API] Criando conexão WhatsApp via convite para conta: ${name} (ID sugerido: ${accountId}) na organização: ${invite.organization_id}`);

      // Verificar se já existe uma conta para este usuário na organização
      const { data: existingAccounts, error: existingError } = await supabase
        .from('whatsapp_accounts')
        .select('id, account_id, name, created_at')
        .eq('organization_id', invite.organization_id)
        .eq('user_id', invite.user_id)
        .order('created_at', { ascending: true });

      const now = new Date().toISOString();
      let accountIdToUse = accountId;
      let accountNameToUse = name;
      let accountRecord = null;

      if (!existingError && existingAccounts && existingAccounts.length > 0) {
        const [primaryAccount, ...duplicateAccounts] = existingAccounts;

        accountIdToUse = primaryAccount.account_id || accountId;
        accountNameToUse = name || primaryAccount.name;

        const { data: updatedAccount, error: updateError } = await supabase
          .from('whatsapp_accounts')
          .update({
            name: accountNameToUse,
            status: 'disconnected', // ✅ CORREÇÃO: Não mudar para connecting quando há convite
            updated_at: now
          })
          .eq('id', primaryAccount.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ [API] Erro ao atualizar conta existente:', updateError);
          return res.status(500).json({ error: 'Erro ao preparar conta existente para reconexão' });
        }

        accountRecord = updatedAccount;

        if (duplicateAccounts.length > 0) {
          const duplicateIds = duplicateAccounts.map(acc => acc.id);
          console.log(`⚠️ [API] Removendo ${duplicateIds.length} conta(s) duplicada(s) para usuário ${invite.user_id}`);
          const { error: deleteError } = await supabase
            .from('whatsapp_accounts')
            .delete()
            .in('id', duplicateIds);

          if (deleteError) {
            console.error('⚠️ [API] Falha ao remover contas duplicadas:', deleteError);
          }
        }
      } else {
        // Criar a conta no banco de dados
        const { data: account, error: dbError } = await supabase
          .from('whatsapp_accounts')
          .insert([{
            user_id: invite.user_id,
            organization_id: invite.organization_id,
            name: name,
            account_id: accountIdToUse,
            status: 'disconnected' // ✅ CORREÇÃO: Criar como disconnected quando há convite
          }])
          .select()
          .single();

        if (dbError) {
          console.error('❌ [API] Erro ao criar conta no banco:', dbError);
          return res.status(500).json({ 
            error: 'Erro ao criar conta WhatsApp no banco de dados' 
          });
        }

        accountRecord = account;
        console.log('✅ [API] Conta WhatsApp criada no banco via convite:', account.id);
      }
      
      // ✅ CORREÇÃO: Gerar QR code automaticamente quando há convite
      // O usuário já clicou em "Conectar", então devemos iniciar a conexão imediatamente
      console.log(`📋 [API] Conta criada via convite. Iniciando conexão WhatsApp para gerar QR Code...`);
      
      try {
        // Iniciar conexão WhatsApp para gerar QR Code
        const connectionResult = await createWhatsAppConnection(
          accountIdToUse,
          accountNameToUse,
          true, // shouldGenerateQr = true
          { 
            source: 'invite', 
            userId: invite.user_id,
            organizationId: invite.organization_id 
          }
        );
        
        console.log(`✅ [API] Conexão WhatsApp iniciada via convite:`, {
          accountId: accountIdToUse,
          connectionSuccess: connectionResult?.success
        });
        
        res.json({
          success: true,
          message: 'Conexão WhatsApp iniciada. Aguarde o QR Code.',
          accountId: accountIdToUse,
          account: accountRecord
        });
      } catch (connectionError) {
        console.error(`❌ [API] Erro ao iniciar conexão WhatsApp via convite:`, connectionError);
        // Mesmo com erro na conexão, a conta foi criada com sucesso
        // O frontend pode tentar novamente
        res.json({
          success: true,
          message: 'Conta criada. Houve um erro ao gerar QR Code, tente novamente.',
          accountId: accountIdToUse,
          account: accountRecord,
          connectionError: connectionError.message
        });
      }
    } catch (error) {
      console.error('❌ [API] Erro ao processar convite:', error);
      res.status(500).json({ 
        error: 'Erro interno ao processar convite' 
      });
    }
  } else {
    // Se não é convite, exigir autenticação
    return res.status(401).json({ error: 'Autenticação necessária' });
  }
});

// ✅ NOVO: GET QR Code de uma conta (público para convites - antes do middleware de autenticação)
// ✅ NOVO: Rate limiting simples para evitar polling excessivo (conservador)
const qrCodeRequestCache = new Map(); // accountId -> { lastRequest: timestamp, count: number }

router.get('/whatsapp/:accountId/qr', async (req, res) => {
  const { accountId } = req.params;
  
  // ✅ NOVO: Rate limiting conservador - máximo 1 requisição a cada 2 segundos por accountId
  const now = Date.now();
  const cached = qrCodeRequestCache.get(accountId);
  
  if (cached) {
    const timeSinceLastRequest = now - cached.lastRequest;
    if (timeSinceLastRequest < 2000) {
      // Se fez requisição há menos de 2 segundos, incrementar contador
      cached.count++;
      if (cached.count > 10) {
        // Se fez mais de 10 requisições em menos de 2 segundos, bloquear temporariamente
        console.warn(`⚠️ [API] Rate limit atingido para accountId: ${accountId} (${cached.count} requisições em ${timeSinceLastRequest}ms)`);
        return res.status(429).json({ 
          success: false, 
          error: 'Muitas requisições. Aguarde alguns segundos antes de tentar novamente.',
          retryAfter: 2
        });
      }
    } else {
      // Resetar contador se passou mais de 2 segundos
      cached.count = 1;
      cached.lastRequest = now;
    }
  } else {
    // Primeira requisição para este accountId
    qrCodeRequestCache.set(accountId, { lastRequest: now, count: 1 });
  }
  
  // Limpar cache antigo (mais de 5 minutos) para evitar memory leak
  if (qrCodeRequestCache.size > 100) {
    for (const [id, data] of qrCodeRequestCache.entries()) {
      if (now - data.lastRequest > 300000) { // 5 minutos
        qrCodeRequestCache.delete(id);
      }
    }
  }
  
  // ✅ REDUZIDO: Logs menos verbosos para evitar poluição (apenas quando necessário)
  // console.log(`🔍 [API] GET /whatsapp/:accountId/qr - Buscando QR Code para conta: ${accountId}`);
  
  try {
    // ✅ NOVO: Tentar buscar do cache de ambos os serviços (Baileys e WPPConnect)
    // pois não sabemos qual API está sendo usada sem verificar a organização
    let qrData = null;
    
    // Tentar primeiro do multiWhatsapp.js (Baileys)
    try {
      const { getQRCodeFromCache: getQRFromBaileys } = await import('../services/multiWhatsapp.js');
      qrData = await getQRFromBaileys(accountId);
      if (qrData) {
        console.log(`✅ [API] QR Code encontrado no cache do Baileys`);
      }
    } catch (baileysError) {
      console.log(`ℹ️ [API] Não foi possível buscar do Baileys (pode não estar em uso):`, baileysError.message);
    }
    
    // Se não encontrou no Baileys, tentar do wppconnectService.js
    if (!qrData) {
      try {
        const { getQRCodeFromCache: getQRFromWPP } = await import('../services/wppconnectService.js');
        qrData = await getQRFromWPP(accountId);
        if (qrData) {
          console.log(`✅ [API] QR Code encontrado no cache do WPPConnect`);
        }
      } catch (wppError) {
        console.log(`ℹ️ [API] Não foi possível buscar do WPPConnect (pode não estar em uso):`, wppError.message);
      }
    }
    
    if (!qrData) {
      // ✅ REDUZIDO: Log apenas quando necessário (não a cada requisição)
      // console.log(`⏳ [API] QR Code ainda não disponível para conta: ${accountId} (verificado em ambos os serviços)`);
      return res.status(404).json({ 
        success: false, 
        error: 'QR Code ainda não disponível. Aguarde alguns segundos.' 
      });
    }
    
    // ✅ REDUZIDO: Log apenas quando QR code é encontrado (sucesso)
    console.log(`✅ [API] QR Code encontrado e retornado para conta: ${accountId}`);
    res.json({
      success: true,
      qrCode: qrData.qrCode,
      accountId: accountId,
      timestamp: qrData.timestamp
    });
  } catch (error) {
    console.error('❌ [API] Erro ao buscar QR Code:', error);
    console.error('❌ [API] Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar QR Code',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Middleware de autenticação
router.use(authenticateToken);

// Listar todas as contas da organização (compatibilidade com frontend)
router.get('/', async (req, res) => {
  try {
    console.log('📱 [API] Buscando contas da organização:', req.user.organization_id);
    
    // Buscar contas da organização no banco
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro ao buscar contas:', error);
      return res.status(500).json({ error: 'Erro ao buscar contas' });
    }

    // Combinar com status das conexões ativas
    const connections = getAllConnectionsStatus();
    const accountsWithStatus = accounts?.map(account => {
      const connection = connections.find(conn => conn.accountId === account.account_id);
      return {
        ...account,
        status: connection?.status || account.status,
        phone_number: connection?.phoneNumber || account.phone_number
      };
    }) || [];

    console.log(`✅ [API] ${accountsWithStatus.length} contas encontradas para organização ${req.user.organization_id}`);
    
    res.json({ accounts: accountsWithStatus });
  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar contas:', error);
    res.status(500).json({ error: error.message });
  }
});



// Desconectar conta específica da organização
router.delete('/whatsapp/:accountId', async (req, res) => {
  const { accountId } = req.params;
  
  console.log(`🔌 [API] Desconectando conta WhatsApp: ${accountId} da organização: ${req.user.organization_id}`);
  
  try {
    // Verificar se a conta pertence à organização
    const { data: account, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const result = await disconnectWhatsAppAccount(accountId);
    
    if (result.success) {
      // Remover do banco de dados
      await supabase
        .from('whatsapp_accounts')
        .delete()
        .eq('account_id', accountId)
        .eq('organization_id', req.user.organization_id);
    }
    
    res.json(result);
  } catch (error) {
    console.error('❌ [API] Erro ao desconectar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter status de uma conta específica da organização
router.get('/whatsapp/:accountId/status', async (req, res) => {
  const { accountId } = req.params;
  
  try {
    // Verificar se a conta pertence à organização
    const { data: account, error } = await supabase
      .from('whatsapp_accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error || !account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const status = getConnectionStatus(accountId);
    res.json({ accountId, status });
  } catch (error) {
    console.error('❌ [API] Erro ao buscar status da conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Enviar mensagem por conta específica da organização
router.post('/whatsapp/:accountId/send', async (req, res) => {
  const { accountId } = req.params;
  const { to, message } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({ 
      error: 'Número de destino e mensagem são obrigatórios' 
    });
  }
  
  console.log(`📤 [API] Enviando mensagem via conta ${accountId} para ${to} da organização: ${req.user.organization_id}`);
  
  try {
    // Verificar se a conta pertence à organização
    const { data: account, error } = await supabase
      .from('whatsapp_accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error || !account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const result = await sendMessageByAccount(accountId, to, message);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ [API] Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter todas as contas com seus status detalhados da organização
router.get('/status', async (req, res) => {
  try {
    console.log('📱 [API] Buscando status das contas da organização:', req.user.organization_id);
    
    // Buscar contas da organização
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro ao buscar contas:', error);
      return res.status(500).json({ error: 'Erro ao buscar contas' });
    }

    // Combinar com status das conexões ativas
    const connections = getAllConnectionsStatus();
    const accountsWithStatus = accounts?.map(account => {
      const connection = connections.find(conn => conn.accountId === account.account_id);
      return {
        ...account,
        status: connection?.status || account.status,
        phone_number: connection?.phoneNumber || account.phone_number
      };
    }) || [];

    const connectedCount = accountsWithStatus.filter(conn => conn.status === 'connected').length;
    
    console.log(`✅ [API] ${accountsWithStatus.length} contas encontradas, ${connectedCount} conectadas para organização ${req.user.organization_id}`);
    
    res.json({ 
      success: true, 
      accounts: accountsWithStatus,
      total: accountsWithStatus.length,
      connected: connectedCount
    });
  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar status das contas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Forçar reconexão de todas as contas da organização
router.post('/reconnect', async (req, res) => {
  console.log('🔄 [API] Recebida solicitação para reconectar todas as contas da organização:', req.user.organization_id);
  try {
    // Buscar contas da organização
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name')
      .eq('organization_id', req.user.organization_id);

    if (error) {
      console.error('❌ [API] Erro ao buscar contas para reconexão:', error);
      return res.status(500).json({ error: 'Erro ao buscar contas' });
    }

    console.log(`📱 [API] ${accounts?.length || 0} contas encontradas para reconexão da organização ${req.user.organization_id}`);

    await reconnectAllAccounts();
    res.json({ 
      success: true, 
      message: `Processo de reconexão iniciado para ${accounts?.length || 0} contas da organização.` 
    });
  } catch (error) {
    console.error('❌ [API] Erro ao acionar a reconexão de todas as contas:', error);
    res.status(500).json({ success: false, error: 'Falha ao iniciar o processo de reconexão.' });
  }
});

// Corrigir chats órfãos (sem assigned_agent_id) associando-os aos donos das contas WhatsApp
router.post('/fix-orphan-chats', async (req, res) => {
  console.log('🔧 Iniciando correção de chats órfãos...');
  
  try {
    // Buscar chats sem assigned_agent_id que têm mensagens
    const { data: orphanChats, error: orphanError } = await supabase
      .from('chats')
      .select(`
        id, 
        whatsapp_jid, 
        name,
        messages(user_id, account_id)
      `)
      .is('assigned_agent_id', null)
      .not('whatsapp_jid', 'is', null);

    if (orphanError) {
      console.error('❌ Erro ao buscar chats órfãos:', orphanError);
      return res.status(500).json({ success: false, error: orphanError.message });
    }

    console.log(`📊 Encontrados ${orphanChats?.length || 0} chats órfãos`);

    let fixed = 0;
    for (const chat of orphanChats || []) {
      // Encontrar o user_id baseado nas mensagens do chat
      const message = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;
      if (message && message.user_id) {
        // Atualizar o chat com o assigned_agent_id
        const { error: updateError } = await supabase
          .from('chats')
          .update({ assigned_agent_id: message.user_id })
          .eq('id', chat.id);

        if (!updateError) {
          console.log(`✅ Chat ${chat.id} (${chat.name}) atribuído ao usuário ${message.user_id}`);
          fixed++;
        } else {
          console.error(`❌ Erro ao corrigir chat ${chat.id}:`, updateError);
        }
      }
    }

    console.log(`🎉 Correção concluída: ${fixed} chats órfãos corrigidos`);
    res.json({ 
      success: true, 
      message: `${fixed} chats órfãos foram corrigidos`,
      orphanChats: orphanChats?.length || 0,
      fixed
    });

  } catch (error) {
    console.error('❌ Erro durante correção de chats órfãos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno durante correção de chats órfãos' 
    });
  }
});

// Corrigir nomes de chats que estão como "Lú" ou números
router.post('/fix-chat-names', async (req, res) => {
  console.log('📝 Iniciando correção de nomes de chats...');
  
  try {
    // Buscar chats com nomes problemáticos
    const { data: chatsWithBadNames, error: badNamesError } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid')
      .or('name.eq.Lú,name.eq.Lu,name.eq.lú,name.eq.lu,name.eq.null')
      .not('whatsapp_jid', 'is', null);
    
    // Também buscar chats que têm apenas números como nome
    const { data: numberNameChats, error: numberError } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid')
      .not('whatsapp_jid', 'is', null);
    
    // Filtrar os que têm apenas números
    const filteredNumberChats = numberNameChats?.filter(chat => 
      chat.name && /^\d+$/.test(chat.name)
    ) || [];
    
    // Combinar as duas listas
    const allBadChats = [...(chatsWithBadNames || []), ...filteredNumberChats];
    
    // Remover duplicatas
    const uniqueBadChats = allBadChats.filter((chat, index, arr) => 
      arr.findIndex(c => c.id === chat.id) === index
    );

    if (badNamesError || numberError) {
      console.error('❌ Erro ao buscar chats com nomes problemáticos:', badNamesError || numberError);
      return res.status(500).json({ success: false, error: (badNamesError || numberError).message });
    }

    console.log(`📊 Encontrados ${uniqueBadChats.length} chats com nomes problemáticos`);

    let fixed = 0;
    for (const chat of uniqueBadChats) {
      // Extrair o número do WhatsApp JID
      const phoneNumber = chat.whatsapp_jid.split('@')[0];
      
      // Atualizar o nome do chat para o número do telefone
      const { error: updateError } = await supabase
        .from('chats')
        .update({ name: phoneNumber })
        .eq('id', chat.id);

      if (!updateError) {
        console.log(`✅ Chat ${chat.id} nome corrigido de "${chat.name}" para "${phoneNumber}"`);
        fixed++;
      } else {
        console.error(`❌ Erro ao corrigir nome do chat ${chat.id}:`, updateError);
      }
    }

    console.log(`🎉 Correção de nomes concluída: ${fixed} chats corrigidos`);
    res.json({ 
      success: true, 
      message: `${fixed} nomes de chats foram corrigidos`,
      chatsWithBadNames: uniqueBadChats.length,
      fixed
    });

  } catch (error) {
    console.error('❌ Erro durante correção de nomes de chats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno durante correção de nomes de chats' 
    });
  }
});

// Listar flows ativos para seleção na conta WhatsApp
router.get('/whatsapp/:accountId/flows', async (req, res) => {
  const { accountId } = req.params;
  const { organization_id } = req.query;
  if (!organization_id) {
    return res.status(400).json({ success: false, error: 'organization_id is required' });
  }
  // Busca apenas flows ativos e do canal whatsapp
  const { data, error } = await supabase
    .from('fluxos')
    .select('id, nome, descricao, canal, ativo')
    .eq('organization_id', organization_id)
    .eq('ativo', true)
    .eq('canal', 'whatsapp');
  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
  res.json({ success: true, flows: data });
});

// Associar um flow à conta WhatsApp
router.post('/whatsapp/:accountId/assign-flow', async (req, res) => {
  const { accountId } = req.params;
  const { flow_id } = req.body;
  if (!flow_id) {
    return res.status(400).json({ success: false, error: 'flow_id is required' });
  }
  // Atualiza a conta WhatsApp para usar o flow selecionado
  const { data, error } = await supabase
    .from('whatsapp_accounts')
    .update({ flow_id })
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
  res.json({ success: true, account: data });
});

// Regenerar QR Code para uma conta específica
router.post('/whatsapp/:accountId/regenerate-qr', async (req, res) => {
  const { accountId } = req.params;
  
  console.log(`🔄 Regenerando QR Code para conta: ${accountId}`);
  
  try {
    // Buscar informações da conta
    const { data: account, error } = await supabase
      .from('whatsapp_accounts')
      .select('name')
      .eq('account_id', accountId)
      .single();
    
    if (error) {
      console.error('❌ Erro ao buscar conta:', error);
      return res.status(404).json({ 
        success: false, 
        error: 'Conta não encontrada' 
      });
    }
    
    // Forçar nova conexão com QR Code
    const result = await createWhatsAppConnection(accountId, account.name, true, { source: 'manual' });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'QR Code regenerado com sucesso' 
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ Erro ao regenerar QR Code:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno ao regenerar QR Code' 
    });
  }
});

// Atualizar conta WhatsApp (modo IA/Flow, assistant_id, flow_id)
router.patch('/whatsapp/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { mode, assistant_id, flow_id } = req.body;
  console.log('[PATCH /whatsapp/:accountId] accountId:', accountId, 'body:', req.body);
  const updateFields = {};
  if (mode) updateFields.mode = mode;
  if (assistant_id !== undefined) updateFields.assistant_id = assistant_id;
  if (flow_id !== undefined) updateFields.flow_id = flow_id;
  if (Object.keys(updateFields).length === 0) {
    console.log('[PATCH /whatsapp/:accountId] Nenhum campo para atualizar');
    return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
  }
  console.log('[PATCH /whatsapp/:accountId] updateFields:', updateFields);
  const { data, error } = await supabase
    .from('whatsapp_accounts')
    .update(updateFields)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) {
    console.log('[PATCH /whatsapp/:accountId] Erro do Supabase:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
  console.log('[PATCH /whatsapp/:accountId] Sucesso:', data);
  res.json({ success: true, account: data });
});

// ✅ NOVO: Rota para monitorar saúde das conexões
router.get('/health', async (req, res) => {
  try {
    console.log('🔍 [HEALTH] Verificando saúde das conexões para organização:', req.user.organization_id);
    
    // Buscar contas da organização
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [HEALTH] Erro ao buscar contas:', error);
      return res.status(500).json({ error: 'Erro ao buscar contas' });
    }

    // Combinar com status das conexões ativas e informações de saúde
    const connections = getAllConnectionsStatus();
    const accountsWithHealth = accounts?.map(account => {
      const connection = connections.find(conn => conn.accountId === account.account_id);
      const isReconnecting = connection?.status === 'connecting';
      const lastAttempt = connection?.lastAttempt || 0;
      const attemptCount = connection?.attemptCount || 0;
      
      return {
        ...account,
        status: connection?.status || account.status,
        phone_number: connection?.phoneNumber || account.phone_number,
        health: {
          isReconnecting,
          lastAttempt,
          attemptCount,
          canRetry: Date.now() - lastAttempt >= 10000, // 10 segundos
          nextRetryIn: Math.max(0, 10000 - (Date.now() - lastAttempt))
        }
      };
    }) || [];

    const connectedCount = accountsWithHealth.filter(conn => conn.status === 'connected').length;
    const reconnectingCount = accountsWithHealth.filter(conn => conn.health.isReconnecting).length;
    
    console.log(`✅ [HEALTH] ${accountsWithHealth.length} contas verificadas, ${connectedCount} conectadas, ${reconnectingCount} reconectando`);
    
    res.json({ 
      success: true, 
      accounts: accountsWithHealth,
      summary: {
        total: accountsWithHealth.length,
        connected: connectedCount,
        disconnected: accountsWithHealth.length - connectedCount,
        reconnecting: reconnectingCount,
        error: accountsWithHealth.filter(acc => acc.status === 'error').length
      }
    });
  } catch (error) {
    console.error('❌ [HEALTH] Erro geral ao verificar saúde:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ NOVO: Rota para forçar reconexão de uma conta específica
router.post('/:accountId/force-reconnect', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`🔄 [FORCE-RECONNECT] Forçando reconexão da conta ${accountId}`);
    
    // Verificar se a conta pertence à organização
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    // Importar função de reconexão
    const { createWhatsAppConnection } = await import('../services/multiWhatsapp.js');
    
    // Forçar reconexão
    await createWhatsAppConnection(accountId, account.name, false, { source: 'manual' });
    
    res.json({ 
      success: true, 
      message: `Reconexão forçada iniciada para ${account.name}` 
    });
  } catch (error) {
    console.error('❌ [FORCE-RECONNECT] Erro ao forçar reconexão:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ NOVO: Enviar convite para uma conta WhatsApp específica
router.post('/whatsapp/:accountId/send-invite', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const organizationId = req.user.organization_id;

    console.log(`📧 [API] Enviando convite para conta: ${accountId} da organização: ${organizationId}`);

    // 1. Buscar conta WhatsApp
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, user_id, organization_id')
      .eq('account_id', accountId)
      .eq('organization_id', organizationId)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ 
        success: false,
        error: 'Conta não encontrada ou você não tem permissão para acessá-la' 
      });
    }

    if (!account.user_id) {
      return res.status(400).json({ 
        success: false,
        error: 'Conta não possui usuário associado' 
      });
    }

    // 2. Buscar dados do usuário (email e nome)
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id, name, email, organization_id')
      .eq('id', account.user_id)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuário não encontrado' 
      });
    }

    // 3. Verificar se usuário pertence à organização correta
    if (userProfile.organization_id !== organizationId) {
      return res.status(403).json({ 
        success: false,
        error: 'Usuário não pertence à sua organização' 
      });
    }

    // 4. Verificar se já existe convite pendente
    const { data: existingInvite } = await supabaseAdmin
      .from('whatsapp_invites')
      .select('id, status, expires_at')
      .eq('user_id', account.user_id)
      .eq('status', 'pending')
      .single();

    let inviteId;
    let token;

    if (existingInvite && new Date() < new Date(existingInvite.expires_at)) {
      // Reutilizar convite existente
      inviteId = existingInvite.id;
      const { data: inviteData } = await supabaseAdmin
        .from('whatsapp_invites')
        .select('token')
        .eq('id', inviteId)
        .single();
      token = inviteData?.token;
      
      console.log(`📧 [API] Reutilizando convite existente: ${inviteId}`);
    } else {
      // Criar novo convite
      token = crypto.randomBytes(32).toString('hex');
      
      // Buscar role do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('name')
        .eq('user_id', account.user_id)
        .single();

      const { data: newInvite, error: inviteError } = await supabaseAdmin
        .from('whatsapp_invites')
        .insert({
          user_id: account.user_id,
          organization_id: organizationId,
          token: token,
          email: userProfile.email,
          name: userProfile.name,
          user_role: userRole?.name || 'user',
          permissions: {},
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
        })
        .select('id')
        .single();

      if (inviteError || !newInvite) {
        console.error('❌ [API] Erro ao criar convite:', inviteError);
        return res.status(500).json({ 
          success: false,
          error: 'Erro ao criar convite' 
        });
      }

      inviteId = newInvite.id;
      console.log(`📧 [API] Novo convite criado: ${inviteId}`);
    }

    // 5. Buscar nome da organização
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    const organizationName = org?.name || 'Sua Organização';

    // 6. Enviar email
    const emailResult = await sendWhatsAppInvite(
      userProfile.email,
      userProfile.name,
      token,
      organizationName
    );

    if (emailResult.success) {
      console.log(`✅ [API] Convite enviado com sucesso para: ${userProfile.email}`);
      return res.json({ 
        success: true, 
        message: 'Convite enviado com sucesso!',
        inviteId: inviteId,
        account: {
          account_id: account.account_id,
          name: account.name
        },
        user: {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email
        }
      });
    } else {
      console.error('❌ [API] Erro ao enviar email:', emailResult.error);
      return res.status(500).json({ 
        success: false,
        error: 'Erro ao enviar email: ' + emailResult.error 
      });
    }

  } catch (error) {
    console.error('❌ [API] Erro ao enviar convite:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor' 
    });
  }
});

export default router;
