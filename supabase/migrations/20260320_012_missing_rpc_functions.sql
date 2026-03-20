-- ============================================================
-- WALK Agente Central Hub — Migration 012: Missing RPC Functions
-- Creates 6 RPC functions required by the frontend
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. get_dashboard_metrics — VoIP Dashboard (DashboardVoip.tsx)
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_dashboard_metrics(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_company_id UUID,
  p_date TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := COALESCE(p_date::DATE, CURRENT_DATE);
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_calls', COALESCE(total_calls, 0),
    'answered_calls', COALESCE(answered, 0),
    'missed_calls', COALESCE(missed, 0),
    'avg_duration', COALESCE(avg_dur, 0),
    'avg_ring_time', COALESCE(avg_ring, 0),
    'total_talk_time', COALESCE(total_talk, 0),
    'inbound_calls', COALESCE(inbound, 0),
    'outbound_calls', COALESCE(outbound, 0),
    'ai_handled', COALESCE(ai_count, 0),
    'total_cost', COALESCE(total_cost, 0),
    'answer_rate', CASE WHEN COALESCE(total_calls, 0) > 0
      THEN ROUND((COALESCE(answered, 0)::NUMERIC / total_calls) * 100, 1)
      ELSE 0 END,
    'active_extensions', COALESCE(active_ext, 0),
    'active_trunks', COALESCE(active_trunks, 0)
  ) INTO v_result
  FROM (
    SELECT
      COUNT(*) AS total_calls,
      COUNT(*) FILTER (WHERE c.status = 'completed' OR c.answered_at IS NOT NULL) AS answered,
      COUNT(*) FILTER (WHERE c.status IN ('missed', 'no_answer', 'busy')) AS missed,
      ROUND(AVG(c.duration_seconds) FILTER (WHERE c.duration_seconds > 0)) AS avg_dur,
      ROUND(AVG(c.ring_time_seconds) FILTER (WHERE c.ring_time_seconds > 0)) AS avg_ring,
      SUM(COALESCE(c.talk_time_seconds, c.duration_seconds, 0)) AS total_talk,
      COUNT(*) FILTER (WHERE c.caller_number IS NOT NULL AND c.destination_number IS NOT NULL
        AND c.caller_number != c.destination_number) AS inbound,
      COUNT(*) FILTER (WHERE c.status IS NOT NULL) -
        COUNT(*) FILTER (WHERE c.caller_number IS NOT NULL AND c.destination_number IS NOT NULL
          AND c.caller_number != c.destination_number) AS outbound,
      COUNT(*) FILTER (WHERE c.ai_handled = true) AS ai_count,
      SUM(COALESCE(c.ai_cost, 0)) AS total_cost
    FROM calls c
    WHERE c.company_id = p_company_id
      AND c.created_at::DATE = v_date
  ) metrics,
  (
    SELECT COUNT(*) FILTER (WHERE status = 'active') AS active_ext
    FROM sip_extensions WHERE company_id = p_company_id
  ) ext,
  (
    SELECT COUNT(*) FILTER (WHERE registration_status = 'registered') AS active_trunks
    FROM sip_trunks WHERE company_id = p_company_id
  ) trunks;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

COMMENT ON FUNCTION get_dashboard_metrics IS 'Returns VoIP dashboard metrics for a company on a specific date. Used by DashboardVoip.tsx';

-- ──────────────────────────────────────────────────────────────
-- 2. get_next_lead_to_dial — Discador (Discador.tsx)
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_next_lead_to_dial(UUID, UUID);

