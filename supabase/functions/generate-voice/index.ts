/**
 * generate-voice
 * Gera áudio TTS via Fish Audio API
 * Actions: list-voices, generate
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FISH_AUDIO_API = "https://api.fish.audio/v1/tts";

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

  const body = await req.json().catch(() => ({}));
  // Auto-detect action: if text + voice_key present, it's a generate request
  const action = body?.action || (body?.text && (body?.voice_key || body?.voice_id) ? "generate" : "list-voices");

  if (action === "list-voices") {
    const { data: voices } = await supabase
      .from("voice_profiles")
      .select("voice_key, voice_id, voice_name, gender, description, provider, speed")
      .eq("active", true)
      .order("voice_name");

    const formatted = (voices || []).map((v: any) => ({
      key: v.voice_key,
      id: v.voice_id,
      name: v.voice_name,
      gender: v.gender,
      description: v.description,
      provider: v.provider,
      speed: v.speed,
    }));

    return new Response(
      JSON.stringify({ voices: formatted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const text = body?.text || "";
  const voiceKey = body?.voice_key || "";

  if (!text) {
    return new Response(
      JSON.stringify({ error: "text is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: voice } = await supabase
    .from("voice_profiles")
    .select("voice_key, voice_id, voice_name, provider, speed")
    .eq("voice_key", voiceKey)
    .eq("active", true)
    .maybeSingle();

  if (!voice) {
    const { data: allVoices } = await supabase
      .from("voice_profiles")
      .select("voice_key")
      .eq("active", true);
    const keys = (allVoices || []).map((v: any) => v.voice_key).join(", ");
    return new Response(
      JSON.stringify({ error: `Invalid voice_key. Options: ${keys}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: cfg } = await supabase
    .from("system_configs")
    .select("value")
    .eq("key", "fish_audio_api_key")
    .maybeSingle();

  const fishApiKey = cfg?.value;
  if (!fishApiKey) {
    return new Response(
      JSON.stringify({ error: "Fish Audio API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const fishResponse = await fetch(FISH_AUDIO_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${fishApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 1000),
        reference_id: voice.voice_id,
        format: "mp3",
        mp3_bitrate: 128,
        latency: "normal",
      }),
    });

    if (!fishResponse.ok) {
      const err = await fishResponse.text();
      return new Response(
        JSON.stringify({ error: `TTS generation failed: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioData = await fishResponse.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(audioData).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    return new Response(
      JSON.stringify({
        audio: base64Audio,
        format: "mp3",
        voice: voice.voice_name,
        provider: voice.provider,
        text_length: text.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `TTS exception: ${String(err)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
