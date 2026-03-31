/**
 * ai-simulator
 * Simulador de ligação IA: texto → LLM (Claude/OpenAI/Groq) → XTTS → retorna áudio
 * TTS via XTTS self-hosted (PC Gamer → tunnel VPS)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// XTTS endpoint via VPS tunnel (PC Gamer 192.168.0.206:8300 → VPS 134.122.17.106)
const XTTS_URL = Deno.env.get("XTTS_URL") || "http://134.122.17.106/api/tts";

type LLMProvider = "groq" | "openai" | "claude";

async function callLLM(
  provider: LLMProvider,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  cfg: Record<string, string>,
): Promise<string> {
  if (provider === "claude") {
    const key = cfg["anthropic_api_key"];
    if (!key) throw new Error("Anthropic API key not configured");

    const claudeMessages = messages.map((m) => ({
      role: m.role === "system" ? "user" : m.role,
      content: m.content,
    }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        temperature: 0.7,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!res.ok) throw new Error(`Claude error: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text || "Desculpe, não entendi.";
  }

  // OpenAI / Groq (same API format)
  const isGroq = provider === "groq";
  const key = isGroq ? cfg["groq_api_key"] : cfg["openai_api_key"];
  const url = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

  if (!key) throw new Error(`${provider} API key not configured`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!res.ok) throw new Error(`${provider} error: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não entendi.";
}

async function generateTTS(text: string): Promise<{ audio: string; format: string } | null> {
  try {
    const ttsRes = await fetch(XTTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "pt" }),
    });

    if (!ttsRes.ok) {
      console.error(`[XTTS] Error: ${ttsRes.status} ${await ttsRes.text()}`);
      return null;
    }

    const contentType = ttsRes.headers.get("content-type") || "";
    const audioData = await ttsRes.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(audioData).reduce((d, b) => d + String.fromCharCode(b), ""),
    );

    // XTTS returns WAV by default
    const format = contentType.includes("mpeg") ? "mp3" : "wav";
    return { audio: base64, format };
  } catch (err: any) {
    console.error(`[XTTS] Failed: ${err.message}`);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Buscar configs de API keys
  const { data: configs } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", [
      "openai_api_key",
      "anthropic_api_key",
      "groq_api_key",
    ]);

  const cfg: Record<string, string> = {};
  (configs || []).forEach((c: any) => {
    cfg[c.key] = c.value;
  });

  function getProvider(requested?: string): LLMProvider {
    if (requested === "claude" && cfg["anthropic_api_key"]) return "claude";
    if (requested === "openai" && cfg["openai_api_key"]) return "openai";
    if (requested === "groq" && cfg["groq_api_key"]) return "groq";
    if (cfg["groq_api_key"]) return "groq";
    if (cfg["openai_api_key"]) return "openai";
    if (cfg["anthropic_api_key"]) return "claude";
    return "groq";
  }

  function normalizeRole(role: string): string {
    if (["agent", "ai", "assistant"].includes(role)) return "assistant";
    return "user";
  }

  const contentType = req.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return new Response(
      JSON.stringify({ error: "Content-Type must be application/json" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const provider = getProvider(body.llm_provider);

  // ── ACTION: start — gera greeting inicial via XTTS ──
  if (action === "start") {
    const script =
      body.script ||
      "Boa tarde! Meu nome é Lucas da Objetivo. Posso falar rapidamente sobre proteção veicular?";

    const tts = await generateTTS(script);

    if (!tts) {
      return new Response(
        JSON.stringify({ error: "XTTS not available", text: script }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        audio: tts.audio,
        format: tts.format,
        text: script,
        role: "agent",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── ACTION: respond — texto do usuário → LLM → XTTS ──
  if (action === "respond") {
    const userText = body.text || "";
    const history = body.history || [];

    if (!userText) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const frontendPrompt = body.system_prompt;
    let systemPrompt: string;
    if (frontendPrompt) {
      systemPrompt = frontendPrompt;
    } else {
      const context = body.context || {};
      const { data: scripts } = await supabase
        .from("ai_call_scripts")
        .select("*")
        .eq("is_active", true)
        .limit(1);
      systemPrompt = buildSystemPrompt(scripts?.[0], context);
    }

    const messages = [
      ...history.map((h: any) => ({
        role: normalizeRole(h.role),
        content: h.text || h.content,
      })),
      { role: "user", content: userText },
    ];

    // LLM + TTS in parallel where possible
    const agentText = await callLLM(provider, systemPrompt, messages, cfg);
    const tts = await generateTTS(agentText);

    return new Response(
      JSON.stringify({
        text: agentText,
        response: agentText,
        audio: tts?.audio || null,
        format: tts?.format || "wav",
        role: "agent",
        llm_provider: provider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── ACTION: list-providers ──
  if (action === "list-providers") {
    const providers = [
      { id: "groq", name: "Groq (LLaMA 3.3 70B) - Rápido", available: !!cfg["groq_api_key"] },
      { id: "openai", name: "OpenAI (GPT-4o-mini)", available: !!cfg["openai_api_key"] },
      { id: "claude", name: "Claude (Sonnet 4) - Inteligente", available: !!cfg["anthropic_api_key"] },
    ];

    return new Response(
      JSON.stringify({ providers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ error: "Invalid action. Use: start, respond, list-providers" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

function buildSystemPrompt(script: any, context: any): string {
  const vendorName = context?.vendor_name || script?.vendor_name || "Lucas";
  const product = context?.product || script?.product || "proteção veicular";
  const tone = context?.tone || script?.tone || "semi-formal";
  const objective = context?.objective || script?.objective || "qualificar lead";
  const rules =
    script?.rules ||
    "Nunca diga 'seguro', sempre use 'proteção veicular'. Não feche venda, apenas agende com consultor humano.";

  const objections = script?.objections || [];
  const objectionBlock = objections
    .map((o: any) => `- Se disser "${o.objection}": ${o.response}`)
    .join("\n");

  return `Você é ${vendorName}, vendedor IA da Objetivo Proteção Veicular.
Você está em uma LIGAÇÃO TELEFÔNICA com um potencial cliente.

PRODUTO: ${product}
TOM: ${tone}
OBJETIVO: ${objective}

SCRIPT DE ABERTURA: ${script?.opening_script || "Boa tarde! Meu nome é " + vendorName + " e estou entrando em contato para falar sobre proteção veicular."}

SCRIPT DE DESENVOLVIMENTO: ${script?.development_script || "Quero entender seu momento e apresentar como funciona a proteção veicular."}

SCRIPT DE FECHAMENTO: ${script?.closing_script || "Posso agendar uma conversa rápida com um consultor humano?"}

OBJEÇÕES E RESPOSTAS:
${objectionBlock || "- Se disser 'já tenho seguro': Proteção veicular é diferente de seguro, mais acessível.\n- Se disser 'tá caro': Posso mostrar que cabe no bolso.\n- Se disser 'não tenho interesse': Sem problemas, em menos de um minuto explico a proposta."}

REGRAS:
${rules}

INSTRUÇÕES:
- Fale como uma pessoa REAL em uma ligação. Seja natural, use expressões coloquiais.
- Respostas naturais de 2-4 frases. Você está ao telefone, seja conversacional.
- NUNCA repita a saudação/abertura. Se já se apresentou, CONTINUE a conversa naturalmente.
- NUNCA quebre o personagem. Você é ${vendorName}, não uma IA.
- Demonstre empatia e escuta ativa.
- Se o lead demonstrar interesse, conduza para agendamento.
- Se o lead não tiver interesse, agradeça e encerre educadamente.
- IMPORTANTE: Se o histórico já tem mensagens, você JÁ se apresentou. Responda ao que o lead disse, não repita "Boa tarde".`;
}
