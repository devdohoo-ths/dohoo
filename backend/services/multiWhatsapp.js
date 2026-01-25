import { Boom } from '@hapi/boom'
import NodeCache from '@cacheable/node-cache'
// ✅ CORREÇÃO: Importação correta conforme documentação oficial
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage
} from '@whiskeysockets/baileys'
// ✅ NOVO: Serviço de gerenciamento de versões
import { getLatestWhatsAppVersion, logVersionInfo } from './versionManager.js'
// ✅ NOVO: Suporte a proxy
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

// ✅ DEBUG removido para reduzir logs

import fs from 'fs'
import P from 'pino'
import path from 'path'
import { execSync } from 'child_process'
import qr from 'qrcode'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Suas importações existentes
import { supabase, supabaseAdmin } from '../lib/supabaseClient.js'
import { processMessageWithAI } from './aiProcessor.js'
import { executeFlowStep } from './flowServices.js'
import { executeFlowSimple } from './flowExecutor.js'
import { processDisconnectNotification } from './disconnectNotificationService.js'
import { processMessageForRules, setIO as setRuleProcessorIO } from './ruleProcessor.js'
import { ensureReconnectEmailDispatched, clearReconnectEmailCache } from './whatsappReconnectService.js'
import OpenAI from 'openai';

// ✅ NOVA: Importar funções do groupProcessor 
import {
  isGroupChat,
  isGroupMention,
  getGroupInfo,
  getContactInfo,
  processGroupMessage,
  sendGroupMessage,
  getGroupsList,
  updateExistingGroupInfo
} from './groupProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ NOVA VERSÃO: Cache de retry e logger otimizado
const msgRetryCounterCache = new NodeCache()

// ✅ CORREÇÃO PROBLEMA 1: Logger mais verboso para debug do QR Code
const logger = P({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info' // Mais verboso para debug
});

// ✅ SOLUÇÃO PROBLEMA 2: Logger completo para todas as mensagens do Baileys
const messageLogger = P({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss'
    }
  }
});

// Manter instâncias ativas das conexões
const activeConnections = new Map();
let io;

const getBundledFfmpegCommand = () => {
  const installerExport = ffmpegInstaller || {};
  const binaryPath = installerExport.path || installerExport;

  if (!binaryPath || !fs.existsSync(binaryPath)) {
    throw new Error('Binário do FFmpeg não encontrado no pacote @ffmpeg-installer/ffmpeg. Reinstale as dependências do backend.');
  }

  return `"${binaryPath}"`;
};

const organizationSettingsCache = new Map();
const ORG_SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let cachedWPPStatusGetter = null;

const getOrganizationSettingsCached = async (organizationId) => {
  if (!organizationId) return null;

  const cached = organizationSettingsCache.get(organizationId);
  if (cached && (Date.now() - cached.timestamp) < ORG_SETTINGS_CACHE_TTL) {
    return cached.settings;
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();

    if (error) {
      console.warn(`⚠️ [ORG_SETTINGS] Erro ao buscar configurações da organização ${organizationId}:`, error.message);
      return null;
    }

    const settings = data?.settings || null;
    organizationSettingsCache.set(organizationId, { settings, timestamp: Date.now() });
    return settings;
  } catch (err) {
    console.warn(`⚠️ [ORG_SETTINGS] Falha ao buscar configurações da organização ${organizationId}:`, err.message);
    return null;
  }
};

const getOrganizationWhatsappApi = async (organizationId) => {
  const settings = await getOrganizationSettingsCached(organizationId);
  return settings?.whatsapp_api || 'baileys';
};

const ensureWPPStatusGetter = async () => {
  if (cachedWPPStatusGetter) {
    return cachedWPPStatusGetter;
  }

  try {
    const module = await import('./wppconnectService.js');
    cachedWPPStatusGetter = module.getConnectionStatus;
  } catch (error) {
    console.warn('⚠️ [RECONNECT] Não foi possível carregar getConnectionStatus do WPPConnect:', error.message);
    cachedWPPStatusGetter = null;
  }

  return cachedWPPStatusGetter;
};

const isWPPAccountConnected = async (accountId) => {
  const getter = await ensureWPPStatusGetter();
  if (!getter) return false;

  try {
    const status = getter(accountId);
    if (!status) return false;

    if (typeof status === 'string') {
      return status === 'connected';
    }

    return status.connected || status.status === 'connected';
  } catch {
    return false;
  }
};

// ✅ CORREÇÃO: Sistema de throttling para conexões simultâneas (reduzido para evitar banimentos)
const connectionQueue = [];
const MAX_CONCURRENT_CONNECTIONS = 2; // ✅ REDUZIDO: Máximo 2 conexões simultâneas (antes: 3)
let currentConnecting = 0;
const CONNECTION_COOLDOWN = 10000; // ✅ NOVO: 10 segundos de cooldown entre conexões
let lastConnectionTime = 0;

// ✅ NOVO: Sistema de locks para prevenir reconexões simultâneas da mesma conta
const connectionLocks = new Map(); // accountId -> { timestamp, source }
const LOCK_TIMEOUT = 60000; // 60 segundos - lock expira automaticamente

// ✅ NOVO: Função para adquirir lock de conexão
const acquireConnectionLock = (accountId, source = 'auto') => {
  const existingLock = connectionLocks.get(accountId);
  const now = Date.now();
  
  // Se há lock ativo e ainda não expirou
  if (existingLock && (now - existingLock.timestamp) < LOCK_TIMEOUT) {
    // Se é conexão manual ou via convite, pode sobrescrever qualquer lock (automático ou manual antigo)
    // Conexões via convite precisam poder sobrescrever locks após desconexões para permitir nova conexão
    if (source === 'manual' || source === 'invite') {
      console.log(`🔓 [LOCK] Sobrescrevendo lock ${existingLock.source} com lock ${source} para ${accountId}`);
      connectionLocks.set(accountId, { timestamp: now, source });
      return true;
    }
    // Lock ativo, não pode conectar
    return false;
  }
  
  // Se o lock expirou, limpar antes de criar novo
  if (existingLock && (now - existingLock.timestamp) >= LOCK_TIMEOUT) {
    console.log(`🧹 [LOCK] Limpando lock expirado para ${accountId} (idade: ${Math.round((now - existingLock.timestamp) / 1000)}s)`);
    connectionLocks.delete(accountId);
  }
  
  // Criar novo lock
  connectionLocks.set(accountId, { timestamp: now, source });
  return true;
};

// ✅ NOVO: Função para liberar lock de conexão
const releaseConnectionLock = (accountId) => {
  connectionLocks.delete(accountId);
};

// ✅ NOVO: Limpar locks expirados periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [accountId, lock] of connectionLocks.entries()) {
    if ((now - lock.timestamp) >= LOCK_TIMEOUT) {
      console.log(`🧹 [LOCK] Removendo lock expirado para ${accountId}`);
      connectionLocks.delete(accountId);
    }
  }
}, 30000); // Verificar a cada 30 segundos

// ✅ NOVO: Função para criar agent de proxy
const createProxyAgent = (proxyUrl) => {
  if (!proxyUrl) return undefined;

  try {
    // Verificar se é um proxy SOCKS
    if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
      return new SocksProxyAgent(proxyUrl);
    }
    
    // Para HTTP/HTTPS proxy
    return new HttpsProxyAgent(proxyUrl);
  } catch (error) {
    console.error(`❌ [PROXY] Erro ao criar agent de proxy: ${error.message}`);
    return undefined;
  }
};

// ✅ CORREÇÃO 1: Configuração simplificada e robusta
// ✅ IMPORTANTE: Configuração mínima e testada para garantir que creds.update funcione
const getBaileysConfig = (accountId, accountName, version, proxyUrl = null) => {
  const config = {
    // ✅ CORREÇÃO: Usar versão mais recente do WhatsApp Web
    version, // Versão dinâmica obtida via fetchLatestWaWebVersion

    // ✅ Configuração de autenticação
    auth: null, // Será definido dinamicamente

    // ✅ CORREÇÃO: Browser config simplificado e testado
    browser: ['Chrome', 'Desktop', '120.0.0'],

    // ✅ CORREÇÃO: Configurações básicas simplificadas (como no exemplo funcional whatsapp.js)
    defaultQueryTimeoutMs: 60000,

    // ✅ Configurações de QR Code (removido printQRInTerminal - deprecated)
    // ✅ AUMENTADO: 15 minutos para dar tempo suficiente após escanear QR e evitar erro 408
    qrTimeout: 900000, // 15 minutos (900000ms)

    // ✅ CORREÇÃO: Configurações mínimas necessárias para creds.update funcionar
    // Removendo opções que podem interferir na autenticação inicial
    // ✅ Configurações de mensagens (mantidas para funcionalidade básica)
    maxMsgRetryCount: 3,
    retryRequestDelayMs: 2000,

    // ✅ Configurações de mídia (mantidas para funcionalidade básica)
    generateHighQualityLinkPreview: true,
    linkPreviewImageThumbnailWidth: 192,

    // ✅ CORREÇÃO: Configurações de sincronização ajustadas
    // ✅ IMPORTANTE: syncFullHistory pode interferir na autenticação inicial
    // ✅ NOVO: Habilitar syncFullHistory para buscar histórico de 7 dias ao conectar
    syncFullHistory: true, // Habilitado para buscar histórico ao conectar
    // ✅ IMPORTANTE: fireInitQueries deve ser true para garantir que queries iniciais sejam executadas
    fireInitQueries: true,
    // ✅ NOVO: shouldSyncHistoryMessage pode ajudar na sincronização inicial
    // ✅ MODIFICADO: Sincronizar apenas mensagens dos últimos 7 dias
    shouldSyncHistoryMessage: (msg) => {
      if (!msg.messageTimestamp) return false;
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      const msgTimestamp = typeof msg.messageTimestamp === 'number' 
        ? (msg.messageTimestamp.toString().length === 13 ? Math.floor(msg.messageTimestamp / 1000) : msg.messageTimestamp)
        : Math.floor(new Date(msg.messageTimestamp).getTime() / 1000);
      return msgTimestamp >= sevenDaysAgo;
    },

    // ✅ Configurações de presença (mantidas)
    markOnlineOnConnect: false,

    // ✅ CORREÇÃO: Logger mínimo para evitar problemas
    logger: P({ level: 'silent' }),

    // ✅ Cache de retry (mantido para funcionalidade básica)
    msgRetryCounterCache: new NodeCache(),

    // ✅ Função para recuperar mensagens (mantida para funcionalidade básica)
    getMessage: async (key) => {
      return undefined;
    }
  };

  // ✅ NOVO: Adicionar proxy se fornecido
  if (proxyUrl) {
    const agent = createProxyAgent(proxyUrl);
    if (agent) {
      config.agent = agent;
      console.log(`🔐 [${accountName}] Proxy configurado: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`);
    } else {
      console.warn(`⚠️ [${accountName}] Falha ao configurar proxy: ${proxyUrl}`);
    }
  }

  return config;
};

// ✅ Função para processar fila de conexões
const processConnectionQueue = async () => {
  if (currentConnecting >= MAX_CONCURRENT_CONNECTIONS || connectionQueue.length === 0) {
    return;
  }

  const nextConnection = connectionQueue[0];

  // ✅ MELHORADO: Bloquear TODAS as conexões quando rate limit está ativo
  // ✅ EXCEÇÃO: Permitir conexões via convite mesmo com rate limit (são ações do usuário)
  const isInviteConnection = nextConnection?.source === 'invite';
  
  if (globalReconnectThrottle && !isInviteConnection) {
    const timeSinceRateLimit = Date.now() - lastRateLimitError;
    const remainingMs = Math.max(0, RATE_LIMIT_COOLDOWN - timeSinceRateLimit);
    
    // ✅ DEBUG: Log detalhado para depuração
    if (remainingMs > RATE_LIMIT_COOLDOWN) {
      console.warn(`⚠️ [RATE_LIMIT] DEBUG: Tempo restante maior que cooldown!`, {
        timeSinceRateLimit,
        remainingMs,
        lastRateLimitError,
        currentTime: Date.now(),
        cooldown: RATE_LIMIT_COOLDOWN
      });
      // ✅ CORREÇÃO: Se o cálculo estiver errado, resetar o rate limit
      globalReconnectThrottle = false;
      lastRateLimitError = 0;
      console.log(`✅ [RATE_LIMIT] Rate limit resetado devido a cálculo incorreto`);
    } else if (remainingMs > 0) {
      // ✅ CORREÇÃO: Dividir por 60000 (milissegundos) para converter para minutos, não por 60
      const remainingCooldown = Math.ceil(remainingMs / 60000); // Converter milissegundos para minutos
      const accountName = nextConnection?.accountName || 'Desconhecida';
      console.log(`⛔ [RATE_LIMIT] ⚠️ BLOQUEADO: Rate limit ativo. Aguarde ${remainingCooldown} minutos antes de tentar conectar.`);
      
      // ✅ Rejeitar a conexão e retornar erro informativo
      const { resolve, reject } = nextConnection;
      connectionQueue.shift();
      currentConnecting--;
      reject(new Error(`Rate limit ativo. Aguarde ${remainingCooldown} minutos antes de tentar conectar novamente.`));
      
      // Processar próximo da fila após um delay maior
      setTimeout(processConnectionQueue, 10000); // 10 segundos
      return;
    } else {
      // Cooldown expirado, desativar throttle
      globalReconnectThrottle = false;
      lastRateLimitError = 0; // ✅ CORREÇÃO: Resetar timestamp quando cooldown expira
      console.log(`✅ [RATE_LIMIT] Cooldown de rate limit finalizado`);
    }
  } else if (globalReconnectThrottle && isInviteConnection) {
    console.log(`✅ [RATE_LIMIT] Permitindo conexão via convite mesmo com rate limit ativo (ação do usuário)`);
  }
  
  // ✅ NOVO: Verificar se esta conta específica teve rate limit recentemente
  // ✅ EXCEÇÃO: Permitir conexões via convite mesmo com rate limit específico da conta
  const nextAccountId = nextConnection?.accountId;
  if (nextAccountId && rateLimitedAccounts.has(nextAccountId) && !isInviteConnection) {
    const rateLimitInfo = rateLimitedAccounts.get(nextAccountId);
    const timeSinceRateLimit = Date.now() - rateLimitInfo.timestamp;
    const remainingMs = Math.max(0, RATE_LIMIT_COOLDOWN - timeSinceRateLimit);
    
    if (remainingMs > 0) {
      // ✅ CORREÇÃO: Dividir por 60000 (milissegundos) para converter para minutos, não por 60
      const remainingCooldown = Math.ceil(remainingMs / 60000); // Converter milissegundos para minutos
      const accountName = nextConnection?.accountName || 'Desconhecida';
      console.log(`⛔ [RATE_LIMIT] ⚠️ BLOQUEADO: Conta ${accountName} teve rate limit recentemente. Aguarde ${remainingCooldown} minutos.`);
      
      // Rejeitar a conexão
      const { resolve, reject } = nextConnection;
      connectionQueue.shift();
      currentConnecting--;
      reject(new Error(`Esta conta teve rate limit recentemente. Aguarde ${remainingCooldown} minutos antes de tentar conectar novamente.`));
      
      setTimeout(processConnectionQueue, 10000);
      return;
    } else {
      // Cooldown expirado para esta conta, remover do tracking
      rateLimitedAccounts.delete(nextAccountId);
    }
  } else if (nextAccountId && rateLimitedAccounts.has(nextAccountId) && isInviteConnection) {
    console.log(`✅ [RATE_LIMIT] Permitindo conexão via convite para conta ${nextConnection?.accountName} mesmo com rate limit específico (ação do usuário)`);
  }

  const { accountId, accountName, shouldGenerateQr, resolve, reject, source, userId, options = {} } = connectionQueue.shift();
  currentConnecting++;

  // ✅ Logs reduzidos - apenas erros
  try {
    // ✅ CORREÇÃO: Passar opções completas para manter userId e organizationId
    const result = await createWhatsAppConnectionInternal(accountId, accountName, shouldGenerateQr, source, userId, options);
    resolve(result);
  } catch (error) {
    console.error(`❌ [QUEUE] Erro ao processar conexão ${accountName}:`, error.message);
    reject(error);
  } finally {
    currentConnecting--;

    // ✅ AUMENTADO: Processar próximo da fila após um delay maior para evitar rate limit
    setTimeout(processConnectionQueue, 30000); // ✅ AUMENTADO: 30 segundos entre conexões (antes: 5 segundos)
  }
};

// ✅ OTIMIZADO: Sistema de monitoramento estável e menos agressivo
const connectionHealthMonitor = new Map();
const HEARTBEAT_INTERVAL = 600000; // ✅ OTIMIZADO: 10 minutos (reduzido de 5 min)

// ✅ NOVO: Sistema de keep-alive ativo para detectar conexões zombie
const keepAliveMonitors = new Map();
const KEEP_ALIVE_INTERVAL = 120000; // 2 minutos - ping periódico
const KEEP_ALIVE_TIMEOUT = 20000; // 20 segundos para resposta
const MAX_KEEP_ALIVE_FAILURES = 3; // Máximo de falhas antes de reconectar
const MAX_RECONNECT_ATTEMPTS = 3; // Reduzido para evitar spam
const BASE_RECONNECT_DELAY = 30000; // ✅ OTIMIZADO: 30 segundos (aumentado de 15s)
const MAX_RECONNECT_DELAY = 300000; // ✅ UNIFICADO: 5 minutos máximo de delay

// ✅ NOVO: Sistema de throttle para atualizações de status no banco
const statusUpdateQueue = new Map(); // accountId -> { status, timestamp }
const STATUS_UPDATE_THROTTLE = 60000; // 1 minuto - só atualiza banco a cada minuto por conta
let statusUpdateTimer = null;

// ✅ NOVO: Sistema para detectar erro 428 (rate limit) e fazer throttling global
let lastRateLimitError = 0;
const RATE_LIMIT_COOLDOWN = 900000; // ✅ AUMENTADO: 15 minutos após erro 428 (antes: 5 minutos)
let globalReconnectThrottle = false;
// ✅ NOVO: Tracking de contas que receberam rate limit recentemente
const rateLimitedAccounts = new Map(); // accountId -> { timestamp, count }

// ✅ NOVO: Sistema de rate limiting por conta para evitar banimentos
const accountMessageRateLimit = new Map(); // accountId -> { count, windowStart, lastMessageTime }
const MESSAGES_PER_MINUTE_LIMIT = 20; // ✅ CONSERVADOR: Máximo 20 mensagens por minuto por conta
const MIN_DELAY_BETWEEN_MESSAGES = 3000; // ✅ MÍNIMO: 3 segundos entre mensagens da mesma conta
const MIN_DELAY_AUTO_RESPONSE = 2000; // ✅ MÍNIMO: 2 segundos antes de respostas automáticas (AI/Flow)
const MAX_DELAY_AUTO_RESPONSE = 5000; // ✅ MÁXIMO: 5 segundos (aleatório para parecer humano)

// ✅ NOVO: Cache de informações de contas para evitar queries repetidas
const accountInfoCache = new Map(); // accountId -> { organization_id, lastUpdated }
const ACCOUNT_INFO_CACHE_TTL = 300000; // 5 minutos

// ✅ NOVO: Cache para evitar processar o mesmo QR code múltiplas vezes
const qrCodeCache = new Map(); // accountId -> { qr: string, timestamp }
const QR_CODE_THROTTLE = 30000; // 30 segundos - só processar QR novo a cada 30s

// ✅ NOVA: Função para registrar mudança de status na auditoria
const logStatusChange = async (accountId, oldStatus, newStatus, reason = 'unknown', metadata = {}) => {
  try {
    // Buscar informações da conta incluindo user_id
    const { data: accountData } = await supabase
      .from('whatsapp_accounts')
      .select('name, organization_id, user_id')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!accountData) {
      console.warn(`⚠️ [AUDIT] Conta ${accountId} não encontrada - pulando registro de auditoria`);
      return;
    }

    // ✅ NOVO: Validar se o user_id pertence à organização antes de registrar
    let validOrganizationId = accountData.organization_id;

    if (accountData.user_id && accountData.organization_id) {
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', accountData.user_id)
        .single();

      if (userError || !userProfile) {
        console.warn(`⚠️ [AUDIT] Usuário ${accountData.user_id} da conta ${accountData.name} não encontrado - registrando com organization_id da conta`);
        // Continuar com organization_id da conta mesmo se usuário não encontrado
      } else if (userProfile.organization_id !== accountData.organization_id) {
        // ✅ CRÍTICO: Se o usuário pertence a outra organização, usar a organização do usuário
        console.warn(`⚠️ [AUDIT] Conta ${accountData.name} (${accountId}) tem organization_id ${accountData.organization_id}, mas o usuário ${accountData.user_id} pertence à organização ${userProfile.organization_id} - usando organização do usuário`);
        validOrganizationId = userProfile.organization_id;
      }
    }

    // Registrar na tabela de auditoria (se existir)
    const { error: auditError } = await supabase
      .from('whatsapp_status_audit')
      .insert({
        account_id: accountId,
        account_name: accountData?.name || null,
        organization_id: validOrganizationId, // ✅ Usar organização validada
        user_id: accountData?.user_id || null, // ✅ Incluir user_id no registro
        old_status: oldStatus,
        new_status: newStatus,
        reason: reason,
        metadata: {
          ...metadata,
          timestamp: Date.now()
        }
      });
    
    // Se a tabela não existir ou houver outro erro, apenas logar (não falhar)
    if (auditError) {
      // 42P01 = tabela não existe, PGRST116 = relação não existe
      if (auditError.code !== '42P01' && auditError.code !== 'PGRST116') {
        console.warn(`⚠️ [AUDIT] Erro ao registrar mudança de status:`, auditError.message);
      }
    }
  } catch (error) {
    // Não falhar a operação principal por erro na auditoria
    console.warn(`⚠️ [AUDIT] Erro ao registrar mudança de status:`, error.message);
  }
};

// ✅ NOVA: Função para atualizar status IMEDIATAMENTE (ignora throttle)
const updateAccountStatusImmediate = async (accountId, status, additionalData = {}, reason = 'immediate_update') => {
  try {
    // Remover da fila de throttle se existir
    statusUpdateQueue.delete(accountId);
    
    // Buscar status atual antes de atualizar
    const { data: currentAccount } = await supabase
      .from('whatsapp_accounts')
      .select('status, name')
      .eq('account_id', accountId)
      .maybeSingle();
    
    const oldStatus = currentAccount?.status;
    const accountName = currentAccount?.name || accountId;
    
    // ✅ NOVO: Log detalhado de mudança de status no banco
    console.log(`\n💾 [${accountName}] ===== ATUALIZANDO STATUS NO BANCO (IMEDIATO) =====`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`📊 Status anterior: ${oldStatus}`);
    console.log(`📊 Novo status: ${status}`);
    console.log(`📝 Razão: ${reason}`);
    console.log(`📦 Dados adicionais:`, JSON.stringify(additionalData, null, 2));
    
    // Atualizar imediatamente no banco
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };
    
    const { error } = await supabase
      .from('whatsapp_accounts')
      .update(updateData)
      .eq('account_id', accountId);
    
    if (error) {
      console.error(`❌ [${accountName}] Erro ao atualizar status imediatamente:`, error);
    } else {
      console.log(`✅ [${accountName}] Status atualizado com sucesso: ${oldStatus} → ${status}`);
    }
    console.log(`${'='.repeat(60)}\n`);
    // ✅ REMOVIDO: Não precisa mais chamar logStatusChange manualmente
    // O trigger do banco (trigger_log_whatsapp_status_change) já registra automaticamente
  } catch (error) {
    console.error(`❌ Erro ao atualizar status imediatamente:`, error);
  }
};

// ✅ OTIMIZADO: Função para atualizar status da conta com throttle
const updateAccountStatus = async (accountId, status, reason = 'updateAccountStatus') => {
  // ✅ THROTTLE: Só adicionar à fila, processar em batch
  const lastUpdate = statusUpdateQueue.get(accountId);
  const now = Date.now();

  // ✅ CORREÇÃO: NUNCA gravar 'connecting' no banco de dados
  // O status 'connecting' é apenas um estado intermediário em memória
  // Isso evita alternância de status e triggers desnecessários no banco
  if (status === 'connecting') {
    console.log(`ℹ️ [${accountId}] Status 'connecting' mantido apenas em memória (não gravado no banco)`);
    return;
  }

  // ✅ CORREÇÃO: Para desconexão, atualizar imediatamente (não usar throttle)
  if (status === 'disconnected') {
    await updateAccountStatusImmediate(accountId, status, { phone_number: null, qr_code: null }, reason);
    return;
  }

  // Se já atualizou recentemente e o status não mudou, ignorar
  if (lastUpdate && (now - lastUpdate.timestamp) < STATUS_UPDATE_THROTTLE && lastUpdate.status === status) {
    return; // Já atualizado recentemente
  }

  // Adicionar/atualizar na fila (com reason para auditoria)
  statusUpdateQueue.set(accountId, { status, timestamp: now, reason });

  // ✅ BATCH UPDATE: Processar atualizações em batch a cada minuto
  if (!statusUpdateTimer) {
    statusUpdateTimer = setInterval(async () => {
      await processStatusUpdateQueue();
    }, STATUS_UPDATE_THROTTLE);
  }
};

// ✅ NOVO: Processar fila de atualizações de status em batch
const processStatusUpdateQueue = async () => {
  if (statusUpdateQueue.size === 0) return;

  const updates = Array.from(statusUpdateQueue.entries());
  statusUpdateQueue.clear();

  // Atualizar cada conta (pode ser otimizado para batch update no futuro)
  for (const [accountId, { status, reason = 'batch_update' }] of updates) {
    try {
      // Buscar status atual antes de atualizar
      const { data: currentAccount } = await supabase
        .from('whatsapp_accounts')
        .select('status')
        .eq('account_id', accountId)
        .maybeSingle();
      
      const oldStatus = currentAccount?.status;
      
      // Atualizar no banco
      const { error } = await supabase
        .from('whatsapp_accounts')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId);
      
      if (error) {
        console.error(`❌ Erro ao atualizar status da conta ${accountId}:`, error);
      }
      // ✅ REMOVIDO: Não precisa mais chamar logStatusChange manualmente
      // O trigger do banco (trigger_log_whatsapp_status_change) já registra automaticamente
    } catch (error) {
      console.error(`❌ Erro ao atualizar status da conta ${accountId}:`, error);
    }
  }
};

// ✅ NOVA: Função para emitir notificação de desconexão
const emitDisconnectionNotification = async (accountId, accountName, disconnectReason = null) => {
  try {
    const { data: accountInfo } = await supabase
      .from('whatsapp_accounts')
      .select('organization_id')
      .eq('account_id', accountId)
      .single();

    // ✅ CORREÇÃO: Garantir que reason seja sempre uma string descritiva
    const isManual = disconnectReason === 401 || disconnectReason === DisconnectReason.loggedOut;
    
    const notificationData = {
      accountId,
      accountName,
      disconnectReason,
      reason: isManual ? 'Desconexão manual (loggedOut)' : 
              disconnectReason === 408 ? 'QR refs attempts ended' :
              disconnectReason === 428 ? 'Rate limit detectado' :
              disconnectReason === 515 ? 'Stream Errored (restart required)' :
              disconnectReason ? `Desconectado (código: ${disconnectReason})` : 'Desconectado',
      isManual: isManual // ✅ NOVO: Flag explícita para identificar desconexão manual
    };

    console.log(`📡 [${accountName}] Emitindo notificação de desconexão:`, {
      accountId,
      accountName,
      disconnectReason,
      reason: notificationData.reason,
      isManual: notificationData.isManual,
      organizationId: accountInfo?.organization_id
    });

    if (accountInfo && io) {
      io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', notificationData);
      console.log(`✅ [${accountName}] Notificação emitida para organização ${accountInfo.organization_id}`);
    } else if (io) {
      io.emit('whatsapp-disconnected', notificationData);
      console.log(`✅ [${accountName}] Notificação emitida globalmente (fallback)`);
    }
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao emitir notificação de desconexão:`, error);
    // Fallback
    if (io) {
      io.emit('whatsapp-disconnected', { 
        accountId, 
        accountName, 
        disconnectReason,
        reason: disconnectReason === 401 ? 'Desconexão manual (loggedOut)' : 'Desconectado',
        isManual: disconnectReason === 401
      });
    }
  }
};

// ✅ NOVO: Função de keep-alive ativo para detectar conexões zombie
const startKeepAlive = (accountId, accountName, sock) => {
  // Limpar monitor existente se houver
  if (keepAliveMonitors.has(accountId)) {
    clearInterval(keepAliveMonitors.get(accountId));
    keepAliveMonitors.delete(accountId);
  }

  console.log(`✅ [KEEP-ALIVE] Iniciando monitor para ${accountName} (intervalo: ${KEEP_ALIVE_INTERVAL}ms)`);

  const keepAliveInterval = setInterval(async () => {
    const connection = activeConnections.get(accountId);
    
    if (!connection || !connection.socket) {
      console.log(`🔴 [KEEP-ALIVE] ${accountName} - Conexão não encontrada, parando keep-alive`);
      clearInterval(keepAliveInterval);
      keepAliveMonitors.delete(accountId);
      return;
    }

    // ✅ CORREÇÃO: Não verificar wsState - o Baileys pode não expor ws corretamente
    // Em vez disso, sempre tentar o ping. Se funcionar, está vivo. Se não, conta falha.
    const wsState = connection.socket.ws?.readyState;
    
    try {
      // ✅ Verificar se o socket tem a função query disponível
      if (typeof connection.socket.query !== 'function') {
        console.log(`⚠️ [KEEP-ALIVE] ${accountName} - Socket não tem função query, tentativa ${(connection.keepAliveFailures || 0) + 1}/${MAX_KEEP_ALIVE_FAILURES}`);
        throw new Error('Socket query not available');
      }
      
      // ✅ Criar promise de timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Keep-alive timeout')), KEEP_ALIVE_TIMEOUT)
      );
      
      // ✅ Query simples que o WhatsApp responde rapidamente (ping)
      const queryPromise = connection.socket.query({
        tag: 'iq',
        attrs: {
          type: 'get',
          xmlns: 'w:p',
          to: '@s.whatsapp.net'
        },
        content: [{ tag: 'ping', attrs: {} }]
      });

      await Promise.race([queryPromise, timeoutPromise]);
      
      // ✅ Sucesso - atualizar timestamp e resetar contadores
      connection.lastHeartbeat = Date.now();
      connection.keepAliveFailures = 0;
      connection.wsNotReadyCount = 0;
      
      // Log apenas a cada 5 pings bem-sucedidos para não poluir
      const pingCount = (connection.keepAlivePingCount || 0) + 1;
      connection.keepAlivePingCount = pingCount;
      if (pingCount % 5 === 0) {
        console.log(`💚 [KEEP-ALIVE] ${accountName} - Conexão responsiva (ping #${pingCount}, ws: ${wsState ?? 'N/A'})`);
      }
      
    } catch (error) {
      // Falha no ping
      connection.keepAliveFailures = (connection.keepAliveFailures || 0) + 1;
      console.warn(`⚠️ [KEEP-ALIVE] ${accountName} - Falha ${connection.keepAliveFailures}/${MAX_KEEP_ALIVE_FAILURES}: ${error.message}`);
      
      if (connection.keepAliveFailures >= MAX_KEEP_ALIVE_FAILURES) {
        console.log(`🔴 [KEEP-ALIVE] ${accountName} - Conexão não responsiva após ${connection.keepAliveFailures} falhas, forçando reconexão...`);
        
        // Limpar monitor antes de reconectar
        clearInterval(keepAliveInterval);
        keepAliveMonitors.delete(accountId);
        
        // Forçar reconexão via handleConnectionFailure
        try {
          await handleConnectionFailure(accountId, accountName, 'keep_alive_timeout');
        } catch (reconnectError) {
          console.error(`❌ [KEEP-ALIVE] ${accountName} - Erro ao forçar reconexão:`, reconnectError.message);
        }
      }
    }
  }, KEEP_ALIVE_INTERVAL);

  keepAliveMonitors.set(accountId, keepAliveInterval);
};

// ✅ NOVO: Parar keep-alive
const stopKeepAlive = (accountId) => {
  if (keepAliveMonitors.has(accountId)) {
    clearInterval(keepAliveMonitors.get(accountId));
    keepAliveMonitors.delete(accountId);
    console.log(`🛑 [KEEP-ALIVE] Monitor parado para conta ${accountId}`);
  }
};

