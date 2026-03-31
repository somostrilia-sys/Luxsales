/**
 * make-call
 * Inicia uma ligação telefônica via VAPI AI
 * Actions: dial, test-voice, status, hangup
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getConfigs(supabase: any, keys: string[]): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", keys);
  const cfg: Record<string, string> = {};
  (data || []).forEach((c: any) => { cfg[c.key] = c.value; });
  return cfg;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (!action) {
    return jsonResponse({ error: "action required: dial, test-voice, status, hangup" }, 400);
  }

  // ── TEST-VOICE: gera áudio TTS com Fish Audio ─────────────────────────
  if (action === "test-voice") {
    const voiceKey = body.voice_key || "fish-alex";
    const text = body.text || body.script || "Boa tarde! Meu nome é Lucas e estou entrando em contato para falar sobre proteção veicular.";

    const cfg = await getConfigs(supabase, ["fish_audio_api_key"]);

    const { data: voice } = await supabase
      .from("voice_profiles")
      .select("voice_id")
      .eq("voice_key", voiceKey)
      .eq("active", true)
      .maybeSingle();

    const fishKey = cfg["fish_audio_api_key"];
    const voiceId = voice?.voice_id;

    if (!fishKey || !voiceId) {
      return jsonResponse({ error: "Voice not configured" }, 500);
    }

    const ttsRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${fishKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 1000),
        reference_id: voiceId,
        format: "mp3",
        mp3_bitrate: 128,
        latency: "normal",
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      return jsonResponse({ error: `TTS failed: ${err}` }, 502);
    }

    const audioData = await ttsRes.arrayBuffer();
    const base64 = btoa(new Uint8Array(audioData).reduce((d, b) => d + String.fromCharCode(b), ""));

    return jsonResponse({ audio: base64, format: "mp3", voice: voiceKey, text });
  }

  // ── DIAL: inicia uma ligação real via VAPI ─────────────────────────────
  if (action === "dial") {
    const toNumber = body.to || body.phone_number;
    const voiceKey = body.voice_key || "fish-alex";
    const openingScript = body.opening_script || null;
    const systemPrompt = body.system_prompt || null;
    const companyId = body.company_id || null;
    const campaignId = body.campaign_id || null;

    if (!toNumber) {
      return jsonResponse({ error: "to (phone number in E.164 format) is required" }, 400);
    }

    // Normalizar número para E.164
    let e164 = toNumber.replace(/\D/g, "");
    if (!e164.startsWith("+")) {
      if (e164.length === 11) e164 = "+55" + e164;
      else if (e164.length === 13 && e164.startsWith("55")) e164 = "+" + e164;
      else e164 = "+" + e164;
    } else {
      e164 = toNumber;
    }

    // Buscar configs do VAPI
    const cfg = await getConfigs(supabase, [
      "vapi_api_key",
      "vapi_assistant_id",
      "vapi_phone_number_id",
      "fish_audio_api_key",
      "fish_audio_model_alex",
    ]);

    const vapiKey = cfg["vapi_api_key"];
    const assistantId = cfg["vapi_assistant_id"];
    const phoneNumberId = cfg["vapi_phone_number_id"];

    if (!vapiKey || !assistantId || !phoneNumberId) {
      return jsonResponse({
        error: "VAPI não configurado",
        detail: "Configure vapi_api_key, vapi_assistant_id e vapi_phone_number_id em system_configs",
        missing: [
          ...(!vapiKey ? ["vapi_api_key"] : []),
          ...(!assistantId ? ["vapi_assistant_id"] : []),
          ...(!phoneNumberId ? ["vapi_phone_number_id"] : []),
        ],
      }, 400);
    }

    // Montar payload VAPI com assistant inline (garante que overrides são aplicados)
    const defaultPrompt = "Você é um vendedor IA brasileiro. Fale em português brasileiro natural. Respostas curtas de 2-4 frases.";
    const vapiPayload: any = {
      phoneNumberId,
      customer: { number: e164 },
      assistant: {
        name: "Lucas - Vendedor IA",
        firstMessage: openingScript || "Boa tarde! Meu nome é Lucas. Posso falar rapidamente?",
        model: {
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          messages: [{ role: "system", content: systemPrompt || defaultPrompt }],
        },
        voice: {
          provider: "custom-voice",
          server: {
            url: Deno.env.get("SUPABASE_URL") + "/functions/v1/vapi-tts-webhook",
          },
        },
        transcriber: {
          provider: "deepgram",
          model: "nova-3",
          language: "pt-BR",
        },
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 300,
        endCallMessage: "Muito obrigado pelo seu tempo! Tenha um ótimo dia!",
      },
    };

    // Chamar VAPI
    const vapiRes = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vapiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiPayload),
    });

    const vapiData = await vapiRes.json().catch(() => null);

    if (!vapiRes.ok) {
      return jsonResponse({
        error: "VAPI call failed",
        detail: vapiData?.message || vapiData?.error || `HTTP ${vapiRes.status}`,
        vapi_response: vapiData,
      }, 502);
    }

    const vapiCallId = vapiData?.id || vapiData?.callId || null;

    // Registrar chamada no banco
    const { data: call, error: callErr } = await supabase
      .from("calls")
      .insert({
        company_id: companyId,
        campaign_id: campaignId,
        destination_number: e164,
        direction: "outbound",
        status: "initiated",
        vapi_call_id: vapiCallId,
      })
      .select()
      .single();

    if (callErr) {
      // Chamada VAPI já foi feita, mas erro ao salvar — retornar mesmo assim
      return jsonResponse({
        success: true,
        call_id: null,
        vapi_call_id: vapiCallId,
        warning: `Call started but DB save failed: ${callErr.message}`,
      });
    }

    return jsonResponse({
      success: true,
      call_id: call.id,
      vapi_call_id: vapiCallId,
      status: "initiated",
      phone_number: e164,
      voice: voiceKey,
    });
  }

  // ── STATUS: consulta status de uma chamada ─────────────────────────────
  if (action === "status") {
    const callId = body.call_id;
    const vapiCallId = body.vapi_call_id;

    if (!callId && !vapiCallId) {
      return jsonResponse({ error: "call_id or vapi_call_id required" }, 400);
    }

    // Se tem vapi_call_id, consultar VAPI diretamente
    if (vapiCallId) {
      const cfg = await getConfigs(supabase, ["vapi_api_key"]);
      const vapiKey = cfg["vapi_api_key"];
      if (!vapiKey) {
        return jsonResponse({ error: "vapi_api_key not configured" }, 500);
      }

      const vapiRes = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${vapiKey}` },
      });

      const vapiData = await vapiRes.json().catch(() => null);
      if (!vapiRes.ok) {
        return jsonResponse({ error: "VAPI status failed", detail: vapiData }, 502);
      }

      // Atualizar status local se temos call_id
      if (callId) {
        await supabase
          .from("calls")
          .update({ status: vapiData?.status || "unknown", metadata: vapiData })
          .eq("id", callId);
      }

      return jsonResponse({ vapi_call_id: vapiCallId, ...vapiData });
    }

    // Fallback: buscar do banco local
    const { data: call } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .single();

    return jsonResponse(call || { error: "Call not found" });
  }

  // ── HANGUP: encerra chamada ────────────────────────────────────────────
  if (action === "hangup") {
    const callId = body.call_id;
    const vapiCallId = body.vapi_call_id;

    if (!callId && !vapiCallId) {
      return jsonResponse({ error: "call_id or vapi_call_id required" }, 400);
    }

    // Se tem vapi_call_id, encerrar no VAPI
    if (vapiCallId) {
      const cfg = await getConfigs(supabase, ["vapi_api_key"]);
      const vapiKey = cfg["vapi_api_key"];
      if (vapiKey) {
        const vapiRes = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${vapiKey}` },
        });
        // VAPI pode usar DELETE ou POST com hangup — tentamos DELETE primeiro
        if (!vapiRes.ok) {
          // Fallback: POST hangup
          await fetch(`https://api.vapi.ai/call/${vapiCallId}/hangup`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${vapiKey}`,
              "Content-Type": "application/json",
            },
          });
        }
      }
    }

    // Atualizar banco local
    if (callId) {
      await supabase
        .from("calls")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", callId);
    }

    return jsonResponse({ status: "completed", call_id: callId, vapi_call_id: vapiCallId });
  }

  return jsonResponse({ error: "Invalid action" }, 400);
});
