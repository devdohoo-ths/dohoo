-- =====================================================
-- MIGRAÇÃO: Adicionar Permissões do Atendimento Inteligente
-- Descrição: Atualiza permissões na tabela ROLES (não profiles)
-- Data: 2025-10-22
-- =====================================================

-- =====================================================
-- 1. ATUALIZAR ROLES (TABELA PRINCIPAL DE PERMISSÕES)
-- =====================================================

-- Atualizar role Super Admin
UPDATE public.roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{intelligent_service}',
  '{
    "view_intelligent_service": true,
    "manage_intelligent_service": true,
    "manage_products": true,
    "configure_flows": true,
    "configure_team_strategies": true,
    "configure_chat_interface": true,
    "view_metrics": true,
    "export_data": true
  }'::jsonb,
  true
)
WHERE name = 'Super Admin';

-- Atualizar role Admin
UPDATE public.roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{intelligent_service}',
  '{
    "view_intelligent_service": true,
    "manage_intelligent_service": true,
    "manage_products": true,
    "configure_flows": true,
    "configure_team_strategies": true,
    "configure_chat_interface": true,
    "view_metrics": true,
    "export_data": true
  }'::jsonb,
  true
)
WHERE name = 'Admin';

-- Atualizar role Manager (se existir)
UPDATE public.roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{intelligent_service}',
  '{
    "view_intelligent_service": true,
    "manage_intelligent_service": false,
    "manage_products": false,
    "configure_flows": false,
    "configure_team_strategies": false,
    "configure_chat_interface": false,
    "view_metrics": true,
    "export_data": false
  }'::jsonb,
  true
)
WHERE name = 'Manager';

-- Atualizar role Agente
UPDATE public.roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{intelligent_service}',
  '{
    "view_intelligent_service": false,
    "manage_intelligent_service": false,
    "manage_products": false,
    "configure_flows": false,
    "configure_team_strategies": false,
    "configure_chat_interface": false,
    "view_metrics": false,
    "export_data": false
  }'::jsonb,
  true
)
WHERE name = 'Agente';

-- =====================================================
-- 2. ATUALIZAR ROLES CUSTOMIZADAS DAS ORGANIZAÇÕES
-- =====================================================

-- Atualizar todas as roles customizadas existentes (que não são globais)
-- Adicionar as permissões apenas se ainda não existirem
UPDATE public.roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{intelligent_service}',
  '{
    "view_intelligent_service": false,
    "manage_intelligent_service": false,
    "manage_products": false,
    "configure_flows": false,
    "configure_team_strategies": false,
    "configure_chat_interface": false,
    "view_metrics": false,
    "export_data": false
  }'::jsonb,
  true
)
WHERE organization_id IS NOT NULL 
  AND (permissions->'intelligent_service') IS NULL;

-- =====================================================
-- 3. VERIFICAÇÃO E LOG
-- =====================================================

-- Verificar quantas roles foram atualizadas
DO $$
DECLARE
  global_roles_count INTEGER;
  custom_roles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO global_roles_count FROM public.roles 
  WHERE organization_id IS NULL AND (permissions->'intelligent_service') IS NOT NULL;
  
  SELECT COUNT(*) INTO custom_roles_count FROM public.roles 
  WHERE organization_id IS NOT NULL AND (permissions->'intelligent_service') IS NOT NULL;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migração de permissões concluída!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '- Roles globais atualizadas: %', global_roles_count;
  RAISE NOTICE '- Roles customizadas atualizadas: %', custom_roles_count;
  RAISE NOTICE '===========================================';
END $$;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================

