-- ============================================================
-- IVR Audio Scripts — ElevenLabs v3 cached audios
-- ============================================================
-- Árvore de intents determinística cobrindo TODAS as respostas
-- previsíveis dos scripts atuais (Qualificação + Reativação
-- Objetivo; Prospecção Fria Trilia). Sem LLM: cada nó é um áudio
-- pré-renderizado com audio tags v3.
--
-- Audio tags usados: [warm] [excited] [softly] [curious]
-- [reassuring] [hesitant] [direct] [laughs] [whispers] [sighs]
--
-- Persona swap Lucas ↔ Cléo: artigos "o Lucas"/"Obrigado" ↔
-- "a Cléo"/"Obrigada". Texto base permanece igual.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Voice profiles ElevenLabs v3 (Premium IVC — fonte limpa)
-- ------------------------------------------------------------
INSERT INTO voice_profiles (voice_key, voice_name, voice_id, gender, provider, language, model, company_id, is_default, active, voice_settings)
VALUES
  (
    'el-lucas-v3',
    'Lucas v3 (ElevenLabs Premium IVC)',
    'zxGP2YdBPFcHWuE7fR9z',
    'male',
    'elevenlabs',
    'pt-BR',
    'eleven_v3',
    NULL,
    false,
    true,
    '{"stability":0.45,"similarity_boost":0.85,"style":0.35,"use_speaker_boost":true}'::jsonb
  ),
  (
    'el-cleo-v3',
    'Cléo v3 (ElevenLabs Premium IVC)',
    'obmxHezVbv5gwWEvDGoK',
    'female',
    'elevenlabs',
    'pt-BR',
    'eleven_v3',
    NULL,
    false,
    true,
    '{"stability":0.40,"similarity_boost":0.85,"style":0.40,"use_speaker_boost":true}'::jsonb
  )
ON CONFLICT (voice_key) DO UPDATE SET
  voice_id     = EXCLUDED.voice_id,
  voice_name   = EXCLUDED.voice_name,
  gender       = EXCLUDED.gender,
  provider     = EXCLUDED.provider,
  language     = EXCLUDED.language,
  model        = EXCLUDED.model,
  voice_settings = EXCLUDED.voice_settings,
  active       = true,
  updated_at   = now();

-- ------------------------------------------------------------
-- 2) Tabela ivr_audio_scripts (cria se não existe)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ivr_audio_scripts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voice_profile_id  uuid NOT NULL REFERENCES voice_profiles(id) ON DELETE CASCADE,
  intent            text NOT NULL,
  variation_key     text NOT NULL DEFAULT 'v1',
  category          text NOT NULL DEFAULT 'generic',
  text_raw          text NOT NULL,
  text_v3           text NOT NULL,
  voice_settings    jsonb DEFAULT '{"stability":0.45,"similarity_boost":0.85,"style":0.35,"use_speaker_boost":true}'::jsonb,
  branch_hints      jsonb DEFAULT '{}'::jsonb,
  training_examples jsonb DEFAULT '[]'::jsonb,
  audio_url         text,
  audio_bytes       bigint,
  audio_duration_ms integer,
  audio_rendered_at timestamptz,
  render_model      text DEFAULT 'eleven_v3',
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, voice_profile_id, intent, variation_key)
);

-- Garantir colunas novas se tabela pré-existia com schema v1
ALTER TABLE ivr_audio_scripts
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'generic';
ALTER TABLE ivr_audio_scripts
  ADD COLUMN IF NOT EXISTS branch_hints jsonb DEFAULT '{}'::jsonb;
ALTER TABLE ivr_audio_scripts
  ADD COLUMN IF NOT EXISTS training_examples jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS ivr_audio_scripts_lookup_idx
  ON ivr_audio_scripts (company_id, voice_profile_id, intent, is_active);

CREATE INDEX IF NOT EXISTS ivr_audio_scripts_unrendered_idx
  ON ivr_audio_scripts (company_id) WHERE audio_url IS NULL;

CREATE INDEX IF NOT EXISTS ivr_audio_scripts_category_idx
  ON ivr_audio_scripts (company_id, category);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION ivr_audio_scripts_touch() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ivr_audio_scripts_touch_trg ON ivr_audio_scripts;
CREATE TRIGGER ivr_audio_scripts_touch_trg
  BEFORE UPDATE ON ivr_audio_scripts
  FOR EACH ROW EXECUTE FUNCTION ivr_audio_scripts_touch();

-- RLS
ALTER TABLE ivr_audio_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ivr_audio_scripts_select ON ivr_audio_scripts;
CREATE POLICY ivr_audio_scripts_select ON ivr_audio_scripts
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM collaborators WHERE id = get_my_collaborator_id()
    )
    OR get_my_role_level() <= 1
  );

DROP POLICY IF EXISTS ivr_audio_scripts_write ON ivr_audio_scripts;
CREATE POLICY ivr_audio_scripts_write ON ivr_audio_scripts
  FOR ALL USING (get_my_role_level() <= 1)
  WITH CHECK (get_my_role_level() <= 1);

-- ------------------------------------------------------------
-- 3) Clear v1 seed (era só rascunho) para re-seed completo v2
-- ------------------------------------------------------------
DELETE FROM ivr_audio_scripts
WHERE company_id IN (
  '70967469-9a9b-4e29-a744-410e41eb47a5', -- Objetivo
  '131d9cba-d49c-44d5-a9b3-baa84d34bd96'  -- Trilia
)
AND variation_key = 'v1'
AND audio_url IS NULL;  -- preserva qualquer render já feito

-- ------------------------------------------------------------
-- 4) Seed OBJETIVO — 27 intents × 2 vozes = 54 scripts
-- ------------------------------------------------------------
DO $objetivo$
DECLARE
  v_company_id uuid := '70967469-9a9b-4e29-a744-410e41eb47a5';
  v_lucas_id   uuid;
  v_cleo_id    uuid;
  rec record;
