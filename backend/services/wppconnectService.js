// ✅ NOVO: Serviço WPPConnect para conexões WhatsApp
// Nota: WPPConnect usa uma API diferente do Baileys, mas processa mensagens da mesma forma
import { create } from '@wppconnect-team/wppconnect';
import { supabase } from '../lib/supabaseClient.js';
import { processMessageWithAI } from './aiProcessor.js';
import { executeFlowStep } from './flowServices.js';
import { executeFlowSimple } from './flowExecutor.js';
import { processDisconnectNotification } from './disconnectNotificationService.js';
import { processMessageForRules } from './ruleProcessor.js';
import { ensureReconnectEmailDispatched, clearReconnectEmailCache } from './whatsappReconnectService.js';
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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import qr from 'qrcode';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Manter instâncias ativas das conexões
const activeConnections = new Map();
let io;

// ✅ Sistema de monitoramento de saúde (mesmo do Baileys)
const connectionHealthMonitor = new Map();
const HEARTBEAT_INTERVAL = 600000; // 10 minutos (aumentado para reduzir carga)

// ✅ Constantes de reconexão (mesmas do Baileys)
const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY = 30000; // 30 segundos
const MAX_RECONNECT_DELAY = 300000; // 5 minutos máximo

// ✅ Sistema de rate limiting (mesmo do Baileys)
let lastRateLimitError = 0;
const RATE_LIMIT_COOLDOWN = 300000; // 5 minutos após erro 428
let globalReconnectThrottle = false;

// ✅ Cache para QR codes (evitar processar múltiplas vezes)
const qrCodeCache = new Map();
const QR_CODE_THROTTLE = 5000; // 5 segundos

// ✅ Razão fixa usada para identificar logout manual, alinhada com Baileys (DisconnectReason.loggedOut)
const MANUAL_LOGOUT_REASON = 401;

const triggerManualDisconnectNotification = async (accountId, accountName) => {
  try {
    await processDisconnectNotification(accountId, MANUAL_LOGOUT_REASON, accountName);
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao enviar notificação de logout manual:`, error);
  }
};

// ✅ NOVA: Função auxiliar para limpar tokens do WPPConnect
const cleanupWPPConnectTokens = async (accountId, accountName = '') => {
  const tokensDir = path.join(__dirname, '../tokens', accountId);
  if (fs.existsSync(tokensDir)) {
    try {
      console.log(`🗑️ [WPPConnect${accountName ? ` - ${accountName}` : ''}] Limpando diretório de tokens para ${accountId}...`);
      // Tentar remover arquivos individualmente primeiro
      const files = fs.readdirSync(tokensDir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(tokensDir, file.name);
        try {
          if (file.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          // Ignorar erros de arquivos individuais
        }
      }
      // Tentar remover diretório
      try {
        fs.rmdirSync(tokensDir);
      } catch {
        fs.rmSync(tokensDir, { recursive: true, force: true });
      }
      console.log(`✅ [WPPConnect${accountName ? ` - ${accountName}` : ''}] Diretório de tokens limpo para ${accountId}`);
    } catch (cleanError) {
      console.warn(`⚠️ [WPPConnect${accountName ? ` - ${accountName}` : ''}] Erro ao limpar tokens (continuando mesmo assim):`, cleanError.message);
    }
  }
};

// ✅ Cache para informações de conta
const accountInfoCache = new Map();
const ACCOUNT_INFO_CACHE_TTL = 300000; // 5 minutos

// ✅ Função para obter configurações da organização (proxy e API)
const getOrganizationSettings = async (accountId) => {
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

      return {
        proxy: organization?.settings?.proxy || null,
        whatsapp_api: organization?.settings?.whatsapp_api || 'baileys'
      };
    }
  } catch (error) {
    console.warn(`⚠️ Erro ao buscar configurações da organização:`, error.message);
  }
  return { proxy: null, whatsapp_api: 'baileys' };
};

// ✅ Função para criar conexão WPPConnect
const createWPPConnectSession = async (accountId, accountName, shouldGenerateQr = true, options = {}) => {
  const source = options?.source || 'auto';
  const organizationId = options?.organizationId;
  const userId = options?.userId || null; // ✅ NOVO: Obter userId das opções
  
  // ✅ DEBUG: Log para verificar se options está sendo passado corretamente
  console.log(`🔍 [${accountName}] DEBUG - createWPPConnectSession chamado com:`, {
    accountId,
    source: source || 'N/A',
    userId: userId || 'N/A',
    organizationId: organizationId || 'N/A',
    optionsKeys: Object.keys(options || {})
  });
  
  try {
    // ✅ NOVO: Se for conexão manual, sempre encerrar conexão existente e gerar novo QR
    if (source === 'manual') {
      console.log(`🔄 [${accountName}] Conexão manual detectada - encerrando conexão existente...`);
      
      const existingConnection = activeConnections.get(accountId);
      if (existingConnection && existingConnection.client) {
        try {
          console.log(`🔄 [${accountName}] Fechando cliente WPPConnect existente...`);
          await existingConnection.client.close();
          // Aguardar para garantir que o browser foi fechado
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log(`✅ [${accountName}] Cliente existente fechado`);
        } catch (closeError) {
          console.warn(`⚠️ [${accountName}] Erro ao fechar cliente existente:`, closeError.message);
        }
      }
      
      // Remover da lista de conexões ativas
      activeConnections.delete(accountId);
      
      // Limpar diretório de tokens para forçar novo QR code
      const tokensDir = path.join(__dirname, '../tokens', accountId);
      if (fs.existsSync(tokensDir)) {
        try {
          console.log(`🗑️ [${accountName}] Limpando diretório de tokens para gerar novo QR code...`);
          // Tentar remover arquivos individualmente
          const files = fs.readdirSync(tokensDir, { withFileTypes: true });
          for (const file of files) {
            const filePath = path.join(tokensDir, file.name);
            try {
              if (file.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
            } catch (fileError) {
              // Ignorar erros de arquivos individuais
            }
          }
          // Tentar remover diretório
          try {
            fs.rmdirSync(tokensDir);
          } catch {
            fs.rmSync(tokensDir, { recursive: true, force: true });
          }
          console.log(`✅ [${accountName}] Diretório de tokens limpo`);
        } catch (cleanError) {
          console.warn(`⚠️ [${accountName}] Erro ao limpar tokens (continuando mesmo assim):`, cleanError.message);
        }
      }
      
      // Aguardar um pouco mais para garantir limpeza completa
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      // ✅ MELHORADO: Para conexões automáticas, verificar se já está conectada
      const existingConnection = activeConnections.get(accountId);
      
      // Verificar se há conexão ativa e se está realmente conectada
      if (existingConnection && existingConnection.client) {
        // ✅ Verificar status em activeConnections
        const isStatusConnected = existingConnection.status === 'connected';
        
        // ✅ Verificar se cliente está conectado
        let isClientConnected = false;
        try {
          isClientConnected = existingConnection.client.isConnected() || false;
        } catch (error) {
          console.warn(`⚠️ [${accountName}] Erro ao verificar isConnected():`, error.message);
        }
        
        // ✅ Verificar status no banco de dados
        let isDbConnected = false;
        try {
          const { data: accountData } = await supabase
            .from('whatsapp_accounts')
            .select('status, phone_number')
            .eq('account_id', accountId)
            .single();
          
          isDbConnected = accountData?.status === 'connected' && !!accountData?.phone_number;
        } catch (error) {
          console.warn(`⚠️ [${accountName}] Erro ao verificar status no banco:`, error.message);
        }
        
        // ✅ Se qualquer verificação indicar que está conectado, não criar nova sessão
        if (isStatusConnected || isClientConnected || isDbConnected) {
          console.log(`✅ [${accountName}] Já está conectada - status: ${existingConnection.status}, client: ${isClientConnected}, db: ${isDbConnected}`);
          return { success: true, message: 'Já está conectada' };
        } else {
          console.log(`⚠️ [${accountName}] Conexão existente mas não conectada - limpando e recriando...`);
          // Limpar conexão existente que não está conectada
          try {
            if (existingConnection.client) {
              await existingConnection.client.close();
            }
          } catch (e) {
            console.warn(`⚠️ [${accountName}] Erro ao fechar conexão não conectada:`, e.message);
          }
          activeConnections.delete(accountId);
        }
      }
    }

    // Obter configurações da organização
    const { proxy } = await getOrganizationSettings(accountId);

    // Preparar diretório de sessão
    const sessionDir = path.join(__dirname, '../wppconnect-sessions', accountId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // ✅ CORREÇÃO: Criar função que captura userId e source do escopo
    const emitQrFromPayload = async (payload) => {
      if (!payload) {
        console.warn(`⚠️ [${accountName}] QR Code vazio recebido do WPPConnect`);
        return;
      }
      // ✅ NOVO: Passar userId e source diretamente para handleWPPConnectQRCode
      await handleWPPConnectQRCode(payload, accountId, accountName, userId, source);
    };

    // Configurações do WPPConnect
    const sessionOptions = {
      session: accountId,
      autoClose: false,
      puppeteerOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      },
      catchQR: async (base64Qr, _asciiQR, _attempts, urlCode) => {
        try {
          // ✅ NOVO: Verificar se já está conectado antes de processar QR code
          const connectionData = activeConnections.get(accountId);
          if (connectionData && connectionData.status === 'connected') {
            console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada - ignorando`);
            return; // Não processar QR code se já está conectado
          }
          
          // ✅ Verificar também no banco de dados
          const { data: accountData } = await supabase
            .from('whatsapp_accounts')
            .select('status, phone_number')
            .eq('account_id', accountId)
            .single();
          
          if (accountData?.status === 'connected' && accountData?.phone_number) {
            console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada no banco - ignorando`);
            return; // Não processar QR code se já está conectado no banco
          }
          
          const payload = urlCode || base64Qr;
          // ✅ CORREÇÃO: Passar userId e source diretamente (capturados do escopo)
          await handleWPPConnectQRCode(payload, accountId, accountName, userId, source);
        } catch (error) {
          console.error(`❌ [${accountName}] Erro no catchQR:`, error);
        }
      },
      // ✅ Adicionar proxy se fornecido
      ...(proxy && {
        proxyServer: proxy.replace(/^https?:\/\//, '').replace(/^socks[45]:\/\//, '')
      })
    };

    // ✅ Limpar conexão existente se houver problema (apenas para conexões automáticas)
    // Para conexões manuais, já foi limpo acima
    if (source !== 'manual' && activeConnections.has(accountId)) {
      const existingConn = activeConnections.get(accountId);
      if (existingConn.client) {
        try {
          console.log(`🔄 [${accountName}] Fechando conexão existente...`);
          await existingConn.client.close();
          // Aguardar um pouco para garantir que o browser foi fechado
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
          console.warn(`⚠️ [${accountName}] Erro ao fechar conexão existente:`, e.message);
        }
      }
      activeConnections.delete(accountId);
    }

    // Criar sessão WPPConnect
    console.log(`📱 [${accountName}] Criando sessão WPPConnect...`);
    
    let client;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        client = await create(sessionOptions);
        break; // Sucesso, sair do loop
      } catch (createError) {
        // Se o erro for de browser já em execução, tentar limpar e recriar
        if (createError.message && createError.message.includes('already running')) {
          retryCount++;
          console.warn(`⚠️ [${accountName}] Browser já em execução (tentativa ${retryCount}/${maxRetries}), tentando limpar sessão...`);
          
          // Aguardar mais tempo para o browser fechar completamente
          await new Promise(resolve => setTimeout(resolve, 5000 * retryCount)); // 5s, 10s, 15s
          
          // ✅ MELHORADO: Se já tentou 2 vezes e ainda falhou, usar session alternativo imediatamente
          // Isso evita ficar tentando limpar arquivos bloqueados indefinidamente
          if (retryCount >= 2) {
            console.warn(`⚠️ [${accountName}] Usando session alternativo após ${retryCount} tentativas (evitando limpeza de arquivos bloqueados)...`);
            const altSessionId = `${accountId}_${Date.now()}`;
            sessionOptions.session = altSessionId;
            
            // Aguardar um pouco antes de tentar com session alternativo
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Tentar criar com session alternativo
            try {
              client = await create(sessionOptions);
              console.log(`✅ [${accountName}] Sessão criada com ID alternativo: ${altSessionId}`);
              break;
            } catch (altError) {
              if (retryCount >= maxRetries) {
                throw new Error(`Falha ao criar sessão mesmo com session alternativo: ${altError.message}`);
              }
              // Continuar para próxima tentativa
            }
          } else {
            // Tentar limpar o diretório de tokens do WPPConnect (apenas nas primeiras tentativas)
            const tokensDir = path.join(__dirname, '../tokens', accountId);
            if (fs.existsSync(tokensDir)) {
              try {
                // Tentar remover apenas arquivos não bloqueados
                const files = fs.readdirSync(tokensDir, { withFileTypes: true });
                let removedCount = 0;
                let blockedCount = 0;
                
                for (const file of files) {
                  const filePath = path.join(tokensDir, file.name);
                  
                  // ✅ NOVO: Ignorar arquivos conhecidos que podem estar bloqueados pelo browser
                  if (file.name === 'lockfile' || 
                      file.name === 'segmentation_platform' || 
                      file.name.includes('Crashpad') ||
                      file.name.includes('SingletonLock')) {
                    blockedCount++;
                    continue; // Pular arquivos bloqueados
                  }
                  
                  try {
                    if (file.isDirectory()) {
                      fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                      fs.unlinkSync(filePath);
                    }
                    removedCount++;
                  } catch (fileError) {
                    // Ignorar arquivos bloqueados
                    blockedCount++;
                  }
                }
                
                console.log(`🗑️ [${accountName}] Limpeza parcial: ${removedCount} removidos, ${blockedCount} bloqueados (tentativa ${retryCount})`);
                
                // Se houver muitos arquivos bloqueados, usar session alternativo na próxima tentativa
                if (blockedCount > 0 && retryCount >= 1) {
                  console.warn(`⚠️ [${accountName}] Muitos arquivos bloqueados detectados, usando session alternativo na próxima tentativa...`);
                }
              } catch (rmError) {
                console.warn(`⚠️ [${accountName}] Erro ao limpar tokens:`, rmError.message);
              }
            }
          }
        } else {
          throw createError;
        }
      }
    }

    // Registrar conexão ANTES de configurar eventos (para evitar race conditions)
    activeConnections.set(accountId, {
      client,
      accountName,
      status: 'connecting',
      lastAttempt: Date.now(),
      attemptCount: 0,
      shouldGenerateQr,
      source,
      organizationId, // ✅ NOVO: Armazenar organizationId para uso ao emitir QR Code
      userId, // ✅ NOVO: Armazenar userId que iniciou a conexão
      reconnectEmailSent: false,
      manualDisconnectNotified: false
    });
    
    // ✅ DEBUG: Log para verificar se userId foi armazenado corretamente
    console.log(`🔍 [${accountName}] DEBUG - Conexão registrada em activeConnections:`, {
      accountId,
      userId: userId || 'N/A',
      source: source || 'N/A',
      organizationId: organizationId || 'N/A'
    });

    // ✅ Configurar eventos (deve ser feito após registrar conexão)
    await setupWPPConnectEvents(client, accountId, accountName, shouldGenerateQr);

    return { success: true, message: 'Conexão WPPConnect iniciada com sucesso' };

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao criar sessão WPPConnect:`, error);
    activeConnections.delete(accountId);
    return { success: false, error: error.message };
  }
};

