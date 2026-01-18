import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import whatsappRoutes from './routes/whatsapp.js';
import accountsRoutes from './routes/accounts.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/users.js';
import aiRoutes from './routes/ai.js';
import transcriptRoutes from './routes/transcript.js';
import aiSettingsRoutes from './routes/aiSettings.js';
import inviteRoutes from './routes/invites.js';
import googleRoutes from './routes/google.js';
import { initializeWhatsApp } from './services/whatsapp.js';
import { initializeMultiWhatsApp } from './services/multiWhatsapp.js';
// ✅ NOVO: Serviço de gerenciamento de versões
import { initializeVersionService } from './services/versionManager.js';
import { startPocCronJob } from './jobs/pocCronJob.js';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import flowsRoutes from './routes/flows.js';
import departmentsRoutes from './routes/departments.js';
import dashboardRoutes from './routes/dashboard.js';
import tagsRoutes from './routes/tags.js';
// ✅ NOVO: Rota de gerenciamento de versões
import versionRoutes from './routes/version.js';
import keywordsRouter from './routes/keywords.js';
import keywordCategoriesRouter from './routes/keywordCategories.js';
import statusCategoriesRoutes from './routes/statusCategories.js';
import tagCategoriesRoutes from './routes/tagCategories.js';
import statusRoutes from './routes/status.js';
import reportsRoutes from './routes/reports.js';
import reportsSimpleRoutes from './routes/reports-simple.js';
import rulesRoutes from './routes/rules.js';
import databaseRoutes from './routes/database.js';
import messagesRoutes from './routes/messages.js';
import analyticsRoutes from './routes/analytics.js';
import organizationsRoutes from './routes/organizations.js';
import whatsappAccountsRoutes from './routes/whatsappAccounts.js';
import whatsappReconnectRoutes from './routes/whatsappReconnect.js';
import whatsappAuditRoutes from './routes/whatsappAudit.js';
import favoriteMessagesRoutes from './routes/favoriteMessages.js';
import aiTrainingDataRoutes from './routes/aiTrainingData.js';
import chatOperationsRoutes from './routes/chatOperations.js';
import connectionsRoutes from './routes/connections.js';
import permissionsRoutes from './routes/permissions.js';
import teamsRoutes from './routes/teams.js';
import rankingsRoutes from './routes/rankings.js';
// ✅ DESABILITADO: Import removido - whatsapp_productivity_metrics não é mais usado
// import whatsappProductivityRoutes from './routes/whatsappProductivity.js';
import campanhasRoutes from './routes/campanhas.js';
import campanhasExecucaoRoutes from './routes/campanhasExecucao.js';
import campanhasContatosRoutes from './routes/campanhasContatos.js';
import contactsRoutes from './routes/contacts.js';
import performanceRoutes from './routes/performance.js';
import cacheRoutes from './routes/cache.js';
import realtimeRoutes from './routes/realtime.js';
import metricsRoutes from './routes/metrics.js';
import productivityRoutes from './routes/productivity.js';
import blacklistRoutes from './routes/blacklist.js';
import pocEmailTemplatesRoutes from './routes/pocEmailTemplates.js';
import intelligentServiceRoutes from './routes/intelligentService.js';
import pausesRoutes from './routes/pauses.js';
import cdrRoutes from './routes/cdr.js';
import cron from 'node-cron';
// ✅ DESABILITADO: Import removido - whatsapp_productivity_metrics não é mais usado
// import { WhatsAppProductivityService } from './services/whatsappProductivityService.js';



dotenv.config();

const app = express();
const server = createServer(app);

// Lista de origens permitidas (env ou defaults)
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'https://dohoo.app',
  'https://www.dohoo.app',
  'https://cimemprimo.dohoo.app'
];

// Adicionar FRONTEND_URL se estiver definido
if (process.env.FRONTEND_URL) {
  defaultAllowedOrigins.push(process.env.FRONTEND_URL);
}