BEGIN
  SELECT id INTO v_lucas_id FROM voice_profiles WHERE voice_key = 'el-lucas-v3';
  SELECT id INTO v_cleo_id  FROM voice_profiles WHERE voice_key = 'el-cleo-v3';

  FOR rec IN
    SELECT * FROM (VALUES
      -- ===== A) OPENINGS (2) =====
      (
        'opening_qualificacao', 'opening',
        'Opa, beleza? Lucas da Objetivo aqui. Tenho uma condição incrível pra proteção do seu veículo — tem um instante pra ouvir?',
        '[warm] Opa, beleza? [softly] Lucas da Objetivo aqui. [excited] Tenho uma condição incrível pra proteção do seu veículo... [curious] tem um instante pra ouvir?',
        '[warm] Opa, beleza? [softly] Cléo da Objetivo aqui. [excited] Tenho uma condição incrível pra proteção do seu veículo... [curious] tem um instante pra ouvir?',
        'Abertura para leads frios da lista de qualificação.',
        '{"on_positive":"pitch_discount_15","on_hesitant":"pitch_condicao_unica","on_negative":"obj_no_want","on_confused":"confusion_assume_yes"}'
      ),
      (
        'opening_reativacao', 'opening',
        'Alô, tudo bem? Aqui é o Lucas da Objetivo. Eu tô te ligando porque a gente está com uma condição única essa semana pra proteção completa do seu veículo. Posso te explicar rapidinho?',
        '[warm] Alô, tudo bem? [softly] Aqui é o Lucas da Objetivo. [reassuring] Eu tô te ligando porque a gente tá com uma condição única essa semana pra proteção completa do seu veículo. [curious] Posso te explicar rapidinho?',
        '[warm] Alô, tudo bem? [softly] Aqui é a Cléo da Objetivo. [reassuring] Eu tô te ligando porque a gente tá com uma condição única essa semana pra proteção completa do seu veículo. [curious] Posso te explicar rapidinho?',
        'Abertura para leads morno/reativação — tom mais contextual.',
        '{"on_positive":"ask_vehicle_type_q","on_hesitant":"request_whatsapp_soft_insist","on_negative":"obj_no_want"}'
      ),

      -- ===== B) PITCH APÓS POSITIVO (2) =====
      (
        'pitch_discount_15', 'pitch',
        'Então, a gente está com uma campanha com quinze por cento de desconto pro ano inteiro. Posso te chamar no WhatsApp pra uma cotação rapidinha, sem compromisso?',
        '[softly] Então, [excited] a gente tá com uma campanha com quinze por cento de desconto pro ano inteiro. [warm] Posso te chamar no WhatsApp pra uma cotação rapidinha, sem compromisso?',
        '[softly] Então, [excited] a gente tá com uma campanha com quinze por cento de desconto pro ano inteiro. [warm] Posso te chamar no WhatsApp pra uma cotação rapidinha, sem compromisso?',
        'Oferta principal após lead positivo — usa percentual em vez de valor.',
        '{"on_positive":"whatsapp_confirmation","on_details":"ask_vehicle_type_q","on_hesitant":"request_whatsapp_soft_insist"}'
      ),
      (
        'pitch_condicao_unica', 'pitch',
        'Olha, é uma proteção completa, acessível e mensal. Posso te mandar sem compromisso uma cotação? Se não fizer sentido, eu não te incomodo.',
        '[softly] Olha, [warm] é uma proteção completa, acessível e mensal. [reassuring] Posso te mandar sem compromisso uma cotação? [softly] Se não fizer sentido, eu não te incomodo.',
        '[softly] Olha, [warm] é uma proteção completa, acessível e mensal. [reassuring] Posso te mandar sem compromisso uma cotação? [softly] Se não fizer sentido, eu não te incomodo.',
        'Pitch suave para leads hesitantes.',
        '{"on_positive":"whatsapp_confirmation","on_details":"ask_how_works","on_hesitant":"obj_no_want"}'
      ),

      -- ===== C) RESPONDER "QUAL É / COMO FUNCIONA" (3) =====
      (
        'ask_what_is', 'info',
        'É uma proteção completa pro seu veículo, acessível e mensal. Posso te mandar uma cotação no WhatsApp, sem compromisso?',
        '[warm] É uma proteção completa pro seu veículo, [softly] acessível e mensal. [reassuring] Posso te mandar uma cotação no WhatsApp, sem compromisso?',
        '[warm] É uma proteção completa pro seu veículo, [softly] acessível e mensal. [reassuring] Posso te mandar uma cotação no WhatsApp, sem compromisso?',
        'Lead pergunta "o que é?" antes de aceitar.',
        '{"on_positive":"whatsapp_confirmation","on_details":"ask_how_works"}'
      ),
      (
        'ask_how_works', 'info',
        'Cobre qualquer coisa que acontecer com o veículo: colisão, incêndio, roubo e mais. Eu te mando no WhatsApp, é bem simples!',
        '[warm] Cobre qualquer coisa que acontecer com o veículo: [excited] colisão, incêndio, roubo e mais. [softly] Eu te mando no WhatsApp, [reassuring] é bem simples!',
        '[warm] Cobre qualquer coisa que acontecer com o veículo: [excited] colisão, incêndio, roubo e mais. [softly] Eu te mando no WhatsApp, [reassuring] é bem simples!',
        'Lead pergunta "como funciona?".',
        '{"on_positive":"whatsapp_confirmation"}'
      ),
      (
        'ask_vehicle_type_q', 'info',
        'Qual seu veículo? Carro, moto ou caminhão?',
        '[curious] Qual seu veículo? [softly] Carro, moto ou caminhão?',
        '[curious] Qual seu veículo? [softly] Carro, moto ou caminhão?',
        'Quando lead quer entender antes (pitch por veículo).',
        '{"carro":"benefit_carro","moto":"benefit_moto","caminhao":"benefit_caminhao","confuso":"disambiguation_vehicle"}'
      ),

      -- ===== D) BENEFÍCIOS POR VEÍCULO + HANDOFF (3) =====
      (
        'benefit_carro', 'benefit',
        'Show! Pro seu carro a gente tem cobertura completa, guincho de mil quilômetros, carro reserva por quinze dias e assistência vinte e quatro horas. Posso te chamar no WhatsApp pra uma cotação? É rapidinho, sem compromisso.',
        '[excited] Show! [warm] Pro seu carro a gente tem cobertura completa, guincho de mil quilômetros, carro reserva por quinze dias e assistência vinte e quatro horas. [softly] Posso te chamar no WhatsApp pra uma cotação? [reassuring] É rapidinho, sem compromisso.',
        '[excited] Show! [warm] Pro seu carro a gente tem cobertura completa, guincho de mil quilômetros, carro reserva por quinze dias e assistência vinte e quatro horas. [softly] Posso te chamar no WhatsApp pra uma cotação? [reassuring] É rapidinho, sem compromisso.',
        'Benefícios carro + chamada WhatsApp imediata.',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"request_whatsapp_soft_insist"}'
      ),
      (
        'benefit_moto', 'benefit',
        'Massa! Pra moto a gente cobre tudo, guincho de quinhentos quilômetros, assistência vinte e quatro horas e ainda instala o rastreador incluso. Posso te chamar no WhatsApp pra uma cotação sem compromisso?',
        '[excited] Massa! [warm] Pra moto a gente cobre tudo, guincho de quinhentos quilômetros, assistência vinte e quatro horas... [softly] e ainda instala o rastreador incluso. [reassuring] Posso te chamar no WhatsApp pra uma cotação sem compromisso?',
        '[excited] Massa! [warm] Pra moto a gente cobre tudo, guincho de quinhentos quilômetros, assistência vinte e quatro horas... [softly] e ainda instala o rastreador incluso. [reassuring] Posso te chamar no WhatsApp pra uma cotação sem compromisso?',
        'Benefícios moto + handoff.',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"request_whatsapp_soft_insist"}'
      ),
      (
        'benefit_caminhao', 'benefit',
        'Beleza! Pro seu caminhão a gente tem guincho de mais de mil quilômetros, destombamento e assistência vinte e quatro horas. Posso te chamar no WhatsApp pra uma cotação rapidinha?',
        '[excited] Beleza! [warm] Pro seu caminhão a gente tem guincho de mais de mil quilômetros, destombamento e assistência vinte e quatro horas. [softly] Posso te chamar no WhatsApp pra uma cotação rapidinha?',
        '[excited] Beleza! [warm] Pro seu caminhão a gente tem guincho de mais de mil quilômetros, destombamento e assistência vinte e quatro horas. [softly] Posso te chamar no WhatsApp pra uma cotação rapidinha?',
        'Benefícios caminhão + handoff.',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"request_whatsapp_soft_insist"}'
      ),

      -- ===== E) WHATSAPP HANDOFF (3) =====
      (
        'request_whatsapp_simple', 'handoff',
        'Posso te chamar no WhatsApp pra uma cotação rapidinha, sem compromisso?',
        '[warm] Posso te chamar no WhatsApp pra uma cotação rapidinha, sem compromisso?',
        '[warm] Posso te chamar no WhatsApp pra uma cotação rapidinha, sem compromisso?',
        'Pedido WhatsApp curto e direto.',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"request_whatsapp_soft_insist"}'
      ),
      (
        'request_whatsapp_soft_insist', 'handoff',
        'É bem rapidinho... te mando lá e você analisa com calma, sem compromisso nenhum. Pode ser?',
        '[reassuring] É bem rapidinho... [warm] te mando lá e você analisa com calma, sem compromisso nenhum. [softly] Pode ser?',
        '[reassuring] É bem rapidinho... [warm] te mando lá e você analisa com calma, sem compromisso nenhum. [softly] Pode ser?',
        'Insistência única suave após hesitação.',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"goodbye_after_2_no"}'
      ),
      (
        'whatsapp_confirmation', 'close',
        'Show! Já tô te mandando no WhatsApp. Qualquer dúvida me chama por lá. Valeu demais, até mais!',
        '[excited] Show! [warm] Já tô te mandando no WhatsApp. [softly] Qualquer dúvida me chama por lá. [reassuring] Valeu demais, até mais!',
        '[excited] Show! [warm] Já tô te mandando no WhatsApp. [softly] Qualquer dúvida me chama por lá. [reassuring] Valeu demais, até mais!',
        'Confirmação final quando lead aceita — encerra chamada.',
        '{"terminal":true}'
      ),

      -- ===== F) REDIRECTS PÓS-OFERTA (3) =====
      (
        'redirect_price_to_whats', 'redirect',
        'Te passo certinho no WhatsApp! Sem compromisso, você dá uma olhada com calma.',
        '[warm] Te passo certinho no WhatsApp! [softly] Sem compromisso, [reassuring] você dá uma olhada com calma.',
        '[warm] Te passo certinho no WhatsApp! [softly] Sem compromisso, [reassuring] você dá uma olhada com calma.',
        'Lead pergunta "quanto custa?" depois de já ter pedido WhatsApp.',
        '{"on_positive":"whatsapp_confirmation"}'
      ),
      (
        'redirect_howworks_to_whats', 'redirect',
        'Mando explicadinho no WhatsApp! É bem mais fácil você ver por lá com calma.',
        '[warm] Mando explicadinho no WhatsApp! [softly] É bem mais fácil você ver por lá com calma.',
        '[warm] Mando explicadinho no WhatsApp! [softly] É bem mais fácil você ver por lá com calma.',
        'Lead pergunta "como funciona?" depois de já ter pedido WhatsApp.',
        '{"on_positive":"whatsapp_confirmation"}'
      ),
      (
        'redirect_think_to_whats', 'redirect',
        'Mando no WhatsApp pra você ver com calma, beleza? Sem pressa nenhuma.',
        '[warm] Mando no WhatsApp pra você ver com calma, [softly] beleza? [reassuring] Sem pressa nenhuma.',
        '[warm] Mando no WhatsApp pra você ver com calma, [softly] beleza? [reassuring] Sem pressa nenhuma.',
        'Lead diz "preciso pensar".',
        '{"on_positive":"whatsapp_confirmation"}'
      ),

      -- ===== G) OBJEÇÕES (5) =====
      (
        'obj_price', 'objection',
        'Ah, caro em relação a quê? Olha, te mando no WhatsApp os valores certinho, aí você vê se faz sentido. Beleza?',
        '[curious] Ah, caro em relação a quê? [softly] Olha... te mando no WhatsApp os valores certinho, [warm] aí você vê se faz sentido. [reassuring] Beleza?',
        '[curious] Ah, caro em relação a quê? [softly] Olha... te mando no WhatsApp os valores certinho, [warm] aí você vê se faz sentido. [reassuring] Beleza?',
        'Objeção "tá caro".',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"goodbye_after_2_no"}'
      ),
      (
        'obj_no_time', 'objection',
        'É rapidinho! Te mando no WhatsApp e você vê quando puder, sem pressa nenhuma.',
        '[reassuring] É rapidinho! [warm] Te mando no WhatsApp e você vê quando puder, [softly] sem pressa nenhuma.',
        '[reassuring] É rapidinho! [warm] Te mando no WhatsApp e você vê quando puder, [softly] sem pressa nenhuma.',
        'Objeção "sem tempo".',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"goodbye_after_2_no"}'
      ),
      (
        'obj_no_interest', 'objection',
        'Entendi. Olha, de cada dez veículos sete tão desprotegidos. Uma cotação rapidinha sem compromisso, pode ser?',
        '[warm] Entendi. [softly] Olha, de cada dez veículos sete tão desprotegidos. [reassuring] Uma cotação rapidinha sem compromisso, [curious] pode ser?',
        '[warm] Entendi. [softly] Olha, de cada dez veículos sete tão desprotegidos. [reassuring] Uma cotação rapidinha sem compromisso, [curious] pode ser?',
        'Objeção "sem interesse" — estatística + oferta suave.',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"goodbye_after_2_no"}'
      ),
      (
        'obj_already_has', 'objection',
        'Ah, qual você tem? Geralmente a gente consegue bem melhor por menos. Posso te mandar uma cotação no WhatsApp só pra você comparar?',
        '[curious] Ah, qual você tem? [excited] Geralmente a gente consegue bem melhor por menos. [warm] Posso te mandar uma cotação no WhatsApp só pra você comparar?',
        '[curious] Ah, qual você tem? [excited] Geralmente a gente consegue bem melhor por menos. [warm] Posso te mandar uma cotação no WhatsApp só pra você comparar?',
        'Objeção "já tenho seguro/proteção".',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"goodbye_after_2_no"}'
      ),
      (
        'obj_no_want', 'objection',
        'Sem problema! Desculpa o incômodo. Tenha um ótimo dia!',
        '[warm] Sem problema! [softly] Desculpa o incômodo. [reassuring] Tenha um ótimo dia!',
        '[warm] Sem problema! [softly] Desculpa o incômodo. [reassuring] Tenha um ótimo dia!',
        'Objeção "não quero" — encerramento educado imediato.',
        '{"terminal":true}'
      ),

      -- ===== H) COMPLIANCE (1) =====
      (
        'how_got_number', 'compliance',
        'Certamente você pesquisou sobre proteção veicular no passado, e seu contato ficou na nossa base. Mas posso te mandar uma cotação sem compromisso, rapidinho?',
        '[softly] Certamente você pesquisou sobre proteção veicular no passado, [warm] e seu contato ficou na nossa base. [reassuring] Mas posso te mandar uma cotação sem compromisso, rapidinho?',
        '[softly] Certamente você pesquisou sobre proteção veicular no passado, [warm] e seu contato ficou na nossa base. [reassuring] Mas posso te mandar uma cotação sem compromisso, rapidinho?',
        'Lead pergunta "de onde veio meu número?".',
        '{"on_positive":"whatsapp_confirmation","on_hesitant":"goodbye_after_2_no"}'
      ),

      -- ===== I) DESPEDIDAS (3) =====
      (
        'goodbye_after_2_no', 'goodbye',
        'Sem problema! Se mudar de ideia, pode me ligar. Tenha um ótimo dia!',
        '[warm] Sem problema! [softly] Se mudar de ideia, pode me ligar. [reassuring] Tenha um ótimo dia!',
        '[warm] Sem problema! [softly] Se mudar de ideia, pode me ligar. [reassuring] Tenha um ótimo dia!',
        'Encerramento após segunda recusa — respeita o limite.',
        '{"terminal":true}'
      ),
      (
        'goodbye_deixa_proxima', 'goodbye',
        'Ah tudo bem, deixa pra uma próxima então. Obrigado!',
        '[softly] Ah tudo bem, [warm] deixa pra uma próxima então. [reassuring] Obrigado!',
        '[softly] Ah tudo bem, [warm] deixa pra uma próxima então. [reassuring] Obrigada!',
        'Encerramento leve — lead deu negativa amigável.',
        '{"terminal":true}'
      ),
      (
        'goodbye_thanks', 'goodbye',
        'Perfeito, já tô mandando. Qualquer dúvida me chama lá. Obrigado, até mais!',
        '[excited] Perfeito, [warm] já tô mandando. [softly] Qualquer dúvida me chama lá. [reassuring] Obrigado, até mais!',
        '[excited] Perfeito, [warm] já tô mandando. [softly] Qualquer dúvida me chama lá. [reassuring] Obrigada, até mais!',
        'Encerramento quando lead já confirmou WhatsApp anteriormente.',
        '{"terminal":true}'
      ),

      -- ===== J) EDGE CASES (2) =====
      (
        'confusion_assume_yes', 'edge',
        'Show! Vou te chamar no WhatsApp já já. Valeu!',
        '[excited] Show! [warm] Vou te chamar no WhatsApp já já. [reassuring] Valeu!',
        '[excited] Show! [warm] Vou te chamar no WhatsApp já já. [reassuring] Valeu!',
        'Lead deu resposta confusa (código, canal) — assume positivo e segue.',
        '{"terminal":true}'
      ),
      (
        'disambiguation_vehicle', 'edge',
        'Desculpa, não peguei direito. É carro, moto ou caminhão?',
        '[hesitant] Desculpa, não peguei direito. [curious] É carro, moto ou caminhão?',
        '[hesitant] Desculpa, não peguei direito. [curious] É carro, moto ou caminhão?',
        'Lead respondeu algo ambíguo sobre veículo.',
        '{"carro":"benefit_carro","moto":"benefit_moto","caminhao":"benefit_caminhao"}'
      )
    ) AS t(intent, category, text_raw, text_v3_lucas, text_v3_cleo, notes, branch_hints_json)
  LOOP
    INSERT INTO ivr_audio_scripts (company_id, voice_profile_id, intent, variation_key, category, text_raw, text_v3, notes, branch_hints)
    VALUES (v_company_id, v_lucas_id, rec.intent, 'v1', rec.category, rec.text_raw, rec.text_v3_lucas, rec.notes, rec.branch_hints_json::jsonb)
    ON CONFLICT (company_id, voice_profile_id, intent, variation_key) DO UPDATE SET
      category     = EXCLUDED.category,
      text_raw     = EXCLUDED.text_raw,
      text_v3      = EXCLUDED.text_v3,
      notes        = EXCLUDED.notes,
      branch_hints = EXCLUDED.branch_hints,
      updated_at   = now();

    INSERT INTO ivr_audio_scripts (company_id, voice_profile_id, intent, variation_key, category, text_raw, text_v3, notes, branch_hints)
    VALUES (v_company_id, v_cleo_id, rec.intent, 'v1', rec.category, rec.text_raw, rec.text_v3_cleo, rec.notes, rec.branch_hints_json::jsonb)
    ON CONFLICT (company_id, voice_profile_id, intent, variation_key) DO UPDATE SET
      category     = EXCLUDED.category,
      text_raw     = EXCLUDED.text_raw,
      text_v3      = EXCLUDED.text_v3,
      notes        = EXCLUDED.notes,
      branch_hints = EXCLUDED.branch_hints,
      updated_at   = now();
  END LOOP;
