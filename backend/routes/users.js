import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { supabase, supabaseAdmin } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendEmail } from '../services/emailService.js';

// Helper para buscar role_name do usuário
async function getUserRoleName(userId) {
  if (!userId) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', userId)
    .single();
    
  if (profile && profile.role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', profile.role_id)
      .single();
    return role?.name || null;
  }
  
  return null;
}

// Helper para buscar permissions do usuário
async function getUserPermissions(userId) {
  if (!userId) return {};
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', userId)
    .single();
    
  if (profile && profile.role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('permissions')
      .eq('id', profile.role_id)
      .single();
    return role?.permissions || {};
  }
  
  return {};
}

// Configuração para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Configuração do multer para upload de avatares
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'));
    }
  }
});

// 🔧 Endpoint que o frontend chama - ADICIONAR para resolver travamentos
router.get('/check-session', async (req, res) => {
  try {
    console.log('🔍 Check session para:', req.user?.email);
    
    // Com nossa auth simplificada, sempre retorna sucesso
    res.json({
      success: true,
      hasSession: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        organization_id: req.user.organization_id,
        user_role: req.user.user_role
      }
    });
  } catch (error) {
    console.error('❌ Erro no check-session:', error);
    res.status(500).json({
      success: false,
      hasSession: false,
      error: error.message
    });
  }
});