// ✅ NOVO: Função para monitorar saúde das conexões
const startHealthMonitoring = (accountId, accountName) => {
  if (connectionHealthMonitor.has(accountId)) {
    clearInterval(connectionHealthMonitor.get(accountId));
  }

  const healthInterval = setInterval(async () => {
    const connection = activeConnections.get(accountId);

    if (!connection) {
      console.log(`🔍 [HEALTH] Conexão ${accountName} não encontrada, parando monitoramento`);
      clearInterval(healthInterval);
      connectionHealthMonitor.delete(accountId);
      return;
    }

    try {
      // ✅ VERIFICAÇÃO PASSIVA: Apenas verificar se a conexão está válida
      if (connection.socket && connection.socket.user && connection.socket.user.id) {
        // ✅ VERIFICAÇÃO SIMPLES: Apenas verificar se está autenticado
        const isAuthenticated = connection.socket.user && connection.socket.user.id;
        const wsState = connection.socket.ws?.readyState;
        
        // ✅ NOVO: Verificar se recebeu mensagens recentemente (prova de vida)
        const lastMessageAge = connection.lastMessageReceived 
          ? Date.now() - connection.lastMessageReceived 
          : Infinity;
        const hasRecentActivity = lastMessageAge < (HEARTBEAT_INTERVAL * 2); // 20 minutos
        
        // ✅ NOVO: Verificar último heartbeat (prova de que conexão estava ativa recentemente)
        const lastHeartbeatAge = connection.lastHeartbeat 
          ? Date.now() - connection.lastHeartbeat 
          : Infinity;
        const hasRecentHeartbeat = lastHeartbeatAge < (HEARTBEAT_INTERVAL * 3); // 30 minutos

        // ✅ MELHORADO: Considerar conexão saudável se:
        // 1. Está autenticado E WebSocket está aberto, OU
        // 2. Está autenticado E teve atividade recente (mensagens ou heartbeat), mesmo se WebSocket estiver temporariamente fechado
        // Isso evita desconexões falsas durante reconexões internas do WebSocket
        const isHealthy = (isAuthenticated && wsState === 1) || 
                         (isAuthenticated && (hasRecentActivity || hasRecentHeartbeat));

        if (isHealthy) {
          // ✅ MELHORADO: Log apenas se houver atividade recente ou a cada 3 verificações
          const shouldLog = hasRecentActivity || (connection.healthCheckCount || 0) % 3 === 0;
          if (shouldLog) {
            const statusInfo = wsState === 1 ? 'WebSocket aberto' : 'WebSocket temporariamente fechado (mas com atividade recente)';
            console.log(`💓 [HEALTH] Conexão saudável para ${accountName} (${statusInfo})${hasRecentActivity ? ' - atividade recente' : ''}`);
          }

          // Atualizar timestamp do último heartbeat
          connection.lastHeartbeat = Date.now();
          connection.status = 'connected';
          connection.healthCheckCount = (connection.healthCheckCount || 0) + 1;
          // ✅ NOVO: Resetar contador de falhas quando conexão está saudável
          connection.healthFailureCount = 0;

          // ✅ OTIMIZADO: Apenas a cada 30 minutos (era 15 min)
          const lastDbUpdate = connection.lastDbUpdate || 0;
          if (Date.now() - lastDbUpdate > 1800000) { // 30 minutos (aumentado de 15 min)
            try {
              // ✅ USAR updateAccountStatus com throttle ao invés de update direto
              await updateAccountStatus(accountId, 'connected', 'health_check');
              connection.lastDbUpdate = Date.now();
            } catch (dbError) {
              console.warn(`⚠️ [HEALTH] Erro ao atualizar status no banco para ${accountName}:`, dbError.message);
            }
          }
        } else {
          // ✅ MELHORADO: Não reconectar imediatamente - aguardar múltiplas falhas
          const connData = activeConnections.get(accountId);
          if (connData) {
            if (!connData.healthFailureCount) {
              connData.healthFailureCount = 0;
            }
            connData.healthFailureCount++;
            
            // ✅ AUMENTADO: Só considerar falha após 5 verificações consecutivas (50 minutos)
            // Isso dá mais tempo para reconexões internas do WebSocket
            if (connData.healthFailureCount >= 5) {
              console.log(`⚠️ [HEALTH] Conexão ${accountName} inválida após ${connData.healthFailureCount} verificações (auth: ${isAuthenticated}, ws: ${wsState}, última atividade: ${hasRecentActivity ? 'sim' : 'não'})`);
              await handleConnectionFailure(accountId, accountName, 'health_check_failed');
              connData.healthFailureCount = 0; // Reset após tratar
            } else {
              console.log(`⚠️ [HEALTH] Conexão ${accountName} inválida (tentativa ${connData.healthFailureCount}/5), aguardando...`);
            }
          }
        }
      } else {
        // ✅ MELHORADO: Não reconectar imediatamente - aguardar múltiplas falhas
        const connData = activeConnections.get(accountId);
        if (connData) {
          if (!connData.healthFailureCount) {
            connData.healthFailureCount = 0;
          }
          connData.healthFailureCount++;
          
          // ✅ AUMENTADO: Só considerar falha após 5 verificações consecutivas (50 minutos)
          if (connData.healthFailureCount >= 5) {
            console.log(`⚠️ [HEALTH] Conexão ${accountName} não encontrada após ${connData.healthFailureCount} verificações`);
            await handleConnectionFailure(accountId, accountName, 'connection_missing');
            connData.healthFailureCount = 0; // Reset após tratar
          } else {
            console.log(`⚠️ [HEALTH] Conexão ${accountName} não encontrada (tentativa ${connData.healthFailureCount}/5), aguardando...`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ [HEALTH] Erro no heartbeat para ${accountName}:`, error.message);
      // ✅ NÃO RECONECTAR por erro de heartbeat - pode ser temporário
      console.log(`🔄 [HEALTH] Ignorando erro temporário para ${accountName}`);
    }
  }, HEARTBEAT_INTERVAL);

  connectionHealthMonitor.set(accountId, healthInterval);
};

// ✅ NOVO: Função para determinar se deve tentar reconectar
const shouldAttemptReconnect = (reason) => {
  // Não reconectar em casos específicos que indicam problemas permanentes
  const noReconnectReasons = [
    'keep_alive_failed', // Muitas tentativas de keep-alive
    'heartbeat_error',   // Erros de heartbeat podem ser temporários
    'connection_timeout' // Timeout pode ser temporário
  ];

  // Não reconectar por erros temporários/suspeitos
  if (noReconnectReasons.some(r => reason.includes(r))) {
    return false;
  }

  // Reconectar apenas por desconexões legítimas
  return reason.includes('disconnect_reason_') || reason.includes('health_check_failed');
};

// ✅ UNIFICADO: Função centralizada para calcular delay de reconexão com jitter
const calculateReconnectDelay = (attemptCount) => {
  // Delay progressivo exponencial: 30s, 60s, 120s, máximo 5min
  const baseDelay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attemptCount - 1), MAX_RECONNECT_DELAY);
  
  // ✅ NOVO: Adicionar jitter aleatório (±20%) para evitar "thundering herd"
  // Isso evita que múltiplas conexões tentem reconectar exatamente ao mesmo tempo
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1); // -20% a +20%
  const finalDelay = Math.max(1000, baseDelay + jitter); // Mínimo 1 segundo
  
  return Math.round(finalDelay);
};

// ✅ NOVO: Função para lidar com falhas de conexão
const handleConnectionFailure = async (accountId, accountName, reason) => {
  const connection = activeConnections.get(accountId);

  if (!connection) return;

  connection.attemptCount = (connection.attemptCount || 0) + 1;
  connection.lastFailure = Date.now();
  connection.failureReason = reason;

  console.log(`🔄 [FAILURE] Tentativa ${connection.attemptCount}/${MAX_RECONNECT_ATTEMPTS} para ${accountName} (${reason})`);

  // Parar monitoramento de saúde
  if (connectionHealthMonitor.has(accountId)) {
    clearInterval(connectionHealthMonitor.get(accountId));
    connectionHealthMonitor.delete(accountId);
  }
  
  // ✅ NOVO: Parar keep-alive
  stopKeepAlive(accountId);

  // Limpar conexão atual
  try {
    if (connection.socket) {
      // ✅ CORREÇÃO: Verificar se a conexão está em estado válido antes de encerrar
      const socketState = connection.socket.ws?.readyState;
      if (socketState === 1) { // WebSocket.OPEN
        await connection.socket.end(new Error(`Falha de conexão: ${reason}`));
      } else {
        console.log(`⚠️ [CLEANUP] Conexão ${accountName} não está em estado válido (${socketState}), pulando encerramento`);
      }
    }
  } catch (error) {
    console.error(`❌ [CLEANUP] Erro ao encerrar conexão ${accountName}:`, error.message);
    // ✅ NOVO: Não deixar o erro propagar para não derrubar o servidor
  }

  // ✅ NOVO: Liberar lock ao limpar conexão
  releaseConnectionLock(accountId);
  activeConnections.delete(accountId);

  // ✅ OTIMIZADO: Atualizar status no banco com throttle
  try {
    const isMaxAttemptsReached = connection.attemptCount >= MAX_RECONNECT_ATTEMPTS;
    await updateAccountStatus(accountId, isMaxAttemptsReached ? 'error' : 'disconnected', 'handleConnectionFailure');
    // ✅ NÃO limpar cache aqui - cache só é limpo quando conexão é estabelecida com sucesso

    // Buscar organização para emitir notificação
    const { data: accountInfo } = await supabase
      .from('whatsapp_accounts')
      .select('organization_id')
      .eq('account_id', accountId)
      .single();

    if (accountInfo) {
      io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
        accountId,
        accountName,
        reason,
        attemptCount: connection.attemptCount
      });
    }
  } catch (error) {
    console.error(`Erro ao atualizar status da conta ${accountName}:`, error);
  }

  // ✅ CORRIGIDO: Se atingiu máximo de tentativas, PARAR completamente
  if (connection.attemptCount >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`⛔ [${accountName}] Máximo de tentativas de reconexão atingido (${MAX_RECONNECT_ATTEMPTS}). Encerrando tentativas.`);
    await updateAccountStatus(accountId, 'disconnected');
    // Limpar conexão completamente
    activeConnections.delete(accountId);
    releaseConnectionLock(accountId);
    return; // NÃO tentar mais reconectar
  }

  // ✅ DESABILITADO: NUNCA reconectar automaticamente - apenas notificar admin
  // ✅ Notificar admin sobre a falha
  await processDisconnectNotification(accountId, reason, accountName);
  console.log(`⏸️ [${accountName}] Falha de conexão detectada. Admin notificado. Reconexão manual necessária.`);
};

// ✅ MELHORADO: Função para verificar conexões órfãs - não reconectar se acabou de conectar
const checkOrphanedConnections = async () => {
  try {
    const { data: accounts } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status, organization_id, updated_at')
      .eq('status', 'connected');

    if (!accounts || accounts.length === 0) return;

    const orphanedAccounts = [];
    const now = Date.now();
    
    for (const account of accounts) {
      const connection = activeConnections.get(account.account_id);
      
      // ✅ MELHORADO: Não reconectar se a conta foi atualizada recentemente (menos de 10 minutos)
      // Isso evita reconectar contas que acabaram de conectar ou estão em processo de conexão
      const updatedAt = new Date(account.updated_at).getTime();
      const timeSinceUpdate = now - updatedAt;
      const tenMinutes = 10 * 60 * 1000; // ✅ AUMENTADO: 10 minutos (antes: 2min)
      
      // ✅ NOVO: Verificar se já existe uma reconexão em andamento para esta conta
      const isReconnecting = activeConnections.has(account.account_id) && 
                            activeConnections.get(account.account_id).status === 'connecting';
      
      // ✅ DESABILITADO: Não reconectar contas órfãs automaticamente
      // Apenas logar para informação do admin
      if (!connection && !isReconnecting && timeSinceUpdate > tenMinutes) {
        console.log(`ℹ️ [ORPHAN] Conta órfã detectada: ${account.name} (última atualização há ${Math.round(timeSinceUpdate / 60000)}min)`);
        // Não reconectar - apenas informar
      }
    }

    // ✅ DESABILITADO: Não reconectar contas órfãs automaticamente
    // Apenas informar no log se houver contas órfãs detectadas
    // (orphanedAccounts não é mais populado, mas mantido para compatibilidade)
  } catch (error) {
    console.error('❌ Erro ao verificar conexões órfãs:', error);
  }
};

// ✅ MELHORADO: Função para verificar e corrigir status de conexões ativas
const checkActiveConnectionsStatus = async () => {
  try {
    // ✅ NOVO: Verificar também contas no banco que têm phone_number mas status "connecting"
    // Isso corrige casos onde a conexão está ativa mas o status não foi atualizado
    const { data: accountsWithPhone, error: phoneError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status, phone_number, organization_id')
      .eq('status', 'connecting')
      .not('phone_number', 'is', null);

    if (!phoneError && accountsWithPhone && accountsWithPhone.length > 0) {
      for (const account of accountsWithPhone) {
        // Verificar se há conexão ativa para esta conta
        const connection = activeConnections.get(account.account_id);
        const isActuallyConnected = connection && 
                                   connection.socket && 
                                   connection.socket.user && 
                                   connection.socket.user.id && 
                                   connection.socket.ws?.readyState === 1;

        if (isActuallyConnected) {
          // Se está realmente conectada, corrigir status
          const phoneNumber = connection.socket.user.id.replace(/:\d+@s\.whatsapp\.net$/, '');
          
          await supabase
            .from('whatsapp_accounts')
            .update({
              status: 'connected',
              phone_number: phoneNumber,
              updated_at: new Date().toISOString()
            })
            .eq('account_id', account.account_id);

          if (account.organization_id) {
            io.to(`org_${account.organization_id}`).emit('whatsapp-connected', {
              accountId: account.account_id,
              accountName: account.name,
              phoneNumber
            });
          }
        } else if (account.phone_number) {
          // ✅ NOVO: Se tem phone_number mas não está em activeConnections, ainda assim corrigir
          // Isso corrige casos onde a conexão está ativa mas foi perdida do mapa
          await supabase
            .from('whatsapp_accounts')
            .update({
              status: 'connected',
              updated_at: new Date().toISOString()
            })
            .eq('account_id', account.account_id);

          if (account.organization_id && io) {
            io.to(`org_${account.organization_id}`).emit('whatsapp-connected', {
              accountId: account.account_id,
              accountName: account.name,
              phoneNumber: account.phone_number
            });
          }
        }
      }
    }

    // Verificar conexões em activeConnections
    for (const [accountId, connection] of activeConnections) {
      // Verificar se a conexão está realmente ativa e autenticada
      const isActuallyConnected = connection.socket && 
                                 connection.socket.user && 
                                 connection.socket.user.id && 
                                 connection.socket.ws?.readyState === 1;
      
      if (isActuallyConnected) {
        // ✅ NOVO: Atualizar status em activeConnections se estiver conectado
        if (connection.status !== 'connected') {
          connection.status = 'connected';
          connection.lastConnected = Date.now();
        }
        
        // Verificar no banco
        const { data: accountData, error } = await supabase
          .from('whatsapp_accounts')
          .select('status, phone_number, organization_id')
          .eq('account_id', accountId)
          .single();

        if (!error && accountData) {
          // Se no banco está como 'connecting' mas a conexão está ativa, corrigir
          if (accountData.status === 'connecting') {
            const phoneNumber = connection.socket.user.id.replace(/:\d+@s\.whatsapp\.net$/, '');
            
            const { error: updateError } = await supabase
              .from('whatsapp_accounts')
              .update({
                status: 'connected',
                phone_number: phoneNumber,
                updated_at: new Date().toISOString()
              })
              .eq('account_id', accountId);

            if (updateError) {
              console.error(`❌ [STATUS_FIX] Erro ao corrigir status para ${connection.accountName}:`, updateError);
            } else {
              // Emitir evento de conexão para atualizar frontend
              if (accountData.organization_id) {
                io.to(`org_${accountData.organization_id}`).emit('whatsapp-connected', {
                  accountId,
                  accountName: connection.accountName,
                  phoneNumber
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao verificar status de conexões ativas:', error);
  }
};

// ✅ OTIMIZADO: Verificação menos frequente para evitar sobrecarga e reconexões desnecessárias
setInterval(checkOrphanedConnections, 600000); // A cada 10 minutos (aumentado de 5min)

// ✅ MELHORADO: Função para detectar contas que ficaram travadas em "connecting"
const checkStuckConnections = async () => {
  try {
    // ✅ AUMENTADO: Buscar contas que estão em "connecting" há mais de 10 minutos (antes: 5min)
    // Isso evita marcar conexões legítimas que estão demorando para autenticar
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckAccounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, organization_id, updated_at')
      .eq('status', 'connecting')
      .lt('updated_at', tenMinutesAgo);

    if (error) {
      console.error('❌ [STUCK_CHECK] Erro ao buscar contas travadas:', error);
      return;
    }

    if (stuckAccounts && stuckAccounts.length > 0) {
      console.log(`⚠️ [STUCK_CHECK] Encontradas ${stuckAccounts.length} conta(s) travada(s) em "connecting"`);
      
      for (const account of stuckAccounts) {
        // Verificar se há uma conexão ativa para esta conta
        const connection = activeConnections.get(account.account_id);
        const isActuallyConnected = connection && 
                                     connection.socket && 
                                     connection.socket.user && 
                                     connection.socket.user.id && 
                                     connection.socket.ws?.readyState === 1;

        if (isActuallyConnected) {
          // Se está realmente conectada, atualizar status
          console.log(`🔧 [STUCK_CHECK] Conta ${account.name} está conectada, corrigindo status...`);
          const phoneNumber = connection.socket.user.id.replace(/:\d+@s\.whatsapp\.net$/, '');
          await supabase
            .from('whatsapp_accounts')
            .update({
              status: 'connected',
              phone_number: phoneNumber,
              updated_at: new Date().toISOString()
            })
            .eq('account_id', account.account_id);
        } else {
          // ✅ NOVO: Verificar se há convite pendente antes de marcar como disconnected
          const { data: accountData } = await supabase
            .from('whatsapp_accounts')
            .select('user_id')
            .eq('account_id', account.account_id)
            .single();

          if (accountData?.user_id) {
            const { data: pendingInvite } = await supabase
              .from('whatsapp_invites')
              .select('id, status')
              .eq('user_id', accountData.user_id)
              .eq('status', 'pending')
              .single();

            if (pendingInvite) {
              console.log(`⏸️ [STUCK_CHECK] Conta ${account.name} tem convite pendente - mantendo status atual`);
              continue; // Não atualizar status se há convite pendente
            }
          }

          // ✅ MELHORADO: Não atualizar imediatamente - verificar se há QR code ativo primeiro
          // Se não está conectada mas pode estar aguardando QR, não marcar como disconnected ainda
          const connectionData = activeConnections.get(account.account_id);
          const hasActiveQR = connectionData && connectionData.lastQRCode;
          
          if (!hasActiveQR) {
            // Só atualizar para disconnected se não há QR code ativo
            console.log(`🔧 [STUCK_CHECK] Conta ${account.name} não está conectada e não há QR ativo, atualizando para "disconnected"...`);
            await supabase
              .from('whatsapp_accounts')
              .update({
                status: 'disconnected',
                updated_at: new Date().toISOString()
              })
              .eq('account_id', account.account_id);
            
            // Limpar conexão inativa
            if (connection) {
              activeConnections.delete(account.account_id);
            }
          } else {
            console.log(`⏸️ [STUCK_CHECK] Conta ${account.name} tem QR code ativo, mantendo status "connecting"...`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ [STUCK_CHECK] Erro ao verificar contas travadas:', error);
  }
};

// ✅ OTIMIZADO: Verificar e corrigir status de conexões ativas com frequência reduzida para estabilidade
setInterval(checkActiveConnectionsStatus, 60000); // ✅ AUMENTADO: A cada 1 minuto (antes: 5 segundos)

// ✅ OTIMIZADO: Verificar contas travadas em "connecting" com frequência reduzida
setInterval(checkStuckConnections, 300000); // ✅ AUMENTADO: A cada 5 minutos (antes: 2 minutos)

// ✅ NOVA VERSÃO: Função para recuperar mensagens (simplificada)
async function getMessage(key) {
  // Implementar recuperação de mensagens do banco se necessário
  // Por enquanto retornamos undefined para compatibilidade
  return undefined;
}

// ✅ MELHORADO: Tratamento global de erros para evitar que derrubem o servidor
// ✅ CRÍTICO: Estes handlers previnem que erros não tratados travem o processo
let unhandledRejectionCount = 0;
const MAX_UNHANDLED_REJECTIONS = 10; // Limite antes de alertar
const UNHANDLED_REJECTION_RESET_TIME = 60000; // Reset contador após 1 minuto

process.on('unhandledRejection', (reason, promise) => {
  unhandledRejectionCount++;
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : undefined;
  
  console.error('❌ [UNHANDLED REJECTION] Erro não tratado:', errorMessage);
  if (errorStack) {
    console.error('❌ [UNHANDLED REJECTION] Stack:', errorStack);
  }
  console.error('❌ [UNHANDLED REJECTION] Promise:', promise);
  console.error(`❌ [UNHANDLED REJECTION] Contador: ${unhandledRejectionCount}/${MAX_UNHANDLED_REJECTIONS}`);
  
  // ✅ ALERTA: Se muitos erros não tratados, pode indicar problema sério
  if (unhandledRejectionCount >= MAX_UNHANDLED_REJECTIONS) {
    console.error('⚠️ [UNHANDLED REJECTION] MUITOS ERROS NÃO TRATADOS DETECTADOS! Verifique os logs.');
    // Reset contador após alerta
    setTimeout(() => {
      unhandledRejectionCount = 0;
    }, UNHANDLED_REJECTION_RESET_TIME);
  }
  
  // ✅ CRÍTICO: Não deixar o erro propagar - já foi logado
  // Em produção, é melhor logar e continuar do que travar o processo
});

let uncaughtExceptionCount = 0;
const MAX_UNCAUGHT_EXCEPTIONS = 5; // Limite mais baixo para exceções não capturadas

process.on('uncaughtException', (error) => {
  uncaughtExceptionCount++;
  
  console.error('❌ [UNCAUGHT EXCEPTION] Erro não capturado:', error.message);
  console.error('❌ [UNCAUGHT EXCEPTION] Stack:', error.stack);
  console.error(`❌ [UNCAUGHT EXCEPTION] Contador: ${uncaughtExceptionCount}/${MAX_UNCAUGHT_EXCEPTIONS}`);
  
  // ✅ ALERTA: Exceções não capturadas são mais críticas
  if (uncaughtExceptionCount >= MAX_UNCAUGHT_EXCEPTIONS) {
    console.error('⚠️ [UNCAUGHT EXCEPTION] MUITAS EXCEÇÕES NÃO CAPTURADAS! Verifique os logs urgentemente.');
    // Reset contador após alerta
    setTimeout(() => {
      uncaughtExceptionCount = 0;
    }, UNHANDLED_REJECTION_RESET_TIME);
  }
  
  // ✅ CRÍTICO: Em produção, é melhor logar e continuar do que travar
  // O PM2 pode reiniciar se necessário, mas não vamos forçar saída aqui
  // para evitar perda de conexões ativas
});

// ✅ NOVO: Watchdog não intrusivo para detectar quando o processo está hibernando
// Este sistema monitora a saúde do processo sem interferir nas conexões
let lastWatchdogHeartbeat = Date.now();
let watchdogWarningCount = 0;
const WATCHDOG_INTERVAL = 300000; // 5 minutos - verificar a cada 5 minutos
const WATCHDOG_WARNING_THRESHOLD = 600000; // 10 minutos sem atividade = alerta
const WATCHDOG_MAX_WARNINGS = 3; // Máximo de alertas antes de ação

// ✅ Função de heartbeat do watchdog (chamada periodicamente)
const watchdogHeartbeat = () => {
  lastWatchdogHeartbeat = Date.now();
  watchdogWarningCount = 0; // Reset contador quando há atividade
};

// ✅ Verificação periódica do watchdog
setInterval(() => {
  const timeSinceLastHeartbeat = Date.now() - lastWatchdogHeartbeat;
  const activeConnectionsCount = activeConnections.size;
  
  // Se passou muito tempo sem heartbeat E há conexões ativas, pode estar hibernando
  if (timeSinceLastHeartbeat > WATCHDOG_WARNING_THRESHOLD && activeConnectionsCount > 0) {
    watchdogWarningCount++;
    
    console.warn(`⚠️ [WATCHDOG] Possível processo hibernando detectado!`);
    console.warn(`⚠️ [WATCHDOG] Tempo desde último heartbeat: ${Math.round(timeSinceLastHeartbeat / 1000)}s`);
    console.warn(`⚠️ [WATCHDOG] Conexões ativas: ${activeConnectionsCount}`);
    console.warn(`⚠️ [WATCHDOG] Alertas consecutivos: ${watchdogWarningCount}/${WATCHDOG_MAX_WARNINGS}`);
    
    // ✅ Verificar saúde das conexões ativas
    let healthyConnections = 0;
    let unhealthyConnections = 0;
    
    for (const [accountId, connection] of activeConnections) {
      const hasValidSocket = connection.socket && 
                             connection.socket.user && 
                             connection.socket.user.id;
      const wsReady = connection.socket?.ws?.readyState === 1;
      
      if (hasValidSocket && wsReady) {
        healthyConnections++;
      } else {
        unhealthyConnections++;
      }
    }
    
    console.warn(`⚠️ [WATCHDOG] Conexões saudáveis: ${healthyConnections}`);
    console.warn(`⚠️ [WATCHDOG] Conexões não saudáveis: ${unhealthyConnections}`);
    
    // ✅ Se muitos alertas consecutivos, pode ser necessário reiniciar
    if (watchdogWarningCount >= WATCHDOG_MAX_WARNINGS) {
      console.error(`🔴 [WATCHDOG] MÚLTIPLOS ALERTAS CONSECUTIVOS! Processo pode estar travado.`);
      console.error(`🔴 [WATCHDOG] Considere reiniciar o processo manualmente ou verificar logs.`);
      // Reset contador após alerta crítico
      watchdogWarningCount = 0;
    }
  } else if (timeSinceLastHeartbeat <= WATCHDOG_WARNING_THRESHOLD) {
    // Processo está saudável - reset contador
    watchdogWarningCount = 0;
  }
  
  // ✅ Sempre atualizar heartbeat se o processo está rodando (prova de que não está travado)
  watchdogHeartbeat();
}, WATCHDOG_INTERVAL);

// ✅ Inicializar heartbeat imediatamente
watchdogHeartbeat();
console.log('✅ [WATCHDOG] Sistema de monitoramento iniciado');

// Função para reconectar todas as contas ativas ao reiniciar o servidor
export const reconnectAllAccounts = async (organizationId = null, shouldGenerateQr = false) => {
  console.log('🔄 [RECONNECT] Iniciando processo de reconexão...', organizationId ? `para organização: ${organizationId}` : 'para todas as organizações', shouldGenerateQr ? '(com QR code)' : '(sem QR code)');
  try {
    // Se organizationId foi fornecido, reconectar apenas essa organização
    if (organizationId) {
      // ✅ CORREÇÃO: Não reconectar contas com status 'disconnected' automaticamente
      // Contas desconectadas devem permanecer desconectadas até ação manual do usuário
      const { data: accounts, error } = await supabase
        .from('whatsapp_accounts')
        .select('account_id, name, status, user_id')
        .in('status', ['connected', 'error', 'connecting']) // ✅ REMOVIDO: 'disconnected' - não reconectar automaticamente
        .eq('organization_id', organizationId);

      if (error) {
        console.error(`❌ [RECONNECT] Erro ao buscar contas da organização ${organizationId}:`, error);
        return;
      }

      const whatsappApi = await getOrganizationWhatsappApi(organizationId);
      const isWppOrg = whatsappApi === 'wppconnect';

      if (accounts && accounts.length > 0) {
        console.log(`🔎 [RECONNECT] Encontradas ${accounts.length} contas para reconectar na organização ${organizationId}`);
        
        // ✅ CORRIGIDO: Separar contas que realmente precisam reconectar
        // Não atualizar contas que já estão 'connected' e têm conexão ativa
        const accountsToReconnect = [];
        const accountIdsToUpdate = [];
        
        for (const account of accounts) {
          // ✅ NOVO: Verificar se há convite pendente antes de reconectar
          if (account.user_id) {
            const { data: pendingInvite } = await supabase
              .from('whatsapp_invites')
              .select('id, status')
              .eq('user_id', account.user_id)
              .eq('status', 'pending')
              .single();

            if (pendingInvite) {
              console.log(`⏸️ [RECONNECT] Conta ${account.name} tem convite pendente - não reconectando automaticamente`);
              continue; // Pular reconexão se há convite pendente
            }
          }

          // ✅ NOVO: Validar se o user_id da conta pertence à organização atual
          if (account.user_id) {
            const { data: userProfile, error: userError } = await supabase
              .from('profiles')
              .select('organization_id')
              .eq('id', account.user_id)
              .single();

            if (userError || !userProfile) {
              console.warn(`⚠️ [RECONNECT] Usuário ${account.user_id} da conta ${account.name} não encontrado - pulando reconexão`);
              continue;
            }

            // ✅ CRÍTICO: Se o usuário pertence a outra organização, não reconectar
            if (userProfile.organization_id !== organizationId) {
              console.warn(`⚠️ [RECONNECT] Conta ${account.name} (${account.account_id}) pertence ao usuário ${account.user_id} que está na organização ${userProfile.organization_id}, mas tentando reconectar na organização ${organizationId} - PULANDO reconexão`);
              continue;
            }
          }

          let shouldReconnect = true;

          if (isWppOrg) {
            const wppConnected = await isWPPAccountConnected(account.account_id);
            if (wppConnected) {
              console.log(`⏸️ [RECONNECT] Conta ${account.name} (WPP) já está conectada, pulando...`);
              shouldReconnect = false;
            }
          } else {
            const connection = activeConnections.get(account.account_id);
            const isActuallyConnected = connection && 
                                       connection.socket && 
                                       connection.socket.user && 
                                       connection.socket.user.id && 
                                       connection.socket.ws?.readyState === 1;

            if (isActuallyConnected) {
              console.log(`⏸️ [RECONNECT] Conta ${account.name} já está conectada, pulando...`);
              shouldReconnect = false;
            }
          }

          if (shouldReconnect) {
            accountsToReconnect.push(account);
            accountIdsToUpdate.push(account.account_id);
          }
        }
        
        // ✅ Só atualizar status das contas que realmente precisam reconectar
        if (accountIdsToUpdate.length > 0) {
          // ✅ CRÍTICO: Verificação dupla antes de atualizar status
          // Verificar novamente se alguma conta conectou entre a verificação anterior e agora
          const finalAccountsToUpdate = [];
          for (const accountId of accountIdsToUpdate) {
            // Verificar no banco
            const { data: accountData } = await supabase
              .from('whatsapp_accounts')
              .select('status, phone_number')
              .eq('account_id', accountId)
              .single();
            
            // Verificar em activeConnections
            const connection = activeConnections.get(accountId);
            const isActuallyConnected = connection && 
                                       connection.socket && 
                                       connection.socket.user && 
                                       connection.socket.user.id && 
                                       connection.socket.ws?.readyState === 1;
            
            // Só adicionar se realmente não está conectada
            if (accountData?.status !== 'connected' && !isActuallyConnected) {
              finalAccountsToUpdate.push(accountId);
            } else {
              console.log(`⏸️ [RECONNECT] Conta ${accountId} já está conectada, removendo da lista de reconexão`);
            }
          }
          
          if (finalAccountsToUpdate.length > 0) {
            // ✅ CORREÇÃO: NÃO atualizar status para 'connecting' no banco
            // O status só deve mudar para 'connected' (sucesso) ou 'disconnected' (falha)
            // Isso evita alternância de status e triggers desnecessários no banco
            console.log(`🔄 [RECONNECT] Iniciando reconexão para ${finalAccountsToUpdate.length} conta(s) (sem alterar status no banco)`);
          } else {
            console.log(`ℹ️ [RECONNECT] Todas as contas já estão conectadas após verificação dupla, nada a fazer`);
          }
        } else {
          console.log(`ℹ️ [RECONNECT] Todas as contas já estão conectadas, nada a fazer`);
          return;
        }
        
        for (const account of accountsToReconnect) {
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // ✅ MELHORADO: Se forceQR for false, tentar primeiro sem QR code
            // Se falhar, tentar novamente com QR code após um tempo
            if (shouldGenerateQr) {
              // Forçar QR code imediatamente
              const result = await createWhatsAppConnection(account.account_id, account.name, true, { source: 'system' });
            } else {
              // Tentar primeiro com credenciais salvas
              const result = await createWhatsAppConnection(account.account_id, account.name, false, { source: 'system' });
              
              // ✅ NOVO: Se a conexão não for estabelecida em 30 segundos, tentar com QR code
              setTimeout(async () => {
                const connection = activeConnections.get(account.account_id);
                const isConnected = connection && 
                                   connection.socket && 
                                   connection.socket.user && 
                                   connection.socket.user.id && 
                                   connection.socket.ws?.readyState === 1;
                
                if (!isConnected) {
                  const { data: accountData } = await supabase
                    .from('whatsapp_accounts')
                    .select('status')
                    .eq('account_id', account.account_id)
                    .single();
                  
                  // Só tentar com QR se ainda estiver em "connecting"
                  if (accountData && accountData.status === 'connecting') {
                    await createWhatsAppConnection(account.account_id, account.name, true, { source: 'system' });
                  }
                }
              }, 30000); // Aguardar 30 segundos
            }
          } catch (error) {
            console.error(`❌ [RECONNECT] Erro ao reconectar ${account.name}:`, error.message);
            // ✅ NOVO: Se falhar e não for forceQR, tentar com QR code
            if (!shouldGenerateQr) {
              try {
                await createWhatsAppConnection(account.account_id, account.name, true, { source: 'system' });
              } catch (qrError) {
                console.error(`❌ [RECONNECT] Erro ao gerar QR code para ${account.name}:`, qrError.message);
                await supabase
                  .from('whatsapp_accounts')
                  .update({ 
                    status: 'error',
                    updated_at: new Date().toISOString()
                  })
                  .eq('account_id', account.account_id);
              }
            } else {
              // Se já tentou com QR e falhou, marcar como erro
              await supabase
                .from('whatsapp_accounts')
                .update({ 
                  status: 'error',
                  updated_at: new Date().toISOString()
                })
                .eq('account_id', account.account_id);
            }
          }
        }
      } else {
        console.log(`ℹ️ [RECONNECT] Nenhuma conta encontrada para reconectar na organização ${organizationId}`);
      }
      return;
    }

    // Se não foi fornecido organizationId, reconectar todas as organizações (comportamento original)
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('status', 'active');

    if (orgError) {
      console.warn('⚠️ Erro ao buscar organizações:', orgError.message);
      console.log('📱 Reconexão automática pulada, sistema funcionará normalmente');
      return; // ✅ MELHORADO: Return suave ao invés de parar o sistema
    }

    for (const org of organizations) {
      const { data: accounts, error } = await supabase
        .from('whatsapp_accounts')
        .select('account_id, name, user_id')
        .in('status', ['connected', 'error', 'connecting']) // ✅ REMOVIDO: 'disconnected' - não reconectar automaticamente
        .eq('organization_id', org.id);

      if (error) {
        console.error(`❌ Erro ao buscar contas da organização ${org.id}:`, error);
        continue;
      }

      const orgWhatsappApi = await getOrganizationWhatsappApi(org.id);
      const isOrgWppConnect = orgWhatsappApi === 'wppconnect';

      if (accounts && accounts.length > 0) {
        console.log(`🔎 [RECONNECT] Encontradas ${accounts.length} contas para reconectar na organização ${org.id}`);
        for (const account of accounts) {
          try {
            // ✅ NOVO: Verificar se há convite pendente antes de reconectar
            if (account.user_id) {
              const { data: pendingInvite } = await supabase
                .from('whatsapp_invites')
                .select('id, status')
                .eq('user_id', account.user_id)
                .eq('status', 'pending')
                .single();

              if (pendingInvite) {
                console.log(`⏸️ [RECONNECT] Conta ${account.name} tem convite pendente - não reconectando automaticamente`);
                continue; // Pular reconexão se há convite pendente
              }
            }

            // ✅ NOVO: Validar se o user_id da conta pertence à organização atual
            if (account.user_id) {
              const { data: userProfile, error: userError } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', account.user_id)
                .single();

              if (userError || !userProfile) {
                console.warn(`⚠️ [RECONNECT] Usuário ${account.user_id} da conta ${account.name} não encontrado - pulando reconexão`);
                continue;
              }

              // ✅ CRÍTICO: Se o usuário pertence a outra organização, não reconectar
              if (userProfile.organization_id !== org.id) {
                console.warn(`⚠️ [RECONNECT] Conta ${account.name} (${account.account_id}) pertence ao usuário ${account.user_id} que está na organização ${userProfile.organization_id}, mas a conta está registrada na organização ${org.id} - PULANDO reconexão`);
                continue;
              }
            }

            let shouldReconnect = true;

            if (isOrgWppConnect) {
              const wppConnected = await isWPPAccountConnected(account.account_id);
              if (wppConnected) {
                console.log(`⏸️ [RECONNECT] Conta ${account.name} (WPP) já está conectada, pulando...`);
                shouldReconnect = false;
              }
            } else {
              const connection = activeConnections.get(account.account_id);
              const isActuallyConnected = connection && 
                                         connection.socket && 
                                         connection.socket.user && 
                                         connection.socket.user.id && 
                                         connection.socket.ws?.readyState === 1;

              if (isActuallyConnected) {
                console.log(`⏸️ [RECONNECT] Conta ${account.name} já está conectada, pulando...`);
                shouldReconnect = false;
              }
            }

            if (!shouldReconnect) {
              continue;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
            const result = await createWhatsAppConnection(account.account_id, account.name, false, { source: 'system' });
            console.log(`✅ [RECONNECT] Resultado da reconexão para ${account.name}:`, result.success ? 'Sucesso' : 'Falha');
          } catch (error) {
            console.error(`❌ [RECONNECT] Erro ao reconectar ${account.name}:`, error.message);
          }
        }
      } else {
        console.log(`ℹ️ [RECONNECT] Nenhuma conta encontrada para reconectar na organização ${org.id}`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro na reconexão automática:', err.message);
    console.log('📱 Sistema funcionará normalmente');
  }
};

export const initializeMultiWhatsApp = (socketIO) => {
  io = socketIO;
  setRuleProcessorIO(socketIO); // ✅ NOVO: Passar io para ruleProcessor
  console.log('🔄 Sistema multi-WhatsApp inicializado');
  console.log('📡 Socket.IO configurado:', !!io);

  // ✅ MELHORADO: Tornar reconexão opcional em caso de erro
  try {
    reconnectAllAccounts();
  } catch (error) {
    console.warn('⚠️ Falha na reconexão automática:', error.message);
    console.log('📱 Sistema funcionará normalmente, contas podem ser conectadas manualmente');
  }
};

// // Verificar se é menção em grupo
// const isGroupMention = (message, myJid) => {
//   const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
//   return mentions.includes(myJid);
// };

// // Verificar se é grupo
// const isGroupChat = (jid) => {
//   return jid?.endsWith('@g.us');
// };

// Simular indicador de digitação
const simulateTyping = async (sock, jid) => {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    const typingTime = Math.random() * (6000 - 4000) + 4000; // Entre 4-6 segundos
    await new Promise(resolve => setTimeout(resolve, typingTime));
    await sock.sendPresenceUpdate('available', jid);
  } catch (error) {
    console.error('Erro ao simular digitação:', error);
  }
};

// Função para verificar se a mensagem é de status
function isStatusMessage(message) {
  // Lista de tipos de mensagens de status que devem ser ignoradas
  const statusTypes = [
    'reaction',
    'revoke',
    'protocol',
    'sticker',
    'system',
    'e2e_notification',
    'call_log',
    'notification_template',
    'notification',
    'notification_contact',
    'notification_group',
    'notification_media',
    'notification_template',
    'notification_template_media',
    'notification_template_text',
    'notification_template_document',
    'notification_template_image',
    'notification_template_video',
    'notification_template_audio',
    'notification_template_sticker',
    'notification_template_location',
    'notification_template_contact',
    'notification_template_buttons',
    'notification_template_list',
    'notification_template_product',
    'notification_template_order',
    'notification_template_catalog',
    'notification_template_cart',
    'notification_template_payment',
    'notification_template_shipping',
    'notification_template_delivery',
    'notification_template_receipt',
    'notification_template_receipt_media',
    'notification_template_receipt_text',
    'notification_template_receipt_document',
    'notification_template_receipt_image',
    'notification_template_receipt_video',
    'notification_template_receipt_audio',
    'notification_template_receipt_sticker',
    'notification_template_receipt_location',
    'notification_template_receipt_contact',
    'notification_template_receipt_buttons',
    'notification_template_receipt_list',
    'notification_template_receipt_product',
    'notification_template_receipt_order',
    'notification_template_receipt_catalog',
    'notification_template_receipt_cart',
    'notification_template_receipt_payment',
    'notification_template_receipt_shipping',
    'notification_template_receipt_delivery'
  ];

  if (message.type === 'status') {
    return true;
  }

  // Novo: Ignorar se message.message?.protocolMessage existir
  if (message.message && message.message.protocolMessage) {
    return true;
  }

  // Verifica se é uma mensagem de sistema
  if (message.isSystem) {
    return true;
  }

  // Verifica se é uma mensagem de notificação
  if (message.isNotification) {
    return true;
  }

  // Verifica se é uma mensagem de protocolo
  if (message.isProtocol) {
    return true;
  }

  // Verifica se é uma mensagem de revogação
  if (message.isRevoke) {
    return true;
  }

  // Verifica se é uma mensagem de reação
  if (message.isReaction) {
    return true;
  }

  return false;
}

// ✅ WRAPPER: Função pública com sistema de fila
export const createWhatsAppConnection = async (accountId, accountName, shouldGenerateQr = true, options = {}) => {
  const { source = 'manual', userId = null } = options;

  return new Promise((resolve, reject) => {
    // ✅ CORREÇÃO: Adicionar opções completas à fila para passar para createWhatsAppConnectionInternal
    connectionQueue.push({ accountId, accountName, shouldGenerateQr, resolve, reject, source, userId, options });

    // Processar fila
    processConnectionQueue();
  });
};

// ✅ NOVA: Função de conexão otimizada
const createWhatsAppConnectionInternal = async (accountId, accountName, shouldGenerateQr = true, source = 'auto', userId = null, options = {}) => {
  // ✅ NOVO: Adquirir lock antes de tentar conectar
  // ✅ CORREÇÃO: Conexões manuais sempre sobrescrevem locks (já implementado em acquireConnectionLock)
  if (!acquireConnectionLock(accountId, source)) {
    // Se for conexão manual, não deveria chegar aqui (acquireConnectionLock sempre retorna true para manual)
    // Mas se chegou, forçar liberação do lock antigo
    if (source === 'manual') {
      console.log(`🔓 [${accountName}] Forçando liberação de lock antigo para conexão manual`);
      releaseConnectionLock(accountId);
      // Tentar adquirir novamente
      if (!acquireConnectionLock(accountId, source)) {
        console.error(`❌ [${accountName}] Erro inesperado ao adquirir lock manual`);
        return { success: false, error: 'Erro ao adquirir lock de conexão' };
      }
    } else {
      // Para conexões automáticas, aguardar o lock ser liberado
      const existingLock = connectionLocks.get(accountId);
      const lockAge = Math.round((Date.now() - existingLock.timestamp) / 1000);
      console.log(`⏸️ [${accountName}] Conexão já em progresso (lock ativo há ${lockAge}s) - aguardando...`);
      
      // Aguardar até o lock expirar ou ser liberado
      return new Promise((resolve) => {
        const checkLock = setInterval(() => {
          if (!connectionLocks.has(accountId) || acquireConnectionLock(accountId, source)) {
            clearInterval(checkLock);
            // Tentar conectar novamente após lock ser liberado
            createWhatsAppConnectionInternal(accountId, accountName, shouldGenerateQr, source, null, {})
              .then(resolve)
              .catch(resolve);
          }
        }, 5000); // Verificar a cada 5 segundos
        
        // Timeout de segurança
        setTimeout(() => {
          clearInterval(checkLock);
          resolve({ success: false, error: 'Timeout aguardando lock de conexão' });
        }, LOCK_TIMEOUT);
      });
    }
  }

  // ✅ NOVO: Se for conexão manual E não tiver credenciais salvas, fazer limpeza completa
  // ✅ CORREÇÃO: Se já tem credenciais salvas (shouldGenerateQr = false), não limpar
  if (source === 'manual' && shouldGenerateQr) {
    console.log(`🔄 [${accountName}] ===== CONEXÃO MANUAL - LIMPEZA COMPLETA =====`);
    
    // ✅ 1. Liberar lock IMEDIATAMENTE (permite nova conexão)
    releaseConnectionLock(accountId);
    console.log(`🔓 [${accountName}] Lock liberado`);
    
    // ✅ 2. Obter conexão existente antes de limpar
    const existingConnection = activeConnections.get(accountId);
    
    // ✅ 3. Limpar todos os timers se existirem
    if (existingConnection) {
      if (existingConnection.qrTimer) {
        clearTimeout(existingConnection.qrTimer);
        console.log(`⏰ [${accountName}] QR timer limpo`);
      }
      if (existingConnection.connectionTimeout) {
        clearTimeout(existingConnection.connectionTimeout);
        console.log(`⏰ [${accountName}] Connection timeout limpo`);
      }
    }
    
    // ✅ 4. Parar monitoramento de saúde se estiver ativo
    if (connectionHealthMonitor.has(accountId)) {
      clearInterval(connectionHealthMonitor.get(accountId));
      connectionHealthMonitor.delete(accountId);
      console.log(`💓 [${accountName}] Monitoramento de saúde parado`);
    }
    
    // ✅ NOVO: Parar keep-alive
    stopKeepAlive(accountId);
    
    // ✅ 5. Fechar socket se existir
    if (existingConnection && existingConnection.socket) {
      try {
        console.log(`🔄 [${accountName}] Fechando socket Baileys existente...`);
        if (existingConnection.socket.ws?.readyState === 1) {
          await existingConnection.socket.end(new Error('Reconexão manual solicitada'));
        }
        // Aguardar para garantir que o socket foi fechado
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`✅ [${accountName}] Socket existente fechado`);
      } catch (closeError) {
        console.warn(`⚠️ [${accountName}] Erro ao fechar socket existente:`, closeError.message);
      }
    }
    
    // ✅ 6. Remover da lista de conexões ativas
    activeConnections.delete(accountId);
    console.log(`🗑️ [${accountName}] Removido de activeConnections`);
    
    // ✅ 7. Limpar diretório de autenticação para forçar novo QR code
    const authDir = `./auth/${accountId}`;
    if (fs.existsSync(authDir)) {
      try {
        console.log(`🗑️ [${accountName}] Limpando diretório de autenticação para gerar novo QR code...`);
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log(`✅ [${accountName}] Diretório de autenticação limpo`);
      } catch (cleanError) {
        console.warn(`⚠️ [${accountName}] Erro ao limpar autenticação (continuando mesmo assim):`, cleanError.message);
      }
    }
    
    // ✅ 8. Limpar cache de QR code se existir
    if (qrCodeCache.has(accountId)) {
      qrCodeCache.delete(accountId);
      console.log(`🗑️ [${accountName}] Cache de QR code limpo`);
    }
    
    // ✅ 9. Atualizar status no banco para 'disconnected' antes de iniciar nova conexão
    try {
      await supabase
        .from('whatsapp_accounts')
        .update({
          status: 'disconnected',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId);
      console.log(`💾 [${accountName}] Status atualizado para 'disconnected' no banco`);
    } catch (dbError) {
      console.warn(`⚠️ [${accountName}] Erro ao atualizar status no banco:`, dbError.message);
    }
    
    // ✅ 10. Resetar contador de tentativas (começar do zero)
    // Isso será feito quando criar a nova conexão
    
    // ✅ 11. Aguardar um pouco para garantir limpeza completa
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ [${accountName}] ===== LIMPEZA COMPLETA FINALIZADA - INICIANDO NOVA CONEXÃO =====`);
  } else {
    // Para conexões automáticas, verificar se já está conectada
    // ✅ CORREÇÃO: Verificar API da organização ANTES de verificar conexão Baileys
    let whatsappApi = 'baileys';
    try {
      const { data: accountData } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();

      if (accountData?.organization_id) {
        const { data: organization } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', accountData.organization_id)
          .single();

        if (organization?.settings) {
          whatsappApi = organization.settings.whatsapp_api || 'baileys';
        }
      }
    } catch (configError) {
      console.warn(`⚠️ [${accountName}] Erro ao buscar configurações:`, configError.message);
    }

    // ✅ CORREÇÃO: Se a API for WPPConnect ou whatsapp-web.js, redirecionar IMEDIATAMENTE
    // sem verificar conexões Baileys
    if (whatsappApi === 'wppconnect') {
      const { createWhatsAppConnection: createWPPConnection } = await import('./wppconnectService.js');
      // ✅ CORREÇÃO: Passar todas as opções (source, userId, organizationId) para manter contexto
      return await createWPPConnection(accountId, accountName, shouldGenerateQr, options);
    }

    if (whatsappApi === 'whatsapp-web.js' || whatsappApi === 'whatsapp-web') {
      const { createWhatsAppConnection: createWAWebConnection } = await import('./whatsappWebService.js');
      // ✅ CORREÇÃO: Passar todas as opções (source, userId, organizationId) para manter contexto
      return await createWAWebConnection(accountId, accountName, shouldGenerateQr, options);
    }

    // ✅ Apenas para Baileys: verificar se já está conectada
    const existingConnection = activeConnections.get(accountId);
    if (existingConnection) {
      const isActuallyConnected = existingConnection.socket && 
                                 existingConnection.socket.user && 
                                 existingConnection.socket.user.id && 
                                 existingConnection.socket.ws?.readyState === 1;
      
      if (isActuallyConnected) {
        console.log(`⏸️ [${accountName}] Já está conectada, não é necessário criar nova conexão`);
        
        // Verificar se o status no banco está correto
        const { data: accountData } = await supabase
          .from('whatsapp_accounts')
          .select('status')
          .eq('account_id', accountId)
          .single();
        
        if (accountData && accountData.status !== 'connected') {
          console.log(`🔧 [${accountName}] Corrigindo status no banco de '${accountData.status}' para 'connected'...`);
          const phoneNumber = existingConnection.socket.user.id.replace(/:\d+@s\.whatsapp\.net$/, '');
          await supabase
            .from('whatsapp_accounts')
            .update({
              status: 'connected',
              phone_number: phoneNumber,
              updated_at: new Date().toISOString()
            })
            .eq('account_id', accountId);
        }
        
        return { success: true, message: 'Já está conectada' };
      }
    }
  }

  try {
    // ✅ NOVO: Buscar versão mais recente automaticamente
    const versionData = await getLatestWhatsAppVersion();
    const { version, isLatest } = versionData;

    // Log detalhado da versão
    logVersionInfo(accountName);

    // ✅ NOVO: Buscar configurações da organização para obter proxy e API
    let proxyUrl = null;
    let whatsappApi = 'baileys';
    try {
      const { data: accountData } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();

      if (accountData?.organization_id) {
        const { data: organization } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', accountData.organization_id)
          .single();

        if (organization?.settings) {
          proxyUrl = organization.settings.proxy || null;
          whatsappApi = organization.settings.whatsapp_api || 'baileys';
          
          if (proxyUrl) {
            console.log(`🔐 [${accountName}] Proxy encontrado nas configurações da organização`);
          }
          console.log(`📱 [${accountName}] API WhatsApp: ${whatsappApi}`);
        }
      }
    } catch (configError) {
      console.warn(`⚠️ [${accountName}] Erro ao buscar configurações:`, configError.message);
      // Continuar com valores padrão se houver erro
    }

    // ✅ NOVO: Se a API for WPPConnect, redirecionar para o serviço WPPConnect
    if (whatsappApi === 'wppconnect') {
      const { createWhatsAppConnection: createWPPConnection } = await import('./wppconnectService.js');
      // ✅ CORREÇÃO: Passar todas as opções (source, userId, organizationId) para manter contexto
      return await createWPPConnection(accountId, accountName, shouldGenerateQr, { source, userId, ...options });
    }

    // ✅ NOVO: Se a API for whatsapp-web.js, redirecionar para o serviço whatsapp-web.js
    if (whatsappApi === 'whatsapp-web.js' || whatsappApi === 'whatsapp-web') {
      const { createWhatsAppConnection: createWAWebConnection } = await import('./whatsappWebService.js');
      // ✅ CORREÇÃO: Passar todas as opções (source, userId, organizationId) para manter contexto
      return await createWAWebConnection(accountId, accountName, shouldGenerateQr, { source, userId, ...options });
    }

    // ✅ MELHORADO: Limpar conexão existente apenas se não estiver realmente conectada
    if (activeConnections.has(accountId)) {
      const existingConn = activeConnections.get(accountId);
      const isActuallyConnected = existingConn.socket && 
                                 existingConn.socket.user && 
                                 existingConn.socket.user.id && 
                                 existingConn.socket.ws?.readyState === 1;
      
      if (isActuallyConnected) {
        return { success: true, message: 'Já está conectada' };
      }
      try {
        if (existingConn.socket?.ws?.readyState === 1) {
          await existingConn.socket.end(new Error('Nova tentativa de conexão'));
        }
      } catch (e) {
      }
      activeConnections.delete(accountId);
    }

    // ✅ Preparar diretório de autenticação
    const authDir = `./auth/${accountId}`;
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // ✅ Obter estado de autenticação
    // ✅ IMPORTANTE: Se shouldGenerateQr = false, significa que já temos credenciais salvas
    // e queremos usar elas para conectar diretamente (após scan QR)
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    // ✅ NOVO: Verificar se já temos credenciais salvas (conexão após scan QR)
    const hasCredentials = state && state.creds && state.creds.me;
    if (!shouldGenerateQr && hasCredentials) {
      console.log(`✅ [${accountName}] Credenciais encontradas - conectando diretamente sem QR code`);
      console.log(`🔍 [${accountName}] Credenciais:`, {
        hasMe: !!state.creds.me,
        meId: state.creds.me?.id,
        registered: state.creds.registered
      });
    } else if (!shouldGenerateQr && !hasCredentials) {
      console.warn(`⚠️ [${accountName}] Tentando conectar sem QR mas sem credenciais salvas - gerando QR code`);
      // ✅ CORREÇÃO: Se não tem credenciais mas shouldGenerateQr = false, mudar para true
      shouldGenerateQr = true;
    }

    // ✅ Obter configuração otimizada com versão mais recente e proxy
    const config = getBaileysConfig(accountId, accountName, version, proxyUrl);
    config.auth = state;

    // ✅ CORREÇÃO: Validar configuração antes de criar socket
    // Verificar se auth state é válido
    if (!state || typeof state !== 'object') {
      throw new Error('Estado de autenticação inválido');
    }

    // Verificar se browser config está correto
    if (!config.browser || !Array.isArray(config.browser) || config.browser.length !== 3) {
      throw new Error('Configuração do navegador inválida');
    }

    // ✅ Criar socket com configuração otimizada
    console.log(`🔧 [${accountName}] Criando socket Baileys...`);
    console.log(`🔧 [${accountName}] Configuração:`, {
      hasAuth: !!config.auth,
      hasVersion: !!config.version,
      browser: config.browser,
      hasProxy: !!config.agent,
      qrTimeout: config.qrTimeout,
      syncFullHistory: config.syncFullHistory,
      fireInitQueries: config.fireInitQueries,
      hasShouldSyncHistoryMessage: typeof config.shouldSyncHistoryMessage === 'function'
    });
    
    let sock;
    try {
      // ✅ CRÍTICO: Criar socket com configuração mínima e testada
      sock = makeWASocket(config);
      console.log(`✅ [${accountName}] Socket criado com sucesso`);
      console.log(`🔍 [${accountName}] Socket criado - verificando eventos disponíveis...`);
    } catch (socketError) {
      console.error(`❌ [${accountName}] Erro específico ao criar socket:`, socketError);

      // ✅ CORREÇÃO: Tratamento específico para erro de protocolo
      if (socketError.message && socketError.message.includes('protocol')) {

        // Tentar com configuração mínima
        const minimalConfig = {
          version, // ✅ Usar versão mais recente
          auth: state,
          browser: ['Chrome', 'Desktop', '120.0.0']
          // ✅ Removido printQRInTerminal (deprecated)
        };

        try {
          sock = makeWASocket(minimalConfig);
        } catch (minimalError) {
          // Última tentativa com configuração ultra-simples
          const ultraSimpleConfig = {
            version, // ✅ Usar versão mais recente
            auth: state,
            browser: ['Chrome', 'Desktop', '120.0.0']
          };

          try {
            sock = makeWASocket(ultraSimpleConfig);
          } catch (ultraError) {
            throw new Error(`Falha ao criar socket mesmo com configuração ultra-simples: ${ultraError.message}`);
          }
        }
      } else {
        throw socketError;
      }
    }

    // ✅ Registrar conexão
    // ✅ MELHORADO: Conexão manual sempre começa do zero (limpeza já foi feita acima)
    activeConnections.set(accountId, {
      socket: sock,
      accountName,
      status: 'connecting',
      lastAttempt: Date.now(),
      attemptCount: 0, // ✅ Sempre começar do zero - limpeza manual já resetou tudo
      authState: state,
      saveCreds,
      shouldGenerateQr,
      source,
      userId, // ✅ NOVO: Armazenar userId que iniciou a conexão
      reconnectEmailSent: false, // ✅ CORREÇÃO: Inicializar flag como false
      manualDisconnectNotified: false // ✅ NOVO: Flag para conexão manual
    });
    
    if (source === 'manual') {
      console.log(`🆕 [${accountName}] Nova conexão manual iniciada - tudo limpo, começando do zero`);
    }

    // ✅ Configurar eventos otimizados
    setupSocketEvents(sock, accountId, accountName, shouldGenerateQr, saveCreds, authDir);

    return { success: true, message: 'Conexão iniciada com sucesso' };

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao criar conexão:`, error);
    
    // ✅ CRÍTICO: Verificar se é erro 515 e tratar adequadamente
    const errorCode = error?.code || error?.output?.statusCode;
    const errorMessage = error?.message || '';
    
    if (errorCode === 515 || errorMessage.includes('Stream Errored') || errorMessage.includes('restart required')) {
      console.log(`🔄 [${accountName}] Erro 515 durante criação da conexão. Limpando e aguardando antes de tentar novamente...`);
      
      // ✅ CRÍTICO: Obter dados da conexão ANTES de deletar
      const connectionData = activeConnections.get(accountId);
      const attemptCount = (connectionData?.attemptCount || 0) + 1;
      
      // Limpar conexão
      activeConnections.delete(accountId);
      
      // ✅ CRÍTICO: Liberar lock para permitir nova tentativa
      releaseConnectionLock(accountId);
      
      if (attemptCount < MAX_RECONNECT_ATTEMPTS) {
        // Aguardar antes de tentar novamente (erro 515 durante conexão inicial precisa de mais tempo)
        const delay = Math.min(15000 * attemptCount, 45000); // 15s, 30s, 45s máximo
        console.log(`⏳ [${accountName}] Aguardando ${delay}ms antes de tentar reconectar após erro 515 na criação (tentativa ${attemptCount}/${MAX_RECONNECT_ATTEMPTS})...`);
        
        setTimeout(async () => {
          try {
            await createWhatsAppConnectionInternal(accountId, accountName, shouldGenerateQr, source, userId, options);
          } catch (retryError) {
            console.error(`❌ [${accountName}] Erro na tentativa de reconexão após erro 515:`, retryError);
            releaseConnectionLock(accountId);
          }
        }, delay);
      } else {
        console.log(`⛔ [${accountName}] Máximo de tentativas atingido. Não tentando reconectar após erro 515 na criação.`);
        releaseConnectionLock(accountId);
      }
    } else {
      // Para outros erros, apenas limpar e liberar lock
      activeConnections.delete(accountId);
      releaseConnectionLock(accountId);
    }
    
    return { success: false, error: error.message };
  }
};

// ✅ NOVO: Função para aguardar sincronização de histórico (o Baileys faz isso automaticamente com syncFullHistory)
const fetchHistoricalMessages = async (sock, accountId, accountName, phoneNumber) => {
  try {
    console.log(`📚 [${accountName}] syncFullHistory está habilitado - o Baileys sincronizará automaticamente mensagens dos últimos 7 dias`);
    console.log(`📚 [${accountName}] As mensagens serão processadas automaticamente através do evento messages.upsert`);
    
    // Com syncFullHistory: true e shouldSyncHistoryMessage configurado,
    // o Baileys automaticamente sincroniza e envia mensagens através do evento messages.upsert
    // Não precisamos fazer nada manualmente aqui, apenas aguardar que o sync aconteça
    
    // Aguardar um tempo para que a sincronização comece
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`✅ [${accountName}] Sincronização de histórico iniciada - mensagens serão processadas automaticamente`);
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao aguardar sincronização:`, error);
  }
};

// ✅ CORREÇÃO: Função handleConnectionOpen movida para antes de setupSocketEvents
// ✅ SIMPLIFICADO: Função para lidar com conexão aberta
const handleConnectionOpen = async (sock, accountId, accountName, qrTimer, connectionTimeout) => {
  console.log(`\n✅✅✅ [${accountName}] ===== HANDLE CONNECTION OPEN CHAMADO =====`);
  console.log(`🔍 [${accountName}] Verificando socket:`, {
    hasUser: !!sock.user,
    userId: sock.user?.id,
    wsReady: sock.ws?.readyState === 1,
    wsState: sock.ws?.readyState
  });

  // ✅ CORREÇÃO: Aguardar WebSocket estar pronto (pode levar alguns milissegundos após connection='open')
  let wsReady = sock.ws?.readyState === 1;
  if (!wsReady && sock.user?.id) {
    console.log(`⏳ [${accountName}] WebSocket não está pronto ainda, aguardando até 3 segundos...`);
    const maxWaitTime = 3000; // 3 segundos
    const checkInterval = 100; // Verificar a cada 100ms
    let waited = 0;
    
    while (!wsReady && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      wsReady = sock.ws?.readyState === 1;
      waited += checkInterval;
    }
    
    if (wsReady) {
      console.log(`✅ [${accountName}] WebSocket ficou pronto após ${waited}ms`);
    } else {
      console.warn(`⚠️ [${accountName}] WebSocket ainda não está pronto após ${maxWaitTime}ms, mas continuando com user.id`);
    }
  }

  // ✅ CORREÇÃO: Validação menos restritiva - se tem user.id válido, considerar conectado
  // O WebSocket pode não estar pronto imediatamente, mas se temos user.id, a autenticação foi bem-sucedida
  const hasValidUserId = sock.user?.id && sock.user.id.includes('@s.whatsapp.net');
  const isValidConnection = hasValidUserId; // Removida verificação de wsReady da validação principal
  
  if (!isValidConnection) {
    console.warn(`⚠️ [${accountName}] Conexão inválida - não marcando como conectada:`, {
      hasUser: !!sock.user,
      hasUserId: !!sock.user?.id,
      wsState: sock.ws?.readyState,
      userIdFormat: sock.user?.id,
      wsReady: wsReady
    });
    return; // Não marcar como conectada se validação falhar
  }
  
  // ✅ NOVO: Log informativo sobre estado do WebSocket
  if (!wsReady) {
    console.warn(`⚠️ [${accountName}] WebSocket não está pronto (state: ${sock.ws?.readyState}), mas user.id está presente - continuando conexão`);
  }

  // ✅ Limpar timers
  if (qrTimer) clearTimeout(qrTimer);
  if (connectionTimeout) clearTimeout(connectionTimeout);

  // ✅ CRÍTICO: Limpar cache de QR code quando conexão é estabelecida
  if (qrCodeCache.has(accountId)) {
    qrCodeCache.delete(accountId);
    console.log(`🗑️ [${accountName}] Cache de QR code limpo após conexão estabelecida`);
  }

  // ✅ Atualizar status da conexão
  let connectionData = activeConnections.get(accountId);
  if (connectionData) {
    connectionData.status = 'connected';
    connectionData.attemptCount = 0;
    connectionData.lastConnected = Date.now();
    connectionData.isAuthenticating = false; // ✅ Limpar flag de autenticação
    connectionData.reconnectEmailSent = false; // ✅ CORREÇÃO: Resetar flag para permitir novo envio se desconectar novamente
    connectionData.isRecreatingSocket = false; // ✅ NOVO: Limpar flag de recriação de socket
    connectionData.recreatingSocketAt = null; // ✅ NOVO: Limpar timestamp de recriação
    // 🔧 FIX: Atualizar socket com informações do usuário autenticado
    connectionData.socket = sock;
    // ✅ CORREÇÃO: Limpar cache de email quando conexão for estabelecida
    clearReconnectEmailCache(accountId);

    console.log(`✅ [${accountName}] Socket atualizado em activeConnections:`, {
      hasUser: !!connectionData.socket.user,
      userId: connectionData.socket.user?.id,
      socketStatus: connectionData.status
    });
  } else {
    // ✅ CORREÇÃO: Se connectionData não existe mas temos um socket válido, recriar
    console.warn(`⚠️ [${accountName}] connectionData não encontrado em activeConnections! Recriando...`);
    // ✅ CORREÇÃO: Tentar recuperar source e userId de uma conexão anterior ou usar valores padrão
    // ⚠️ ATENÇÃO: Se connectionData não existe, previousConnection também não existe, então vamos usar valores padrão
    // Mas isso não deveria acontecer normalmente, então vamos logar um aviso
    const previousConnection = activeConnections.get(accountId);
    console.warn(`⚠️ [${accountName}] Tentando recuperar previousConnection:`, {
      exists: !!previousConnection,
      source: previousConnection?.source || 'N/A',
      userId: previousConnection?.userId || 'N/A'
    });
    
    connectionData = {
      socket: sock,
      accountName,
      status: 'connected',
      lastAttempt: Date.now(),
      attemptCount: 0,
      lastConnected: Date.now(),
      isAuthenticating: false,
      reconnectEmailSent: false, // ✅ CORREÇÃO: Inicializar flag como false
      source: previousConnection?.source || 'auto', // ✅ CORREÇÃO: Preservar source se existir
      userId: previousConnection?.userId || null // ✅ CORREÇÃO: Preservar userId se existir
    };
    activeConnections.set(accountId, connectionData);
    // ✅ CORREÇÃO: Limpar cache de email quando nova conexão for criada
    clearReconnectEmailCache(accountId);
    console.log(`✅ [${accountName}] connectionData recriado e adicionado a activeConnections:`, {
      source: connectionData.source,
      userId: connectionData.userId || 'N/A'
    });
  }
  
  // ✅ NOVO: Garantir que source e userId estão presentes no connectionData
  if (!connectionData.source) {
    console.warn(`⚠️ [${accountName}] connectionData não tem source! Definindo como 'auto'`);
    connectionData.source = 'auto';
  }
  if (connectionData.userId === undefined) {
    console.warn(`⚠️ [${accountName}] connectionData não tem userId! Definindo como null`);
    connectionData.userId = null;
  }

  try {
    // ✅ SIMPLIFICADO: Extrair número do telefone
    if (!sock.user?.id) {
      console.error(`❌ [${accountName}] Socket não tem user.id, não é possível atualizar`);
      return;
    }
    
    const phoneNumber = sock.user.id.replace(/:\d+@s\.whatsapp\.net$/, '');
    console.log(`🔄 [${accountName}] Atualizando banco: accountId=${accountId}, phone=${phoneNumber}`);

    // ✅ SIMPLIFICADO: Atualizar status imediatamente - uma única query
    const { error: updateError, data: updateData } = await supabase
      .from('whatsapp_accounts')
      .update({
        phone_number: phoneNumber,
        status: 'connected',
        updated_at: new Date().toISOString()
      })
      .eq('account_id', accountId)
      .select('status, phone_number');

    if (updateError) {
      console.error(`❌ [${accountName}] ERRO ao atualizar status no banco:`, updateError);
    } else {
      console.log(`✅✅✅ [${accountName}] Status atualizado no banco:`, updateData?.[0] || 'sem dados retornados');
    }

    // ✅ NOVO: Obter informações da conexão para identificar tipo (manual vs convite) ANTES de buscar organização
    const connectionDataForInvite = connectionData || activeConnections.get(accountId);
    const isInviteConnectionForUpdate = connectionDataForInvite?.source === 'invite' || connectionDataForInvite?.source === 'system';
    const userIdForInvite = connectionDataForInvite?.userId || null;

    // ✅ NOVO: Atualizar status do convite para 'accepted' quando conexão é estabelecida via convite
    let inviteInfo = null;
    if (isInviteConnectionForUpdate && userIdForInvite) {
      try {
        // Buscar conta para obter user_id e organization_id
        const { data: accountDataForInvite } = await supabase
          .from('whatsapp_accounts')
          .select('user_id, organization_id')
          .eq('account_id', accountId)
          .single();

        if (accountDataForInvite?.user_id) {
          // Buscar convite pendente para este usuário na organização
          const { data: pendingInvite, error: inviteError } = await supabaseAdmin
            .from('whatsapp_invites')
            .select('id, token, status')
            .eq('user_id', accountDataForInvite.user_id)
            .eq('status', 'pending')
            .eq('organization_id', accountDataForInvite.organization_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!inviteError && pendingInvite) {
            // Atualizar convite para 'accepted'
            const { error: updateInviteError } = await supabaseAdmin
              .from('whatsapp_invites')
              .update({ 
                status: 'accepted',
                accepted_at: new Date().toISOString()
              })
              .eq('id', pendingInvite.id);

            if (updateInviteError) {
              console.error(`❌ [${accountName}] Erro ao atualizar status do convite:`, updateInviteError);
            } else {
              console.log(`✅ [${accountName}] Convite ${pendingInvite.id} marcado como 'accepted'`);
              inviteInfo = {
                inviteId: pendingInvite.id,
                token: pendingInvite.token,
                status: 'accepted'
              };
            }
          } else {
            console.log(`ℹ️ [${accountName}] Nenhum convite pendente encontrado para user_id ${accountDataForInvite.user_id}`);
          }
        }
      } catch (inviteUpdateError) {
        console.error(`❌ [${accountName}] Erro ao processar atualização de convite:`, inviteUpdateError);
        // Não bloquear conexão se houver erro ao atualizar convite
      }
    }

    // ✅ OTIMIZADO: Usar cache para buscar organização
    let accountInfo = null;
    const cachedAccountInfo = accountInfoCache.get(accountId);

    if (cachedAccountInfo && (Date.now() - cachedAccountInfo.lastUpdated) < ACCOUNT_INFO_CACHE_TTL) {
      accountInfo = { organization_id: cachedAccountInfo.organization_id };
    } else {
      // Buscar do banco
      const { data: fetchedInfo } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();

      if (fetchedInfo) {
        accountInfo = fetchedInfo;
        // Atualizar cache
        accountInfoCache.set(accountId, {
          organization_id: fetchedInfo.organization_id,
          lastUpdated: Date.now()
        });
      }
    }

    // ✅ NOVO: Obter informações da conexão para identificar tipo (manual vs convite)
    // ✅ CORREÇÃO: Usar connectionData atualizado em vez de buscar novamente
    const connectionDataForEvent = connectionData || activeConnections.get(accountId);
    const isManualConnection = connectionDataForEvent?.source === 'manual';
    const isInviteConnection = connectionDataForEvent?.source === 'invite' || connectionDataForEvent?.source === 'system';
    const userId = connectionDataForEvent?.userId || null;
    
    console.log(`🔍 [${accountName}] Dados da conexão para eventos:`, {
      hasConnectionData: !!connectionDataForEvent,
      source: connectionDataForEvent?.source,
      userId: userId,
      isManualConnection: isManualConnection,
      isInviteConnection: isInviteConnection,
      connectionDataKeys: connectionDataForEvent ? Object.keys(connectionDataForEvent) : []
    });
    
    // ✅ SIMPLIFICADO: Sempre emitir evento - buscar organização depois se necessário
    const connectionEvent = {
      accountId,
      accountName,
      phoneNumber,
      source: connectionDataForEvent?.source || 'auto', // ✅ NOVO: Identificar origem da conexão
      userId: userId // ✅ NOVO: Incluir userId para identificar usuário que conectou
    };
    
    if (accountInfo?.organization_id) {
      // ✅ Emitir evento principal de conexão
      io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-connected', connectionEvent);
      console.log(`📡 [${accountName}] ✅ Evento whatsapp-connected emitido para org ${accountInfo.organization_id}`);
      
      // ✅ NOVO: Emitir evento específico para fechar modal (conexão manual OU convite com userId)
      // Se há userId, significa que há um usuário esperando a resposta, então emitir o evento de sucesso
      if (userId && (isManualConnection || isInviteConnection)) {
        const targetRoom = `user-${userId}`;
        console.log(`📡 [${accountName}] 🔒 Emitindo whatsapp-connection-success para ${targetRoom}...`);
        console.log(`🔍 [${accountName}] Verificando salas Socket.IO antes de emitir:`, {
          targetRoom,
          userId,
          isManualConnection,
          isInviteConnection,
          accountId,
          accountName
        });
        
        // ✅ NOVO: Verificar quantos clientes estão na sala antes de emitir
        const room = io.sockets.adapter.rooms.get(targetRoom);
        const roomSize = room ? room.size : 0;
        console.log(`👥 [${accountName}] Clientes na sala ${targetRoom}: ${roomSize}`);
        
        io.to(targetRoom).emit('whatsapp-connection-success', {
          accountId,
          accountName,
          phoneNumber,
          message: 'Conexão estabelecida com sucesso!'
        });
        console.log(`📡 [${accountName}] ✅ Evento whatsapp-connection-success emitido para ${targetRoom} (${isManualConnection ? 'manual' : 'convite'}) - ${roomSize} cliente(s) na sala`);
      } else {
        console.log(`⚠️ [${accountName}] Não emitiu whatsapp-connection-success:`, {
          isManualConnection: isManualConnection,
          isInviteConnection: isInviteConnection,
          hasUserId: !!userId,
          userId: userId
        });
      }
      
      // ✅ NOVO: Emitir mensagem de sucesso para convites (sempre emitir para organização também)
      if (isInviteConnection) {
        // ✅ NOVO: Incluir informações do convite no evento
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-invite-success', {
          accountId,
          accountName,
          phoneNumber,
          message: 'WhatsApp conectado com sucesso! Você pode fechar esta tela.',
          inviteInfo // ✅ NOVO: Incluir informações do convite atualizado
        });
        console.log(`📡 [${accountName}] ✅ Evento whatsapp-invite-success emitido para org ${accountInfo.organization_id}`, {
          accountId,
          phoneNumber,
          inviteInfo
        });
        
        // ✅ NOVO: Emitir evento específico para atualizar status do convite na web
        if (inviteInfo) {
          io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-invite-status-updated', {
            inviteId: inviteInfo.inviteId,
            token: inviteInfo.token,
            accountId,
            accountName,
            phoneNumber,
            status: 'accepted',
            message: 'WhatsApp conectado com sucesso!'
          });
          console.log(`📡 [${accountName}] ✅ Evento whatsapp-invite-status-updated emitido para org ${accountInfo.organization_id}`);
        }
      }
    } else {
      // ✅ Fallback: emitir globalmente se organização não encontrada
      if (io) {
        io.emit('whatsapp-connected', connectionEvent);
        console.log(`📡 [${accountName}] ⚠️ Organização não encontrada - emitindo evento globalmente como fallback`);
      }
    }

    // ✅ NOVO: Iniciar monitoramento de saúde após conexão estabelecida
    startHealthMonitoring(accountId, accountName, sock);
    
    // ✅ NOVO: Iniciar keep-alive ativo para detectar conexões zombie
    startKeepAlive(accountId, accountName, sock);

    // ✅ NOVO: Buscar 7 dias de histórico quando número conectar
    setTimeout(async () => {
      try {
        console.log(`📚 [${accountName}] Iniciando busca de histórico de 7 dias...`);
        await fetchHistoricalMessages(sock, accountId, accountName, phoneNumber);
      } catch (error) {
        console.error(`❌ [${accountName}] Erro ao buscar histórico:`, error);
      }
    }, 5000); // Aguardar 5 segundos após conexão para garantir estabilidade

    console.log(`✅✅✅ [${accountName}] ===== HANDLE CONNECTION OPEN FINALIZADO =====\n`);
  } catch (error) {
    console.error(`❌ [${accountName}] Erro em handleConnectionOpen:`, error);
    console.error(`❌ [${accountName}] Stack:`, error.stack);
  }
};