END
$objetivo$;

-- ------------------------------------------------------------
-- 5) Seed TRILIA — 23 intents × 2 vozes = 46 scripts
-- ------------------------------------------------------------
DO $trilia$
DECLARE
  v_company_id uuid := '131d9cba-d49c-44d5-a9b3-baa84d34bd96';
  v_lucas_id   uuid;
  v_cleo_id    uuid;
  rec record;
BEGIN
  SELECT id INTO v_lucas_id FROM voice_profiles WHERE voice_key = 'el-lucas-v3';
  SELECT id INTO v_cleo_id  FROM voice_profiles WHERE voice_key = 'el-cleo-v3';

  FOR rec IN
    SELECT * FROM (VALUES
      -- ===== A) OPENINGS POR SEGMENTO (5) =====
      (
        'opening_medicos_dentistas', 'opening',
        'Oi! Aqui é o Lucas, da Trilia. Trabalho com profissionais de saúde que querem se posicionar como autoridade e atrair o paciente certo, sem depender só de indicação. Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é o Lucas, da Trilia. [reassuring] Trabalho com profissionais de saúde que querem se posicionar como autoridade e atrair o paciente certo, [softly] sem depender só de indicação. [curious] Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é a Cléo, da Trilia. [reassuring] Trabalho com profissionais de saúde que querem se posicionar como autoridade e atrair o paciente certo, [softly] sem depender só de indicação. [curious] Posso te contar em trinta segundos?',
        'Abertura para médicos e dentistas.',
        '{"on_positive":"pitch_3_pilares","on_hesitant":"obj_no_time_1","on_negative":"goodbye_whats_no"}'
      ),
      (
        'opening_advogados_consultores', 'opening',
        'Oi! Aqui é o Lucas, da Trilia. Trabalho com profissionais como você que querem cobrar mais pelo que entregam e parar de competir com quem cobra mais barato. Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é o Lucas, da Trilia. [reassuring] Trabalho com profissionais como você que querem cobrar mais pelo que entregam [softly] e parar de competir com quem cobra mais barato. [curious] Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é a Cléo, da Trilia. [reassuring] Trabalho com profissionais como você que querem cobrar mais pelo que entregam [softly] e parar de competir com quem cobra mais barato. [curious] Posso te contar em trinta segundos?',
        'Abertura para advogados e consultores.',
        '{"on_positive":"pitch_3_pilares","on_hesitant":"obj_no_time_1","on_negative":"goodbye_whats_no"}'
      ),
      (
        'opening_donos_empresa', 'opening',
        'Oi! Aqui é o Lucas, da Trilia. Trabalho com donos de empresa que querem escalar sem precisar estar em tudo, com time comercial estruturado e cultura alinhada. Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é o Lucas, da Trilia. [reassuring] Trabalho com donos de empresa que querem escalar sem precisar estar em tudo, [softly] com time comercial estruturado e cultura alinhada. [curious] Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é a Cléo, da Trilia. [reassuring] Trabalho com donos de empresa que querem escalar sem precisar estar em tudo, [softly] com time comercial estruturado e cultura alinhada. [curious] Posso te contar em trinta segundos?',
        'Abertura para donos de empresa com equipe.',
        '{"on_positive":"pitch_3_pilares","on_hesitant":"obj_no_time_1","on_negative":"goodbye_whats_no"}'
      ),
      (
        'opening_estetica', 'opening',
        'Oi! Aqui é o Lucas, da Trilia. Trabalho com profissionais de estética que querem lotar a agenda com clientes de ticket maior, não só volume. Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é o Lucas, da Trilia. [reassuring] Trabalho com profissionais de estética que querem lotar a agenda com clientes de ticket maior, [softly] não só volume. [curious] Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é a Cléo, da Trilia. [reassuring] Trabalho com profissionais de estética que querem lotar a agenda com clientes de ticket maior, [softly] não só volume. [curious] Posso te contar em trinta segundos?',
        'Abertura para estética e beleza.',
        '{"on_positive":"pitch_3_pilares","on_hesitant":"obj_no_time_1","on_negative":"goodbye_whats_no"}'
      ),
      (
        'opening_generico', 'opening',
        'Oi! Aqui é o Lucas, da Trilia. Trabalho com donos de empresa que querem estruturar o comercial e vender mais sem depender de sorte. Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é o Lucas, da Trilia. [reassuring] Trabalho com donos de empresa que querem estruturar o comercial e vender mais [softly] sem depender de sorte. [curious] Posso te contar em trinta segundos?',
        '[warm] Oi! [softly] Aqui é a Cléo, da Trilia. [reassuring] Trabalho com donos de empresa que querem estruturar o comercial e vender mais [softly] sem depender de sorte. [curious] Posso te contar em trinta segundos?',
        'Abertura genérica (lista mista).',
        '{"on_positive":"pitch_3_pilares","on_hesitant":"obj_no_time_1","on_negative":"goodbye_whats_no"}'
      ),

      -- ===== B) PITCH 3 PILARES (1) =====
      (
        'pitch_3_pilares', 'pitch',
        'Então, a Trilia é uma consultoria que integra três pilares: processo comercial, posicionamento de marca e cultura de equipe. A gente não entrega só estratégia — implementa junto e acompanha por doze meses. Me conta, qual o maior desafio hoje na sua empresa: é mais vendas, como você se posiciona ou o time?',
        '[softly] Então, [warm] a Trilia é uma consultoria que integra três pilares: [excited] processo comercial, posicionamento de marca e cultura de equipe. [reassuring] A gente não entrega só estratégia... [softly] implementa junto e acompanha por doze meses. [curious] Me conta, qual o maior desafio hoje na sua empresa: [softly] é mais vendas, como você se posiciona ou o time?',
        '[softly] Então, [warm] a Trilia é uma consultoria que integra três pilares: [excited] processo comercial, posicionamento de marca e cultura de equipe. [reassuring] A gente não entrega só estratégia... [softly] implementa junto e acompanha por doze meses. [curious] Me conta, qual o maior desafio hoje na sua empresa: [softly] é mais vendas, como você se posiciona ou o time?',
        'Pitch principal após positivo na abertura — termina com pergunta de dor.',
        '{"on_pain":"transfer_to_sdr_offer","on_vague":"probe_crescer","on_negative":"goodbye_whats_no"}'
      ),

      -- ===== C) PROBE QUANDO LEAD VAGO (1) =====
      (
        'probe_crescer', 'probe',
        'Que bom! E quando você pensa em crescer nos próximos meses, onde sente que poderia ser melhor?',
        '[warm] Que bom! [softly] E quando você pensa em crescer nos próximos meses, [curious] onde sente que poderia ser melhor?',
        '[warm] Que bom! [softly] E quando você pensa em crescer nos próximos meses, [curious] onde sente que poderia ser melhor?',
        'Lead disse "tá tudo bem" — segunda tentativa de levantar dor.',
        '{"on_pain":"transfer_to_sdr_offer","on_vague":"goodbye_whats_no"}'
      ),

      -- ===== D) TRANSFERÊNCIA PRO SDR (2) =====
      (
        'transfer_to_sdr_offer', 'handoff',
        'Olha, pelo que você me falou acho que faz muito sentido você conversar com um dos nossos consultores. Ele vai entender melhor o seu momento e mostrar como a Trilia pode ajudar, sem compromisso. Posso te conectar agora com ele?',
        '[warm] Olha, pelo que você me falou acho que faz muito sentido você conversar com um dos nossos consultores. [reassuring] Ele vai entender melhor o seu momento e mostrar como a Trilia pode ajudar, [softly] sem compromisso. [curious] Posso te conectar agora com ele?',
        '[warm] Olha, pelo que você me falou acho que faz muito sentido você conversar com um dos nossos consultores. [reassuring] Ele vai entender melhor o seu momento e mostrar como a Trilia pode ajudar, [softly] sem compromisso. [curious] Posso te conectar agora com ele?',
        'Oferta de transferência ao SDR — quando lead declarou dor.',
        '{"on_positive":"transfer_confirm_connecting","on_hesitant":"obj_manda_whats","on_negative":"goodbye_whats_yes"}'
      ),
      (
        'transfer_confirm_connecting', 'close',
        'Perfeito! Vou te conectar agora com o nosso consultor. Um instante só, ele já vai falar com você. Valeu!',
        '[excited] Perfeito! [warm] Vou te conectar agora com o nosso consultor. [softly] Um instante só, [reassuring] ele já vai falar com você. Valeu!',
        '[excited] Perfeito! [warm] Vou te conectar agora com o nosso consultor. [softly] Um instante só, [reassuring] ele já vai falar com você. Valeu!',
        'Confirmação — transfere para SDR humano.',
        '{"terminal":true,"action":"transfer_sip"}'
      ),

      -- ===== E) OBJEÇÕES (9) =====
      (
        'obj_no_time_1', 'objection',
        'Entendo. São só dois minutinhos — você me ouve e decide se vale a pena. Se não fizer sentido, eu mesmo encerro a chamada. Pode ser?',
        '[warm] Entendo. [softly] São só dois minutinhos... [reassuring] você me ouve e decide se vale a pena. [softly] Se não fizer sentido, eu mesmo encerro a chamada. [curious] Pode ser?',
        '[warm] Entendo. [softly] São só dois minutinhos... [reassuring] você me ouve e decide se vale a pena. [softly] Se não fizer sentido, eu mesma encerro a chamada. [curious] Pode ser?',
        'Objeção "não tenho tempo agora".',
        '{"on_positive":"pitch_3_pilares","on_hesitant":"obj_me_liga_depois"}'
      ),
      (
        'obj_me_liga_depois', 'objection',
        'Claro! Posso deixar marcado. Só pra não perder o contato — posso te mandar um WhatsApp com as informações enquanto isso?',
        '[warm] Claro! [softly] Posso deixar marcado. [reassuring] Só pra não perder o contato... [curious] posso te mandar um WhatsApp com as informações enquanto isso?',
        '[warm] Claro! [softly] Posso deixar marcado. [reassuring] Só pra não perder o contato... [curious] posso te mandar um WhatsApp com as informações enquanto isso?',
        'Objeção "me liga depois / semana que vem".',
        '{"on_positive":"goodbye_whats_yes","on_negative":"goodbye_whats_no"}'
      ),
      (
        'obj_to_ocupado', 'objection',
        'Tudo bem! Fica à vontade. Posso te mandar um WhatsApp com mais informações da Trilia pra você avaliar quando tiver um momento?',
        '[warm] Tudo bem! [softly] Fica à vontade. [reassuring] Posso te mandar um WhatsApp com mais informações da Trilia [curious] pra você avaliar quando tiver um momento?',
        '[warm] Tudo bem! [softly] Fica à vontade. [reassuring] Posso te mandar um WhatsApp com mais informações da Trilia [curious] pra você avaliar quando tiver um momento?',
        'Objeção "tô ocupado".',
        '{"on_positive":"goodbye_whats_yes","on_negative":"goodbye_whats_no"}'
      ),
      (
        'obj_ja_tenho_consultoria', 'objection',
        'Entendo. O diferencial da Trilia é que a gente integra os três pilares juntos — comercial, marca e cultura — e implementa junto, não só orienta. Vale uma conversa rápida com nosso consultor pra você ver a diferença?',
        '[curious] Entendo. [warm] O diferencial da Trilia é que a gente integra os três pilares juntos — comercial, marca e cultura — [softly] e implementa junto, não só orienta. [reassuring] Vale uma conversa rápida com nosso consultor pra você ver a diferença?',
        '[curious] Entendo. [warm] O diferencial da Trilia é que a gente integra os três pilares juntos — comercial, marca e cultura — [softly] e implementa junto, não só orienta. [reassuring] Vale uma conversa rápida com nosso consultor pra você ver a diferença?',
        'Objeção "já tenho consultoria".',
        '{"on_positive":"transfer_to_sdr_offer","on_hesitant":"obj_manda_whats"}'
      ),
      (
        'obj_nao_conheco', 'objection',
        'Faz sentido, estamos crescendo. Já atendemos dezenas de empresas no seu segmento. O diagnóstico é gratuito — é a melhor forma de você ver o método na prática. Posso te conectar com o consultor?',
        '[softly] Faz sentido, [warm] estamos crescendo. [reassuring] Já atendemos dezenas de empresas no seu segmento. [softly] O diagnóstico é gratuito... [excited] é a melhor forma de você ver o método na prática. [curious] Posso te conectar com o consultor?',
        '[softly] Faz sentido, [warm] estamos crescendo. [reassuring] Já atendemos dezenas de empresas no seu segmento. [softly] O diagnóstico é gratuito... [excited] é a melhor forma de você ver o método na prática. [curious] Posso te conectar com o consultor?',
        'Objeção "não conheço a Trilia".',
        '{"on_positive":"transfer_to_sdr_offer","on_hesitant":"obj_manda_whats"}'
      ),
      (
        'obj_nao_preciso', 'objection',
        'Sem problema! Só pra entender — você já tem processo comercial rodando, estratégia de conteúdo e cultura de time definida? Se tiver tudo isso, realmente não precisa. Se não, vale dois minutinhos?',
        '[softly] Sem problema! [curious] Só pra entender... você já tem processo comercial rodando, estratégia de conteúdo e cultura de time definida? [warm] Se tiver tudo isso, realmente não precisa. [softly] Se não, [reassuring] vale dois minutinhos?',
        '[softly] Sem problema! [curious] Só pra entender... você já tem processo comercial rodando, estratégia de conteúdo e cultura de time definida? [warm] Se tiver tudo isso, realmente não precisa. [softly] Se não, [reassuring] vale dois minutinhos?',
        'Objeção "não preciso disso" — reframe com 3 pilares.',
        '{"on_pain":"transfer_to_sdr_offer","on_negative":"goodbye_whats_no"}'
      ),
      (
        'obj_manda_whats', 'objection',
        'Claro, posso mandar! Mas olha — o nosso consultor consegue entender muito melhor o seu momento numa conversa de dez minutinhos. Posso te conectar agora com ele?',
        '[warm] Claro, posso mandar! [softly] Mas olha... o nosso consultor consegue entender muito melhor o seu momento numa conversa de dez minutinhos. [curious] Posso te conectar agora com ele?',
        '[warm] Claro, posso mandar! [softly] Mas olha... o nosso consultor consegue entender muito melhor o seu momento numa conversa de dez minutinhos. [curious] Posso te conectar agora com ele?',
        'Lead pede "me manda no WhatsApp" — tenta SDR uma vez.',
        '{"on_positive":"transfer_confirm_connecting","on_negative":"goodbye_whats_yes"}'
      ),
      (
        'obj_voce_e_ia', 'objection',
        'Sou um assistente da Trilia. Mas posso te conectar agora com o nosso consultor que é quem vai realmente entender o seu negócio. Faz sentido?',
        '[softly] Sou um assistente da Trilia. [warm] Mas posso te conectar agora com o nosso consultor [reassuring] que é quem vai realmente entender o seu negócio. [curious] Faz sentido?',
        '[softly] Sou um assistente da Trilia. [warm] Mas posso te conectar agora com o nosso consultor [reassuring] que é quem vai realmente entender o seu negócio. [curious] Faz sentido?',
        'Lead pergunta "você é uma IA?" — assume e redireciona pro humano.',
        '{"on_positive":"transfer_to_sdr_offer","on_negative":"goodbye_whats_no"}'
      ),
      (
        'obj_preco', 'objection',
        'Isso o consultor explica na reunião, que é gratuita. A ideia aqui é ele entender seu momento e te mostrar como a gente pode ajudar. Posso te conectar?',
        '[softly] Isso o consultor explica na reunião, [warm] que é gratuita. [reassuring] A ideia aqui é ele entender seu momento e te mostrar como a gente pode ajudar. [curious] Posso te conectar?',
        '[softly] Isso o consultor explica na reunião, [warm] que é gratuita. [reassuring] A ideia aqui é ele entender seu momento e te mostrar como a gente pode ajudar. [curious] Posso te conectar?',
        'Lead pergunta preço — NUNCA falar valor na ligação.',
        '{"on_positive":"transfer_to_sdr_offer","on_negative":"goodbye_whats_no"}'
      ),

      -- ===== F) COMPLIANCE (1) =====
      (
        'how_got_number_trilia', 'compliance',
        'Seu contato ficou na nossa base de empresas do seu segmento. Mas posso te mandar no WhatsApp informações da Trilia pra você avaliar com calma?',
        '[softly] Seu contato ficou na nossa base de empresas do seu segmento. [warm] Mas posso te mandar no WhatsApp informações da Trilia [curious] pra você avaliar com calma?',
        '[softly] Seu contato ficou na nossa base de empresas do seu segmento. [warm] Mas posso te mandar no WhatsApp informações da Trilia [curious] pra você avaliar com calma?',
        'Lead pergunta "de onde veio meu número?".',
        '{"on_positive":"goodbye_whats_yes","on_negative":"goodbye_whats_no"}'
      ),

      -- ===== G) FECHAMENTOS (3) =====
      (
        'goodbye_whats_yes', 'goodbye',
        'Ótimo! Mando agora. Qualquer coisa, me chama.',
        '[excited] Ótimo! [warm] Mando agora. [softly] Qualquer coisa, me chama.',
        '[excited] Ótimo! [warm] Mando agora. [softly] Qualquer coisa, me chama.',
        'Lead aceitou receber WhatsApp — encerra com confirmação.',
        '{"terminal":true,"action":"send_whatsapp_followup"}'
      ),
      (
        'goodbye_whats_no', 'goodbye',
        'Beleza! Se precisar, nos chama. Boa sorte com a empresa!',
        '[warm] Beleza! [softly] Se precisar, nos chama. [reassuring] Boa sorte com a empresa!',
        '[warm] Beleza! [softly] Se precisar, nos chama. [reassuring] Boa sorte com a empresa!',
        'Lead recusou até o WhatsApp — encerra respeitoso.',
        '{"terminal":true}'
      ),
      (
        'goodbye_no_answer', 'goodbye',
        'Oi! Aqui é o Lucas da Trilia. Te liguei mas não consegui falar. Trabalho com donos de empresa que querem estruturar o comercial e vender mais. Se fizer sentido, me chama aqui!',
        '[warm] Oi! [softly] Aqui é o Lucas da Trilia. [reassuring] Te liguei mas não consegui falar. [softly] Trabalho com donos de empresa que querem estruturar o comercial e vender mais. [curious] Se fizer sentido, me chama aqui!',
        '[warm] Oi! [softly] Aqui é a Cléo da Trilia. [reassuring] Te liguei mas não consegui falar. [softly] Trabalho com donos de empresa que querem estruturar o comercial e vender mais. [curious] Se fizer sentido, me chama aqui!',
        'Mensagem pós-ligação sem atendimento (voice note / whats).',
        '{"terminal":true,"action":"send_voice_note"}'
      ),

      -- ===== H) TERCEIRA OBJEÇÃO (1) =====
      (
        'close_after_3_objections', 'goodbye',
        'Tudo bem! Respeito. Obrigado pelo tempo e bom dia!',
        '[softly] Tudo bem! [warm] Respeito. [reassuring] Obrigado pelo tempo e bom dia!',
        '[softly] Tudo bem! [warm] Respeito. [reassuring] Obrigada pelo tempo e bom dia!',
        'Após 3 objeções — encerra com educação, não insiste mais.',
        '{"terminal":true}'
      )
    ) AS t(intent, category, text_raw, text_v3_lucas, text_v3_cleo, notes, branch_hints_json)
  LOOP
    INSERT INTO ivr_audio_scripts (company_id, voice_profile_id, intent, variation_key, category, text_raw, text_v3, notes, branch_hints)
    VALUES (v_company_id, v_lucas_id, rec.intent, 'v1', rec.category, rec.text_raw, rec.text_v3_lucas, rec.notes, rec.branch_hints_json::jsonb)
    ON CONFLICT (company_id, voice_profile_id, intent, variation_key) DO UPDATE SET
      category     = EXCLUDED.category,
      text_raw     = EXCLUDED.text_raw,
      text_v3      = EXCLUDED.text_v3,
      notes        = EXCLUDED.notes,
      branch_hints = EXCLUDED.branch_hints,
      updated_at   = now();

    INSERT INTO ivr_audio_scripts (company_id, voice_profile_id, intent, variation_key, category, text_raw, text_v3, notes, branch_hints)
    VALUES (v_company_id, v_cleo_id, rec.intent, 'v1', rec.category, rec.text_raw, rec.text_v3_cleo, rec.notes, rec.branch_hints_json::jsonb)
    ON CONFLICT (company_id, voice_profile_id, intent, variation_key) DO UPDATE SET
      category     = EXCLUDED.category,
      text_raw     = EXCLUDED.text_raw,
      text_v3      = EXCLUDED.text_v3,
      notes        = EXCLUDED.notes,
      branch_hints = EXCLUDED.branch_hints,
      updated_at   = now();
  END LOOP;
