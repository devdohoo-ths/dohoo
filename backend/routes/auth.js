import express from 'express';
import { supabaseAdmin } from '../lib/supabaseClient.js';
import { supabase } from '../lib/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ✅ Criar cliente com ANON_KEY para autenticação de usuários
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const authClient = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// POST /api/auth/login - Login do usuário
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    if (!authClient) {
      return res.status(500).json({ error: 'Configuração do Supabase incompleta' });
    }

    // Fazer login via Supabase
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return res.status(401).json({ 
        error: error?.message || 'Credenciais inválidas' 
      });
    }

    // ✅ CORREÇÃO: Buscar perfil do usuário (sem join automático de roles)
    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select(`
        id,
        name,
        email,
        organization_id,
        role_id,
        organizations!inner(
          id,
          name,
          status
        )
      `)
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Perfil do usuário não encontrado' });
    }

    // ✅ CORREÇÃO: Buscar role manualmente em default_roles OU roles
    let roleData = null;
    if (profile.role_id) {
      // Primeiro tentar buscar em default_roles
      const { data: defaultRole } = await supabaseAdmin
        .from('default_roles')
        .select('id, name, description, permissions')
        .eq('id', profile.role_id)
        .eq('is_active', true)
        .single();

      if (defaultRole) {
        roleData = defaultRole;
      } else {
        // Se não encontrou em default_roles, buscar em roles
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('id, name, description, permissions')
          .eq('id', profile.role_id)
          .single();

        if (role) {
          roleData = role;
        }
      }
    }

    // Retornar dados do usuário e token
    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        ...data.user
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        organization_id: profile.organization_id,
        role_id: profile.role_id,
        role_name: roleData?.name || null,
        role_permissions: roleData?.permissions || {},
        organization: {
          id: profile.organizations.id,
          name: profile.organizations.name,
          status: profile.organizations.status
        }
      }
    });
  } catch (error) {
    console.error('❌ [Auth] Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/logout - Logout do usuário
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token && authClient) {
      // Invalidar sessão no Supabase (opcional, pois o token expira naturalmente)
      // O logout é principalmente client-side
    }

    res.json({ success: true, message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('❌ [Auth] Erro no logout:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/session - Obter sessão atual
router.get('/session', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    if (!authClient) {
      return res.status(500).json({ error: 'Configuração do Supabase incompleta' });
    }

    // Verificar token e obter usuário
    const { data: { user }, error } = await authClient.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // ✅ CORREÇÃO: Buscar perfil (sem join automático de roles)
    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select(`
        id,
        name,
        email,
        organization_id,
        role_id,
        organizations!inner(
          id,
          name,
          status
        )
      `)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    // ✅ CORREÇÃO: Buscar role manualmente em default_roles OU roles
    let roleData = null;
    if (profile.role_id) {
      // Primeiro tentar buscar em default_roles
      const { data: defaultRole } = await supabaseAdmin
        .from('default_roles')
        .select('id, name, description, permissions')
        .eq('id', profile.role_id)
        .eq('is_active', true)
        .single();

      if (defaultRole) {
        roleData = defaultRole;
      } else {
        // Se não encontrou em default_roles, buscar em roles
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('id, name, description, permissions')
          .eq('id', profile.role_id)
          .single();

        if (role) {
          roleData = role;
        }
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        ...user
      },
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        organization_id: profile.organization_id,
        role_id: profile.role_id,
        role_name: roleData?.name || null,
        role_permissions: roleData?.permissions || {},
        // ✅ ADICIONADO: Retornar objeto roles completo para compatibilidade com frontend
        roles: roleData ? {
          id: roleData.id,
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions
        } : null,
        organization: {
          id: profile.organizations.id,
          name: profile.organizations.name,
          status: profile.organizations.status
        }
      }
    });
  } catch (error) {
    console.error('❌ [Auth] Erro ao obter sessão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/refresh - Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token é obrigatório' });
    }

    if (!authClient) {
      return res.status(500).json({ error: 'Configuração do Supabase incompleta' });
    }

    // Refresh session
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token
    });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }

    res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('❌ [Auth] Erro ao refresh token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/profile - Obter perfil do usuário autenticado
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    if (!authClient) {
      return res.status(500).json({ error: 'Configuração do Supabase incompleta' });
    }

    // Verificar token
    const { data: { user }, error } = await authClient.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // ✅ CORREÇÃO: Buscar perfil completo (sem join automático de roles)
    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select(`
        id,
        name,
        email,
        organization_id,
        role_id,
        avatar_url,
        organizations!inner(
          id,
          name,
          status
        )
      `)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    // ✅ CORREÇÃO: Buscar role manualmente em default_roles OU roles
    let roleData = null;
    if (profile.role_id) {
      // Primeiro tentar buscar em default_roles
      const { data: defaultRole } = await supabaseAdmin
        .from('default_roles')
        .select('id, name, description, permissions')
        .eq('id', profile.role_id)
        .eq('is_active', true)
        .single();

      if (defaultRole) {
        roleData = defaultRole;
      } else {
        // Se não encontrou em default_roles, buscar em roles
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('id, name, description, permissions')
          .eq('id', profile.role_id)
          .single();

        if (role) {
          roleData = role;
        }
      }
    }

    res.json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        organization_id: profile.organization_id,
        role_id: profile.role_id,
        avatar_url: profile.avatar_url,
        role_name: roleData?.name || null,
        role_permissions: roleData?.permissions || {},
        // ✅ ADICIONADO: Retornar objeto roles completo para compatibilidade com frontend
        roles: roleData ? {
          id: roleData.id,
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions
        } : null,
        organization: {
          id: profile.organizations.id,
          name: profile.organizations.name,
          status: profile.organizations.status
        }
      }
    });
  } catch (error) {
    console.error('❌ [Auth] Erro ao obter perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;

