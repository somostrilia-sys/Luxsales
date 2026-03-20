-- ============================================================
-- FASE 10: SETUP COMPLETO - SIP Trunks, AI Scripts, Dados de Teste
-- ============================================================

BEGIN;

-- ============================================================
-- 10.1 SIP Trunks demo para todas as empresas
-- ============================================================
INSERT INTO sip_trunks (company_id, name, provider, sip_host, sip_port, sip_transport, auth_username, max_channels, is_active, codecs, dtmf_mode, nat_traversal)
SELECT
  id,
  name || ' - Trunk Principal',
  'voxbone',
  'sip.voxbone.com',
  5060,
  'UDP',
  slug || '_trunk',
  10,
  true,
  '{G.711a,G.711u,G.729,OPUS}',
  'rfc2833',
  true
FROM companies
WHERE id NOT IN (SELECT company_id FROM sip_trunks)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10.2 SIP Extensions padrão (ramais 1001-1005 por empresa)
-- ============================================================
INSERT INTO sip_extensions (company_id, trunk_id, extension_number, display_name, recording_policy, status)
SELECT
  t.company_id,
  t.id,
  '100' || n.num,
  'Ramal ' || '100' || n.num,
  'all',
  'active'
FROM sip_trunks t
CROSS JOIN (VALUES ('1'),('2'),('3'),('4'),('5')) AS n(num)
WHERE NOT EXISTS (
  SELECT 1 FROM sip_extensions se
  WHERE se.company_id = t.company_id AND se.extension_number = '100' || n.num
);

-- ============================================================
-- 10.3 AI Call Scripts para cada empresa
-- ============================================================

-- Script: Qualificação de Lead
INSERT INTO ai_call_scripts (company_id, name, description, script_type, system_prompt, max_duration_sec, fallback_action, opening_message, closing_message, is_active, flow, objection_handlers, qualification_criteria, compliance_disclaimers)
SELECT
  c.id,
  'Qualificação de Lead - ' || c.name,
  'Script para qualificar leads por telefone com IA',
  'branching',
  'Você é um assistente de vendas profissional da ' || c.name || '. Seu objetivo é qualificar o lead, entender suas necessidades e agendar uma reunião com um consultor humano. Seja educado, objetivo e nunca pressione. Se o lead pedir para parar, respeite imediatamente.',
  180,
  'transfer',
  'Olá! Meu nome é Lucas, da ' || c.name || '. Estou ligando rapidamente para entender se podemos te ajudar. Tem um minutinho?',
  'Perfeito! Vou agendar uma conversa rápida com um dos nossos consultores. Muito obrigado pela atenção!',
  true,
  '{"nodes":[{"id":"greeting","type":"greeting","content":"Apresentação e verificação de disponibilidade"},{"id":"discovery","type":"question","content":"Entender necessidade do lead"},{"id":"qualify","type":"question","content":"Verificar perfil e fit"},{"id":"objection","type":"objection","content":"Lidar com objeções"},{"id":"close","type":"close","content":"Agendar reunião com consultor"}],"edges":[{"from":"greeting","to":"discovery","condition":"lead_available"},{"from":"discovery","to":"qualify","condition":"has_need"},{"from":"qualify","to":"close","condition":"qualified"},{"from":"qualify","to":"objection","condition":"has_objection"},{"from":"objection","to":"close","condition":"objection_handled"}]}'::JSONB,
  '{"preco_alto":"Entendo sua preocupação com o investimento. Posso te mostrar opções que cabem no seu orçamento.","sem_interesse":"Sem problemas! Só para garantir, você conhece os benefícios que oferecemos? Em 30 segundos consigo te explicar.","ja_tenho":"Ótimo que já tem uma solução! Mas posso te mostrar como a nossa pode complementar ou até substituir com vantagem.","sem_tempo":"Entendo perfeitamente! Posso te ligar em outro horário que seja melhor para você?"}'::JSONB,
  '{"min_score":3,"criteria":["tem_necessidade","tem_budget","tem_autoridade","tem_urgencia"]}'::JSONB,
  ARRAY['Esta ligação pode ser gravada para fins de qualidade.', 'Você pode solicitar a remoção dos seus dados a qualquer momento.']
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_scripts s WHERE s.company_id = c.id AND s.name LIKE 'Qualificação%'
);

-- Script: Pesquisa de Satisfação
INSERT INTO ai_call_scripts (company_id, name, description, script_type, system_prompt, max_duration_sec, fallback_action, opening_message, closing_message, is_active, flow)
SELECT
  c.id,
  'Pesquisa de Satisfação - ' || c.name,
  'Script para pesquisa NPS/CSAT por telefone',
  'linear',
  'Você é um assistente da ' || c.name || ' realizando uma pesquisa rápida de satisfação. Seja breve, educado e registre as respostas. Máximo 3 perguntas.',
  120,
  'hangup',
  'Olá! Sou da ' || c.name || ' e gostaria de fazer uma pesquisa rápida sobre sua experiência conosco. Leva menos de 1 minuto!',
  'Muito obrigado pela sua avaliação! Sua opinião é muito importante para nós. Tenha um ótimo dia!',
  true,
  '{"nodes":[{"id":"intro","type":"greeting","content":"Apresentação da pesquisa"},{"id":"q1","type":"question","content":"De 0 a 10, qual a chance de recomendar?"},{"id":"q2","type":"question","content":"O que podemos melhorar?"},{"id":"thanks","type":"farewell","content":"Agradecimento"}],"edges":[{"from":"intro","to":"q1"},{"from":"q1","to":"q2"},{"from":"q2","to":"thanks"}]}'::JSONB
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_scripts s WHERE s.company_id = c.id AND s.name LIKE 'Pesquisa%'
);