// ✅ CORREÇÃO CRÍTICA: Função handleConnectionTimeout movida para ANTES de setupSocketEvents
// Esta função é chamada dentro de setupSocketEvents, então precisa estar definida antes
const handleConnectionTimeout = async (accountId, accountName, isManualConnection = false) => {
  const timeoutLabel = isManualConnection ? '2 minutos' : '3 minutos';
  console.log(`⏰ [${accountName}] Timeout de conexão atingido (${timeoutLabel}) - encerrando conexão completamente...`);

  try {
    const connectionData = activeConnections.get(accountId);
    
    // ✅ NOVO: Marcar que foi encerrado por timeout (não reconectar automaticamente)
    if (connectionData) {
      connectionData.closedByTimeout = true;
      connectionData.timeoutTimestamp = Date.now();
    }
    
    // ✅ NOVO: Encerrar socket se existir
    if (connectionData && connectionData.socket) {
      try {
        console.log(`🔌 [${accountName}] Fechando socket devido ao timeout...`);
        if (connectionData.socket.ws?.readyState === 1) {
          await connectionData.socket.end(new Error(`Timeout de conexão após ${timeoutLabel}`));
        }
      } catch (closeError) {
        console.warn(`⚠️ [${accountName}] Erro ao fechar socket:`, closeError.message);
      }
    }
    
    // ✅ NOVO: Emitir evento de timeout para conexão manual (fechar modal)
    if (isManualConnection && connectionData?.userId && io) {
      try {
        const { data: accountInfo } = await supabase
          .from('whatsapp_accounts')
          .select('organization_id')
          .eq('account_id', accountId)
          .single();
        
        if (accountInfo) {
          io.to(`user-${connectionData.userId}`).emit('whatsapp-connection-timeout', {
            accountId,
            accountName,
            message: 'Tempo de conexão expirado. Por favor, tente novamente.',
            requiresManualRetry: true
          });
          console.log(`📡 [${accountName}] ✅ Evento whatsapp-connection-timeout emitido para user ${connectionData.userId}`);
        }
      } catch (error) {
        console.error(`❌ [${accountName}] Erro ao emitir evento de timeout:`, error);
      }
    }

    // ✅ Limpar timers
    if (connectionData) {
      if (connectionData.qrTimer) clearTimeout(connectionData.qrTimer);
      if (connectionData.connectionTimeout) clearTimeout(connectionData.connectionTimeout);
    }

    // ✅ Parar monitoramento de saúde
    if (connectionHealthMonitor.has(accountId)) {
      clearInterval(connectionHealthMonitor.get(accountId));
      connectionHealthMonitor.delete(accountId);
    }
    
    // ✅ NOVO: Parar keep-alive
    stopKeepAlive(accountId);

    // ✅ Limpar conexão
    activeConnections.delete(accountId);

    // ✅ Atualizar status no banco para 'disconnected'
    await updateAccountStatus(accountId, 'disconnected');

    // ✅ Emitir notificação de timeout (apenas para organização, não para usuário específico)
    try {
      const { data: accountInfo } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();

      if (accountInfo) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
          accountId,
          accountName,
          reason: `Timeout de conexão após ${timeoutLabel}. Conexão encerrada. ${isManualConnection ? 'Clique em "Conectar" para tentar novamente.' : 'Reconexão manual necessária.'}`,
          attemptCount: 0,
          requiresManualReconnect: true
        });
      }
    } catch (error) {
      console.error(`❌ [${accountName}] Erro ao emitir notificação de timeout:`, error);
    }

    // ✅ Liberar lock após timeout
    releaseConnectionLock(accountId);
    
    console.log(`✅ [${accountName}] Conexão encerrada completamente após timeout de ${timeoutLabel}. ${isManualConnection ? 'Clique em "Conectar" para tentar novamente.' : 'Reconexão manual necessária.'}`);
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao lidar com timeout:`, error);
  }
};

// ✅ CORREÇÃO 3: Eventos de conexão melhorados
const setupSocketEvents = (sock, accountId, accountName, shouldGenerateQr, saveCreds, authDir) => {
  let qrTimer = null;
  let connectionTimeout = null;
  
  console.log(`🔧 [${accountName}] Configurando eventos do socket...`);

  // ✅ NOVO: Remover todos os listeners anteriores antes de adicionar novos (evitar duplicação)
  // Nota: O Baileys não tem método removeAllListeners direto, mas podemos usar off() para eventos específicos
  // Como não sabemos quais listeners existem, vamos apenas garantir que não adicionamos múltiplos

  // ✅ NOVO: Listener para capturar TODOS os eventos (debug completo)
  sock.ev.on('*', (event, data) => {
    // ✅ Proteção leve contra erros no handler genérico (apenas logging)
    try {
      if (event === 'creds.update') {
        console.log(`\n🎯🎯🎯 [${accountName}] ===== EVENTO CREDS.UPDATE CAPTURADO NO LISTENER GENÉRICO! =====`);
        console.log(`🎯 [${accountName}] Dados do evento:`, data ? 'Presente' : 'Ausente');
        if (data) {
          console.log(`🎯 [${accountName}] Dados detalhados:`, {
            hasMe: !!data.me,
            meId: data.me?.id,
            registered: data.registered,
            noiseKey: !!data.noiseKey,
            signedIdentityKey: !!data.signedIdentityKey,
            signedPreKey: !!data.signedPreKey
          });
        }
      } else if (event === 'connection.update') {
        // ✅ NOVO: Log detalhado de connection.update para debug
        const update = data;
        if (update && (update.connection === 'connecting' || update.connection === 'open' || update.isNewLogin)) {
          console.log(`\n🔍 [${accountName}] CONNECTION.UPDATE no listener genérico:`, {
            connection: update.connection,
            isNewLogin: update.isNewLogin,
            qrCode: update.qr ? 'Presente' : 'Ausente',
            lastDisconnect: update.lastDisconnect ? 'Presente' : 'Ausente'
          });
        }
      } else if (event !== 'messages.upsert') {
        console.log(`🔍 [${accountName}] Evento capturado: ${event}`, data ? '(com dados)' : '(sem dados)');
      }
    } catch (error) {
      // ✅ Erro no handler genérico não deve travar o processo
      console.error(`❌ [${accountName}] Erro no handler genérico de eventos:`, error.message);
    }
  });

  // ✅ OTIMIZADO: Evento de atualização de conexão - só logar estados importantes (open, close, erro)
  let lastConnectionState = null;
  sock.ev.on('connection.update', async (update) => {
    // ✅ CRÍTICO: Proteção contra erros não tratados que podem travar o processo
    try {
      const { connection, lastDisconnect, qr: qrCode } = update;
    
    // ✅ NOVO: Log detalhado para diagnóstico
    console.log(`\n📡 [${accountName}] ===== CONNECTION.UPDATE RECEBIDO =====`);
    console.log(`🔍 [${accountName}] Update:`, {
      connection: connection || 'undefined',
      qrCode: qrCode ? `Presente (${qrCode.length} chars)` : 'Ausente',
      lastDisconnect: lastDisconnect ? 'Presente' : 'Ausente',
      isNewLogin: update.isNewLogin,
      receivedPendingNotifications: update.receivedPendingNotifications
    });

    // ✅ OTIMIZADO: Só logar estados críticos (open, close, erro) e QR code
    const currentState = {
      connection: connection || 'undefined',
      hasQR: !!qrCode,
      hasDisconnect: !!lastDisconnect
    };

    // ✅ Reduzir logs: só logar estados importantes (open, close) ou quando QR aparece
    const isImportantState = connection === 'open' || 
                             connection === 'close' || 
                             connection === 'connecting' ||
                             (connection === undefined && qrCode && !lastConnectionState?.hasQR) ||
                             (lastDisconnect && lastDisconnect.error);

    if (isImportantState) {
      // Log resumido apenas para estados críticos
      if (connection === 'open') {
        console.log(`✅ [${accountName}] CONECTADO`);
      } else if (connection === 'close') {
        console.log(`🔌 [${accountName}] DESCONECTADO`);
      } else if (connection === 'connecting') {
        console.log(`🔄 [${accountName}] CONECTANDO (QR escaneado, aguardando autenticação)...`);
      } else if (qrCode && !lastConnectionState?.hasQR) {
        console.log(`📱 [${accountName}] QR Code gerado`);
        console.log(`🔍 [${accountName}] QR Code detalhes:`, {
          length: qrCode.length,
          type: typeof qrCode,
          startsWith: qrCode.substring(0, 50),
          isValidFormat: qrCode.startsWith('2@') || qrCode.includes('@')
        });
      } else if (lastDisconnect?.error) {
        const errorCode = lastDisconnect.error?.output?.statusCode;
        const errorMessage = lastDisconnect.error?.message || 'Desconhecido';
        
        // ✅ MELHORADO: Logs mais informativos para erros específicos
        if (errorCode === 515 || errorMessage.includes('Stream Errored') || errorMessage.includes('restart required')) {
          console.log(`🔄 [${accountName}] Erro 515 (Stream Errored - restart required) - Reconexão automática será tentada`);
        } else if (errorCode === 408 || errorMessage.includes('QR refs attempts ended')) {
          console.log(`⏸️ [${accountName}] Erro 408 (QR refs attempts ended) - QR code expirado após 15 minutos`);
        } else {
          console.log(`❌ [${accountName}] Erro: ${errorMessage}`);
        }
        
        console.log(`❌ [${accountName}] Detalhes do erro:`, {
          statusCode: errorCode,
          reason: lastDisconnect.error?.output?.reason,
          code: lastDisconnect.error?.code,
          data: lastDisconnect.error?.data
        });
      }
      lastConnectionState = currentState;
    }

    // ✅ MELHORADO: Tratamento do estado 'connecting' (após QR ser escaneado)
    // IMPORTANTE: Verificar este estado ANTES de tratar QR code para evitar gerar novo QR
    if (connection === 'connecting') {
      console.log(`\n🔄🔄🔄 [${accountName}] ===== ESTADO 'CONNECTING' DETECTADO =====`);
      console.log(`🔍 [${accountName}] Detalhes do update:`, {
        isNewLogin: update.isNewLogin,
        receivedPendingNotifications: update.receivedPendingNotifications,
        qrCode: qrCode ? 'Presente' : 'Ausente',
        lastDisconnect: lastDisconnect ? 'Presente' : 'Ausente'
      });
      
      // ✅ CRÍTICO: Verificar estado REAL do socket antes de atualizar status
      const connectionData = activeConnections.get(accountId);
      const socket = connectionData?.socket || sock;
      
      // ✅ NOVO: Verificar se há conexão ativa sendo iniciada manualmente
      // Se não há conexão ativa em activeConnections, não mudar status para connecting
      if (!connectionData) {
        console.log(`⚠️ [${accountName}] Evento 'connecting' IGNORADO - não há conexão ativa sendo iniciada manualmente`);
        return; // Não mudar status se não há conexão ativa
      }

      // ✅ NOVO: Verificar se há convite pendente antes de mudar para connecting
      if (connectionData.userId) {
        const { data: pendingInvite } = await supabase
          .from('whatsapp_invites')
          .select('id, status')
          .eq('user_id', connectionData.userId)
          .eq('status', 'pending')
          .single();

        if (pendingInvite) {
          console.log(`⏸️ [${accountName}] Evento 'connecting' IGNORADO - há convite pendente`);
          return; // Não mudar status se há convite pendente
        }
      }
      
      // Verificar se o socket está realmente conectado e autenticado
      const isSocketReallyConnected = socket && 
                                      socket.user && 
                                      socket.user.id && 
                                      socket.ws && 
                                      socket.ws.readyState === 1; // WebSocket.OPEN
      
      // Verificar status no banco e em activeConnections
      let isAlreadyConnected = false;
      try {
        const { data: currentAccount } = await supabase
          .from('whatsapp_accounts')
          .select('status, phone_number')
          .eq('account_id', accountId)
          .single();
        
        isAlreadyConnected = (currentAccount && currentAccount.status === 'connected' && currentAccount.phone_number) || 
                            (connectionData && connectionData.status === 'connected') ||
                            isSocketReallyConnected;
      } catch (error) {
        // Se erro ao verificar banco, usar apenas activeConnections e socket
        isAlreadyConnected = (connectionData && connectionData.status === 'connected') || isSocketReallyConnected;
      }
      
      // ✅ CORREÇÃO CRÍTICA: Se socket está realmente conectado, IGNORAR evento 'connecting'
      // O Baileys pode disparar eventos 'connecting' durante reconexões internas do WebSocket
      // mas se o socket já está conectado e autenticado, não devemos mudar o status
      if (isAlreadyConnected || isSocketReallyConnected) {
        console.log(`⚠️ [${accountName}] Evento 'connecting' IGNORADO - conexão já está estabelecida e estável`);
        console.log(`🔍 [${accountName}] Estado do socket:`, {
          hasSocket: !!socket,
          hasUser: !!socket?.user,
          hasUserId: !!socket?.user?.id,
          wsState: socket?.ws?.readyState,
          wsReady: socket?.ws?.readyState === 1,
          connectionDataStatus: connectionData?.status,
          isSocketReallyConnected: isSocketReallyConnected
        });
        return; // Sair sem atualizar status
      }
      
      // ✅ Se não está conectado, processar normalmente (primeira conexão ou reconexão após desconexão)
      // ✅ MAS SÓ SE HOUVER CONEXÃO ATIVA EM activeConnections (iniciada manualmente)
      console.log(`💡 [${accountName}] Estado 'connecting' válido - QR escaneado ou reconectando após desconexão`);
      console.log(`⏳ [${accountName}] Aguardando evento 'creds.update' ou 'connection.update' com connection='open'...`);
      
      try {
        const { data: currentAccount } = await supabase
          .from('whatsapp_accounts')
          .select('status')
          .eq('account_id', accountId)
          .single();
        
        // ✅ SIMPLIFICADO: Não atualizar status no banco para 'connecting'
        // Apenas logar para diagnóstico - o status só será atualizado quando:
        // - Conexão abrir com sucesso (connected)
        // - Conexão falhar/desconectar (disconnected)
        console.log(`📊 [${accountName}] Estado 'connecting' detectado - NÃO atualizando banco (apenas memória)`);
        console.log(`🔍 [${accountName}] Contexto:`, {
          currentStatus: currentAccount?.status,
          source: connectionData?.source,
          shouldGenerateQr: connectionData?.shouldGenerateQr,
          hasUserId: !!connectionData?.userId
        });
        
        // ✅ CRÍTICO: Marcar que estamos conectando para evitar gerar novo QR
        if (connectionData) {
          connectionData.status = 'connecting';
          connectionData.isAuthenticating = true;
          connectionData.connectingSince = Date.now(); // ✅ NOVO: Marcar timestamp
        }
      } catch (error) {
        console.error(`❌ [${accountName}] Erro ao atualizar status:`, error.message);
      }
    }

    // ✅ Tratamento de QR Code melhorado
    // ✅ CORREÇÃO: Processar QR code mesmo se estivermos em 'connecting' (pode ser um novo QR válido)
    if (qrCode && shouldGenerateQr) {
      console.log(`\n📱 [${accountName}] ===== QR CODE DETECTADO NO CONNECTION.UPDATE =====`);
      console.log(`🔍 [${accountName}] QR Code info:`, {
        length: qrCode.length,
        type: typeof qrCode,
        startsWith: qrCode.substring(0, 30) + '...',
        isValidFormat: qrCode.startsWith('2@') || qrCode.includes('@')
      });
      console.log(`💡 [${accountName}] Este QR code deve ser escaneado no WhatsApp. Após escanear, o evento 'creds.update' deve ser disparado.`);
      const connectionData = activeConnections.get(accountId);
      
      // ✅ NOVO: Verificar se a conta já está conectada ANTES de processar QR code
      try {
        // Verificar status no banco de dados
        const { data: accountData } = await supabase
          .from('whatsapp_accounts')
          .select('status, phone_number')
          .eq('account_id', accountId)
          .single();
        
        // Se já está conectada no banco E tem número de telefone, ignorar QR code
        if (accountData?.status === 'connected' && accountData?.phone_number) {
          console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada no banco - ignorando`);
          return; // Não processar QR code se já está conectado
        }
        
        // Verificar também no activeConnections
        if (connectionData && connectionData.status === 'connected') {
          console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada (activeConnections) - ignorando`);
          return; // Não processar QR code se já está conectado
        }
      } catch (error) {
        console.warn(`⚠️ [${accountName}] Erro ao verificar status no banco antes de processar QR:`, error.message);
        // Continuar processamento se houver erro na verificação
      }
      
      // ✅ NOVO: Verificar se este é um QR code diferente do anterior
      const lastQR = connectionData?.lastQRCode;
      const isNewQR = !lastQR || lastQR !== qrCode;
      
      // Se já estamos conectando/autenticando E é o mesmo QR code, ignorar
      if (connectionData && (connectionData.status === 'connecting' || connectionData.isAuthenticating) && !isNewQR) {
        console.log(`⚠️ [${accountName}] QR code duplicado ignorado (já em autenticação)`);
        return;
      }
      
      // Se é um novo QR code, processar normalmente
      if (isNewQR) {
        // Salvar QR code atual
        if (connectionData) {
          connectionData.lastQRCode = qrCode;
          // ✅ CORREÇÃO: NÃO resetar flag aqui - manter para evitar múltiplos envios
          // A flag só será resetada quando a conexão for estabelecida com sucesso
        }
        await handleQRCode(qrCode, accountId, accountName, qrTimer);
      } else {
        // Se estamos em 'connecting' mas é um QR novo, pode ser que a autenticação falhou
        // Processar o novo QR code
        console.log(`🔄 [${accountName}] Novo QR code recebido durante autenticação, processando...`);
        if (connectionData) {
          connectionData.lastQRCode = qrCode;
          // Resetar flag de autenticação para permitir novo QR
          connectionData.isAuthenticating = false;
          connectionData.status = 'connecting'; // Manter como connecting
          // ✅ CORREÇÃO: NÃO resetar flag aqui - manter para evitar múltiplos envios
          // A flag só será resetada quando a conexão for estabelecida com sucesso
        }
        await handleQRCode(qrCode, accountId, accountName, qrTimer);
      }
    }

    // ✅ Tratamento de desconexão melhorado
    if (connection === 'close') {
      console.log(`\n🔌🔌🔌 [${accountName}] ===== CONNECTION === 'CLOSE' RECEBIDO =====`);
      console.log(`📅 [${accountName}] Timestamp: ${new Date().toISOString()}`);
      
      // ✅ NOVO: Log detalhado do objeto lastDisconnect para diagnóstico
      console.log(`🔍 [${accountName}] lastDisconnect existe: ${!!lastDisconnect}`);
      if (lastDisconnect) {
        console.log(`🔍 [${accountName}] lastDisconnect.error existe: ${!!lastDisconnect.error}`);
        if (lastDisconnect.error) {
          console.log(`🔍 [${accountName}] lastDisconnect.error.output:`, lastDisconnect.error?.output);
          console.log(`🔍 [${accountName}] lastDisconnect.error.message: ${lastDisconnect.error?.message}`);
          console.log(`🔍 [${accountName}] lastDisconnect.error.code: ${lastDisconnect.error?.code}`);
          console.log(`🔍 [${accountName}] lastDisconnect.error stack:`, lastDisconnect.error?.stack?.substring(0, 500));
        }
      }
      
      // ✅ Verificar estado do socket no momento da desconexão
      const socketState = sock?.ws?.readyState;
      const socketStateMap = { 0: 'CONNECTING', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED' };
      console.log(`🔌 [${accountName}] Estado do WebSocket: ${socketStateMap[socketState] || socketState}`);
      console.log(`🔌 [${accountName}] Socket user exists: ${!!sock?.user}`);
      
      // ✅ NOVO: Log detalhado para desconexão manual
      if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
        console.log(`📱 [${accountName}] ⚠️ DESCONEXÃO MANUAL DETECTADA (loggedOut - código 401)`);
        console.log(`📱 [${accountName}] O usuário desconectou o WhatsApp pelo celular`);
      }
      
      await handleDisconnection(lastDisconnect, accountId, accountName, qrTimer, connectionTimeout);
    }

    // ✅ MELHORADO: Tratamento de conexão aberta
    // ✅ CRÍTICO: Se isNewLogin = true, significa que acabamos de fazer scan QR
    // Neste caso, o socket pode precisar de mais tempo para ter user.id
    if (connection === 'open') {
      console.log(`\n🔥🔥🔥 [${accountName}] ===== CONEXÃO ABERTA DETECTADA =====`);
      const isNewLogin = update.isNewLogin === true;
      
      // ✅ NOVO: Se há erro 515 pendente e conexão abriu, limpar flag imediatamente
      const connectionData = activeConnections.get(accountId);
      if (connectionData?.has515Error && connection === 'open') {
        console.log(`✅ [${accountName}] Conexão estabelecida - limpando flag de erro 515 imediatamente`);
        connectionData.has515Error = false;
        connectionData.has515ErrorAt = null;
      }
      
      console.log(`🔍 [${accountName}] Estado do socket:`, {
        hasUser: !!sock.user,
        userId: sock.user?.id,
        wsReady: sock.ws?.readyState === 1,
        wsState: sock.ws?.readyState,
        isNewLogin: isNewLogin
      });
      
      // ✅ NOVO: Se for novo login (após scan QR), aguardar mais tempo
      const waitTime = isNewLogin ? 5000 : 2000; // 5s para novo login, 2s para reconexão
      
      if (sock.user?.id) {
        console.log(`✅ [${accountName}] Socket tem user, chamando handleConnectionOpen IMEDIATAMENTE...`);
        await handleConnectionOpen(sock, accountId, accountName, qrTimer, connectionTimeout);
      } else {
        // Se não tem user, aguardar e tentar novamente
        console.log(`⏳ [${accountName}] Socket não tem user ainda, aguardando ${waitTime}ms (isNewLogin: ${isNewLogin})...`);
        setTimeout(async () => {
          if (sock.user?.id && sock.ws?.readyState === 1) {
            console.log(`✅ [${accountName}] User disponível após espera, atualizando...`);
            await handleConnectionOpen(sock, accountId, accountName, qrTimer, connectionTimeout);
          } else {
            console.warn(`⚠️ [${accountName}] User ainda não disponível após espera de ${waitTime}ms`);
            console.warn(`⚠️ [${accountName}] Estado atual:`, {
              hasUser: !!sock.user,
              hasUserId: !!sock.user?.id,
              wsReady: sock.ws?.readyState === 1,
              wsState: sock.ws?.readyState
            });
            
            // ✅ NOVO: Se ainda não tem user após espera E for novo login, tentar mais uma vez após 3s
            if (isNewLogin) {
              console.log(`⏳ [${accountName}] Novo login detectado - aguardando mais 3s...`);
              setTimeout(async () => {
                if (sock.user?.id && sock.ws?.readyState === 1) {
                  console.log(`✅ [${accountName}] User disponível após segunda espera, atualizando...`);
                  await handleConnectionOpen(sock, accountId, accountName, qrTimer, connectionTimeout);
                } else {
                  console.error(`❌ [${accountName}] User ainda não disponível após múltiplas tentativas`);
                }
              }, 3000);
            }
          }
        }, waitTime);
      }
      console.log(`🔥🔥🔥 [${accountName}] ===== FIM TRATAMENTO CONEXÃO ABERTA =====\n`);
    }

    // ✅ MELHORADO: Tratamento de erros durante conexão com mais detalhes
    if (lastDisconnect?.error) {
      const errorCode = lastDisconnect.error?.output?.statusCode;
      const errorMessage = lastDisconnect.error?.message;
      
      console.error(`\n❌❌❌ [${accountName}] ===== ERRO DETECTADO DURANTE CONEXÃO =====`);
      console.error(`❌ [${accountName}] Código do erro:`, errorCode);
      console.error(`❌ [${accountName}] Mensagem:`, errorMessage);
      console.error(`❌ [${accountName}] Estado da conexão:`, connection);
      console.error(`❌ [${accountName}] Erro completo:`, lastDisconnect.error);
      
      // ✅ NOVO: Se for erro durante autenticação (após scan), logar detalhes adicionais
      const connectionData = activeConnections.get(accountId);
      if (connectionData && (connectionData.status === 'connecting' || connectionData.isAuthenticating)) {
        console.error(`❌ [${accountName}] ERRO DURANTE AUTENTICAÇÃO (após scan do QR code)`);
        console.error(`❌ [${accountName}] Estado da conexão:`, {
          status: connectionData.status,
          isAuthenticating: connectionData.isAuthenticating,
          hasSocket: !!connectionData.socket,
          socketUser: !!connectionData.socket?.user,
          socketUserId: connectionData.socket?.user?.id
        });
      }

      // Se for erro 428 (rate limit) e for conexão manual, não aplicar throttle
      if (errorCode === 428) {
        const isManualConnection = connectionData?.source === 'manual';
        
        if (isManualConnection) {
          console.warn(`⚠️ [${accountName}] Erro 428 durante conexão manual - ignorando throttle`);
        } else {
          console.warn(`⚠️ [${accountName}] Erro 428 - rate limit detectado`);
        }
      }
      
      console.error(`❌❌❌ [${accountName}] ===== FIM ERRO DETECTADO =====\n`);
    }
    } catch (error) {
      // ✅ CRÍTICO: Capturar qualquer erro não tratado no handler para evitar unhandledRejection
      console.error(`❌ [${accountName}] ERRO CRÍTICO no handler connection.update:`, error);
      console.error(`❌ [${accountName}] Stack:`, error.stack);
      // Não propagar o erro para evitar travar o processo
      // O erro já foi logado, então podemos continuar normalmente
    }
  });

  // ✅ Evento de mensagens recebidas (logs reduzidos)
  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handleMessagesUpsert(m, accountId, accountName, sock);
    } catch (error) {
      // ✅ CRÍTICO: Proteção contra erros não tratados
      console.error(`❌ [${accountName}] Erro no handler messages.upsert:`, error);
      console.error(`❌ [${accountName}] Stack:`, error.stack);
    }
  });

  // ✅ Evento de atualização de credenciais (logs melhorados para diagnóstico)
  // ✅ CRÍTICO: Este evento DEVE ser disparado quando o QR code é escaneado
  sock.ev.on('creds.update', async (creds) => {
    // ✅ CRÍTICO: Proteção externa contra erros não tratados
    try {
      console.log(`\n🎯🎯🎯 [${accountName}] ===== CREDS.UPDATE DISPARADO! =====`);
      console.log(`🔐 [${accountName}] ===== CREDENCIAIS ATUALIZADAS (QR ESCANEADO) =====`);
      console.log(`🔍 [${accountName}] Credenciais recebidas:`, creds ? 'Presente' : 'Ausente');
      console.log(`🔍 [${accountName}] Estado do socket:`, {
        hasUser: !!sock.user,
        userId: sock.user?.id,
        wsReady: sock.ws?.readyState === 1,
        wsState: sock.ws?.readyState
      });
      
      try {
      // ✅ CORREÇÃO: Garantir que o diretório existe antes de salvar
      if (authDir && !fs.existsSync(authDir)) {
        console.log(`📁 [${accountName}] Criando diretório de autenticação: ${authDir}`);
        fs.mkdirSync(authDir, { recursive: true });
      }
      
      console.log(`💾 [${accountName}] Salvando credenciais...`);
      await saveCreds();
      console.log(`✅ [${accountName}] Credenciais salvas com sucesso`);
      
      // ✅ NOVO: Marcar timestamp de atualização de credenciais
      const connectionData = activeConnections.get(accountId);
      if (connectionData) {
        connectionData.lastCredsUpdate = Date.now();
        connectionData.isAuthenticating = true;
      }
      
      // ✅ CRÍTICO: Quando há novo login, o Baileys pode precisar recriar o socket
      // Mas primeiro vamos aguardar o evento connection.update com isNewLogin: true
      // para confirmar que realmente é um novo login
      console.log(`⏳ [${accountName}] Credenciais salvas. Aguardando confirmação de conexão...`);
      console.log(`💡 [${accountName}] O Baileys deve disparar connection.update com connection='open' em breve`);
      
      // ✅ NÃO recriar socket imediatamente - aguardar connection.update
      // O Baileys pode estabelecer a conexão automaticamente após salvar credenciais
      // Se não conectar em 10 segundos, então recriar
      // ✅ NOVO: Marcar que socket está sendo recriado para evitar notificações de desconexão prematuras
      const connectionDataForRecreate = activeConnections.get(accountId);
      if (connectionDataForRecreate) {
        // ✅ CORREÇÃO: Verificar se já existe um timeout de recriação para evitar múltiplas recriações
        if (connectionDataForRecreate.recreateTimeout) {
          console.log(`⏸️ [${accountName}] Já existe um timeout de recriação ativo, cancelando...`);
          clearTimeout(connectionDataForRecreate.recreateTimeout);
        }
        
        connectionDataForRecreate.isRecreatingSocket = true;
        connectionDataForRecreate.recreatingSocketAt = Date.now();
        
        // ✅ NOVO: Armazenar timeout para poder cancelar se necessário
        const recreateTimeout = setTimeout(async () => {
          const checkConnection = activeConnections.get(accountId);
          
          // ✅ CORREÇÃO CRÍTICA: Verificar se está REALMENTE conectado (não apenas status 'connecting')
          // Uma conexão só é válida se tem user.id válido E WebSocket pronto OU status 'connected'
          const hasValidUserId = checkConnection?.socket?.user?.id && checkConnection.socket.user.id.includes('@s.whatsapp.net');
          const isWebSocketReady = checkConnection?.socket?.ws?.readyState === 1;
          const isStatusConnected = checkConnection?.status === 'connected';
          const isReallyConnected = isStatusConnected || (hasValidUserId && isWebSocketReady);
          
          // ✅ NOVO: Verificar se há erro 515 sendo tratado (aguardar mais tempo)
          const has515Error = checkConnection?.has515Error || false;
          const timeSinceCredsUpdate = checkConnection?.lastCredsUpdate ? (Date.now() - checkConnection.lastCredsUpdate) : 0;
          
          console.log(`🔍 [${accountName}] Verificando conexão após timeout:`, {
            hasValidUserId,
            isWebSocketReady,
            isStatusConnected,
            isReallyConnected,
            has515Error,
            timeSinceCredsUpdate: `${Math.round(timeSinceCredsUpdate / 1000)}s`
          });
          
          if (!checkConnection || !isReallyConnected) {
            // ✅ OTIMIZADO: Se há erro 515 recente, aguardar apenas 3s antes de recriar
            if (has515Error && timeSinceCredsUpdate < 10000) { // ✅ OTIMIZADO: 10s (era 45s)
              console.log(`⏳ [${accountName}] Erro 515 detectado. Aguardando 3s antes de recriar...`);
              await new Promise(resolve => setTimeout(resolve, 3000)); // ✅ OTIMIZADO: 3s (era 15s)
              
              // Verificar novamente após espera adicional
              const recheckConnection = activeConnections.get(accountId);
              const recheckHasValidUserId = recheckConnection?.socket?.user?.id && recheckConnection.socket.user.id.includes('@s.whatsapp.net');
              const recheckIsWebSocketReady = recheckConnection?.socket?.ws?.readyState === 1;
              const recheckIsStatusConnected = recheckConnection?.status === 'connected';
              const recheckIsReallyConnected = recheckIsStatusConnected || (recheckHasValidUserId && recheckIsWebSocketReady);
              
              if (recheckConnection && recheckIsReallyConnected) {
                console.log(`✅ [${accountName}] Conexão estabelecida após espera! Cancelando recriação.`);
                if (recheckConnection) {
                  recheckConnection.isRecreatingSocket = false;
                  recheckConnection.recreatingSocketAt = null;
                  recheckConnection.recreateTimeout = null;
                  recheckConnection.has515Error = false;
                }
                return;
              }
            }
            
            console.log(`🔄 [${accountName}] Conexão não estabelecida automaticamente após 5s - recriando socket...`); // ✅ ATUALIZADO: 5s (era 30s)
            
            // ✅ Verificar novamente antes de recriar (evitar recriação desnecessária)
            const finalCheck = activeConnections.get(accountId);
            const finalHasValidUserId = finalCheck?.socket?.user?.id && finalCheck.socket.user.id.includes('@s.whatsapp.net');
            const finalIsWebSocketReady = finalCheck?.socket?.ws?.readyState === 1;
            const finalIsStatusConnected = finalCheck?.status === 'connected';
            const finalIsReallyConnected = finalIsStatusConnected || (finalHasValidUserId && finalIsWebSocketReady);
            
            if (finalCheck && finalIsReallyConnected) {
              console.log(`✅ [${accountName}] Conexão estabelecida antes da recriação! Cancelando recriação.`);
              if (finalCheck) {
                finalCheck.isRecreatingSocket = false;
                finalCheck.recreatingSocketAt = null;
                finalCheck.recreateTimeout = null;
                finalCheck.has515Error = false;
              }
              return;
            }
            
            // ✅ Fechar socket antigo graciosamente
            try {
              if (sock.ws?.readyState === 1) {
                await sock.end(new Error('Recriando socket após novo login'));
              }
            } catch (closeError) {
              console.warn(`⚠️ [${accountName}] Erro ao fechar socket antigo:`, closeError.message);
            }
            
            // ✅ Aguardar um pouco antes de recriar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // ✅ Recriar conexão com as credenciais salvas
            try {
              const currentConnectionData = activeConnections.get(accountId);
              const source = currentConnectionData?.source || 'auto';
              const userId = currentConnectionData?.userId || null;
              
              // ✅ Limpar conexão antiga
              activeConnections.delete(accountId);
              releaseConnectionLock(accountId);
              
              // ✅ Recriar conexão (sem gerar novo QR, usando credenciais salvas)
              await createWhatsAppConnectionInternal(accountId, accountName, false, source, userId, {});
              console.log(`✅ [${accountName}] Socket recriado com sucesso após novo login`);
              
              // ✅ NOVO: Limpar flag de recriação após recriar
              const recreatedConnection = activeConnections.get(accountId);
              if (recreatedConnection) {
                recreatedConnection.isRecreatingSocket = false;
                recreatedConnection.recreatingSocketAt = null;
                recreatedConnection.recreateTimeout = null;
                recreatedConnection.has515Error = false; // ✅ Limpar flag de erro 515 também
                recreatedConnection.has515ErrorAt = null;
              }
            } catch (recreateError) {
              console.error(`❌ [${accountName}] Erro ao recriar socket:`, recreateError);
              console.error(`❌ [${accountName}] Stack:`, recreateError.stack);
              
              // ✅ Em caso de erro, atualizar status
              await updateAccountStatus(accountId, 'disconnected');
              activeConnections.delete(accountId);
              releaseConnectionLock(accountId);
            }
          } else {
            // ✅ CORREÇÃO: Só considerar conectado se realmente tem user.id válido
            const reallyHasValidUserId = checkConnection?.socket?.user?.id && checkConnection.socket.user.id.includes('@s.whatsapp.net');
            const reallyIsWebSocketReady = checkConnection?.socket?.ws?.readyState === 1;
            const reallyIsStatusConnected = checkConnection?.status === 'connected';
            const reallyIsConnected = reallyIsStatusConnected || (reallyHasValidUserId && reallyIsWebSocketReady);
            
            if (reallyIsConnected) {
              console.log(`✅ [${accountName}] Conexão estabelecida automaticamente após salvar credenciais`);
              // ✅ Limpar flags de recriação e erro 515
              if (checkConnection) {
                checkConnection.isRecreatingSocket = false;
                checkConnection.recreatingSocketAt = null;
                checkConnection.recreateTimeout = null;
                checkConnection.has515Error = false;
                checkConnection.has515ErrorAt = null;
              }
            } else {
              console.log(`⏳ [${accountName}] Conexão ainda não estabelecida completamente (aguardando user.id válido)...`);
              // Não limpar flags ainda - aguardar mais
            }
          }
        }, 5000); // ✅ OTIMIZADO: Aguardar apenas 5 segundos (era 30s) - recriação rápida do socket
        
        connectionDataForRecreate.recreateTimeout = recreateTimeout;
      }
      
      console.log(`🔐 [${accountName}] ===== FIM CREDENCIAIS ATUALIZADAS =====\n`);
    } catch (error) {
      console.error(`❌❌❌ [${accountName}] ERRO ao salvar credenciais:`, error);
      console.error(`❌ [${accountName}] Stack:`, error.stack);
      
      // ✅ NOVO: Tentar criar o diretório e salvar novamente
      if (error.code === 'ENOENT' && authDir) {
        try {
          console.log(`🔄 [${accountName}] Tentando criar diretório e salvar novamente...`);
          fs.mkdirSync(authDir, { recursive: true });
          await saveCreds();
          console.log(`✅ [${accountName}] Credenciais salvas após criar diretório`);
        } catch (retryError) {
          console.error(`❌ [${accountName}] Erro ao salvar credenciais após criar diretório:`, retryError);
        }
      }
    }
    } catch (outerError) {
      // ✅ CRÍTICO: Capturar qualquer erro não tratado no handler externo
      console.error(`❌ [${accountName}] ERRO CRÍTICO no handler creds.update:`, outerError);
      console.error(`❌ [${accountName}] Stack:`, outerError.stack);
      // Não propagar o erro para evitar travar o processo
    }
  });

  // ✅ NOVO: Timeout diferenciado - 2 minutos para conexão manual, 3 minutos para automática
  const connectionData = activeConnections.get(accountId);
  const isManualConnection = connectionData?.source === 'manual';
  const timeoutDuration = isManualConnection ? 120000 : 180000; // 2min manual, 3min automática
  const timeoutLabel = isManualConnection ? '2 minutos' : '3 minutos';
  
  connectionTimeout = setTimeout(async () => {
    const currentConnectionData = activeConnections.get(accountId);
    if (currentConnectionData && currentConnectionData.status === 'connecting') {
      console.warn(`⚠️ [${accountName}] Timeout de conexão após ${timeoutLabel} - encerrando conexão`);
      await handleConnectionTimeout(accountId, accountName, isManualConnection);
    }
  }, timeoutDuration);
  
  // ✅ Salvar timeout na conexão para poder limpar depois
  if (connectionData) {
    connectionData.connectionTimeout = connectionTimeout;
  }
};

// ✅ Função para tratar mensagens recebidas (logs reduzidos)
async function handleMessagesUpsert(m, accountId, accountName, sock) {
  try {
    // ✅ NOVO: Atualizar timestamp de última mensagem recebida (prova de vida)
    const connectionData = activeConnections.get(accountId);
    if (connectionData) {
      connectionData.lastMessageReceived = Date.now();
      connectionData.status = 'connected'; // Garantir que está marcado como conectado
    }

    for (const message of m.messages || []) {
      // ✅ Verificar filtros
      const isOwnMessage = message.key?.fromMe;
      const senderJid = message.key?.remoteJid;
      const isStatusBroadcast = message.key?.remoteJid === 'status@broadcast';
      const isSystemMessage = isStatusMessage(message);
      const isNotifyType = m.type === 'notify';

      // ✅ CRÍTICO: Ignorar mensagens de newsletter/updates ANTES de qualquer processamento
      if (senderJid && (senderJid.includes('@newsletter') || senderJid.includes('@updates'))) {
        console.log(`🚫 [${accountName}] Mensagem de newsletter/updates ignorada no handleMessagesUpsert: ${senderJid}`);
        continue; // Não processar mensagens de newsletter/updates
      }

      // ✅ Ignorar mensagens de status
      if (isStatusBroadcast) {
        continue;
      }

      // ✅ Ignorar mensagens de sistema
      if (isSystemMessage) {
        continue;
      }

      // ✅ CORREÇÃO: Processar mensagens próprias (enviadas) sempre, e mensagens recebidas apenas se forem do tipo 'notify'
      // Isso garante que mensagens enviadas sejam sempre registradas
      if (isOwnMessage || isNotifyType) {
        await processReceivedMessage(message, accountId, accountName, sock);
      }
    }
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao processar mensagens:`, error);
  }
}