END
$trilia$;

-- ------------------------------------------------------------
-- 6) Training examples — frases do lead que disparam cada intent
--    Usado pelo classificador semântico (edge function ivr-classify)
-- ------------------------------------------------------------

-- OBJETIVO training examples
WITH obj_examples(intent, phrases) AS (
  VALUES
    ('pitch_discount_15',            '["sim","pode falar","oi","opa","tudo bem","diz aí","pode sim","fala","fala aí","pode falar sim","manda","uhum","tô aqui"]'::jsonb),
    ('pitch_condicao_unica',         '["hmm","sei lá","meio que sim","tá bom","depende","não sei","pode ser","talvez","se for rápido","fala rápido"]'::jsonb),
    ('ask_what_is',                  '["o que é","que proteção","do que se trata","é o que","que condição","mas é o quê","que negócio é esse","do que vocês falam"]'::jsonb),
    ('ask_how_works',                '["como funciona","como é","me explica","o que cobre","funciona como","como que é","explica melhor","me conta como é"]'::jsonb),
    ('ask_vehicle_type_q',           '["tenho um veículo","tenho um automóvel","não sei","depende","tenho um","protege o quê","o que protege"]'::jsonb),
    ('benefit_carro',                '["carro","tenho um carro","é carro","meu carro","um hb20","civic","onix","gol","fiat","sedan","passeio","automóvel"]'::jsonb),
    ('benefit_moto',                 '["moto","uma moto","tenho moto","moto cb","honda","bros","scooter","motoneta"]'::jsonb),
    ('benefit_caminhao',             '["caminhão","volvo","scania","iveco","caminhão truck","caminhão pesado","mercedes","caminhonete grande"]'::jsonb),
    ('request_whatsapp_simple',      '[]'::jsonb),
    ('request_whatsapp_soft_insist', '["sei não","ah não sei","tô ocupado agora","não sei se quero","não entendi","tenho pressa"]'::jsonb),
    ('whatsapp_confirmation',        '["pode mandar","manda","sim","tá bom","ok manda","pode","beleza","uhum","tá","pode mandar sim","mandar","envia","envia aí","manda lá","fechado","perfeito"]'::jsonb),
    ('redirect_price_to_whats',      '["quanto custa","qual o valor","quanto tá","mas quanto é","qual o preço","tá quanto","é caro","quanto sai"]'::jsonb),
    ('redirect_howworks_to_whats',   '["como funciona","me explica melhor","como é","me conta","funciona como","quais as coberturas","o que inclui"]'::jsonb),
    ('redirect_think_to_whats',      '["preciso pensar","deixa eu ver","vou pensar","me dá um tempo","depois te falo","vou analisar","preciso conversar com","deixa eu consultar"]'::jsonb),
    ('obj_price',                    '["tá caro","caro","muito caro","não tenho esse dinheiro","passou do limite","fora do orçamento","é salgado","tá puxado","tá alto","não cabe","acho caro"]'::jsonb),
    ('obj_no_time',                  '["sem tempo","tô ocupado","não tenho tempo","agora não","tô trabalhando","não posso agora","tô correndo","em reunião","tô no serviço"]'::jsonb),
    ('obj_no_interest',              '["sem interesse","não tenho interesse","não me interessa","não curto","não quero saber","desinteressado","não preciso"]'::jsonb),
    ('obj_already_has',              '["já tenho seguro","tenho proteção","já faço com outro","já tô com bradesco","já tenho porto","já tenho carro protegido","tenho associação","já faço com outra"]'::jsonb),
    ('obj_no_want',                  '["não quero","não obrigado","para de ligar","não me liga mais","sai fora","não insiste","não quero nada","não me incomoda"]'::jsonb),
    ('how_got_number',               '["de onde veio meu número","como pegou meu telefone","quem te passou","onde conseguiu","como conseguiu","quem deu","onde você pegou","de onde tirou"]'::jsonb),
    ('goodbye_after_2_no',           '[]'::jsonb),
    ('goodbye_deixa_proxima',        '["deixa pra outra","talvez mais pra frente","agora não","outra hora","depois vejo","fica pra outro dia","fica pra próxima"]'::jsonb),
    ('goodbye_thanks',               '["pode mandar depois","blz valeu","obrigado","tá bom valeu","obrigadão","tudo certo","combinado","até mais"]'::jsonb),
    ('confusion_assume_yes',         '["que","hã","oi","como","ruído","inaudível","som","pode repetir"]'::jsonb),
    ('disambiguation_vehicle',       '["kkk","ah sei lá","não entendi","sei lá","como assim","que isso"]'::jsonb)
)
UPDATE ivr_audio_scripts ias
SET training_examples = e.phrases,
    updated_at = now()
