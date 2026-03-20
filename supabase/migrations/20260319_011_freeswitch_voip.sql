-- ============================================================
-- Walk Agente Central Hub
-- Migration 011: FreeSWITCH VoIP Integration
-- Campos adicionais para integração com FreeSWITCH
-- ============================================================

-- 11.1 Campos extras na tabela calls para FreeSWITCH
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS is_recorded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_stopped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_file_path TEXT,
  ADD COLUMN IF NOT EXISTS recording_file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS freeswitch_uuid TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound'
    CHECK (direction IN ('inbound','outbound','internal'));

-- Índice para buscar chamadas gravadas rapidamente
CREATE INDEX IF NOT EXISTS idx_calls_is_recorded
  ON calls(company_id, is_recorded) WHERE is_recorded = true;

-- Índice para buscar por UUID do FreeSWITCH
CREATE INDEX IF NOT EXISTS idx_calls_freeswitch_uuid
  ON calls(freeswitch_uuid) WHERE freeswitch_uuid IS NOT NULL;

-- Índice para filtrar por direção
CREATE INDEX IF NOT EXISTS idx_calls_direction
  ON calls(company_id, direction);

COMMENT ON COLUMN calls.is_recorded IS 'Se a chamada foi gravada';
COMMENT ON COLUMN calls.recording_file_path IS 'Caminho no VPS FreeSWITCH antes de upload ao Storage';
COMMENT ON COLUMN calls.freeswitch_uuid IS 'UUID interno do FreeSWITCH para correlação de eventos';
COMMENT ON COLUMN calls.direction IS 'Direção: inbound, outbound, internal';

-- 11.2 Tabela para logs do FreeSWITCH (debugging e auditoria)
CREATE TABLE IF NOT EXISTS freeswitch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_events_call ON freeswitch_events(call_id);
CREATE INDEX IF NOT EXISTS idx_fs_events_company ON freeswitch_events(company_id, created_at DESC);

ALTER TABLE freeswitch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation for freeswitch_events"
  ON freeswitch_events FOR ALL
  USING (company_id IN (
    SELECT company_id FROM collaborators WHERE user_id = auth.uid()
  ));

COMMENT ON TABLE freeswitch_events IS 'Log de eventos do FreeSWITCH para debugging e auditoria';

-- 11.3 Trigger para setar is_recorded automaticamente
CREATE OR REPLACE FUNCTION fn_update_call_recorded()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE calls
  SET is_recorded = true,
      recording_id = NEW.id
  WHERE id = NEW.call_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_recording_created ON call_recordings;
CREATE TRIGGER trg_call_recording_created
  AFTER INSERT ON call_recordings
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_call_recorded();

-- 11.4 View para dashboard de chamadas gravadas
CREATE OR REPLACE VIEW v_recorded_calls AS
SELECT
  c.id,
  c.company_id,
  c.direction,
  c.caller_number,
  c.destination_number,
  c.status,
  c.duration_seconds,
  c.billable_duration_sec,
  c.cost_brl,
  c.is_recorded,
  c.hangup_cause,
  c.quality_mos,
  c.recording_url,
  c.created_at,
  cr.recording_url AS storage_recording_url,
  cr.duration_seconds AS recording_duration,
  cr.file_size_bytes,
  cr.transcription_status,
  cr.transcription_text,
  cr.transcription_confidence,
  cr.consent_obtained
FROM calls c
LEFT JOIN call_recordings cr ON cr.call_id = c.id
WHERE c.is_recorded = true
ORDER BY c.created_at DESC;

COMMENT ON VIEW v_recorded_calls IS 'Chamadas gravadas com dados da gravação e transcrição';