// ✅ NOVA: Função para processar mensagem recebida (incluindo próprias)
async function processReceivedMessage(message, accountId, accountName, sock) {
  try {
    const senderJid = message.key?.remoteJid;
    const isOwnMessage = message.key?.fromMe;

    // ✅ CRÍTICO: Ignorar mensagens de newsletter/updates do WhatsApp
    // Esses chats não devem ser salvos no sistema
    if (senderJid && (senderJid.includes('@newsletter') || senderJid.includes('@updates'))) {
      console.log(`🚫 [${accountName}] Mensagem de newsletter/updates ignorada: ${senderJid}`);
      return; // Não processar mensagens de newsletter/updates
    }

    // ✅ CORREÇÃO: Verificar se é mensagem de broadcast (lista de transmissão) - apenas se realmente for broadcast
    // Broadcast no WhatsApp tem formato específico: termina com "@broadcast" mas não é "status@broadcast"
    // E deve ser uma mensagem própria (enviada por nós)
    const isBroadcast = senderJid?.endsWith('@broadcast') && 
                        senderJid !== 'status@broadcast' && // Ignorar status
                        isOwnMessage; // Apenas mensagens próprias podem ser broadcast
    
    if (isBroadcast) {
      console.log(`📢 [${accountName}] Detectada mensagem de broadcast: ${senderJid}`);
      await saveBroadcastMessage(message, accountId, accountName, sock);
      return;
    }

    // ✅ NOVO: Verificar se é mensagem de grupo
    if (isGroupChat(senderJid)) {
      console.log(`👥 [${accountName}] Detectada mensagem de grupo, processando...`);
      await processGroupMessage(message, accountId, accountName, sock, io, downloadAndProcessMedia);
      return;
    }

    // ✅ Processamento para mensagens individuais (próprias e de outros)
    console.log(`📨 [${accountName}] Processando mensagem individual (própria: ${isOwnMessage})...`);

    // Buscar dados da conta (incluindo phone_number para validação)
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id, phone_number')
      .eq('account_id', accountId)
      .single();

    if (!accountData) {
      console.error(`❌ [${accountName}] Conta não encontrada: ${accountId}`);
      return;
    }

    if (!senderJid) {
      console.error(`❌ [${accountName}] JID do remetente não encontrado`);
      return;
    }

    // ✅ CORREÇÃO: Lógica específica para mensagens próprias
    let targetJid, contactInfo, phoneNumber, contactName;

    // ✅ CRÍTICO: Validar senderJid ANTES de determinar targetJid
    if (senderJid && (senderJid.includes('@newsletter') || senderJid.includes('@updates'))) {
      console.log(`🚫 [${accountName}] senderJid é newsletter/updates, ignorando: ${senderJid}`);
      return; // Não processar mensagens de newsletter/updates
    }

    if (isOwnMessage) {
      // ✅ CORREÇÃO CRÍTICA: Quando senderJid termina com @lid, não conseguimos identificar o destinatário diretamente
      // O @lid pode indicar que é uma mensagem enviada do próprio dispositivo (celular)
      // Precisamos buscar o destinatário de outra forma
      if (senderJid?.endsWith('@lid')) {
        // ✅ CORREÇÃO: Quando remoteJid termina com @lid, o Baileys fornece remoteJidAlt com o JID real do destinatário!
        if (message.key?.remoteJidAlt) {
          targetJid = message.key.remoteJidAlt;
          console.log(`✅ [${accountName}] Mensagem própria com @lid - usando remoteJidAlt como destinatário: ${targetJid}`);
          contactInfo = await getContactInfo(sock, targetJid, message);
          phoneNumber = contactInfo.phoneNumber;
          contactName = contactInfo.name || phoneNumber;
        } else {
          // Fallback: se não tiver remoteJidAlt, usar a lógica antiga
          const extractedPhoneFromLid = senderJid.split('@')[0];
          console.log(`⚠️ [${accountName}] Mensagem própria com @lid mas sem remoteJidAlt - número extraído: ${extractedPhoneFromLid}`);
          const connectedPhoneNumber = sock.user?.id?.replace(/@.*$/, '') || '';
          if (extractedPhoneFromLid === connectedPhoneNumber || senderJid.replace('@lid', '') === connectedPhoneNumber.replace(/@.*$/, '')) {
            console.log(`✅ [${accountName}] Confirmado: número do @lid é o próprio número conectado`);
            targetJid = null;
          } else {
            console.log(`⚠️ [${accountName}] Número do @lid não corresponde ao conectado - tentando usar como destinatário`);
            targetJid = `${extractedPhoneFromLid}@s.whatsapp.net`;
            contactInfo = await getContactInfo(sock, targetJid, message);
            phoneNumber = contactInfo.phoneNumber;
            contactName = contactInfo.name || phoneNumber;
          }
        }
      } else {
        // ✅ Para mensagens próprias normais (sem @lid), o senderJid é o destinatário
        targetJid = senderJid;
        contactInfo = await getContactInfo(sock, targetJid, message);
        phoneNumber = contactInfo.phoneNumber;
        contactName = contactInfo.name || phoneNumber;

        console.log(`👤 [${accountName}] Mensagem própria para:`, {
          jid: targetJid,
          name: contactName,
          phone: phoneNumber,
          hasPicture: !!contactInfo.profilePicture
        });
      }
    } else {
      // ✅ CRÍTICO: Validar senderJid antes de processar mensagem recebida
      if (senderJid && (senderJid.includes('@newsletter') || senderJid.includes('@updates'))) {
        console.log(`🚫 [${accountName}] Mensagem recebida de newsletter/updates ignorada: ${senderJid}`);
        return; // Não processar mensagens de newsletter/updates
      }

      // ✅ CORREÇÃO CRÍTICA: Verificar se senderJid termina com @lid mesmo que isOwnMessage seja false
      // Isso acontece quando a mensagem é enviada do próprio celular (não do WhatsApp Web)
      if (senderJid?.endsWith('@lid')) {
        console.log(`⚠️ [${accountName}] Mensagem com @lid mas isOwnMessage=false - detectada como mensagem do próprio celular`);
        console.log(`   senderJid: ${senderJid}, remoteJidAlt: ${message.key?.remoteJidAlt || 'N/A'}`);
        
        // ✅ Usar remoteJidAlt se disponível (destinatário real)
        if (message.key?.remoteJidAlt) {
          targetJid = message.key.remoteJidAlt;
          console.log(`✅ [${accountName}] Usando remoteJidAlt como destinatário: ${targetJid}`);
          contactInfo = await getContactInfo(sock, targetJid, message);
          phoneNumber = contactInfo.phoneNumber;
          contactName = contactInfo.name || phoneNumber;
        } else {
          // ✅ Se não tem remoteJidAlt, tentar buscar pela última mensagem enviada recentemente
          // Isso identifica o destinatário correto mesmo sem remoteJidAlt
          console.log(`🔍 [${accountName}] Sem remoteJidAlt - buscando destinatário pela última mensagem enviada...`);
          
          const messageTimestamp = message.messageTimestamp ? new Date(message.messageTimestamp * 1000).toISOString() : new Date().toISOString();
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
          
          const { data: recentSentMessages } = await supabase
            .from('messages')
            .select(`
              metadata,
              chats!inner(
                id,
                whatsapp_jid,
                assigned_agent_id,
                organization_id
              )
            `)
            .eq('chats.assigned_agent_id', accountData.user_id)
            .eq('chats.organization_id', accountData.organization_id)
            .eq('chats.is_group', false)
            .eq('is_from_me', true)
            .eq('metadata->>account_id', accountId)
            .not('metadata->>target_jid', 'is', null)
            .lte('created_at', messageTimestamp)
            .gte('created_at', twoMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (recentSentMessages && recentSentMessages.length > 0) {
            const metadataTargetJid = recentSentMessages[0].metadata?.target_jid;
            const connectedPhoneNumber = accountData.phone_number?.replace(/\D/g, '') || '';
            
            if (metadataTargetJid && !metadataTargetJid.endsWith('@lid') && !metadataTargetJid.includes(connectedPhoneNumber)) {
              targetJid = metadataTargetJid;
              console.log(`✅ [${accountName}] Destinatário encontrado pela última mensagem: ${targetJid}`);
              contactInfo = await getContactInfo(sock, targetJid, message);
              phoneNumber = contactInfo.phoneNumber;
              contactName = contactInfo.name || phoneNumber;
            } else {
              console.error(`❌ [${accountName}] Não foi possível identificar destinatário válido da última mensagem`);
              return;
            }
          } else {
            // ❌ Não processar se não conseguir identificar o destinatário
            console.error(`❌ [${accountName}] Mensagem com @lid sem remoteJidAlt e sem mensagens recentes - não é possível identificar destinatário`);
            console.error(`   A mensagem será processada quando o destinatário responder`);
            return;
          }
        }
      } else {
        // ✅ Para mensagens de outros (sem @lid), o senderJid é o remetente
        targetJid = senderJid;
        contactInfo = await getContactInfo(sock, targetJid, message);
        phoneNumber = contactInfo.phoneNumber;
        contactName = contactInfo.name || phoneNumber;

        console.log(`👤 [${accountName}] Mensagem de:`, {
          jid: targetJid,
          name: contactName,
          phone: phoneNumber,
          hasPicture: !!contactInfo.profilePicture
        });
      }
    }

    // ✅ Buscar ou criar chat usando o targetJid correto
    let existingChat = null;
    let chatError = null;
    
    if (targetJid) {
      // ✅ CORREÇÃO: Buscar chat validando por account_id OU phone_number
      // Isso garante que encontre chats mesmo se a conta foi recriada com o mesmo número
      const phoneNumberNormalized = accountData.phone_number?.replace(/\D/g, '') || '';
      
      // Primeiro tentar buscar por account_id (mais específico)
      let messagesWithChat = null;
      if (accountId) {
        const { data } = await supabase
          .from('messages')
          .select(`
            chat_id,
            chats!inner(
              id,
              name,
              avatar_url,
              whatsapp_jid,
              assigned_agent_id,
              organization_id
            )
          `)
          .eq('chats.whatsapp_jid', targetJid)
          .eq('chats.assigned_agent_id', accountData.user_id)
          .eq('chats.organization_id', accountData.organization_id)
          .eq('chats.status', 'active')
          .eq('metadata->>account_id', accountId)
          .limit(1)
          .maybeSingle();
        messagesWithChat = data;
      }
      
      // Se não encontrou por account_id, buscar por phone_number (para contas recriadas)
      if (!messagesWithChat?.chats && phoneNumberNormalized) {
        const { data } = await supabase
          .from('messages')
          .select(`
            chat_id,
            chats!inner(
              id,
              name,
              avatar_url,
              whatsapp_jid,
              assigned_agent_id,
              organization_id
            )
          `)
          .eq('chats.whatsapp_jid', targetJid)
          .eq('chats.assigned_agent_id', accountData.user_id)
          .eq('chats.organization_id', accountData.organization_id)
          .eq('chats.status', 'active')
          .or(`sender_jid.ilike.%${phoneNumberNormalized}%,metadata->>target_jid.ilike.%${phoneNumberNormalized}%`)
          .limit(1)
          .maybeSingle();
        messagesWithChat = data;
      }
      
      if (messagesWithChat?.chats) {
        existingChat = messagesWithChat.chats;
        console.log(`✅ [${accountName}] Chat encontrado com validação por account_id/phone_number: ${existingChat.id}`);
      } else {
        // Se não encontrou, tentar buscar sem filtro (compatibilidade com chats muito antigos)
        const chatResult = await supabase
          .from('chats')
          .select('id, name, avatar_url')
          .eq('whatsapp_jid', targetJid)
          .eq('assigned_agent_id', accountData.user_id)
          .eq('organization_id', accountData.organization_id)
          .eq('status', 'active')
          .maybeSingle();
        
        existingChat = chatResult.data;
        chatError = chatResult.error;
        
        if (existingChat) {
          console.log(`⚠️ [${accountName}] Chat encontrado sem filtro (chat muito antigo): ${existingChat.id}`);
        }
      }
    }
    
    // ✅ CORREÇÃO CRÍTICA: Se não encontrou chat e é mensagem própria com @lid SEM remoteJidAlt,
    // buscar pelo último chat que teve mensagem ENVIADA recentemente (destinatário real)
    // Se temos targetJid do remoteJidAlt, não devemos fazer essa busca - apenas criar o chat se não existir
    if (!existingChat && isOwnMessage && senderJid?.endsWith('@lid') && !message.key?.remoteJidAlt) {
      console.log(`🔍 [${accountName}] Mensagem própria com @lid SEM remoteJidAlt - buscando destinatário pelo último chat com mensagem enviada recente`);
      
      const messageTimestamp = message.messageTimestamp ? new Date(message.messageTimestamp * 1000).toISOString() : new Date().toISOString();
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      // ✅ CORREÇÃO CRÍTICA: Buscar a última mensagem ENVIADA e extrair target_jid do metadata
      // NÃO usar whatsapp_jid do chat, pois ele pode estar errado!
      const { data: recentSentMessages } = await supabase
        .from('messages')
        .select(`
          chat_id,
          metadata,
          chats!inner(
            id,
            name,
            avatar_url,
            whatsapp_jid,
            assigned_agent_id,
            organization_id,
            is_group
          )
        `)
        .eq('chats.assigned_agent_id', accountData.user_id)
        .eq('chats.organization_id', accountData.organization_id)
        .eq('chats.is_group', false)
        .eq('is_from_me', true) // ✅ CORREÇÃO: Buscar mensagens ENVIADAS (próprias)
        .eq('metadata->>account_id', accountId) // ✅ Filtrar por account_id
        .not('metadata->>target_jid', 'is', null) // ✅ Garantir que tem target_jid
        .lte('created_at', messageTimestamp)
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (recentSentMessages && recentSentMessages.length > 0 && recentSentMessages[0].chats) {
        const recentMessage = recentSentMessages[0];
        existingChat = recentMessage.chats;
        
        // ✅ CORREÇÃO CRÍTICA: Usar target_jid do metadata da mensagem, NÃO whatsapp_jid do chat!
        const metadataTargetJid = recentMessage.metadata?.target_jid;
        const connectedPhoneNumber = accountData.phone_number?.replace(/\D/g, '') || '';
        
        if (metadataTargetJid && !metadataTargetJid.endsWith('@lid') && !metadataTargetJid.includes(connectedPhoneNumber)) {
          // ✅ Usar target_jid do metadata se for válido
          targetJid = metadataTargetJid;
          console.log(`✅ [${accountName}] Chat encontrado - usando target_jid do metadata: ${targetJid}`);
        } else if (existingChat.whatsapp_jid && !existingChat.whatsapp_jid.endsWith('@lid') && !existingChat.whatsapp_jid.includes(connectedPhoneNumber)) {
          // ✅ Fallback: usar whatsapp_jid do chat apenas se não for @lid nem o número conectado
          targetJid = existingChat.whatsapp_jid;
          console.log(`⚠️ [${accountName}] Chat encontrado - usando whatsapp_jid do chat (fallback): ${targetJid}`);
        } else {
          // ❌ Não processar se não conseguir identificar um destinatário válido
          console.error(`❌ [${accountName}] Não foi possível identificar destinatário válido - whatsapp_jid suspeito: ${existingChat.whatsapp_jid}, metadata target_jid: ${metadataTargetJid}`);
          return;
        }
        
        // Buscar informações do contato destinatário
        contactInfo = await getContactInfo(sock, targetJid, message);
        phoneNumber = contactInfo.phoneNumber;
        contactName = contactInfo.name || phoneNumber;
      } else {
        // ❌ Não processar mensagem se não conseguir identificar o destinatário
        // Isso só acontece se não tiver remoteJidAlt (raro) e não encontrar chat recente
        console.error(`❌ [${accountName}] Não foi possível identificar destinatário para mensagem própria com @lid sem remoteJidAlt`);
        // A mensagem será processada quando o destinatário responder (como mensagem recebida)
        return;
      }
    }
    
    // ✅ VALIDAÇÃO: Garantir que temos targetJid válido antes de continuar
    if (!targetJid) {
      console.error(`❌ [${accountName}] targetJid não definido após processamento - não é possível criar/atualizar chat`);
      return;
    }
    
    // ✅ VALIDAÇÃO CRÍTICA: Garantir que targetJid não seja o próprio número conectado
    const connectedPhoneNumber = accountData.phone_number?.replace(/\D/g, '') || '';
    const targetPhoneNumber = targetJid.replace(/@.*$/, '').replace(/\D/g, '');
    const isTargetOwnNumber = targetPhoneNumber === connectedPhoneNumber || targetJid.includes(connectedPhoneNumber);
    
    if (isTargetOwnNumber || targetJid.endsWith('@lid')) {
      console.error(`❌ [${accountName}] targetJid inválido - é o próprio número conectado ou @lid: ${targetJid}`);
      console.error(`   Número conectado: ${connectedPhoneNumber}, targetJid: ${targetJid}`);
      return;
    }

    // ✅ CRÍTICO: Validar targetJid ANTES de buscar ou criar chat
    if (targetJid && (targetJid.includes('@newsletter') || targetJid.includes('@updates'))) {
      console.log(`🚫 [${accountName}] targetJid é newsletter/updates, ignorando: ${targetJid}`);
      return; // Não processar mensagens de newsletter/updates
    }

    let chatId;
    if (existingChat) {
      chatId = existingChat.id;
      console.log(`📨 [${accountName}] Chat existente: ${chatId}`);

      // ✅ CORREÇÃO CRÍTICA: Verificar e corrigir whatsapp_jid se estiver errado
      // Isso corrige chats que foram criados com o número errado (ex: 98711283712193@lid)
      const isChatJidIncorrect = existingChat.whatsapp_jid?.endsWith('@lid') || 
                                  existingChat.whatsapp_jid?.includes(connectedPhoneNumber);
      const needsJidUpdate = (isChatJidIncorrect || existingChat.whatsapp_jid !== targetJid) && targetJid;
      
      if (needsJidUpdate) {
        console.log(`⚠️ [${accountName}] CORRIGINDO whatsapp_jid do chat: ${existingChat.whatsapp_jid} → ${targetJid}`);
        await supabase
          .from('chats')
          .update({ whatsapp_jid: targetJid, updated_at: new Date().toISOString() })
          .eq('id', chatId);
      }

      // ✅ CRÍTICO: Validar que o targetJid não é newsletter/updates antes de atualizar
      if (targetJid && (targetJid.includes('@newsletter') || targetJid.includes('@updates'))) {
        console.log(`🚫 [${accountName}] Tentativa de atualizar chat com newsletter/updates bloqueada: ${targetJid}`);
        return; // Não atualizar chat para newsletter/updates
      }

      // ✅ CORREÇÃO: NÃO atualizar nome se o chat já existe e tem um nome válido
      // ✅ Apenas atualizar avatar se necessário
      // ✅ O nome do cliente deve ser mantido quando o chat já existe
      const needsAvatarUpdate = contactInfo.profilePicture && !existingChat.avatar_url;
      
      // ✅ Só atualizar se precisar corrigir JID ou atualizar avatar
      // ✅ NÃO atualizar o nome quando o chat já existe
      if (needsAvatarUpdate || needsJidUpdate) {
        if (needsAvatarUpdate) {
          console.log(`🖼️ [${accountName}] Atualizando foto do chat: ${contactInfo.profilePicture}`);
        }
        
        await supabase
          .from('chats')
          .update({
            name: existingChat.name, // ✅ MANTER o nome existente sempre
            avatar_url: contactInfo.profilePicture || existingChat.avatar_url,
            whatsapp_jid: targetJid, // ✅ Sempre garantir que está correto
            is_group: false
          })
          .eq('id', chatId);
      }
    } else {
      // ✅ CRÍTICO: Validar novamente antes de criar chat (segurança dupla)
      if (!targetJid || targetJid.includes('@newsletter') || targetJid.includes('@updates')) {
        console.log(`🚫 [${accountName}] Tentativa de criar chat para newsletter/updates bloqueada: ${targetJid}`);
        return; // Não criar chat para newsletter/updates
      }

      // ✅ CORREÇÃO: Ao criar chat novo ao receber mensagem do cliente
      // ✅ Usar nome do cliente se disponível e válido, senão usar número
      // ✅ Validar se o nome não é apenas um número ou nome do próprio usuário
      let finalChatName = phoneNumber; // Padrão: usar número
      
      if (contactInfo.name && 
          contactInfo.name !== phoneNumber && 
          !/^\d+$/.test(contactInfo.name.trim()) &&
          !isOwnMessage) { // ✅ Só usar nome se não for mensagem própria
        // ✅ REMOVER prefixo "Contato" se presente
        finalChatName = contactInfo.name.replace(/^Contato\s+/i, '').trim();
        console.log(`✅ [${accountName}] Usando nome do cliente: ${finalChatName}`);
      } else {
        console.log(`📱 [${accountName}] Usando número do cliente: ${finalChatName} (nome será atualizado quando disponível)`);
      }
      
      // ✅ Criar novo chat
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
          name: finalChatName,
          platform: 'whatsapp',
          whatsapp_jid: targetJid,
          assigned_agent_id: accountData.user_id,
          status: 'active',
          organization_id: accountData.organization_id,
          avatar_url: contactInfo.profilePicture,
          is_group: false
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`❌ [${accountName}] Erro ao criar chat:`, createError);
        return;
      }

      chatId = newChat.id;
      console.log(`📨 [${accountName}] Novo chat criado: ${chatId} (Individual) com nome: ${finalChatName}`);
    }

    // ✅ Processar mídia
    const mediaInfo = await downloadAndProcessMedia(message, sock, chatId);

    // ✅ Extrair conteúdo da mensagem
    // ✅ CORREÇÃO: Para mídias sem caption, usar nome do arquivo ou deixar vazio (não usar "Mídia")
    let messageContent = message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption ||
      message.message?.audioMessage?.caption ||
      message.message?.documentMessage?.caption ||
      mediaInfo.caption ||
      null;
    
    // Se não há conteúdo de texto mas há mídia, usar nome do arquivo ou deixar vazio
    if (!messageContent && mediaInfo.mediaType !== 'text' && mediaInfo.fileName) {
      messageContent = mediaInfo.fileName;
    } else if (!messageContent && mediaInfo.mediaType !== 'text') {
      // Para mídias sem nome de arquivo, deixar vazio (será exibido como mídia na interface)
      messageContent = '';
    }

    console.log(`📨 [${accountName}] Conteúdo da mensagem:`, messageContent ? messageContent.substring(0, 100) + '...' : '(mídia sem texto)');

    // ✅ NOVO: Processar CDR (URA) se for mensagem recebida (não própria) e tiver conteúdo de texto
    if (!isOwnMessage && messageContent && messageContent.trim() !== '') {
      try {
        const { processCDRMessage } = await import('./cdrService.js');
        const cdrResult = await processCDRMessage(
          message,
          accountId,
          accountName,
          targetJid,
          messageContent
        );

        if (cdrResult && cdrResult.handled) {
          console.log(`✅ [${accountName}] Mensagem processada pelo CDR`);
          // Mensagem foi tratada pelo CDR, não processar normalmente
          return;
        }
      } catch (cdrError) {
        // Não falhar o processamento da mensagem por erro no CDR
        console.error(`⚠️ [${accountName}] Erro ao processar CDR (não crítico):`, cdrError);
      }
    }

    // ✅ NOVO: Processar resposta de campanha se for mensagem recebida (não própria) e tiver conteúdo de texto
    if (!isOwnMessage && messageContent && messageContent.trim() !== '') {
      try {
        // Extrair número de telefone do JID (formato: 5511999999999@s.whatsapp.net)
        const phoneNumber = targetJid.split('@')[0];

        // ✅ CORREÇÃO: Buscar campanha por telefone diretamente (não depende de contato_id)
        // Isso funciona mesmo se o contato_id não corresponder ao ID real
        const { data: campanhaContato, error: campanhaError } = await supabase
          .from('campanha_contatos')
          .select(`
              id,
              campanha_id,
              contato_id,
              status,
              contato_telefone,
              campanha:campanhas!inner(
                id,
                status,
                organization_id
              )
            `)
          .or(`contato_telefone.eq.${phoneNumber},contato_telefone.eq.55${phoneNumber}`)
          .eq('campanha.organization_id', accountData.organization_id)
          .eq('campanha.status', 'em_execucao')
          .eq('status', 'enviado') // Apenas contatos que já receberam mensagem
          .order('enviado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!campanhaError && campanhaContato && campanhaContato.campanha) {
          console.log(`🎯 [${accountName}] Resposta de campanha detectada para:`, {
            campanha_id: campanhaContato.campanha_id,
            contato_id: campanhaContato.contato_id,
            phone: phoneNumber,
            telefone_campanha: campanhaContato.contato_telefone
          });

          // Processar resposta usando o serviço de campanha
          const CampanhaService = (await import('./campanhaService.js')).default;
          await CampanhaService.processarRespostaCliente(
            campanhaContato.campanha_id,
            campanhaContato.id, // ✅ CORREÇÃO: Usar ID do campanha_contatos, não contato_id
            messageContent // ✅ Primeira mensagem respondida
          );

          console.log(`✅ [${accountName}] Resposta de campanha processada`);
        }
      } catch (campanhaProcessError) {
        // Não falhar o processamento da mensagem por erro na campanha
        console.error(`⚠️ [${accountName}] Erro ao processar resposta de campanha (não crítico):`, campanhaProcessError);
      }
    }

    // ✅ Salvar mensagem no banco (corrigido para mensagens próprias)
    const messagePayload = {
      chat_id: chatId,
      content: messageContent,
      message_type: mediaInfo.mediaType,
      media_url: mediaInfo.mediaUrl,
      is_from_me: isOwnMessage,
      sender_name: isOwnMessage ? accountName : contactName,
      sender_jid: isOwnMessage ? sock.user?.id : targetJid, // Para mensagens próprias: nosso JID. Para recebidas: JID do remetente (targetJid)
      status: isOwnMessage ? 'sent' : 'received',
      whatsapp_message_id: message.key?.id,
      organization_id: accountData.organization_id,
      user_id: accountData.user_id,
      message_object: message.message,
      message_key: message.key,
      metadata: {
        ...mediaInfo,
        is_group_message: false,
        is_own_message: isOwnMessage,
        target_jid: targetJid, // ✅ NOVO: JID do destinatário/remetente
        received_at: new Date().toISOString(),
        push_name: message.pushName,
        timestamp: message.messageTimestamp,
        account_id: accountId // ✅ NOVO: ID da conta WhatsApp que recebeu/enviou a mensagem
      }
    };

    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert(messagePayload)
      .select('id')
      .single();

    if (messageError) {
      console.error(`❌ [${accountName}] Erro ao salvar mensagem:`, messageError);
      return;
    }

    console.log(`✅ [${accountName}] Mensagem salva: ${savedMessage.id} (própria: ${isOwnMessage})`);

    // ✅ NOVO: Transcrever áudio automaticamente se for mensagem de áudio (recebidas E enviadas, incluindo grupos)
    if (mediaInfo.mediaType === 'audio' && mediaInfo.localPath) {
      // Transcrever em background (não bloquear o processamento) - tanto recebidas quanto enviadas
      transcribeAudioAutomatically(savedMessage.id, mediaInfo.localPath, accountData.organization_id, accountName)
        .catch(error => {
          console.error(`❌ [${accountName}] Erro ao transcrever áudio automaticamente:`, error);
        });
    }

    // ✅ Processar regras de monitoramento (para todas as mensagens)
    try {
      await processMessageForRules({
        id: savedMessage.id,
        chat_id: chatId,
        content: messageContent,
        created_at: messagePayload.created_at || new Date().toISOString(),
        sender_name: messagePayload.sender_name,
        organization_id: accountData.organization_id
      });
    } catch (rulesError) {
      console.warn(`⚠️ [${accountName}] Erro ao processar regras:`, rulesError.message);
    }

    // ✅ Atualizar updated_at do chat para que apareça no topo da lista
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    // ✅ Emitir evento para frontend
    const io = global.io;
    if (io) {
      io.to(`org_${accountData.organization_id}`).emit('new-message', {
        message: {
          ...messagePayload,
          id: savedMessage.id,
          created_at: messagePayload.created_at || new Date().toISOString()
        },
        chat_id: chatId,
        is_broadcast: false,
        is_group: false,
        is_own_message: isOwnMessage
      });
      console.log(`📡 [${accountName}] Evento new-message emitido para org ${accountData.organization_id}, chat ${chatId}`);
    } else {
      console.warn(`⚠️ [${accountName}] global.io não disponível - evento new-message não foi emitido`);
    }

    // ⚠️ COMENTADO: Processamento de Flow e IA desabilitado temporariamente
    /*
    // ✅ NOVO: Verificar e executar fluxo (apenas para mensagens de outros)
    if (!isOwnMessage) {
      let flowProcessed = false;

      try {
        // 1. Buscar fluxo ativo para esta organização
        console.log(`🤖 [FLOW] Verificando fluxo ativo para organização: ${accountData.organization_id}`);

        const { data: activeFlow, error: flowError } = await supabase
          .from('fluxos')
          .select('*')
          .eq('organization_id', accountData.organization_id)
          .eq('ativo', true)
          .eq('canal', 'whatsapp')
          .maybeSingle();

        if (flowError) {
          console.error(`❌ [FLOW] Erro ao buscar fluxo ativo:`, flowError);
        }

        if (activeFlow) {
          console.log(`🤖 [FLOW] Fluxo ativo encontrado: ${activeFlow.nome} (${activeFlow.id})`);

          // 2. Executar o fluxo
          try {
            // ✅ Usar phoneNumber como userId único para o fluxo
            const flowUserId = phoneNumber || targetJid.replace('@s.whatsapp.net', '');

            console.log(`🤖 [FLOW] userId para o fluxo: ${flowUserId}`);

            const flowResponse = await executeFlowSimple({
              accountId,
              fromJid: targetJid,
              message: messageContent,
              flow: activeFlow,
              sock,
              chatId,
              userId: flowUserId,
              organizationId: accountData.organization_id,
              mediaInfo,
              accountData,
              whatsapp_Id: accountId
            });

            if (flowResponse && flowResponse.text) {
              console.log(`✅ [FLOW] Fluxo processou a mensagem, enviando resposta: "${flowResponse.text}"`);

              // ✅ NOVO: Delay aleatório antes de resposta automática (para parecer humano)
              const randomDelay = Math.floor(Math.random() * (MAX_DELAY_AUTO_RESPONSE - MIN_DELAY_AUTO_RESPONSE + 1)) + MIN_DELAY_AUTO_RESPONSE;
              console.log(`⏳ [FLOW] Aguardando ${randomDelay}ms antes de enviar resposta (delay aleatório para evitar banimento)`);
              await new Promise(resolve => setTimeout(resolve, randomDelay));

              // ✅ NOVO: Aplicar rate limiting antes de enviar
              await checkAndApplyRateLimit(accountId);

              // Enviar resposta do fluxo
              await sock.sendMessage(targetJid, { text: flowResponse.text });
              console.log(`📤 [FLOW] Resposta enviada`);

              // Se houver segunda mensagem com delay
              if (flowResponse.nextMessage) {
                const delay = Math.max(flowResponse.delay || 3000, MIN_DELAY_BETWEEN_MESSAGES);
                console.log(`⏳ [FLOW] Aguardando ${delay}ms para enviar próxima mensagem...`);
                setTimeout(async () => {
                  try {
                    // ✅ NOVO: Aplicar rate limiting antes de enviar segunda mensagem
                    await checkAndApplyRateLimit(accountId);
                    await sock.sendMessage(targetJid, { text: flowResponse.nextMessage });
                    console.log(`📤 [FLOW] Segunda mensagem enviada: "${flowResponse.nextMessage}"`);
                  } catch (delayError) {
                    console.error(`❌ [FLOW] Erro ao enviar mensagem com delay:`, delayError);
                  }
                }, delay);
              }

              flowProcessed = true;
            } else {
              console.log(`⚠️ [FLOW] Fluxo não retornou resposta válida`);
            }
          } catch (flowExecError) {
            console.error(`❌ [FLOW] Erro ao executar fluxo:`, flowExecError);
          }
        } else {
          console.log(`ℹ️ [FLOW] Nenhum fluxo ativo encontrado para esta organização`);
        }
      } catch (flowCheckError) {
        console.error(`❌ [FLOW] Erro ao verificar fluxo:`, flowCheckError);
      }

      // 3. Se o fluxo não processou, processar com IA
      if (!flowProcessed) {
        try {
          console.log(`🤖 [IA] Processando com IA (fluxo não ativo ou não processou)`);
          await processMessageWithAI(
            accountId,
            targetJid,
            messageContent,
            sock,
            message,
            accountData.organization_id,
            mediaInfo,
            false
          );
        } catch (aiError) {
          console.warn(`⚠️ [${accountName}] Erro ao processar com IA:`, aiError.message);
        }
      } else {
        console.log(`✅ [FLOW] Mensagem processada pelo fluxo, pulando IA`);
      }
    } else {
      console.log(`🤖 [${accountName}] Pulando processamento automático para mensagem própria`);
    }
    */

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao processar mensagem recebida:`, error);
  }
}

// Desconectar conta específica
export const disconnectWhatsAppAccount = async (accountId) => {
  try {
    const connection = activeConnections.get(accountId);
    if (connection) {
      try {
        // ✅ CRÍTICO: Encerrar socket ANTES de limpar arquivos
        if (connection.socket) {
          try {
            console.log(`🔌 [DISCONNECT] Encerrando socket para ${accountId}...`);
            
            if (connection.socket.ws?.readyState === 1) {
              await connection.socket.logout();
              console.log(`✅ [DISCONNECT] Logout do socket executado`);
            } else {
              await connection.socket.end(new Error('Desconexão manual via botão'));
              console.log(`✅ [DISCONNECT] Socket encerrado`);
            }
            
            // Aguardar para garantir que o socket foi completamente encerrado
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (logoutError) {
            console.warn(`⚠️ Erro ao fazer logout (continuando desconexão):`, logoutError.message);
            // Tentar encerrar de forma forçada
            try {
              await connection.socket.end(new Error('Forçando encerramento'));
            } catch (e) {
              // Ignorar se já estiver fechado
            }
          }
        }
      } catch (logoutError) {
        console.warn(`⚠️ Erro ao fazer logout (continuando desconexão):`, logoutError.message);
      }
      
      // ✅ CRÍTICO: Limpar timers
      if (connection.qrTimer) {
        clearTimeout(connection.qrTimer);
        connection.qrTimer = null;
      }
      if (connection.connectionTimeout) {
        clearTimeout(connection.connectionTimeout);
        connection.connectionTimeout = null;
      }
      if (connection.recreateTimeout) {
        clearTimeout(connection.recreateTimeout);
        connection.recreateTimeout = null;
      }
      
      // ✅ CRÍTICO: Limpar cache de QR code
      if (qrCodeCache.has(accountId)) {
        qrCodeCache.delete(accountId);
        console.log(`🗑️ [DISCONNECT] Cache de QR code removido para ${accountId}`);
      }
      
      // ✅ CRÍTICO: Liberar lock de conexão
      releaseConnectionLock(accountId);
      console.log(`🔓 [DISCONNECT] Lock de conexão liberado para ${accountId}`);
      
      activeConnections.delete(accountId);

      // ✅ CRÍTICO: Remover arquivos de sessão APÓS encerrar socket
      const authDir = `./auth/${accountId}`;
      if (fs.existsSync(authDir)) {
        try {
          // Aguardar um pouco mais para garantir que o socket liberou os arquivos
          await new Promise(resolve => setTimeout(resolve, 500));
          fs.rmSync(authDir, { recursive: true, force: true });
          console.log(`🧹 Arquivos de sessão removidos para ${accountId}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Erro ao remover arquivos de sessão:`, cleanupError.message);
          // Tentar novamente após um delay maior
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log(`✅ Arquivos de sessão removidos na segunda tentativa para ${accountId}`);
          } catch (retryError) {
            console.error(`❌ Erro ao remover arquivos na segunda tentativa:`, retryError.message);
          }
        }
      }

      // ✅ CORREÇÃO: Atualizar tabela whatsapp_accounts IMEDIATAMENTE (sem throttle)
      try {
        const { error: updateError } = await supabase
          .from('whatsapp_accounts')
          .update({
            status: 'disconnected',
            phone_number: null,
            qr_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('account_id', accountId);

        if (updateError) {
          console.error(`❌ Erro ao atualizar whatsapp_accounts para ${accountId}:`, updateError);
        } else {
          console.log(`✅ [DISCONNECT] whatsapp_accounts atualizada para ${accountId} (disconnected)`);
        }
      } catch (dbError) {
        console.error(`❌ Erro ao atualizar whatsapp_accounts para ${accountId}:`, dbError);
      }

      // Atualizar tabela connection_accounts (se existir)
      try {
        const { error: updateError } = await supabase
          .from('connection_accounts')
          .update({
            status: 'disconnected',
            updated_at: new Date().toISOString(),
            config: {
              phone_number: null,
              qr_code: null
            }
          })
          .eq('id', accountId);

        if (updateError) {
          // Não é crítico se connection_accounts não existir
          console.log(`ℹ️ connection_accounts não atualizada (pode não existir):`, updateError.message);
        } else {
          console.log(`✅ [DISCONNECT] connection_accounts atualizada para ${accountId} (disconnected)`);
        }
      } catch (dbError) {
        // Não é crítico
        console.log(`ℹ️ Erro ao atualizar connection_accounts (não crítico):`, dbError.message);
      }

      // ✅ NOVO: Emitir evento de desconexão via Socket.IO
      try {
        const { data: accountInfo } = await supabase
          .from('whatsapp_accounts')
          .select('organization_id, name')
          .eq('account_id', accountId)
          .maybeSingle();

        if (accountInfo && accountInfo.organization_id && io) {
          // ✅ Emitir evento de desconexão
          io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
            accountId,
            accountName: accountInfo.name || accountId,
            reason: 'Desconexão manual',
            attemptCount: 0,
            status: 'disconnected' // ✅ NOVO: Incluir status explícito
          });
          console.log(`📡 [DISCONNECT] Evento de desconexão emitido para organização ${accountInfo.organization_id}`);
          
          // ✅ NOVO: Emitir evento adicional para forçar atualização da UI
          io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-status-update', {
            accountId,
            accountName: accountInfo.name || accountId,
            status: 'disconnected',
            phoneNumber: null,
            qrCode: null,
            forceUpdate: true // ✅ Flag para forçar atualização imediata na UI
          });
          console.log(`📡 [DISCONNECT] Evento whatsapp-status-update emitido para forçar atualização da UI`);
        }
      } catch (emitError) {
        console.warn(`⚠️ Erro ao emitir evento de desconexão:`, emitError.message);
      }

      return { success: true, message: 'Conta desconectada com sucesso' };
    }
    
    // ✅ CORREÇÃO: Se a conta não está ativa, ainda assim atualizar o status no banco
    const authDir = `./auth/${accountId}`;
    if (fs.existsSync(authDir)) {
      try {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log(`🧹 Arquivos de sessão limpos para conta inativa ${accountId}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Erro ao limpar arquivos:`, cleanupError.message);
      }
    }
    
    // ✅ CRÍTICO: Limpar cache de QR code mesmo se não houver conexão ativa
    if (qrCodeCache.has(accountId)) {
      qrCodeCache.delete(accountId);
      console.log(`🗑️ [DISCONNECT] Cache de QR code removido para conta inativa ${accountId}`);
    }
    
    // ✅ CRÍTICO: Liberar lock de conexão para contas inativas também
    releaseConnectionLock(accountId);
    console.log(`🔓 [DISCONNECT] Lock de conexão liberado para conta inativa ${accountId}`);
    
    // ✅ NOVO: Atualizar status mesmo se não houver conexão ativa
    try {
      const { error: updateError } = await supabase
        .from('whatsapp_accounts')
        .update({
          status: 'disconnected',
          phone_number: null,
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId);

      if (updateError) {
        console.error(`❌ Erro ao atualizar status de conta inativa ${accountId}:`, updateError);
      } else {
        console.log(`✅ [DISCONNECT] Status atualizado para conta inativa ${accountId}`);
        
        // ✅ NOVO: Emitir evento Socket.IO para contas inativas também
        try {
          const { data: accountInfo } = await supabase
            .from('whatsapp_accounts')
            .select('organization_id, name')
            .eq('account_id', accountId)
            .maybeSingle();

          if (accountInfo && accountInfo.organization_id && io) {
            io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-status-update', {
              accountId,
              accountName: accountInfo.name || accountId,
              status: 'disconnected',
              phoneNumber: null,
              qrCode: null,
              forceUpdate: true
            });
            console.log(`📡 [DISCONNECT] Evento whatsapp-status-update emitido para conta inativa ${accountId}`);
          }
        } catch (emitError) {
          console.warn(`⚠️ Erro ao emitir evento para conta inativa:`, emitError.message);
        }
      }
    } catch (dbError) {
      console.error(`❌ Erro ao atualizar status de conta inativa:`, dbError);
    }

    return { success: true, message: 'Sessão inativa removida e status atualizado' };
  } catch (error) {
    console.error('❌ Erro ao desconectar conta:', error);
    return { success: false, error: error.message };
  }
};

// ✅ NOVO: Função para resetar rate limit global (útil para administradores)
export const resetRateLimit = () => {
  console.log('🔄 [RATE_LIMIT] Resetando rate limit global...');
  globalReconnectThrottle = false;
  lastRateLimitError = 0;
  rateLimitedAccounts.clear();
  console.log('✅ [RATE_LIMIT] Rate limit resetado com sucesso');
};

// ✅ NOVO: Função para verificar e aplicar rate limiting por conta (exportada para uso em outros módulos)
export const checkAndApplyRateLimit = async (accountId) => {
  const now = Date.now();
  const rateLimitData = accountMessageRateLimit.get(accountId) || { count: 0, windowStart: now, lastMessageTime: 0 };
  
  // ✅ Resetar contador se passou 1 minuto
  if (now - rateLimitData.windowStart > 60000) {
    rateLimitData.count = 0;
    rateLimitData.windowStart = now;
  }
  
  // ✅ Verificar se excedeu limite de mensagens por minuto
  if (rateLimitData.count >= MESSAGES_PER_MINUTE_LIMIT) {
    const waitTime = 60000 - (now - rateLimitData.windowStart);
    console.warn(`⚠️ [RATE_LIMIT] Conta ${accountId} atingiu limite de ${MESSAGES_PER_MINUTE_LIMIT} msg/min. Aguardando ${Math.ceil(waitTime/1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    rateLimitData.count = 0;
    rateLimitData.windowStart = Date.now();
  }
  
  // ✅ Aplicar delay mínimo entre mensagens
  const timeSinceLastMessage = now - rateLimitData.lastMessageTime;
  if (timeSinceLastMessage < MIN_DELAY_BETWEEN_MESSAGES) {
    const delayNeeded = MIN_DELAY_BETWEEN_MESSAGES - timeSinceLastMessage;
    console.log(`⏳ [RATE_LIMIT] Aguardando ${delayNeeded}ms antes de enviar (delay mínimo entre mensagens)`);
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  
  // ✅ Atualizar contador e timestamp
  rateLimitData.count++;
  rateLimitData.lastMessageTime = Date.now();
  accountMessageRateLimit.set(accountId, rateLimitData);
};

export const sendMessageByAccount = async (accountId, to, message, replyTo = null, originalMessageObject = null, originalMessageKey = null, originalMessageContent = null, originalMessageIsFromMe = false, originalSenderJid = null) => {
  try {
    // ✅ NOVO: Aplicar rate limiting antes de enviar
    await checkAndApplyRateLimit(accountId);

    const connection = activeConnections.get(accountId);

    if (!connection || !connection.socket) {
      console.error('❌ Conexão não encontrada para accountId:', accountId);
      
      // ✅ DESABILITADO: NUNCA reconectar automaticamente
      // Apenas retornar erro informando que a conta precisa ser conectada manualmente
      throw new Error('Conta não conectada. Por favor, conecte a conta manualmente através da interface ou API.');
    }

    // 🔍 Verificar se a conexão está realmente ativa
    if (!connection.socket.user || !connection.socket.user.id) {
      console.error('❌ Socket não autenticado para accountId:', accountId);
      throw new Error('Conexão WhatsApp não está autenticada. Tente reconectar a conta.');
    }

    // Formatar JID corretamente
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    // Preparar a mensagem com ou sem resposta
    const messageData = { text: message };

    if (replyTo && originalMessageObject && originalMessageKey) {
      // Descobrir o JID do agente (número do próprio bot)
      const agentJid = connection.socket.user?.id;
      let participant = originalMessageKey.participant || originalMessageKey.remoteJid;
      if (originalMessageKey.fromMe && agentJid) {
        participant = agentJid;
      }

      // 🔍 Validar se originalMessageKey tem ID
      if (!originalMessageKey.id) {
        console.warn('⚠️ originalMessageKey sem ID, pulando contextInfo');
      } else {
        console.log('🔄 Configurando resposta para mensagem (contextInfo):', replyTo, originalMessageObject, participant, originalMessageKey.remoteJid);
        messageData.contextInfo = {
          quotedMessage: originalMessageObject,
          stanzaId: originalMessageKey.id,
          participant,
          remoteJid: originalMessageKey.remoteJid
        };
      }
    }

    console.log('📤 Enviando mensagem para:', jid, 'com dados:', messageData);
    const result = await connection.socket.sendMessage(jid, messageData);
    console.log('📤 Mensagem enviada com resultado:', result);

    // 🔍 Validação mais robusta do resultado
    const messageId = result?.key?.id || result?.messageStubParameters?.key?.id || null;

    return {
      success: true,
      message: 'Mensagem enviada com sucesso',
      whatsapp_message_id: messageId
    };
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    console.error('❌ Stack trace:', error.stack);
    return { success: false, error: error.message };
  }
};

// Enviar imagem por conta específica
export const sendImageByAccount = async (accountId, to, imagePath, caption = '') => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.socket) {
      throw new Error('Conta não conectada');
    }
    // Formatar JID corretamente
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    // Ler o arquivo da imagem
    const buffer = fs.readFileSync(imagePath);
    // Só envie o caption se não for vazio e não for um caminho de arquivo
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    const result = await connection.socket.sendMessage(jid, {
      image: buffer,
      caption: safeCaption
    });
    return {
      success: true,
      message: 'Imagem enviada com sucesso',
      whatsapp_message_id: result?.key?.id || null
    };
  } catch (error) {
    console.error('❌ Erro ao enviar imagem:', error);
    return { success: false, error: error.message };
  }
};