FROM obj_examples e
WHERE ias.company_id = '70967469-9a9b-4e29-a744-410e41eb47a5'
  AND ias.intent = e.intent;

-- TRILIA training examples
WITH tri_examples(intent, phrases) AS (
  VALUES
    ('opening_medicos_dentistas',     '[]'::jsonb),
    ('opening_advogados_consultores', '[]'::jsonb),
    ('opening_donos_empresa',         '[]'::jsonb),
    ('opening_estetica',              '[]'::jsonb),
    ('opening_generico',              '[]'::jsonb),
    ('pitch_3_pilares',               '["pode falar","sim","pode sim","fala","diz aí","manda","tudo bem","uhum","pode contar","tô ouvindo"]'::jsonb),
    ('probe_crescer',                 '["tá tudo bem","tá ok","tá indo","tudo certo","sem problemas","tá legal","vai bem","bem obrigado","tá tranquilo"]'::jsonb),
    ('transfer_to_sdr_offer',         '["vendas","comercial","não vendo","equipe","time","marca","posicionamento","conteúdo","falta vender","preciso vender mais","equipe fraca","pouco cliente","dificuldade","tá difícil","reclamação","dor","problema"]'::jsonb),
    ('transfer_confirm_connecting',   '["sim","pode","beleza","pode conectar","conecta","pode chamar","tá bom","ok","fechado","pode ser"]'::jsonb),
    ('obj_no_time_1',                 '["sem tempo","não tenho tempo","tô ocupado","agora não","tô em reunião","tô trabalhando","não posso agora","tô correndo"]'::jsonb),
    ('obj_me_liga_depois',            '["me liga depois","liga semana que vem","liga mês que vem","me chama outra hora","liga na próxima semana","me retorna","depois me liga"]'::jsonb),
    ('obj_to_ocupado',                '["tô super ocupado","não dá agora","impossível agora","tô atolado","enterrado de trabalho","não consigo falar"]'::jsonb),
    ('obj_ja_tenho_consultoria',      '["já tenho consultoria","tenho consultor","já faço com outra","tenho mentor","tenho coach","já trabalho com alguém","já tenho contratado","tenho agência"]'::jsonb),
    ('obj_nao_conheco',               '["não conheço a trilia","nunca ouvi falar","quem é vocês","primeira vez que ouço","não conheço","é novo","nova empresa","estreante"]'::jsonb),
    ('obj_nao_preciso',               '["não preciso disso","tá tudo bem já","empresa vai bem","não tenho problema","tô bem assim","não necessito","tá tudo resolvido"]'::jsonb),
    ('obj_manda_whats',               '["me manda no whatsapp","manda no whats","me envia por whats","passa no whatsapp","manda por mensagem","manda informação","manda link"]'::jsonb),
    ('obj_voce_e_ia',                 '["você é ia","é robô","é humano","é pessoa","é real","é gravação","é bot","você é uma pessoa","tá falando com quem","é máquina"]'::jsonb),
    ('obj_preco',                     '["quanto custa","qual o valor","quanto é","quanto sai","tá quanto","qual o preço","é caro","investimento","mensalidade","qual o ticket"]'::jsonb),
    ('how_got_number_trilia',         '["de onde veio meu número","como pegou meu contato","quem te passou","onde conseguiu","de onde tirou","quem deu meu telefone"]'::jsonb),
    ('goodbye_whats_yes',             '["pode mandar","manda","pode","sim","tá bom","ok","beleza","combinado","tudo certo"]'::jsonb),
    ('goodbye_whats_no',              '["não quero","não obrigado","não precisa","deixa quieto","não manda","sem problema","sem chance","não me manda"]'::jsonb),
    ('goodbye_no_answer',             '[]'::jsonb),
    ('close_after_3_objections',      '[]'::jsonb)
)
UPDATE ivr_audio_scripts ias
SET training_examples = e.phrases,
    updated_at = now()
