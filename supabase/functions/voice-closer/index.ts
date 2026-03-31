/**
 * voice-closer v1
 * Agente de fechamento pós-ligação via WhatsApp
 *
 * 1. Recebe payload pós-ligação com transcrição
 * 2. Analisa com Claude Opus via Anthropic API
 * 3. Decide se deve enviar WhatsApp (duration >= 30s OU interest_detected)
 * 4. Chama whatsapp-meta-send para disparar a mensagem
 * 5. Salva conversa nas tabelas wa_conversations + wa_messages
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "analyze_and_contact":
        return await analyzeAndContact(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    console.error("voice-closer error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

async function analyzeAndContact(body: any) {
  const {
    phone,
    lead_name,
    duration_seconds = 0,
    transcript,
    interest_detected = false,
    call_summary,
    company_id,
    call_id,
  } = body;

  if (!phone) {
    return json({ error: "phone é obrigatório" }, 400);
  }

  // Regra de elegibilidade
  const eligible = duration_seconds >= 30 || interest_detected;
  if (!eligible) {
    return json({ ok: true, sent: false, reason: "not_eligible" });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);
  }

  // Analisar com Claude Opus
  const transcriptText = transcript
    ? (typeof transcript === "string" ? transcript : JSON.stringify(transcript))
    : "sem transcrição";

  const analysisPrompt = `Você é especialista em vendas da Objetivo Proteção Veicular.
Analise esta ligação e responda APENAS em JSON válido (sem markdown):
{
  "should_send_whatsapp": true,
  "sentiment": "positive|neutral|negative",
  "interest_level": "high|medium|low",
  "opening_message": "mensagem personalizada para o lead (máx 3 linhas)",
  "reason": "motivo em 1 frase"
}

Lead: ${lead_name || "desconhecido"}
Duração: ${duration_seconds}s
Resumo: ${call_summary || "sem resumo"}
Transcrição: ${transcriptText}`;

  let analysis: any = null;

  try {
    const opusRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 400,
        messages: [{ role: "user", content: analysisPrompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (opusRes.ok) {
      const opusData = await opusRes.json();
      const raw = opusData.content?.[0]?.text || "";
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      analysis = JSON.parse(cleaned);
      console.log("[OPUS] analysis:", JSON.stringify(analysis).slice(0, 200));
    } else {
      const errData = await opusRes.json();
      console.error("[OPUS] error:", errData.error?.message);
    }
  } catch (e) {
    console.error("[OPUS] analysis failed:", e);
  }

  if (!analysis?.should_send_whatsapp) {
    return json({ ok: true, sent: false, reason: analysis?.reason || "opus_said_no", analysis });
  }

  // Salvar wa_conversation
  const { data: conversation, error: convError } = await supabase
    .from("wa_conversations")
    .upsert(
      {
        phone,
        lead_name: lead_name || null,
        company_id: company_id || null,
        call_id: call_id || null,
        status: "active",
        human_mode: false,
        analysis,
        turn_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone,company_id" }
    )
    .select()
    .single();

  if (convError) {
    console.error("[WA_CONV] error:", convError);
    return json({ error: convError.message }, 500);
  }

  const conversationId = conversation.id;

  // Enviar WhatsApp via send-meta-message (insere em whatsapp_meta_messages → trigger → wa_messages)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let sent = false;
  try {
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-meta-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        to: phone,
        type: "text",
        text: analysis.opening_message,
        company_id: company_id,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const sendData = await sendRes.json();
    sent = sendRes.ok && (sendData.ok || sendData.success);
    if (!sent) console.warn("[SEND] response:", JSON.stringify(sendData).slice(0, 200));
  } catch (e) {
    console.error("[SEND] error:", e);
  }

  return json({
    ok: true,
    sent,
    analysis,
    conversation_id: conversationId,
  });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
