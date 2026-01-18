
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import qr from 'qrcode';
// ✅ NOVO: Serviço de gerenciamento de versões
import { getLatestWhatsAppVersion, logVersionInfo } from './versionManager.js';

let sock;
let io;

export const initializeWhatsApp = async (socketIO) => {
  io = socketIO;

  try {
    // ✅ NOVO: Buscar versão mais recente automaticamente
    const versionData = await getLatestWhatsAppVersion();
    const { version, isLatest } = versionData;
    
    // Log detalhado da versão
    logVersionInfo('WhatsApp Principal');

    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    sock = makeWASocket({
      version, // ✅ Usar a versão mais recente
      auth: state,
      printQRInTerminal: true,
      defaultQueryTimeoutMs: 60000,
      browser: ['Dohoo', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr: qrCode } = update;

      if (qrCode) {
        const qrString = await qr.toDataURL(qrCode);
        io.emit('qr-code', { qr: qrString });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('🔌 Conexão fechada devido a:', lastDisconnect?.error);
        console.log('🔄 Status Code:', statusCode, '- Reconectando:', shouldReconnect);

        if (shouldReconnect) {
          // ✅ CORREÇÃO: Sempre tentar reconectar com a versão mais recente
          console.log('🔄 Tentando reconectar com a versão mais recente...');
          setTimeout(() => initializeWhatsApp(io), 2000); // Delay de 2 segundos
        } else {
          io.emit('whatsapp-disconnected');
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado com sucesso!');
        io.emit('whatsapp-connected');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      console.log('📨 Nova mensagem recebida:', message);
      console.log('mensagem completa: ', m);
      // Ignorar mensagens de status (stories)
      if (message.key.remoteJid === "status@broadcast") return;

      // Checar se é broadcast list
      if (message.key.remoteJid?.endsWith("@broadcast")) {
        console.log("📢 Mensagem de broadcast detectada!");
        console.log("Lista:", message.key.remoteJid);
      }

      if (!message.key.fromMe && m.type === 'notify') {
        console.log('📨 Nova mensagem recebida:', message);

        const chatData = {
          id: message.key.remoteJid,
          from: message.key.remoteJid,
          message: message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            'Mídia',
          timestamp: new Date(),
          type: 'received'
        };

        io.emit('new-whatsapp-message', chatData);
      }
    });

  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', error);
  }
};

export const sendMessage = async (fromNumber, toNumber, message) => {
  try {
    // ✅ CORREÇÃO: Verificações mais robustas do socket
    if (!sock) {
      throw new Error('WhatsApp não está conectado - socket não inicializado');
    }

    // ✅ CORREÇÃO: Verificar se o socket está autenticado
    if (!sock.user || !sock.user.id) {
      throw new Error('WhatsApp não está autenticado - aguarde a conexão ser estabelecida');
    }

    // ✅ CORREÇÃO: Verificar se o socket está realmente conectado
    if (sock.ws?.readyState !== 1) {
      throw new Error('WhatsApp não está conectado - conexão WebSocket não está ativa');
    }

    // Formatar número de destino
    const numeroFormatado = toNumber.includes('@') ? toNumber : `${toNumber}@s.whatsapp.net`;
    
    console.log(`📤 Enviando mensagem de ${fromNumber} para ${numeroFormatado}: ${message}`);
    console.log(`🔍 Socket status:`, {
      hasSocket: !!sock,
      hasUser: !!sock.user,
      userId: sock.user?.id,
      wsReadyState: sock.ws?.readyState
    });
    
    const result = await sock.sendMessage(numeroFormatado, { text: message });
    
    console.log(`✅ Mensagem enviada com sucesso:`, result);
    return { success: true, message: 'Mensagem enviada com sucesso', result };
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    console.error('❌ Detalhes do erro:', {
      message: error.message,
      stack: error.stack,
      socketStatus: {
        hasSocket: !!sock,
        hasUser: !!sock?.user,
        userId: sock?.user?.id,
        wsReadyState: sock?.ws?.readyState
      }
    });
    return { success: false, error: error.message };
  }
};

export const sendMediaMessage = async (to, file, type) => {
  try {
    // ✅ CORREÇÃO: Verificações mais robustas do socket
    if (!sock) {
      throw new Error('WhatsApp não está conectado - socket não inicializado');
    }

    // ✅ CORREÇÃO: Verificar se o socket está autenticado
    if (!sock.user || !sock.user.id) {
      throw new Error('WhatsApp não está autenticado - aguarde a conexão ser estabelecida');
    }

    // ✅ CORREÇÃO: Verificar se o socket está realmente conectado
    if (sock.ws?.readyState !== 1) {
      throw new Error('WhatsApp não está conectado - conexão WebSocket não está ativa');
    }

    // Converter File para Buffer se necessário
    let buffer;
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = file;
    }

    let messageType;
    let mediaType;

    switch (type) {
      case 'image':
        messageType = 'imageMessage';
        mediaType = 'image';
        break;
      case 'video':
        messageType = 'videoMessage';
        mediaType = 'video';
        break;
      case 'audio':
        messageType = 'audioMessage';
        mediaType = 'audio';
        break;
      case 'document':
        messageType = 'documentMessage';
        mediaType = 'document';
        break;
      default:
        messageType = 'documentMessage';
        mediaType = 'document';
    }

    const message = {
      [messageType]: {
        url: '',
        mimetype: file.type || 'application/octet-stream',
        fileLength: buffer.length,
        fileSha256: require('crypto').createHash('sha256').update(buffer).digest(),
        fileEncSha256: require('crypto').createHash('sha256').update(buffer).digest(),
        mediaKey: require('crypto').randomBytes(32),
        mediaKeyTimestamp: Math.floor(Date.now() / 1000),
        contextInfo: {
          participant: sock.user?.id,
          quotedMessage: null
        }
      }
    };

    await sock.sendMessage(to, message, { 
      media: buffer,
      mimetype: file.type || 'application/octet-stream'
    });

    return { success: true, message: `${mediaType} enviado com sucesso` };
  } catch (error) {
    console.error(`❌ Erro ao enviar ${type}:`, error);
    return { success: false, error: error.message };
  }
};

export const getConnectionStatus = () => {
  if (!sock) {
    return { status: 'disconnected', reason: 'Socket não inicializado' };
  }
  
  if (!sock.user || !sock.user.id) {
    return { status: 'connecting', reason: 'Aguardando autenticação' };
  }
  
  if (sock.ws?.readyState !== 1) {
    return { status: 'disconnected', reason: 'WebSocket não conectado' };
  }
  
  return { 
    status: 'connected', 
    reason: 'Conectado e autenticado',
    userId: sock.user.id,
    wsReadyState: sock.ws?.readyState
  };
};

// ✅ NOVA: Função para aguardar conexão estar pronta
export const waitForConnection = async (timeoutMs = 30000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const status = getConnectionStatus();
    
    if (status.status === 'connected') {
      return true;
    }
    
    if (status.status === 'disconnected') {
      throw new Error(`Conexão falhou: ${status.reason}`);
    }
    
    // Aguardar 1 segundo antes de verificar novamente
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Timeout aguardando conexão');
};
