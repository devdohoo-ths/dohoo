-- Tabela para armazenar transcrições
CREATE TABLE IF NOT EXISTS transcripts (
    id SERIAL PRIMARY KEY,
    chat_id UUID REFERENCES chats(id),
    audio_file_path VARCHAR(255),
    transcript_text TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para armazenar conversões de áudio
CREATE TABLE IF NOT EXISTS audio_conversions (
    id SERIAL PRIMARY KEY,
    transcript_id INTEGER REFERENCES transcripts(id),
    original_audio_path VARCHAR(255),
    converted_audio_path VARCHAR(255),
    voice_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_transcripts_chat_id ON transcripts(chat_id);
CREATE INDEX IF NOT EXISTS idx_audio_conversions_transcript_id ON audio_conversions(transcript_id); 