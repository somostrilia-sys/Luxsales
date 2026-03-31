-- Adicionar colunas faltantes em call_logs para Historico.tsx
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS lucas_summary TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES collaborators(id);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_transcript JSONB;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_id UUID;

CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_collaborator_id ON call_logs(collaborator_id);
