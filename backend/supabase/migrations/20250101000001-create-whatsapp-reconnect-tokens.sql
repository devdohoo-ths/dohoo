-- =====================================================
-- TOKENS DE RECONEXÃO DO WHATSAPP
-- =====================================================

CREATE TABLE IF NOT EXISTS whatsapp_reconnect_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL REFERENCES whatsapp_accounts(account_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_reconnect_tokens_account ON whatsapp_reconnect_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_reconnect_tokens_user ON whatsapp_reconnect_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_reconnect_tokens_expires_at ON whatsapp_reconnect_tokens(expires_at);

COMMENT ON TABLE whatsapp_reconnect_tokens IS 'Tokens temporários que permitem regenerar QR Code de contas WhatsApp quando um novo pareamento é necessário.';
COMMENT ON COLUMN whatsapp_reconnect_tokens.token IS 'Token único enviado por e-mail para regenerar o QR Code.';
COMMENT ON COLUMN whatsapp_reconnect_tokens.expires_at IS 'Momento em que o token expira e deixa de ser válido.';
COMMENT ON COLUMN whatsapp_reconnect_tokens.used_at IS 'Momento em que o token foi utilizado para gerar um novo QR Code.';

