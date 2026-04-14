/**
 * ivr-classify
 * Classificador semântico de transcrições do lead → intent IVR.
 *
 * Pipeline típico durante uma chamada:
 *   1. Deepgram Nova-3 transcreve a fala do lead
 *   2. Esta função mapeia transcript → intent_id usando Groq Llama 3.1 8B
 *      (few-shot com training_examples de cada intent)
 *   3. O LiveKit agent toca o áudio cacheado correspondente
 *   4. Se confidence < 0.55 → fallback_to_llm=true (rota LLM tradicional)
 *
 * Request:
 *   POST /ivr-classify
 *   {
 *     company_id:        uuid,
 *     voice_profile_id:  uuid,
 *     transcript:        string,          // fala do lead já transcrita
 *     current_intent?:   string,          // último intent emitido (contexto)
 *     turn_index?:       number,          // quantos turnos já rolaram
 *     objection_count?:  number           // quantas objeções já rolaram (pra forçar close_after_3)
 *   }
 *
 * Response:
 *   { intent_id, confidence, fallback_to_llm, audio_url?, text_raw?, branch_hints? }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse, json } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Provider: groq > openai > anthropic. Define IVR_PROVIDER pra forçar um.
const PROVIDER    = (Deno.env.get("IVR_PROVIDER") ?? pickDefaultProvider()).toLowerCase();
const CONF_THRESHOLD = parseFloat(Deno.env.get("IVR_CONF_THRESHOLD") ?? "0.55");

function pickDefaultProvider(): string {
  if (Deno.env.get("GROQ_API_KEY"))      return "groq";
  if (Deno.env.get("OPENAI_API_KEY"))    return "openai";
  if (Deno.env.get("ANTHROPIC_API_KEY")) return "anthropic";
  return "openai";
}

const PROVIDERS: Record<string, { url: string; key: string; model: string; authHeader: (k: string) => Record<string,string> }> = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: Deno.env.get("GROQ_API_KEY") ?? "",
    model: Deno.env.get("IVR_CLASSIFIER_MODEL") ?? "llama-3.1-8b-instant",
    authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    key: Deno.env.get("OPENAI_API_KEY") ?? "",
    model: Deno.env.get("IVR_CLASSIFIER_MODEL") ?? "gpt-4o-mini",
    authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    key: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
    model: Deno.env.get("IVR_CLASSIFIER_MODEL") ?? "claude-haiku-4-5-20251001",
    authHeader: (k) => ({ "x-api-key": k, "anthropic-version": "2023-06-01" }),
  },
};

type IntentRow = {
  intent: string;
  category: string;
  text_raw: string;
  audio_url: string | null;
  training_examples: string[];
  branch_hints: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const body = await req.json();
    const {
      company_id,
      voice_profile_id,
      transcript,
      current_intent,
      turn_index = 0,
      objection_count = 0,
    } = body ?? {};

    if (!company_id || !voice_profile_id || !transcript) {
      return json({ error: "company_id, voice_profile_id e transcript são obrigatórios" }, 400);
    }

    // Regra dura: 3 objeções → encerra (sobrepõe classificador)
    if (objection_count >= 3) {
      const hard = await loadIntent(company_id, voice_profile_id, "close_after_3_objections");
      if (hard) return json({ ...toResponse(hard), confidence: 1, reason: "hard_rule:objection_limit" });
    }

    // Carregar catálogo de intents disponíveis
    const { data: intents, error } = await supabase
      .from("ivr_audio_scripts")
      .select("intent, category, text_raw, audio_url, training_examples, branch_hints")
      .eq("company_id", company_id)
      .eq("voice_profile_id", voice_profile_id)
      .eq("is_active", true);

    if (error) return json({ error: error.message }, 500);
    if (!intents?.length) return json({ error: "nenhum intent encontrado" }, 404);

    const intentsArr = intents as IntentRow[];

    // 1) Consecutive-objection dedup: lead em modo negativo após obj_* → escalar pra goodbye
    //    (roda antes pra não ser pego pelo fast-match de outra objection).
    const objDedup = objectionDedup(transcript, current_intent, intentsArr, objection_count);
    if (objDedup) {
      return json({
        intent_id: objDedup.intent,
        category: objDedup.category,
        confidence: 0.9,
        fallback_to_llm: false,
        audio_url: objDedup.audio_url,
        text_raw: objDedup.text_raw,
        branch_hints: objDedup.branch_hints,
        reason: "objection_dedup",
      });
    }

    // 2) Short-response branching (PRIORIDADE): confirmações/negações curtas seguem
    //    branch_hints do current_intent. O blocklist interno evita capturar "é caro", "tá ocupado" etc.
    //    Roda ANTES do fast-match pra não ficar preso em loops de opening (opening_qualificacao ↔ opening_reativacao).
    const branchHit = shortResponseBranch(transcript, current_intent, intentsArr);
    if (branchHit) {
      return json({
        intent_id: branchHit.intent,
        category: branchHit.category,
        confidence: 0.88,
        fallback_to_llm: false,
        audio_url: branchHit.audio_url,
        text_raw: branchHit.text_raw,
        branch_hints: branchHit.branch_hints,
        reason: "short_response_branch",
      });
    }

    // 3) Fast-path: match exato por palavra em training_examples
    //    current_intent é excluído pra evitar loop.
    const fastMatch = fastKeywordMatch(transcript, intentsArr, current_intent);
    if (fastMatch) {
      const audio_url = fastMatch.audio_url;
      return json({
        intent_id: fastMatch.intent,
        category: fastMatch.category,
        confidence: 0.9,
        fallback_to_llm: false,
        audio_url,
        text_raw: fastMatch.text_raw,
        branch_hints: fastMatch.branch_hints,
        reason: "fast_keyword_match",
      });
    }

    // 4) LLM classifier (via provider configurado)
    const prompt = buildPrompt(transcript, intentsArr, current_intent, turn_index);
    const classified = await classifyWithLLM(prompt);

    const picked = intentsArr.find(i => i.intent === classified.intent_id);
    if (!picked || classified.confidence < CONF_THRESHOLD) {
      return json({
        intent_id: classified.intent_id,
        confidence: classified.confidence,
        fallback_to_llm: true,
        reason: `low_confidence_${classified.confidence.toFixed(2)}`,
      });
    }

    return json({
      intent_id: picked.intent,
      category: picked.category,
      confidence: classified.confidence,
      fallback_to_llm: false,
      audio_url: picked.audio_url,
      text_raw: picked.text_raw,
      branch_hints: picked.branch_hints,
      reason: "groq_llm_classified",
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** normaliza string: lowercase, sem acento, sem pontuação extra */
function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resposta curta tipo "sim"/"não"/"pode" segue branch_hints do intent atual.
 *  Evita loops e respeita o fluxo narrativo da árvore IVR.
 *  Ativa só quando: (1) há current_intent, (2) transcript tem ≤4 tokens, (3) match claro com um dos buckets. */
