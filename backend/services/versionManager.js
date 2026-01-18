/**
 * Serviço de Gerenciamento de Versões do WhatsApp Web
 * 
 * Este serviço implementa múltiplas estratégias para garantir que sempre
 * usemos a versão mais recente e estável do WhatsApp Web:
 * 
 * 1. Busca dinâmica via fetchLatestWaWebVersion
 * 2. Cache inteligente com TTL
 * 3. Fallback para versões conhecidas estáveis
 * 4. Verificação periódica de atualizações
 */

import { fetchLatestWaWebVersion } from '@whiskeysockets/baileys';
import NodeCache from '@cacheable/node-cache';

// Cache para versões com TTL de 24 horas (evitar rate limiting)
const versionCache = new NodeCache({ 
  stdTTL: 24 * 60 * 60, // 24 horas
  checkperiod: 60 * 60 // Verificar a cada 1 hora
});

// Versões de fallback conhecidas e estáveis
const FALLBACK_VERSIONS = [
  [2, 3000, 1028570661], // Versão mais recente estável (10/17/2025)
  [2, 3000, 1028573154], // Versão alternativa estável
  [2, 3000, 1023223821], // Versão anterior estável (fallback)
];

// Configurações
const CONFIG = {
  CACHE_KEY: 'latest_wa_version',
  MAX_RETRIES: 2, // Reduzido para evitar rate limiting
  RETRY_DELAY: 30000, // 30 segundos - delay maior para evitar 429
  FALLBACK_ENABLED: true,
  AUTO_UPDATE_ENABLED: true,
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas - cache mais longo
  RATE_LIMIT_DELAY: 60000 // 1 minuto entre tentativas quando há rate limiting
};

/**
 * Busca a versão mais recente do WhatsApp Web com retry e cache
 */
