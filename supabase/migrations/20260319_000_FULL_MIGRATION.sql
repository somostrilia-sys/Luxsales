-- ============================================================
-- FASE 1: FUNDACAO
-- Pré-requisitos: nenhum
-- Tabelas: ALTER companies, CREATE audit_logs, CREATE billing_usage
-- ============================================================

BEGIN;

-- ============================================================
-- 1.1 ALTER companies - adicionar campos Meta BSP e LGPD
-- ============================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS meta_business_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_app_id TEXT,
  ADD COLUMN IF NOT EXISTS lgpd_dpo_email TEXT,
  ADD COLUMN IF NOT EXISTS lgpd_dpo_name TEXT,
  ADD COLUMN IF NOT EXISTS messaging_tier TEXT DEFAULT 'TIER_250'
    CHECK (messaging_tier IN ('TIER_250','TIER_1K','TIER_10K','TIER_100K','UNLIMITED')),
  ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'basic'
    CHECK (plan_tier IN ('basic','starter','professional','enterprise','custom'));

COMMENT ON COLUMN companies.meta_business_id IS 'Meta Business Manager ID para BSP';
COMMENT ON COLUMN companies.meta_app_id IS 'Meta App ID do Facebook Developer';
COMMENT ON COLUMN companies.lgpd_dpo_email IS 'Email do DPO (Data Protection Officer) - LGPD';
COMMENT ON COLUMN companies.lgpd_dpo_name IS 'Nome do DPO - LGPD';
COMMENT ON COLUMN companies.messaging_tier IS 'Tier de limite de mensagens Meta WhatsApp';
COMMENT ON COLUMN companies.plan_tier IS 'Plano da empresa na plataforma';

-- ============================================================
-- 1.2 CREATE audit_logs - rastreamento de compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','LOGIN','EXPORT','API_CALL')),
  actor_id UUID,
  actor_type TEXT CHECK (actor_type IN ('user','system','api','webhook','cron')),
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created
  ON audit_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record
  ON audit_logs (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action, created_at DESC);

COMMENT ON TABLE audit_logs IS 'Log de auditoria para compliance LGPD e Meta BSP';