// Permitir múltiplas origens via CORS_ALLOWED_ORIGINS (separadas por vírgula)
const corsEnv = (process.env.CORS_ALLOWED_ORIGINS || '').trim();
const envAllowed = corsEnv ? corsEnv.split(',').map(s => s.trim().replace(/[\[\]'"]/g, '')).filter(Boolean) : [];

// Em desenvolvimento, sempre adicionar localhost:8080 e localhost:5173
const isDevelopment = process.env.NODE_ENV === 'development';
if (isDevelopment && !defaultAllowedOrigins.includes('http://localhost:8080')) {
  defaultAllowedOrigins.push('http://localhost:8080');
}

// Se CORS_ALLOWED_ORIGINS contém '*' ou está vazio, usar defaults + FRONTEND_URL
// Caso contrário, usar apenas as origens definidas no env
const allowedOrigins = (envAllowed.length > 0 && !envAllowed.includes('*')) 
  ? envAllowed 
  : defaultAllowedOrigins;

// Helper para checar subdomínios dohoo.app (ex.: *.dohoo.app)
function isAllowedOrigin(origin) {
  if (!origin) return false;
  
  // Verificar se está na lista de origens permitidas
  if (allowedOrigins.includes(origin)) return true;
  
  // Verificar subdomínios dohoo.app
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (hostname === 'dohoo.app' || hostname === 'www.dohoo.app') return true;
    if (hostname.endsWith('.dohoo.app')) return true;
    
    // Em desenvolvimento, permitir qualquer localhost
    if (process.env.NODE_ENV === 'development' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Permitir chamadas de ferramentas sem origin (ex.: curl/postman)
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by Socket.IO CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true
  },
  // ✅ CONFIGURAÇÕES ROBUSTAS PARA PRODUÇÃO
  pingTimeout: 60000, // 60 segundos - tempo para considerar conexão morta
  pingInterval: 25000, // 25 segundos - intervalo entre pings
  connectTimeout: 60000, // 60 segundos - timeout para handshake
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Compatibilidade com versões antigas
  maxHttpBufferSize: 1e8, // 100MB - para suportar payloads grandes
  // Configurações de reconexão
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10
});

// Tornar io global para usar no aiProcessor
global.io = io;

// Middleware CORS unificado
app.use(cors((req, callback) => {
  const requestHeaders = req.header('Access-Control-Request-Headers');
  const origin = req.header('Origin');
  
  // Permitir requisições sem origin (ferramentas como curl, postman)
  if (!origin) {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: requestHeaders || [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'x-user-id',
        'x-user-role',
        'x-request-id',
        'x-organization-id',
        'X-Organization-Id',
        'cache-control',
        'pragma',
        'expires'
      ],
      exposedHeaders: ['Content-Length'],
      optionsSuccessStatus: 204,
      maxAge: 86400
    });
  }
  
  const isAllowed = isAllowedOrigin(origin);
  
  if (!isAllowed && origin) {
    console.warn(`⚠️ [CORS] Origin não permitida: ${origin}`);
  }
  
  const corsOptions = {
    origin: isAllowed ? origin : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: requestHeaders || [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-user-id',
      'x-user-role',
      'x-request-id',
      'x-organization-id',
      'X-Organization-Id',
      'cache-control',
      'pragma',
      'expires'
    ],
    exposedHeaders: ['Content-Length'],
    optionsSuccessStatus: 204,
    maxAge: 86400
  };
  callback(null, corsOptions);
}));

// Removido middleware manual que duplicava headers CORS

