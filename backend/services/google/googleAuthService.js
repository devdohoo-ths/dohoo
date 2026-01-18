import { google } from 'googleapis';
import { supabase } from '../../lib/supabaseClient.js';

// Configurações do Google OAuth (do .env)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_REDIRECT_URI) {
  console.error('❌ GOOGLE_REDIRECT_URI não está configurado no arquivo .env');
  throw new Error('GOOGLE_REDIRECT_URI não está configurado. Configure a variável de ambiente GOOGLE_REDIRECT_URI no arquivo .env');
}

// Configuração do OAuth2
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Scopes para diferentes serviços
const SCOPES = {
  calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  drive: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
  ]
};

/**
 * Recupera e configura o oAuth2Client para o usuário
 */
export const getOAuthClient = async (userId, organizationId, serviceType = 'calendar') => {
  try {
    console.log('🔐 Obtendo cliente OAuth para:', { userId, organizationId, serviceType });
    
    // Primeiro, tentar encontrar integração específica do usuário
    let { data: integration, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .eq('is_active', true)
      .single();

    // Se não encontrar integração específica do usuário, tentar encontrar integração da organização
    if (error || !integration) {
      console.log('🔍 Integração específica do usuário não encontrada, buscando integração da organização...');
      
      const { data: orgIntegration, error: orgError } = await supabase
        .from('google_integrations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('service_type', serviceType)
        .eq('is_active', true)
        .single();

      if (orgError || !orgIntegration) {
        throw new Error(`Configuração do Google ${serviceType} não encontrada para este usuário/organização.`);
      }

      integration = orgIntegration;
      console.log('✅ Usando integração da organização');
    } else {
      console.log('✅ Usando integração específica do usuário');
    }

    const oAuth2Client = new google.auth.OAuth2(
      integration.client_id,
      integration.client_secret,
      integration.redirect_uri
    );

    // Define os tokens que já estão no banco
    oAuth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.expiry_date ? new Date(integration.expiry_date).getTime() : null,
    });

    // Escuta eventos de renovação de token e salva no banco
    oAuth2Client.on('tokens', async (tokens) => {
      console.log('🔁 Token do Google atualizado, salvando no banco...');

      const updateData = {};
      
      if (tokens.access_token) {
        updateData.access_token = tokens.access_token;
      }

      if (tokens.refresh_token) {
        updateData.refresh_token = tokens.refresh_token;
      }

      if (tokens.expiry_date) {
        updateData.expiry_date = new Date(tokens.expiry_date).toISOString();
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('google_integrations')
          .update(updateData)
          .eq('id', integration.id);

        if (updateError) {
          console.error('❌ Erro ao salvar tokens atualizados:', updateError);
        } else {
          console.log('💾 Tokens salvos com sucesso no banco.');
        }
      }
    });

    return oAuth2Client;
  } catch (error) {
    console.error('❌ Erro ao obter cliente OAuth:', error);
    throw error;
  }
};

/**
 * Cria ou atualiza uma integração do Google
 */
export const createOrUpdateGoogleIntegration = async (userId, organizationId, serviceType, integrationData) => {
  try {
    console.log('🔧 Criando/atualizando integração Google:', { userId, organizationId, serviceType });
    
    const { data: existingIntegration } = await supabase
      .from('google_integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .single();

    const integrationDataToSave = {
      user_id: userId,
      organization_id: organizationId,
      service_type: serviceType,
      client_id: integrationData.client_id,
      client_secret: integrationData.client_secret,
      redirect_uri: integrationData.redirect_uri,
      scope: integrationData.scope || [],
      is_active: true
    };

    let result;
    if (existingIntegration) {
      // Atualizar integração existente
      const { data, error } = await supabase
        .from('google_integrations')
        .update(integrationDataToSave)
        .eq('id', existingIntegration.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Criar nova integração
      const { data, error } = await supabase
        .from('google_integrations')
        .insert(integrationDataToSave)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    console.log('✅ Integração Google salva com sucesso:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Erro ao salvar integração Google:', error);
    throw error;
  }
};

/**
 * Salva tokens de acesso após autenticação OAuth
 */
export const saveGoogleTokens = async (userId, organizationId, serviceType, tokens) => {
  try {
    console.log('💾 Salvando tokens do Google...');
    
    const updateData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      is_active: true
    };

    const { data, error } = await supabase
      .from('google_integrations')
      .update(updateData)
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Tokens salvos com sucesso');
    return data;
  } catch (error) {
    console.error('❌ Erro ao salvar tokens:', error);
    throw error;
  }
};

/**
 * Gera URL de autorização OAuth
 */
export const generateAuthUrl = (serviceType, organizationId) => {
  console.log('🔗 Gerando URL de autorização:', { serviceType, organizationId });
  
  const scopes = SCOPES[serviceType] || SCOPES.calendar;
  console.log('📋 Scopes:', scopes);
  
  console.log('🔧 Configurações do OAuth2Client:', {
    clientId: !!GOOGLE_CLIENT_ID,
    clientSecret: !!GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI
  });
  
  // Usar o cliente OAuth2 global configurado com as variáveis do .env
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: JSON.stringify({ organizationId, serviceType })
  });

  console.log('✅ URL gerada:', authUrl);
  return authUrl;
};

