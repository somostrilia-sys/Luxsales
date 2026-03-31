/**
 * dashboard-calls
 * Dashboard dedicado a ligações IA
 * Actions: overview, queue-stats, call-history, performance, lead-funnel
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
      case "queue-stats":
        return await getQueueStats(body);
      case "call-history":
        return await getCallHistory(body);
      case "performance":
        return await getPerformance(body);
      case "lead-funnel":
        return await getLeadFunnel(body);
      default:
        return json({ error: "Action inválida. Use: overview, queue-stats, call-history, performance, lead-funnel" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Visão geral das ligações — KPIs principais
 */
async function getOverview(body: any) {
  const { company_id, requester_role } = body;

  if (!["ceo", "director"].includes(requester_role)) {
    return json({ error: "Sem acesso ao dashboard de ligações" }, 403);
  }

  const today = new Date().toISOString().split("T")[0];
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Chamadas hoje
  const { data: callsToday } = await supabase
    .from("calls")
    .select("id, status, sentiment, whatsapp_authorized, duration_seconds, lead_name, destination_number")
    .eq("company_id", company_id)
    .gte("created_at", today);

  const todayStats = {
    total: callsToday?.length || 0,
    answered: 0,
    no_answer: 0,
    whatsapp_authorized: 0,
    avg_duration_sec: 0,
    sentiment_positive: 0,
    sentiment_negative: 0,
  };

  let totalDuration = 0;
  for (const c of callsToday || []) {
    if (c.status === "completed" || c.status === "answered") todayStats.answered++;
    if (c.status === "no_answer" || c.status === "missed") todayStats.no_answer++;
    if (c.whatsapp_authorized) todayStats.whatsapp_authorized++;
    if (c.sentiment === "positive" || c.sentiment === "interested") todayStats.sentiment_positive++;
    if (c.sentiment === "negative") todayStats.sentiment_negative++;
    if (c.duration_seconds) totalDuration += c.duration_seconds;
  }
  todayStats.avg_duration_sec = todayStats.answered > 0 ? Math.round(totalDuration / todayStats.answered) : 0;

  // Chamadas 7 dias (resumo)
  const { count: calls7d } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("created_at", since7d);

  const { count: answered7d } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("created_at", since7d)
    .in("status", ["completed", "answered"]);

  const { count: optedIn7d } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("created_at", since7d)
    .eq("whatsapp_authorized", true);

  // Leads master — contadores de ligação
  let leadsStats: any = null;
  try {
    const rpcResult = await supabase.rpc("leads_master_stats", { p_company_id: company_id });
    leadsStats = rpcResult.data;
  } catch { /* ignore */ }

  // Filas ativas
  const { data: activeQueues } = await supabase
    .from("call_queues")
    .select("id, name, status, total_leads, leads_called, leads_answered, leads_opted_in, leads_converted, max_daily_calls")
    .eq("company_id", company_id)
    .eq("status", "active");

  // Próximas ligações agendadas
  const { count: scheduledCalls } = await supabase
    .from("leads_master")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .not("next_call_at", "is", null)
    .in("status", ["new", "queued_call", "called"]);

  return json({
    today: todayStats,
    week: {
      total_calls: calls7d || 0,
      answered: answered7d || 0,
      opted_in: optedIn7d || 0,
      answer_rate: (calls7d || 0) > 0 ? Math.round(((answered7d || 0) / (calls7d || 1)) * 100) : 0,
      opt_in_rate: (answered7d || 0) > 0 ? Math.round(((optedIn7d || 0) / (answered7d || 1)) * 100) : 0,
    },
    leads_master: leadsStats || {},
    active_queues: activeQueues || [],
    scheduled_callbacks: scheduledCalls || 0,
  });
}

/**
 * Estatísticas de filas de ligação
 */
async function getQueueStats(body: any) {
  const { company_id, queue_id } = body;

  let query = supabase
    .from("call_queues")
    .select("*")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false });

  if (queue_id) {
    query = query.eq("id", queue_id);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  // Para cada fila, calcular leads restantes
  const queues = [];
  for (const q of data || []) {
    const { count } = await supabase
      .from("leads_master")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id)
      .eq("status", "new")
      .lt("total_call_attempts", q.max_retries || 3);

    queues.push({
      ...q,
      leads_remaining: count || 0,
      completion_pct: q.total_leads > 0 ? Math.round((q.leads_called / q.total_leads) * 100) : 0,
      conversion_rate: q.leads_answered > 0 ? Math.round((q.leads_opted_in / q.leads_answered) * 100) : 0,
    });
  }

  return json({ queues });
}

/**
 * Histórico de chamadas (paginado)
 */
