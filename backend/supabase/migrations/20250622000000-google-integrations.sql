-- Tabela para armazenar integrações do Google por organização
CREATE TABLE google_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('calendar', 'drive', 'gmail')),
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expiry_date TIMESTAMP WITH TIME ZONE,
    scope TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX idx_google_integrations_org_user ON google_integrations(organization_id, user_id);
CREATE INDEX idx_google_integrations_service ON google_integrations(service_type);
CREATE INDEX idx_google_integrations_active ON google_integrations(is_active);

-- Tabela para armazenar eventos do Google Calendar
CREATE TABLE google_calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    google_event_id TEXT NOT NULL,
    client_phone_number TEXT,
    user_email TEXT NOT NULL,
    start_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    summary TEXT,
    description TEXT,
    location TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'rescheduled')),
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para eventos
CREATE INDEX idx_google_calendar_events_org ON google_calendar_events(organization_id);
CREATE INDEX idx_google_calendar_events_user ON google_calendar_events(user_id);
CREATE INDEX idx_google_calendar_events_google_id ON google_calendar_events(google_event_id);
CREATE INDEX idx_google_calendar_events_phone ON google_calendar_events(client_phone_number);
CREATE INDEX idx_google_calendar_events_status ON google_calendar_events(status);
CREATE INDEX idx_google_calendar_events_date_range ON google_calendar_events(start_date_time, end_date_time);

-- Tabela para armazenar arquivos do Google Drive
CREATE TABLE google_drive_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    google_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT,
    folder_id TEXT,
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para arquivos
CREATE INDEX idx_google_drive_files_org ON google_drive_files(organization_id);
CREATE INDEX idx_google_drive_files_user ON google_drive_files(user_id);
CREATE INDEX idx_google_drive_files_google_id ON google_drive_files(google_file_id);
CREATE INDEX idx_google_drive_files_chat ON google_drive_files(chat_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_google_integrations_updated_at 
    BEFORE UPDATE ON google_integrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_calendar_events_updated_at 
    BEFORE UPDATE ON google_calendar_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_drive_files_updated_at 
    BEFORE UPDATE ON google_drive_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_files ENABLE ROW LEVEL SECURITY;

-- Políticas para google_integrations
CREATE POLICY "Users can view their own google integrations" ON google_integrations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own google integrations" ON google_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google integrations" ON google_integrations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google integrations" ON google_integrations
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para google_calendar_events
CREATE POLICY "Users can view their own calendar events" ON google_calendar_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events" ON google_calendar_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events" ON google_calendar_events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events" ON google_calendar_events
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para google_drive_files
CREATE POLICY "Users can view their own drive files" ON google_drive_files
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drive files" ON google_drive_files
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drive files" ON google_drive_files
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drive files" ON google_drive_files
    FOR DELETE USING (auth.uid() = user_id); 