// ✅ Função para atualizar status da conta (com throttle)
const updateAccountStatus = async (accountId, status) => {
  try {
    // ✅ CORREÇÃO: NUNCA gravar 'connecting' no banco de dados
    // O status 'connecting' é apenas um estado intermediário em memória
    // Isso evita alternância de status e triggers desnecessários no banco
    if (status === 'connecting') {
      console.log(`ℹ️ [${accountId}] Status 'connecting' mantido apenas em memória (não gravado no banco)`);
      return;
    }

    await supabase
      .from('whatsapp_accounts')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('account_id', accountId);
  } catch (error) {
    console.error(`❌ Erro ao atualizar status:`, error);
  }
};

// ✅ NOVA: Função auxiliar para extrair número de telefone do WPPConnect
const extractPhoneNumberFromWPPConnect = async (client, accountName) => {
  let phoneNumberStr = null;
  
  try {
    // Tentar obter via getHostDevice
    const hostDevice = await client.getHostDevice();
    console.log(`🔍 [${accountName}] getHostDevice retornou:`, JSON.stringify(hostDevice, null, 2));
    
    // Tentar diferentes formatos possíveis
    if (hostDevice) {
      // Formato 1: hostDevice.id (ex: "5511999999999@c.us")
      if (hostDevice.id) {
        phoneNumberStr = hostDevice.id.replace('@c.us', '').replace('@s.whatsapp.net', '');
      }
      // Formato 2: hostDevice.wid (ex: "5511999999999@c.us")
      else if (hostDevice.wid) {
        phoneNumberStr = hostDevice.wid.replace('@c.us', '').replace('@s.whatsapp.net', '');
      }
      // Formato 3: hostDevice.user (ex: "5511999999999")
      else if (hostDevice.user) {
        phoneNumberStr = hostDevice.user;
      }
      // Formato 4: hostDevice é string direta
      else if (typeof hostDevice === 'string') {
        phoneNumberStr = hostDevice.replace('@c.us', '').replace('@s.whatsapp.net', '');
      }
    }
    
    // ✅ Se ainda não conseguiu, tentar via getNumberId
    if (!phoneNumberStr || phoneNumberStr === '1' || phoneNumberStr.length < 10) {
      if (client.getNumberId && typeof client.getNumberId === 'function') {
        try {
          const numberId = await client.getNumberId();
          console.log(`🔍 [${accountName}] getNumberId retornou:`, JSON.stringify(numberId, null, 2));
          
          if (numberId) {
            if (typeof numberId === 'string') {
              phoneNumberStr = numberId.replace('@c.us', '').replace('@s.whatsapp.net', '');
            } else if (numberId.user) {
              phoneNumberStr = numberId.user;
            } else if (numberId.id) {
              phoneNumberStr = numberId.id.replace('@c.us', '').replace('@s.whatsapp.net', '');
            }
          }
        } catch (numberIdError) {
          console.warn(`⚠️ [${accountName}] Erro ao obter número via getNumberId:`, numberIdError.message);
        }
      } else {
        console.warn(`⚠️ [${accountName}] client.getNumberId não está disponível nesta instância`);
      }
    }
    
    // ✅ Se ainda não conseguiu, tentar via getMe
    if (!phoneNumberStr || phoneNumberStr === '1' || phoneNumberStr.length < 10) {
      try {
        if (client.getMe && typeof client.getMe === 'function') {
          const me = await client.getMe();
          console.log(`🔍 [${accountName}] getMe retornou:`, JSON.stringify(me, null, 2));
          
          if (me) {
            if (me.id) {
              phoneNumberStr = me.id.replace('@c.us', '').replace('@s.whatsapp.net', '');
            } else if (me.wid) {
              phoneNumberStr = me.wid.replace('@c.us', '').replace('@s.whatsapp.net', '');
            } else if (me.user) {
              phoneNumberStr = me.user;
            }
          }
        }
      } catch (meError) {
        console.warn(`⚠️ [${accountName}] Erro ao obter número via getMe:`, meError.message);
      }
    }
    
    // ✅ Validação final: se ainda for "1" ou inválido, tentar extrair do próprio client
    if (!phoneNumberStr || phoneNumberStr === '1' || phoneNumberStr.length < 10) {
      if (client.info) {
        const clientInfo = client.info;
        console.log(`🔍 [${accountName}] client.info:`, JSON.stringify(clientInfo, null, 2));
        
        if (clientInfo.wid) {
          phoneNumberStr = clientInfo.wid.replace('@c.us', '').replace('@s.whatsapp.net', '');
        } else if (clientInfo.id) {
          phoneNumberStr = clientInfo.id.replace('@c.us', '').replace('@s.whatsapp.net', '');
        } else if (clientInfo.user) {
          phoneNumberStr = clientInfo.user;
        }
      }
    }
    
    // ✅ Validação e log final
    if (phoneNumberStr && phoneNumberStr !== '1' && phoneNumberStr.length >= 10) {
      console.log(`✅ [${accountName}] Número extraído com sucesso: ${phoneNumberStr}`);
      return phoneNumberStr;
    } else {
      console.warn(`⚠️ [${accountName}] Número inválido ou não encontrado: ${phoneNumberStr}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao extrair número de telefone:`, error);
    return null;
  }
};

// ✅ Função para processar QR code (mesma lógica do Baileys)
// ✅ CORREÇÃO: Aceitar userId e source como parâmetros para evitar problemas de timing
const handleWPPConnectQRCode = async (qrCode, accountId, accountName, userId = null, source = null) => {
  // ✅ NOVO: Verificar se já está conectado antes de processar QR code
  const initialConnectionData = activeConnections.get(accountId);
  if (initialConnectionData && initialConnectionData.status === 'connected') {
    console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada (status: connected) - ignorando`);
    return; // Não processar QR code se já está conectado
  }
  
  // ✅ Verificar também no banco de dados
  try {
    const { data: accountData } = await supabase
      .from('whatsapp_accounts')
      .select('status, phone_number')
      .eq('account_id', accountId)
      .single();
    
    if (accountData?.status === 'connected' && accountData?.phone_number) {
      console.log(`⏸️ [${accountName}] QR code recebido mas conta já está conectada no banco - ignorando`);
      return; // Não processar QR code se já está conectado no banco
    }
  } catch (error) {
    console.warn(`⚠️ [${accountName}] Erro ao verificar status no banco antes de processar QR:`, error.message);
  }

  // ✅ Throttle para evitar processar o mesmo QR code múltiplas vezes
  const cachedQR = qrCodeCache.get(accountId);
  const now = Date.now();

  if (cachedQR && (now - cachedQR.timestamp) < QR_CODE_THROTTLE && cachedQR.qr === qrCode) {
    return; // QR code já foi processado recentemente
  }

  console.log(`📱 [${accountName}] QR Code gerado`);

  try {
    if (!qrCode || typeof qrCode !== 'string') {
      console.error(`❌ [${accountName}] QR Code inválido`);
      return;
    }

    // Gerar QR Code como DataURL
    const qrString = await qr.toDataURL(qrCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1
    });

    // Buscar organização da conta
    let accountData = null;
    
    // ✅ NOVO: Primeiro verificar se organizationId está na conexão ativa (para convites)
    const activeConnectionData = activeConnections.get(accountId);
    if (activeConnectionData && activeConnectionData.organizationId) {
      console.log(`📋 [${accountName}] Usando organizationId da conexão ativa: ${activeConnectionData.organizationId}`);
      accountData = { organization_id: activeConnectionData.organizationId };
    } else {
      // Se não estiver na conexão ativa, buscar do cache ou banco
      const cachedAccountInfo = accountInfoCache.get(accountId);

      if (cachedAccountInfo && (now - cachedAccountInfo.lastUpdated) < ACCOUNT_INFO_CACHE_TTL) {
        accountData = { organization_id: cachedAccountInfo.organization_id };
      } else {
        const { data: fetchedData } = await supabase
          .from('whatsapp_accounts')
          .select('organization_id')
          .eq('account_id', accountId)
          .single();

        if (fetchedData) {
          accountData = fetchedData;
          accountInfoCache.set(accountId, {
            organization_id: fetchedData.organization_id,
            lastUpdated: now
          });
        }
      }
    }

    // Emitir QR Code via Socket.IO
    if (io) {
      const qrData = {
        accountId,
        qr: qrString,
        accountName,
        timestamp: Date.now()
      };

      console.log(`📤 [${accountName}] Emitindo QR Code via Socket.IO`, {
        accountId,
        hasOrganization: !!accountData,
        organizationId: accountData?.organization_id
      });

      // ✅ NOVO: Verificar se há userId na conexão para emitir apenas para o usuário específico
      // ✅ IMPORTANTE: Convites e conexões automáticas NÃO têm userId, então usam fallback para organização
      // ✅ CORREÇÃO: Usar userId passado como parâmetro OU buscar da conexão ativa (fallback)
      const currentConnectionData = activeConnections.get(accountId);
      const connectionUserId = userId || currentConnectionData?.userId; // ✅ Priorizar userId passado como parâmetro
      const connectionSource = source || currentConnectionData?.source; // ✅ Priorizar source passado como parâmetro
      
      // ✅ DEBUG: Log detalhado para diagnóstico
      console.log(`🔍 [${accountName}] DEBUG - Verificando conexão para emitir QR:`, {
        accountId,
        hasConnectionData: !!currentConnectionData,
        userIdParam: userId || 'N/A',
        userIdFromConnection: currentConnectionData?.userId || 'N/A',
        userIdFinal: connectionUserId || 'N/A',
        sourceParam: source || 'N/A',
        sourceFromConnection: currentConnectionData?.source || 'N/A',
        sourceFinal: connectionSource || 'N/A',
        status: currentConnectionData?.status || 'N/A'
      });
      
      if (connectionUserId && connectionSource === 'manual') {
        // ✅ Conexão manual autenticada: emitir apenas para o usuário específico
        console.log(`📡 [${accountName}] 🔒 Emitindo QR Code APENAS para usuário ${connectionUserId} (conexão manual autenticada)`);
        io.to(`user-${connectionUserId}`).emit('whatsapp-qr-code', qrData);
        io.to(`user-${connectionUserId}`).emit('qr_code', {
          accountId,
          qrCode: qrString,
          accountName
        });
        console.log(`📡 [${accountName}] ✅ QR Code emitido exclusivamente para user-${connectionUserId}`);
      } else if (accountData && accountData.organization_id) {
        // ✅ FALLBACK: Se não houver userId OU for conexão automática/convite, emitir para organização
        // Isso garante compatibilidade com convites e conexões automáticas
        console.log(`📤 [${accountName}] 📢 Emitindo para organização ${accountData.organization_id} (${currentConnectionData?.source || 'sem source'} - ${connectionUserId ? 'com userId mas não manual' : 'sem userId'})`);
        io.to(`org_${accountData.organization_id}`).emit('whatsapp-qr-code', qrData);
        io.to(`org_${accountData.organization_id}`).emit('qr_code', {
          accountId,
          qrCode: qrString,
          accountName
        });
      } else {
        console.log(`📤 [${accountName}] Emitindo globalmente (sem organização)`);
        io.emit('whatsapp-qr-code', qrData);
        io.emit('qr_code', {
          accountId,
          qrCode: qrString,
          accountName
        });
      }
    } else {
      console.warn(`⚠️ [${accountName}] Socket.IO não disponível para emitir QR Code`);
    }

    // Atualizar status
    await updateAccountStatus(accountId, 'connecting');

    // Salvar no cache
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

    // Configurar timer de expiração do QR (5 minutos)
    const refreshedConnectionData = activeConnections.get(accountId);
    if (refreshedConnectionData) {
      if (refreshedConnectionData.qrTimer) clearTimeout(refreshedConnectionData.qrTimer);
      
      refreshedConnectionData.qrTimer = setTimeout(async () => {
        console.log(`⏰ [${accountName}] QR Code expirado (5 minutos)`);
        
        if (io && accountData) {
          io.to(`org_${accountData.organization_id}`).emit('whatsapp-qr-expired', {
            accountId,
            accountName,
            timestamp: Date.now()
          });
        }
        
        // Gerar novo QR code após timeout
        setTimeout(async () => {
          await createWPPConnectSession(accountId, accountName, true, 'auto');
        }, 3000);
      }, 300000); // 5 minutos
    }

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao processar QR Code:`, error);
    
    if (io) {
      const { data: accountInfo } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();
      
      if (accountInfo) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-qr-error', {
          accountId,
          accountName,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
  }
};

// ✅ NOVO: Função para buscar QR Code do cache (para polling HTTP)
export const getQRCodeFromCache = async (accountId) => {
  console.log(`🔍 [getQRCodeFromCache] Buscando QR Code no cache para accountId: ${accountId}`);
  console.log(`🔍 [getQRCodeFromCache] DEBUG - Estado do cache:`, {
    cacheSize: qrCodeCache.size,
    cacheKeys: Array.from(qrCodeCache.keys()),
    requestedAccountId: accountId,
    accountIdType: typeof accountId
  });
  
  const cachedQR = qrCodeCache.get(accountId);
  
  if (!cachedQR || !cachedQR.qr) {
    console.log(`❌ [getQRCodeFromCache] QR Code não encontrado no cache para accountId: ${accountId}`);
    // ✅ DEBUG: Listar todos os accountIds no cache
    const cacheKeys = Array.from(qrCodeCache.keys());
    console.log(`📋 [getQRCodeFromCache] AccountIds disponíveis no cache:`, cacheKeys);
    console.log(`📋 [getQRCodeFromCache] Comparação de IDs:`, {
      requested: accountId,
      available: cacheKeys,
      matches: cacheKeys.map(key => ({
        key,
        matches: key === accountId,
        strictEqual: key === accountId,
        looseEqual: key == accountId
      }))
    });
    return null;
  }
  
  console.log(`✅ [getQRCodeFromCache] QR Code encontrado no cache para accountId: ${accountId}`);
  console.log(`✅ [getQRCodeFromCache] DEBUG - Dados do cache:`, {
    accountId,
    qrLength: cachedQR.qr?.length || 0,
    qrType: typeof cachedQR.qr,
    timestamp: cachedQR.timestamp,
    age: Date.now() - cachedQR.timestamp
  });
  
  // Converter para DataURL
  const qrString = await qr.toDataURL(cachedQR.qr, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    quality: 0.92,
    margin: 1
  });
  
  console.log(`✅ [getQRCodeFromCache] QR Code convertido para DataURL, tamanho: ${qrString.length} chars`);
  
  return {
    qrCode: qrString,
    timestamp: cachedQR.timestamp
  };
};

