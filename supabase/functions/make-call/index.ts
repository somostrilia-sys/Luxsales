/**
 * make-call
 * Inicia uma ligação telefônica via LiveKit Voice Agent (self-hosted)
 * Actions: dial, status, hangup
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// LiveKit Call API via tunnel (PC Gamer → VPS → edge function)
const CALL_API_URL = Deno.env.get("LIVEKIT_CALL_API_URL") || "http://localhost:3003";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    return jsonResponse({ error: "action required: dial, status, hangup" }, 400);
  }

  // ── DIAL: inicia uma ligação via LiveKit ─────────────────────────────
  if (action === "dial") {
    const toNumber = body.to || body.phone_number;
    const companyId = body.company_id || null;
    const campaignId = body.campaign_id || null;
    const leadId = body.lead_id || null;
    const consultorId = body.consultor_id || body.consultant_id || null;
    const route = body.route === "ivr" ? "ivr" : null;
    let voiceProfileId = body.voice_profile_id || null;
    let voiceId = body.voice_id || null;
    let voiceName = body.voice_name || null;

    if (!toNumber) {
      return jsonResponse({ error: "to (phone number) is required" }, 400);
    }

    // Buscar voice profile pra pegar gender (pra definir nome do vendedor)
    let voiceGender: string | null = null;

    if (voiceProfileId && !voiceId) {
      const { data: vp } = await supabase
        .from("voice_profiles")
        .select("voice_id, voice_name, provider, gender")
        .eq("id", voiceProfileId)
        .eq("active", true)
        .maybeSingle();
      if (vp) {
        voiceId = vp.voice_id;
        voiceName = vp.voice_name;
        voiceGender = vp.gender;
      }
    }

    // Se passou voice_id direto, buscar gender tambem
    if (voiceId && !voiceGender) {
      const { data: vp } = await supabase
        .from("voice_profiles")
        .select("gender")
        .eq("voice_id", voiceId)
        .eq("active", true)
        .maybeSingle();
      if (vp) voiceGender = vp.gender;
    }

    // Fallback: voz default global (qualquer provider)
    if (!voiceId) {
      const { data: defaultVoice } = await supabase
        .from("voice_profiles")
        .select("voice_id, voice_name, gender")
        .eq("active", true)
        .eq("is_default", true)
        .maybeSingle();
      if (defaultVoice) {
        voiceId = defaultVoice.voice_id;
        voiceName = defaultVoice.voice_name;
        voiceGender = defaultVoice.gender;
      }
    }

    // Nome do vendedor: usa voice_name do perfil, senão fallback por gender
    const sellerName = voiceName || (voiceGender === "female" ? "Cléo" : "Lucas");

    // Normalizar número para E.164
    let e164 = toNumber.replace(/\D/g, "");
    if (e164.length === 11) e164 = "+55" + e164;
    else if (e164.length === 13 && e164.startsWith("55")) e164 = "+" + e164;
    else if (!e164.startsWith("+")) e164 = "+" + e164;
    else e164 = toNumber;

    // Chamar LiveKit Call API com voice_id + seller_name (Lucas masculino / Luana feminino)
    let callRes;
    try {
      callRes = await fetch(`${CALL_API_URL}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: e164,
          company_id: companyId,
          lead_id: leadId,
          voice_id: voiceId,
          agent_name: sellerName,
          consultor_id: consultorId,
          voice_profile_id: voiceProfileId,
          ...(route ? { route } : {}),
        }),
      });
    } catch (err) {
      return jsonResponse({
        error: "LiveKit Call API unreachable",
        detail: String(err),
      }, 502);
    }

    const callData = await callRes.json().catch(() => null);

    if (!callRes.ok || !callData?.success) {
      return jsonResponse({
        error: "Call failed",
        detail: callData?.error || `HTTP ${callRes.status}`,
      }, 502);
    }

    // Registrar chamada no banco
    const { data: call, error: callErr } = await supabase
      .from("calls")
      .insert({
        company_id: companyId,
        campaign_id: campaignId,
        lead_id: leadId,
        collaborator_id: consultorId,
        destination_number: e164,
        direction: "outbound",
        status: "initiated",
        livekit_room: callData.room,
        livekit_participant_id: callData.uuid,
      })
      .select()
      .single();

    if (callErr) {
      return jsonResponse({
        success: true,
        call_id: null,
        room: callData.room,
        warning: `Call started but DB save failed: ${callErr.message}`,
      });
    }

    return jsonResponse({
      success: true,
      call_id: call.id,
      room: callData.room,
      participant_id: callData.uuid,
      status: "initiated",
      phone_number: e164,
    });
  }

  // ── CALL-STATUS: consulta status direto via LiveKit Call API ──────────
  if (action === "call-status") {
    const room = body.room;
    if (!room) {
      return jsonResponse({ error: "room required" }, 400);
    }
    try {
      const r = await fetch(`${CALL_API_URL}/call-status?room=${encodeURIComponent(room)}`, {
        method: "GET",
      });
      if (r.ok) {
        const d = await r.json();
        return jsonResponse(d);
      }
      return jsonResponse({ active: false });
    } catch (_) {
      return jsonResponse({ active: false });
    }
  }

  // ── STATUS: consulta status de uma chamada ─────────────────────────────
  if (action === "status") {
    const callId = body.call_id;
    if (!callId) {
      return jsonResponse({ error: "call_id required" }, 400);
    }

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
    const room = body.room;

    if (room) {
      try {
        await fetch(`${CALL_API_URL}/hangup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room }),
        });
      } catch (_) { /* best effort */ }
    }

    if (callId) {
      await supabase
        .from("calls")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", callId);
    }

    return jsonResponse({ status: "completed", call_id: callId, room });
  }

  // ── PIPELINE-STATUS: verifica saúde do pipeline ───────────────────────
  if (action === "pipeline-status") {
    try {
      const healthRes = await fetch(`${CALL_API_URL}/health`, { method: "GET" });
      const healthData = await healthRes.json().catch(() => null);
      return jsonResponse({
        pipeline: "livekit",
        status: healthRes.ok ? "online" : "offline",
        ...healthData,
      });
    } catch (_) {
      return jsonResponse({ pipeline: "livekit", status: "offline", error: "Call API unreachable" });
    }
  }

  return jsonResponse({ error: "Invalid action" }, 400);
});