function shortResponseBranch(
  transcript: string,
  currentIntent: string | undefined | null,
  intents: IntentRow[],
): IntentRow | null {
  if (!currentIntent) return null;
  const t = norm(transcript);
  if (!t) return null;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;

  const POSITIVE = new Set([
    "sim","s","positivo","pode","claro","fechou","beleza","blz","manda","bora","tá","ta","tudo bem","tudo","vamo","vamos","certo","ok","okay","isso","exato","exatamente","uhum","aham","perfeito","show","dale","firmeza","tranquilo","com certeza","ótimo","otimo","legal","massa","afirmativo","combinado","concordo","dito","pode sim","pode mandar","pode falar","fala","diz","diga","continua","continue","manda bala","manda ver","manda a real","confirmado","oi","ei","eae","e ae","opa","ola","olá","alô","alo","bom dia","boa tarde","boa noite",
  ]);
  const NEGATIVE = new Set([
    "não","nao","n","nada","nem","nop","não quero","nao quero","agora não","agora nao","outro dia","depois","mais tarde","só depois","so depois","pra frente","deixa","dispenso","dispensa","recuso","negativo","nega","jamais","nunca","esquece","deixa pra lá","deixa la","de jeito nenhum","sem chance","passa","não obrigado","nao obrigado","valeu mas não","valeu mas nao","não curti","nao curti","não tenho","nao tenho",
  ]);
  const HESITANT = new Set([
    "talvez","sei lá","sei la","pode ser","não sei","nao sei","acho que","meio","mais ou menos","depende","hmm","ahn","quem sabe",
  ]);
  const DETAILS = new Set([
    "como","como assim","me explica","explica","detalhes","mais info","fala mais","conta mais","quanto","qual","onde","quando","como funciona","detalha","me conta",
  ]);

  // Blocklist: se a fala contém claim/objeção ("caro", "problema", etc), NÃO tratar como resposta
  // curta — deixa fast-match ou LLM resolver a intent correta.
  const OBJECTION_SIGNALS = /\b(car[oa]|difícil|dificil|problema|complicado|apertad|pesado|desconfi|golpe|outro\s?seguro|ja\s?tenho|muito\s?caro|muito\s?dinheiro|precinh|inflaciona|roubou|mentira|fraud|propagand|boleto|sem\s?dinheiro|nao\s?dá|não\s?dá|ja\s?tenho|ocupad|tempo\s?ruim)/i;
  if (OBJECTION_SIGNALS.test(t)) return null;

  const hitAll = (set: Set<string>) => words.some(w => set.has(w)) || set.has(t);
  const isPositive = hitAll(POSITIVE);
  const isNegative = hitAll(NEGATIVE);
  const isHesitant = hitAll(HESITANT);
  const isDetails  = hitAll(DETAILS);

  if (!(isPositive || isNegative || isHesitant || isDetails)) return null;

  const current = intents.find(i => i.intent === currentIntent);
  if (!current?.branch_hints) return null;
  const bh = current.branch_hints as Record<string, string | boolean>;

  // Prioridade: details > positive > hesitant > negative
  const pickKey = (): string | null => {
    if (isDetails  && typeof bh.on_details  === "string") return bh.on_details;
    if (isPositive && typeof bh.on_positive === "string") return bh.on_positive;
    if (isHesitant && typeof bh.on_hesitant === "string") return bh.on_hesitant;
    if (isNegative && typeof bh.on_negative === "string") return bh.on_negative;
    return null;
  };
  const targetIntent = pickKey();
  if (!targetIntent) return null;

  const picked = intents.find(i => i.intent === targetIntent);
  return picked ?? null;
}