// GET /api/users/list?organization_id=...
router.get('/list', async (req, res) => {
  const { organization_id } = req.query;
  
  if (!organization_id) {
    return res.status(400).json({ success: false, error: 'organization_id é obrigatório' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role_id, department')
    .eq('organization_id', organization_id)
    .is('deleted_at', null);

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({
    success: true,
    users: data
  });
});

// GET /users - Lista todos os usuários da organização
router.get('/', async (req, res) => {
  try {
    const { user } = req;
    const { organization_id } = req.query;
    
    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // Usar organization_id do query se fornecido, senão usar do usuário
    const targetOrgId = organization_id || user.organization_id;
    
    // REMOVER O FILTRO .is('deleted_at', null) para retornar TODOS os usuários
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, email, role_id, created_at, avatar_url, is_online, last_seen, show_name_in_chat, deleted_at')
      .eq('organization_id', targetOrgId)
      // .is('deleted_at', null) // ❌ REMOVIDO: Agora retorna todos os usuários
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro do Supabase ao buscar usuários:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
    
    // Adicionar role_name e permissions aos usuários
    const usersWithRoles = await Promise.all(
      (users || []).map(async (user) => {
        const role_name = await getUserRoleName(user.id);
        const permissions = await getUserPermissions(user.id);
        return {
          ...user,
          user_role: role_name || 'user', // Compatibilidade com frontend
          permissions: permissions // Permissions da role
        };
      })
    );
    

    res.json({ 
      success: true,
      users: usersWithRoles || [],
      total: usersWithRoles?.length || 0
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /users/inactive - Lista apenas usuários desativados
router.get('/inactive', async (req, res) => {
  try {
    console.log('👥 [API] Requisição para listar usuários desativados');
    const { user } = req;
    const { organization_id } = req.query;
    
    if (!user || !user.organization_id) {
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    const targetOrgId = organization_id || user.organization_id;
    
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, email, role_id, created_at, avatar_url, is_online, last_seen, show_name_in_chat, deleted_at')
      .eq('organization_id', targetOrgId)
      .not('deleted_at', 'is', null) // 🎯 APENAS USUÁRIOS DESATIVADOS
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Erro do Supabase ao buscar usuários desativados:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    console.log(`👥 [API] Usuários desativados encontrados: ${users?.length || 0}`);
    
    // Adicionar role_name aos usuários
    const usersWithRoles = await Promise.all(
      (users || []).map(async (user) => {
        const role_name = await getUserRoleName(user.id);
        return {
          ...user,
          user_role: role_name || 'user'
        };
      })
    );

    res.json({ 
      success: true,
      users: usersWithRoles || [],
      total: usersWithRoles?.length || 0
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar usuários desativados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter perfil do usuário
router.get('/profile', (req, res) => {
  const user = {
    id: '1',
    name: 'Admin User',
    email: 'admin@chatflow.com',
    role: 'admin',
    department: 'Suporte',
    isOnline: true,
    settings: {
      theme: 'light',
      language: 'pt',
      notifications: {
        email: true,
        push: true,
        sound: false,
        desktop: true
      }
    }
  };
  
  res.json({ user });
});

// Atualizar configurações do usuário
router.put('/settings', (req, res) => {
  const { settings } = req.body;
  
  console.log('Atualizando configurações:', settings);
  
  res.json({ 
    success: true, 
    message: 'Configurações atualizadas com sucesso' 
  });
});

// Obter usuários online
router.get('/online', (req, res) => {
  const users = [
    { id: '1', name: 'Ana Silva', role: 'Manager', isOnline: true },
    { id: '2', name: 'Carlos Santos', role: 'Agent', isOnline: true },
    { id: '4', name: 'João Oliveira', role: 'Admin', isOnline: true }
  ];
  
  res.json({ users });
});

// PATCH /api/users/:id - Atualizar usuário
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role_id, show_name_in_chat } = req.body;
    
    console.log(`✏️ [API] Atualizando usuário ${id}:`, req.body);
    console.log("req.user", req.user)
    
    if (!id) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    // Verificar se o usuário existe e pertence à organização
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (checkError || !existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Validar hierarquia se role_id está sendo alterado
    if (role_id !== undefined) {
      const currentUserRole = req.headers['x-user-role'];
      
      const { data: targetRole, error: targetRoleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', role_id)
        .single();

      if (!targetRoleError && targetRole) {
        const targetRoleName = targetRole.name?.toLowerCase();
        
        // Agentes não podem alterar roles
        if (currentUserRole === 'agent') {
          return res.status(403).json({ 
            error: 'Agentes não têm permissão para alterar roles de usuários.' 
          });
        }
        
        // Admins não podem atribuir role de super admin
        if (currentUserRole === 'admin' && 
            (targetRoleName?.includes('super') || targetRoleName?.includes('super_admin'))) {
          return res.status(403).json({ 
            error: 'Admins não podem atribuir permissões de Super Admin a usuários.' 
          });
        }
        
        console.log('✅ Hierarquia validada para atualização - Role:', targetRoleName);
      }
    }

    // Preparar dados para atualização
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role_id !== undefined) updateData.role_id = role_id;
    if (show_name_in_chat !== undefined) updateData.show_name_in_chat = show_name_in_chat;

    // Atualizar usuário
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [API] Erro ao atualizar usuário:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }

    // Se role_id foi alterado, atualizar a atribuição de role
    if (role_id !== undefined) {
      // Remover atribuições antigas
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', id)
        .is('organization_id', null)

      // Adicionar nova atribuição
      if (role_id) {
        const { error: assignmentError } = await supabase
          .from('user_roles')
          .insert({
            id: randomUUID(),
            user_id: id,
            role_id: role_id,
            organization_id: req.user.organization_id,
            assigned_by: req.user.id
          });

        if (assignmentError) {
          console.error('⚠️ Erro ao atualizar atribuição de role:', assignmentError.message);
        } else {
          console.log(`✅ Atribuição de role atualizada para usuário: ${id}`);
        }
      }
    }

    console.log('✅ [API] Usuário atualizado com sucesso');
    
    res.json({ 
      success: true,
      user: updatedUser,
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint seguro para cadastro de usuário
router.post('/invite', async (req, res) => {
  
  console.log('👤 [API] POST /users/invite - Dados recebidos:', req.body);
  console.log('👤 [API] POST /users/invite - Headers:', req.headers);
  
  let { name, email, password, role_id, organization_id, show_name_in_chat } = req.body;
  
  console.log('👤 [API] POST /users/invite - Dados extraídos:', {
    name, email, password: password ? '***' : 'undefined', role_id, organization_id, show_name_in_chat
  });
  
  if (!name || !email || !password || !organization_id) {
    console.log('❌ [API] POST /users/invite - Campos obrigatórios faltando:', {
      name: !!name, email: !!email, password: !!password, organization_id: !!organization_id
    });
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }

  try {
    // Verificar hierarquia de permissões
    // ✅ CORREÇÃO: Usar req.user do middleware authenticateToken em vez de headers
    const currentUserId = req.user?.id;
    let currentUserRole = null;
    
    // Buscar role do usuário atual do banco de dados
    if (currentUserId) {
      currentUserRole = await getUserRoleName(currentUserId);
      // Normalizar role para comparação
      if (currentUserRole) {
        const roleMapping = {
          'Super Admin': 'super_admin',
          'Admin': 'admin',
          'Administrador': 'admin',
          'Manager': 'manager',
          'Agente': 'agent',
          'Agent': 'agent'
        };
        currentUserRole = roleMapping[currentUserRole] || currentUserRole.toLowerCase();
      }
    }
    
    console.log('🔐 Validando hierarquia - Usuario atual:', currentUserRole, 'ID:', currentUserId);
    // Se não veio role_id mas veio role_name, buscar o id correspondente
    if (!role_id && role_name) {
      // Buscar role pelo nome (case-insensitive) na organização
      console.log('🔍 [DEBUG] Buscando role_name:', role_name, 'na organização:', organization_id);
      
      // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
      const { data: foundRole, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .is('organization_id', null)
        .ilike('name', role_name.trim());
        
      console.log('🔍 [DEBUG] Query resultado:', { foundRole, roleError });
      
      if (roleError) {
        console.error('❌ [DEBUG] Erro na query role:', roleError);
        return res.status(400).json({ error: 'Erro ao buscar role: ' + roleError.message });
      }
      if (!foundRole || foundRole.length === 0) {
        console.error('❌ [DEBUG] Role não encontrada. Roles disponíveis na org:');
        
        // Debug: listar todas as roles da organização
        const { data: allRoles } = await supabaseAdmin
          .from('roles')
          .select('id, name')
          .is('organization_id', null);
        
        console.log('📋 [DEBUG] Todas as roles da org:', allRoles);
        
        return res.status(400).json({ 
          error: `Role '${role_name}' não encontrada para esta organização. Verifique o nome exato da role.`,
          availableRoles: allRoles?.map(r => r.name) || []
        });
      }
      
      role_id = foundRole[0].id;
      console.log('✅ [DEBUG] Role encontrada:', foundRole[0], 'role_id definido como:', role_id);
    }


    // Validar hierarquia de permissões antes de criar o usuário
    if (role_id) {
      // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
      const { data: targetRole, error: targetRoleError } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', role_id)
        .single();

      if (!targetRoleError && targetRole) {
        const targetRoleName = targetRole.name?.toLowerCase();
        
                 // Agentes não podem criar nenhum usuário
         if (currentUserRole === 'agent') {
           console.log('❌ [API] POST /users/invite - Agente tentando criar usuário');
           return res.status(403).json({ 
             error: 'Agentes não têm permissão para criar usuários.' 
           });
         }
        
        // Admins não podem criar super admins
        if (currentUserRole === 'admin' && 
            (targetRoleName?.includes('super') || targetRoleName?.includes('super_admin'))) {
          return res.status(403).json({ 
            error: 'Admins não podem criar usuários com permissões de Super Admin.' 
          });
        }
        
        console.log('✅ Hierarquia validada - Permitindo criação de usuário com role:', targetRoleName);
      }
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // Verificar se o usuário já existe
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('email', email)
      .eq('organization_id', organization_id)
      .single();

    if (existingUser) {
      console.log(`⚠️ Usuário já existe: ${email}`);
      return res.json({ 
        success: true, 
        user_id: existingUser.id,
        existing: true,
        message: 'Usuário já existe no sistema'
      });
    }

    // 1. Criar usuário no auth
    // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth (requer SERVICE_ROLE_KEY)
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    
    if (authError) {
      return res.status(400).json({ error: 'Erro ao criar usuário: ' + authError.message });
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // 2. Criar profile (sem permissões)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userData.user.id,
        name,
        email,
        role_id: role_id, // Referência à role
        organization_id,
        show_name_in_chat: show_name_in_chat ?? true
      });
    if (profileError) {
      return res.status(400).json({ error: 'Erro ao criar perfil: ' + profileError.message });
    }

    // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
    // 3. Atribuir role ao usuário (se especificada)
    if (role_id) {
      const { error: assignmentError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          id: randomUUID(),
          user_id: userData.user.id,
          role_id: role_id,
          organization_id,
          assigned_by: req.user.id
        });

      if (assignmentError) {
        console.error('⚠️ Erro ao atribuir role:', assignmentError.message);
        // Não falha a criação do usuário se não conseguir atribuir a role
      } else {
        console.log(`✅ Role atribuída ao usuário: ${email}`);
      }
    } else {
      // ✅ CORREÇÃO: Usar cliente admin (validações de segurança feitas no middleware)
      // 4. Buscar role padrão da organização se não especificada
      const { data: defaultRole, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('is_default', true)
        .single();

      // 5. Atribuir role padrão ao usuário (se existir)
      if (defaultRole && !roleError) {
        const { error: assignmentError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            id: randomUUID(),
            user_id: userData.user.id,
            role_id: defaultRole.id,
            organization_id,
            assigned_by: req.user.id
          });

        if (assignmentError) {
          console.error('⚠️ Erro ao atribuir role padrão:', assignmentError.message);
          // Não falha a criação do usuário se não conseguir atribuir a role
        } else {
          console.log(`✅ Role padrão atribuída ao usuário: ${email}`);
        }
      } else {
        console.log(`⚠️ Nenhuma role padrão encontrada para organização: ${organization_id}`);
      }
    }

    // Verificar se o email está bloqueado no Auth
    try {
      // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth
      const { data: authUsers, error: authCheckError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (!authCheckError && authUsers?.users) {
        const existingAuthUser = authUsers.users.find(u => u.email === email);
        
        if (existingAuthUser) {
          console.log(`⚠️ Email ${email} existe no Auth mas não no profiles`);
          
          // Tentar excluir o usuário órfão do Auth
          try {
            // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth
            const { error: orphanDeleteError } = await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
            
            if (orphanDeleteError) {
              console.warn(`⚠️ Não foi possível excluir usuário órfão ${existingAuthUser.id}:`, orphanDeleteError.message);
            }
          } catch (orphanError) {
            console.warn(`⚠️ Erro ao tentar remover usuário órfão:`, orphanError.message);
          }
        }
      }
    } catch (authListError) {
      console.warn(`⚠️ Erro ao verificar usuários no Auth:`, authListError.message);
    }

    console.log(`✅ Novo usuário criado: ${email}`);
    return res.json({ 
      success: true, 
      user_id: userData.user.id,
      user: userData.user,
      existing: false,
      message: 'Usuário criado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint seguro para exclusão de usuário (soft delete)
router.delete('/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'ID do usuário não fornecido.' });
  }

  try {
    
    // Passo 0: Excluir todos os convites relacionados ao usuário na tabela whatsapp_invites
    const { error: inviteError } = await supabase
      .from('whatsapp_invites')
      .delete()
      .eq('user_id', userId);
    if (inviteError) {
      console.error('Erro ao excluir convites whatsapp:', inviteError.message);
      throw new Error(`Erro ao excluir convites whatsapp: ${inviteError.message}`);
    }

    // Passo 1: Soft delete do perfil do usuário (atualizar deleted_at)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    if (profileError) {
      console.error('Erro ao desativar perfil:', profileError.message);
      throw new Error(`Erro ao desativar perfil do usuário: ${profileError.message}`);
    }

    // Passo 2: EXCLUIR DEFINITIVAMENTE o usuário do Supabase Auth
    try {
      console.log(`🔐 Tentando excluir usuário ${userId} da autenticação...`);
      // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error(`❌ Erro ao excluir usuário ${userId} da autenticação:`, authError.message);
        
        // Se o erro for "User not found", não é um problema
        if (authError.message.includes('User not found') || authError.message.includes('not found')) {
          console.log(`ℹ️ Usuário ${userId} já não existe na autenticação`);
        } else {
          // Para outros erros, tentar uma abordagem alternativa
          console.log(` Tentando abordagem alternativa para excluir usuário ${userId}...`);
          
          // Tentar desabilitar o usuário primeiro
          // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth
          const { error: disableError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { disabled: true },
            app_metadata: { disabled: true }
          });
          
          if (disableError) {
            console.warn(`⚠️ Não foi possível desabilitar usuário ${userId}:`, disableError.message);
          } else {
            console.log(`✅ Usuário ${userId} desabilitado como alternativa`);
          }
        }
      } else {
        console.log(`✅ Usuário ${userId} excluído da autenticação com sucesso.`);
      }
    } catch (authDeleteError) {
      console.error(`❌ Erro inesperado ao excluir usuário ${userId} da autenticação:`, authDeleteError.message);
      
      // Tentar uma abordagem de fallback
      try {
        console.log(`🔄 Tentando fallback para usuário ${userId}...`);
        
        // Verificar se o usuário existe no Auth
        // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth
        const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (getUserError) {
          console.log(`ℹ️ Usuário ${userId} não encontrado na autenticação`);
        } else if (authUser?.user) {
          console.log(`⚠️ Usuário ${userId} ainda existe no Auth, mas não foi possível excluir`);
          // Aqui você pode implementar uma lógica adicional se necessário
        }
      } catch (fallbackError) {
        console.error(`❌ Erro no fallback para usuário ${userId}:`, fallbackError.message);
      }
    }
    
    return res.json({ success: true, message: 'Usuário desativado com sucesso.' });

  } catch (error) {
    console.error('Falha na operação de exclusão do usuário:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint para alteração de senha de usuário por admin
router.put('/:userId/password', async (req, res) => {
  const { userId } = req.params;
  const { password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'ID do usuário e nova senha são obrigatórios.' });
  }

  try {
    // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) {
      console.error('Erro ao alterar senha:', error.message);
      return res.status(400).json({ error: 'Erro ao alterar senha: ' + error.message });
    }
    return res.json({ success: true, message: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('Erro inesperado ao alterar senha:', err);
    return res.status(500).json({ error: 'Erro inesperado ao alterar senha.' });
  }
});

// Endpoint para reativar usuário (soft undelete)
router.patch('/:userId/restore', async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
  }
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', userId);
    if (error) {
      return res.status(400).json({ error: 'Erro ao reativar usuário: ' + error.message });
    }
    return res.json({ success: true, message: 'Usuário reativado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro inesperado ao reativar usuário.' });
  }
});

// Endpoint para hard delete (exclusão definitiva)
router.delete('/:userId/hard', async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
  }
  
  try {
    // Passo 1: Excluir convites relacionados
    const { error: inviteError } = await supabase
      .from('whatsapp_invites')
      .delete()
      .eq('user_id', userId);
    
    if (inviteError) {
      console.warn(`⚠️ Aviso: Erro ao excluir convites do usuário ${userId}:`, inviteError.message);
    }

    // Passo 2: Atualizar user_roles onde este usuário é referenciado como assigned_by
    // Isso resolve a constraint user_roles_assigned_by_fkey
    const { error: assignedByError } = await supabase
      .from('user_roles')
      .update({ assigned_by: null })
      .eq('assigned_by', userId);
    
    if (assignedByError) {
      console.warn(`⚠️ Aviso: Erro ao atualizar user_roles (assigned_by) do usuário ${userId}:`, assignedByError.message);
    }

    // Passo 3: Excluir user_roles relacionados (onde este usuário é o user_id)
    const { error: userRolesError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    
    if (userRolesError) {
      console.warn(`⚠️ Aviso: Erro ao excluir user_roles do usuário ${userId}:`, userRolesError.message);
    }

    // Passo 4: Remover usuário como agente atribuído nos chats (RESOLVE O CONSTRAINT)
    const { error: chatsError } = await supabase
      .from('chats')
      .update({ assigned_agent_id: null })
      .eq('assigned_agent_id', userId);
    
    if (chatsError) {
      console.warn(`⚠️ Aviso: Erro ao remover usuário dos chats ${userId}:`, chatsError.message);
    }

    // Passo 5: Excluir configurações do usuário (user_settings)
    const { error: settingsError } = await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', userId);
    
    if (settingsError) {
      console.warn(`⚠️ Aviso: Erro ao excluir configurações do usuário ${userId}:`, settingsError.message);
    }

    // Passo 6: Excluir profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) {
      console.error(`❌ Erro ao excluir perfil do usuário ${userId}:`, profileError.message);
      throw new Error(`Erro ao excluir perfil: ${profileError.message}`);
    }

    // Passo 7: EXCLUIR DEFINITIVAMENTE do Auth
    try {
      // ✅ CORREÇÃO: Usar supabaseAdmin para operações admin do auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error(`❌ Erro ao excluir usuário ${userId} da autenticação:`, authError.message);
        
        // Se o erro for "User not found", não é um problema
        if (!authError.message.includes('User not found') && !authError.message.includes('not found')) {
          // Para outros erros, tentar desabilitar o usuário
          const { error: disableError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { disabled: true },
            app_metadata: { disabled: true }
          });
          
          if (disableError) {
            console.warn(`⚠️ Não foi possível desabilitar usuário ${userId}:`, disableError.message);
          }
        }
      }
    } catch (authDeleteError) {
      console.error(`❌ Erro inesperado ao excluir usuário ${userId} da autenticação:`, authDeleteError.message);
    }

    return res.json({ success: true, message: 'Usuário removido definitivamente.' });
    
  } catch (err) {
    console.error(`❌ Erro inesperado ao remover usuário ${userId}:`, err);
    return res.status(500).json({ error: 'Erro inesperado ao remover usuário.' });
  }
});

// Endpoint para upload de avatar
router.post('/:userId/avatar', avatarUpload.single('avatar'), async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
  }

  try {
    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Gerar URL do avatar
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Atualizar o perfil do usuário com a nova URL do avatar
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar URL do avatar:', updateError.message);
      return res.status(500).json({ error: 'Erro ao salvar avatar.' });
    }

    return res.json({ success: true, message: 'Avatar atualizado com sucesso!', avatarUrl });

  } catch (err) {
    console.error('Erro inesperado ao fazer upload do avatar:', err);
    return res.status(500).json({ error: 'Erro inesperado ao fazer upload do avatar.' });
  }
});

// Novo endpoint para verificar organização por email
router.post('/check-organization', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  try {
    // Extrair domínio do email
    const domain = email.split('@')[1];
    
    // Buscar organização pelo domínio
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('id, name, domain')
      .eq('domain', domain)
      .single();

    if (error || !organization) {
      return res.status(404).json({ 
        error: 'Organização não encontrada para este domínio',
        domain 
      });
    }

    return res.json({
      success: true,
      organization,
      redirectUrl: `https://${organization.domain}`
    });

  } catch (error) {
    console.error('Erro ao verificar organização:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para enviar email de boas-vindas + convite WhatsApp
router.post('/send-welcome-email', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Dados obrigatórios faltando: name, email, password' });
    }

    console.log('📧 [API] Enviando email de boas-vindas + convite WhatsApp para:', email);

    // Verificar configurações de email
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ Configurações de email não encontradas.');
      return res.json({ 
        success: false, 
        message: 'Configurações de email não encontradas.' 
      });
    }

    // 1. Buscar o usuário criado para pegar user_id e role
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select(`
        id, 
        organization_id, 
        role_id,
        roles!inner(name)
      `)
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('❌ Usuário não encontrado:', userError);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // 2. Buscar dados completos da organização (nome + domínio)
    const { data: org } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', user.organization_id)
      .single();

    const organizationName = org?.name || 'Sua Organização';
    const organizationDomain = org?.domain || null;

    console.log('📋 [DEBUG] Organização:', { name: organizationName, domain: organizationDomain });

    // 3. Gerar token único para convite WhatsApp
    const crypto = await import('crypto');
    const whatsappToken = crypto.randomBytes(32).toString('hex');
    
    // 4. Criar convite WhatsApp
    // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (política requer auth.uid() que não está disponível no backend)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('whatsapp_invites')
      .insert({
        user_id: user.id,
        organization_id: user.organization_id,
        token: whatsappToken,
        email,
        name,
        user_role: user.roles.name,
        permissions: {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      })
      .select()
      .single();

    if (inviteError) {
      console.error('❌ Erro ao criar convite WhatsApp:', inviteError);
      // Continua mesmo assim, apenas sem o link WhatsApp
    }

    // 5. Gerar links
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.FRONTEND_URL;
    
    const whatsappLink = isDevelopment 
      ? `http://localhost:8080/connect-whatsapp/${whatsappToken}`
      : `${process.env.FRONTEND_URL}/connect-whatsapp/${whatsappToken}`;

    // Link de acesso da organização
    const accessLink = organizationDomain 
      ? `https://${organizationDomain}` 
      : (isDevelopment ? 'http://localhost:8080' : process.env.FRONTEND_URL);

    // 6. Template completo: Credenciais + Domínio + WhatsApp
    const welcomeEmailTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bem-vindo ao Dohoo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3; }
          .access-section { background: #f0f8ff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50; }
          .whatsapp-section { background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #25D366; }
          .button { display: inline-block; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: bold; }
          .button-primary { background: #4CAF50; }
          .button-whatsapp { background: #25D366; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .domain-highlight { background: #fff; padding: 10px; border-radius: 3px; font-family: monospace; border: 1px solid #ddd; display: inline-block; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Bem-vindo ao Dohoo!</h1>
            <p>Sua conta foi criada com sucesso em <strong>${organizationName}</strong></p>
          </div>
          
          <div class="content">
            <h2>Olá ${name}!</h2>
            
            <p>Sua conta foi criada com sucesso na plataforma Dohoo. Siga os passos abaixo para começar:</p>
            
            <div class="credentials">
              <h3>🔐 Suas credenciais de acesso:</h3>
              <p><strong>Domain:</strong> ${organizationDomain || accessLink}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Senha:</strong> ${password}</p>
              <p><strong>Role:</strong> ${user.roles.name}</p>
            </div>
            
            <div class="whatsapp-section">
              <h3>📱 Conectar WhatsApp</h3>
              <p>Para usar todas as funcionalidades, conecte seu WhatsApp clicando no botão abaixo:</p>
              <div style="text-align: center;">
                <a href="${whatsappLink}" class="button button-whatsapp">
                  🔗 Conectar WhatsApp
                </a>
              </div>
              <p><strong>Importante:</strong> Este link é único e expira em 7 dias.</p>
            </div>
            
            <p><strong>Próximos passos:</strong></p>
            <ol>
              <li>🌐 <strong>Acesse a plataforma</strong> usando o link ${organizationDomain ? `<strong>${organizationDomain}</strong>` : 'acima'}</li>
              <li>🔐 <strong>Faça login</strong> com suas credenciais</li>
              <li>📱 <strong>Conecte seu WhatsApp</strong> usando o botão verde</li>
              <li>⚙️ <strong>Configure seu perfil</strong> conforme necessário</li>
            </ol>
            
            <p>Se você tiver alguma dúvida, entre em contato com o administrador da ${organizationName}.</p>
          </div>
          
          <div class="footer">
            <p>Este é um email automático do sistema Dohoo. Não responda a este email.</p>
            <p>© 2024 Dohoo. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 7. Enviar email
    const { sendEmail } = await import('../services/emailService.js');
    
    const result = await sendEmail(
      email,
      `🎉 Bem-vindo ao Dohoo - ${organizationName}`,
      welcomeEmailTemplate
    );

    if (result.success) {
      console.log('✅ Email completo enviado para:', email, 'com domínio:', organizationDomain);
      return res.json({ 
        success: true, 
        message: 'Email de boas-vindas enviado com sucesso',
        organizationDomain: organizationDomain,
        whatsappLink: whatsappLink
      });
    } else {
      console.error('❌ Erro ao enviar email:', result.error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao enviar email: ' + result.error 
      });
    }

  } catch (error) {
    console.error('❌ Erro geral ao enviar email de boas-vindas:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para enviar convite individual para um usuário
router.post('/:userId/invite', async (req, res) => {
  try {
    const { userId } = req.params;
    const { user } = req;
    
    console.log('📧 [API] POST /users/:userId/invite - Enviando convite para usuário:', userId);
    
    // ✅ SEGURANÇA: Verificar autenticação e organização
    if (!user || !user.organization_id) {
      console.log('❌ [API] Usuário não autenticado ou sem organização');
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // ✅ SEGURANÇA: Buscar dados do usuário APENAS da organização do usuário autenticado
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        role_id,
        organization_id,
        roles!inner(name)
      `)
      .eq('id', userId)
      .eq('organization_id', user.organization_id) // ✅ CRÍTICO: Garantir que só acessa usuários da mesma organização
      .single();

    if (userError || !targetUser) {
      console.error('❌ [API] Usuário não encontrado ou não pertence à organização:', userError);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // ✅ SEGURANÇA: Verificar se o usuário que está enviando o convite tem permissão
    const currentUserRole = await getUserRoleName(user.id);
    if (currentUserRole === 'agent') {
      console.log('❌ [API] Agente tentando enviar convite:', user.id);
      return res.status(403).json({ 
        error: 'Agentes não têm permissão para enviar convites.' 
      });
    }

    // ✅ SEGURANÇA: Buscar dados da organização APENAS da organização do usuário autenticado
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, domain')
      .eq('id', user.organization_id) // ✅ CRÍTICO: Garantir que só acessa dados da própria organização
      .single();

    if (orgError || !org) {
      console.error('❌ [API] Organização não encontrada:', orgError);
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    const organizationName = org.name || 'Sua Organização';
    const organizationDomain = org.domain || null;

    // ✅ SEGURANÇA: Gerar token único para convite WhatsApp
    const crypto = await import('crypto');
    const whatsappToken = crypto.randomBytes(32).toString('hex');
    
    // ✅ SEGURANÇA: Criar convite WhatsApp APENAS para a organização correta
    // ✅ CORREÇÃO: Usar supabaseAdmin para bypassar RLS (política requer auth.uid() que não está disponível no backend)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('whatsapp_invites')
      .insert({
        user_id: targetUser.id,
        organization_id: user.organization_id, // ✅ CRÍTICO: Usar organization_id do usuário autenticado
        token: whatsappToken,
        email: targetUser.email,
        name: targetUser.name,
        user_role: targetUser.roles.name,
        permissions: {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      })
      .select()
      .single();

    if (inviteError) {
      console.error('❌ [API] Erro ao criar convite WhatsApp:', inviteError);
      return res.status(500).json({ error: 'Erro ao criar convite' });
    }

    // ✅ CORRIGIDO: Usar apiBase em vez de hardcode
    const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    // Gerar links usando variáveis de ambiente
    const whatsappLink = `${frontendUrl}/connect-whatsapp/${whatsappToken}`;

    // Link de acesso da organização
    const accessLink = organizationDomain 
      ? `https://${organizationDomain}` 
      : frontendUrl;

    // Template do email de convite
    const inviteEmailTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Convite WhatsApp - Dohoo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .whatsapp-section { background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #25D366; }
          .button { display: inline-block; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: bold; }
          .button-whatsapp { background: #25D366; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> Convite WhatsApp - Dohoo</h1>
            <p>Conecte seu WhatsApp na plataforma <strong>${organizationName}</strong></p>
          </div>
          
          <div class="content">
            <h2>Olá ${targetUser.name}!</h2>
            
            <p>Você recebeu um convite para conectar seu WhatsApp na plataforma Dohoo.</p>
            
            <div class="whatsapp-section">
              <h3>🔗 Conectar WhatsApp</h3>
              <p>Clique no botão abaixo para conectar seu WhatsApp:</p>
              <div style="text-align: center;">
                <a href="${whatsappLink}" class="button button-whatsapp">
                   Conectar WhatsApp
                </a>
              </div>
              <p><strong>Importante:</strong> Este link é único e expira em 7 dias.</p>
            </div>
            
            <p><strong>Próximos passos:</strong></p>
            <ol>
              <li>🌐 <strong>Acesse a plataforma</strong> em ${accessLink}</li>
              <li> <strong>Faça login</strong> com suas credenciais</li>
              <li>📱 <strong>Conecte seu WhatsApp</strong> usando o botão verde</li>
            </ol>
            
            <p>Se você tiver alguma dúvida, entre em contato com o administrador da ${organizationName}.</p>
          </div>
          
          <div class="footer">
            <p>Este é um email automático do sistema Dohoo. Não responda a este email.</p>
            <p>© 2024 Dohoo. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email
    const { sendEmail } = await import('../services/emailService.js');
    
    const result = await sendEmail(
      targetUser.email,
      ` Convite WhatsApp - ${organizationName}`,
      inviteEmailTemplate
    );

    if (result.success) {
      console.log('✅ [API] Convite enviado com sucesso para:', targetUser.email, 'da organização:', user.organization_id);
      return res.json({ 
        success: true, 
        message: 'Convite enviado com sucesso!',
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email
        }
      });
    } else {
      console.error('❌ [API] Erro ao enviar convite:', result.error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao enviar email: ' + result.error 
      });
    }

  } catch (error) {
    console.error('❌ [API] Erro geral ao enviar convite:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// ✅ NOVO: Rota para gerar link de conexão sem enviar email
router.post('/:userId/generate-link', async (req, res) => {
  try {
    const { userId } = req.params;
    const { user } = req;
    
    console.log('🔗 [API] POST /users/:userId/generate-link - Gerando link de conexão para usuário:', userId);
    
    // ✅ SEGURANÇA: Verificar autenticação e organização
    if (!user || !user.organization_id) {
      console.log('❌ [API] Usuário não autenticado ou sem organização');
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    // ✅ SEGURANÇA: Buscar dados do usuário APENAS da organização do usuário autenticado
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        role_id,
        organization_id,
        roles!inner(name)
      `)
      .eq('id', userId)
      .eq('organization_id', user.organization_id)
      .single();

    if (userError || !targetUser) {
      console.error('❌ [API] Usuário não encontrado ou não pertence à organização:', userError);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // ✅ SEGURANÇA: Verificar se o usuário que está gerando o link tem permissão
    const currentUserRole = await getUserRoleName(user.id);
    if (currentUserRole === 'agent') {
      console.log('❌ [API] Agente tentando gerar link:', user.id);
      return res.status(403).json({ 
        error: 'Agentes não têm permissão para gerar links de conexão.' 
      });
    }

    // ✅ SEGURANÇA: Gerar token único para convite WhatsApp
    const crypto = await import('crypto');
    const whatsappToken = crypto.randomBytes(32).toString('hex');
    
    // ✅ SEGURANÇA: Criar convite WhatsApp APENAS para a organização correta
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('whatsapp_invites')
      .insert({
        user_id: targetUser.id,
        organization_id: user.organization_id,
        token: whatsappToken,
        email: targetUser.email,
        name: targetUser.name,
        user_role: targetUser.roles.name,
        permissions: {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      })
      .select()
      .single();

    if (inviteError) {
      console.error('❌ [API] Erro ao criar convite WhatsApp:', inviteError);
      return res.status(500).json({ error: 'Erro ao criar convite' });
    }

    // Gerar link usando variáveis de ambiente
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const whatsappLink = `${frontendUrl}/connect-whatsapp/${whatsappToken}`;

    console.log('✅ [API] Link de conexão gerado com sucesso para:', targetUser.email);
    return res.json({ 
      success: true, 
      message: 'Link de conexão gerado com sucesso!',
      link: whatsappLink,
      token: whatsappToken,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao gerar link:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// ✅ ADICIONADO: Rota para redefinir senha (sem autenticação)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    console.log('🔐 [API] POST /users/reset-password - Redefinindo senha');
    
    if (!token || !password) {
      console.log('❌ [API] Token ou senha não fornecidos');
      return res.status(400).json({ 
        error: 'Token e nova senha são obrigatórios' 
      });
    }

    // ✅ SEGURANÇA: Validar força da senha
    if (password.length < 6) {
      console.log('❌ [API] Senha muito fraca');
      return res.status(400).json({ 
        error: 'A senha deve ter pelo menos 6 caracteres' 
      });
    }

    // ✅ SEGURANÇA: Usar Supabase para redefinir senha
    const { data, error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('❌ [API] Erro ao redefinir senha:', error);
      return res.status(400).json({ 
        error: error.message || 'Erro ao redefinir senha' 
      });
    }

    console.log('✅ [API] Senha redefinida com sucesso para:', data.user?.email);
    
    res.json({ 
      success: true, 
      message: 'Senha redefinida com sucesso',
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro inesperado ao redefinir senha:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// ✅ ADICIONADO: Rota para verificar token de redefinição
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    console.log('🔐 [API] POST /users/verify-reset-token - Verificando token');
    
    if (!token) {
      console.log('❌ [API] Token não fornecido');
      return res.status(400).json({ 
        error: 'Token é obrigatório' 
      });
    }

    // ✅ SEGURANÇA: Verificar se o token é válido
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log('❌ [API] Token inválido ou expirado');
      return res.status(400).json({ 
        error: 'Token inválido ou expirado' 
      });
    }

    console.log('✅ [API] Token válido para usuário:', user.email);
    
    res.json({ 
      success: true, 
      message: 'Token válido',
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro inesperado ao verificar token:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

export default router;