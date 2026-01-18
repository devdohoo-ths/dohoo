/**
 * Rotas para gerenciamento de versões do WhatsApp Web
 */

import express from 'express';
import { 
  getVersionInfo, 
  forceVersionUpdate, 
  getLatestWhatsAppVersion,
  getFallbackVersion,
  forceLatestKnownVersion
} from '../services/versionManager.js';

const router = express.Router();

/**
 * GET /api/version/info
 * Obtém informações sobre a versão atual
 */
router.get('/info', async (req, res) => {
  try {
    const versionInfo = getVersionInfo();
    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    console.error('❌ [VERSION API] Erro ao obter informações da versão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/version/update
 * Força atualização da versão
 */
router.post('/update', async (req, res) => {
  try {
    console.log('🔄 [VERSION API] Forçando atualização da versão...');
    
    const versionData = await forceVersionUpdate();
    
    res.json({
      success: true,
      message: 'Versão atualizada com sucesso',
      data: {
        version: versionData.version.join('.'),
        isLatest: versionData.isLatest,
        source: versionData.source,
        timestamp: new Date(versionData.timestamp).toISOString()
      }
    });
  } catch (error) {
    console.error('❌ [VERSION API] Erro ao atualizar versão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar versão',
      message: error.message
    });
  }
});

/**
 * GET /api/version/latest
 * Busca a versão mais recente (sem cache)
 */
router.get('/latest', async (req, res) => {
  try {
    console.log('🔄 [VERSION API] Buscando versão mais recente...');
    
    const versionData = await getLatestWhatsAppVersion(true);
    
    res.json({
      success: true,
      message: 'Versão mais recente obtida com sucesso',
      data: {
        version: versionData.version.join('.'),
        isLatest: versionData.isLatest,
        source: versionData.source,
        timestamp: new Date(versionData.timestamp).toISOString()
      }
    });
  } catch (error) {
    console.error('❌ [VERSION API] Erro ao buscar versão mais recente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar versão mais recente',
      message: error.message
    });
  }
});

/**
 * GET /api/version/fallback
 * Obtém versão de fallback
 */
router.get('/fallback', async (req, res) => {
  try {
    const fallbackData = getFallbackVersion();
    
    res.json({
      success: true,
      message: 'Versão de fallback obtida com sucesso',
      data: {
        version: fallbackData.version.join('.'),
        isLatest: fallbackData.isLatest,
        source: fallbackData.source,
        timestamp: new Date(fallbackData.timestamp).toISOString()
      }
    });
  } catch (error) {
    console.error('❌ [VERSION API] Erro ao obter versão de fallback:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter versão de fallback',
      message: error.message
    });
  }
});

/**
 * POST /api/version/force-latest
 * Força o uso da versão mais recente conhecida
 */
router.post('/force-latest', async (req, res) => {
  try {
    console.log('🔄 [VERSION API] Forçando versão mais recente conhecida...');
    
    const versionData = forceLatestKnownVersion();
    
    res.json({
      success: true,
      message: 'Versão mais recente conhecida aplicada com sucesso',
      data: {
        version: versionData.version.join('.'),
        isLatest: versionData.isLatest,
        source: versionData.source,
        timestamp: new Date(versionData.timestamp).toISOString()
      }
    });
  } catch (error) {
    console.error('❌ [VERSION API] Erro ao forçar versão mais recente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao forçar versão mais recente',
      message: error.message
    });
  }
});

/**
 * GET /api/version/health
 * Verifica saúde do serviço de versão
 */
router.get('/health', async (req, res) => {
  try {
    const versionInfo = getVersionInfo();
    const isHealthy = versionInfo.status === 'loaded' && !versionInfo.isOutdated;
    
    res.json({
      success: true,
      healthy: isHealthy,
      data: {
        ...versionInfo,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ [VERSION API] Erro na verificação de saúde:', error);
    res.status(500).json({
      success: false,
      healthy: false,
      error: 'Erro na verificação de saúde',
      message: error.message
    });
  }
});

export default router;
