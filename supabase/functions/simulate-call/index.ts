/**
 * simulate-call
 * Simulador de ligação IA: recebe áudio do microfone → Whisper STT → Claude → Fish Audio TTS → retorna áudio
 * Usado pelo Simulador no painel Ligações IA
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Buscar configs
  const { data: configs } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", [
      "fish_audio_api_key", "fish_audio_model_alex",
      "openai_api_key", "anthropic_api_key"
    ]);

  const cfg: Record<string, string> = {};
  (configs || []).forEach((c: any) => { cfg[c.key] = c.value; });

  const contentType = req.headers.get("content-type") || "";

  // ── ACTION: text-to-speech (texto direto → áudio) ──────────────────────
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Iniciar simulação: retorna greeting em áudio
    if (action === "start") {
      const voiceKey = body.voice_key || "fish-alex";
      const script = body.script || "Boa tarde! Meu nome é Lucas da Objetivo. Posso falar rapidamente sobre proteção veicular?";
      const vendorName = body.vendor_name || "Lucas";
      const product = body.product || "Objetivo";

      // Buscar voice profile
      const { data: voice } = await supabase
        .from("voice_profiles")
        .select("voice_id")
        .eq("voice_key", voiceKey)
        .eq("active", true)
        .maybeSingle();

      const voiceId = voice?.voice_id || cfg["fish_audio_model_alex"];
      const fishKey = cfg["fish_audio_api_key"];

      if (!fishKey || !voiceId) {
        return new Response(
          JSON.stringify({ error: "TTS not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Gerar áudio do greeting
      const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${fishKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: script,
          reference_id: voiceId,
          format: "mp3",
          mp3_bitrate: 128,
          latency: "normal",
        }),
      });

      if (!ttsRes.ok) {
        return new Response(
          JSON.stringify({ error: `TTS failed: ${await ttsRes.text()}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const audioData = await ttsRes.arrayBuffer();
      const base64 = btoa(new Uint8Array(audioData).reduce((d, b) => d + String.fromCharCode(b), ""));

      return new Response(
        JSON.stringify({
          audio: base64,
          format: "mp3",
          text: script,
          role: "agent",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Responder a texto do usuário (modo texto)
    if (action === "respond") {
      const userText = body.text || "";
      const voiceKey = body.voice_key || "fish-alex";
      const context = body.context || {};
      const history = body.history || [];

      if (!userText) {
        return new Response(
          JSON.stringify({ error: "text is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar script de treinamento
      const { data: scripts } = await supabase
        .from("ai_call_scripts")
        .select("*")
        .eq("is_active", true)
        .limit(1);

      const script = scripts?.[0];

      // Montar system prompt baseado no treinamento
      const systemPrompt = buildSystemPrompt(script, context);

      // Chamar Claude
      const anthropicKey = cfg["anthropic_api_key"];
      if (!anthropicKey) {
        return new Response(
          JSON.stringify({ error: "Anthropic API key not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const messages = [
        ...history.map((h: any) => ({ role: h.role, content: h.text })),
        { role: "user", content: userText },
      ];

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: systemPrompt,
          messages,
        }),
      });

      if (!claudeRes.ok) {
        return new Response(
          JSON.stringify({ error: `Claude error: ${await claudeRes.text()}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const claudeData = await claudeRes.json();
      const agentText = claudeData.content?.[0]?.text || "Desculpe, não entendi.";

      // Gerar TTS
      const { data: voice } = await supabase
        .from("voice_profiles")
        .select("voice_id")
        .eq("voice_key", voiceKey)
        .eq("active", true)
        .maybeSingle();

      const voiceId = voice?.voice_id || cfg["fish_audio_model_alex"];
      const fishKey = cfg["fish_audio_api_key"];

      let audioBase64 = null;
      if (fishKey && voiceId) {
        const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${fishKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: agentText,
            reference_id: voiceId,
            format: "mp3",
            mp3_bitrate: 128,
            latency: "normal",
          }),
        });

        if (ttsRes.ok) {
          const audioData = await ttsRes.arrayBuffer();
          audioBase64 = btoa(new Uint8Array(audioData).reduce((d, b) => d + String.fromCharCode(b), ""));
        }
      }

      return new Response(
        JSON.stringify({
          text: agentText,
          audio: audioBase64,
          format: "mp3",
          role: "agent",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: start, respond" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Modo áudio: recebe gravação do microfone → STT → LLM → TTS ────────
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const voiceKey = (formData.get("voice_key") as string) || "fish-alex";
    const historyRaw = formData.get("history") as string;
    const contextRaw = formData.get("context") as string;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "audio file is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. STT via Whisper
    const openaiKey = cfg["openai_api_key"];
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sttForm = new FormData();
    sttForm.append("file", audioFile, "audio.webm");
    sttForm.append("model", "gpt-4o-mini-transcribe");
    sttForm.append("language", "pt");

    const sttRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}` },
      body: sttForm,
    });

    if (!sttRes.ok) {
      const errText = await sttRes.text();
      // Fallback to whisper-1 if gpt-4o-mini-transcribe fails
      const fallbackForm = new FormData();
      fallbackForm.append("file", audioFile, "audio.webm");
      fallbackForm.append("model", "whisper-1");
      fallbackForm.append("language", "pt");
      fallbackForm.append("prompt", "Conversa telefônica sobre proteção veicular, associação, carro, moto, cotação, preço.");

      const fallbackRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}` },
        body: fallbackForm,
      });

      if (!fallbackRes.ok) {
        return new Response(
          JSON.stringify({ error: `STT failed: ${errText}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      var sttData = await fallbackRes.json();
    } else {
      var sttData = await sttRes.json();
    }

    let userText = (sttData.text || "").trim();

    // Filtrar alucinações conhecidas do Whisper
    const hallucinations = [
      "legendas pela comunidade",
      "amara.org",
      "tradução e legendas",
      "transcrição automática",
      "obrigado por assistir",
      "inscreva-se no canal",
      "subtitles by",
    ];
    const lower = userText.toLowerCase();
    if (hallucinations.some(h => lower.includes(h)) || userText.length < 2) {
      return new Response(
        JSON.stringify({ error: "Não consegui entender o áudio. Tente falar mais alto e próximo ao microfone.", user_text: "", retry: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. LLM via Claude
    const history = historyRaw ? JSON.parse(historyRaw) : [];
    const context = contextRaw ? JSON.parse(contextRaw) : {};

    const { data: scripts } = await supabase
      .from("ai_call_scripts")
      .select("*")
      .eq("is_active", true)
      .limit(1);

    const systemPrompt = buildSystemPrompt(scripts?.[0], context);
    const anthropicKey = cfg["anthropic_api_key"];

    const messages = [
      ...history.map((h: any) => ({ role: h.role, content: h.text })),
      { role: "user", content: userText },
    ];

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: systemPrompt,
        messages,
      }),
    });

    const claudeData = await claudeRes.json();
    const agentText = claudeData.content?.[0]?.text || "Desculpe, poderia repetir?";

    // 3. TTS via Fish Audio
    const { data: voice } = await supabase
      .from("voice_profiles")
      .select("voice_id")
      .eq("voice_key", voiceKey)
      .eq("active", true)
      .maybeSingle();

    const voiceId = voice?.voice_id || cfg["fish_audio_model_alex"];
    const fishKey = cfg["fish_audio_api_key"];

    let audioBase64 = null;
    if (fishKey && voiceId) {
      const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${fishKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: agentText,
          reference_id: voiceId,
          format: "mp3",
          mp3_bitrate: 128,
          latency: "normal",
        }),
      });

      if (ttsRes.ok) {
        const audioData = await ttsRes.arrayBuffer();
        audioBase64 = btoa(new Uint8Array(audioData).reduce((d, b) => d + String.fromCharCode(b), ""));
      }
    }

    return new Response(
      JSON.stringify({
        user_text: userText,
        agent_text: agentText,
        audio: audioBase64,
        format: "mp3",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Invalid request" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

function buildSystemPrompt(script: any, context: any): string {
  const vendorName = context?.vendor_name || script?.vendor_name || "Lucas";
  const product = context?.product || script?.product || "proteção veicular";
  const tone = context?.tone || script?.tone || "semi-formal";
  const objective = context?.objective || script?.objective || "qualificar lead";
  const rules = script?.rules || "Nunca diga 'seguro', sempre use 'proteção veicular'. Não feche venda, apenas agende com consultor humano.";

  const objections = script?.objections || [];
  const objectionBlock = objections.map((o: any) =>
    `- Se disser "${o.objection}": ${o.response}`
  ).join("\n");

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
- Respostas CURTAS (1-3 frases). Você está ao telefone, não escrevendo um email.
- NUNCA quebre o personagem. Você é ${vendorName}, não uma IA.
- Demonstre empatia e escuta ativa.
- Se o lead demonstrar interesse, conduza para agendamento.
- Se o lead não tiver interesse, agradeça e encerre educadamente.`;
}
