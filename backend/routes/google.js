import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { supabase } from '../lib/supabaseClient.js';
import { 
  getOAuthClient, 
  createOrUpdateGoogleIntegration, 
  saveGoogleTokens,
  generateAuthUrl,
  exchangeCodeForTokens,
  saveTokens,
  disconnectIntegration
} from '../services/google/googleAuthService.js';
import {
  createEvent,
  checkAvailability,
  suggestAvailableSlots,
  rescheduleEvent,
  listEvents,
  cancelEvent,
  listStoredEvents,
  getEventByGoogleId
} from '../services/google/calendarService.js';
import {
  listFiles,
  uploadLocalFile,
  deleteFile,
  downloadFile,
  listStoredFiles,
  createFolderForOrganization
} from '../services/google/googleDriveService.js';
import { google } from 'googleapis';

const router = express.Router();

// Rota de teste para verificar se as rotas estão funcionando (sem autenticação)
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Rotas do Google funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rota de teste específica para callback
router.get('/callback-test', (req, res) => {
  console.log('🔍 Rota de teste /callback-test acessada:', req.query);
  res.json({ 
    success: true, 
    message: 'Rota /callback-test funcionando!',
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

// Rota de teste para criar um evento de exemplo (com autenticação)
router.post('/test/create-event', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.body;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    // Criar um evento de teste para amanhã
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const endTime = new Date(tomorrow);
    endTime.setHours(11, 0, 0, 0);

    const eventData = {
      summary: 'Evento de Teste - Google Integration',
      description: 'Este é um evento de teste para verificar se a integração com Google Calendar está funcionando.',
      start: {
        dateTime: tomorrow.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
    };

    const event = await createEvent(userId, organizationId, '+5511999999999', eventData);

    res.json({
      success: true,
      message: 'Evento de teste criado com sucesso',
      event
    });

  } catch (error) {
    console.error('❌ Erro ao criar evento de teste:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ROTAS DE CALLBACK OAUTH (SEM AUTENTICAÇÃO) =====

// Callback OAuth (versão simplificada)
router.get('/callback', async (req, res) => {
  try {
    console.log('🔄 Callback OAuth recebido:', req.query);
    const { code, state } = req.query;
    
    if (!code || !state) {
      console.log('❌ Parâmetros inválidos no callback:', { code: !!code, state: !!state });
      return res.status(400).json({
        success: false,
        error: 'Código de autorização e state são obrigatórios'
      });
    }

    console.log('📋 State decodificado:', state);
    const { organizationId, serviceType } = JSON.parse(state);
    console.log('📋 Parâmetros extraídos:', { organizationId, serviceType });
    
    // Troca código por tokens
    console.log('🔄 Trocando código por tokens...');
    const tokens = await exchangeCodeForTokens(code, organizationId);
    console.log('✅ Tokens obtidos:', { 
      hasAccessToken: !!tokens.access_token, 
      hasRefreshToken: !!tokens.refresh_token,
      hasExpiryDate: !!tokens.expiry_date 
    });
    
    // Busca a integração para obter o user_id
    console.log('🔍 Buscando integração no banco...');
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .single();
    
    if (integrationError) {
      console.log('❌ Erro ao buscar integração:', integrationError);
      throw integrationError;
    }
    
    console.log('✅ Integração encontrada:', integration);
    
    // Salva tokens no banco (versão simplificada)
    console.log('💾 Salvando tokens no banco...');
    await saveTokens(organizationId, serviceType, tokens, integration?.user_id);
    console.log('✅ Tokens salvos com sucesso!');

    // Página de sucesso
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conectado com Sucesso!</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          .success-icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          h1 { margin-bottom: 10px; }
          p { margin-bottom: 30px; opacity: 0.9; }
          .close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
          }
          .close-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Conectado com Sucesso!</h1>
          <p>Sua conta Google foi conectada com sucesso ao sistema.</p>
          <p>Você pode fechar esta janela e voltar ao sistema.</p>
          <button class="close-btn" onclick="window.close()">Fechar Janela</button>
        </div>
        <script>
          // Notifica a janela pai sobre o sucesso
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_CONNECTED', service: '${serviceType}' }, '*');
          }
          // Fecha automaticamente após 3 segundos
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Erro no callback OAuth:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro na Conexão</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          .error-icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          h1 { margin-bottom: 10px; }
          p { margin-bottom: 30px; opacity: 0.9; }
          .close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
          }
          .close-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Erro na Conexão</h1>
          <p>Ocorreu um erro ao conectar sua conta Google.</p>
          <p>Tente novamente ou entre em contato com o suporte.</p>
          <button class="close-btn" onclick="window.close()">Fechar Janela</button>
        </div>
        <script>
          // Notifica a janela pai sobre o erro
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_ERROR', error: '${error.message}' }, '*');
          }
          // Fecha automaticamente após 5 segundos
          setTimeout(() => window.close(), 5000);
        </script>
      </body>
      </html>
    `);
  }
});

// Callback OAuth alternativo para compatibilidade com Google Console
router.get('/auth/google/callback', async (req, res) => {
  try {
    console.log('🔄 Callback OAuth alternativo recebido:', req.query);
    const { code, state } = req.query;
    
    if (!code || !state) {
      console.log('❌ Parâmetros inválidos no callback alternativo:', { code: !!code, state: !!state });
      return res.status(400).json({
        success: false,
        error: 'Código de autorização e state são obrigatórios'
      });
    }

    console.log('📋 State decodificado:', state);
    const { organizationId, serviceType } = JSON.parse(state);
    console.log('📋 Parâmetros extraídos:', { organizationId, serviceType });
    
    // Troca código por tokens
    console.log('🔄 Trocando código por tokens...');
    const tokens = await exchangeCodeForTokens(code, organizationId);
    console.log('✅ Tokens obtidos:', { 
      hasAccessToken: !!tokens.access_token, 
      hasRefreshToken: !!tokens.refresh_token,
      hasExpiryDate: !!tokens.expiry_date 
    });
    
    // Busca a integração para obter o user_id
    console.log('🔍 Buscando integração no banco...');
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .single();
    
    if (integrationError) {
      console.log('❌ Erro ao buscar integração:', integrationError);
      throw integrationError;
    }
    
    console.log('✅ Integração encontrada:', integration);
    
    // Salva tokens no banco (versão simplificada)
    console.log('💾 Salvando tokens no banco...');
    await saveTokens(organizationId, serviceType, tokens, integration?.user_id);
    console.log('✅ Tokens salvos com sucesso!');

    // Página de sucesso
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conectado com Sucesso!</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          .success-icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          h1 { margin-bottom: 10px; }
          p { margin-bottom: 30px; opacity: 0.9; }
          .close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
          }
          .close-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Conectado com Sucesso!</h1>
          <p>Sua conta Google foi conectada com sucesso ao sistema.</p>
          <p>Você pode fechar esta janela e voltar ao sistema.</p>
          <button class="close-btn" onclick="window.close()">Fechar Janela</button>
        </div>
        <script>
          // Notifica a janela pai sobre o sucesso
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_CONNECTED', service: '${serviceType}' }, '*');
          }
          // Fecha automaticamente após 3 segundos
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Erro no callback OAuth alternativo:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro na Conexão</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          .error-icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          h1 { margin-bottom: 10px; }
          p { margin-bottom: 30px; opacity: 0.9; }
          .close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
          }
          .close-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Erro na Conexão</h1>
          <p>Ocorreu um erro ao conectar sua conta Google.</p>
          <p>Tente novamente ou entre em contato com o suporte.</p>
          <button class="close-btn" onclick="window.close()">Fechar Janela</button>
        </div>
        <script>
          // Notifica a janela pai sobre o erro
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_ERROR', error: '${error.message}' }, '*');
          }
          // Fecha automaticamente após 5 segundos
          setTimeout(() => window.close(), 5000);
        </script>
      </body>
      </html>
    `);
  }
});

// Middleware de autenticação para todas as outras rotas
router.use(authenticateToken);

// ===== ROTAS DE AUTENTICAÇÃO GOOGLE =====

// Listar integrações do Google
router.get('/integrations', async (req, res) => {
  try {
    const { organizationId } = req.query;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    const { data: integrations, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      integrations: integrations || []
    });

  } catch (error) {
    console.error('❌ Erro ao listar integrações:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota de teste para verificar se a rota está funcionando
router.get('/integrations-test', async (req, res) => {
  res.json({
    success: true,
    message: 'Rota /integrations está funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Configurar integração Google
router.post('/setup', async (req, res) => {
  try {
    const { organizationId, serviceType, clientId, clientSecret, redirectUri, scope } = req.body;
    const userId = req.user.id;

    if (!organizationId || !serviceType) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, serviceType' });
    }

    // Se clientId e clientSecret não foram fornecidos, usa configurações do .env
    const integrationData = {
      client_id: clientId || process.env.GOOGLE_CLIENT_ID,
      client_secret: clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri || process.env.GOOGLE_REDIRECT_URI,
      scope: scope || []
    };

    // Valida se as configurações estão disponíveis
    if (!integrationData.client_id || !integrationData.client_secret) {
      return res.status(400).json({ 
        error: 'Configurações OAuth não encontradas. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env ou forneça clientId e clientSecret.' 
      });
    }

    const integration = await createOrUpdateGoogleIntegration(userId, organizationId, serviceType, integrationData);

    res.json({
      success: true,
      message: 'Integração Google configurada com sucesso',
      integration
    });

  } catch (error) {
    console.error('❌ Erro ao configurar integração Google:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gerar URL de autorização
router.post('/auth-url', async (req, res) => {
  try {
    const { organizationId, serviceType } = req.body;
    const userId = req.user.id;

    // Buscar configuração da integração
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .single();

    if (!integration) {
      return res.status(404).json({ error: 'Integração não encontrada' });
    }

    const authUrl = generateAuthUrl(serviceType, organizationId);

    res.json({
      success: true,
      authUrl
    });

  } catch (error) {
    console.error('❌ Erro ao gerar URL de autorização:', error);
    res.status(500).json({ error: error.message });
  }
});

// Callback OAuth - trocar código por tokens
router.post('/callback', async (req, res) => {
  try {
    const { organizationId, serviceType, code } = req.body;
    const userId = req.user.id;

    // Buscar configuração da integração
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .single();

    if (!integration) {
      return res.status(404).json({ error: 'Integração não encontrada' });
    }

    // Trocar código por tokens
    console.log('🔄 Trocando código por tokens...');
    const tokens = await exchangeCodeForTokens(code, organizationId);
    console.log('✅ Tokens obtidos:', { 
      hasAccessToken: !!tokens.access_token, 
      hasRefreshToken: !!tokens.refresh_token,
      hasExpiryDate: !!tokens.expiry_date 
    });

    // Salvar tokens no banco
    await saveGoogleTokens(userId, organizationId, serviceType, tokens);

    res.json({
      success: true,
      message: 'Autenticação Google concluída com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro no callback OAuth:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ROTAS DO GOOGLE CALENDAR =====

// Criar evento
router.post('/calendar/events', async (req, res) => {
  try {
    const { organizationId, clientPhoneNumber, eventData } = req.body;
    const userId = req.user.id;

    if (!organizationId || !eventData) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, eventData' });
    }

    const event = await createEvent(userId, organizationId, clientPhoneNumber, eventData);

    res.json({
      success: true,
      message: 'Evento criado com sucesso',
      event
    });

  } catch (error) {
    console.error('❌ Erro ao criar evento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar disponibilidade
router.post('/calendar/availability', async (req, res) => {
  try {
    const { organizationId, startDate, endDate } = req.body;
    const userId = req.user.id;

    if (!organizationId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, startDate, endDate' });
    }

    const isAvailable = await checkAvailability(userId, organizationId, startDate, endDate);

    res.json({
      success: true,
      isAvailable
    });

  } catch (error) {
    console.error('❌ Erro ao verificar disponibilidade:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sugerir horários disponíveis
router.post('/calendar/suggest-slots', async (req, res) => {
  try {
    const { organizationId, startDate } = req.body;
    const userId = req.user.id;

    if (!organizationId || !startDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, startDate' });
    }

    const suggestions = await suggestAvailableSlots(userId, organizationId, startDate);

    res.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('❌ Erro ao sugerir horários:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar eventos
router.get('/calendar/events', async (req, res) => {
  try {
    const { organizationId, startDate, endDate } = req.query;
    const userId = req.user.id;

    if (!organizationId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, startDate, endDate' });
    }

    const events = await listEvents(userId, organizationId, startDate, endDate);

    res.json({
      success: true,
      events
    });

  } catch (error) {
    console.error('❌ Erro ao listar eventos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reagendar evento
router.put('/calendar/events/:eventId/reschedule', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { organizationId, newStartDate, newEndDate } = req.body;
    const userId = req.user.id;

    if (!organizationId || !newStartDate || !newEndDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, newStartDate, newEndDate' });
    }

    const event = await rescheduleEvent(userId, organizationId, eventId, newStartDate, newEndDate);

    res.json({
      success: true,
      message: 'Evento reagendado com sucesso',
      event
    });

  } catch (error) {
    console.error('❌ Erro ao reagendar evento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancelar evento
router.delete('/calendar/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { organizationId } = req.body;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    const result = await cancelEvent(userId, organizationId, eventId);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar evento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar eventos armazenados
router.get('/calendar/stored-events', async (req, res) => {
  try {
    const { organizationId, status } = req.query;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    const events = await listStoredEvents(userId, organizationId, status);

    res.json({
      success: true,
      events
    });

  } catch (error) {
    console.error('❌ Erro ao listar eventos armazenados:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ROTAS DO GOOGLE DRIVE =====

// Listar arquivos
router.get('/drive/files', async (req, res) => {
  try {
    const { organizationId, folderId } = req.query;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    const files = await listFiles(userId, organizationId, folderId);

    res.json({
      success: true,
      files
    });

  } catch (error) {
    console.error('❌ Erro ao listar arquivos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload de arquivo local
router.post('/drive/upload', async (req, res) => {
  try {
    const { organizationId, localFilePath, fileName, chatId, messageId } = req.body;
    const userId = req.user.id;

    if (!organizationId || !localFilePath) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, localFilePath' });
    }

    const file = await uploadLocalFile(userId, organizationId, localFilePath, fileName, chatId, messageId);

    res.json({
      success: true,
      message: 'Arquivo enviado com sucesso',
      file
    });

  } catch (error) {
    console.error('❌ Erro ao fazer upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar arquivo
router.delete('/drive/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { organizationId } = req.body;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    const result = await deleteFile(userId, organizationId, fileId);

    res.json({
      success: true,
      message: 'Arquivo deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar arquivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download de arquivo
router.post('/drive/download', async (req, res) => {
  try {
    const { organizationId, fileId, destinationPath } = req.body;
    const userId = req.user.id;

    if (!organizationId || !fileId || !destinationPath) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: organizationId, fileId, destinationPath' });
    }

    const result = await downloadFile(userId, organizationId, fileId, destinationPath);

    res.json({
      success: true,
      message: 'Arquivo baixado com sucesso',
      path: result.path
    });

  } catch (error) {
    console.error('❌ Erro ao baixar arquivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar arquivos armazenados
router.get('/drive/stored-files', async (req, res) => {
  try {
    const { organizationId, chatId } = req.query;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    const files = await listStoredFiles(userId, organizationId, chatId);

    res.json({
      success: true,
      files
    });

  } catch (error) {
    console.error('❌ Erro ao listar arquivos armazenados:', error);
    res.status(500).json({ error: error.message });
  }
});

// Criar pasta para organização
router.post('/drive/create-folder', async (req, res) => {
  try {
    const { organizationId } = req.body;
    const userId = req.user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Parâmetro obrigatório: organizationId' });
    }

    const folderId = await createFolderForOrganization(userId, organizationId);

    res.json({
      success: true,
      message: 'Pasta criada com sucesso',
      folderId
    });

  } catch (error) {
    console.error('❌ Erro ao criar pasta:', error);
    res.status(500).json({ error: error.message });
  }
});

// Conectar conta Google
router.post('/connect', async (req, res) => {
  try {
    const { organizationId, service } = req.body;
    
    console.log('🔗 Conectando Google:', { organizationId, service });
    console.log('🔍 Debug - google object:', { 
      googleExists: !!google, 
      googleType: typeof google,
      googleKeys: google ? Object.keys(google) : 'N/A'
    });
    
    if (!organizationId || !service) {
      return res.status(400).json({ 
        success: false,
        error: 'Organization ID e service são obrigatórios' 
      });
    }

    // Verificar se as credenciais OAuth2 estão configuradas
    const { data: oauthConfig, error: oauthError } = await supabase
      .from('google_integrations')
      .select('client_id, client_secret, redirect_uri')
      .eq('organization_id', organizationId)
      .eq('service_type', 'oauth_config')
      .single();

    if (oauthError || !oauthConfig) {
      console.log('❌ Configuração OAuth2 não encontrada para organização:', organizationId);
      return res.status(400).json({ 
        success: false,
        error: 'Configurações OAuth2 não encontradas. Configure primeiro as credenciais OAuth2.' 
      });
    }

    console.log('✅ Configuração OAuth2 encontrada, prosseguindo com conexão...');
    console.log('🔍 Debug - oauthConfig:', {
      hasClientId: !!oauthConfig.client_id,
      hasClientSecret: !!oauthConfig.client_secret,
      hasRedirectUri: !!oauthConfig.redirect_uri
    });

    // Verificar se já existe conexão para este serviço
    const { data: existingConnection, error: checkError } = await supabase
      .from('google_integrations')
      .select('id, access_token, refresh_token')
      .eq('organization_id', organizationId)
      .eq('service_type', service)
      .single();

    if (existingConnection && existingConnection.access_token) {
      return res.status(400).json({ 
        success: false,
        error: `${service} já está conectado para esta organização` 
      });
    }

    // Se não existe integração para o serviço, criar uma
    if (!existingConnection) {
      console.log('🔧 Criando integração para o serviço:', service);
      
      // Buscar um usuário da organização para associar à integração
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(1)
        .single();
      
      if (userError || !user) {
        console.log('❌ Nenhum usuário encontrado na organização');
        return res.status(400).json({ 
          success: false,
          error: 'Nenhum usuário encontrado na organização' 
        });
      }
      
      // Criar integração para o serviço
      const { data: newIntegration, error: createError } = await supabase
        .from('google_integrations')
        .insert({
          organization_id: organizationId,
          service_type: service,
          user_id: user.id,
          client_id: oauthConfig.client_id,
          client_secret: oauthConfig.client_secret,
          redirect_uri: oauthConfig.redirect_uri,
          scope: service === 'calendar' 
            ? ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
            : ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'],
          is_active: true
        })
        .select()
        .single();
      
      if (createError) {
        console.log('❌ Erro ao criar integração:', createError);
        return res.status(500).json({ 
          success: false,
          error: 'Erro ao criar integração para o serviço' 
        });
      }
      
      console.log('✅ Integração criada para o serviço:', service);
    }

    // Verificar se o objeto google está disponível
    console.log('🔍 Debug - Verificando google.auth:', {
      googleExists: !!google,
      authExists: !!(google && google.auth),
      authType: google && google.auth ? typeof google.auth : 'N/A'
    });

    if (!google || !google.auth) {
      console.error('❌ Objeto google não está disponível:', { google: !!google, auth: !!(google && google.auth) });
      return res.status(500).json({ 
        success: false,
        error: 'Erro interno: googleapis não está disponível' 
      });
    }

    // Configurar OAuth2 com as credenciais da organização
    console.log('🔧 Criando cliente OAuth2...');
    console.log('🔍 Debug - Antes de criar OAuth2:', {
      clientId: oauthConfig.client_id ? 'Presente' : 'Ausente',
      clientSecret: oauthConfig.client_secret ? 'Presente' : 'Ausente',
      redirectUri: oauthConfig.redirect_uri
    });

    // Log específico antes da linha problemática
    console.log('🔍 Debug - Linha 608 - google.auth.OAuth2:', {
      googleType: typeof google,
      authType: typeof google.auth,
      oauth2Type: typeof google.auth.OAuth2,
      isConstructor: google.auth.OAuth2 && typeof google.auth.OAuth2 === 'function'
    });

    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.client_id,
      oauthConfig.client_secret,
      oauthConfig.redirect_uri
    );

    console.log('✅ Cliente OAuth2 criado com sucesso');

    // Definir escopos baseados no serviço
    const scopes = service === 'calendar' 
      ? ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
      : ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'];

    // Gerar URL de autorização
    console.log('🔗 Gerando URL de autorização...');
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: JSON.stringify({ organizationId, serviceType: service })
    });

    console.log('🔗 URL de autorização gerada para', service);

    res.json({
      success: true,
      authUrl,
      message: `URL de autorização gerada para ${service}`
    });
  } catch (error) {
    console.error('❌ Erro ao conectar Google:', error);
    console.error('📋 Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Rota para desconectar conta Google
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const { organizationId, service } = req.body;
    
    if (!organizationId || !service) {
      return res.status(400).json({
        success: false,
        error: 'organizationId e service são obrigatórios'
      });
    }

    await disconnectIntegration(organizationId, service);

    res.json({
      success: true,
      message: 'Conta desconectada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao desconectar conta Google:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Rota para verificar status da conexão
router.get('/status/:organizationId', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const { data: integrations, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const status = {
      calendar: integrations.some(i => i.service_type === 'calendar'),
      drive: integrations.some(i => i.service_type === 'drive')
    };

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Configuração OAuth2 (Super Admin)
router.get('/config/status/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    console.log('🔍 Verificando status da configuração OAuth2 para organização:', organizationId);
    
    const { data: config, error } = await supabase
      .from('google_integrations')
      .select('client_id, client_secret, redirect_uri')
      .eq('organization_id', organizationId)
      .eq('service_type', 'oauth_config')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const isConfigured = !!config;
    
    res.json({
      success: true,
      isConfigured,
      config: isConfigured ? {
        client_id: config.client_id,
        redirect_uri: config.redirect_uri
      } : null
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status da configuração:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Salvar configuração OAuth2
router.post('/config/setup', async (req, res) => {
  try {
    console.log('🔧 POST /config/setup recebido');
    console.log('📋 Headers:', req.headers);
    console.log('📋 Body:', { ...req.body, clientSecret: '***' });
    
    const { organizationId, clientId, clientSecret, redirectUri } = req.body;
    
    console.log('🔧 Configurando OAuth2 para organização:', organizationId);
    
    if (!organizationId || !clientId || !clientSecret || !redirectUri) {
      console.log('❌ Campos obrigatórios faltando:', { 
        organizationId: !!organizationId, 
        clientId: !!clientId, 
        clientSecret: !!clientSecret, 
        redirectUri: !!redirectUri 
      });
      return res.status(400).json({ 
        success: false,
        error: 'Todos os campos são obrigatórios' 
      });
    }

    console.log('✅ Validação de campos passou');

    // Verificar se já existe configuração
    console.log('🔍 Verificando configuração existente...');
    const { data: existingConfig, error: checkError } = await supabase
      .from('google_integrations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('service_type', 'oauth_config')
      .single();

    console.log('📋 Configuração existente:', existingConfig);
    console.log('📋 Erro na verificação:', checkError);

    if (existingConfig) {
      console.log('❌ Configuração já existe, retornando erro');
      return res.status(400).json({ 
        success: false,
        error: 'Configuração OAuth2 já existe. Use PUT para atualizar.' 
      });
    }

    console.log('✅ Nenhuma configuração existente encontrada');

    // Criar nova configuração
    console.log('💾 Criando nova configuração OAuth2...');
    const { data: newConfig, error: insertError } = await supabase
      .from('google_integrations')
      .insert({
        organization_id: organizationId,
        service_type: 'oauth_config',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        scope: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    console.log('📋 Resultado da inserção:', { newConfig, insertError });

    if (insertError) {
      console.error('❌ Erro ao inserir configuração:', insertError);
      throw insertError;
    }

    console.log('✅ Configuração OAuth2 criada com sucesso');
    
    res.json({
      success: true,
      message: 'Configuração OAuth2 criada com sucesso',
      config: {
        id: newConfig.id,
        client_id: newConfig.client_id,
        redirect_uri: newConfig.redirect_uri
      }
    });
  } catch (error) {
    console.error('❌ Erro ao configurar OAuth2:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Atualizar configuração OAuth2
router.put('/config/update', async (req, res) => {
  try {
    const { organizationId, clientId, clientSecret, redirectUri } = req.body;
    
    console.log('🔄 Atualizando configuração OAuth2 para organização:', organizationId);
    
    if (!organizationId || !clientId || !redirectUri) {
      return res.status(400).json({ 
        success: false,
        error: 'Client ID e Redirect URI são obrigatórios' 
      });
    }

    // Buscar configuração existente
    const { data: existingConfig, error: checkError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('service_type', 'oauth_config')
      .single();

    if (checkError || !existingConfig) {
      return res.status(404).json({ 
        success: false,
        error: 'Configuração OAuth2 não encontrada' 
      });
    }

    // Preparar dados para atualização
    const updateData = {
      client_id: clientId,
      redirect_uri: redirectUri,
      updated_at: new Date().toISOString()
    };

    // Só atualizar client_secret se foi fornecido
    if (clientSecret) {
      updateData.client_secret = clientSecret;
    }

    // Atualizar configuração
    const { data: updatedConfig, error: updateError } = await supabase
      .from('google_integrations')
      .update(updateData)
      .eq('organization_id', organizationId)
      .eq('service_type', 'oauth_config')
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Configuração OAuth2 atualizada com sucesso');
    
    res.json({
      success: true,
      message: 'Configuração OAuth2 atualizada com sucesso',
      config: {
        id: updatedConfig.id,
        client_id: updatedConfig.client_id,
        redirect_uri: updatedConfig.redirect_uri
      }
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar configuração OAuth2:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router; 