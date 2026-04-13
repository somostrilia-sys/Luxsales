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

    // 1) Fast-path: match exato por palavra em training_examples
    const fastMatch = fastKeywordMatch(transcript, intents as IntentRow[]);
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

    // 2) LLM classifier (via provider configurado)
    const prompt = buildPrompt(transcript, intents as IntentRow[], current_intent, turn_index);
    const classified = await classifyWithLLM(prompt);

    const picked = (intents as IntentRow[]).find(i => i.intent === classified.intent_id);
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

/** Fast-path conservador: só dispara se match é inequívoco (>=8 chars + word-boundary). */
function fastKeywordMatch(transcript: string, intents: IntentRow[]): IntentRow | null {
  const FAST_MIN_LEN = 8;
  const t = norm(transcript);
  if (!t) return null;
  let best: { row: IntentRow; score: number } | null = null;

  for (const row of intents) {
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