// ✅ Configurar eventos do WPPConnect
const setupWPPConnectEvents = async (client, accountId, accountName, shouldGenerateQr) => {
  try {
    let connectionTimeout = null;
    
    // ✅ Evento de QR Code
    if (shouldGenerateQr) {
      const qrListener = async (qrCode) => {
        try {
          // ✅ NOVO: Verificar se já está conectado antes de processar QR code
          const connectionData = activeConnections.get(accountId);
          if (connectionData && connectionData.status === 'connected') {
            console.log(`⏸️ [${accountName}] QR code recebido via listener mas conta já está conectada - ignorando`);
            return; // Não processar QR code se já está conectado
          }
          
          await handleWPPConnectQRCode(qrCode, accountId, accountName, null, null);
        } catch (error) {
          console.error(`❌ [${accountName}] Erro ao processar QR Code (listener):`, error);
        }
      };

      let handlerRegistered = false;

      if (client && typeof client.onQRCode === 'function') {
        client.onQRCode(qrListener);
        handlerRegistered = true;
      } else if (client && typeof client.on === 'function') {
        client.on('qrCode', qrListener);
        handlerRegistered = true;
      }

      if (!handlerRegistered) {
        console.warn(`⚠️ [${accountName}] Instância WPPConnect não expõe listener de QR (onQRCode / 'qrCode'). Usando apenas catchQR.`);
      }
    }

    // ✅ ADICIONAR: Tratamento de erros do cliente
    if (client && typeof client.on === 'function') {
      client.on('error', async (error) => {
        console.error(`❌ [${accountName}] Erro no cliente WPPConnect:`, error);
        
        const connectionData = activeConnections.get(accountId);
        if (!connectionData) return;
        
        // Se o erro for de autenticação, tratar adequadamente
        const errorMessage = error?.message || error?.toString() || '';
        if (errorMessage.includes('Failed to authenticate') ||
            errorMessage.includes('Auto Close Called') ||
            errorMessage.includes('Session closed') ||
            errorMessage.includes('Connection closed')) {
          console.warn(`⚠️ [${accountName}] Erro de autenticação/conexão detectado: ${errorMessage}`);
          
          connectionData.status = 'disconnected';
          
          // Atualizar banco
          try {
            await supabase
              .from('whatsapp_accounts')
              .update({
                status: 'disconnected',
                qr_code: null,
                updated_at: new Date().toISOString()
              })
              .eq('account_id', accountId);
          } catch (dbError) {
            console.error(`❌ [${accountName}] Erro ao atualizar banco após erro de autenticação:`, dbError);
          }
          
          // Emitir erro para frontend
          if (io) {
            try {
              const { data: accountInfo } = await supabase
                .from('whatsapp_accounts')
                .select('organization_id')
                .eq('account_id', accountId)
                .maybeSingle();
              
              if (accountInfo?.organization_id) {
                io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-connection-error', {
                  accountId,
                  accountName,
                  error: 'Erro ao conectar conta. Use o botão "Tentar Novamente" para gerar um novo QR Code.',
                  details: errorMessage
                });
                console.log(`📡 [${accountName}] Evento de erro de conexão emitido para organização ${accountInfo.organization_id}`);
              }
            } catch (notifError) {
              console.error(`❌ [${accountName}] Erro ao emitir evento de erro:`, notifError);
            }
          }
        }
      });
    }

    // ✅ Evento de autenticação
    client.onStateChange(async (state) => {
      console.log(`🔄 [${accountName}] Estado WPPConnect: ${state} (tipo: ${typeof state})`);
      
      const connectionData = activeConnections.get(accountId);
      if (!connectionData) {
        console.warn(`⚠️ [${accountName}] connectionData não encontrado para accountId: ${accountId} quando estado mudou para: ${state}`);
        return;
      }

      console.log(`🔍 [${accountName}] Entrando no switch com estado: ${state} (tipo: ${typeof state}), status atual: ${connectionData.status}`);
      
      // ✅ CORREÇÃO: Normalizar estado para comparação (case-insensitive)
      const normalizedState = String(state).toUpperCase().trim();
      console.log(`🔍 [${accountName}] Estado normalizado: ${normalizedState}`);
      
      switch (normalizedState) {
        case 'CONNECTED':
          console.log(`✅ [${accountName}] CONECTADO - Iniciando processamento...`);
          connectionData.status = 'connected';
          connectionData.attemptCount = 0;
          connectionData.healthFailureCount = 0;
          connectionData.manualDisconnectNotified = false;
          
          // Limpar timers
          if (connectionData.qrTimer) {
            clearTimeout(connectionData.qrTimer);
            connectionData.qrTimer = null;
          }
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          // ✅ NOVO: Limpar verificação periódica de status (se existir)
          if (connectionData.sessionStatusCheck) {
            clearInterval(connectionData.sessionStatusCheck);
            connectionData.sessionStatusCheck = null;
          }
          
          try {
            console.log(`📞 [${accountName}] Extraindo número de telefone...`);
            // ✅ MELHORADO: Usar função auxiliar para extrair número de telefone
            const phoneNumberStr = await extractPhoneNumberFromWPPConnect(client, accountName);
            console.log(`📞 [${accountName}] Número extraído: ${phoneNumberStr || 'não encontrado'}`);
            
            console.log(`🔍 [${accountName}] Buscando informações da conta no banco...`);
            // Buscar organização para emitir notificação
            const { data: accountInfo, error: accountInfoError } = await supabase
              .from('whatsapp_accounts')
              .select('organization_id, phone_number')
              .eq('account_id', accountId)
              .single();
            
            if (accountInfoError) {
              console.error(`❌ [${accountName}] Erro ao buscar accountInfo:`, accountInfoError);
            } else {
              console.log(`✅ [${accountName}] AccountInfo encontrado:`, {
                organizationId: accountInfo.organization_id,
                phoneNumber: accountInfo.phone_number
              });
            }
            
            // Atualizar banco apenas se tiver número válido
            const updateData = {
              status: 'connected',
              updated_at: new Date().toISOString()
            };
            
            const hasValidPhone = phoneNumberStr && phoneNumberStr !== '1' && phoneNumberStr.length >= 10;
            if (hasValidPhone) {
              updateData.phone_number = phoneNumberStr;
            } else if (!accountInfo?.phone_number) {
              updateData.phone_number = '1';
            }
            
            console.log(`💾 [${accountName}] Atualizando banco de dados...`);
            const { error: updateError } = await supabase
              .from('whatsapp_accounts')
              .update(updateData)
              .eq('account_id', accountId);
            
            if (updateError) {
              console.error(`❌ [${accountName}] Erro ao atualizar banco:`, updateError);
            } else {
              console.log(`✅ [${accountName}] Banco atualizado com sucesso`);
            }

            // Emitir notificação de conexão para a organização correta
            if (io) {
              if (accountInfo) {
                const connectionEvent = {
                  accountId,
                  accountName,
                  phoneNumber: phoneNumberStr || null // Só enviar se for válido
                };
                console.log(`📡 [${accountName}] Emitindo evento whatsapp-connected:`, {
                  accountId,
                  accountName,
                  phoneNumber: phoneNumberStr || null,
                  organizationId: accountInfo.organization_id,
                  room: `org_${accountInfo.organization_id}`
                });
                io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-connected', connectionEvent);
                io.to(`org_${accountInfo.organization_id}`).emit('connection_status', {
                  accountId,
                  status: 'connected',
                  accountName,
                  phoneNumber: phoneNumberStr || null
                });
                console.log(`✅ [${accountName}] Evento whatsapp-connected emitido para organização ${accountInfo.organization_id}`);
              } else {
                console.warn(`⚠️ [${accountName}] accountInfo não encontrado, emitindo globalmente`);
                io.emit('connection_status', {
                  accountId,
                  status: 'connected',
                  accountName,
                  phoneNumber: phoneNumberStr || null
                });
                io.emit('whatsapp-connected', {
                  accountId,
                  accountName,
                  phoneNumber: phoneNumberStr || null
                });
              }
            } else {
              console.warn(`⚠️ [${accountName}] Socket.IO não disponível para emitir evento whatsapp-connected`);
            }
            
            // ✅ Log informativo
            if (phoneNumberStr && phoneNumberStr !== '1' && phoneNumberStr.length >= 10) {
              console.log(`✅ [${accountName}] Número ${phoneNumberStr} salvo com sucesso no banco`);
            } else {
              console.warn(`⚠️ [${accountName}] Número não foi salvo (inválido ou não encontrado). Status atualizado para 'connected' sem número.`);
            }

            // ✅ Iniciar monitoramento de saúde
            startHealthMonitoring(accountId, accountName, client);
            
            console.log(`✅ [${accountName}] Conexão estabelecida e monitoramento iniciado`);
          } catch (error) {
            console.error(`❌ [${accountName}] Erro ao atualizar status conectado:`, error);
            console.error(`❌ [${accountName}] Stack trace:`, error.stack);
            // ✅ CORREÇÃO: Tentar emitir evento mesmo em caso de erro (se accountInfo estiver disponível)
            if (io) {
              try {
                const { data: fallbackAccountInfo } = await supabase
                  .from('whatsapp_accounts')
                  .select('organization_id')
                  .eq('account_id', accountId)
                  .maybeSingle();
                
                if (fallbackAccountInfo?.organization_id) {
                  console.log(`📡 [${accountName}] Tentando emitir evento whatsapp-connected após erro...`);
                  io.to(`org_${fallbackAccountInfo.organization_id}`).emit('whatsapp-connected', {
                    accountId,
                    accountName,
                    phoneNumber: null
                  });
                  console.log(`✅ [${accountName}] Evento whatsapp-connected emitido após erro`);
                }
              } catch (fallbackError) {
                console.error(`❌ [${accountName}] Erro ao emitir evento após falha:`, fallbackError);
              }
            }
          }
          break;

        case 'UNPAIRED':
        case 'UNPAIRED_IDLE':
          console.warn(`⚠️ [${accountName}] Estado ${state} recebido - interpretando como logout manual`);
          
          // ✅ NOVO: Limpar tokens quando há logout manual
          await cleanupWPPConnectTokens(accountId, accountName);
          
          // ✅ CORREÇÃO: Atualizar status no banco IMEDIATAMENTE quando desconectar manualmente
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
              console.error(`❌ [${accountName}] Erro ao atualizar status para disconnected:`, updateError);
            } else {
              console.log(`✅ [IMMEDIATE UPDATE] Status atualizado imediatamente para ${accountId}: disconnected`);
            }
          } catch (dbError) {
            console.error(`❌ [${accountName}] Erro ao atualizar status no banco:`, dbError);
          }
          
          // Atualizar status na conexão ativa
          connectionData.status = 'disconnected';
          
          // ✅ NOVO: Limpar verificação periódica de status
          if (connectionData.sessionStatusCheck) {
            clearInterval(connectionData.sessionStatusCheck);
            connectionData.sessionStatusCheck = null;
          }
          
          // Enviar notificação apenas uma vez
          if (!connectionData.manualDisconnectNotified) {
            connectionData.manualDisconnectNotified = true;
            await triggerManualDisconnectNotification(accountId, accountName);
          }
          
          // Emitir evento de desconexão via Socket.IO
          try {
            const { data: accountInfo } = await supabase
              .from('whatsapp_accounts')
              .select('organization_id')
              .eq('account_id', accountId)
              .maybeSingle();

            if (accountInfo?.organization_id && io) {
              io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
                accountId,
                accountName,
                reason: 'Desconexão manual',
                attemptCount: connectionData.attemptCount || 0
              });
              io.to(`org_${accountInfo.organization_id}`).emit('connection_status', {
                accountId,
                status: 'disconnected',
                accountName
              });
              console.log(`📡 [WPPConnect] Evento de desconexão emitido para organização ${accountInfo.organization_id}`);
            }
          } catch (notifError) {
            console.error(`❌ [${accountName}] Erro ao emitir evento de desconexão:`, notifError);
          }
          
          break;

        case 'DISCONNECTED':
          console.log(`🔌 [${accountName}] DESCONECTADO`);
          connectionData.status = 'disconnected';
          
          // ✅ NOVO: Limpar tokens quando desconectado
          await cleanupWPPConnectTokens(accountId, accountName);
          
          // Parar monitoramento de saúde
          if (connectionHealthMonitor.has(accountId)) {
            clearInterval(connectionHealthMonitor.get(accountId));
            connectionHealthMonitor.delete(accountId);
          }
          
          // Limpar timers
          if (connectionData.qrTimer) {
            clearTimeout(connectionData.qrTimer);
            connectionData.qrTimer = null;
          }
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          // ✅ NOVO: Limpar verificação periódica de status
          if (connectionData.sessionStatusCheck) {
            clearInterval(connectionData.sessionStatusCheck);
            connectionData.sessionStatusCheck = null;
          }
          
          try {
            // Buscar organização para emitir notificação
            const { data: accountInfo } = await supabase
              .from('whatsapp_accounts')
              .select('organization_id')
              .eq('account_id', accountId)
              .maybeSingle();
            
            // ✅ CORREÇÃO: Atualizar status no banco IMEDIATAMENTE quando desconectar
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
              console.error(`❌ [${accountName}] Erro ao atualizar status para disconnected:`, updateError);
            } else {
              console.log(`✅ [IMMEDIATE UPDATE] Status atualizado imediatamente para ${accountId}: disconnected`);
            }

            // Emitir notificação de desconexão para a organização correta
            if (io) {
              if (accountInfo) {
                io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
                  accountId,
                  accountName,
                  reason: 'disconnected',
                  timestamp: Date.now()
                });
                io.to(`org_${accountInfo.organization_id}`).emit('connection_status', {
                  accountId,
                  status: 'disconnected',
                  accountName
                });
              } else {
                io.emit('connection_status', {
                  accountId,
                  status: 'disconnected',
                  accountName
                });
              }
            }
          } catch (error) {
            console.error(`❌ [${accountName}] Erro ao atualizar status desconectado:`, error);
          }
          break;

        case 'FAILED':
        case 'CLOSED':
          console.error(`❌ [${accountName}] Estado de erro: ${state}`);
          connectionData.status = 'disconnected';
          
          // ✅ NOVO: Limpar tokens quando há erro
          await cleanupWPPConnectTokens(accountId, accountName);
          
          // Limpar timers
          if (connectionData.qrTimer) {
            clearTimeout(connectionData.qrTimer);
            connectionData.qrTimer = null;
          }
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          
          // Limpar verificação periódica de status
          if (connectionData.sessionStatusCheck) {
            clearInterval(connectionData.sessionStatusCheck);
            connectionData.sessionStatusCheck = null;
          }
          
          // Atualizar banco
          try {
            await supabase
              .from('whatsapp_accounts')
              .update({
                status: 'disconnected',
                qr_code: null,
                updated_at: new Date().toISOString()
              })
              .eq('account_id', accountId);
          } catch (error) {
            console.error(`❌ [${accountName}] Erro ao atualizar status após erro:`, error);
          }
          
          // Emitir erro para o frontend
          if (io) {
            try {
              const { data: accountInfo } = await supabase
                .from('whatsapp_accounts')
                .select('organization_id')
                .eq('account_id', accountId)
                .maybeSingle();
              
              if (accountInfo?.organization_id) {
                io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-connection-error', {
                  accountId,
                  accountName,
                  error: 'Falha na autenticação. Tente conectar novamente.',
                  state
                });
                console.log(`📡 [${accountName}] Evento de erro de autenticação emitido para organização ${accountInfo.organization_id}`);
              }
            } catch (notifError) {
              console.error(`❌ [${accountName}] Erro ao emitir evento de erro:`, notifError);
            }
          }
          
          break;

        default:
          console.log(`ℹ️ [${accountName}] Estado desconhecido: ${state} (tipo: ${typeof state}, normalizado: ${normalizedState})`);
          // ✅ CORREÇÃO: Tentar tratar estados que podem ser variações de CONNECTED
          if (normalizedState && (normalizedState.includes('CONNECT') || normalizedState === 'OPEN' || normalizedState === 'AUTHENTICATED')) {
            console.log(`⚠️ [${accountName}] Estado parece ser uma variação de CONNECTED, a verificação periódica vai detectar isso`);
            // A verificação periódica vai detectar e processar a conexão
          }
      }
    });

    // ✅ NOVO: Verificar periodicamente se a sessão foi desemparelhada OU se conectou com sucesso
    // Isso é necessário porque o evento onStateChange pode não ser disparado quando a sessão é desemparelhada ou conectada
    const checkSessionStatus = setInterval(async () => {
      try {
        const connectionData = activeConnections.get(accountId);
        if (!connectionData) {
          clearInterval(checkSessionStatus);
          return;
        }

        // ✅ NOVO: Verificar se a conexão mudou de 'connecting' para 'connected'
        // Isso detecta conexões bem-sucedidas que não dispararam o evento onStateChange
        if (connectionData.status === 'connecting') {
          let isConnected = false;
          let state = null;
          
          try {
            // Tentar 1: getState()
            if (client && typeof client.getState === 'function') {
              state = await client.getState();
              isConnected = state === 'CONNECTED';
              console.log(`🔍 [${accountName}] Verificando status durante connecting: state=${state}, isConnected=${isConnected}`);
            }
            
            // Tentar 2: isConnected()
            if (!isConnected && client && typeof client.isConnected === 'function') {
              isConnected = await client.isConnected();
              console.log(`🔍 [${accountName}] isConnected() retornou: ${isConnected}`);
            }
            
            // Tentar 3: Verificar se consegue obter hostDevice (indica conexão ativa)
            if (!isConnected && client && typeof client.getHostDevice === 'function') {
              try {
                await Promise.race([
                  client.getHostDevice(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
                isConnected = true;
                console.log(`✅ [${accountName}] getHostDevice() bem-sucedido - conexão detectada`);
              } catch (testError) {
                // Se falhou, ainda está conectando
                isConnected = false;
              }
            }
          } catch (error) {
            console.warn(`⚠️ [${accountName}] Erro ao verificar se conectou:`, error.message);
            isConnected = false;
          }

          // Se detectou conexão bem-sucedida, processar como se fosse o evento CONNECTED
          if (isConnected) {
            console.log(`✅ [${accountName}] Conexão bem-sucedida detectada via verificação periódica! Processando...`);
            
            // Atualizar status na conexão
            connectionData.status = 'connected';
            connectionData.attemptCount = 0;
            connectionData.healthFailureCount = 0;
            connectionData.manualDisconnectNotified = false;
            
            // Limpar timers
            if (connectionData.qrTimer) {
              clearTimeout(connectionData.qrTimer);
              connectionData.qrTimer = null;
            }
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              connectionTimeout = null;
            }
            
            try {
              // Extrair número de telefone
              const phoneNumberStr = await extractPhoneNumberFromWPPConnect(client, accountName);
              console.log(`📞 [${accountName}] Número extraído: ${phoneNumberStr || 'não encontrado'}`);
              
              // Buscar informações da conta no banco
              const { data: accountInfo, error: accountInfoError } = await supabase
                .from('whatsapp_accounts')
                .select('organization_id, phone_number')
                .eq('account_id', accountId)
                .single();
              
              if (accountInfoError) {
                console.error(`❌ [${accountName}] Erro ao buscar accountInfo:`, accountInfoError);
              }
              
              // Atualizar banco
              const updateData = {
                status: 'connected',
                updated_at: new Date().toISOString()
              };
              
              const hasValidPhone = phoneNumberStr && phoneNumberStr !== '1' && phoneNumberStr.length >= 10;
              if (hasValidPhone) {
                updateData.phone_number = phoneNumberStr;
              } else if (!accountInfo?.phone_number) {
                updateData.phone_number = '1';
              }
              
              const { error: updateError } = await supabase
                .from('whatsapp_accounts')
                .update(updateData)
                .eq('account_id', accountId);
              
              if (updateError) {
                console.error(`❌ [${accountName}] Erro ao atualizar banco:`, updateError);
              } else {
                console.log(`✅ [${accountName}] Banco atualizado com sucesso via verificação periódica`);
              }

              // Emitir evento whatsapp-connected
              if (io && accountInfo) {
                const connectionEvent = {
                  accountId,
                  accountName,
                  phoneNumber: phoneNumberStr || null
                };
                console.log(`📡 [${accountName}] Emitindo evento whatsapp-connected via verificação periódica:`, {
                  accountId,
                  accountName,
                  phoneNumber: phoneNumberStr || null,
                  organizationId: accountInfo.organization_id,
                  room: `org_${accountInfo.organization_id}`
                });
                io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-connected', connectionEvent);
                io.to(`org_${accountInfo.organization_id}`).emit('connection_status', {
                  accountId,
                  status: 'connected',
                  accountName,
                  phoneNumber: phoneNumberStr || null
                });
                console.log(`✅ [${accountName}] Evento whatsapp-connected emitido via verificação periódica para organização ${accountInfo.organization_id}`);
              }
              
              // Iniciar monitoramento de saúde
              startHealthMonitoring(accountId, accountName, client);
            } catch (error) {
              console.error(`❌ [${accountName}] Erro ao processar conexão detectada via verificação periódica:`, error);
              console.error(`❌ [${accountName}] Stack trace:`, error.stack);
            }
            
            // Continuar com a verificação normal de desconexão
          }
        }

        // Verificar desconexão apenas se já estava conectado
        if (connectionData.status !== 'connected') {
          return;
        }

        // ✅ MELHORADO: Verificar múltiplas formas de detectar desconexão
        let isConnected = false;
        let state = null;
        
        try {
          // Tentar 1: isConnected()
          if (client && typeof client.isConnected === 'function') {
            isConnected = await client.isConnected();
          }
          
          // Tentar 2: getState()
          if (!isConnected && client && typeof client.getState === 'function') {
            state = await client.getState();
            isConnected = state === 'CONNECTED';
          }
          
          // Tentar 3: Verificar se o cliente ainda existe e está válido
          if (!isConnected && client) {
            // Se o cliente existe mas não responde, pode estar desconectado
            // Tentar uma operação simples para verificar
            try {
              if (typeof client.getHostDevice === 'function') {
                await Promise.race([
                  client.getHostDevice(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
                isConnected = true; // Se conseguiu obter hostDevice, está conectado
              }
            } catch (testError) {
              // Se falhou, está desconectado
              isConnected = false;
            }
          }
        } catch (error) {
          // Se houver erro ao verificar, assumir que está desconectado
          console.warn(`⚠️ [${accountName}] Erro ao verificar status da conexão:`, error.message);
          isConnected = false;
        }

        // Se não estiver conectado, atualizar status
        if (!isConnected) {
          console.warn(`⚠️ [${accountName}] Sessão desemparelhada detectada (state: ${state || 'N/A'}) - atualizando status`);
          
          // ✅ NOVO: Limpar tokens quando detecta sessão desemparelhada
          await cleanupWPPConnectTokens(accountId, accountName);
          
          // Atualizar status no banco
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
              console.error(`❌ [${accountName}] Erro ao atualizar status para disconnected:`, updateError);
            } else {
              console.log(`✅ [IMMEDIATE UPDATE] Status atualizado imediatamente para ${accountId}: disconnected`);
            }
          } catch (dbError) {
            console.error(`❌ [${accountName}] Erro ao atualizar status no banco:`, dbError);
          }

          // Atualizar status na conexão ativa
          connectionData.status = 'disconnected';
          
          // ✅ NOVO: Limpar verificação periódica de status
          if (connectionData.sessionStatusCheck) {
            clearInterval(connectionData.sessionStatusCheck);
            connectionData.sessionStatusCheck = null;
          }
          
          // Emitir evento de desconexão via Socket.IO
          try {
            const { data: accountInfo } = await supabase
              .from('whatsapp_accounts')
              .select('organization_id')
              .eq('account_id', accountId)
              .maybeSingle();

            if (accountInfo?.organization_id && io) {
              io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
                accountId,
                accountName,
                reason: 'Desconexão manual',
                attemptCount: connectionData.attemptCount || 0
              });
              io.to(`org_${accountInfo.organization_id}`).emit('connection_status', {
                accountId,
                status: 'disconnected',
                accountName
              });
              console.log(`📡 [WPPConnect] Evento de desconexão emitido para organização ${accountInfo.organization_id}`);
            }
          } catch (notifError) {
            console.error(`❌ [${accountName}] Erro ao emitir evento de desconexão:`, notifError);
          }

          // Limpar intervalo
          clearInterval(checkSessionStatus);
        }
      } catch (error) {
        console.error(`❌ [${accountName}] Erro ao verificar status da sessão:`, error);
      }
    }, 5000); // ✅ CORREÇÃO: Verificar a cada 5 segundos (mais rápido para detectar desconexões)

    // Salvar intervalo na conexão para limpar quando desconectar
    const connectionDataForCheck = activeConnections.get(accountId);
    if (connectionDataForCheck) {
      connectionDataForCheck.sessionStatusCheck = checkSessionStatus;
    }

    // ✅ Evento de mensagens recebidas (apenas mensagens de clientes)
    client.onMessage(async (message) => {
      try {
        if (message.fromMe) {
          return; // Mensagens próprias serão tratadas pelo onAnyMessage
        }
        console.log(`📨 [${accountName}] Mensagem recebida via WPPConnect:`, {
          from: message.from,
          fromMe: message.fromMe,
          type: message.type,
          body: message.body?.substring(0, 50) || 'sem texto'
        });
        await handleWPPConnectMessage(message, accountId, accountName, client);
      } catch (error) {
        console.error(`❌ [${accountName}] Erro ao processar mensagem:`, error);
        console.error(`❌ [${accountName}] Stack trace:`, error.stack);
      }
    });

    // ✅ Evento de mensagens próprias enviadas pelo WhatsApp oficial
    if (typeof client.onAnyMessage === 'function') {
      client.onAnyMessage(async (message) => {
        try {
          if (!message.fromMe) {
            return; // Evitar duplicidade com onMessage
          }
          console.log(`📤 [${accountName}] Mensagem própria detectada via WPPConnect:`, {
            to: message.to || message.chatId || message.from,
            type: message.type,
            body: message.body?.substring(0, 50) || 'sem texto'
          });
          await handleWPPConnectMessage(message, accountId, accountName, client);
        } catch (error) {
          console.error(`❌ [${accountName}] Erro ao processar mensagem própria:`, error);
          console.error(`❌ [${accountName}] Stack trace:`, error.stack);
        }
      });
    } else {
      console.warn(`⚠️ [${accountName}] onAnyMessage não disponível no client - mensagens próprias podem não ser registradas`);
    }

    // ✅ Timeout de conexão: 3 minutos - encerrar completamente se não conectar
    connectionTimeout = setTimeout(async () => {
      const connectionData = activeConnections.get(accountId);
      if (connectionData && connectionData.status === 'connecting') {
        console.warn(`⚠️ [${accountName}] Timeout de conexão após 3 minutos - encerrando conexão`);
        await handleConnectionTimeout(accountId, accountName);
      }
    }, 180000); // ✅ 3 minutos (180000ms) - encerrar completamente se não conectar

    // Salvar timeout na conexão
    const connectionData = activeConnections.get(accountId);
    if (connectionData) {
      connectionData.connectionTimeout = connectionTimeout;
    }

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao configurar eventos WPPConnect:`, error);
  }
};

// ✅ Função para lidar com desconexão (mesma lógica do Baileys)
const handleWPPConnectDisconnection = async (accountId, accountName, reason) => {
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

  // Limpar conexão atual
  try {
    if (connection.client) {
      try {
        await connection.client.logout();
      } catch (error) {
        // Ignorar erros ao fazer logout
      }
    }
  } catch (error) {
    console.error(`❌ [CLEANUP] Erro ao limpar conexão ${accountName}:`, error.message);
  }

  activeConnections.delete(accountId);

  // Atualizar status no banco
  try {
    const isMaxAttemptsReached = connection.attemptCount >= MAX_RECONNECT_ATTEMPTS;
    await updateAccountStatus(accountId, isMaxAttemptsReached ? 'error' : 'disconnected');

    // Buscar organização para emitir notificação
    const { data: accountInfo } = await supabase
      .from('whatsapp_accounts')
      .select('organization_id')
      .eq('account_id', accountId)
      .single();

    if (accountInfo && io) {
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

  // Se atingiu máximo de tentativas, gerar QR code novo
  if (connection.attemptCount >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`📱 [${accountName}] Máximo de tentativas atingido, gerando novo QR code...`);
    setTimeout(async () => {
      // ✅ NOVO: Verificar se já está conectado antes de gerar novo QR code
      try {
        const { data: accountData } = await supabase
          .from('whatsapp_accounts')
          .select('status, phone_number')
          .eq('account_id', accountId)
          .single();
        
        if (accountData?.status === 'connected' && accountData?.phone_number) {
          console.log(`⏸️ [${accountName}] Conta já está conectada - não gerando novo QR code após máximo de tentativas`);
          return; // Não gerar novo QR code se já está conectado
        }
        
        await createWPPConnectSession(accountId, accountName, true, 'auto');
      } catch (error) {
        console.warn(`⚠️ [${accountName}] Erro ao verificar status antes de gerar novo QR:`, error.message);
        // Continuar gerando QR code se houver erro na verificação
        await createWPPConnectSession(accountId, accountName, true, 'auto');
      }
    }, 5000);
    return;
  }

  // ✅ NOVO: Verificar se já está conectado antes de reconectar
  try {
    const { data: accountData } = await supabase
      .from('whatsapp_accounts')
      .select('status, phone_number')
      .eq('account_id', accountId)
      .single();
    
    if (accountData?.status === 'connected' && accountData?.phone_number) {
      console.log(`⏸️ [${accountName}] Conta já está conectada no banco - não reconectando`);
      return; // Não reconectar se já está conectado
    }
  } catch (error) {
    console.warn(`⚠️ [${accountName}] Erro ao verificar status antes de reconectar:`, error.message);
    // Continuar com reconexão se houver erro na verificação
  }

  // Reconectar com delay progressivo
  if (shouldAttemptReconnect(reason)) {
    const delay = calculateReconnectDelay(connection.attemptCount);
    console.log(`🔄 [RECONNECT] Reconectando ${accountName} em ${delay}ms (${Math.round(delay/1000)}s) - tentativa ${connection.attemptCount}/${MAX_RECONNECT_ATTEMPTS}`);

    setTimeout(() => {
      createWPPConnectSession(accountId, accountName, false, 'auto');
    }, delay);
  } else {
    console.log(`❌ [SKIP_RECONNECT] Reconexão não necessária para ${accountName} (razão: ${reason})`);
  }
};

// ✅ Função para determinar se deve tentar reconectar
const shouldAttemptReconnect = (reason) => {
  const noReconnectReasons = [
    'keep_alive_failed',
    'heartbeat_error',
    'connection_timeout'
  ];

  if (noReconnectReasons.some(r => reason.includes(r))) {
    return false;
  }

  return reason.includes('disconnect') || reason.includes('health_check_failed') || reason === 'disconnected' || reason === 'failure';
};

// ✅ Função para calcular delay de reconexão (backoff exponencial)
const calculateReconnectDelay = (attemptCount) => {
  return Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attemptCount - 1), MAX_RECONNECT_DELAY);
};

// ✅ CORRIGIDO: Função para lidar com timeout de conexão - encerrar completamente
const handleConnectionTimeout = async (accountId, accountName) => {
  console.log(`⏰ [${accountName}] Timeout de conexão atingido (3 minutos) - encerrando conexão completamente...`);

  try {
    const connectionData = activeConnections.get(accountId);
    
    // ✅ NOVO: Encerrar cliente WPPConnect se existir
    if (connectionData && connectionData.client) {
      try {
        console.log(`🔌 [${accountName}] Fechando cliente WPPConnect devido ao timeout...`);
        await connectionData.client.close();
      } catch (closeError) {
        console.warn(`⚠️ [${accountName}] Erro ao fechar cliente:`, closeError.message);
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

    // ✅ Limpar conexão
    activeConnections.delete(accountId);

    // ✅ Atualizar status no banco para 'disconnected'
    await updateAccountStatus(accountId, 'disconnected');

    // ✅ Emitir notificação de timeout
    try {
      const { data: accountInfo } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id')
        .eq('account_id', accountId)
        .single();

      if (accountInfo && io) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
          accountId,
          accountName,
          reason: 'Timeout de conexão após 3 minutos. Conexão encerrada.',
          attemptCount: 0
        });
      }
    } catch (error) {
      console.error(`❌ [${accountName}] Erro ao emitir notificação de timeout:`, error);
    }

    console.log(`✅ [${accountName}] Conexão encerrada completamente após timeout de 3 minutos`);
  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao lidar com timeout:`, error);
  }
};

