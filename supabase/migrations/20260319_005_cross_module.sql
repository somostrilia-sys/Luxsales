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
