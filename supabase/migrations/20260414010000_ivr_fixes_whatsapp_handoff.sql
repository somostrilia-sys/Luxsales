-- ============================================================
-- IVR fixes: SDR Trilia via WhatsApp + nunca admitir ser IA
-- ============================================================
-- Correções pós-deploy do IVR v1:
--   1. Handoff Trilia é por WhatsApp, não por transferência SIP live.
--   2. Agentes NUNCA admitem ser IA/robô/assistente. Resposta ao "é IA?"
--      deflete e redireciona pro fluxo principal.
--   3. Objetivo ganha novo intent obj_voce_e_ia (não existia).
-- Todos os áudios afetados são re-renderizados pelo script
-- scripts/render-ivr-audios.mjs após esta migration.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- TRILIA — converter handoffs SDR live → WhatsApp
-- ------------------------------------------------------------

UPDATE ivr_audio_scripts SET
  text_raw = 'Olha, pelo que você me falou faz muito sentido conversar com um dos nossos consultores. Posso te mandar no WhatsApp pra ele entrar em contato ainda hoje e entender melhor seu momento?',
  text_v3  = '[warm] Olha, pelo que você me falou faz muito sentido conversar com um dos nossos consultores. [reassuring] Posso te mandar no WhatsApp [softly] pra ele entrar em contato ainda hoje [curious] e entender melhor seu momento?',
  branch_hints = '{"on_positive":"transfer_confirm_connecting","on_hesitant":"obj_manda_whats","on_negative":"goodbye_whats_no"}'::jsonb,
  notes = 'Oferta de handoff SDR via WhatsApp (não via transferência SIP) — quando lead declarou dor.',
  audio_url = NULL, audio_bytes = NULL, audio_duration_ms = NULL, audio_rendered_at = NULL,
  updated_at = now()
WHERE company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND intent = 'transfer_to_sdr_offer';

UPDATE ivr_audio_scripts SET
  text_raw = 'Perfeito! Já vou mandar tua conversa pro consultor e ele vai te chamar no WhatsApp ainda hoje. Qualquer coisa, me chama por lá. Valeu!',
  text_v3  = '[excited] Perfeito! [warm] Já vou mandar tua conversa pro consultor [softly] e ele vai te chamar no WhatsApp ainda hoje. [reassuring] Qualquer coisa, me chama por lá. Valeu!',
  branch_hints = '{"terminal":true,"action":"send_whatsapp_sdr_handoff"}'::jsonb,
  notes = 'Confirmação — SDR humano contactará via WhatsApp (não transferência SIP).',
  audio_url = NULL, audio_bytes = NULL, audio_duration_ms = NULL, audio_rendered_at = NULL,
  updated_at = now()
WHERE company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND intent = 'transfer_confirm_connecting';

UPDATE ivr_audio_scripts SET
  text_raw = 'Como assim? Tô aqui falando com você! Me conta, qual seu maior desafio hoje — é mais vendas, como você se posiciona ou o time?',
  text_v3  = '[curious] Como assim? [warm] Tô aqui falando com você! [softly] Me conta, [curious] qual seu maior desafio hoje — é mais vendas, como você se posiciona ou o time?',
  branch_hints = '{"on_pain":"transfer_to_sdr_offer","on_vague":"probe_crescer","on_negative":"goodbye_whats_no"}'::jsonb,
  notes = 'Lead pergunta "é IA?" — NUNCA admite, deflete + redireciona pra pergunta de dor.',
  audio_url = NULL, audio_bytes = NULL, audio_duration_ms = NULL, audio_rendered_at = NULL,
  updated_at = now()
WHERE company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND intent = 'obj_voce_e_ia';

UPDATE ivr_audio_scripts SET
  text_raw = 'Claro! Vou te mandar no WhatsApp e o nosso consultor entra em contato ainda hoje pra entender melhor seu momento. Pode ser?',
  text_v3  = '[warm] Claro! [softly] Vou te mandar no WhatsApp [reassuring] e o nosso consultor entra em contato ainda hoje [softly] pra entender melhor seu momento. [curious] Pode ser?',
  branch_hints = '{"on_positive":"transfer_confirm_connecting","on_negative":"goodbye_whats_no"}'::jsonb,
  notes = 'Lead pede WhatsApp — aceita direto (WhatsApp é o handoff, não resistência).',
  audio_url = NULL, audio_bytes = NULL, audio_duration_ms = NULL, audio_rendered_at = NULL,
  updated_at = now()
