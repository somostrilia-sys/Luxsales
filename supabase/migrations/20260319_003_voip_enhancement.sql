-- ============================================================
-- FASE 3: VOIP ENHANCEMENT
-- Pre-requisitos: Fase 1 (001_foundation.sql)
-- ============================================================

BEGIN;

-- ============================================================
-- 3.1 CREATE sip_trunks
-- ============================================================
CREATE TABLE IF NOT EXISTS sip_trunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  sip_host TEXT NOT NULL,
  sip_port INTEGER DEFAULT 5060,
  sip_transport TEXT DEFAULT 'UDP' CHECK (sip_transport IN ('UDP','TCP','TLS','WSS')),
  auth_username TEXT,
  auth_password_vault_id TEXT,
  auth_realm TEXT,
  outbound_proxy TEXT,
  inbound_did_pattern TEXT,
  codecs TEXT[] DEFAULT '{G.711a,G.711u,G.729,OPUS}',
  max_channels INTEGER DEFAULT 10,
  active_channels INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  failover_trunk_id UUID REFERENCES sip_trunks(id) ON DELETE SET NULL,
  dtmf_mode TEXT DEFAULT 'rfc2833' CHECK (dtmf_mode IN ('rfc2833','inband','info','auto')),
  registration_required BOOLEAN DEFAULT true,
  registration_status TEXT DEFAULT 'unregistered'
    CHECK (registration_status IN ('unregistered','registering','registered','failed','expired')),
  last_registered_at TIMESTAMPTZ,
  nat_traversal BOOLEAN DEFAULT true,
  stun_server TEXT,
  keep_alive_interval INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sip_trunks_company ON sip_trunks(company_id);
CREATE INDEX IF NOT EXISTS idx_sip_trunks_active ON sip_trunks(is_active) WHERE is_active = true;

COMMENT ON TABLE sip_trunks IS 'Configuracao de trunks SIP - substitui campos sip_* da tabela companies';
COMMENT ON COLUMN sip_trunks.auth_password_vault_id IS 'Referencia ao Supabase Vault - NAO armazenar senha em texto plano';

-- ============================================================
-- 3.2 CREATE sip_extensions
-- ============================================================
CREATE TABLE IF NOT EXISTS sip_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trunk_id UUID NOT NULL REFERENCES sip_trunks(id) ON DELETE CASCADE,
  extension_number TEXT NOT NULL,
  display_name TEXT,
  collaborator_id UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  auth_username TEXT,
  auth_password_vault_id TEXT,
  voicemail_enabled BOOLEAN DEFAULT false,
  voicemail_pin_vault_id TEXT,
  voicemail_email TEXT,
  call_forward_number TEXT,
  call_forward_on_busy BOOLEAN DEFAULT false,
  call_forward_on_no_answer BOOLEAN DEFAULT false,
  no_answer_timeout_sec INTEGER DEFAULT 30,
  do_not_disturb BOOLEAN DEFAULT false,
  recording_policy TEXT DEFAULT 'all'
    CHECK (recording_policy IN ('all','inbound','outbound','none')),
  max_concurrent_calls INTEGER DEFAULT 2,
  caller_id_override TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  device_type TEXT,
  device_info JSONB,
  last_registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, extension_number)
);

CREATE INDEX IF NOT EXISTS idx_sip_extensions_company ON sip_extensions(company_id);
CREATE INDEX IF NOT EXISTS idx_sip_extensions_collaborator ON sip_extensions(collaborator_id) WHERE collaborator_id IS NOT NULL;

COMMENT ON TABLE sip_extensions IS 'Ramais SIP vinculados a trunks e colaboradores';