// ✅ AUMENTADO: Limite de payload para suportar uploads grandes
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ✅ NOVO: Middleware de logging global para debug
app.use((req, res, next) => {
  // Log apenas para rotas de conexão WhatsApp
  if (req.path.includes('/whatsapp-accounts') && req.path.includes('/connect')) {
    console.log('🌍 [GLOBAL] ===== REQUISIÇÃO RECEBIDA =====');
    console.log('🌍 [GLOBAL] Método:', req.method);
    console.log('🌍 [GLOBAL] Path:', req.path);
    console.log('🌍 [GLOBAL] URL completa:', req.url);
    console.log('🌍 [GLOBAL] Headers:', {
      authorization: req.headers['authorization'] ? 'Presente' : 'Ausente',
      'x-user-id': req.headers['x-user-id'],
      'content-type': req.headers['content-type']
    });
    console.log('🌍 [GLOBAL] Body:', req.body);
    console.log('🌍 [GLOBAL] Params:', req.params);
    console.log('🌍 [GLOBAL] Query:', req.query);
  }
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ MELHORADO: Servir arquivos estáticos da pasta uploads com tratamento de erros
import fs from 'fs';

// Garantir que a pasta uploads existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ NOVO: Middleware para servir arquivos de uploads (fallback)
// Este middleware é executado ANTES do express.static
app.use('/uploads', (req, res, next) => {
  // Ignorar se não for GET ou HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  
  // Remover /uploads do início do path
  let filePath = req.path;
  if (filePath.startsWith('/uploads/')) {
    filePath = filePath.replace(/^\/uploads\//, '');
  } else if (filePath.startsWith('/uploads')) {
    filePath = filePath.replace(/^\/uploads/, '');
  }
  
  // Se não há path após /uploads, passar para o próximo middleware
  if (!filePath || filePath === '/') {
    return next();
  }
  
  const fullPath = path.join(uploadsDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ [UPLOADS FALLBACK] Arquivo não encontrado: ${fullPath}`);
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  
  // Determinar content-type baseado na extensão
  const ext = path.extname(fullPath).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  
  // Cache de 1 dia para arquivos de mídia
  if (ext.match(/\.(jpg|jpeg|png|gif|webp|mp4|mp3|ogg|wav|pdf|doc|docx|xls|xlsx)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  
  res.sendFile(fullPath);
  
  // Não chamar next() aqui, pois já enviamos a resposta
});

// Servir arquivos estáticos com opções melhoradas
app.use('/uploads', (req, res, next) => {
  // ✅ MELHORADO: Logs detalhados para debug
  // Remover /uploads do início do path se existir
  let relativePath = req.path;
  if (relativePath.startsWith('/uploads/')) {
    relativePath = relativePath.replace(/^\/uploads\//, '');
  } else if (relativePath.startsWith('/uploads')) {
    relativePath = relativePath.replace(/^\/uploads/, '');
  }
  
  const requestedPath = path.join(uploadsDir, relativePath);
  const fileExists = fs.existsSync(requestedPath);
  
  next();
}, express.static(uploadsDir, {
  // Adicionar headers de cache para arquivos de mídia
  setHeaders: (res, filePath) => {
    // Cache de 1 dia para arquivos de mídia
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp|mp4|mp3|ogg|wav|pdf|doc|docx|xls|xlsx)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
  // ✅ NOVO: Configurar index e dotfiles
  index: false,
  dotfiles: 'allow'
}));

// Routes
// ✅ NOVO: Rotas de autenticação (sem middleware de autenticação)
app.use('/api/auth', authRoutes);
console.log('✅ Rota auth registrada');

app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/chat', chatRoutes);
// ✅ NOVO: Rota de gerenciamento de versões
app.use('/api/version', versionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/transcript', transcriptRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/flows', flowsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/keywords', keywordsRouter);
app.use('/api/status-categories', statusCategoriesRoutes);
app.use('/api/tag-categories', tagCategoriesRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/reports', reportsSimpleRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/poc-email-templates', pocEmailTemplatesRoutes);
console.log('🔧 Registrando rota whatsapp-accounts...');
app.use('/api/whatsapp-accounts', whatsappAccountsRoutes);
app.use('/api/whatsapp-reconnect', whatsappReconnectRoutes);
console.log('🔧 Registrando rota whatsapp-audit...');
app.use('/api/whatsapp-audit', whatsappAuditRoutes);
console.log('✅ Rota whatsapp-audit registrada');
app.use('/api/favorite-messages', favoriteMessagesRoutes);
app.use('/api/ai-training-data', aiTrainingDataRoutes);
app.use('/api/chat-operations', chatOperationsRoutes);
console.log('✅ Rota whatsapp-accounts registrada');

console.log('🔧 Registrando rota connections...');
app.use('/api/connections', connectionsRoutes);
console.log('✅ Rota connections registrada');

console.log('🔧 Registrando rota permissions...');
app.use('/api/permissions', permissionsRoutes);
console.log('✅ Rota permissions registrada');

console.log('🔧 Registrando rota teams...');
app.use('/api/teams', teamsRoutes);
console.log('✅ Rota teams registrada');

console.log('🔧 Registrando rota rankings...');
app.use('/api/rankings', rankingsRoutes);
console.log('✅ Rota rankings registrada');

// ✅ DESABILITADO: Rota removida - whatsapp_productivity_metrics não é mais usado

console.log('🔧 Registrando rotas campanhas...');
app.use('/api/campanhas', campanhasRoutes);
app.use('/api/campanhas', campanhasExecucaoRoutes);
app.use('/api/campanhas', campanhasContatosRoutes);
console.log('✅ Rotas campanhas registradas');

console.log('🔧 Registrando rota contacts...');
app.use('/api/contacts', contactsRoutes);
console.log('✅ Rota contacts registrada');

app.use('/api/performance', performanceRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/productivity', productivityRoutes);
app.use('/api/blacklist', blacklistRoutes);

console.log('🔧 Registrando rota intelligent-service...');
app.use('/api/intelligent-service', intelligentServiceRoutes);
console.log('✅ Rota intelligent-service registrada');

console.log('🔧 Registrando rota pauses...');
app.use('/api/pauses', pausesRoutes);
app.use('/api/cdr', cdrRoutes);
console.log('✅ Rota pauses registrada');



// Rota de teste para verificar se o servidor está funcionando
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Rota de callback OAuth para compatibilidade com frontend
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    // Importar as funções necessárias no início
    const { exchangeCodeForTokens, saveGoogleTokens } = await import('./services/google/googleAuthService.js');
    const { supabase } = await import('./lib/supabaseClient.js');
    
    console.log('🔄 Callback OAuth recebido na rota principal:', req.query);
    const { code, state } = req.query;
    
    console.log('📋 Parâmetros recebidos:', {
      hasCode: !!code,
      hasState: !!state,
      code: code ? code.substring(0, 20) + '...' : null,
      state: state || null
    });
    
    if (!code) {
      console.log('❌ Código de autorização não encontrado');
      return res.status(400).json({
        success: false,
        error: 'Código de autorização é obrigatório'
      });
    }

    // Se não tiver state, vamos tentar usar valores padrão ou buscar da integração
    let organizationId, serviceType;
    
    if (state) {
      try {
        console.log('📋 State decodificado:', state);
        const stateData = JSON.parse(state);
        organizationId = stateData.organizationId;
        serviceType = stateData.serviceType;
        console.log('📋 Parâmetros extraídos do state:', { organizationId, serviceType });
      } catch (parseError) {
        console.log('❌ Erro ao decodificar state:', parseError);
        return res.status(400).json({
          success: false,
          error: 'State inválido'
        });
      }
    } else {
      console.log('⚠️ State não encontrado, tentando buscar integração ativa...');
      // Buscar integração ativa mais recente
      const { data: activeIntegration, error: integrationError } = await supabase
        .from('google_integrations')
        .select('organization_id, service_type')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (integrationError || !activeIntegration) {
        console.log('❌ Nenhuma integração ativa encontrada');
        return res.status(400).json({
          success: false,
          error: 'State é obrigatório e nenhuma integração ativa foi encontrada'
        });
      }
      
      organizationId = activeIntegration.organization_id;
      serviceType = activeIntegration.service_type;
      console.log('📋 Usando integração ativa:', { organizationId, serviceType });
    }
    
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
      .select('user_id, id')
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .not('user_id', 'is', null)
      .single();
    
    if (integrationError || !integration) {
      console.log('⚠️ Integração com user_id não encontrada, buscando qualquer integração...');
      // Buscar qualquer integração da organização para o serviço específico
      const { data: anyIntegration, error: anyError } = await supabase
        .from('google_integrations')
        .select('user_id, id')
        .eq('organization_id', organizationId)
        .eq('service_type', serviceType)
        .single();
      
      if (anyError || !anyIntegration) {
        console.log('❌ Nenhuma integração encontrada para esta organização e serviço');
        throw new Error('Nenhuma integração encontrada para esta organização e serviço');
      }
      
      console.log('✅ Integração encontrada (sem user_id):', anyIntegration);
      
      // Se não tiver user_id, vamos buscar um usuário da organização
      if (!anyIntegration.user_id) {
        console.log('🔍 Buscando usuário da organização...');
        const { data: user, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', organizationId)
          .limit(1)
          .single();
        
        if (userError || !user) {
          console.log('❌ Nenhum usuário encontrado na organização');
          throw new Error('Nenhum usuário encontrado na organização');
        }
        
        console.log('✅ Usuário encontrado:', user.id);
        
        // Atualizar a integração com o user_id
        const { error: updateError } = await supabase
          .from('google_integrations')
          .update({ user_id: user.id })
          .eq('id', anyIntegration.id);
        
        if (updateError) {
          console.log('❌ Erro ao atualizar user_id da integração:', updateError);
          throw updateError;
        }
        
        console.log('✅ User_id atualizado na integração');
        
        // Salva tokens no banco
        console.log('💾 Salvando tokens no banco...');
        await saveGoogleTokens(user.id, organizationId, serviceType, tokens);
        console.log('✅ Tokens salvos com sucesso!');
      } else {
        // Salva tokens no banco
        console.log('💾 Salvando tokens no banco...');
        await saveGoogleTokens(anyIntegration.user_id, organizationId, serviceType, tokens);
        console.log('✅ Tokens salvos com sucesso!');
      }
    } else {
      console.log('✅ Integração encontrada:', integration);
      
      // Salva tokens no banco
      console.log('💾 Salvando tokens no banco...');
      await saveGoogleTokens(integration.user_id, organizationId, serviceType, tokens);
      console.log('✅ Tokens salvos com sucesso!');
    }

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
          console.log('🎉 Página de sucesso carregada!');
          console.log('📋 Service:', '${serviceType}');
          console.log('🔍 Window opener:', !!window.opener);
          
          // Notifica a janela pai sobre o sucesso
          if (window.opener) {
            console.log('📤 Enviando mensagem para janela pai...');
            try {
              window.opener.postMessage({ 
                type: 'GOOGLE_CONNECTED', 
                service: '${serviceType}',
                timestamp: new Date().toISOString()
              }, '*');
              console.log('✅ Mensagem enviada com sucesso!');
            } catch (error) {
              console.error('❌ Erro ao enviar mensagem:', error);
            }
          } else {
            console.log('⚠️ Nenhuma janela pai encontrada');
          }
          
          // Fecha automaticamente após 3 segundos
          setTimeout(() => {
            console.log('🔄 Fechando janela automaticamente...');
            window.close();
          }, 3000);
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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// ✅ MIDDLEWARE DE AUTENTICAÇÃO PARA SOCKET.IO
io.use(async (socket, next) => {
  try {
    // Obter token de autenticação (pode vir de auth object ou headers)
    const token = socket.handshake.auth?.token || 
                  socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                  socket.handshake.query?.token;

    // ✅ NOVO: Verificar se é um token de convite (para páginas de convite sem autenticação)
    if (!token) {
      // Tentar obter token de convite de múltiplas fontes (query, auth, headers)
      const inviteTokenRaw = socket.handshake.query?.inviteToken || 
                             socket.handshake.auth?.inviteToken ||
                             socket.handshake.headers?.['x-invite-token'];
      const inviteToken = Array.isArray(inviteTokenRaw) ? inviteTokenRaw[0] : inviteTokenRaw;
      
      if (inviteToken) {
        try {
          const { supabaseAdmin } = await import('./lib/supabaseClient.js');
          const { data: invite, error } = await supabaseAdmin
            .from('whatsapp_invites')
            .select('user_id, organization_id, status, expires_at')
            .eq('token', inviteToken)
            .single();

          if (!error && invite && invite.status === 'pending' && new Date() < new Date(invite.expires_at)) {
            // ✅ Convite válido: permitir conexão sem autenticação completa
            socket.userId = null; // Não há usuário autenticado (mas armazenar user_id do convite)
            socket.organizationId = invite.organization_id;
            socket.inviteToken = inviteToken; // Marcar como conexão via convite
            socket.inviteUserId = invite.user_id; // ✅ NOVO: Armazenar user_id do convite para validação
            console.log(`✅ [Socket.IO] Cliente conectado via convite: ${socket.id} (organização: ${invite.organization_id}, user_id: ${invite.user_id})`);
            return next();
          } else {
            console.error('❌ [Socket.IO] Convite inválido ou expirado:', {
              error: error?.message,
              inviteStatus: invite?.status,
              expiresAt: invite?.expires_at,
              isExpired: invite ? new Date() >= new Date(invite.expires_at) : null
            });
          }
        } catch (inviteError) {
          console.error('❌ [Socket.IO] Erro ao validar token de convite:', inviteError);
        }
      }
      
      console.error('❌ [Socket.IO] Token não fornecido e nenhum token de convite válido encontrado');
      return next(new Error('Token de autenticação é obrigatório'));
    }

    // Importar supabase client
    const { supabase } = await import('./lib/supabaseClient.js');
    
    // ✅ CORREÇÃO: Criar cliente com ANON_KEY para validar tokens de usuário
    // SERVICE_ROLE_KEY não funciona para validar tokens JWT de usuários
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseAnonKey) {
      console.error('❌ [Socket.IO] SUPABASE_ANON_KEY não configurada - necessário para validar tokens de usuários');
      return next(new Error('Configuração do Supabase incompleta'));
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const authClient = createClient(supabaseUrl, supabaseAnonKey);

    // Verificar token de desenvolvimento
    const devToken = process.env.DEV_TOKEN || 'dohoo_dev_token_2024';
    if (token === devToken) {
      const userId = socket.handshake.auth?.userId || socket.handshake.headers?.['x-user-id'];
      if (!userId) {
        console.error('❌ [Socket.IO] Header x-user-id é obrigatório em desenvolvimento');
        return next(new Error('Header x-user-id é obrigatório'));
      }
      socket.userId = userId;
      socket.organizationId = socket.handshake.auth?.organizationId || socket.handshake.headers?.['x-organization-id'];
      return next();
    }

    // Verificar token JWT do Supabase usando cliente de autenticação
    const { data: { user }, error } = await authClient.auth.getUser(token);

    if (error || !user) {
      // ✅ CORREÇÃO: Log mais detalhado para debug
      console.error('❌ [Socket.IO] Token inválido ou expirado:', {
        error: error?.message,
        errorCode: error?.status,
        tokenLength: token?.length,
        tokenPrefix: token?.substring(0, 20) + '...'
      });
      
      // ✅ CORREÇÃO: Se for erro de API key inválida, pode ser problema de configuração
      if (error?.message?.includes('Invalid API key')) {
        console.error('⚠️ [Socket.IO] Erro de API key - verifique configuração do Supabase');
      }
      
      return next(new Error('Token inválido ou expirado'));
    }

    // ✅ CORREÇÃO: Buscar perfil usando ANON_KEY (já que SERVICE_ROLE_KEY está truncada)
    // A ANON_KEY funciona e tem permissão para ler profiles devido ao RLS configurado
    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select('id, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ [Socket.IO] Perfil não encontrado:', {
        error: profileError?.message,
        errorCode: profileError?.code,
        userId: user.id,
        userEmail: user.email
      });
      
      // ✅ CORREÇÃO: Se o perfil não existir, ainda permitir conexão mas sem organização
      // Isso evita logout automático quando o perfil ainda não foi criado
      console.warn('⚠️ [Socket.IO] Perfil não encontrado, permitindo conexão sem organização');
      socket.userId = user.id;
      socket.organizationId = null;
      return next();
    }

    // Armazenar informações do usuário no socket
    socket.userId = profile.id;
    socket.organizationId = profile.organization_id;

    next();
  } catch (error) {
    console.error('❌ [Socket.IO] Erro no middleware de autenticação:', error);
    next(new Error('Erro interno de autenticação'));
  }
});

// Socket.IO para comunicação em tempo real
io.on('connection', (socket) => {
  // ✅ SEGURANÇA: Validar userId antes de entrar na sala
  // Cliente se identifica com user_id (SEGURANÇA)
  socket.on('join-user', async (userId) => {
    // ✅ CORREÇÃO: Permitir conexões via convite entrar na sala do usuário do convite
    if (socket.inviteToken && socket.inviteUserId) {
      // Validar que o userId corresponde ao user_id do convite
      if (socket.inviteUserId === userId) {
        socket.join(`user-${userId}`);
        return;
      } else {
        console.error(`❌ [Socket.IO] userId não corresponde ao convite. Convite userId: ${socket.inviteUserId}, Tentativa: ${userId}`);
        return;
      }
    }
    
    // ✅ NOVO: Se tem inviteToken mas não tem inviteUserId, buscar do banco
    if (socket.inviteToken && !socket.inviteUserId) {
      try {
        const { supabaseAdmin } = await import('./lib/supabaseClient.js');
        const { data: invite } = await supabaseAdmin
          .from('whatsapp_invites')
          .select('user_id, organization_id, status, expires_at')
          .eq('token', socket.inviteToken)
          .single();
        
        if (invite && invite.user_id === userId && invite.status === 'pending' && new Date() < new Date(invite.expires_at)) {
          socket.inviteUserId = invite.user_id; // Armazenar para próximas vezes
          socket.join(`user-${userId}`);
          return;
        } else {
          console.error(`❌ [Socket.IO] Convite inválido ou userId não corresponde. Convite userId: ${invite?.user_id}, Tentativa: ${userId}`);
          return;
        }
      } catch (error) {
        console.error(`❌ [Socket.IO] Erro ao buscar convite para join-user:`, error);
        return;
      }
    }
    
    // Validar que o userId corresponde ao usuário autenticado (para conexões normais)
    if (socket.userId !== userId) {
      console.error(`❌ [Socket.IO] Tentativa de entrar na sala de outro usuário. Socket: ${socket.userId}, Tentativa: ${userId}`);
      return;
    }
    socket.join(`user-${userId}`);
  });

  // ✅ NOVO: Cliente se identifica com organização (SEGURANÇA)
  socket.on('join-organization', async (organizationId) => {
    // ✅ CORREÇÃO: Permitir entrada se for conexão via convite OU se organizationId corresponder
    if (socket.inviteToken) {
      // Conexão via convite: validar que o organizationId corresponde ao convite
      if (socket.organizationId !== organizationId) {
        console.error(`❌ [Socket.IO] Tentativa de entrar na sala de outra organização via convite. Socket: ${socket.organizationId}, Tentativa: ${organizationId}`);
        return;
      }
      socket.join(`org_${organizationId}`);
      return;
    }
    
    // Validar que o organizationId corresponde à organização do usuário autenticado
    if (socket.organizationId !== organizationId) {
      console.error(`❌ [Socket.IO] Tentativa de entrar na sala de outra organização. Socket: ${socket.organizationId}, Tentativa: ${organizationId}`);
      return;
    }
    socket.join(`org_${organizationId}`);
    
    // ✅ DESABILITADO: Reemissão de QR codes desabilitada
    // QR codes agora são emitidos apenas para usuários específicos (user-${userId})
    // Não faz sentido reemitir para toda a organização
  });

  // ✅ NOVO: Cliente se identifica com time (SEGURANÇA)
  socket.on('join-team', (teamId) => {
    socket.join(`team_${teamId}`);
  });

  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('send-message', (data) => {
    // CORREÇÃO: Não emitir automaticamente - deixar que o backend controle as notificações
    // baseadas no assigned_agent_id do chat para evitar notificações cruzadas
  });

  socket.on('typing', (data) => {
    socket.to(data.chatId).emit('user-typing', data);
  });

  socket.on('disconnect', (reason) => {
    // Log removido para reduzir verbosidade
  });

  // ✅ NOVO: Handler para erros de autenticação
  socket.on('error', (error) => {
    console.error('❌ [Socket.IO] Erro no socket:', socket.id, error);
  });
});

// ✅ NOVO: Inicializar serviço de gerenciamento de versões
console.log('🚀 Inicializando serviço de gerenciamento de versões...');
initializeVersionService();

// Inicializar WhatsApp (sistema antigo - manter compatibilidade)
initializeWhatsApp(io);

// Inicializar sistema multi-WhatsApp
initializeMultiWhatsApp(io);

// ✅ NOVO: Inicializar WPPConnect (carregamento assíncrono)
(async () => {
  try {
    const { initializeWPPConnect } = await import('./services/wppconnectService.js');
    initializeWPPConnect(io);
    console.log('✅ WPPConnect inicializado');
  } catch (error) {
    console.warn('⚠️ Erro ao inicializar WPPConnect:', error.message);
  }
})();

// ✅ NOVO: Inicializar whatsapp-web.js (carregamento assíncrono)
(async () => {
  try {
    const { initializeWhatsAppWeb } = await import('./services/whatsappWebService.js');
    initializeWhatsAppWeb(io);
    console.log('✅ whatsapp-web.js inicializado');
  } catch (error) {
    console.warn('⚠️ Erro ao inicializar whatsapp-web.js:', error.message);
  }
})();



const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 ChatFlow AI v2.0 Backend com Multi-WhatsApp iniciado`);
  console.log(`✅ CORS allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`📱 WhatsApp accounts: http://localhost:${PORT}/api/whatsapp-accounts/ping`);
  
  // Iniciar cron job de POC
  const pocCronStarted = startPocCronJob();
  if (pocCronStarted) {
    console.log(`🕐 Cron job de POC iniciado com sucesso`);
  } else {
    console.log(`⚠️ Falha ao iniciar cron job de POC`);
  }
});

export { io };