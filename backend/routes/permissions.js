import express from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';
import { PERMISSION_MODULES } from '../config/permissionModules.js';

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// GET /api/permissions/roles - Listar todas as roles (globais + da organização)
router.get('/roles', async (req, res) => {
  try {
    // Buscar roles globais (organization_id IS NULL)
    const { data: globalRoles, error: globalError } = await supabase
      .from('roles')
      .select('*')
      .is('organization_id', null)
      .order('name');

    if (globalError) {
      console.error('❌ [API] Erro ao buscar roles globais:', globalError);
      return res.status(500).json({ error: 'Erro ao buscar roles globais' });
    }

    // Buscar roles customizadas da organização
    const { data: customRoles, error: customError } = await supabase
      .from('roles')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .order('name');

    if (customError) {
      console.error('❌ [API] Erro ao buscar roles customizadas:', customError);
      return res.status(500).json({ error: 'Erro ao buscar roles customizadas' });
    }

    // Combinar roles globais e customizadas
    const allRoles = [...(globalRoles || []), ...(customRoles || [])];

    // Buscar contagem de usuários por role
    if (allRoles && allRoles.length > 0) {
      for (const role of allRoles) {
        const { count, error: countError } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.id)
          .eq('organization_id', req.user.organization_id);

        if (!countError) {
          role.user_count = count || 0;
        } else {
          role.user_count = 0;
        }
      }
    }
    
    res.json({ 
      success: true,
      roles: allRoles || [],
      globalRoles: globalRoles || [],
      customRoles: customRoles || []
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar roles:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/permissions/roles - Criar nova role (apenas customizada)
router.post('/roles', async (req, res) => {
  try {
    const { name, description, permissions, is_default = false, based_on_default_role } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da role é obrigatório' });
    }

    console.log('🔐 [API] Criando nova role customizada:', { name, description }, 'para organização:', req.user.organization_id);
    
    let finalPermissions = permissions || {};
    
    // Se foi especificado uma role padrão como base, buscar suas permissões
    if (based_on_default_role && based_on_default_role !== 'none') {
      const { data: defaultRole, error: defaultRoleError } = await supabase
        .from('roles')
        .select('permissions')
        .is('organization_id', null) // Buscar apenas roles globais
        .eq('name', based_on_default_role)
        .single();

      if (!defaultRoleError && defaultRole) {
        // Mesclar permissões da role padrão com as permissões fornecidas
        finalPermissions = { ...defaultRole.permissions, ...permissions };
        console.log('✅ [API] Usando role padrão como base:', based_on_default_role);
      } else {
        console.log('⚠️ [API] Role padrão não encontrada, usando permissões fornecidas');
      }
    }
    
    // Se esta role será padrão, desativar todas as outras roles padrão da organização
    if (is_default) {
      console.log('🔄 [API] Desativando outras roles padrão da organização');
      const { error: updateError } = await supabase
        .from('roles')
        .update({ is_default: false })
        .eq('organization_id', req.user.organization_id)
        .eq('is_default', true);

      if (updateError) {
        console.error('❌ [API] Erro ao desativar outras roles padrão:', updateError);
        return res.status(500).json({ error: 'Erro ao gerenciar roles padrão' });
      }
      console.log('✅ [API] Outras roles padrão desativadas com sucesso');
    }
    
    // Gerar ID único para a role
    const roleId = randomUUID();
    
    const { data: role, error } = await supabase
      .from('roles')
      .insert([{
        id: roleId,
        name,
        description,
        permissions: finalPermissions,
        is_default,
        organization_id: req.user.organization_id
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao criar role:', error);
      return res.status(500).json({ error: 'Erro ao criar role' });
    }

    console.log('✅ [API] Role customizada criada com sucesso:', role.id);
    
    res.json({ 
      success: true,
      role 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao criar role:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/permissions/roles/:id - Obter role específica
router.get('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔐 [API] Buscando role:', id);
    
    // Buscar role (pode ser global ou da organização)
    const { data: role, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', id)
      .or(`organization_id.is.null,organization_id.eq.${req.user.organization_id}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Role não encontrada' });
      }
      console.error('❌ [API] Erro ao buscar role:', error);
      return res.status(500).json({ error: 'Erro ao buscar role' });
    }

    res.json({ 
      success: true,
      role 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar role:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/permissions/roles/:id - Atualizar role (apenas customizadas)
router.patch('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, is_default } = req.body;
    
    console.log('🔐 [API] Atualizando role:', id, req.body);
    
    // Verificar se a role existe
    const { data: existingRole, error: checkError } = await supabase
      .from('roles')
      .select('organization_id')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('❌ [API] Erro ao verificar role:', checkError);
      return res.status(500).json({ error: 'Erro ao verificar role' });
    }

    // 🎯 VERIFICAR SE É SUPER ADMIN
    let isSuperAdmin = false;
    if (req.user.role_id) {
      try {
        const { data: role } = await supabase
          .from('roles')
          .select('name')
          .eq('id', req.user.role_id)
          .single();
        
        if (role && role.name === 'Super Admin') {
          isSuperAdmin = true;
          console.log('✅ [API] Super admin detectado - pode editar roles globais');
        }
      } catch (error) {
        console.log('🔐 [API] Erro ao verificar role para Super Admin:', error.message);
      }
    }

    // Verificar permissões baseado no tipo de role
    if (!existingRole.organization_id) {
      // Role global - apenas Super Admin pode editar
      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Não é possível editar roles globais do sistema' });
      }
      console.log('✅ [API] Super Admin editando role global');
    } else {
      // Role customizada - verificar se pertence à organização do usuário
      if (existingRole.organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      console.log('✅ [API] Editando role customizada da organização');
    }
    
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (is_default !== undefined) updateData.is_default = is_default;

    // Se esta role será marcada como padrão
    if (is_default === true) {
      if (!existingRole.organization_id) {
        // Role global - desativar todas as outras roles globais padrão
        console.log('🔄 [API] Desativando outras roles globais padrão');
        const { error: updateError } = await supabase
          .from('roles')
          .update({ is_default: false })
          .is('organization_id', null)
          .eq('is_default', true)
          .neq('id', id);

        if (updateError) {
          console.error('❌ [API] Erro ao desativar outras roles globais padrão:', updateError);
          return res.status(500).json({ error: 'Erro ao gerenciar roles padrão' });
        }
      } else {
        // Role customizada - desativar outras roles padrão da organização
        console.log('🔄 [API] Desativando outras roles padrão da organização');
        const { error: updateError } = await supabase
          .from('roles')
          .update({ is_default: false })
          .eq('organization_id', req.user.organization_id)
          .eq('is_default', true)
          .neq('id', id);

        if (updateError) {
          console.error('❌ [API] Erro ao desativar outras roles padrão:', updateError);
          return res.status(500).json({ error: 'Erro ao gerenciar roles padrão' });
        }
      }
      console.log('✅ [API] Outras roles padrão desativadas com sucesso');
    }

    // Atualizar a role
    let updateQuery = supabase
      .from('roles')
      .update(updateData)
      .eq('id', id);

    // Adicionar filtro de organização apenas para roles customizadas
    if (existingRole.organization_id) {
      updateQuery = updateQuery.eq('organization_id', req.user.organization_id);
    }

    const { data: role, error } = await updateQuery.select().single();

    if (error) {
      console.error('❌ [API] Erro ao atualizar role:', error);
      return res.status(500).json({ error: 'Erro ao atualizar role' });
    }

    console.log('✅ [API] Role atualizada com sucesso');
    
    res.json({ 
      success: true,
      role,
      message: 'Role atualizada. Os usuários podem precisar fazer logout para aplicar as novas permissões.'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar role:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/permissions/roles/:id - Deletar role
router.delete('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔐 [API] Deletando role:', id);
    
    // Verificar se a role existe
    const { data: existingRole, error: checkError } = await supabase
      .from('roles')
      .select('organization_id, is_default')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('❌ [API] Erro ao verificar role:', checkError);
      return res.status(500).json({ error: 'Erro ao verificar role' });
    }

    // 🎯 VERIFICAR SE É SUPER ADMIN
    let isSuperAdmin = false;
    if (req.user.role_id) {
      try {
        const { data: role } = await supabase
          .from('roles')
          .select('name')
          .eq('id', req.user.role_id)
          .single();
        
        if (role && role.name === 'Super Admin') {
          isSuperAdmin = true;
          console.log('✅ [API] Super admin detectado - pode deletar roles globais');
        }
      } catch (error) {
        console.log('🔐 [API] Erro ao verificar role para Super Admin:', error.message);
      }
    }

    // Verificar permissões baseado no tipo de role
    if (!existingRole.organization_id) {
      // Role global - apenas Super Admin pode deletar
      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Não é possível deletar roles globais do sistema' });
      }
      
      // Não permitir deletar roles padrão globais
      if (existingRole.is_default) {
        return res.status(403).json({ error: 'Não é possível deletar roles padrão globais' });
      }
      
      console.log('✅ [API] Super Admin deletando role global');
    } else {
      // Role customizada - verificar se pertence à organização do usuário
      if (existingRole.organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      
      // Não permitir deletar roles padrão da organização
      if (existingRole.is_default) {
        return res.status(403).json({ error: 'Não é possível deletar roles padrão da organização' });
      }
      
      console.log('✅ [API] Deletando role customizada da organização');
    }

    // Deletar a role
    let deleteQuery = supabase
      .from('roles')
      .delete()
      .eq('id', id);

    // Adicionar filtro de organização apenas para roles customizadas
    if (existingRole.organization_id) {
      deleteQuery = deleteQuery.eq('organization_id', req.user.organization_id);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('❌ [API] Erro ao deletar role:', error);
      return res.status(500).json({ error: 'Erro ao deletar role' });
    }

    console.log('✅ [API] Role deletada com sucesso');
    
    res.json({ 
      success: true,
      message: 'Role deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao deletar role:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/permissions/modules - Obter módulos e permissões disponíveis (da constante)
router.get('/modules', async (req, res) => {
  try {
    console.log('🔐 [API] Buscando módulos e permissões da configuração');
    
    // ✅ RETORNAR MÓDULOS DA CONSTANTE (nada fixo no frontend, tudo vem do backend)
    res.json({ 
      success: true,
      modules: PERMISSION_MODULES
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar módulos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/permissions/default-roles - Obter roles padrão do sistema (globais)
router.get('/default-roles', async (req, res) => {
  try {
    console.log('🔐 [API] Buscando roles padrão do sistema (globais)');
    
    const { data: defaultRoles, error } = await supabase
      .from('roles')
      .select('*')
      .is('organization_id', null) // Apenas roles globais
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Erro ao buscar roles padrão:', error);
      return res.status(500).json({ error: 'Erro ao buscar roles padrão' });
    }

    console.log(`✅ [API] ${defaultRoles?.length || 0} roles padrão encontradas`);
    
    res.json({ 
      success: true,
      defaultRoles: defaultRoles || []
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar roles padrão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/permissions/user-permissions - Buscar permissões do usuário logado
router.get('/user-permissions', async (req, res) => {
  try {
    console.log('🔐 [API] Buscando permissões do usuário:', req.user.id);
    console.log('🔐 [API] Dados do usuário:', {
      id: req.user.id,
      user_role: req.user.user_role,
      role_id: req.user.role_id,
      organization_id: req.user.organization_id
    });
    
    let permissions = {};
    let role_id = null;
    let role_name = null;

    // 🎯 DETERMINAR SE É SUPER ADMIN BASEADO NO ROLE_ID
    let isSuperAdmin = false;
    
    if (req.user.role_id) {
      try {
        const { data: role } = await supabase
          .from('roles')
          .select('name')
          .eq('id', req.user.role_id)
          .single();
        
        if (role && role.name === 'Super Admin') {
          isSuperAdmin = true;
          console.log('✅ [API] Super admin detectado via role_id:', req.user.role_id);
        }
      } catch (error) {
        console.log('🔐 [API] Erro ao verificar role para Super Admin:', error.message);
      }
    }

    // ✅ REMOVIDO: Código fixo de Super Admin - agora tudo vem do banco
    // ✅ Se o usuário tem uma role, buscar permissões do banco
    if (role_id) {
      // Buscar role_id do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', req.user.id)
        .single();

      console.log('🔐 [API] Profile encontrado:', profile);
      console.log('🔐 [API] Erro do profile:', profileError);

      if (profile && profile.role_id) {
        role_id = profile.role_id;
        console.log('🔐 [API] Role ID encontrado:', role_id);
        
        // Buscar role (pode ser global ou customizada)
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('name, permissions')
          .eq('id', profile.role_id)
          .or(`organization_id.is.null,organization_id.eq.${req.user.organization_id}`)
          .single();

        console.log('🔐 [API] Role encontrada:', role);
        console.log('🔐 [API] Erro da role:', roleError);

        if (role && !roleError) {
          permissions = role.permissions || {};
          role_name = role.name;
          console.log('✅ [API] Permissões encontradas da role:', role_name, permissions);
        } else {
          console.log('⚠️ [API] Role não encontrada no banco para role_id:', profile.role_id);
          permissions = {};
        }
      } else {
        console.log('⚠️ [API] Usuário sem role_id definido no profile. Tentando atribuir role padrão...');
        
        // Tentar atribuir uma role padrão ao usuário (primeiro global, depois customizada)
        const { data: defaultRole, error: defaultRoleError } = await supabase
          .from('roles')
          .select('id, name, permissions')
          .or(`and(is_default.eq.true,organization_id.is.null),and(is_default.eq.true,organization_id.eq.${req.user.organization_id})`)
          .order('organization_id', { ascending: false }) // Priorizar roles customizadas
          .limit(1)
          .single();

        if (defaultRole && !defaultRoleError) {
          console.log('✅ [API] Role padrão encontrada:', defaultRole.name);
          
          // Atualizar o profile do usuário com a role padrão
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role_id: defaultRole.id })
            .eq('id', req.user.id);

          if (!updateError) {
            console.log('✅ [API] Role padrão atribuída ao usuário');
            role_id = defaultRole.id;
            role_name = defaultRole.name;
            permissions = defaultRole.permissions || {};
          } else {
            console.log('❌ [API] Erro ao atribuir role padrão:', updateError);
            permissions = {};
          }
        } else {
          console.log('⚠️ [API] Nenhuma role padrão encontrada');
          permissions = {};
        }
      }
    }

    console.log('🔐 [API] Permissões retornadas:', permissions);
    res.json({
      success: true,
      permissions,
      role_id,
      role_name
    });
  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar permissões:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 