// ✅ NOVO: Serviço whatsapp-web.js para conexões WhatsApp
// Nota: whatsapp-web.js usa uma API diferente, mas processa mensagens da mesma forma
// ✅ CORREÇÃO: Importação correta para módulo CommonJS
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
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
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Manter instâncias ativas das conexões
const activeConnections = new Map();
let io;

// ✅ Sistema de monitoramento de saúde (mesmo do Baileys)
const connectionHealthMonitor = new Map();
const HEARTBEAT_INTERVAL = 600000; // 10 minutos

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

// ✅ Função para criar agent de proxy
const createProxyAgent = (proxyUrl) => {
  if (!proxyUrl) return undefined;

  try {
    if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  } catch (error) {
    console.error(`❌ [PROXY] Erro ao criar agent de proxy: ${error.message}`);
    return undefined;
  }
};

// ✅ Função para criar conexão whatsapp-web.js
const createWhatsAppWebSession = async (accountId, accountName, shouldGenerateQr = true, options = {}) => {
  const source = options?.source || 'auto';
  const organizationId = options?.organizationId;
  const userId = options?.userId || null; // ✅ NOVO: Obter userId das opções
  try {
    // ✅ NOVO: Se for conexão manual, sempre encerrar conexão existente e gerar novo QR
    if (source === 'manual') {
      console.log(`🔄 [${accountName}] Conexão manual detectada - encerrando conexão existente...`);
      
      const existingConnection = activeConnections.get(accountId);
      if (existingConnection && existingConnection.client) {
        try {
          console.log(`🔄 [${accountName}] Fechando cliente whatsapp-web.js existente...`);
          await existingConnection.client.destroy();
          // Aguardar para garantir que o browser foi fechado
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log(`✅ [${accountName}] Cliente existente fechado`);
        } catch (closeError) {
          console.warn(`⚠️ [${accountName}] Erro ao fechar cliente existente:`, closeError.message);
        }
      }
      
      // Remover da lista de conexões ativas
      activeConnections.delete(accountId);
      
      // Limpar diretório de sessão para forçar novo QR code
      const sessionDir = path.join(__dirname, '../whatsapp-web-sessions', accountId);
      if (fs.existsSync(sessionDir)) {
        try {
          console.log(`🗑️ [${accountName}] Limpando diretório de sessão para gerar novo QR code...`);
          console.log(`🗑️ [${accountName}] Diretório: ${sessionDir}`);
          
          // Listar arquivos antes de limpar
          const files = fs.readdirSync(sessionDir);
          console.log(`🗑️ [${accountName}] Arquivos encontrados na sessão:`, files);
          
          fs.rmSync(sessionDir, { recursive: true, force: true });
          console.log(`✅ [${accountName}] Diretório de sessão limpo`);
          
          // Verificar se foi realmente limpo
          if (fs.existsSync(sessionDir)) {
            console.warn(`⚠️ [${accountName}] Diretório ainda existe após limpeza!`);
          } else {
            console.log(`✅ [${accountName}] Diretório confirmado como removido`);
          }
        } catch (cleanError) {
          console.warn(`⚠️ [${accountName}] Erro ao limpar sessão (continuando mesmo assim):`, cleanError.message);
          console.warn(`⚠️ [${accountName}] Stack trace:`, cleanError.stack);
        }
      } else {
        console.log(`ℹ️ [${accountName}] Diretório de sessão não existe: ${sessionDir}`);
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
          const client = existingConnection.client;
          isClientConnected = client.info && (client.info.wid || client.info.wid?.user) || false;
        } catch (error) {
          console.warn(`⚠️ [${accountName}] Erro ao verificar isReady():`, error.message);
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
              await existingConnection.client.destroy();
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
    const sessionDir = path.join(__dirname, '../whatsapp-web-sessions', accountId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Configurações do whatsapp-web.js
    const puppeteerOptions = {
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
    };

    // ✅ Adicionar proxy se fornecido
    // NOTA: Puppeteer só suporta proxies HTTP/HTTPS
    // Proxies SOCKS não são suportados diretamente pelo Puppeteer
    if (proxy) {
      // Verificar se é proxy HTTP/HTTPS (suportado pelo Puppeteer)
      if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
        // Formatar proxy corretamente: remover protocolo para proxyServer
        const proxyServer = proxy.replace(/^https?:\/\//, '');
        // Usar propriedade proxyServer diretamente (recomendado pelo Puppeteer)
        puppeteerOptions.proxyServer = `http://${proxyServer}`;
        // Também adicionar como argumento para compatibilidade
        puppeteerOptions.args.push(`--proxy-server=http://${proxyServer}`);
        console.log(`🔐 [${accountName}] Proxy HTTP/HTTPS configurado: ${proxyServer.replace(/:[^:@]+@/, ':****@')}`);
      } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
        // Proxies SOCKS não são suportados pelo Puppeteer
        console.warn(`⚠️ [${accountName}] Proxy SOCKS não é suportado pelo Puppeteer/whatsapp-web.js. Use proxy HTTP/HTTPS.`);
        // Não adicionar proxy - continuar sem proxy
      } else {
        // Tentar como HTTP se não especificar protocolo
        console.log(`🔐 [${accountName}] Assumindo proxy como HTTP: ${proxy}`);
        puppeteerOptions.proxyServer = `http://${proxy}`;
        puppeteerOptions.args.push(`--proxy-server=http://${proxy}`);
      }
    }

    const clientOptions = {
      authStrategy: new LocalAuth({
        clientId: accountId,
        dataPath: sessionDir
      }),
      puppeteer: puppeteerOptions
    };

    // Criar cliente whatsapp-web.js
    console.log(`📱 [${accountName}] Criando sessão whatsapp-web.js...`);
    const client = new Client(clientOptions);

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
      reconnectEmailSent: false
    });

    // ✅ Configurar eventos
    console.log(`📡 [${accountName}] Configurando eventos do whatsapp-web.js...`);
    await setupWhatsAppWebEvents(client, accountId, accountName, shouldGenerateQr);
    console.log(`✅ [${accountName}] Eventos configurados com sucesso`);

    // ✅ Pequeno delay para garantir que os listeners estão totalmente configurados
    await new Promise(resolve => setTimeout(resolve, 500));

    // Inicializar cliente (deve ser chamado após configurar eventos)
    console.log(`🚀 [${accountName}] Inicializando cliente whatsapp-web.js...`);
    try {
      await client.initialize();
      console.log(`✅ [${accountName}] Cliente inicializado - aguardando QR code ou conexão...`);
      
      // ✅ Aguardar um pouco para ver se o QR code é emitido
      console.log(`⏳ [${accountName}] Aguardando 3 segundos para verificar se QR code será emitido...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // ✅ Verificar se há informações do cliente (com tratamento de erro para Target closed)
      try {
        // Verificar se o cliente ainda está válido antes de acessar info
        if (client && typeof client.info !== 'undefined') {
          const clientInfo = client.info;
          console.log(`ℹ️ [${accountName}] Informações do cliente após inicialização:`, {
            hasInfo: !!clientInfo,
            wid: clientInfo?.wid,
            isReady: client.info ? 'sim' : 'não'
          });
        } else {
          console.log(`ℹ️ [${accountName}] Cliente não tem informações disponíveis ainda`);
        }
      } catch (infoError) {
        // Ignorar erros de "Target closed" ao verificar informações
        if (infoError.message.includes('Target closed') || infoError.message.includes('Protocol error')) {
          console.warn(`⚠️ [${accountName}] Browser foi fechado durante verificação de informações`);
        } else {
          console.warn(`⚠️ [${accountName}] Erro ao obter informações do cliente:`, infoError.message);
        }
      }
    } catch (initError) {
      // ✅ Tratar erro "Target closed" especificamente
      if (initError.message.includes('Target closed') || 
          initError.message.includes('Protocol error') ||
          initError.message.includes('Runtime.callFunctionOn')) {
        console.error(`❌ [${accountName}] Erro: Browser foi fechado durante inicialização`);
        console.error(`❌ [${accountName}] Tentando limpar e recriar conexão...`);
        
        // Limpar conexão atual
        try {
          if (client) {
            await client.destroy().catch(() => {}); // Ignorar erros ao destruir
          }
        } catch (e) {
          // Ignorar erros
        }
        
        activeConnections.delete(accountId);
        
        // Aguardar um pouco antes de retornar erro
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return { 
          success: false, 
          error: 'Browser foi fechado durante inicialização. Tente novamente.' 
        };
      }
      // ✅ Se houver erro de proxy, tentar novamente sem proxy
      if (proxy && (initError.message.includes('ERR_NO_SUPPORTED_PROXIES') || 
                    initError.message.includes('proxy') || 
                    initError.message.includes('PROXY'))) {
        console.warn(`⚠️ [${accountName}] Erro com proxy, tentando sem proxy...`);
        
        // Limpar cliente anterior
        try {
          if (client) {
            await client.destroy().catch((destroyError) => {
              // Ignorar erros de "Target closed" ao destruir
              if (!destroyError.message.includes('Target closed') && 
                  !destroyError.message.includes('Protocol error')) {
                console.warn(`⚠️ [${accountName}] Erro ao destruir cliente anterior:`, destroyError.message);
              }
            });
            // Aguardar um pouco para garantir que o browser foi fechado
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (e) {
          // Ignorar erros ao destruir
          if (!e.message.includes('Target closed') && !e.message.includes('Protocol error')) {
            console.warn(`⚠️ [${accountName}] Erro ao destruir cliente:`, e.message);
          }
        }
        
        // Criar nova configuração sem proxy
        const clientOptionsNoProxy = {
          authStrategy: new LocalAuth({
            clientId: accountId,
            dataPath: sessionDir
          }),
          puppeteer: {
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
          }
        };
        
        const clientNoProxy = new Client(clientOptionsNoProxy);
        activeConnections.set(accountId, {
          client: clientNoProxy,
          accountName,
          status: 'connecting',
          lastAttempt: Date.now(),
          attemptCount: 0,
          shouldGenerateQr,
          source,
          organizationId, // ✅ NOVO: Armazenar organizationId para uso ao emitir QR Code
          reconnectEmailSent: false
        });
        
        console.log(`📡 [${accountName}] Configurando eventos para cliente sem proxy...`);
        await setupWhatsAppWebEvents(clientNoProxy, accountId, accountName, shouldGenerateQr);
        
        // ✅ Pequeno delay para garantir que os listeners estão totalmente configurados
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log(`🚀 [${accountName}] Inicializando cliente whatsapp-web.js sem proxy...`);
        try {
          await clientNoProxy.initialize();
          console.log(`✅ [${accountName}] Cliente inicializado sem proxy - aguardando QR code...`);
          
          // ✅ Aguardar um pouco para ver se o QR code é emitido
          console.log(`⏳ [${accountName}] Aguardando 3 segundos para verificar se QR code será emitido...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // ✅ Verificar se há informações do cliente (com tratamento de erro para Target closed)
          try {
            if (clientNoProxy && typeof clientNoProxy.info !== 'undefined') {
              const clientInfo = clientNoProxy.info;
              console.log(`ℹ️ [${accountName}] Informações do cliente após inicialização:`, {
                hasInfo: !!clientInfo,
                wid: clientInfo?.wid,
                isReady: clientNoProxy.info ? 'sim' : 'não'
              });
            } else {
              console.log(`ℹ️ [${accountName}] Cliente sem proxy não tem informações disponíveis ainda`);
            }
          } catch (infoError) {
            // Ignorar erros de "Target closed" ao verificar informações
            if (infoError.message.includes('Target closed') || infoError.message.includes('Protocol error')) {
              console.warn(`⚠️ [${accountName}] Browser foi fechado durante verificação de informações`);
            } else {
              console.warn(`⚠️ [${accountName}] Erro ao obter informações do cliente:`, infoError.message);
            }
          }
        } catch (noProxyInitError) {
          // ✅ Tratar erro "Target closed" na inicialização sem proxy
          if (noProxyInitError.message.includes('Target closed') || 
              noProxyInitError.message.includes('Protocol error') ||
              noProxyInitError.message.includes('Runtime.callFunctionOn')) {
            console.error(`❌ [${accountName}] Erro: Browser foi fechado durante inicialização sem proxy`);
            
            // Limpar conexão
            try {
              if (clientNoProxy) {
                await clientNoProxy.destroy().catch(() => {});
              }
            } catch (e) {
              // Ignorar erros
            }
            
            activeConnections.delete(accountId);
            
            return { 
              success: false, 
              error: 'Browser foi fechado durante inicialização. Tente novamente em alguns segundos.' 
            };
          }
          // Relançar outros erros
          throw noProxyInitError;
        }
        
        return { success: true, message: 'Conexão whatsapp-web.js iniciada sem proxy (proxy falhou)' };
      }
      
      // Se não for erro de proxy, relançar o erro
      throw initError;
    }

    return { success: true, message: 'Conexão whatsapp-web.js iniciada com sucesso' };

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao criar sessão whatsapp-web.js:`, error);
    activeConnections.delete(accountId);
    return { success: false, error: error.message };
  }
};

// ✅ Função para atualizar status da conta (com throttle)
const updateAccountStatus = async (accountId, status) => {
  try {
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

// ✅ Função para processar QR code (mesma lógica do Baileys)
const handleWhatsAppWebQRCode = async (qrCode, accountId, accountName) => {
  // ✅ NOVO: Verificar se já está conectado ANTES de processar QR code
  const connectionData = activeConnections.get(accountId);
  if (connectionData && connectionData.status === 'connected') {
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
    // Continuar processamento se houver erro na verificação
  }

  // ✅ Throttle para evitar processar o mesmo QR code múltiplas vezes
  const cachedQR = qrCodeCache.get(accountId);
  const now = Date.now();

  if (cachedQR && (now - cachedQR.timestamp) < QR_CODE_THROTTLE && cachedQR.qr === qrCode) {
    return; // QR code já foi processado recentemente
  }

  console.log(`📱 [${accountName}] QR Code gerado (tamanho: ${qrCode?.length || 0} caracteres)`);

  try {
    if (!qrCode || typeof qrCode !== 'string') {
      console.error(`❌ [${accountName}] QR Code inválido:`, { type: typeof qrCode, value: qrCode });
      return;
    }
    
    console.log(`🔄 [${accountName}] Convertendo QR code para DataURL...`);

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
    const connectionData = activeConnections.get(accountId);
    if (connectionData && connectionData.organizationId) {
      console.log(`📋 [${accountName}] Usando organizationId da conexão ativa: ${connectionData.organizationId}`);
      accountData = { organization_id: connectionData.organizationId };
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
        organizationId: accountData?.organization_id,
        qrLength: qrString.length
      });

      // ✅ NOVO: Verificar se há userId na conexão para emitir apenas para o usuário específico
      // ✅ IMPORTANTE: Convites e conexões automáticas NÃO têm userId, então usam fallback para organização
      const connectionData = activeConnections.get(accountId);
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
      } else if (accountData && accountData.organization_id) {
        // ✅ FALLBACK: Se não houver userId OU for conexão automática/convite, emitir para organização
        // Isso garante compatibilidade com convites e conexões automáticas
        console.log(`📤 [${accountName}] 📢 Emitindo para organização ${accountData.organization_id} (${connectionData?.source || 'sem source'} - ${connectionUserId ? 'com userId mas não manual' : 'sem userId'})`);
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
      console.log(`✅ [${accountName}] QR Code emitido com sucesso`);
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

    // Configurar timer de expiração do QR (5 minutos)
    const connectionData = activeConnections.get(accountId);
    if (connectionData) {
      if (connectionData.qrTimer) clearTimeout(connectionData.qrTimer);
      
      connectionData.qrTimer = setTimeout(async () => {
        console.log(`⏰ [${accountName}] QR Code expirado (5 minutos)`);
        
        if (io && accountData) {
          io.to(`org_${accountData.organization_id}`).emit('whatsapp-qr-expired', {
            accountId,
            accountName,
            timestamp: Date.now()
          });
        }
        
        // ✅ NOVO: Verificar se já está conectado antes de gerar novo QR code
        setTimeout(async () => {
          try {
            const { data: accountData } = await supabase
              .from('whatsapp_accounts')
              .select('status, phone_number')
              .eq('account_id', accountId)
              .single();
            
            if (accountData?.status === 'connected' && accountData?.phone_number) {
              console.log(`⏸️ [${accountName}] Conta já está conectada - não gerando novo QR code após timeout`);
              return; // Não gerar novo QR code se já está conectado
            }
            
            await createWhatsAppWebSession(accountId, accountName, true, 'auto');
          } catch (error) {
            console.warn(`⚠️ [${accountName}] Erro ao verificar status antes de gerar novo QR:`, error.message);
            // Continuar gerando QR code se houver erro na verificação
            await createWhatsAppWebSession(accountId, accountName, true, 'auto');
          }
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

// ✅ Configurar eventos do whatsapp-web.js
const setupWhatsAppWebEvents = async (client, accountId, accountName, shouldGenerateQr) => {
  try {
    let connectionTimeout = null;
    
    // ✅ Evento de QR Code
    if (shouldGenerateQr) {
      console.log(`📡 [${accountName}] Configurando listener para evento 'qr' do whatsapp-web.js`);
      
      // ✅ Adicionar listener para todos os eventos para debug
      client.on('qr', async (qrCode) => {
        try {
          console.log(`📱 [${accountName}] ✅✅✅ Evento 'qr' recebido do whatsapp-web.js, processando...`);
          console.log(`📱 [${accountName}] QR Code recebido (tipo: ${typeof qrCode}, tamanho: ${qrCode?.length || 'N/A'})`);
          
          // ✅ NOVO: Verificar se já está conectado antes de processar QR code
          const connectionData = activeConnections.get(accountId);
          if (connectionData && connectionData.status === 'connected') {
            console.log(`⏸️ [${accountName}] QR code recebido via listener mas conta já está conectada - ignorando`);
            return; // Não processar QR code se já está conectado
          }
          
          await handleWhatsAppWebQRCode(qrCode, accountId, accountName);
        } catch (error) {
          console.error(`❌ [${accountName}] Erro ao processar QR Code (listener):`, error);
          console.error(`❌ [${accountName}] Stack trace:`, error.stack);
        }
      });
      
      // ✅ Adicionar listeners para outros eventos para debug
      client.on('authenticated', () => {
        console.log(`✅ [${accountName}] Cliente autenticado (evento 'authenticated')`);
      });
      
      client.on('auth_failure', (msg) => {
        console.log(`❌ [${accountName}] Falha na autenticação:`, msg);
      });
      
      client.on('loading_screen', (percent, message) => {
        console.log(`⏳ [${accountName}] Tela de carregamento: ${percent}% - ${message}`);
      });
      
      // ✅ Listener para qualquer erro
      client.on('error', (error) => {
        // Ignorar erros de "Target closed" que são comuns quando o browser é fechado
        if (error.message && (
          error.message.includes('Target closed') || 
          error.message.includes('Protocol error') ||
          error.message.includes('Runtime.callFunctionOn')
        )) {
          console.warn(`⚠️ [${accountName}] Browser foi fechado (erro ignorado):`, error.message);
        } else {
          console.error(`❌ [${accountName}] Erro no cliente whatsapp-web.js:`, error);
        }
      });
      
      console.log(`✅ [${accountName}] Listener para evento 'qr' configurado com sucesso`);
    } else {
      console.log(`⏭️ [${accountName}] shouldGenerateQr é false - não configurando listener de QR`);
    }

    // ✅ Evento de autenticação (ready)
    client.on('ready', async () => {
      try {
        console.log(`✅ [${accountName}] CONECTADO`);
        
        const connectionData = activeConnections.get(accountId);
        if (!connectionData) {
          console.warn(`⚠️ [${accountName}] Conexão não encontrada no evento 'ready'`);
          return;
        }

        connectionData.status = 'connected';
        connectionData.attemptCount = 0;
        connectionData.healthFailureCount = 0;
        
        // Limpar timers
        if (connectionData.qrTimer) {
          clearTimeout(connectionData.qrTimer);
          connectionData.qrTimer = null;
        }
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        
        // Obter informações da sessão (com tratamento de erro)
        let phoneNumber = null;
        try {
          if (client && typeof client.info !== 'undefined') {
            const clientInfo = client.info;
            phoneNumber = clientInfo?.wid?.user || null;
          }
        } catch (infoError) {
          // Ignorar erros de "Target closed" ao obter informações
          if (infoError.message.includes('Target closed') || infoError.message.includes('Protocol error')) {
            console.warn(`⚠️ [${accountName}] Browser foi fechado ao obter informações no evento 'ready'`);
            return;
          }
          console.warn(`⚠️ [${accountName}] Erro ao obter informações no evento 'ready':`, infoError.message);
        }
        
        // Atualizar banco
        await updateAccountStatus(accountId, 'connected');
        if (phoneNumber) {
          await supabase
            .from('whatsapp_accounts')
            .update({
              phone_number: phoneNumber,
              updated_at: new Date().toISOString()
            })
            .eq('account_id', accountId);
        }

        // Buscar organização para emitir notificação
        const { data: accountInfo } = await supabase
          .from('whatsapp_accounts')
          .select('organization_id')
          .eq('account_id', accountId)
          .single();

        // Emitir notificação de conexão
        if (io) {
          if (accountInfo) {
            io.to(`org_${accountInfo.organization_id}`).emit('whatsapp-connected', {
              accountId,
              accountName,
              phoneNumber
            });
            io.to(`org_${accountInfo.organization_id}`).emit('connection_status', {
              accountId,
              status: 'connected',
              accountName
            });
          } else {
            io.emit('connection_status', {
              accountId,
              status: 'connected',
              accountName
            });
          }
        }

        // ✅ Iniciar monitoramento de saúde
        startHealthMonitoring(accountId, accountName, client);
        
        console.log(`✅ [${accountName}] Conexão estabelecida e monitoramento iniciado`);
      } catch (error) {
        // Ignorar erros de "Target closed"
        if (error.message && (
          error.message.includes('Target closed') || 
          error.message.includes('Protocol error') ||
          error.message.includes('Runtime.callFunctionOn')
        )) {
          console.warn(`⚠️ [${accountName}] Browser foi fechado durante atualização de status (erro ignorado)`);
        } else {
          console.error(`❌ [${accountName}] Erro ao atualizar status conectado:`, error);
        }
      }
    });

    // ✅ Evento de desconexão
    client.on('disconnected', async (reason) => {
      console.log(`🔌 [${accountName}] DESCONECTADO: ${reason}`);
      
      const connectionData = activeConnections.get(accountId);
      if (!connectionData) return;

      connectionData.status = 'disconnected';
      
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
      
      // ✅ Tratar desconexão
      await handleWhatsAppWebDisconnection(accountId, accountName, reason || 'disconnected');
    });

    // ✅ Evento de autenticação falhada
    client.on('auth_failure', async (message) => {
      console.log(`❌ [${accountName}] FALHA NA AUTENTICAÇÃO: ${message}`);
      await handleWhatsAppWebDisconnection(accountId, accountName, 'auth_failure');
    });

    // ✅ Evento de mensagens recebidas
    client.on('message', async (message) => {
      try {
        await handleWhatsAppWebMessage(message, accountId, accountName, client);
      } catch (error) {
        console.error(`❌ [${accountName}] Erro ao processar mensagem:`, error);
      }
    });

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
    console.error(`❌ [${accountName}] Erro ao configurar eventos whatsapp-web.js:`, error);
  }
};

// ✅ Função para lidar com desconexão (mesma lógica do Baileys)
const handleWhatsAppWebDisconnection = async (accountId, accountName, reason) => {
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
        await connection.client.destroy();
      } catch (error) {
        // Ignorar erros ao destruir
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
        
        await createWhatsAppWebSession(accountId, accountName, true, 'auto');
      } catch (error) {
        console.warn(`⚠️ [${accountName}] Erro ao verificar status antes de gerar novo QR:`, error.message);
        // Continuar gerando QR code se houver erro na verificação
        await createWhatsAppWebSession(accountId, accountName, true, 'auto');
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
      createWhatsAppWebSession(accountId, accountName, false, 'auto');
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

  return reason.includes('disconnect') || reason.includes('health_check_failed') || reason === 'disconnected' || reason === 'failure' || reason === 'auth_failure';
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
    
    // ✅ NOVO: Encerrar cliente WhatsApp Web se existir
    if (connectionData && connectionData.client) {
      try {
        console.log(`🔌 [${accountName}] Fechando cliente WhatsApp Web devido ao timeout...`);
        await connectionData.client.destroy();
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
      // whatsapp-web.js: verificar se client.info existe e tem wid
      const isReady = client && client.info && (client.info.wid || client.info.wid?.user);

      if (isReady) {
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
          await handleWhatsAppWebDisconnection(accountId, accountName, 'health_check_failed');
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
      const connection = activeConnections.get(account.account_id);

      const updatedAt = new Date(account.updated_at).getTime();
      const timeSinceUpdate = now - updatedAt;
      const tenMinutes = 10 * 60 * 1000;

      const isReconnecting = activeConnections.has(account.account_id) &&
                            activeConnections.get(account.account_id).status === 'connecting';

      if (!connection && !isReconnecting && timeSinceUpdate > tenMinutes) {
        orphanedAccounts.push(account.name);
        await createWhatsAppWebSession(account.account_id, account.name, false, 'auto');
      }
    }

    if (orphanedAccounts.length > 0) {
      console.log(`🔄 [ORPHAN] Reconectando ${orphanedAccounts.length} conta(s) órfã(s): ${orphanedAccounts.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Erro ao verificar conexões órfãs:', error);
  }
};

