-- Migração para corrigir nomes de perfis que estão usando email
-- Esta migração atualiza perfis onde o nome é igual ao email

-- Função para extrair nome amigável do email
CREATE OR REPLACE FUNCTION extract_name_from_email(email_address TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Extrair a parte antes do @
  RETURN INITCAP(SPLIT_PART(email_address, '@', 1));
END;
$$ LANGUAGE plpgsql;

-- Atualizar perfis onde o nome é igual ao email
UPDATE public.profiles 
SET name = extract_name_from_email(email)
WHERE name = email 
  AND email IS NOT NULL 
  AND email != '';

-- Limpar a função após o uso
DROP FUNCTION IF EXISTS extract_name_from_email(TEXT);

-- Log das alterações
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Perfis atualizados: %', updated_count;
END $$; 