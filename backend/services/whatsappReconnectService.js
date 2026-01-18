import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient.js';
import { sendWhatsAppReconnectEmail } from './emailService.js';

const TOKEN_TTL_MINUTES = parseInt(process.env.WHATSAPP_RECONNECT_TOKEN_TTL || '1440', 10); // 24h padrão
const EMAIL_COOLDOWN_MINUTES = parseInt(process.env.WHATSAPP_RECONNECT_EMAIL_COOLDOWN || '120', 10); // 2h padrão

const minutesToMs = (minutes) => minutes * 60 * 1000;

// ✅ CORREÇÃO: Cache em memória para rastrear último envio de email por conta
const lastEmailSentCache = new Map(); // accountId -> timestamp

const getActiveTokenForAccount = async (accountId) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('whatsapp_reconnect_tokens')
    .select('*')
    .eq('account_id', accountId)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error(`❌ [ReconnectToken] Erro ao buscar token ativo (${accountId}):`, error);
    throw new Error('Erro ao consultar tokens de reconexão');
  }

  return data || null;
};

const createReconnectToken = async (accountId, userId) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + minutesToMs(TOKEN_TTL_MINUTES)).toISOString();

  const { data, error } = await supabase
    .from('whatsapp_reconnect_tokens')
    .insert({
      account_id: accountId,
      user_id: userId,
      token,
      expires_at: expiresAt
    })
    .select()
    .single();

  if (error) {
    console.error(`❌ [ReconnectToken] Erro ao criar token (${accountId}):`, error);
    throw new Error('Erro ao criar token de reconexão');
  }

  return data;
};

export const ensureReconnectEmailDispatched = async (accountId, accountName) => {
  try {
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, user_id, organization_id')
      .eq('account_id', accountId)
      .single();

    if (accountError || !account) {
      console.error(`❌ [ReconnectEmail] Conta não encontrada para ${accountId}:`, accountError);
      return;
    }

    if (!account.user_id) {
      console.warn(`⚠️ [ReconnectEmail] Conta ${accountId} não possui user_id associado, e-mail não será enviado.`);
      return;
    }

    // ✅ CORREÇÃO: Verificar se email já foi enviado (sem cooldown - apenas uma vez até conexão ser estabelecida)
    if (lastEmailSentCache.has(accountId)) {
      console.log(`ℹ️ [ReconnectEmail] E-mail já foi enviado para ${accountId}. Não será reenviado até que a conexão seja estabelecida.`);
      return;
    }

    // ✅ Verificar se existe token ativo no banco (indica que email já foi enviado anteriormente)
    const activeToken = await getActiveTokenForAccount(accountId);
    if (activeToken) {
      console.log(`ℹ️ [ReconnectEmail] Token ativo encontrado para ${accountId}, e-mail já foi enviado anteriormente. Não será reenviado.`);
      // ✅ Marcar no cache para evitar verificações futuras
      lastEmailSentCache.set(accountId, Date.now());
      return;
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', account.user_id)
      .single();

    if (profileError || !userProfile) {
      console.error(`❌ [ReconnectEmail] Perfil não encontrado para usuário ${account.user_id}:`, profileError);
      return;
    }

    if (!userProfile.email) {
      console.warn(`⚠️ [ReconnectEmail] Usuário ${userProfile.id} não possui e-mail cadastrado, e-mail não será enviado.`);
      return;
    }

    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', account.organization_id)
      .single();

    if (orgError) {
      console.error(`❌ [ReconnectEmail] Erro ao buscar organização ${account.organization_id}:`, orgError);
    }

    const tokenRecord = activeToken || await createReconnectToken(accountId, account.user_id);
    const organizationName = organization?.name || 'Sua Organização';

    const emailResult = await sendWhatsAppReconnectEmail({
      to: userProfile.email,
      userName: userProfile.name || 'Usuário',
      accountName: accountName || account.name,
      organizationName,
      token: tokenRecord.token,
      expiresAt: tokenRecord.expires_at
    });

    if (emailResult.success) {
      // ✅ CORREÇÃO: Atualizar cache com timestamp do envio
      lastEmailSentCache.set(accountId, Date.now());
      console.log(`✅ [ReconnectEmail] E-mail de reconexão enviado para ${userProfile.email} (conta ${accountId})`);
    } else {
      console.error(`❌ [ReconnectEmail] Falha ao enviar e-mail para ${userProfile.email}:`, emailResult.error);
    }
  } catch (error) {
    console.error(`❌ [ReconnectEmail] Erro inesperado ao processar reconexão para ${accountId}:`, error);
  }
};

export const validateReconnectToken = async (token) => {
  const { data, error } = await supabase
    .from('whatsapp_reconnect_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) {
    throw new Error('Token inválido ou inexistente');
  }

  if (data.used_at) {
    throw new Error('Token já utilizado');
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error('Token expirado');
  }

  const { data: account, error: accountError } = await supabase
    .from('whatsapp_accounts')
    .select('account_id, name, organization_id, user_id')
    .eq('account_id', data.account_id)
    .single();

  if (accountError || !account) {
    throw new Error('Conta associada ao token não foi encontrada');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', data.user_id)
    .single();

  if (profileError || !profile) {
    throw new Error('Usuário associado ao token não foi encontrado');
  }

  return {
    tokenRecord: data,
    account,
    user: profile
  };
};

export const markReconnectTokenUsed = async (tokenId) => {
  const { error } = await supabase
    .from('whatsapp_reconnect_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId);

  if (error) {
    console.error(`❌ [ReconnectToken] Erro ao marcar token ${tokenId} como utilizado:`, error);
    throw new Error('Não foi possível atualizar o token de reconexão');
  }
};

// ✅ CORREÇÃO: Função para limpar cache de email quando conexão for estabelecida
export const clearReconnectEmailCache = (accountId) => {
  if (lastEmailSentCache.has(accountId)) {
    lastEmailSentCache.delete(accountId);
    console.log(`🧹 [ReconnectEmail] Cache de email limpo para ${accountId}`);
  }
};

