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
