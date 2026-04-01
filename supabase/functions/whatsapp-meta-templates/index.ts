import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getMetaConfig(supabase: any, companyId?: string) {
  const keys = ["meta_whatsapp_token", "meta_waba_id", "meta_phone_number_id"];

  // Tentar config da empresa primeiro, fallback para global
  if (companyId) {
    const { data: companyData } = await supabase
      .from("system_configs")
      .select("key, value")
      .eq("company_id", companyId)
      .in("key", keys);
    if (companyData && companyData.length > 0) {
      const cfg: Record<string, string> = {};
      for (const row of companyData) cfg[row.key] = row.value;
      // Se encontrou ao menos token e waba_id, usar da empresa
      if (cfg.meta_whatsapp_token && cfg.meta_waba_id) return cfg;
    }
  }

  // Fallback: config global (sem company_id ou company_id IS NULL)
  const { data } = await supabase
    .from("system_configs")
    .select("key, value")
    .in("key", keys)
    .is("company_id", null);
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value;
  return cfg;
}

async function syncTemplates(supabase: any, cfg: Record<string, string>, companyId?: string) {
  if (!companyId) {
    return json({ error: "company_id é obrigatório para sync" }, 400);
  }

  const token = cfg.meta_whatsapp_token;
  const wabaId = cfg.meta_waba_id;
  if (!token || !wabaId) {
    return json({ error: "Meta token ou WABA ID não configurados em system_configs" }, 400);
  }

  // Buscar TODOS os templates da Meta (paginar se necessário)
  let allMetaTemplates: any[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?limit=100`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: `Erro Meta API: ${res.status}`, details: err }, 502);
    }

    const page = await res.json();
    allMetaTemplates = allMetaTemplates.concat(page.data || []);
    nextUrl = page.paging?.next || null;
  }

  // Set de meta_template_ids reais da Meta
  const metaIds = new Set(allMetaTemplates.map((t: any) => t.id));
  const metaNames = new Set(allMetaTemplates.map((t: any) => `${t.name}__${t.language}`));

  let created = 0;
  let updated = 0;
  let disabled = 0;
  let errors: string[] = [];

  // Atualizar/criar templates que existem na Meta
  for (const t of allMetaTemplates) {
    const row: Record<string, any> = {
      name: t.name,
      category: t.category,
      language: t.language,
      status: t.status,
      meta_template_id: t.id,
      components: t.components || [],
      quality_score: t.quality_score?.score || null,
      rejection_reason: t.rejected_reason || null,
      updated_at: new Date().toISOString(),
    };

    row.company_id = companyId;

    // Buscar por meta_template_id + company_id (evita duplicatas entre empresas)
    const { data: existing } = await supabase
      .from("whatsapp_meta_templates")
      .select("id")
      .eq("meta_template_id", t.id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("whatsapp_meta_templates")
        .update(row)
        .eq("meta_template_id", t.id)
        .eq("company_id", companyId);

      if (error) {
        errors.push(`${t.name}: ${error.message}`);
        continue;
      }
      updated++;
    } else {
      const { error } = await supabase
        .from("whatsapp_meta_templates")
        .insert(row);

      if (error) {
        const { error: e2 } = await supabase
          .from("whatsapp_meta_templates")
          .update(row)
          .eq("name", t.name)
          .eq("language", t.language);

        if (e2) {
          errors.push(`${t.name}: ${e2.message}`);
          continue;
        }
        updated++;
        continue;
      }
      created++;
    }
  }

  // CRÍTICO: Marcar templates locais que NÃO existem na Meta como DISABLED
  // Isso remove "fantasmas" — templates que estão no banco mas não na Meta
  const { data: localTemplates } = await supabase
    .from("whatsapp_meta_templates")
    .select("id, name, language, meta_template_id, status")
    .eq("company_id", companyId)
    .in("status", ["APPROVED", "PENDING"]);

  for (const local of localTemplates || []) {
    const existsOnMeta = local.meta_template_id
      ? metaIds.has(local.meta_template_id)
      : metaNames.has(`${local.name}__${local.language}`);

    if (!existsOnMeta) {
      await supabase
        .from("whatsapp_meta_templates")
        .update({
          status: "DISABLED",
          rejection_reason: "Template não encontrado na Meta API durante sync — removido ou nunca aprovado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", local.id);
      disabled++;
    }
  }

  return json({
    success: true,
    created,
    updated,
    disabled,
    synced: created + updated,
    total_on_meta: allMetaTemplates.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

async function deleteTemplate(supabase: any, cfg: Record<string, string>, name: string, companyId?: string) {
  const token = cfg.meta_whatsapp_token;
  const wabaId = cfg.meta_waba_id;
  if (!token || !wabaId) {
    return json({ error: "Meta token ou WABA ID não configurados" }, 400);
  }

  // Delete from Meta
  const url = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  let metaDeleted = false;
  let metaError: any = null;

  if (res.ok) {
    metaDeleted = true;
  } else {
    metaError = await res.json().catch(() => ({ error: `Status ${res.status}` }));
  }

  // Always delete from local DB
  let delQuery = supabase
    .from("whatsapp_meta_templates")
    .delete()
    .eq("name", name);
  if (companyId) delQuery = delQuery.eq("company_id", companyId);
  await delQuery;

  return json({
    success: true,
    deleted: name,
    meta_deleted: metaDeleted,
    meta_warning: metaDeleted ? undefined : "Removido do banco local, mas falhou na Meta (permissão). Requer whatsapp_business_management no System User.",
    meta_error: metaDeleted ? undefined : metaError,
  });
}

async function listTemplates(supabase: any, companyId?: string) {
  let query = supabase
    .from("whatsapp_meta_templates")
    .select("*")
    .not("status", "eq", "DISABLED")
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;

  if (error) return json({ error: error.message }, 500);

  // Deduplicar por name+language (manter mais recente)
  const seen = new Map<string, any>();
  for (const t of data || []) {
    const key = `${t.name}__${t.language}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  const unique = Array.from(seen.values());

  return json({ templates: unique, total: unique.length });
}

async function createTemplate(supabase: any, cfg: Record<string, string>, body: any) {
  const token = cfg.meta_whatsapp_token;
  const wabaId = cfg.meta_waba_id;
  if (!token || !wabaId) {
    return json({ error: "Meta token ou WABA ID não configurados" }, 400);
  }

  const { name, category, language, components } = body;
  if (!name || !category || !language || !components) {
    return json({ error: "name, category, language e components são obrigatórios" }, 400);
  }

  const res = await fetch(`https://graph.facebook.com/v22.0/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, category, language, components }),
  });

  const result = await res.json();

  if (!res.ok) {
    return json({ error: "Erro ao criar template na Meta", details: result }, 502);
  }

  // Save locally
  const row: Record<string, any> = {
    name,
    category,
    language,
    status: result.status || "PENDING",
    meta_template_id: result.id,
    components,
    updated_at: new Date().toISOString(),
  };
  if (body.company_id) row.company_id = body.company_id;

  // Evitar duplicata: checar se já existe por meta_template_id + company_id
  if (body.company_id && result.id) {
    const { data: existing } = await supabase
      .from("whatsapp_meta_templates")
      .select("id")
      .eq("meta_template_id", result.id)
      .eq("company_id", body.company_id)
      .maybeSingle();
    if (existing) {
      await supabase.from("whatsapp_meta_templates").update(row).eq("id", existing.id);
    } else {
      await supabase.from("whatsapp_meta_templates").insert(row).catch(() => {});
    }
  } else {
    await supabase.from("whatsapp_meta_templates").insert(row).catch(() => {});
  }

  return json({ success: true, template_id: result.id, status: result.status });
}

async function updateTemplate(supabase: any, cfg: Record<string, string>, body: any) {
  const token = cfg.meta_whatsapp_token;
  const wabaId = cfg.meta_waba_id;
  if (!token || !wabaId) {
    return json({ error: "Meta token ou WABA ID não configurados" }, 400);
  }

  const { name, category, language, components, company_id } = body;
  if (!name || !components) {
    return json({ error: "name e components são obrigatórios para update" }, 400);
  }

  // Step 1: Fetch the template from Meta to get the template_id
  const lang = language || "pt_BR";
  const searchUrl = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?name=${encodeURIComponent(name)}&limit=100`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    return json({ error: `Erro ao buscar template na Meta: ${searchRes.status}`, details: err }, 502);
  }

  const { data: metaTemplates } = await searchRes.json();

  // Find the matching template by name (and optionally language)
  const match = (metaTemplates || []).find(
    (t: any) => t.name === name && (!language || t.language === language)
  );

  if (!match) {
    return json({
      error: `Template '${name}' não encontrado na Meta API`,
      hint: "Verifique se o nome está correto ou crie um novo template com action 'create'",
    }, 404);
  }

  const templateId = match.id;

  // Step 2: POST to /{template_id} with updated components
  const updatePayload: Record<string, any> = { components };
  if (category) updatePayload.category = category;

  const updateRes = await fetch(`https://graph.facebook.com/v22.0/${templateId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  const updateResult = await updateRes.json();

  if (!updateRes.ok) {
    return json({ error: "Erro ao atualizar template na Meta", details: updateResult }, 502);
  }

  // Step 3: Update local DB
  const row: Record<string, any> = {
    components,
    status: "PENDING",
    updated_at: new Date().toISOString(),
  };
  if (category) row.category = category;
  if (company_id) row.company_id = company_id;

  const { error: dbError } = await supabase
    .from("whatsapp_meta_templates")
    .update(row)
    .eq("meta_template_id", templateId);

  // If no row matched by meta_template_id, try by name
  if (dbError) {
    await supabase
      .from("whatsapp_meta_templates")
      .update({ ...row, meta_template_id: templateId })
      .eq("name", name)
      .catch(() => {});
  }

  return json({
    success: true,
    template_id: templateId,
    status: updateResult.success ? "PENDING" : updateResult.status,
    meta_response: updateResult,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const companyId = url.searchParams.get("company_id") || undefined;
      return await listTemplates(supabase, companyId);
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const name = url.searchParams.get("name");
      const cfg = await getMetaConfig(supabase);
      if (!name) {
        const body = await req.json().catch(() => ({}));
        if (body.name) return await deleteTemplate(supabase, cfg, body.name, body.company_id);
        return json({ error: "Parâmetro 'name' obrigatório" }, 400);
      }
      return await deleteTemplate(supabase, cfg, name);
    }

    // POST
    const body = await req.json();
    const action = body.action || "create";
    const cfg = await getMetaConfig(supabase, body.company_id);

    switch (action) {
      case "sync":
        return await syncTemplates(supabase, cfg, body.company_id);
      case "delete": {
        const tplName = body.name || body.template_name;
        if (!tplName) return json({ error: "name ou template_name obrigatório" }, 400);
        return await deleteTemplate(supabase, cfg, tplName, body.company_id);
      }
      case "create":
        return await createTemplate(supabase, cfg, body);
      case "update":
        return await updateTemplate(supabase, cfg, body);
      case "list":
        return await listTemplates(supabase, body.company_id);
      default:
        return json({ error: `Action '${action}' não suportada` }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
