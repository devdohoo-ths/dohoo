import express from 'express';
import {
  supabase
} from '../lib/supabaseClient.js';
import {
  validateReconnectToken,
  markReconnectTokenUsed
} from '../services/whatsappReconnectService.js';
import { createWhatsAppConnection } from '../services/multiWhatsapp.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const { data: accounts, error: accountsError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id')
      .eq('organization_id', req.user.organization_id);

    if (accountsError) {
      console.error('❌ [WhatsAppReconnect] Erro ao buscar contas da organização:', accountsError);
      return res.status(500).json({ success: false, error: 'Erro ao buscar contas da organização' });
    }

    const accountIds = (accounts || []).map((acc) => acc.account_id);

    if (accountIds.length === 0) {
      return res.json({ success: true, tokens: [] });
    }

    const { data: tokens, error: tokensError } = await supabase
      .from('whatsapp_reconnect_tokens')
      .select('account_id, created_at, expires_at')
      .in('account_id', accountIds)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString());

    if (tokensError) {
      console.error('❌ [WhatsAppReconnect] Erro ao buscar tokens pendentes:', tokensError);
      return res.status(500).json({ success: false, error: 'Erro ao buscar tokens pendentes' });
    }

    res.json({ success: true, tokens: tokens || [] });
  } catch (error) {
    console.error('❌ [WhatsAppReconnect] Falha ao carregar tokens pendentes:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao buscar tokens pendentes' });
  }
});

router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const { account, user, tokenRecord } = await validateReconnectToken(token);

    res.json({
      success: true,
      token: tokenRecord.id,
      account: {
        id: account.account_id,
        name: account.name,
        organization_id: account.organization_id
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      expires_at: tokenRecord.expires_at
    });
  } catch (error) {
    console.error('❌ [WhatsAppReconnect] Falha ao validar token:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:token/regenerate', async (req, res) => {
  const { token } = req.params;

  try {
    const { account, tokenRecord } = await validateReconnectToken(token);

    console.log(`📧 [WhatsAppReconnect] Regenerando QR Code via token para conta ${account.account_id} (${account.name})`);
    console.log(`📧 [WhatsAppReconnect] A API será detectada automaticamente baseada nas configurações da organização`);

    const result = await createWhatsAppConnection(account.account_id, account.name, true, {
      source: 'email',
      trigger: 'reconnect-token'
    });

    if (!result?.success) {
      throw new Error(result?.error || 'Falha ao iniciar reconexão');
    }

    await markReconnectTokenUsed(tokenRecord.id);

    res.json({
      success: true,
      message: 'Processo de reconexão iniciado. Escaneie o novo QR Code.',
      account: {
        id: account.account_id,
        name: account.name,
        organization_id: account.organization_id
      }
    });
  } catch (error) {
    console.error('❌ [WhatsAppReconnect] Falha ao regenerar QR Code:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;