WHERE company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND intent = 'obj_manda_whats';

UPDATE ivr_audio_scripts SET
  text_raw = 'Entendo. O diferencial da Trilia é que a gente integra os três pilares juntos — comercial, marca e cultura — e implementa junto, não só orienta. Vale uma conversa rápida com nosso consultor no WhatsApp pra você ver a diferença?',
  text_v3  = '[curious] Entendo. [warm] O diferencial da Trilia é que a gente integra os três pilares juntos — comercial, marca e cultura — [softly] e implementa junto, não só orienta. [reassuring] Vale uma conversa rápida com nosso consultor no WhatsApp pra você ver a diferença?',
  audio_url = NULL, audio_bytes = NULL, audio_duration_ms = NULL, audio_rendered_at = NULL,
  updated_at = now()
WHERE company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND intent = 'obj_ja_tenho_consultoria';

UPDATE ivr_audio_scripts SET
  text_raw = 'Faz sentido, estamos crescendo. Já atendemos dezenas de empresas no seu segmento. O diagnóstico é gratuito — é a melhor forma de você ver o método na prática. Posso te mandar no WhatsApp pro nosso consultor te chamar?',
  text_v3  = '[softly] Faz sentido, [warm] estamos crescendo. [reassuring] Já atendemos dezenas de empresas no seu segmento. [softly] O diagnóstico é gratuito... [excited] é a melhor forma de você ver o método na prática. [curious] Posso te mandar no WhatsApp pro nosso consultor te chamar?',
  audio_url = NULL, audio_bytes = NULL, audio_duration_ms = NULL, audio_rendered_at = NULL,
  updated_at = now()
WHERE company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND intent = 'obj_nao_conheco';

UPDATE ivr_audio_scripts SET
  text_raw = 'Isso o consultor explica melhor, numa reunião que é gratuita. A ideia aqui é ele entender seu momento e te mostrar como a gente pode ajudar. Posso te mandar no WhatsApp pra ele te chamar?',
  text_v3  = '[softly] Isso o consultor explica melhor, [warm] numa reunião que é gratuita. [reassuring] A ideia aqui é ele entender seu momento [softly] e te mostrar como a gente pode ajudar. [curious] Posso te mandar no WhatsApp pra ele te chamar?',
  audio_url = NULL, audio_bytes = NULL, audio_duration_ms = NULL, audio_rendered_at = NULL,
  updated_at = now()
WHERE company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND intent = 'obj_preco';

-- ------------------------------------------------------------
-- OBJETIVO — adicionar obj_voce_e_ia (não existia na v1)
-- ------------------------------------------------------------
INSERT INTO ivr_audio_scripts (company_id, voice_profile_id, intent, variation_key, category, text_raw, text_v3, notes, branch_hints, training_examples)
SELECT
  '70967469-9a9b-4e29-a744-410e41eb47a5',
  vp.id,
  'obj_voce_e_ia',
  'v1',
  'objection',
  'Tô aqui na linha com você agora! Mas me conta, tem algum veículo que você quer proteger — carro, moto ou caminhão?',
  '[curious] Tô aqui na linha com você agora! [warm] Mas me conta, [softly] tem algum veículo que você quer proteger — [curious] carro, moto ou caminhão?',
  'Lead pergunta "é IA?" — NUNCA admite, deflete + redireciona pra pergunta de veículo.',
  '{"carro":"benefit_carro","moto":"benefit_moto","caminhao":"benefit_caminhao","on_negative":"obj_no_want"}'::jsonb,
  '["você é ia","é robô","é humano","é pessoa","é real","é gravação","é bot","você é uma pessoa","tá falando com quem","é máquina","tô falando com máquina","isso é gravação"]'::jsonb
FROM voice_profiles vp
WHERE vp.voice_key IN ('el-lucas-v3', 'el-cleo-v3')
ON CONFLICT (company_id, voice_profile_id, intent, variation_key) DO UPDATE SET
  text_raw = EXCLUDED.text_raw,
  text_v3 = EXCLUDED.text_v3,
  notes = EXCLUDED.notes,
  branch_hints = EXCLUDED.branch_hints,
  training_examples = EXCLUDED.training_examples,
  updated_at = now();

COMMIT;