FROM tri_examples e
WHERE ias.company_id = '131d9cba-d49c-44d5-a9b3-baa84d34bd96'
  AND ias.intent = e.intent;

-- ------------------------------------------------------------
-- 7) View agregadora — árvore IVR por empresa
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_ivr_tree AS
SELECT
  c.id          AS company_id,
  c.name        AS company_name,
  vp.id         AS voice_profile_id,
  vp.voice_name,
  ias.category,
  ias.intent,
  ias.variation_key,
  ias.text_raw,
  ias.text_v3,
  ias.branch_hints,
  ias.audio_url,
  (ias.audio_url IS NOT NULL) AS rendered,
  ias.audio_duration_ms,
  ias.training_examples,
  ias.notes,
  ias.updated_at
FROM ivr_audio_scripts ias
JOIN companies       c  ON c.id  = ias.company_id
JOIN voice_profiles  vp ON vp.id = ias.voice_profile_id
WHERE ias.is_active
ORDER BY c.name, vp.voice_name, ias.category, ias.intent;

COMMENT ON TABLE ivr_audio_scripts IS
  'Árvore de intents IVR para handoff via voz. Cada linha é um áudio cacheável renderizado com ElevenLabs v3 (audio tags). branch_hints documenta transições esperadas.';

COMMIT;
