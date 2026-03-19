// WhatsApp Meta Template Management
// CRUD de templates + sync com Meta API
// Endpoints: GET (listar/sync), POST (criar), DELETE (deletar)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const META_API_BASE = "https://graph.facebook.com";

interface TemplateRequest {
  company_id: string;
  action: "create" | "sync" | "delete" | "list";
  // Para create
  name?: string;
  language?: string;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components?: unknown[];
  // Para delete
  template_name?: string;
  template_id?: string;
}

async function getCredentials(companyId: string) {
  const { data } = await supabase
    .from("whatsapp_meta_credentials")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .single();
  return data;
}

// Sincronizar templates da Meta com o banco local
async function syncTemplates(companyId: string) {
  const creds = await getCredentials(companyId);
  if (!creds) return { error: "Credentials not found" };

  const apiVersion = creds.api_version || "v21.0";
  const wabaId = creds.meta_waba_id;

  const response = await fetch(
    `${META_API_BASE}/${apiVersion}/${wabaId}/message_templates?limit=250`,
    {
      headers: { Authorization: `Bearer ${creds.meta_access_token}` },
    },
  );

  if (!response.ok) {
    const err = await response.json();
    return { error: "Meta API error", details: err };
  }

  const result = await response.json();
  const templates = result.data || [];

  let synced = 0;
  let created = 0;
  let updated = 0;

  for (const tmpl of templates) {
    const { data: existing } = await supabase
      .from("whatsapp_meta_templates")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", tmpl.name)
      .eq("language", tmpl.language)
      .single();

    const templateData = {
      company_id: companyId,
      meta_template_id: tmpl.id,
      name: tmpl.name,
      language: tmpl.language,
      category: tmpl.category,
      sub_category: tmpl.sub_category || null,
      status: tmpl.status,
      quality_score: tmpl.quality_score?.score || "UNKNOWN",
      components: tmpl.components || [],
      rejection_reason: tmpl.rejected_reason || null,
      previous_category: tmpl.previous_category || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase
        .from("whatsapp_meta_templates")
        .update(templateData)
        .eq("id", existing.id);
      updated++;
    } else {
      await supabase
        .from("whatsapp_meta_templates")
        .insert({
          ...templateData,
          approved_at: tmpl.status === "APPROVED" ? new Date().toISOString() : null,
        });
      created++;
    }
    synced++;
  }

  return { synced, created, updated, total_from_meta: templates.length };
}

// Criar template na Meta
async function createTemplate(companyId: string, body: TemplateRequest) {
  const creds = await getCredentials(companyId);
  if (!creds) return { error: "Credentials not found" };

  if (!body.name || !body.category || !body.components) {
    return { error: "name, category, and components are required" };
  }

  const apiVersion = creds.api_version || "v21.0";
  const wabaId = creds.meta_waba_id;

  const payload = {
    name: body.name,
    language: body.language || "pt_BR",
    category: body.category,
    components: body.components,
  };

  const response = await fetch(
    `${META_API_BASE}/${apiVersion}/${wabaId}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    return { error: "Meta API error", details: result };
  }

  // Salvar no banco
  await supabase.from("whatsapp_meta_templates").insert({
    company_id: companyId,
    meta_template_id: result.id,
    name: body.name,
    language: body.language || "pt_BR",
    category: body.category,
    status: result.status || "PENDING",
    components: body.components,
  });

  await supabase.from("audit_logs").insert({
    company_id: companyId,
    table_name: "whatsapp_meta_templates",
    action: "INSERT",
    actor_type: "api",
    metadata: { template_name: body.name, category: body.category, meta_id: result.id },
  });

  return { success: true, template_id: result.id, status: result.status };
}

// Deletar template na Meta
async function deleteTemplate(companyId: string, templateName: string) {
  const creds = await getCredentials(companyId);
  if (!creds) return { error: "Credentials not found" };

  const apiVersion = creds.api_version || "v21.0";
  const wabaId = creds.meta_waba_id;

  const response = await fetch(
    `${META_API_BASE}/${apiVersion}/${wabaId}/message_templates?name=${templateName}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${creds.meta_access_token}` },
    },
  );

  const result = await response.json();

  if (response.ok) {
    await supabase
      .from("whatsapp_meta_templates")
      .update({ status: "DELETED", updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("name", templateName);
  }

  return { success: response.ok, details: result };
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id");
    if (!companyId) {
      return Response.json({ error: "company_id required" }, { status: 400 });
    }

    const { data: templates } = await supabase
      .from("whatsapp_meta_templates")
      .select("*")
      .eq("company_id", companyId)
      .neq("status", "DELETED")
      .order("category")
      .order("name");

    return Response.json({ templates });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: TemplateRequest = await req.json();
    const { company_id, action } = body;

    if (!company_id || !action) {
      return Response.json({ error: "company_id and action required" }, { status: 400 });
    }

    let result;

    switch (action) {
      case "sync":
        result = await syncTemplates(company_id);
        break;
      case "create":
        result = await createTemplate(company_id, body);
        break;
      case "delete":
        if (!body.template_name) {
          return Response.json({ error: "template_name required" }, { status: 400 });
        }
        result = await deleteTemplate(company_id, body.template_name);
        break;
      case "list":
        const { data } = await supabase
          .from("whatsapp_meta_templates")
          .select("*")
          .eq("company_id", company_id)
          .neq("status", "DELETED");
        result = { templates: data };
        break;
      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    if (result && "error" in result) {
      return Response.json(result, { status: 400 });
    }

    return Response.json(result);
  } catch (err) {
    console.error("Template error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
