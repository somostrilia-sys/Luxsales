/**
 * call-complete v2
 * Webhook pós-chamada — PONTE entre Pipeline VoIP e WhatsApp
 *
 * Recebe resumo + transcript da ligação e:
 * 1. Salva na tabela calls (com transcript, interest_detected, eligible_for_whatsapp)
 * 2. Analisa transcrição via Qwen se lead for elegível (duration>=30s OU interesse detectado)
 * 3. Salva ai_analysis em calls
 * 4. Se whatsapp_authorized: registra opt-in + lifecycle + enfileira template
 * 5. Agenda follow-ups automáticos
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/normalize-phone.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const QWEN_URL = "http://192.168.0.206:8400/v1/chat/completions";

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

    switch (action || "complete") {
      case "complete":
        return await handleCallComplete(body);
      case "get":
        return await getCall(body);
      case "list":
        return await listCalls(body);
      case "process-followups":
        return await processFollowups(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    console.error("call-complete error:", err);
    return json({ error: err.message }, 500);
  }
});

/**
 * Analisar transcrição via Qwen local
 */
async function analyzeTranscriptWithQwen(transcript: string, leadName: string | null): Promise<any> {
  const prompt = `Você é o @objetivocloserbot, especialista em vendas da Objetivo Proteção Veicular.
Analise esta transcrição de ligação e responda APENAS em JSON válido (sem markdown):
{
  "should_send_whatsapp": true,
  "reason": "motivo em 1 frase",
  "sentiment": "positive|neutral|negative",
  "interest_level": "high|medium|low",
  "best_template_slot": "pos_ligacao_interesse_alto|pos_ligacao_interesse_medio|pos_ligacao_atendeu|pos_ligacao_nao_quis",
  "personalization_notes": "notas para personalizar a mensagem"
}

Lead: ${leadName || "desconhecido"}
Transcrição:
${transcript}`;

  try {
    const res = await fetch(QWEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn("[QWEN] status", res.status);
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("[QWEN] analysis error:", e);
    return null;
  }
}

/**
 * Processar conclusão de chamada
 */
async function handleCallComplete(body: any) {
  const {
    company_id,
    phone_number,
    lead_name,
    duration_seconds,
    call_summary,
    extracted_data,
    sentiment,
    whatsapp_authorized,
    suggested_template_slot,
    suggested_template_variables,
    llm_provider,
    voice_model,
    campaign_id,
    call_context,
    freeswitch_uuid,
    transcript,
    interest_detected,
  } = body;

  if (!phone_number) {
    return json({ error: "phone_number é obrigatório" }, 400);
  }

  const normalized = normalizePhone(phone_number);
  if (!normalized) {
    return json({ error: "Número de telefone inválido" }, 400);
  }

  // Regra de elegibilidade para WhatsApp
  const durationSecs = duration_seconds || 0;
  const interestFlag = interest_detected === true;
  const eligibleForWhatsapp = durationSecs >= 30 || interestFlag;

  console.log(`[ELIGIBILITY] duration=${durationSecs}s interest=${interestFlag} eligible=${eligibleForWhatsapp}`);

  // Buscar company_config
  const { data: config } = await supabase
    .from("company_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  // Buscar chamada anterior
  const { data: previousCall } = await supabase
    .from("calls")
    .select("id, call_summary")
    .eq("company_id", company_id)
    .eq("destination_number", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Análise Qwen se elegível ──
  let aiAnalysis: any = null;
  let finalTemplateSlot = suggested_template_slot || "pos_ligacao_principal";

  if (eligibleForWhatsapp && transcript) {
    console.log("[QWEN] Analisando transcrição...");
    aiAnalysis = await analyzeTranscriptWithQwen(transcript, lead_name);
    if (aiAnalysis) {
      console.log("[QWEN] analysis:", JSON.stringify(aiAnalysis).slice(0, 200));
      // Usar slot sugerido pela IA se disponível
      if (aiAnalysis.best_template_slot) {
        finalTemplateSlot = aiAnalysis.best_template_slot;
      }
    }
  }

  // ── 1. Salvar chamada ──
  const { data: call, error: callError } = await supabase
    .from("calls")
    .insert({
      company_id,
      destination_number: normalized,
      lead_name: lead_name || null,
      direction: "outbound",
      status: "completed",
      duration_seconds: durationSecs || null,
      call_summary: call_summary || null,
      sentiment: sentiment || null,
      extracted_data: extracted_data || {},
      whatsapp_authorized: whatsapp_authorized || false,
      suggested_template_slot: finalTemplateSlot,
      suggested_template_variables: suggested_template_variables || null,
      previous_call_id: previousCall?.id || null,
      call_context: call_context || null,
      llm_provider: llm_provider || null,
      voice_model: voice_model || null,
      campaign_id: campaign_id || null,
      freeswitch_uuid: body.freeswitch_uuid || body.call_uuid || null,
      ended_at: new Date().toISOString(),
      transcript: transcript || null,
      interest_detected: interestFlag,
      eligible_for_whatsapp: eligibleForWhatsapp,
      ai_analysis: aiAnalysis || null,
    })
    .select()
    .single();

  if (callError) {
    console.error("Insert call error:", callError);
    return json({ error: callError.message }, 500);
  }

  // ── Acionar voice-closer (fire-and-forget) ──
  if (eligibleForWhatsapp) {
    const closerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-closer`;
    fetch(closerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        action: "analyze_and_contact",
        phone: normalized,
        lead_name,
        duration_seconds: durationSecs,
        transcript,
        interest_detected: interestFlag,
        call_summary,
        company_id,
        call_id: call.id,
      }),
    }).catch(() => {}); // fire-and-forget
  }

  // ── Atualizar daily_metrics ──
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("daily_metrics").upsert(
    {
      company_id,
      metric_date: today,
      calls_total: 1,
      calls_answered: durationSecs > 0 ? 1 : 0,
      calls_eligible: eligibleForWhatsapp ? 1 : 0,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "company_id,metric_date",
      ignoreDuplicates: false,
    }
  ).catch(() => {}); // non-blocking, best-effort

  const result: Record<string, any> = {
    call_id: call.id,
    whatsapp_authorized,
    eligible_for_whatsapp: eligibleForWhatsapp,
    interest_detected: interestFlag,
    ai_analysis: aiAnalysis,
    opt_in_created: false,
    lifecycle_created: false,
    dispatch_queued: false,
    followups_scheduled: false,
    leads_master_updated: false,
  };

  // ── Atualizar leads_master ──
  const leadMasterUpdate: Record<string, any> = {
    last_call_at: new Date().toISOString(),
    last_call_result: whatsapp_authorized ? "answered" : (durationSecs > 0 ? "answered" : "no_answer"),
    last_call_id: call.id,
    lead_name: lead_name || undefined,
    lead_score: sentiment === "positive" || sentiment === "interested" ? 70
      : sentiment === "negative" ? 20
      : sentiment === "neutral" ? 40 : 30,
    lead_temperature: whatsapp_authorized ? "hot"
      : (sentiment === "positive" || sentiment === "interested") ? "warm"
      : "cold",
    status_changed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (whatsapp_authorized) {
    leadMasterUpdate.status = "opted_in";
  } else if (durationSecs > 0) {
    leadMasterUpdate.status = "called";
  } else {
    leadMasterUpdate.status = "called";
    leadMasterUpdate.last_call_result = "no_answer";
  }

  const { data: updatedLead } = await supabase
    .from("leads_master")
    .update(leadMasterUpdate)
    .eq("company_id", company_id)
    .eq("phone_number", normalized)
    .select("id, total_call_attempts")
    .maybeSingle();

  if (updatedLead) {
    try {
      await supabase.rpc("increment_call_attempts", { p_lead_id: updatedLead.id });
    } catch {
      await supabase
        .from("leads_master")
        .update({ total_call_attempts: (updatedLead.total_call_attempts || 0) + 1 })
        .eq("id", updatedLead.id);
    }
    result.leads_master_updated = true;
  }

  // ── Se não elegível E não autorizou WhatsApp → parar ──
  if (!eligibleForWhatsapp && !whatsapp_authorized) {
    if (!durationSecs || durationSecs < 10) {
      await supabase
        .from("leads_master")
        .update({ next_call_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() })
        .eq("company_id", company_id)
        .eq("phone_number", normalized);
    }
    return json({ success: true, ...result, message: "Chamada salva. Lead não elegível para WhatsApp." });
  }

  // ── Se elegível mas IA disse para não enviar WhatsApp ──
  if (eligibleForWhatsapp && !whatsapp_authorized && aiAnalysis?.should_send_whatsapp === false) {
    return json({ success: true, ...result, message: "Chamada salva. IA recomendou não enviar WhatsApp." });
  }

  // ── Se não autorizou explicitamente e IA não recomendou → parar ──
  if (!whatsapp_authorized && !aiAnalysis?.should_send_whatsapp) {
    return json({ success: true, ...result, message: "Chamada salva. Sem autorização ou recomendação para WhatsApp." });
  }

  // ── 3. Registrar opt-in ──
  const { data: optIn } = await supabase
    .from("whatsapp_opt_ins")
    .upsert(
      {
        company_id,
        phone_number: normalized,
        lead_name: lead_name || null,
        opt_in_source: "ai_call",
        opt_in_proof: call.id,
        opt_in_proof_type: "call_recording",
        status: "active",
        opt_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,phone_number" }
    )
    .select()
    .single();

  if (optIn) {
    result.opt_in_created = true;
    result.opt_in_id = optIn.id;
  }

  // ── 4. Criar/atualizar lifecycle ──
  const callCount = previousCall ? 2 : 1;
  const { data: lifecycle } = await supabase
    .from("lead_whatsapp_lifecycle")
    .upsert(
      {
        company_id,
        phone_number: normalized,
        lead_name: lead_name || null,
        opt_in_id: optIn?.id,
        stage: "opted_in",
        stage_changed_at: new Date().toISOString(),
        last_call_at: new Date().toISOString(),
        total_calls: callCount,
        conversation_summary: call_summary || null,
        lead_interests: extracted_data?.interests || extractInterests(extracted_data),
        objections: extracted_data?.objections || [],
        sentiment: sentiment || "neutral",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,phone_number" }
    )
    .select()
    .single();

  if (lifecycle) {
    result.lifecycle_created = true;
    result.lifecycle_id = lifecycle.id;

    await supabase
      .from("calls")
      .update({ lifecycle_id: lifecycle.id, opt_in_id: optIn?.id })
      .eq("id", call.id);

    await supabase
      .from("leads_master")
      .update({
        opt_in_id: optIn?.id,
        lifecycle_id: lifecycle.id,
        status: "opted_in",
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company_id)
      .eq("phone_number", normalized);
  }

  // ── 5. Selecionar template e enfileirar disparo ──
  // Personalização via notas da IA
  const personalizationNotes = aiAnalysis?.personalization_notes || "";

  const { data: slotData } = await supabase
    .rpc("select_template_for_call", {
      p_company_id: company_id,
      p_suggested_slot: finalTemplateSlot,
      p_extracted_data: { ...( extracted_data || {}), personalization_notes: personalizationNotes },
    });

  const selectedSlot = slotData?.[0];

  if (selectedSlot) {
    const resolvedVars = resolveVariables(
      selectedSlot.variable_mapping,
      {
        lead_name: lead_name || "",
        extracted: extracted_data || {},
        product_data: config?.product_data || {},
        company_config: config || {},
      }
    );

    const { data: dispatch } = await supabase
      .from("smart_dispatches")
      .insert({
        company_id,
        phone_number: normalized,
        lead_name: lead_name || null,
        lifecycle_id: lifecycle?.id,
        template_name: selectedSlot.template_name,
        template_params: { body_params: resolvedVars },
        status: "queued",
        scheduled_for: new Date().toISOString(),
        priority: 1,
        dispatch_reason: "pos_ligacao",
      })
      .select()
      .single();

    if (dispatch) {
      result.dispatch_queued = true;
      result.dispatch_id = dispatch.id;
      result.template_name = selectedSlot.template_name;
      result.template_variables = resolvedVars;

      await supabase
        .from("calls")
        .update({ dispatch_id: dispatch.id })
        .eq("id", call.id);
    }

    // Disparar imediatamente via smart-dispatcher (non-blocking)
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-dispatcher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ action: "process-queue", company_id, limit: 1 }),
    }).catch(() => {});
  } else {
    result.template_warning = "Nenhum template aprovado para slot " + finalTemplateSlot;
  }

  // ── 6. Agendar follow-ups ──
  const followupHoursFirst = config?.followup_hours_first || 48;
  const followupHoursCall = config?.followup_hours_call || 72;

  await supabase.from("scheduled_actions").insert({
    company_id,
    phone_number: normalized,
    lifecycle_id: lifecycle?.id,
    action_type: "send_template",
    template_slot: "follow_up_48h",
    scheduled_for: new Date(Date.now() + followupHoursFirst * 60 * 60 * 1000).toISOString(),
  });

  await supabase.from("scheduled_actions").insert({
    company_id,
    phone_number: normalized,
    lifecycle_id: lifecycle?.id,
    action_type: "request_call",
    scheduled_for: new Date(Date.now() + followupHoursCall * 60 * 60 * 1000).toISOString(),
  });

  result.followups_scheduled = true;

  return json({
    success: true,
    ...result,
    message: eligibleForWhatsapp
      ? "Chamada salva, elegível, template enfileirado, follow-ups agendados"
      : "Chamada salva. Lead não elegível para WhatsApp.",
  });
}

async function getCall(body: any) {
  const { call_id, company_id, phone_number } = body;
  let query = supabase.from("calls").select("*");
  if (call_id) {
    query = query.eq("id", call_id);
  } else if (phone_number) {
    const normalized = normalizePhone(phone_number);
    query = query.eq("company_id", company_id).eq("destination_number", normalized)
      .order("created_at", { ascending: false }).limit(1);
  }
  const { data, error } = await query.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Chamada não encontrada" }, 404);
  return json({ call: data });
}

async function listCalls(body: any) {
  const { company_id, limit = 50, offset = 0, status_filter } = body;
  let query = supabase.from("calls").select("*", { count: "exact" })
    .eq("company_id", company_id).order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status_filter) query = query.eq("status", status_filter);
  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ calls: data, total: count });
}

async function processFollowups(body: any) {
  const { company_id } = body;
  const now = new Date().toISOString();
  const { data: pending } = await supabase
    .from("scheduled_actions").select("*")
    .eq("company_id", company_id).eq("status", "pending")
    .lte("scheduled_for", now).order("scheduled_for").limit(50);

  if (!pending?.length) return json({ processed: 0 });
  let processed = 0;

  for (const action of pending) {
    try {
      const { data: lifecycle } = await supabase
        .from("lead_whatsapp_lifecycle")
        .select("stage, last_inbound_at, messages_received")
        .eq("company_id", company_id).eq("phone_number", action.phone_number).maybeSingle();

      if (lifecycle && (lifecycle.messages_received > 0 || ["engaged", "closed_won", "closed_lost"].includes(lifecycle.stage))) {
        await supabase.from("scheduled_actions").update({ status: "cancelled", executed_at: now }).eq("id", action.id);
        continue;
      }

      if (action.action_type === "send_template" && action.template_slot) {
        const { data: config } = await supabase.from("company_config").select("product_data")
          .eq("company_id", company_id).maybeSingle();
        const { data: slotData } = await supabase.rpc("select_template_for_call", {
          p_company_id: company_id, p_suggested_slot: action.template_slot, p_extracted_data: {},
        });
        const slot = slotData?.[0];
        if (slot) {
          const { data: lc } = await supabase.from("lead_whatsapp_lifecycle").select("lead_name")
            .eq("id", action.lifecycle_id).maybeSingle();
          const { data: lastCall } = await supabase.from("calls").select("extracted_data")
            .eq("company_id", company_id).eq("destination_number", action.phone_number)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          const vars = resolveVariables(slot.variable_mapping, {
            lead_name: lc?.lead_name || "", extracted: lastCall?.extracted_data || {},
            product_data: config?.product_data || {}, company_config: {},
          });
          await supabase.from("smart_dispatches").insert({
            company_id, phone_number: action.phone_number, lead_name: lc?.lead_name,
            lifecycle_id: action.lifecycle_id, template_name: slot.template_name,
            template_params: { body_params: vars }, status: "queued", scheduled_for: now,
            priority: 3, dispatch_reason: action.template_slot,
          });
        }
      } else if (action.action_type === "request_call") {
        await supabase.from("lead_whatsapp_lifecycle").update({
          next_call_requested: true, next_call_reason: "Sem resposta no WhatsApp após follow-ups", updated_at: now,
        }).eq("company_id", company_id).eq("phone_number", action.phone_number);
      }

      await supabase.from("scheduled_actions").update({ status: "executed", executed_at: now }).eq("id", action.id);
      processed++;
    } catch (err) {
      await supabase.from("scheduled_actions").update({ status: "failed", error_message: (err as Error).message }).eq("id", action.id);
    }
  }

  return json({ processed, total: pending.length });
}

function resolveVariables(
  mapping: Record<string, { source: string; transform?: string }>,
  context: { lead_name: string; extracted: Record<string, any>; product_data: Record<string, any>; company_config: Record<string, any> }
): string[] {
  const resolved: string[] = [];
  const sortedKeys = Object.keys(mapping).sort();
  for (const key of sortedKeys) {
    const cfg = mapping[key];
    let value = "";
    const parts = cfg.source.split(".");
    if (parts[0] === "lead_name") value = context.lead_name;
    else if (parts[0] === "extracted" && parts.length >= 2) value = String(context.extracted?.[parts[1]] ?? "");
    else if (parts[0] === "product_data" && parts.length >= 2) value = String(context.product_data?.[parts[1]] ?? "");
    else if (parts[0] === "company_config" && parts.length >= 2) value = String(context.company_config?.[parts[1]] ?? "");
    if (cfg.transform === "capitalize" && value) value = value.charAt(0).toUpperCase() + value.slice(1);
    else if (cfg.transform === "uppercase" && value) value = value.toUpperCase();
    else if (cfg.transform === "currency" && value) {
      const num = parseFloat(value);
      if (!isNaN(num)) value = num.toFixed(2).replace(".", ",");
    }
    resolved.push(value || "");
  }
  return resolved;
}

function extractInterests(data: Record<string, any> | null): string[] {
  if (!data) return [];
  const interests: string[] = [];
  if (data.interest_level === "alto") interests.push("alto interesse");
  if (data.vehicle_model) interests.push(`proteção para ${data.vehicle_brand || ""} ${data.vehicle_model}`.trim());
  if (data.procedure) interests.push(data.procedure);
  if (data.property_type) interests.push(`${data.property_type} em ${data.neighborhood || "local não definido"}`);
  return interests;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
