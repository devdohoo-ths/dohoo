-- =====================================================
-- MIGRAÇÃO: Adicionar Permissões do Atendimento Inteligente
-- Descrição: Atualiza permissões no campo permissions da tabela profiles
-- Data: 2025-10-22
-- NOTA: Esta migração foi adaptada - o sistema usa user_role enum e permissions JSONB em profiles
-- =====================================================

-- =====================================================
-- 1. ATUALIZAR PERMISSÕES EM PROFILES (user_role + permissions JSONB)
-- =====================================================

-- As permissões já são gerenciadas via JSONB na tabela profiles
-- Esta migração é mantida para referência histórica mas não precisa executar nada
-- pois as permissões são gerenciadas diretamente na tabela profiles

-- COMENTADO: A tabela roles não existe no sistema
-- UPDATE public.roles
-- COMENTADO: A tabela roles não existe no sistema
-- As permissões são gerenciadas via campo JSONB 'permissions' na tabela profiles
-- e via enum 'user_role' (super_admin, admin, agent)
-- 
-- Para adicionar essas permissões, elas devem ser incluídas diretamente
-- no campo permissions JSONB dos perfis conforme necessário pela aplicação

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================