-- ============================================================
-- 1.3 CREATE billing_usage - custos cross-channel
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','voip','ai_call','sms','telegram','email')),
  usage_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost_brl NUMERIC(10,6) DEFAULT 0,
  total_cost_brl NUMERIC(12,4) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  reference_id UUID,
  reference_table TEXT,
  meta_conversation_id TEXT,
  billing_period_start DATE,
  billing_period_end DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_company_channel
  ON billing_usage (company_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_usage_period
  ON billing_usage (company_id, billing_period_start, billing_period_end);

CREATE INDEX IF NOT EXISTS idx_billing_usage_reference
  ON billing_usage (reference_table, reference_id)
  WHERE reference_id IS NOT NULL;

COMMENT ON TABLE billing_usage IS 'Rastreamento de custos e uso cross-channel (WhatsApp, VoIP, AI Call, SMS)';

COMMIT;
-- ============================================================
-- FASE 2: WHATSAPP META BSP CORE
-- Pre-requisitos: Fase 1 (001_foundation.sql)
-- ============================================================

BEGIN;

-- ============================================================
-- 2.1 ALTER whatsapp_meta_credentials
-- ============================================================
ALTER TABLE whatsapp_meta_credentials
  ADD COLUMN IF NOT EXISTS app_id TEXT,
  ADD COLUMN IF NOT EXISTS app_secret_vault_id TEXT,
  ADD COLUMN IF NOT EXISTS business_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS api_version TEXT DEFAULT 'v21.0',
  ADD COLUMN IF NOT EXISTS quality_rating TEXT CHECK (quality_rating IN ('GREEN','YELLOW','RED')),
  ADD COLUMN IF NOT EXISTS messaging_limit_tier TEXT DEFAULT 'TIER_250'
    CHECK (messaging_limit_tier IN ('TIER_250','TIER_1K','TIER_10K','TIER_100K','UNLIMITED')),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_pem TEXT,
  ADD COLUMN IF NOT EXISTS certificate_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS system_user_token_vault_id TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending'
    CHECK (onboarding_status IN ('pending','in_progress','verified','active','suspended','revoked')),
  ADD COLUMN IF NOT EXISTS embedded_signup_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solution_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN whatsapp_meta_credentials.app_secret_vault_id IS 'Referencia ao Supabase Vault - NAO armazenar secret em texto plano';
COMMENT ON COLUMN whatsapp_meta_credentials.system_user_token_vault_id IS 'Referencia ao Supabase Vault para system user token';

-- ============================================================
-- 2.2 CREATE whatsapp_meta_phone_numbers
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_meta_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES whatsapp_meta_credentials(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL UNIQUE,
  display_phone TEXT NOT NULL,
  verified_name TEXT,
  quality_rating TEXT CHECK (quality_rating IN ('GREEN','YELLOW','RED')),
  messaging_limit INTEGER DEFAULT 250,
  messaging_limit_tier TEXT DEFAULT 'TIER_250'
    CHECK (messaging_limit_tier IN ('TIER_250','TIER_1K','TIER_10K','TIER_100K','UNLIMITED')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','connected','disconnected','banned','migrating','flagged')),
  name_status TEXT CHECK (name_status IN ('APPROVED','DECLINED','PENDING','EXPIRED')),
  code_verification_status TEXT CHECK (code_verification_status IN ('NOT_VERIFIED','VERIFIED','EXPIRED')),
  platform_type TEXT DEFAULT 'CLOUD_API',
  is_official_business_account BOOLEAN DEFAULT false,
  is_pin_enabled BOOLEAN DEFAULT false,
  throughput_level TEXT DEFAULT 'STANDARD'
    CHECK (throughput_level IN ('STANDARD','HIGH')),
  max_msgs_per_second INTEGER DEFAULT 80,
  webhook_url TEXT,
  last_onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_phone_numbers_company ON whatsapp_meta_phone_numbers(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_phone_numbers_quality ON whatsapp_meta_phone_numbers(quality_rating);
CREATE INDEX IF NOT EXISTS idx_wa_phone_numbers_status ON whatsapp_meta_phone_numbers(status);

COMMENT ON TABLE whatsapp_meta_phone_numbers IS 'Numeros de telefone registrados na Meta WhatsApp Cloud API';

-- ============================================================
-- 2.3 CREATE whatsapp_meta_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_meta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number_id UUID REFERENCES whatsapp_meta_phone_numbers(id) ON DELETE SET NULL,
  meta_template_id TEXT,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  sub_category TEXT,
  status TEXT DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','PAUSED','DISABLED','APPEAL_REQUESTED','IN_APPEAL','DELETED')),
  quality_score TEXT CHECK (quality_score IN ('GREEN','YELLOW','RED','UNKNOWN')),
  components JSONB NOT NULL DEFAULT '[]',
  example_values JSONB,
  rejection_reason TEXT,
  previous_category TEXT,
  cta_url_link_tracking_opted_out BOOLEAN DEFAULT false,
  message_send_ttl_seconds INTEGER DEFAULT 86400,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  UNIQUE(company_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_company_cat ON whatsapp_meta_templates(company_id, category, status);
CREATE INDEX IF NOT EXISTS idx_wa_templates_status ON whatsapp_meta_templates(status);
CREATE INDEX IF NOT EXISTS idx_wa_templates_meta_id ON whatsapp_meta_templates(meta_template_id) WHERE meta_template_id IS NOT NULL;

COMMENT ON TABLE whatsapp_meta_templates IS 'Templates de mensagem aprovados pela Meta - obrigatorio para mensagens business-initiated';
COMMENT ON COLUMN whatsapp_meta_templates.components IS 'Array JSON com header/body/footer/buttons seguindo spec Meta';

-- ============================================================
-- 2.4 CREATE whatsapp_meta_opt_ins (LGPD compliance)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_meta_opt_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  opt_in_method TEXT NOT NULL
    CHECK (opt_in_method IN ('website_form','whatsapp_reply','sms','paper','api','imported','qr_code','click_to_wa')),
  opt_in_source TEXT,
  opted_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opted_out_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  consent_text TEXT NOT NULL,
  consent_ip INET,
  consent_user_agent TEXT,
  -- LGPD fields
  lgpd_legal_basis TEXT CHECK (lgpd_legal_basis IN ('consent','legitimate_interest','contract','legal_obligation')),
  lgpd_data_purpose TEXT,
  lgpd_retention_days INTEGER DEFAULT 365,
  lgpd_deletion_requested_at TIMESTAMPTZ,
  lgpd_deletion_completed_at TIMESTAMPTZ,
  lgpd_anonymized BOOLEAN DEFAULT false,
  proof_document_url TEXT,
  -- Marketing consent granular
  consent_marketing BOOLEAN DEFAULT false,
  consent_transactional BOOLEAN DEFAULT true,
  consent_support BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_wa_opt_ins_active ON whatsapp_meta_opt_ins(company_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wa_opt_ins_phone ON whatsapp_meta_opt_ins(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_opt_ins_lgpd_deletion ON whatsapp_meta_opt_ins(lgpd_deletion_requested_at)
  WHERE lgpd_deletion_requested_at IS NOT NULL AND lgpd_deletion_completed_at IS NULL;

COMMENT ON TABLE whatsapp_meta_opt_ins IS 'Registro de consentimento/opt-in para LGPD e compliance Meta';

-- ============================================================
-- 2.5 CREATE whatsapp_meta_webhook_events
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_meta_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  event_type TEXT NOT NULL,
  event_subtype TEXT,
  wamid TEXT,
  from_phone TEXT,
  to_phone TEXT,
  payload JSONB NOT NULL,
  processing_status TEXT DEFAULT 'received'
    CHECK (processing_status IN ('received','processing','processed','failed','ignored','duplicate')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_company_time ON whatsapp_meta_webhook_events(company_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_wamid ON whatsapp_meta_webhook_events(wamid) WHERE wamid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_webhook_pending ON whatsapp_meta_webhook_events(processing_status, received_at)
  WHERE processing_status IN ('received','failed');
CREATE INDEX IF NOT EXISTS idx_wa_webhook_idempotency ON whatsapp_meta_webhook_events(idempotency_key);

COMMENT ON TABLE whatsapp_meta_webhook_events IS 'Log de todos os webhook events recebidos da Meta - base para processamento e auditoria';

-- ============================================================
-- 2.6 ALTER whatsapp_meta_messages
-- ============================================================
ALTER TABLE whatsapp_meta_messages
  ADD COLUMN IF NOT EXISTS pricing_category TEXT
    CHECK (pricing_category IN ('marketing','utility','authentication','service','referral_conversion')),
  ADD COLUMN IF NOT EXISTS meta_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS conversation_type TEXT,
  ADD COLUMN IF NOT EXISTS conversation_origin TEXT
    CHECK (conversation_origin IN ('business_initiated','user_initiated','referral_conversion')),
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_title TEXT,
  ADD COLUMN IF NOT EXISTS error_details JSONB,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES whatsapp_meta_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_brl NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS phone_number_fk UUID REFERENCES whatsapp_meta_phone_numbers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opt_in_id UUID REFERENCES whatsapp_meta_opt_ins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_wamid TEXT,
  ADD COLUMN IF NOT EXISTS reaction_emoji TEXT,
  ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequently_forwarded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_wa_meta_msgs_conversation ON whatsapp_meta_messages(meta_conversation_id)
  WHERE meta_conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_meta_msgs_template ON whatsapp_meta_messages(template_id)
  WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_meta_msgs_pricing ON whatsapp_meta_messages(pricing_category, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_meta_msgs_status ON whatsapp_meta_messages(status, created_at DESC);

-- ============================================================
-- 2.7 CREATE whatsapp_meta_conversations_billing
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_meta_conversations_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meta_conversation_id TEXT NOT NULL UNIQUE,
  phone_number_id UUID REFERENCES whatsapp_meta_phone_numbers(id) ON DELETE SET NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION','SERVICE','REFERRAL_CONVERSION')),
  origin TEXT NOT NULL CHECK (origin IN ('business_initiated','user_initiated')),
  is_billable BOOLEAN DEFAULT true,
  is_free_tier BOOLEAN DEFAULT false,
  is_free_entry_point BOOLEAN DEFAULT false,
  free_entry_point_type TEXT,
  pricing_model TEXT DEFAULT 'per_message'
    CHECK (pricing_model IN ('per_message','per_conversation')),
  cost_brl NUMERIC(10,6) DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  first_message_wamid TEXT,
  message_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_billing_company ON whatsapp_meta_conversations_billing(company_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_wa_billing_category ON whatsapp_meta_conversations_billing(category, is_billable);
CREATE INDEX IF NOT EXISTS idx_wa_billing_contact ON whatsapp_meta_conversations_billing(contact_phone, window_start);

COMMENT ON TABLE whatsapp_meta_conversations_billing IS 'Janelas de conversa Meta para billing - modelo per_message a partir de Jul 2025';

-- ============================================================
-- 2.8 CREATE whatsapp_meta_rate_limits
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_meta_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number_id UUID REFERENCES whatsapp_meta_phone_numbers(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL
    CHECK (limit_type IN ('messaging','template_send','media_upload','api_call','conversation_initiation')),
  max_per_second INTEGER DEFAULT 80,
  max_per_day INTEGER,
  current_window_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_duration_seconds INTEGER DEFAULT 1,
  is_throttled BOOLEAN DEFAULT false,
  throttled_until TIMESTAMPTZ,
  violation_count INTEGER DEFAULT 0,
  last_violation_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_rate_limits_company ON whatsapp_meta_rate_limits(company_id, phone_number_id, limit_type);
CREATE INDEX IF NOT EXISTS idx_wa_rate_limits_throttled ON whatsapp_meta_rate_limits(is_throttled)
  WHERE is_throttled = true;

COMMENT ON TABLE whatsapp_meta_rate_limits IS 'Tracking de rate limits - rate limiting real deve ser no app layer (Redis)';

-- ============================================================
-- 2.9 CREATE whatsapp_meta_quality_signals
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_meta_quality_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number_id UUID REFERENCES whatsapp_meta_phone_numbers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES whatsapp_meta_templates(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL
    CHECK (signal_type IN (
      'BLOCK','REPORT','QUALITY_UPDATE','TEMPLATE_PAUSED','TEMPLATE_DISABLED',
      'ACCOUNT_RESTRICT','ACCOUNT_BAN','PHONE_QUALITY_UPDATE','MESSAGING_LIMIT_UPDATE',
      'TEMPLATE_QUALITY_UPDATE'
    )),
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  source TEXT DEFAULT 'webhook' CHECK (source IN ('webhook','api','manual','system')),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_quality_company ON whatsapp_meta_quality_signals(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_quality_phone ON whatsapp_meta_quality_signals(phone_number_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_wa_quality_unresolved ON whatsapp_meta_quality_signals(severity, created_at)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE whatsapp_meta_quality_signals IS 'Sinais de qualidade da Meta - blocks, reports, quality updates, restricoes';

COMMIT;
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
-- ============================================================
-- FASE 4: AI CALLING ENHANCEMENT
-- Pre-requisitos: Fase 1, Fase 3
-- ============================================================

BEGIN;

-- ============================================================
-- 4.1 CREATE ai_call_scripts
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_call_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
  script_type TEXT DEFAULT 'linear'
    CHECK (script_type IN ('linear','branching','dynamic','hybrid')),
  flow JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  system_prompt TEXT,
  personality TEXT,
  max_duration_sec INTEGER DEFAULT 180,
  silence_timeout_sec INTEGER DEFAULT 10,
  fallback_action TEXT DEFAULT 'transfer'
    CHECK (fallback_action IN ('transfer','hangup','voicemail','callback','escalate')),
  fallback_target TEXT,
  variables JSONB DEFAULT '[]',
  compliance_disclaimers TEXT[],
  opening_message TEXT,
  closing_message TEXT,
  objection_handlers JSONB DEFAULT '{}',
  qualification_criteria JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  parent_script_id UUID REFERENCES ai_call_scripts(id) ON DELETE SET NULL,
  total_calls INTEGER DEFAULT 0,
  avg_duration_sec NUMERIC(8,2),
  success_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_scripts_company ON ai_call_scripts(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_scripts_active ON ai_call_scripts(is_active, company_id) WHERE is_active = true;

COMMENT ON TABLE ai_call_scripts IS 'Scripts de conversa para ligacoes IA com fluxo de nodes/edges e branching';
COMMENT ON COLUMN ai_call_scripts.flow IS 'Fluxo: {nodes: [{id, type (greeting/question/objection/close/farewell), content, conditions}], edges: [{from, to, condition}]}';
COMMENT ON COLUMN ai_call_scripts.objection_handlers IS 'Mapa de objecoes comuns e respostas: {"preco_alto": "resposta...", "sem_interesse": "resposta..."}';

-- ============================================================
-- 4.2 CREATE ai_call_training
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_call_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  script_id UUID REFERENCES ai_call_scripts(id) ON DELETE SET NULL,
  training_type TEXT NOT NULL
    CHECK (training_type IN ('few_shot_examples','fine_tune_dataset','rag_documents','objection_library','product_knowledge','competitor_analysis','faq')),
  name TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  source_call_ids UUID[],
  file_url TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','processing','ready','archived','failed')),
  processing_error TEXT,
  token_count INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_training_company ON ai_call_training(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_script ON ai_call_training(script_id) WHERE script_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_training_status ON ai_call_training(status);

COMMENT ON TABLE ai_call_training IS 'Dados de treinamento para IA de ligacoes - exemplos, RAG, objecoes, FAQ';

-- ============================================================
-- 4.3 ALTER call_logs (existente)
-- ============================================================
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS script_id UUID REFERENCES ai_call_scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sentiment_overall TEXT
    CHECK (sentiment_overall IN ('positive','neutral','negative','mixed')),
  ADD COLUMN IF NOT EXISTS sentiment_scores JSONB,
  ADD COLUMN IF NOT EXISTS detected_intents TEXT[],
  ADD COLUMN IF NOT EXISTS extracted_entities JSONB,
  ADD COLUMN IF NOT EXISTS compliance_flags JSONB,
  ADD COLUMN IF NOT EXISTS is_compliant BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS compliance_review_status TEXT DEFAULT 'auto_passed'
    CHECK (compliance_review_status IN ('auto_passed','pending_review','reviewed_ok','reviewed_violation')),
  ADD COLUMN IF NOT EXISTS conversation_quality_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS goal_achieved BOOLEAN,
  ADD COLUMN IF NOT EXISTS goal_details JSONB,
  ADD COLUMN IF NOT EXISTS lead_temperature TEXT
    CHECK (lead_temperature IN ('hot','warm','cold','dead')),
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cost_brl NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tts_characters INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stt_seconds INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_call_logs_script ON call_logs(script_id) WHERE script_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_sentiment ON call_logs(sentiment_overall);
CREATE INDEX IF NOT EXISTS idx_call_logs_temperature ON call_logs(lead_temperature) WHERE lead_temperature IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_compliance ON call_logs(is_compliant) WHERE is_compliant = false;

-- ============================================================
-- 4.4 CREATE ai_voice_clones
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_voice_clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cartesia',
  provider_voice_id TEXT,
  source_recording_ids UUID[],
  source_audio_urls TEXT[],
  training_status TEXT DEFAULT 'pending'
    CHECK (training_status IN ('pending','uploading','training','ready','failed','deprecated')),
  training_error TEXT,
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,
  -- Consent (obrigatorio para clonagem de voz)
  consent_document_url TEXT NOT NULL,
  consent_obtained_at TIMESTAMPTZ NOT NULL,
  consenting_person_name TEXT NOT NULL,
  consenting_person_document TEXT,
  consent_purpose TEXT DEFAULT 'ai_calling',
  -- Caracteristicas
  language TEXT DEFAULT 'pt-BR',
  gender TEXT CHECK (gender IN ('male','female','neutral')),
  age_range TEXT,
  accent TEXT,
  description TEXT,
  sample_audio_url TEXT,
  is_active BOOLEAN DEFAULT true,
  -- Link com voice_profiles existente
  voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_voice_clones_company ON ai_voice_clones(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_voice_clones_status ON ai_voice_clones(training_status);

COMMENT ON TABLE ai_voice_clones IS 'Vozes clonadas para IA - requer consentimento documentado';

-- ============================================================
-- 4.5 CREATE ai_call_analytics
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_call_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  script_id UUID REFERENCES ai_call_scripts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES call_campaigns(id) ON DELETE SET NULL,
  analytics_date DATE NOT NULL,
  -- Volume
  total_calls INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  no_answer_calls INTEGER DEFAULT 0,
  busy_calls INTEGER DEFAULT 0,
  -- Duracao
  avg_duration_sec NUMERIC(8,2) DEFAULT 0,
  total_duration_sec INTEGER DEFAULT 0,
  min_duration_sec INTEGER,
  max_duration_sec INTEGER,
  -- Qualidade
  avg_sentiment_score NUMERIC(3,2),
  avg_quality_score NUMERIC(3,2),
  -- Resultados
  goal_achievement_rate NUMERIC(5,2) DEFAULT 0,
  hot_leads INTEGER DEFAULT 0,
  warm_leads INTEGER DEFAULT 0,
  cold_leads INTEGER DEFAULT 0,
  dead_leads INTEGER DEFAULT 0,
  transfer_count INTEGER DEFAULT 0,
  transfer_rate NUMERIC(5,2) DEFAULT 0,
  hangup_by_contact_rate NUMERIC(5,2) DEFAULT 0,
  -- Inteligencia
  top_intents JSONB,
  top_objections JSONB,
  top_entities JSONB,
  -- Compliance
  compliance_violation_count INTEGER DEFAULT 0,
  -- Custos
  cost_total_brl NUMERIC(12,4) DEFAULT 0,
  cost_per_call_brl NUMERIC(10,4) DEFAULT 0,
  cost_per_lead_brl NUMERIC(10,4) DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  tts_characters_total INTEGER DEFAULT 0,
  stt_seconds_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, script_id, campaign_id, analytics_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_analytics_company ON ai_call_analytics(company_id, analytics_date DESC);

COMMENT ON TABLE ai_call_analytics IS 'Metricas agregadas diarias de ligacoes IA - performance, custos, qualidade';

-- ============================================================
-- 4.6 CREATE ai_call_compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_call_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  compliance_type TEXT NOT NULL
    CHECK (compliance_type IN ('dnc_list','recording_consent','call_hours','procon_complaint','anatel_regulation','lgpd_request','blacklist')),
  phone_number TEXT,
  phone_number_normalized TEXT,
  reason TEXT,
  source TEXT CHECK (source IN ('manual','import','procon','anatel','customer_request','system','api')),
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  added_by UUID,
  reference_number TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_compliance_dnc ON ai_call_compliance(phone_number_normalized)
  WHERE compliance_type = 'dnc_list' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_compliance_company ON ai_call_compliance(company_id, compliance_type);
CREATE INDEX IF NOT EXISTS idx_ai_compliance_type ON ai_call_compliance(compliance_type, is_active);

COMMENT ON TABLE ai_call_compliance IS 'Compliance de ligacoes - DNC (nao ligar), Procon, Anatel, LGPD, blacklist';

-- ============================================================
-- Function: verificar se telefone esta na lista DNC
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_dnc(p_phone TEXT, p_company_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_normalized TEXT;
  v_blocked BOOLEAN;
BEGIN
  -- Normalizar telefone (remover caracteres nao numericos)
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  SELECT EXISTS(
    SELECT 1 FROM ai_call_compliance
    WHERE phone_number_normalized = v_normalized
      AND compliance_type IN ('dnc_list','blacklist','procon_complaint')
      AND is_active = true
      AND (valid_until IS NULL OR valid_until > now())
      AND (p_company_id IS NULL OR company_id = p_company_id)
  ) INTO v_blocked;

  RETURN v_blocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_check_dnc IS 'Verifica se um telefone esta na lista DNC/blacklist/Procon - retorna TRUE se bloqueado';

COMMIT;
-- ============================================================
-- FASE 5: CROSS-MODULE INTEGRATION
-- Pre-requisitos: Fases 1, 2, 3, 4
-- ============================================================

BEGIN;

-- ============================================================
-- 5.1 CREATE omnichannel_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS omnichannel_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  -- Canal atual
  current_channel TEXT CHECK (current_channel IN ('whatsapp_meta','whatsapp_uazapi','voip','ai_call','telegram','email','webchat','instagram')),
  -- Status
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','pending','assigned','waiting_customer','waiting_agent','resolved','closed','archived')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent','critical')),
  -- Atribuicao
  assigned_collaborator_id UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES agent_definitions(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  mode TEXT DEFAULT 'bot'
    CHECK (mode IN ('bot','human','hybrid','auto')),
  -- Mensagens
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound','outbound')),
  unread_count INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  -- Classificacao
  tags TEXT[],
  category TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative','mixed')),
  lead_score INTEGER,
  -- SLA
  first_response_at TIMESTAMPTZ,
  first_response_sla_sec INTEGER,
  sla_breached BOOLEAN DEFAULT false,
  sla_deadline TIMESTAMPTZ,
  -- Resolucao
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  resolution_type TEXT CHECK (resolution_type IN ('resolved','no_response','spam','duplicate','escalated')),
  -- Canais utilizados
  channels_used TEXT[] DEFAULT '{}',
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omni_conv_company_status ON omnichannel_conversations(company_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_conv_contact ON omnichannel_conversations(contact_phone, company_id);
CREATE INDEX IF NOT EXISTS idx_omni_conv_assigned ON omnichannel_conversations(assigned_collaborator_id, status)
  WHERE status IN ('open','pending','assigned','waiting_customer');
CREATE INDEX IF NOT EXISTS idx_omni_conv_agent ON omnichannel_conversations(assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omni_conv_lead ON omnichannel_conversations(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omni_conv_sla ON omnichannel_conversations(sla_deadline)
  WHERE sla_breached = false AND sla_deadline IS NOT NULL AND status IN ('open','pending');
CREATE INDEX IF NOT EXISTS idx_omni_conv_unread ON omnichannel_conversations(company_id, unread_count)
  WHERE unread_count > 0;

COMMENT ON TABLE omnichannel_conversations IS 'Visao unificada de conversas cross-channel - inbox omnichannel';

-- ============================================================
-- 5.2 CREATE channel_routing
-- ============================================================
CREATE TABLE IF NOT EXISTS channel_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_channel TEXT NOT NULL,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('keyword','intent','time_based','overflow','manual','escalation','fallback','first_contact','returning_customer','high_value')),
  trigger_config JSONB NOT NULL,
  -- Destino
  target_channel TEXT NOT NULL,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('agent_definition','collaborator','queue','ivr','external_number','webhook','ai_script')),
  target_id UUID,
  target_config JSONB,
  -- Regras
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  business_hours_only BOOLEAN DEFAULT false,
  business_hours JSONB,
  -- Condicoes extras
  min_lead_score INTEGER,
  required_tags TEXT[],
  excluded_tags TEXT[],
  max_daily_routes INTEGER,
  current_daily_routes INTEGER DEFAULT 0,
  last_route_reset_at DATE,
  -- Fallback
  fallback_routing_id UUID REFERENCES channel_routing(id) ON DELETE SET NULL,
  -- Stats
  total_routed INTEGER DEFAULT 0,
  last_routed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_routing_company ON channel_routing(company_id, source_channel, priority DESC);
CREATE INDEX IF NOT EXISTS idx_channel_routing_active ON channel_routing(is_active, company_id) WHERE is_active = true;

COMMENT ON TABLE channel_routing IS 'Regras de roteamento entre canais - keyword, intent, horario, overflow, escalation';
COMMENT ON COLUMN channel_routing.trigger_config IS 'Config do trigger: {keywords: [], intents: [], schedule: {}, conditions: {}}';

-- ============================================================
-- 5.3 CREATE omnichannel_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS omnichannel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES omnichannel_conversations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type TEXT NOT NULL
    CHECK (sender_type IN ('contact','collaborator','bot','system','ai')),
  sender_id UUID,
  sender_name TEXT,
  -- Conteudo
  content_type TEXT NOT NULL
    CHECK (content_type IN ('text','image','audio','video','document','location','contact','template','interactive','reaction','sticker','call_event','note','system_event')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_file_name TEXT,
  media_size_bytes BIGINT,
  -- Template (se WhatsApp)
  template_name TEXT,
  template_params JSONB,
  -- Referencia ao canal original
  source_message_id UUID,
  source_table TEXT,
  source_external_id TEXT,
  -- Status
  status TEXT DEFAULT 'sent'
    CHECK (status IN ('pending','sent','delivered','read','failed','deleted')),
  error_message TEXT,
  -- AI
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence NUMERIC(5,4),
  ai_model TEXT,
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omni_msgs_conversation ON omnichannel_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_omni_msgs_company ON omnichannel_messages(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omni_msgs_source ON omnichannel_messages(source_table, source_message_id)
  WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omni_msgs_channel ON omnichannel_messages(channel, created_at DESC);

COMMENT ON TABLE omnichannel_messages IS 'Mensagens unificadas cross-channel - tabela fisica para queries rapidas no inbox';

-- ============================================================
-- Function: buscar ou criar conversa omnichannel
-- ============================================================
CREATE OR REPLACE FUNCTION fn_get_or_create_omnichannel_conversation(
  p_company_id UUID,
  p_contact_phone TEXT,
  p_channel TEXT,
  p_contact_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Buscar conversa aberta existente
  SELECT id INTO v_conversation_id
  FROM omnichannel_conversations
  WHERE company_id = p_company_id
    AND contact_phone = p_contact_phone
    AND status IN ('open','pending','assigned','waiting_customer','waiting_agent')
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Se nao existe, criar nova
  IF v_conversation_id IS NULL THEN
    INSERT INTO omnichannel_conversations (
      company_id, contact_phone, contact_name, current_channel, channels_used
    ) VALUES (
      p_company_id, p_contact_phone, p_contact_name, p_channel, ARRAY[p_channel]
    )
    RETURNING id INTO v_conversation_id;
  ELSE
    -- Atualizar canal atual se mudou
    UPDATE omnichannel_conversations
    SET current_channel = p_channel,
        channels_used = CASE
          WHEN NOT (p_channel = ANY(channels_used)) THEN channels_used || p_channel
          ELSE channels_used
        END,
        updated_at = now()
    WHERE id = v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: aplicar regras de roteamento
-- ============================================================
CREATE OR REPLACE FUNCTION fn_route_message(
  p_company_id UUID,
  p_channel TEXT,
  p_content TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL
)
RETURNS TABLE(
  routing_id UUID,
  target_channel TEXT,
  target_type TEXT,
  target_id UUID,
  target_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS routing_id,
    cr.target_channel,
    cr.target_type,
    cr.target_id,
    cr.target_config
  FROM channel_routing cr
  WHERE cr.company_id = p_company_id
    AND cr.source_channel = p_channel
    AND cr.is_active = true
    AND (
      cr.business_hours_only = false
      OR (
        cr.business_hours IS NOT NULL
        AND EXTRACT(DOW FROM now()) = ANY(
          ARRAY(SELECT jsonb_array_elements_text(cr.business_hours->'days')::INT)
        )
      )
    )
  ORDER BY cr.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
-- ============================================================
-- FASE 6: RLS POLICIES - ISOLAMENTO MULTI-TENANT
-- Pre-requisitos: Todas as fases anteriores
-- ============================================================

BEGIN;

-- ============================================================
-- NOVAS TABELAS (criadas nas fases 1-5)
-- ============================================================

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (true); -- sistema pode inserir para qualquer company

-- billing_usage
ALTER TABLE billing_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_usage_tenant ON billing_usage
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_phone_numbers
ALTER TABLE whatsapp_meta_phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_phone_numbers_tenant ON whatsapp_meta_phone_numbers
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_templates
ALTER TABLE whatsapp_meta_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_templates_tenant ON whatsapp_meta_templates
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_opt_ins
ALTER TABLE whatsapp_meta_opt_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_opt_ins_tenant ON whatsapp_meta_opt_ins
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_webhook_events
ALTER TABLE whatsapp_meta_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_webhook_select ON whatsapp_meta_webhook_events FOR SELECT
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
CREATE POLICY wa_webhook_insert ON whatsapp_meta_webhook_events FOR INSERT
  WITH CHECK (true); -- webhooks podem chegar sem company_id resolvido

-- whatsapp_meta_conversations_billing
ALTER TABLE whatsapp_meta_conversations_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_billing_tenant ON whatsapp_meta_conversations_billing
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_rate_limits
ALTER TABLE whatsapp_meta_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_rate_limits_tenant ON whatsapp_meta_rate_limits
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_quality_signals
ALTER TABLE whatsapp_meta_quality_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_quality_signals_tenant ON whatsapp_meta_quality_signals
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- sip_trunks
ALTER TABLE sip_trunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY sip_trunks_tenant ON sip_trunks
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- sip_extensions
ALTER TABLE sip_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sip_extensions_tenant ON sip_extensions
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- call_recordings
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_recordings_tenant ON call_recordings
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- call_quality_metrics
ALTER TABLE call_quality_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_quality_tenant ON call_quality_metrics
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ivr_menus
ALTER TABLE ivr_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY ivr_menus_tenant ON ivr_menus
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- call_transfers
ALTER TABLE call_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_transfers_tenant ON call_transfers
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- pbx_config
ALTER TABLE pbx_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbx_config_tenant ON pbx_config
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_scripts
ALTER TABLE ai_call_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_scripts_tenant ON ai_call_scripts
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_training
ALTER TABLE ai_call_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_training_tenant ON ai_call_training
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_voice_clones
ALTER TABLE ai_voice_clones ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_voice_clones_tenant ON ai_voice_clones
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_analytics
ALTER TABLE ai_call_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_analytics_tenant ON ai_call_analytics
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_compliance
ALTER TABLE ai_call_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_compliance_own ON ai_call_compliance FOR SELECT
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
CREATE POLICY ai_compliance_insert ON ai_call_compliance FOR INSERT
  WITH CHECK (company_id = (auth.jwt() ->> 'company_id')::UUID);
-- DNC lookup cross-company via function fn_check_dnc (SECURITY DEFINER)

-- omnichannel_conversations
ALTER TABLE omnichannel_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY omni_conv_tenant ON omnichannel_conversations
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- channel_routing
ALTER TABLE channel_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY channel_routing_tenant ON channel_routing
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- omnichannel_messages
ALTER TABLE omnichannel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY omni_msgs_tenant ON omnichannel_messages
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ============================================================
-- TABELAS EXISTENTES - habilitar RLS se ainda nao ativo
-- (usar DO block para evitar erro se RLS ja estiver ativo)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tables_with_company_id TEXT[] := ARRAY[
    'companies', 'collaborators', 'roles', 'sectors', 'units',
    'agent_definitions', 'agent_conversations', 'agent_messages',
    'agents', 'calls', 'campaigns', 'dial_queue', 'daily_metrics',
    'call_campaigns', 'call_logs',
    'bot_instances', 'bot_messages',
    'whatsapp_meta_credentials', 'whatsapp_meta_messages',
    'whatsapp_conversations', 'whatsapp_messages', 'whatsapp_instances',
    'whatsapp_bot_conversations',
    'leads', 'contact_leads', 'lead_items', 'lead_batches', 'lead_distributions',
    'conversations', 'messages',
    'blast_config', 'blast_jobs', 'blast_logs', 'blasted_phones',
    'disposable_chips',
    'collaborator_agent_access', 'collaborator_metrics', 'role_agent_access',
    'consultant_lead_pool',
    'invite_links',
    'carousel_creations',
    'video_edits',
    'extraction_logs',
    'service_orders', 'maintenances',
    'clients', 'orders', 'order_items', 'order_installments',
    'products', 'inventory', 'inventory_movements',
    'technicians', 'technician_inventory', 'technician_leads',
    'financial_closings', 'financial_closing_items',
    'city_analysis', 'sim_lines',
    'social_selling_campaigns', 'social_selling_actions',
    'social_selling_profiles', 'social_selling_leads',
    'social_selling_experts', 'social_selling_knowledge',
    'social_selling_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_company_id LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'RLS habilitado para: %', t;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso ao habilitar RLS em %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Policies para tabelas existentes que tem company_id
-- (criadas com IF NOT EXISTS via DO block)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
  tables_needing_policy TEXT[] := ARRAY[
    'collaborators', 'roles', 'sectors', 'units',
    'agent_definitions', 'agents',
    'calls', 'campaigns', 'dial_queue', 'daily_metrics',
    'call_campaigns', 'call_logs',
    'bot_instances',
    'whatsapp_meta_credentials', 'whatsapp_meta_messages',
    'whatsapp_conversations', 'whatsapp_messages',
    'leads', 'contact_leads', 'lead_items', 'lead_batches', 'lead_distributions',
    'conversations', 'messages',
    'blast_jobs', 'blast_logs',
    'disposable_chips',
    'collaborator_metrics',
    'invite_links',
    'video_edits',
    'extraction_logs',
    'service_orders', 'maintenances',
    'clients', 'orders', 'order_items', 'order_installments',
    'products', 'inventory', 'inventory_movements',
    'technicians', 'technician_inventory',
    'financial_closings', 'financial_closing_items',
    'sim_lines',
    'social_selling_campaigns'
  ];
BEGIN
  FOREACH t IN ARRAY tables_needing_policy LOOP
    policy_name := t || '_tenant_isolation';
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (company_id = (auth.jwt() ->> ''company_id'')::UUID)',
        policy_name, t
      );
      RAISE NOTICE 'Policy criada para: %', t;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Policy ja existe para: %', t;
    WHEN OTHERS THEN
      RAISE NOTICE 'Aviso ao criar policy em %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Policy especial: companies (usuario so ve sua propria empresa)
-- ============================================================
DO $$
BEGIN
  CREATE POLICY companies_tenant ON companies
    USING (id = (auth.jwt() ->> 'company_id')::UUID);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy companies_tenant ja existe';
END $$;

-- ============================================================
-- Tabelas sem company_id (policies especiais ou skip)
-- ============================================================

-- voice_profiles: compartilhados entre empresas (read-only para todos)
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY voice_profiles_read ON voice_profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- uazapi_accounts: admin-only
ALTER TABLE uazapi_accounts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY uazapi_accounts_admin ON uazapi_accounts FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- api_key_pool: admin-only
ALTER TABLE api_key_pool ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY api_key_pool_admin ON api_key_pool FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- system_config / system_configs: admin-only
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY system_config_admin ON system_config FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY system_configs_admin ON system_configs FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- profiles: usuario ve apenas seu proprio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY profiles_own ON profiles
    USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
-- ============================================================
-- FASE 7: DATA MIGRATION, VIEWS E FUNCTIONS
-- Pre-requisitos: Todas as fases anteriores
-- ============================================================

BEGIN;

-- ============================================================
-- 7.1 Migrar SIP de companies para sip_trunks
-- (apenas para companies com sip_host preenchido)
-- ============================================================
INSERT INTO sip_trunks (company_id, name, provider, sip_host, sip_port, auth_username, auth_password_vault_id)
SELECT
  id,
  name || ' - SIP Trunk',
  'custom',
  sip_host,
  COALESCE(sip_port, 5060),
  sip_username,
  sip_password
FROM companies
WHERE sip_host IS NOT NULL AND sip_host != ''
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7.2 Criar PBX config padrao para cada empresa
-- ============================================================
INSERT INTO pbx_config (company_id)
SELECT id FROM companies
WHERE id NOT IN (SELECT company_id FROM pbx_config)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7.4 Popular whatsapp_meta_opt_ins com contatos existentes
-- (marca como imported + legitimate_interest para revisao)
-- ============================================================
INSERT INTO whatsapp_meta_opt_ins (
  company_id, phone_number, contact_name, opt_in_method,
  consent_text, lgpd_legal_basis, lgpd_data_purpose
)
SELECT DISTINCT ON (wc.consultant_id, wc.sender_phone)
  c.company_id,
  wc.sender_phone,
  wc.sender_name,
  'imported',
  'Contato importado de conversas existentes - requer revisao e confirmacao de consentimento',
  'legitimate_interest',
  'Comunicacao comercial via WhatsApp'
FROM whatsapp_conversations wc
JOIN collaborators c ON c.id = wc.consultant_id
WHERE wc.sender_phone IS NOT NULL AND wc.sender_phone != ''
ON CONFLICT (company_id, phone_number) DO NOTHING;

-- ============================================================
-- 7.5 VIEWS
-- ============================================================

-- View: Saude do WhatsApp por empresa
CREATE OR REPLACE VIEW v_company_whatsapp_health AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  cred.quality_rating,
  cred.messaging_limit_tier,
  cred.is_verified,
  cred.onboarding_status,
  (SELECT COUNT(*) FROM whatsapp_meta_phone_numbers pn WHERE pn.company_id = c.id) AS total_phone_numbers,
  (SELECT COUNT(*) FROM whatsapp_meta_phone_numbers pn WHERE pn.company_id = c.id AND pn.status = 'connected') AS connected_numbers,
  (SELECT COUNT(*) FROM whatsapp_meta_templates t WHERE t.company_id = c.id AND t.status = 'APPROVED') AS approved_templates,
  (SELECT COUNT(*) FROM whatsapp_meta_templates t WHERE t.company_id = c.id AND t.status = 'REJECTED') AS rejected_templates,
  (SELECT COUNT(*) FROM whatsapp_meta_templates t WHERE t.company_id = c.id AND t.status = 'PENDING') AS pending_templates,
  (SELECT COUNT(*) FROM whatsapp_meta_quality_signals qs WHERE qs.company_id = c.id AND qs.resolved_at IS NULL) AS unresolved_quality_signals,
  (SELECT COUNT(*) FROM whatsapp_meta_opt_ins oi WHERE oi.company_id = c.id AND oi.is_active = true) AS active_opt_ins,
  (SELECT COUNT(*) FROM whatsapp_meta_opt_ins oi WHERE oi.company_id = c.id AND oi.lgpd_deletion_requested_at IS NOT NULL AND oi.lgpd_deletion_completed_at IS NULL) AS pending_lgpd_deletions
FROM companies c
LEFT JOIN whatsapp_meta_credentials cred ON cred.company_id = c.id;

-- View: Custos diarios por canal
CREATE OR REPLACE VIEW v_daily_channel_costs AS
SELECT
  company_id,
  channel,
  DATE(created_at) AS cost_date,
  SUM(quantity) AS total_quantity,
  SUM(total_cost_brl) AS total_cost_brl,
  COUNT(*) AS total_transactions,
  AVG(unit_cost_brl) AS avg_unit_cost
FROM billing_usage
GROUP BY company_id, channel, DATE(created_at);

-- View: Performance dos agentes IA
CREATE OR REPLACE VIEW v_agent_performance AS
SELECT
  ad.id AS agent_id,
  ad.name AS agent_name,
  ad.company_id,
  ad.agent_type,
  (SELECT COUNT(*) FROM agent_conversations ac WHERE ac.agent_id = ad.id) AS total_conversations,
  (SELECT COUNT(*) FROM agent_conversations ac WHERE ac.agent_id = ad.id AND ac.status = 'active') AS active_conversations,
  (SELECT SUM(message_count) FROM agent_conversations ac WHERE ac.agent_id = ad.id) AS total_messages,
  (SELECT MAX(last_message_at) FROM agent_conversations ac WHERE ac.agent_id = ad.id) AS last_activity_at,
  -- WhatsApp conversations handled
  (SELECT COUNT(*) FROM whatsapp_conversations wc WHERE wc.agent_id = ad.id) AS whatsapp_conversations,
  -- Omnichannel
  (SELECT COUNT(*) FROM omnichannel_conversations oc WHERE oc.assigned_agent_id = ad.id) AS omnichannel_conversations,
  (SELECT COUNT(*) FROM omnichannel_conversations oc WHERE oc.assigned_agent_id = ad.id AND oc.status = 'resolved') AS resolved_conversations
FROM agent_definitions ad
WHERE ad.active = true;

-- View: Conversas ativas (inbox)
CREATE OR REPLACE VIEW v_active_conversations AS
SELECT
  oc.id,
  oc.company_id,
  oc.contact_phone,
  oc.contact_name,
  oc.current_channel,
  oc.status,
  oc.priority,
  oc.mode,
  oc.unread_count,
  oc.last_message_at,
  oc.last_message_preview,
  oc.last_message_direction,
  oc.sentiment,
  oc.sla_breached,
  oc.sla_deadline,
  oc.channels_used,
  oc.tags,
  col.name AS assigned_collaborator_name,
  ad.name AS assigned_agent_name,
  oc.created_at,
  oc.updated_at
FROM omnichannel_conversations oc
LEFT JOIN collaborators col ON col.id = oc.assigned_collaborator_id
LEFT JOIN agent_definitions ad ON ad.id = oc.assigned_agent_id
WHERE oc.status IN ('open','pending','assigned','waiting_customer','waiting_agent');

-- View: Todas as mensagens WhatsApp (UaZapi + Meta unificadas)
CREATE OR REPLACE VIEW v_all_whatsapp_messages AS
SELECT
  id,
  company_id,
  'meta' AS source,
  direction,
  phone_from AS from_number,
  phone_to AS to_number,
  type AS message_type,
  body AS content,
  media_url,
  template_name,
  status,
  pricing_category,
  cost_brl,
  created_at
FROM whatsapp_meta_messages
UNION ALL
SELECT
  id,
  company_id,
  'uazapi' AS source,
  direction,
  from_number,
  to_number,
  message_type,
  content,
  NULL AS media_url,
  template_name,
  status,
  NULL AS pricing_category,
  meta_cost AS cost_brl,
  created_at
FROM whatsapp_messages
WHERE company_id IS NOT NULL;

-- ============================================================
-- 7.6 FUNCTIONS
-- ============================================================

-- Function: verificar opt-in antes de enviar mensagem
CREATE OR REPLACE FUNCTION fn_check_opt_in(
  p_company_id UUID,
  p_phone TEXT,
  p_message_type TEXT DEFAULT 'transactional'
)
RETURNS TABLE(
  has_opt_in BOOLEAN,
  opt_in_id UUID,
  consent_marketing BOOLEAN,
  consent_transactional BOOLEAN,
  lgpd_legal_basis TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.is_active AS has_opt_in,
    oi.id AS opt_in_id,
    oi.consent_marketing,
    oi.consent_transactional,
    oi.lgpd_legal_basis
  FROM whatsapp_meta_opt_ins oi
  WHERE oi.company_id = p_company_id
    AND oi.phone_number = p_phone
    AND oi.is_active = true
    AND oi.lgpd_anonymized = false
    AND (oi.lgpd_deletion_requested_at IS NULL OR oi.lgpd_deletion_completed_at IS NOT NULL)
  LIMIT 1;

  -- Se nao encontrou nenhum registro, retornar false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, false, false, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_check_opt_in IS 'Verifica se contato tem opt-in ativo e valido antes de enviar mensagem WhatsApp';

-- Function: abrir/recuperar janela de conversa para billing
CREATE OR REPLACE FUNCTION fn_open_conversation_window(
  p_company_id UUID,
  p_contact_phone TEXT,
  p_category TEXT,
  p_origin TEXT,
  p_phone_number_id UUID DEFAULT NULL,
  p_wamid TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_window_id UUID;
BEGIN
  -- Buscar janela ativa existente (dentro de 24h)
  SELECT id INTO v_window_id
  FROM whatsapp_meta_conversations_billing
  WHERE company_id = p_company_id
    AND contact_phone = p_contact_phone
    AND category = p_category
    AND window_end > now()
  ORDER BY window_start DESC
  LIMIT 1;

  IF v_window_id IS NOT NULL THEN
    -- Incrementar contagem de mensagens
    UPDATE whatsapp_meta_conversations_billing
    SET message_count = message_count + 1
    WHERE id = v_window_id;

    RETURN v_window_id;
  END IF;

  -- Criar nova janela de 24h
  INSERT INTO whatsapp_meta_conversations_billing (
    company_id, meta_conversation_id, phone_number_id,
    contact_phone, category, origin,
    window_start, window_end, first_message_wamid
  ) VALUES (
    p_company_id,
    'conv_' || gen_random_uuid()::TEXT,
    p_phone_number_id,
    p_contact_phone,
    p_category,
    p_origin,
    now(),
    now() + interval '24 hours',
    p_wamid
  )
  RETURNING id INTO v_window_id;

  RETURN v_window_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_open_conversation_window IS 'Abre ou recupera janela de conversa de 24h para billing Meta WhatsApp';

-- Function: processar LGPD deletion request
CREATE OR REPLACE FUNCTION fn_process_lgpd_deletion(
  p_company_id UUID,
  p_phone TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}';
  v_deleted_count INTEGER := 0;
BEGIN
  -- 1. Marcar opt-in como deletado
  UPDATE whatsapp_meta_opt_ins
  SET lgpd_deletion_completed_at = now(),
      lgpd_anonymized = true,
      is_active = false,
      contact_name = 'ANONIMIZADO',
      consent_ip = NULL,
      consent_user_agent = NULL,
      updated_at = now()
  WHERE company_id = p_company_id AND phone_number = p_phone;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('opt_ins_anonymized', v_deleted_count);

  -- 2. Anonimizar mensagens WhatsApp Meta
  UPDATE whatsapp_meta_messages
  SET phone_from = 'ANONIMIZADO',
      phone_to = 'ANONIMIZADO',
      body = NULL
  WHERE company_id = p_company_id
    AND (phone_from = p_phone OR phone_to = p_phone);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('messages_anonymized', v_deleted_count);

  -- 3. Log de auditoria
  INSERT INTO audit_logs (
    company_id, table_name, action, actor_type, metadata
  ) VALUES (
    p_company_id, 'lgpd_deletion', 'DELETE', 'system',
    jsonb_build_object('phone', p_phone, 'result', v_result)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_process_lgpd_deletion IS 'Processa pedido de exclusao LGPD - anonimiza dados do contato';

COMMIT;
