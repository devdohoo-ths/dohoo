-- Adicionar foreign key entre whatsapp_accounts e profiles
ALTER TABLE public.whatsapp_accounts
ADD CONSTRAINT whatsapp_accounts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Adicionar foreign key entre whatsapp_accounts e profiles (via user_id)
-- Isso permite que o Supabase reconheça a relação para JOINs
ALTER TABLE public.whatsapp_accounts
ADD CONSTRAINT whatsapp_accounts_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; 