// ✅ Função para iniciar monitoramento de saúde
const startHealthMonitoring = (accountId, accountName, client) => {
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
      // Verificar se a conexão está válida
      const isConnected = client?.isConnected() || false;

      if (isConnected) {
        console.log(`💓 [HEALTH] Conexão saudável para ${accountName}`);

        connection.lastHeartbeat = Date.now();
        connection.status = 'connected';
        connection.healthFailureCount = 0;

        // Atualizar banco apenas a cada 30 minutos
        const lastDbUpdate = connection.lastDbUpdate || 0;
        if (Date.now() - lastDbUpdate > 1800000) { // 30 minutos
          try {
            await updateAccountStatus(accountId, 'connected');
            connection.lastDbUpdate = Date.now();
          } catch (dbError) {
            console.warn(`⚠️ [HEALTH] Erro ao atualizar status no banco para ${accountName}:`, dbError.message);
          }
        }
      } else {
        // Incrementar contador de falhas
        if (!connection.healthFailureCount) {
          connection.healthFailureCount = 0;
        }
        connection.healthFailureCount++;

        // Só considerar falha após 3 verificações consecutivas (30 minutos)
        if (connection.healthFailureCount >= 3) {
          console.log(`⚠️ [HEALTH] Conexão ${accountName} inválida após ${connection.healthFailureCount} verificações`);
          await handleWPPConnectDisconnection(accountId, accountName, 'health_check_failed');
          connection.healthFailureCount = 0;
        } else {
          console.log(`⚠️ [HEALTH] Conexão ${accountName} inválida (tentativa ${connection.healthFailureCount}/3), aguardando...`);
        }
      }
    } catch (error) {
      console.error(`❌ [HEALTH] Erro no heartbeat para ${accountName}:`, error.message);
    }
  }, HEARTBEAT_INTERVAL);

  connectionHealthMonitor.set(accountId, healthInterval);
};

