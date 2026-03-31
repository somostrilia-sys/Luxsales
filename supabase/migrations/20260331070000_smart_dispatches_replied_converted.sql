-- Adicionar campos de tracking em smart_dispatches para histórico de Disparos
ALTER TABLE smart_dispatches ADD COLUMN IF NOT EXISTS replied BOOLEAN DEFAULT FALSE;
ALTER TABLE smart_dispatches ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT FALSE;
ALTER TABLE smart_dispatches ADD COLUMN IF NOT EXISTS wa_status TEXT;
CREATE INDEX IF NOT EXISTS idx_smart_dispatches_replied ON smart_dispatches(replied) WHERE replied = true;