/**
 * Troca código de autorização por tokens (versão atualizada para usar credenciais da organização)
 */
export const exchangeCodeForTokens = async (code, organizationId) => {
  try {
    console.log('🔄 Trocando código por tokens para organização:', organizationId);
    
    // Buscar configuração OAuth2 da organização
    const { data: oauthConfig, error: oauthError } = await supabase
      .from('google_integrations')
      .select('client_id, client_secret, redirect_uri')
      .eq('organization_id', organizationId)
      .eq('service_type', 'oauth_config')
      .single();

    if (oauthError || !oauthConfig) {
      throw new Error('Configuração OAuth2 não encontrada para esta organização');
    }

    console.log('✅ Configuração OAuth2 encontrada, criando cliente OAuth2...');

    // Criar cliente OAuth2 com as credenciais da organização
    const organizationOAuth2Client = new google.auth.OAuth2(
      oauthConfig.client_id,
      oauthConfig.client_secret,
      oauthConfig.redirect_uri
    );

    // Trocar código por tokens
    const { tokens } = await organizationOAuth2Client.getToken(code);
    
    console.log('✅ Tokens obtidos com sucesso:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      hasExpiryDate: !!tokens.expiry_date
    });
    
    return tokens;
  } catch (error) {
    console.error('❌ Erro ao trocar código por tokens:', error);
    throw error;
  }
};

/**
 * Configura integração (versão completa para super admin)
 */
export const setupIntegration = async (organizationId, serviceType, clientId, clientSecret, redirectUri) => {
  try {
    // Verifica se já existe integração
    const { data: existingIntegration } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .single();

    if (existingIntegration) {
      // Atualiza integração existente
      const { error } = await supabase
        .from('google_integrations')
        .update({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingIntegration.id);

      if (error) throw error;
      return existingIntegration.id;
    } else {
      // Cria nova integração
      const { data, error } = await supabase
        .from('google_integrations')
        .insert({
          organization_id: organizationId,
          service_type: serviceType,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    console.error('Erro ao configurar integração:', error);
    throw error;
  }
};

/**
 * Salva tokens (versão simplificada)
 */
export const saveTokens = async (organizationId, serviceType, tokens, userId = null) => {
  try {
    // Verifica se já existe integração
    const { data: existingIntegration } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .single();

    if (existingIntegration) {
      // Atualiza integração existente
      const { error } = await supabase
        .from('google_integrations')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingIntegration.id);

      if (error) throw error;
      return existingIntegration.id;
    } else {
      // Cria nova integração com configurações padrão
      const integrationData = {
        organization_id: organizationId,
        service_type: serviceType,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date,
        is_active: true
      };

      // Adiciona user_id se fornecido
      if (userId) {
        integrationData.user_id = userId;
      }

      const { data, error } = await supabase
        .from('google_integrations')
        .insert(integrationData)
        .select()
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    console.error('Erro ao salvar tokens:', error);
    throw error;
  }
};

/**
 * Obtém tokens válidos
 */
export const getValidTokens = async (organizationId, serviceType) => {
  try {
    const { data: integration, error } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType)
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      throw new Error('Integração não encontrada');
    }

    // Verifica se o token expirou
    if (integration.token_expiry && new Date() > new Date(integration.token_expiry)) {
      // Token expirado, tenta renovar
      if (integration.refresh_token) {
        oauth2Client.setCredentials({
          refresh_token: integration.refresh_token
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Atualiza tokens no banco
        await supabase
          .from('google_integrations')
          .update({
            access_token: credentials.access_token,
            token_expiry: credentials.expiry_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', integration.id);

        return {
          access_token: credentials.access_token,
          refresh_token: integration.refresh_token
        };
      } else {
        throw new Error('Token expirado e sem refresh token');
      }
    }

    return {
      access_token: integration.access_token,
      refresh_token: integration.refresh_token
    };
  } catch (error) {
    console.error('Erro ao obter tokens válidos:', error);
    throw error;
  }
};

/**
 * Desconecta integração
 */
export const disconnectIntegration = async (organizationId, serviceType) => {
  try {
    const { error } = await supabase
      .from('google_integrations')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('service_type', serviceType);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao desconectar integração:', error);
    throw error;
  }
};

export default {
  generateAuthUrl,
  exchangeCodeForTokens,
  setupIntegration,
  saveTokens,
  getValidTokens,
  disconnectIntegration
};