// ✅ Função para verificar conexões órfãs
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
      // ✅ CRÍTICO: Verificar qual API a organização está usando ANTES de tentar reconectar
      const orgConfig = await getOrganizationSettings(account.account_id);
      const whatsappApi = orgConfig?.whatsapp_api || 'baileys';
      
      // ✅ Se a organização não está usando WPPConnect, pular esta conta
      if (whatsappApi !== 'wppconnect') {
        continue; // Deixar o serviço Baileys ou outro serviço lidar com isso
      }

      const connection = activeConnections.get(account.account_id);

      const updatedAt = new Date(account.updated_at).getTime();
      const timeSinceUpdate = now - updatedAt;
      const tenMinutes = 10 * 60 * 1000;

      const isReconnecting = activeConnections.has(account.account_id) &&
                            activeConnections.get(account.account_id).status === 'connecting';

      // ✅ MELHORADO: Verificar também se está conectado no banco antes de reconectar
      const isDbConnected = account.status === 'connected' && !!account.phone_number;
      
      if (!connection && !isReconnecting && !isDbConnected && timeSinceUpdate > tenMinutes) {
        orphanedAccounts.push(account.name);
        await createWPPConnectSession(account.account_id, account.name, false, { source: 'auto' });
      } else if (isDbConnected && !connection) {
        // ✅ Se está conectado no banco mas não em activeConnections, apenas logar (não reconectar)
        console.log(`ℹ️ [ORPHAN] Conta ${account.name} está conectada no banco mas não em activeConnections - mantendo status`);
      }
    }

    if (orphanedAccounts.length > 0) {
      console.log(`🔄 [ORPHAN] Reconectando ${orphanedAccounts.length} conta(s) órfã(s) WPPConnect: ${orphanedAccounts.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Erro ao verificar conexões órfãs:', error);
  }
};

// ✅ Inicializar verificações periódicas
setInterval(checkOrphanedConnections, 600000); // A cada 10 minutos

// ✅ Converter mensagem WPPConnect para formato Baileys
const convertWPPConnectToBaileysFormat = (wppMessage) => {
  const message = {
    key: {
      id: wppMessage.id,
      remoteJid: wppMessage.from,
      fromMe: wppMessage.fromMe || false
    },
    messageTimestamp: wppMessage.timestamp || Date.now(),
    pushName: wppMessage.notifyName || wppMessage.sender?.pushname || wppMessage.senderName || ''
  };

  // Detectar tipo de mensagem e converter
  if (wppMessage.type === 'image' || wppMessage.isMedia && wppMessage.mimetype?.startsWith('image/')) {
    message.message = {
      imageMessage: {
        url: wppMessage.mediaUrl || wppMessage.deprecatedMms3Url,
        mimetype: wppMessage.mimetype || 'image/jpeg',
        fileLength: wppMessage.size || null,
        fileName: wppMessage.filename || `image_${Date.now()}.jpg`,
        caption: wppMessage.caption || ''
      }
    };
  } else if (wppMessage.type === 'video' || wppMessage.isMedia && wppMessage.mimetype?.startsWith('video/')) {
    message.message = {
      videoMessage: {
        url: wppMessage.mediaUrl || wppMessage.deprecatedMms3Url,
        mimetype: wppMessage.mimetype || 'video/mp4',
        fileLength: wppMessage.size || null,
        fileName: wppMessage.filename || `video_${Date.now()}.mp4`,
        caption: wppMessage.caption || ''
      }
    };
  } else if (wppMessage.type === 'audio' || wppMessage.isMedia && wppMessage.mimetype?.startsWith('audio/')) {
    message.message = {
      audioMessage: {
        url: wppMessage.mediaUrl || wppMessage.deprecatedMms3Url,
        mimetype: wppMessage.mimetype || 'audio/ogg',
        fileLength: wppMessage.size || null,
        fileName: wppMessage.filename || `audio_${Date.now()}.ogg`,
        ptt: wppMessage.isPTT || false
      }
    };
  } else if (wppMessage.type === 'document' || wppMessage.isMedia) {
    message.message = {
      documentMessage: {
        url: wppMessage.mediaUrl || wppMessage.deprecatedMms3Url,
        mimetype: wppMessage.mimetype || 'application/pdf',
        fileLength: wppMessage.size || null,
        fileName: wppMessage.filename || `document_${Date.now()}.pdf`,
        caption: wppMessage.caption || ''
      }
    };
  } else if (wppMessage.type === 'sticker') {
    message.message = {
      stickerMessage: {
        url: wppMessage.mediaUrl || wppMessage.deprecatedMms3Url,
        mimetype: wppMessage.mimetype || 'image/webp',
        fileLength: wppMessage.size || null
      }
    };
  } else if (wppMessage.type === 'location') {
    message.message = {
      locationMessage: {
        degreesLatitude: wppMessage.lat,
        degreesLongitude: wppMessage.lng
      }
    };
  } else if (wppMessage.type === 'vcard' || wppMessage.isVcard) {
    message.message = {
      contactMessage: {
        contacts: [{
          name: wppMessage.vcard?.displayName || wppMessage.body?.split('\n')[0] || 'Contato',
          number: wppMessage.vcard?.phoneNumber || ''
        }]
      }
    };
  } else {
    // Mensagem de texto
    message.message = {
      conversation: wppMessage.body || wppMessage.text || '',
      extendedTextMessage: wppMessage.body ? { text: wppMessage.body } : undefined
    };
  }

  return message;
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

// ✅ Função para baixar mídia do WPPConnect
const downloadWPPConnectMedia = async (wppMessage, chatId, client = null) => {
  try {
    // ✅ CORREÇÃO: Para mensagens próprias, verificar também mediaData (base64)
    // ✅ MELHORADO: Verificar se o tipo da mensagem realmente indica mídia
    const isMediaType = wppMessage.type === 'image' || 
                        wppMessage.type === 'video' || 
                        wppMessage.type === 'audio' || 
                        wppMessage.type === 'document' || 
                        wppMessage.type === 'sticker' ||
                        wppMessage.mimetype?.startsWith('image/') ||
                        wppMessage.mimetype?.startsWith('video/') ||
                        wppMessage.mimetype?.startsWith('audio/');
    
    const hasMedia = isMediaType || 
                     wppMessage.isMedia || 
                     wppMessage.mediaUrl || 
                     wppMessage.deprecatedMms3Url || 
                     (wppMessage.mediaData && wppMessage.mediaData.length > 100); // mediaData válido tem mais de 100 bytes
    
    if (!hasMedia) {
      console.log(`ℹ️ [WPPCONNECT] Mensagem não contém mídia válida. Type: ${wppMessage.type}, isMedia: ${wppMessage.isMedia}, hasMediaUrl: ${!!wppMessage.mediaUrl}, mediaDataLength: ${wppMessage.mediaData?.length || 0}`);
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

    // ✅ CORREÇÃO: Determinar tipo de mídia ANTES de processar (garantir que GIFs sejam tratados como imagens)
    let mediaType = 'text';
    if (wppMessage.type === 'image' || wppMessage.mimetype?.startsWith('image/')) {
      mediaType = 'image'; // ✅ GIFs são tratados como imagens
    } else if (wppMessage.type === 'video' || wppMessage.mimetype?.startsWith('video/')) {
      mediaType = 'video';
    } else if (wppMessage.type === 'audio' || wppMessage.mimetype?.startsWith('audio/') || wppMessage.type === 'ptt') {
      mediaType = 'audio';
    } else if (wppMessage.type === 'document' || wppMessage.type === 'file') {
      mediaType = 'file';
    } else if (wppMessage.type === 'sticker') {
      mediaType = 'sticker';
    } else if (wppMessage.type === 'location' || wppMessage.lat || wppMessage.lng) {
      // ✅ NOVO: Tratar localização
      const locationText = `📍 Localização\n🌍 Latitude: ${wppMessage.lat || 'N/A'}\n🌍 Longitude: ${wppMessage.lng || 'N/A'}`;
      return {
        mediaType: 'location',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: locationText,
        localPath: null
      };
    } else if (wppMessage.type === 'vcard' || wppMessage.vcard) {
      // ✅ NOVO: Tratar contato
      const contactText = `📞 Contato: ${wppMessage.vcard?.displayName || 'Sem nome'}\n📱 Número: ${wppMessage.vcard?.phoneNumber || 'Sem número'}`;
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

    // ✅ CORREÇÃO: Para mensagens próprias, pode ter mediaData (base64) ao invés de URL
    let mediaUrl = wppMessage.mediaUrl || wppMessage.deprecatedMms3Url;
    let buffer = null;
    
    // ✅ VALIDAÇÃO: Verificar se a URL é válida antes de tentar baixar
    const isValidUrl = mediaUrl && 
                      typeof mediaUrl === 'string' && 
                      mediaUrl.trim() !== '' && 
                      (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) &&
                      !mediaUrl.includes('web.whatsapp.net') && // ✅ CORREÇÃO: URLs do web.whatsapp.net não funcionam diretamente
                      mediaUrl.length > 10; // URL mínima válida
    
    // ✅ MELHORADO: Para mensagens próprias, tentar baixar via client PRIMEIRO (mais confiável)
    // Se for mensagem própria e tiver client e messageId, tentar baixar via client primeiro
    if (wppMessage.fromMe && client && wppMessage.id && !isValidUrl) {
      try {
        console.log(`📥 [WPPCONNECT] Mensagem própria detectada - tentando baixar via client primeiro...`);
        console.log(`📥 [WPPCONNECT] MessageId: ${wppMessage.id}, Type: ${wppMessage.type}`);
        
        // Tentar diferentes formatos de ID e métodos
        let mediaData = null;
        
        // Método 1: Tentar com o ID completo
        if (typeof client.downloadMedia === 'function') {
          try {
            mediaData = await client.downloadMedia(wppMessage.id);
            console.log(`📥 [WPPCONNECT] downloadMedia com ID completo retornou:`, {
              hasData: !!mediaData?.data,
              dataType: typeof mediaData?.data,
              dataLength: mediaData?.data?.length || 0
            });
          } catch (error1) {
            console.warn(`⚠️ [WPPCONNECT] Erro ao usar downloadMedia com ID completo:`, error1.message);
            
            // Método 2: Tentar extrair apenas a parte do ID após o último underscore
            try {
              const idParts = wppMessage.id.split('_');
              if (idParts.length > 0) {
                const shortId = idParts[idParts.length - 1];
                console.log(`📥 [WPPCONNECT] Tentando com ID curto: ${shortId}`);
                mediaData = await client.downloadMedia(shortId);
                console.log(`📥 [WPPCONNECT] downloadMedia com ID curto retornou:`, {
                  hasData: !!mediaData?.data,
                  dataType: typeof mediaData?.data,
                  dataLength: mediaData?.data?.length || 0
                });
              }
            } catch (error2) {
              console.warn(`⚠️ [WPPCONNECT] Erro ao usar downloadMedia com ID curto:`, error2.message);
            }
          }
        }
        
        // Método 3: Tentar usar getMessageById primeiro e depois downloadMedia
        if (!mediaData && typeof client.getMessageById === 'function' && typeof client.downloadMedia === 'function') {
          try {
            const fullMessage = await client.getMessageById(wppMessage.id);
            if (fullMessage && fullMessage.id) {
              console.log(`📥 [WPPCONNECT] getMessageById retornou mensagem com ID: ${fullMessage.id}`);
              mediaData = await client.downloadMedia(fullMessage.id);
              console.log(`📥 [WPPCONNECT] downloadMedia via getMessageById retornou:`, {
                hasData: !!mediaData?.data,
                dataType: typeof mediaData?.data,
                dataLength: mediaData?.data?.length || 0
              });
            }
          } catch (error3) {
            console.warn(`⚠️ [WPPCONNECT] Erro ao usar getMessageById + downloadMedia:`, error3.message);
          }
        }
        
        // Processar dados obtidos
        if (mediaData && mediaData.data) {
          if (typeof mediaData.data === 'string') {
            const base64String = mediaData.data.includes(',') 
              ? mediaData.data.split(',')[1] 
              : mediaData.data;
            buffer = Buffer.from(base64String, 'base64');
            console.log(`✅ [WPPCONNECT] Mídia baixada via client (base64) - ${buffer.length} bytes`);
          } else if (Buffer.isBuffer(mediaData.data)) {
            buffer = mediaData.data;
            console.log(`✅ [WPPCONNECT] Mídia baixada via client (Buffer) - ${buffer.length} bytes`);
          }
        } else {
          console.warn(`⚠️ [WPPCONNECT] Nenhum dado de mídia retornado pelos métodos do client`);
        }
      } catch (clientError) {
        console.error(`❌ [WPPCONNECT] Erro geral ao baixar mídia via client (mensagem própria):`, clientError);
        console.error(`❌ [WPPCONNECT] Stack trace:`, clientError.stack);
      }
    }
    
    // Se não tem URL mas tem mediaData (base64), usar isso (apenas se ainda não tem buffer)
    // ✅ CORREÇÃO: Ignorar mediaData muito pequeno (< 100 bytes) - indica dados inválidos
    if (!buffer && !isValidUrl && wppMessage.mediaData) {
      try {
        let base64Data = null;
        let tempBuffer = null;
        
        // ✅ CORREÇÃO: Verificar tipo de mediaData e extrair string base64
        if (typeof wppMessage.mediaData === 'string') {
          // Já é uma string base64
          base64Data = wppMessage.mediaData;
        } else if (Buffer.isBuffer(wppMessage.mediaData)) {
          // Já é um Buffer, usar diretamente
          tempBuffer = wppMessage.mediaData;
        } else if (typeof wppMessage.mediaData === 'object') {
          // É um objeto, tentar extrair a propriedade base64
          base64Data = wppMessage.mediaData.data || 
                      wppMessage.mediaData.base64 || 
                      wppMessage.mediaData.toString?.() || 
                      null;
          
          // Se ainda não for string, logar aviso
          if (base64Data === null || typeof base64Data !== 'string') {
            console.warn(`⚠️ [WPPCONNECT] mediaData é objeto sem propriedade data/base64 válida:`, Object.keys(wppMessage.mediaData));
            base64Data = null;
          }
        }
        
        // Converter base64 para buffer se necessário
        if (base64Data && typeof base64Data === 'string') {
          // Remover prefixo data: se existir (ex: "data:image/jpeg;base64,/9j/4AAQ...")
          const base64String = base64Data.includes(',') 
            ? base64Data.split(',')[1] 
            : base64Data;
          
          tempBuffer = Buffer.from(base64String, 'base64');
        }
        
        // ✅ CORREÇÃO: Só usar mediaData se o buffer resultante for válido (> 100 bytes)
        if (tempBuffer && tempBuffer.length >= 100) {
          buffer = tempBuffer;
          console.log(`✅ [WPPCONNECT] Usando mediaData (base64) para mensagem própria - ${buffer.length} bytes`);
        } else if (tempBuffer && tempBuffer.length < 100) {
          console.warn(`⚠️ [WPPCONNECT] mediaData muito pequeno (${tempBuffer.length} bytes) - ignorando. Provavelmente dados inválidos.`);
        } else {
          console.warn(`⚠️ [WPPCONNECT] mediaData não pôde ser convertido para buffer válido`);
        }
      } catch (error) {
        console.error(`❌ [WPPCONNECT] Erro ao decodificar mediaData:`, error);
        console.error(`❌ [WPPCONNECT] Tipo de mediaData:`, typeof wppMessage.mediaData);
        console.error(`❌ [WPPCONNECT] mediaData value:`, wppMessage.mediaData);
      }
    }
    
    // ✅ NOVO: Tentar usar o client do WPPConnect para baixar mídia se URL não estiver disponível
    // ✅ MELHORADO: Priorizar download via client para mensagens próprias (fromMe: true)
    // ✅ CORREÇÃO: Tentar baixar via client se buffer é muito pequeno (< 100 bytes) ou não existe
    if ((!buffer || (buffer && buffer.length < 100)) && client && wppMessage.id) {
      try {
        console.log(`📥 [WPPCONNECT] Tentando baixar mídia usando client WPPConnect para mensagem ${wppMessage.id} (fromMe: ${wppMessage.fromMe || false})`);
        
        // Tentar diferentes métodos do WPPConnect para baixar mídia
        let mediaData = null;
        
        // Método 1: downloadMedia (método mais comum)
        if (typeof client.downloadMedia === 'function') {
          try {
            mediaData = await client.downloadMedia(wppMessage.id);
            console.log(`📥 [WPPCONNECT] downloadMedia retornou:`, {
              hasData: !!mediaData?.data,
              dataType: typeof mediaData?.data,
              dataLength: mediaData?.data?.length || 0
            });
          } catch (downloadError) {
            console.warn(`⚠️ [WPPCONNECT] Erro ao usar downloadMedia:`, downloadError.message);
          }
        }
        
        // Método 2: getMediaFromMessage (alternativa)
        if (!mediaData && typeof client.getMediaFromMessage === 'function') {
          try {
            mediaData = await client.getMediaFromMessage(wppMessage);
            console.log(`📥 [WPPCONNECT] getMediaFromMessage retornou:`, {
              hasData: !!mediaData?.data,
              dataType: typeof mediaData?.data,
              dataLength: mediaData?.data?.length || 0
            });
          } catch (getMediaError) {
            console.warn(`⚠️ [WPPCONNECT] Erro ao usar getMediaFromMessage:`, getMediaError.message);
          }
        }
        
        // Método 3: Tentar usar getMessageById e depois downloadMedia
        if (!mediaData && typeof client.getMessageById === 'function' && typeof client.downloadMedia === 'function') {
          try {
            const fullMessage = await client.getMessageById(wppMessage.id);
            if (fullMessage && fullMessage.id) {
              mediaData = await client.downloadMedia(fullMessage.id);
              console.log(`📥 [WPPCONNECT] downloadMedia via getMessageById retornou:`, {
                hasData: !!mediaData?.data,
                dataType: typeof mediaData?.data,
                dataLength: mediaData?.data?.length || 0
              });
            }
          } catch (getMessageError) {
            console.warn(`⚠️ [WPPCONNECT] Erro ao usar getMessageById + downloadMedia:`, getMessageError.message);
          }
        }
        
        // Processar dados obtidos
          if (mediaData && mediaData.data) {
          if (typeof mediaData.data === 'string') {
            // É uma string base64
            const base64String = mediaData.data.includes(',') 
              ? mediaData.data.split(',')[1] 
              : mediaData.data;
            buffer = Buffer.from(base64String, 'base64');
            console.log(`✅ [WPPCONNECT] Mídia baixada via client (base64) - ${buffer.length} bytes`);
          } else if (Buffer.isBuffer(mediaData.data)) {
            // Já é um Buffer
            buffer = mediaData.data;
            console.log(`✅ [WPPCONNECT] Mídia baixada via client (Buffer) - ${buffer.length} bytes`);
          }
        }
      } catch (clientError) {
        console.error(`❌ [WPPCONNECT] Erro ao baixar mídia via client:`, clientError);
        console.error(`❌ [WPPCONNECT] Stack trace:`, clientError.stack);
      }
    }

    // Criar diretório para o chat
    const uploadDir = path.join(__dirname, '..', 'uploads', chatId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ✅ CORREÇÃO: Baixar mídia apenas se não tiver buffer (de mediaData) e URL for válida
    if (!buffer && isValidUrl) {
      try {
        console.log(`📥 [WPPCONNECT] Baixando mídia da URL: ${mediaUrl.substring(0, 100)}...`);
        const response = await axios.get(mediaUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000, // 30 segundos de timeout
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400
        });
        buffer = Buffer.from(response.data);
        console.log(`✅ [WPPCONNECT] Mídia baixada da URL - ${buffer.length} bytes`);
      } catch (error) {
        console.error(`❌ [WPPCONNECT] Erro ao baixar mídia da URL:`, error.message);
        console.error(`❌ [WPPCONNECT] URL:`, mediaUrl);
        // Não retornar erro imediatamente, tentar outras opções
      }
    }
    
    // ✅ CORREÇÃO: Verificar se o buffer é válido (não muito pequeno - menos de 100 bytes indica dados inválidos)
    if (!buffer || (buffer && buffer.length < 100)) {
      console.warn(`⚠️ [WPPCONNECT] Não foi possível obter dados válidos da mídia.`, {
        tipo: mediaType,
        urlValida: isValidUrl,
        temMediaData: !!wppMessage.mediaData,
        bufferLength: buffer?.length || 0,
        messageId: wppMessage.id,
        fromMe: wppMessage.fromMe || false
      });
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: `❌ Não foi possível baixar a mídia. Tipo: ${wppMessage.type || 'desconhecido'}`,
        localPath: null
      };
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = wppMessage.filename ? path.extname(wppMessage.filename) : getExtensionFromMimeType(wppMessage.mimetype);
    const uniqueFileName = `file-${timestamp}-${randomId}${extension}`;
    const localPath = path.join(uploadDir, uniqueFileName);

    // Salvar arquivo
    fs.writeFileSync(localPath, buffer);

    console.log(`✅ [WPPCONNECT] Mídia salva: ${localPath} (${mediaType}, ${buffer.length} bytes)`);

    return {
      mediaType,
      mediaUrl: `/uploads/${chatId}/${uniqueFileName}`,
      fileName: wppMessage.filename || uniqueFileName,
      mimeType: wppMessage.mimetype || 'application/octet-stream',
      fileSize: buffer.length,
      caption: wppMessage.caption || '',
      localPath
    };

  } catch (error) {
    console.error(`❌ Erro ao baixar mídia WPPConnect:`, error);
    console.error(`❌ Stack trace:`, error.stack);
    return {
      mediaType: 'text',
      mediaUrl: null,
      fileName: null,
      mimeType: null,
      fileSize: null,
      caption: `❌ Erro ao baixar mídia: ${error.message}`,
      localPath: null
    };
  }
};

// ✅ Função auxiliar já definida acima (removida duplicata)

// ✅ Processar mensagens recebidas via WPPConnect (usando mesma lógica do Baileys)
const handleWPPConnectMessage = async (wppMessage, accountId, accountName, client) => {
  try {
    console.log(`📨 [${accountName}] handleWPPConnectMessage chamado:`, {
      from: wppMessage.from,
      fromMe: wppMessage.fromMe,
      type: wppMessage.type,
      hasMedia: !!wppMessage.mediaUrl || !!wppMessage.mediaData
    });

    // ✅ CORREÇÃO: Processar mensagens próprias também (incluindo áudios enviados)
    // Não ignorar mais mensagens próprias - elas precisam ser salvas no banco

    // Ignorar mensagens de status
    if (wppMessage.from === 'status@broadcast' || wppMessage.from === 'status') {
      console.log(`⏭️ [${accountName}] Ignorando mensagem de status`);
      return;
    }

    // Converter formato WPPConnect para formato Baileys
    const convertedMessage = convertWPPConnectToBaileysFormat(wppMessage);
    // Preservar mensagem original para download de mídia
    convertedMessage._wppOriginal = wppMessage;

    console.log(`🔄 [${accountName}] Mensagem convertida, processando...`);
    // ✅ Processar mensagem usando a mesma lógica do Baileys
    await processWPPConnectReceivedMessage(convertedMessage, accountId, accountName, client);

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao processar mensagem WPPConnect:`, error);
    console.error(`❌ [${accountName}] Stack trace:`, error.stack);
  }
};