-- ============================================================
-- 3.3 CREATE call_recordings
-- ============================================================
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  recording_url TEXT NOT NULL,
  storage_path TEXT,
  storage_bucket TEXT DEFAULT 'call-recordings',
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  format TEXT DEFAULT 'wav' CHECK (format IN ('wav','mp3','ogg','webm')),
  sample_rate INTEGER DEFAULT 8000,
  channels INTEGER DEFAULT 1,
  transcription_status TEXT DEFAULT 'pending'
    CHECK (transcription_status IN ('pending','processing','completed','failed','skipped')),
  transcription_text TEXT,
  transcription_segments JSONB,
  transcription_provider TEXT,
  transcription_language TEXT DEFAULT 'pt-BR',
  transcription_confidence NUMERIC(5,4),
  consent_obtained BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  retention_policy_days INTEGER DEFAULT 90,
  retention_expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_recordings_company ON call_recordings(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_recordings_call ON call_recordings(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_recordings_transcription ON call_recordings(transcription_status)
  WHERE transcription_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_call_recordings_retention ON call_recordings(retention_expires_at)
  WHERE deleted_at IS NULL AND retention_expires_at IS NOT NULL;

COMMENT ON TABLE call_recordings IS 'Gravacoes de chamadas com transcricao e controle de retencao';

-- ============================================================
-- 3.4 CREATE call_quality_metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS call_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  direction TEXT CHECK (direction IN ('inbound','outbound')),
  mos_score NUMERIC(3,2) CHECK (mos_score >= 1.0 AND mos_score <= 5.0),
  jitter_ms NUMERIC(8,2),
  packet_loss_percent NUMERIC(5,2),
  round_trip_latency_ms NUMERIC(8,2),
  codec TEXT,
  bytes_sent BIGINT,
  bytes_received BIGINT,
  packets_sent BIGINT,
  packets_received BIGINT,
  r_factor NUMERIC(5,2),
  network_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_quality_call ON call_quality_metrics(call_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_company ON call_quality_metrics(company_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_quality_mos ON call_quality_metrics(mos_score) WHERE mos_score < 3.0;

COMMENT ON TABLE call_quality_metrics IS 'Metricas de qualidade de chamada - MOS, jitter, packet loss, latencia';

-- ============================================================
-- 3.5 CREATE ivr_menus
-- ============================================================
CREATE TABLE IF NOT EXISTS ivr_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trunk_id UUID REFERENCES sip_trunks(id) ON DELETE SET NULL,
  greeting_audio_url TEXT,
  greeting_tts_text TEXT,
  greeting_voice_key TEXT,
  timeout_seconds INTEGER DEFAULT 10,
  max_retries INTEGER DEFAULT 3,
  invalid_input_message TEXT DEFAULT 'Opcao invalida. Tente novamente.',
  timeout_message TEXT DEFAULT 'Nao recebi sua opcao. Tente novamente.',
  options JSONB NOT NULL DEFAULT '[]',
  business_hours JSONB,
  after_hours_action JSONB,
  is_active BOOLEAN DEFAULT true,
  parent_menu_id UUID REFERENCES ivr_menus(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ivr_menus_company ON ivr_menus(company_id);

COMMENT ON TABLE ivr_menus IS 'Menus de URA (IVR) com opcoes, horario comercial e sub-menus';
COMMENT ON COLUMN ivr_menus.options IS 'Array: [{digit, label, action_type (transfer/submenu/queue/voicemail/external), action_target}]';
COMMENT ON COLUMN ivr_menus.business_hours IS '{days: [1-7], start: "08:00", end: "18:00", timezone: "America/Sao_Paulo"}';

-- ============================================================
-- 3.6 CREATE call_transfers
-- ============================================================
CREATE TABLE IF NOT EXISTS call_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  original_call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('blind','attended','queue','ivr','ai')),
  from_extension_id UUID REFERENCES sip_extensions(id) ON DELETE SET NULL,
  from_agent_name TEXT,
  to_extension_id UUID REFERENCES sip_extensions(id) ON DELETE SET NULL,
  to_external_number TEXT,
  to_queue_name TEXT,
  transfer_status TEXT DEFAULT 'initiated'
    CHECK (transfer_status IN ('initiated','ringing','answered','completed','failed','cancelled','timeout')),
  transfer_reason TEXT,
  initiated_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  new_call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_transfers_call ON call_transfers(original_call_id);
CREATE INDEX IF NOT EXISTS idx_call_transfers_company ON call_transfers(company_id, created_at DESC);

COMMENT ON TABLE call_transfers IS 'Registro de transferencias de chamadas entre ramais/filas/URA';

-- ============================================================
-- 3.7 CREATE pbx_config
-- ============================================================
CREATE TABLE IF NOT EXISTS pbx_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  music_on_hold_url TEXT,
  ring_timeout_sec INTEGER DEFAULT 30,
  max_concurrent_calls INTEGER DEFAULT 10,
  recording_policy TEXT DEFAULT 'all'
    CHECK (recording_policy IN ('all','inbound','outbound','none')),
  recording_consent_prompt BOOLEAN DEFAULT true,
  recording_consent_audio_url TEXT,
  voicemail_enabled BOOLEAN DEFAULT true,
  voicemail_greeting_url TEXT,
  voicemail_max_duration_sec INTEGER DEFAULT 120,
  voicemail_email_notification BOOLEAN DEFAULT true,
  caller_id_mode TEXT DEFAULT 'company'
    CHECK (caller_id_mode IN ('company','extension','custom','dynamic')),
  custom_caller_id TEXT,
  call_parking_enabled BOOLEAN DEFAULT false,
  intercom_enabled BOOLEAN DEFAULT false,
  call_queue_strategy TEXT DEFAULT 'round_robin'
    CHECK (call_queue_strategy IN ('round_robin','least_calls','random','ring_all','priority')),
  call_queue_timeout_sec INTEGER DEFAULT 300,
  call_queue_max_size INTEGER DEFAULT 20,
  business_hours JSONB,
  after_hours_action TEXT DEFAULT 'voicemail'
    CHECK (after_hours_action IN ('voicemail','ivr','forward','hangup','message')),
  after_hours_target TEXT,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pbx_config IS 'Configuracao do PBX virtual por empresa - URA, filas, gravacao, horario';

-- ============================================================
-- 3.8 ALTER calls (existente)
-- ============================================================
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS trunk_id UUID REFERENCES sip_trunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extension_id UUID REFERENCES sip_extensions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES call_recordings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ivr_path JSONB,
  ADD COLUMN IF NOT EXISTS hangup_source TEXT
    CHECK (hangup_source IN ('caller','callee','system','timeout','ai','transfer')),
  ADD COLUMN IF NOT EXISTS ring_duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS talk_duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS hold_duration_sec INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billable_duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS cost_brl NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS codec TEXT,
  ADD COLUMN IF NOT EXISTS quality_mos NUMERIC(3,2);

CREATE INDEX IF NOT EXISTS idx_calls_trunk ON calls(trunk_id) WHERE trunk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_extension ON calls(extension_id) WHERE extension_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_quality ON calls(quality_mos) WHERE quality_mos IS NOT NULL AND quality_mos < 3.0;

COMMIT;
