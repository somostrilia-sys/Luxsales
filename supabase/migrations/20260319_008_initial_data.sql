-- ============================================================
-- FASE 8: DADOS INICIAIS - Templates, Rate Limits, Routing
-- ============================================================

BEGIN;

-- ============================================================
-- 8.1 Rate limits padrao para todas as empresas
-- ============================================================
INSERT INTO whatsapp_meta_rate_limits (company_id, limit_type, max_per_second, max_per_day)
SELECT id, 'messaging', 80, 250 FROM companies
ON CONFLICT DO NOTHING;

INSERT INTO whatsapp_meta_rate_limits (company_id, limit_type, max_per_second, max_per_day)
SELECT id, 'template_send', 80, 250 FROM companies
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8.2 PBX config padrao (ja criado na fase 7, garantir)
-- ============================================================
INSERT INTO pbx_config (company_id)
SELECT id FROM companies
WHERE id NOT IN (SELECT company_id FROM pbx_config)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8.3 Channel routing padrao - WhatsApp para bot IA
-- ============================================================
INSERT INTO channel_routing (company_id, name, source_channel, trigger_type, trigger_config, target_channel, target_type, priority, is_active)
SELECT
  c.id,
  'WhatsApp Meta -> Bot IA',
  'whatsapp_meta',
  'first_contact',
  '{"auto_assign": true}'::JSONB,
  'whatsapp_meta',
  'agent_definition',
  10,
  true
FROM companies c
ON CONFLICT DO NOTHING;

-- Fallback: escalar para humano
INSERT INTO channel_routing (company_id, name, source_channel, trigger_type, trigger_config, target_channel, target_type, priority, is_active)
SELECT
  c.id,
  'Escalacao -> Humano',
  'whatsapp_meta',
  'escalation',
  '{"keywords": ["atendente", "humano", "pessoa", "falar com alguem", "sair do bot"]}'::JSONB,
  'whatsapp_meta',
  'collaborator',
  20,
  true
FROM companies c
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8.4 System configs para WhatsApp Meta BSP
-- ============================================================
INSERT INTO system_config (key, value, description) VALUES
  ('whatsapp_meta_api_version', '"v21.0"'::JSONB, 'Versao da API Meta WhatsApp Cloud'),
  ('whatsapp_meta_webhook_url', '"https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/whatsapp-meta-webhook"'::JSONB, 'URL do webhook Meta'),
  ('whatsapp_meta_max_template_per_waba', '6000'::JSONB, 'Limite de templates por WABA (verificado)'),
  ('whatsapp_meta_free_service_conversations', '1000'::JSONB, 'Conversas de servico gratuitas por mes'),
  ('whatsapp_meta_pricing_model', '"per_message"'::JSONB, 'Modelo de precificacao ativo (Jul 2025)'),
  ('lgpd_retention_days_default', '365'::JSONB, 'Dias de retencao padrao LGPD'),
  ('lgpd_message_retention_days', '30'::JSONB, 'Dias de retencao de mensagens (Meta exige max 30)'),
  ('ai_call_max_duration_default', '180'::JSONB, 'Duracao maxima padrao de ligacao IA (segundos)'),
  ('voip_recording_consent_required', 'true'::JSONB, 'Exigir consentimento para gravacao de chamadas'),
  ('dnc_check_enabled', 'true'::JSONB, 'Verificar lista DNC antes de ligar/enviar mensagem')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ============================================================
-- 8.5 Compliance defaults - horarios permitidos para ligacao
-- ============================================================
INSERT INTO ai_call_compliance (company_id, compliance_type, reason, source, is_active, metadata)
SELECT
  id,
  'call_hours',
  'Horario comercial para ligacoes - Anatel/Procon',
  'system',
  true,
  '{"allowed_days": [1,2,3,4,5], "start_hour": 9, "end_hour": 21, "saturday_start": 10, "saturday_end": 16, "sunday_allowed": false, "holiday_allowed": false, "timezone": "America/Sao_Paulo"}'::JSONB
FROM companies
ON CONFLICT DO NOTHING;

COMMIT;
