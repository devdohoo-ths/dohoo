import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  createWhatsAppConnection, 
  disconnectWhatsAppAccount,
  reconnectAllAccounts,
  getConnectionStatus as getBaileysConnectionStatus
} from '../services/multiWhatsapp.js';
import { getConnectionStatus as getWPPConnectionStatus } from '../services/wppconnectService.js';
import { ensureReconnectEmailDispatched } from '../services/whatsappReconnectService.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

const isAccountAlreadyConnected = (accountId, accountRecord = null) => {
  const statuses = [];

  if (typeof getBaileysConnectionStatus === 'function') {
    statuses.push(getBaileysConnectionStatus(accountId));
  }

  if (typeof getWPPConnectionStatus === 'function') {
    statuses.push(getWPPConnectionStatus(accountId));
  }

  const hasActiveConnection = statuses.some(status => {
    if (!status) return false;
    if (typeof status === 'string') {
      return status === 'connected';
    }
    if (typeof status === 'object') {
      if (status.connected) return true;
      if (status.status) return status.status === 'connected';
    }
    return false;
  });

  if (hasActiveConnection) {
    return true;
  }

  if (accountRecord) {
    return accountRecord.status === 'connected' && !!accountRecord.phone_number;
  }

  return false;
};

// Rota de teste
router.get('/test', (req, res) => {
  console.log('📱 [API] Rota de teste chamada');
  res.json({ 
    success: true, 
    message: 'Rota de teste funcionando',
    user: req.user 
  });
});