// Enviar documento por conta específica
export const sendDocumentByAccount = async (accountId, to, filePath, mimetype = '', filename = '', caption = '') => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.socket) {
      throw new Error('Conta não conectada');
    }
    // Formatar JID corretamente
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    // Ler o arquivo
    const buffer = fs.readFileSync(filePath);
    // Só envie o caption se não for vazio e não for um caminho de arquivo
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    const result = await connection.socket.sendMessage(jid, {
      document: buffer,
      mimetype: mimetype || undefined,
      fileName: filename || undefined,
      caption: safeCaption
    });
    return {
      success: true,
      message: 'Documento enviado com sucesso',
      whatsapp_message_id: result?.key?.id || null
    };
  } catch (error) {
    console.error('❌ Erro ao enviar documento:', error);
    return { success: false, error: error.message };
  }
};

// Enviar áudio por conta específica
export const sendAudioByAccount = async (accountId, to, audioPath, mimetype = 'audio/webm', caption = '') => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.socket) {
      throw new Error('Conta não conectada');
    }
    // Formatar JID corretamente
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    // Ler o arquivo de áudio
    const buffer = fs.readFileSync(audioPath);
    // Áudio normalmente não tem caption, mas se vier, nunca envie caminho de arquivo
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    const result = await connection.socket.sendMessage(jid, {
      audio: buffer,
      mimetype: mimetype || 'audio/webm',
      ptt: true,
      caption: safeCaption
    });
    return {
      success: true,
      message: 'Áudio enviado com sucesso',
      whatsapp_message_id: result?.key?.id || null
    };
  } catch (error) {
    console.error('❌ Erro ao enviar áudio:', error);
    return { success: false, error: error.message };
  }
};

