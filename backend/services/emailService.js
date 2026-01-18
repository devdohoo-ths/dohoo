import nodemailer from 'nodemailer';
import { supabase, supabaseAdmin } from '../lib/supabaseClient.js';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do transporter de email com variáveis de ambiente genéricas
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST,
  port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10), // Converte a porta para número
  secure: (process.env.SMTP_SECURE || process.env.EMAIL_SECURE) === 'true', // true para 465, false para outras portas
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

const minutesToMs = (minutes) => minutes * 60 * 1000;

// Função genérica para enviar emails
export const sendEmail = async (to, subject, htmlContent) => {
  try {
    // Verificar se as configurações de email estão disponíveis
    const hasHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
    const hasUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const hasPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    
    if (!hasHost || !hasUser || !hasPass) {
      console.warn('⚠️ Configurações de email não encontradas. Email não será enviado.');
      console.warn('📝 Configure SMTP_HOST/EMAIL_HOST, SMTP_USER/EMAIL_USER e SMTP_PASS/EMAIL_PASS no .env');
      return { success: false, error: 'Configurações de email não encontradas' };
    }

    const mailOptions = {
      from: process.env.SMTP_USER || process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado com sucesso para ${to}:`, info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erro ao enviar email para ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// Template do email de convite
const createInviteEmailTemplate = (userName, inviteLink, organizationName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Convite para Dohoo</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .highlight { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Bem-vindo ao Dohoo!</h1>
          <p>Você foi convidado para se juntar à equipe</p>
        </div>
        
        <div class="content">
          <h2>Olá ${userName}!</h2>
          
          <p>Você foi convidado para fazer parte da equipe <strong>${organizationName}</strong> na plataforma Dohoo.</p>
          
          <div class="highlight">
            <h3>📱 Próximos Passos:</h3>
            <ol>
              <li><strong>Faça login</strong> na plataforma com suas credenciais</li>
              <li><strong>Conecte seu WhatsApp</strong> para começar a usar</li>
              <li><strong>Configure suas permissões</strong> conforme necessário</li>
            </ol>
          </div>
          
          <p>Para começar, clique no botão abaixo para conectar seu WhatsApp:</p>
          
          <div style="text-align: center;">
            <a href="${inviteLink}" class="button">
              🔗 Conectar WhatsApp
            </a>
          </div>
          
          <p><strong>Importante:</strong> Este link é único e seguro. Não compartilhe com outras pessoas.</p>
          
          <p>Se você tiver alguma dúvida, entre em contato com o administrador da sua organização.</p>
        </div>
        
        <div class="footer">
          <p>Este é um email automático do sistema Dohoo. Não responda a este email.</p>
          <p>© 2024 Dohoo. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Função para enviar convite por email
export const sendWhatsAppInvite = async (userEmail, userName, inviteToken, organizationName) => {
  try {
    // Detectar se estamos em desenvolvimento
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.FRONTEND_URL;
    console.log("isDevelopment", isDevelopment);
    let inviteLink;
    let additionalInstructions = '';
    
    if (isDevelopment) {
      // Em desenvolvimento, usar localhost com instruções
      inviteLink = `http://localhost:8080/connect-whatsapp/${inviteToken}`;
      additionalInstructions = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Importante para Desenvolvimento:</h4>
          <p style="margin: 0; color: #856404; font-size: 14px;">
            Este link aponta para localhost. Para testar, você precisa:
            <br>1. Ter o servidor frontend rodando em localhost:8080
            <br>2. Copiar e colar este link no navegador: <strong>${inviteLink}</strong>
          </p>
        </div>
      `;
    } else {
      // Em produção, usar a URL configurada
      inviteLink = `${process.env.FRONTEND_URL}/connect-whatsapp/${inviteToken}`;
    }
    
    const mailOptions = {
      from: `"Dohoo" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`, // Remetente amigável
      to: userEmail,
      subject: `🚀 Convite para Dohoo - ${organizationName}`,
      html: createInviteEmailTemplate(userName, inviteLink, organizationName) + additionalInstructions
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de convite enviado com sucesso:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Erro ao enviar email de convite:', error);
    return { success: false, error: error.message };
  }
};

// Função para reenviar convite
export const resendWhatsAppInvite = async (inviteId) => {
  try {
    // Buscar dados do convite no banco
    // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (função pode ser chamada sem contexto de usuário)
    const { data: invite, error } = await supabaseAdmin
      .from('whatsapp_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (error || !invite) {
      throw new Error('Convite não encontrado');
    }

    // Verificar se o convite não expirou
    if (new Date() > new Date(invite.expires_at)) {
      throw new Error('Convite expirado');
    }

    // Buscar nome da organização
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', invite.organization_id)
      .single();

    const organizationName = org?.name || 'Sua Organização';

    // Reenviar email
    return await sendWhatsAppInvite(
      invite.email,
      invite.name,
      invite.token,
      organizationName
    );
  } catch (error) {
    console.error('❌ Erro ao reenviar convite:', error);
    return { success: false, error: error.message };
  }
};

// Verificar configuração de email
export const checkEmailConfig = () => {
  const hasConfig = (process.env.SMTP_HOST || process.env.EMAIL_HOST) && 
                   (process.env.SMTP_PORT || process.env.EMAIL_PORT) && 
                   (process.env.SMTP_USER || process.env.EMAIL_USER) && 
                   (process.env.SMTP_PASS || process.env.EMAIL_PASS);
  if (!hasConfig) {
    console.warn('⚠️ Configuração de email SMTP não encontrada. Verifique as variáveis de ambiente no .env');
  }
  return hasConfig;
};

// Template do email de notificação de desconexão (visual amigável)
const createDisconnectNotificationTemplate = (user, account, conversations) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatConversations = (conversations) => {
    if (!conversations || conversations.length === 0) {
      return '<p><em>Nenhuma conversa encontrada.</em></p>';
    }

    return conversations.map((conv, index) => {
      const messagesHtml = conv.messages.map(msg => `
        <div style="margin: 8px 0; padding: 10px; background: ${msg.is_from_me ? '#e6f7ff' : '#f4f4f4'}; border-radius: 8px;">
          <div style="font-weight: 500; color: #555; font-size: 13px;">
            ${msg.is_from_me ? '👤 Agente' : '📱 Cliente'} - ${formatDate(msg.created_at)}
          </div>
          <div style="margin-top: 4px; color: #222;">
            ${msg.content || '[Mídia]'}
          </div>
        </div>
      `).join('');

      return `
        <div style="margin: 20px 0; padding: 18px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fafbfc;">
          <h4 style="margin: 0 0 10px 0; color: #3a3a3a; font-size: 16px;">
            📞 Conversa ${index + 1}: ${conv.chatName || 'Cliente'}
          </h4>
          <div style="font-size: 12px; color: #888; margin-bottom: 10px;">
            Última atividade: ${formatDate(conv.lastMessageAt)}
          </div>
          <div style="max-height: 200px; overflow-y: auto;">
            ${messagesHtml}
          </div>
        </div>
      `;
    }).join('');
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Alerta de Desconexão WhatsApp</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f6f8fa; color: #222; }
        .container { max-width: 700px; margin: 0 auto; padding: 24px; background: #fff; border-radius: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .header { background: #f0f4f8; color: #2d3a4a; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px 0 0 0; border-radius: 0 0 10px 10px; }
        .alert { background: #e6f7ff; border: 1px solid #b3e5fc; padding: 16px; border-radius: 8px; margin: 20px 0; color: #31708f; }
        .user-info { background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #ececec; }
        .footer { text-align: center; margin-top: 32px; color: #888; font-size: 13px; }
        .conversation-container { margin: 20px 0; }
        h1, h2, h3, h4 { font-family: 'Segoe UI', Arial, sans-serif; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 2rem;">Notificação de Desconexão WhatsApp</h1>
          <p style="margin: 8px 0 0 0; font-size: 1.1rem; color: #4a4a4a;">Um usuário desconectou manualmente sua conta</p>
        </div>
        
        <div class="content">
          <div class="alert">
            <h3 style="margin: 0 0 8px 0; color: #31708f; font-size: 1.1rem;">Atenção!</h3>
            <p style="margin: 0; color: #31708f; font-size: 1rem;">
              Um usuário da sua organização desconectou manualmente sua conta WhatsApp.<br>
              Esta ação foi realizada pelo próprio usuário através do aplicativo WhatsApp.
            </p>
          </div>

          <h2 style="font-size: 1.2rem; color: #2d3a4a; margin-top: 32px;">👤 Informações do Usuário</h2>
          <div class="user-info">
            <p><strong>Nome:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Conta WhatsApp:</strong> ${account.name}</p>
            <p><strong>Data/Hora da Desconexão:</strong> ${formatDate(new Date())}</p>
          </div>

          <h2 style="font-size: 1.2rem; color: #2d3a4a; margin-top: 32px;">Últimas Conversas</h2>
          <p style="color: #555;">Abaixo estão as últimas 3 conversas que este usuário teve antes da desconexão:</p>
          
          <div class="conversation-container">
            ${formatConversations(conversations)}
          </div>

          <div class="alert" style="background: #fffbe6; border: 1px solid #ffe58f; color: #8a6d3b;">
            <h4 style="margin: 0 0 10px 0; color: #8a6d3b;">📋 Ações Recomendadas:</h4>
            <ul style="margin: 0; color: #8a6d3b;">
              <li>Verificar se a desconexão foi intencional</li>
              <li>Contatar o usuário para entender o motivo</li>
              <li>Verificar se há conversas pendentes que precisam de atenção</li>
              <li>Orientar o usuário sobre como reconectar a conta se necessário</li>
            </ul>
          </div>

          <p style="color: #888; font-size: 0.97rem; margin-top: 24px;"><strong>Importante:</strong> Esta notificação é enviada apenas quando a desconexão é realizada manualmente pelo usuário no aplicativo WhatsApp. Desconexões automáticas (como problemas de rede) não geram este alerta.</p>
        </div>
        
        <div class="footer">
          <p>Este é um email automático do sistema Dohoo. Não responda a este email.</p>
          <p>© 2024 Dohoo. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Função para enviar notificação de desconexão
export const sendDisconnectNotificationEmail = async (managerEmail, user, account, conversations) => {
  try {
    console.log(`📧 Enviando notificação de desconexão para: ${managerEmail}`);
    
    const mailOptions = {
      from: `"Dohoo - Sistema de Alertas" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
      to: managerEmail,
      subject: `⚠️ Alerta: ${user.name} desconectou WhatsApp - ${account.name}`,
      html: createDisconnectNotificationTemplate(user, account, conversations)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de notificação de desconexão enviado com sucesso:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Erro ao enviar email de notificação de desconexão:', error);
    return { success: false, error: error.message };
  }
}; 

const createReconnectEmailTemplate = ({ userName, accountName, organizationName, reconnectLink, expiresAt }) => {
  const formattedExpiration = new Date(expiresAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Novo pareamento necessário</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f9ff; color: #1f2933; margin: 0; padding: 0; }
        .container { max-width: 620px; margin: 0 auto; padding: 32px 24px; }
        .card { background: #ffffff; border-radius: 18px; box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08); overflow: hidden; }
        .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; padding: 36px 40px; }
        .header h1 { margin: 0; font-size: 26px; }
        .content { padding: 36px 40px; }
        .highlight { background: #f0f7ff; border-radius: 12px; padding: 18px 20px; margin: 24px 0; border: 1px solid #cbd5f5; }
        .button { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 9999px; font-weight: 600; margin: 28px 0; }
        .footer { padding: 28px 40px; background: #f8fafc; color: #64748b; font-size: 13px; text-align: center; }
        .details { margin: 24px 0; }
        .details p { margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>👋 Olá ${userName.split(' ')[0] || 'agente'},</h1>
            <p style="margin-top: 12px; opacity: 0.9;">
              Precisamos que você faça um novo pareamento da sua conta WhatsApp <strong>${accountName}</strong>.
            </p>
          </div>
          <div class="content">
            <p>
              Durante a última tentativa automática de reconexão da sua conta no Dohoo, detectamos que o WhatsApp solicitou um novo QR Code.
            </p>
            <div class="highlight">
              <p style="margin: 0; font-weight: 600;">O que fazer agora?</p>
              <ul style="margin: 12px 0 0 20px; padding: 0;">
                <li>Acesse o botão abaixo;</li>
                <li>O sistema vai gerar um novo QR Code;</li>
                <li>Escaneie o QR Code com o WhatsApp do seu celular.</li>
              </ul>
            </div>
            <div style="text-align: center;">
              <a href="${reconnectLink}" class="button">Gerar novo QR Code</a>
            </div>
            <div class="details">
              <p><strong>Organização:</strong> ${organizationName}</p>
              <p><strong>Conta:</strong> ${accountName}</p>
              <p><strong>Validade do link:</strong> ${formattedExpiration}</p>
            </div>
            <p style="margin-top: 18px; font-size: 14px; color: #475569;">
              Caso o link expire ou você não consiga escanear o código, solicite uma nova conexão pela tela de contas no Dohoo.
            </p>
          </div>
          <div class="footer">
            Este é um e-mail automático da plataforma Dohoo.<br />Se não foi você quem solicitou, ignore esta mensagem.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const sendWhatsAppReconnectEmail = async ({ to, userName, accountName, organizationName, token, expiresAt }) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl.replace(/\/$/, '')}/reconnect-whatsapp/${token}`;
    const expirationIso = expiresAt || new Date(Date.now() + minutesToMs(parseInt(process.env.WHATSAPP_RECONNECT_TOKEN_TTL || '1440', 10))).toISOString();

    const mailOptions = {
      from: `"Dohoo" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
      to,
      subject: `🔄 Novo pareamento necessário - ${accountName}`,
      html: createReconnectEmailTemplate({
        userName,
        accountName,
        organizationName,
        reconnectLink: link,
        expiresAt: expirationIso
      })
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de reconexão enviado com sucesso:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Erro ao enviar email de reconexão:', error);
    return { success: false, error: error.message };
  }
};