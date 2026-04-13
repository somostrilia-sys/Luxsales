#!/usr/bin/env node
/**
 * render-ivr-audios.mjs
 * Renderiza todos os ivr_audio_scripts ainda não renderizados usando
 * ElevenLabs v3 TTS e salva no bucket `ivr-audios` do Supabase Storage.
 *
 * Uso:
 *   ELEVENLABS_API_KEY=sk_... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/render-ivr-audios.mjs [--limit N] [--only intent_id] [--dry]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://ecaduzwautlpzpvjognr.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EL_KEY       = process.env.ELEVENLABS_API_KEY;
const EL_MODEL     = process.env.ELEVENLABS_MODEL ?? "eleven_v3";
const BUCKET       = "ivr-audios";
const DRY          = process.argv.includes("--dry");

if (!SERVICE_KEY) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!EL_KEY)      { console.error("Falta ELEVENLABS_API_KEY"); process.exit(1); }

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : Infinity;
const onlyArg = args.indexOf("--only");
const ONLY_INTENT = onlyArg >= 0 ? args[onlyArg + 1] : null;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchScripts() {
  let q = sb
    .from("ivr_audio_scripts")
    .select("id, company_id, voice_profile_id, intent, variation_key, text_v3, voice_settings, render_model, audio_url")
    .is("audio_url", null)
    .eq("is_active", true);
  if (ONLY_INTENT) q = q.eq("intent", ONLY_INTENT);
  const { data, error } = await q.order("intent");
  if (error) throw error;
  return data ?? [];
}

async function fetchVoice(voice_profile_id) {
  const { data, error } = await sb
    .from("voice_profiles")
    .select("voice_id, voice_settings, model, voice_name")
    .eq("id", voice_profile_id)
    .single();
  if (error) throw error;
  return data;
}

async function renderOne(script, voice) {
  const model = EL_MODEL || voice.model || "eleven_v3";
  const settings = { ...(voice.voice_settings ?? {}), ...(script.voice_settings ?? {}) };
  const body = {
    text: script.text_v3,
    model_id: model,
    voice_settings: {
      stability: settings.stability ?? 0.45,
      similarity_boost: settings.similarity_boost ?? 0.85,
      style: settings.style ?? 0.35,
      use_speaker_boost: settings.use_speaker_boost ?? true,
    },
  };
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": EL_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    // Fallback: se v3 falhar, tenta multilingual_v2
    if (res.status === 400 && model === "eleven_v3") {
      console.warn(`  ⚠ v3 recusado, fallback eleven_multilingual_v2...`);
      const res2 = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify({ ...body, model_id: "eleven_multilingual_v2" }),
      });
      if (!res2.ok) throw new Error(`fallback também falhou ${res2.status}: ${await res2.text()}`);
      return { bytes: new Uint8Array(await res2.arrayBuffer()), model_used: "eleven_multilingual_v2" };
    }
    throw new Error(`ElevenLabs ${res.status}: ${errText}`);
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), model_used: model };
}

async function uploadAudio(key, bytes) {
  const { error } = await sb.storage.from(BUCKET).upload(key, bytes, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

async function updateScript(id, audio_url, bytes, model_used) {
  const { error } = await sb.from("ivr_audio_scripts").update({
    audio_url,
    audio_bytes: bytes,
    audio_rendered_at: new Date().toISOString(),
    render_model: model_used,
  }).eq("id", id);
  if (error) throw error;
}

async function main() {
  console.log(`→ Buscando scripts não renderizados${ONLY_INTENT ? ` (intent=${ONLY_INTENT})` : ""}...`);
  const scripts = await fetchScripts();
  console.log(`→ ${scripts.length} scripts encontrados. Limit=${isFinite(LIMIT) ? LIMIT : "all"}. DRY=${DRY}`);

  const voiceCache = new Map();
  let ok = 0, fail = 0, skipped = 0;

  for (const s of scripts.slice(0, LIMIT)) {
    try {
      let voice = voiceCache.get(s.voice_profile_id);
      if (!voice) { voice = await fetchVoice(s.voice_profile_id); voiceCache.set(s.voice_profile_id, voice); }

      const key = `${s.company_id}/${s.voice_profile_id}/${s.intent}_${s.variation_key}.mp3`;
      console.log(`[${ok+fail+1}/${Math.min(scripts.length, LIMIT)}] ${voice.voice_name} · ${s.intent} (${s.text_v3.length}ch)`);

      if (DRY) { skipped++; continue; }

      const { bytes, model_used } = await renderOne(s, voice);
      const url = await uploadAudio(key, bytes);
      await updateScript(s.id, url, bytes.length, model_used);
      console.log(`  ✓ ${(bytes.length / 1024).toFixed(0)}KB · ${model_used} · ${url}`);
      ok++;
      await sleep(250); // rate-limit friendly
    } catch (err) {
      fail++;
      console.error(`  ✗ ${s.intent}: ${err.message}`);
      await sleep(1000);
    }
  }
  console.log(`\nResumo: ok=${ok} fail=${fail} skipped=${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
