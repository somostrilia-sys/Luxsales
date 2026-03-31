/**
 * smart-dispatcher
 * Envio inteligente de templates com TODAS as verificações:
 * 1. Permissão do colaborador (role, limite diário, template autorizado)
 * 2. Opt-in ativo do lead
 * 3. Qualidade do número (quality rating + tier)
 * 4. Envio via Meta API oficial
 * 5. Tracking completo (sent → delivered → read → replied)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/normalize-phone.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API = "https://graph.facebook.com/v22.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "send":
        return await sendTemplate(body);
      case "send-batch":
        return await sendBatch(body);
      case "queue":
        return await queueDispatch(body);
      case "process-queue":
        return await processQueue(body);
      case "status":
        return await getDispatchStatus(body);
      case "history":
        return await getHistory(body);
      case "send-by-slot":
        return await sendBySlot(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Enviar template imediatamente (ação do vendedor)
 */
async function sendTemplate(body: any) {
  const {
    company_id,
    collaborator_id,
    phone_number,
    template_name,
    template_params,
    dispatch_reason,
  } = body;

  // ── VERIFICAÇÃO 1: Permissão do colaborador ──
  const permCheck = await checkPermission(collaborator_id, template_name);
  if (!permCheck.allowed) {
    return json({ error: permCheck.reason, code: "PERMISSION_DENIED" }, 403);
  }

  // ── VERIFICAÇÃO 2: Opt-in do lead ──
  const normalized = normalizePhone(phone_number);
  if (!normalized) return json({ error: "Número inválido" }, 400);

  const optInCheck = await checkOptIn(company_id, normalized);
  if (!optInCheck.active) {
    return json({ error: "Lead não tem opt-in ativo", code: "NO_OPT_IN" }, 403);
  }

  // ── VERIFICAÇÃO 3: Qualidade do número ──
  const qualityCheck = await checkQuality(company_id);
  if (!qualityCheck.ok) {
    return json({
      error: qualityCheck.reason,
      code: "QUALITY_BLOCK",
      quality: qualityCheck.quality,
      tier: qualityCheck.tier,
    }, 503);
  }

  // ── VERIFICAÇÃO 4: Template existe e está aprovado ──
  const template = await getApprovedTemplate(company_id, template_name);
  if (!template) {
    return json({ error: "Template não encontrado ou não aprovado", code: "TEMPLATE_INVALID" }, 400);
  }

  // ── ENVIAR via Meta API ──
  const sendResult = await sendViaMeta(company_id, normalized, template, template_params);

  if (!sendResult.success) {
    // Registrar falha
    await createDispatchRecord({
      company_id,
      phone_number: normalized,
      lead_name: optInCheck.lead_name,
      template_name,
      template_params,
      status: "failed",
      error_message: sendResult.error,
      dispatch_reason,
      collaborator_id,
    });

    return json({ error: sendResult.error, code: "SEND_FAILED" }, 500);
  }

  // ── Registrar sucesso ──
  const dispatch = await createDispatchRecord({
    company_id,
    phone_number: normalized,
    lead_name: optInCheck.lead_name,
    template_name,
    template_params,
    status: "sent",
    sent_at: new Date().toISOString(),
    meta_message_id: sendResult.messageId,
    dispatch_reason,
    collaborator_id,
  });

  // ── Incrementar contador do colaborador ──
  try {
    await supabase.rpc("increment_dispatch_counter", { p_collaborator_id: collaborator_id });
  } catch {
    // Fallback manual
    await supabase
      .from("dispatch_permissions")
      .update({
        daily_dispatches_used: permCheck.used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("collaborator_id", collaborator_id);
  }

  // ── Atualizar lifecycle ──
  await updateLifecycleAfterDispatch(company_id, normalized, template_name, dispatch_reason);

  // ── Atualizar leads_master ──
  await supabase
    .from("leads_master")
    .update({
      status: "dispatched",
      status_changed_at: new Date().toISOString(),
      last_dispatch_at: new Date().toISOString(),
      total_dispatches: 1, // será incrementado
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", company_id)
    .eq("phone_number", normalized)
    .in("status", ["opted_in", "queued_dispatch"])
    .catch(() => {});

  // ── Atualizar distribuição ──
  if (collaborator_id) {
    await supabase
      .from("lead_distribution")
      .update({ status: "dispatched", dispatch_id: dispatch?.id })
      .eq("company_id", company_id)
      .eq("phone_number", normalized)
      .eq("collaborator_id", collaborator_id)
      .eq("status", "pending");
  }

  return json({
    success: true,
    dispatch_id: dispatch?.id,
    meta_message_id: sendResult.messageId,
    remaining_today: permCheck.remaining - 1,
  });
}

/**
 * Enviar batch (CEO only — para múltiplos leads)
 */
async function sendBatch(body: any) {
  const { company_id, collaborator_id, phone_numbers, template_name, requester_role } = body;

  if (requester_role !== "ceo") {
    return json({ error: "Apenas o CEO pode enviar em batch" }, 403);
  }

  const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

  for (const phone of phone_numbers) {
    const result = await sendTemplate({
      company_id,
      collaborator_id,
      phone_number: phone,
      template_name,
      template_params: body.template_params,
      dispatch_reason: "batch",
    });

    const resultBody = await result.json();
    if (resultBody.success) {
      results.sent++;
    } else if (resultBody.code === "NO_OPT_IN" || resultBody.code === "PERMISSION_DENIED") {
      results.skipped++;
      results.errors.push(`${phone}: ${resultBody.error}`);
    } else {
      results.failed++;
      results.errors.push(`${phone}: ${resultBody.error}`);
    }
  }

  return json({ success: true, results });
}

/**
 * Agendar envio futuro
 */
async function queueDispatch(body: any) {
  const {
    company_id,
    collaborator_id,
    phone_number,
    template_name,
    template_params,
    scheduled_for,
    dispatch_reason,
    priority = 5,
  } = body;

  const normalized = normalizePhone(phone_number);
  if (!normalized) return json({ error: "Número inválido" }, 400);

  const dispatch = await createDispatchRecord({
    company_id,
    phone_number: normalized,
    template_name,
    template_params,
    status: "queued",
    scheduled_for,
    priority,
    dispatch_reason,
    collaborator_id,
  });

  return json({ success: true, dispatch });
}

/**
 * Processar fila (chamado por cron)
 */
async function processQueue(body: any) {
  const { company_id, limit = 50 } = body;

  // Verificar qualidade antes de processar
  const qualityCheck = await checkQuality(company_id);
  if (!qualityCheck.ok) {
    return json({ processed: 0, reason: qualityCheck.reason });
  }

  // Buscar dispatches prontos
  const now = new Date().toISOString();
  const { data: queued } = await supabase
    .from("smart_dispatches")
    .select("*")
    .eq("company_id", company_id)
    .eq("status", "queued")
    .lte("scheduled_for", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!queued?.length) return json({ processed: 0 });

  let processed = 0;
  for (const dispatch of queued) {
    const result = await sendTemplate({
      company_id: dispatch.company_id,
      collaborator_id: dispatch.collaborator_id || body.collaborator_id,
      phone_number: dispatch.phone_number,
      template_name: dispatch.template_name,
      template_params: dispatch.template_params,
      dispatch_reason: dispatch.dispatch_reason,
    });

    const resultBody = await result.json();
    if (resultBody.success) processed++;
  }

  return json({ processed, total: queued.length });
}

/**
 * Status de um dispatch
 */
async function getDispatchStatus(body: any) {
  const { dispatch_id } = body;

  const { data } = await supabase
    .from("smart_dispatches")
    .select("*")
    .eq("id", dispatch_id)
    .maybeSingle();

  if (!data) return json({ error: "Dispatch não encontrado" }, 404);
  return json({ dispatch: data });
}

/**
 * Histórico de dispatches
 */
async function getHistory(body: any) {
  const { company_id, collaborator_id, phone_number, limit = 50, offset = 0 } = body;

  let query = supabase
    .from("smart_dispatches")
    .select("*", { count: "exact" })
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (collaborator_id) query = query.eq("collaborator_id", collaborator_id);
  if (phone_number) query = query.eq("phone_number", normalizePhone(phone_number));

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);

  return json({ dispatches: data, total: count });
}

/**
 * Enviar por slot — resolve template + variáveis automaticamente
 * Usado pelo call-complete e crons de follow-up
 */
async function sendBySlot(body: any) {
  const {
    company_id,
    collaborator_id,
    phone_number,
    slot,                    // "pos_ligacao_principal", "follow_up_48h", etc
    extra_variables,         // variáveis extras pra override
    dispatch_reason,
  } = body;

  if (!slot || !phone_number) {
    return json({ error: "slot e phone_number são obrigatórios" }, 400);
  }

  const normalized = normalizePhone(phone_number);
  if (!normalized) return json({ error: "Número inválido" }, 400);

  // Buscar template do slot
  const { data: slotData } = await supabase
    .rpc("select_template_for_call", {
      p_company_id: company_id,
      p_suggested_slot: slot,
      p_extracted_data: {},
    });

  const selectedSlot = slotData?.[0];
  if (!selectedSlot) {
    return json({ error: `Nenhum template aprovado para o slot "${slot}"` }, 400);
  }

  // Buscar dados do lead pra resolver variáveis
  const { data: lifecycle } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("lead_name")
    .eq("company_id", company_id)
    .eq("phone_number", normalized)
    .maybeSingle();

  // Buscar extracted_data da última call
  const { data: lastCall } = await supabase
    .from("calls")
    .select("extracted_data")
    .eq("company_id", company_id)
    .eq("destination_number", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Buscar company_config pra product_data
  const { data: config } = await supabase
    .from("company_config")
    .select("product_data, persona_name, persona_company")
    .eq("company_id", company_id)
    .maybeSingle();

  // Resolver variáveis
  const resolvedVars = resolveSlotVariables(
    selectedSlot.variable_mapping,
    {
      lead_name: lifecycle?.lead_name || "",
      extracted: { ...(lastCall?.extracted_data || {}), ...(extra_variables || {}) },
      product_data: config?.product_data || {},
      company_config: config || {},
    }
  );

  // Enviar via sendTemplate normal
  return await sendTemplate({
    company_id,
    collaborator_id: collaborator_id || body.requester_id,
    phone_number: normalized,
    template_name: selectedSlot.template_name,
    template_params: { body_params: resolvedVars },
    dispatch_reason: dispatch_reason || slot,
  });
}

function resolveSlotVariables(
  mapping: Record<string, { source: string; transform?: string }>,
  context: {
    lead_name: string;
    extracted: Record<string, any>;
    product_data: Record<string, any>;
    company_config: Record<string, any>;
  }
): string[] {
  const resolved: string[] = [];
  const sortedKeys = Object.keys(mapping).sort();

  for (const key of sortedKeys) {
    const cfg = mapping[key];
    let value = "";

    const parts = cfg.source.split(".");
    if (parts[0] === "lead_name") {
      value = context.lead_name;
    } else if (parts[0] === "extracted" && parts.length >= 2) {
      value = String(context.extracted?.[parts[1]] ?? "");
    } else if (parts[0] === "product_data" && parts.length >= 2) {
      value = String(context.product_data?.[parts[1]] ?? "");
    } else if (parts[0] === "company_config" && parts.length >= 2) {
      value = String(context.company_config?.[parts[1]] ?? "");
    }

    if (cfg.transform === "capitalize" && value) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    } else if (cfg.transform === "uppercase" && value) {
      value = value.toUpperCase();
    }

    resolved.push(value || "");
  }

  return resolved;
}

// ── HELPERS ──────────────────────────────────────────────────────────────

async function checkPermission(collaboratorId: string, templateName?: string) {
  const { data: perm } = await supabase
    .from("dispatch_permissions")
    .select("*")
    .eq("collaborator_id", collaboratorId)
    .eq("is_active", true)
    .maybeSingle();

  if (!perm) return { allowed: false, reason: "Sem permissão configurada" };

  // Reset diário
  const today = new Date().toISOString().split("T")[0];
  if (perm.last_reset_at < today) {
    await supabase
      .from("dispatch_permissions")
      .update({ daily_dispatches_used: 0, last_reset_at: today })
      .eq("id", perm.id);
    perm.daily_dispatches_used = 0;
  }

  if (!perm.can_dispatch) {
    return { allowed: false, reason: "Disparo desativado para este colaborador" };
  }

  if (perm.daily_dispatches_used >= perm.daily_dispatch_limit) {
    return {
      allowed: false,
      reason: `Limite diário atingido (${perm.daily_dispatches_used}/${perm.daily_dispatch_limit})`,
      used: perm.daily_dispatches_used,
      remaining: 0,
    };
  }

  // Verificar template autorizado (CEO pode tudo)
  if (templateName && perm.role !== "ceo") {
    let allowed: string[] = [];
    try {
      allowed = typeof perm.allowed_templates === "string"
        ? JSON.parse(perm.allowed_templates)
        : perm.allowed_templates || [];
    } catch { allowed = []; }

    if (allowed.length > 0 && !allowed.includes(templateName)) {
      return { allowed: false, reason: `Template "${templateName}" não autorizado` };
    }
  }

  return {
    allowed: true,
    remaining: perm.daily_dispatch_limit - perm.daily_dispatches_used,
    used: perm.daily_dispatches_used,
    limit: perm.daily_dispatch_limit,
  };
}

async function checkOptIn(companyId: string, phone: string) {
  const { data } = await supabase
    .from("whatsapp_opt_ins")
    .select("id, lead_name, status")
    .eq("company_id", companyId)
    .eq("phone_number", phone)
    .eq("status", "active")
    .maybeSingle();

  return { active: !!data, lead_name: data?.lead_name };
}

async function checkQuality(companyId: string) {
  const { data } = await supabase
    .from("meta_quality_tracking")
    .select("quality_rating, messaging_limit_tier, conversations_24h, tier_limit, usage_pct")
    .eq("company_id", companyId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    // Sem dados de quality — permitir com cautela
    return { ok: true, quality: "UNKNOWN", tier: "UNKNOWN" };
  }

  if (data.quality_rating === "RED") {
    return {
      ok: false,
      reason: "Qualidade do número está VERMELHA — envios pausados automaticamente",
      quality: data.quality_rating,
      tier: data.messaging_limit_tier,
    };
  }

  // Se YELLOW, permitir mas com warning
  // Se uso > 50% do tier, bloquear (margem de segurança)
  const usagePct = data.usage_pct || 0;
  if (usagePct > 50) {
    return {
      ok: false,
      reason: `Limite seguro atingido (${usagePct}% do tier usado). Aguarde reset em 24h.`,
      quality: data.quality_rating,
      tier: data.messaging_limit_tier,
    };
  }

  return { ok: true, quality: data.quality_rating, tier: data.messaging_limit_tier };
}

async function getApprovedTemplate(companyId: string, templateName: string) {
  const { data } = await supabase
    .from("whatsapp_meta_templates")
    .select("*")
    .eq("company_id", companyId)
    .eq("name", templateName)
    .eq("status", "APPROVED")
    .maybeSingle();

  return data;
}

async function sendViaMeta(
  companyId: string,
  phone: string,
  template: any,
  params?: any
) {
  // Buscar credenciais
  const { data: config } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", ["meta_whatsapp_token", "meta_phone_number_id"]);

  const configMap: Record<string, string> = {};
  for (const c of config || []) configMap[c.key] = c.value;

  let token = configMap.meta_whatsapp_token;
  let phoneNumberId = configMap.meta_phone_number_id;

  // Fallback: whatsapp_meta_credentials
  if (!token || !phoneNumberId) {
    const { data: cred } = await supabase
      .from("whatsapp_meta_credentials")
      .select("access_token, phone_number_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (cred) {
      token = token || cred.access_token;
      phoneNumberId = phoneNumberId || cred.phone_number_id;
    }
  }

  if (!token || !phoneNumberId) {
    return { success: false, error: "Credenciais Meta não configuradas" };
  }

  // Montar payload do template
  const components: any[] = [];
  if (params) {
    // Body parameters
    if (params.body_params?.length) {
      components.push({
        type: "body",
        parameters: params.body_params.map((p: string) => ({
          type: "text",
          text: p,
        })),
      });
    }
    // Header parameters
    if (params.header_params?.length) {
      components.push({
        type: "header",
        parameters: params.header_params.map((p: string) => ({
          type: "text",
          text: p,
        })),
      });
    }
  }

  const payload: any = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language || "pt_BR" },
    },
  };

  if (components.length > 0) {
    payload.template.components = components;
  }

  try {
    const res = await fetch(`${META_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: result.error?.message || `Meta API error ${res.status}`,
      };
    }

    const messageId = result.messages?.[0]?.id;

    // Salvar na tabela de mensagens também
    await supabase
      .from("whatsapp_meta_messages")
      .insert({
        company_id: companyId,
        message_id: messageId,
        direction: "outbound",
        phone_from: phoneNumberId,
        phone_to: phone,
        phone_number_id: phoneNumberId,
        type: "template",
        template_name: template.name,
        template_params: params,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .catch(() => {});

    return { success: true, messageId };
  } catch (err) {
    return { success: false, error: `Network error: ${err.message}` };
  }
}

async function createDispatchRecord(data: any) {
  const { data: dispatch, error } = await supabase
    .from("smart_dispatches")
    .insert({
      company_id: data.company_id,
      phone_number: data.phone_number,
      lead_name: data.lead_name,
      template_name: data.template_name,
      template_params: data.template_params,
      status: data.status,
      sent_at: data.sent_at,
      meta_message_id: data.meta_message_id,
      error_message: data.error_message,
      dispatch_reason: data.dispatch_reason,
      scheduled_for: data.scheduled_for,
      priority: data.priority,
      collaborator_id: data.collaborator_id,
    })
    .select()
    .maybeSingle();

  if (error) console.error("Create dispatch error:", error);

  // Buscar lifecycle_id e vincular
  if (dispatch && data.phone_number) {
    const { data: lc } = await supabase
      .from("lead_whatsapp_lifecycle")
      .select("id")
      .eq("company_id", data.company_id)
      .eq("phone_number", data.phone_number)
      .maybeSingle();

    if (lc) {
      await supabase
        .from("smart_dispatches")
        .update({ lifecycle_id: lc.id })
        .eq("id", dispatch.id);
    }
  }

  return dispatch;
}

async function updateLifecycleAfterDispatch(
  companyId: string,
  phone: string,
  templateName: string,
  reason?: string
) {
  const update: Record<string, any> = {
    last_template_sent_at: new Date().toISOString(),
    last_template_name: templateName,
    messages_sent: 1, // será somado pelo trigger
    updated_at: new Date().toISOString(),
  };

  // Avançar stage se necessário
  const { data: lc } = await supabase
    .from("lead_whatsapp_lifecycle")
    .select("stage")
    .eq("company_id", companyId)
    .eq("phone_number", phone)
    .maybeSingle();

  if (lc?.stage === "opted_in") {
    update.stage = "first_contact";
    update.stage_changed_at = new Date().toISOString();
  }

  if (reason === "proposal" && lc?.stage !== "proposal_sent") {
    update.stage = "proposal_sent";
    update.stage_changed_at = new Date().toISOString();
  }

  await supabase
    .from("lead_whatsapp_lifecycle")
    .update(update)
    .eq("company_id", companyId)
    .eq("phone_number", phone);
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
