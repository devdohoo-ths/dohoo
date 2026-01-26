import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Middleware de logging para debug removido

// Função para buscar o nome da role do usuário
const getUserRoleName = async (userId) => {
  try {
    if (!userId) {
      console.log('⚠️ [API] getUserRoleName - userId não fornecido');
      return 'agent'; // Role padrão
    }

    // Buscar o profile do usuário com role_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ [API] getUserRoleName - Erro ao buscar profile:', profileError);
      return 'agent'; // Role padrão em caso de erro
    }

    if (!profile) {
      console.log('⚠️ [API] getUserRoleName - Profile não encontrado');
      return 'agent'; // Role padrão
    }

    // ✅ CORREÇÃO: Se tem role_id, buscar o nome da role em default_roles OU roles
    if (profile.role_id) {
      // Primeiro tentar buscar em default_roles
      const { data: defaultRole, error: defaultRoleError } = await supabase
        .from('default_roles')
        .select('name')
        .eq('id', profile.role_id)
        .eq('is_active', true)
        .single();

      if (defaultRole && !defaultRoleError) {
        console.log('✅ [API] getUserRoleName - Role encontrada em default_roles:', defaultRole.name);
        return defaultRole.name;
      }

      // Se não encontrou em default_roles, buscar em roles
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single();

      if (roleError) {
        console.error('❌ [API] getUserRoleName - Erro ao buscar role:', roleError);
        return 'agent'; // Role padrão em caso de erro
      }

      if (role) {
        console.log('✅ [API] getUserRoleName - Role encontrada em roles:', role.name);
        return role.name;
      }
    }

    // Se não tem role_id, retornar role padrão
    console.log('⚠️ [API] getUserRoleName - Usuário sem role_id, usando role padrão');
    return 'agent';

  } catch (error) {
    console.error('❌ [API] getUserRoleName - Erro geral:', error);
    return 'agent'; // Role padrão em caso de erro
  }
};