/** Após uma objection, se o lead continuar negativo/resistente, não re-aplicar obj_*:
 *  escalar pra `goodbye_after_2_no` / `close_after_3_objections` baseado no contador. */
function objectionDedup(
  transcript: string,
  currentIntent: string | undefined | null,
  intents: IntentRow[],
  objectionCount: number,
): IntentRow | null {
  if (!currentIntent?.startsWith("obj_")) return null;
  const t = norm(transcript);
  if (!t) return null;
  const NEG_TOKENS = /\b(n[ãa]o|nada|nem|sem|negativ|depois|agora n[ãa]o|desist|deixa|dispens|pass)/;
  if (!NEG_TOKENS.test(t)) return null;

  // 2ª negativa → goodbye_after_2_no (se existir), senão deixa fluxo normal
  if (objectionCount >= 2) {
    const esc = intents.find(i => i.intent === "close_after_3_objections")
             ?? intents.find(i => i.intent === "goodbye_after_2_no")
             ?? intents.find(i => i.intent === "goodbye_deixa_proxima")
             ?? intents.find(i => i.intent === "goodbye_whats_no");
    return esc ?? null;
  }
  return null;
}

/** Fast-path conservador: só dispara se match é inequívoco (>=8 chars + word-boundary).
 *  currentIntent, se fornecido, é ignorado como candidato pra evitar que o lead fique
 *  preso no mesmo nó quando responde confirmações tipo "sim"/"pode falar" (training_examples
 *  compartilhados por múltiplos intents).
 */
