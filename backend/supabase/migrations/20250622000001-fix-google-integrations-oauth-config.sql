-- Migration para adicionar 'oauth_config' ao check constraint do service_type
-- Isso permite configurar credenciais OAuth2 separadamente da conexão de contas

-- Remover o check constraint atual
ALTER TABLE google_integrations DROP CONSTRAINT IF EXISTS google_integrations_service_type_check;

-- Adicionar o novo check constraint com 'oauth_config'
ALTER TABLE google_integrations ADD CONSTRAINT google_integrations_service_type_check 
    CHECK (service_type IN ('calendar', 'drive', 'gmail', 'oauth_config'));

-- Comentário explicativo
COMMENT ON COLUMN google_integrations.service_type IS 
    'Tipo de serviço: calendar, drive, gmail, ou oauth_config (para configuração OAuth2)'; 