-- Script: Reativação de Lead Inativo
INSERT INTO ai_call_scripts (company_id, name, description, script_type, system_prompt, max_duration_sec, fallback_action, opening_message, closing_message, is_active, flow)
SELECT
  c.id,
  'Reativação de Lead - ' || c.name,
  'Script para reativar leads que não responderam',
  'branching',
  'Você é um assistente da ' || c.name || '. Está ligando para um lead que demonstrou interesse anteriormente mas não deu retorno. Seja amigável e descubra o motivo. Ofereça uma nova oportunidade.',
  150,
  'voicemail',
  'Olá! Aqui é da ' || c.name || '. Conversamos há um tempo e queria saber se ainda posso te ajudar com alguma coisa.',
  'Fico feliz em poder ajudar! Vou encaminhar para nosso time dar continuidade. Obrigado!',
  true,
  '{"nodes":[{"id":"greeting","type":"greeting","content":"Lembrar contato anterior"},{"id":"reason","type":"question","content":"Entender por que não deu retorno"},{"id":"offer","type":"question","content":"Oferecer nova proposta"},{"id":"close","type":"close","content":"Reagendar ou encerrar"}],"edges":[{"from":"greeting","to":"reason"},{"from":"reason","to":"offer","condition":"still_interested"},{"from":"offer","to":"close"}]}'::JSONB
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_scripts s WHERE s.company_id = c.id AND s.name LIKE 'Reativação%'
);

-- ============================================================
-- 10.4 AI Call Training - dados base para cada empresa
-- ============================================================
INSERT INTO ai_call_training (company_id, name, training_type, description, data, status)
SELECT
  c.id,
  'FAQ Geral - ' || c.name,
  'faq',
  'Perguntas frequentes sobre produtos e serviços',
  '[
    {"question":"Qual o horário de atendimento?","answer":"Nosso atendimento funciona de segunda a sexta, das 8h às 18h."},
    {"question":"Como posso contratar?","answer":"Você pode contratar pelo nosso site, WhatsApp ou agendar uma reunião com nosso consultor."},
    {"question":"Vocês têm suporte técnico?","answer":"Sim! Nosso suporte técnico está disponível 24h por dia, 7 dias por semana."},
    {"question":"Qual a forma de pagamento?","answer":"Aceitamos cartão de crédito, boleto e PIX."},
    {"question":"Posso cancelar a qualquer momento?","answer":"Sim, nossos planos não têm fidelidade. Você pode cancelar quando quiser."}
  ]'::JSONB,
  'ready'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_training t WHERE t.company_id = c.id AND t.training_type = 'faq'
);

INSERT INTO ai_call_training (company_id, name, training_type, description, data, status)
SELECT
  c.id,
  'Biblioteca de Objeções - ' || c.name,
  'objection_library',
  'Respostas para objeções comuns em vendas',
  '[
    {"objection":"Está muito caro","response":"Entendo sua preocupação. Vamos analisar juntos o custo-benefício e ver opções que cabem no seu orçamento.","category":"price"},
    {"objection":"Preciso pensar","response":"Claro! Posso te enviar um resumo por WhatsApp para você analisar com calma?","category":"delay"},
    {"objection":"Já tenho fornecedor","response":"Que bom que já tem uma solução! Posso te mostrar como complementamos o que você já tem.","category":"competition"},
    {"objection":"Não é o momento","response":"Entendo perfeitamente. Quando seria um bom momento para conversarmos novamente?","category":"timing"},
    {"objection":"Preciso falar com meu sócio","response":"Faz total sentido! Podemos agendar uma apresentação rápida para vocês dois?","category":"authority"}
  ]'::JSONB,
  'ready'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_training t WHERE t.company_id = c.id AND t.training_type = 'objection_library'
);

-- ============================================================
-- 10.5 Vincular voice profiles aos scripts
-- ============================================================
UPDATE ai_call_scripts
SET voice_profile_id = (SELECT id FROM voice_profiles WHERE voice_key = 'heitor' LIMIT 1)
WHERE voice_profile_id IS NULL AND name LIKE 'Qualificação%';

UPDATE ai_call_scripts
SET voice_profile_id = (SELECT id FROM voice_profiles WHERE voice_key = 'ana_paula' LIMIT 1)
WHERE voice_profile_id IS NULL AND name LIKE 'Pesquisa%';

UPDATE ai_call_scripts
SET voice_profile_id = (SELECT id FROM voice_profiles WHERE voice_key = 'mirella' LIMIT 1)
WHERE voice_profile_id IS NULL AND name LIKE 'Reativação%';

