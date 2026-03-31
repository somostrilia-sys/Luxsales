-- ============================================================================
-- LUXSALES — SETUP P0 (executar no SQL Editor do Supabase)
-- URL: https://supabase.com/dashboard/project/ecaduzwautlpzpvjognr
-- Ordem: 1) Este arquivo  2) Importar leads
-- ============================================================================

-- ============================================================================
-- STEP 1: Inserir credenciais no system_configs
-- ⚠️ SUBSTITUA os valores [PLACEHOLDER] pelas suas chaves reais
-- ============================================================================

INSERT INTO system_configs (key, value, description) VALUES

-- Meta WhatsApp Business API
('meta_whatsapp_token', '[SEU_TOKEN_META]', 'Meta Business API access token (permanent system user token)'),
('meta_waba_id', '[SEU_WABA_ID]', 'WhatsApp Business Account ID'),
('meta_phone_number_id', '[SEU_PHONE_NUMBER_ID]', 'Phone number ID registrado na Meta'),
('meta_webhook_verify_token', 'luxsales_webhook_2026', 'Token para verificação de webhook Meta'),

-- VAPI (Ligações IA)
('vapi_api_key', '[SEU_VAPI_KEY]', 'Vapi.ai API key'),
('vapi_assistant_id', '[SEU_VAPI_ASSISTANT_ID]', 'Vapi assistant ID configurado'),
('vapi_phone_number_id', '[SEU_VAPI_PHONE_ID]', 'Vapi phone number ID para outbound'),

-- Fish Audio (TTS / Voz Clonada)
('fish_audio_api_key', '[SEU_FISH_KEY]', 'Fish Audio API key'),
('fish_audio_model_alex', '14ff1471abca4a7cae3e27d9f6a0093e', 'Fish Audio voice model - Alex Donato V2'),

-- LLMs
('anthropic_api_key', '[SEU_CLAUDE_KEY]', 'Anthropic Claude API key (conversation-engine)'),
('groq_api_key', '[SEU_GROQ_KEY]', 'Groq API key (Whisper STT + LLaMA)'),

-- Telnyx (pipeline de voz alternativo)
('telnyx_api_key', '[SEU_TELNYX_KEY]', 'Telnyx API key'),
('telnyx_phone_number', '+18155950103', 'Telnyx phone number')

ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ============================================================================
-- STEP 2: Criar seu usuário CEO com permissões totais
-- ⚠️ SUBSTITUA [SEU_USER_ID] pelo UUID do seu Auth user no Supabase
-- ⚠️ SUBSTITUA [SEU_COMPANY_ID] pelo UUID da empresa
-- ============================================================================

-- Se ainda não sabe o company_id, buscar:
-- SELECT company_id FROM company_config WHERE segment = 'protecao_veicular' LIMIT 1;

-- Criar permissão CEO
INSERT INTO dispatch_permissions (
    company_id,
    collaborator_id,
    role,
    daily_dispatch_limit,
    can_create_templates,
    can_edit_templates,
    can_view_config,
    can_manage_opt_ins,
    can_view_quality,
    can_distribute_leads,
    can_dispatch,
    is_active
) VALUES (
    '[SEU_COMPANY_ID]'::UUID,
    '[SEU_USER_ID]'::UUID,
    'ceo',
    9999,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true
)
ON CONFLICT (company_id, collaborator_id) DO UPDATE SET
    role = 'ceo',
    daily_dispatch_limit = 9999,
    can_create_templates = true,
    can_edit_templates = true,
    can_view_config = true,
    can_manage_opt_ins = true,
    can_view_quality = true,
    can_distribute_leads = true,
    is_active = true,
    updated_at = now();

-- ============================================================================
-- STEP 3: Voice profiles (se não existir)
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    voice_key TEXT NOT NULL UNIQUE,
    voice_name TEXT,
    voice_id TEXT NOT NULL,
    provider TEXT DEFAULT 'fish_audio',
    language TEXT DEFAULT 'pt-BR',
    gender TEXT DEFAULT 'male',
    speed DECIMAL DEFAULT 1.0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO voice_profiles (voice_key, voice_name, voice_id, provider) VALUES
('fish-alex', 'Alex Donato V2', '14ff1471abca4a7cae3e27d9f6a0093e', 'fish_audio'),
('fish-alex-v3', 'Alex Donato V3', 'e256232e084f463ca35a13a7ee9678a1', 'fish_audio'),
('fish-alex-v1', 'Alex Donato V1', 'e79929ea7a3f4799afaba2bc0996077e', 'fish_audio'),
('fish-alex-original', 'Alex Original', '3eeb57bf66634bb190b74e953a75a83a', 'fish_audio')
ON CONFLICT (voice_key) DO NOTHING;

-- ============================================================================
-- STEP 4: Verificar que tudo está OK
-- ============================================================================

-- Conferir configs inseridas
SELECT key, LEFT(value, 20) || '...' as value_preview, description FROM system_configs ORDER BY key;

-- Conferir permissões
SELECT collaborator_id, role, daily_dispatch_limit, is_active FROM dispatch_permissions;

-- Conferir company_config
SELECT company_id, company_name, segment, persona_name FROM company_config;

-- Conferir vozes
SELECT voice_key, voice_name, voice_id FROM voice_profiles WHERE active = true;

-- Conferir tabelas novas existem
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'leads_master', 'lead_import_batches', 'call_queues', 'dispatch_queues',
    'whatsapp_opt_ins', 'lead_whatsapp_lifecycle', 'smart_dispatches',
    'meta_quality_tracking', 'template_performance', 'dispatch_permissions',
    'company_config', 'template_slots', 'scheduled_actions'
) ORDER BY tablename;