// ✅ Função para processar mensagem recebida (replicando lógica do Baileys)
const processWPPConnectReceivedMessage = async (message, accountId, accountName, client) => {
  try {
    const senderJid = message.key?.remoteJid;
    const isOwnMessage = message.key?.fromMe;
    const originalWppMessage = message._wppOriginal;

    // ✅ CORREÇÃO: Verificar se é mensagem de broadcast (lista de transmissão) - apenas se realmente for broadcast
    const isBroadcast = ((senderJid?.endsWith('@broadcast') && senderJid !== 'status@broadcast') ||
                        (originalWppMessage?.from?.endsWith('@broadcast') && originalWppMessage?.from !== 'status@broadcast')) &&
                        isOwnMessage; // Apenas mensagens próprias podem ser broadcast
    
    if (isBroadcast) {
      console.log(`📢 [${accountName}] Detectada mensagem de broadcast (WPPConnect): ${senderJid || originalWppMessage?.from}`);
      // Criar mock sock para saveBroadcastMessage
      const phoneNumber = await extractPhoneNumberFromWPPConnect(client, accountName);
      const mockSock = {
        user: { id: phoneNumber ? `${phoneNumber}@s.whatsapp.net` : await client.getHostDevice() },
        ev: { on: () => {}, off: () => {} } // Mock para eventos
      };
      const multiWhatsappModule = await import('./multiWhatsapp.js');
      if (multiWhatsappModule.saveBroadcastMessage) {
        await multiWhatsappModule.saveBroadcastMessage(message, accountId, accountName, mockSock);
      }
      return;
    }

    // ✅ Verificar se é mensagem de grupo
    if (isGroupChat(senderJid)) {
      console.log(`👥 [${accountName}] Detectada mensagem de grupo, processando...`);
      // Criar mock sock para processGroupMessage
      const phoneNumber = await extractPhoneNumberFromWPPConnect(client, accountName);
      const mockSock = {
        user: { id: phoneNumber ? `${phoneNumber}@s.whatsapp.net` : await client.getHostDevice() },
        sendMessage: async (jid, msg) => {
          if (typeof msg === 'string') {
            return await client.sendText(jid, msg);
          } else if (msg.text) {
            return await client.sendText(jid, msg.text);
          }
        }
      };
      await processGroupMessage(message, accountId, accountName, mockSock, io, downloadWPPConnectMedia);
      return;
    }

    // ✅ Processamento para mensagens individuais
    console.log(`📨 [${accountName}] Processando mensagem individual (própria: ${isOwnMessage})...`);

    // Buscar dados da conta
    const { data: accountData, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, organization_id')
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

    // ✅ Obter informações do contato
    let targetJid, contactInfo, phoneNumber, contactName;

    if (isOwnMessage) {
      targetJid = senderJid;
      // Para WPPConnect, obter informações do contato
      try {
        const contact = await client.getContact(targetJid);
        phoneNumber = targetJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        contactName = contact?.name || contact?.pushname || phoneNumber;
        contactInfo = {
          name: contactName,
          phoneNumber,
          profilePicture: null // WPPConnect pode ter método para obter foto
        };
      } catch (error) {
        phoneNumber = targetJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        contactName = phoneNumber;
        contactInfo = { name: contactName, phoneNumber, profilePicture: null };
      }
    } else {
      targetJid = senderJid;
      try {
        const contact = await client.getContact(targetJid);
        phoneNumber = targetJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        contactName = contact?.name || contact?.pushname || message.pushName || phoneNumber;
        contactInfo = {
          name: contactName,
          phoneNumber,
          profilePicture: null
        };
      } catch (error) {
        phoneNumber = targetJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        contactName = message.pushName || phoneNumber;
        contactInfo = { name: contactName, phoneNumber, profilePicture: null };
      }
    }

    // ✅ Buscar ou criar chat
    let { data: existingChat, error: chatError } = await supabase
      .from('chats')
      .select('id, name, avatar_url')
      .eq('whatsapp_jid', targetJid)
      .eq('assigned_agent_id', accountData.user_id)
      .eq('organization_id', accountData.organization_id)
      .maybeSingle();

    let chatId;
    if (existingChat) {
      chatId = existingChat.id;
      console.log(`📨 [${accountName}] Chat existente: ${chatId}`);

      // ✅ CORREÇÃO: Atualizar informações do contato se necessário
      // ✅ Atualizar nome apenas se:
      // 1. Tem um nome válido (não é apenas número)
      // 2. O nome mudou
      // 3. Não é mensagem própria (para evitar atualizar com nome do usuário)
      const hasValidName = contactInfo.name && 
                          contactInfo.name !== phoneNumber && 
                          !/^\d+$/.test(contactInfo.name.trim()) &&
                          !isOwnMessage;
      if (hasValidName && contactInfo.name !== existingChat.name) {
        console.log(`🔄 [${accountName}] Atualizando nome do chat: ${existingChat.name} → ${contactInfo.name}`);
        await supabase
          .from('chats')
          .update({
            name: contactInfo.name,
            avatar_url: contactInfo.profilePicture || existingChat.avatar_url,
            is_group: false
          })
          .eq('id', chatId);
      }
    } else {
      // ✅ CORREÇÃO: Ao criar chat novo ao receber mensagem do cliente
      // ✅ Usar nome do cliente se disponível e válido, senão usar número
      let finalChatName = phoneNumber; // Padrão: usar número
      
      if (contactInfo.name && 
          contactInfo.name !== phoneNumber && 
          !/^\d+$/.test(contactInfo.name.trim()) &&
          !isOwnMessage) { // ✅ Só usar nome se não for mensagem própria
        finalChatName = contactInfo.name;
        console.log(`✅ [${accountName}] Usando nome do cliente: ${finalChatName}`);
      } else {
        console.log(`📱 [${accountName}] Usando número do cliente: ${finalChatName} (nome será atualizado quando disponível)`);
      }
      
      // Criar novo chat
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

    // ✅ Processar mídia (usando função adaptada para WPPConnect)
    // Converter mensagem WPPConnect de volta para obter dados originais
    // Usar a variável originalWppMessage já declarada no início da função, ou usar message diretamente
    const wppMessageForMedia = message._wppOriginal || message;
    const mediaInfo = await downloadWPPConnectMedia(wppMessageForMedia, chatId, client);

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

    // ✅ Processar resposta de campanha se for mensagem recebida e tiver conteúdo de texto
    if (!isOwnMessage && messageContent && messageContent.trim() !== '') {
      try {
        const phoneNumber = targetJid.split('@')[0];
        const { data: campanhaContato } = await supabase
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
          .eq('status', 'enviado')
          .order('enviado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (campanhaContato && campanhaContato.campanha) {
          const CampanhaService = (await import('./campanhaService.js')).default;
          await CampanhaService.processarRespostaCliente(
            campanhaContato.campanha_id,
            campanhaContato.id,
            messageContent
          );
          console.log(`✅ [${accountName}] Resposta de campanha processada`);
        }
      } catch (campanhaProcessError) {
        console.error(`⚠️ [${accountName}] Erro ao processar resposta de campanha:`, campanhaProcessError);
      }
    }

    // ✅ Salvar mensagem no banco (mesma estrutura do Baileys)
    const hostDevice = await client.getHostDevice();
    // ✅ CORREÇÃO: Garantir que o tipo de mídia seja preservado mesmo se não houver URL
    const finalMessageType = mediaInfo.mediaType !== 'text' ? mediaInfo.mediaType : 
                            (wppMessageForMedia.type === 'sticker' ? 'sticker' :
                            wppMessageForMedia.type === 'image' ? 'image' :
                            wppMessageForMedia.type === 'video' ? 'video' :
                            wppMessageForMedia.type === 'audio' ? 'audio' :
                            wppMessageForMedia.type === 'document' ? 'file' : 'text');
    
    const whatsappMessageId = message.key?.id;
    
    // ✅ CORREÇÃO: Para mensagens próprias enviadas, verificar se já existe uma mensagem no banco
    // Isso evita duplicatas quando o evento 'onMessage' captura mensagens que já foram salvas
    let savedMessage = null;
    let messagePayload = null;
    
    if (isOwnMessage && whatsappMessageId) {
      // Verificar se já existe uma mensagem com este whatsapp_message_id
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id, whatsapp_message_id, status')
        .eq('whatsapp_message_id', whatsappMessageId)
        .eq('chat_id', chatId)
        .eq('is_from_me', true)
        .maybeSingle();
      
      if (existingMessage) {
        // Atualizar mensagem existente com informações completas
        const updatePayload = {
          status: 'sent',
          content: messageContent,
          message_type: finalMessageType,
          media_url: mediaInfo.mediaUrl,
          sender_name: accountName,
          sender_jid: hostDevice?.id,
          message_object: message.message,
          message_key: message.key,
          metadata: {
            ...mediaInfo,
            is_group_message: false,
            is_own_message: true,
            target_jid: targetJid,
            received_at: new Date().toISOString(),
            push_name: message.pushName,
            timestamp: message.messageTimestamp,
            original_type: wppMessageForMedia.type,
            original_mimetype: wppMessageForMedia.mimetype,
            download_failed: !mediaInfo.mediaUrl && finalMessageType !== 'text'
          }
        };
        
        const { data: updatedMessage, error: updateError } = await supabase
          .from('messages')
          .update(updatePayload)
          .eq('id', existingMessage.id)
          .select('id')
          .single();
        
        if (updateError) {
          console.error(`❌ [${accountName}] Erro ao atualizar mensagem existente:`, updateError);
        } else {
          savedMessage = updatedMessage;
          messagePayload = {
            chat_id: chatId,
            content: messageContent,
            message_type: finalMessageType,
            media_url: mediaInfo.mediaUrl,
            is_from_me: true,
            sender_name: accountName,
            sender_jid: hostDevice?.id,
            status: 'sent',
            whatsapp_message_id: whatsappMessageId,
            organization_id: accountData.organization_id,
            user_id: accountData.user_id,
            message_object: message.message,
            message_key: message.key,
            metadata: updatePayload.metadata
          };
          console.log(`✅ [${accountName}] Mensagem atualizada: ${savedMessage.id} (própria: ${isOwnMessage}, tipo: ${finalMessageType})`);
        }
      }
    }
    
    // Se não encontrou mensagem existente, inserir nova
    if (!savedMessage) {
      messagePayload = {
        chat_id: chatId,
        content: messageContent,
        message_type: finalMessageType,
        media_url: mediaInfo.mediaUrl,
        is_from_me: isOwnMessage,
        sender_name: isOwnMessage ? accountName : contactName,
        sender_jid: isOwnMessage ? hostDevice?.id : targetJid,
        status: isOwnMessage ? 'sent' : 'received',
        whatsapp_message_id: whatsappMessageId,
        organization_id: accountData.organization_id,
        user_id: accountData.user_id,
        message_object: message.message,
        message_key: message.key,
        metadata: {
          ...mediaInfo,
          is_group_message: false,
          is_own_message: isOwnMessage,
          target_jid: targetJid,
          received_at: new Date().toISOString(),
          push_name: message.pushName,
          timestamp: message.messageTimestamp,
          // ✅ NOVO: Preservar informações originais da mídia mesmo se não foi possível baixar
          original_type: wppMessageForMedia.type,
          original_mimetype: wppMessageForMedia.mimetype,
          download_failed: !mediaInfo.mediaUrl && finalMessageType !== 'text'
        }
      };

      const { data: insertedMessage, error: messageError } = await supabase
        .from('messages')
        .insert(messagePayload)
        .select('id')
        .single();

      if (messageError) {
        // ✅ CORREÇÃO: Se for erro de duplicata, tentar atualizar mensagem existente
        if (messageError.code === '23505' || messageError.message?.includes('duplicate') || messageError.message?.includes('unique')) {
          console.log(`⚠️ [${accountName}] Mensagem duplicada detectada, tentando atualizar...`);
          
          // Buscar mensagem existente por conteúdo e chat
          const { data: existingByContent } = await supabase
            .from('messages')
            .select('id')
            .eq('chat_id', chatId)
            .eq('content', messageContent)
            .eq('is_from_me', true)
            .eq('status', 'sending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (existingByContent) {
            const { data: updatedMessage, error: updateError } = await supabase
              .from('messages')
              .update({
                status: 'sent',
                whatsapp_message_id: whatsappMessageId,
                message_type: finalMessageType,
                media_url: mediaInfo.mediaUrl,
                message_object: message.message,
                message_key: message.key,
                metadata: {
                  ...mediaInfo,
                  is_group_message: false,
                  is_own_message: true,
                  target_jid: targetJid,
                  received_at: new Date().toISOString(),
                  push_name: message.pushName,
                  timestamp: message.messageTimestamp,
                  original_type: wppMessageForMedia.type,
                  original_mimetype: wppMessageForMedia.mimetype,
                  download_failed: !mediaInfo.mediaUrl && finalMessageType !== 'text'
                }
              })
              .eq('id', existingByContent.id)
              .select('id')
              .single();
            
            if (!updateError && updatedMessage) {
              savedMessage = updatedMessage;
              messagePayload = {
                chat_id: chatId,
                content: messageContent,
                message_type: finalMessageType,
                media_url: mediaInfo.mediaUrl,
                is_from_me: true,
                sender_name: accountName,
                sender_jid: hostDevice?.id,
                status: 'sent',
                whatsapp_message_id: whatsappMessageId,
                organization_id: accountData.organization_id,
                user_id: accountData.user_id,
                message_object: message.message,
                message_key: message.key,
                metadata: {
                  ...mediaInfo,
                  is_group_message: false,
                  is_own_message: true,
                  target_jid: targetJid,
                  received_at: new Date().toISOString(),
                  push_name: message.pushName,
                  timestamp: message.messageTimestamp,
                  original_type: wppMessageForMedia.type,
                  original_mimetype: wppMessageForMedia.mimetype,
                  download_failed: !mediaInfo.mediaUrl && finalMessageType !== 'text'
                }
              };
              console.log(`✅ [${accountName}] Mensagem duplicada atualizada: ${savedMessage.id}`);
            } else {
              console.error(`❌ [${accountName}] Erro ao atualizar mensagem duplicada:`, updateError);
            }
          } else {
            console.error(`❌ [${accountName}] Erro ao salvar mensagem (duplicata não encontrada para atualizar):`, messageError);
          }
        } else {
          console.error(`❌ [${accountName}] Erro ao salvar mensagem:`, messageError);
        }
        
        if (!savedMessage) {
          return; // Não continuar se não conseguiu salvar
        }
      } else {
        savedMessage = insertedMessage;
        console.log(`✅ [${accountName}] Mensagem salva: ${savedMessage.id} (própria: ${isOwnMessage}, tipo: ${finalMessageType})`);
      }
    }

    // ✅ NOVO: Transcrever áudio automaticamente se for mensagem de áudio (recebidas E enviadas)
    if (mediaInfo.mediaType === 'audio' && mediaInfo.localPath) {
      try {
        const multiWhatsappModule = await import('./multiWhatsapp.js');
        if (multiWhatsappModule.transcribeAudioAutomatically) {
          multiWhatsappModule.transcribeAudioAutomatically(savedMessage.id, mediaInfo.localPath, accountData.organization_id, accountName)
            .catch(error => {
              console.error(`❌ [${accountName}] Erro ao transcrever áudio automaticamente:`, error);
            });
        }
      } catch (importError) {
        console.warn(`⚠️ [${accountName}] Não foi possível importar função de transcrição:`, importError.message);
      }
    }

    // ✅ Processar regras de monitoramento
    try {
      if (messagePayload) {
        await processMessageForRules({
          id: savedMessage.id,
          chat_id: chatId,
          content: messageContent,
          created_at: messagePayload.created_at || new Date().toISOString(),
          sender_name: messagePayload.sender_name,
          organization_id: accountData.organization_id
        });
      } else {
        console.warn(`⚠️ [${accountName}] messagePayload ausente ao processar regras`);
      }
    } catch (rulesError) {
      console.warn(`⚠️ [${accountName}] Erro ao processar regras:`, rulesError.message);
    }

    // ✅ Emitir evento para frontend
    if (io) {
      io.to(`org_${accountData.organization_id}`).emit('new-message', {
        message: {
          ...messagePayload,
          id: savedMessage.id
        },
        chat_id: chatId,
        is_broadcast: false,
        is_group: false,
        is_own_message: isOwnMessage
      });
    }

    // ✅ Processar com fluxo e IA (apenas para mensagens recebidas)
    if (!isOwnMessage) {
      let flowProcessed = false;

      try {
        const { data: activeFlow } = await supabase
          .from('fluxos')
          .select('*')
          .eq('organization_id', accountData.organization_id)
          .eq('ativo', true)
          .eq('canal', 'whatsapp')
          .maybeSingle();

        if (activeFlow) {
          const flowUserId = phoneNumber || targetJid.replace('@s.whatsapp.net', '');
          
          // Criar mock sock para executeFlowSimple
          const mockSock = {
            user: { id: hostDevice?.id },
            sendMessage: async (jid, msg) => {
              if (typeof msg === 'string') {
                return await client.sendText(jid, msg);
              } else if (msg.text) {
                return await client.sendText(jid, msg.text);
              } else if (msg.image) {
                return await client.sendImage(jid, msg.image);
              }
            }
          };

          const flowResponse = await executeFlowSimple({
            accountId,
            fromJid: targetJid,
            message: messageContent,
            flow: activeFlow,
            sock: mockSock,
            chatId,
            userId: flowUserId,
            organizationId: accountData.organization_id,
            mediaInfo,
            accountData,
            whatsapp_Id: accountId
          });

          if (flowResponse && flowResponse.text) {
            await client.sendText(targetJid, flowResponse.text);
            flowProcessed = true;
          }
        }
      } catch (flowError) {
        console.error(`❌ [FLOW] Erro ao processar fluxo:`, flowError);
      }

      // Se o fluxo não processou, processar com IA
      if (!flowProcessed) {
        try {
          const mockSock = {
            user: { id: hostDevice?.id },
            sendMessage: async (jid, msg) => {
              if (typeof msg === 'string') {
                return await client.sendText(jid, msg);
              } else if (msg.text) {
                return await client.sendText(jid, msg.text);
              }
            }
          };

          await processMessageWithAI(
            accountId,
            targetJid,
            messageContent,
            mockSock,
            message,
            accountData.organization_id,
            mediaInfo,
            false
          );
        } catch (aiError) {
          console.warn(`⚠️ [${accountName}] Erro ao processar com IA:`, aiError.message);
        }
      }
    }

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao processar mensagem recebida:`, error);
  }
};

// ✅ Função pública para criar conexão
export const createWhatsAppConnection = async (accountId, accountName, shouldGenerateQr = true, options = {}) => {
  return await createWPPConnectSession(accountId, accountName, shouldGenerateQr, options);
};

// ✅ Função para desconectar
export const disconnectWhatsAppAccount = async (accountId) => {
  try {
    const connection = activeConnections.get(accountId);
    if (connection && connection.client) {
      try {
        // Tentar fazer logout do cliente WPPConnect
        await connection.client.logout();
      } catch (logoutError) {
        console.warn(`⚠️ Erro ao fazer logout WPPConnect (continuando desconexão):`, logoutError.message);
      }
      
      activeConnections.delete(accountId);
    }

    // ✅ NOVO: Limpar diretório de tokens para forçar novo QR code na próxima conexão
    await cleanupWPPConnectTokens(accountId);

    // ✅ CORREÇÃO: Sempre atualizar status no banco, mesmo se não houver conexão ativa
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
        console.error(`❌ [WPPConnect] Erro ao atualizar whatsapp_accounts para ${accountId}:`, updateError);
      } else {
        console.log(`✅ [WPPConnect] whatsapp_accounts atualizada para ${accountId} (disconnected)`);
      }
    } catch (dbError) {
      console.error(`❌ [WPPConnect] Erro ao atualizar whatsapp_accounts para ${accountId}:`, dbError);
    }

    // ✅ NOVO: Emitir evento de desconexão via Socket.IO
    try {
      const { data: accountInfo } = await supabase
        .from('whatsapp_accounts')
        .select('organization_id, name')
        .eq('account_id', accountId)
        .maybeSingle();

      if (accountInfo && accountInfo.organization_id && io) {
        io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-disconnected', {
          accountId,
          accountName: accountInfo.name || accountId,
          reason: 'Desconexão manual',
          attemptCount: 0
        });
        console.log(`📡 [WPPConnect] Evento de desconexão emitido para organização ${accountInfo.organization_id}`);
      }
    } catch (emitError) {
      console.warn(`⚠️ [WPPConnect] Erro ao emitir evento de desconexão:`, emitError.message);
    }

    return { success: true, message: 'Desconectado com sucesso' };
  } catch (error) {
    console.error(`❌ [WPPConnect] Erro ao desconectar:`, error);
    return { success: false, error: error.message };
  }
};

// ✅ Função para enviar mensagem (compatível com Baileys)
export const sendMessageByAccount = async (accountId, to, message, replyTo = null, originalMessageObject = null, originalMessageKey = null, originalMessageContent = null, originalMessageIsFromMe = false, originalSenderJid = null) => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.client) {
      throw new Error('Conexão não encontrada');
    }

    const client = connection.client;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    let result;

    if (replyTo && originalMessageKey) {
      // Enviar com resposta
      result = await client.reply(jid, message, replyTo);
    } else {
      result = await client.sendText(jid, message);
    }

    return {
      success: true,
      message: 'Mensagem enviada com sucesso',
      whatsapp_message_id: result?.id || result?.messageId || null
    };
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem:`, error);
    return { success: false, error: error.message };
  }
};

// ✅ Enviar imagem por conta específica (compatível com Baileys)
export const sendImageByAccount = async (accountId, to, imagePath, caption = '') => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.client) {
      throw new Error('Conta não conectada');
    }
    
    const client = connection.client;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const buffer = fs.readFileSync(imagePath);
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    
    const result = await client.sendImage(jid, buffer.toString('base64'), 'image', safeCaption);
    
    return {
      success: true,
      message: 'Imagem enviada com sucesso',
      whatsapp_message_id: result?.id || result?.messageId || null
    };
  } catch (error) {
    console.error('❌ Erro ao enviar imagem:', error);
    return { success: false, error: error.message };
  }
};

