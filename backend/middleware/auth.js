import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Token de desenvolvimento para testes
// Usa variável de ambiente com fallback para compatibilidade
const SIMPLE_TOKEN = process.env.DEV_TOKEN || 'dohoo_dev_token_2024';

// ✅ CORREÇÃO: Criar cliente com ANON_KEY para validar tokens de usuários
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const authClient = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.error('❌ [Auth] Token de autorização não fornecido');
            return res.status(401).json({ error: 'Token de autorização é obrigatório' });
        }

        // ✅ CORREÇÃO: Verificar se é token de desenvolvimento
        if (token === SIMPLE_TOKEN) {
            // Para desenvolvimento, buscar usuário pelos headers
            const userId = req.headers['x-user-id'];
            
            if (!userId) {
                console.error('❌ [Auth] Header x-user-id é obrigatório em desenvolvimento');
                return res.status(400).json({ error: 'Header x-user-id é obrigatório em desenvolvimento' });
            }
            
            // ✅ CORREÇÃO: Buscar perfil (sem join automático de roles)
            const { data: profile, error: profileError } = await supabase
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
                .eq('id', userId)
                .single();

            if (profileError || !profile) {
                console.error('❌ [Auth] Perfil não encontrado:', profileError?.message);
                return res.status(404).json({ error: 'Perfil do usuário não encontrado' });
            }

            // ✅ CORREÇÃO: Buscar role manualmente em default_roles OU roles
            let roleData = null;
            if (profile.role_id) {
                // Primeiro tentar buscar em default_roles
                const { data: defaultRole } = await supabase
                    .from('default_roles')
                    .select('id, name, description, permissions')
                    .eq('id', profile.role_id)
                    .eq('is_active', true)
                    .single();

                if (defaultRole) {
                    roleData = defaultRole;
                } else {
                    // Se não encontrou em default_roles, buscar em roles
                    const { data: role } = await supabase
                        .from('roles')
                        .select('id, name, description, permissions')
                        .eq('id', profile.role_id)
                        .single();

                    if (role) {
                        roleData = role;
                    }
                }
            }

            // ✅ Validar se a organização está ativa (se tiver status)
            if (profile.organizations.status && profile.organizations.status !== 'active') {
                console.error('❌ [Auth] Organização inativa:', profile.organizations.name);
                return res.status(403).json({ error: 'Organização inativa' });
            }

            // ✅ CORREÇÃO: Adicionar dados do usuário com estrutura correta (com role buscada manualmente)
            req.user = {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                organization_id: profile.organization_id,
                role_id: profile.role_id,
                role_name: roleData?.name || null,
                role_permissions: roleData?.permissions || {},
                organization: {
                    id: profile.organizations.id,
                    name: profile.organizations.name,
                    status: profile.organizations.status
                }
            };

            return next();
        }

        // ✅ CORREÇÃO: Para tokens JWT reais do Supabase, usar ANON_KEY
        // SERVICE_ROLE_KEY não funciona para validar tokens de usuários
        if (!authClient) {
            console.error('❌ [Auth] SUPABASE_ANON_KEY não configurada');
            return res.status(500).json({ error: 'Configuração do Supabase incompleta' });
        }
        
        const { data: { user }, error } = await authClient.auth.getUser(token);

        if (error || !user) {
            console.error('❌ [Auth] Token JWT inválido:', error?.message);
            return res.status(403).json({ error: 'Token inválido ou expirado' });
        }

        // ✅ CORREÇÃO: Buscar perfil usando ANON_KEY (sem join automático de roles)
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
            console.error('❌ [Auth] Perfil não encontrado:', profileError?.message);
            return res.status(404).json({ error: 'Perfil do usuário não encontrado' });
        }

        // ✅ CORREÇÃO: Buscar role manualmente em default_roles OU roles
        let roleData = null;
        if (profile.role_id) {
            // Primeiro tentar buscar em default_roles
            const { data: defaultRole } = await supabase
                .from('default_roles')
                .select('id, name, description, permissions')
                .eq('id', profile.role_id)
                .eq('is_active', true)
                .single();

            if (defaultRole) {
                roleData = defaultRole;
            } else {
                // Se não encontrou em default_roles, buscar em roles
                const { data: role } = await supabase
                    .from('roles')
                    .select('id, name, description, permissions')
                    .eq('id', profile.role_id)
                    .single();

                if (role) {
                    roleData = role;
                }
            }
        }

        // ✅ Validar organização ativa
        if (profile.organizations.status && profile.organizations.status !== 'active') {
            console.error('❌ [Auth] Organização inativa:', profile.organizations.name);
            return res.status(403).json({ error: 'Organização inativa' });
        }

        // ✅ CORREÇÃO: Estrutura correta para JWT (com role buscada manualmente)
        req.user = {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            organization_id: profile.organization_id,
            role_id: profile.role_id,
            role_name: roleData?.name || null,
            role_permissions: roleData?.permissions || {},
            organization: {
                id: profile.organizations.id,
                name: profile.organizations.name,
                status: profile.organizations.status
            }
        };

        next();
    } catch (error) {
        console.error('❌ [Auth] Erro no middleware:', error);
        return res.status(500).json({ error: 'Erro interno de autenticação' });
    }
};

// ✅ CORREÇÃO: Middleware para super admins
export const requireSuperAdmin = (req, res, next) => {
    if (req.user?.role_name !== 'Super Admin') {
        return res.status(403).json({ error: 'Acesso negado: apenas super admins' });
    }
    next();
};

// ✅ CORREÇÃO: Middleware para admins
export const requireAdmin = (req, res, next) => {
    if (!['Admin', 'Super Admin'].includes(req.user?.role_name)) {
        return res.status(403).json({ error: 'Acesso negado: apenas administradores' });
    }
    next();
}; 