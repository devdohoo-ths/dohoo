import express from 'express';
import { supabase, supabaseAdmin } from '../lib/supabaseClient.js';
import { sendWhatsAppInvite, resendWhatsAppInvite, checkEmailConfig } from '../services/emailService.js';
import crypto from 'crypto';

const router = express.Router();

// Criar convite para usuário
router.post('/whatsapp', async (req, res) => {
  const { userId, email, name, user_role, permissions, organization_id } = req.body;

  if (!userId || !email || !name || !user_role || !organization_id) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  console.log('📧 [Invites] Criando convite WhatsApp:', { userId, email, name, user_role, organization_id });

  try {
    // Verificar se já existe um convite pendente para este usuário
    // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (rota pode não ter autenticação)
    const { data: existingInvite } = await supabaseAdmin
      .from('whatsapp_invites')
      .select('id, status, expires_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      // Se o convite ainda não expirou, reenviar
      if (new Date() < new Date(existingInvite.expires_at)) {
        const result = await resendWhatsAppInvite(existingInvite.id);
        if (result.success) {
          return res.json({ 
            success: true, 
            message: 'Convite reenviado com sucesso',
            inviteId: existingInvite.id 
          });
        } else {
          return res.status(500).json({ error: result.error });
        }
      }
    }

    // Gerar token único
    const token = crypto.randomBytes(32).toString('hex');
    
    // Criar novo convite
    // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (política requer auth.uid() que não está disponível no backend)
    const { data: invite, error } = await supabaseAdmin
      .from('whatsapp_invites')
      .insert({
        user_id: userId,
        organization_id,
        token,
        email,
        name,
        user_role,
        permissions: permissions || {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar convite:', error);
      return res.status(500).json({ error: 'Erro ao criar convite' });
    }

    // Buscar nome da organização
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    const organizationName = org?.name || 'Sua Organização';

    // Enviar email
    const emailResult = await sendWhatsAppInvite(email, name, token, organizationName);
    
    if (emailResult.success) {
      res.json({ 
        success: true, 
        message: 'Convite enviado com sucesso',
        inviteId: invite.id 
      });
    } else {
      // Se o email falhou, deletar o convite
      // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS
      await supabaseAdmin
        .from('whatsapp_invites')
        .delete()
        .eq('id', invite.id);
      
      res.status(500).json({ error: 'Erro ao enviar email: ' + emailResult.error });
    }

  } catch (error) {
    console.error('Erro ao criar convite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar convites da organização
router.get('/whatsapp', async (req, res) => {
  const { organization_id } = req.query;

  if (!organization_id) {
    return res.status(400).json({ error: 'ID da organização é obrigatório' });
  }

  try {
    const { data: invites, error } = await supabase
      .from('whatsapp_invites')
      .select(`
        id,
        user_id,
        email,
        name,
        user_role,
        permissions,
        status,
        expires_at,
        created_at,
        updated_at
      `)
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites:', error);
      return res.status(500).json({ error: 'Erro ao buscar convites' });
    }

    res.json({ success: true, invites: invites || [] });

  } catch (error) {
    console.error('Erro ao listar convites:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Reenviar convite
router.post('/whatsapp/:inviteId/resend', async (req, res) => {
  const { inviteId } = req.params;

  try {
    const result = await resendWhatsAppInvite(inviteId);
    
    if (result.success) {
      res.json({ success: true, message: 'Convite reenviado com sucesso' });
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('Erro ao reenviar convite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Validar token de convite
router.get('/whatsapp/validate/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (rota pública, sem autenticação)
    const { data: invite, error } = await supabaseAdmin
      .from('whatsapp_invites')
      .select(`
        id,
        user_id,
        email,
        name,
        user_role,
        permissions,
        status,
        expires_at,
        organization_id
      `)
      .eq('token', token)
      .single();

    if (error || !invite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    // Verificar se expirou
    if (new Date() > new Date(invite.expires_at)) {
      return res.status(400).json({ error: 'Convite expirado' });
    }

    // Verificar se já foi aceito
    if (invite.status === 'accepted') {
      return res.status(400).json({ error: 'Convite já foi utilizado' });
    }

    res.json({ 
      success: true, 
      invite: {
        id: invite.id,
        user_id: invite.user_id,
        email: invite.email,
        name: invite.name,
        user_role: invite.user_role,
        permissions: invite.permissions,
        organization_id: invite.organization_id
      }
    });

  } catch (error) {
    console.error('Erro ao validar token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Marcar convite como aceito
router.post('/whatsapp/:token/accept', async (req, res) => {
  const { token } = req.params;

  try {
    // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (política requer auth.uid() que pode não estar disponível)
    const { data: invite, error } = await supabaseAdmin
      .from('whatsapp_invites')
      .update({ status: 'accepted' })
      .eq('token', token)
      .select()
      .single();

    if (error || !invite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    res.json({ success: true, message: 'Convite aceito com sucesso' });

  } catch (error) {
    console.error('Erro ao aceitar convite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificar configuração de email
router.get('/email-config', (req, res) => {
  const hasConfig = checkEmailConfig();
  res.json({ 
    success: true, 
    emailConfigured: hasConfig 
  });
});

export default router; 