// ✅ Enviar documento por conta específica (compatível com Baileys)
export const sendDocumentByAccount = async (accountId, to, filePath, mimetype = '', filename = '', caption = '') => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.client) {
      throw new Error('Conta não conectada');
    }
    
    const client = connection.client;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const buffer = fs.readFileSync(filePath);
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    
    const result = await client.sendFile(jid, buffer.toString('base64'), filename || path.basename(filePath), safeCaption);
    
    return {
      success: true,
      message: 'Documento enviado com sucesso',
      whatsapp_message_id: result?.id || result?.messageId || null
    };
  } catch (error) {
    console.error('❌ Erro ao enviar documento:', error);
    return { success: false, error: error.message };
  }
};

// ✅ Enviar áudio por conta específica (compatível com Baileys)
export const sendAudioByAccount = async (accountId, to, audioPath, mimetype = 'audio/webm', caption = '') => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.client) {
      throw new Error('Conta não conectada');
    }
    
    const client = connection.client;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const buffer = fs.readFileSync(audioPath);
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    
    const result = await client.sendPtt(jid, buffer.toString('base64'), safeCaption);
    
    return {
      success: true,
      message: 'Áudio enviado com sucesso',
      whatsapp_message_id: result?.id || result?.messageId || null
    };
  } catch (error) {
    console.error('❌ Erro ao enviar áudio:', error);
    return { success: false, error: error.message };
  }
};