CREATE OR REPLACE FUNCTION get_next_lead_to_dial(
  p_company_id UUID,
  p_campaign_id UUID
)
RETURNS TABLE (
  queue_id UUID,
  lead_id UUID,
  lead_name TEXT,
  lead_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS queue_id,
    l.id AS lead_id,
    l.name AS lead_name,
    l.phone AS lead_phone
  FROM leads l
  WHERE l.company_id = p_company_id
    AND l.campaign_id = p_campaign_id
    AND l.status IN ('pending', 'available', 'retry')
    AND (l.next_attempt_at IS NULL OR l.next_attempt_at <= NOW())
    AND (l.max_attempts IS NULL OR COALESCE(l.attempts, 0) < l.max_attempts)
    AND NOT EXISTS (
      SELECT 1 FROM ai_call_compliance dnc
      WHERE dnc.phone = l.phone AND dnc.list_type = 'dnc'
    )
  ORDER BY l.score DESC NULLS LAST, l.created_at ASC
  LIMIT 1;

  -- Mark as in_progress
  IF FOUND THEN
    UPDATE leads
    SET status = 'in_progress',
        last_attempt_at = NOW(),
        attempts = COALESCE(attempts, 0) + 1
    WHERE id = (
      SELECT l2.id FROM leads l2
      WHERE l2.company_id = p_company_id
        AND l2.campaign_id = p_campaign_id
        AND l2.status IN ('pending', 'available', 'retry')
        AND (l2.next_attempt_at IS NULL OR l2.next_attempt_at <= NOW())
      ORDER BY l2.score DESC NULLS LAST, l2.created_at ASC
      LIMIT 1
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION get_next_lead_to_dial IS 'Returns next lead to dial from campaign queue and marks it as in_progress. Used by Discador.tsx';

-- ──────────────────────────────────────────────────────────────
-- 3. complete_call — Discador (Discador.tsx)
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS complete_call(UUID, TEXT, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION complete_call(
  p_call_id UUID,
  p_status TEXT DEFAULT 'completed',
  p_duration INTEGER DEFAULT 0,
  p_ai_qualification TEXT DEFAULT NULL,
  p_ai_summary TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update call record
  UPDATE calls
  SET status = p_status,
      ended_at = NOW(),
      duration_seconds = p_duration,
      ai_qualification = p_ai_qualification,
      ai_summary = p_ai_summary
  WHERE id = p_call_id;

  -- Update corresponding lead qualification if linked
  UPDATE leads
  SET qualification = p_ai_qualification,
      qualification_notes = p_ai_summary,
      status = CASE
        WHEN p_ai_qualification = 'hot' THEN 'qualified'
        WHEN p_ai_qualification = 'warm' THEN 'contacted'
        WHEN p_ai_qualification = 'cold' THEN 'contacted'
        WHEN p_ai_qualification = 'not_qualified' THEN 'disqualified'
        ELSE 'contacted'
      END,
      contacted_at = NOW(),
      updated_at = NOW()
  WHERE id = (SELECT lead_id FROM calls WHERE id = p_call_id)
    AND (SELECT lead_id FROM calls WHERE id = p_call_id) IS NOT NULL;

  -- Log in audit
  INSERT INTO audit_logs (company_id, action, entity_type, entity_id, details)
  SELECT company_id, 'call_completed', 'call', p_call_id,
    jsonb_build_object(
      'status', p_status,
      'duration', p_duration,
      'qualification', p_ai_qualification
    )
  FROM calls WHERE id = p_call_id;
END;
$$;

COMMENT ON FUNCTION complete_call IS 'Completes a call with qualification data and updates linked lead. Used by Discador.tsx';

-- ──────────────────────────────────────────────────────────────
-- 4. count_available_leads — MotorLeads (MotorLeads.tsx)
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS count_available_leads(UUID);

CREATE OR REPLACE FUNCTION count_available_leads(
  p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_items BIGINT;
  v_contact_leads_pending BIGINT;
  v_leads_pending BIGINT;
BEGIN
  -- Count available items in consultant_lead_pool (not yet sent)
  SELECT COUNT(*) INTO v_lead_items
  FROM consultant_lead_pool clp
  INNER JOIN collaborators c ON c.id = clp.collaborator_id
  WHERE clp.status IN ('pending', 'available')
    AND (p_company_id IS NULL OR c.company_id = p_company_id);

  -- Count contact_leads not yet imported to consultant_lead_pool
  SELECT COUNT(*) INTO v_contact_leads_pending
  FROM contact_leads cl
  WHERE cl.status = 'pending'
    AND cl.phone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM consultant_lead_pool clp WHERE clp.phone = cl.phone
    );

  -- Count leads not yet in consultant_lead_pool
  SELECT COUNT(*) INTO v_leads_pending
  FROM leads l
  WHERE l.status IN ('pending', 'available')
    AND l.phone IS NOT NULL
    AND (p_company_id IS NULL OR l.company_id = p_company_id)
    AND NOT EXISTS (
      SELECT 1 FROM consultant_lead_pool clp WHERE clp.phone = l.phone
    );

  RETURN jsonb_build_object(
    'lead_items_disponiveis', v_lead_items,
    'contact_leads_nao_importados', v_contact_leads_pending,
    'leads_nao_importados', v_leads_pending
  );
END;
$$;

COMMENT ON FUNCTION count_available_leads IS 'Counts available leads by source for distribution. Used by MotorLeads.tsx';

-- ──────────────────────────────────────────────────────────────
-- 5. sync_leads_from_base — MotorLeads (MotorLeads.tsx)
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS sync_leads_from_base(UUID, INTEGER);

CREATE OR REPLACE FUNCTION sync_leads_from_base(
  p_company_id UUID,
  p_limit INTEGER DEFAULT 50000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imported INTEGER := 0;
  v_rec RECORD;
BEGIN
  -- Import from contact_leads into leads table
  FOR v_rec IN
    SELECT cl.id, cl.name, cl.phone, cl.email, cl.city, cl.region, cl.state,
           cl.category, cl.subcategory, cl.source, cl.score, cl.tipo_pessoa
    FROM contact_leads cl
    WHERE cl.phone IS NOT NULL
      AND cl.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM leads l WHERE l.phone = cl.phone AND l.company_id = p_company_id
      )
    ORDER BY cl.score DESC NULLS LAST, cl.created_at ASC
    LIMIT p_limit
  LOOP
    INSERT INTO leads (
      company_id, name, phone, email, city, region, category, subcategory,
      source, score, tipo_pessoa, status, created_at
    ) VALUES (
      p_company_id, v_rec.name, v_rec.phone, v_rec.email, v_rec.city,
      v_rec.region, v_rec.category, v_rec.subcategory,
      v_rec.source, v_rec.score, v_rec.tipo_pessoa, 'available', NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Mark contact_lead as imported
    UPDATE contact_leads SET status = 'imported', updated_at = NOW()
    WHERE id = v_rec.id;

    v_imported := v_imported + 1;
  END LOOP;

  RETURN jsonb_build_object('total', v_imported);
END;
$$;

COMMENT ON FUNCTION sync_leads_from_base IS 'Imports leads from contact_leads base into leads table for a company. Used by MotorLeads.tsx';

-- ──────────────────────────────────────────────────────────────
-- 6. distribute_leads — MotorLeads (MotorLeads.tsx)
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS distribute_leads(UUID, UUID, UUID, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION distribute_leads(
  p_assigned_to UUID,
  p_company_id UUID,
  p_assigned_by UUID,
  p_quantidade INTEGER DEFAULT 500,
  p_filtro_cidade TEXT DEFAULT NULL,
  p_filtro_ddd TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_distributed INTEGER := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT l.id, l.name, l.phone, l.city, l.category
    FROM leads l
    WHERE l.company_id = p_company_id
      AND l.status IN ('available', 'pending')
      AND l.consultant_id IS NULL
      AND l.phone IS NOT NULL
      AND (p_filtro_cidade IS NULL OR LOWER(l.city) = LOWER(p_filtro_cidade))
      AND (p_filtro_ddd IS NULL OR LEFT(REGEXP_REPLACE(l.phone, '\D', '', 'g'), 2) = p_filtro_ddd
           OR SUBSTRING(REGEXP_REPLACE(l.phone, '\D', '', 'g') FROM 3 FOR 2) = p_filtro_ddd)
      AND NOT EXISTS (
        SELECT 1 FROM consultant_lead_pool clp WHERE clp.phone = l.phone AND clp.collaborator_id = p_assigned_to
      )
    ORDER BY l.score DESC NULLS LAST, l.created_at ASC
    LIMIT p_quantidade
  LOOP
    -- Insert into consultant_lead_pool
    INSERT INTO consultant_lead_pool (
      collaborator_id, phone, lead_name, lead_city, lead_category,
      lead_ddd, status, assigned_at
    ) VALUES (
      p_assigned_to, v_rec.phone, v_rec.name, v_rec.city, v_rec.category,
      LEFT(REGEXP_REPLACE(v_rec.phone, '\D', '', 'g'), 2),
      'pending', NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Update lead assignment
    UPDATE leads
    SET consultant_id = p_assigned_to,
        status = 'assigned',
        updated_at = NOW()
    WHERE id = v_rec.id;

    v_distributed := v_distributed + 1;
  END LOOP;

  -- Audit log
  INSERT INTO audit_logs (company_id, action, entity_type, entity_id, details)
  VALUES (
    p_company_id, 'leads_distributed', 'collaborator', p_assigned_to,
    jsonb_build_object(
      'leads_distribuidos', v_distributed,
      'assigned_by', p_assigned_by,
      'filtro_cidade', p_filtro_cidade,
      'filtro_ddd', p_filtro_ddd
    )
  );

  RETURN jsonb_build_object('leads_distribuidos', v_distributed);
END;
$$;

COMMENT ON FUNCTION distribute_leads IS 'Distributes available leads to a consultant with optional city/DDD filters. Used by MotorLeads.tsx';

-- ──────────────────────────────────────────────────────────────
-- Indexes to optimize the new functions
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calls_company_date ON calls(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_company_campaign_status ON leads(company_id, campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_company_status_consultant ON leads(company_id, status, consultant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_leads_status_phone ON contact_leads(status, phone) WHERE phone IS NOT NULL;