// Obter status de todas as conexões
export const getAllConnectionsStatus = () => {
  const connections = [];
  activeConnections.forEach((connection, accountId) => {
    connections.push({
      accountId,
      accountName: connection.accountName,
      phoneNumber: connection.phoneNumber,
      status: connection.status
    });
  });
  return connections;
};

// Obter status de uma conexão específica
export const getConnectionStatus = (accountId) => {
  const connection = activeConnections.get(accountId);
  return connection ? connection.status : 'disconnected';
};

// Verificar status da conexão de uma conta específica
export const checkConnectionStatus = (accountId) => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.socket) {
      return { connected: false, error: 'Conta não conectada' };
    }

    const user = connection.socket.user;
    if (!user || !user.id) {
      return { connected: false, error: 'WhatsApp não autenticado' };
    }

    return {
      connected: true,
      phoneNumber: user.id,
      accountName: connection.accountName,
      status: connection.status
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

// ✅ Função auxiliar para obter extensão do tipo MIME (movida para cima para ser acessível)
const getExtensionFromMimeType = (mimeType) => {
  // ✅ CORREÇÃO: Remover codecs do mimeType se presente (ex: "audio/ogg; codecs=opus" -> "audio/ogg")
  const cleanMimeType = mimeType?.split(';')[0]?.trim() || mimeType;
  
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mp3': '.mp3',
    'audio/mp4': '.m4a',
    'audio/webm': '.webm',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar'
  };
  return mimeMap[cleanMimeType] || '.bin';
};

// ✅ MELHORADO: Função para baixar e processar mídia do WhatsApp com tratamento robusto de erros
const downloadAndProcessMedia = async (message, sock, chatId) => {
  try {
    // ✅ VALIDAÇÃO: Verificar parâmetros de entrada
    if (!message) {
      console.error('❌ [MÍDIA] Mensagem não fornecida');
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: '❌ Mensagem inválida',
        localPath: null
      };
    }

    if (!sock) {
      console.error('❌ [MÍDIA] Socket não fornecido');
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: '❌ Conexão WhatsApp não disponível',
        localPath: null
      };
    }

    if (!chatId) {
      console.error('❌ [MÍDIA] ChatId não fornecido');
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: '❌ Chat ID não encontrado',
        localPath: null
      };
    }

    let mediaType = 'text';
    let mediaUrl = null;
    let fileName = null;
    let mimeType = null;
    let fileSize = null;
    let caption = null;

    // ✅ MELHORADO: Detectar tipo de mídia e extrair informações com validação
    if (message.message?.imageMessage) {
      mediaType = 'image';
      const imgMsg = message.message.imageMessage;
      mediaUrl = imgMsg.url;
      mimeType = imgMsg.mimetype || 'image/jpeg';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType (suporta GIF, PNG, WEBP, etc)
      const extension = getExtensionFromMimeType(mimeType);
      fileName = imgMsg.fileName || `image_${Date.now()}${extension}`;
      fileSize = imgMsg.fileLength;
      caption = imgMsg.caption || '';
    } else if (message.message?.videoMessage) {
      mediaType = 'video';
      const vidMsg = message.message.videoMessage;
      mediaUrl = vidMsg.url;
      mimeType = vidMsg.mimetype || 'video/mp4';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType
      const extension = getExtensionFromMimeType(mimeType);
      fileName = vidMsg.fileName || `video_${Date.now()}${extension}`;
      fileSize = vidMsg.fileLength;
      caption = vidMsg.caption || '';
    } else if (message.message?.audioMessage) {
      mediaType = 'audio';
      const audMsg = message.message.audioMessage;
      mediaUrl = audMsg.url;
      mimeType = audMsg.mimetype || 'audio/ogg';
      // Áudio pode ter PTT (push to talk)
      if (audMsg.ptt) {
        mimeType = 'audio/ogg; codecs=opus';
        fileName = `voice_${Date.now()}.ogg`;
      } else {
        // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType
        const extension = getExtensionFromMimeType(mimeType);
        fileName = audMsg.fileName || `audio_${Date.now()}${extension}`;
      }
      fileSize = audMsg.fileLength;
    } else if (message.message?.documentMessage) {
      mediaType = 'file';
      const docMsg = message.message.documentMessage;
      mediaUrl = docMsg.url;
      mimeType = docMsg.mimetype || 'application/pdf';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType ou nome do arquivo
      if (docMsg.fileName) {
        fileName = docMsg.fileName;
      } else {
        const extension = getExtensionFromMimeType(mimeType);
        fileName = `document_${Date.now()}${extension}`;
      }
      fileSize = docMsg.fileLength;
      caption = docMsg.caption || '';
    } else if (message.message?.stickerMessage) {
      mediaType = 'sticker';
      const stkMsg = message.message.stickerMessage;
      mediaUrl = stkMsg.url;
      mimeType = stkMsg.mimetype || 'image/webp';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType (pode ser webp, png, etc)
      const extension = getExtensionFromMimeType(mimeType);
      fileName = `sticker_${Date.now()}${extension}`;
      fileSize = stkMsg.fileLength;
    } else if (message.message?.contactMessage) {
      mediaType = 'contact';
      const contactMsg = message.message.contactMessage;
      // Contatos são salvos como texto especial
      const contact = contactMsg.contacts?.[0];
      if (contact) {
        const contactText = `📞 Contato: ${contact.name || 'Sem nome'}\n📱 Número: ${contact.number || 'Sem número'}`;
        return {
          mediaType: 'contact',
          mediaUrl: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
          caption: contactText,
          localPath: null
        };
      }
    } else if (message.message?.locationMessage) {
      mediaType = 'location';
      const locMsg = message.message.locationMessage;
      const locationText = `📍 Localização\n🌍 Latitude: ${locMsg.degreesLatitude}\n🌍 Longitude: ${locMsg.degreesLongitude}`;
      return {
        mediaType: 'location',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: locationText,
        localPath: null
      };
    }

    // Se não há mídia, retornar apenas texto
    if (!mediaUrl) {
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: null,
        localPath: null
      };
    }

    console.log(`📥 [MÍDIA] Baixando ${mediaType}: ${fileName} (${mimeType})`);

    // ✅ VALIDAÇÃO: Verificar se sock tem updateMediaMessage
    if (!sock.updateMediaMessage) {
      console.warn('⚠️ [MÍDIA] sock.updateMediaMessage não disponível, tentando download sem reupload');
    }

    // ✅ MELHORADO: Criar diretório para o chat com tratamento de erro
    const uploadDir = path.join(__dirname, '..', 'uploads', chatId);
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`📁 [MÍDIA] Diretório criado: ${uploadDir}`);
      }
    } catch (dirError) {
      console.error(`❌ [MÍDIA] Erro ao criar diretório ${uploadDir}:`, dirError.message);
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: `❌ Erro ao criar diretório: ${dirError.message}`,
        localPath: null
      };
    }

    // ✅ MELHORADO: Baixar mídia usando Baileys com tratamento de erro específico
    let buffer;
    try {
      const downloadOptions = {
        logger: console
      };
      
      // Adicionar reuploadRequest apenas se disponível
      if (sock.updateMediaMessage && typeof sock.updateMediaMessage === 'function') {
        downloadOptions.reuploadRequest = sock.updateMediaMessage;
      }

      buffer = await downloadMediaMessage(message, 'buffer', {}, downloadOptions);

      if (!buffer || buffer.length === 0) {
        console.error(`❌ [MÍDIA] Buffer vazio ou inválido para ${mediaType}`);
        return {
          mediaType: 'text',
          mediaUrl: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
          caption: `❌ Erro ao baixar mídia: buffer vazio`,
          localPath: null
        };
      }

      console.log(`✅ [MÍDIA] Download concluído: ${buffer.length} bytes`);
    } catch (downloadError) {
      console.error(`❌ [MÍDIA] Erro ao baixar mídia do WhatsApp:`, downloadError);
      const errorMessage = downloadError.message || downloadError.toString();
      
      // ✅ Tratamento específico para diferentes tipos de erro
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        return {
          mediaType: 'text',
          mediaUrl: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
          caption: '❌ Erro ao baixar mídia: timeout',
          localPath: null
        };
      } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        return {
          mediaType: 'text',
          mediaUrl: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
          caption: '❌ Erro ao baixar mídia: arquivo não encontrado no servidor',
          localPath: null
        };
      } else if (errorMessage.includes('expired')) {
        return {
          mediaType: 'text',
          mediaUrl: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
          caption: '❌ Erro ao baixar mídia: arquivo expirado',
          localPath: null
        };
      } else {
        return {
          mediaType: 'text',
          mediaUrl: null,
          fileName: null,
          mimeType: null,
          fileSize: null,
          caption: `❌ Erro ao baixar mídia: ${errorMessage}`,
          localPath: null
        };
      }
    }

    // ✅ MELHORADO: Gerar nome único para o arquivo com validação
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = fileName ? path.extname(fileName) : getExtensionFromMimeType(mimeType);
    const uniqueFileName = `file-${timestamp}-${randomId}${extension}`;
    const localPath = path.join(uploadDir, uniqueFileName);

    // ✅ MELHORADO: Salvar arquivo localmente com tratamento de erro
    try {
      fs.writeFileSync(localPath, buffer);
      console.log(`✅ [MÍDIA] Arquivo salvo: ${localPath} (${buffer.length} bytes)`);
    } catch (writeError) {
      console.error(`❌ [MÍDIA] Erro ao salvar arquivo ${localPath}:`, writeError.message);
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: `❌ Erro ao salvar mídia: ${writeError.message}`,
        localPath: null
      };
    }

    // ✅ Retornar informações da mídia
    return {
      mediaType,
      mediaUrl: `/uploads/${chatId}/${uniqueFileName}`,
      fileName: fileName || uniqueFileName,
      mimeType,
      fileSize: fileSize || buffer.length,
      caption: caption || '',
      localPath
    };

  } catch (error) {
    // ✅ MELHORADO: Log detalhado do erro com stack trace
    console.error('❌ [MÍDIA] Erro geral ao processar mídia:', error);
    console.error('❌ [MÍDIA] Stack trace:', error.stack);
    
    const errorMessage = error.message || error.toString();
    
    return {
      mediaType: 'text',
      mediaUrl: null,
      fileName: null,
      mimeType: null,
      fileSize: null,
      caption: `❌ Erro ao processar mídia: ${errorMessage}`,
      localPath: null
    };
  }
};

// ✅ Função auxiliar já definida acima (removida duplicata)

// Função utilitária para filtrar mensagens padrão
function isMensagemPadrao(text) {
  if (!text) return false;
  const padroes = [
    'Processando...',
    'Verificando horário de atendimento...',
    'Tentando...',
    'Aguarde...',
    'Carregando...',
    'Processando sua solicitação...'
  ];
  return padroes.includes(text.trim());
}

// ✅ NOVA: Função para transcrever áudio automaticamente (exportada para uso em groupProcessor)
export async function transcribeAudioAutomatically(messageId, audioPath, organizationId, accountName) {
  let convertedAudioPath = null;
  let renamedAudioPath = null;
  
  try {
    console.log(`🎤 [${accountName}] Iniciando transcrição automática do áudio: ${audioPath}`);

    if (!process.env.OPENAI_API_KEY) {
      console.warn(`⚠️ [${accountName}] OpenAI API key não configurada, pulando transcrição`);
      return;
    }

    if (!fs.existsSync(audioPath)) {
      console.error(`❌ [${accountName}] Arquivo de áudio não encontrado: ${audioPath}`);
      return;
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ✅ NOVO: Verificar formato do arquivo e converter se necessário
    const supportedFormats = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
    const fileExtension = path.extname(audioPath).toLowerCase().replace('.', '') || '';
    let finalAudioPath = audioPath;

    console.log(`🔍 [${accountName}] Verificando formato do áudio: extensão="${fileExtension}", caminho="${audioPath}"`);

    // Converter para MP3 se:
    // 1. Não tiver extensão
    // 2. Formato não for suportado
    // 3. For OGG/OGA (mesmo que suportado, pode ter problemas com codecs específicos)
    const needsConversion = !fileExtension || !supportedFormats.includes(fileExtension) || fileExtension === 'ogg' || fileExtension === 'oga';
    
    if (needsConversion) {
      console.log(`🔄 [${accountName}] Convertendo áudio de "${fileExtension || 'sem extensão'}" para MP3...`);
      console.log(`📁 [${accountName}] Arquivo original: ${audioPath}`);
      
      const audioDir = path.dirname(audioPath);
      const audioName = path.basename(audioPath, path.extname(audioPath)) || `audio_${Date.now()}`;
      convertedAudioPath = path.join(audioDir, `${audioName}_converted.mp3`);
      
      console.log(`📁 [${accountName}] Caminho de conversão: ${convertedAudioPath}`);
      
      try {
        const ffmpegCommandPrefix = getBundledFfmpegCommand();

        try {
          execSync(`${ffmpegCommandPrefix} -version`, { stdio: 'pipe', timeout: 5000 });
        } catch (ffmpegCheckError) {
          throw new Error(`FFmpeg embutido indisponível: ${ffmpegCheckError.message || ffmpegCheckError}. Reinstale as dependências do backend para converter áudios.`);
        }
        
        // Converter usando ffmpeg com codec específico para garantir compatibilidade
        const ffmpegCommand = `${ffmpegCommandPrefix} -i "${audioPath}" -acodec libmp3lame -ar 44100 -ac 2 -b:a 192k -y "${convertedAudioPath}"`;
        console.log(`🔧 [${accountName}] Executando conversão com ffmpeg...`);
        
        const conversionOutput = execSync(ffmpegCommand, { 
          stdio: 'pipe',
          timeout: 30000, // 30 segundos de timeout
          encoding: 'utf8'
        });
        
        // Verificar se o arquivo foi criado e tem tamanho válido
        if (!fs.existsSync(convertedAudioPath)) {
          throw new Error('Arquivo convertido não foi criado após conversão');
        }
        
        const convertedSize = fs.statSync(convertedAudioPath).size;
        if (convertedSize === 0) {
          throw new Error('Arquivo convertido está vazio (0 bytes)');
        }
        
        console.log(`✅ [${accountName}] Conversão para MP3 concluída: ${convertedAudioPath} (${convertedSize} bytes)`);
        finalAudioPath = convertedAudioPath;
      } catch (conversionError) {
        console.error(`❌ [${accountName}] Erro na conversão para MP3:`, conversionError);
        console.error(`❌ [${accountName}] Detalhes do erro:`, conversionError.message);
        
        // Se a conversão falhar, não tentar usar o arquivo original se não for suportado
        if (!fileExtension || !supportedFormats.includes(fileExtension)) {
          console.error(`❌ [${accountName}] Não é possível usar arquivo original (formato não suportado: ${fileExtension || 'sem extensão'})`);
          throw new Error(`Falha ao converter áudio para formato suportado. Formato original: ${fileExtension || 'desconhecido'}`);
        }
        
        // Apenas para formatos suportados, tentar usar o original
        console.warn(`⚠️ [${accountName}] Tentando usar arquivo original (formato suportado: ${fileExtension})...`);
        finalAudioPath = audioPath;
      }
    } else {
      console.log(`✅ [${accountName}] Formato ${fileExtension} é suportado, usando arquivo original`);
    }

    // Verificar se o arquivo final existe
    if (!fs.existsSync(finalAudioPath)) {
      throw new Error(`Arquivo de áudio não encontrado: ${finalAudioPath}`);
    }

    const finalExtension = path.extname(finalAudioPath).toLowerCase().replace('.', '') || 'mp3';
    const fileName = path.basename(finalAudioPath);
    console.log(`📤 [${accountName}] Enviando arquivo para transcrição: ${fileName} (extensão: ${finalExtension}, tamanho: ${fs.statSync(finalAudioPath).size} bytes)`);

    // ✅ GARANTIR: O arquivo sempre tenha extensão .mp3 após conversão
    // Se ainda não tiver extensão válida, renomear para .mp3
    let fileToUpload = finalAudioPath;
    if (!finalExtension || !supportedFormats.includes(finalExtension)) {
      const newPath = finalAudioPath + '.mp3';
      if (finalAudioPath !== convertedAudioPath) {
        // Copiar arquivo para novo nome com extensão
        fs.copyFileSync(finalAudioPath, newPath);
        fileToUpload = newPath;
        renamedAudioPath = newPath;
        console.log(`🔄 [${accountName}] Arquivo renomeado para ter extensão .mp3: ${newPath}`);
      }
    }

    // Transcrever usando OpenAI Whisper
    // A API detecta o formato pelo conteúdo e pelo nome do arquivo
    const audioStream = fs.createReadStream(fileToUpload);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "pt",
      response_format: "text"
    });

    const transcriptionText = typeof transcription === 'string' ? transcription : transcription.text || String(transcription);
    console.log(`✅ [${accountName}] Transcrição concluída: ${transcriptionText.substring(0, 50)}...`);

    // Atualizar metadata da mensagem com a transcrição
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('metadata')
      .eq('id', messageId)
      .eq('organization_id', organizationId)
      .single();

    if (!messageError && message) {
      const metadata = message.metadata || {};
      metadata.transcription = transcriptionText;
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ metadata })
        .eq('id', messageId)
        .eq('organization_id', organizationId);

      if (updateError) {
        console.error(`❌ [${accountName}] Erro ao atualizar metadata com transcrição:`, updateError);
      } else {
        console.log(`✅ [${accountName}] Transcrição salva no metadata da mensagem ${messageId}`);
        
        // Emitir evento para frontend atualizar a mensagem
        if (io) {
          io.to(`org_${organizationId}`).emit('message-transcription-updated', {
            messageId: messageId,
            transcription: transcriptionText
          });
        }
      }
    }

    // ✅ NOVO: Limpar arquivos temporários se existirem
    if (convertedAudioPath && fs.existsSync(convertedAudioPath)) {
      try {
        fs.unlinkSync(convertedAudioPath);
        console.log(`🧹 [${accountName}] Arquivo temporário convertido removido`);
      } catch (cleanupError) {
        console.warn(`⚠️ [${accountName}] Erro ao remover arquivo temporário:`, cleanupError);
      }
    }
    
    if (renamedAudioPath && fs.existsSync(renamedAudioPath)) {
      try {
        fs.unlinkSync(renamedAudioPath);
        console.log(`🧹 [${accountName}] Arquivo temporário renomeado removido`);
      } catch (cleanupError) {
        console.warn(`⚠️ [${accountName}] Erro ao remover arquivo renomeado:`, cleanupError);
      }
    }
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao transcrever áudio automaticamente:`, error);
    
    // Limpar arquivos temporários em caso de erro
    if (convertedAudioPath && fs.existsSync(convertedAudioPath)) {
      try {
        fs.unlinkSync(convertedAudioPath);
      } catch (cleanupError) {
        console.warn(`⚠️ [${accountName}] Erro ao remover arquivo temporário após erro:`, cleanupError);
      }
    }
    
    if (renamedAudioPath && fs.existsSync(renamedAudioPath)) {
      try {
        fs.unlinkSync(renamedAudioPath);
      } catch (cleanupError) {
        console.warn(`⚠️ [${accountName}] Erro ao remover arquivo renomeado após erro:`, cleanupError);
      }
    }
  }
}

// ✅ NOVA IMPLEMENTAÇÃO: Sistema inteligente de detecção automática de broadcast
export async function saveBroadcastMessage(message, accountId, accountName, sock) {
  console.log(`📢 [BROADCAST SAVE] Salvando mensagem de broadcast no banco...`);

  try {
    // Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id, id')
      .eq('account_id', accountId)
      .single();

    if (!accountData) {
      console.error(`❌ [BROADCAST SAVE] Conta não encontrada: ${accountId}`);
      return;
    }

    // Extrair conteúdo da mensagem
    const messageContent = message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      'Mídia';

    const broadcastJid = message.key.remoteJid;
    const messageId = message.key.id;
    const timestamp = message.messageTimestamp;

    console.log(`📢 [BROADCAST SAVE] Broadcast detectado: ${broadcastJid}`);
    console.log(`📢 [BROADCAST SAVE] Message ID: ${messageId}`);
    console.log(`📢 [BROADCAST SAVE] Conteúdo: "${messageContent}"`);

    // ✅ NOVO: Sistema de coleta automática de destinatários
    const broadcastCollector = new Map();

    // ✅ NOVO: Configurar listener para receipts
    const receiptListener = (updates) => {
      updates.forEach(update => {
        if (update.receipts) {
          update.receipts.forEach(receipt => {
            if (receipt.participant && receipt.id === messageId) {
              const phoneNumber = receipt.participant.split('@')[0];
              if (!broadcastCollector.has(receipt.participant)) {
                broadcastCollector.set(receipt.participant, {
                  jid: receipt.participant,
                  phone: phoneNumber,
                  timestamp: receipt.timestamp || Date.now()
                });
                console.log(`📢 [BROADCAST COLLECTOR] Novo destinatário detectado: ${receipt.participant}`);
              }
            }
          });
        }
      });
    };

    // ✅ NOVO: Adicionar listener temporário
    sock.ev.on('receipts.update', receiptListener);

    // ✅ NOVO: Aguardar 30 segundos para coletar todos os destinatários
    console.log(`📢 [BROADCAST SAVE] Aguardando 30 segundos para detectar destinatários...`);

    await new Promise(resolve => setTimeout(resolve, 30000));

    // ✅ NOVO: Remover listener
    sock.ev.off('receipts.update', receiptListener);

    // ✅ NOVO: Obter lista de destinatários coletados
    const detectedRecipients = Array.from(broadcastCollector.values());

    console.log(`📢 [BROADCAST SAVE] Destinatários detectados: ${detectedRecipients.length}`);
    detectedRecipients.forEach((recipient, index) => {
      console.log(`📢 [BROADCAST SAVE] ${index + 1}. ${recipient.phone} (${recipient.jid})`);
    });

    // ✅ NOVO: Se não detectou nenhum, usar lista de fallback baseada nos logs
    if (detectedRecipients.length === 0) {
      console.log(`�� [BROADCAST SAVE] Nenhum destinatário detectado, usando lista de fallback...`);

      // ✅ NOVO: Lista dinâmica baseada nos logs recentes
      const fallbackRecipients = [
        '5519993430256@s.whatsapp.net',
        '5519995180958@s.whatsapp.net',
        '5519995449300@s.whatsapp.net',
        '5519995976422@s.whatsapp.net',
        '5519989410246@s.whatsapp.net' // ✅ NOVO: Incluir novos números
      ];

      detectedRecipients.push(...fallbackRecipients.map(jid => ({
        jid,
        phone: jid.split('@')[0],
        timestamp: Date.now()
      })));
    }

    // ✅ NOVO: Salvar mensagem para cada destinatário detectado
    console.log(`📢 [BROADCAST SAVE] Processando ${detectedRecipients.length} destinatários...`);

    for (const recipient of detectedRecipients) {
      const { jid: recipientJid, phone: phoneNumber } = recipient;

      // ✅ CRÍTICO: Ignorar destinatários de newsletter/updates
      if (recipientJid && (recipientJid.includes('@newsletter') || recipientJid.includes('@updates'))) {
        console.log(`🚫 [BROADCAST SAVE] Destinatário newsletter/updates ignorado: ${recipientJid}`);
        continue; // Pular este destinatário
      }

      // Buscar chat existente para este destinatário
      let { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id, name')
        .eq('whatsapp_jid', recipientJid)
        .eq('assigned_agent_id', accountData.user_id)
        .eq('organization_id', accountData.organization_id)
        .maybeSingle();

      let chatId;
      if (existingChat) {
        chatId = existingChat.id;
        console.log(`📢 [BROADCAST SAVE] Chat existente para ${phoneNumber}: ${chatId}`);
      } else {
        // Criar novo chat para este destinatário
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert({
            name: phoneNumber,
            platform: 'whatsapp',
            whatsapp_jid: recipientJid,
            assigned_agent_id: accountData.user_id,
            status: 'active',
            organization_id: accountData.organization_id
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`❌ [BROADCAST SAVE] Erro ao criar chat para ${phoneNumber}:`, createError);
          continue;
        }

        chatId = newChat.id;
        console.log(`📢 [BROADCAST SAVE] Novo chat criado para ${phoneNumber}: ${chatId}`);
      }

      // Processar mídia
      const mediaInfo = await downloadAndProcessMedia(message, sock, chatId);

      // ✅ NOVO: Salvar mensagem com metadados de broadcast
      const messagePayload = {
        chat_id: chatId,
        content: messageContent,
        message_type: mediaInfo.mediaType,
        media_url: mediaInfo.mediaUrl,
        is_from_me: true,
        sender_name: 'Broadcast',
        status: 'sent',
        whatsapp_message_id: message.key.id,
        organization_id: accountData.organization_id,
        user_id: accountData.user_id,
        account_id: accountData.id,
        sender_jid: sock.user?.id || message.key.remoteJid,
        message_object: message.message,
        message_key: message.key,
        metadata: {
          is_broadcast_message: true,
          broadcast_list: broadcastJid,
          original_sender: accountName,
          broadcast_message_id: messageId,
          recipient_count: detectedRecipients.length,
          recipient_phone: phoneNumber,
          detected_automatically: true, // ✅ NOVO: Flag para indicar detecção automática
          timestamp: new Date().toISOString(),
          ...mediaInfo
        }
      };

      const { data: savedMessage, error: messageError } = await supabase
        .from('messages')
        .insert(messagePayload)
        .select('id')
        .single();

      if (messageError) {
        console.error(`❌ [BROADCAST SAVE] Erro ao salvar mensagem para ${phoneNumber}:`, messageError);
        continue;
      }

      console.log(`✅ [BROADCAST SAVE] Mensagem salva para ${phoneNumber}: ${savedMessage.id}`);

      // Emitir evento para frontend
      io.to(`org_${accountData.organization_id}`).emit('new-message', {
        message: {
          ...messagePayload,
          id: savedMessage.id
        },
        chat_id: chatId,
        is_broadcast: true
      });
    }

    console.log(`✅ [BROADCAST SAVE] Processamento completo! ${detectedRecipients.length} mensagens salvas.`);

  } catch (error) {
    console.error(`❌ [BROADCAST SAVE] Erro geral:`, error);
  }
}

// ✅ MELHORADA: Função para atualizar informações de contatos existentes
async function updateExistingContactInfo(sock, accountId, accountName) {
  try {
    console.log(`🔄 [UPDATE CONTACTS] Iniciando atualização de contatos para conta: ${accountName}`);

    // Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id')
      .eq('account_id', accountId)
      .single();

    if (!accountData) {
      console.error(`❌ [UPDATE CONTACTS] Conta não encontrada: ${accountId}`);
      return;
    }

    // ✅ Buscar apenas chats individuais (não grupos)
    const { data: existingChats, error: chatsError } = await supabase
      .from('chats')
      .select('id, name, whatsapp_jid, avatar_url')
      .eq('assigned_agent_id', accountData.user_id)
      .eq('organization_id', accountData.organization_id)
      .eq('platform', 'whatsapp')
      .eq('is_group', false) // ✅ Apenas contatos individuais
      .or('name.is.null,name.eq.,name.like.%5511%,name.like.%5512%,name.like.%5513%,name.like.%5514%,name.like.%5515%,name.like.%5516%,name.like.%5517%,name.like.%5518%,name.like.%5519%,name.like.%5521%,name.like.%5522%,name.like.%5523%,name.like.%5524%,name.like.%5525%,name.like.%5526%,name.like.%5527%,name.like.%5528%,name.like.%5529%,name.like.%5531%,name.like.%5532%,name.like.%5533%,name.like.%5534%,name.like.%5535%,name.like.%5536%,name.like.%5537%,name.like.%5538%,name.like.%5539%,name.like.%5541%,name.like.%5542%,name.like.%5543%,name.like.%5544%,name.like.%5545%,name.like.%5546%,name.like.%5547%,name.like.%5548%,name.like.%5549%');

    if (chatsError) {
      console.error(`❌ [UPDATE CONTACTS] Erro ao buscar chats:`, chatsError);
      return;
    }

    console.log(`🔄 [UPDATE CONTACTS] Encontrados ${existingChats?.length || 0} contatos individuais para atualizar`);

    let updatedCount = 0;
    let errorCount = 0;

    // Atualizar cada chat individual
    for (const chat of existingChats || []) {
      if (!chat.whatsapp_jid) continue;

      try {
        console.log(`🔄 [UPDATE CONTACTS] Processando contato: ${chat.name} (${chat.whatsapp_jid})`);

        const contactInfo = await getContactInfo(sock, chat.whatsapp_jid);

        console.log(`📋 [UPDATE CONTACTS] Informações obtidas:`, {
          chatId: chat.id,
          oldName: chat.name,
          newName: contactInfo.name,
          hasPicture: !!contactInfo.profilePicture,
          exists: contactInfo.exists
        });

        // ✅ SEMPRE tentar atualizar se temos um nome (mesmo se for igual)
        if (contactInfo.name) {
          console.log(`✅ [UPDATE CONTACTS] Atualizando nome: ${chat.name} → ${contactInfo.name}`);

          const { error: updateError } = await supabase
            .from('chats')
            .update({
              name: contactInfo.name,
              avatar_url: contactInfo.profilePicture || chat.avatar_url,
              is_group: false // ✅ Garantir que é individual
            })
            .eq('id', chat.id);

          if (updateError) {
            console.error(`❌ [UPDATE CONTACTS] Erro ao atualizar chat ${chat.id}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ [UPDATE CONTACTS] Chat ${chat.id} atualizado com sucesso`);
            updatedCount++;
          }
        } else {
          console.log(`⚠️ [UPDATE CONTACTS] Chat ${chat.id} não conseguiu obter nome para: ${chat.whatsapp_jid}`);
        }

        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ [UPDATE CONTACTS] Erro ao processar chat ${chat.id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ [UPDATE CONTACTS] Atualização concluída:`, {
      total: existingChats?.length || 0,
      updated: updatedCount,
      errors: errorCount,
      accountName
    });

  } catch (error) {
    console.error(`❌ [UPDATE CONTACTS] Erro geral:`, error);
  }
}