// GET /api/whatsapp-accounts - Listar contas da organização do usuário
router.get('/', async (req, res) => {
  try {
    // ✅ OTIMIZADO: Removidos campos pesados (qr_code, session_data) que não são necessários na listagem
    let query = supabase
      .from('whatsapp_accounts')
      .select('id, user_id, name, phone_number, status, account_id, last_connected_at, created_at, updated_at, assistant_id, flow_id, mode, organization_id')
      .eq('organization_id', req.user.organization_id);
    
    // ✅ CORRIGIDO: Usar role_name diretamente do middleware
    let userRoleName = req.user.role_name;

    // Mapear nomes das roles para comparação
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };

    // Converter o nome da role para o formato esperado
    const normalizedRoleName = roleMapping[userRoleName] || userRoleName;
    
    // Filtrar baseado no role do usuário
    if (normalizedRoleName !== 'super_admin' && normalizedRoleName !== 'admin') {
      // Agentes e outros usuários só podem ver suas próprias contas
      query = query.eq('user_id', req.user.id);
    }
    
    const { data: accounts, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro ao buscar contas:', error);
      return res.status(500).json({ error: 'Erro ao buscar contas WhatsApp' });
    }

    // Buscar dados dos usuários responsáveis pelas contas
    const userIds = [...new Set(accounts?.map(acc => acc.user_id).filter(Boolean) || [])];

    let userProfiles = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (!profilesError && profiles) {
        userProfiles = profiles.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Combinar dados das contas com os perfis dos usuários
    const accountsWithUsers = accounts?.map(account => {
      const responsibleUser = userProfiles[account.user_id] || null;
      
      return {
        ...account,
        responsible_user: responsibleUser
      };
    }) || [];
    
    res.json({ 
      success: true,
      accounts: accountsWithUsers
    });

  } catch (error) {
    console.error('❌ [API] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-accounts - Criar nova conta
router.post('/', async (req, res) => {
  try {
    const { name, platform, account_type } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da conta é obrigatório' });
    }

    console.log('📱 [API] Criando nova conta:', { name, platform, account_type }, 'para organização:', req.user.organization_id);
    
    // Buscar role do usuário
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        roles (
          id,
          name,
          permissions
        )
      `)
      .eq('user_id', req.user.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    let userRoleName = req.user.user_role || req.user.role_name; // fallback
    let userPermissions = {};

    if (!roleError && userRole?.roles) {
      userRoleName = userRole.roles.name;
      userPermissions = userRole.roles.permissions || {};
      console.log('🔐 [API] Role encontrado na tabela roles:', userRoleName);
    } else {
      console.log('⚠️ [API] Role não encontrado na tabela roles, usando fallback:', req.user.user_role || req.user.role_name);
    }
    
    // ✅ CORREÇÃO: Normalizar nome do role para comparação consistente
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent',
      'super_admin': 'super_admin',
      'admin': 'admin',
      'manager': 'manager',
      'agent': 'agent'
    };
    
    const normalizedRoleName = roleMapping[userRoleName] || userRoleName?.toLowerCase().replace(/\s+/g, '_') || 'agent';
    console.log('🔐 [API] Role normalizado:', normalizedRoleName, '(original:', userRoleName, ')');
    
    // ✅ CORREÇÃO: Verificar se o usuário já tem uma conta (apenas para agentes e managers)
    // Super admins e admins podem criar quantas contas quiserem
    if (normalizedRoleName !== 'super_admin' && normalizedRoleName !== 'admin') {
      const { data: existingAccount, error: checkError } = await supabase
        .from('whatsapp_accounts')
        .select('id, name')
        .eq('user_id', req.user.id)
        .eq('organization_id', req.user.organization_id)
        .single();

      if (existingAccount && !checkError) {
        console.log('❌ [API] Usuário já possui uma conta:', existingAccount.name);
        return res.status(400).json({ 
          error: 'Você já possui uma conta WhatsApp. Cada agente pode ter apenas uma conta.' 
        });
      }
    } else {
      console.log('✅ [API] Usuário é admin/super_admin, permitindo criação de múltiplas contas');
    }
    
    // Gerar UUID único para a conta
    const accountId = uuidv4();
    
    // Criar conta no banco com organization_id
    const { data: account, error: dbError } = await supabase
      .from('whatsapp_accounts')
      .insert([{
        id: accountId, // Usar UUID como id principal
        user_id: req.user.id,
        organization_id: req.user.organization_id,
        name,
        platform: platform || 'whatsapp',
        account_type: account_type || 'unofficial',
        account_id: accountId, // Manter account_id igual ao id para compatibilidade
        status: 'disconnected'
      }])
      .select()
      .single();

    if (dbError) {
      console.error('❌ [API] Erro ao criar conta no banco:', dbError);
      return res.status(500).json({ error: 'Erro ao criar conta no banco de dados' });
    }

    console.log('✅ [API] Conta criada com sucesso:', account.id, 'para organização:', req.user.organization_id);
    
    res.json({ 
      success: true,
      account 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao criar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/whatsapp-accounts/:accountId - Obter conta específica
router.get('/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log('📱 [API] Buscando conta:', accountId, 'da organização:', req.user.organization_id);
    
    const { data: account, error } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }
      console.error('❌ [API] Erro ao buscar conta:', error);
      return res.status(500).json({ error: 'Erro ao buscar conta' });
    }

    res.json({ 
      success: true,
      account 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/whatsapp-accounts/:accountId - Atualizar conta
router.patch('/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { name, assistant_id, flow_id, mode } = req.body;
    
    console.log('📱 [API] Atualizando conta:', accountId, req.body, 'da organização:', req.user.organization_id);
    
    // Buscar role real do usuário na tabela roles
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        roles (
          id,
          name,
          permissions
        )
      `)
      .eq('user_id', req.user.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    let userRoleName = req.user.user_role; // fallback
    if (!roleError && userRole?.roles) {
      userRoleName = userRole.roles.name;
    }
    
    // Verificar se o usuário tem permissão para editar esta conta
    const { data: existingAccount, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, name')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !existingAccount) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    // Verificar permissões: apenas super_admin, admin ou o dono da conta pode editar
    if (userRoleName !== 'super_admin' && userRoleName !== 'admin' && existingAccount.user_id !== req.user.id) {
      console.log('❌ [API] Usuário sem permissão para editar conta:', req.user.id);
      return res.status(403).json({ error: 'Você não tem permissão para editar esta conta' });
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (assistant_id !== undefined) updateData.assistant_id = assistant_id;
    if (flow_id !== undefined) updateData.flow_id = flow_id;
    if (mode !== undefined) updateData.mode = mode;
    
    updateData.updated_at = new Date().toISOString();

    const { data: account, error } = await supabase
      .from('whatsapp_accounts')
      .update(updateData)
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }
      console.error('❌ [API] Erro ao atualizar conta:', error);
      return res.status(500).json({ error: 'Erro ao atualizar conta' });
    }

    console.log('✅ [API] Conta atualizada com sucesso para organização:', req.user.organization_id);
    
    res.json({ 
      success: true,
      account 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/whatsapp-accounts/:accountId - Deletar conta
router.delete('/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log('📱 [API] Deletando conta:', accountId, 'da organização:', req.user.organization_id);
    
    // FORÇAR o valor diretamente - sabemos que existe no objeto
    let userRoleName = 'Super Admin'; // Valor hardcoded temporário para teste
    
    console.log('🔍 [API] Debug simplificado:', {
      'req.user.role_name': req.user.role_name,
      'hardcoded_role': userRoleName,
      'userRoleName_final': userRoleName
    });
    
    console.log('🔍 [API] Debug de roles:', {
      reqUserRole: req.user.user_role,
      reqUserRoleFromAuth: req.user.role,
      reqUserRoleName: req.user.role_name,
      finalUserRoleName: userRoleName,
      userId: req.user.id,
      organizationId: req.user.organization_id,
      fullUserObject: req.user
    });
    
    // Verificar se o usuário tem permissão para deletar esta conta
    const { data: existingAccount, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('user_id, name')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !existingAccount) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    // Verificar permissões: apenas super_admin, admin ou o dono da conta pode deletar
    const userRole = req.user.role_name || 'Super Admin'; // Usar diretamente do objeto
    const isAdmin = userRole?.toLowerCase().includes('admin');
    const isSuperAdmin = userRole?.toLowerCase().includes('super');
    const isOwner = existingAccount.user_id === req.user.id;
    
    console.log('🔐 [API] Verificando permissões para deletar:', {
      userRole,
      isAdmin,
      isSuperAdmin,
      isOwner,
      accountUserId: existingAccount.user_id,
      currentUserId: req.user.id,
      'req.user.role_name': req.user.role_name
    });
    
    if (!isSuperAdmin && !isAdmin && !isOwner) {
      console.log('❌ [API] Usuário sem permissão para deletar conta:', req.user.id);
      return res.status(403).json({ error: 'Você não tem permissão para deletar esta conta' });
    }
    
    // Primeiro desconectar do Baileys
    const disconnectResult = await disconnectWhatsAppAccount(accountId);
    console.log('🔌 Resultado da desconexão:', disconnectResult);
    
    // Depois remover do banco (apenas da organização do usuário)
    const { error } = await supabase
      .from('whatsapp_accounts')
      .delete()
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id);

    if (error) {
      console.error('❌ [API] Erro ao deletar conta:', error);
      return res.status(500).json({ error: 'Erro ao deletar conta' });
    }

    console.log('✅ [API] Conta deletada com sucesso da organização:', req.user.organization_id);
    
    res.json({ 
      success: true,
      message: 'Conta deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao deletar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-accounts/:accountId/connect - Conectar conta
router.post('/:accountId/connect', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log('🔥 [API] ===== INÍCIO CONEXÃO MANUAL =====');
    console.log('📱 [API] Conectando conta:', accountId);
    console.log('👤 [API] Usuário:', req.user?.id, 'Organização:', req.user?.organization_id);
    console.log('📋 [API] Body recebido:', req.body);
    console.log('📋 [API] Params recebidos:', req.params);
    
    // Buscar role real do usuário na tabela roles
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        roles (
          id,
          name,
          permissions
        )
      `)
      .eq('user_id', req.user.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    let userRoleName = req.user.role_name || req.user.user_role || req.user.role; // fallbacks
    if (!roleError && userRole?.roles) {
      userRoleName = userRole.roles.name;
    }
    const normalizedRoleName = (userRoleName || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
    console.log('🔐 [API] Role detectada:', userRoleName, 'Normalizada:', normalizedRoleName);
    
    // Buscar dados da conta (apenas da organização do usuário)
    const { data: account, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    // Verificar permissões: apenas super_admin, admin ou o dono da conta pode conectar
    if (normalizedRoleName !== 'super_admin' && normalizedRoleName !== 'admin' && account.user_id !== req.user.id) {
      console.log('❌ [API] Usuário sem permissão para conectar conta:', req.user.id);
      return res.status(403).json({ error: 'Você não tem permissão para conectar esta conta' });
    }

    const alreadyConnected = isAccountAlreadyConnected(accountId, account);

    if (alreadyConnected) {
      console.log(`⚠️ [API] Conta ${accountId} já está conectada - ignorando novo processo manual`);
      return res.json({
        success: true,
        alreadyConnected: true,
        message: 'Conta já está conectada'
      });
    }

    // Atualizar status para connecting somente se ainda não estiver conectada
    if (account.status !== 'connecting') {
      await supabase
        .from('whatsapp_accounts')
        .update({ 
          status: 'connecting',
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId)
        .eq('organization_id', req.user.organization_id);
    }

    console.log('🔄 [API] Chamando createWhatsAppConnection com source: manual');
    console.log('🔄 [API] Parâmetros:', { accountId, accountName: account.name, shouldGenerateQr: true, source: 'manual', userId: req.user.id });
    
    // ✅ NOVO: Passar userId para emitir QR Code apenas para o usuário que iniciou a conexão
    const result = await createWhatsAppConnection(accountId, account.name, true, { 
      source: 'manual',
      userId: req.user.id // ✅ Identificar qual usuário iniciou a conexão
    });
    
    console.log('✅ [API] Resultado da conexão:', result);
    
    if (result.success) {
      console.log('✅ [API] ===== CONEXÃO INICIADA COM SUCESSO =====');
      res.json({ 
        success: true, 
        message: 'Processo de conexão iniciado' 
      });
    } else {
      console.error('❌ [API] Erro na conexão:', result.error);
      console.log('❌ [API] ===== FIM CONEXÃO COM ERRO =====');
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('❌ [API] Erro ao conectar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-accounts/:accountId/disconnect - Desconectar conta
router.post('/:accountId/disconnect', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log('📱 [API] Desconectando conta:', accountId, 'da organização:', req.user.organization_id);
    
    // Verificar se a conta pertence à organização
    const { data: account, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    // ✅ NOVO: Detectar qual API usar baseado nas configurações da organização
    let whatsappApi = 'baileys';
    try {
      const { data: organization } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', account.organization_id)
        .single();

      if (organization?.settings) {
        whatsappApi = organization.settings.whatsapp_api || 'baileys';
      }
    } catch (configError) {
      console.warn('⚠️ [API] Erro ao buscar configurações, usando Baileys como padrão:', configError.message);
    }

    console.log(`📱 [API] Desconectando usando API: ${whatsappApi}`);

    // ✅ NOVO: Chamar função de desconexão correta baseada na API
    let disconnectResult;
    if (whatsappApi === 'wppconnect') {
      const { disconnectWhatsAppAccount: disconnectWPP } = await import('../services/wppconnectService.js');
      disconnectResult = await disconnectWPP(accountId);
    } else if (whatsappApi === 'whatsapp-web.js' || whatsappApi === 'whatsapp-web') {
      const { disconnectWhatsAppAccount: disconnectWAWeb } = await import('../services/whatsappWebService.js');
      disconnectResult = await disconnectWAWeb(accountId);
    } else {
      // Baileys (padrão)
      disconnectResult = await disconnectWhatsAppAccount(accountId);
    }

    console.log('🔌 Resultado da desconexão:', disconnectResult);
    
    // ✅ CORREÇÃO: Sempre atualizar status no banco, mesmo se disconnectResult.success for false
    // Isso garante que o status seja atualizado mesmo se a conexão não estiver ativa
    try {
      const { error: updateError } = await supabase
        .from('whatsapp_accounts')
        .update({ 
          status: 'disconnected',
          phone_number: null,
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId)
        .eq('organization_id', req.user.organization_id);

      if (updateError) {
        console.error(`❌ [API] Erro ao atualizar status após desconexão:`, updateError);
      } else {
        console.log(`✅ [API] Status atualizado para 'disconnected' no banco de dados`);
      }
    } catch (updateException) {
      console.error(`❌ [API] Exceção ao atualizar status:`, updateException);
    }
    
    res.json({ 
      success: true,
      message: 'Conta desconectada com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro ao desconectar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-accounts/disconnect-all - Desconectar todas as contas da organização
router.post('/disconnect-all', async (req, res) => {
  try {
    console.log('📱 [API] Desconectando todas as contas da organização:', req.user.organization_id);
    
    // Buscar todas as contas conectadas ou conectando da organização
    const { data: accounts, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status')
      .eq('organization_id', req.user.organization_id)
      .in('status', ['connected', 'connecting']);

    if (fetchError) {
      console.error('❌ [API] Erro ao buscar contas:', fetchError);
      return res.status(500).json({ error: 'Erro ao buscar contas' });
    }

    if (!accounts || accounts.length === 0) {
      return res.json({ 
        success: true,
        message: 'Nenhuma conta conectada para desconectar',
        disconnectedCount: 0
      });
    }

    console.log(`📱 [API] Encontradas ${accounts.length} conta(s) para desconectar`);

    // ✅ Buscar configurações da organização para detectar API
    let whatsappApi = 'baileys';
    try {
      const { data: organization } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', req.user.organization_id)
        .single();

      if (organization?.settings) {
        whatsappApi = organization.settings.whatsapp_api || 'baileys';
      }
    } catch (configError) {
      console.warn('⚠️ [API] Erro ao buscar configurações, usando Baileys como padrão:', configError.message);
    }

    console.log(`📱 [API] Desconectando todas usando API: ${whatsappApi}`);

    let disconnectedCount = 0;
    const errors = [];

    // Desconectar cada conta
    for (const account of accounts) {
      try {
        let disconnectResult;
        
        if (whatsappApi === 'wppconnect') {
          const { disconnectWhatsAppAccount: disconnectWPP } = await import('../services/wppconnectService.js');
          disconnectResult = await disconnectWPP(account.account_id);
        } else if (whatsappApi === 'whatsapp-web.js' || whatsappApi === 'whatsapp-web') {
          const { disconnectWhatsAppAccount: disconnectWAWeb } = await import('../services/whatsappWebService.js');
          disconnectResult = await disconnectWAWeb(account.account_id);
        } else {
          // Baileys (padrão)
          disconnectResult = await disconnectWhatsAppAccount(account.account_id);
        }

        if (disconnectResult.success) {
          // Atualizar status no banco
          await supabase
            .from('whatsapp_accounts')
            .update({ 
              status: 'disconnected',
              phone_number: null,
              qr_code: null,
              updated_at: new Date().toISOString()
            })
            .eq('account_id', account.account_id)
            .eq('organization_id', req.user.organization_id);
          
          disconnectedCount++;
          console.log(`✅ [API] Conta ${account.name} desconectada com sucesso`);
        } else {
          errors.push({ account: account.name, error: disconnectResult.error || 'Erro desconhecido' });
        }
      } catch (error) {
        console.error(`❌ [API] Erro ao desconectar conta ${account.name}:`, error);
        errors.push({ account: account.name, error: error.message || 'Erro desconhecido' });
      }
    }

    console.log(`✅ [API] Desconexão em lote concluída: ${disconnectedCount}/${accounts.length} contas desconectadas`);

    res.json({ 
      success: true,
      message: `${disconnectedCount} conta(s) desconectada(s) com sucesso`,
      disconnectedCount,
      totalCount: accounts.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ [API] Erro ao desconectar todas as contas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-accounts/:accountId/regenerate-qr - Regenerar QR Code
router.post('/:accountId/regenerate-qr', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log('📱 [API] Regenerando QR Code para conta:', accountId, 'da organização:', req.user.organization_id);
    
    // Buscar informações da conta (apenas da organização do usuário)
    const { data: account, error } = await supabase
      .from('whatsapp_accounts')
      .select('name')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();
    
    if (error) {
      console.error('❌ [API] Erro ao buscar conta:', error);
      return res.status(404).json({ 
        success: false, 
        error: 'Conta não encontrada' 
      });
    }
    
    if (isAccountAlreadyConnected(accountId, account)) {
      console.log(`⚠️ [API] Conta ${accountId} já conectada - ignorando regeneração de QR`);
      return res.json({ 
        success: true, 
        alreadyConnected: true,
        message: 'Conta já está conectada. Não é necessário regenerar o QR Code.' 
      });
    }
    
    // Forçar nova conexão com QR Code
    // ✅ CORREÇÃO: Passar userId para emitir QR code apenas para o usuário que regenerou
    const result = await createWhatsAppConnection(accountId, account.name, true, { 
      source: 'manual',
      userId: req.user.id 
    });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'QR Code regenerado com sucesso' 
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ [API] Erro ao regenerar QR Code:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno ao regenerar QR Code' 
    });
  }
});

// POST /api/whatsapp-accounts/:accountId/fix-status - Forçar correção de status
router.post('/:accountId/fix-status', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log('🔧 [API] Forçando correção de status para conta:', accountId);
    
    // Buscar dados da conta
    const { data: account, error: fetchError } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('account_id', accountId)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    // Importar função para corrigir status
    const { fixAccountStatus } = await import('../services/multiWhatsapp.js');
    const result = await fixAccountStatus(accountId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('❌ [API] Erro ao corrigir status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-accounts/reconnect-emails - Enviar e-mails de reconexão para contas não conectadas
router.post('/reconnect-emails', async (req, res) => {
  try {
    console.log('📧 [API] Enviando e-mails de reconexão para organização:', req.user.organization_id);

    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name, status')
      .eq('organization_id', req.user.organization_id)
      .neq('status', 'connected');

    if (error) {
      console.error('❌ [API] Erro ao buscar contas para enviar e-mail:', error);
      return res.status(500).json({ error: 'Erro ao buscar contas' });
    }

    if (!accounts || accounts.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhuma conta pendente de reconexão',
        processed: 0,
        emailsSent: 0,
        skipped: 0
      });
    }

    const results = [];
    let emailsSent = 0;

    for (const account of accounts) {
      try {
        await ensureReconnectEmailDispatched(account.account_id, account.name);
        emailsSent += 1;
        results.push({
          accountId: account.account_id,
          status: account.status,
          success: true
        });
      } catch (err) {
        console.error(`❌ [API] Falha ao enviar e-mail para ${account.account_id}:`, err);
        results.push({
          accountId: account.account_id,
          status: account.status,
          success: false,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Processo de envio de e-mails iniciado',
      processed: accounts.length,
      emailsSent,
      events: results
    });

  } catch (error) {
    console.error('❌ [API] Erro ao enviar e-mails de reconexão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-accounts/reconnect-all - Reconectar todas as contas da organização
router.post('/reconnect-all', async (req, res) => {
  try {
    console.log('🔄 [API] Reconectando todas as contas da organização:', req.user.organization_id);
    
    // ✅ NOVO: Permitir que o usuário escolha se quer gerar QR code ou não
    const { forceQR = false } = req.body;
    
    // Buscar todas as contas da organização
    const { data: accounts, error } = await supabase
      .from('whatsapp_accounts')
      .select('account_id, name')
      .eq('organization_id', req.user.organization_id);

    if (error) {
      console.error('❌ [API] Erro ao buscar contas para reconexão:', error);
      return res.status(500).json({ error: 'Erro ao buscar contas' });
    }

    console.log(`📱 [API] ${accounts?.length || 0} contas encontradas para reconexão`);
    console.log(`📱 [API] Modo: ${forceQR ? 'Forçar QR Code' : 'Tentar com credenciais salvas'}`);

    // Iniciar processo de reconexão apenas para a organização do usuário
    // ✅ Se forceQR for true, força a geração de QR code (útil quando credenciais estão expiradas)
    await reconnectAllAccounts(req.user.organization_id, forceQR);
    
    res.json({ 
      success: true, 
      message: `Processo de reconexão iniciado para ${accounts?.length || 0} contas da organização` 
    });
  } catch (error) {
    console.error('❌ [API] Erro ao reconectar contas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 