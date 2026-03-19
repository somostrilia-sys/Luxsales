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
