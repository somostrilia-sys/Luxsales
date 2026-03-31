/**
 * vapi-tts-webhook
 * Endpoint custom TTS para Vapi.ai usando Fish Audio
 * Vapi envia texto → chamamos Fish Audio → retornamos PCM raw
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FISH_AUDIO_API = "https://api.fish.audio/v1/tts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Buscar configs
  const { data: configs } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", ["fish_audio_api_key", "fish_audio_model_alex"]);

  const cfg: Record<string, string> = {};
  (configs || []).forEach((c: any) => { cfg[c.key] = c.value; });

  const fishApiKey = cfg["fish_audio_api_key"];
  const fishModelId = cfg["fish_audio_model_alex"];

  if (!fishApiKey || !fishModelId) {
    return new Response("TTS not configured", { status: 500 });
  }

  // Parse Vapi request
  const body = await req.json().catch(() => ({}));

  // Vapi envia: { message: { type: "say", content: "texto..." }, ... }
  // ou formato direto: { text: "..." }
  const text = body?.message?.content || body?.text || body?.input || "";

  if (!text) {
    return new Response("No text provided", { status: 400 });
  }

  // Chamar Fish Audio com formato PCM (linear16)
  const fishResponse = await fetch(FISH_AUDIO_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${fishApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text.slice(0, 200),
      reference_id: fishModelId,
      format: "pcm",
      pcm_sample_rate: 24000,
      pcm_bit_depth: 16,
      latency: "low",
    }),
  });

  if (!fishResponse.ok) {
    const err = await fishResponse.text();
    console.error(`Fish Audio error: ${fishResponse.status} ${err}`);
    return new Response(`TTS error: ${err}`, { status: 502 });
  }

  // Retornar PCM raw com headers corretos pro Vapi
  const audioData = await fishResponse.arrayBuffer();

  return new Response(audioData, {
    status: 200,
    headers: {
      "Content-Type": "audio/pcm",
      "X-Sample-Rate": "24000",
      "X-Channels": "1",
      "X-Bits-Per-Sample": "16",
    },
  });
});
