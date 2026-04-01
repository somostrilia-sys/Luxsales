-- ============================================================
-- Formalização de tabelas pré-existentes + fixes multi-tenant
-- NÃO altera dados existentes, apenas garante schema + RLS
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. wa_conversations — formalizar tabela legada
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  collaborator_id UUID,
  assigned_to UUID,
  assigned_human_id UUID,
  phone TEXT NOT NULL,
  lead_name TEXT,
  status TEXT DEFAULT 'open',
  human_mode BOOLEAN DEFAULT false,
  ia_mode BOOLEAN DEFAULT true,
  turn_count INT DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  window_expires_at TIMESTAMPTZ,
  lucas_summary TEXT,
  analysis JSONB,
  is_typing BOOLEAN DEFAULT false,
  typing_updated_at TIMESTAMPTZ,
  call_id UUID,
  pool_id UUID,
  template_used TEXT,
  dispatched_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes que podem faltar
CREATE INDEX IF NOT EXISTS idx_wa_conv_company ON wa_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON wa_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_wa_conv_collab ON wa_conversations(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_status ON wa_conversations(status);

-- RLS
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'wa_conversations') THEN
    CREATE POLICY "service_role_all" ON wa_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_wa_conv' AND tablename = 'wa_conversations') THEN
    CREATE POLICY "tenant_isolation_wa_conv" ON wa_conversations FOR SELECT TO authenticated
      USING (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 2. wa_messages — formalizar tabela legada
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES wa_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  meta_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON wa_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_created ON wa_messages(created_at);

ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'wa_messages') THEN
    CREATE POLICY "service_role_all" ON wa_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_wa_msg' AND tablename = 'wa_messages') THEN
    CREATE POLICY "tenant_isolation_wa_msg" ON wa_messages FOR SELECT TO authenticated
      USING (conversation_id IN (
        SELECT wc.id FROM wa_conversations wc
        JOIN collaborators c ON c.company_id = wc.company_id
        WHERE c.auth_user_id = auth.uid() AND c.active = true
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 3. smart_dispatches — formalizar tabela legada
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS smart_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  collaborator_id UUID,
  phone_number TEXT NOT NULL,
  lead_name TEXT,
  template_name TEXT NOT NULL,
  template_params JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','queued','sent','delivered','read','replied','failed','cancelled')),
  priority INT DEFAULT 5,
  dispatch_reason TEXT,
  lifecycle_id UUID,
  meta_message_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  error_message TEXT,
  replied BOOLEAN DEFAULT false,
  converted BOOLEAN DEFAULT false,
  wa_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_company ON smart_dispatches(company_id);
CREATE INDEX IF NOT EXISTS idx_sd_status ON smart_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_sd_collab ON smart_dispatches(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_sd_phone ON smart_dispatches(phone_number);
CREATE INDEX IF NOT EXISTS idx_sd_scheduled ON smart_dispatches(scheduled_for) WHERE status = 'queued';

ALTER TABLE smart_dispatches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'smart_dispatches') THEN
    CREATE POLICY "service_role_all" ON smart_dispatches FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_sd' AND tablename = 'smart_dispatches') THEN
    CREATE POLICY "tenant_isolation_sd" ON smart_dispatches FOR SELECT TO authenticated
      USING (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 4. company_config — formalizar tabela usada por CompanySetup
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS company_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT,
  segment TEXT,
  segment_display_name TEXT,
  -- Persona
  persona_name TEXT,
  persona_role TEXT,
  persona_company TEXT,
  persona_tone TEXT,
  -- Vocabulário
  forbidden_words JSONB DEFAULT '[]',
  allowed_words JSONB DEFAULT '[]',
  -- Produto (JSONB: {description, base_price, plans[], differentials[]})
  product_data JSONB DEFAULT '{}',
  -- Extração de dados de ligações
  extraction_schema JSONB DEFAULT '{}',
  -- Follow-up
  followup_hours_first INT DEFAULT 48,
  followup_hours_call INT DEFAULT 72,
  max_templates_before_call INT DEFAULT 2,
  -- Prompts customizados (override)
  call_system_prompt TEXT,
  whatsapp_system_prompt TEXT,
  summary_prompt TEXT,
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_company_config_company UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_company ON company_config(company_id);

ALTER TABLE company_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'company_config') THEN
    CREATE POLICY "service_role_all" ON company_config FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_read_cc' AND tablename = 'company_config') THEN
    CREATE POLICY "tenant_read_cc" ON company_config FOR SELECT TO authenticated
      USING (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_write_cc' AND tablename = 'company_config') THEN
    CREATE POLICY "tenant_write_cc" ON company_config FOR ALL TO authenticated
      USING (company_id IN (
        SELECT c.company_id FROM collaborators c
        JOIN roles r ON r.id = c.role_id
        WHERE c.auth_user_id = auth.uid() AND c.active = true AND r.level <= 1
      ))
      WITH CHECK (company_id IN (
        SELECT c.company_id FROM collaborators c
        JOIN roles r ON r.id = c.role_id
        WHERE c.auth_user_id = auth.uid() AND c.active = true AND r.level <= 1
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 5. template_slots — mapeamento template → funil
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS template_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_id TEXT,
  variable_mapping JSONB DEFAULT '{}',
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_template_slot UNIQUE (company_id, slot, template_name)
);

ALTER TABLE template_slots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'template_slots') THEN
    CREATE POLICY "service_role_all" ON template_slots FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_ts' AND tablename = 'template_slots') THEN
    CREATE POLICY "tenant_isolation_ts" ON template_slots FOR ALL TO authenticated
      USING (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ))
      WITH CHECK (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 6. template_variable_mappings — variáveis por empresa
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS template_variable_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  variable_index INT NOT NULL,
  label TEXT,
  source TEXT CHECK (source IN ('leads_master', 'company_config', 'custom')),
  source_field TEXT,
  default_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_tvm UNIQUE (company_id, template_name, variable_index)
);

ALTER TABLE template_variable_mappings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'template_variable_mappings') THEN
    CREATE POLICY "service_role_all" ON template_variable_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_tvm' AND tablename = 'template_variable_mappings') THEN
    CREATE POLICY "tenant_isolation_tvm" ON template_variable_mappings FOR ALL TO authenticated
      USING (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ))
      WITH CHECK (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 7. lead_whatsapp_lifecycle — formalizar
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lead_whatsapp_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  phone_number TEXT NOT NULL,
  lead_name TEXT,
  window_open BOOLEAN DEFAULT false,
  window_expires_at TIMESTAMPTZ,
  stage TEXT DEFAULT 'new',
  sentiment TEXT,
  interests JSONB,
  objections JSONB,
  messages_sent INT DEFAULT 0,
  messages_received INT DEFAULT 0,
  last_dispatch_template TEXT,
  last_dispatch_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_lifecycle_company_phone UNIQUE (company_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_lwl_company ON lead_whatsapp_lifecycle(company_id);
CREATE INDEX IF NOT EXISTS idx_lwl_phone ON lead_whatsapp_lifecycle(phone_number);

ALTER TABLE lead_whatsapp_lifecycle ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'lead_whatsapp_lifecycle') THEN
    CREATE POLICY "service_role_all" ON lead_whatsapp_lifecycle FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_lwl' AND tablename = 'lead_whatsapp_lifecycle') THEN
    CREATE POLICY "tenant_isolation_lwl" ON lead_whatsapp_lifecycle FOR SELECT TO authenticated
      USING (company_id IN (
        SELECT c.company_id FROM collaborators c WHERE c.auth_user_id = auth.uid() AND c.active = true
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 8. FIX: fn_check_dnc — forçar company_id obrigatório
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_check_dnc(
  p_phone TEXT,
  p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_normalized TEXT;
  v_blocked BOOLEAN;
BEGIN
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Checar global blacklist (sem company_id) + empresa específica
  SELECT EXISTS (
    SELECT 1 FROM ai_call_compliance
    WHERE phone_number_normalized = v_normalized
      AND compliance_type IN ('dnc_list', 'blacklist', 'procon_complaint')
      AND is_active = true
      AND (valid_until IS NULL OR valid_until > now())
      AND (
        company_id IS NULL  -- regra global (Procon, ANATEL)
        OR company_id = p_company_id  -- regra da empresa
      )
  ) INTO v_blocked;

  RETURN v_blocked;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 9. Função de limpeza de gravações expiradas (LGPD)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_cleanup_expired_recordings()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  -- Marcar como deletadas gravações expiradas
  WITH expired AS (
    UPDATE call_recordings
    SET deleted_at = now(),
        file_url = NULL,
        transcription_text = NULL
    WHERE retention_expires_at < now()
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM expired;

  -- Log
  IF v_deleted > 0 THEN
    INSERT INTO audit_logs (company_id, action, entity_type, details)
    VALUES (NULL, 'retention_cleanup', 'call_recordings',
      jsonb_build_object('deleted_count', v_deleted, 'cleanup_at', now()));
  END IF;

  RETURN v_deleted;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 10. Rate limit check function para smart-dispatcher
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_check_rate_limit(
  p_company_id UUID,
  p_phone_number_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  allowed BOOLEAN,
  daily_sent INT,
  daily_limit INT,
  reason TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INT;
  v_sent INT;
BEGIN
  -- Buscar tier da empresa
  SELECT messaging_tier INTO v_tier
  FROM companies WHERE id = p_company_id;

  -- Limites por tier Meta
  v_limit := CASE v_tier
    WHEN 'STANDARD' THEN 1000
    WHEN 'TIER_1' THEN 1000
    WHEN 'TIER_2' THEN 10000
    WHEN 'TIER_3' THEN 100000
    WHEN 'TIER_4' THEN 1000000
    ELSE 250  -- unverified/novo
  END;

  -- Contar enviados hoje
  SELECT COUNT(*) INTO v_sent
  FROM smart_dispatches
  WHERE company_id = p_company_id
    AND status IN ('sent', 'delivered', 'read', 'replied')
    AND sent_at >= CURRENT_DATE;

  -- Retornar
  IF v_sent >= v_limit THEN
    RETURN QUERY SELECT false, v_sent, v_limit, 'Limite diário atingido (tier ' || COALESCE(v_tier, 'UNKNOWN') || ')';
  ELSE
    RETURN QUERY SELECT true, v_sent, v_limit, NULL::TEXT;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 11. Bridge: omnichannel_conversations ↔ wa_conversations
-- Adicionar coluna de referência sem alterar omnichannel
-- ═══════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_conversations' AND column_name = 'omnichannel_id'
  ) THEN
    ALTER TABLE wa_conversations ADD COLUMN omnichannel_id UUID REFERENCES omnichannel_conversations(id);
    CREATE INDEX idx_wa_conv_omni ON wa_conversations(omnichannel_id) WHERE omnichannel_id IS NOT NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 12. Deprecar campos SIP de companies (marcar como deprecated)
-- Não remove pra não quebrar queries legadas, mas adiciona comentário
-- ═══════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'sip_host'
  ) THEN
    COMMENT ON COLUMN companies.sip_host IS 'DEPRECATED: usar sip_trunks.sip_host';
    COMMENT ON COLUMN companies.sip_port IS 'DEPRECATED: usar sip_trunks.sip_port';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'sip_username'
  ) THEN
    COMMENT ON COLUMN companies.sip_username IS 'DEPRECATED: usar sip_trunks.auth_username';
    COMMENT ON COLUMN companies.sip_password IS 'DEPRECATED: usar sip_trunks.auth_password_vault_id';
  END IF;
END $$;