-- ============================================================
-- 10.6 Channel routing completo para cada empresa
-- ============================================================

-- VoIP -> AI (chamadas inbound vão para IA primeiro)
INSERT INTO channel_routing (company_id, name, source_channel, trigger_type, trigger_config, target_channel, target_type, priority, is_active)
SELECT id, 'VoIP Inbound -> AI', 'voip', 'first_contact',
  '{"auto_assign": true, "match_business_hours": true}'::JSONB,
  'voip', 'ai_script', 5, true
FROM companies
ON CONFLICT DO NOTHING;

-- AI Call -> WhatsApp follow-up
INSERT INTO channel_routing (company_id, name, source_channel, trigger_type, trigger_config, target_channel, target_type, priority, is_active)
SELECT id, 'AI Call Qualificado -> WhatsApp', 'ai_call', 'intent',
  '{"intents": ["qualified", "interested", "scheduled"], "auto_send_template": "followup_ligacao"}'::JSONB,
  'whatsapp_meta', 'agent_definition', 15, true
FROM companies
ON CONFLICT DO NOTHING;

-- WhatsApp -> Escalação humana
INSERT INTO channel_routing (company_id, name, source_channel, trigger_type, trigger_config, target_channel, target_type, priority, is_active)
SELECT id, 'WhatsApp -> Escalar Humano', 'whatsapp_meta', 'keyword',
  '{"keywords": ["atendente", "humano", "pessoa", "falar com alguem", "reclamação", "cancelar", "sair"]}'::JSONB,
  'whatsapp_meta', 'collaborator', 25, true
FROM companies
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10.7 Dados de teste - algumas mensagens e billing
-- ============================================================

-- Billing de teste (últimos 7 dias)
INSERT INTO billing_usage (company_id, channel, usage_type, quantity, unit_cost_brl, total_cost_brl, billing_period_start, billing_period_end, description, created_at)
SELECT
  c.id,
  channel,
  usage_type,
  qty,
  unit_cost,
  qty * unit_cost,
  CURRENT_DATE - 7,
  CURRENT_DATE,
  descr,
  now() - (random() * interval '7 days')
FROM companies c
CROSS JOIN (VALUES
  ('whatsapp', 'message_template', 45, 0.0450, 'Templates enviados'),
  ('whatsapp', 'message_service', 120, 0.0000, 'Mensagens de serviço (grátis)'),
  ('voip', 'call_minute', 230, 0.0300, 'Minutos de ligação SIP'),
  ('ai_call', 'ai_call_minute', 85, 0.1200, 'Minutos de ligação IA (STT+LLM+TTS)'),
  ('whatsapp', 'message_marketing', 30, 0.0800, 'Mensagens marketing')
) AS d(channel, usage_type, qty, unit_cost, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM billing_usage b WHERE b.company_id = c.id AND b.usage_type = d.usage_type
);

-- AI Call Analytics de teste (últimos 7 dias)
INSERT INTO ai_call_analytics (company_id, analytics_date, total_calls, completed_calls, failed_calls, no_answer_calls, avg_duration_sec, avg_sentiment_score, goal_achievement_rate, hot_leads, warm_leads, cold_leads, transfer_count, compliance_violation_count, cost_total_brl, cost_per_lead_brl)
SELECT
  c.id,
  d::date,
  floor(random() * 30 + 10)::int,
  floor(random() * 20 + 5)::int,
  floor(random() * 5)::int,
  floor(random() * 10)::int,
  floor(random() * 120 + 60)::numeric,
  (random() * 2 + 3)::numeric(3,2),
  (random() * 40 + 20)::numeric(5,2),
  floor(random() * 5 + 1)::int,
  floor(random() * 8 + 2)::int,
  floor(random() * 10 + 3)::int,
  floor(random() * 3)::int,
  0,
  (random() * 50 + 10)::numeric(12,4),
  (random() * 5 + 2)::numeric(10,4)
FROM companies c
CROSS JOIN generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
WHERE NOT EXISTS (
  SELECT 1 FROM ai_call_analytics a WHERE a.company_id = c.id AND a.analytics_date = d::date
);

-- ============================================================
-- 10.8 Cleanup automático - function para limpar webhook events antigos
-- ============================================================
CREATE OR REPLACE FUNCTION fn_cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM whatsapp_meta_webhook_events
  WHERE received_at < now() - interval '90 days'
    AND processing_status = 'processed';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Log cleanup
  INSERT INTO audit_logs (company_id, table_name, action, actor_type, metadata)
  SELECT DISTINCT company_id, 'whatsapp_meta_webhook_events', 'DELETE', 'cron',
    jsonb_build_object('deleted_count', v_deleted, 'retention_days', 90)
  FROM whatsapp_meta_webhook_events
  LIMIT 1;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup de gravações expiradas
CREATE OR REPLACE FUNCTION fn_cleanup_expired_recordings()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  UPDATE call_recordings
  SET deleted_at = now(),
      recording_url = 'EXPIRED',
      storage_path = NULL,
      transcription_text = NULL
  WHERE retention_expires_at < now()
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