// ✅ Inicializar verificações periódicas
setInterval(checkOrphanedConnections, 600000); // A cada 10 minutos

// ✅ Converter mensagem whatsapp-web.js para formato Baileys
const convertWhatsAppWebToBaileysFormat = (waMessage) => {
  const message = {
    key: {
      id: waMessage.id._serialized || waMessage.id.id || waMessage.id,
      remoteJid: waMessage.from,
      fromMe: waMessage.fromMe || false
    },
    messageTimestamp: waMessage.timestamp || Date.now(),
    pushName: waMessage.notifyName || waMessage._data?.notifyName || ''
  };

  // Detectar tipo de mensagem e converter
  if (waMessage.hasMedia) {
    const mediaData = waMessage._data;
    
    if (mediaData.type === 'image') {
      message.message = {
        imageMessage: {
          mimetype: mediaData.mimetype || 'image/jpeg',
          fileLength: mediaData.fileLength || null,
          fileName: mediaData.filename || `image_${Date.now()}.jpg`,
          caption: waMessage.caption || ''
        }
      };
    } else if (mediaData.type === 'video') {
      message.message = {
        videoMessage: {
          mimetype: mediaData.mimetype || 'video/mp4',
          fileLength: mediaData.fileLength || null,
          fileName: mediaData.filename || `video_${Date.now()}.mp4`,
          caption: waMessage.caption || ''
        }
      };
    } else if (mediaData.type === 'audio' || mediaData.type === 'ptt') {
      message.message = {
        audioMessage: {
          mimetype: mediaData.mimetype || 'audio/ogg',
          fileLength: mediaData.fileLength || null,
          fileName: mediaData.filename || `audio_${Date.now()}.ogg`,
          ptt: mediaData.type === 'ptt' || false
        }
      };
    } else if (mediaData.type === 'document') {
      message.message = {
        documentMessage: {
          mimetype: mediaData.mimetype || 'application/pdf',
          fileLength: mediaData.fileLength || null,
          fileName: mediaData.filename || `document_${Date.now()}.pdf`,
          caption: waMessage.caption || ''
        }
      };
    } else if (mediaData.type === 'sticker') {
      message.message = {
        stickerMessage: {
          mimetype: mediaData.mimetype || 'image/webp',
          fileLength: mediaData.fileLength || null
        }
      };
    }
  } else if (waMessage.location) {
    message.message = {
      locationMessage: {
        degreesLatitude: waMessage.location.latitude,
        degreesLongitude: waMessage.location.longitude
      }
    };
  } else if (waMessage.vCards && waMessage.vCards.length > 0) {
    const vcard = waMessage.vCards[0];
    message.message = {
      contactMessage: {
        contacts: [{
          name: vcard.displayName || 'Contato',
          number: vcard.phoneNumber || ''
        }]
      }
    };
  } else {
    // Mensagem de texto
    message.message = {
      conversation: waMessage.body || waMessage.text || '',
      extendedTextMessage: waMessage.body ? { text: waMessage.body } : undefined
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

// ✅ Função para baixar mídia do whatsapp-web.js
const downloadWhatsAppWebMedia = async (waMessage, chatId) => {
  try {
    if (!waMessage.hasMedia) {
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

    // ✅ VALIDAÇÃO: Verificar parâmetros de entrada
    if (!waMessage || !chatId) {
      return {
        mediaType: 'text',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: '❌ Parâmetros inválidos',
        localPath: null
      };
    }

    const mediaData = waMessage._data;
    let mediaType = 'text';
    let fileName = null;
    let mimeType = null;
    let fileSize = null;
    let caption = null;

    // ✅ MELHORADO: Determinar tipo de mídia com suporte completo a GIFs e outros formatos
    if (mediaData.type === 'image') {
      mediaType = 'image';
      mimeType = mediaData.mimetype || 'image/jpeg';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType (suporta GIF, PNG, WEBP, etc)
      const extension = getExtensionFromMimeType(mimeType);
      fileName = mediaData.filename || `image_${Date.now()}${extension}`;
      fileSize = mediaData.fileLength || null;
      caption = waMessage.caption || '';
    } else if (mediaData.type === 'video') {
      mediaType = 'video';
      mimeType = mediaData.mimetype || 'video/mp4';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType
      const extension = getExtensionFromMimeType(mimeType);
      fileName = mediaData.filename || `video_${Date.now()}${extension}`;
      fileSize = mediaData.fileLength || null;
      caption = waMessage.caption || '';
    } else if (mediaData.type === 'audio' || mediaData.type === 'ptt') {
      mediaType = 'audio';
      mimeType = mediaData.mimetype || 'audio/ogg';
      if (mediaData.type === 'ptt') {
        mimeType = 'audio/ogg; codecs=opus';
        fileName = `voice_${Date.now()}.ogg`;
      } else {
        // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType
        const extension = getExtensionFromMimeType(mimeType);
        fileName = mediaData.filename || `audio_${Date.now()}${extension}`;
      }
      fileSize = mediaData.fileLength || null;
    } else if (mediaData.type === 'document') {
      mediaType = 'file';
      mimeType = mediaData.mimetype || 'application/pdf';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType ou nome do arquivo
      if (mediaData.filename) {
        fileName = mediaData.filename;
      } else {
        const extension = getExtensionFromMimeType(mimeType);
        fileName = `document_${Date.now()}${extension}`;
      }
      fileSize = mediaData.fileLength || null;
      caption = waMessage.caption || '';
    } else if (mediaData.type === 'sticker') {
      mediaType = 'sticker';
      mimeType = mediaData.mimetype || 'image/webp';
      // ✅ CORREÇÃO: Usar extensão correta baseada no mimeType (pode ser webp, png, etc)
      const extension = getExtensionFromMimeType(mimeType);
      fileName = `sticker_${Date.now()}${extension}`;
      fileSize = mediaData.fileLength || null;
    } else if (waMessage.location) {
      mediaType = 'location';
      const locationText = `📍 Localização\n🌍 Latitude: ${waMessage.location.latitude}\n🌍 Longitude: ${waMessage.location.longitude}`;
      return {
        mediaType: 'location',
        mediaUrl: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
        caption: locationText,
        localPath: null
      };
    } else if (waMessage.vCards && waMessage.vCards.length > 0) {
      mediaType = 'contact';
      const vcard = waMessage.vCards[0];
      const contactText = `📞 Contato: ${vcard.displayName || 'Sem nome'}\n📱 Número: ${vcard.phoneNumber || 'Sem número'}`;
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

    // Se não há mídia para baixar, retornar apenas texto
    if (mediaType === 'text') {
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

    // ✅ Criar diretório para o chat
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

    // ✅ Baixar mídia usando whatsapp-web.js
    let buffer;
    try {
      const media = await waMessage.downloadMedia();
      if (!media || !media.data) {
        throw new Error('Mídia não disponível');
      }
      
      // Converter base64 para buffer
      buffer = Buffer.from(media.data, 'base64');

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

    // ✅ Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = fileName ? path.extname(fileName) : getExtensionFromMimeType(mimeType);
    const uniqueFileName = `file-${timestamp}-${randomId}${extension}`;
    const localPath = path.join(uploadDir, uniqueFileName);

    // ✅ Salvar arquivo localmente
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

    // ✅ Retornar informações da mídia (mesmo formato do Baileys)
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

// ✅ Processar mensagens recebidas via whatsapp-web.js (usando mesma lógica do Baileys)
const handleWhatsAppWebMessage = async (waMessage, accountId, accountName, client) => {
  try {
    // ✅ CORREÇÃO: Processar mensagens próprias também (incluindo áudios enviados)
    // Não ignorar mais mensagens próprias - elas precisam ser salvas no banco

    // Ignorar mensagens de status
    if (waMessage.from === 'status@broadcast') {
      return;
    }

    // Converter formato whatsapp-web.js para formato Baileys
    const convertedMessage = convertWhatsAppWebToBaileysFormat(waMessage);
    // Preservar mensagem original para download de mídia
    convertedMessage._waOriginal = waMessage;

    // ✅ Processar mensagem usando a mesma lógica do Baileys
    await processWhatsAppWebReceivedMessage(convertedMessage, accountId, accountName, client);

  } catch (error) {
    console.error(`❌ [${accountName}] Erro ao processar mensagem whatsapp-web.js:`, error);
  }
};

// ✅ Função para processar mensagem recebida (replicando lógica do Baileys)
const processWhatsAppWebReceivedMessage = async (message, accountId, accountName, client) => {
  try {
    const senderJid = message.key?.remoteJid;
    const isOwnMessage = message.key?.fromMe;
    const originalWaMessage = message._waOriginal || message;

    // ✅ CRÍTICO: Ignorar mensagens de newsletter/updates do WhatsApp
    // Esses chats não devem ser salvos no sistema
    if (senderJid && (senderJid.includes('@newsletter') || senderJid.includes('@updates'))) {
      console.log(`🚫 [${accountName}] Mensagem de newsletter/updates ignorada: ${senderJid}`);
      return; // Não processar mensagens de newsletter/updates
    }

    // ✅ CORREÇÃO: Verificar se é mensagem de broadcast (lista de transmissão) - apenas se realmente for broadcast
    const isBroadcast = ((senderJid?.endsWith('@broadcast') && senderJid !== 'status@broadcast') ||
                        (originalWaMessage?.from?.endsWith('@broadcast') && originalWaMessage?.from !== 'status@broadcast')) &&
                        isOwnMessage; // Apenas mensagens próprias podem ser broadcast
    
    if (isBroadcast) {
      console.log(`📢 [${accountName}] Detectada mensagem de broadcast (WhatsAppJS): ${senderJid || originalWaMessage?.from}`);
      // Criar mock sock para saveBroadcastMessage
      const mockSock = {
        user: { id: client.info?.wid?._serialized || client.info?.wid?.user },
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
      const mockSock = {
        user: { id: client.info?.wid?._serialized || client.info?.wid?.user },
        sendMessage: async (jid, msg) => {
          if (typeof msg === 'string') {
            return await client.sendMessage(jid, msg);
          } else if (msg.text) {
            return await client.sendMessage(jid, msg.text);
          }
        }
      };
      await processGroupMessage(message, accountId, accountName, mockSock, io, downloadWhatsAppWebMedia);
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
      try {
        const contact = await client.getContactById(targetJid);
        phoneNumber = targetJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        contactName = contact?.name || contact?.pushname || phoneNumber;
        contactInfo = {
          name: contactName,
          phoneNumber,
          profilePicture: null
        };
      } catch (error) {
        phoneNumber = targetJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        contactName = phoneNumber;
        contactInfo = { name: contactName, phoneNumber, profilePicture: null };
      }
    } else {
      targetJid = senderJid;
      try {
        const contact = await client.getContactById(targetJid);
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

      // ✅ CORREÇÃO: NÃO atualizar nome se o chat já existe e tem um nome válido
      // ✅ Apenas atualizar avatar se necessário
      // ✅ O nome do cliente deve ser mantido quando o chat já existe
      const needsAvatarUpdate = contactInfo.profilePicture && !existingChat.avatar_url;
      
      // ✅ Só atualizar se precisar atualizar avatar
      // ✅ NÃO atualizar o nome quando o chat já existe
      if (needsAvatarUpdate) {
        console.log(`🖼️ [${accountName}] Atualizando foto do chat: ${contactInfo.profilePicture}`);
        await supabase
          .from('chats')
          .update({
            name: existingChat.name, // ✅ MANTER o nome existente sempre
            avatar_url: contactInfo.profilePicture || existingChat.avatar_url,
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

    // ✅ Processar mídia (usando função adaptada para whatsapp-web.js)
    const mediaInfo = await downloadWhatsAppWebMedia(originalWaMessage, chatId);

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
    const clientInfo = client.info;
    const whatsappMessageId = message.key?.id;
    
    // ✅ CORREÇÃO: Para mensagens próprias enviadas, verificar se já existe uma mensagem no banco
    // Isso evita duplicatas quando o evento 'message' captura mensagens que já foram salvas
    let savedMessage = null;
    
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
          message_type: mediaInfo.mediaType,
          media_url: mediaInfo.mediaUrl,
          sender_name: accountName,
          sender_jid: clientInfo?.wid?._serialized || clientInfo?.wid?.user,
          message_object: message.message,
          message_key: message.key,
          metadata: {
            ...mediaInfo,
            is_group_message: false,
            is_own_message: true,
            target_jid: targetJid,
            received_at: new Date().toISOString(),
            push_name: message.pushName,
            timestamp: message.messageTimestamp
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
          console.log(`✅ [${accountName}] Mensagem atualizada: ${savedMessage.id} (própria: ${isOwnMessage}, tipo: ${mediaInfo.mediaType})`);
        }
      }
    }
    
    // Se não encontrou mensagem existente, inserir nova
    if (!savedMessage) {
      const messagePayload = {
        chat_id: chatId,
        content: messageContent,
        message_type: mediaInfo.mediaType,
        media_url: mediaInfo.mediaUrl,
        is_from_me: isOwnMessage,
        sender_name: isOwnMessage ? accountName : contactName,
        sender_jid: isOwnMessage ? clientInfo?.wid?._serialized || clientInfo?.wid?.user : targetJid,
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
          timestamp: message.messageTimestamp
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
                message_object: message.message,
                message_key: message.key,
                metadata: {
                  ...mediaInfo,
                  is_group_message: false,
                  is_own_message: true,
                  target_jid: targetJid,
                  received_at: new Date().toISOString(),
                  push_name: message.pushName,
                  timestamp: message.messageTimestamp
                }
              })
              .eq('id', existingByContent.id)
              .select('id')
              .single();
            
            if (!updateError && updatedMessage) {
              savedMessage = updatedMessage;
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
        console.log(`✅ [${accountName}] Mensagem salva: ${savedMessage.id} (própria: ${isOwnMessage}, tipo: ${mediaInfo.mediaType})`);
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
            user: { id: clientInfo?.wid?._serialized || clientInfo?.wid?.user },
            sendMessage: async (jid, msg) => {
              if (typeof msg === 'string') {
                return await client.sendMessage(jid, msg);
              } else if (msg.text) {
                return await client.sendMessage(jid, msg.text);
              } else if (msg.image) {
                return await client.sendMessage(jid, { media: msg.image });
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
            await client.sendMessage(targetJid, flowResponse.text);
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
            user: { id: clientInfo?.wid?._serialized || clientInfo?.wid?.user },
            sendMessage: async (jid, msg) => {
              if (typeof msg === 'string') {
                return await client.sendMessage(jid, msg);
              } else if (msg.text) {
                return await client.sendMessage(jid, msg.text);
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
  return await createWhatsAppWebSession(accountId, accountName, shouldGenerateQr, options);
};

// ✅ Função para desconectar
export const disconnectWhatsAppAccount = async (accountId) => {
  try {
    const connection = activeConnections.get(accountId);
    if (connection && connection.client) {
      try {
        // Tentar destruir o cliente WhatsApp Web
        await connection.client.destroy();
      } catch (destroyError) {
        console.warn(`⚠️ Erro ao destruir cliente WhatsApp Web (continuando desconexão):`, destroyError.message);
      }
      
      activeConnections.delete(accountId);
    }

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
        console.error(`❌ [WhatsApp Web] Erro ao atualizar whatsapp_accounts para ${accountId}:`, updateError);
      } else {
        console.log(`✅ [WhatsApp Web] whatsapp_accounts atualizada para ${accountId} (disconnected)`);
      }
    } catch (dbError) {
      console.error(`❌ [WhatsApp Web] Erro ao atualizar whatsapp_accounts para ${accountId}:`, dbError);
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
        console.log(`📡 [WhatsApp Web] Evento de desconexão emitido para organização ${accountInfo.organization_id}`);
      }
    } catch (emitError) {
      console.warn(`⚠️ [WhatsApp Web] Erro ao emitir evento de desconexão:`, emitError.message);
    }

    return { success: true, message: 'Desconectado com sucesso' };
  } catch (error) {
    console.error(`❌ [WhatsApp Web] Erro ao desconectar:`, error);
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
      const quotedMessage = await client.getMessageById(replyTo);
      if (quotedMessage) {
        result = await client.sendMessage(jid, message, { quotedMessageId: replyTo });
      } else {
        result = await client.sendMessage(jid, message);
      }
    } else {
      result = await client.sendMessage(jid, message);
    }

    return {
      success: true,
      message: 'Mensagem enviada com sucesso',
      whatsapp_message_id: result?.id?._serialized || result?.id?.id || result?.id || null
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
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    
    const media = fs.readFileSync(imagePath);
    const result = await client.sendMessage(jid, {
      media: media,
      caption: safeCaption
    });
    
    return {
      success: true,
      message: 'Imagem enviada com sucesso',
      whatsapp_message_id: result?.id?._serialized || result?.id?.id || result?.id || null
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
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    const media = fs.readFileSync(filePath);
    
    const result = await client.sendMessage(jid, {
      media: media,
      filename: filename || path.basename(filePath),
      mimetype: mimetype || undefined,
      caption: safeCaption
    });
    
    return {
      success: true,
      message: 'Documento enviado com sucesso',
      whatsapp_message_id: result?.id?._serialized || result?.id?.id || result?.id || null
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
    const safeCaption = caption && !caption.startsWith('/uploads/') ? caption : '';
    const media = fs.readFileSync(audioPath);
    
    const result = await client.sendMessage(jid, {
      media: media,
      mimetype: mimetype || 'audio/ogg',
      ptt: true,
      caption: safeCaption
    });
    
    return {
      success: true,
      message: 'Áudio enviado com sucesso',
      whatsapp_message_id: result?.id?._serialized || result?.id?.id || result?.id || null
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
      const quotedMessage = await client.getMessageById(replyTo);
      if (quotedMessage) {
        result = await client.sendMessage(groupJid, message, { quotedMessageId: replyTo });
      } else {
        result = await client.sendMessage(groupJid, message);
      }
    } else {
      result = await client.sendMessage(groupJid, message);
    }
    
    return {
      success: true,
      message: 'Mensagem de grupo enviada com sucesso',
      whatsapp_message_id: result?.id?._serialized || result?.id?.id || result?.id || null
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

  const isReady = connection.client?.info && connection.client?.info?.wid;
  return {
    status: connection.status || 'disconnected',
    connected: !!isReady,
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

// ✅ Obter lista de grupos (compatível com Baileys)
export const getGroupsListByAccount = async (accountId) => {
  try {
    const connection = activeConnections.get(accountId);
    if (!connection || !connection.client) {
      throw new Error('Conta não conectada');
    }
    
    const client = connection.client;
    const groups = await client.getChats();
    const groupChats = groups.filter(chat => chat.isGroup);
    
    return {
      success: true,
      groups: groupChats || []
    };
  } catch (error) {
    console.error('❌ Erro ao obter lista de grupos:', error);
    return { success: false, error: error.message, groups: [] };
  }
};

// ✅ Inicializar Socket.IO
export const initializeWhatsAppWeb = (socketIO) => {
  io = socketIO;
  console.log('✅ whatsapp-web.js inicializado com Socket.IO');
  
  // ✅ Iniciar verificações periódicas
  console.log('✅ whatsapp-web.js: Verificações periódicas iniciadas');
};

// ✅ Exportar conexões ativas (para compatibilidade)
export { activeConnections };

