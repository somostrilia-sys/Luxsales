/**
 * quality-monitor
 * Monitora qualidade do número e tier de envio via Meta API
 * - Check automático (chamado por cron a cada 1h)
 * - Alertas quando quality degrada
 * - Ações automáticas (pausar envios se RED)
 * - Histórico de evolução de tier
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_API = "https://graph.facebook.com/v22.0";

const TIER_LIMITS: Record<string, number> = {
  STANDARD: 1000,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: 999999,
  UNLIMITED: 999999,
};

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
      case "check":
        return await checkQuality(body);
      case "history":
        return await getHistory(body);
      case "tier-history":
        return await getTierHistory(body);
      case "dashboard":
        return await getDashboard(body);
      case "template-quality":
        return await getTemplateQuality(body);
      default:
        return json({ error: "Action inválida" }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

/**
 * Check qualidade via Meta API e salvar
 */
async function checkQuality(body: any) {
  const { company_id, company_only } = body;

  // 1. Buscar credenciais da empresa primeiro
  const cfg: Record<string, string> = {};

  if (company_id) {
    const { data: cred } = await supabase
      .from("whatsapp_meta_credentials")
      .select("meta_access_token, meta_phone_number_id, meta_waba_id, access_token, phone_number_id, waba_id")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .maybeSingle();

    if (cred) {
      cfg.meta_whatsapp_token = cred.meta_access_token || cred.access_token || "";
      cfg.meta_phone_number_id = cred.meta_phone_number_id || cred.phone_number_id || "";
      cfg.meta_waba_id = cred.meta_waba_id || cred.waba_id || "";
    }
  }

  // 2. Fallback: credenciais globais (só se não for company_only)
  if (!company_only && (!cfg.meta_whatsapp_token || !cfg.meta_phone_number_id)) {
    const { data: globalConfig } = await supabase
      .from("system_configs")
      .select("key, value")
      .in("key", ["meta_whatsapp_token", "meta_phone_number_id", "meta_waba_id"]);

    for (const c of globalConfig || []) {
      if (!cfg[c.key]) cfg[c.key] = c.value;
    }
  }

  if (!cfg.meta_whatsapp_token || !cfg.meta_phone_number_id) {
    return json({ error: "Credenciais Meta não configuradas" }, 400);
  }

  // Buscar dados do número na Meta
  const fields = "quality_rating,messaging_limit_tier,throughput,verified_name,code_verification_status,status";
  const res = await fetch(
    `${META_API}/${cfg.meta_phone_number_id}?fields=${fields}`,
    {
      headers: { Authorization: `Bearer ${cfg.meta_whatsapp_token}` },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    return json({ error: `Meta API: ${err.error?.message || res.status}` }, 500);
  }

  const metaData = await res.json();

  // Mapear tier (Meta API pode retornar STANDARD, TIER_1K, etc.)
  const tierMap: Record<string, string> = {
    STANDARD: "STANDARD",
    TIER_250: "TIER_250",
    TIER_1K: "TIER_1K",
    TIER_10K: "TIER_10K",
    TIER_100K: "TIER_100K",
    TIER_UNLIMITED: "TIER_UNLIMITED",
    UNLIMITED: "TIER_UNLIMITED",
  };

  const quality = metaData.quality_rating || "UNKNOWN";
  const tierRaw = metaData.messaging_limit_tier || metaData.messaging_limit || metaData.throughput?.level || "UNKNOWN";
  const tier = tierMap[tierRaw] || tierRaw;
  const tierLimit = TIER_LIMITS[tier] || 0;

  // Contar conversas das últimas 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: conversations24h } = await supabase
    .from("smart_dispatches")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .gte("sent_at", since24h)
    .in("status", ["sent", "delivered", "read", "replied"]);

  const conv24h = conversations24h || 0;
  const usagePct = tierLimit > 0 ? Math.round((conv24h / tierLimit) * 10000) / 100 : 0;

  // Contar blocks e reports (estimativa baseada em falhas)
  const { count: blocks24h } = await supabase
    .from("smart_dispatches")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("status", "failed")
    .gte("failed_at", since24h);

  // Buscar quality scores dos templates
  const { data: templatePerf } = await supabase
    .from("template_performance")
    .select("template_name, performance_score, block_rate, meta_quality_score")
    .eq("company_id", company_id);

  const templateScores: Record<string, any> = {};
  for (const t of templatePerf || []) {
    templateScores[t.template_name] = {
      score: t.performance_score,
      block_rate: t.block_rate,
      quality: t.meta_quality_score,
    };
  }

  // Templates pausados pela Meta
  const { data: pausedTemplates } = await supabase
    .from("whatsapp_meta_templates")
    .select("name, status")
    .eq("company_id", company_id)
    .eq("status", "PAUSED");

  // Salvar tracking
  const tracking = {
    company_id,
    phone_number_id: cfg.meta_phone_number_id,
    quality_rating: quality,
    messaging_limit_tier: tier,
    conversations_24h: conv24h,
    tier_limit: tierLimit,
    usage_pct: usagePct,
    blocks_24h: blocks24h || 0,
    reports_24h: 0, // Meta não expõe isso diretamente
    template_quality_scores: templateScores,
    templates_paused: (pausedTemplates || []).map((t: any) => t.name),
    checked_at: new Date().toISOString(),
  };

  await supabase.from("meta_quality_tracking").insert(tracking);

  // Verificar mudança de tier/quality
  const { data: previous } = await supabase
    .from("meta_quality_tracking")
    .select("quality_rating, messaging_limit_tier")
    .eq("company_id", company_id)
    .order("checked_at", { ascending: false })
    .range(1, 1) // pegar o anterior (não o que acabou de inserir)
    .maybeSingle();

  if (previous) {
    const tierChanged = previous.messaging_limit_tier !== tier;
    const qualityChanged = previous.quality_rating !== quality;

    if (tierChanged || qualityChanged) {
      await supabase.from("meta_tier_history").insert({
        company_id,
        phone_number_id: cfg.meta_phone_number_id,
        old_tier: previous.messaging_limit_tier,
        new_tier: tier,
        old_quality: previous.quality_rating,
        new_quality: quality,
        trigger_event: "auto_check",
        notes: tierChanged
          ? `Tier mudou: ${previous.messaging_limit_tier} → ${tier}`
          : `Quality mudou: ${previous.quality_rating} → ${quality}`,
      });
    }
  }

  // Alertas
  const alerts: string[] = [];
  if (quality === "RED") {
    alerts.push("CRÍTICO: Qualidade VERMELHA — envios pausados automaticamente");
  } else if (quality === "YELLOW") {
    alerts.push("ATENÇÃO: Qualidade AMARELA — reduzir volume");
  }
  if (usagePct > 40) {
    alerts.push(`Uso do tier em ${usagePct}% — próximo do limite seguro (50%)`);
  }
  if ((pausedTemplates || []).length > 0) {
    alerts.push(`${pausedTemplates!.length} template(s) pausado(s) pela Meta`);
  }

  return json({
    quality,
    tier,
    tier_limit: tierLimit,
    conversations_24h: conv24h,
    usage_pct: usagePct,
    blocks_24h: blocks24h || 0,
    template_scores: templateScores,
    paused_templates: (pausedTemplates || []).map((t: any) => t.name),
    alerts,
    verified_name: metaData.verified_name,
    phone_status: metaData.status,
  });
}

/**
 * Histórico de quality checks
 */
async function getHistory(body: any) {
  const { company_id, limit = 24, offset = 0 } = body;

  const { data, error } = await supabase
    .from("meta_quality_tracking")
    .select("*")
    .eq("company_id", company_id)
    .order("checked_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return json({ error: error.message }, 500);
  return json({ history: data });
}

/**
 * Histórico de mudanças de tier
 */
async function getTierHistory(body: any) {
  const { company_id } = body;

  const { data, error } = await supabase
    .from("meta_tier_history")
    .select("*")
    .eq("company_id", company_id)
    .order("changed_at", { ascending: false })
    .limit(50);

  if (error) return json({ error: error.message }, 500);
  return json({ tier_history: data });
}

/**
 * Dashboard completo para CEO
 */
async function getDashboard(body: any) {
  const { company_id, requester_role } = body;

  if (requester_role !== "ceo" && requester_role !== "director") {
    return json({ error: "Sem acesso ao dashboard de qualidade" }, 403);
  }

  // Quality atual
  const qualityResult = await checkQuality({ company_id });
  const qualityData = await qualityResult.json();

  // Dispatches hoje
  const today = new Date().toISOString().split("T")[0];
  const { data: todayDispatches } = await supabase
    .from("smart_dispatches")
    .select("status")
    .eq("company_id", company_id)
    .gte("created_at", today);

  const dispatchStats = {
    total: todayDispatches?.length || 0,
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    failed: 0,
  };

  for (const d of todayDispatches || []) {
    if (d.status in dispatchStats) (dispatchStats as any)[d.status]++;
  }

  // Templates performance
  const { data: templates } = await supabase
    .from("template_performance")
    .select("*")
    .eq("company_id", company_id)
    .order("performance_score", { ascending: false });

  // Vendedores ativos
  const { data: permissions } = await supabase
    .from("dispatch_permissions")
    .select("collaborator_id, role, daily_dispatch_limit, daily_dispatches_used")
    .eq("company_id", company_id)
    .eq("is_active", true);

  return json({
    quality: qualityData,
    dispatches_today: dispatchStats,
    templates: templates || [],
    active_sellers: permissions?.length || 0,
    seller_usage: permissions || [],
  });
}

/**
 * Quality por template
 */
async function getTemplateQuality(body: any) {
  const { company_id, template_name } = body;

  // Recalcular performance
  try {
    await supabase.rpc("recalculate_template_performance", {
      p_company_id: company_id,
      p_template_name: template_name,
    });
  } catch { /* ignore */ }

  const { data } = await supabase
    .from("template_performance")
    .select("*")
    .eq("company_id", company_id)
    .eq("template_name", template_name)
    .maybeSingle();

  if (!data) return json({ error: "Sem dados de performance" }, 404);
  return json({ performance: data });
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