async function getCallHistory(body: any) {
  const { company_id, limit = 50, offset = 0, status_filter, date_from, date_to } = body;

  let query = supabase
    .from("calls")
    .select("id, destination_number, lead_name, status, sentiment, duration_seconds, whatsapp_authorized, call_summary, extracted_data, created_at", { count: "exact" })
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status_filter) query = query.eq("status", status_filter);
  if (date_from) query = query.gte("created_at", date_from);
  if (date_to) query = query.lte("created_at", date_to);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);

  // Normalizar campos para o frontend (aliases)
  const calls = (data || []).map((c: any) => ({
    ...c,
    phone: c.destination_number,
    summary: c.call_summary,
    duration: c.duration_seconds,
  }));

  return json({ calls, total: count });
}

/**
 * Performance de ligações (métricas de conversão)
 */
async function getPerformance(body: any) {
  const { company_id, period = "30d" } = body;

  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: calls } = await supabase
    .from("calls")
    .select("status, sentiment, whatsapp_authorized, duration_seconds, created_at")
    .eq("company_id", company_id)
    .gte("created_at", since);

  const total = calls?.length || 0;
  let answered = 0, waAuth = 0, positiveSentiment = 0, totalDuration = 0;

  // Agrupar por dia
  const dailyMap: Record<string, { total: number; answered: number; opted_in: number }> = {};

  for (const c of calls || []) {
    const day = c.created_at?.split("T")[0];
    if (!dailyMap[day]) dailyMap[day] = { total: 0, answered: 0, opted_in: 0 };
    dailyMap[day].total++;

    if (c.status === "completed" || c.status === "answered") {
      answered++;
      dailyMap[day].answered++;
    }
    if (c.whatsapp_authorized) {
      waAuth++;
      dailyMap[day].opted_in++;
    }
    if (c.sentiment === "positive" || c.sentiment === "interested") positiveSentiment++;
    if (c.duration_seconds) totalDuration += c.duration_seconds;
  }

  // Converter mapa pra array ordenado
  const daily = Object.entries(dailyMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return json({
    period: `${days}d`,
    totals: {
      calls: total,
      answered,
      opted_in: waAuth,
      answer_rate: total > 0 ? Math.round((answered / total) * 100) : 0,
      opt_in_rate: answered > 0 ? Math.round((waAuth / answered) * 100) : 0,
      positive_sentiment_pct: answered > 0 ? Math.round((positiveSentiment / answered) * 100) : 0,
      avg_duration_sec: answered > 0 ? Math.round(totalDuration / answered) : 0,
      total_minutes: Math.round(totalDuration / 60),
    },
    daily,
  });
}

/**
 * Funil de leads (leads_master → chamada → opt-in → disparo → conversão)
 */
async function getLeadFunnel(body: any) {
  const { company_id } = body;

  // Stats do leads_master
  let stats: any = null;
  try {
    const rpcResult = await supabase.rpc("leads_master_stats", { p_company_id: company_id });
    stats = rpcResult.data;
  } catch { /* ignore */ }

  if (!stats) {
    // Fallback manual
    const { count: total } = await supabase
      .from("leads_master")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id);

    return json({
      funnel: {
        total_leads: total || 0,
        message: "Execute a função leads_master_stats para métricas completas",
      },
    });
  }

  const s = stats as any;
  const totalActive = (s.total || 0) - (s.lost || 0) - (s.dnc || 0) - (s.invalid || 0);

  return json({
    funnel: {
      total_leads: s.total || 0,
      total_active: totalActive,
      stages: {
        new: s.new || 0,
        queued_call: s.queued_call || 0,
        calling: s.calling || 0,
        called: s.called || 0,
        opted_in: s.opted_in || 0,
        queued_dispatch: s.queued_dispatch || 0,
        dispatched: s.dispatched || 0,
        engaged: s.engaged || 0,
        converted: s.converted || 0,
      },
      discarded: {
        lost: s.lost || 0,
        dnc: s.dnc || 0,
        invalid: s.invalid || 0,
      },
      temperature: {
        hot: s.hot || 0,
        warm: s.warm || 0,
        cold: s.cold || 0,
      },
      avg_score: s.avg_score || 0,
    },
    conversion_rates: {
      call_to_answer: "Calculado no dashboard-calls overview",
      answer_to_optin: "Calculado no dashboard-calls overview",
      optin_to_engaged: (s.opted_in || 0) > 0 ? Math.round(((s.engaged || 0) / s.opted_in) * 100) : 0,
      engaged_to_converted: (s.engaged || 0) > 0 ? Math.round(((s.converted || 0) / s.engaged) * 100) : 0,
    },
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
