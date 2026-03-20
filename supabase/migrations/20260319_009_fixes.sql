-- ============================================================
-- FASE 9: FIXES - Correções da revisão de código
-- ============================================================

BEGIN;

-- ============================================================
-- FIX 1: fn_check_opt_in - lógica contraditória na verificação LGPD
-- Condição correta: deletion não solicitada OU deletion já completada
-- ============================================================
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

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, false, false, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 2: fn_check_dnc - garantir retorno FALSE se não encontrar
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_dnc(p_phone TEXT, p_company_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_normalized TEXT;
  v_blocked BOOLEAN := false;
BEGIN
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  SELECT EXISTS(
    SELECT 1 FROM ai_call_compliance
    WHERE phone_number_normalized = v_normalized
      AND compliance_type IN ('dnc_list','blacklist','procon_complaint')
      AND is_active = true
      AND (valid_until IS NULL OR valid_until > now())
      AND (p_company_id IS NULL OR company_id = p_company_id)
  ) INTO v_blocked;

  RETURN COALESCE(v_blocked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 3: fn_get_or_create_omnichannel_conversation - prevenir race condition
-- Usa INSERT ... ON CONFLICT para atomicidade
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
  -- Buscar conversa aberta existente com lock
  SELECT id INTO v_conversation_id
  FROM omnichannel_conversations
  WHERE company_id = p_company_id
    AND contact_phone = p_contact_phone
    AND status IN ('open','pending','assigned','waiting_customer','waiting_agent')
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_conversation_id IS NULL THEN
    INSERT INTO omnichannel_conversations (
      company_id, contact_phone, contact_name, current_channel, channels_used
    ) VALUES (
      p_company_id, p_contact_phone, p_contact_name, p_channel, ARRAY[p_channel]
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_conversation_id;

    -- Se ON CONFLICT, buscar o que foi criado por outra transação
    IF v_conversation_id IS NULL THEN
      SELECT id INTO v_conversation_id
      FROM omnichannel_conversations
      WHERE company_id = p_company_id
        AND contact_phone = p_contact_phone
        AND status IN ('open','pending','assigned','waiting_customer','waiting_agent')
      ORDER BY updated_at DESC
      LIMIT 1;
    END IF;
  ELSE
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
-- FIX 4: fn_process_lgpd_deletion - normalizar telefone antes de buscar
-- ============================================================
CREATE OR REPLACE FUNCTION fn_process_lgpd_deletion(
  p_company_id UUID,
  p_phone TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}';
  v_deleted_count INTEGER := 0;
  v_normalized TEXT;
BEGIN
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- 1. Marcar opt-in como deletado
  UPDATE whatsapp_meta_opt_ins
  SET lgpd_deletion_completed_at = now(),
      lgpd_anonymized = true,
      is_active = false,
      contact_name = 'ANONIMIZADO',
      consent_ip = NULL,
      consent_user_agent = NULL,
      updated_at = now()
  WHERE company_id = p_company_id
    AND regexp_replace(phone_number, '[^0-9]', '', 'g') = v_normalized;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('opt_ins_anonymized', v_deleted_count);

  -- 2. Anonimizar mensagens WhatsApp Meta (busca normalizada)
  UPDATE whatsapp_meta_messages
  SET phone_from = 'ANONIMIZADO',
      phone_to = 'ANONIMIZADO',
      body = NULL
  WHERE company_id = p_company_id
    AND (regexp_replace(phone_from, '[^0-9]', '', 'g') = v_normalized
      OR regexp_replace(phone_to, '[^0-9]', '', 'g') = v_normalized);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('messages_anonymized', v_deleted_count);

  -- 3. Log de auditoria
  INSERT INTO audit_logs (
    company_id, table_name, action, actor_type, metadata
  ) VALUES (
    p_company_id, 'lgpd_deletion', 'DELETE', 'system',
    jsonb_build_object('phone', 'REDACTED', 'phone_hash', md5(v_normalized), 'result', v_result)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 5: v_all_whatsapp_messages - corrigir nomes de colunas no UNION
-- ============================================================
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
  NULL::TEXT AS media_url,
  template_name,
  status,
  NULL::TEXT AS pricing_category,
  meta_cost AS cost_brl,
  created_at
FROM whatsapp_messages
WHERE company_id IS NOT NULL;

-- ============================================================
-- FIX 6: Indexes faltantes para queries frequentes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_omni_msgs_sender ON omnichannel_messages(sender_id) WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_routing_target ON channel_routing(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_action ON audit_logs(company_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_compliance_date_range ON ai_call_compliance(company_id, compliance_type, valid_from, valid_until) WHERE is_active = true;

-- ============================================================
-- FIX 7: RLS - adicionar UPDATE/DELETE policies para ai_call_compliance
-- ============================================================
DO $$
BEGIN
  CREATE POLICY ai_compliance_update ON ai_call_compliance FOR UPDATE
    USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY ai_compliance_delete ON ai_call_compliance FOR DELETE
    USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
