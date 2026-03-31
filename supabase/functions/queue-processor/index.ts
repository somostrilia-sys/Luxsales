/**
 * queue-processor
 * Worker que processa filas de ligação e disparo automaticamente.
 * Chamado por cron (a cada 1-5 min) ou manualmente.
 *
 * Actions:
 *   process-calls    — Processa call_queues ativas → liga pro próximo lead
 *   process-dispatch — Processa dispatch_queues ativas → dispara próximo template
 *   process-all      — Processa ambos
 *   cron             — Tudo (calls + dispatch + followups + quality + window cleanup)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      case "process-calls":
        return await processCallQueues(body);
      case "process-dispatch":
        return await processDispatchQueues(body);
      case "process-all":
        const calls = await processCallQueues(body);
        const dispatches = await processDispatchQueues(body);
        const callsResult = await calls.json();
        const dispatchResult = await dispatches.json();
        return json({ calls: callsResult, dispatches: dispatchResult });
      case "cron":
        return await runCron(body);
      default:
        return json({ error: "Action inválida. Use: process-calls, process-dispatch, process-all, cron" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Processar filas de ligação ativas
 */
async function processCallQueues(body: any) {
  const results = { queues_processed: 0, calls_initiated: 0, errors: [] as string[] };

  // Buscar filas ativas
  const { data: queues } = await supabase
    .from("call_queues")
    .select("*")
    .eq("status", "active");

  if (!queues?.length) return json({ ...results, message: "Nenhuma fila ativa" });

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
  const currentDay = now.getDay() || 7; // 1=seg, 7=dom

  for (const queue of queues) {
    // Verificar horário de operação
    if (currentTime < queue.active_hours_start || currentTime > queue.active_hours_end) {
      continue;
    }
    if (!queue.active_days?.includes(currentDay)) {
      continue;
    }

    // Verificar limite diário
    if (queue.leads_called >= queue.max_daily_calls) {
      continue;
    }

    // Buscar próximo lead da fila
    const { data: nextLeads } = await supabase.rpc("get_next_lead_to_call", {
      p_company_id: queue.company_id,
      p_queue_id: queue.id,
    });

    const nextLead = nextLeads?.[0];
    if (!nextLead) {
      // Fila esgotada — marcar como completed
      await supabase
        .from("call_queues")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queue.id);
      continue;
    }

    // Marcar lead como calling
    await supabase
      .from("leads_master")
      .update({
        status: "calling",
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", nextLead.lead_id);

    // Iniciar chamada via make-call
    try {
      const callRes = await fetch(`${SUPABASE_URL}/functions/v1/make-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          action: "dial",
          to: nextLead.phone_number,
          company_id: queue.company_id,
          voice_key: queue.voice_key || "fish-alex",
          system_prompt: queue.system_prompt || undefined,
          opening_script: queue.opening_script || undefined,
        }),
      });

      const callResult = await callRes.json();

      if (callResult.success) {
        results.calls_initiated++;

        // Atualizar contadores da fila
        await supabase
          .from("call_queues")
          .update({
            leads_called: queue.leads_called + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue.id);

        // Atualizar lead com call_id
        await supabase
          .from("leads_master")
          .update({
            last_call_id: callResult.call_id,
            last_call_at: new Date().toISOString(),
          })
          .eq("id", nextLead.lead_id);
      } else {
        results.errors.push(`Queue ${queue.name}: ${callResult.error}`);

        // Reverter status do lead
        await supabase
          .from("leads_master")
          .update({ status: "queued_call", updated_at: new Date().toISOString() })
          .eq("id", nextLead.lead_id);
      }
    } catch (err) {
      results.errors.push(`Queue ${queue.name}: ${(err as Error).message}`);

      await supabase
        .from("leads_master")
        .update({ status: "queued_call", updated_at: new Date().toISOString() })
        .eq("id", nextLead.lead_id);
    }

    results.queues_processed++;
  }

  return json(results);
}

/**
 * Processar filas de disparo WhatsApp ativas
 */
async function processDispatchQueues(body: any) {
  const results = { queues_processed: 0, dispatches_sent: 0, errors: [] as string[] };

  const { data: queues } = await supabase
    .from("dispatch_queues")
    .select("*")
    .eq("status", "active");

  if (!queues?.length) return json({ ...results, message: "Nenhuma fila ativa" });

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const currentDay = now.getDay() || 7;

  for (const queue of queues) {
    if (currentTime < queue.active_hours_start || currentTime > queue.active_hours_end) continue;
    if (!queue.active_days?.includes(currentDay)) continue;
    if (queue.dispatched >= queue.max_daily) continue;

    // Verificar qualidade Meta antes
    if (queue.respect_tier_limit) {
      const { data: quality } = await supabase
        .from("meta_quality_tracking")
        .select("quality_rating, usage_pct")
        .eq("company_id", queue.company_id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (quality?.quality_rating === "RED") continue;
      if ((quality?.usage_pct || 0) > queue.tier_usage_safety_pct) continue;
    }

    // Buscar próximo lead
    const { data: nextLeads } = await supabase.rpc("get_next_lead_to_dispatch", {
      p_company_id: queue.company_id,
      p_queue_id: queue.id,
    });

    const nextLead = nextLeads?.[0];
    if (!nextLead) {
      await supabase
        .from("dispatch_queues")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queue.id);
      continue;
    }

    // Enviar via smart-dispatcher (por slot ou template direto)
    try {
      const dispatchAction = queue.template_slot ? "send-by-slot" : "send";
      const dispatchBody: any = {
        action: dispatchAction,
        company_id: queue.company_id,
        phone_number: nextLead.phone_number,
        dispatch_reason: `queue:${queue.name}`,
      };

      if (queue.template_slot) {
        dispatchBody.slot = queue.template_slot;
      } else {
        dispatchBody.template_name = queue.template_name;
      }

      // CEO como collaborator pra queue-based dispatch
      const { data: ceoPerm } = await supabase
        .from("dispatch_permissions")
        .select("collaborator_id")
        .eq("company_id", queue.company_id)
        .eq("role", "ceo")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      dispatchBody.collaborator_id = ceoPerm?.collaborator_id || body.collaborator_id;

      const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/smart-dispatcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify(dispatchBody),
      });

      const dispatchResult = await dispatchRes.json();

      if (dispatchResult.success) {
        results.dispatches_sent++;
        await supabase
          .from("dispatch_queues")
          .update({
            dispatched: queue.dispatched + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", queue.id);
      } else {
        results.errors.push(`Queue ${queue.name}: ${dispatchResult.error}`);
      }
    } catch (err) {
      results.errors.push(`Queue ${queue.name}: ${(err as Error).message}`);
    }

    results.queues_processed++;
  }

  return json(results);
}

/**
 * Cron master — roda tudo que precisa rodar periodicamente
 */
async function runCron(_body: any) {
  const results: Record<string, any> = {};

  // 1. Fechar janelas expiradas
  let windowsClosed = 0;
  try { const r = await supabase.rpc("close_expired_windows"); windowsClosed = r.data || 0; } catch { /* ignore */ }
  results.windows_closed = windowsClosed;

  // 2. Reset contadores diários
  let countersReset = 0;
  try { const r = await supabase.rpc("reset_daily_dispatch_counters"); countersReset = r.data || 0; } catch { /* ignore */ }
  results.counters_reset = countersReset;

  // 3. Processar filas de ligação
  const callsRes = await processCallQueues({});
  results.calls = await callsRes.json();

  // 4. Processar filas de disparo
  const dispatchRes = await processDispatchQueues({});
  results.dispatches = await dispatchRes.json();

  // 5. Processar follow-ups (para cada company)
  const { data: companies } = await supabase
    .from("company_config")
    .select("company_id")
    .eq("is_active", true);

  let followupsProcessed = 0;
  for (const company of companies || []) {
    try {
      const fuRes = await fetch(`${SUPABASE_URL}/functions/v1/call-complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          action: "process-followups",
          company_id: company.company_id,
        }),
      });
      const fuResult = await fuRes.json();
      followupsProcessed += fuResult.processed || 0;
    } catch { /* ignore */ }
  }
  results.followups_processed = followupsProcessed;

  // 6. Processar fila de smart_dispatches (queued)
  for (const company of companies || []) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/smart-dispatcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          action: "process-queue",
          company_id: company.company_id,
          limit: 50,
        }),
      });
    } catch { /* ignore */ }
  }

  // 7. Quality check (a cada chamada de cron)
  for (const company of companies || []) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/quality-monitor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          action: "check",
          company_id: company.company_id,
        }),
      });
    } catch { /* ignore */ }
  }

  results.timestamp = new Date().toISOString();
  return json(results);
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
