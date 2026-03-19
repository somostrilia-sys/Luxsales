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