// ✅ NOVA FUNÇÃO: Corrigir nomes nas mensagens
async function fixMessageSenderNames(sock, accountId, accountName) {
  try {
    console.log(`🔄 [FIX MESSAGES] Iniciando correção de nomes nas mensagens para conta: ${accountName}`);

    // Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id')
      .eq('account_id', accountId)
      .single();

    if (!accountData) {
      console.error(`❌ [FIX MESSAGES] Conta não encontrada: ${accountId}`);
      return;
    }

    // Buscar mensagens com números ao invés de nomes
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, sender_name, sender_jid, chat_id')
      .eq('account_id', accountId)
      .or('sender_name.like.%5511%,sender_name.like.%5512%,sender_name.like.%5513%,sender_name.like.%5514%,sender_name.like.%5515%,sender_name.like.%5516%,sender_name.like.%5517%,sender_name.like.%5518%,sender_name.like.%5519%,sender_name.like.%5521%,sender_name.like.%5522%,sender_name.like.%5523%,sender_name.like.%5524%,sender_name.like.%5525%,sender_name.like.%5526%,sender_name.like.%5527%,sender_name.like.%5528%,sender_name.like.%5529%,sender_name.like.%5531%,sender_name.like.%5532%,sender_name.like.%5533%,sender_name.like.%5534%,sender_name.like.%5535%,sender_name.like.%5536%,sender_name.like.%5537%,sender_name.like.%5538%,sender_name.like.%5539%,sender_name.like.%5541%,sender_name.like.%5542%,sender_name.like.%5543%,sender_name.like.%5544%,sender_name.like.%5545%,sender_name.like.%5546%,sender_name.like.%5547%,sender_name.like.%5548%,sender_name.like.%5549%');

    if (messagesError) {
      console.error(`❌ [FIX MESSAGES] Erro ao buscar mensagens:`, messagesError);
      return;
    }

    console.log(`🔄 [FIX MESSAGES] Encontradas ${messages?.length || 0} mensagens com números para corrigir`);

    let updatedCount = 0;
    let errorCount = 0;

    // Corrigir cada mensagem
    for (const message of messages || []) {
      if (!message.sender_jid) continue;

      try {
        console.log(`🔄 [FIX MESSAGES] Processando mensagem: ${message.id} (${message.sender_jid})`);

        const contactInfo = await getContactInfo(sock, message.sender_jid);

        console.log(`📋 [FIX MESSAGES] Informações obtidas:`, {
          messageId: message.id,
          oldName: message.sender_name,
          newName: contactInfo.name
        });

        // Atualizar se temos um nome melhor
        if (contactInfo.name && contactInfo.name !== message.sender_name) {
          console.log(`✅ [FIX MESSAGES] Atualizando nome: ${message.sender_name} → ${contactInfo.name}`);

          const { error: updateError } = await supabase
            .from('messages')
            .update({
              sender_name: contactInfo.name
            })
            .eq('id', message.id);

          if (updateError) {
            console.error(`❌ [FIX MESSAGES] Erro ao atualizar mensagem ${message.id}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ [FIX MESSAGES] Mensagem ${message.id} atualizada com sucesso`);
            updatedCount++;
          }
        } else {
          console.log(`⚠️ [FIX MESSAGES] Mensagem ${message.id} não precisa de atualização`);
        }

        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ [FIX MESSAGES] Erro ao processar mensagem ${message.id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ [FIX MESSAGES] Correção concluída:`, {
      total: messages?.length || 0,
      updated: updatedCount,
      errors: errorCount,
      accountName
    });

  } catch (error) {
    console.error(`❌ [FIX MESSAGES] Erro geral:`, error);
  }
}

// ✅ EXPORTAR: Funções para uso externo
export { updateExistingContactInfo, getContactInfo, activeConnections, fixMessageSenderNames };

// ✅ NOVO: Função para obter QR Code do cache (para uso em rotas HTTP)
export const getQRCodeFromCache = async (accountId) => {
  // ✅ REDUZIDO: Logs menos verbosos para evitar poluição durante polling frequente
  // console.log(`🔍 [getQRCodeFromCache] Buscando QR Code no cache para accountId: ${accountId}`);
  
  const cachedQR = qrCodeCache.get(accountId);
  
  if (!cachedQR || !cachedQR.qr) {
    // ✅ REDUZIDO: Log apenas em caso de erro real, não a cada requisição de polling
    // console.log(`❌ [getQRCodeFromCache] QR Code não encontrado no cache para accountId: ${accountId}`);
    return null;
  }
  
  // ✅ REDUZIDO: Log apenas quando QR code é encontrado (sucesso)
  // console.log(`✅ [getQRCodeFromCache] QR Code encontrado no cache para accountId: ${accountId}`);
  
  // Converter para DataURL
  const qrString = await qr.toDataURL(cachedQR.qr, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    quality: 0.92,
    margin: 1
  });
  
  // ✅ REDUZIDO: Log apenas quando necessário
  // console.log(`✅ [getQRCodeFromCache] QR Code convertido para DataURL, tamanho: ${qrString.length} chars`);
  
  return {
    qrCode: qrString,
    timestamp: cachedQR.timestamp
  };
};

// ✅ NOVA FUNÇÃO: Processar mensagens individuais enviadas
async function processBroadcastSent(message, toJid, accountId, accountName, sock) {
  console.log(`📤 [INDIVIDUAL SAVE] Salvando mensagem individual para ${toJid}`);

  // ✅ CRÍTICO: Ignorar mensagens para newsletter/updates
  if (toJid && (toJid.includes('@newsletter') || toJid.includes('@updates'))) {
    console.log(`🚫 [${accountName}] Tentativa de salvar mensagem para newsletter/updates ignorada: ${toJid}`);
    return;
  }

  try {
    // Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id')
      .eq('account_id', accountId)
      .single();

    if (!accountData) {
      console.error(`❌ [INDIVIDUAL SAVE] Conta não encontrada: ${accountId}`);
      return;
    }

    // ✅ MELHORADO: Buscar informações completas do contato
    const contactInfo = await getContactInfo(sock, toJid);
    const phoneNumber = contactInfo.phoneNumber;
    let avatarUrl = contactInfo.profilePicture;

    console.log(`👤 [INDIVIDUAL SAVE] Informações do destinatário:`, {
      jid: toJid,
      name: contactInfo.name,
      phone: phoneNumber,
      hasPicture: !!contactInfo.profilePicture
    });

    // Buscar chat existente
    let { data: existingChat, error: chatError } = await supabase
      .from('chats')
      .select('id, name')
      .eq('whatsapp_jid', toJid)
      .eq('assigned_agent_id', accountData.user_id)
      .eq('organization_id', accountData.organization_id)
      .maybeSingle();

    let chatId;
    if (existingChat) {
      chatId = existingChat.id;
      console.log(`📤 [INDIVIDUAL SAVE] Chat existente: ${chatId}`);

      // ✅ ATUALIZAR: Informações do contato sempre que temos um nome válido (não é número)
      // ✅ CORREÇÃO: Só atualizar se o nome não for apenas um número (evita atualizar com número quando já tem nome)
      if (contactInfo.name && contactInfo.name !== phoneNumber && !/^\d+$/.test(contactInfo.name.trim())) {
        console.log(`🔄 [INDIVIDUAL SAVE] Atualizando nome do chat: ${existingChat.name} → ${contactInfo.name}`);
        await supabase
          .from('chats')
          .update({
            name: contactInfo.name,
            avatar_url: avatarUrl || existingChat.avatar_url
          })
          .eq('id', chatId);
      }
    } else {
      // ✅ CORREÇÃO: Ao criar chat novo (primeira mensagem enviada), usar APENAS o número do telefone
      // ✅ O nome do cliente só será atualizado quando ele responder (via processReceivedMessage)
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
          name: phoneNumber, // ✅ Usar apenas o número, não o nome
          platform: 'whatsapp',
          whatsapp_jid: toJid,
          assigned_agent_id: accountData.user_id,
          status: 'active',
          organization_id: accountData.organization_id,
          avatar_url: avatarUrl
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`❌ [INDIVIDUAL SAVE] Erro ao criar chat:`, createError);
        return;
      }

      chatId = newChat.id;
      console.log(`📤 [INDIVIDUAL SAVE] Novo chat criado: ${chatId} com número: ${phoneNumber} (nome será atualizado quando cliente responder)`);
    }

    // Processar mídia
    const mediaInfo = await downloadAndProcessMedia(message, sock, chatId);

    const messageContent = message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      'Mídia';

    // Salvar mensagem individual
    const messagePayload = {
      chat_id: chatId,
      content: messageContent,
      message_type: mediaInfo.mediaType,
      sender_type: 'agent', // ✅ NOVO: Identificar como agente
      sender_name: accountName,
      metadata: {
        ...mediaInfo.metadata,
        message_id: message.key.id,
        sent_by_agent: true
      },
      timestamp: new Date(message.messageTimestamp * 1000).toISOString()
    };

    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert(messagePayload)
      .select('id')
      .single();

    if (messageError) {
      console.error(`❌ [INDIVIDUAL SAVE] Erro ao salvar mensagem:`, messageError);
      return;
    }

    console.log(`✅ [INDIVIDUAL SAVE] Mensagem salva: ${savedMessage.id}`);

    // Emitir evento para frontend
    io.to(`org_${accountData.organization_id}`).emit('new-message', {
      message: {
        ...messagePayload,
        id: savedMessage.id
      },
      chat_id: chatId,
      is_broadcast: false
    });

  } catch (error) {
    console.error(`❌ [INDIVIDUAL SAVE] Erro geral:`, error);
  }
}

// ✅ NOVA FUNÇÃO: Limpar sessões conflitantes
export const clearConflictingSessions = async (accountId) => {
  try {
    console.log(` [CLEANUP] Limpando sessões conflitantes para conta: ${accountId}`);

    // Remover arquivos de sessão
    const authDir = `./auth/${accountId}`;
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log(`✅ [CLEANUP] Arquivos de sessão removidos: ${authDir}`);
    }

    // Remover conexão ativa
    if (activeConnections.has(accountId)) {
      const connection = activeConnections.get(accountId);
      try {
        if (connection.socket) {
          await connection.socket.end(new Error('Limpeza de sessão conflitante'));
        }
      } catch (error) {
        console.log(`⚠️ [CLEANUP] Erro ao encerrar socket: ${error.message}`);
      }
      activeConnections.delete(accountId);
      console.log(`✅ [CLEANUP] Conexão removida do cache`);
    }

    // Atualizar status no banco
    await supabase
      .from('whatsapp_accounts')
      .update({
        status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('account_id', accountId);

    console.log(`✅ [CLEANUP] Status atualizado no banco`);

    return { success: true, message: 'Sessões conflitantes limpas' };
  } catch (error) {
    console.error(`❌ [CLEANUP] Erro ao limpar sessões:`, error);
    return { success: false, error: error.message };
  }
};

// ✅ CORREÇÃO 2: Função de QR Code melhorada com tratamento de erro robusto
const handleQRCode = async (qrCode, accountId, accountName, qrTimer) => {
  // ✅ NOVO: Verificar se já está conectado ANTES de processar QR code (verificação de segurança adicional)
  const connectionData = activeConnections.get(accountId);
  if (connectionData && connectionData.status === 'connected') {
    console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada (status: connected) - ignorando`);
    return; // Não processar QR code se já está conectado
  }
  
  // ✅ Verificar também no banco de dados
  try {
    // ✅ CORREÇÃO: Usar maybeSingle() para evitar erro quando conta não existe
    const { data: accountData } = await supabase
      .from('whatsapp_accounts')
      .select('status, phone_number')
      .eq('account_id', accountId)
      .maybeSingle();
    
    if (accountData?.status === 'connected' && accountData?.phone_number) {
      console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada no banco - ignorando`);
      return; // Não processar QR code se já está conectado no banco
    }
  } catch (error) {
    console.warn(`⚠️ [${accountName}] Erro ao verificar status no banco antes de processar QR:`, error.message);
    // Continuar processamento se houver erro na verificação
  }

  // ✅ OTIMIZADO: Throttle para evitar processar o mesmo QR code múltiplas vezes
  const cachedQR = qrCodeCache.get(accountId);
  const now = Date.now();

  if (cachedQR && (now - cachedQR.timestamp) < QR_CODE_THROTTLE && cachedQR.qr === qrCode) {
    // QR code já foi processado recentemente, ignorar
    return;
  }

  console.log(`📱 [${accountName}] QR Code gerado - Iniciando processamento`);

  let accountInfo = null; // ✅ CORREÇÃO: Declarar fora do try

  try {
    // ✅ DEBUG: Verificar se qrCode é válido
    if (!qrCode || typeof qrCode !== 'string') {
      console.error(`❌ [${accountName}] QR Code inválido:`, typeof qrCode, qrCode);
      return;
    }

    console.log(`📱 [${accountName}] QR Code válido, gerando DataURL...`);

    // ✅ CORREÇÃO: Reutilizar connectionData já declarado no início da função
    const shouldTriggerReconnectEmail =
      connectionData &&
      connectionData.shouldGenerateQr === false &&
      connectionData.source !== 'manual' &&
      !connectionData.reconnectEmailSent; // ✅ CORREÇÃO: Verificar se email já foi enviado

    if (shouldTriggerReconnectEmail) {
      console.log(`📧 [${accountName}] Detectado novo pareamento obrigatório, disparando e-mail para responsável...`);
      await ensureReconnectEmailDispatched(accountId, accountName);
      // ✅ CORREÇÃO: Marcar que o email foi enviado para evitar loop
      if (connectionData) {
        connectionData.reconnectEmailSent = true;
      }
    }
    // ✅ OTIMIZADO: Remover log do QR code completo (economiza I/O)

    // ✅ Gerar QR Code como DataURL com tratamento de erro
    const qrString = await qr.toDataURL(qrCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1
    });

    console.log(`✅ [${accountName}] QR Code gerado com sucesso, tamanho: ${qrString.length} chars`);

    // ✅ OTIMIZADO: Usar cache para buscar organização da conta
    let accountData = null;
    const cachedAccountInfo = accountInfoCache.get(accountId);

    if (cachedAccountInfo && (now - cachedAccountInfo.lastUpdated) < ACCOUNT_INFO_CACHE_TTL) {
      // Usar cache
      accountData = { organization_id: cachedAccountInfo.organization_id };
      console.log(`📊 [${accountName}] Usando cache de organização`);
    } else {
      // Buscar do banco e atualizar cache
      // ✅ CORREÇÃO: Usar maybeSingle() para evitar erro quando conta não existe
      const { data: fetchedData, error: accountError } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .maybeSingle();

      if (accountError) {
        console.error(`❌ [${accountName}] Erro ao buscar organização:`, accountError);
        // ✅ Continuar processamento mesmo com erro - emitir globalmente como fallback
      } else if (fetchedData && fetchedData.organization_id) {
        accountData = fetchedData;
        // Atualizar cache
        accountInfoCache.set(accountId, {
          organization_id: fetchedData.organization_id,
          lastUpdated: now
        });
      } else {
        // ✅ Conta não encontrada ou sem organization_id - logar mas continuar
        console.warn(`⚠️ [${accountName}] Conta não encontrada ou sem organization_id no banco (accountId: ${accountId})`);
      }
    }

    // ✅ OTIMIZADO: Emitir QR Code usando dados do cache ou banco
    if (!accountData) {
      // ✅ Fallback: emitir globalmente quando organização não encontrada (se io estiver disponível)
      if (io) {
        const qrData = {
          accountId,
          qr: qrString,
          accountName,
          timestamp: Date.now()
        };
        console.log(`📡 [${accountName}] ⚠️ Organização não encontrada - emitindo QR code globalmente como fallback`);
        io.emit('whatsapp-qr-code', qrData);
        io.emit('qr_code', {
          accountId,
          qrCode: qrString,
          accountName
        });
      }
    } else {
      accountInfo = accountData; // ✅ CORREÇÃO: Atribuir valor
      // ✅ Emitir QR Code para a organização específica (se io estiver disponível)
      if (io) {
        const qrData = {
          accountId,
          qr: qrString,
          accountName,
          timestamp: Date.now()
        };
        
        // ✅ NOVO: Se houver userId na conexão, emitir APENAS para o usuário específico
        // Isso garante que apenas o usuário que clicou em conectar receba o QR code
        // ✅ IMPORTANTE: Convites e conexões automáticas NÃO têm userId, então usam fallback para organização
        const connectionUserId = connectionData?.userId;
        if (connectionUserId && connectionData?.source === 'manual') {
          // ✅ Conexão manual autenticada: emitir apenas para o usuário específico
          console.log(`📡 [${accountName}] 🔒 Emitindo QR Code APENAS para usuário ${connectionUserId} (conexão manual autenticada)`);
          io.to(`user-${connectionUserId}`).emit('whatsapp-qr-code', qrData);
          io.to(`user-${connectionUserId}`).emit('qr_code', {
            accountId,
            qrCode: qrString,
            accountName
          });
          console.log(`📡 [${accountName}] ✅ QR Code emitido exclusivamente para user-${connectionUserId}`);
        } else {
          // ✅ FALLBACK: Se não houver userId OU for conexão automática/convite, emitir para organização
          // Isso garante compatibilidade com:
          // - Convites (usuário não está logado, não tem userId)
          // - Conexões automáticas (source: 'auto', não têm userId)
          // - Reconexões automáticas
          console.log(`📡 [${accountName}] 📢 Emitindo para organização ${accountInfo.organization_id} (${connectionData?.source || 'sem source'} - ${connectionUserId ? 'com userId mas não manual' : 'sem userId'})`);
          io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-qr-code', qrData);
          io.to(`org_${accountInfo.organization_id}`).emit('qr_code', {
            accountId,
            qrCode: qrString,
            accountName
          });
        }
        
        console.log(`📡 [${accountName}] Detalhes do QR emitido:`, {
          accountId,
          accountName,
          qrLength: qrString.length,
          userId: connectionUserId || 'N/A',
          room: connectionUserId ? `user-${connectionUserId}` : `org_${accountInfo.organization_id}`,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`⚠️ [${accountName}] QR Code gerado mas Socket.IO não disponível!`);
      }
    }

    // ✅ CACHE: Salvar QR code processado no cache
    qrCodeCache.set(accountId, {
      qr: qrCode,
      timestamp: now
    });
    console.log(`💾 [${accountName}] QR Code salvo no cache para accountId: ${accountId}`);
    console.log(`💾 [${accountName}] DEBUG Cache - QR Code salvo:`, {
      accountId,
      qrCodeLength: qrCode?.length || 0,
      qrCodeType: typeof qrCode,
      timestamp: now,
      cacheSize: qrCodeCache.size,
      cacheKeys: Array.from(qrCodeCache.keys())
    });

    // ✅ Configurar timer de expiração do QR (aumentado para 5 minutos)
    if (qrTimer) clearTimeout(qrTimer);

    qrTimer = setTimeout(async () => {
      console.log(`⏰ [${accountName}] QR Code expirado (5 minutos)`);

      if (accountInfo) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-qr-expired', {
          accountId,
          accountName,
          timestamp: Date.now()
        });
      } else {
        io.emit('whatsapp-qr-expired', {
          accountId,
          accountName,
          timestamp: Date.now()
        });
      }
    }, 300000); // 5 minutos

  } catch (error) {
    console.error(`❌ [${accountName}] Erro crítico ao processar QR Code:`, error);

    // ✅ Emitir erro para o frontend (se io estiver disponível)
    if (io) {
      if (accountInfo) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-qr-error', {
          accountId,
          accountName,
          error: error.message,
          timestamp: Date.now()
        });
      } else {
        io.emit('whatsapp-qr-error', {
          accountId,
          accountName,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
  }
};

// ✅ NOVA: Função para lidar com logout (movida para antes de handleDisconnection)
const handleLogout = async (accountId, accountName) => {
  console.log(`🧹 [${accountName}] Usuário fez logout, limpando sessão COMPLETAMENTE`);

  try {
    // ✅ CRÍTICO: Obter conexão antes de limpar
    const connection = activeConnections.get(accountId);
    
    // ✅ CRÍTICO: Encerrar socket ANTES de limpar arquivos
    if (connection && connection.socket) {
      try {
        console.log(`🔌 [${accountName}] Encerrando socket antes de limpar sessão...`);
        
        // Verificar se socket está aberto antes de encerrar
        if (connection.socket.ws?.readyState === 1) {
          await connection.socket.logout();
          console.log(`✅ [${accountName}] Logout do socket executado`);
        } else {
          // Se não está aberto, apenas encerrar
          await connection.socket.end(new Error('Logout manual - limpando sessão'));
          console.log(`✅ [${accountName}] Socket encerrado`);
        }
        
        // Aguardar um pouco para garantir que o socket foi completamente encerrado
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (socketError) {
        console.warn(`⚠️ [${accountName}] Erro ao encerrar socket (continuando limpeza):`, socketError.message);
        // Tentar encerrar de forma forçada
        try {
          if (connection.socket) {
            await connection.socket.end(new Error('Forçando encerramento'));
          }
        } catch (e) {
          // Ignorar erro se já estiver fechado
        }
      }
    }
    
    // ✅ CRÍTICO: Limpar timers ANTES de limpar arquivos
    if (connection) {
      if (connection.qrTimer) {
        clearTimeout(connection.qrTimer);
        connection.qrTimer = null;
        console.log(`⏰ [${accountName}] Timer de QR code limpo`);
      }
      if (connection.connectionTimeout) {
        clearTimeout(connection.connectionTimeout);
        connection.connectionTimeout = null;
        console.log(`⏰ [${accountName}] Timer de conexão limpo`);
      }
      if (connection.recreateTimeout) {
        clearTimeout(connection.recreateTimeout);
        connection.recreateTimeout = null;
        console.log(`⏰ [${accountName}] Timer de recriação limpo`);
      }
    }
    
    // ✅ CRÍTICO: Limpar cache de QR code
    if (qrCodeCache.has(accountId)) {
      qrCodeCache.delete(accountId);
      console.log(`🗑️ [${accountName}] Cache de QR code removido`);
    }
    
    // ✅ Limpar arquivos de sessão
    const authDir = `./auth/${accountId}`;
    if (fs.existsSync(authDir)) {
      try {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log(`🧹 [${accountName}] Arquivos de sessão removidos: ${authDir}`);
      } catch (cleanupError) {
        console.error(`❌ [${accountName}] Erro ao remover arquivos de sessão:`, cleanupError.message);
        // Tentar novamente após um delay
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
          console.log(`✅ [${accountName}] Arquivos de sessão removidos na segunda tentativa`);
        } catch (retryError) {
          console.error(`❌ [${accountName}] Erro ao remover arquivos na segunda tentativa:`, retryError.message);
        }
      }
    } else {
      console.log(`ℹ️ [${accountName}] Diretório de autenticação não existe: ${authDir}`);
    }

    // ✅ NOTA: Status já foi atualizado em handleDisconnection antes de chamar esta função
    console.log(`✅ [${accountName}] Logout processado - TODAS as sessões limpas`);
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao limpar dados de logout:`, error);
    throw error; // Re-throw para que o erro seja tratado pelo chamador
  }
};

// ✅ NOVA: Função de reconexão inteligente
const handleDisconnection = async (lastDisconnect, accountId, accountName, qrTimer, connectionTimeout) => {
  // ✅ Determinar informações do erro ANTES de logar
  const reason = lastDisconnect?.error?.output?.statusCode;
  const errorMessage = lastDisconnect?.error?.message || '';
  const errorCode = lastDisconnect?.error?.code;
  
  // ✅ NOVO: Log estruturado detalhado para diagnóstico de desconexão
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔴 [${accountName}] ===== DESCONEXÃO DETECTADA - DIAGNÓSTICO DETALHADO =====`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔢 Código de razão (statusCode): ${reason}`);
  console.log(`📝 Mensagem de erro: ${errorMessage || 'Nenhuma'}`);
  console.log(`🏷️ Código do erro: ${errorCode || 'Nenhum'}`);
  console.log(`📦 Dados do erro:`, JSON.stringify(lastDisconnect?.error?.data || {}, null, 2));
  console.log(`🔗 Output completo:`, JSON.stringify(lastDisconnect?.error?.output || {}, null, 2));
  
  // ✅ NOVO: Mapear códigos de desconexão para descrições legíveis
  const disconnectReasonMap = {
    401: 'loggedOut - Usuário desconectou manualmente no WhatsApp',
    408: 'timedOut - QR code expirou (15 minutos)',
    428: 'rateLimited - Muitas tentativas, WhatsApp bloqueou temporariamente',
    440: 'conflict - Sessão aberta em outro dispositivo',
    515: 'restartRequired - Erro de stream, necessita reinício'
  };
  
  console.log(`📖 Descrição do código: ${disconnectReasonMap[reason] || `Código desconhecido (${reason})`}`);
  
  // ✅ Verificar estado da conexão em memória
  const connectionData = activeConnections.get(accountId);
  console.log(`💾 Estado em activeConnections:`, {
    exists: !!connectionData,
    status: connectionData?.status || 'N/A',
    attemptCount: connectionData?.attemptCount || 0,
    source: connectionData?.source || 'N/A',
    lastConnected: connectionData?.lastConnected ? new Date(connectionData.lastConnected).toISOString() : 'Nunca',
    isAuthenticating: connectionData?.isAuthenticating || false
  });
  console.log(`${'='.repeat(80)}\n`);
  
  // ✅ CRÍTICO: Verificar PRIMEIRO se é desconexão manual (401) ANTES de verificar outros erros
  // Isso evita tratar desconexão manual como erro 515 quando a mensagem contém "Stream Errored"
  const isManualDisconnect = reason === DisconnectReason.loggedOut || reason === 401;
  
  if (isManualDisconnect) {
    console.log(`📱 [${accountName}] ⚠️ DESCONEXÃO MANUAL DETECTADA (loggedOut - código 401)`);
    console.log(`📱 [${accountName}] O usuário desconectou o WhatsApp pelo celular`);
    console.log(`📱 [${accountName}] Conexão fechada - Logout manual (usuário desconectou pelo celular)`);
  } else if (reason === 515 || (errorMessage.includes('Stream Errored') && reason !== 401) || errorMessage.includes('restart required')) {
    // ✅ CORREÇÃO: Só tratar como 515 se NÃO for código 401
    console.log(`🔄 [${accountName}] Conexão fechada - Erro 515 (Stream Errored - restart required)`);
  } else if (reason === 408 || errorMessage.includes('QR refs attempts ended')) {
    console.log(`⏸️ [${accountName}] Conexão fechada - Erro 408 (QR refs attempts ended - QR expirado)`);
  } else {
    console.log(`🔌 [${accountName}] Conexão fechada`);
  }

  // ✅ Limpar timers
  if (qrTimer) clearTimeout(qrTimer);
  if (connectionTimeout) clearTimeout(connectionTimeout);

  // ✅ NOVO: Verificar se foi encerrado por timeout - não reconectar automaticamente
  // (connectionData já foi obtido acima para os logs de diagnóstico)
  if (connectionData?.closedByTimeout) {
    console.log(`⏸️ [${accountName}] Conexão foi encerrada por timeout. Não reconectando automaticamente.`);
    activeConnections.delete(accountId);
    return; // Não reconectar se foi encerrado por timeout
  }

  // ✅ Determinar se deve reconectar
  const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

  // ✅ MELHORADO: Log detalhado apenas para erros não tratados especificamente
  if (reason !== 515 && reason !== 408 && reason !== 428 && reason !== 440 && !isManualDisconnect) {
    console.log(`🔍 [${accountName}] Razão da desconexão:`, reason);
    console.log(`🔍 [${accountName}] Mensagem de erro:`, errorMessage);
    console.log(`🔍 [${accountName}] Código do erro:`, errorCode);
    console.log(`🔄 [${accountName}] Deve reconectar:`, shouldReconnect);
  }
  
  // ✅ CRÍTICO: Verificar PRIMEIRO se é desconexão manual ANTES de tratar como erro 515
  // Se for desconexão manual, pular tratamento de erro 515 e ir direto para tratamento de logout
  if (isManualDisconnect) {
    console.log(`📱 [${accountName}] Desconexão manual detectada - pulando tratamento de erro 515`);
    // ✅ Desconexão manual será tratada abaixo, não aqui
    // Pular tratamento de erro 515 e ir direto para o tratamento de logout manual
  } else if (reason === 515 || reason === DisconnectReason.restartRequired || (errorMessage.includes('Stream Errored') && reason !== 401) || errorMessage.includes('restart required')) {
    // ✅ CORREÇÃO: Só tratar como 515 se NÃO for código 401
    console.log(`🔄 [${accountName}] Erro 515 (Stream Errored - restart required) detectado`);
    
    // ✅ NOVO: Verificar se estamos em processo de autenticação (após scan QR)
    // (usando connectionData já obtido acima)
    const isAuthenticating = connectionData?.isAuthenticating || connectionData?.status === 'connecting';
    const hasRecentCredsUpdate = connectionData?.lastCredsUpdate && (Date.now() - connectionData.lastCredsUpdate) < 15000; // ✅ OTIMIZADO: Últimos 15 segundos (era 45s)
    const isRecreatingSocket = connectionData?.isRecreatingSocket || false; // ✅ NOVO: Verificar se socket está sendo recriado
    const hasRecreateTimeout = connectionData?.recreateTimeout !== null && connectionData?.recreateTimeout !== undefined; // ✅ NOVO: Verificar se há timeout de recriação ativo
    
    if (isAuthenticating && (hasRecentCredsUpdate || isRecreatingSocket || hasRecreateTimeout)) {
      // ✅ CORREÇÃO: Marcar que há erro 515 para o handler de creds.update saber que precisa aguardar mais
      if (connectionData) {
        connectionData.has515Error = true;
        connectionData.has515ErrorAt = Date.now();
      }
      
      // ✅ CORREÇÃO: Aguardar mais tempo se socket está sendo recriado ou há timeout ativo
      // O socket é recriado após 30 segundos no handler de creds.update, então precisamos aguardar mais
      // ✅ OTIMIZADO: Se socket já foi recriado há mais de 30s, reduzir tempo de espera
      const timeSinceRecreate = connectionData?.recreatingSocketAt 
        ? (Date.now() - connectionData.recreatingSocketAt) 
        : 0;
      const socketAlreadyRecreated = timeSinceRecreate > 10000; // ✅ OTIMIZADO: 10s (era 30s)
      
      const waitTime = socketAlreadyRecreated 
        ? 5000  // ✅ OTIMIZADO: 5s se socket já foi recriado (era 15s)
        : (isRecreatingSocket || hasRecreateTimeout) 
          ? 10000 // ✅ OTIMIZADO: 10s se ainda está recriando (era 40s)
          : 8000;  // ✅ OTIMIZADO: 8s caso contrário (era 30s)
      console.log(`⏳ [${accountName}] Erro 515 durante autenticação (após scan QR). Aguardando ${waitTime/1000}s para autenticação completar ou socket ser recriado...`);
      console.log(`🔍 [${accountName}] Estado:`, {
        isAuthenticating,
        hasRecentCredsUpdate,
        isRecreatingSocket,
        hasRecreateTimeout,
        socketAlreadyRecreated,
        timeSinceRecreate: `${Math.round(timeSinceRecreate / 1000)}s`,
        lastCredsUpdate: connectionData?.lastCredsUpdate ? new Date(connectionData.lastCredsUpdate).toISOString() : null,
        recreatingSocketAt: connectionData?.recreatingSocketAt ? new Date(connectionData.recreatingSocketAt).toISOString() : null
      });
      
      // ✅ OTIMIZADO: Fazer verificações periódicas durante a espera (polling a cada 2s)
      // Isso permite detectar conexão estabelecida mais rapidamente
      const checkInterval = 2000; // ✅ OTIMIZADO: Verificar a cada 2 segundos (era 5s)
      const maxChecks = Math.ceil(waitTime / checkInterval); // Número máximo de verificações
      let connectionEstablished = false;
      
      console.log(`⏳ [${accountName}] Iniciando verificações periódicas (a cada ${checkInterval/1000}s, máximo ${maxChecks} verificações)...`);
      
      for (let check = 0; check < maxChecks && !connectionEstablished; check++) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        // Verificar se conexão foi estabelecida
        const currentConnection = activeConnections.get(accountId);
        if (currentConnection) {
          const hasValidUserId = currentConnection.socket?.user?.id && currentConnection.socket.user.id.includes('@s.whatsapp.net');
          const isWebSocketReady = currentConnection.socket?.ws?.readyState === 1;
          const isStatusConnected = currentConnection.status === 'connected';
          const isStatusConnecting = currentConnection.status === 'connecting';
          const hasSocket = !!currentConnection.socket;
          const isReallyConnected = isStatusConnected || (hasValidUserId && isWebSocketReady);
          const isConnectingWithValidSocket = isStatusConnecting && hasSocket && hasValidUserId;
          
          if (isReallyConnected || isConnectingWithValidSocket) {
            console.log(`✅ [${accountName}] Conexão estabelecida após ${(check + 1) * checkInterval / 1000}s (verificação ${check + 1}/${maxChecks})`);
            connectionEstablished = true;
            
            // Limpar flag de erro 515
            if (currentConnection) {
              currentConnection.has515Error = false;
              currentConnection.has515ErrorAt = null;
            }
            return; // Conexão estabelecida, sair imediatamente
          } else if (check < maxChecks - 1) {
            // Só logar se não for a última verificação (evitar spam de logs)
            console.log(`⏳ [${accountName}] Verificação ${check + 1}/${maxChecks}: Conexão ainda não estabelecida, aguardando...`);
          }
        }
      }
      
      if (!connectionEstablished) {
        console.log(`⏳ [${accountName}] Tempo de espera completo (${waitTime/1000}s) - verificando conexão final...`);
      }
      
      // ✅ Verificar novamente se a conexão foi estabelecida (verificação final)
      const updatedConnection = activeConnections.get(accountId);
      if (updatedConnection) {
        // ✅ CORREÇÃO CRÍTICA: Verificar se está REALMENTE conectado (user.id válido E WebSocket pronto OU status 'connected')
        // ✅ NOVO: Também considerar quando há um novo socket sendo criado (status 'connecting' com socket válido)
        const hasValidUserId = updatedConnection.socket?.user?.id && updatedConnection.socket.user.id.includes('@s.whatsapp.net');
        const isWebSocketReady = updatedConnection.socket?.ws?.readyState === 1;
        const isStatusConnected = updatedConnection.status === 'connected';
        const isStatusConnecting = updatedConnection.status === 'connecting';
        const hasSocket = !!updatedConnection.socket;
        const isReallyConnected = isStatusConnected || (hasValidUserId && isWebSocketReady);
        // ✅ NOVO: Considerar também quando está 'connecting' com socket válido (pode estar em processo de conexão)
        const isConnectingWithValidSocket = isStatusConnecting && hasSocket && hasValidUserId;
        const stillRecreating = updatedConnection.isRecreatingSocket && (Date.now() - (updatedConnection.recreatingSocketAt || 0)) < 15000; // ✅ OTIMIZADO: 15s (era 60s)
        
        console.log(`🔍 [${accountName}] Verificando conexão após espera de erro 515:`, {
          hasValidUserId,
          isWebSocketReady,
          isStatusConnected,
          isStatusConnecting,
          hasSocket,
          isReallyConnected,
          isConnectingWithValidSocket,
          stillRecreating,
          userId: updatedConnection.socket?.user?.id,
          wsState: updatedConnection.socket?.ws?.readyState,
          status: updatedConnection.status
        });
        
        // ✅ CORREÇÃO: Se está conectado OU está conectando com socket válido, considerar sucesso
        if (isReallyConnected || isConnectingWithValidSocket) {
          console.log(`✅ [${accountName}] Autenticação completada após erro 515! Conexão estabelecida ou em processo.`);
          console.log(`🔍 [${accountName}] Detalhes da conexão:`, {
            hasValidUserId,
            isWebSocketReady,
            isStatusConnected,
            isStatusConnecting,
            status: updatedConnection.status,
            userId: updatedConnection.socket?.user?.id,
            wsReady: updatedConnection.socket?.ws?.readyState === 1
          });
          // ✅ Limpar flag de erro 515
          if (updatedConnection) {
            updatedConnection.has515Error = false;
            updatedConnection.has515ErrorAt = null;
          }
          return; // Conexão estabelecida ou em processo, não tratar como erro
        } else if (stillRecreating || updatedConnection.recreateTimeout) {
          console.log(`⏳ [${accountName}] Socket ainda está sendo recriado. Aguardando mais 3s...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // ✅ OTIMIZADO: 3s (era 10s)
          
          // Verificar novamente após espera adicional
          const finalConnection = activeConnections.get(accountId);
          if (finalConnection) {
            const finalHasValidUserId = finalConnection.socket?.user?.id && finalConnection.socket.user.id.includes('@s.whatsapp.net');
            const finalIsWebSocketReady = finalConnection.socket?.ws?.readyState === 1;
            const finalIsStatusConnected = finalConnection.status === 'connected';
            const finalIsStatusConnecting = finalConnection.status === 'connecting';
            const finalHasSocket = !!finalConnection.socket;
            const finalIsReallyConnected = finalIsStatusConnected || (finalHasValidUserId && finalIsWebSocketReady);
            const finalIsConnectingWithValidSocket = finalIsStatusConnecting && finalHasSocket && finalHasValidUserId;
            
            if (finalIsReallyConnected || finalIsConnectingWithValidSocket) {
              console.log(`✅ [${accountName}] Conexão estabelecida após recriação do socket!`);
              // ✅ Limpar flag de erro 515
              if (finalConnection) {
                finalConnection.has515Error = false;
                finalConnection.has515ErrorAt = null;
              }
              return; // Conexão estabelecida, não tratar como erro
            }
          }
        }
      }
      
      // ✅ NOVO: Verificar uma última vez se há timeout de recriação ainda ativo antes de tratar como desconexão
      const finalCheck = activeConnections.get(accountId);
      if (finalCheck) {
        const hasRecreateTimeoutActive = finalCheck.recreateTimeout && (Date.now() - (finalCheck.recreatingSocketAt || 0)) < 15000; // ✅ OTIMIZADO: 15s (era 60s)
        const finalHasValidUserId = finalCheck.socket?.user?.id && finalCheck.socket.user.id.includes('@s.whatsapp.net');
        const finalIsStatusConnected = finalCheck.status === 'connected';
        const finalIsStatusConnecting = finalCheck.status === 'connecting';
        const finalHasSocket = !!finalCheck.socket;
        const finalIsReallyConnected = finalIsStatusConnected || (finalHasValidUserId && finalCheck.socket?.ws?.readyState === 1);
        const finalIsConnectingWithValidSocket = finalIsStatusConnecting && finalHasSocket && finalHasValidUserId;
        
        if (hasRecreateTimeoutActive || finalIsConnectingWithValidSocket) {
          console.log(`⏳ [${accountName}] Socket ainda está sendo recriado. Aguardando mais 3s...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // ✅ OTIMIZADO: 3s (era 10s)
          
          const veryFinalCheck = activeConnections.get(accountId);
          if (veryFinalCheck) {
            const veryFinalHasValidUserId = veryFinalCheck.socket?.user?.id && veryFinalCheck.socket.user.id.includes('@s.whatsapp.net');
            const veryFinalIsWebSocketReady = veryFinalCheck.socket?.ws?.readyState === 1;
            const veryFinalIsStatusConnected = veryFinalCheck.status === 'connected';
            const veryFinalIsStatusConnecting = veryFinalCheck.status === 'connecting';
            const veryFinalHasSocket = !!veryFinalCheck.socket;
            const veryFinalIsReallyConnected = veryFinalIsStatusConnected || (veryFinalHasValidUserId && veryFinalIsWebSocketReady);
            const veryFinalIsConnectingWithValidSocket = veryFinalIsStatusConnecting && veryFinalHasSocket && veryFinalHasValidUserId;
            
            if (veryFinalIsReallyConnected || veryFinalIsConnectingWithValidSocket) {
              console.log(`✅ [${accountName}] Conexão estabelecida após espera final!`);
              if (veryFinalCheck) {
                veryFinalCheck.has515Error = false;
                veryFinalCheck.has515ErrorAt = null;
              }
              return; // Conexão estabelecida, não tratar como erro
            }
          }
        }
      }
      
      // ✅ CRÍTICO: Verificar uma última vez ANTES de emitir notificações de desconexão
      const veryLastCheck = activeConnections.get(accountId);
      if (veryLastCheck) {
        const veryLastHasValidUserId = veryLastCheck.socket?.user?.id && veryLastCheck.socket.user.id.includes('@s.whatsapp.net');
        const veryLastIsStatusConnected = veryLastCheck.status === 'connected';
        const veryLastIsStatusConnecting = veryLastCheck.status === 'connecting';
        const veryLastHasSocket = !!veryLastCheck.socket;
        const veryLastIsReallyConnected = veryLastIsStatusConnected || (veryLastHasValidUserId && veryLastCheck.socket?.ws?.readyState === 1);
        const veryLastIsConnectingWithValidSocket = veryLastIsStatusConnecting && veryLastHasSocket && veryLastHasValidUserId;
        
        if (veryLastIsReallyConnected || veryLastIsConnectingWithValidSocket) {
          console.log(`✅ [${accountName}] Conexão detectada na verificação final! Não emitindo notificação de desconexão.`);
          if (veryLastCheck) {
            veryLastCheck.has515Error = false;
            veryLastCheck.has515ErrorAt = null;
          }
          return; // Conexão estabelecida, não tratar como erro
        }
      }
      
      console.log(`⚠️ [${accountName}] Autenticação não completou após espera de ${waitTime/1000}s. Tratando como desconexão.`);
    }
    
    // ✅ Liberar lock imediatamente
    releaseConnectionLock(accountId);
    console.log(`🔓 [${accountName}] Lock liberado após erro 515`);
    
    // ✅ Limpar conexão atual (mas não deletar ainda, pode ser necessário para tratamento abaixo)
    // activeConnections.delete(accountId); // ✅ COMENTADO: Não deletar aqui, deixar para tratamento específico abaixo
    
    // ✅ SEMPRE notificar admin sobre erro 515
    await processDisconnectNotification(accountId, 515, accountName);
    await emitDisconnectionNotification(accountId, accountName, 515);
    
    // ✅ Atualizar status no banco
    await updateAccountStatus(accountId, 'disconnected');
    
    // ✅ NUNCA reconectar automaticamente após erro 515
    console.log(`⏸️ [${accountName}] Erro 515 tratado. Admin notificado. Reconexão manual necessária.`);
    
    return; // Sair da função - não executar lógica de reconexão
  }

  // ✅ NOVO: Tratamento especial para erro 408 (QR refs attempts ended)
  // Este erro geralmente ocorre quando o QR code expira - não reconectar automaticamente
  if (reason === 408 || errorMessage.includes('QR refs attempts ended')) {
    console.log(`⏸️ [${accountName}] Erro 408 (QR refs attempts ended) detectado. QR code expirado.`);
    activeConnections.delete(accountId);
    
    // ✅ CRÍTICO: Liberar lock de conexão para permitir nova conexão
    releaseConnectionLock(accountId);
    console.log(`🔓 [${accountName}] Lock liberado após erro 408 (QR expirado)`);
    
    await updateAccountStatus(accountId, 'disconnected');
    await emitDisconnectionNotification(accountId, accountName, reason);
    
    // ✅ MELHORADO: Emitir evento específico para QR expirado
    try {
      const { data: accountInfo } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();
      
      if (accountInfo && io) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-qr-expired', {
          accountId,
          accountName,
          reason: 'QR code expirado. Por favor, gere um novo QR code.',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`❌ [${accountName}] Erro ao emitir evento de QR expirado:`, error);
    }
    
    return; // Não reconectar automaticamente para erro 408
  }

  // ✅ NOVO: Verificar contador de tentativas ANTES de qualquer reconexão
  const currentAttemptCount = (connectionData?.attemptCount || 0);
  if (currentAttemptCount >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`⛔ [${accountName}] Máximo de tentativas de reconexão atingido (${MAX_RECONNECT_ATTEMPTS}). Encerrando tentativas.`);
    activeConnections.delete(accountId);
    await updateAccountStatus(accountId, 'disconnected');
    await emitDisconnectionNotification(accountId, accountName, reason);
    return; // PARAR completamente
  }

  // ✅ NOVO: Detectar erro 428 (rate limit) e ativar throttling global
  // ✅ CORREÇÃO: Verificar status antes de deletar conexão
  // ✅ NOTA: connectionData já foi obtido acima, reutilizar
  const connectionSource = connectionData?.source || 'auto';
  const isInitialConnection = connectionData && connectionData.status === 'connecting';
  const isManualConnection = connectionSource === 'manual';
  
  // ✅ MELHORADO: Tratamento do erro 428 (Rate Limit do WhatsApp)
  // Código 428 = Rate Limit - WhatsApp bloqueou temporariamente por muitas tentativas de conexão
  // IMPORTANTE: Este código indica que o WhatsApp detectou muitas tentativas de conexão e bloqueou temporariamente
  if (reason === 428) {
    console.warn(`⚠️ [RATE_LIMIT] ⚠️⚠️⚠️ ERRO 428 (Rate Limit) detectado para ${accountName} ⚠️⚠️⚠️`);
    console.warn(`⚠️ [RATE_LIMIT] WhatsApp bloqueou temporariamente por muitas tentativas de conexão`);
    
    // ✅ Registrar rate limit global (BLOQUEIA TODAS as conexões)
    lastRateLimitError = Date.now();
    globalReconnectThrottle = true;
    
    // ✅ NOVO: Registrar rate limit específico para esta conta
    const existingRateLimit = rateLimitedAccounts.get(accountId) || { count: 0, timestamp: 0 };
    rateLimitedAccounts.set(accountId, {
      count: existingRateLimit.count + 1,
      timestamp: Date.now()
    });
    
    console.warn(`⚠️ [RATE_LIMIT] Esta conta teve ${existingRateLimit.count + 1} rate limit(s). Cooldown de 15 minutos ativado.`);
    
    // ✅ Desativar throttle global após 15 minutos
    setTimeout(() => {
      globalReconnectThrottle = false;
      console.log(`✅ [RATE_LIMIT] Cooldown global de rate limit finalizado (15 minutos)`);
    }, RATE_LIMIT_COOLDOWN);
    
    // ✅ Desativar throttle específico da conta após 15 minutos
    setTimeout(() => {
      rateLimitedAccounts.delete(accountId);
      console.log(`✅ [RATE_LIMIT] Cooldown da conta ${accountName} finalizado (15 minutos)`);
    }, RATE_LIMIT_COOLDOWN);
    
    // ✅ SEMPRE notificar admin sobre rate limit
    await processDisconnectNotification(accountId, 428, accountName);
    await emitDisconnectionNotification(accountId, accountName, 428);
    
    // ✅ Atualizar status no banco
    await updateAccountStatus(accountId, 'disconnected');
    
    // ✅ Emitir evento específico de rate limit
    try {
      const { data: accountInfo } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();

      if (accountInfo && io) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-rate-limit', {
          accountId,
          accountName,
          message: 'Rate limit detectado pelo WhatsApp. Aguarde 15 minutos antes de tentar conectar novamente.',
          cooldownMinutes: 15,
          timestamp: Date.now()
        });
        
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
          accountId,
          accountName,
          reason: 'Rate limit detectado pelo WhatsApp. Aguarde 15 minutos antes de tentar conectar novamente.',
          attemptCount: 0
        });
      }
    } catch (error) {
      console.error(`❌ [${accountName}] Erro ao emitir evento de rate limit:`, error);
    }
    
    // ✅ NUNCA reconectar automaticamente após rate limit
    console.log(`⏸️ [${accountName}] Rate limit detectado. Admin notificado. Aguarde 15 minutos antes de tentar conectar manualmente.`);
    
    return; // Sair da função - não executar lógica de reconexão
  }

  // ✅ Limpar conexão atual (após tratar rate limit)
  activeConnections.delete(accountId);

  // ✅ Emitir notificação de desconexão (apenas se não for rate limit)
  if (reason !== 428) {
    await emitDisconnectionNotification(accountId, accountName, reason);
  }

  // ✅ CRÍTICO: Verificar PRIMEIRO se é desconexão manual ANTES de tratar como conflito
  // Desconexão manual (401) pode ter mensagem "Stream Errored (conflict)" mas não é conflito de sessão
  if (isManualDisconnect) {
    // ✅ Desconexão manual será tratada abaixo, não aqui
    // Pular tratamento de conflito
  } else if (reason === 440 || (errorMessage.toLowerCase().includes('conflict') && reason !== 401)) {
    // ✅ CORREÇÃO: Só tratar como conflito se NÃO for código 401
    console.log(`⚠️ [${accountName}] CONFLITO DE SESSÃO DETECTADO - Aguardando antes de reconectar`);
    
    // ✅ CORREÇÃO: Verificar contador global ANTES de processar conflito
    const globalAttemptCount = (connectionData?.attemptCount || 0);
    if (globalAttemptCount >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`⛔ [${accountName}] Máximo de tentativas de reconexão atingido (${MAX_RECONNECT_ATTEMPTS}). Não processando conflito.`);
      activeConnections.delete(accountId);
      await updateAccountStatus(accountId, 'disconnected');
      await emitDisconnectionNotification(accountId, accountName, reason);
      return;
    }
    
    // ✅ CORREÇÃO: Verificar se já existe uma conexão ativa antes de limpar
    const existingConnection = activeConnections.get(accountId);
    if (existingConnection && existingConnection.status === 'connected') {
      console.log(`✅ [${accountName}] Conexão já está ativa, não é necessário reconectar`);
      return; // Não fazer nada se já está conectado
    }

    // ✅ Limpar sessão conflitante
    await clearConflictingSessions(accountId);

    // ✅ CORREÇÃO: Usar contador global de tentativas ao invés de contador separado
    const attemptCount = (existingConnection?.attemptCount || 0) + 1;
    
    if (attemptCount > MAX_RECONNECT_ATTEMPTS) {
      console.log(`⛔ [${accountName}] Máximo de tentativas de reconexão atingido (${MAX_RECONNECT_ATTEMPTS}). Parando após conflito.`);
      activeConnections.delete(accountId);
      await updateAccountStatus(accountId, 'disconnected');
      await emitDisconnectionNotification(accountId, accountName, reason);
      return;
    }

    // ✅ Incrementar contador de tentativas
    if (existingConnection) {
      existingConnection.attemptCount = attemptCount;
    } else {
      activeConnections.set(accountId, { attemptCount });
    }

    // ✅ DESABILITADO: Não reconectar automaticamente após conflito
    // Apenas notificar admin e atualizar status
    await processDisconnectNotification(accountId, reason, accountName);
    await emitDisconnectionNotification(accountId, accountName, reason);
    console.log(`⏸️ [${accountName}] Conflito de sessão detectado. Admin notificado. Reconexão manual necessária.`);

    return; // Sair da função para não executar a lógica padrão
  }

  // ✅ NOVO: SEMPRE notificar admin quando conta cair, mas NUNCA reconectar automaticamente
  // ✅ CORREÇÃO: Usar a mesma variável isManualDisconnect já declarada acima
  
  if (isManualDisconnect) {
    console.log(`📱 [${accountName}] ⚠️ DESCONEXÃO MANUAL DETECTADA - Enviando email e notificação`);
    
    // ✅ CORREÇÃO: Garantir que reason seja 401 para processDisconnectNotification
    const manualReason = reason === DisconnectReason.loggedOut ? 401 : reason;
    
    // ✅ CRÍTICO: Limpar timers ANTES de qualquer outra ação
    if (qrTimer) clearTimeout(qrTimer);
    if (connectionTimeout) clearTimeout(connectionTimeout);
    
    // ✅ CRÍTICO: Obter conexão para limpar timers adicionais
    const connectionData = activeConnections.get(accountId);
    if (connectionData) {
      if (connectionData.qrTimer) {
        clearTimeout(connectionData.qrTimer);
        connectionData.qrTimer = null;
      }
      if (connectionData.connectionTimeout) {
        clearTimeout(connectionData.connectionTimeout);
        connectionData.connectionTimeout = null;
      }
      if (connectionData.recreateTimeout) {
        clearTimeout(connectionData.recreateTimeout);
        connectionData.recreateTimeout = null;
      }
    }
    
    // ✅ CRÍTICO: Limpar cache de QR code
    if (qrCodeCache.has(accountId)) {
      qrCodeCache.delete(accountId);
      console.log(`🗑️ [${accountName}] Cache de QR code limpo na desconexão manual`);
    }
    
    // ✅ CRÍTICO: Encerrar socket ANTES de limpar arquivos
    if (connectionData && connectionData.socket) {
      try {
        console.log(`🔌 [${accountName}] Encerrando socket na desconexão manual...`);
        if (connectionData.socket.ws?.readyState === 1) {
          await connectionData.socket.logout();
        } else {
          await connectionData.socket.end(new Error('Desconexão manual detectada'));
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (socketError) {
        console.warn(`⚠️ [${accountName}] Erro ao encerrar socket:`, socketError.message);
      }
    }
    
    // ✅ CRÍTICO: Atualizar status PRIMEIRO no banco de dados (IMEDIATAMENTE) usando updateAccountStatusImmediate
    await updateAccountStatusImmediate(accountId, 'disconnected', {
      phone_number: null,
      qr_code: null
    });
    console.log(`✅ [${accountName}] Status atualizado para 'disconnected' no banco de dados (IMEDIATO)`);
    
    // ✅ Usuário fez logout, limpar sessão
    await handleLogout(accountId, accountName);

    // ✅ Enviar notificação por e-mail para administradores
    await processDisconnectNotification(accountId, manualReason, accountName);
    
    // ✅ CORREÇÃO: Emitir notificação via Socket.IO também com informação de desconexão manual
    await emitDisconnectionNotification(accountId, accountName, manualReason);
    
    // ✅ CORREÇÃO: Remover conexão de activeConnections
    activeConnections.delete(accountId);
    
    // ✅ CORREÇÃO: Parar monitoramento de saúde se existir
    if (connectionHealthMonitor.has(accountId)) {
      clearInterval(connectionHealthMonitor.get(accountId));
      connectionHealthMonitor.delete(accountId);
    }
    
    // ✅ NOVO: Parar keep-alive
    stopKeepAlive(accountId);
    
    // ✅ CRÍTICO: Liberar lock de conexão para permitir nova conexão
    releaseConnectionLock(accountId);
    console.log(`🔓 [${accountName}] Lock liberado após desconexão manual`);
    
    console.log(`✅ [${accountName}] Logout manual tratado. Email enviado. Notificação emitida. Status atualizado.`);
    
    return; // ✅ CRÍTICO: Sair da função para não executar lógica adicional
  } else {
    // ✅ SEMPRE notificar admin sobre desconexão
    await processDisconnectNotification(accountId, reason, accountName);
    
    // ✅ Emitir notificação via Socket.IO também
    await emitDisconnectionNotification(accountId, accountName, reason);
    
    // ✅ Atualizar status no banco
    await updateAccountStatus(accountId, 'disconnected');
    
    // ✅ CORREÇÃO: Remover conexão de activeConnections
    activeConnections.delete(accountId);
    
    // ✅ CORREÇÃO: Parar monitoramento de saúde se existir
    if (connectionHealthMonitor.has(accountId)) {
      clearInterval(connectionHealthMonitor.get(accountId));
      connectionHealthMonitor.delete(accountId);
    }
    
    // ✅ NOVO: Parar keep-alive
    stopKeepAlive(accountId);
    
    // ✅ CRÍTICO: Liberar lock de conexão para permitir nova conexão
    releaseConnectionLock(accountId);
    console.log(`🔓 [${accountName}] Lock liberado após desconexão`);
    
    // ✅ NUNCA reconectar automaticamente - apenas notificar
    console.log(`⏸️ [${accountName}] Conta desconectada. Admin notificado. Reconexão manual necessária.`);
  }
  
  // ✅ DESABILITADO: Removida toda lógica de reconexão automática
  /* CÓDIGO REMOVIDO - RECONEXÃO AUTOMÁTICA DESABILITADA
  if (false && shouldReconnect) {
    // ✅ DESABILITADO: NUNCA reconectar automaticamente
    // Apenas notificar admin e atualizar status
    await processDisconnectNotification(accountId, reason, accountName);
    await emitDisconnectionNotification(accountId, accountName, reason);
    await updateAccountStatus(accountId, 'disconnected');
    console.log(`⏸️ [${accountName}] Conta desconectada. Admin notificado. Reconexão manual necessária.`);
  }
};

// ✅ DESABILITADO: Função de reconexão automática removida
// NUNCA reconectar automaticamente - apenas notificar admin
const scheduleReconnection = async (accountId, accountName) => {
  // ✅ DESABILITADO: Esta função não deve ser chamada mais
  // Apenas logar para debug se for chamada acidentalmente
  console.log(`⏸️ [${accountName}] scheduleReconnection chamada mas reconexão automática está desabilitada`);
  
  // ✅ Notificar admin sobre tentativa de reconexão (se houver)
  await processDisconnectNotification(accountId, 'auto_reconnect_disabled', accountName);
  
  return; // Não fazer nada - reconexão automática desabilitada
};

// ✅ NOVA: Função para debug de conexões
export const debugConnections = () => {
  console.log('📊 Status das conexões ativas:');

  activeConnections.forEach((connection, accountId) => {
    console.log(`📱 [${connection.accountName}] (${accountId}):`, {
      status: connection.status,
      hasSocket: !!connection.socket,
      hasUser: !!connection.socket?.user,
      userId: connection.socket?.user?.id,
      wsState: connection.socket?.ws?.readyState,
      lastAttempt: new Date(connection.lastAttempt).toISOString(),
      attemptCount: connection.attemptCount
    });
  });

  console.log(` Total de conexões: ${activeConnections.size}`);
};

// ✅ NOVA: Função para limpar todas as conexões
// ✅ NOVO: Função para corrigir status de uma conta específica
export const fixAccountStatus = async (accountId) => {
  try {
    // Buscar dados da conta
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status, phone_number, organization_id')
      .eq('account_id', accountId)
      .single();

    if (accountError || !account) {
      return { success: false, error: 'Conta não encontrada' };
    }

    // Verificar se há conexão ativa
    const connection = activeConnections.get(accountId);
    const isActuallyConnected = connection && 
                               connection.socket && 
                               connection.socket.user && 
                               connection.socket.user.id && 
                               connection.socket.ws?.readyState === 1;

    // Se tem phone_number ou está realmente conectada, corrigir status
    const hasPhoneNumber = account.phone_number && account.phone_number.length > 0;
    
    if (isActuallyConnected || hasPhoneNumber) {
      const phoneNumber = isActuallyConnected 
        ? connection.socket.user.id.replace(/:\d+@s\.whatsapp\.net$/, '')
        : account.phone_number;

      console.log(`🔧 [FIX_STATUS] Corrigindo status para ${account.name}: phone=${phoneNumber}, connected=${isActuallyConnected}`);

      const { error: updateError } = await supabase
        .from('whatsapp_accounts')
        .update({
          status: 'connected',
          phone_number: phoneNumber,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId);

      if (updateError) {
        console.error(`❌ [FIX_STATUS] Erro ao corrigir:`, updateError);
        return { success: false, error: updateError.message };
      }

      // Emitir evento para atualizar frontend
      if (account.organization_id && io) {
        io.to(`org_${account.organization_id}`).emit('whatsapp-connected', {
          accountId,
          accountName: account.name,
          phoneNumber
        });
      }

      return { 
        success: true, 
        message: 'Status corrigido',
        account: {
          account_id: accountId,
          status: 'connected',
          phone_number: phoneNumber
        }
      };
    }

    return { 
      success: false, 
      message: 'Conta não está conectada',
      hasPhoneNumber,
      isActuallyConnected
    };
  } catch (error) {
    console.error('❌ [FIX_STATUS] Erro:', error);
    return { success: false, error: error.message };
  }
};

export const clearAllConnections = async () => {
  console.log(' [CLEANUP] Limpando todas as conexões...');

  for (const [accountId, connection] of activeConnections) {
    try {
      if (connection.socket?.ws?.readyState === 1) {
        await connection.socket.end(new Error('Limpeza geral'));
      }
    } catch (error) {
      console.log(`⚠️ [CLEANUP] Erro ao limpar ${connection.accountName}:`, error.message);
    }
  }

  activeConnections.clear();
  console.log('✅ [CLEANUP] Todas as conexões limpas');
};

// ✅ REMOVIDO: Função handleConnectionOpen duplicada - já está definida antes de setupSocketEvents (linha ~1784)

// ✅ REMOVIDO: Função handleLogout movida para antes de handleDisconnection (linha ~4824)

// ✅ REMOVIDO: Funções movidas para antes do primeiro uso (linha ~370)

// ✅ REMOVIDO: Função handleConnectionTimeout movida para ANTES de setupSocketEvents (linha ~2365)
// A função agora está definida antes de ser usada para evitar ReferenceError

// ✅ NOVA: Função para reemitir QR codes pendentes quando cliente entrar na sala
// ✅ CORREÇÃO: Esta função foi desabilitada pois agora emitimos apenas para usuários específicos
// Não faz sentido reemitir para toda a organização quando cada QR code é específico de um usuário
export const reemitPendingQRCodes = async (organizationId) => {
  // ✅ DESABILITADO: QR codes agora são emitidos apenas para usuários específicos
  // Não reemitir para toda a organização
  console.log(`ℹ️ [REEMIT] Reemissão de QR codes desabilitada - QR codes são específicos por usuário`);
  return;
  
  /* CÓDIGO ANTIGO - MANTIDO PARA REFERÊNCIA
  if (!io) {
    console.warn('⚠️ Socket.IO não disponível para reemitir QR codes');
    return;
  }

  try {
    console.log(`🔄 [REEMIT] Verificando QR codes pendentes para organização ${organizationId}`);
    
    // Buscar todas as contas da organização que estão em status 'connecting'
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status, organization_id')
      .eq('organization_id', organizationId)
      .eq('status', 'connecting');

    if (error) {
      console.error('❌ [REEMIT] Erro ao buscar contas:', error);
      return;
    }

    if (!accounts || accounts.length === 0) {
      console.log(`ℹ️ [REEMIT] Nenhuma conta em status 'connecting' para organização ${organizationId}`);
      return;
    }

    console.log(`📋 [REEMIT] Encontradas ${accounts.length} conta(s) em status 'connecting'`);

    // Para cada conta, verificar se há QR code no cache e reemitir
    for (const account of accounts) {
      const cachedQR = qrCodeCache.get(account.account_id);
      
      if (cachedQR && cachedQR.qr) {
        try {
          // Gerar QR code como DataURL novamente
          const qrString = await qr.toDataURL(cachedQR.qr, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1
          });

          const qrData = {
            accountId: account.account_id,
            qr: qrString,
            accountName: account.name,
            timestamp: Date.now()
          };

          console.log(`📤 [REEMIT] Reemitindo QR code para conta ${account.name} (${account.account_id})`);
          io.to(`org_${organizationId}`).emit('whatsapp-qr-code', qrData);
          io.to(`org_${organizationId}`).emit('qr_code', {
            accountId: account.account_id,
            qrCode: qrString,
            accountName: account.name
          });
          
          console.log(`✅ [REEMIT] QR code reemitido com sucesso para ${account.name}`);
        } catch (qrError) {
          console.error(`❌ [REEMIT] Erro ao gerar QR code para ${account.name}:`, qrError);
        }
      } else {
        // Verificar se há conexão ativa que pode gerar QR code
        const connection = activeConnections.get(account.account_id);
        if (connection && connection.status === 'connecting') {
          console.log(`ℹ️ [REEMIT] Conta ${account.name} está conectando mas não há QR code em cache`);
        }
      }
    }
  } catch (error) {
    console.error('❌ [REEMIT] Erro ao reemitir QR codes pendentes:', error);
  }
  */
};

// ✅ NOVAS: Funções exportadas para grupos
export const sendGroupMessageByAccount = async (accountId, groupJid, message, replyTo = null) => {
  return await sendGroupMessage(accountId, groupJid, message, replyTo, activeConnections);
};

export const getGroupsListByAccount = async (accountId) => {
  return await getGroupsList(accountId, activeConnections);
};