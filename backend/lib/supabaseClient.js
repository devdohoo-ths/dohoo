import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Supabase URL não definida nas variáveis de ambiente.');
}

const supabaseKey = anonKey || serviceRoleKey;

if (!supabaseKey) {
  throw new Error('Supabase ANON_KEY ou SERVICE_ROLE_KEY não definidas nas variáveis de ambiente.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const supabaseAdmin = serviceRoleKey && serviceRoleKey.length > 200 
  ? createClient(supabaseUrl, serviceRoleKey)
  : supabase;

/**
 * Cria um cliente Supabase autenticado com o token do usuário
 * Isso é necessário para operações que precisam respeitar RLS (Row Level Security)
 * @param {string} accessToken - Token de acesso do usuário (JWT)
 * @returns {Object} Cliente Supabase autenticado
 */
export const createAuthenticatedClient = (accessToken) => {
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY não configurada - necessária para autenticação de usuários');
  }
  
  const client = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  
  return client;
};