// ✅ Enviar mensagem de grupo (compatível com Baileys)
export const sendGroupMessageByAccount = async (accountId, groupJid, message, replyTo = null) => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.client) {
      throw new Error('Conta não conectada');
    }
    
    const client = connection.client;
    let result;
    
    if (replyTo) {
      result = await client.reply(groupJid, message, replyTo);
    } else {
      result = await client.sendText(groupJid, message);
    }
    
    return {
      success: true,
      message: 'Mensagem de grupo enviada com sucesso',
      whatsapp_message_id: result?.id || result?.messageId || null
    };
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem de grupo:', error);
    return { success: false, error: error.message };
  }
};

// ✅ Função para obter status da conexão
export const getConnectionStatus = (accountId) => {
  const connection = activeConnections.get(accountId);
  if (!connection) {
    return { status: 'disconnected', connected: false };
  }

  const isConnected = connection.client?.isConnected() || false;
  return {
    status: connection.status || 'disconnected',
    connected: isConnected,
    accountName: connection.accountName
  };
};

// ✅ Função para obter todas as conexões
export const getAllConnectionsStatus = () => {
  const statuses = {};
  activeConnections.forEach((connection, accountId) => {
    statuses[accountId] = getConnectionStatus(accountId);
  });
  return statuses;
};

// ✅ Inicializar Socket.IO
export const initializeWPPConnect = (socketIO) => {
  io = socketIO;
  console.log('✅ WPPConnect inicializado com Socket.IO');
};

// ✅ Obter lista de grupos (compatível com Baileys)
export const getGroupsListByAccount = async (accountId) => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.client) {
      throw new Error('Conta não conectada');
    }
    
    const client = connection.client;
    const groups = await client.getAllGroups();
    
    return {
      success: true,
      groups: groups || []
    };
  } catch (error) {
    console.error('❌ Erro ao obter lista de grupos:', error);
    return { success: false, error: error.message, groups: [] };
  }
};

// ✅ Exportar conexões ativas (para compatibilidade)
export { activeConnections };

