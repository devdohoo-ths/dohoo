-- Migração para melhorar a criação automática de perfis de usuário
-- Atualizar a função handle_new_user para não usar email como nome

-- Função para extrair nome amigável do email
CREATE OR REPLACE FUNCTION extract_name_from_email(email_address TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Extrair a parte antes do @ e capitalizar
  RETURN INITCAP(SPLIT_PART(email_address, '@', 1));
END;
$$ LANGUAGE plpgsql;

-- Atualizar a função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name', 
      extract_name_from_email(NEW.email)
    ),
    'agent'
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar a função auxiliar
DROP FUNCTION IF EXISTS extract_name_from_email(TEXT); 