function fastKeywordMatch(transcript: string, intents: IntentRow[], currentIntent?: string | null): IntentRow | null {
  const FAST_MIN_LEN = 8;
  const t = norm(transcript);
  if (!t) return null;
  let best: { row: IntentRow; score: number } | null = null;

  for (const row of intents) {
    if (currentIntent && row.intent === currentIntent) continue;
    const examples = Array.isArray(row.training_examples) ? row.training_examples : [];
    for (const ex of examples) {
      const n = norm(ex);
      if (!n || n.length < FAST_MIN_LEN) continue;
      const pattern = new RegExp(`(^|\\s)${escapeRe(n)}(\\s|$)`);
      if (pattern.test(t)) {
        const score = n.length;
        if (!best || score > best.score) best = { row, score };
      }
    }
  }
  return best?.row ?? null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPrompt(
  transcript: string,
  intents: IntentRow[],
  currentIntent?: string,
  turnIndex?: number,
): string {
  const catalog = intents
    .map(i => {
      const ex = Array.isArray(i.training_examples) ? i.training_examples.slice(0, 6) : [];
      const exStr = ex.length ? ` — ex: ${ex.map(e => `"${e}"`).join(", ")}` : "";
      return `- ${i.intent} (${i.category}): agent diz "${i.text_raw.substring(0, 120)}"${exStr}`;
    })
    .join("\n");

  return `Você é um classificador de intents IVR pra um agente de voz em português brasileiro.

CONTEXTO DA CONVERSA:
- Último intent emitido pelo agente: ${currentIntent ?? "nenhum (início)"}
- Turno atual: ${turnIndex ?? 0}

CATÁLOGO DE INTENTS DISPONÍVEIS:
${catalog}

FALA DO LEAD (transcrita do áudio):
"${transcript}"

TAREFA:
Classifique a fala do lead no intent mais apropriado do catálogo.
- Considere paráfrases, gírias, abreviações, fala coloquial brasileira.
- Use o CONTEXTO (último intent) para desambiguar.
- Confidence de 0.0 a 1.0. Use < 0.55 apenas se realmente incerto.

Responda SOMENTE um JSON no formato:
{"intent_id":"nome_do_intent","confidence":0.85,"reasoning":"breve"}`;
}

async function classifyWithLLM(prompt: string): Promise<{ intent_id: string; confidence: number }> {
  const p = PROVIDERS[PROVIDER];
  if (!p?.key) throw new Error(`Provider ${PROVIDER} sem API key`);

  const systemMsg = "Você responde APENAS JSON válido. Sem markdown, sem texto fora do JSON.";
  let body: Record<string, unknown>;
  if (PROVIDER === "anthropic") {
    body = {
      model: p.model,
      system: systemMsg,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.1,
    };
  } else {
    // groq + openai — compatíveis OpenAI API
    body = {
      model: p.model,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user",   content: prompt     },
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: "json_object" },
    };
  }

  const res = await fetch(p.url, {
    method: "POST",
    headers: { ...p.authHeader(p.key), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${PROVIDER} error ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const raw = PROVIDER === "anthropic"
    ? (data?.content?.[0]?.text ?? "{}")
    : (data?.choices?.[0]?.message?.content ?? "{}");

  const parsed = tryParseJson(raw);
  return {
    intent_id: String(parsed.intent_id ?? "unknown"),
    confidence: Number.isFinite(parsed.confidence) ? Number(parsed.confidence) : 0,
  };
}

function tryParseJson(s: string): any {
  try { return JSON.parse(s); }
  catch {
    // tenta extrair JSON de dentro de markdown ```json ... ```
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall */ } }
    return {};
  }
}

async function loadIntent(
  company_id: string,
  voice_profile_id: string,
  intent: string,
): Promise<IntentRow | null> {
  const { data } = await supabase
    .from("ivr_audio_scripts")
    .select("intent, category, text_raw, audio_url, training_examples, branch_hints")
    .eq("company_id", company_id)
    .eq("voice_profile_id", voice_profile_id)
    .eq("intent", intent)
    .maybeSingle();
  return (data as IntentRow) ?? null;
}

function toResponse(row: IntentRow) {
  return {
    intent_id: row.intent,
    category: row.category,
    fallback_to_llm: false,
    audio_url: row.audio_url,
    text_raw: row.text_raw,
    branch_hints: row.branch_hints,
  };
}