export const getLatestWhatsAppVersion = async (forceRefresh = false) => {
  try {
    // Verificar cache primeiro (se não forçar refresh)
    if (!forceRefresh) {
      const cachedVersion = versionCache.get(CONFIG.CACHE_KEY);
      if (cachedVersion) {
        console.log(`📱 [VERSION] Usando versão do cache: v${cachedVersion.version.join(".")}, isLatest: ${cachedVersion.isLatest}`);
        return cachedVersion;
      }
    }

    console.log(`🔄 [VERSION] Buscando versão mais recente do WhatsApp Web...`);
    
    // Tentar buscar versão mais recente com retry inteligente
    let lastError;
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        console.log(`🔄 [VERSION] Tentativa ${attempt}/${CONFIG.MAX_RETRIES}...`);
        
        const result = await fetchLatestWaWebVersion();
        
        // Verificar se houve erro na resposta (mesmo com sucesso HTTP)
        if (result.error) {
          throw new Error(`WhatsApp API Error: ${result.error.message || 'Unknown error'}`);
        }
        
        const { version, isLatest } = result;
        
        const versionData = {
          version,
          isLatest,
          timestamp: Date.now(),
          source: 'fetchLatestWaWebVersion'
        };

        // Salvar no cache
        versionCache.set(CONFIG.CACHE_KEY, versionData);
        
        console.log(`✅ [VERSION] Versão obtida com sucesso: v${version.join(".")}, isLatest: ${isLatest}`);
        return versionData;

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ [VERSION] Tentativa ${attempt} falhou:`, error.message);
        
        // Verificar se é erro de rate limiting (429)
        const isRateLimited = error.message.includes('429') || 
                             error.message.includes('Too Many Requests') ||
                             (error.response && error.response.status === 429);
        
        if (isRateLimited) {
          console.log(`🚫 [VERSION] Rate limiting detectado (429). Aguardando ${CONFIG.RATE_LIMIT_DELAY/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY));
        } else if (attempt < CONFIG.MAX_RETRIES) {
          console.log(`⏳ [VERSION] Aguardando ${CONFIG.RETRY_DELAY/1000}s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        }
      }
    }

    // Se todas as tentativas falharam, usar fallback
    if (CONFIG.FALLBACK_ENABLED) {
      console.warn(`⚠️ [VERSION] Todas as tentativas falharam, usando versão de fallback...`);
      const fallbackData = getFallbackVersion();
      
      // Salvar no cache para evitar novas tentativas
      versionCache.set(CONFIG.CACHE_KEY, fallbackData);
      
      return fallbackData;
    }

    throw lastError || new Error('Falha ao obter versão do WhatsApp Web');

  } catch (error) {
    console.error(`❌ [VERSION] Erro ao obter versão:`, error);
    
    if (CONFIG.FALLBACK_ENABLED) {
      console.log(`🔄 [VERSION] Usando versão de fallback devido ao erro...`);
      return getFallbackVersion();
    }
    
    throw error;
  }
};

/**
 * Obtém uma versão de fallback estável
 */
export const getFallbackVersion = () => {
  const fallbackVersion = FALLBACK_VERSIONS[0]; // Usar a primeira versão de fallback
  
  const versionData = {
    version: fallbackVersion,
    isLatest: true, // Marcar como mais recente pois é nossa versão preferida
    timestamp: Date.now(),
    source: 'fallback'
  };

  console.log(`🔄 [VERSION] Usando versão de fallback: v${fallbackVersion.join(".")}`);
  return versionData;
};

/**
 * Força o uso da versão mais recente conhecida (fallback)
 */
export const forceLatestKnownVersion = () => {
  console.log(`🔄 [VERSION] Forçando uso da versão mais recente conhecida...`);
  
  const latestKnown = FALLBACK_VERSIONS[0];
  const versionData = {
    version: latestKnown,
    isLatest: true,
    timestamp: Date.now(),
    source: 'forced_latest'
  };

  // Salvar no cache
  versionCache.set(CONFIG.CACHE_KEY, versionData);
  
  console.log(`✅ [VERSION] Versão mais recente forçada: v${latestKnown.join(".")}`);
  return versionData;
};

/**
 * Verifica se a versão atual está desatualizada
 */
export const isVersionOutdated = (versionData, maxAge = 24 * 60 * 60 * 1000) => {
  if (!versionData || !versionData.timestamp) return true;
  
  const age = Date.now() - versionData.timestamp;
  const isOutdated = age > maxAge;
  
  if (isOutdated) {
    console.log(`⚠️ [VERSION] Versão desatualizada (idade: ${Math.round(age / 1000 / 60)} minutos)`);
  }
  
  return isOutdated;
};

/**
 * Força atualização da versão (limpa cache e busca nova)
 */
export const forceVersionUpdate = async () => {
  console.log(`🔄 [VERSION] Forçando atualização da versão...`);
  
  // Limpar cache
  versionCache.del(CONFIG.CACHE_KEY);
  
  // Buscar nova versão
  return await getLatestWhatsAppVersion(true);
};

/**
 * Inicializa o serviço de versão com verificação periódica
 */
export const initializeVersionService = () => {
  console.log(`🚀 [VERSION] Inicializando serviço de versão...`);
  
  // Usar versão mais recente conhecida imediatamente
  console.log('🔄 [VERSION] Configurando versão mais recente conhecida...');
  const latestKnown = forceLatestKnownVersion();
  console.log(`✅ [VERSION] Versão configurada: v${latestKnown.version.join(".")}`);
  
  // Buscar versão inicial em background (sem bloquear)
  setTimeout(() => {
    getLatestWhatsAppVersion().catch(error => {
      console.error(`❌ [VERSION] Erro na busca em background:`, error);
    });
  }, 5000); // Aguardar 5 segundos antes de tentar buscar

  // Verificar atualizações a cada 6 horas (menos agressivo para evitar rate limiting)
  if (CONFIG.AUTO_UPDATE_ENABLED) {
    setInterval(async () => {
      try {
        const currentVersion = versionCache.get(CONFIG.CACHE_KEY);
        
        if (!currentVersion || isVersionOutdated(currentVersion, 6 * 60 * 60 * 1000)) { // 6 horas
          console.log(`🔄 [VERSION] Verificação periódica: buscando nova versão...`);
          await getLatestWhatsAppVersion(true);
        } else {
          console.log(`✅ [VERSION] Versão atual ainda válida: v${currentVersion.version.join(".")}`);
        }
      } catch (error) {
        console.error(`❌ [VERSION] Erro na verificação periódica:`, error);
      }
    }, 6 * 60 * 60 * 1000); // 6 horas
  }
};

/**
 * Obtém informações sobre a versão atual
 */
export const getVersionInfo = () => {
  const versionData = versionCache.get(CONFIG.CACHE_KEY);
  
  if (!versionData) {
    return {
      status: 'not_loaded',
      message: 'Versão não carregada ainda'
    };
  }

  const age = Date.now() - versionData.timestamp;
  const ageMinutes = Math.round(age / 1000 / 60);

  return {
    status: 'loaded',
    version: versionData.version.join('.'),
    isLatest: versionData.isLatest,
    source: versionData.source,
    ageMinutes,
    isOutdated: isVersionOutdated(versionData)
  };
};

/**
 * Middleware para logs de versão
 */
export const logVersionInfo = (accountName) => {
  const versionInfo = getVersionInfo();
  
  if (versionInfo.status === 'loaded') {
    console.log(`📱 [${accountName}] WhatsApp Web v${versionInfo.version} (${versionInfo.source}) - isLatest: ${versionInfo.isLatest} - Idade: ${versionInfo.ageMinutes}min`);
  } else {
    console.log(`⚠️ [${accountName}] Versão não disponível: ${versionInfo.message}`);
  }
};

export default {
  getLatestWhatsAppVersion,
  getFallbackVersion,
  isVersionOutdated,
  forceVersionUpdate,
  initializeVersionService,
  getVersionInfo,
  logVersionInfo
};
