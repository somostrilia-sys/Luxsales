/**
 * dashboard-geral
 * Dashboard unificado — visão 360° do CEO
 * Puxa dados de: leads_master, ligações, WhatsApp Meta, disparos, equipe
 * Actions: overview, kpis, timeline
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
      case "overview":
        return await getOverview(body);
      case "kpis":
        return await getKPIs(body);
      case "timeline":
        return await getTimeline(body);
      case "voice-metrics":
        return await getVoiceMetrics(body);
      default:
        return json({ error: "Action inválida. Use: overview, kpis, timeline, voice-metrics" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Overview unificado — tudo que o CEO precisa ver ao abrir o app
 */
async function getOverview(body: any) {
  const { company_id, requester_role } = body;

  if (!["ceo", "director", "manager"].includes(requester_role)) {
    return json({ error: "Sem acesso ao dashboard geral" }, 403);
  }

  const today = new Date().toISOString().split("T")[0];
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── LEADS MASTER ──────────────────────────────────────────────────
  let leadsStats: any = null;
  try {
    const rpcResult = await supabase.rpc("leads_master_stats", { p_company_id: company_id });
    leadsStats = rpcResult.data;
  } catch { /* ignore */ }

  // ── LIGAÇÕES HOJE ─────────────────────────────────────────────────
  const { data: callsToday } = await supabase
    .from("calls")
    .select("status, whatsapp_authorized, sentiment")
    .eq("company_id", company_id)
    .gte("created_at", today);

  const callStats = { total: 0, answered: 0, opted_in: 0 };
  for (const c of callsToday || []) {
    callStats.total++;
    if (c.status === "completed" || c.status === "answered") callStats.answered++;
    if (c.whatsapp_authorized) callStats.opted_in++;
  }

  // ── DISPAROS WHATSAPP HOJE ────────────────────────────────────────
  const { data: dispatchesToday } = await supabase
    .from("smart_dispatches")
    .select("status")
    .eq("company_id", company_id)
    .gte("created_at", today);

  const dispatchStats = { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
  for (const d of dispatchesToday || []) {
    dispatchStats.total++;
    if (["sent", "delivered", "read", "replied"].includes(d.status)) dispatchStats.sent++;
    if (["delivered", "read", "replied"].includes(d.status)) dispatchStats.delivered++;
    if (["read", "replied"].includes(d.status)) dispatchStats.read++;
    if (d.status === "replied") dispatchStats.replied++;
    if (d.status === "failed") dispatchStats.failed++;
  }

  // ── QUALIDADE META ────────────────────────────────────────────────
  const { data: latestQuality } = await supabase
    .from("meta_quality_tracking")
    .select("quality_rating, messaging_limit_tier, tier_limit, usage_pct, blocks_24h")
    .eq("company_id", company_id)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── EQUIPE ────────────────────────────────────────────────────────
  const { data: team } = await supabase
    .from("dispatch_permissions")
    .select("collaborator_id, role, daily_dispatch_limit, daily_dispatches_used, can_dispatch, is_active")
    .eq("company_id", company_id)
    .eq("is_active", true);

  const teamStats = {
    total: team?.length || 0,
    active_dispatchers: team?.filter((t: any) => t.can_dispatch && t.daily_dispatches_used > 0).length || 0,
    total_dispatches_today: team?.reduce((sum: number, t: any) => sum + (t.daily_dispatches_used || 0), 0) || 0,
    total_limit_today: team?.reduce((sum: number, t: any) => sum + (t.daily_dispatch_limit || 0), 0) || 0,
  };

  // ── CONVERSAS ATIVAS ──────────────────────────────────────────────
  const { count: activeConversations } = await supabase
    .from("whatsapp_ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("status", "active");

  const { count: handoffPending } = await supabase
    .from("whatsapp_ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("status", "handoff_requested");

  // ── FILAS ATIVAS ──────────────────────────────────────────────────
  const { data: callQueues } = await supabase
    .from("call_queues")
    .select("id, name, status, total_leads, leads_called, leads_opted_in")
    .eq("company_id", company_id)
    .eq("status", "active");

  const { data: dispatchQueues } = await supabase
    .from("dispatch_queues")
    .select("id, name, status, total_leads, dispatched, replied")
    .eq("company_id", company_id)
    .eq("status", "active");

  // ── ALERTAS ───────────────────────────────────────────────────────
  const alerts: string[] = [];

  if (latestQuality?.quality_rating === "RED") {
    alerts.push("🔴 Qualidade Meta VERMELHA — disparos pausados");
  } else if (latestQuality?.quality_rating === "YELLOW") {
    alerts.push("🟡 Qualidade Meta AMARELA — reduzir volume");
  }
  if ((latestQuality?.usage_pct || 0) > 40) {
    alerts.push(`⚠️ Uso do tier em ${latestQuality?.usage_pct}%`);
  }
  if ((handoffPending || 0) > 0) {
    alerts.push(`👤 ${handoffPending} conversa(s) aguardando atendimento humano`);
  }
  if (dispatchStats.failed > 0) {
    alerts.push(`❌ ${dispatchStats.failed} disparo(s) falharam hoje`);
  }

  return json({
    // Números de manchete
    headline: {
      total_leads: (leadsStats as any)?.total || 0,
      leads_hot: (leadsStats as any)?.hot || 0,
      calls_today: callStats.total,
      dispatches_today: dispatchStats.total,
      active_conversations: activeConversations || 0,
      conversions: (leadsStats as any)?.converted || 0,
    },

    // Detalhes por canal
    calls: {
      today: callStats,
      answer_rate: callStats.total > 0 ? Math.round((callStats.answered / callStats.total) * 100) : 0,
      opt_in_rate: callStats.answered > 0 ? Math.round((callStats.opted_in / callStats.answered) * 100) : 0,
    },
    whatsapp: {
      today: dispatchStats,
      delivery_rate: dispatchStats.sent > 0 ? Math.round((dispatchStats.delivered / dispatchStats.sent) * 100) : 0,
      read_rate: dispatchStats.delivered > 0 ? Math.round((dispatchStats.read / dispatchStats.delivered) * 100) : 0,
      reply_rate: dispatchStats.delivered > 0 ? Math.round((dispatchStats.replied / dispatchStats.delivered) * 100) : 0,
    },
    meta_quality: latestQuality || { quality_rating: "UNKNOWN", messaging_limit_tier: "UNKNOWN" },

    // Leads
    leads: leadsStats || {},

    // Equipe
    team: teamStats,

    // Conversas
    conversations: {
      active: activeConversations || 0,
      handoff_pending: handoffPending || 0,
    },

    // Filas
    queues: {
      call_queues: callQueues || [],
      dispatch_queues: dispatchQueues || [],
    },

    alerts,
  });
}

/**
 * KPIs semanais/mensais comparativos
 */
async function getKPIs(body: any) {
  const { company_id, requester_role } = body;

  if (!["ceo", "director", "manager"].includes(requester_role)) {
    return json({ error: "Sem acesso" }, 403);
  }

  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay() + 1); // segunda
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Chamadas esta semana vs semana passada
  const { count: callsThisWeek } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("created_at", thisWeekStart.toISOString());

  const { count: callsLastWeek } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("created_at", lastWeekStart.toISOString())
    .lt("created_at", thisWeekStart.toISOString());

  // Disparos este mês vs mês passado
  const { count: dispatchesThisMonth } = await supabase
    .from("smart_dispatches")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("created_at", thisMonthStart.toISOString())
    .in("status", ["sent", "delivered", "read", "replied"]);

  const { count: dispatchesLastMonth } = await supabase
    .from("smart_dispatches")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("created_at", lastMonthStart.toISOString())
    .lt("created_at", thisMonthStart.toISOString())
    .in("status", ["sent", "delivered", "read", "replied"]);

  // Opt-ins este mês
  const { count: optInsThisMonth } = await supabase
    .from("whatsapp_opt_ins")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("opt_in_at", thisMonthStart.toISOString())
    .eq("status", "active");

  // Conversões este mês
  const { count: conversionsThisMonth } = await supabase
    .from("leads_master")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("status", "converted")
    .gte("status_changed_at", thisMonthStart.toISOString());

  function pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  return json({
    weekly: {
      calls: {
        current: callsThisWeek || 0,
        previous: callsLastWeek || 0,
        change_pct: pctChange(callsThisWeek || 0, callsLastWeek || 0),
      },
    },
    monthly: {
      dispatches: {
        current: dispatchesThisMonth || 0,
        previous: dispatchesLastMonth || 0,
        change_pct: pctChange(dispatchesThisMonth || 0, dispatchesLastMonth || 0),
      },
      opt_ins: optInsThisMonth || 0,
      conversions: conversionsThisMonth || 0,
    },
  });
}

/**
 * Timeline de atividade recente (últimas 50 ações de todos os canais)
 */
async function getTimeline(body: any) {
  const { company_id, limit = 30 } = body;

  // Últimas ligações
  const { data: recentCalls } = await supabase
    .from("calls")
    .select("id, destination_number, lead_name, status, sentiment, whatsapp_authorized, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Últimos disparos
  const { data: recentDispatches } = await supabase
    .from("smart_dispatches")
    .select("id, phone_number, lead_name, template_name, status, dispatch_reason, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Últimos opt-ins
  const { data: recentOptIns } = await supabase
    .from("whatsapp_opt_ins")
    .select("id, phone_number, lead_name, opt_in_source, opt_in_at")
    .eq("company_id", company_id)
    .order("opt_in_at", { ascending: false })
    .limit(limit);

  // Mesclar e ordenar por data
  const timeline: any[] = [];

  for (const c of recentCalls || []) {
    timeline.push({
      type: "call",
      timestamp: c.created_at,
      phone: c.destination_number,
      name: c.lead_name,
      detail: `Ligação ${c.status}${c.whatsapp_authorized ? " — WhatsApp autorizado" : ""}`,
      sentiment: c.sentiment,
      id: c.id,
    });
  }

  for (const d of recentDispatches || []) {
    timeline.push({
      type: "dispatch",
      timestamp: d.created_at,
      phone: d.phone_number,
      name: d.lead_name,
      detail: `Template "${d.template_name}" — ${d.status}`,
      reason: d.dispatch_reason,
      id: d.id,
    });
  }

  for (const o of recentOptIns || []) {
    timeline.push({
      type: "opt_in",
      timestamp: o.opt_in_at,
      phone: o.phone_number,
      name: o.lead_name,
      detail: `Opt-in via ${o.opt_in_source}`,
      id: o.id,
    });
  }

  // Ordenar por timestamp DESC
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return json({ timeline: timeline.slice(0, limit) });
}


/**
 * Métricas completas de voz + WhatsApp por período
 */
async function getVoiceMetrics(body: any) {
  const { company_id, period = "today" } = body;

  if (!company_id) return json({ error: "company_id é obrigatório" }, 400);

  // Calcular janela temporal
  const now = new Date();
  let since: string;
  if (period === "today") {
    since = now.toISOString().split("T")[0] + "T00:00:00.000Z";
  } else if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    since = d.toISOString();
  } else {
    // month
    since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  // ── Métricas de Ligações ──
  const { data: calls } = await supabase
    .from("calls")
    .select("duration_seconds, interest_detected, eligible_for_whatsapp, status, whatsapp_authorized")
    .eq("company_id", company_id)
    .gte("created_at", since);

  const callStats = {
    total: 0,
    answered: 0,
    no_answer: 0,
    avg_duration_seconds: 0,
    interest_detected: 0,
    eligible_for_whatsapp: 0,
  };

  let totalDuration = 0;
  for (const c of calls || []) {
    callStats.total++;
    const dur = c.duration_seconds || 0;
    if (dur > 0) {
      callStats.answered++;
      totalDuration += dur;
    } else {
      callStats.no_answer++;
    }
    if (c.interest_detected) callStats.interest_detected++;
    if (c.eligible_for_whatsapp) callStats.eligible_for_whatsapp++;
  }
  if (callStats.answered > 0) {
    callStats.avg_duration_seconds = Math.round(totalDuration / callStats.answered);
  }

  // ── Métricas de WhatsApp ──
  const { data: dispatches } = await supabase
    .from("smart_dispatches")
    .select("status, template_name, dispatch_reason")
    .eq("company_id", company_id)
    .gte("created_at", since);

  const waStats = {
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    conversion_rate: 0,
  };

  const templateCounts: Record<string, { sent: number; replied: number }> = {};

  for (const d of dispatches || []) {
    if (["sent", "delivered", "read", "replied"].includes(d.status)) waStats.sent++;
    if (["delivered", "read", "replied"].includes(d.status)) waStats.delivered++;
    if (["read", "replied"].includes(d.status)) waStats.read++;
    if (d.status === "replied") waStats.replied++;

    const tname = d.template_name || "unknown";
    if (!templateCounts[tname]) templateCounts[tname] = { sent: 0, replied: 0 };
    if (["sent", "delivered", "read", "replied"].includes(d.status)) templateCounts[tname].sent++;
    if (d.status === "replied") templateCounts[tname].replied++;
  }

  if (waStats.sent > 0) {
    waStats.conversion_rate = Math.round((waStats.replied / waStats.sent) * 1000) / 10;
  }

  // ── Top templates ──
  const topTemplates = Object.entries(templateCounts)
    .map(([name, counts]) => ({
      name,
      sent: counts.sent,
      reply_rate: counts.sent > 0 ? Math.round((counts.replied / counts.sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 5);

  // ── Funil ──
  const funnel = {
    called: callStats.total,
    answered_30s: calls?.filter((c) => (c.duration_seconds || 0) >= 30).length || 0,
    whatsapp_sent: waStats.sent,
    whatsapp_replied: waStats.replied,
    converted: 0,
  };

  // Contar convertidos
  const { count: converted } = await supabase
    .from("leads_master")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("status", "converted")
    .gte("status_changed_at", since);
  funnel.converted = converted || 0;

  // ── Salvar em daily_metrics (upsert) ──
  const today = now.toISOString().split("T")[0];
  if (period === "today") {
    await supabase.from("daily_metrics").upsert(
      {
        company_id,
        metric_date: today,
        calls_total: callStats.total,
        calls_answered: callStats.answered,
        calls_eligible: callStats.eligible_for_whatsapp,
        wa_sent: waStats.sent,
        wa_replied: waStats.replied,
        wa_converted: funnel.converted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,metric_date" }
    );
  }

  return json({
    period,
    since,
    calls: callStats,
    whatsapp: waStats,
    funnel,
    top_templates: topTemplates,
  });
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
