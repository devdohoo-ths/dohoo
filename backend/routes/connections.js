import express from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  createWhatsAppConnection, 
  disconnectWhatsAppAccount,
  reconnectAllAccounts
} from '../services/multiWhatsapp.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// GET /api/connections - Listar todas as conexões da organização
router.get('/', async (req, res) => {
  try {
    console.log('🔗 [API] Buscando conexões da organização:', req.user.organization_id, 'Role:', req.user.user_role);
    
    let query = supabase
      .from('connection_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    // Super admins veem todas as conexões da organização
    if (req.user.user_role === 'super_admin') {
      query = query.eq('organization_id', req.user.organization_id);
    } else {
      // Outros usuários veem apenas suas próprias conexões
      query = query.eq('organization_id', req.user.organization_id)
                   .eq('user_id', req.user.id);
    }

    const { data: connections, error } = await query;

    if (error) {
      console.error('❌ [API] Erro ao buscar conexões:', error);
      return res.status(500).json({ error: 'Erro ao buscar conexões' });
    }

    console.log(`✅ [API] ${connections?.length || 0} conexões encontradas para ${req.user.user_role}`);

    // Buscar dados dos usuários manualmente
    if (connections && connections.length > 0) {
      const userIds = [...new Set([
        ...connections.map(c => c.assigned_to).filter(Boolean),
        ...connections.map(c => c.user_id).filter(Boolean)
      ])];

      console.log('🔍 Buscando dados dos usuários:', userIds);

      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) {
        console.error('❌ [API] Erro ao buscar usuários:', usersError);
      } else {
        console.log(`✅ [API] ${users?.length || 0} usuários encontrados`);
        
        // Criar mapa de usuários
        const usersMap = new Map();
        users?.forEach(user => {
          usersMap.set(user.id, user);
        });

        // Adicionar dados dos usuários às conexões
        connections.forEach(connection => {
          connection.assigned_user = usersMap.get(connection.assigned_to);
          connection.created_user = usersMap.get(connection.user_id);
        });
      }
    }
    
    res.json({ 
      success: true,
      connections: connections || []
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar conexões:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/connections - Criar nova conexão
router.post('/', async (req, res) => {
  try {
    const { name, platform, account_type, config } = req.body;
    
    if (!name || !platform) {
      return res.status(400).json({ error: 'Nome e plataforma são obrigatórios' });
    }

    console.log('🔗 [API] Criando nova conexão:', { name, platform, account_type }, 'para organização:', req.user.organization_id);
    
    // Configuração padrão baseada na plataforma
    const defaultConfig = {
      status: 'disconnected',
      ...config
    };

    // Adicionar account_type apenas para WhatsApp
    if (platform === 'whatsapp') {
      defaultConfig.account_type = account_type || 'unofficial';
    }

    // Gerar ID específico por plataforma para compatibilidade com Baileys
    let connectionId;
    if (platform === 'whatsapp') {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      connectionId = `wa_${timestamp}_${randomSuffix}`;
    } else {
      connectionId = randomUUID();
    }

    // Criar conexão no banco
    const { data: connection, error: dbError } = await supabase
      .from('connection_accounts')
      .insert([{
        id: connectionId,
        name,
        platform,
        status: 'disconnected',
        user_id: req.user.id,
        organization_id: req.user.organization_id,
        assigned_to: req.user.id,
        config: defaultConfig
      }])
      .select()
      .single();

    if (dbError) {
      console.error('❌ [API] Erro ao criar conexão no banco:', dbError);
      return res.status(500).json({ error: 'Erro ao criar conexão no banco de dados' });
    }

    console.log('✅ [API] Conexão criada com sucesso:', connection.id);
    
    // Adicionar dados do usuário à conexão criada
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', req.user.id)
      .single();

    if (!userError && user) {
      connection.assigned_user = user;
      connection.created_user = user;
    }
    
    res.json({ 
      success: true,
      connection 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao criar conexão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/connections/:id - Obter conexão específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔗 [API] Buscando conexão:', id, 'da organização:', req.user.organization_id);
    
    const { data: connection, error } = await supabase
      .from('connection_accounts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Conexão não encontrada' });
      }
      console.error('❌ [API] Erro ao buscar conexão:', error);
      return res.status(500).json({ error: 'Erro ao buscar conexão' });
    }

    res.json({ 
      success: true,
      connection 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar conexão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/connections/:id - Atualizar conexão
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, config, assigned_to } = req.body;
    
    console.log('🔗 [API] Atualizando conexão:', id, req.body);
    
    // Buscar conexão atual para mesclar configurações
    const { data: currentConnection, error: fetchError } = await supabase
      .from('connection_accounts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    
    // Mesclar configurações
    if (config !== undefined) {
      updateData.config = {
        
        ...currentConnection.config,
        ...config
      };
    }

    const { data: connection, error } = await supabase
      .from('connection_accounts')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao atualizar conexão:', error);
      return res.status(500).json({ error: 'Erro ao atualizar conexão' });
    }

    console.log('✅ [API] Conexão atualizada com sucesso');
    
    res.json({ 
      success: true,
      connection 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar conexão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/connections/:id/connect - Conectar conta
router.post('/:id/connect', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔗 [API] Conectando conta:', id);
    
    // Buscar a conexão
    const { data: connection, error: fetchError } = await supabase
      .from('connection_accounts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    // Lógica específica por plataforma
    if (connection.platform === 'whatsapp') {
      // Usar lógica existente do WhatsApp
      const result = await createWhatsAppConnection(connection.id, connection.name, true, { source: 'manual' });
      
      if (result.success) {
        // Atualizar status para connecting
        await supabase
          .from('connection_accounts')
          .update({ 
            status: 'connecting',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }
      
      res.json(result);
    } else {
      // Para outras plataformas, simular conexão bem-sucedida imediatamente
      console.log(`🔄 [API] Simulando conexão ${connection.platform} para ID: ${id}`);
      
      // Simular conexão bem-sucedida imediatamente
      const { error: connectedError } = await supabase
        .from('connection_accounts')
        .update({ 
          status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (connectedError) {
        console.error(`❌ [API] Erro ao simular conexão ${connection.platform}:`, connectedError);
        return res.status(500).json({ error: 'Erro ao conectar' });
      }

      console.log(`✅ [API] Conexão ${connection.platform} simulada como conectada para ID: ${id}`);

      res.json({
        success: true,
        message: `${connection.platform} conectado com sucesso!`,
        platform: connection.platform,
        connectionId: id
      });
    }

  } catch (error) {
    console.error('❌ [API] Erro ao conectar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/connections/:id/disconnect - Desconectar conta
router.post('/:id/disconnect', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔌 [API] Desconectando conta:', id);
    
    // Buscar a conexão
    const { data: connection, error: fetchError } = await supabase
      .from('connection_accounts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    // Lógica específica por plataforma
    if (connection.platform === 'whatsapp') {
      // Desconectar WhatsApp
      await disconnectWhatsAppAccount(connection.id);
    }
    
    // Atualizar status para disconnected
    const { error: updateError } = await supabase
      .from('connection_accounts')
      .update({ 
        status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [API] Erro ao atualizar status da conexão:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar status da conexão' });
    }

    console.log('✅ [API] Conexão desconectada com sucesso');
    
    res.json({
      success: true,
      message: `Conexão ${connection.platform} desconectada com sucesso`,
      platform: connection.platform
    });

  } catch (error) {
    console.error('❌ [API] Erro ao desconectar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/connections/:id - Deletar conexão
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔗 [API] Deletando conexão:', id);
    
    // Buscar a conexão para verificar a plataforma
    const { data: connection, error: fetchError } = await supabase
      .from('connection_accounts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    // Se for WhatsApp, desconectar primeiro
    if (connection.platform === 'whatsapp') {
      await disconnectWhatsAppAccount(connection.id);
    }
    
    // Remover do banco
    const { error } = await supabase
      .from('connection_accounts')
      .delete()
      .eq('id', id)
      .eq('organization_id', req.user.organization_id);

    if (error) {
      console.error('❌ [API] Erro ao deletar conexão:', error);
      return res.status(500).json({ error: 'Erro ao deletar conexão' });
    }

    console.log('✅ [API] Conexão deletada com sucesso');
    
    res.json({ 
      success: true,
      message: 'Conexão removida com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao deletar conexão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 