// GET /api/organizations - Lista todas as organizações (apenas super_admin)
router.get('/', async (req, res) => {
  try {
    const { user } = req;
    
    if (!user) {
      console.log('❌ [API] Usuário não autenticado');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar permissões do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', user.id)
      .single();

    if (!profile?.role_id) {
      console.log('❌ [API] Usuário não possui role_id');
      return res.status(403).json({ error: 'Usuário não possui permissões definidas.' });
    }

    // ✅ CORREÇÃO: Buscar role e suas permissões em default_roles OU roles
    let role = null;
    
    // Primeiro tentar buscar em default_roles
    const { data: defaultRole, error: defaultRoleError } = await supabase
      .from('default_roles')
      .select('name, permissions')
      .eq('id', profile.role_id)
      .eq('is_active', true)
      .single();

    if (defaultRole && !defaultRoleError) {
      role = defaultRole;
      console.log('✅ [API] Role encontrada em default_roles:', defaultRole.name);
    } else {
      // Se não encontrou em default_roles, buscar em roles
      const { data: customRole, error: roleError } = await supabase
        .from('roles')
        .select('name, permissions')
        .eq('id', profile.role_id)
        .single();

      if (roleError) {
        console.error('❌ [API] Erro ao buscar role:', roleError);
      }

      if (customRole && !roleError) {
        role = customRole;
        console.log('✅ [API] Role encontrada em roles:', customRole.name);
      }
    }

    if (!role) {
      console.log('❌ [API] Role não encontrada');
      return res.status(403).json({ error: 'Role não encontrada.' });
    }

    // Verificar se tem permissão manage_organizations
    // Para default_roles, verificar estrutura simples: { "organizations": true } ou { "manage_all_organizations": true }
    // Para roles customizadas, verificar estrutura aninhada: { "advanced_settings": { "manage_organizations": true } }
    let hasPermission = false;
    
    if (role.permissions) {
      // Verificar estrutura simples (default_roles)
      if (role.permissions.organizations === true || 
          role.permissions.manage_all_organizations === true ||
          role.permissions.manage_organizations === true) {
        hasPermission = true;
      }
      // Verificar estrutura aninhada (roles customizadas)
      else if (role.permissions.advanced_settings?.manage_organizations === true) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      console.log('❌ [API] Usuário não tem permissão manage_organizations');
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para gerenciar organizações.' });
    }

    // Parâmetros de paginação e filtros
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const isPoc = req.query.is_poc;
    const showInactive = req.query.show_inactive === 'true';

    // Calcular offset para paginação
    const offset = (page - 1) * limit;

    let organizations = [];
    let count = 0;

    // Aplicar filtros de ativas/desativadas
    if (showInactive) {
      // Mostrar APENAS as desativadas (deleted_at NÃO é null)
      // Mas excluir as que têm POC finalizada (expired ou converted), pois essas aparecem na lista ativa
      let query = supabase
        .from('organizations')
        .select('*', { count: 'exact' })
        .not('deleted_at', 'is', null)
        .not('poc_status', 'eq', 'expired')
        .not('poc_status', 'eq', 'converted');
      
      console.log('🏢 [API] Filtrando DESATIVADAS - deleted_at NOT NULL (exceto POCs finalizadas)');

      // Aplicar filtros adicionais
      if (isPoc !== undefined && isPoc !== '') {
        const pocFilter = isPoc === 'true';
        query = query.eq('is_poc', pocFilter);
      }

      if (search && search.trim() !== '') {
        query = query.or(`name.ilike.%${search}%,cpf_cnpj.ilike.%${search}%,financial_email.ilike.%${search}%`);
      }

      // Aplicar ordenação e paginação
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const result = await query;
      
      if (result.error) {
        console.error('❌ [API] Erro ao buscar organizações desativadas:', result.error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }

      organizations = result.data || [];
      count = result.count || 0;
    } else {
      // Mostrar as ativas (deleted_at É null) OU organizações com POC finalizada (expired ou converted)
      // Fazer duas queries separadas e combinar os resultados para evitar problemas com múltiplos .or()

      // Query 1: Organizações ativas (deleted_at IS NULL)
      let query1 = supabase
        .from('organizations')
        .select('*')
        .is('deleted_at', null);

      // Query 2: Organizações com POC finalizada (expired ou converted)
      let query2 = supabase
        .from('organizations')
        .select('*')
        .in('poc_status', ['expired', 'converted']);

      // Aplicar filtros adicionais em ambas as queries
      if (isPoc !== undefined && isPoc !== '') {
        const pocFilter = isPoc === 'true';
        query1 = query1.eq('is_poc', pocFilter);
        query2 = query2.eq('is_poc', pocFilter);
      }

      if (search && search.trim() !== '') {
        query1 = query1.or(`name.ilike.%${search}%,cpf_cnpj.ilike.%${search}%,financial_email.ilike.%${search}%`);
        query2 = query2.or(`name.ilike.%${search}%,cpf_cnpj.ilike.%${search}%,financial_email.ilike.%${search}%`);
      }

      // Executar ambas as queries
      const [result1, result2] = await Promise.all([
        query1,
        query2
      ]);

      // Verificar erros
      if (result1.error) {
        console.error('❌ [API] Erro na query 1 (organizações ativas):', result1.error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }

      if (result2.error) {
        console.error('❌ [API] Erro na query 2 (POCs finalizadas):', result2.error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }

      // Combinar resultados e remover duplicatas
      const allOrgs = [...(result1.data || []), ...(result2.data || [])];
      const uniqueOrgs = allOrgs.filter((org, index, self) => 
        index === self.findIndex(o => o.id === org.id)
      );

      // Ordenar por created_at
      uniqueOrgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Aplicar paginação manualmente
      count = uniqueOrgs.length;
      organizations = uniqueOrgs.slice(offset, offset + limit);
    }

    // Calcular informações de paginação
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({ 
      success: true,
      organizations: organizations || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count || 0,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar organizações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/organizations/current - Obter organização atual do usuário
router.get('/current', async (req, res) => {
  try {
    const { user } = req;
    
    if (!user) {
      console.log('❌ [API] Usuário não autenticado');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!user.organization_id) {
      console.log('❌ [API] Usuário não possui organization_id');
      return res.status(404).json({ error: 'Usuário não possui organização' });
    }
    
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('id, name, domain, logo_url, cpf_cnpj, max_users, settings')
      .eq('id', user.organization_id)
      .single();

    if (error) {
      console.error('❌ [API] Erro ao buscar organização:', error);
      return res.status(500).json({ error: 'Erro ao buscar organização' });
    }

    if (!organization) {
      console.log('❌ [API] Organização não encontrada');
      return res.status(404).json({ error: 'Organização não encontrada' });
    }
    res.json({ 
      success: true,
      organization 
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar organização atual:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/organizations/:id - Obter organização específica (deve vir DEPOIS da rota /current)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Buscar role_name real do banco
    const role_name = await getUserRoleName(user?.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Mapear nomes de roles para verificação de permissões
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    const normalizedRole = roleMapping[role_name] || role_name.toLowerCase();
    
    console.log('🏢 [API] GET /:id - Role original:', role_name);
    console.log('🏢 [API] GET /:id - Role normalizado:', normalizedRole);
    
    // Verificar se o usuário tem acesso à organização
    if (!['super_admin', 'admin', "administrador"].includes(normalizedRole) && user.organization_id !== id) {
      console.log('❌ [API] GET /:id - Usuário não tem acesso à organização. Role:', role_name, '->', normalizedRole);
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(500).json({ error: 'Erro ao buscar organização' });
    }

    if (!organization) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    res.json({ 
      success: true,
      organization 
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/organizations - Criar nova organização
router.post('/', async (req, res) => {
  try {
    console.log('🏢 [API] POST /organizations - Dados recebidos:', req.body);
    console.log('🏢 [API] POST /organizations - Headers:', req.headers);
    
    const { name, logo_url, cpf_cnpj, max_users, financial_email, price_per_user, is_poc, poc_duration_days, poc_start_date, poc_contact_email, poc_contact_phone } = req.body;
    const { user } = req;
    
    console.log('🏢 [API] POST /organizations - Dados extraídos:', {
      name, logo_url, cpf_cnpj, max_users, financial_email, price_per_user, is_poc, poc_duration_days, poc_start_date, poc_contact_email, poc_contact_phone
    });
    console.log('🏢 [API] POST /organizations - Usuário:', user);
    
    // Buscar role_name real do banco
    const role_name = await getUserRoleName(user?.id);
    
    console.log('🏢 [API] POST /organizations - Role name:', role_name);
    
    if (!user) {
      console.log('❌ [API] POST /organizations - Usuário não autenticado');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Mapear nomes de roles para verificação de permissões (incluindo português)
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Administrador': 'admin',
      'Manager': 'manager',
      'Agente': 'agent',
      'Agent': 'agent'
    };
    
    const normalizedRole = roleMapping[role_name] || role_name.toLowerCase();
    
    console.log('🏢 [API] POST - Role original:', role_name);
    console.log('🏢 [API] POST - Role normalizado:', normalizedRole);
    
    // Apenas super_admin e admin podem criar organizações
    if (!['super_admin', 'admin'].includes(normalizedRole)) {
      console.log('❌ [API] POST /organizations - Acesso negado. Role:', role_name, '->', normalizedRole);
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem criar organizações.' });
    }

    console.log('✅ [API] POST /organizations - Usuário tem permissão para criar organização');

    console.log('🔍 [API] POST /organizations - Verificando nome:', name);
    console.log('🔍 [API] POST /organizations - Tipo do nome:', typeof name);
    console.log('🔍 [API] POST /organizations - Nome é truthy:', !!name);
    
    if (!name) {
      console.log('❌ [API] POST /organizations - Nome é obrigatório');
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    // Gerar subdomínio automaticamente baseado no nome da organização
    const generateSubdomain = (orgName) => {
      // Converter para lowercase e remover caracteres especiais
      let subdomain = orgName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]/g, '') // Remove caracteres especiais, mantém apenas letras e números
        .replace(/\s+/g, ''); // Remove espaços
      
      // Se ficou vazio após a limpeza, usar um fallback
      if (!subdomain) {
        subdomain = 'org';
      }
      
      return `${subdomain}.dohoo.com.br`;
    };

    const domain = generateSubdomain(name);
    
    console.log('🏢 [API] POST /organizations - Subdomínio gerado:', domain);

    // Calcular poc_end_date e poc_status se for POC
    let pocEndDate = null;
    let pocStatus = 'inactive';

    if (is_poc) {
      const startDate = poc_start_date ? new Date(poc_start_date) : new Date();
      const durationDays = poc_duration_days || 30;
      pocEndDate = new Date(startDate);
      pocEndDate.setDate(pocEndDate.getDate() + durationDays);
      pocStatus = 'active';
      
      console.log('🏢 [API] POC configurada:', {
        start_date: startDate.toISOString(),
        end_date: pocEndDate.toISOString(),
        duration: durationDays,
        status: pocStatus
      });
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .insert([{
        name,
        domain,
        logo_url,
        cpf_cnpj,
        max_users: max_users || 10,
        financial_email,
        price_per_user: price_per_user || 0,
        is_poc: is_poc || false,
        poc_duration_days: poc_duration_days || null,
        poc_start_date: poc_start_date || null,
        poc_end_date: pocEndDate ? pocEndDate.toISOString() : null,
        poc_status: pocStatus,
        poc_contact_email: poc_contact_email || null,
        poc_contact_phone: poc_contact_phone || null
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao criar organização:', error);
      console.error('❌ [API] Detalhes do erro:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: 'Erro ao criar organização', details: error.message });
    }

    console.log('✅ [API] Organização criada:', organization.id);
    res.json({ 
      success: true,
      organization 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao criar organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/organizations/:id - Atualizar organização
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, logo_url, cpf_cnpj, max_users, financial_email, price_per_user } = req.body;
    const { user } = req;
    
    // Buscar role_name real do banco
    const role_name = await getUserRoleName(user?.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Mapear nomes de roles para verificação de permissões
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    const normalizedRole = roleMapping[role_name] || role_name.toLowerCase();
    
    console.log('🏢 [API] PUT - Role original:', role_name);
    console.log('🏢 [API] PUT - Role normalizado:', normalizedRole);
    
    // Apenas super_admin e admin podem editar organizações
    if (!['super_admin', 'admin'].includes(normalizedRole)) {
      console.log('❌ [API] PUT - Usuário não tem permissão para editar organizações. Role:', role_name, '->', normalizedRole);
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem editar organizações.' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .update({
        name,
        domain,
        logo_url,
        cpf_cnpj,
        max_users: max_users || 10,
        financial_email,
        price_per_user: price_per_user || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [API] Erro ao atualizar organização:', error);
      return res.status(500).json({ error: 'Erro ao atualizar organização' });
    }

    if (!organization) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    console.log('✅ [API] Organização atualizada:', id);
    res.json({ 
      success: true,
      organization 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/organizations/:id - Soft delete (desativar)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Buscar role_name real do banco
    const role_name = await getUserRoleName(user?.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Mapear nomes de roles para verificação de permissões
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    const normalizedRole = roleMapping[role_name] || role_name.toLowerCase();
    
    console.log('🏢 [API] DELETE - Role original:', role_name);
    console.log('🏢 [API] DELETE - Role normalizado:', normalizedRole);
    
    // Apenas super_admin e admin podem desativar organizações
    if (!['super_admin', 'admin'].includes(normalizedRole)) {
      console.log('❌ [API] DELETE - Usuário não tem permissão para desativar organizações. Role:', role_name, '->', normalizedRole);
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem desativar organizações.' });
    }

    const { error } = await supabase
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('❌ [API] Erro ao desativar organização:', error);
      return res.status(500).json({ error: 'Erro ao desativar organização' });
    }

    console.log('✅ [API] Organização desativada:', id);
    res.json({ 
      success: true,
      message: 'Organização desativada com sucesso' 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao desativar organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/organizations/:id/restore - Reativar organização
router.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Buscar role_name real do banco
    const role_name = await getUserRoleName(user?.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Mapear nomes de roles para verificação de permissões
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    const normalizedRole = roleMapping[role_name] || role_name.toLowerCase();
    
    console.log('🏢 [API] PATCH /restore - Role original:', role_name);
    console.log('🏢 [API] PATCH /restore - Role normalizado:', normalizedRole);
    
    // Apenas super_admin e admin podem reativar organizações
    if (!['super_admin', 'admin'].includes(normalizedRole)) {
      console.log('❌ [API] PATCH /restore - Usuário não tem permissão para reativar organizações. Role:', role_name, '->', normalizedRole);
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem reativar organizações.' });
    }

    const { error } = await supabase
      .from('organizations')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) {
      console.error('❌ [API] Erro ao reativar organização:', error);
      return res.status(500).json({ error: 'Erro ao reativar organização' });
    }

    console.log('✅ [API] Organização reativada:', id);
    res.json({ 
      success: true,
      message: 'Organização reativada com sucesso' 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao reativar organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/organizations/:id/hard - Hard delete (exclusão permanente)
router.delete('/:id/hard', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    // Buscar role_name real do banco
    const role_name = await getUserRoleName(user?.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Mapear nomes de roles para verificação de permissões
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    
    const normalizedRole = roleMapping[role_name] || role_name.toLowerCase();
    
    console.log('🏢 [API] DELETE /hard - Role original:', role_name);
    console.log('🏢 [API] DELETE /hard - Role normalizado:', normalizedRole);
    
    // Apenas super_admin e admin podem excluir permanentemente organizações
    if (!['super_admin', 'admin'].includes(normalizedRole)) {
      console.log('❌ [API] DELETE /hard - Usuário não tem permissão para excluir permanentemente organizações. Role:', role_name, '->', normalizedRole);
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem excluir permanentemente organizações.' });
    }

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [API] Erro ao excluir organização:', error);
      return res.status(500).json({ error: 'Erro ao excluir organização' });
    }

    console.log('✅ [API] Organização excluída permanentemente:', id);
    res.json({ 
      success: true,
      message: 'Organização excluída permanentemente' 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao excluir organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/organizations/:id/settings - Buscar configurações da organização
router.get('/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ [API] Erro ao buscar organização:', error);
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    const settings = organization.settings || {
      disabledModules: [],
      features: {
        automation: true,
        advancedSettings: true,
        marketplace: true,
        aiPlayground: true
      },
      proxy: null,
      whatsapp_api: 'baileys' // Default: Baileys
    };
    
    res.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/organizations/:id/settings - Atualizar configurações da organização
router.put('/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;
    
    console.log('🔐 [API] Atualizando configurações da organização:', id);
    console.log('🔐 [API] Novas configurações:', settings);
    
    // ✅ Verificar se está mudando a API WhatsApp (ANTES de atualizar)
    const { data: currentOrg } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', id)
      .single();
    
    const currentApi = currentOrg?.settings?.whatsapp_api || 'baileys';
    const newApi = settings?.whatsapp_api || 'baileys';
    const apiChanged = currentApi !== newApi;
    
    // ✅ Verificar se há contas WhatsApp conectadas quando mudar a API (para aviso)
    let activeConnectionsCount = 0;
    if (apiChanged) {
      const { data: accounts, error: accountsError } = await supabase
        .from('whatsapp_accounts')
        .select('account_id, name, status')
        .eq('organization_id', id)
        .in('status', ['connected', 'connecting']);
      
      if (accountsError) {
        console.error('❌ [API] Erro ao verificar contas:', accountsError);
      } else if (accounts && accounts.length > 0) {
        activeConnectionsCount = accounts.length;
        console.log(`⚠️ [API] ${activeConnectionsCount} conta(s) ativa(s) detectada(s) - API será alterada mesmo assim`);
      }
    }
    
    // ✅ Garantir que whatsapp_api está definido
    if (!settings.whatsapp_api) {
      settings.whatsapp_api = 'baileys';
    }
    
    // ✅ Validar valor da API
    if (!['baileys', 'wppconnect', 'whatsapp-web.js', 'whatsapp-web'].includes(settings.whatsapp_api)) {
      return res.status(400).json({ 
        error: 'API WhatsApp inválida. Use "baileys", "wppconnect" ou "whatsapp-web.js"' 
      });
    }
    
    // ✅ CORREÇÃO: SEMPRE atualizar as configurações, mesmo se houver conexões ativas
    const { error } = await supabase
      .from('organizations')
      .update({ settings })
      .eq('id', id);

    if (error) {
      console.error('❌ [API] Erro ao atualizar organização:', error);
      return res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }

    console.log('✅ [API] Configurações atualizadas com sucesso');
    
    // ✅ Retornar resposta com aviso se necessário
    if (apiChanged && activeConnectionsCount > 0) {
      return res.json({
        success: true,
        message: `API alterada de ${currentApi} para ${newApi}. Reconecte todas as contas WhatsApp.`,
        warning: `A API foi alterada de ${currentApi} para ${newApi}. Todas as ${activeConnectionsCount} conexão(ões) ativa(s) precisarão ser reconectadas.`,
        requiresReconnection: true,
        activeConnections: activeConnectionsCount,
        apiChanged: true
      });
    }
    
    res.json({
      success: true,
      message: apiChanged ? 
        `API alterada de ${currentApi} para ${newApi}. Reconecte todas as contas WhatsApp.` : 
        'Configurações atualizadas com sucesso',
      apiChanged
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:id/switch', authenticateToken, async (req, res) => {
  try {
    const { id: targetOrgId } = req.params;
    const { user } = req;
    
    // 1. Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      return res.status(403).json({ error: 'Apenas Super Admins podem trocar de organização' });
    }
    
    // 2. Verificar se organização existe
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, status')
      .eq('id', targetOrgId)
      .single();
      
    if (orgError || !org) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }
    
    // 3. Atualizar organization_id do usuário
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        organization_id: targetOrgId,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
      
    if (updateError) {
      return res.status(500).json({ error: 'Erro ao trocar organização' });
    }
    
    // 4. Log de auditoria
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'organization_switch',
        details: {
          from_org: user.organization_id,
          to_org: targetOrgId,
          organization_name: org.name
        },
        created_at: new Date().toISOString()
      });
    
    res.json({
      success: true,
      message: `Agora você está acessando como ${org.name}`,
      organization: org
    });
    
  } catch (error) {
    console.error('Erro ao trocar organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/organizations/:id/switch - Trocar para organização (apenas Super Admin)
router.post('/:id/switch', async (req, res) => {
  try {
    const { id: targetOrgId } = req.params;
    const { user } = req;
    
    console.log('🔄 [API] POST /organizations/:id/switch - Dados recebidos:', {
      targetOrgId,
      userId: user?.id,
      currentOrgId: user?.organization_id
    });
    
    if (!user) {
      console.log('❌ [API] Usuário não autenticado');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    
    // 1. Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    console.log('🔄 [API] Role do usuário:', role_name);
    
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem trocar de organização');
      return res.status(403).json({ error: 'Apenas Super Admins podem trocar de organização' });
    }
    
    // 2. Verificar se organização existe e está ativa
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, status, deleted_at')
      .eq('id', targetOrgId)
      .single();
      
    if (orgError || !org) {
      console.log('❌ [API] Organização não encontrada:', orgError);
      return res.status(404).json({ error: 'Organização não encontrada' });
    }
    
    if (org.deleted_at) {
      console.log('❌ [API] Organização está desativada');
      return res.status(400).json({ error: 'Organização está desativada' });
    }
    
    
    // 3. Atualizar organization_id do usuário
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        organization_id: targetOrgId,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
      
    if (updateError) {
      console.error('❌ [API] Erro ao trocar organização:', updateError);
      return res.status(500).json({ error: 'Erro ao trocar organização' });
    }
    
    console.log('✅ [API] Organização do usuário atualizada com sucesso');
    
    // 4. Log de auditoria (se a tabela existir)
    try {
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'organization_switch',
          details: {
            from_org: user.organization_id,
            to_org: targetOrgId,
            organization_name: org.name
          },
          created_at: new Date().toISOString()
        });
      console.log('✅ [API] Log de auditoria criado');
    } catch (auditError) {
      console.log('⚠️ [API] Erro ao criar log de auditoria (tabela pode não existir):', auditError.message);
      // Não falha a operação se não conseguir criar o log
    }
    
    res.json({
      success: true,
      message: `Agora você está acessando como ${org.name}`,
      organization: {
        id: org.id,
        name: org.name,
        status: org.status
      }
    });
    
  } catch (error) {
    console.error('❌ [API] Erro geral ao trocar organização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==================== ROTAS POC ====================

// GET /api/organizations/:id/poc - Buscar configurações POC da organização
router.get('/:id/poc', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    console.log('🎯 [API] GET /organizations/:id/poc - Buscando POC:', { id, userId: user?.id });
    console.log('🎯 [API] ID da organização:', id);

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem acessar configurações POC');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar organização básica primeiro (sempre funciona)
    const { data: basicOrg, error: basicError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', id)
      .single();

    if (basicError || !basicOrg) {
      console.log('❌ [API] Organização não encontrada:', basicError);
      return res.status(404).json({ error: 'Organização não encontrada' });
    }


    // Tentar buscar campos POC (pode falhar se não existirem)
    let org = {
      id: basicOrg.id,
      name: basicOrg.name,
      is_poc: false,
      poc_start_date: null,
      poc_end_date: null,
      poc_duration_days: 30,
      poc_notifications_sent: [],
      poc_status: 'inactive'
    };

    try {
      const { data: pocData, error: pocError } = await supabase
        .from('organizations')
        .select('is_poc, poc_start_date, poc_end_date, poc_duration_days, poc_notifications_sent, poc_status, poc_contact_email, poc_contact_phone')
        .eq('id', id)
        .single();

      if (!pocError && pocData) {
        org = { ...org, ...pocData };
        console.log('✅ [API] Campos POC encontrados:', { 
          is_poc: org.is_poc, 
          poc_status: org.poc_status,
          has_contact_email: !!org.poc_contact_email,
          has_contact_phone: !!org.poc_contact_phone
        });
      } else {
        console.log('⚠️ [API] Campos POC não existem, usando padrões:', pocError?.message);
      }
    } catch (error) {
      console.log('⚠️ [API] Erro ao buscar campos POC:', error.message);
    }


    // Buscar histórico POC (pode não existir se migração não foi executada)
    let history = [];
    try {
      const { data: historyData, error: historyError } = await supabase
        .from('poc_history')
        .select(`
          id, action, old_end_date, new_end_date, notes, created_at,
          profiles (name, email)
        `)
        .eq('organization_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError) {
        console.log('⚠️ [API] Erro ao buscar histórico POC (tabela pode não existir):', historyError);
      } else {
        history = historyData || [];
      }
    } catch (error) {
      console.log('⚠️ [API] Tabela poc_history não existe:', error.message);
    }

    // Calcular dias restantes
    let daysRemaining = null;
    if (org.is_poc && org.poc_end_date) {
      const endDate = new Date(org.poc_end_date);
      const today = new Date();
      const diffTime = endDate - today;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    res.json({
      success: true,
      poc: {
        ...org,
        contact_email: org.poc_contact_email || null,
        contact_phone: org.poc_contact_phone || null,
        days_remaining: daysRemaining,
        history: history
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar POC:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/organizations/:id/poc - Atualizar configurações POC
router.put('/:id/poc', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const { 
      is_poc, 
      poc_duration_days, 
      poc_start_date, 
      extend_days,
      convert_to_full,
      notes,
      poc_contact_email,
      poc_contact_phone
    } = req.body;

    console.log('🎯 [API] PUT /organizations/:id/poc - Atualizando POC:', { 
      id, 
      userId: user?.id, 
      body: req.body 
    });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem configurar POC');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar organização atual
    const { data: currentOrg, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (orgError || !currentOrg) {
      console.log('❌ [API] Organização não encontrada:', orgError);
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    let updateData = {};
    let action = 'updated';
    let oldEndDate = currentOrg.poc_end_date;

    // Se está convertendo para full
    if (convert_to_full) {
      updateData = {
        is_poc: false,
        poc_status: 'converted',
        updated_at: new Date().toISOString()
      };
      action = 'converted';
    }
    // Se está estendendo POC
    else if (extend_days && extend_days > 0) {
      const newEndDate = new Date(currentOrg.poc_end_date);
      newEndDate.setDate(newEndDate.getDate() + extend_days);
      
      updateData = {
        poc_end_date: newEndDate.toISOString(),
        poc_duration_days: currentOrg.poc_duration_days + extend_days,
        poc_notifications_sent: [], // Reset notificações
        updated_at: new Date().toISOString()
      };
      action = 'extended';
    }
    // Se está configurando POC
    else if (is_poc !== undefined) {
      if (is_poc) {
        const startDate = poc_start_date ? new Date(poc_start_date) : new Date();
        const duration = poc_duration_days || 30;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);

        updateData = {
          is_poc: true,
          poc_start_date: startDate.toISOString(),
          poc_end_date: endDate.toISOString(),
          poc_duration_days: duration,
          poc_status: 'active',
          poc_notifications_sent: [],
          poc_contact_email: poc_contact_email || null,
          poc_contact_phone: poc_contact_phone || null,
          updated_at: new Date().toISOString()
        };
        action = currentOrg.is_poc ? 'updated' : 'created';
      } else {
        updateData = {
          is_poc: false,
          poc_status: 'inactive',
          updated_at: new Date().toISOString()
        };
        action = 'deactivated';
      }
    }
    // Se está atualizando apenas campos de contato (sem mudar is_poc)
    else if (poc_contact_email !== undefined || poc_contact_phone !== undefined) {
      updateData = {
        poc_contact_email: poc_contact_email || null,
        poc_contact_phone: poc_contact_phone || null,
        updated_at: new Date().toISOString()
      };
      action = 'contact_updated';
    }

    // Atualizar organização
    console.log('🔄 [API] Atualizando organização com dados:', updateData);
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select('id, name, is_poc, poc_start_date, poc_end_date, poc_duration_days, poc_status, poc_contact_email, poc_contact_phone')
      .single();

    if (updateError) {
      console.error('❌ [API] Erro ao atualizar POC:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar POC' });
    }

    console.log('✅ [API] Organização atualizada:', updatedOrg);
    console.log('✅ [API] is_poc após atualização:', updatedOrg.is_poc);

    // Registrar no histórico
    try {
      await supabase
        .from('poc_history')
        .insert({
          organization_id: id,
          action: action,
          old_end_date: oldEndDate,
          new_end_date: updatedOrg.poc_end_date,
          performed_by: user.id,
          notes: notes || null,
          metadata: {
            duration_days: updatedOrg.poc_duration_days,
            extend_days: extend_days || null
          }
        });
      console.log('✅ [API] Histórico POC registrado');
    } catch (historyError) {
      console.log('⚠️ [API] Erro ao registrar histórico POC:', historyError);
      // Não falha a operação se não conseguir registrar o histórico
    }

    // Calcular dias restantes
    let daysRemaining = null;
    if (updatedOrg.is_poc && updatedOrg.poc_end_date) {
      const endDate = new Date(updatedOrg.poc_end_date);
      const today = new Date();
      const diffTime = endDate - today;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const responseData = {
      success: true,
      message: `POC ${action === 'created' ? 'criada' : action === 'extended' ? 'estendida' : action === 'converted' ? 'convertida' : 'atualizada'} com sucesso`,
      poc: {
        ...updatedOrg,
        contact_email: updatedOrg.poc_contact_email || null,
        contact_phone: updatedOrg.poc_contact_phone || null,
        days_remaining: daysRemaining
      }
    };

    console.log('📤 [API] Resposta final:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error('❌ [API] Erro ao atualizar POC:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/organizations/poc/dashboard - Dashboard de POCs
router.get('/poc/dashboard', async (req, res) => {
  try {
    const { user } = req;

    console.log('🎯 [API] GET /organizations/poc/dashboard - Dashboard POC:', { userId: user?.id });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem acessar dashboard POC');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar POCs ativas
    const { data: activePocs, error: activeError } = await supabase
      .from('organizations')
      .select('id, name, poc_start_date, poc_end_date, poc_duration_days, contact_email, contact_phone')
      .eq('is_poc', true)
      .eq('poc_status', 'active')
      .order('poc_end_date', { ascending: true });

    if (activeError) {
      console.error('❌ [API] Erro ao buscar POCs ativas:', activeError);
      return res.status(500).json({ error: 'Erro ao buscar POCs ativas' });
    }

    // Buscar POCs expiradas
    const { data: expiredPocs, error: expiredError } = await supabase
      .from('organizations')
      .select('id, name, poc_end_date, contact_email, contact_phone')
      .eq('is_poc', true)
      .eq('poc_status', 'expired')
      .order('poc_end_date', { ascending: false })
      .limit(10);

    if (expiredError) {
      console.log('⚠️ [API] Erro ao buscar POCs expiradas:', expiredError);
    }

    // Buscar POCs convertidas (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: convertedPocs, error: convertedError } = await supabase
      .from('organizations')
      .select('id, name, poc_end_date, contact_email, contact_phone')
      .eq('is_poc', false)
      .eq('poc_status', 'converted')
      .gte('updated_at', thirtyDaysAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (convertedError) {
      console.log('⚠️ [API] Erro ao buscar POCs convertidas:', convertedError);
    }

    // Processar POCs ativas para adicionar dias restantes
    const processedActivePocs = (activePocs || []).map(poc => {
      const endDate = new Date(poc.poc_end_date);
      const today = new Date();
      const diffTime = endDate - today;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...poc,
        days_remaining: daysRemaining,
        status: daysRemaining <= 0 ? 'expired' : daysRemaining <= 3 ? 'critical' : daysRemaining <= 7 ? 'warning' : 'ok'
      };
    });

    // Estatísticas
    const stats = {
      total_active: processedActivePocs.length,
      expiring_7_days: processedActivePocs.filter(p => p.days_remaining <= 7 && p.days_remaining > 0).length,
      expiring_3_days: processedActivePocs.filter(p => p.days_remaining <= 3 && p.days_remaining > 0).length,
      expired: (expiredPocs || []).length,
      converted_last_30_days: (convertedPocs || []).length
    };

    res.json({
      success: true,
      dashboard: {
        stats,
        active_pocs: processedActivePocs,
        expired_pocs: expiredPocs || [],
        converted_pocs: convertedPocs || []
      }
    });

  } catch (error) {
    console.error('❌ [API] Erro ao buscar dashboard POC:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/organizations/poc/check - Executar verificação manual de POCs (apenas Super Admin)
router.get('/poc/check', async (req, res) => {
  try {
    const { user } = req;

    console.log('🎯 [API] GET /organizations/poc/check - Verificação manual POC:', { userId: user?.id });

    // Verificar se é Super Admin
    const role_name = await getUserRoleName(user.id);
    if (role_name !== 'Super Admin') {
      console.log('❌ [API] Apenas Super Admins podem executar verificação manual');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Importar e executar verificação
    const { runManualPocCheck } = await import('../jobs/pocCronJob.js');
    const result = await runManualPocCheck();

    res.json({
      success: result.success,
      message: result.success ? 'Verificação executada com sucesso' : 'Erro na verificação',
      data: result
    });

  } catch (error) {
    console.error('❌ [API] Erro na verificação manual POC:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 