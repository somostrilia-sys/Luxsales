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
